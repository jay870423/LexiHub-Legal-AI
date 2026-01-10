import React, { useState, useRef } from 'react';
import { AgentIntent, AgentLead, SearchResult } from '../types';
import { 
  extractAgentIntent, 
  searchWithGrounding, 
  structureLeadsStream
} from '../services/geminiService';
import { 
  Zap, Loader2, CheckCircle2, Download,
  ArrowRight, Check, Sparkles, Phone
} from 'lucide-react';

interface KnowledgeBaseProps {
  onLeadsGenerated?: (count: number) => void;
}

const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({ onLeadsGenerated }) => {
  // --- LEAD DISCOVERY STATE ---
  const [searchQuery, setSearchQuery] = useState('');
  const [agentStatus, setAgentStatus] = useState<'idle' | 'identifying' | 'searching' | 'processing' | 'complete'>('idle');
  const [intentData, setIntentData] = useState<AgentIntent | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [generatedLeads, setGeneratedLeads] = useState<AgentLead[]>([]);
  const [processingTime, setProcessingTime] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);
  const timerRef = useRef<number | null>(null);

  // --- CSV EXPORT LOGIC ---
  const handleExportCsv = () => {
    if (generatedLeads.length === 0) return;

    // Add BOM for proper UTF-8 handling in Excel
    const BOM = '\uFEFF';
    const headers = ['Firm Name', 'Contact Person', 'Phone Number', 'Address', 'Source URL'];
    
    // Construct CSV rows
    const csvRows = [headers.join(',')];
    
    for (const lead of generatedLeads) {
      // Escape quotes by doubling them
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
    
    // Trigger download
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

  // --- AGENT LOGIC ---
  const handleAgentSearch = async () => {
    if (!searchQuery.trim()) return;

    // Reset
    setAgentStatus('identifying');
    setIntentData(null);
    setSearchResults([]);
    setGeneratedLeads([]);
    setProcessingTime(0);
    setProcessingProgress(0);

    // Start Timer
    const startTime = Date.now();
    timerRef.current = window.setInterval(() => {
      setProcessingTime(Math.floor((Date.now() - startTime) / 1000));
    }, 100);

    try {
      // Step 1: Intent
      const intent = await extractAgentIntent(searchQuery);
      setIntentData(intent);
      setAgentStatus('searching');

      // Step 2: Search with Grounding
      const searchRes = await searchWithGrounding(`${intent.event} lawyer in ${intent.location} ${intent.contactPerson !== '-' ? intent.contactPerson : ''}`);
      setSearchResults(searchRes.links);
      setAgentStatus('processing');

      // Step 3: LLM Structure (Streaming)
      let accumulatedText = "";
      const stream = structureLeadsStream(searchRes.text);
      
      for await (const chunk of stream) {
        if (chunk) {
          accumulatedText += chunk;
          // Heuristic progress: assuming ~1500 characters for a typical response.
          // Increment progress but cap at 98% until finish.
          setProcessingProgress(prev => Math.min(prev + (chunk.length / 15), 98));
        }
      }

      // Final Parsing
      try {
         // Sometimes the model outputs markdown code blocks around JSON even if schema is set,
         // though schema usually forces pure JSON. Let's be safe.
         const cleanJson = accumulatedText.replace(/```json\n?|\n?```/g, '').trim();
         const leads = JSON.parse(cleanJson);
         setGeneratedLeads(leads);
         
         // Notify parent app for dashboard stats
         if (onLeadsGenerated && leads.length > 0) {
           onLeadsGenerated(leads.length);
         }
      } catch (parseError) {
         console.warn("JSON Parse Error on stream result, attempting regex extraction...", parseError);
         // Fallback: try to find the array brackets
         const match = accumulatedText.match(/\[[\s\S]*\]/);
         if (match) {
             try {
                const leads = JSON.parse(match[0]);
                setGeneratedLeads(leads);
                if (onLeadsGenerated && leads.length > 0) {
                  onLeadsGenerated(leads.length);
                }
             } catch (e) { console.error("Fallback parsing failed", e); }
         }
      }
      
      setProcessingProgress(100);
      setAgentStatus('complete');

    } catch (e) {
      console.error(e);
      alert("Agent failed during process. Please try again.");
      setAgentStatus('idle');
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  // --- RENDER ---
  return (
    <div className="flex flex-col bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden min-h-[500px] md:min-h-[600px]">
      
      {/* --- CONTENT: LEAD DISCOVERY --- */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50">
          <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
            
            {/* Search Input Area */}
            <div className="bg-white p-4 md:p-8 rounded-2xl shadow-sm border border-gray-200">
              <label className="block text-base font-semibold text-slate-800 mb-3">Search Query</label>
              <div className="flex flex-col md:flex-row gap-4">
                 <input 
                   type="text" 
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && handleAgentSearch()}
                   placeholder="e.g. Divorce lawyer in Beijing"
                   className="flex-1 px-5 py-3 md:py-4 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-900 placeholder:text-slate-400 text-base md:text-lg shadow-inner"
                 />
                 <button 
                   onClick={handleAgentSearch}
                   disabled={agentStatus !== 'idle' && agentStatus !== 'complete'}
                   className="bg-blue-600 hover:bg-blue-700 text-white px-6 md:px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:shadow-none w-full md:w-auto min-w-[160px]"
                 >
                   {agentStatus !== 'idle' && agentStatus !== 'complete' ? <Loader2 className="animate-spin" size={24} /> : <Zap size={24} />}
                   <span>Find Leads</span>
                 </button>
              </div>
            </div>

            {/* Workflow Status */}
            {(agentStatus !== 'idle') && (
              <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-200 animate-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-slate-800 text-lg">Workflow Status</h3>
                  {agentStatus === 'complete' && <span className="text-xs text-slate-400 font-mono">Total Time: {processingTime}s</span>}
                </div>

                {/* Steps */}
                <div className="flex items-center gap-2 md:gap-3 text-sm mb-6 flex-wrap">
                  {[
                    { id: 'identifying', label: 'Intent Recognition' },
                    { id: 'searching', label: 'Searching' },
                    { id: 'processing', label: 'LLM Processing' }
                  ].map((step, idx) => {
                    // Logic: If current status index >= step index, it's done or active.
                    const statuses = ['idle', 'identifying', 'searching', 'processing', 'complete'];
                    const currentIdx = statuses.indexOf(agentStatus);
                    const stepIdx = statuses.indexOf(step.id);
                    const isDone = currentIdx > stepIdx;
                    const isActive = currentIdx === stepIdx;

                    return (
                      <div key={step.id} className="flex items-center gap-1 md:gap-2">
                        <div className={`px-2 md:px-3 py-1.5 rounded-full flex items-center gap-1.5 border text-xs md:text-sm whitespace-nowrap ${
                          isDone 
                            ? 'bg-green-50 border-green-200 text-green-700' 
                            : isActive 
                              ? 'bg-blue-50 border-blue-200 text-blue-700 animate-pulse'
                              : 'bg-gray-50 border-gray-200 text-gray-400'
                        }`}>
                          <span className="font-medium">{step.label}</span>
                          {isDone ? <Check size={12} /> : isActive ? <Loader2 size={12} className="animate-spin" /> : null}
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
                    <div className="font-medium text-slate-800 text-sm md:text-base">{intentData?.event || (agentStatus === 'identifying' ? 'Analyzing...' : '-')}</div>
                  </div>
                  <div className="bg-gray-50 p-3 md:p-4 rounded-xl border border-gray-100">
                    <label className="text-xs text-slate-400 block mb-1">Location</label>
                    <div className="font-medium text-slate-800 text-sm md:text-base">{intentData?.location || (agentStatus === 'identifying' ? 'Analyzing...' : '-')}</div>
                  </div>
                </div>

                {/* Progress Bar during Processing */}
                {agentStatus === 'processing' && (
                  <div className="mt-6 animate-in fade-in slide-in-from-top-1">
                    <div className="flex justify-between text-xs text-slate-500 mb-2">
                       <span className="flex items-center gap-1"><Sparkles size={12} className="text-blue-500" /> Generating structured leads...</span>
                       <span>{Math.round(processingProgress)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                       <div 
                         className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
                         style={{ width: `${processingProgress}%` }}
                       ></div>
                    </div>
                  </div>
                )}
                
                {agentStatus === 'complete' && (
                  <div className="mt-4 text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    Processing complete, took {processingTime}s
                  </div>
                )}
              </div>
            )}

            {/* Results Section */}
            {(agentStatus === 'processing' || agentStatus === 'complete') && (
              <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-200 animate-in slide-in-from-bottom-4">
                
                {/* Search Results Links */}
                <div className="mb-8">
                  <h3 className="font-bold text-slate-800 text-lg mb-4">Search Results</h3>
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

                {/* Leads Table */}
                {agentStatus === 'complete' && (
                <div className="border-t border-gray-100 pt-6 animate-in fade-in">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                     <h3 className="font-bold text-slate-800 text-lg">Generated {generatedLeads.length} leads</h3>
                     <button 
                       onClick={handleExportCsv}
                       className="w-full sm:w-auto text-sm text-slate-600 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors font-medium active:scale-95"
                     >
                        <Download size={16} /> Export CSV
                     </button>
                  </div>
                  
                  <div className="overflow-x-auto border border-gray-200 rounded-xl">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                      <thead className="bg-gray-50 text-slate-500 font-semibold border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3">Firm Name</th>
                          <th className="px-4 py-3">Contact</th>
                          <th className="px-4 py-3">Phone</th>
                          <th className="px-4 py-3">Address</th>
                          <th className="px-4 py-3 text-right">Source</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {generatedLeads.map((lead, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                            <td className="px-4 py-3 font-medium text-slate-800">{lead.lawFirm}</td>
                            <td className="px-4 py-3 text-slate-600">{lead.contact}</td>
                            <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                              {lead.phone && lead.phone !== '-' && lead.phone !== 'Unknown' ? (
                                <a 
                                  href={`tel:${lead.phone.replace(/[^\d+]/g, '')}`} 
                                  className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded-md transition-all border border-transparent hover:border-blue-100 w-fit"
                                >
                                  <Phone size={12} className="shrink-0" />
                                  <span>{lead.phone}</span>
                                </a>
                              ) : (
                                <span className="text-slate-400">{lead.phone || '-'}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate" title={lead.address}>{lead.address}</td>
                            <td className="px-4 py-3 text-right">
                               {lead.sourceUrl !== '-' ? (
                                 <a href={lead.sourceUrl} target="_blank" className="text-blue-600 hover:underline text-xs font-medium bg-blue-50 px-2 py-1 rounded inline-block">View</a>
                               ) : (
                                 <span className="text-slate-300">-</span>
                               )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {generatedLeads.length === 0 && (
                      <div className="py-12 text-center text-slate-400 bg-slate-50">
                        <p>No structured leads could be extracted.</p>
                      </div>
                    )}
                  </div>
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