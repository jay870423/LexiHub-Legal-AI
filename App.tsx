
import React, { useState, useEffect } from 'react';
import { ViewState, AIProvider, PersonalDoc, Language } from './types';
import { INITIAL_ARTICLES } from './constants';
import Sidebar from './components/Sidebar';
import KnowledgeBase from './components/KnowledgeBase';
import ChatInterface from './components/ChatInterface';
import Workspace from './components/Workspace';
import Settings from './components/Settings';
import UserManual from './components/UserManual';
import AuthModal from './components/AuthModal';
import { getGlobalProvider } from './services/geminiService';
import { supabase, signOut, fetchUserStats, fetchDocuments } from './services/supabase';
import { getTranslation } from './utils/i18n';
import { TrendingUp, Activity, Cpu, Users, Menu } from 'lucide-react';
import { User } from '@supabase/supabase-js';

// Dashboard Summary Component
const Dashboard = ({ leadsCount, queryCount, provider, docsCount, lang }: { leadsCount: number, queryCount: number, provider: string, docsCount: number, lang: Language }) => {
  const t = getTranslation(lang);
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
           <p className="text-sm font-medium text-slate-500">{t.dashboard.totalLeads}</p>
           <h3 className="text-4xl font-bold text-slate-900 mt-1">{leadsCount}</h3>
           <p className="text-xs text-slate-400 mt-2">{t.dashboard.newContacts}</p>
        </div>
      </div>
      
      {/* Card 2: Personal Knowledge */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start mb-4">
           <div className="bg-purple-100 p-3 rounded-xl text-purple-600">
             <Activity size={24} />
           </div>
        </div>
        <div>
           <p className="text-sm font-medium text-slate-500">{t.dashboard.workspaceDocs}</p>
           <h3 className="text-4xl font-bold text-slate-900 mt-1">{docsCount}</h3>
           <p className="text-xs text-slate-400 mt-2">{t.dashboard.ragAvailable}</p>
        </div>
      </div>

      {/* Card 3: AI Engine Status */}
      <div className="bg-slate-900 p-6 rounded-2xl text-white shadow-lg flex flex-col justify-between overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4 opacity-10">
           <Cpu size={100} />
        </div>
        <div className="relative z-10">
           <p className="text-sm font-medium text-slate-400 mb-1">{t.dashboard.inferenceEngine}</p>
           <h3 className="text-2xl font-bold flex items-center gap-2">
             {provider === 'gemini' ? 'Gemini Flash' : 'DeepSeek V3'}
             <span className="flex h-2.5 w-2.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.5)]"></span>
           </h3>
        </div>
        <div className="relative z-10 mt-4">
           <div className="flex items-center justify-between text-xs text-slate-400 font-mono border-t border-slate-700 pt-3">
             <span>Status: Operational</span>
             <span>{t.dashboard.queries}: {queryCount}</span>
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
  
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  
  // Session State
  const [sessionLeads, setSessionLeads] = useState<number>(0);
  const [sessionQueries, setSessionQueries] = useState<number>(0);
  const [articles] = useState(INITIAL_ARTICLES); 

  // --- NEW: Personal Workspace State ---
  const [personalDocs, setPersonalDocs] = useState<PersonalDoc[]>(() => {
    // Initial Load: Try LocalStorage first (Guest Mode)
    try {
      const saved = localStorage.getItem('lexihub_personal_docs');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  
  // Language State
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('lexihub_language');
    if (saved === 'zh') return 'zh';
    return 'en';
  });

  useEffect(() => {
    localStorage.setItem('lexihub_language', lang);
  }, [lang]);
  
  // Sync Guest Data to LocalStorage
  useEffect(() => {
    if (!user) {
       localStorage.setItem('lexihub_personal_docs', JSON.stringify(personalDocs));
    }
  }, [personalDocs, user]);

  // --- AUTH & DATA SYNC LOGIC ---
  useEffect(() => {
    // 1. Check active session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleUserSession(session?.user ?? null);
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleUserSession(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleUserSession = async (currentUser: User | null) => {
    setUser(currentUser);
    
    if (currentUser) {
       // --- LOGGED IN: FETCH FROM SUPABASE ---
       console.log("[App] User logged in, syncing cloud data...");
       await syncUserData(currentUser);
    } else {
       // --- GUEST: REVERT TO LOCAL STORAGE ---
       console.log("[App] Guest mode, loading local data...");
       loadLocalData();
    }
  };

  const syncUserData = async (currentUser: User) => {
    // 1. Fetch Docs
    try {
        const cloudDocs = await fetchDocuments();
        setPersonalDocs(cloudDocs);
    } catch (e) {
        console.error("Failed to sync documents:", e);
    }

    // 2. Fetch Stats
    try {
        const stats = await fetchUserStats();
        if (stats) {
            setSessionLeads(stats.leadsGenerated);
            setSessionQueries(stats.queriesCount);
        }
    } catch (e) {
        console.error("Failed to load stats", e);
    }
  };

  const loadLocalData = () => {
    try {
      const saved = localStorage.getItem('lexihub_personal_docs');
      setPersonalDocs(saved ? JSON.parse(saved) : []);
      // Reset session stats for guest
      setSessionLeads(0);
      setSessionQueries(0);
    } catch (e) {
      setPersonalDocs([]);
    }
  };

  const handleLeadsGenerated = (count: number) => {
    setSessionLeads(prev => prev + count);
    setSessionQueries(prev => prev + 1);
  };

  const handleLogout = async () => {
    try {
      await signOut();
      // handleUserSession will be triggered by onAuthStateChange
    } catch (error) {
      console.error(error);
    }
  };

  const t = getTranslation(lang);

  return (
    <div className="flex min-h-[100dvh] bg-gray-50">
      <Sidebar 
        currentView={currentView} 
        setView={setCurrentView} 
        currentProvider={currentProvider} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        lang={lang}
        setLang={setLang}
        user={user}
        onLoginClick={() => setIsAuthModalOpen(true)}
        onLogoutClick={handleLogout}
      />

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)}
        lang={lang}
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
              {currentView === 'dashboard' && t.header.dashboardTitle}
              {currentView === 'knowledge' && t.header.discoveryTitle}
              {currentView === 'workspace' && t.header.workspaceTitle}
              {currentView === 'chat' && t.header.chatTitle}
              {currentView === 'manual' && t.header.manualTitle}
              {currentView === 'settings' && t.header.settingsTitle}
            </h1>
            <p className="text-sm md:text-base text-slate-500 mt-1 line-clamp-2 md:line-clamp-none">
              {currentView === 'dashboard' && t.header.dashboardDesc}
              {currentView === 'knowledge' && t.header.discoveryDesc}
              {currentView === 'workspace' && t.header.workspaceDesc}
              {currentView === 'chat' && t.header.chatDesc}
              {currentView === 'manual' && t.header.manualDesc}
              {currentView === 'settings' && t.header.settingsDesc}
            </p>
          </header>

          {/* View Router */}
          <div className="animate-fade-in">
            {currentView === 'dashboard' && (
               <Dashboard 
                 leadsCount={sessionLeads} 
                 queryCount={sessionQueries} 
                 docsCount={personalDocs.length}
                 provider={currentProvider} 
                 lang={lang}
               />
            )}
            
            {currentView === 'knowledge' && (
              <KnowledgeBase 
                onLeadsGenerated={handleLeadsGenerated}
                lang={lang}
              />
            )}

            {currentView === 'workspace' && (
              <Workspace 
                documents={personalDocs}
                setDocuments={setPersonalDocs}
                lang={lang}
              />
            )}

            {currentView === 'chat' && (
              <ChatInterface 
                articles={articles} 
                personalDocs={personalDocs}
                lang={lang}
              />
            )}

            {currentView === 'manual' && (
              <UserManual lang={lang} />
            )}

            {currentView === 'settings' && (
              <Settings 
                currentProvider={currentProvider} 
                setProvider={setCurrentProvider} 
                lang={lang}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
