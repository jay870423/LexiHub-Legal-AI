import React, { useState, useRef } from 'react';
import { PersonalDoc } from '../types';
import { Plus, FileText, Trash2, Edit2, Save, X, Search, FileBarChart, Calendar, Tag, Upload, AlertCircle } from 'lucide-react';

interface WorkspaceProps {
  documents: PersonalDoc[];
  setDocuments: React.Dispatch<React.SetStateAction<PersonalDoc[]>>;
}

const Workspace: React.FC<WorkspaceProps> = ({ documents, setDocuments }) => {
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form State
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState<PersonalDoc['category']>('Report');
  const [editTags, setEditTags] = useState('');

  const handleCreateNew = () => {
    const newDoc: PersonalDoc = {
      id: Date.now().toString(),
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

  // FIX: Explicitly use window.confirm and ensure state updates
  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      // 1. Deselect if currently selected
      if (selectedDocId === id) {
        setSelectedDocId(null);
      }
      // 2. Remove from list
      setDocuments(prev => prev.filter(d => d.id !== id));
    }
  };

  // NEW: Handle File Import
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        const newDoc: PersonalDoc = {
          id: Date.now().toString(),
          title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
          category: 'Data',
          content: text,
          tags: ['Imported'],
          updatedAt: new Date().toISOString()
        };
        setDocuments(prev => [newDoc, ...prev]);
        handleSelectDoc(newDoc);
        alert(`Successfully imported "${file.name}"`);
      }
    };
    reader.readAsText(file);
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
    <div className="flex h-[calc(100vh-140px)] md:h-[calc(100vh-10rem)] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        className="hidden" 
        accept=".txt,.md,.json,.csv,.xml" 
      />

      {/* LEFT: Document List */}
      <div className="w-full md:w-1/3 border-r border-gray-200 flex flex-col bg-gray-50">
        <div className="p-4 border-b border-gray-200 space-y-3">
          <div className="flex gap-2">
            <button 
              onClick={handleCreateNew}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors shadow-sm text-sm"
            >
              <Plus size={16} /> New Doc
            </button>
            <button 
              onClick={triggerFileUpload}
              className="px-4 bg-white border border-gray-300 hover:bg-gray-50 text-slate-700 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors shadow-sm text-sm"
              title="Import .txt, .md, .json, .csv"
            >
              <Upload size={16} /> Import
            </button>
          </div>
          
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search title, content, tags..." 
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
                <span>No documents found.</span>
             </div>
          ) : (
            filteredDocs.map(doc => (
              <div 
                key={doc.id}
                onClick={() => handleSelectDoc(doc)}
                className={`p-3 rounded-lg cursor-pointer transition-all border ${
                  selectedDocId === doc.id 
                    ? 'bg-white border-blue-500 shadow-md scale-[1.02]' 
                    : 'bg-white border-transparent hover:bg-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h4 className={`font-semibold text-sm truncate pr-2 ${selectedDocId === doc.id ? 'text-blue-700' : 'text-slate-800'}`}>
                    {doc.title || "Untitled"}
                  </h4>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 shrink-0">
                    {doc.category}
                  </span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2 mb-2 h-8 break-all">
                  {doc.content?.substring(0, 100) || "No content..."}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <Calendar size={10} />
                  <span>{new Date(doc.updatedAt).toLocaleDateString()}</span>
                  {/* Content Match Indicator */}
                  {searchTerm && !doc.title.toLowerCase().includes(searchTerm.toLowerCase()) && doc.content.toLowerCase().includes(searchTerm.toLowerCase()) && (
                    <span className="text-blue-500 ml-auto font-medium">Match in content</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT: Editor / Preview */}
      <div className="flex-1 flex flex-col bg-white h-full overflow-hidden">
        {selectedDoc ? (
          <>
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
               <div className="overflow-hidden mr-4">
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={editTitle} 
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="text-lg font-bold text-slate-800 border-b border-dashed border-slate-300 focus:border-blue-500 outline-none bg-transparent w-full"
                      placeholder="Document Title"
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
                      <button onClick={handleSave} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm">
                        <Save size={16} /> Save
                      </button>
                    </>
                 ) : (
                    <>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(selectedDoc.id);
                        }} 
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Document"
                      >
                        <Trash2 size={18} />
                      </button>
                      <button onClick={() => setIsEditing(true)} className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-700 rounded-lg text-sm font-medium transition-all">
                        <Edit2 size={16} /> Edit
                      </button>
                    </>
                 )}
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-8">
              {isEditing ? (
                <div className="space-y-4 max-w-3xl mx-auto animate-in fade-in">
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Category</label>
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
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Tags (comma separated)</label>
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
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Content</label>
                      <textarea 
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        placeholder="Paste your report, data analysis, or meeting notes here..."
                        className="w-full h-[450px] p-4 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed resize-none shadow-inner"
                      />
                   </div>
                </div>
              ) : (
                <div className="max-w-3xl mx-auto animate-in fade-in">
                   <div className="flex gap-2 mb-6">
                      <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
                        {selectedDoc.category}
                      </span>
                      {selectedDoc.tags.map((tag, i) => (
                        <span key={i} className="px-2 py-1 rounded-md bg-blue-50 text-blue-600 text-xs font-medium border border-blue-100 flex items-center gap-1">
                           <Tag size={10} /> {tag}
                        </span>
                      ))}
                   </div>
                   <div className="prose prose-slate max-w-none">
                     {selectedDoc.content ? (
                       <p className="whitespace-pre-wrap text-slate-700 leading-relaxed font-normal">{selectedDoc.content}</p>
                     ) : (
                       <p className="text-slate-300 italic">Empty document.</p>
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
            <p className="font-medium text-slate-500">Select a document to view or edit</p>
            <p className="text-sm mt-1">Or import a file to start your knowledge base</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Workspace;