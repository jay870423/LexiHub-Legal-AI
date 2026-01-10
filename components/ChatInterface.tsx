import React, { useState, useRef, useEffect } from 'react';
import { Article, Message } from '../types';
import { streamChatMessage, getGlobalProvider } from '../services/geminiService';
import { Send, User, Bot, FileText, Loader2, Sparkles, AlertTriangle } from 'lucide-react';

interface ChatInterfaceProps {
  articles: Article[];
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ articles }) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: '0', role: 'model', content: 'Hello. I am LexiHub, your AI Legal Assistant. I can analyze regulations and answer questions based on your Knowledge Base.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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

    const keywords = input.toLowerCase().split(' ').filter(w => w.length > 2);
    const relevantArticles = articles.filter(a => 
      keywords.some(k => a.title.toLowerCase().includes(k) || a.content.toLowerCase().includes(k))
    );
    
    const context = relevantArticles.length > 0 
      ? relevantArticles.map(a => `SOURCE: ${a.title}\nCONTENT: ${a.content}\nANALYSIS: ${JSON.stringify(a.analysis || {})}`).join('\n\n')
      : "No specific documents found in knowledge base.";

    const historyForApi = messages.map(m => ({ role: m.role, content: m.content }));

    const botMsgId = (Date.now() + 1).toString();
    const initialBotMsg: Message = {
      id: botMsgId,
      role: 'model',
      content: '', 
      sources: relevantArticles.map(a => a.title)
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

  const currentProvider = getGlobalProvider();

  return (
    // Use flex-col and h-full logic to ensure it fills available space in parent without hardcoding calc(100vh-...) which fails on mobile browsers with address bars
    <div className="flex flex-col h-[calc(100vh-140px)] md:h-[calc(100vh-10rem)] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      
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

                {msg.role === 'model' && msg.sources && msg.sources.length > 0 && (
                   <div className="flex flex-wrap gap-2 animate-fade-in">
                      {msg.sources.slice(0, 3).map((src, i) => (
                        <div key={i} className="flex items-center gap-1 text-[10px] md:text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100 max-w-full truncate">
                           <FileText size={10} className="shrink-0" />
                           <span className="truncate max-w-[150px]">{src}</span>
                        </div>
                      ))}
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
                 <span className="text-xs text-slate-500 font-medium">Connecting...</span>
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
            placeholder="Ask LexiHub..."
            disabled={isLoading}
            className="flex-1 pl-4 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900 transition-all shadow-inner disabled:opacity-60 text-sm md:text-base"
          />
          <button 
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shrink-0"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
          </button>
        </div>
        <p className="text-center text-[10px] text-slate-400 mt-2">
          LexiHub AI Assistant
        </p>
      </div>
    </div>
  );
};

export default ChatInterface;