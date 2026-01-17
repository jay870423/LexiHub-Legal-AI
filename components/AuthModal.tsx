import React from 'react';
import { X, Github, Mail } from 'lucide-react';
import { signInWithGoogle, signInWithGithub } from '../services/supabase';
import { getTranslation } from '../utils/i18n';
import { Language } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, lang }) => {
  if (!isOpen) return null;

  const t = getTranslation(lang);

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
      // Auth flow redirects, so no need to close modal
    } catch (error) {
      console.error(error);
      alert(t.auth.error);
    }
  };

  const handleGithubLogin = async () => {
    try {
      await signInWithGithub();
    } catch (error) {
      console.error(error);
      alert(t.auth.error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative animate-in zoom-in-95 duration-200 m-4">
        
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-100 rounded-full"
        >
          <X size={20} />
        </button>

        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto mb-6 flex items-center justify-center text-white shadow-lg shadow-blue-200">
             <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/><path d="M3 17c2 0 5-1 7-2 2 1 5 2 7 2"/></svg>
          </div>
          
          <h2 className="text-2xl font-bold text-slate-800 mb-2">{t.auth.title}</h2>
          <p className="text-slate-500 mb-8">{t.auth.subtitle}</p>

          <div className="space-y-3">
            <button 
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition-all shadow-sm hover:shadow"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {t.auth.google}
            </button>
            
            <button 
              onClick={handleGithubLogin}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#24292e] hover:bg-[#2b3137] text-white font-medium rounded-xl transition-all shadow-md hover:shadow-lg"
            >
              <Github size={20} />
              {t.auth.github}
            </button>
          </div>

          <p className="mt-8 text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
            {t.auth.footer}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;