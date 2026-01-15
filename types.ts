
export enum ContentType {
  ANNOUNCEMENT = 'ANNOUNCEMENT', // 公告
  ARTICLE = 'ARTICLE', // 推文
  REGULATION = 'REGULATION', // 法规
  REPORT = 'REPORT', // 报告
  DATA = 'DATA', // 数据图表
  MEETING_NOTE = 'MEETING_NOTE', // 会议纪要
}

export interface Subscription {
  id: string;
  name: string;
  avatar?: string;
  unreadCount?: number;
}

export interface AnalysisResult {
  policyImpact: string;
  executionTime: string;
  targetAudience: string;
  riskFactors: string[];
  summary: string;
}

export interface Article {
  id: string;
  subscriptionId?: string;
  title: string;
  content: string;
  source: string; // e.g., "Official Website", "WeChat: LawDaily"
  url: string;
  type: ContentType;
  publishDate: string;
  createdAt: string;
  isAnalyzed: boolean;
  analysis?: AnalysisResult;
}

// New Interface for Personal Workspace Documents
export interface PersonalDoc {
  id: string;
  title: string;
  category: 'Report' | 'Meeting' | 'Data' | 'Other';
  content: string;
  tags: string[];
  updatedAt: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  isThinking?: boolean;
  sources?: string[]; // For RAG citations
  searchResults?: Array<{ title: string; uri: string }>; // For Google Search results
}

export type ViewState = 'dashboard' | 'knowledge' | 'workspace' | 'chat' | 'settings';

export type AIProvider = 'gemini' | 'deepseek';

// --- Agent Types ---
export interface AgentIntent {
  event: string;
  location: string;
  contactPerson: string;
  phone: string;
}

export interface AgentLead {
  lawFirm: string;
  contact: string;
  phone: string;
  address: string;
  sourceUrl: string;
}

export interface SearchResult {
  title: string;
  url: string;
}