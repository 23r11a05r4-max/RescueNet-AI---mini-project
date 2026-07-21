import React, { useState, useEffect } from "react";
import { api, API } from "../lib/api";
import { toast } from "sonner";
import { 
  SpeakerHigh, 
  Clock, 
  Translate, 
  ArrowClockwise, 
  Microphone
} from "@phosphor-icons/react";

export default function VoiceHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const r = await api.get("/voice/history");
      setHistory(r.data || []);
    } catch (err) {
      console.error("Failed to load voice history:", err);
      toast.error("Failed to load voice conversations history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleReplay = (item) => {
    if (!item.audio_path) {
      // Fallback: request dynamic TTS audio from backend
      triggerFallbackTts(item);
      return;
    }
    
    const absoluteAudioUrl = `${API.replace("/api", "")}${item.audio_path}`;
    const audio = new Audio(absoluteAudioUrl);
    audio.play()
      .then(() => toast.success("Playing voice response..."))
      .catch((err) => {
        console.error("Failed to play audio path:", err);
        triggerFallbackTts(item);
      });
  };

  const triggerFallbackTts = async (item) => {
    toast.info("Synthesizing dynamic replay audio...");
    try {
      const r = await api.post("/voice/tts", {
        text: item["AI reply"] || item.ai_reply,
        lang: item.language
      });
      const absoluteAudioUrl = `${API.replace("/api", "")}${r.data.audio_url}`;
      const audio = new Audio(absoluteAudioUrl);
      audio.play();
    } catch (err) {
      toast.error("Failed to synthesize response replay");
    }
  };

  const getLanguageLabel = (code) => {
    const maps = {
      "en": "English",
      "hi": "Hindi (हिंदी)",
      "te": "Telugu (తెలుగు)",
      "ta": "Tamil (தமிழ்)",
      "kn": "Kannada (ಕನ್ನಡ)"
    };
    return maps[code.toLowerCase()] || code.toUpperCase();
  };

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-6 space-y-6 font-sans text-white">
      {/* Title */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-cyan-500/10 rounded text-cyan-400">
            <Microphone size={24} weight="fill" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Voice AI Logs</div>
            <h1 className="font-display text-3xl font-black tracking-tighter mt-1 text-white">Voice Conversation History</h1>
          </div>
        </div>
        <button 
          onClick={fetchHistory} 
          disabled={loading}
          className="p-2 border border-slate-800 rounded bg-slate-900 text-slate-400 hover:text-white transition disabled:opacity-40"
        >
          <ArrowClockwise size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* History timeline feed list */}
      <div className="space-y-4">
        {history.map((item, idx) => (
          <div key={idx} className="border border-slate-800 bg-slate-900 rounded-lg p-5 space-y-4 hover:border-slate-700 transition">
            {/* Top info row */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs border-b border-slate-850 pb-2.5">
              <div className="flex items-center gap-4 text-slate-400">
                <span className="flex items-center gap-1">
                  <Translate size={14} className="text-cyan-400" />
                  {getLanguageLabel(item.language)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={14} className="text-slate-500" />
                  {new Date(item.timestamp).toLocaleString()}
                </span>
              </div>
              <button 
                onClick={() => handleReplay(item)}
                className="bg-cyan-600/10 hover:bg-cyan-600/20 text-cyan-400 border border-cyan-500/20 hover:border-cyan-500/40 px-3.5 py-1.5 rounded text-xs flex items-center gap-1.5 transition font-semibold"
              >
                <SpeakerHigh size={14} weight="fill" /> Replay AI Voice
              </button>
            </div>

            {/* Conversation text details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
              <div className="bg-slate-950 border border-slate-850 rounded p-3.5">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 font-mono">User Transcript</div>
                <p className="text-slate-200 whitespace-pre-wrap font-mono italic">"{item.transcript}"</p>
              </div>
              <div className="bg-slate-950/40 border border-slate-850/50 rounded p-3.5">
                <div className="text-[10px] uppercase tracking-wider text-cyan-400 mb-1.5 font-mono">AI Response</div>
                <p className="text-slate-300 whitespace-pre-wrap">{item["AI reply"] || item.ai_reply}</p>
              </div>
            </div>
          </div>
        ))}

        {history.length === 0 && !loading && (
          <div className="border border-slate-800 border-dashed rounded-lg py-16 text-center text-slate-500 text-sm">
            No voice conversation records found. Use the AI Chatbot's microphone to start voice chatting!
          </div>
        )}
      </div>
    </div>
  );
}
