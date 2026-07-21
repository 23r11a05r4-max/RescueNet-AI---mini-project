import { useCallback, useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, API } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { CaretLeft, DownloadSimple, UploadSimple, Shield, MapPin, Eye, FileText, Check, Phone, Video, PhoneDisconnect, Sparkle, Target, ListChecks, Heartbeat } from "@phosphor-icons/react";
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, Circle } from "react-leaflet";

const priorityBadge = {
  Critical: "bg-red-500/10 text-red-400 border-red-500/30",
  High: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  Medium: "bg-amber-400/10 text-amber-400 border-amber-400/30",
  Low: "bg-slate-500/10 text-slate-300 border-slate-500/30",
};

export default function InvestigationDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [inv, setInv] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [newStatus, setNewStatus] = useState("");
  
  // Assign Fields
  const [station, setStation] = useState("");
  const [ngos, setNgos] = useState("");
  
  // Evidence Fields
  const [evidenceDesc, setEvidenceDesc] = useState("");
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);

  // CCTV Fields
  const [cctvCam, setCctvCam] = useState("CAM-01");
  const [cctvFile, setCctvFile] = useState(null);
  const [uploadingCctv, setUploadingCctv] = useState(false);

  // Rehab Fields
  const [rehabStatus, setRehabStatus] = useState("Counseling");
  const [rehabPct, setRehabPct] = useState(25);
  const [rehabText, setRehabText] = useState("");
  const [submittingRehab, setSubmittingRehab] = useState(false);

  // WebRTC Audio/Video Call States
  const [inCall, setInCall] = useState(false);
  const [callType, setCallType] = useState("audio"); // audio or video
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Agentic AI states
  const [agenticData, setAgenticData] = useState(null);
  const [loadingAgent, setLoadingAgent] = useState(false);
  const [searchRadius, setSearchRadius] = useState(5000);

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/investigations/${id}`);
      setInv(r.data);
      setNewStatus(r.data.status);
      setStation(r.data.assigned_station || "");
      setNgos(r.data.assigned_ngos?.join(", ") || "");
      setSearchRadius(r.data.search_radius || 5000);
      const a = await api.get("/alerts", { params: { limit: 200 } });
      setAlerts(a.data.filter(x => x.investigation_id === id));
    } catch (err) {
      console.error("Failed to load investigation details:", err);
      toast.error("Failed to load details");
    }
  }, [id]);

  const loadAgenticAI = useCallback(async () => {
    setLoadingAgent(true);
    try {
      const r = await api.get(`/ai/investigations/${id}/agent`);
      setAgenticData(r.data);
      toast.success("Agentic AI analysis completed. Recommendations generated.");
    } catch (err) {
      console.error("Failed to load Agentic AI:", err);
    } finally {
      setLoadingAgent(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // WebRTC Signaling Handshake Connection
  const startWebRtcCall = async (type) => {
    setCallType(type);
    setInCall(true);
    
    try {
      const constraints = {
        audio: true,
        video: type === "video"
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      // Establish WebSocket connection to backend signaling room
      const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${wsProto}//${window.location.host}/api/ws/webrtc/${id}/${user.id}`;
      
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;
      
      socket.onopen = () => {
        toast.success(`Connected to emergency ${type} call room`);
      };
      
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "peer_joined") {
          toast.info(`Peer connected. Initializing streams.`);
          // In a production WebRTC app, we construct RTCPeerConnection,
          // attach tracks, compile SDP offer, and send it.
          // For high-fidelity local feedback, we mount a simulated remote stream loopback.
          setRemoteStream(stream);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
          }
        }
      };

    } catch (err) {
      toast.error("Failed to access camera/microphone");
      endWebRtcCall();
    }
  };

  const endWebRtcCall = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (socketRef.current) {
      socketRef.current.close();
    }
    setLocalStream(null);
    setRemoteStream(null);
    setInCall(false);
    toast.info("Call disconnected");
  };

  const updateStatus = async () => {
    try {
      await api.patch(`/investigations/${id}/status`, { status: newStatus });
      toast.success("Investigation status updated");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to update status");
    }
  };

  const handleAssign = async () => {
    try {
      const splitNgos = ngos.split(",").map(x => x.trim()).filter(Boolean);
      await api.patch(`/investigations/${id}/assign`, {
        assigned_station: station,
        assigned_ngos: splitNgos
      });
      toast.success("Case assignments updated successfully");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Assignment update failed");
    }
  };

  const handleEvidenceUpload = async (e) => {
    e.preventDefault();
    if (!evidenceFile) return;
    setUploadingEvidence(true);
    const fd = new FormData();
    fd.append("file", evidenceFile);
    fd.append("description", evidenceDesc);
    fd.append("gdpr_consent", "true");
    try {
      await api.post(`/investigations/${id}/evidence`, fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      toast.success("Supporting document / photo uploaded");
      setEvidenceFile(null);
      setEvidenceDesc("");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Evidence upload failed");
    } finally {
      setUploadingEvidence(false);
    }
  };

  const handleCctvUpload = async (e) => {
    e.preventDefault();
    if (!cctvFile) return;
    setUploadingCctv(true);
    const fd = new FormData();
    fd.append("file", cctvFile);
    fd.append("camera_id", cctvCam);
    try {
      const r = await api.post(`/investigations/${id}/cctv`, fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      toast.success(`CCTV scanning completed. Found ${r.data.detections_count} child matches.`);
      setCctvFile(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "CCTV upload failed");
    } finally {
      setUploadingCctv(false);
    }
  };

  const handleRehabSubmit = async (e) => {
    e.preventDefault();
    if (!rehabText.trim()) return;
    setSubmittingRehab(true);
    try {
      await api.post(`/investigations/${id}/rehab`, {
        rehabilitation_status: rehabStatus,
        progress_percentage: parseInt(rehabPct),
        updates: rehabText
      });
      toast.success("Rehabilitation report added");
      setRehabText("");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to add rehabilitation update");
    } finally {
      setSubmittingRehab(false);
    }
  };

  const downloadCsv = () => {
    const token = localStorage.getItem("sentinel_token");
    fetch(`${API}/reports/investigation/${id}?fmt=csv`, { headers: { Authorization: `Bearer ${token}` }})
      .then(r => r.blob()).then(b => {
        const url = URL.createObjectURL(b);
        const a = document.createElement("a"); a.href = url; a.download = `case_${id.slice(0,8)}.csv`; a.click();
      });
  };

  const handlePrintFlyer = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Popup blocker prevented printing missing child flyer. Please allow popups.");
      return;
    }
    const referencePhoto = inv.photo_url 
      ? (inv.photo_url.startsWith('http') ? inv.photo_url : serverUrl + inv.photo_url) 
      : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>MISSING CHILD ALERT - ${inv.person_name}</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 40px;
            color: #000;
            background-color: #fff;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            border: 10px solid #dc2626;
            padding: 30px;
            position: relative;
          }
          .header {
            background-color: #dc2626;
            color: #fff;
            text-align: center;
            padding: 20px;
            margin-bottom: 30px;
          }
          .header h1 {
            margin: 0;
            font-size: 42px;
            letter-spacing: 2px;
            font-weight: 900;
            text-transform: uppercase;
          }
          .header p {
            margin: 5px 0 0 0;
            font-size: 18px;
            font-weight: bold;
            text-transform: uppercase;
          }
          .main-section {
            display: flex;
            gap: 30px;
            margin-bottom: 35px;
          }
          .photo-frame {
            flex: 1;
            text-align: center;
          }
          .photo-frame img {
            width: 100%;
            max-height: 380px;
            object-fit: cover;
            border: 4px solid #000;
          }
          .details {
            flex: 1.2;
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 15px;
          }
          .detail-row {
            font-size: 16px;
            line-height: 1.6;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 8px;
          }
          .detail-row strong {
            display: inline-block;
            width: 150px;
            color: #dc2626;
            text-transform: uppercase;
            font-size: 13px;
          }
          .description-box {
            background-color: #f9fafb;
            border: 2px dashed #d1d5db;
            padding: 20px;
            margin-bottom: 35px;
          }
          .description-box h3 {
            margin-top: 0;
            color: #dc2626;
            text-transform: uppercase;
            font-size: 16px;
            border-bottom: 2px solid #dc2626;
            padding-bottom: 5px;
          }
          .description-box p {
            font-size: 15px;
            line-height: 1.6;
            margin: 10px 0;
          }
          .footer {
            text-align: center;
            border-top: 4px solid #dc2626;
            padding-top: 20px;
            margin-top: 20px;
          }
          .footer h2 {
            margin: 0;
            font-size: 24px;
            color: #dc2626;
          }
          .footer p {
            margin: 5px 0 0 0;
            font-size: 16px;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>MISSING CHILD</h1>
            <p>Please Help Us Locate ${inv.person_name}</p>
          </div>
          <div class="main-section">
            <div class="photo-frame">
              <img src="${referencePhoto}" alt="Missing Person Photo" />
            </div>
            <div class="details">
              <div class="detail-row"><strong>Name:</strong> ${inv.person_name}</div>
              <div class="detail-row"><strong>Age:</strong> ${inv.age} years old</div>
              <div class="detail-row"><strong>Gender:</strong> ${inv.gender}</div>
              <div class="detail-row"><strong>Last Seen:</strong> ${inv.last_seen_location}</div>
              <div class="detail-row"><strong>Date & Time:</strong> ${new Date(inv.last_seen_date_time).toLocaleString()}</div>
              <div class="detail-row"><strong>City/District:</strong> ${inv.city}, ${inv.district}</div>
              <div class="detail-row"><strong>Case Reference:</strong> ${inv.id.slice(0, 8)}</div>
            </div>
          </div>
          <div class="description-box">
            <h3>Physical Characteristics & Clothes Worn</h3>
            <p><strong>Physical Description:</strong> ${inv.physical_description || 'No description provided'}</p>
            <p><strong>Clothing description:</strong> ${inv.clothing_description || 'No description provided'}</p>
            <p><strong>Special Identification Marks:</strong> ${inv.special_marks || 'None listed'}</p>
          </div>
          <div class="footer">
            <h2>IF YOU HAVE ANY INFORMATION, PLEASE CONTACT:</h2>
            <p>${inv.reporter_contact || 'Local Authorities Immediately'}</p>
            <p style="font-size: 13px; color: #6b7280; font-weight: normal; margin-top: 10px;">Generated via RescueNet-AI Portal</p>
          </div>
        </div>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 1500);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (!inv) return <div className="p-8 text-slate-500 text-sm">Loading investigation...</div>;

  const sortedMovements = [...(inv.movement_path || [])].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
  const polylineCoords = sortedMovements.map(m => [m.lat, m.lng]);
  
  // Plot RAG/Agentic AI suggested locations on the map if they exist
  const agenticLocations = agenticData?.search_locations || [];
  const centerCoords = polylineCoords.length ? polylineCoords[polylineCoords.length - 1] : [inv.lat, inv.lng];
  const serverUrl = API.replace("/api", "");

  return (
    <div className="mx-auto max-w-[1500px] px-6 py-6 space-y-6" data-testid="investigation-detail">
      <div className="flex items-center justify-between">
        <button onClick={() => nav(-1)} className="text-slate-400 hover:text-white text-xs flex items-center gap-1">
          <CaretLeft size={14} /> Back
        </button>
        
        {/* WebRTC calling panel */}
        <div className="flex items-center gap-2">
          {!inCall ? (
            <>
              <button onClick={() => startWebRtcCall("audio")} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 border border-slate-700">
                <Phone size={14} /> WebRTC Voice Call
              </button>
              <button onClick={() => startWebRtcCall("video")} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 border border-slate-700">
                <Video size={14} /> Live Video Call
              </button>
            </>
          ) : (
            <button onClick={endWebRtcCall} className="bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5">
              <PhoneDisconnect size={14} /> End Session
            </button>
          )}
        </div>
      </div>

      {/* WebRTC Video Feeds */}
      {inCall && (
        <div className="grid grid-cols-2 gap-4 border border-slate-800 rounded-md bg-slate-900 p-4">
          <div className="relative h-48 bg-slate-950 rounded overflow-hidden">
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <span className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[10px] text-white">Local Stream</span>
          </div>
          <div className="relative h-48 bg-slate-950 rounded overflow-hidden">
            {remoteStream ? (
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">Connecting to peer...</div>
            )}
            <span className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[10px] text-white">Remote Stream</span>
          </div>
        </div>
      )}

      {/* Case Overview Card */}
      <div className="border border-slate-800 rounded-md bg-slate-900 p-6">
        <div className="flex items-start justify-between flex-wrap gap-6">
          <div className="flex gap-4">
            {inv.photo_url ? (
              <img
                src={`${serverUrl}${inv.photo_url}`}
                alt="Child"
                className="w-24 h-24 rounded border border-slate-800 object-cover bg-slate-950"
              />
            ) : (
              <div className="w-24 h-24 rounded border border-slate-800 bg-slate-950 flex flex-col items-center justify-center text-slate-600 text-xs">
                No Photo
              </div>
            )}
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Investigation #{inv.id.slice(0,8)}</div>
              <h1 className="font-display text-3xl font-black tracking-tighter mt-1">{inv.person_name}</h1>
              <div className="text-slate-400 text-sm mt-1">Age {inv.age} · {inv.gender === "M" ? "Male" : inv.gender === "F" ? "Female" : "Other"}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`text-xs px-2.5 py-1 rounded border ${priorityBadge[inv.priority]}`}>{inv.priority}</span>
                {inv.priority_score !== undefined && (
                  <span className="text-xs px-2.5 py-1 rounded border border-cyan-500/30 bg-cyan-950/20 text-cyan-400 font-mono font-bold">
                    AI Risk Score: {inv.priority_score}%
                  </span>
                )}
                <span className="text-xs px-2.5 py-1 rounded border border-slate-700 bg-slate-800 text-slate-300 uppercase">{inv.status.replace("_"," ")}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {(user.role === "admin" || user.role === "police") && (
              <>
                <select data-testid="status-select" value={newStatus} onChange={e => setNewStatus(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm text-white">
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="recovered">Recovered</option>
                  <option value="closed">Closed</option>
                </select>
                <button data-testid="update-status" onClick={updateStatus} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-md text-sm transition">Update</button>
              </>
            )}
            <button data-testid="download-csv" onClick={downloadCsv} className="border border-slate-800 hover:bg-slate-800 text-slate-300 px-3 py-2 rounded-md text-sm flex items-center gap-2"><DownloadSimple size={14} /> CSV</button>
            <button onClick={handlePrintFlyer} className="border border-slate-800 hover:bg-slate-800 text-slate-300 px-3 py-2 rounded-md text-sm flex items-center gap-2"><FileText size={14} /> Print Flyer</button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Location</div>
            <div className="text-sm text-white mt-1">{inv.last_seen_location}</div>
            <div className="text-xs text-slate-500">{inv.district}, {inv.city}, {inv.state}</div>
            {inv.resolved_address ? (
              <div className="text-xs text-blue-400 mt-1">
                <span className="block font-semibold">Resolved: {inv.resolved_address}</span>
                {inv.lat && inv.lng ? (
                  <span className="block font-mono text-[9px] text-slate-450">GPS: {inv.lat.toFixed(5)}, {inv.lng.toFixed(5)}</span>
                ) : (
                  <span className="block font-mono text-[9px] text-red-400">Coordinates not resolved</span>
                )}
              </div>
            ) : (
              <div className="text-xs text-red-400 mt-1">Location not found</div>
            )}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Reported by</div>
            <div className="text-sm text-white mt-1">{inv.reporter_name}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Station</div>
            <div className="text-sm text-white mt-1">{inv.assigned_station || "Unassigned"}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">NGOs</div>
            <div className="text-sm text-white mt-1">{inv.assigned_ngos?.join(", ") || "None"}</div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-800 flex items-center justify-between">
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Description</div>
            <div className="text-sm text-slate-300 leading-relaxed">{inv.description}</div>
          </div>
          {/* Agentic AI Analysis Trigger */}
          {(user.role === "admin" || user.role === "police") && (
            <button
              onClick={loadAgenticAI}
              disabled={loadingAgent}
              className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold px-4 py-2.5 rounded transition flex items-center gap-1.5 shadow"
            >
              <Sparkle size={14} weight="fill" className={loadingAgent ? "animate-spin" : ""} />
              {loadingAgent ? "Analyzing Case..." : "Run Agentic AI"}
            </button>
          )}
        </div>
      </div>

      {/* AI Risk Assessment & Smart insights panel */}
      {inv.priority_score !== undefined && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Risk score gauge card */}
          <div className="border border-slate-800 rounded-md bg-slate-900 p-5 flex flex-col justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500 font-bold">AI Risk Assessment</div>
              <h3 className="font-display font-bold text-md text-white mt-0.5">Priority scoring index</h3>
            </div>
            <div className="flex items-center gap-4 py-3">
              <div className="relative flex items-center justify-center w-16 h-16 rounded-full border-4 border-slate-850" style={{
                borderColor: inv.priority === "Critical" ? "#ef4444" : 
                            inv.priority === "High" ? "#f97316" : 
                            inv.priority === "Medium" ? "#f59e0b" : "#64748b"
              }}>
                <span className="font-mono text-lg font-black text-white">{inv.priority_score}%</span>
              </div>
              <div>
                <div className="text-sm font-bold text-white">Severity Level: {inv.priority}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Evaluated against age, time, and health details.</div>
              </div>
            </div>
          </div>

          {/* Actionable recommendations card */}
          <div className="md:col-span-2 border border-slate-800 rounded-md bg-slate-900 p-5 flex flex-col justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500 font-bold font-display">AI Recommendations</div>
              <h3 className="font-display font-bold text-md text-white mt-0.5">Smart incident intelligence</h3>
            </div>
            <div className="space-y-1.5 py-2.5">
              {inv.ai_recommendations && inv.ai_recommendations.length > 0 ? (
                inv.ai_recommendations.map((rec, index) => (
                  <div key={index} className="text-xs text-slate-350 flex items-start gap-1.5 bg-slate-950/20 px-2 py-1.5 rounded border border-slate-850">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                    <span>{rec}</span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-500">No priority recommendations computed. Add description or details to generate insights.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Case Management Assignment Drawer for Police/Admin */}
      {(user.role === "admin" || user.role === "police") && (
        <div className="border border-slate-800 rounded-md bg-slate-900 p-5">
          <h2 className="font-display font-bold text-sm text-white mb-4">Case Assignment</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1.5">Police Station</label>
              <input type="text" value={station} onChange={e => setStation(e.target.value)} placeholder="e.g. Central Station" className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-white" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1.5">Assigned NGOs (comma separated)</label>
              <input type="text" value={ngos} onChange={e => setNgos(e.target.value)} placeholder="e.g. ChildLine India, Save the Children" className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-white" />
            </div>
            <button onClick={handleAssign} className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold py-2.5 rounded-md transition flex items-center justify-center gap-2 border border-slate-700">
              Update Case Assignments
            </button>
          </div>
        </div>
      )}

      {/* Configurable Geofencing Radius (Police/Admin only) */}
      {(user.role === "admin" || user.role === "police") && (
        <div className="border border-slate-800 rounded-md bg-slate-900 p-5 mt-4">
          <h2 className="font-display font-bold text-sm text-white mb-2">Geofence Configuration</h2>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1">Search Perimeter Radius: <strong className="text-white font-mono">{searchRadius} meters</strong></label>
              <input 
                type="range" 
                min="500" 
                max="20000" 
                step="500" 
                value={searchRadius} 
                onChange={e => setSearchRadius(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500" 
              />
            </div>
            <button 
              onClick={async () => {
                try {
                  await api.patch(`/investigations/${id}/radius`, { radius: searchRadius });
                  toast.success(`Geofence boundary updated to ${searchRadius}m`);
                  load();
                } catch(err) {
                  toast.error("Failed to update search radius");
                }
              }} 
              className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold px-4 py-2.5 rounded transition shadow-sm mt-3"
            >
              Apply Geofence
            </button>
          </div>
        </div>
      )}

      {/* Agentic AI Advisor Board */}
      {(user.role === "admin" || user.role === "police") && agenticData && (
        <div className="border border-cyan-600/30 rounded-md bg-slate-900 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h2 className="font-display font-bold text-md text-white flex items-center gap-2">
              <Sparkle size={18} className="text-cyan-400" weight="fill" /> Agentic AI Copilot Recommendations
            </h2>
            <span className="text-xs font-mono text-cyan-400">Risk Assessment: <strong>{agenticData.risk_score}/100</strong></span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Steps & Locations */}
            <div className="space-y-3.5">
              <div>
                <h3 className="font-semibold text-white flex items-center gap-1.5 mb-1.5">
                  <Target size={14} className="text-red-400" /> Suggested Search Hubs
                </h3>
                <ul className="space-y-1.5 text-slate-300">
                  {agenticData.search_locations?.map((l, i) => (
                    <li key={i} className="bg-slate-950/40 p-2 rounded border border-slate-800/80">
                      <strong>{l.name}</strong>: {l.reason}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-white flex items-center gap-1.5 mb-1.5">
                  <ListChecks size={14} className="text-cyan-400" /> Actionable Search Checklist
                </h3>
                <ul className="space-y-1 text-slate-300 list-disc list-inside">
                  {agenticData.investigation_steps?.map((step, i) => <li key={i}>{step}</li>)}
                </ul>
              </div>
            </div>

            {/* Workflows */}
            <div className="space-y-3.5">
              <div>
                <h3 className="font-semibold text-white flex items-center gap-1.5 mb-1.5">
                  <Shield size={14} className="text-blue-400" /> Rescue Workflow
                </h3>
                <div className="space-y-1.5 font-mono text-[11px]">
                  {agenticData.rescue_workflow?.map((r, i) => (
                    <div key={i} className="bg-slate-950/30 p-1.5 rounded flex justify-between gap-4 border border-slate-800/60">
                      <span>[{r.phase}] {r.action}</span>
                      <span className="text-cyan-400 font-bold shrink-0">{r.owner}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-white flex items-center gap-1.5 mb-1.5">
                  <Heartbeat size={14} className="text-emerald-400" /> Rehabilitation Workflow
                </h3>
                <div className="space-y-1.5 font-mono text-[11px]">
                  {agenticData.rehab_workflow?.map((rh, i) => (
                    <div key={i} className="bg-slate-950/30 p-1.5 rounded flex justify-between gap-4 border border-slate-800/60">
                      <span>[{rh.phase}] {rh.action}</span>
                      <span className="text-emerald-400 font-bold shrink-0">{rh.owner}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Details and Sidebars */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          
          {/* Movement tracking map */}
          <div className="border border-slate-800 rounded-md bg-slate-900 overflow-hidden h-96 relative">
            <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 text-[10px] uppercase tracking-[0.25em] text-slate-500 font-bold flex items-center gap-1.5">
              <MapPin size={12} className="text-cyan-400" /> CCTV Tracking Timeline Map
            </div>
            { (inv.lat && inv.lng && inv.lat !== 0 && inv.lng !== 0) ? (
              <MapContainer center={centerCoords} zoom={13} className="w-full h-full" scrollWheelZoom>
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {/* Geofencing perimeter */}
                <Circle center={[inv.lat, inv.lng]} radius={searchRadius} pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.1, dashArray: "10, 10" }}>
                  <Popup>
                    <div className="text-xs font-bold font-mono text-cyan-400">Emergency Geofenced Search Perimeter ({searchRadius}m)</div>
                  </Popup>
                </Circle>

                {/* Plot last seen home location */}
                <CircleMarker center={[inv.lat, inv.lng]} radius={10} pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.8 }}>
                  <Popup>
                    <div className="text-xs font-bold">Home/Initial Location</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{inv.last_seen_location}</div>
                  </Popup>
                </CircleMarker>

                {/* Plot movements */}
                {sortedMovements.map((pt, idx) => (
                  <CircleMarker key={idx} center={[pt.lat, pt.lng]} radius={7} pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.7 }}>
                    <Popup>
                      <div className="text-xs font-bold">{pt.camera}</div>
                      <div className="text-[10px] text-slate-500">Time: {new Date(pt.timestamp).toLocaleString()}</div>
                      <div className="text-[10px] text-cyan-400">Heading: {pt.direction}</div>
                    </Popup>
                  </CircleMarker>
                ))}

                {/* Plot Agentic AI Suggested search coordinates */}
                {agenticLocations.map((al, idx) => (
                  <CircleMarker key={`al-${idx}`} center={[al.lat, al.lng]} radius={8} pathOptions={{ color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 0.8 }}>
                    <Popup>
                      <div className="text-xs font-bold font-mono text-amber-500">AI Suggested Zone</div>
                      <div className="text-xs font-bold">{al.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{al.reason}</div>
                    </Popup>
                  </CircleMarker>
                ))}

                {/* Connect movements with vectors */}
                {polylineCoords.length > 1 && (
                  <Polyline positions={polylineCoords} pathOptions={{ color: "#ef4444", weight: 3, dashArray: "5, 5" }} />
                )}
              </MapContainer>
            ) : (
              <div className="w-full h-full bg-slate-950/60 flex flex-col items-center justify-center text-slate-500">
                <MapPin size={32} className="text-red-500 mb-2 opacity-60" />
                <span className="text-sm font-semibold">Location not found</span>
                <span className="text-[10px] text-slate-650 mt-1">Unable to display map coordinates for this case.</span>
              </div>
            )}
          </div>

          {/* Timeline Event History */}
          <div className="border border-slate-800 rounded-md bg-slate-900 p-5 space-y-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1">Timeline</div>
              <h2 className="font-display font-bold text-lg mb-4">Event History</h2>
            </div>
            <div className="relative border-l border-slate-800 ml-3 pl-6 space-y-5 text-xs">
              {(inv.timeline && inv.timeline.length > 0 ? inv.timeline : alerts.map(a => ({
                id: a.id,
                event_type: a.event_type,
                description: a.description,
                timestamp: a.timestamp
              }))).map((t, idx) => (
                <div key={t.id || idx} className="relative">
                  <span className="absolute -left-[31px] top-1 w-2.5 h-2.5 rounded-full border-2 border-slate-900" style={{
                    backgroundColor: t.event_type === "case_closed" ? "#10b981" : 
                                    t.event_type === "ai_face_match" ? "#a855f7" :
                                    t.event_type === "evidence_uploaded" ? "#3b82f6" : "#f59e0b"
                  }} />
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500 font-mono">
                        {t.event_type.replace("_", " ")}
                      </span>
                      <p className="text-white font-medium mt-0.5">{t.description}</p>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0">
                      {new Date(t.timestamp).toLocaleDateString()} {new Date(t.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                </div>
              ))}
              {(!inv.timeline || inv.timeline.length === 0) && alerts.length === 0 && (
                <div className="text-slate-500 py-2">No lifecycle events recorded yet</div>
              )}
            </div>
          </div>

          {/* Rehabilitation Updates (visible to all, NGO can submit) */}
          <div className="border border-slate-800 rounded-md bg-slate-900 p-5 space-y-4">
            <h2 className="font-display font-bold text-md text-white">NGO Rehabilitation Updates</h2>
            
            <div className="space-y-3">
              {inv.rehabilitation_updates?.length ? inv.rehabilitation_updates.map((update) => (
                <div key={update.id} className="border border-slate-800 rounded-md p-3 bg-slate-950/40 text-xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-cyan-400 font-mono uppercase text-[10px]">{update.ngo_name}</span>
                    <span className="text-slate-500 text-[10px] font-mono">{new Date(update.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-white flex-1">{update.updates}</div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-slate-400">Progress</div>
                      <div className="text-sm font-bold font-mono text-emerald-400">{update.progress}%</div>
                    </div>
                  </div>
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mt-2">Rehab Phase: {update.status}</div>
                </div>
              )) : (
                <div className="text-xs text-slate-500 py-3 text-center">No rehabilitation reports filed yet</div>
              )}
            </div>

            {/* Submit Rehab Update Form (NGO/Admin only) */}
            {(user.role === "ngo" || user.role === "admin") && (
              <form onSubmit={handleRehabSubmit} className="border-t border-slate-800 pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1">Rehabilitation Stage</label>
                    <select value={rehabStatus} onChange={e => setRehabStatus(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white">
                      <option>Counseling</option>
                      <option>Medical Checkup</option>
                      <option>Shelter Care</option>
                      <option>Educational Integration</option>
                      <option>Reunited with Family</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1">Progress Percentage</label>
                    <input type="number" min="0" max="100" value={rehabPct} onChange={e => setRehabPct(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1">Updates / Notes</label>
                  <textarea rows={2.5} value={rehabText} onChange={e => setRehabText(e.target.value)} placeholder="Describe child's recovery and counseling details..." className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white" required />
                </div>
                <button type="submit" disabled={submittingRehab} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-2 rounded transition">
                  {submittingRehab ? "Saving..." : "Add Rehabilitation Update"}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Side Panel Detections / Upload Forms */}
        <div className="space-y-6">

          {/* AI Matches details */}
          <div className="border border-slate-800 rounded-md bg-slate-900 p-5 space-y-4">
            <h2 className="font-display font-bold text-sm text-white">AI Face Recognition Matches</h2>
            <div className="space-y-3">
              {inv.ai_matches?.length ? inv.ai_matches.map((m, i) => (
                <div key={i} className="border border-slate-800 bg-slate-950/40 rounded p-3 flex gap-3 text-xs">
                  {m.frame_url ? (
                    <img
                      src={`${serverUrl}${m.frame_url}`}
                      alt="Detected Face"
                      className="w-16 h-16 rounded object-cover border border-slate-800 bg-slate-950"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded border border-slate-800 bg-slate-950 flex items-center justify-center text-slate-500 text-[10px]">
                      No Frame
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-cyan-400 font-bold">{m.cam}</span>
                      <span className="font-mono text-emerald-400 font-black">{Math.round(m.score * 100)}% Match</span>
                    </div>
                    <div className="text-slate-400 mt-1 text-[10px] font-mono leading-relaxed">
                      {new Date(m.time).toLocaleString()}
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-xs text-slate-500">No AI matches found yet. Upload CCTV footage to start scanning.</div>
              )}
            </div>
          </div>

          {/* CCTV Upload panel (Police/Admin only) */}
          {(user.role === "police" || user.role === "admin") && (
            <div className="border border-slate-800 rounded-md bg-slate-900 p-5 space-y-3">
              <h2 className="font-display font-bold text-sm text-white flex items-center gap-1.5">
                <UploadSimple size={16} /> CCTV Video Analysis
              </h2>
              <form onSubmit={handleCctvUpload} className="space-y-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1">Camera Identification</label>
                  <input type="text" value={cctvCam} onChange={e => setCctvCam(e.target.value)} placeholder="CAM-01" className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1">CCTV Footage File</label>
                  <input type="file" onChange={e => setCctvFile(e.target.files[0])} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300" required />
                </div>
                <button type="submit" disabled={uploadingCctv || !cctvFile} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold py-2 rounded transition">
                  {uploadingCctv ? "Scanning & Comparing Faces..." : "Upload & Analyze Video"}
                </button>
              </form>
            </div>
          )}

          {/* Evidence / Document Upload panel */}
          {((user.role === "citizen" && inv.reporter_id === user.id) || user.role === "police" || user.role === "admin") && (
            <div className="border border-slate-800 rounded-md bg-slate-900 p-5 space-y-3">
              <h2 className="font-display font-bold text-sm text-white flex items-center gap-1.5">
                <UploadSimple size={16} /> Supporting Files / Photos
              </h2>
              <form onSubmit={handleEvidenceUpload} className="space-y-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1">Description</label>
                  <input type="text" value={evidenceDesc} onChange={e => setEvidenceDesc(e.target.value)} placeholder="e.g. Birth certificate / recent profile photo" className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white" required />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1">File Upload</label>
                  <input type="file" onChange={e => setEvidenceFile(e.target.files[0])} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300" required />
                </div>
                <button type="submit" disabled={uploadingEvidence || !evidenceFile} className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2 rounded transition">
                  {uploadingEvidence ? "Uploading files..." : "Upload Document"}
                </button>
              </form>
            </div>
          )}

          {/* Evidence and supporting files listing */}
          <div className="border border-slate-800 rounded-md bg-slate-900 p-5 space-y-3">
            <h2 className="font-display font-bold text-sm text-white">Evidence & Certificates</h2>
            <div className="space-y-2.5">
              {inv.evidence?.length ? inv.evidence.map((ev) => (
                <div key={ev.id} className="border border-slate-800 rounded px-3 py-2 bg-slate-950/40 text-xs flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <div className="font-medium text-white truncate">{ev.name}</div>
                    <div className="text-[9px] text-slate-500 font-mono mt-0.5 truncate">
                      By {ev.uploaded_by} on {new Date(ev.timestamp).toLocaleDateString()}
                    </div>
                    <div className="text-slate-400 mt-1 text-[10px] italic">{ev.description}</div>
                  </div>
                  <a
                    href={`${serverUrl}${ev.url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 p-1.5 shrink-0"
                    title="View Document"
                  >
                    <Eye size={16} />
                  </a>
                </div>
              )) : (
                <div className="text-xs text-slate-500">No supporting documentation uploaded.</div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
