import { useState, useEffect, useRef } from "react";
import { api, API } from "../lib/api";
import { 
  ChatCircleText, 
  X, 
  PaperPlaneTilt, 
  Microphone, 
  SpeakerHigh, 
  StopCircle, 
  ArrowClockwise, 
  Translate, 
  Play, 
  Pause,
  Stop,
  Gear
} from "@phosphor-icons/react";
import { toast } from "sonner";

export default function AIChat({ role }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState(""); // "Listening...", "Processing...", "AI Speaking..."
  
  // Chat Session States
  const [sessionId, setSessionId] = useState(null);
  const [sessionStatus, setSessionStatus] = useState("ai");
  
  // Voice AI States
  const [lang, setLang] = useState("en"); // en, hi, te, ta, kn
  const [lastAudioUrl, setLastAudioUrl] = useState(null);
  
  // Custom Cloned Voices
  const [clonesList, setClonesList] = useState([]);
  const [selectedClone, setSelectedClone] = useState("");
  const [uploadingClone, setUploadingClone] = useState(false);
  
  // SpeechSynthesis Web API States
  const [voices, setVoices] = useState([]);
  const [selectedEnglishVoice, setSelectedEnglishVoice] = useState("");
  const [selectedHindiVoice, setSelectedHindiVoice] = useState("");
  const [selectedTeluguVoice, setSelectedTeluguVoice] = useState("");
  const [selectedTamilVoice, setSelectedTamilVoice] = useState("");
  const [selectedKannadaVoice, setSelectedKannadaVoice] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [lastSpokenText, setLastSpokenText] = useState("");

  const mediaRecorderRef = useRef(null);
  const feedEndRef = useRef(null);
  const activeAudioRef = useRef(null);

  const generateUUID = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

  const fetchHistory = async () => {
    try {
      const sessRes = await api.get("/chat/sessions");
      let activeSid = sessionId;
      
      if (sessRes.data && sessRes.data.length > 0) {
        const activeSess = sessRes.data.find(s => s.session_id === sessionId) || sessRes.data[0];
        activeSid = activeSess.session_id;
        setSessionId(activeSid);
        setSessionStatus(activeSess.status || "ai");
      } else {
        activeSid = generateUUID();
        setSessionId(activeSid);
        setHistory([]);
        setSessionStatus("ai");
        return;
      }
      
      const r = await api.get(`/chat/history/${activeSid}`);
      setHistory(r.data || []);
    } catch (err) {
      console.error("Failed to load chat history:", err);
      const newSid = generateUUID();
      setSessionId(newSid);
      setHistory([]);
      setSessionStatus("ai");
    }
  };

  // Load available system voices
  useEffect(() => {
    const loadVoices = () => {
      const vList = window.speechSynthesis.getVoices();
      setVoices(vList);
      
      const savedEn = localStorage.getItem("voice_en");
      const savedHi = localStorage.getItem("voice_hi");
      const savedTe = localStorage.getItem("voice_te");
      const savedTa = localStorage.getItem("voice_ta");
      const savedKn = localStorage.getItem("voice_kn");

      if (savedEn) setSelectedEnglishVoice(savedEn);
      else {
        const defEn = vList.find(v => v.lang.startsWith("en"));
        if (defEn) setSelectedEnglishVoice(defEn.name);
      }
      
      if (savedHi) setSelectedHindiVoice(savedHi);
      else {
        const defHi = vList.find(v => v.lang.startsWith("hi"));
        if (defHi) setSelectedHindiVoice(defHi.name);
      }

      if (savedTe) setSelectedTeluguVoice(savedTe);
      else {
        const defTe = vList.find(v => v.lang.startsWith("te"));
        if (defTe) setSelectedTeluguVoice(defTe.name);
      }

      if (savedTa) setSelectedTamilVoice(savedTa);
      else {
        const defTa = vList.find(v => v.lang.startsWith("ta"));
        if (defTa) setSelectedTamilVoice(defTa.name);
      }

      if (savedKn) setSelectedKannadaVoice(savedKn);
      else {
        const defKn = vList.find(v => v.lang.startsWith("kn"));
        if (defKn) setSelectedKannadaVoice(defKn.name);
      }
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchHistory();
    }
  }, [open]);

  const handleRequestHandoff = async (roleTarget = "police") => {
    if (!sessionId) return;
    try {
      await api.post("/chat/handoff", { session_id: sessionId, target_role: roleTarget });
      setSessionStatus("handed_off");
      toast.success(`Handoff requested. Transferring to human ${roleTarget.toUpperCase()} operator.`);
      fetchHistory();
    } catch (err) {
      toast.error("Failed to request human transfer");
    }
  };

  const fetchClones = async () => {
    try {
      const r = await api.get("/voice/clones");
      setClonesList(r.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUploadClone = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingClone(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", file.name.slice(0, 15));
    try {
      const r = await api.post("/voice/clone", fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      toast.success("Voice sample cloned successfully!");
      fetchClones();
      setSelectedClone(r.data.clone_id);
    } catch (err) {
      toast.error("Failed to clone voice sample.");
    } finally {
      setUploadingClone(false);
    }
  };

  useEffect(() => {
    if (showSettings) {
      fetchClones();
    }
  }, [showSettings]);

  useEffect(() => {
    let interval = null;
    if (open && sessionStatus === "handed_off") {
      interval = setInterval(() => {
        fetchHistory();
      }, 4000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [open, sessionStatus, sessionId]);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  // Language detector helper
  const detectLanguage = (text) => {
    if (/[\u0c00-\u0c7f]/.test(text)) return "te"; // Telugu range
    if (/[\u0900-\u097f]/.test(text)) return "hi"; // Hindi range
    if (/[\u0b80-\u0bff]/.test(text)) return "ta"; // Tamil range
    if (/[\u0c80-\u0cff]/.test(text)) return "kn"; // Kannada range
    return "en"; // Default
  };

  // Playback speech synthesis using backend high-fidelity server TTS
  const speakText = async (text, msgLang = null) => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
    }
    setLastSpokenText(text);

    const detectedLang = msgLang || detectLanguage(text) || lang;
    
    setStatus("AI Speaking...");
    setIsSpeaking(true);
    setIsPaused(false);

    try {
      const r = await api.post("/voice/tts", {
        text: text,
        lang: selectedClone || detectedLang
      });
      
      const absoluteAudioUrl = `${API.replace("/api", "")}${r.data.audio_url}`;
      setLastAudioUrl(absoluteAudioUrl);
      
      const audio = new Audio(absoluteAudioUrl);
      activeAudioRef.current = audio;
      
      audio.onended = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        setStatus("");
      };
      
      audio.onerror = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        setStatus("");
      };
      
      await audio.play();
    } catch (err) {
      console.error("Backend TTS failed:", err);
      toast.error("Failed to play audio response");
      setIsSpeaking(false);
      setIsPaused(false);
      setStatus("");
    }
  };

  const pauseSpeech = () => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      setIsPaused(true);
      setStatus("AI Paused");
    }
  };

  const resumeSpeech = () => {
    if (activeAudioRef.current) {
      activeAudioRef.current.play();
      setIsPaused(false);
      setStatus("AI Speaking...");
    }
  };

  const stopSpeech = () => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.currentTime = 0;
      setIsSpeaking(false);
      setIsPaused(false);
      setStatus("");
    }
  };

  const saveEnVoice = (name) => {
    setSelectedEnglishVoice(name);
    localStorage.setItem("voice_en", name);
  };

  const saveHiVoice = (name) => {
    setSelectedHindiVoice(name);
    localStorage.setItem("voice_hi", name);
  };

  const saveTeVoice = (name) => {
    setSelectedTeluguVoice(name);
    localStorage.setItem("voice_te", name);
  };

  const saveTaVoice = (name) => {
    setSelectedTamilVoice(name);
    localStorage.setItem("voice_ta", name);
  };

  const saveKnVoice = (name) => {
    setSelectedKannadaVoice(name);
    localStorage.setItem("voice_kn", name);
  };

  const sendText = async (e, customMsg = null) => {
    if (e) e.preventDefault();
    const queryText = customMsg || msg;
    if (!queryText.trim()) return;
    
    setMsg("");
    setLoading(true);
    setStatus("Processing...");
    
    const activeSid = sessionId || generateUUID();
    if (!sessionId) {
      setSessionId(activeSid);
    }
    
    const payload = { 
      message: queryText, 
      session_id: activeSid,
      language: lang
    };

    setHistory(prev => [...prev, { role: "user", content: queryText, timestamp: new Date().toISOString() }]);

    try {
      const r = await api.post("/chat", payload);
      const textToSpeak = r.data.response;
      
      setHistory(prev => [
        ...prev, 
        { 
          role: "assistant", 
          content: textToSpeak, 
          sources: r.data.sources,
          timestamp: new Date().toISOString() 
        }
      ]);
      
      // Auto play generated speech using high-fidelity backend TTS
      speakText(textToSpeak, lang);

      // Save voice conversation log to MongoDB
      try {
        await api.post("/voice/log", {
          transcript: queryText,
          ai_reply: textToSpeak,
          language: lang
        });
      } catch (logErr) {
        console.error("Failed to log voice conversation:", logErr);
      }
    } catch (err) {
      toast.error("Failed to send query");
    } finally {
      setLoading(false);
    }
  };

  // Browser Web Audio API PCM WAV recorder
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const input = audioContext.createMediaStreamSource(stream);
      
      const bufferSize = 2048;
      const recorder = audioContext.createScriptProcessor(bufferSize, 1, 1);
      
      const leftChannel = [];
      let recordingLength = 0;
      
      recorder.onaudioprocess = (event) => {
        const samples = event.inputBuffer.getChannelData(0);
        leftChannel.push(new Float32Array(samples));
        recordingLength += bufferSize;
      };
      
      input.connect(recorder);
      recorder.connect(audioContext.destination);
      
      const writeString = (view, offset, string) => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      };

      mediaRecorderRef.current = {
        stop: async () => {
          input.disconnect();
          recorder.disconnect();
          stream.getTracks().forEach(track => track.stop());
          audioContext.close();
          
          const samples = new Float32Array(recordingLength);
          let offset = 0;
          for (let i = 0; i < leftChannel.length; i++) {
            samples.set(leftChannel[i], offset);
            offset += leftChannel[i].length;
          }
          
          const buffer = new ArrayBuffer(44 + samples.length * 2);
          const view = new DataView(buffer);
          
          writeString(view, 0, 'RIFF');
          view.setUint32(4, 36 + samples.length * 2, true);
          writeString(view, 8, 'WAVE');
          writeString(view, 12, 'fmt ');
          view.setUint32(16, 16, true);
          view.setUint16(20, 1, true);
          view.setUint16(22, 1, true);
          view.setUint32(24, audioContext.sampleRate, true);
          view.setUint32(28, audioContext.sampleRate * 2, true);
          view.setUint16(32, 2, true);
          view.setUint16(34, 16, true);
          writeString(view, 36, 'data');
          view.setUint32(40, samples.length * 2, true);
          
          let index = 44;
          for (let i = 0; i < samples.length; i++) {
            const s = Math.max(-1, Math.min(1, samples[i]));
            view.setInt16(index, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            index += 2;
          }
          
          const audioBlob = new Blob([view], { type: 'audio/wav' });
          const file = new File([audioBlob], "recording.wav", { type: "audio/wav" });
          
          const fd = new FormData();
          fd.append("file", file);
          fd.append("lang", lang);
          
          setLoading(true);
          setStatus("Processing...");
          
          try {
            const r = await api.post(`/ai/voice/chat?lang=${lang}`, fd, {
              headers: { "Content-Type": "multipart/form-data" }
            });
            
            const textUserSaid = r.data.user_said;
            const textAiSaid = r.data.ai_said;
            
            setHistory(prev => [
              ...prev, 
              { role: "user", content: textUserSaid, timestamp: new Date().toISOString() },
              { role: "assistant", content: textAiSaid, timestamp: new Date().toISOString() }
            ]);

            // Save voice conversation log to MongoDB via /api/voice/log
            try {
              await api.post("/voice/log", {
                transcript: textUserSaid,
                ai_reply: textAiSaid,
                language: lang,
                audio_path: r.data.audio_url
              });
            } catch (logErr) {
              console.error("Failed to log voice conversation:", logErr);
            }

            // Speak the reply
            speakText(textAiSaid, lang);
            
          } catch (err) {
            toast.error("Voice recognition failed. Try speaking clearly.");
          } finally {
            setLoading(false);
          }
        }
      };
      
      setRecording(true);
      setStatus("Listening...");
      toast.info("Recording started. Speak clearly into your mic.");
    } catch (err) {
      toast.error("Microphone access denied or unavailable");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-cyan-600 hover:bg-cyan-500 text-white p-4 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center ai-glow"
        data-testid="ai-chat-trigger"
        title="RescueNet-AI Assistant"
      >
        <ChatCircleText size={28} weight="fill" />
      </button>

      {open && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[450px] z-50 bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl transition-transform transform duration-300 ease-in-out font-sans">
          
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <div>
                <div className="text-xs font-mono uppercase tracking-widest text-cyan-400">{role} copilot</div>
                <h2 className="font-display font-bold text-sm text-white">AI Rescue Assistant</h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="text-slate-450 hover:text-white p-1 rounded-md transition"
                title="Voice Settings"
              >
                <Gear size={18} />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md transition"
                data-testid="close-chat-drawer"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Voice Settings Panel */}
          {showSettings && (
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-950 text-xs space-y-3">
              <h4 className="font-semibold text-slate-200 uppercase tracking-wider text-[10px]">Select Neural Voices</h4>
              
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase block mb-1">English Voice</label>
                  <select
                    value={selectedEnglishVoice}
                    onChange={e => saveEnVoice(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-white text-[11px]"
                  >
                    {voices.filter(v => v.lang.startsWith("en")).map((v, i) => (
                      <option key={i} value={v.name}>{v.name} ({v.lang})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 uppercase block mb-1">Hindi Voice (हिंदी)</label>
                  <select
                    value={selectedHindiVoice}
                    onChange={e => saveHiVoice(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-white text-[11px]"
                  >
                    {voices.filter(v => v.lang.startsWith("hi")).map((v, i) => (
                      <option key={i} value={v.name}>{v.name}</option>
                    ))}
                    {voices.filter(v => v.lang.startsWith("hi")).length === 0 && (
                      <option value="">Browser default (Hindi)</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 uppercase block mb-1">Telugu Voice (తెలుగు)</label>
                  <select
                    value={selectedTeluguVoice}
                    onChange={e => saveTeVoice(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-white text-[11px]"
                  >
                    {voices.filter(v => v.lang.startsWith("te")).map((v, i) => (
                      <option key={i} value={v.name}>{v.name}</option>
                    ))}
                    {voices.filter(v => v.lang.startsWith("te")).length === 0 && (
                      <option value="">Browser default (Telugu)</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 uppercase block mb-1">Tamil Voice (தமிழ்)</label>
                  <select
                    value={selectedTamilVoice}
                    onChange={e => saveTaVoice(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-white text-[11px]"
                  >
                    {voices.filter(v => v.lang.startsWith("ta")).map((v, i) => (
                      <option key={i} value={v.name}>{v.name}</option>
                    ))}
                    {voices.filter(v => v.lang.startsWith("ta")).length === 0 && (
                      <option value="">Browser default (Tamil)</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 uppercase block mb-1">Kannada Voice (ಕನ್ನಡ)</label>
                  <select
                    value={selectedKannadaVoice}
                    onChange={e => saveKnVoice(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-white text-[11px]"
                  >
                    {voices.filter(v => v.lang.startsWith("kn")).map((v, i) => (
                      <option key={i} value={v.name}>{v.name}</option>
                    ))}
                    {voices.filter(v => v.lang.startsWith("kn")).length === 0 && (
                      <option value="">Browser default (Kannada)</option>
                    )}
                  </select>
                </div>
                
                {/* Voice Cloning Section */}
                <div className="border-t border-slate-800 pt-3 mt-3">
                  <h5 className="font-semibold text-slate-200 uppercase tracking-wider text-[10px] mb-2">Simulated Voice Cloning</h5>
                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase block mb-1">Select Cloned Voice Profile</label>
                      <select
                        value={selectedClone}
                        onChange={e => setSelectedClone(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-white text-[11px]"
                      >
                        <option value="">-- Use Standard TTS --</option>
                        {clonesList.map((c, i) => (
                          <option key={i} value={c.id}>{c.name} (Pitch: {c.pitch_hz}Hz)</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase block mb-1">Upload Voice Sample (.wav/.mp3)</label>
                      <input 
                        type="file" 
                        accept="audio/*" 
                        onChange={handleUploadClone} 
                        disabled={uploadingClone}
                        className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-white text-[10px]"
                      />
                      {uploadingClone && <span className="text-[9px] text-cyan-400">Extracting vocal properties...</span>}
                    </div>
                  </div>
                </div>

                {/* Handoff Section */}
                <div className="border-t border-slate-800 pt-3 mt-3 flex justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleRequestHandoff("police")}
                    disabled={sessionStatus === "handed_off"}
                    className="flex-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/20 font-mono text-[10px] py-1.5 rounded transition uppercase text-center"
                  >
                    Transfer to Police
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRequestHandoff("ngo")}
                    disabled={sessionStatus === "handed_off"}
                    className="flex-1 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/20 font-mono text-[10px] py-1.5 rounded transition uppercase text-center"
                  >
                    Transfer to NGO
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Multilingual toolbar and playback controls */}
          <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <Translate size={14} className="text-cyan-400" />
              <select
                value={lang}
                onChange={e => setLang(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-[11px] text-white"
              >
                <option value="en">English</option>
                <option value="hi">Hindi (हिंदी)</option>
                <option value="te">Telugu (తెలుగు)</option>
                <option value="ta">Tamil (தமிழ்)</option>
                <option value="kn">Kannada (ಕನ್ನಡ)</option>
              </select>
            </div>
            
            <div className="flex items-center gap-1.5">
              {lastSpokenText && (
                <div className="flex items-center gap-1 border border-slate-800 rounded bg-slate-950 px-2 py-0.5 text-[10px]">
                  {isSpeaking ? (
                    <>
                      {isPaused ? (
                        <button onClick={resumeSpeech} title="Play" className="text-cyan-400 hover:text-cyan-300">
                          <Play size={10} weight="fill" />
                        </button>
                      ) : (
                        <button onClick={pauseSpeech} title="Pause" className="text-cyan-400 hover:text-cyan-300">
                          <Pause size={10} weight="fill" />
                        </button>
                      )}
                      <button onClick={stopSpeech} title="Stop" className="text-red-400 hover:text-red-300 ml-1">
                        <Stop size={10} weight="fill" />
                      </button>
                    </>
                  ) : (
                    <button onClick={() => speakText(lastSpokenText, lang)} className="text-slate-400 hover:text-white flex items-center gap-1">
                      <SpeakerHigh size={10} /> Replay
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/20">
            {sessionStatus === "handed_off" && (
              <div className="bg-amber-600/10 text-amber-400 border border-amber-600/20 px-3 py-2 text-[10px] uppercase font-mono text-center flex items-center justify-center gap-1.5 rounded animate-pulse">
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping"></span>
                Active Officer Handoff: Polling human replies
              </div>
            )}
            {history.map((msg, i) => (
              <div
                key={i}
                className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3.5 py-2 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-cyan-600 text-white rounded-br-none"
                      : "bg-slate-800 text-slate-200 rounded-bl-none border border-slate-800"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                    <div className="mt-1.5 pt-1.5 border-t border-slate-700/50 text-[10px] text-slate-400 font-mono">
                      Source: {msg.sources.join(", ")}
                    </div>
                  )}
                  {msg.role === "assistant" && (
                    <div className="mt-2 flex items-center gap-1.5 justify-end">
                      <button
                        onClick={() => speakText(msg.content, lang)}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono uppercase"
                        title="Listen to audio"
                      >
                        <SpeakerHigh size={12} /> Speak
                      </button>
                    </div>
                  )}
                </div>
                <span className="text-[9px] text-slate-500 font-mono mt-1 px-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}

            {history.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                <ChatCircleText size={36} className="text-slate-600 animate-pulse" />
                <div>
                  <div className="text-xs font-semibold text-slate-400">How can I assist you today?</div>
                  <div className="text-[10px] text-slate-500 max-w-[240px] mt-1 leading-relaxed">
                    Select a suggested question below or type your query directly.
                  </div>
                </div>
                
                {/* Suggestions Grid */}
                <div className="grid grid-cols-1 gap-2 w-full max-w-[320px]">
                  {[
                    "How do I report a missing child?",
                    "What documents are required?",
                    "Show investigation status.",
                    "Contact nearby police station."
                  ].map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => sendText(null, s)}
                      className="bg-slate-950 hover:bg-slate-900 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 px-3 py-2 rounded text-[11px] text-left transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Recording wave visualizer animation */}
            {recording && (
              <div className="flex flex-col items-center justify-center py-6 space-y-2">
                <div className="flex items-center gap-1">
                  {[...Array(6)].map((_, i) => (
                    <span
                      key={i}
                      className="w-1.5 h-6 bg-cyan-400 rounded-full animate-pulse"
                      style={{ animationDelay: `${i * 0.1}s`, animationDuration: '0.6s' }}
                    />
                  ))}
                </div>
                <div className="text-[10px] text-cyan-400 font-mono tracking-widest uppercase">Listening...</div>
              </div>
            )}

            {status && !recording && (
              <div className="flex items-center gap-2 text-xs text-slate-500 pl-2">
                <ArrowClockwise size={12} className="animate-spin" /> {status}
              </div>
            )}
            <div ref={feedEndRef} />
          </div>

          {/* Form Actions */}
          <div className="p-4 border-t border-slate-800 bg-slate-900">
            <form onSubmit={sendText} className="flex gap-2">
              {recording ? (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="bg-red-600 hover:bg-red-500 text-white px-3.5 rounded-md flex items-center justify-center transition animate-pulse"
                  title="Stop recording"
                >
                  <StopCircle size={18} weight="fill" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3.5 rounded-md flex items-center justify-center transition border border-slate-800"
                  title="Speak to Assistant"
                  disabled={loading}
                >
                  <Microphone size={18} />
                </button>
              )}

              <input
                type="text"
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                placeholder={recording ? "Listening..." : "Ask the AI assistant..."}
                disabled={loading || recording}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 text-white disabled:opacity-50"
              />

              <button
                type="submit"
                disabled={loading || recording || !msg.trim()}
                className="bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-2 rounded-md transition disabled:opacity-40"
              >
                <PaperPlaneTilt size={16} weight="bold" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
