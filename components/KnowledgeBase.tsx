import React, { useState, useRef } from 'react';
import { AgentIntent, AgentLead, SearchResult, Language } from '../types';
import { 
  extractAgentIntent, 
  searchWithGrounding, 
  structureLeadsStream,
  getMaskedGeminiKey 
} from '../services/geminiService';
import { incrementUserStats } from '../services/supabase';
import { getTranslation } from '../utils/i18n';
import { 
  Zap, Loader2, CheckCircle2, Download,
  ArrowRight, Check, Sparkles, Phone, AlertTriangle, FileText, XCircle, RefreshCw
} from 'lucide-react';

interface KnowledgeBaseProps {
  onLeadsGenerated?: (count: number) => void;
  lang: Language;
}

const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({ onLeadsGenerated, lang }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [agentStatus, setAgentStatus] = useState<'idle' | 'identifying' | 'searching' | 'processing' | 'complete' | 'error'>('idle');
  const [intentData, setIntentData] = useState<AgentIntent | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchSummary, setSearchSummary] = useState<string>("");
  const [generatedLeads, setGeneratedLeads] = useState<AgentLead[]>([]);
  const [processingTime, setProcessingTime] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const timerRef = useRef<number | null>(null);

  const t = getTranslation(lang);

  const handleExportCsv = () => {
    if (generatedLeads.length === 0) return;
    const BOM = '\uFEFF';
    const headers = [t.knowledge.table.firm, t.knowledge.table.contact, t.knowledge.table.phone, t.knowledge.table.address, t.knowledge.table.source];
    const csvRows = [headers.join(',')];
    
    for (const lead of generatedLeads) {
      const row = [
        `"${(lead.lawFirm || '').replace(/"/g, '""')}"`,
        `"${(lead.contact || '').replace(/"/g, '""')}"`,
        `"${(lead.phone || '').replace(/"/g, '""')}"`,
        `"${(lead.address || '').replace(/"/g, '""')}"`,
        `"${(lead.sourceUrl || '').replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(','));
    }

    const csvString = BOM + csvRows.join('\n');
    const filename = `legal_leads_${new Date().toISOString().slice(0, 10)}.csv`;
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper for delays
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const handleAgentSearch = async () => {
    if (!searchQuery.trim()) return;

    setAgentStatus('identifying');
    setIntentData(null);
    setSearchResults([]);
    setSearchSummary("");
    setGeneratedLeads([]);
    setProcessingTime(0);
    setProcessingProgress(0);
    setErrorMessage(''); // Reset error

    const startTime = Date.now();
    timerRef.current = window.setInterval(() => {
      setProcessingTime(Math.floor((Date.now() - startTime) / 1000));
    }, 100);

    try {
      // Step 1: Intent
      const intent = await extractAgentIntent(searchQuery);
      setIntentData(intent);
      
      // THROTTLE: Pause to let rate limit bucket refill
      await wait(1500);

      setAgentStatus('searching');

      // Step 2: Search with Grounding
      const searchRes = await searchWithGrounding(`${intent.event} lawyer in ${intent.location} ${intent.contactPerson !== '-' ? intent.contactPerson : ''}`);
      setSearchResults(searchRes.links);
      setSearchSummary(searchRes.text);

      if (searchRes.error) {
        setAgentStatus('error');
        setErrorMessage(searchRes.errorMessage || "Search Tool Failed.");
        if (timerRef.current) clearInterval(timerRef.current);
        return; 
      }

      // THROTTLE: Pause before the heavy structured generation
      await wait(1500);
      
      setAgentStatus('processing');

      // Step 3: LLM Structure
      let accumulatedText = "";
      const stream = structureLeadsStream(searchRes.text);
      
      for await (const chunk of stream) {
        if (chunk) {
          accumulatedText += chunk;
          setProcessingProgress(prev => Math.min(prev + (chunk.length / 15), 98));
        }
      }

      let leadsCount = 0;
      try {
         const cleanJson = accumulatedText.replace(/```json\n?|\n?```/g, '').trim();
         if (cleanJson && cleanJson.length > 0) {
             const leads = JSON.parse(cleanJson);
             setGeneratedLeads(leads);
             leadsCount = leads.length;
         }
      } catch (parseError) {
         console.warn("JSON Parse Error on stream result, attempting regex extraction...", parseError);
         const match = accumulatedText.match(/\[[\s\S]*\]/);
         if (match) {
             try {
                const leads = JSON.parse(match[0]);
                setGeneratedLeads(leads);
                leadsCount = leads.length;
             } catch (e) { console.error("Fallback parsing failed", e); }
         }
      }
      
      if (leadsCount > 0 && onLeadsGenerated) {
        onLeadsGenerated(leadsCount);
        // Sync stats to Supabase if logged in (Fire and forget)
        incrementUserStats(leadsCount, 1);
      } else {
        // Just increment query count
        incrementUserStats(0, 1);
      }
      
      setProcessingProgress(100);
      setAgentStatus('complete');

    } catch (e: any) {
      console.error(e);
      setAgentStatus('error'); 
      const rawMsg = e.message || '';
      // User friendly message for 429
      if (rawMsg.includes('429') || rawMsg.includes('Resource exhausted') || rawMsg.includes('Quota exceeded')) {
        setErrorMessage(`API Quota Exceeded. Using Key ending in ${getMaskedGeminiKey()}. The search tool is heavily rate-limited even on paid tiers. Please try again in 1 minute.`);
      } else {
        setErrorMessage(rawMsg || "An unexpected error occurred during the workflow.");
      }
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  return (
    <div className="flex flex-col bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden min-h-[500px] md:min-h-[600px]">
      
      <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50">
          <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
            
            {/* Search Input Area */}
            <div className="bg-white p-4 md:p-8 rounded-2xl shadow-sm border border-gray-200">
              <label className="block text-base font-semibold text-slate-800 mb-3">{t.knowledge.searchPlaceholder}</label>
              <div className="flex flex-col md:flex-row gap-4">
                 <input 
                   type="text" 
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && handleAgentSearch()}
                   placeholder={t.knowledge.searchPlaceholder}
                   className="flex-1 px-5 py-3 md:py-4 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-900 placeholder:text-slate-400 text-base md:text-lg shadow-inner"
                 />
                 <button 
                   onClick={handleAgentSearch}
                   disabled={agentStatus !== 'idle' && agentStatus !== 'complete' && agentStatus !== 'error'}
                   className="bg-blue-600 hover:bg-blue-700 text-white px-6 md:px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:shadow-none w-full md:w-auto min-w-[160px]"
                 >
                   {agentStatus !== 'idle' && agentStatus !== 'complete' && agentStatus !== 'error' ? <Loader2 className="animate-spin" size={24} /> : <Zap size={24} />}
                   <span>{t.knowledge.findLeads}</span>
                 </button>
              </div>
            </div>

            {/* Workflow Status */}
            {(agentStatus !== 'idle') && (
              <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-200 animate-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-slate-800 text-lg">{t.knowledge.workflowStatus}</h3>
                  {(agentStatus === 'complete' || agentStatus === 'error') && <span className="text-xs text-slate-400 font-mono">Total Time: {processingTime}s</span>}
                </div>

                <div className="flex items-center gap-2 md:gap-3 text-sm mb-6 flex-wrap">
                  {[
                    { id: 'identifying', label: t.knowledge.steps.identifying },
                    { id: 'searching', label: t.knowledge.steps.searching },
                    { id: 'processing', label: t.knowledge.steps.processing }
                  ].map((step, idx) => {
                    const statuses = ['idle', 'identifying', 'searching', 'processing', 'complete'];
                    const isError = agentStatus === 'error' && (step.id === 'searching' || step.id === 'identifying' || step.id === 'processing'); 
                    // Determine "Done" state
                    let isDone = false;
                    if (agentStatus === 'complete') isDone = true;
                    // Approximate done logic for simple visualization
                    if (idx === 0 && (agentStatus === 'searching' || agentStatus === 'processing')) isDone = true;
                    if (idx === 1 && agentStatus === 'processing') isDone = true;

                    const isActive = agentStatus === step.id; // Correct mapping needs more complex logic if step.id != agentStatus strings exactly, but here they mostly align except for i18n label.
                    // Actually step.id matches the state string 'identifying', 'searching', 'processing'.

                    return (
                      <div key={step.id} className="flex items-center gap-1 md:gap-2">
                        <div className={`px-2 md:px-3 py-1.5 rounded-full flex items-center gap-1.5 border text-xs md:text-sm whitespace-nowrap ${
                          isError && isActive 
                            ? 'bg-red-50 border-red-200 text-red-700'
                            : isDone 
                              ? 'bg-green-50 border-green-200 text-green-700' 
                              : isActive 
                                ? 'bg-blue-50 border-blue-200 text-blue-700 animate-pulse'
                                : 'bg-gray-50 border-gray-200 text-gray-400'
                        }`}>
                          <span className="font-medium">{step.label}</span>
                          {isError && isActive ? <XCircle size={12} /> : isDone ? <Check size={12} /> : isActive ? <Loader2 size={12} className="animate-spin" /> : null}
                        </div>
                        {idx < 2 && <ArrowRight size={14} className="text-gray-300" />}
                      </div>
                    );
                  })}
                </div>

                {/* Intent Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div className="bg-gray-50 p-3 md:p-4 rounded-xl border border-gray-100">
                    <label className="text-xs text-slate-400 block mb-1">Event / Issue</label>
                    <div className="font-medium text-slate-800 text-sm md:text-base">{intentData?.event || (agentStatus === 'identifying' ? '...' : '-')}</div>
                  </div>
                  <div className="bg-gray-50 p-3 md:p-4 rounded-xl border border-gray-100">
                    <label className="text-xs text-slate-400 block mb-1">Location</label>
                    <div className="font-medium text-slate-800 text-sm md:text-base">{intentData?.location || (agentStatus === 'identifying' ? '...' : '-')}</div>
                  </div>
                </div>

                {agentStatus === 'processing' && (
                  <div className="mt-6 animate-in fade-in slide-in-from-top-1">
                    <div className="flex justify-between text-xs text-slate-500 mb-2">
                       <span className="flex items-center gap-1"><Sparkles size={12} className="text-blue-500" /> {t.knowledge.generating}</span>
                       <span>{Math.round(processingProgress)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                       <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out" style={{ width: `${processingProgress}%` }}></div>
                    </div>
                  </div>
                )}
                
                {agentStatus === 'error' && (
                  <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-3 animate-in shake">
                    <AlertTriangle className="shrink-0 mt-0.5" size={18} />
                    <div className="flex-1">
                        <p className="font-bold flex items-center gap-2">
                            Error: Process Halted
                        </p>
                        <p className="mt-1 break-words">{errorMessage}</p>
                        <p className="mt-2 text-xs text-red-500">
                           {errorMessage.includes("Quota") ? "Tip: Google Search has strict rate limits. Try again in 30-60 seconds." : "Tip: Check your API Key in Settings."}
                        </p>
                    </div>
                    <button onClick={handleAgentSearch} className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs font-medium transition-colors flex items-center gap-1">
                        <RefreshCw size={12}/> Retry
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Results Section */}
            {(agentStatus === 'processing' || agentStatus === 'complete' || (agentStatus === 'error' && searchResults.length > 0)) && (
              <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-200 animate-in slide-in-from-bottom-4">
                
                {searchSummary && (
                  <div className={`mb-6 p-4 rounded-xl border ${
                    searchSummary.includes("Error") || searchSummary.includes("QUOTA EXCEEDED") || searchSummary.includes("SYSTEM WARNING")
                      ? "bg-orange-50 border-orange-200 text-orange-800" 
                      : "bg-blue-50/50 border-blue-100 text-slate-700"
                  }`}>
                    <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
                      <FileText size={16}/> {t.knowledge.searchSummary}
                    </h3>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{searchSummary}</p>
                  </div>
                )}

                <div className="mb-8">
                  <h3 className="font-bold text-slate-800 text-lg mb-4">{t.knowledge.searchResults}</h3>
                  <div className="space-y-3">
                    {searchResults.length > 0 ? searchResults.slice(0, 5).map((result, i) => (
                      <div key={i} className="flex flex-col p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-blue-100 transition-colors">
                        <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium text-sm truncate block mb-1">
                          {result.title}
                        </a>
                        <span className="text-xs text-slate-500 truncate font-mono block w-full overflow-hidden text-ellipsis">{result.url}</span>
                      </div>
                    )) : (
                      <p className="text-sm text-slate-400 italic">No direct links returned by search tool.</p>
                    )}
                  </div>
                </div>

                {agentStatus === 'complete' && generatedLeads.length > 0 && (
                <div className="border-t border-gray-100 pt-6 animate-in fade-in">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                     <h3 className="font-bold text-slate-800 text-lg">{t.knowledge.generatedLeads.replace('{count}', generatedLeads.length.toString())}</h3>
                     <button onClick={handleExportCsv} className="w-full sm:w-auto text-sm text-slate-600 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors font-medium active:scale-95">
                        <Download size={16} /> {t.knowledge.exportCsv}
                     </button>
                  </div>
                  
                  <div className="overflow-x-auto border border-gray-200 rounded-xl">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                      <thead className="bg-gray-50 text-slate-500 font-semibold border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3">{t.knowledge.table.firm}</th>
                          <th className="px-4 py-3">{t.knowledge.table.contact}</th>
                          <th className="px-4 py-3">{t.knowledge.table.phone}</th>
                          <th className="px-4 py-3">{t.knowledge.table.address}</th>
                          <th className="px-4 py-3 text-right">{t.knowledge.table.source}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {generatedLeads.map((lead, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                            <td className="px-4 py-3 font-medium text-slate-800">{lead.lawFirm}</td>
                            <td className="px-4 py-3 text-slate-600">{lead.contact}</td>
                            <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                              {lead.phone && lead.phone !== '-' && lead.phone !== 'Unknown' ? (
                                <a href={`tel:${lead.phone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded-md transition-all border border-transparent hover:border-blue-100 w-fit">
                                  <Phone size={12} className="shrink-0" /> <span>{lead.phone}</span>
                                </a>
                              ) : <span className="text-slate-400">{lead.phone || '-'}</span>}
                            </td>
                            <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate" title={lead.address}>{lead.address}</td>
                            <td className="px-4 py-3 text-right">
                               {lead.sourceUrl !== '-' ? (
                                 <a href={lead.sourceUrl} target="_blank" className="text-blue-600 hover:underline text-xs font-medium bg-blue-50 px-2 py-1 rounded inline-block">{t.knowledge.table.view}</a>
                               ) : <span className="text-slate-300">-</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                )}
                
                {agentStatus === 'complete' && generatedLeads.length === 0 && (
                   <div className="py-8 text-center text-slate-400 bg-slate-50 border-t border-gray-100 rounded-b-2xl">
                     <p>{t.knowledge.noLeads}</p>
                   </div>
                )}
              </div>
            )}
          </div>
      </div>
    </div>
  );
};

export default KnowledgeBase;