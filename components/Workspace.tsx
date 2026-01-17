import React, { useState, useRef } from 'react';
import { PersonalDoc, Language } from '../types';
import { generateDocumentAnalysis } from '../services/geminiService';
import { getTranslation } from '../utils/i18n';
import { Plus, FileText, Trash2, Edit2, Save, X, Search, FileBarChart, Calendar, Tag, Upload, AlertCircle, Zap, Shield, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';

interface WorkspaceProps {
  documents: PersonalDoc[];
  setDocuments: React.Dispatch<React.SetStateAction<PersonalDoc[]>>;
  lang: Language;
}

const Workspace: React.FC<WorkspaceProps> = ({ documents, setDocuments, lang }) => {
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form State
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState<PersonalDoc['category']>('Report');
  const [editTags, setEditTags] = useState('');

  const t = getTranslation(lang);

  // Helper for unique ID
  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const handleCreateNew = () => {
    const newDoc: PersonalDoc = {
      id: generateId(),
      title: 'Untitled Document',
      category: 'Report',
      content: '',
      tags: [],
      updatedAt: new Date().toISOString()
    };
    setDocuments(prev => [newDoc, ...prev]);
    handleSelectDoc(newDoc);
    setIsEditing(true);
  };

  const handleSelectDoc = (doc: PersonalDoc) => {
    setSelectedDocId(doc.id);
    setEditTitle(doc.title);
    setEditContent(doc.content);
    setEditCategory(doc.category);
    setEditTags(doc.tags.join(', '));
    setIsEditing(false);
  };

  const handleBackToList = () => {
    setSelectedDocId(null);
    setIsEditing(false);
  };

  const handleSave = () => {
    if (!selectedDocId) return;
    
    setDocuments(prev => prev.map(doc => {
      if (doc.id === selectedDocId) {
        return {
          ...doc,
          title: editTitle,
          content: editContent,
          category: editCategory,
          tags: editTags.split(',').map(t => t.trim()).filter(Boolean),
          updatedAt: new Date().toISOString()
        };
      }
      return doc;
    }));
    setIsEditing(false);
  };

  // Robust Delete Handler
  const handleDelete = (e: React.MouseEvent, id: string) => {
    // Prevent event from bubbling up to the row click handler
    e.stopPropagation();
    e.preventDefault();
    
    if (window.confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
        // 1. Remove from list immediately
        setDocuments(prev => prev.filter(d => d.id !== id));

        // 2. If the deleted document was selected, clear selection
        if (selectedDocId === id) {
            setSelectedDocId(null);
            setIsEditing(false);
        }
    }
  };

  // Trigger AI Analysis
  const handleAnalyze = async () => {
    if (!selectedDocId || !selectedDoc) return;
    if (!selectedDoc.content || selectedDoc.content.length < 50) {
        alert("Content is too short to analyze.");
        return;
    }

    setIsAnalyzing(true);
    try {
        const analysis = await generateDocumentAnalysis(selectedDoc.title, selectedDoc.content, selectedDoc.category, lang);
        
        // Save analysis to document
        setDocuments(prev => prev.map(doc => {
            if (doc.id === selectedDocId) {
                return { ...doc, aiAnalysis: analysis };
            }
            return doc;
        }));
    } catch (error: any) {
        alert(`Analysis failed: ${error.message}`);
    } finally {
        setIsAnalyzing(false);
    }
  };

  // Handle File Import
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (2MB limit)
    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
        alert(t.workspace.fileTooLarge);
        event.target.value = ''; // Reset input
        return;
    }

    const fileType = file.name.split('.').pop()?.toLowerCase();
    let textContent = '';
    
    // We use dynamic imports to load parsing libraries only when needed
    try {
        if (fileType === 'pdf') {
            // PDF Parsing
            const pdfjsLib = await import('pdfjs-dist');
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs`;
            
            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            
            let fullText = '';
            for(let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map((item: any) => item.str).join(' ');
                fullText += `[Page ${i}]\n${pageText}\n\n`;
            }
            textContent = fullText;

        } else if (fileType === 'docx') {
            // Word Parsing
            const mammoth = await import('mammoth');
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            textContent = result.value;
            if (result.messages.length > 0) {
                console.log("Mammoth messages:", result.messages);
            }

        } else if (['xlsx', 'xls'].includes(fileType)) {
            // Excel Parsing
            const XLSX = await import('xlsx');
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer);
            
            workbook.SheetNames.forEach(sheetName => {
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                textContent += `--- Sheet: ${sheetName} ---\n`;
                jsonData.forEach((row: any) => {
                    textContent += row.join('\t') + '\n';
                });
                textContent += '\n';
            });

        } else {
            // Default: Text Read
            textContent = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.readAsText(file);
            });
        }
    } catch (error: any) {
        console.error("File processing failed:", error);
        alert(`Failed to parse ${fileType} file: ${error.message}`);
        event.target.value = '';
        return;
    }

    if (textContent) {
        const newDoc: PersonalDoc = {
          id: generateId(),
          title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
          category: ['xlsx', 'xls', 'csv'].includes(fileType || '') ? 'Data' : 'Report',
          content: textContent,
          tags: ['Imported', (fileType || 'file').toUpperCase()],
          updatedAt: new Date().toISOString()
        };
        setDocuments(prev => [newDoc, ...prev]);
        handleSelectDoc(newDoc);
        alert(`Successfully imported "${file.name}"`);
    }

    // Reset input so same file can be selected again
    event.target.value = '';
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  // Updated Filter Logic: Content and Tags included
  const filteredDocs = documents.filter(doc => {
    const term = searchTerm.toLowerCase();
    return (
      doc.title.toLowerCase().includes(term) || 
      doc.category.toLowerCase().includes(term) ||
      (doc.content && doc.content.toLowerCase().includes(term)) ||
      (doc.tags && doc.tags.some(t => t.toLowerCase().includes(term)))
    );
  });

  const selectedDoc = documents.find(d => d.id === selectedDocId);

  return (
    <div className="flex h-[calc(100dvh-140px)] md:h-[calc(100dvh-10rem)] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        className="hidden" 
        accept=".txt,.md,.json,.csv,.xml,.pdf,.docx,.xlsx,.xls" 
      />

      {/* LEFT: Document List (Hidden on mobile if doc selected) */}
      <div className={`w-full md:w-1/3 border-r border-gray-200 flex-col bg-gray-50 ${selectedDocId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-gray-200 space-y-3">
          <div className="flex gap-2">
            <button 
              onClick={handleCreateNew}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors shadow-sm text-sm"
            >
              <Plus size={16} /> {t.workspace.newDoc}
            </button>
            <button 
              onClick={triggerFileUpload}
              className="px-4 bg-white border border-gray-300 hover:bg-gray-50 text-slate-700 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors shadow-sm text-sm"
              title="Import PDF, Word, Excel, TXT..."
            >
              <Upload size={16} /> {t.workspace.import}
            </button>
          </div>
          
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder={t.workspace.searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {filteredDocs.length === 0 ? (
             <div className="text-center py-10 text-slate-400 text-sm flex flex-col items-center gap-2">
                <AlertCircle size={24} className="opacity-20"/>
                <span>{t.workspace.noDocs}</span>
                {searchTerm && <span className="text-xs text-slate-300">Try different keywords in content or tags.</span>}
             </div>
          ) : (
            filteredDocs.map(doc => (
              <div 
                key={doc.id}
                onClick={() => handleSelectDoc(doc)}
                className={`group p-3 rounded-lg cursor-pointer transition-all border relative ${
                  selectedDocId === doc.id 
                    ? 'bg-white border-blue-500 shadow-md scale-[1.02] z-10' 
                    : 'bg-white border-transparent hover:bg-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h4 className={`font-semibold text-sm truncate pr-2 flex-1 ${selectedDocId === doc.id ? 'text-blue-700' : 'text-slate-800'}`}>
                    {doc.title || "Untitled"}
                  </h4>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 shrink-0 ml-2">
                    {doc.category}
                  </span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2 mb-2 h-8 break-all pr-4">
                  {doc.content?.substring(0, 100) || "No content..."}
                </p>
                <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      <Calendar size={10} />
                      <span>{new Date(doc.updatedAt).toLocaleDateString()}</span>
                      {/* Content Match Indicator */}
                      {searchTerm && !doc.title.toLowerCase().includes(searchTerm.toLowerCase()) && doc.content.toLowerCase().includes(searchTerm.toLowerCase()) && (
                          <span className="text-blue-500 font-medium bg-blue-50 px-1 rounded">{t.workspace.matchContent}</span>
                      )}
                      {/* Analysis Indicator */}
                      {doc.aiAnalysis && <span className="text-purple-500 font-medium bg-purple-50 px-1 rounded flex items-center gap-0.5"><Zap size={8} /> {t.workspace.analyzedTag}</span>}
                    </div>
                    
                    {/* Sidebar Delete Button */}
                    <button 
                        type="button"
                        onClick={(e) => handleDelete(e, doc.id)}
                        className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all relative z-50 hover:shadow-sm bg-transparent hover:bg-white"
                        title="Delete"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT: Editor / Preview (Hidden on mobile if no doc selected) */}
      <div className={`flex-1 flex-col bg-white h-full overflow-hidden ${selectedDocId ? 'flex' : 'hidden md:flex'}`}>
        {selectedDoc ? (
          <>
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
               {/* Mobile Back Button */}
               <button 
                 onClick={handleBackToList}
                 className="md:hidden mr-2 p-2 text-slate-500 hover:bg-slate-100 rounded-full shrink-0"
               >
                 <ArrowLeft size={20} />
               </button>

               <div className="overflow-hidden mr-4 flex-1">
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={editTitle} 
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="text-lg font-bold text-slate-800 border-b border-dashed border-slate-300 focus:border-blue-500 outline-none bg-transparent w-full"
                      placeholder={t.workspace.docTitlePlaceholder}
                    />
                  ) : (
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 truncate">
                       <FileText size={20} className="text-blue-600 shrink-0"/>
                       <span className="truncate">{selectedDoc.title}</span>
                    </h2>
                  )}
                  <p className="text-xs text-slate-400 mt-1">Last updated: {new Date(selectedDoc.updatedAt).toLocaleString()}</p>
               </div>
               
               <div className="flex gap-2 shrink-0">
                 {isEditing ? (
                    <>
                      <button onClick={() => setIsEditing(false)} className="p-2 text-slate-500 hover:bg-slate-50 rounded-lg">
                        <X size={20} />
                      </button>
                      <button onClick={handleSave} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm">
                        <Save size={16} className="md:mr-1" /> <span className="hidden md:inline">{t.workspace.save}</span>
                      </button>
                    </>
                 ) : (
                    <>
                       {/* AI Analysis Button */}
                       <button 
                          onClick={handleAnalyze}
                          disabled={isAnalyzing}
                          className={`flex items-center gap-1.5 px-2 md:px-3 py-2 border rounded-lg text-sm font-medium transition-all mr-1 ${
                             selectedDoc.aiAnalysis 
                               ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                               : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300 hover:text-purple-600'
                          }`}
                       >
                          {isAnalyzing ? <span className="animate-spin">⏳</span> : <Zap size={16} className={selectedDoc.aiAnalysis ? 'fill-purple-700' : ''} />}
                          <span className="hidden md:inline">{isAnalyzing ? t.workspace.analyzing : (selectedDoc.aiAnalysis ? t.workspace.reAnalyzeBtn : t.workspace.analyzeBtn)}</span>
                       </button>

                      <button 
                        type="button"
                        onClick={(e) => handleDelete(e, selectedDoc.id)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100 relative z-20"
                        title={t.workspace.delete}
                      >
                        <Trash2 size={18} />
                      </button>
                      <button onClick={() => setIsEditing(true)} className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-700 rounded-lg text-sm font-medium transition-all">
                        <Edit2 size={16} className="md:mr-1" /> <span className="hidden md:inline">{t.workspace.edit}</span>
                      </button>
                    </>
                 )}
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8">
              {isEditing ? (
                <div className="space-y-4 max-w-3xl mx-auto animate-in fade-in">
                   {/* Editor View */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">{t.workspace.category}</label>
                        <select 
                          value={editCategory} 
                          onChange={(e) => setEditCategory(e.target.value as any)}
                          className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          <option value="Report">Report</option>
                          <option value="Meeting">Meeting Note</option>
                          <option value="Data">Data / Chart</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">{t.workspace.tags}</label>
                        <input 
                          type="text" 
                          value={editTags}
                          onChange={(e) => setEditTags(e.target.value)}
                          placeholder="e.g. Q3, Finance, Legal"
                          className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                   </div>

                   <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">{t.workspace.contentLabel}</label>
                      <textarea 
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        placeholder={t.workspace.contentPlaceholder}
                        className="w-full h-[450px] p-4 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed resize-none shadow-inner"
                      />
                   </div>
                </div>
              ) : (
                <div className="max-w-4xl mx-auto animate-in fade-in space-y-8">
                   
                   {/* AI ANALYSIS DASHBOARD WIDGET */}
                   {selectedDoc.aiAnalysis && (
                      <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 shadow-sm animate-slide-in-from-top-4">
                         <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                               <Zap className="text-purple-600 fill-purple-100" size={20} />
                               {t.workspace.analysisTitle}
                            </h3>
                            <div className="flex items-center gap-2">
                               <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">{t.workspace.riskScore}</span>
                               <div className={`flex items-center gap-1 px-3 py-1 rounded-full font-bold text-sm border ${
                                  selectedDoc.aiAnalysis.riskScore > 70 ? 'bg-red-100 text-red-700 border-red-200' :
                                  selectedDoc.aiAnalysis.riskScore > 40 ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                                  'bg-green-100 text-green-700 border-green-200'
                               }`}>
                                  {selectedDoc.aiAnalysis.riskScore > 70 ? <AlertTriangle size={14}/> : <Shield size={14}/>}
                                  {selectedDoc.aiAnalysis.riskScore}/100
                               </div>
                            </div>
                         </div>

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                               <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">{t.workspace.execSummary}</h4>
                               <p className="text-sm text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                  {selectedDoc.aiAnalysis.executiveSummary}
                               </p>

                               <h4 className="text-xs font-bold text-slate-500 uppercase mt-4 mb-2">{t.workspace.keyRisks}</h4>
                               <div className="space-y-2">
                                  {selectedDoc.aiAnalysis.keyRisks.map((risk, i) => (
                                     <div key={i} className="flex gap-2 bg-white p-2 rounded-lg border border-slate-100">
                                        <div className={`w-1.5 rounded-full shrink-0 ${
                                           risk.severity === 'High' ? 'bg-red-500' : 
                                           risk.severity === 'Medium' ? 'bg-yellow-500' : 'bg-blue-400'
                                        }`}></div>
                                        <div>
                                           <div className="font-semibold text-slate-800 text-xs">{risk.title}</div>
                                           <div className="text-xs text-slate-500">{risk.description}</div>
                                        </div>
                                     </div>
                                  ))}
                                  {selectedDoc.aiAnalysis.keyRisks.length === 0 && <p className="text-xs text-slate-400 italic">{t.workspace.noRisks}</p>}
                               </div>
                            </div>

                            <div>
                               <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">{t.workspace.actions}</h4>
                               <div className="bg-blue-50/50 rounded-lg border border-blue-100 p-4 h-full">
                                  <ul className="space-y-3">
                                     {selectedDoc.aiAnalysis.actionableInsights.map((action, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                           <CheckCircle2 size={16} className="text-blue-600 shrink-0 mt-0.5" />
                                           <span>{action}</span>
                                        </li>
                                     ))}
                                  </ul>
                                </div>
                            </div>
                         </div>
                      </div>
                   )}

                   {/* Document Header Info */}
                   <div className="flex gap-2">
                      <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
                        {selectedDoc.category}
                      </span>
                      {selectedDoc.tags.map((tag, i) => (
                        <span key={i} className="px-2 py-1 rounded-md bg-blue-50 text-blue-600 text-xs font-medium border border-blue-100 flex items-center gap-1">
                           <Tag size={10} /> {tag}
                        </span>
                      ))}
                   </div>

                   {/* Main Content */}
                   <div className="prose prose-slate max-w-none pb-20">
                     {selectedDoc.content ? (
                       <p className="whitespace-pre-wrap text-slate-700 leading-relaxed font-normal">{selectedDoc.content}</p>
                     ) : (
                       <p className="text-slate-300 italic">{t.workspace.emptyDoc}</p>
                     )}
                   </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
            <div className="bg-slate-50 p-6 rounded-full mb-4 animate-bounce-slow">
              <FileBarChart size={48} className="text-slate-200" />
            </div>
            <p className="font-medium text-slate-500">{t.workspace.selectDocPrompt}</p>
            <p className="text-sm mt-1">{t.workspace.importPrompt}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Workspace;