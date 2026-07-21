# -*- coding: utf-8 -*-
import uuid
import os
import shutil
import zipfile
import io
import csv
import xml.etree.ElementTree as ET
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
from pypdf import PdfReader
from app.database import db
from app.middleware.auth import get_current_user, require_roles
from app.services.ai_service import LocalSemanticSearch
from app.utils.date import now_iso
from app.config import ROOT_DIR

router = APIRouter(prefix="/rag", tags=["rag"])

class QueryPayload(BaseModel):
    q: str
    limit: Optional[int] = 5

def read_docx(file_path: str) -> str:
    """
    Parses a DOCX file natively by extracting and reading the document.xml file.
    """
    try:
        with zipfile.ZipFile(file_path) as docx:
            xml_content = docx.read('word/document.xml')
        tree = ET.fromstring(xml_content)
        namespaces = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        texts = [node.text for node in tree.findall('.//w:t', namespaces) if node.text]
        return " ".join(texts)
    except Exception as e:
        raise Exception(f"Failed to parse docx contents: {e}")

@router.post("/upload")
async def upload_rag_document(
    file: UploadFile = File(...),
    user=Depends(require_roles("admin", "police"))
):
    """
    Ingests and parses document PDFs / DOCX / TXT / CSV files,
    saves document metadata, extracts text, chunks it, and indexes inside MongoDB.
    """
    # Create target directory
    docs_dir = ROOT_DIR / "uploads" / "rag_docs"
    os.makedirs(docs_dir, exist_ok=True)
    
    doc_id = str(uuid.uuid4())
    filename_clean = file.filename.replace(" ", "_")
    file_path = docs_dir / f"{doc_id}_{filename_clean}"
    
    # Save the file physically
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    file_size = os.path.getsize(file_path)
    text_content = ""
    
    # Extract text from file
    if file.filename.endswith(".pdf"):
        try:
            reader = PdfReader(str(file_path))
            for page in reader.pages:
                text_content += page.extract_text() or ""
        except Exception as e:
            if os.path.exists(file_path):
                os.remove(file_path)
            raise HTTPException(status_code=400, detail=f"Failed to read PDF file: {e}")
    elif file.filename.endswith(".docx"):
        try:
            text_content = read_docx(str(file_path))
        except Exception as e:
            if os.path.exists(file_path):
                os.remove(file_path)
            raise HTTPException(status_code=400, detail=str(e))
    elif file.filename.endswith(".csv"):
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                reader = csv.reader(f)
                lines = []
                for row in reader:
                    lines.append(", ".join(row))
                text_content = "\n".join(lines)
        except Exception as e:
            if os.path.exists(file_path):
                os.remove(file_path)
            raise HTTPException(status_code=400, detail=f"Failed to read CSV file: {e}")
    elif file.filename.endswith(".txt"):
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                text_content = f.read()
        except Exception as e:
            if os.path.exists(file_path):
                os.remove(file_path)
            raise HTTPException(status_code=400, detail=f"Failed to read text file: {e}")
    else:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=400, detail="Unsupported file type. Supported extensions: .pdf, .docx, .txt, .csv")
            
    if not text_content.strip():
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=400, detail="Document contains no extractable text.")
        
    # Split text into chunks
    chunk_size = 500
    overlap = 100
    chunks = []
    start = 0
    while start < len(text_content):
        end = start + chunk_size
        chunk_text = text_content[start:end]
        chunks.append({
            "id": str(uuid.uuid4()),
            "document_id": doc_id,
            "filename": file.filename,
            "text": chunk_text.strip(),
            "uploaded_by": user["email"],
            "uploaded_at": now_iso()
        })
        start += (chunk_size - overlap)
        
    # Save chunks
    if chunks:
        await db.knowledge_chunks.insert_many(chunks)
        
    # Save document metadata to knowledge_documents
    doc_metadata = {
        "id": doc_id,
        "filename": file.filename,
        "filepath": f"/uploads/rag_docs/{doc_id}_{filename_clean}",
        "uploaded_by": user["email"],
        "upload_date": now_iso(),
        "document_type": file.filename.split(".")[-1].upper(),
        "file_size": file_size,
        "extracted_text": text_content,
        "embedding": [],
        "metadata": {
            "chunks_count": len(chunks)
        }
    }
    
    await db.knowledge_documents.insert_one(doc_metadata)
    
    return {
        "ok": True, 
        "id": doc_id,
        "filename": file.filename, 
        "chunks_indexed": len(chunks),
        "file_size": file_size
    }

@router.get("/documents")
async def list_documents(user=Depends(require_roles("admin", "police"))):
    """
    Returns list of all uploaded documents.
    """
    docs = await db.knowledge_documents.find({}, {"_id": 0}).sort("upload_date", -1).to_list(500)
    return docs

@router.get("/document/{id}")
async def get_document(id: str, user=Depends(require_roles("admin", "police"))):
    """
    Returns a specific document metadata and text.
    """
    doc = await db.knowledge_documents.find_one({"id": id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc

@router.delete("/document/{id}")
async def delete_document(id: str, user=Depends(require_roles("admin", "police"))):
    """
    Removes document from database, deletes all chunks, and deletes physical file from server.
    """
    doc = await db.knowledge_documents.find_one({"id": id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    # Delete from database
    await db.knowledge_documents.delete_one({"id": id})
    await db.knowledge_chunks.delete_many({"document_id": id})
    
    # Try deleting physical file on server
    try:
        filepath = doc.get("filepath", "")
        if filepath:
            filename = os.path.basename(filepath)
            docs_dir = ROOT_DIR / "uploads" / "rag_docs"
            full_path = docs_dir / filename
            if os.path.exists(full_path):
                os.remove(full_path)
    except Exception as e:
        logger.error(f"Failed to delete physical file: {e}")
        
    return {"ok": True, "message": "Document deleted successfully"}

@router.post("/query")
async def query_knowledge_base(body: QueryPayload, user=Depends(get_current_user)):
    """
    Search knowledge base chunks using TF-IDF local semantic search.
    """
    chunks = await db.knowledge_chunks.find({}, {"_id": 0}).to_list(5000)
    if not chunks:
        return []
        
    matches = LocalSemanticSearch.find_matches(body.q, chunks, top_k=body.limit)
    return matches

@router.get("/download/{id}")
async def download_document(id: str, user=Depends(require_roles("admin", "police"))):
    """
    Secure download endpoint for ingested documents.
    """
    doc = await db.knowledge_documents.find_one({"id": id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    filepath = doc.get("filepath", "")
    if not filepath:
        raise HTTPException(status_code=400, detail="No filepath associated with document")
        
    filename = os.path.basename(filepath)
    docs_dir = ROOT_DIR / "uploads" / "rag_docs"
    full_path = docs_dir / filename
    
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="Physical file not found on server")
        
    return FileResponse(path=str(full_path), filename=doc["filename"], media_type="application/octet-stream")
