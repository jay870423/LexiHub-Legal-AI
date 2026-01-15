import React from 'react';
import { LayoutDashboard, MessageSquareText, Settings, Scale, Telescope, FolderKanban, X } from 'lucide-react';
import { ViewState, AIProvider } from '../types';

interface SidebarProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
  currentProvider: AIProvider;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, currentProvider, isOpen, onClose }) => {
  const navItems: { id: ViewState; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: 'knowledge', label: 'Lead Discovery', icon: <Telescope size={20} /> },
    { id: 'workspace', label: 'My Workspace', icon: <FolderKanban size={20} /> },
    { id: 'chat', label: 'AI Assistant', icon: <MessageSquareText size={20} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={20} /> },
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

        <div className="p-4 border-t border-slate-800">
          <div className="bg-slate-800 rounded-lg p-3 text-xs text-slate-400 transition-colors hover:bg-slate-700">
            <p className="font-semibold text-slate-300 mb-1">Status: Online</p>
            <div className="flex justify-between items-center">
               <span>Provider:</span>
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