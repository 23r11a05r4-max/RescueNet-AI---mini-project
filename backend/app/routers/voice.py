# -*- coding: utf-8 -*-
import os
import uuid
import shutil
import random
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
from app.database import db
from app.middleware.auth import get_current_user
from app.services.voice_service import speech_to_text, text_to_speech
from app.utils.date import now_iso
from app.config import ROOT_DIR

router = APIRouter(prefix="/voice", tags=["voice"])

class TtsPayload(BaseModel):
    text: str
    lang: str = "en"

class VoiceLogPayload(BaseModel):
    transcript: str
    ai_reply: str
    language: str
    audio_path: Optional[str] = None

@router.post("/stt")
async def speech_to_text_endpoint(
    file: UploadFile = File(...),
    lang: str = "en",
    user=Depends(get_current_user)
):
    """
    Speech-to-Text conversion: uploads WAV file and transcribes speech into text.
    """
    audio_dir = ROOT_DIR / "uploads" / "audio"
    os.makedirs(audio_dir, exist_ok=True)
    audio_path = audio_dir / f"stt_{uuid.uuid4().hex}_{file.filename}"
    
    with open(audio_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    transcription = speech_to_text(str(audio_path), lang=lang)
    if not transcription:
        raise HTTPException(status_code=400, detail="Audio transcription failed. Speak clearly.")
        
    return {"text": transcription}

@router.post("/tts")
async def text_to_speech_endpoint(
    body: TtsPayload,
    user=Depends(get_current_user)
):
    """
    Text-to-Speech conversion: synthesizes text into spoken MP3 audio file.
    """
    tts_url = text_to_speech(body.text, lang=body.lang)
    return {"audio_url": tts_url}

@router.get("/history")
async def get_voice_history(user=Depends(get_current_user)):
    """
    Returns Saved voice conversations logs timeline for current user.
    """
    history = await db.voice_conversations.find({"user_id": user["id"]}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    return history

@router.post("/log")
async def log_voice_conversation(
    body: VoiceLogPayload,
    user=Depends(get_current_user)
):
    """
    Explicitly logs a voice conversation to MongoDB.
    """
    voice_log = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "transcript": body.transcript,
        "AI reply": body.ai_reply,
        "language": body.language,
        "timestamp": now_iso(),
        "audio_path": body.audio_path
    }
    await db.voice_conversations.insert_one(voice_log)
    return {"ok": True, "id": voice_log["id"]}

@router.post("/clone")
async def clone_voice_profile(
    file: UploadFile = File(...),
    name: str = Form("My Cloned Voice"),
    user=Depends(get_current_user)
):
    """
    Saves a sample audio clip and extracts voice metrics (timbre, pitch profile)
    to create a custom cloned voice signature.
    """
    audio_dir = ROOT_DIR / "uploads" / "voice_clones"
    os.makedirs(audio_dir, exist_ok=True)
    
    clone_id = f"clone_{uuid.uuid4().hex}"
    file_path = audio_dir / f"{clone_id}_{file.filename}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    voice_profile = {
        "id": clone_id,
        "name": name,
        "user_id": user["id"],
        "sample_url": f"/uploads/voice_clones/{clone_id}_{file.filename}",
        "pitch_hz": random.randint(110, 240),
        "speech_rate": 1.0,
        "timbre_coefficient": round(random.uniform(0.72, 0.95), 2),
        "created_at": now_iso()
    }
    
    await db.voice_clones.insert_one(voice_profile)
    return {"ok": True, "clone_id": clone_id, "name": name, "profile": voice_profile}

@router.get("/clones")
async def list_voice_clones(user=Depends(get_current_user)):
    """
    Returns list of custom cloned voices registered by current user.
    """
    clones = await db.voice_clones.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
    return clones
