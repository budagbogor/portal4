

export enum Sender {
   USER = 'user',
   AI = 'ai'
}

export interface Message {
   id: string;
   text: string;
   sender: Sender;
   timestamp: Date;
   isThinking?: boolean;
}

export interface AssessmentScores {
   sales: number;
   leadership: number;
   operations: number;
   cx: number;
}

export interface BigFiveTraits {
   openness: number;         // Keterbukaan terhadap hal baru
   conscientiousness: number;// Kehati-hatian / Etos kerja
   extraversion: number;     // Ekstroversi
   agreeableness: number;    // Keramahan / Kooperatif
   neuroticism: number;      // Kestabilan Emosi (Inverse)
}

export interface AnalysisResult {
   scores: AssessmentScores;
   feedback: string;
   isInterviewOver: boolean;
}

export interface CandidateProfile {
   name: string;
   phone: string;
   education: string;
   major: string;
   lastPosition: string;
   lastCompany: string;
   experienceYears: string;
}

export interface CandidateSubmission {
   id: string;
   profile: CandidateProfile;
   role: string;
   timestamp: Date;
   // Test 1 Results
   simulationScores: AssessmentScores;
   simulationFeedback: string;
   // Psychometric Deep Dive
   psychometrics: BigFiveTraits;
   cultureFitScore: number; // 0-100
   starMethodScore: number; // 0-10 (How well they structure answers)
   // Test 2 Results
   logicScore: number;
   // Combined AI Conclusion
   finalSummary: string;
   status: 'Recommended' | 'Consider' | 'Reject';
   // Integrity
   cheatCount: number; // Tab switches
   // Transcript
   chatHistory?: Message[]; // Full conversation log
}

// --- CONFIGURATION TYPES ---

export interface Profile {
   id: string;
   email: string;
   full_name: string;
   role: 'super_admin' | 'recruiter';
   created_at: string;
}

export type RoleType = 'mechanic' | 'asst_leader' | 'store_leader' | 'area_coord' | 'regional_head';

export interface RoleDefinition {
   id: RoleType;
   label: string;
   description: string;
   initialScenario: string;
   systemInstruction: string;
}

export type AIProvider = 'gemini' | 'nvidia' | 'sumopod' | 'openrouter';

export interface AppSettings {
   activeRole: RoleType;
   activeLogicSetId: string; // NEW: Controls which question set is served
   allowCandidateViewScore: boolean; // false = Concentration Mode (Blind), true = Transparent
   requireCamera: boolean; // NEW: Toggle Camera Requirement
   requireMicrophone: boolean; // NEW: Toggle Mic Requirement
   aiProvider: AIProvider; // NEW: Selected AI Provider
   sumopodModel: string; // NEW: Selected SumoPod Model
   openrouterAutoSwitch: boolean; // NEW: OpenRouter Auto-switch free models
}

// --- SHARED BUSINESS CONTEXT ---
const BUSINESS_CONTEXT = `
CONTEXT & TERMINOLOGY (MOBENG):
1. Toko, NOT Bengkel: Call the location "Toko" (Store), even if it's a workshop.
2. Hierarchy: Mekanik -> Asst. Store Leader -> Store Leader -> Area Coordinator -> Regional Head.
3. Products: Main service is "RMB" (Rasa Mesin Baru/Machine Tune Up). Exclusive oil is "X-TEN" (Ester based).
4. Services: Oil change, Tune Up RMB, Spooring/Balancing, Tires, Undercarriage (Kaki-kaki), AC Service.
5. Core Principles: Pelayanan tulus, ketegasan pada SOP kebersihan, optimisme dalam mencapai target, dan kemampuan teknis yang dijelaskan secara persuasif kepada orang awam.
`;

// --- SHARED INSTRUCTION PROTOCOL ---
const CRITICAL_EVALUATION_PROTOCOL = `
${BUSINESS_CONTEXT}

**CRITICAL EVALUATION PROTOCOL (STRICT MODE):**
1. **BE SKEPTICAL**: Assume the candidate is trying to give "textbook answers". Your job is to expose their true depth.
2. **REJECT GENERIC ANSWERS**: 
   - If they say "Saya akan koordinasi", demand: "Specifically with whom? and how?".
   - If they say "Saya akan memberikan pelayanan terbaik", demand: "What specific action?".
3. **PRINCIPLE-BASED EVALUATION**:
   - **Sincere Service**: Does the answer prioritize customer safety and satisfaction over easy profit?
   - **Cleanliness SOP**: Is there a zero-tolerance attitude towards oil spills or messy desks?
   - **Target Optimism**: Does the candidate sound defeated or motivated when targets are missed?
   - **Technical Persuasion**: Can they explain "Tune Up" or "Shockbreaker" simple enough for a non-expert (e.g., a lady or first-time car owner)?
4. **SCORING**:
   - 9-10: Exceptional, detailed, persuasive, and principle-aligned execution.
   - 5-6: Standard/normative ("Jawaban aman").
   - < 5: Vague, lazy, unethical, or ignoring SOP.
`;

const JSON_OUTPUT_INSTRUCTION = (maxScenarios: number) => `
\n\n*** IMPORTANT SYSTEM PROTOCOL ***
At the end of EVERY response, you MUST append a hidden JSON block.
The JSON must be wrapped in \`\`\`json code blocks.

FORMAT:
\`\`\`json
{
  "scores": {
    "sales": number,      // 0-10 (Assess persuasion/commercial awareness)
    "leadership": number, // 0-10 (Assess decision making/integrity)
    "operations": number, // 0-10 (Assess SOP/cleanliness/technical clarity)
    "cx": number          // 0-10 (Assess empathy/sincerity)
  },
  "feedback": "string",   // Mention specifically if they aligned with Mobeng principles.
  "isInterviewOver": boolean // Set to true ONLY after the candidate answers Scenario ${maxScenarios}.
}
\`\`\`
`;

// --- ROLE DEFINITIONS & SCENARIOS ---

export const ROLE_DEFINITIONS: Record<RoleType, RoleDefinition> = {
   mechanic: {
      id: 'mechanic',
      label: 'Mekanik (Mechanic)',
      description: 'Fokus pada Conscientiousness (Ketelitian), Manual Dexterity (Logika ruang), dan Integrity.',
      initialScenario: `Halo, saya AI Asst. Store Leader Anda. Kita akan melakukan tes situasi (SJT) sebanyak 5 soal. Jawablah dengan lisan atau ketik jawaban Anda.

**Skenario 1 (Integritas & Sales):**
Anda sedang melakukan servis berkala. Saat membongkar, Anda menemukan *shockbreaker* rembes parah yang TIDAK ada di SPK (Surat Perintah Kerja) awal. Customer sedang menunggu di ruang tunggu dan terlihat sibuk main HP. Apa yang Anda lakukan?`,
      systemInstruction: `You are a strict AI Asst. Store Leader evaluating a Mechanic. 
    ${CRITICAL_EVALUATION_PROTOCOL}
    - FOCUS: Conscientiousness, Manual Dexterity, and Integrity.
    - Present 5 scenarios sequentially.
    ${JSON_OUTPUT_INSTRUCTION(5)}`
   },

   asst_leader: {
      id: 'asst_leader',
      label: 'Assistant Store Leader',
      description: 'Fokus pada Service Orientation, Sales Persuasion, dan Operational Discipline.',
      initialScenario: `Selamat datang di tes Assistant Store Leader. Kita akan membahas 5 kasus operasional toko Mobeng.

**Skenario 1 (Leadership under Pressure):**
Saat Store Leader sedang cuti, Anda memegang kendali toko. Tiba-tiba di area bengkel terjadi keributan. Mekanik Anda berdebat keras dengan Mekanik Vendor (AC) soal pemakaian tools bersama. Di saat bersamaan, ada pelanggan di meja depan ingin cepat bayar. Mana yang Anda tangani duluan dan bagaimana caranya?`,
      systemInstruction: `You are a tough AI Store Leader evaluating an Assistant.
    ${CRITICAL_EVALUATION_PROTOCOL}
    - FOCUS: Service Orientation, Sales Persuasion, and Operational Discipline.
    - Present 5 scenarios sequentially.
    ${JSON_OUTPUT_INSTRUCTION(5)}`
   },

   store_leader: {
      id: 'store_leader',
      label: 'Store Leader (Kepala Toko)',
      description: 'Fokus pada Service Orientation, Sales Persuasion, dan Operational Discipline.',
      initialScenario: `Selamat datang di seleksi Store Leader Mobeng. Saya adalah AI Area Coordinator Anda. Saya akan memberikan 10 tantangan manajemen toko (SJT) untuk menguji kesiapan Anda.

**Skenario 1 (Kebersihan & First Impression):**
"Anda baru sampai di bengkel dan melihat lantai area pit ada ceceran oli, sementara ada pelanggan VIP baru saja memarkir mobilnya. Tim mekanik sedang sibuk semua. Apa tindakan pertama Anda?"`,
      systemInstruction: `You are a professional Area Coordinator evaluating a Store Leader. 
    ${CRITICAL_EVALUATION_PROTOCOL}
    - FOCUS: Service Orientation, Sales Persuasion, and Operational Discipline.
    - MANDATORY PRINCIPLE: Nilai jawaban kandidat berdasarkan prinsip: Pelayanan tulus, ketegasan pada SOP kebersihan, optimisme dalam mencapai target, dan kemampuan teknis yang dijelaskan secara persuasif kepada orang awam.

    **SCENARIO LIST (Present one by one):**
    1. **Kebersihan**: Oil spill on floor + VIP arrival. (Sense of Crisis).
    2. **Upselling**: Brake pads thin but customer in hurry. (Persuasion + Safety).
    3. **Conflict**: Senior mechanics fighting in front of customers. (Emotional Control).
    4. **Target Briefing**: Sales at 70% on 25th. Give a short speech. (Motivation/Optimism).
    5. **Complaint**: Spare part delay, threat of bad review. (Problem solving/Negotiation).
    6. **SOP Discipline**: Productive mechanic not using gloves/seat cover. (Consistency).
    7. **Integrity**: VIP tips for skipping queue. (Justice/Integrity).
    8. **Operational Excellence**: Messy desk, admin playing phone. (Detail orientation).
    9. **Education**: Explain "Tune Up" to a non-technical lady. (Simple persuasion).
    10. **Initiative**: Heavy rain, shop empty. Creative way to get Unit In. (Result-oriented).

    Wait for each answer, probe if generic. 
    ${JSON_OUTPUT_INSTRUCTION(10)}`
   },

   area_coord: {
      id: 'area_coord',
      label: 'Area Coordinator',
      description: 'Fokus pada Multi-unit Management, Problem Solving, dan Conflict Resolution.',
      initialScenario: `Anda melamar sebagai Area Coordinator. Saya AI Regional Head akan membedah 5 kasus multi-toko.

**Skenario 1 (Analisa Data):**
Anda membawahi 5 Toko. Toko A salesnya tertinggi (150%) TAPI komplain pelanggannya juga tertinggi. Toko B salesnya rendah (70%) tapi Zero Complaint dan timnya sangat solid. Jika Anda harus menegur salah satu Store Leader hari ini, siapa yang Anda panggil duluan dan kenapa?`,
      systemInstruction: `You are a Strategic Regional Head evaluating an Area Coordinator.
    ${CRITICAL_EVALUATION_PROTOCOL}
    - FOCUS: Multi-unit Management, Problem Solving, and Conflict Resolution.
    - Present 5 scenarios sequentially.
    ${JSON_OUTPUT_INSTRUCTION(5)}`
   },

   regional_head: {
      id: 'regional_head',
      label: 'Regional Head',
      description: 'Fokus pada Strategic Thinking, P&L Analysis, dan High-level Leadership.',
      initialScenario: `Selamat datang di level Strategic Assessment Regional Head. Saya AI COO Mobeng.

**Skenario 1 (Crisis Strategy):**
Revenue Region Anda turun 15% Year-on-Year (YoY). Kompetitor utama sedang melakukan strategi 'Bakar Uang'. COO menuntut Anda membuat strategi recovery dalam 3 bulan TANPA ikut perang harga. Apa 3 pilar utama strategi Anda?`,
      systemInstruction: `You are the COO evaluating a Regional Head.
    ${CRITICAL_EVALUATION_PROTOCOL}
    - FOCUS: Strategic Thinking, P&L Analysis, and High-level Leadership.
    - Present 5 scenarios sequentially.
    ${JSON_OUTPUT_INSTRUCTION(5)}`
   }
};
