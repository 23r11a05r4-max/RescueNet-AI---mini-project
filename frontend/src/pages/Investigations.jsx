import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { Plus, X, UploadSimple } from "@phosphor-icons/react";
import { MapContainer, TileLayer, CircleMarker, useMapEvents } from "react-leaflet";

const priorityBadge = {
  Critical: "bg-red-500/10 text-red-400 border-red-500/30",
  High: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  Medium: "bg-amber-400/10 text-amber-400 border-amber-400/30",
  Low: "bg-slate-500/10 text-slate-300 border-slate-500/30",
};
const statusBadge = {
  open: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  in_progress: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  recovered: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  closed: "bg-slate-500/10 text-slate-300 border-slate-500/30",
};

function MapClickHandler({ onClick }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

function NewForm({ user, onClose, onDone }) {
  const [step, setStep] = useState(1);
  const [f, setF] = useState({
    person_name: "",
    age: "",
    gender: "M",
    last_seen_location: "",
    district: "Bandra",
    city: "Mumbai",
    state: "Maharashtra",
    lat: 19.059,
    lng: 72.829,
    priority: "High",
    reporter_contact: "",
    reporter_name: user?.name || "",
    reporter_email: user?.email || "",
    last_seen_date_time: "",
    physical_description: "",
    special_marks: "",
    clothing_description: "",
    additional_notes: "",
    gdpr_consent: true,
  });
  
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const upd = (k) => (e) => {
    const val = e.target.type === "number" ? (e.target.value === "" ? "" : parseInt(e.target.value || 0)) : e.target.value;
    setF({ ...f, [k]: val });
  };

  const handleMapClick = async (lat, lng) => {
    setF(prev => ({ ...prev, lat, lng }));
    toast.info(`Updated location coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    try {
      const res = await api.get(`/geocoding/reverse?lat=${lat}&lng=${lng}`);
      if (res.data && res.data.resolved_address) {
        setF(prev => ({
          ...prev,
          lat,
          lng,
          resolved_address: res.data.resolved_address,
          city: res.data.city || prev.city,
          state: res.data.state || prev.state,
          district: res.data.district || prev.district
        }));
        toast.success(`Resolved address: ${res.data.resolved_address}`);
      }
    } catch (err) {
      console.error("Reverse geocoding failed", err);
    }
  };

  const handleLocationBlur = async () => {
    if (!f.last_seen_location || !f.last_seen_location.trim()) return;
    try {
      const res = await api.get(`/geocoding/search?q=${encodeURIComponent(f.last_seen_location)}`);
      if (res.data && res.data.lat && res.data.lng) {
        setF(prev => ({
          ...prev,
          lat: res.data.lat,
          lng: res.data.lng,
          resolved_address: res.data.resolved_address,
          city: res.data.city || prev.city,
          state: res.data.state || prev.state,
          district: res.data.district || prev.district
        }));
        toast.success(`Location resolved: ${res.data.resolved_address}`);
      }
    } catch (err) {
      setF(prev => ({
        ...prev,
        lat: 0,
        lng: 0,
        resolved_address: "Location not found"
      }));
      toast.error("Location not found. Map marker is deactivated. Check spelling or click manually on map.");
    }
  };

  const handleFileChange = (file) => {
    if (!file) return;
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Unsupported file format! Please upload JPG, JPEG, PNG, or WEBP.");
      return;
    }
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error("File is too large! Maximum allowed size is 5MB.");
      return;
    }
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const validateStep = () => {
    if (step === 1) {
      if (!f.reporter_name.trim()) { toast.warning("Reporter name is required"); return false; }
      if (!f.reporter_contact.trim()) { toast.warning("Mobile number is required"); return false; }
      return true;
    }
    if (step === 2) {
      if (!f.person_name.trim()) { toast.warning("Missing person name is required"); return false; }
      if (!f.age || f.age <= 0) { toast.warning("Valid age is required"); return false; }
      if (!f.last_seen_location.trim()) { toast.warning("Last seen location address is required"); return false; }
      if (!f.last_seen_date_time.trim()) { toast.warning("Last seen date and time is required"); return false; }
      return true;
    }
    if (step === 3) {
      if (!f.physical_description.trim()) { toast.warning("Physical description is required"); return false; }
      if (!f.special_marks.trim()) { toast.warning("Special identification marks are required"); return false; }
      if (!f.clothing_description.trim()) { toast.warning("Clothing details are required"); return false; }
      return true;
    }
    if (step === 4) {
      if (!photo) { toast.warning("Photograph is required for facial matching systems"); return false; }
      return true;
    }
    return true;
  };

  const next = () => {
    if (validateStep()) setStep(step + 1);
  };

  const prev = () => {
    setStep(step - 1);
  };

  const submit = async (e) => {
    if (e) e.preventDefault();
    if (!validateStep()) return;
    
    setLoading(true);
    try {
      const fullDescription = `Physical Details: ${f.physical_description}\nMarks: ${f.special_marks}\nClothing: ${f.clothing_description}\nAdditional Notes: ${f.additional_notes}`;
      const payload = {
        ...f,
        description: fullDescription,
        age: parseInt(f.age),
        lat: parseFloat(f.lat),
        lng: parseFloat(f.lng),
      };
      
      // 1. Create Report
      const res = await api.post("/investigations", payload);
      const invId = res.data.id;
      
      // 2. Upload photo evidence
      const fd = new FormData();
      fd.append("file", photo);
      fd.append("description", "Recent photograph for facial recognition");
      await api.post(`/investigations/${invId}/evidence`, fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      toast.success("Missing person report and profile photo registered successfully!");
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to submit report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inp = "w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-white disabled:opacity-50";
  const stepTitles = ["Reporter Info", "Person Info", "Physical Profile", "Photograph"];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6" data-testid="new-report-modal">
      <div className="w-full max-w-xl border border-slate-800 rounded-md bg-slate-900 shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950 rounded-t-md">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-mono">Step {step} of 4</div>
            <h2 className="font-display font-bold text-base text-white">File Missing Report</h2>
          </div>
          <button onClick={onClose} data-testid="close-modal" className="text-slate-400 hover:text-white p-1 transition"><X size={18} /></button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-950 h-1 flex">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`flex-1 h-full transition-all duration-300 ${
                s <= step ? "bg-blue-500" : "bg-slate-800"
              }`}
            />
          ))}
        </div>

        {/* Stepper Labels */}
        <div className="px-5 py-2.5 bg-slate-900 border-b border-slate-800/60 flex justify-between text-[9px] uppercase tracking-wider text-slate-500 font-mono">
          {stepTitles.map((t, idx) => (
            <span key={idx} className={idx + 1 === step ? "text-blue-400 font-bold" : idx + 1 < step ? "text-slate-400" : ""}>
              {t}
            </span>
          ))}
        </div>

        {/* Form Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          
          {/* STEP 1: REPORTER INFORMATION */}
          {step === 1 && (
            <div className="space-y-3.5">
              <div className="bg-blue-500/5 border border-blue-500/20 rounded p-3 text-[11px] text-slate-450 leading-normal">
                <strong>Reporter Information:</strong> Please provide your legal contact details. This information is confidential and will only be shared with verified search forces.
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1.5 font-semibold">Your Full Name <span className="text-red-500">*</span></label>
                <input data-testid="inp-name" required placeholder="e.g. Priyanjali Sharma" value={f.reporter_name} onChange={upd("reporter_name")} className={inp} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1.5 font-semibold">Your Mobile Number <span className="text-red-500">*</span></label>
                <input data-testid="inp-contact" required type="tel" placeholder="e.g. +91 98765 43210" value={f.reporter_contact} onChange={upd("reporter_contact")} className={inp} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1.5 font-semibold">Your Email Address (Optional)</label>
                <input type="email" placeholder="e.g. reporter@example.com" value={f.reporter_email} onChange={upd("reporter_email")} className={inp} />
              </div>
            </div>
          )}

          {/* STEP 2: MISSING PERSON GENERAL INFO */}
          {step === 2 && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1.5 font-semibold">Person's Full Name <span className="text-red-500">*</span></label>
                  <input data-testid="inp-name" required placeholder="Missing person's name" value={f.person_name} onChange={upd("person_name")} className={inp} />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1.5 font-semibold">Age <span className="text-red-500">*</span></label>
                  <input data-testid="inp-age" required type="number" name="age" placeholder="Age in years" value={f.age} onChange={upd("age")} className={inp} />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1.5 font-semibold">Gender <span className="text-red-500">*</span></label>
                  <select data-testid="inp-gender" value={f.gender} onChange={upd("gender")} className={inp}>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="O">Other</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1.5 font-semibold">Last Seen Date & Time <span className="text-red-500">*</span></label>
                  <input type="datetime-local" value={f.last_seen_date_time} onChange={upd("last_seen_date_time")} className={inp} required />
                </div>
                 <div className="col-span-2">
                   <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1.5 font-semibold">Last Seen Address / Location <span className="text-red-500">*</span></label>
                   <input data-testid="inp-location" required placeholder="Junction, market, or landmark name..." value={f.last_seen_location} onChange={upd("last_seen_location")} onBlur={handleLocationBlur} className={inp} />
                   {f.resolved_address && (
                     <div className="mt-1 text-[9px] text-blue-400 flex flex-col font-mono leading-normal">
                       <span>Resolved Address: {f.resolved_address}</span>
                     </div>
                   )}
                 </div>
                 
                 {/* Collapsible Leaflet Map Coordinate Picker */}
                 <div className="col-span-2 space-y-1">
                   <label className="text-[10px] uppercase tracking-wider text-slate-500 block font-semibold flex items-center justify-between">
                     <span>GPS Coordinates (Map Picker)</span>
                     <span className="font-mono text-blue-400">{(f.lat && f.lng) ? `${f.lat.toFixed(4)}, ${f.lng.toFixed(4)}` : "Not found"}</span>
                   </label>
                   <div className="border border-slate-800 rounded-md overflow-hidden h-40 relative z-10">
                     <MapContainer center={(f.lat && f.lng && f.lat !== 0 && f.lng !== 0) ? [f.lat, f.lng] : [20.5937, 78.9629]} zoom={(f.lat && f.lng && f.lat !== 0 && f.lng !== 0) ? 12 : 5} className="w-full h-full" scrollWheelZoom={false}>
                       <TileLayer
                         attribution='&copy; OpenStreetMap contributors'
                         url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                       />
                       {f.lat && f.lng && f.lat !== 0 && f.lng !== 0 && (
                         <CircleMarker center={[f.lat, f.lng]} radius={8} pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.8 }} />
                       )}
                       <MapClickHandler onClick={handleMapClick} />
                     </MapContainer>
                   </div>
                   <p className="text-[9px] text-slate-500 italic mt-0.5">Click on the map above to select the coordinates where the person was last seen.</p>
                 </div>
               </div>
             </div>
           )}

          {/* STEP 3: PHYSICAL DESCRIPTION */}
          {step === 3 && (
            <div className="space-y-3.5">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1.5 font-semibold">Physical Description <span className="text-red-500">*</span></label>
                <input placeholder="e.g. Height: 4ft 2in, Complexion: Fair, Hair: Black short, Eyes: Brown" value={f.physical_description} onChange={upd("physical_description")} className={inp} required />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1.5 font-semibold">Special Identification Marks <span className="text-red-500">*</span></label>
                <input placeholder="e.g. Scar on left wrist, birthmark on neck, speaks only Telugu..." value={f.special_marks} onChange={upd("special_marks")} className={inp} required />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1.5 font-semibold">Clothes Worn When Last Seen <span className="text-red-500">*</span></label>
                <input placeholder="e.g. White school shirt and blue trousers, black shoes" value={f.clothing_description} onChange={upd("clothing_description")} className={inp} required />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1.5 font-semibold">Additional Notes (Optional)</label>
                <textarea rows={3} placeholder="Any other context, transit tickets found, suspicious events..." value={f.additional_notes} onChange={upd("additional_notes")} className={`${inp} h-20 resize-none`} />
              </div>
            </div>
          )}

          {/* STEP 4: PHOTOGRAPH UPLOAD */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="bg-cyan-500/5 border border-cyan-500/20 rounded p-3 text-[11px] text-cyan-400 leading-normal">
                <strong>AI Facial Matching Requirement:</strong> Upload a high-resolution, front-facing photograph of the child without filters, hats, or sunglasses. This photo generates the search embeddings.
              </div>

              {/* Drag & Drop Area */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition ${
                  dragActive ? "border-blue-500 bg-blue-500/5" : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
                }`}
                onClick={() => document.getElementById("file-upload").click()}
              >
                <input
                  id="file-upload"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e.target.files[0])}
                  className="hidden"
                />
                
                {photoPreview ? (
                  <div className="relative w-28 h-28 border border-slate-700 rounded overflow-hidden">
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPhoto(null);
                        setPhotoPreview("");
                      }}
                      className="absolute top-1 right-1 bg-red-600 hover:bg-red-500 text-white p-1 rounded-full shadow"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <>
                    <UploadSimple size={24} className="text-slate-500 mb-2" />
                    <span className="text-[11px] text-slate-300">Drag & drop photograph here or <span className="text-blue-400 font-semibold underline">browse files</span></span>
                    <span className="text-[9px] text-slate-500 font-mono mt-1">Accepts JPG, PNG, WEBP (Max 5MB)</span>
                  </>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-slate-800 bg-slate-950 rounded-b-md flex justify-between gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={prev}
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold px-4 py-2 rounded-md transition"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={next}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-5 py-2 rounded-md transition"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={loading || !photo}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-5 py-2 rounded-md transition disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit Report"}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

export default function Investigations() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("active");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [sortByScore, setSortByScore] = useState(false);
  const [sp, setSp] = useSearchParams();
  const [showNew, setShowNew] = useState(sp.get("new") === "1");
  const navigate = useNavigate();

  const load = useCallback(async () => {
    const params = {};
    if (status) params.status = status;
    if (priorityFilter) params.priority = priorityFilter;
    const r = await api.get("/investigations", { params });
    setItems(r.data);
  }, [status, priorityFilter]);
  useEffect(() => { load(); }, [load]);

  const done = () => {
    setShowNew(false);
    sp.delete("new");
    setSp(sp);
    window.dispatchEvent(new CustomEvent("new-case-registered"));
    load();
  };

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-6 space-y-6" data-testid="investigations-page">
      {showNew && <NewForm user={user} onClose={() => { setShowNew(false); sp.delete("new"); setSp(sp); }} onDone={done} />}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Case management</div>
          <h1 className="font-display text-3xl font-black tracking-tighter mt-1">Investigations</h1>
        </div>
        <button data-testid="open-new-report" onClick={() => setShowNew(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2">
          <Plus size={16} weight="bold" /> New Report
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {["active", "open", "in_progress", "recovered", "closed", "all"].map(s => (
            <button key={s} data-testid={`status-filter-${s}`} onClick={() => setStatus(s)}
              className={`text-[10px] px-2.5 py-1 rounded border transition ${status===s ? "bg-blue-600 text-white border-blue-600" : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"}`}>
              {s === "active" ? "Active Cases" : s === "all" ? "All Cases" : s.replace("_"," ")}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] uppercase font-bold text-slate-500 mr-1">Filter Risk:</span>
          {["","Critical","High","Medium","Low"].map(p => (
            <button key={p||"all"} onClick={() => setPriorityFilter(p)}
              className={`text-[10px] px-2.5 py-1 rounded border transition ${priorityFilter===p ? "bg-cyan-600 text-white border-cyan-600" : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"}`}>
              {p || "All"}
            </button>
          ))}
          
          <button
            onClick={() => setSortByScore(!sortByScore)}
            className={`text-[10px] px-2.5 py-1 rounded border transition font-bold ${
              sortByScore ? "bg-amber-600 text-white border-amber-600" : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
            }`}
          >
            Sort by AI Score
          </button>
        </div>
      </div>

      <div className="border border-slate-800 rounded-md bg-slate-900 overflow-hidden">
        <table className="w-full text-sm" data-testid="investigations-table">
          <thead className="bg-slate-950 text-[10px] uppercase tracking-[0.15em] text-slate-500">
            <tr>
              <th className="text-left px-4 py-3">Person</th>
              <th className="text-left px-4 py-3">Location</th>
              <th className="text-left px-4 py-3">Priority</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Reported</th>
              <th className="text-left px-4 py-3">ID</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const sortedItems = [...items].sort((a, b) => {
                if (sortByScore) {
                  return (b.priority_score ?? 0) - (a.priority_score ?? 0);
                }
                // Default: Sort by reported_at desc (newest first)
                return new Date(b.reported_at) - new Date(a.reported_at);
              });              
              return sortedItems.map(i => (
                <tr key={i.id} data-testid={`row-${i.id}`} onClick={() => navigate(`/investigations/${i.id}`)}
                  className={`border-t border-slate-800 hover:bg-slate-850 cursor-pointer transition-colors ${i.priority === "Critical" ? "bg-red-950/10 hover:bg-red-950/20" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-white flex items-center gap-1.5">
                      {i.person_name}
                      {i.priority === "Critical" && (
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      )}
                    </div>
                    <div className="text-xs text-slate-500">{i.age} · {i.gender}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    <div>{i.district}, {i.city}</div>
                    <div className="text-xs text-slate-500">{i.state}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1 items-start">
                      <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${priorityBadge[i.priority]}`}>{i.priority}</span>
                      {i.priority_score !== undefined && (
                        <span className="text-[9px] font-mono text-cyan-400 font-bold">Score: {i.priority_score}%</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${statusBadge[i.status]}`}>{i.status.replace("_"," ")}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 font-mono">{new Date(i.reported_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 font-mono">{i.id.slice(0,8)}</td>
                </tr>
              ));
            })()}
            {items.length===0 && <tr><td colSpan="6" className="text-center py-10 text-slate-500 text-xs">No investigations found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
