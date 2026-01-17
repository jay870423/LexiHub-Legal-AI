
import React from 'react';
import { LayoutDashboard, MessageSquareText, Settings, Scale, Telescope, FolderKanban, X, LogIn, LogOut, User, BookOpen } from 'lucide-react';
import { ViewState, AIProvider, Language } from '../types';
import { getTranslation } from '../utils/i18n';
import { User as SupabaseUser } from '@supabase/supabase-js';

interface SidebarProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
  currentProvider: AIProvider;
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  setLang: (lang: Language) => void;
  user: SupabaseUser | null;
  onLoginClick: () => void;
  onLogoutClick: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, currentProvider, isOpen, onClose, lang, setLang, user, onLoginClick, onLogoutClick }) => {
  const t = getTranslation(lang);

  const navItems: { id: ViewState; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: t.nav.dashboard, icon: <LayoutDashboard size={20} /> },
    { id: 'knowledge', label: t.nav.discovery, icon: <Telescope size={20} /> },
    { id: 'workspace', label: t.nav.workspace, icon: <FolderKanban size={20} /> },
    { id: 'chat', label: t.nav.assistant, icon: <MessageSquareText size={20} /> },
    { id: 'manual', label: t.nav.manual, icon: <BookOpen size={20} /> },
    { id: 'settings', label: t.nav.settings, icon: <Settings size={20} /> },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed left-0 top-0 h-full w-64 bg-slate-900 text-white z-40 shadow-xl
        flex flex-col transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0
      `}>
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
               <Scale size={24} className="text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">LexiHub</span>
          </div>
          {/* Close button for mobile */}
          <button onClick={onClose} className="md:hidden text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setView(item.id);
                onClose(); // Close sidebar on selection on mobile
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                currentView === item.id
                  ? 'bg-blue-700 text-white shadow-md'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {item.icon}
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-4">
          
          {/* User Profile / Login */}
          {user ? (
            <div className="bg-slate-800 rounded-lg p-3">
               <div className="flex items-center gap-3 mb-3">
                  {user.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="User" className="w-8 h-8 rounded-full border border-slate-600" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                        <User size={16} className="text-slate-400" />
                    </div>
                  )}
                  <div className="overflow-hidden">
                     <div className="text-xs text-slate-400">{t.nav.welcomeUser}</div>
                     <div className="text-sm font-semibold truncate text-white">{user.user_metadata?.full_name || user.email?.split('@')[0]}</div>
                  </div>
               </div>
               <button 
                 onClick={onLogoutClick}
                 className="w-full flex items-center justify-center gap-2 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-slate-700 rounded transition-colors"
               >
                 <LogOut size={12} /> {t.nav.logout}
               </button>
            </div>
          ) : (
             <button 
               onClick={onLoginClick}
               className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors shadow-sm text-sm"
             >
               <LogIn size={16} /> {t.nav.login}
             </button>
          )}

          {/* Language Switcher */}
          <div className="flex bg-slate-800 p-1 rounded-lg">
             <button 
               onClick={() => setLang('en')}
               className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${lang === 'en' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}
             >
               English
             </button>
             <button 
               onClick={() => setLang('zh')}
               className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${lang === 'zh' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}
             >
               中文
             </button>
          </div>

          <div className="bg-slate-800 rounded-lg p-3 text-xs text-slate-400 transition-colors hover:bg-slate-700">
            <p className="font-semibold text-slate-300 mb-1">{t.nav.status}: {t.nav.online}</p>
            <div className="flex justify-between items-center">
               <span>{t.nav.provider}:</span>
               <span className={`font-mono ${currentProvider === 'gemini' ? 'text-blue-400' : 'text-indigo-400'}`}>
                 {currentProvider === 'gemini' ? 'Gemini' : 'DeepSeek'}
               </span>
            </div>
            <div className="mt-1 truncate opacity-70">
              {currentProvider === 'gemini' ? 'gemini-2.0-flash' : 'deepseek-v3'}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
