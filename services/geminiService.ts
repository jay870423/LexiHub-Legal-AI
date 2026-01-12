import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, Article, ContentType, AIProvider, AgentIntent, AgentLead, SearchResult } from "../types";

// --- Configuration & State ---
const GEMINI_MODEL_NAME = "gemini-3-flash-preview";
const DEEPSEEK_MODEL_NAME = "deepseek-chat";

// State to track current provider and keys
let currentProvider: AIProvider = (localStorage.getItem('ai_provider') as AIProvider) || 'gemini';
let deepSeekApiKey: string = localStorage.getItem('deepseek_api_key') || '';
let serpApiKey: string = localStorage.getItem('serp_api_key') || '';

// Clean the stored URL on init to prevent "undefined" string or double slashes
const storedBaseUrl = localStorage.getItem('deepseek_base_url');
let deepSeekBaseUrl: string = storedBaseUrl ? storedBaseUrl.replace(/\/$/, '') : 'https://api.deepseek.com';

// Initialize the Google GenAI client (Always initialized with env key)
const googleAi = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Configuration Setters
export const setGlobalProvider = (provider: AIProvider) => {
  currentProvider = provider;
  localStorage.setItem('ai_provider', provider);
  console.log(`[LexiHub] Provider switched to: ${provider}`);
};

export const setGlobalDeepSeekKey = (key: string) => {
  deepSeekApiKey = key;
  localStorage.setItem('deepseek_api_key', key);
};

export const setGlobalDeepSeekBaseUrl = (url: string) => {
  // Remove trailing slash if present for consistency
  const cleanUrl = url.trim().replace(/\/$/, '');
  deepSeekBaseUrl = cleanUrl;
  localStorage.setItem('deepseek_base_url', cleanUrl);
};

export const setGlobalSerpApiKey = (key: string) => {
  serpApiKey = key;
  localStorage.setItem('serp_api_key', key);
};

export const getGlobalProvider = () => currentProvider;

// --- Helper: SerpApi Fetcher ---
const callSerpApi = async (query: string): Promise<any> => {
  if (!serpApiKey) throw new Error("SerpApi Key is missing");

  // Use local proxy if available (Vite/Vercel) to avoid CORS
  const baseUrl = '/api/proxy/serpapi'; 
  // Fallback to direct URL if we are confident (but usually fails CORS in browser) 
  // or use a public CORS proxy as a last resort backup if local proxy 404s
  
  const params = new URLSearchParams({
    engine: "google",
    q: query,
    api_key: serpApiKey,
    google_domain: "google.com",
    hl: "en", // language
    gl: "us", // country - can be dynamic but defaulting to US for broad access
    num: "10"
  });

  try {
    const response = await fetch(`${baseUrl}/search.json?${params.toString()}`);
    if (!response.ok) {
       // Try direct fetch if proxy fails (e.g. not running on Vercel/Vite correctly)
       const directUrl = `https://serpapi.com/search.json?${params.toString()}`;
       const directResponse = await fetch(directUrl);
       if (!directResponse.ok) {
         const err = await directResponse.json();
         throw new Error(`SerpApi Error: ${err.error || directResponse.statusText}`);
       }
       return await directResponse.json();
    }
    return await response.json();
  } catch (error) {
    console.error("SerpApi Fetch Error:", error);
    throw error;
  }
};

// --- Helper: DeepSeek Fetcher (Non-Streaming) ---
const callDeepSeek = async (messages: any[], jsonMode: boolean = false) => {
  if (!deepSeekApiKey) {
    throw new Error("DeepSeek API Key is missing. Please configure it in Settings.");
  }

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
      throw new Error(`Network Error: Browser blocked request to ${deepSeekBaseUrl}. This is likely CORS. Please use a Proxy URL.`);
    }
    throw error;
  }
};

// --- Helper: DeepSeek Stream Generator ---
async function* callDeepSeekStream(messages: any[]) {
  if (!deepSeekApiKey) {
    throw new Error("DeepSeek API Key is missing. Please configure it in Settings.");
  }

  // Ensure URL is clean
  const baseUrl = deepSeekBaseUrl || 'https://api.deepseek.com';
  const endpoint = `${baseUrl}/chat/completions`;

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
    console.error("DeepSeek Stream Connection Error:", error);
     if (error instanceof TypeError && (error.message.includes("fetch") || error.message.includes("Failed to fetch"))) {
      throw new Error(`Connection Failed: Browser blocked access to ${baseUrl} due to CORS. Please update 'API Base URL' in Settings to a proxy (e.g. corsproxy.io) or use Gemini.`);
    }
    throw error;
  }

  if (!response.ok || !response.body) {
    const errText = await response.text().catch(() => response.statusText);
    throw new Error(`DeepSeek Stream API Error (${response.status}): ${errText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep the last incomplete line

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
  // System Prompt for consistent JSON output
  const systemPrompt = `You are a specialized Legal AI Analyst. 
  Analyze the provided legal text or news article and extract key dimensions into a strict JSON format.
  Return ONLY the JSON object, no markdown formatting.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      policyImpact: { type: Type.STRING, description: "Detailed impact of the policy on businesses or individuals." },
      executionTime: { type: Type.STRING, description: "Specific dates or timelines mentioned for enforcement." },
      targetAudience: { type: Type.STRING, description: "Who does this regulation or news apply to?" },
      riskFactors: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: "List of potential legal or compliance risks."
      },
      summary: { type: Type.STRING, description: "A concise executive summary of the content." }
    },
    required: ["policyImpact", "executionTime", "targetAudience", "riskFactors", "summary"]
  };

  try {
    // Branch based on Provider
    if (currentProvider === 'deepseek') {
      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analyze this content:\n\n${text}` }
      ];
      const jsonStr = await callDeepSeek(messages, true);
      // Clean up markdown code blocks if present (common in DeepSeek output even with JSON mode)
      const cleanJson = jsonStr.replace(/```json\n?|\n?```/g, '');
      return JSON.parse(cleanJson);
    } else {
      // Default: Gemini
      const response = await googleAi.models.generateContent({
        model: GEMINI_MODEL_NAME,
        contents: text,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: schema
        }
      });
      
      if (response.text) {
        return JSON.parse(response.text) as AnalysisResult;
      }
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
  const systemInstruction = `You are LexiHub, a specialized Legal AI Assistant.
  
    1. **Knowledge Base Priority**: Always prioritize the provided [CONTEXT] to answer the user's question.
    2. **Analysis Style**: Be professional, objective, and cite specific clauses or source titles if available in the context.
    3. **No External Tools**: You do not have direct access to Google Search tools. If the user asks for current lawyer contacts or real-time info not in the context, clearly state that you are answering based on the provided Knowledge Base and your general legal training.
    4. **Lead Generation**: If the user asks to find a lawyer, provide general advice on how to find one (e.g., Bar Associations) unless specific lawyer details are in the [CONTEXT].
    
    [CONTEXT START]
    ${context}
    [CONTEXT END]`;

  if (currentProvider === 'deepseek') {
    // --- DeepSeek Streaming ---

    // Map 'model' role to 'assistant' for OpenAI-compatible APIs (like DeepSeek)
    const deepSeekHistory = history.map(msg => ({
      role: msg.role === 'model' ? 'assistant' : msg.role,
      content: msg.content
    }));

    const messages = [
      { role: "system", content: systemInstruction },
      ...deepSeekHistory,
      { role: "user", content: userQuery }
    ];
    
    yield* callDeepSeekStream(messages);

  } else {
    // --- Gemini Streaming ---
    try {
      // Filter out any system messages from the history array for Gemini Chat
      const geminiHistory = history
        .filter(msg => msg.role !== 'system')
        .map(msg => ({
          role: msg.role === 'model' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        }));

      const chat = googleAi.chats.create({
        model: GEMINI_MODEL_NAME,
        history: geminiHistory,
        config: {
          systemInstruction: systemInstruction,
        }
      });

      const responseStream = await chat.sendMessageStream({ message: userQuery });
      
      for await (const chunk of responseStream) {
        // Safe casting based on Google GenAI SDK
        const c = chunk as GenerateContentResponse;
        if (c.text) {
          yield c.text;
        }
      }
    } catch (error) {
      console.error("Gemini Chat Stream Error:", error);
      yield "Sorry, I encountered an error connecting to the Google Gemini service.";
    }
  }
}

// 3. CRAWLER
export const crawlUrl = async (url: string): Promise<Article> => {
  // Helper to try multiple proxies (Simplified for brevity)
  const fetchHtml = async (targetUrl: string): Promise<string> => {
    try {
      const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`);
      if (!response.ok) throw new Error("Proxy error");
      const data = await response.json();
      return data.contents;
    } catch (e) {
      // Fallback
      return `<html><body><p>Could not crawl. Error: ${String(e)}</p></body></html>`;
    }
  };

  let htmlContent = await fetchHtml(url);

  // Extraction Prompt
  const prompt = `Analyze the provided HTML source code and extract article info.
  HTML Source (Truncated):
  ${htmlContent.substring(0, 30000)}`;

  try {
     const response = await googleAi.models.generateContent({
      model: GEMINI_MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: "You are an intelligent web scraper. Extract: title, source, publishDate, content (clean HTML). Return JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
             title: { type: Type.STRING },
             source: { type: Type.STRING },
             publishDate: { type: Type.STRING },
             content: { type: Type.STRING }
          },
          required: ["title", "source", "publishDate", "content"]
        }
      }
    });

    if (!response.text) throw new Error("No data extracted");
    const extracted = JSON.parse(response.text);

    return {
      id: `crawled-${Date.now()}`,
      url: url,
      title: extracted.title || "Untitled",
      content: extracted.content || "<p>No content extracted</p>",
      source: extracted.source || "Unknown",
      publishDate: extracted.publishDate || new Date().toLocaleString(),
      type: ContentType.ARTICLE,
      createdAt: new Date().toISOString(),
      isAnalyzed: false,
      subscriptionId: '' 
    };
  } catch (error) {
    throw new Error("AI Extraction failed.");
  }
};

// --- AGENT FUNCTIONS (For Lead Discovery) ---

// Step 1: Extract Intent
export const extractAgentIntent = async (query: string): Promise<AgentIntent> => {
  if (!process.env.API_KEY) {
    return { event: "Error: API Key Missing", location: "Check Settings", contactPerson: "-", phone: "-" };
  }

  const prompt = `Analyze the search query and extract structured intent fields.
  Query: "${query}"
  
  If information is missing, use "-" or "Any".
  
  Fields:
  - event: The legal issue or event (e.g. "Civil Dispute", "IPO", "Divorce").
  - location: The city or region (e.g. "Beijing").
  - contactPerson: Name of specific person if mentioned, else "-".
  - phone: Phone number if mentioned, else "-".`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      event: { type: Type.STRING },
      location: { type: Type.STRING },
      contactPerson: { type: Type.STRING },
      phone: { type: Type.STRING }
    },
    required: ["event", "location", "contactPerson", "phone"]
  };

  try {
    const response = await googleAi.models.generateContent({
      model: GEMINI_MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    if (response.text) return JSON.parse(response.text);
    throw new Error("No intent extracted");
  } catch (error) {
    return { event: query, location: "Unknown", contactPerson: "-", phone: "-" };
  }
};

// Step 2: Search with Grounding (Supports SerpApi & Gemini)
export const searchWithGrounding = async (query: string): Promise<{ text: string, links: SearchResult[], error?: boolean }> => {
  
  // STRATEGY 1: SerpApi (Priority if Key exists)
  if (serpApiKey) {
    console.log("Searching with SerpApi...");
    try {
      const data = await callSerpApi(query);
      
      const links: SearchResult[] = [];
      let textContent = `[SERP-API RESULTS] Query: ${query}\n\n`;

      // 1. Process Local Results (Map Pack) - Highest Value for Leads
      if (data.local_results && data.local_results.length > 0) {
        textContent += `--- LOCAL BUSINESSES (HIGH PRIORITY) ---\n`;
        data.local_results.forEach((place: any, idx: number) => {
          textContent += `${idx + 1}. NAME: ${place.title}\n`;
          if (place.phone) textContent += `   PHONE: ${place.phone}\n`;
          if (place.address) textContent += `   ADDRESS: ${place.address}\n`;
          if (place.website) {
             textContent += `   WEBSITE: ${place.website}\n`;
             links.push({ title: `${place.title} (Map)`, url: place.website });
          }
          if (place.rating) textContent += `   RATING: ${place.rating} (${place.reviews} reviews)\n`;
          textContent += `\n`;
        });
      }

      // 2. Process Organic Results
      if (data.organic_results && data.organic_results.length > 0) {
         textContent += `--- WEB RESULTS ---\n`;
         data.organic_results.forEach((res: any) => {
           textContent += `TITLE: ${res.title}\nLINK: ${res.link}\nSNIPPET: ${res.snippet}\n\n`;
           links.push({ title: res.title, url: res.link });
         });
      }

      // 3. Process Knowledge Graph (e.g. specific entity info)
      if (data.knowledge_graph) {
        textContent += `--- KNOWLEDGE GRAPH ---\n`;
        textContent += `TITLE: ${data.knowledge_graph.title}\n`;
        if (data.knowledge_graph.description) textContent += `DESC: ${data.knowledge_graph.description}\n`;
        // Sometimes phone numbers appear here for firms
        // SerpApi structure varies, usually in a list or attributes
      }

      if (links.length === 0 && !textContent.includes("NAME:")) {
        return { text: "SerpApi returned no relevant results.", links: [], error: true };
      }

      return { text: textContent, links };

    } catch (e: any) {
      console.warn("SerpApi Failed:", e);
      // If SerpApi fails, we can either error out or fall back to Gemini. 
      // Given the user specifically switched to SerpApi, we should probably report the error clearly
      // but if the user has NO api key for Gemini Grounding (free tier limit), this is the end of the line.
      return { 
        text: `SerpApi Error: ${e.message}. Please check your API Key in Settings.`, 
        links: [], 
        error: true 
      };
    }
  }

  // STRATEGY 2: Google Gemini Native Search (Fallback / Default)
  if (!process.env.API_KEY) {
    return { 
      text: "Configuration Error: API_KEY is missing.", 
      links: [],
      error: true
    };
  }

  try {
    if (currentProvider !== 'gemini') {
      console.warn("Switching to Gemini for Search Tool capability");
    }
    
    const response = await googleAi.models.generateContent({
      model: GEMINI_MODEL_NAME, 
      contents: `Find detailed information about: ${query}. 
      List specific law firms, lawyers, their contact details (phone, address) and websites.
      Provide as much concrete detail as possible.`,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty response from Search tool (Safety or Quota).");
    }
    
    // Extract grounding chunks
    const links: SearchResult[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    chunks.forEach((chunk: any) => {
      if (chunk.web?.uri) {
        links.push({
          title: chunk.web.title || "Source Link",
          url: chunk.web.uri
        });
      }
    });

    return { text, links };

  } catch (error: any) {
    console.warn("Primary Gemini Search Failed (Likely Quota), attempting fallback...", error);
    
    try {
      const fallbackResponse = await googleAi.models.generateContent({
         model: GEMINI_MODEL_NAME,
         contents: `User asked: ${query}. 
         The search tool failed due to quota limits. 
         Please provide a general helpful response about how to find such lawyers in that location.
         Start your response with: "[SEARCH QUOTA EXCEEDED] Falling back to general knowledge: "`
      });
      
      return { 
        text: fallbackResponse.text || "No results available.", 
        links: [],
        error: true
      };

    } catch (fallbackError: any) {
       return { 
        text: `Search Critical Failure: ${error.message || 'Unknown error'}.`, 
        links: [],
        error: true
      };
    }
  }
};

// Step 3: Structure Leads (Legacy Non-Streaming)
export const structureLeads = async (rawText: string): Promise<AgentLead[]> => {
  const prompt = `Extract a list of law firms or lawyers from the text below. 
  Format as a JSON array.
  
  Text:
  ${rawText.substring(0, 20000)} // Truncate if too long`;

  const schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        lawFirm: { type: Type.STRING, description: "Name of law firm" },
        contact: { type: Type.STRING, description: "Contact person name or '-'" },
        phone: { type: Type.STRING, description: "Phone number or '-'" },
        address: { type: Type.STRING, description: "Address or City" },
        sourceUrl: { type: Type.STRING, description: "A relevant URL or '-'" }
      },
      required: ["lawFirm", "contact", "phone", "address", "sourceUrl"]
    }
  };

  try {
    const response = await googleAi.models.generateContent({
      model: GEMINI_MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    if (response.text) return JSON.parse(response.text);
    return [];
  } catch (error) {
    console.error("Structuring leads failed:", error);
    return [];
  }
};

// Step 3 (Streaming): Structure Leads with stream
export async function* structureLeadsStream(rawText: string) {
  if (rawText.startsWith("Configuration Error") || rawText.includes("Critical Failure")) {
    return;
  }

  const prompt = `Extract a list of law firms or lawyers from the text below. 
  Format as a JSON array.
  
  Text:
  ${rawText.substring(0, 20000)} // Truncate if too long`;

  const schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        lawFirm: { type: Type.STRING, description: "Name of law firm" },
        contact: { type: Type.STRING, description: "Contact person name or '-'" },
        phone: { type: Type.STRING, description: "Phone number or '-'" },
        address: { type: Type.STRING, description: "Address or City" },
        sourceUrl: { type: Type.STRING, description: "A relevant URL or '-'" }
      },
      required: ["lawFirm", "contact", "phone", "address", "sourceUrl"]
    }
  };

  try {
    const streamResponse = await googleAi.models.generateContentStream({
      model: GEMINI_MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    for await (const chunk of streamResponse) {
       yield chunk.text;
    }
  } catch (error) {
    console.error("Streaming leads failed:", error);
    throw error;
  }
}