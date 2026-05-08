
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai"; // For NVIDIA Fallback
import { Message, Sender, AnalysisResult, AssessmentScores, CandidateProfile, BigFiveTraits } from "../types";
import { supabase } from "./supabaseClient";

// Cache the keys in memory
let cachedApiKey: string | null = null;
let cachedNvidiaKey: string | null = null;
let cachedOpenRouterKey: string | null = null;
let cachedSumopodKey: string | null = null;

export const SUMOPOD_MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o (Premium)' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet' },
  { id: 'llama-3.1-405b', name: 'Llama 3.1 405B' },
  { id: 'mixtral-8x22b', name: 'Mixtral 8x22B' }
];

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

// Helper to get OpenRouter instance
const getOpenRouterAI = async () => {
  if (cachedOpenRouterKey) return new OpenAI({ apiKey: cachedOpenRouterKey, baseURL: 'https://openrouter.ai/api/v1', dangerouslyAllowBrowser: true });

  try {
    const { data } = await supabase.from('system_settings').select('value').eq('key', 'openrouter_api_key').single();
    if (data?.value) cachedOpenRouterKey = data.value;
  } catch (err) { console.warn("Supabase OpenRouter key fetch failed", err); }

  const finalKey = cachedOpenRouterKey || (import.meta.env && import.meta.env.VITE_OPENROUTER_API_KEY) || '';
  return new OpenAI({ apiKey: finalKey, baseURL: 'https://openrouter.ai/api/v1', dangerouslyAllowBrowser: true });
};

// Helper to get SumoPod instance (Assuming OpenAI compatible)
const getSumopodAI = async () => {
  if (cachedSumopodKey) return new OpenAI({ apiKey: cachedSumopodKey, baseURL: 'https://api.sumopod.com/v1', dangerouslyAllowBrowser: true });

  try {
    const { data } = await supabase.from('system_settings').select('value').eq('key', 'sumopod_api_key').single();
    if (data?.value) cachedSumopodKey = data.value;
  } catch (err) { console.warn("Supabase SumoPod key fetch failed", err); }

  const finalKey = cachedSumopodKey || (import.meta.env && import.meta.env.VITE_SUMOPOD_API_KEY) || '';
  return new OpenAI({ apiKey: finalKey, baseURL: 'https://api.sumopod.com/v1', dangerouslyAllowBrowser: true });
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
      temperature: 0.2, // INCREASED TO 0.2
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

const sendMessageToOpenRouter = async (
  history: Message[],
  latestUserMessage: string,
  systemInstruction: string,
  autoSwitch: boolean = false
): Promise<{ text: string; analysis: AnalysisResult | null }> => {
  const or = await getOpenRouterAI();
  let model = "google/gemini-flash-1.5-8b"; // Default

  if (autoSwitch) {
    try {
      const resp = await fetch('https://openrouter.ai/api/v1/models');
      const data = await resp.json();
      const freeModels = data.data.filter((m: any) => 
        m.id.includes(':free') || (m.pricing && m.pricing.prompt === "0")
      );
      if (freeModels.length > 0) {
        // Pick a free model, prefer gemini or llama
        const preferred = freeModels.find((m: any) => m.id.includes('gemini') || m.id.includes('llama-3.1-8b'));
        model = preferred ? preferred.id : freeModels[0].id;
        console.log("OpenRouter Auto-Switch: Using free model", model);
      }
    } catch (e) {
      console.warn("OpenRouter model fetch failed, using default", e);
    }
  }

  const messages = [
    { role: 'system', content: systemInstruction },
    ...history.slice(0, -1).map(msg => ({
      role: msg.sender === Sender.USER ? 'user' : 'assistant',
      content: msg.text
    } as any)),
    { role: 'user', content: latestUserMessage }
  ];

  try {
    const completion = await or.chat.completions.create({
      model: model,
      messages: messages,
      temperature: 0.2,
    });
    return parseOpenAIResponse(completion.choices[0]?.message?.content || "");
  } catch (error: any) {
    console.error("OpenRouter API Error:", error);
    throw error;
  }
};

const sendMessageToSumopod = async (
  history: Message[],
  latestUserMessage: string,
  systemInstruction: string,
  model: string
): Promise<{ text: string; analysis: AnalysisResult | null }> => {
  const sp = await getSumopodAI();
  const messages = [
    { role: 'system', content: systemInstruction },
    ...history.slice(0, -1).map(msg => ({
      role: msg.sender === Sender.USER ? 'user' : 'assistant',
      content: msg.text
    } as any)),
    { role: 'user', content: latestUserMessage }
  ];

  try {
    const completion = await sp.chat.completions.create({
      model: model || "gpt-4o",
      messages: messages,
      temperature: 0.2,
    });
    return parseOpenAIResponse(completion.choices[0]?.message?.content || "");
  } catch (error: any) {
    console.error("SumoPod API Error:", error);
    throw error;
  }
};

const parseOpenAIResponse = (responseText: string): { text: string; analysis: AnalysisResult | null } => {
  const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
  let analysis: AnalysisResult | null = null;
  let cleanText = responseText;

  if (jsonMatch && jsonMatch[1]) {
    try {
      analysis = JSON.parse(jsonMatch[1]);
      cleanText = responseText.replace(/```json\s*[\s\S]*?\s*```/, '').trim();
    } catch (e) {
      console.error("JSON Parse Error", e);
    }
  }
  return { text: cleanText, analysis };
};

export const sendMessageToGemini = async (
  history: Message[],
  latestUserMessage: string,
  systemInstruction: string
): Promise<{ text: string; analysis: AnalysisResult | null }> => {
  // Check settings for provider
  let provider = 'gemini';
  let sumopodModel = 'gpt-4o';
  let orAutoSwitch = false;

  try {
    const { data: settings } = await supabase.from('system_settings').select('key, value');
    const p = settings?.find(s => s.key === 'ai_provider')?.value;
    if (p) provider = p;
    const m = settings?.find(s => s.key === 'sumopod_model')?.value;
    if (m) sumopodModel = m;
    const as = settings?.find(s => s.key === 'openrouter_auto_switch')?.value;
    if (as === 'true') orAutoSwitch = true;
  } catch (e) { console.warn("Failed to load AI provider settings", e); }

  try {
    if (provider === 'openrouter') {
      return await sendMessageToOpenRouter(history, latestUserMessage, systemInstruction, orAutoSwitch);
    } else if (provider === 'sumopod') {
      return await sendMessageToSumopod(history, latestUserMessage, systemInstruction, sumopodModel);
    } else if (provider === 'nvidia') {
      return await sendMessageToNvidia(history, latestUserMessage, systemInstruction);
    }

    // Default: Gemini
    const ai = await getGenAI();
    const chat = ai.chats.create({
      model: "gemini-2.0-flash",
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.2,
      },
      history: history.slice(0, -1).map(msg => ({
        role: msg.sender === Sender.USER ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }))
    });

    const result = await chat.sendMessage({ message: latestUserMessage });
    const responseText = result.text || '';
    return parseOpenAIResponse(responseText);

  } catch (error: any) {
    console.error(`${provider} API Error, switching to NVIDIA fallback:`, error);
    try {
      return await sendMessageToNvidia(history, latestUserMessage, systemInstruction);
    } catch (nvidiaError: any) {
      return {
        text: "Maaf, sistem sedang sibuk (Semua AI Fail). " + (nvidiaError.message || ""),
        analysis: null
      };
    }
  }
};

export const testAIConnection = async (provider: string, apiKey: string, model?: string): Promise<{ success: boolean; message: string }> => {
  try {
    if (provider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey });
      const modelInst = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await modelInst.generateContent("Hi, test connection. Reply with 'OK'");
      return { success: true, message: result.response.text().substring(0, 50) };
    } else if (provider === 'openrouter') {
      const or = new OpenAI({ apiKey, baseURL: 'https://openrouter.ai/api/v1', dangerouslyAllowBrowser: true });
      const completion = await or.chat.completions.create({
        model: "google/gemini-flash-1.5-8b",
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 10
      });
      return { success: true, message: "Connected: " + completion.choices[0]?.message?.content };
    } else if (provider === 'sumopod') {
      const sp = new OpenAI({ apiKey, baseURL: 'https://api.sumopod.com/v1', dangerouslyAllowBrowser: true });
      const completion = await sp.chat.completions.create({
        model: model || "gpt-4o",
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 10
      });
      return { success: true, message: "Connected: " + completion.choices[0]?.message?.content };
    } else if (provider === 'nvidia') {
      const proxyUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/nvidia` : '/api/nvidia';
      const nv = new OpenAI({ apiKey, baseURL: proxyUrl, dangerouslyAllowBrowser: true });
      const completion = await nv.chat.completions.create({
        model: "meta/llama-3.1-70b-instruct",
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 10
      });
      return { success: true, message: "Connected: " + completion.choices[0]?.message?.content };
    }
    return { success: false, message: "Provider tidak dikenal" };
  } catch (e: any) {
    return { success: false, message: e.message || "Connection failed" };
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
  logicScore: number,
  chatHistory: Message[] = [] // NEW: Accept full chat history
): Promise<FinalAnalysisReport> => {
  // Convert chat history to readable transcript
  const transcript = chatHistory.map(m => `${m.sender === 'user' ? 'Candidate' : 'Recruiter'}: ${m.text}`).join('\n');

  // 1. Define Prompt OUTSIDE try-catch to ensure availability for fallback
  const prompt = `
        Role: Senior I/O Psychologist & Elite Recruiter (Google Standard).
        Task: Conduct a high-level candidate assessment using the "Google Hiring Attributes" framework.
        
        CONTEXT (Mobeng):
        - Place: "Toko" (not Bengkel).
        - Hierarchy: Mekanik -> Assist. Store Leader -> Store Leader -> Area Coord -> Regional Head.
        - Products: Service RMB (Rasa Mesin Baru), Oli X-TEN (Ester).
        - Services: Ganti Oli, Tune Up RMB, Spooring, Ban, Kaki-kaki, AC.

        Candidate: ${profile.name} (Position: ${role})
        
        DATA POINTS:
        1. **General Cognitive Ability (GCA) Baseline**: ${logicScore.toFixed(1)}/10 (Logic Test Score)
        2. **Behavioral Competencies (SJT)**: Sales(${simScores.sales}), Leadership(${simScores.leadership}), Ops(${simScores.operations}), CX(${simScores.cx})
        3. **Interview Transcript Analysis**: 
           "${transcript || simFeedback}" (If transcript empty, use summary)
        
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

        **4. Mobeng Culture Fit (Core Values)**
        - **Introspeksi**: Can they learn from mistakes? (Self-reflection).
        - **Innovasi**: Do they have new ideas or better methods?
        - **Komitmen**: Do they go above and beyond to achieve goals?
        - **Kolaborasi**: Win-win cooperation and mutual trust.
        - **Taglines**: Learning & Respek, Melawan Arus, Fokus, Komit, Siap Berubah.

        ---

        ### OUTPUT REQUIREMENT (JSON):
        
         1. **Culture Fit Score** (1-100):
            - Based on Mobeng Values: Introspeksi, Innovasi, Komitmen, Kolaborasi.
            - < 60: Low Commitment, No Introspection, or "Sok Tahu".
            - > 85: High Innovation, Collaborative, Strong Integrity.
           
        2. **Psychometrics (Big Five)**:
           - Derive OCEAN traits strictly from behavioral evidence in the transcript.
           - Scale: 0-100.
           - **IMPORTANT**: If the transcript is too short or lacks signal for a specific trait, use the population average (**50**) as a neutral baseline. DO NOT output **0** unless there is clear evidence of extremely low trait presence.
           
        3. **Executive Summary Text (Bahasa Indonesia)**:
           Must follow this EXACT Markdown format:
           
           "**Executive Summary (Automotive Industry Standard):**
           [2 sentences summarizing the candidate's profile for a Workshop/Retail environment.]

           **1. Cognitive & Problem Solving (GCA):**
           - [Analysis of logic vs communication clarity. Mention the Logic Score ${logicScore.toFixed(1)} explicitly.]
           
           **2. Automotive Retail & Technical Fit (RRK):**
           - [Analysis of sales capability, technical understanding, and operational awareness.]

           **3. Leadership, Integrity & 'The Mobeng Way' (Culture):**
           - [Analysis of Introspeksi, Innovasi, Komitmen, and Kolaborasi.]
           
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
                "openness": number, // 0-100
                "conscientiousness": number, // 0-100
                "extraversion": number, // 0-100
                "agreeableness": number, // 0-100
                "emotionalStability": number // 0-100
            },
            "cultureFitScore": number, // 0-100
            "starMethodScore": number // 0-10 (Strictly max 10)
        }
        
        IMPORTANT: You must output valid JSON ONLY. Do not output any markdown text outside the JSON object. The 'summary' field should contain the markdown text.
    `;

    // Check settings for provider
    let provider = 'gemini';
    let sumopodModel = 'gpt-4o';
    let orAutoSwitch = false;

    try {
      const { data: settings } = await supabase.from('system_settings').select('key, value');
      const p = settings?.find(s => s.key === 'ai_provider')?.value;
      if (p) provider = p;
      const m = settings?.find(s => s.key === 'sumopod_model')?.value;
      if (m) sumopodModel = m;
      const as = settings?.find(s => s.key === 'openrouter_auto_switch')?.value;
      if (as === 'true') orAutoSwitch = true;
    } catch (e) { console.warn("Failed to load AI provider settings", e); }

    let json;
    let responseText = "";

    try {
      if (provider === 'openrouter') {
        const or = await getOpenRouterAI();
        let model = "google/gemini-pro-1.5-exp:free";
        if (orAutoSwitch) {
           // We already have a helper for this in sendMessageToOpenRouter, 
           // but for simplicity here we use the same logic or just stick to a strong model for summary.
           model = "google/gemini-flash-1.5"; 
        }
        const completion = await or.chat.completions.create({
          model: model,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.2
        });
        responseText = completion.choices[0]?.message?.content || "{}";
      } else if (provider === 'sumopod') {
        const sp = await getSumopodAI();
        const completion = await sp.chat.completions.create({
          model: sumopodModel || "gpt-4o",
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.2
        });
        responseText = completion.choices[0]?.message?.content || "{}";
      } else if (provider === 'nvidia') {
        const nv = await getNvidiaAI();
        const completion = await nv.chat.completions.create({
          model: "meta/llama-3.1-70b-instruct",
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2
        });
        responseText = completion.choices[0]?.message?.content || "{}";
      } else {
        // Default: Gemini
        const ai = await getGenAI();
        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            responseMimeType: "application/json",
            temperature: 0.2,
          }
        });
        responseText = response.text || '{}';
      }

      try {
        json = JSON.parse(responseText.replace(/```json\s*|\s*```/g, '').trim());
      } catch (e) {
        // Fallback for non-JSON or malformed
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
        json = JSON.parse(jsonMatch ? jsonMatch[1] : responseText);
      }

    // Helper to normalize scores to 0-100 scale
    const norm = (val: number | undefined) => {
      if (typeof val !== 'number') return 50;
      if (val <= 1) return val * 100; // 0.8 -> 80
      if (val <= 10) return val * 10; // 8 -> 80
      return val;
    };

    return {
      summary: json.summary || "Analisa tidak tersedia.",
      psychometrics: {
        openness: norm(json.psychometrics?.openness),
        conscientiousness: norm(json.psychometrics?.conscientiousness),
        extraversion: norm(json.psychometrics?.extraversion),
        agreeableness: norm(json.psychometrics?.agreeableness),
        neuroticism: norm(json.psychometrics?.emotionalStability)
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
        temperature: 0.2, // INCREASED TO 0.2
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
        console.log("NVIDIA returned raw text instead of JSON. Falling back to text summary.");
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
