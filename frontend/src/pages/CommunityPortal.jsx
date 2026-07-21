import { useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { 
  HandHeart, Users, CheckCircle, XCircle, MapPin, Eye, ShareNetwork, 
  ShieldAlert, ListChecks, CalendarBlank, Camera, VideoCamera, Flag, Sparkle 
} from "@phosphor-icons/react";
import { MapContainer, TileLayer, CircleMarker, useMapEvents } from "react-leaflet";
import { useNavigate } from "react-router-dom";

const API_BASE = "http://localhost:8000";

function MapClickHandler({ onClick }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

export default function CommunityPortal() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("cases"); // cases, volunteer, sightings, moderate
  const [cases, setCases] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [volProfile, setVolProfile] = useState(null);
  const [sightings, setSightings] = useState([]);
  const [stats, setStats] = useState(null);

  // Filter States for Cases
  const [searchLoc, setSearchLoc] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [ageGroupFilter, setAgeGroupFilter] = useState("");

  // Volunteer form state
  const [volForm, setVolForm] = useState({
    contact_details: "",
    city: "",
    district: "",
    skills: [],
    availability: "available"
  });
  const availableSkills = ["Search & Rescue", "Medical / First Aid", "Photography / Drones", "Social Media / Awareness", "Translation / Local Guide"];

  // Sighting form state
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [sightingDate, setSightingDate] = useState("");
  const [sightingLoc, setSightingLoc] = useState("");
  const [sightingLat, setSightingLat] = useState(19.076);
  const [sightingLng, setSightingLng] = useState(72.877);
  const [sightingDesc, setSightingDesc] = useState("");
  const [sightingContact, setSightingContact] = useState("");
  const [sightingAnon, setSightingAnon] = useState(true);
  const [sightingFile, setSightingFile] = useState(null);
  const [uploadingSighting, setUploadingSighting] = useState(false);

  // Load everything
  const loadCases = useCallback(async () => {
    try {
      const r = await api.get("/investigations");
      setCases(r.data.filter(c => c.status !== "closed" && c.status !== "recovered"));
    } catch (err) {
      toast.error("Failed to load active cases");
    }
  }, []);

  const loadVolProfile = useCallback(async () => {
    try {
      const r = await api.get("/community/volunteers/profile");
      if (r.data?.registered) {
        setVolProfile(r.data);
        setVolForm({
          contact_details: r.data.contact_details,
          city: r.data.city,
          district: r.data.district,
          skills: r.data.skills || [],
          availability: r.data.availability || "available"
        });
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadVolunteers = useCallback(async () => {
    if (user.role !== "admin" && user.role !== "police") return;
    try {
      const r = await api.get("/community/volunteers");
      setVolunteers(r.data);
    } catch (err) {
      console.error(err);
    }
  }, [user]);

  const loadSightings = useCallback(async () => {
    try {
      const r = await api.get("/community/sightings");
      setSightings(r.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const r = await api.get("/community/volunteers/stats");
      setStats(r.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadCases();
    loadVolProfile();
    loadSightings();
    loadStats();
    if (user.role === "admin" || user.role === "police") {
      loadVolunteers();
    }
  }, [loadCases, loadVolProfile, loadSightings, loadStats, loadVolunteers, user]);

  const handleShare = (caseId) => {
    const shareUrl = `${window.location.origin}/public-case/${caseId}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success("Public awareness profile link copied to clipboard!");
  };

  const handleVolunteerSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/community/volunteers", volForm);
      toast.success("Volunteer credentials successfully registered!");
      loadVolProfile();
      loadStats();
    } catch (err) {
      toast.error("Registration failed");
    }
  };

  const handleSkillToggle = (skill) => {
    setVolForm(prev => {
      const skills = prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill];
      return { ...prev, skills };
    });
  };

  const handleSightingSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCaseId) {
      toast.error("Please select a missing person case");
      return;
    }
    setUploadingSighting(true);
    try {
      let photo_url = null;
      if (sightingFile) {
        const formData = new FormData();
        formData.append("file", sightingFile);
        const uploadRes = await api.post("/admin/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        photo_url = uploadRes.data.url;
      }

      await api.post("/community/sightings", {
        investigation_id: selectedCaseId,
        date_time: sightingDate || new Date().toISOString(),
        location: sightingLoc,
        lat: sightingLat,
        lng: sightingLng,
        description: sightingDesc,
        photo_url,
        reporter_contact: sightingContact,
        anonymous: sightingAnon
      });

      toast.success("Sighting report submitted successfully for moderation.");
      setSelectedCaseId("");
      setSightingLoc("");
      setSightingDesc("");
      setSightingContact("");
      setSightingFile(null);
      loadSightings();
      loadStats();
    } catch (err) {
      toast.error("Failed to submit sighting report");
    } finally {
      setUploadingSighting(false);
    }
  };

  const moderateSighting = async (sightingId, action) => {
    try {
      await api.post(`/community/sightings/${sightingId}/moderate`, { action });
      toast.success(`Sighting report marked as ${action}`);
      loadSightings();
      loadStats();
      loadCases(); // reload cases to update timeline and routes
    } catch (err) {
      toast.error("Moderation request failed");
    }
  };

  const verifyVolunteer = async (volId) => {
    try {
      const r = await api.post(`/community/volunteers/${volId}/verify`);
      toast.success(`Volunteer status updated! Verified: ${r.data.verified}`);
      loadVolunteers();
      loadStats();
    } catch (err) {
      toast.error("Verification failed");
    }
  };

  const joinSearchCampaign = async (caseId) => {
    try {
      await api.post("/community/volunteers/join-campaign", { investigation_id: caseId });
      toast.success("You have successfully joined this search campaign!");
      loadVolProfile();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Must be registered as volunteer");
    }
  };

  // Filter cases logic
  const filteredCases = cases.filter(c => {
    const matchesLoc = !searchLoc || 
      c.city?.toLowerCase().includes(searchLoc.toLowerCase()) || 
      c.district?.toLowerCase().includes(searchLoc.toLowerCase()) ||
      c.state?.toLowerCase().includes(searchLoc.toLowerCase());
    const matchesGender = !genderFilter || c.gender === genderFilter;
    const matchesAge = !ageGroupFilter || (
      ageGroupFilter === "child" ? c.age <= 12 : 
      ageGroupFilter === "teen" ? (c.age > 12 && c.age <= 17) : c.age >= 18
    );
    return matchesLoc && matchesGender && matchesAge;
  });

  return (
    <div className="mx-auto max-w-[1500px] px-6 py-6 space-y-6" data-testid="community-portal">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500 font-bold">Public crowdsourcing</div>
          <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tighter mt-1">Community Awareness Space</h1>
        </div>
        
        {/* Volunteer Status Badge */}
        {volProfile?.verified && (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs px-3.5 py-2 rounded-md font-bold">
            <CheckCircle size={16} weight="fill" /> Verified Search Volunteer
          </div>
        )}
      </div>

      {/* Community Stats Bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-900 border border-slate-800 rounded-md p-4">
          <div>
            <div className="text-[9px] uppercase tracking-wider text-slate-500">Active Volunteers</div>
            <div className="text-xl font-bold font-mono text-white mt-0.5">{stats.active_volunteers} <span className="text-[11px] font-normal text-slate-400">/ {stats.total_volunteers} registered</span></div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-slate-500">Verified Rescue Units</div>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">{stats.verified_volunteers} verified</div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-slate-500">Crowdsourced Sightings</div>
            <div className="text-xl font-bold font-mono text-cyan-400 mt-0.5">{stats.total_sightings} reported</div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-slate-500">Verified Sighting Updates</div>
            <div className="text-xl font-bold font-mono text-amber-500 mt-0.5">{stats.verified_sightings} matches pinned</div>
          </div>
        </div>
      )}

      {/* Tabs System Navigation */}
      <div className="border-b border-slate-800 flex flex-wrap gap-2 pb-px">
        <button onClick={() => setActiveTab("cases")} className={`pb-3 text-xs uppercase tracking-wider font-semibold border-b-2 px-3 transition-colors ${activeTab === "cases" ? "border-blue-500 text-blue-400" : "border-transparent text-slate-400 hover:text-white"}`}>
          Active Incidents Directory
        </button>
        <button onClick={() => setActiveTab("volunteer")} className={`pb-3 text-xs uppercase tracking-wider font-semibold border-b-2 px-3 transition-colors ${activeTab === "volunteer" ? "border-blue-500 text-blue-400" : "border-transparent text-slate-400 hover:text-white"}`}>
          Volunteer Desk
        </button>
        <button onClick={() => setActiveTab("sighting")} className={`pb-3 text-xs uppercase tracking-wider font-semibold border-b-2 px-3 transition-colors ${activeTab === "sighting" ? "border-blue-500 text-blue-400" : "border-transparent text-slate-400 hover:text-white"}`}>
          Report Sighting
        </button>
        {(user.role === "admin" || user.role === "police") && (
          <button onClick={() => setActiveTab("moderate")} className={`pb-3 text-xs uppercase tracking-wider font-semibold border-b-2 px-3 transition-colors ${activeTab === "moderate" ? "border-blue-500 text-blue-400" : "border-transparent text-slate-400 hover:text-white"}`}>
            Moderate Sightings
          </button>
        )}
      </div>

      {/* TAB CONTENT: CASES DIRECTORY */}
      {activeTab === "cases" && (
        <div className="space-y-4">
          {/* Filtering bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900 border border-slate-800 rounded p-3">
            <div>
              <input type="text" placeholder="Search City / State..." value={searchLoc} onChange={e => setSearchLoc(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-500" />
            </div>
            <div>
              <select value={genderFilter} onChange={e => setGenderFilter(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-white cursor-pointer">
                <option value="">All Genders</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </div>
            <div>
              <select value={ageGroupFilter} onChange={e => setAgeGroupFilter(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-white cursor-pointer">
                <option value="">All Ages</option>
                <option value="child">Child (0-12)</option>
                <option value="teen">Teen (13-17)</option>
                <option value="adult">Adult (18+)</option>
              </select>
            </div>
          </div>

          {/* Cases grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {filteredCases.map(c => (
              <div key={c.id} className="border border-slate-800 rounded-md bg-slate-900 overflow-hidden flex flex-col justify-between">
                <div className="relative h-44 bg-slate-955 overflow-hidden border-b border-slate-800">
                  {c.photo_url ? (
                    <img src={`${API_BASE}${c.photo_url}`} alt={c.person_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-xs text-slate-500 bg-slate-950">No Photograph Provided</div>
                  )}
                  {c.priority === "Critical" && (
                    <span className="absolute top-2 left-2 bg-red-600 text-white text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded shadow">Critical priority</span>
                  )}
                </div>

                <div className="p-4 space-y-3.5 flex-1">
                  <div>
                    <h3 className="font-display font-black text-lg text-white tracking-tight leading-tight">{c.person_name}</h3>
                    <div className="text-slate-400 text-xs mt-0.5">Age {c.age} · {c.gender === "M" ? "Male" : "Female"}</div>
                  </div>

                  <div className="text-xs text-slate-350 space-y-1 bg-slate-950/40 p-2.5 rounded border border-slate-850">
                    <div><strong className="text-slate-500">Last Seen:</strong> {c.last_seen_location}</div>
                    <div className="text-[10px] text-slate-400 mt-1">{c.district}, {c.city}, {c.state}</div>
                  </div>

                  {/* Actions buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-850">
                    <button onClick={() => navigate(`/investigations/${c.id}`)} className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold py-2 rounded-md flex items-center justify-center gap-1.5 border border-slate-750 transition">
                      <Eye size={14} /> Full File
                    </button>
                    <button onClick={() => handleShare(c.id)} className="bg-cyan-600/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 text-xs font-semibold py-2 rounded-md flex items-center justify-center gap-1.5 transition">
                      <ShareNetwork size={14} /> Share Awareness
                    </button>
                  </div>
                  
                  {volProfile && (
                    <button
                      onClick={() => joinSearchCampaign(c.id)}
                      disabled={volProfile.joined_campaigns?.includes(c.id)}
                      className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900/20 disabled:text-blue-500 disabled:border-blue-900/30 text-white text-xs font-semibold py-2 rounded-md transition flex items-center justify-center gap-1.5"
                    >
                      <HandHeart size={14} />
                      {volProfile.joined_campaigns?.includes(c.id) ? "Active Joined Searcher" : "Join Search Campaign"}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {filteredCases.length === 0 && (
              <div className="col-span-3 text-center py-12 text-slate-500 text-xs bg-slate-900 border border-slate-800 rounded">
                No active missing person cases found matching search filter parameters.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: VOLUNTEER HUB */}
      {activeTab === "volunteer" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Volunteer form registration */}
          <div className="lg:col-span-2 border border-slate-800 rounded-md bg-slate-900 p-5 space-y-4">
            <div>
              <h2 className="font-display font-bold text-lg text-white">Rescue Volunteer Credentials</h2>
              <p className="text-xs text-slate-400 mt-1">Submit your details to enlist in crowdsourced local physical grid searches or coordination awareness groups.</p>
            </div>

            <form onSubmit={handleVolunteerSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1.5">Availability Contact Details (Phone/Email)</label>
                  <input required type="text" placeholder="e.g. +91 98765 43210" value={volForm.contact_details} onChange={e => setVolForm({...volForm, contact_details: e.target.value})} className="w-full bg-slate-950 border border-slate-850 rounded px-3 py-2 text-white placeholder-slate-500" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1.5">Availability Status</label>
                  <select value={volForm.availability} onChange={e => setVolForm({...volForm, availability: e.target.value})} className="w-full bg-slate-950 border border-slate-850 rounded px-3 py-2 text-white">
                    <option value="available">Available (On Call for local campaigns)</option>
                    <option value="unavailable">Unavailable (Temporarily inactive)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1.5">Active City</label>
                  <input required type="text" placeholder="e.g. Mumbai" value={volForm.city} onChange={e => setVolForm({...volForm, city: e.target.value})} className="w-full bg-slate-950 border border-slate-850 rounded px-3 py-2 text-white placeholder-slate-500" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1.5">Active District</label>
                  <input required type="text" placeholder="e.g. Bandra" value={volForm.district} onChange={e => setVolForm({...volForm, district: e.target.value})} className="w-full bg-slate-950 border border-slate-850 rounded px-3 py-2 text-white placeholder-slate-500" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-wider text-slate-500 block">Skills & Mobilization Capabilities</label>
                <div className="flex flex-wrap gap-2">
                  {availableSkills.map(s => {
                    const checked = volForm.skills.includes(s);
                    return (
                      <button type="button" key={s} onClick={() => handleSkillToggle(s)} className={`px-3 py-1.5 rounded border text-[11px] font-semibold transition ${checked ? "bg-blue-600 border-blue-500 text-white" : "bg-slate-950 border-slate-850 text-slate-400 hover:text-white"}`}>
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2.5 rounded transition">
                {volProfile?.registered ? "Update Volunteer Profile" : "Register as Active Search Volunteer"}
              </button>
            </form>
          </div>

          {/* Volunteer Status / Campaigns info */}
          <div className="space-y-6">
            {volProfile ? (
              <div className="border border-slate-800 rounded-md bg-slate-900 p-5 space-y-4">
                <h3 className="font-display font-bold text-sm text-white">My Volunteer Profile</h3>
                <div className="space-y-2.5 text-xs text-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Verification Status:</span>
                    {volProfile.verified ? (
                      <span className="text-emerald-400 font-bold inline-flex items-center gap-1"><CheckCircle size={14} weight="fill" /> VERIFIED</span>
                    ) : (
                      <span className="text-amber-500 font-bold inline-flex items-center gap-1"><Flag size={14} /> PENDING ADMIN CHECK</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Availability:</span>
                    <span className="capitalize font-semibold text-white">{volProfile.availability}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Active Location:</span>
                    <span className="text-white">{volProfile.district}, {volProfile.city}</span>
                  </div>
                  <div className="border-t border-slate-850 pt-2.5">
                    <span className="text-slate-500 block mb-1">Joined Campaigns ({volProfile.joined_campaigns?.length || 0}):</span>
                    <div className="space-y-1">
                      {volProfile.joined_campaigns?.map(id => {
                        const matchedCase = cases.find(c => c.id === id);
                        return (
                          <div key={id} onClick={() => navigate(`/investigations/${id}`)} className="bg-slate-950/40 p-2 rounded border border-slate-850 flex justify-between items-center cursor-pointer hover:bg-slate-950 transition">
                            <span>Search group for {matchedCase ? matchedCase.person_name : id.slice(0, 8)}</span>
                            <Eye size={12} className="text-cyan-400" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border border-slate-800 border-dashed rounded-md bg-slate-950/20 p-5 text-center text-xs text-slate-500">
                You have not registered as a volunteer. Enlist on the left form to help search for missing people.
              </div>
            )}

            {/* List volunteers for Admin verification toggling */}
            {(user.role === "admin" || user.role === "police") && volunteers.length > 0 && (
              <div className="border border-slate-800 rounded-md bg-slate-900 p-5 space-y-4">
                <h3 className="font-display font-bold text-sm text-white">Volunteers Registry Verification</h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {volunteers.map(v => (
                    <div key={v.id} className="border border-slate-800 bg-slate-950/50 p-2.5 rounded text-xs flex justify-between items-center gap-3">
                      <div>
                        <div className="font-semibold text-white flex items-center gap-1">
                          {v.name}
                          {v.verified && <CheckCircle size={12} className="text-emerald-400" weight="fill" />}
                        </div>
                        <div className="text-[10px] text-slate-400">{v.district}, {v.city} · Skills: {v.skills?.length || 0}</div>
                      </div>
                      
                      {user.role === "admin" && (
                        <button onClick={() => verifyVolunteer(v.id)} className={`px-2 py-1 rounded text-[10px] font-bold transition ${v.verified ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-emerald-600 text-white"}`}>
                          {v.verified ? "Revoke" : "Verify"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: REPORT A SIGHTING */}
      {activeTab === "sighting" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 border border-slate-800 rounded-md bg-slate-900 p-5 space-y-4">
            <div>
              <h2 className="font-display font-bold text-lg text-white">Report a Possible Sighting</h2>
              <p className="text-xs text-slate-400 mt-1">If you have observed someone matching the description of an active missing person report, please log details below.</p>
            </div>

            <form onSubmit={handleSightingSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1.5">Select Missing Person <span className="text-red-500">*</span></label>
                  <select required value={selectedCaseId} onChange={e => setSelectedCaseId(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded px-3 py-2 text-white">
                    <option value="">-- Choose Case File --</option>
                    {cases.map(c => (
                      <option key={c.id} value={c.id}>{c.person_name} (Age {c.age}, last seen {c.city})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1.5">Date & Approximate Time Observed</label>
                  <input type="datetime-local" value={sightingDate} onChange={e => setSightingDate(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded px-3 py-2 text-white" />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1.5">Address / Location Details <span className="text-red-500">*</span></label>
                <input required type="text" placeholder="e.g. Bus stop opposite Main Market, Bandra West" value={sightingLoc} onChange={e => setSightingLoc(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded px-3 py-2 text-white placeholder-slate-500" />
              </div>

              {/* Sighting Map coordinates selector */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-slate-500 block flex justify-between font-bold">
                  <span>GPS Map Marker Sighting Coordinates</span>
                  <span className="font-mono text-cyan-400">{sightingLat.toFixed(4)}, {sightingLng.toFixed(4)}</span>
                </label>
                <div className="border border-slate-850 rounded overflow-hidden h-48 relative z-10">
                  <MapContainer center={[sightingLat, sightingLng]} zoom={12} className="w-full h-full" scrollWheelZoom={false}>
                    <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <CircleMarker center={[sightingLat, sightingLng]} radius={10} pathOptions={{ color: "#e11d48", fillColor: "#e11d48", fillOpacity: 0.8 }} />
                    <MapClickHandler onClick={(lat, lng) => { setSightingLat(lat); setSightingLng(lng); }} />
                  </MapContainer>
                </div>
                <p className="text-[9px] text-slate-500 italic">Click on map to pin precise sighting location coordinate logs.</p>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1.5">Observation Details (Clothes, behavior, accompanied?) <span className="text-red-500">*</span></label>
                <textarea rows={3} required placeholder="Describe clothes worn, physical appearance, emotional state or if they were accompanied by someone..." value={sightingDesc} onChange={e => setSightingDesc(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded p-2.5 text-white placeholder-slate-500 h-24 resize-none" />
              </div>

              <div className="border-t border-slate-850 pt-4 flex flex-col gap-4">
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 text-slate-300 font-bold select-none cursor-pointer">
                    <input type="checkbox" checked={sightingAnon} onChange={e => setSightingAnon(e.target.checked)} className="rounded border-slate-800 bg-slate-950 text-blue-600 focus:ring-0 cursor-pointer" />
                    <span>Report Anonymously</span>
                  </label>
                </div>

                {!sightingAnon && (
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1.5">Your Contact Info (Phone/Email) <span className="text-red-500">*</span></label>
                    <input required type="text" placeholder="e.g. +91 99999 88888 or citizen@example.com" value={sightingContact} onChange={e => setSightingContact(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded px-3 py-2 text-white placeholder-slate-500" />
                  </div>
                )}

                <div>
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1.5">Supporting Photograph / Sighting Media (Optional)</label>
                  <input type="file" onChange={e => setSightingFile(e.target.files[0])} className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-slate-400" />
                </div>
              </div>

              <button type="submit" disabled={uploadingSighting} className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-5 py-2.5 rounded transition">
                {uploadingSighting ? "Submitting report file..." : "Submit Sighting Report"}
              </button>
            </form>
          </div>

          <div className="border border-slate-800 rounded-md bg-slate-900 p-5 space-y-4">
            <h3 className="font-display font-bold text-sm text-white">Tips for Reporting</h3>
            <div className="space-y-3 text-xs text-slate-400 leading-relaxed">
              <p><strong>1. Prioritize Safety:</strong> Do not approach suspicious individuals or attempt to intervene yourself. Report details silently.</p>
              <p><strong>2. Take Photo Safely:</strong> If possible without drawing attention, capture a photograph or note down vehicle license plates.</p>
              <p><strong>3. Exact Location:</strong> Pining the exact coordinates on the map selector helps search teams deploy instantly.</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: MODERATE SIGHTINGS */}
      {activeTab === "moderate" && (user.role === "admin" || user.role === "police") && (
        <div className="border border-slate-800 rounded-md bg-slate-900 p-5 space-y-4">
          <div>
            <h2 className="font-display font-bold text-lg text-white">Sighting Reports Moderation</h2>
            <p className="text-xs text-slate-400 mt-1">Review public sighting contributions before approval to update case map routing coordinates.</p>
          </div>

          <div className="space-y-4">
            {sightings.filter(s => s.status === "pending").map(s => (
              <div key={s.id} className="border border-slate-800 bg-slate-950/40 rounded p-4 flex flex-col md:flex-row justify-between items-start gap-4">
                <div className="space-y-2 text-xs flex-1">
                  <div className="flex items-center gap-3">
                    <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded">Pending Approval</span>
                    <span className="text-slate-500 font-mono">{new Date(s.created_at).toLocaleString()}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Sighting for case: {s.person_name} ({s.investigation_id.slice(0,8)})</h3>
                    <p className="text-slate-400 mt-1 italic">"{s.description}"</p>
                  </div>
                  <div className="text-[11px] text-slate-400 grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 border-t border-slate-900">
                    <div><strong>Last Observed:</strong> {s.location} ({new Date(s.date_time).toLocaleString()})</div>
                    <div><strong>Coordinates:</strong> {s.lat.toFixed(4)}, {s.lng.toFixed(4)}</div>
                    <div><strong>Reporter:</strong> {s.anonymous ? "Anonymous citizen" : s.reporter_contact}</div>
                  </div>
                  {s.photo_url && (
                    <div className="pt-2">
                      <a href={`${API_BASE}${s.photo_url}`} target="_blank" rel="noreferrer" className="text-cyan-400 hover:text-cyan-300 font-semibold inline-flex items-center gap-1">
                        <Camera size={14} /> View Uploaded Photo / Evidence
                      </a>
                    </div>
                  )}
                </div>

                <div className="flex md:flex-col gap-2 shrink-0 w-full md:w-auto">
                  <button onClick={() => moderateSighting(s.id, "approve")} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded text-xs transition flex items-center justify-center gap-1.5">
                    <CheckCircle size={14} /> Approve & Log
                  </button>
                  <button onClick={() => moderateSighting(s.id, "reject")} className="flex-1 border border-slate-800 hover:bg-slate-800 text-slate-400 font-bold px-3 py-1.5 rounded text-xs transition flex items-center justify-center gap-1.5">
                    <XCircle size={14} /> Reject
                  </button>
                  <button onClick={() => moderateSighting(s.id, "spam")} className="flex-1 bg-red-950/20 text-red-400 border border-red-500/20 hover:bg-red-950/40 font-bold px-3 py-1.5 rounded text-xs transition flex items-center justify-center gap-1.5">
                    <Flag size={14} /> Mark Spam
                  </button>
                </div>
              </div>
            ))}
            {sightings.filter(s => s.status === "pending").length === 0 && (
              <div className="text-center py-10 text-slate-500 text-xs bg-slate-950/10 border border-slate-800 border-dashed rounded">
                No pending sighting reports awaiting moderator actions.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
