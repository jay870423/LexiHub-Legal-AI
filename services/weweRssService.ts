import { Article, ContentType, Subscription } from "../types";

const DEFAULT_API_URL = "https://weread.111965.xyz";

// Helper to fetch JSON via proxy to bypass CORS
const proxyFetch = async (url: string, options?: RequestInit): Promise<any> => {
  // Strategy: Try direct first (if CORS allowed), then fall back to proxies
  try {
    const directRes = await fetch(url, options);
    if (directRes.ok) return await directRes.json();
  } catch (e) {
    console.warn("Direct fetch failed, trying proxies...", e);
  }

  const proxies = [
    {
      name: 'CorsProxy.io',
      url: (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
      transform: async (res: Response) => await res.json()
    },
    {
      name: 'AllOrigins',
      url: (u: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
      transform: async (res: Response) => {
        const data = await res.json();
        // AllOrigins returns the content as a string in 'contents'
        return JSON.parse(data.contents);
      }
    }
  ];

  for (const proxy of proxies) {
    try {
      const fetchUrl = proxy.url(url);
      const res = await fetch(fetchUrl, options);
      if (res.ok) {
        return await proxy.transform(res);
      }
    } catch (e) {
      console.warn(`Proxy ${proxy.name} failed:`, e);
    }
  }

  throw new Error("Failed to fetch from Wewe-RSS API via all available proxies.");
};

export const weweApi = {
  // 1. Get the WeRead Login URL (to generate QR Code)
  getLoginUrl: async (baseUrl: string = DEFAULT_API_URL) => {
    // Endpoint: /v1/auth/login - Returns the WeChat Reading login URL
    const data = await proxyFetch(`${baseUrl}/v1/auth/login`);
    // Standard wewe-rss response: { code: 0, msg: "success", data: "https://weread.qq.com/..." }
    if (data && data.code === 0 && data.data) {
      return data.data;
    }
    throw new Error(data?.msg || "Failed to get login URL");
  },

  // 2. Check Login Status (Poll this)
  checkLoginStatus: async (baseUrl: string = DEFAULT_API_URL) => {
    // We check /v1/user/info. If 200/code=0, we are logged in.
    try {
      const data = await proxyFetch(`${baseUrl}/v1/user/info`);
      if (data && data.code === 0) {
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  },

  // 3. Fetch Subscribed Accounts (Feeds)
  getSubscriptions: async (baseUrl: string = DEFAULT_API_URL): Promise<Subscription[]> => {
    // Endpoint: /v1/feed/list is the standard for subscribed official accounts
    let data;
    try {
        data = await proxyFetch(`${baseUrl}/v1/feed/list`);
    } catch (e) {
        console.warn("Failed to fetch feed list", e);
        return [];
    }

    if (data && data.code === 0 && Array.isArray(data.data)) {
      return data.data.map((item: any) => ({
        id: `wx-${item.id || item.mpName}`, // Prefix to ensure unique ID
        name: item.mpName || item.name || "Unknown Account",
        avatar: item.headImg || item.cover || `https://ui-avatars.com/api/?name=${(item.mpName || "WX").substring(0, 2)}`,
        unreadCount: 0 
      }));
    }
    return [];
  },

  // 4. Fetch Recent Articles
  // wewe-rss article list usually returns { code: 0, data: { total: 100, list: [...] } } or just data: [...]
  getArticles: async (baseUrl: string = DEFAULT_API_URL): Promise<Article[]> => {
    try {
        const data = await proxyFetch(`${baseUrl}/v1/article/list?limit=20`);
        
        let articleList = [];
        if (data && data.code === 0) {
           if (Array.isArray(data.data)) {
               articleList = data.data;
           } else if (data.data && Array.isArray(data.data.list)) {
               articleList = data.data.list;
           }
        }

        if (articleList.length > 0) {
            return articleList.map((item: any) => ({
                id: `wx-art-${item.id}`,
                subscriptionId: `wx-${item.mpName}`, // Best effort mapping to subscription
                title: item.title,
                content: item.htmlContent || item.desc || "<p>Content not available in preview.</p>",
                source: item.mpName,
                url: item.url || "#",
                type: ContentType.ARTICLE,
                publishDate: item.publishTime ? new Date(item.publishTime * 1000).toLocaleString() : new Date().toLocaleString(),
                createdAt: new Date().toISOString(),
                isAnalyzed: false
            }));
        }
    } catch (e) {
        console.warn("Failed to fetch article list", e);
    }
    return [];
  }
};