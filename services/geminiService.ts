
import { GoogleGenAI } from "@google/genai";
import { Message, Sender, AnalysisResult, AssessmentScores, CandidateProfile, BigFiveTraits } from "../types";

const apiKey = process.env.API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey });

export const sendMessageToGemini = async (
  history: Message[],
  latestUserMessage: string,
  systemInstruction: string 
): Promise<{ text: string; analysis: AnalysisResult | null }> => {
  try {
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: systemInstruction, 
        temperature: 0.3,
      },
      history: history.slice(0, -1).map(msg => ({
        role: msg.sender === Sender.USER ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }))
    });

    const result = await chat.sendMessage({
      message: latestUserMessage
    });

    const responseText = result.text;
    
    // Updated Regex: More robust, allows spaces instead of strict newlines
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    let analysis: AnalysisResult | null = null;
    let cleanText = responseText;

    if (jsonMatch && jsonMatch[1]) {
      try {
        analysis = JSON.parse(jsonMatch[1]);
        // Remove the JSON block from the text shown to user
        cleanText = responseText.replace(/```json\s*[\s\S]*?\s*```/, '').trim();
      } catch (e) {
        console.error("Failed to parse analysis JSON", e);
      }
    }

    return {
      text: cleanText,
      analysis: analysis
    };

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

interface FinalAnalysisReport {
    summary: string;
    psychometrics: BigFiveTraits;
    cultureFitScore: number;
    starMethodScore: number;
}

export const generateFinalSummary = async (
    profile: CandidateProfile,
    role: string,
    simScores: AssessmentScores,
    simFeedback: string,
    logicScore: number
): Promise<FinalAnalysisReport> => {
    try {
        // UPDATED PROMPT FOR OWNER'S REQUEST (MOBENG EXCELLENCE FORMAT)
        const prompt = `
        Role: Expert I/O Psychologist & Recruitment Director at Mobeng (Automotive Retail).
        Task: Analyze candidate performance based on SJT (Situational Judgement Test) and Logic Test.
        
        Candidate: ${profile.name} (Position: ${role})
        
        DATA:
        1. Behavioral SJT Scores (0-10): Sales(${simScores.sales}), Leadership(${simScores.leadership}), Ops(${simScores.operations}), CX(${simScores.cx})
        2. AI Feedback Log: "${simFeedback}"
        3. Logic Test Score: ${logicScore.toFixed(1)}/10
        
        MOBENG EXCELLENCE CULTURE:
        1. **High Integrity**: Honest, transparent, no fraud.
        2. **Customer Obsessed**: Service oriented, polite.
        3. **Sat-Set (Pragmatic)**: Fast but safe, result oriented.
        
        OUTPUT REQUIREMENT (JSON):
        Analyze the data and map it to these specific categories requested by the Owner:
        
        1. **Culture Fit Score** (1-100):
           - How well do they match the 3 Mobeng values above?
           
        2. **Psychometrics (Big Five)**:
           - Derive OCEAN traits from their behavioral choices.
           
        3. **Executive Summary Text (Bahasa Indonesia)**:
           Must follow this EXACT format inside the string (Markdown):
           
           "**Profil Psikometrik:**
           [Jelaskan singkat 2 kalimat tentang karakter dominan kandidat. Apakah dia dominan, teliti, atau sosial?]
           
           **Potensi Red Flags:**
           - [List negative traits found, e.g. 'Cenderung kompromi soal SOP', 'Kurang inisiatif', 'Jawaban terlalu singkat/malas', or 'Tidak ditemukan Red Flag signifikan']
           
           **Prediksi Performa:**
           [Kategorikan: 'RUNNER' (Tipe Pengejar Target/Proaktif/Ambisius) atau 'FOLLOWER' (Tipe Pasif/Menunggu Perintah/Safety Player). Jelaskan alasannya.]
           
           **Rekomendasi Akhir:**
           [Pilih satu: 'INTERVIEW SEGERA', 'SIMPAN SEBAGAI CADANGAN', atau 'GUGURKAN']"
           
        JSON STRUCTURE:
        {
            "summary": "The formatted text string above...",
            "psychometrics": {
                "openness": number,
                "conscientiousness": number,
                "extraversion": number,
                "agreeableness": number,
                "emotionalStability": number
            },
            "cultureFitScore": number,
            "starMethodScore": number
        }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json"
            }
        });

        const json = JSON.parse(response.text);
        
        return {
            summary: json.summary,
            psychometrics: {
                openness: json.psychometrics.openness,
                conscientiousness: json.psychometrics.conscientiousness,
                extraversion: json.psychometrics.extraversion,
                agreeableness: json.psychometrics.agreeableness,
                neuroticism: json.psychometrics.emotionalStability 
            },
            cultureFitScore: json.cultureFitScore,
            starMethodScore: json.starMethodScore
        };

    } catch (error) {
        console.error("Error generating final summary:", error);
        return {
            summary: "Gagal membuat analisa. Data tidak cukup.",
            psychometrics: { openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, neuroticism: 50 },
            cultureFitScore: 50,
            starMethodScore: 5
        };
    }
}
