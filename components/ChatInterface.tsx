import React, { useState, useRef, useEffect } from 'react';
import { Article, Message, PersonalDoc } from '../types';
import { streamChatMessage, getGlobalProvider } from '../services/geminiService';
import { Send, User, Bot, FileText, Loader2, Sparkles, AlertTriangle, Database, FolderKanban, X, ExternalLink, Calendar } from 'lucide-react';

interface ChatInterfaceProps {
  articles: Article[];
  personalDocs: PersonalDoc[];
}

type KnowledgeSource = 'public_demo' | 'personal_workspace';

// Helper Interface for the Modal Content
interface ReferenceContent {
  title: string;
  content: string;
  source: string;
  url?: string;
  date?: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ articles, personalDocs }) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: '0', role: 'model', content: 'Hello. I am LexiHub, your AI Legal Assistant. Select a knowledge source below and ask me anything.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sourceMode, setSourceMode] = useState<KnowledgeSource>('public_demo');
  
  // Reference Modal State
  const [selectedReference, setSelectedReference] = useState<ReferenceContent | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // --- RAG LOGIC START ---
    // Updated: Smarter keyword extraction for multi-language support (Chinese/English)
    const keywords = input.toLowerCase()
      .split(/[\s,，.。?？!！]+/) // Split by common delimiters (English & Chinese)
      .filter(w => w.length >= 2 || /[\u4e00-\u9fa5]/.test(w)); // Keep words >= 2 chars OR any Chinese chars

    let context = "";
    let sources: string[] = [];

    if (sourceMode === 'public_demo') {
      const relevantArticles = articles.filter(a => 
        keywords.some(k => a.title.toLowerCase().includes(k) || a.content.toLowerCase().includes(k))
      );
      
      context = relevantArticles.length > 0 
        ? relevantArticles.map(a => `SOURCE: ${a.title}\nTYPE: ${a.type}\nCONTENT: ${a.content}\nANALYSIS: ${JSON.stringify(a.analysis || {})}`).join('\n\n')
        : "No specific documents found in public knowledge base.";
      
      sources = relevantArticles.map(a => a.title);

    } else {
      const relevantDocs = personalDocs.filter(d => 
        keywords.some(k => d.title.toLowerCase().includes(k) || d.content.toLowerCase().includes(k) || d.tags.some(t => t.toLowerCase().includes(k)))
      );

      const topDocs = relevantDocs.slice(0, 5);

      context = topDocs.length > 0
        ? topDocs.map(d => `SOURCE: ${d.title}\nCATEGORY: ${d.category}\nUPDATED: ${d.updatedAt}\nCONTENT: ${d.content}`).join('\n\n')
        : "No relevant documents found in your personal workspace.";

      sources = topDocs.map(d => d.title);
    }
    // --- RAG LOGIC END ---

    const historyForApi = messages.map(m => ({ role: m.role, content: m.content }));

    const botMsgId = (Date.now() + 1).toString();
    const initialBotMsg: Message = {
      id: botMsgId,
      role: 'model',
      content: '', 
      sources: sources
    };
    
    setMessages(prev => [...prev, initialBotMsg]);

    try {
      const stream = streamChatMessage(historyForApi, context, userMsg.content);
      let fullContent = '';
      for await (const chunk of stream) {
        if (!isMounted.current) break;
        fullContent += chunk;
        setMessages(prev => prev.map(msg => 
          msg.id === botMsgId ? { ...msg, content: fullContent } : msg
        ));
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown connection error";
      setMessages(prev => prev.map(msg => 
        msg.id === botMsgId ? { ...msg, content: msg.content + `\n[System Error: ${errorMessage}]` } : msg
      ));
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  };

  // Handle clicking a citation source
  const handleSourceClick = (sourceTitle: string) => {
    // 1. Search in Personal Docs
    const pDoc = personalDocs.find(d => d.title === sourceTitle);
    if (pDoc) {
      setSelectedReference({
        title: pDoc.title,
        content: pDoc.content,
        source: "My Workspace",
        date: new Date(pDoc.updatedAt).toLocaleDateString()
      });
      return;
    }

    // 2. Search in Public Articles
    const article = articles.find(a => a.title === sourceTitle);
    if (article) {
      setSelectedReference({
        title: article.title,
        content: article.content,
        source: article.source,
        url: article.url,
        date: article.publishDate
      });
      return;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] md:h-[calc(100vh-10rem)] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
      
      {/* Header with Source Toggle */}
      <div className="p-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center px-4">
         <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
            <Sparkles size={16} className="text-blue-500" />
            <span>AI Assistant</span>
         </div>
         
         <div className="flex bg-gray-200 p-1 rounded-lg">
            <button 
              onClick={() => setSourceMode('public_demo')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                sourceMode === 'public_demo' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
               <Database size={12} /> Public Data
            </button>
            <button 
               onClick={() => setSourceMode('personal_workspace')}
               className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                sourceMode === 'personal_workspace' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
               <FolderKanban size={12} /> My Workspace
            </button>
         </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6 bg-slate-50 scroll-smooth" ref={scrollRef}>
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex gap-2 md:gap-3 max-w-[90%] md:max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === 'user' ? 'bg-slate-700 text-white' : 'bg-blue-600 text-white shadow-blue-200 shadow-lg'
              }`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={18} />}
              </div>
              
              <div className={`space-y-2`}>
                <div className={`p-3 md:p-4 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-slate-800 text-white rounded-tr-none' 
                    : 'bg-white text-slate-800 border border-gray-200 shadow-sm rounded-tl-none'
                }`}>
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  
                  {msg.role === 'model' && msg.content.includes("[System Error") && (
                    <div className="mt-3 pt-3 border-t border-red-100 text-xs text-red-600 flex items-start gap-2">
                       <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                       <span>Check API settings.</span>
                    </div>
                  )}

                  {isLoading && msg.role === 'model' && msg.id === messages[messages.length - 1].id && (
                    <span className="inline-block w-2 h-4 ml-1 bg-blue-400 align-middle animate-pulse"></span>
                  )}
                </div>

                {/* Sources Citation */}
                {msg.role === 'model' && msg.sources && msg.sources.length > 0 && (
                   <div className="flex flex-col gap-1 animate-fade-in">
                      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider ml-1">References (Click to view)</span>
                      <div className="flex flex-wrap gap-2">
                        {msg.sources.slice(0, 5).map((src, i) => (
                          <button 
                            key={i} 
                            onClick={() => handleSourceClick(src)}
                            className="flex items-center gap-1 text-[10px] md:text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100 max-w-full hover:bg-indigo-100 transition-colors"
                          >
                             <FileText size={10} className="shrink-0" />
                             <span className="truncate max-w-[200px]">{src}</span>
                          </button>
                        ))}
                      </div>
                   </div>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && messages[messages.length - 1].content === '' && (
          <div className="flex justify-start">
             <div className="flex gap-3">
               <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center">
                 <Bot size={16} />
               </div>
               <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-200 flex items-center gap-2">
                 <Loader2 className="animate-spin text-blue-600" size={16} />
                 <span className="text-xs text-slate-500 font-medium">Analyzing {sourceMode === 'personal_workspace' ? 'your workspace' : 'database'}...</span>
               </div>
             </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 md:p-4 bg-white border-t border-gray-200">
        <div className="relative max-w-4xl mx-auto flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={sourceMode === 'personal_workspace' ? "Ask about your reports, data, or notes..." : "Ask LexiHub about laws and regulations..."}
            disabled={isLoading}
            className={`flex-1 pl-4 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:bg-white text-slate-900 transition-all shadow-inner disabled:opacity-60 text-sm md:text-base ${
               sourceMode === 'personal_workspace' ? 'focus:ring-indigo-500' : 'focus:ring-blue-500'
            }`}
          />
          <button 
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className={`p-3 text-white rounded-xl disabled:opacity-50 transition-colors shrink-0 ${
               sourceMode === 'personal_workspace' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
          </button>
        </div>
        <p className="text-center text-[10px] text-slate-400 mt-2">
           Context: {sourceMode === 'personal_workspace' ? 'My Workspace' : 'Public Knowledge Base'}
        </p>
      </div>

      {/* REFERENCE PREVIEW MODAL */}
      {selectedReference && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-2xl max-h-[80%] flex flex-col animate-in zoom-in-95 duration-200">
              {/* Modal Header */}
              <div className="p-4 border-b border-gray-100 flex justify-between items-start gap-4 bg-gray-50 rounded-t-xl">
                 <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                       <span className="font-semibold px-1.5 py-0.5 bg-slate-200 rounded text-slate-700">{selectedReference.source}</span>
                       <span className="flex items-center gap-1"><Calendar size={10}/> {selectedReference.date}</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 leading-snug">{selectedReference.title}</h3>
                 </div>
                 <button 
                   onClick={() => setSelectedReference(null)}
                   className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                 >
                    <X size={20} />
                 </button>
              </div>
              
              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 prose prose-slate max-w-none text-sm">
                 <div dangerouslySetInnerHTML={{ __html: selectedReference.content }} />
              </div>

              {/* Modal Footer */}
              <div className="p-3 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end">
                 {selectedReference.url && selectedReference.url !== '#' && (
                    <a 
                      href={selectedReference.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                       <span>View Original Source</span>
                       <ExternalLink size={14} />
                    </a>
                 )}
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default ChatInterface;