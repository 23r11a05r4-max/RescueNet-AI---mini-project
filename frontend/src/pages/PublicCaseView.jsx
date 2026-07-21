import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { MapPin, CalendarBlank, Warning, Camera, ArrowLeft } from "@phosphor-icons/react";
import { MapContainer, TileLayer, CircleMarker, useMapEvents } from "react-leaflet";

const API_BASE = "http://localhost:8000";

function MapClickHandler({ onClick }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

export default function PublicCaseView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [c, setCase] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sighting form states
  const [sightingLoc, setSightingLoc] = useState("");
  const [sightingDate, setSightingDate] = useState("");
  const [sightingLat, setSightingLat] = useState(19.076);
  const [sightingLng, setSightingLng] = useState(72.877);
  const [sightingDesc, setSightingDesc] = useState("");
  const [sightingContact, setSightingContact] = useState("");
  const [sightingAnon, setSightingAnon] = useState(true);
  const [sightingFile, setSightingFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    // Public fetch bypasses Sentinel JWT auth to allow guest view
    axios.get(`${API_BASE}/api/investigations/${id}`)
      .then(res => {
        setCase(res.data);
        if (res.data.lat && res.data.lng) {
          setSightingLat(res.data.lat);
          setSightingLng(res.data.lng);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        toast.error("Unable to load public case profile details.");
        setLoading(false);
      });
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);
    try {
      let photo_url = null;
      if (sightingFile) {
        const formData = new FormData();
        formData.append("file", sightingFile);
        const uploadRes = await axios.post(`${API_BASE}/api/admin/upload`, formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        photo_url = uploadRes.data.url;
      }

      // Anonymous post sighting bypass
      await axios.post(`${API_BASE}/api/community/sightings`, {
        investigation_id: id,
        date_time: sightingDate || new Date().toISOString(),
        location: sightingLoc,
        lat: sightingLat,
        lng: sightingLng,
        description: sightingDesc,
        photo_url,
        reporter_contact: sightingContact || "Public Guest Sighting",
        anonymous: sightingAnon
      }, {
        headers: {
          // Send dummy authorization or empty token mapping for guest submission
          Authorization: `Bearer ${localStorage.getItem("sentinel_token") || ""}`
        }
      });

      toast.success("Sighting report successfully uploaded to the central investigations desk.");
      setSightingLoc("");
      setSightingDesc("");
      setSightingContact("");
      setSightingFile(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload sighting details. Try again.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500 text-xs">Loading public case profile...</div>;
  }

  if (!c) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 space-y-4">
        <Warning size={36} className="text-red-500" />
        <div className="text-sm">Alert profile not found or inactive.</div>
        <button onClick={() => navigate("/")} className="text-xs text-blue-400 hover:underline">Go to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      {/* High-visibility Warning Banner */}
      <div className="bg-gradient-to-r from-red-700 to-amber-700 px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-red-800">
        <div className="flex items-center gap-3">
          <Warning size={28} className="text-white animate-pulse shrink-0" />
          <div>
            <h1 className="font-display font-black text-lg sm:text-xl tracking-tight text-white uppercase">Missing Child Alert</h1>
            <p className="text-xs text-white/95 font-medium mt-0.5">Please review the details below. Report any sightings immediately.</p>
          </div>
        </div>
        <button onClick={() => window.history.back()} className="bg-black/30 hover:bg-black/50 text-white text-xs px-3.5 py-1.5 rounded border border-white/20 flex items-center gap-1.5 transition">
          <ArrowLeft size={12} /> Go Back
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Child Details Card */}
        <div className="border border-slate-800 rounded-md bg-slate-900 overflow-hidden space-y-5">
          <div className="relative h-72 bg-slate-955 overflow-hidden border-b border-slate-800 flex items-center justify-center bg-slate-950">
            {c.photo_url ? (
              <img src={`${API_BASE}${c.photo_url}`} alt={c.person_name} className="w-full h-full object-contain" />
            ) : (
              <span className="text-xs text-slate-500">No Photo Available</span>
            )}
          </div>

          <div className="p-5 space-y-4">
            <div>
              <h2 className="font-display font-black text-2xl tracking-tight text-white">{c.person_name}</h2>
              <div className="text-xs text-slate-400 mt-0.5">Age {c.age} · {c.gender === "M" ? "Male" : "Female"}</div>
            </div>

            <div className="border-t border-slate-850 pt-3 space-y-2 text-xs">
              <div>
                <span className="text-slate-500 uppercase tracking-wider text-[10px] block font-bold">Physical Description</span>
                <p className="text-white font-medium mt-0.5">{c.physical_description || "N/A"}</p>
              </div>
              <div>
                <span className="text-slate-500 uppercase tracking-wider text-[10px] block font-bold">Special Marks / Dialects</span>
                <p className="text-white font-medium mt-0.5">{c.special_marks || "N/A"}</p>
              </div>
              <div>
                <span className="text-slate-500 uppercase tracking-wider text-[10px] block font-bold">Clothes Worn When Last Seen</span>
                <p className="text-white font-medium mt-0.5">{c.clothing_description || "N/A"}</p>
              </div>
            </div>

            <div className="border-t border-slate-850 pt-3 text-xs">
              <span className="text-slate-500 uppercase tracking-wider text-[10px] block font-bold">Last Seen Details</span>
              <div className="bg-slate-950/50 p-3 rounded border border-slate-850 mt-1 space-y-1 text-slate-300">
                <div className="flex items-center gap-1.5"><MapPin size={14} className="text-red-400 shrink-0" /> <strong>Location:</strong> {c.last_seen_location}</div>
                <div className="pl-5 text-[11px] text-slate-400">{c.district}, {c.city}, {c.state}</div>
                {c.last_seen_date_time && (
                  <div className="flex items-center gap-1.5 pt-1.5"><CalendarBlank size={14} className="text-cyan-400 shrink-0" /> <strong>Date/Time:</strong> {new Date(c.last_seen_date_time).toLocaleString()}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Public Sighting Report Form */}
        <div className="border border-slate-800 rounded-md bg-slate-900 p-6 space-y-4 h-fit">
          <div>
            <h3 className="font-display font-bold text-lg text-white">Report Sighting of {c.person_name}</h3>
            <p className="text-xs text-slate-400 mt-1">If you have recently spotted this person, please help the search team by submitting details anonymously.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1.5">Where did you spot them? <span className="text-red-500">*</span></label>
              <input required type="text" placeholder="e.g. Near Star Coffee, Bandra Station Road" value={sightingLoc} onChange={e => setSightingLoc(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded px-3 py-2 text-white placeholder-slate-500 focus:outline-none" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1.5">Approx. Sighting Date/Time</label>
                <input type="datetime-local" value={sightingDate} onChange={e => setSightingDate(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-white" />
              </div>
              <div className="flex flex-col justify-end pb-1.5">
                <label className="flex items-center gap-2 text-slate-400 font-bold select-none cursor-pointer">
                  <input type="checkbox" checked={sightingAnon} onChange={e => setSightingAnon(e.target.checked)} className="rounded border-slate-800 bg-slate-950 text-blue-600 focus:ring-0 cursor-pointer" />
                  <span>Report Anonymously</span>
                </label>
              </div>
            </div>

            {/* GPS coordinates picker */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-slate-500 block flex justify-between font-bold">
                <span>Pin GPS Sighting Location</span>
                <span className="font-mono text-cyan-400">{sightingLat.toFixed(4)}, {sightingLng.toFixed(4)}</span>
              </label>
              <div className="border border-slate-850 rounded overflow-hidden h-40 relative z-10">
                <MapContainer center={[sightingLat, sightingLng]} zoom={12} className="w-full h-full" scrollWheelZoom={false}>
                  <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <CircleMarker center={[sightingLat, sightingLng]} radius={8} pathOptions={{ color: "#e11d48", fillColor: "#e11d48", fillOpacity: 0.8 }} />
                  <MapClickHandler onClick={(lat, lng) => { setSightingLat(lat); setSightingLng(lng); }} />
                </MapContainer>
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1.5">Observed details (clothes/behavior/companion?) <span className="text-red-500">*</span></label>
              <textarea rows={2.5} required placeholder="State any details: did they look distressed? Who were they with?" value={sightingDesc} onChange={e => setSightingDesc(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-white placeholder-slate-500 resize-none h-20" />
            </div>

            {!sightingAnon && (
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1.5">Your Contact Email/Phone <span className="text-red-500">*</span></label>
                <input required type="text" placeholder="e.g. contact@example.com" value={sightingContact} onChange={e => setSightingContact(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded px-3 py-2 text-white placeholder-slate-500" />
              </div>
            )}

            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1.5">Upload Photo / Evidence (Optional)</label>
              <input type="file" onChange={e => setSightingFile(e.target.files[0])} className="w-full bg-slate-950 border border-slate-850 rounded p-1 text-slate-400" />
            </div>

            <button type="submit" disabled={uploading} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 rounded transition uppercase tracking-wider">
              {uploading ? "Uploading sighting file..." : "Send Alert / Report Sighting"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
