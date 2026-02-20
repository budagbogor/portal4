
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai"; // For NVIDIA Fallback
import { Message, Sender, AnalysisResult, AssessmentScores, CandidateProfile, BigFiveTraits } from "../types";
import { supabase } from "./supabaseClient";

// Cache the keys in memory
let cachedApiKey: string | null = null;
let cachedNvidiaKey: string | null = null;

// Helper to get the AI instance dynamically (Async now)
// Helper to get Gemini instance
const getGenAI = async () => {
  if (cachedApiKey) return new GoogleGenAI({ apiKey: cachedApiKey });

  try {
    const { data } = await supabase.from('system_settings').select('value').eq('key', 'gemini_api_key').single();
    if (data?.value) cachedApiKey = data.value;
  } catch (err) { console.warn("Supabase key fetch failed", err); }

  const finalKey = cachedApiKey || (import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) || '';
  if (!finalKey) console.warn("Gemini API Key missing");

  return new GoogleGenAI({ apiKey: finalKey });
};

// Helper to get NVIDIA instance
const getNvidiaAI = async () => {
  const proxyUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/nvidia` : '/api/nvidia';

  if (cachedNvidiaKey) {
    console.log("DEBUG_v2: Using Cached NVIDIA Key with Proxy:", proxyUrl);
    return new OpenAI({ apiKey: cachedNvidiaKey, baseURL: proxyUrl, dangerouslyAllowBrowser: true });
  }

  try {
    const { data } = await supabase.from('system_settings').select('value').eq('key', 'nvidia_api_key').single();
    if (data?.value) cachedNvidiaKey = data.value;
  } catch (err) { console.warn("Supabase NVIDIA key fetch failed", err); }

  const finalKey = cachedNvidiaKey || (import.meta.env && import.meta.env.VITE_NVIDIA_API_KEY) || '';
  if (!finalKey) console.warn("NVIDIA API Key missing");

  console.log("DEBUG_v2: Initializing NVIDIA with Proxy:", proxyUrl);

  return new OpenAI({
    apiKey: finalKey,
    baseURL: proxyUrl, // Use Full Proxy URL to avoid SDK issues
    dangerouslyAllowBrowser: true // Client-side usage
  });
};

const sendMessageToNvidia = async (
  history: Message[],
  latestUserMessage: string,
  systemInstruction: string
): Promise<{ text: string; analysis: AnalysisResult | null }> => {
  console.log("Using NVIDIA Fallback...");
  const nvidia = await getNvidiaAI();

  const messages = [
    { role: 'system', content: systemInstruction },
    ...history.slice(0, -1).map(msg => ({
      role: msg.sender === Sender.USER ? 'user' : 'assistant',
      content: msg.text
    } as any)),
    { role: 'user', content: latestUserMessage }
  ];

  try {
    const completion = await nvidia.chat.completions.create({
      model: "meta/llama-3.1-70b-instruct",
      messages: messages,
      temperature: 0.1, // REDUCED TO 0.1
      max_tokens: 1024,
      top_p: 1,
    });

    const responseText = completion.choices[0]?.message?.content || "";

    // Parse JSON from response
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    let analysis: AnalysisResult | null = null;
    let cleanText = responseText;

    if (jsonMatch && jsonMatch[1]) {
      try {
        analysis = JSON.parse(jsonMatch[1]);
        cleanText = responseText.replace(/```json\s*[\s\S]*?\s*```/, '').trim();
      } catch (e) {
        console.error("NVIDIA JSON Parse Error", e);
      }
    }

    return { text: cleanText, analysis };
  } catch (error: any) {
    console.error("NVIDIA API Error:", error);
    throw error;
  }
};

export const sendMessageToGemini = async (
  history: Message[],
  latestUserMessage: string,
  systemInstruction: string
): Promise<{ text: string; analysis: AnalysisResult | null }> => {
  try {
    // Create instance dynamically
    const ai = await getGenAI();

    const chat = ai.chats.create({
      model: "gemini-2.0-flash", // UPGRADED MODEL for better reasoning
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1, // REDUCED TO 0.1 FOR REALISTIC/DETERMINISTIC OUTPUT
      },
      history: history.slice(0, -1).map(msg => ({
        role: msg.sender === Sender.USER ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }))
    });

    const result = await chat.sendMessage({
      message: latestUserMessage
    });

    const responseText = result.text || '';

    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    let analysis: AnalysisResult | null = null;
    let cleanText = responseText;

    if (jsonMatch && jsonMatch[1]) {
      try {
        analysis = JSON.parse(jsonMatch[1]);
        cleanText = responseText.replace(/```json\s*[\s\S]*?\s*```/, '').trim();
      } catch (e) {
        console.error("Failed to parse analysis JSON", e);
      }
    }

    return {
      text: cleanText,
      analysis: analysis
    };

  } catch (error: any) {
    console.error("Gemini API Error, switching to NVIDIA:", error);
    try {
      return await sendMessageToNvidia(history, latestUserMessage, systemInstruction);
    } catch (nvidiaError: any) {
      return {
        text: "Maaf, sistem sedang sibuk (Gemini & NVIDIA Fail). " + (nvidiaError.message || ""),
        analysis: null
      };
    }
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
  // 1. Define Prompt OUTSIDE try-catch to ensure availability for fallback
  const prompt = `
        Role: Senior I/O Psychologist & Elite Recruiter (Google Standard).
        Task: Conduct a high-level candidate assessment using the "Google Hiring Attributes" framework.
        
        Candidate: ${profile.name} (Position: ${role})
        
        DATA POINTS:
        1. **General Cognitive Ability (GCA) Baseline**: ${logicScore.toFixed(1)}/10 (Logic Test Score)
        2. **Behavioral Competencies (SJT)**: Sales(${simScores.sales}), Leadership(${simScores.leadership}), Ops(${simScores.operations}), CX(${simScores.cx})
        3. **Interview Transcript Analysis**: "${simFeedback}"
        
        ### ANALYSIS FRAMEWORK (MANDATORY):
        
        **1. General Cognitive Ability (GCA) in Automotive Context**
        - Can they explain complex technical issues (cars/engines) in simple terms?
        - High Logic + Structured Answer = **Strong GCA (Good for Service Advisor/Leader)**.
        - High Logic + Unstructured = **Potential Lazy/Arrogant**.
        - Low Logic + Structured = **Hard Worker (Good for Mechanic/Admin)**.

        **2. Role-Related Knowledge (RRK) - Workshop & Retail**
        - **Technical Awareness**: Did they show understanding of bengkel operations (SPK, Spareparts, Service Flow)?
        - **Sales & Service**: Did they show ability to upsell (e.g., oil, tires) HONESTLY?
        - **Trust Factor**: Automotive industry relies on TRUST. Did they sound honest or manipulative?

        **3. Leadership & "Mobeng Way"**
        - **Operational Discipline**: Workshops require strict SOP adherence. Did they respect rules?
        - **Emergent Leadership**: Taking ownership when the workshop is busy/chaos.

        **4. Googleyness (Culture Fit)**
        - **Customer Obsession**: Willing to go extra mile for customer safety?
        - **Integrity**: ZERO TOLERANCE for cheating/lying (Crucial in auto service).

        ---

        ### OUTPUT REQUIREMENT (JSON):
        
        1. **Culture Fit Score** (1-100):
           - Based on Integrity & Service Orientation.
           - < 60: Toxic, Dishonest, or "Sok Tahu".
           - > 85: High Integrity, Customer First, Hardworking.
           
        2. **Psychometrics (Big Five)**:
           - Derive OCEAN traits strictly from behavioral evidence.
           
        3. **Executive Summary Text (Bahasa Indonesia)**:
           Must follow this EXACT Markdown format:
           
           "**Executive Summary (Automotive Industry Standard):**
           [2 sentences summarizing the candidate's profile for a Workshop/Retail environment.]

           **1. Cognitive & Problem Solving (GCA):**
           - [Analysis of logic vs communication clarity. Mention the Logic Score ${logicScore.toFixed(1)} explicitly.]
           
           **2. Automotive Retail & Technical Fit (RRK):**
           - [Analysis of sales capability, technical understanding, and operational awareness.]

           **3. Leadership, Integrity & 'The Mobeng Way':**
           - [Analysis of ownership, honesty (crucial), and discipline.]
           
           **4. Psychometric Insights (OCEAN):**
           - [Highlight dominant traits (e.g., 'High Conscientiousness important for SOP adherence', 'High Agreeableness good for CS').]

           **5. Red Flags / Areas for Improvement:**
           - [Critical weaknesses if any.]

           **6. Saran Pengembangan & Training (Development Plan):**
           - [Concrete steps to improve. Examples: 'Perlu training product knowledge lebih dalam', 'Rotasi ke bagian Front Office untuk melatih komunikasi', 'Mentoring langsung dengan Kepala Bengkel'.]
           
           **Final Verdict:**
           [One of: 'HIRE (Strong)', 'HIRE (Standard)', 'NO HIRE']"
           
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

  try {
    const ai = await getGenAI();

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash', // UPGRADED MODEL
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        temperature: 0.1, // REDUCED TO 0.1
      }
    });

    const jsonText = response.text || '{}'; // Handle undefined
    let json;
    try {
      json = JSON.parse(jsonText);
    } catch (e) {
      console.error("Failed to parse final summary JSON", e);
      // Try to clean markdown
      const cleanText = jsonText.replace(/```json\s*|\s*```/g, '').trim();
      json = JSON.parse(cleanText);
    }

    return {
      summary: json.summary || "Analisa tidak tersedia.",
      psychometrics: {
        openness: json.psychometrics?.openness || 50,
        conscientiousness: json.psychometrics?.conscientiousness || 50,
        extraversion: json.psychometrics?.extraversion || 50,
        agreeableness: json.psychometrics?.agreeableness || 50,
        neuroticism: json.psychometrics?.emotionalStability || 50
      },
      cultureFitScore: json.cultureFitScore || 50,
      starMethodScore: json.starMethodScore || 5
    };

  } catch (error) {
    console.warn("Gemini Final Summary Error, Try NVIDIA:", error);

    // Fallback logic for Final Summary
    try {
      const nvidia = await getNvidiaAI();
      const completion = await nvidia.chat.completions.create({
        model: "meta/llama-3.1-70b-instruct",
        messages: [{ role: 'user', content: prompt }], // Prompt contains Role/Task inside
        temperature: 0.1, // REDUCED TO 0.1
        max_tokens: 2048
      });

      const responseText = completion.choices[0]?.message?.content || "{}";
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : responseText;

      let json;
      try {
        json = JSON.parse(jsonStr);
      } catch (e) {
        // If JSON parse fails, check if the raw text is actually just the summary
        console.warn("NVIDIA JSON Parse Error on Summary", e);
        // Fallback: Use the whole text as summary
        json = {
          summary: responseText.substring(0, 4000), // Increased Limit to 4000 chars
          psychometrics: { openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, neuroticism: 50 },
          cultureFitScore: 50,
          starMethodScore: 5
        };
      }

      return {
        summary: json.summary || responseText.substring(0, 4000) + "...", // Increased Limit
        psychometrics: json.psychometrics || { openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, neuroticism: 50 },
        cultureFitScore: json.cultureFitScore || 50,
        starMethodScore: json.starMethodScore || 5
      };

    } catch (nvErr) {
      console.error("NVIDIA Final Summary Error:", nvErr);
      return {
        summary: "Gagal membuat analisa (All AI Failed). Mohon cek koneksi atau API Key.",
        psychometrics: { openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, neuroticism: 50 },
        cultureFitScore: 50,
        starMethodScore: 5
      };
    }
  }
}
