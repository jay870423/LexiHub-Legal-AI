import React, { useState } from 'react';
import { ViewState, AIProvider } from './types';
import { INITIAL_ARTICLES } from './constants';
import Sidebar from './components/Sidebar';
import KnowledgeBase from './components/KnowledgeBase';
import ChatInterface from './components/ChatInterface';
import Settings from './components/Settings';
import { getGlobalProvider } from './services/geminiService';
import { TrendingUp, Activity, Cpu, Users, Menu } from 'lucide-react';

// Dashboard Summary Component
const Dashboard = ({ leadsCount, queryCount, provider }: { leadsCount: number, queryCount: number, provider: string }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Card 1: Leads Generated */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start mb-4">
           <div className="bg-blue-100 p-3 rounded-xl text-blue-600">
             <Users size={24} />
           </div>
           <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full flex items-center gap-1">
             <TrendingUp size={12} /> Live
           </span>
        </div>
        <div>
           <p className="text-sm font-medium text-slate-500">Total Leads Discovered</p>
           <h3 className="text-4xl font-bold text-slate-900 mt-1">{leadsCount}</h3>
           <p className="text-xs text-slate-400 mt-2">New potential contacts in this session</p>
        </div>
      </div>
      
      {/* Card 2: Search Activity */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start mb-4">
           <div className="bg-indigo-100 p-3 rounded-xl text-indigo-600">
             <Activity size={24} />
           </div>
        </div>
        <div>
           <p className="text-sm font-medium text-slate-500">Search Queries</p>
           <h3 className="text-4xl font-bold text-slate-900 mt-1">{queryCount}</h3>
           <div className="w-full bg-gray-100 h-1.5 rounded-full mt-4 overflow-hidden">
             <div 
               className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
               style={{ width: `${Math.min(queryCount * 20, 100)}%` }}
             ></div>
           </div>
        </div>
      </div>

      {/* Card 3: AI Engine Status */}
      <div className="bg-slate-900 p-6 rounded-2xl text-white shadow-lg flex flex-col justify-between overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4 opacity-10">
           <Cpu size={100} />
        </div>
        <div className="relative z-10">
           <p className="text-sm font-medium text-slate-400 mb-1">AI Inference Engine</p>
           <h3 className="text-2xl font-bold flex items-center gap-2">
             {provider === 'gemini' ? 'Gemini 3.0 Flash' : 'DeepSeek V3'}
             <span className="flex h-2.5 w-2.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.5)]"></span>
           </h3>
        </div>
        <div className="relative z-10 mt-4">
           <div className="flex items-center justify-between text-xs text-slate-400 font-mono border-t border-slate-700 pt-3">
             <span>Status: Operational</span>
             <span>Latency: {provider === 'gemini' ? '<800ms' : 'Variable'}</span>
           </div>
        </div>
      </div>
    </div>
  );
}

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [currentProvider, setCurrentProvider] = useState<AIProvider>(getGlobalProvider());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Session State for Dashboard
  const [sessionLeads, setSessionLeads] = useState<number>(0);
  const [sessionQueries, setSessionQueries] = useState<number>(0);
  // We keep articles state for Chat RAG context, though removed from dashboard
  const [articles] = useState(INITIAL_ARTICLES); 

  const handleLeadsGenerated = (count: number) => {
    setSessionLeads(prev => prev + count);
    setSessionQueries(prev => prev + 1);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar 
        currentView={currentView} 
        setView={setCurrentView} 
        currentProvider={currentProvider} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      
      {/* Main Content Area - Responsive Margins */}
      <main className="flex-1 transition-all duration-300 md:ml-64 ml-0 w-full">
        {/* Mobile Header Bar */}
        <div className="md:hidden bg-white border-b border-gray-200 p-4 sticky top-0 z-20 flex items-center justify-between shadow-sm">
           <div className="flex items-center gap-3">
             <button 
               onClick={() => setIsSidebarOpen(true)}
               className="p-2 -ml-2 text-slate-600 hover:bg-gray-100 rounded-lg"
             >
               <Menu size={24} />
             </button>
             <span className="font-bold text-slate-900 text-lg">LexiHub</span>
           </div>
           <div className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-500">
             {currentProvider === 'gemini' ? 'Gemini' : 'DeepSeek'}
           </div>
        </div>

        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {/* Desktop Header / Page Title */}
          <header className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              {currentView === 'dashboard' && 'Executive Dashboard'}
              {currentView === 'knowledge' && 'Smart Lead Discovery'}
              {currentView === 'chat' && 'Legal AI Assistant'}
              {currentView === 'settings' && 'System Settings'}
            </h1>
            <p className="text-sm md:text-base text-slate-500 mt-1 line-clamp-2 md:line-clamp-none">
              {currentView === 'dashboard' && 'Real-time overview of lead generation performance.'}
              {currentView === 'knowledge' && 'AI-powered intent recognition, grounded search, and structured lead generation.'}
              {currentView === 'chat' && 'Interactive legal assistant with RAG capabilities.'}
              {currentView === 'settings' && 'Configure AI providers and system preferences.'}
            </p>
          </header>

          {/* View Router */}
          <div className="animate-fade-in">
            {currentView === 'dashboard' && (
               <Dashboard 
                 leadsCount={sessionLeads} 
                 queryCount={sessionQueries} 
                 provider={currentProvider} 
               />
            )}
            
            {currentView === 'knowledge' && (
              <KnowledgeBase 
                onLeadsGenerated={handleLeadsGenerated}
              />
            )}

            {currentView === 'chat' && (
              <ChatInterface 
                articles={articles} 
              />
            )}

            {currentView === 'settings' && (
              <Settings 
                currentProvider={currentProvider} 
                setProvider={setCurrentProvider} 
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;