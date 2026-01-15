import React, { useState, useEffect } from 'react';
import { Key, Bot, Cpu, Check, AlertCircle, Globe, Server, Eye, EyeOff, Trash2, Save, Search, ExternalLink } from 'lucide-react';
import { AIProvider } from '../types';
import { setGlobalProvider, setGlobalDeepSeekKey, setGlobalDeepSeekBaseUrl, setGlobalSerpApiKey, setGlobalGeminiKey } from '../services/geminiService';

interface SettingsProps {
  currentProvider: AIProvider;
  setProvider: (provider: AIProvider) => void;
}

const Settings: React.FC<SettingsProps> = ({ currentProvider, setProvider }) => {
  const [geminiKey, setGeminiKey] = useState('');
  const [deepSeekKey, setDeepSeekKey] = useState('');
  const [deepSeekBaseUrl, setDeepSeekBaseUrl] = useState('');
  const [serpApiKey, setSerpApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Load existing configuration on mount
  useEffect(() => {
    const storedGeminiKey = localStorage.getItem('gemini_api_key');
    const storedDSKey = localStorage.getItem('deepseek_api_key');
    const storedUrl = localStorage.getItem('deepseek_base_url');
    const storedSerpKey = localStorage.getItem('serp_api_key');
    
    if (storedGeminiKey) setGeminiKey(storedGeminiKey);
    if (storedDSKey) setDeepSeekKey(storedDSKey);
    if (storedSerpKey) setSerpApiKey(storedSerpKey);
    setDeepSeekBaseUrl(storedUrl || 'https://api.deepseek.com');
  }, []);

  const handleSave = () => {
    setSaveStatus('saving');
    
    // Update Service & LocalStorage
    setGlobalProvider(currentProvider);
    setGlobalGeminiKey(geminiKey);
    setGlobalDeepSeekKey(deepSeekKey);
    setGlobalDeepSeekBaseUrl(deepSeekBaseUrl);
    setGlobalSerpApiKey(serpApiKey);
    
    // Simulate save delay for better UX
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 600);
  };

  const handleProviderSwitch = (provider: AIProvider) => {
    setProvider(provider);
    setGlobalProvider(provider); 
  };

  const handleClearData = () => {
    if (window.confirm('Are you sure you want to clear all locally stored settings?')) {
      setGlobalGeminiKey('');
      setGlobalDeepSeekKey('');
      setGlobalDeepSeekBaseUrl('https://api.deepseek.com');
      setGlobalSerpApiKey('');
      
      localStorage.removeItem('gemini_api_key');
      localStorage.removeItem('deepseek_api_key');
      localStorage.removeItem('deepseek_base_url');
      localStorage.removeItem('serp_api_key');
      localStorage.removeItem('ai_provider');

      setGeminiKey('');
      setDeepSeekKey('');
      setDeepSeekBaseUrl('https://api.deepseek.com');
      setSerpApiKey('');
      
      handleProviderSwitch('gemini');
      
      alert('Settings cleared.');
    }
  };

  const useVercelProxy = () => {
    setDeepSeekBaseUrl('/api/proxy/deepseek');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      
      {/* 1. Search Provider (SerpApi) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
               <Search size={20} />
             </div>
             <div>
               <h2 className="text-lg font-bold text-slate-800">Search Configuration</h2>
               <p className="text-xs text-slate-500">Manage how LexiHub finds legal information on the web</p>
             </div>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
           <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">SerpApi Key (Optional)</label>
              <div className="relative">
                <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type={showKey ? "text" : "password"} 
                  value={serpApiKey}
                  onChange={(e) => setSerpApiKey(e.target.value)}
                  placeholder="Enter your SerpApi Key..."
                  className="w-full pl-9 pr-10 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-shadow"
                />
                <button 
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
           </div>
        </div>
      </div>

      {/* 2. AI Model Selection */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
               <Cpu size={20} />
             </div>
             <div>
               <h2 className="text-lg font-bold text-slate-800">AI Inference Engine</h2>
             </div>
          </div>
          {saveStatus === 'saved' && (
            <span className="text-green-600 text-sm font-medium flex items-center gap-1 animate-in fade-in">
              <Check size={16} /> Saved
            </span>
          )}
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Google Gemini Option */}
            <div 
              onClick={() => handleProviderSwitch('gemini')}
              className={`relative cursor-pointer rounded-xl border-2 p-4 transition-all ${
                currentProvider === 'gemini' 
                  ? 'border-blue-600 bg-blue-50/50' 
                  : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                 <div className="flex items-center gap-2 font-bold text-slate-800">
                   <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500"></div>
                   Google Gemini
                 </div>
                 {currentProvider === 'gemini' && <Check size={18} className="text-blue-600" />}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Uses <strong>Gemini Flash</strong>. Supports Google Search Grounding.
              </p>
            </div>

            {/* DeepSeek Option */}
            <div 
              onClick={() => handleProviderSwitch('deepseek')}
              className={`relative cursor-pointer rounded-xl border-2 p-4 transition-all ${
                currentProvider === 'deepseek' 
                  ? 'border-indigo-600 bg-indigo-50/50' 
                  : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                 <div className="flex items-center gap-2 font-bold text-slate-800">
                   <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[8px]">DS</div>
                   DeepSeek
                 </div>
                 {currentProvider === 'deepseek' && <Check size={18} className="text-indigo-600" />}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Uses <strong>DeepSeek-V3</strong>.
              </p>
            </div>
          </div>

          {/* Configuration Fields */}
          <div className="mt-6 pt-6 border-t border-gray-100 animate-in slide-in-from-top-2">
            {currentProvider === 'gemini' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-slate-700">Gemini API Key</label>
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                      Get Key <ExternalLink size={10} />
                    </a>
                </div>
                <div className="relative">
                    <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type={showKey ? "text" : "password"} 
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      placeholder={process.env.API_KEY ? "Using Vercel Env Var (Override here...)" : "Enter Gemini API Key..."}
                      className="w-full pl-9 pr-10 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                    />
                    <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>
                {!process.env.API_KEY && !geminiKey && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle size={12}/> API Key is required for search.
                    </p>
                )}
                <p className="text-xs text-slate-400">
                    You can set this in Vercel Environment Variables as <code>API_KEY</code>, or input here to save in browser.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">DeepSeek API Key</label>
                  <div className="relative">
                    <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type={showKey ? "text" : "password"} 
                      value={deepSeekKey}
                      onChange={(e) => setDeepSeekKey(e.target.value)}
                      placeholder="sk-..."
                      className="w-full pl-9 pr-10 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                    />
                    <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">API Base URL</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" 
                        value={deepSeekBaseUrl}
                        onChange={(e) => setDeepSeekBaseUrl(e.target.value)}
                        placeholder="https://api.deepseek.com"
                        className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono text-slate-600 transition-shadow"
                      />
                    </div>
                    <button onClick={useVercelProxy} className="px-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-medium border border-indigo-200 flex items-center gap-1 transition-colors">
                      <Server size={14} /> Use Vercel Proxy
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 flex justify-between items-center pt-4 border-t border-gray-100">
            <button 
              onClick={handleClearData}
              className="text-red-500 text-sm hover:text-red-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50 transition-colors"
            >
              <Trash2 size={16} /> Clear Local Data
            </button>

            <button 
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-all shadow-md hover:shadow-lg flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {saveStatus === 'saving' ? <>Saving...</> : <><Save size={18} /> Save Configuration</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;