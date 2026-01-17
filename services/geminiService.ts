import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, Article, ContentType, AIProvider, AgentIntent, AgentLead, SearchResult, DocumentAnalysis, Language } from "../types";

// --- Configuration & State ---
// Using 2.0 Flash as it is generally stable for tools.
const GEMINI_MODEL_NAME = "gemini-2.0-flash"; 
const DEEPSEEK_MODEL_NAME = "deepseek-chat";

// State to track current provider and keys
let currentProvider: AIProvider = (localStorage.getItem('ai_provider') as AIProvider) || 'gemini';
let deepSeekApiKey: string = localStorage.getItem('deepseek_api_key') || '';
let deepSeekBaseUrl: string = localStorage.getItem('deepseek_base_url')?.replace(/\/$/, '') || 'https://api.deepseek.com';
let serpApiKey: string = localStorage.getItem('serp_api_key') || '';

// Allow runtime override of Gemini Key
// LOGIC: Check LocalStorage first, then fallback to Vercel Env Var
let geminiApiKey: string = localStorage.getItem('gemini_api_key') || process.env.API_KEY || '';

// Helper to get dynamic client
const getGeminiClient = () => {
  if (!geminiApiKey) {
    throw new Error("Gemini API Key is missing. Please set it in Settings or configure APP_KEY/API_KEY in Vercel.");
  }
  return new GoogleGenAI({ apiKey: geminiApiKey });
};

// Debug Helper: Get Masked Key
export const getMaskedGeminiKey = () => {
  if (!geminiApiKey) return "No Key";
  if (geminiApiKey.length < 8) return "****";
  return `...${geminiApiKey.slice(-4)}`;
};

// Configuration Setters
export const setGlobalProvider = (provider: AIProvider) => {
  currentProvider = provider;
  localStorage.setItem('ai_provider', provider);
  console.log(`[LexiHub] Provider switched to: ${provider}`);
};

export const setGlobalGeminiKey = (key: string) => {
  const cleanKey = key.trim();
  if (cleanKey) {
    // User provided a specific key
    geminiApiKey = cleanKey;
    localStorage.setItem('gemini_api_key', cleanKey);
  } else {
    // User cleared the input, revert to System Env Var
    localStorage.removeItem('gemini_api_key');
    geminiApiKey = process.env.API_KEY || '';
    console.log("[LexiHub] Gemini Key reset to System Env Var");
  }
};

export const setGlobalDeepSeekKey = (key: string) => {
  deepSeekApiKey = key;
  localStorage.setItem('deepseek_api_key', key);
};

export const setGlobalDeepSeekBaseUrl = (url: string) => {
  const cleanUrl = url.trim().replace(/\/$/, '');
  deepSeekBaseUrl = cleanUrl;
  localStorage.setItem('deepseek_base_url', cleanUrl);
};

export const setGlobalSerpApiKey = (key: string) => {
  serpApiKey = key;
  localStorage.setItem('serp_api_key', key);
};

export const getGlobalProvider = () => currentProvider;

// --- Helper: Retry Mechanism (Exponential Backoff) ---
// UPDATED: Increased defaults to 6 retries and 4000ms delay to handle free tier limits better
const retryWithBackoff = async <T>(fn: () => Promise<T>, retries = 5, delay = 3000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const msg = (error.message || JSON.stringify(error)).toLowerCase();
    const isRateLimit = msg.includes('429') || msg.includes('resource exhausted') || msg.includes('quota exceeded');
    const isServerOverload = msg.includes('503') || msg.includes('overloaded');

    if ((isRateLimit || isServerOverload) && retries > 0) {
      console.warn(`[LexiHub AI] Rate limit hit (429). Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      // Exponential backoff
      return retryWithBackoff(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

// --- Helper: Clean JSON ---
const cleanJson = (text: string) => {
    let clean = text.replace(/```json\n?|\n?```/g, '');
    clean = clean.replace(/```\n?|\n?```/g, '');
    return clean.trim();
};

// --- Helper: SerpApi Fetcher ---
const callSerpApi = async (query: string): Promise<any> => {
  if (!serpApiKey) throw new Error("SerpApi Key is missing");

  const params = new URLSearchParams({
    engine: "google",
    q: query,
    api_key: serpApiKey,
    google_domain: "google.com",
    hl: "en",
    gl: "us",
    num: "10"
  });

  const targetUrl = `https://serpapi.com/search.json?${params.toString()}`;

  // 1. Try Local Proxy (Vite/Vercel)
  try {
    const proxyUrl = `/api/proxy/serpapi/search.json?${params.toString()}`;
    const response = await fetch(proxyUrl);
    if (response.ok) return await response.json();
  } catch (e) {
    console.warn("Local proxy fetch failed, switching to public CORS proxy...");
  }

  // 2. Fallback: Public CORS Proxy
  try {
    const corsUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
    const response = await fetch(corsUrl);
    
    if (!response.ok) {
      const errText = await response.text();
      let errorMessage = response.statusText;
      try {
        const jsonErr = JSON.parse(errText);
        if (jsonErr.error) errorMessage = jsonErr.error;
      } catch {}
      throw new Error(`SerpApi Error (${response.status}): ${errorMessage}`);
    }
    return await response.json();
  } catch (error) {
    console.error("SerpApi Fetch Error (Final):", error);
    if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
       throw new Error("Network Error: Could not connect to SerpApi. Likely CORS.");
    }
    throw error;
  }
};

// --- Helper: DeepSeek Fetcher ---
const callDeepSeek = async (messages: any[], jsonMode: boolean = false) => {
  if (!deepSeekApiKey) throw new Error("DeepSeek API Key is missing. Please configure it in Settings.");

  const endpoint = `${deepSeekBaseUrl}/chat/completions`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${deepSeekApiKey}`
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL_NAME,
        messages: messages,
        response_format: jsonMode ? { type: "json_object" } : { type: "text" },
        temperature: 1.3,
        max_tokens: 4096 // Add limit to prevent truncation issues or provider defaults
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`DeepSeek API Error (${response.status}): ${err.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("DeepSeek Fetch Error:", error);
    if (error instanceof TypeError && (error.message.includes("fetch") || error.message.includes("Failed to fetch"))) {
      throw new Error(`Network Error: Browser blocked request to ${deepSeekBaseUrl}. Use a Proxy URL.`);
    }
    throw error;
  }
};

// --- Helper: DeepSeek Stream ---
async function* callDeepSeekStream(messages: any[]) {
  if (!deepSeekApiKey) throw new Error("DeepSeek API Key is missing.");

  const endpoint = `${deepSeekBaseUrl}/chat/completions`;
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${deepSeekApiKey}`
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL_NAME,
        messages: messages,
        stream: true,
        temperature: 1.3
      })
    });
  } catch (error) {
    if (error instanceof TypeError && (error.message.includes("fetch") || error.message.includes("Failed to fetch"))) {
      throw new Error(`Connection Failed: Browser blocked access to ${deepSeekBaseUrl}.`);
    }
    throw error;
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText);
    throw new Error(`DeepSeek Stream API Error (${response.status}): ${errText}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (trimmed.startsWith('data: ')) {
        try {
          const json = JSON.parse(trimmed.slice(6));
          const content = json.choices[0]?.delta?.content || '';
          if (content) yield content;
        } catch (e) {
          console.error('Error parsing DeepSeek stream chunk', e);
        }
      }
    }
  }
}

// 1. ANALYTICAL ENGINE
export const analyzeArticle = async (text: string): Promise<AnalysisResult> => {
  const systemPrompt = `You are a specialized Legal AI Analyst. Analyze the provided legal text and extract key dimensions into JSON.`;
  const schema = {
    type: Type.OBJECT,
    properties: {
      policyImpact: { type: Type.STRING },
      executionTime: { type: Type.STRING },
      targetAudience: { type: Type.STRING },
      riskFactors: { type: Type.ARRAY, items: { type: Type.STRING } },
      summary: { type: Type.STRING }
    },
    required: ["policyImpact", "executionTime", "targetAudience", "riskFactors", "summary"]
  };

  try {
    if (currentProvider === 'deepseek') {
      const messages = [
        { role: "system", content: systemPrompt + " Return ONLY JSON." },
        { role: "user", content: `Analyze:\n${text}` }
      ];
      const jsonStr = await callDeepSeek(messages, true);
      const cleanJsonStr = cleanJson(jsonStr);
      return JSON.parse(cleanJsonStr);
    } else {
      const googleAi = getGeminiClient();
      // Apply Retry Logic
      const response = await retryWithBackoff(() => googleAi.models.generateContent({
        model: GEMINI_MODEL_NAME,
        contents: text,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: schema,
          maxOutputTokens: 8192 // Ensure sufficient tokens
        }
      })) as GenerateContentResponse;
      
      if (response.text) return JSON.parse(response.text) as AnalysisResult;
      throw new Error("Empty response from Gemini");
    }
  } catch (error) {
    console.error("Analysis failed:", error);
    return {
      policyImpact: "Analysis failed",
      executionTime: "Unknown",
      targetAudience: "Unknown",
      riskFactors: [`Error: ${error instanceof Error ? error.message : String(error)}`],
      summary: "Could not generate analysis."
    };
  }
};

// --- WORKSPACE DEEP ANALYSIS ---
export const generateDocumentAnalysis = async (
    title: string, 
    content: string, 
    category: string,
    lang: Language = 'en'
): Promise<DocumentAnalysis> => {
  const outputLang = lang === 'zh' ? 'Chinese (Simplified)' : 'English';
  
  const systemPrompt = `You are LexiHub's Senior Legal Compliance Auditor. 
  Your goal is to "Solve Pain Points" for the user by analyzing their document (Category: ${category}).
  
  PAIN POINTS TO SOLVE:
  1. Reading long documents is tedious -> Provide a crisp Executive Summary.
  2. Hidden risks are dangerous -> Assign a Risk Score (0-100) and list specific High/Medium/Low risks.
  3. Not knowing what to do next -> Provide concrete Actionable Insights.

  IMPORTANT: The output must be in ${outputLang}.

  Output strictly in JSON.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      riskScore: { type: Type.NUMBER, description: "0 is safe, 100 is critical risk." },
      executiveSummary: { type: Type.STRING, description: "A concise summary of the document." },
      keyRisks: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
             severity: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
             title: { type: Type.STRING },
             description: { type: Type.STRING }
          }
        }
      },
      actionableInsights: { type: Type.ARRAY, items: { type: Type.STRING } },
      sentiment: { type: Type.STRING, enum: ["Positive", "Neutral", "Negative", "Caution"] }
    },
    required: ["riskScore", "executiveSummary", "keyRisks", "actionableInsights", "sentiment"]
  };

  try {
     // Use DeepSeek if selected, otherwise Gemini
     if (currentProvider === 'deepseek') {
        const messages = [
            { role: "system", content: systemPrompt + " Return JSON matching the schema: riskScore (number), executiveSummary, keyRisks [{severity, title, description}], actionableInsights [string], sentiment." },
            { role: "user", content: `Document Title: ${title}\n\nContent:\n${content.substring(0, 15000)}` }
        ];
        const jsonStr = await callDeepSeek(messages, true);
        try {
            return JSON.parse(cleanJson(jsonStr));
        } catch (e) {
            console.error("DeepSeek JSON Parse Error:", e);
            throw new Error("DeepSeek returned malformed JSON. The document might be too large or the response was truncated.");
        }
     } else {
        const googleAi = getGeminiClient();
        const response = await retryWithBackoff(() => googleAi.models.generateContent({
            model: GEMINI_MODEL_NAME,
            contents: `Document Title: ${title}\n\nContent:\n${content.substring(0, 20000)}`, // Limit context
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: "application/json",
                responseSchema: schema,
                maxOutputTokens: 8192 // Ensure we have enough output tokens for large analyses
            }
        })) as GenerateContentResponse;
        
        if (response.text) {
             try {
                 return JSON.parse(response.text);
             } catch (e) {
                 // Fallback: try cleaning markdown just in case (though schema mode shouldn't have it)
                 try {
                     const cleaned = cleanJson(response.text);
                     return JSON.parse(cleaned);
                 } catch (e2) {
                     console.error("Gemini JSON Parse Error:", e2);
                     throw new Error("Gemini returned malformed JSON. The response might have been truncated due to complexity.");
                 }
             }
        }
        throw new Error("No analysis returned from Gemini.");
     }

  } catch (error: any) {
    console.error("Document Deep Analysis Failed:", error);
    throw new Error(error.message || "Analysis Failed");
  }
}

// 2. CHAT BOT (Streaming)
export async function* streamChatMessage(
  history: { role: string; content: string }[], 
  context: string,
  userQuery: string,
  lang: Language = 'en'
) {
  const outputLang = lang === 'zh' ? 'Chinese (Simplified)' : 'English';
  
  // UPDATED: System Prompt to enforce language matching strictly
  const systemInstruction = `You are LexiHub, a specialized Legal AI Assistant.
  
  LANGUAGE PROTOCOL:
  1. Your interface is currently set to: ${outputLang}.
  2. You MUST respond in ${outputLang}, regardless of the language of the provided context.
  3. If the user asks in a different language than ${outputLang}, you should politely answer in ${outputLang} (or mirror them if appropriate, but prefer ${outputLang}).
  
  Use the provided Context below to answer. If the answer is not in the context, use your general legal knowledge but prioritize the context.

  Context:\n${context}`;

  if (currentProvider === 'deepseek') {
    const deepSeekHistory = history.map(msg => ({
      role: msg.role === 'model' ? 'assistant' : msg.role,
      content: msg.content
    }));
    const messages = [{ role: "system", content: systemInstruction }, ...deepSeekHistory, { role: "user", content: userQuery }];
    yield* callDeepSeekStream(messages);
  } else {
    try {
      const googleAi = getGeminiClient();
      const geminiHistory = history
        .filter(msg => msg.role !== 'system')
        .map(msg => ({
          role: msg.role === 'model' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        }));

      const chat = googleAi.chats.create({
        model: GEMINI_MODEL_NAME,
        history: geminiHistory,
        config: { systemInstruction }
      });

      // Retry initializing the stream call is hard, usually chat doesn't hit limit on init but on message
      // We wrap the sendMessageStream in a retry block for the initial request
      const responseStream = await retryWithBackoff(() => chat.sendMessageStream({ message: userQuery })) as AsyncIterable<GenerateContentResponse>;
      
      for await (const chunk of responseStream) {
        const c = chunk as GenerateContentResponse;
        if (c.text) yield chunk.text;
      }
    } catch (error: any) {
      console.error("Gemini Chat Error:", error);
      yield `[System Error] ${error.message || 'Connection failed'}. Please check your API Key in Settings.`;
    }
  }
}

// 3. CRAWLER (Extraction)
export const crawlUrl = async (url: string): Promise<Article> => {
  const fetchHtml = async (u: string) => `<html><body>Mock Content for ${u}</body></html>`; 
  const htmlContent = await fetchHtml(url);

  try {
     const googleAi = getGeminiClient();
     // Apply Retry Logic
     const response = await retryWithBackoff(() => googleAi.models.generateContent({
      model: GEMINI_MODEL_NAME,
      contents: `Extract article info from HTML: ${htmlContent.substring(0, 10000)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { title: { type: Type.STRING }, source: { type: Type.STRING }, publishDate: { type: Type.STRING }, content: { type: Type.STRING } }
        }
      }
    })) as GenerateContentResponse;
    const extracted = JSON.parse(response.text || "{}");
    return {
      id: `crawled-${Date.now()}`,
      url: url,
      title: extracted.title || "Untitled",
      content: extracted.content || "No content",
      source: extracted.source || "Unknown",
      publishDate: extracted.publishDate || new Date().toLocaleString(),
      type: ContentType.ARTICLE,
      createdAt: new Date().toISOString(),
      isAnalyzed: false
    };
  } catch (error) {
    throw new Error("AI Extraction failed.");
  }
};

// --- AGENT FUNCTIONS ---

// Step 1: Extract Intent
export const extractAgentIntent = async (query: string): Promise<AgentIntent> => {
  try {
    const googleAi = getGeminiClient();
    const prompt = `Analyze query: "${query}". Extract: event, location, contactPerson, phone. If missing use '-'.`;
    const schema = {
      type: Type.OBJECT,
      properties: { event: { type: Type.STRING }, location: { type: Type.STRING }, contactPerson: { type: Type.STRING }, phone: { type: Type.STRING } },
      required: ["event", "location", "contactPerson", "phone"]
    };

    // Apply Retry Logic
    const response = await retryWithBackoff(() => googleAi.models.generateContent({
      model: GEMINI_MODEL_NAME,
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: schema }
    })) as GenerateContentResponse;

    if (response.text) return JSON.parse(response.text);
    throw new Error("Empty intent response");
  } catch (error: any) {
    // If we fail here (e.g. 403), we must throw to stop the flow and alert user
    console.error("Intent extraction failed:", error);
    throw new Error(`Intent Error: ${error.message || 'API Failure'}`);
  }
};

// Step 2: Search with Grounding (With Fallback)
export const searchWithGrounding = async (query: string): Promise<{ text: string, links: SearchResult[], error?: boolean, errorMessage?: string }> => {
  // Strategy 1: SerpApi
  if (serpApiKey) {
    try {
      const data = await callSerpApi(query);
      const links: SearchResult[] = [];
      let text = JSON.stringify(data).substring(0, 5000); 
      if (data.organic_results) {
         data.organic_results.forEach((r: any) => links.push({title: r.title, url: r.link}));
      }
      return { text: "SerpApi Results: " + text, links };
    } catch (e: any) {
      return { text: "", links: [], error: true, errorMessage: `SerpApi Error: ${e.message}` };
    }
  }

  // Strategy 2: Gemini Grounding
  const googleAi = getGeminiClient();
  
  try {
    // ATTEMPT 1: Try with Google Search Tool (Grounded)
    console.log("[Gemini] Attempting grounded search...");
    const response = await retryWithBackoff(() => googleAi.models.generateContent({
      model: "gemini-2.0-flash", 
      contents: `Find law firms for: ${query}. List names, phones, addresses.`,
      config: {
        tools: [{ googleSearch: {} }]
      }
    }), 3, 2000) as GenerateContentResponse; // Reduce retries for tool to fail faster

    const text = response.text || "";
    if (!text) throw new Error("No text returned from Gemini Search.");
    
    const links: SearchResult[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    chunks.forEach((chunk: any) => {
      if (chunk.web?.uri) links.push({ title: chunk.web.title || "Source", url: chunk.web.uri });
    });

    return { text, links };

  } catch (error: any) {
    console.warn("[Gemini] Grounded Search failed (likely 429). Falling back to pure generation...", error.message);
    
    // ATTEMPT 2: Fallback to Pure Generation (No Tool) if Quota Exceeded
    // This allows the user to still get a result, even if it's not "live" from the web.
    try {
       const fallbackResponse = await retryWithBackoff(() => googleAi.models.generateContent({
        model: GEMINI_MODEL_NAME,
        contents: `You are a legal assistant. The user wants to find lawyers for: "${query}". 
        Since you cannot access the internet right now, please provide general advice on how to find such a lawyer, 
        or list any famous/well-known law firms you know from your training data in that location.
        Mark your response clearly saying 'Note: Live search is unavailable, these are general suggestions.'`,
      }), 2, 2000) as GenerateContentResponse;

      return { 
        text: `[SYSTEM WARNING: Search Quota Exceeded. Showing AI Knowledge instead.]\n\n${fallbackResponse.text || "No suggestions available."}`, 
        links: [] 
      };

    } catch (fallbackError: any) {
      console.error("Gemini Fallback Failed:", fallbackError);
      return { 
        text: "", 
        links: [],
        error: true,
        errorMessage: `Both Search and Fallback failed. Key: ${getMaskedGeminiKey()}. Error: ${fallbackError.message}`
      };
    }
  }
};

// Step 3 (Streaming): Structure Leads
export async function* structureLeadsStream(rawText: string) {
  if (!rawText || rawText.startsWith("Configuration Error")) return;

  const prompt = `Extract law firms from text. JSON Array. Text: ${rawText.substring(0, 20000)}`;
  const schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        lawFirm: { type: Type.STRING },
        contact: { type: Type.STRING },
        phone: { type: Type.STRING },
        address: { type: Type.STRING },
        sourceUrl: { type: Type.STRING }
      },
      required: ["lawFirm", "contact", "phone", "address", "sourceUrl"]
    }
  };

  try {
    const googleAi = getGeminiClient();
    // Apply Retry Logic for Stream Initialization
    const streamResponse = await retryWithBackoff(() => googleAi.models.generateContentStream({
      model: GEMINI_MODEL_NAME,
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: schema }
    })) as AsyncIterable<GenerateContentResponse>;

    for await (const chunk of streamResponse) {
       if (chunk.text) yield chunk.text;
    }
  } catch (error: any) {
    console.error("Lead Structuring Failed:", error);
    throw new Error(`Structuring Error: ${error.message}`);
  }
}