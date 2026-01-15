import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, Article, ContentType, AIProvider, AgentIntent, AgentLead, SearchResult } from "../types";

// --- Configuration & State ---
const GEMINI_MODEL_NAME = "gemini-2.0-flash"; // Using 2.0 Flash as it is generally stable
const DEEPSEEK_MODEL_NAME = "deepseek-chat";

// State to track current provider and keys
let currentProvider: AIProvider = (localStorage.getItem('ai_provider') as AIProvider) || 'gemini';
let deepSeekApiKey: string = localStorage.getItem('deepseek_api_key') || '';
let deepSeekBaseUrl: string = localStorage.getItem('deepseek_base_url')?.replace(/\/$/, '') || 'https://api.deepseek.com';
let serpApiKey: string = localStorage.getItem('serp_api_key') || '';
// Allow runtime override of Gemini Key
let geminiApiKey: string = localStorage.getItem('gemini_api_key') || process.env.API_KEY || '';

// Helper to get dynamic client
const getGeminiClient = () => {
  if (!geminiApiKey) {
    throw new Error("Gemini API Key is missing. Please set it in Settings or Vercel Environment Variables.");
  }
  return new GoogleGenAI({ apiKey: geminiApiKey });
};

// Configuration Setters
export const setGlobalProvider = (provider: AIProvider) => {
  currentProvider = provider;
  localStorage.setItem('ai_provider', provider);
  console.log(`[LexiHub] Provider switched to: ${provider}`);
};

export const setGlobalGeminiKey = (key: string) => {
  geminiApiKey = key;
  localStorage.setItem('gemini_api_key', key);
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
// Handles 429 (Too Many Requests) and 503 (Service Unavailable)
const retryWithBackoff = async <T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const msg = (error.message || JSON.stringify(error)).toLowerCase();
    const isRateLimit = msg.includes('429') || msg.includes('resource exhausted') || msg.includes('quota exceeded');
    const isServerOverload = msg.includes('503') || msg.includes('overloaded');

    if ((isRateLimit || isServerOverload) && retries > 0) {
      console.warn(`[LexiHub AI] Rate limit hit. Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * 2);
    }
    throw error;
  }
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
        temperature: 1.3
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
      const cleanJson = jsonStr.replace(/```json\n?|\n?```/g, '');
      return JSON.parse(cleanJson);
    } else {
      const googleAi = getGeminiClient();
      // Apply Retry Logic
      const response = await retryWithBackoff(() => googleAi.models.generateContent({
        model: GEMINI_MODEL_NAME,
        contents: text,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: schema
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

// 2. CHAT BOT (Streaming)
export async function* streamChatMessage(
  history: { role: string; content: string }[], 
  context: string,
  userQuery: string
) {
  const systemInstruction = `You are LexiHub, a specialized Legal AI Assistant. Context:\n${context}`;

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
        if (c.text) yield c.text;
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

// Step 2: Search with Grounding
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
  try {
    const googleAi = getGeminiClient();
    
    // Apply Retry Logic to Gemini Search
    const response = await retryWithBackoff(() => googleAi.models.generateContent({
      model: "gemini-2.0-flash", // Keep 2.0-flash for search tools
      contents: `Find law firms for: ${query}. List names, phones, addresses.`,
      config: {
        tools: [{ googleSearch: {} }]
      }
    })) as GenerateContentResponse;

    const text = response.text || "";
    if (!text) throw new Error("No text returned from Gemini Search.");
    
    const links: SearchResult[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    chunks.forEach((chunk: any) => {
      if (chunk.web?.uri) links.push({ title: chunk.web.title || "Source", url: chunk.web.uri });
    });

    return { text, links };

  } catch (error: any) {
    console.error("Gemini Search Failed:", error);
    // Return detailed error message to be displayed in UI
    return { 
      text: "", 
      links: [],
      error: true,
      errorMessage: error.message || "Unknown Gemini API Error"
    };
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