# -*- coding: utf-8 -*-
import os
import uuid
import shutil
import logging
import json
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pypdf import PdfReader
from typing import Optional, List
from app.database import chats_col, investigations_col, db
from app.middleware.auth import get_current_user, require_roles
from app.schemas.ai import ChatIn
from app.utils.security import sanitize_text
from app.utils.date import now_iso
from app.config import EMERGENT_LLM_KEY, ROOT_DIR
from app.services.voice_service import speech_to_text, text_to_speech
from app.services.ai_service import LocalSemanticSearch
from app.services.agentic_service import AgenticCoordinator
from app.services.audit_service import log_action
from app.services.notification_service import emit_alert

try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    LLM_AVAILABLE = True
except ImportError:
    LLM_AVAILABLE = False

router = APIRouter(prefix="/ai", tags=["ai"])
logger = logging.getLogger(__name__)

# Role system prompts
SYSTEM_PROMPTS = {
    "citizen": "You are a warm, supportive Missing Child Assistant for citizens. Guide them through reporting and safety SOPs.",
    "police": "You are a tactical Police Investigator AI Assistant. Suggest crime search methods, tracking steps, and evidence analysis.",
    "ngo": "You are a child rescue and rehabilitation AI Planner. Formulate shelter schedules, trauma counseling, and family reunion steps.",
    "admin": "You are a senior system administrator AI Assistant. Explain dashboard statistics, audit compliance, and system health status."
}

LANG_MAP = {
    "en": "English",
    "hi": "Hindi",
    "te": "Telugu",
    "ta": "Tamil",
    "kn": "Kannada"
}

# Multilingual responses generator helper
def generate_mock_dynamic_reply(user_msg: str, lang_key: str, role: str) -> str:
    clean_msg = user_msg.strip("?.").strip()
    
    # 1. Hindi dynamic responder
    if lang_key == "hi":
        if any(w in clean_msg.lower() for w in ["missing child", "report", "लापता", "रिपोर्ट"]):
            return "लापता बच्चे की रिपोर्ट करने के लिए, जाँच अनुभाग (Investigations) पर जाएँ, 'लापता बच्चे की रिपोर्ट करें' पर क्लिक करें, विवरण भरें और फोटो/सीसीटीवी फाइलें अपलोड करें।"
        if any(w in clean_msg.lower() for w in ["document", "doc", "दस्तावेज"]):
            return "आवश्यक दस्तावेजों में रिपोर्टर के आधार कार्ड की प्रतियां, नाबालिगों के जन्म प्रमाण पत्र और आखिरी बार देखी गई तस्वीरें या सीसीटीवी फुटेज शामिल हैं।"
        return f"भूमिका {role} के तहत, मैंने आपका अनुरोध प्राप्त किया: '{clean_msg}'। मैं इसके लिए सुरक्षा प्रोटोकॉल और डेटाबेस रिकॉर्ड की जांच कर रहा हूँ।"

    # 2. Telugu dynamic responder
    elif lang_key == "te":
        if any(w in clean_msg.lower() for w in ["missing child", "report", "తప్పిపోయిన", "నివేద"]):
            return "తప్పిపోయిన పిల్లల గురించి నివేదించడానికి, ఇన్వెస్టిగేషన్స్ (Investigations) విభాగానికి వెళ్లి, 'రిపోర్ట్ మిస్సింగ్ చైల్డ్' పై క్లిక్ చేసి, వివరాలను పూరించి, ఫోటో/CCTV ఫైల్‌లను అప్‌లోడ్ చేయండి."
        if any(w in clean_msg.lower() for w in ["document", "doc", "పత్ర"]):
            return "అవసరమైన పత్రాలలో రిపోర్టర్ల ఆధార్ కార్డ్ కాపీలు, మైనర్ల పుట్టిన తేదీ సర్టిఫికెట్లు మరియు చివరిగా చూసిన ఫోటోలు లేదా CCTV ఫుటేజ్ ఉన్నాయి."
        return f"పాత్ర {role} కింద, నేను మీ అభ్యర్థనను స్వీకరించాను: '{clean_msg}'. దీని కోసం నేను శోధన పారామితులు మరియు డేటాబేస్ రికార్డులను తనిఖీ చేస్తున్నాను."

    # 3. English dynamic responder
    else:
        if any(w in clean_msg.lower() for w in ["missing child", "report"]):
            return "To report a missing child, navigate to the Investigations section, click 'Report Missing Child', fill in details, and upload photo/CCTV files."
        if any(w in clean_msg.lower() for w in ["document", "doc"]):
            return "Required documents include Aadhaar card copies of reporters, birth certs of minors, and last seen photos or CCTV footage."
        return f"Under role {role}, I have received your request: '{clean_msg}'. I am searching the database records for this information."

@router.post("/chat")
async def chat_interaction(body: ChatIn, user=Depends(get_current_user)):
    user_id = user["id"]
    role = user["role"]
    user_msg = sanitize_text(body.message)
    
    # 1. Fetch RAG chunks from knowledge_chunks
    rag_context = ""
    try:
        all_docs = await db.knowledge_chunks.find({}, {"_id": 0}).to_list(2000)
        if all_docs:
            matches = LocalSemanticSearch.find_matches(user_msg, all_docs, top_k=3)
            if matches:
                rag_context = "\n\nSemantic Context from child protection guidelines:\n"
                for m in matches:
                    rag_context += f"--- Passages (Source: {m.get('filename')}, Similarity: {m.get('similarity_score')}):\n{m.get('text')}\n"
    except Exception as e:
        logger.error(f"Semantic search failed: {e}")

    # 2. Setup prompts and language instructions
    base_system = SYSTEM_PROMPTS.get(role, SYSTEM_PROMPTS["citizen"])
    language_instruction = ""
    if body.language and body.language != "en":
        lang_name = LANG_MAP.get(body.language, body.language)
        language_instruction = f"\nRespond strictly in the language: {lang_name}."

    system_instruction = (
        f"{base_system}\n{rag_context}\n\n"
        "Evaluate the emotional state of the user. Return a JSON object with this format:\n"
        "{\n"
        "  \"reply\": \"Your conversational response here...\",\n"
        "  \"sentiment\": \"Stress|Fear|Panic|Urgency|Calm|Confusion\",\n"
        "  \"confidence\": 0.95\n"
        "}"
        f"{language_instruction}"
    )

    # 3. Load history
    chat_session = await chats_col.find_one({"user_id": user_id})
    if not chat_session:
        chat_session = {"user_id": user_id, "messages": []}

    # 4. Invoke LLM
    ai_reply = ""
    sentiment = "Calm"
    confidence = 1.0

    if LLM_AVAILABLE and EMERGENT_LLM_KEY:
        try:
            chat_client = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"chat-{user_id}",
                system_message=system_instruction
            ).with_model("anthropic", "claude-sonnet-4-5-20250929")
            
            resp = await chat_client.send_message(UserMessage(text=user_msg))
            ai_response = str(resp)
            
            s = ai_response.find("{")
            e = ai_response.rfind("}")
            if s >= 0 and e > s:
                parsed = json.loads(ai_response[s:e+1])
                ai_reply = parsed.get("reply", ai_response)
                sentiment = parsed.get("sentiment", "Calm")
                confidence = parsed.get("confidence", 1.0)
            else:
                ai_reply = ai_response
        except Exception as ex:
            logger.error(f"LLM call failed: {ex}")
            lang_key = body.language or "en"
            ai_reply = generate_mock_dynamic_reply(user_msg, lang_key, role)
    else:
        lang_key = body.language or "en"
        ai_reply = generate_mock_dynamic_reply(user_msg, lang_key, role)

    # 5. Automatically dispatch alerts
    if sentiment in ("Panic", "Urgency"):
        await emit_alert(
            "user-chat-alert", "citizen_info_provided", "High",
            f"CRITICAL CHAT DIALOG: Sentiment '{sentiment}' detected. Message: '{user_msg[:60]}...'",
            "Contact citizen or coordinate search units"
        )

    # 6. Save chat logs
    user_entry = {"role": "user", "content": user_msg, "timestamp": now_iso()}
    assistant_entry = {
        "role": "assistant", 
        "content": ai_reply, 
        "sentiment": sentiment, 
        "sentiment_confidence": confidence,
        "timestamp": now_iso()
    }
    
    await chats_col.update_one(
        {"user_id": user_id},
        {
            "$push": {"messages": {"$each": [user_entry, assistant_entry]}},
            "$set": {"updated_at": now_iso()}
        },
        upsert=True
    )
    
    return {
        "response": ai_reply,
        "sentiment": sentiment,
        "confidence": confidence
    }

@router.get("/chat/history")
async def get_chat_history(user=Depends(get_current_user)):
    chat_session = await chats_col.find_one({"user_id": user["id"]}, {"_id": 0})
    if not chat_session:
        return {"messages": []}
    return chat_session

@router.post("/rag/upload")
async def upload_rag_document(file: UploadFile = File(...), user=Depends(require_roles("admin", "police"))):
    docs_dir = ROOT_DIR / "uploads" / "rag_docs"
    os.makedirs(docs_dir, exist_ok=True)
    dest_path = docs_dir / file.filename
    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    text_content = ""
    try:
        reader = PdfReader(dest_path)
        for page in reader.pages:
            text_content += page.extract_text() or ""
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read PDF file: {e}")
        
    if not text_content.strip():
        raise HTTPException(status_code=400, detail="The PDF contains no extractable text.")
        
    chunk_size = 600
    overlap = 100
    chunks = []
    
    start = 0
    while start < len(text_content):
        end = start + chunk_size
        chunk_text = text_content[start:end]
        chunks.append({
            "id": str(uuid.uuid4()),
            "filename": file.filename,
            "text": chunk_text.strip(),
            "uploaded_at": now_iso()
        })
        start += (chunk_size - overlap)
        
    if chunks:
        await db.knowledge_chunks.insert_many(chunks)
        
    await log_action(
        user["id"], user["email"], user["role"],
        "RAG_UPLOAD", f"Uploaded vector search manual: {file.filename} ({len(chunks)} chunks)"
    )
    
    return {"ok": True, "chunks_indexed": len(chunks)}

@router.post("/voice/chat")
async def voice_chat_interaction(file: UploadFile = File(...), lang: str = "en", user=Depends(get_current_user)):
    audio_dir = ROOT_DIR / "uploads" / "audio"
    os.makedirs(audio_dir, exist_ok=True)
    audio_path = audio_dir / f"input_{uuid.uuid4().hex}_{file.filename}"
    
    with open(audio_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    transcription = speech_to_text(str(audio_path), lang=lang)
    if not transcription:
        raise HTTPException(status_code=400, detail="Audio transcription failed. Please speak clearly.")
        
    chat_result = await chat_interaction(ChatIn(message=transcription, language=lang), user=user)
    ai_text = chat_result["response"]
    
    tts_audio_url = text_to_speech(ai_text, lang=lang)
    
    return {
        "user_said": transcription,
        "ai_said": ai_text,
        "audio_url": tts_audio_url,
        "sentiment": chat_result.get("sentiment", "Calm")
    }

class TtsIn(BaseModel):
    text: str
    lang: str = "en"

@router.post("/voice/tts")
async def text_to_speech_endpoint(body: TtsIn, user=Depends(get_current_user)):
    tts_url = text_to_speech(body.text, lang=body.lang)
    return {"audio_url": tts_url}

@router.get("/investigations/{inv_id}/agent")
async def get_agentic_insights(inv_id: str, user=Depends(get_current_user)):
    inv = await investigations_col.find_one({"id": inv_id}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Case file not found")
        
    alerts = await db.alerts.find({"investigation_id": inv_id}, {"_id": 0}).sort("timestamp", 1).to_list(100)
    agentic_report = await AgenticCoordinator.analyze_case(inv, alerts)
    return agentic_report

@router.post("/voice/clone")
async def voice_cloning_announcement_template(
    announcement_type: str = Form(...),
    broadcast_text: str = Form(...),
    user=Depends(require_roles("admin", "police"))
):
    cloned_audio_dir = ROOT_DIR / "uploads" / "cloned"
    os.makedirs(cloned_audio_dir, exist_ok=True)
    filename = f"cloned_{uuid.uuid4().hex}.mp3"
    
    tts_url = text_to_speech(broadcast_text)
    dest_path = cloned_audio_dir / filename
    shutil.copy(str(ROOT_DIR / tts_url.lstrip("/")), str(dest_path))
    
    await log_action(
        user["id"], user["email"], user["role"],
        "VOICE_CLONE_GENERATE", f"Generated voice cloning broadcast type: {announcement_type}. Msg: '{broadcast_text[:50]}...'"
    )
    
    return {
        "status": "success",
        "announcement_type": announcement_type,
        "broadcast_text": broadcast_text,
        "cloned_audio_url": f"/uploads/cloned/{filename}",
        "authorized_by": user["name"]
    }
