import React, { useState, useEffect } from "react";
import { api, API } from "../lib/api";
import { toast } from "sonner";
import { 
  CloudArrowUp, 
  FilePdf, 
  FileDoc, 
  FileTxt, 
  Trash, 
  Download, 
  FileMagnifyingGlass, 
  ArrowClockwise, 
  Sparkle,
  Eye,
  Warning,
  X,
  FileCsv
} from "@phosphor-icons/react";

export default function KnowledgeBase() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [aiSearchQuery, setAiSearchQuery] = useState("");
  const [aiSearchResults, setAiSearchResults] = useState(null);
  const [searchingAI, setSearchingAI] = useState(false);

  // Modal Dialog States
  const [previewDoc, setPreviewDoc] = useState(null);
  const [deleteDoc, setDeleteDoc] = useState(null);

  // Statistics
  const [stats, setStats] = useState({
    totalDocs: 0,
    totalChunks: 0,
    recentUpload: "None"
  });

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const r = await api.get("/rag/documents");
      setDocuments(r.data || []);
      
      // Calculate statistics
      const total = r.data.length;
      const chunks = r.data.reduce((acc, curr) => acc + (curr.metadata?.chunks_count || 0), 0);
      let recent = "None";
      if (total > 0) {
        const sorted = [...r.data].sort((a, b) => new Date(b.upload_date) - new Date(a.upload_date));
        recent = sorted[0].filename;
      }
      setStats({
        totalDocs: total,
        totalChunks: chunks,
        recentUpload: recent
      });
    } catch (err) {
      console.error("Failed to load knowledge base:", err);
      toast.error("Failed to load documents list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    
    // Validate format extension
    const allowed = [".pdf", ".docx", ".txt", ".csv"];
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!allowed.includes(ext)) {
      toast.error("Unsupported file format. Use PDF, DOCX, TXT, or CSV only.");
      return;
    }

    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);

    try {
      await api.post("/rag/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      toast.success(`Successfully uploaded and indexed ${file.name}`);
      fetchDocuments();
    } catch (err) {
      console.error("Upload failed:", err);
      toast.error(err.response?.data?.detail || "Indexing failed. Speak with system admin.");
    } finally {
      setUploading(false);
    }
  };

  const executeDelete = async () => {
    if (!deleteDoc) return;
    try {
      await api.delete(`/rag/document/${deleteDoc.id}`);
      toast.success(`Successfully deleted ${deleteDoc.filename}`);
      setDeleteDoc(null);
      fetchDocuments();
      // Clear AI search results if they referenced this doc
      setAiSearchResults(null);
    } catch (err) {
      toast.error("Failed to delete document");
    }
  };

  const handleDownload = (doc) => {
    const token = localStorage.getItem("sentinel_token");
    window.open(`${API}/rag/download/${doc.id}?token=${token}`);
  };

  const openPreview = async (doc) => {
    try {
      const r = await api.get(`/rag/document/${doc.id}`);
      setPreviewDoc(r.data);
    } catch (err) {
      toast.error("Failed to fetch document text for preview");
    }
  };

  const handleAISearch = async (e) => {
    if (e) e.preventDefault();
    if (!aiSearchQuery.trim()) return;

    setSearchingAI(true);
    try {
      const r = await api.post("/rag/query", { q: aiSearchQuery, limit: 3 });
      setAiSearchResults(r.data || []);
      toast.success("AI Search completed successfully");
    } catch (err) {
      console.error("AI Search failed:", err);
      toast.error("Semantic search query failed");
    } finally {
      setSearchingAI(false);
    }
  };

  const getFileIcon = (name) => {
    if (name.endsWith(".pdf")) return <FilePdf size={20} className="text-red-400" />;
    if (name.endsWith(".docx")) return <FileDoc size={20} className="text-blue-400" />;
    if (name.endsWith(".csv")) return <FileCsv size={20} className="text-emerald-400" />;
    return <FileTxt size={20} className="text-slate-400" />;
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Filter list
  const filteredDocs = documents.filter(doc => 
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6 space-y-6 font-sans text-white">
      {/* Title */}
      <div className="flex justify-between items-start">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Retrieval Augmented Generation</div>
          <h1 className="font-display text-3xl font-black tracking-tighter mt-1 text-white">RAG Knowledge Base</h1>
        </div>
        <button onClick={fetchDocuments} className="p-2 border border-slate-800 rounded bg-slate-900 text-slate-400 hover:text-white transition">
          <ArrowClockwise size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Stats Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="border border-slate-800 bg-slate-900 rounded-lg p-5 flex items-center gap-4">
          <div className="p-3.5 bg-cyan-500/10 rounded text-cyan-400">
            <FileMagnifyingGlass size={24} />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Total Documents</div>
            <div className="text-xl font-bold font-mono mt-0.5">{stats.totalDocs}</div>
          </div>
        </div>

        <div className="border border-slate-800 bg-slate-900 rounded-lg p-5 flex items-center gap-4">
          <div className="p-3.5 bg-cyan-500/10 rounded text-cyan-400">
            <Sparkle size={24} />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Total Indexed Chunks</div>
            <div className="text-xl font-bold font-mono mt-0.5">{stats.totalChunks}</div>
          </div>
        </div>

        <div className="border border-slate-800 bg-slate-900 rounded-lg p-5 flex items-center gap-4">
          <div className="p-3.5 bg-cyan-500/10 rounded text-cyan-400">
            <CloudArrowUp size={24} />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Recently Uploaded</div>
            <div className="text-xs font-semibold text-slate-200 mt-1 truncate max-w-[200px]" title={stats.recentUpload}>
              {stats.recentUpload}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Upload & List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Upload & AI Search */}
        <div className="space-y-6">
          {/* Upload Box */}
          <div className="border border-slate-800 bg-slate-900 rounded-lg p-5 space-y-4">
            <h2 className="font-display font-bold text-sm text-white">Ingest Knowledge Document</h2>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Upload emergency response guides, SOP directives, search procedures, or manuals. The RAG pipeline processes, chunks, and builds embeddings dynamically.
            </p>

            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragOver(false); handleFileUpload(e.dataTransfer.files); }}
              className={`border-2 border-dashed rounded-md p-8 text-center transition flex flex-col items-center justify-center cursor-pointer ${
                isDragOver ? "border-cyan-400 bg-cyan-950/20" : "border-slate-800 bg-slate-950 hover:border-slate-700"
              }`}
            >
              <input
                type="file"
                id="file-upload"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
                accept=".pdf,.docx,.txt,.csv"
              />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center justify-center w-full">
                <CloudArrowUp size={36} className={`mb-3 ${uploading ? "animate-bounce text-cyan-400" : "text-slate-500"}`} />
                <div className="text-xs font-semibold text-slate-200">
                  {uploading ? "Uploading & Chunking..." : "Drag & Drop File Here"}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">or click to browse local files</div>
              </label>
            </div>
            
            {uploading && (
              <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                <div className="bg-cyan-500 h-1.5 rounded-full animate-pulse" style={{ width: '100%' }}></div>
              </div>
            )}
          </div>

          {/* AI Semantic Search Box */}
          <div className="border border-slate-800 bg-slate-900 rounded-lg p-5 space-y-4">
            <h2 className="font-display font-bold text-sm text-white flex items-center gap-1.5">
              <Sparkle size={16} className="text-cyan-400 animate-pulse" /> Semantic AI Search
            </h2>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Query the uploaded knowledge base directly using local semantic vector search.
            </p>
            <form onSubmit={handleAISearch} className="flex gap-2">
              <input
                type="text"
                value={aiSearchQuery}
                onChange={e => setAiSearchQuery(e.target.value)}
                placeholder="Ask document questions..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
              <button
                type="submit"
                disabled={searchingAI || !aiSearchQuery.trim()}
                className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white px-3 py-1.5 rounded text-xs transition flex items-center gap-1 font-semibold"
              >
                {searchingAI ? "Searching..." : "AI Search"}
              </button>
            </form>

            {aiSearchResults && (
              <div className="space-y-3 pt-2">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">AI Vector Matches</div>
                {aiSearchResults.map((m, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800 rounded p-2.5 space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] font-mono text-cyan-400">
                      <span className="truncate max-w-[150px]">{m.filename}</span>
                      <span>Score: {m.similarity_score?.toFixed(3)}</span>
                    </div>
                    <div className="text-[11px] text-slate-300 leading-relaxed font-mono whitespace-pre-wrap">
                      "{m.text}"
                    </div>
                  </div>
                ))}
                {aiSearchResults.length === 0 && (
                  <div className="text-xs text-center text-slate-500 py-2">No semantic matches found.</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Documents Table */}
        <div className="lg:col-span-2 border border-slate-800 bg-slate-900 rounded-lg p-5 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h2 className="font-display font-bold text-sm text-white">Ingested Corpus Directory</h2>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search file name..."
              className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-white max-w-xs w-full focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="py-2.5">File Name</th>
                  <th className="py-2.5">File Type</th>
                  <th className="py-2.5">File Size</th>
                  <th className="py-2.5">Uploaded By</th>
                  <th className="py-2.5">Upload Date</th>
                  <th className="py-2.5">Status</th>
                  <th className="py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredDocs.map((doc, idx) => (
                  <tr key={idx} className="hover:bg-slate-950/40">
                    <td className="py-3 flex items-center gap-2 max-w-[180px] truncate">
                      {getFileIcon(doc.filename)}
                      <span className="font-mono text-slate-200" title={doc.filename}>{doc.filename}</span>
                    </td>
                    <td className="py-3 text-slate-400 font-mono text-[10px]">{doc.document_type}</td>
                    <td className="py-3 text-slate-400 font-mono">{formatBytes(doc.file_size)}</td>
                    <td className="py-3 text-slate-400 truncate max-w-[120px]" title={doc.uploaded_by}>{doc.uploaded_by}</td>
                    <td className="py-3 text-slate-400">{new Date(doc.upload_date).toLocaleDateString()}</td>
                    <td className="py-3">
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                        Indexed
                      </span>
                    </td>
                    <td className="py-3 text-right space-x-1.5">
                      <button onClick={() => openPreview(doc)} className="p-1.5 bg-slate-950 hover:bg-slate-800 text-cyan-400 border border-slate-800 rounded transition" title="Preview Extracted Text">
                        <Eye size={14} />
                      </button>
                      <button onClick={() => handleDownload(doc)} className="p-1.5 bg-slate-950 hover:bg-slate-850 text-cyan-400 border border-slate-800 rounded transition" title="Secure Download">
                        <Download size={14} />
                      </button>
                      <button onClick={() => setDeleteDoc(doc)} className="p-1.5 bg-slate-950 hover:bg-red-950/20 text-red-400 border border-slate-800 hover:border-red-800/40 rounded transition" title="Delete Ingested File">
                        <Trash size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredDocs.length === 0 && (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-500">
                      No documents found in knowledge base.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Preview Dialog Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-3xl w-full flex flex-col h-[70vh] shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-display font-bold text-sm truncate max-w-[500px] text-white">
                Extracted Text Preview: {previewDoc.filename}
              </h3>
              <button onClick={() => setPreviewDoc(null)} className="text-slate-400 hover:text-white p-1 rounded">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 p-5 overflow-y-auto font-mono text-xs text-slate-300 whitespace-pre-wrap bg-slate-950/40 leading-relaxed select-all">
              {previewDoc.extracted_text || "No extractable text found."}
            </div>
            <div className="px-5 py-3 border-t border-slate-800 flex justify-end">
              <button onClick={() => setPreviewDoc(null)} className="bg-slate-800 hover:bg-slate-700 text-white text-xs px-4 py-2 rounded transition">
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteDoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400">
              <Warning size={28} />
              <h3 className="font-display font-bold text-base text-white">Confirm Document Deletion</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-red-400 font-mono">{deleteDoc.filename}</strong>? 
              This will remove all RAG vector chunks, delete the physical file from the server, and ground matching logic will no longer query it.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setDeleteDoc(null)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-4 py-2 rounded transition">
                Cancel
              </button>
              <button onClick={executeDelete} className="bg-red-600 hover:bg-red-500 text-white text-xs px-4 py-2 rounded transition font-semibold">
                Delete Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
