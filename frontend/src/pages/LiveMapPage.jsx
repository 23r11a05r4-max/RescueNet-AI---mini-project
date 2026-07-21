import { useState, useEffect, useCallback } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import { api } from "../lib/api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { 
  MapPin, Compass, Sliders, Calendar, Funnel, 
  ArrowRight, NavigationArrow, Eye, Info
} from "@phosphor-icons/react";

const DEFAULT_CENTER = [20.5937, 78.9629]; // Center of India
const statusColors = {
  open: "#3b82f6",          // Blue
  in_progress: "#f97316",   // Orange
  ai_match_found: "#a855f7",// Purple
  recovered: "#10b981",     // Emerald
  closed: "#64748b"         // Slate
};

// Map controller to smoothly pan/zoom Leaflet
function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || 13, { animate: true, duration: 1.5 });
    }
  }, [center, zoom, map]);
  return null;
}

export default function LiveMapPage() {
  const nav = useNavigate();

  // Search & Filter States
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [radius, setRadius] = useState(25); // default 25km radius

  // GPS States
  const [userCoords, setUserCoords] = useState(null);
  const [fetchingGps, setFetchingGps] = useState(false);
  const [isRadiusSearch, setIsRadiusSearch] = useState(false);

  // Demographic Filter States
  const [gender, setGender] = useState("");
  const [status, setStatus] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Map settings
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(5);
  const [viewMode, setViewMode] = useState("markers"); // "markers" or "heatmap"

  // Cases List
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch Cases from API
  const fetchMapData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        state: state || undefined,
        city: city || undefined,
        district: district || undefined,
        pin_code: pinCode || undefined,
        gender: gender || undefined,
        status: status || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined
      };

      // Handle Age Groups
      if (ageGroup === "child") {
        params.max_age = 12;
      } else if (ageGroup === "teen") {
        params.min_age = 13;
        params.max_age = 17;
      } else if (ageGroup === "adult") {
        params.min_age = 18;
      }

      // Handle GPS Radius search
      if (isRadiusSearch && userCoords) {
        params.lat = userCoords.lat;
        params.lng = userCoords.lng;
        params.radius_km = radius;
      }

      const r = await api.get("/investigations", { params });
      setCases(r.data);

      // Adjust Map Center to first match if any
      if (r.data.length > 0 && (!isRadiusSearch || !userCoords)) {
        const first = r.data[0];
        if (first.lat && first.lng) {
          setMapCenter([first.lat, first.lng]);
          setMapZoom(11);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load map data");
    } finally {
      setLoading(false);
    }
  }, [state, city, district, pinCode, gender, status, ageGroup, startDate, endDate, isRadiusSearch, userCoords, radius]);

  useEffect(() => {
    fetchMapData();
  }, [fetchMapData]);

  // Request browser GPS Coordinates
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Browser Geolocation is not supported");
      return;
    }
    setFetchingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserCoords(coords);
        setMapCenter([coords.lat, coords.lng]);
        setMapZoom(12);
        setIsRadiusSearch(true);
        setFetchingGps(false);
        toast.success("GPS Coordinates lock successfully!");
      },
      (err) => {
        console.error(err);
        setFetchingGps(false);
        toast.error("GPS access denied or timed out");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleClearLocationSearch = () => {
    setIsRadiusSearch(false);
    setUserCoords(null);
    setState("");
    setCity("");
    setDistrict("");
    setPinCode("");
    setMapCenter(DEFAULT_CENTER);
    setMapZoom(5);
  };

  const handleZoomToCase = (c) => {
    if (c.lat && c.lng) {
      setMapCenter([c.lat, c.lng]);
      setMapZoom(14);
    }
  };

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-6 font-sans text-white flex flex-col lg:flex-row gap-6 h-[calc(100vh-6.5rem)]" data-testid="live-map-root">
      
      {/* Search and Filters Sidebar */}
      <aside className="w-full lg:w-96 bg-slate-900 border border-slate-800 rounded-md p-5 flex flex-col gap-5 shrink-0 overflow-y-auto max-h-full">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-blue-400 font-bold">Location Intelligence</div>
          <h2 className="text-xl font-bold tracking-tight text-white mt-0.5">Live Incident Map</h2>
        </div>

        {/* GPS Radius Trigger */}
        <div className="space-y-2 border-b border-slate-800 pb-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Geospatial Radial Filter</div>
          <div className="flex gap-2">
            <button
              onClick={handleUseCurrentLocation}
              disabled={fetchingGps}
              className="flex-1 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-xs px-3 py-2 rounded flex items-center justify-center gap-1.5 font-bold transition"
            >
              <Compass size={14} className={fetchingGps ? "animate-spin text-blue-400" : "text-blue-400"} />
              {fetchingGps ? "Locating..." : "Use My GPS Location"}
            </button>
            {isRadiusSearch && (
              <button
                onClick={handleClearLocationSearch}
                className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs px-3 py-2 rounded font-semibold transition"
              >
                Clear
              </button>
            )}
          </div>
          {isRadiusSearch && userCoords && (
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Search Radius Limit:</span>
                <span className="font-mono text-cyan-400 font-bold">{radius} km</span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                value={radius}
                onChange={(e) => setRadius(parseInt(e.target.value))}
                className="w-full accent-blue-500 bg-slate-950 h-1.5 rounded cursor-pointer"
              />
            </div>
          )}
        </div>

        {/* Text Area Searches */}
        {!isRadiusSearch && (
          <div className="space-y-3 border-b border-slate-800 pb-4">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Location Parameter Search</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex flex-col gap-1">
                <label className="text-slate-500">State</label>
                <input
                  type="text"
                  placeholder="e.g. Maharashtra"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-white placeholder-slate-600 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-500">City</label>
                <input
                  type="text"
                  placeholder="e.g. Mumbai"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-white placeholder-slate-600 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-500">District</label>
                <input
                  type="text"
                  placeholder="e.g. Bandra"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-white placeholder-slate-600 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-500">PIN Code</label>
                <input
                  type="text"
                  placeholder="6 digits PIN"
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value)}
                  className="bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-white placeholder-slate-600 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Demographic Sub-Filters */}
        <div className="space-y-3 border-b border-slate-800 pb-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Demographic Narrowing</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex flex-col gap-1">
              <label className="text-slate-500">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="bg-slate-950 border border-slate-850 rounded p-1.5 text-white focus:outline-none cursor-pointer"
              >
                <option value="">All Cases</option>
                <option value="open">Missing</option>
                <option value="in_progress">Under Investigation</option>
                <option value="ai_match_found">AI Match Found</option>
                <option value="recovered">Recovered</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-slate-500">Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="bg-slate-950 border border-slate-850 rounded p-1.5 text-white focus:outline-none cursor-pointer"
              >
                <option value="">All Genders</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-slate-500">Age Group</label>
              <select
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value)}
                className="bg-slate-950 border border-slate-850 rounded p-1.5 text-white focus:outline-none cursor-pointer"
              >
                <option value="">All Ages</option>
                <option value="child">Child (0-12)</option>
                <option value="teen">Teen (13-17)</option>
                <option value="adult">Adult (18+)</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1 text-xs">
            <label className="text-slate-500">Date Range (Last Seen From/To)</label>
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-855 rounded p-1 text-[11px]"
              />
              <span className="text-slate-600">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-855 rounded p-1 text-[11px]"
              />
            </div>
          </div>
        </div>

        {/* Matches lists */}
        <div className="flex-1 min-h-0 flex flex-col gap-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Incident Grid ({cases.length} entries)</div>
          
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {loading ? (
              <div className="py-8 text-center text-slate-500 text-xs animate-pulse">Filtering directories…</div>
            ) : cases.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded bg-slate-950/20">
                No matching reports found
              </div>
            ) : (
              cases.map((c) => (
                <div
                  key={c.id}
                  onClick={() => handleZoomToCase(c)}
                  className="border border-slate-850 hover:border-slate-700 bg-slate-950/20 hover:bg-slate-950/50 p-3 rounded-md cursor-pointer transition flex justify-between items-center"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-xs text-white truncate">{c.person_name}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 truncate">{c.last_seen_location}</div>
                    <div className="text-[9px] font-mono text-slate-500 mt-1 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColors[c.status] || "#94a3b8" }} />
                      {c.status.replace("_", " ").toUpperCase()}
                    </div>
                  </div>
                  {c.distance_km !== undefined && (
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-cyan-400 font-bold font-mono">{c.distance_km} km</div>
                      <div className="text-[8px] uppercase tracking-wider text-slate-500 mt-0.5">distance</div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* Main Interactive Map Area */}
      <main className="flex-1 bg-slate-900 border border-slate-800 rounded-md overflow-hidden flex flex-col relative min-h-0">
        
        {/* Map view mode toggle controls overlay */}
        <div className="absolute top-4 right-4 z-40 bg-slate-950/90 border border-slate-800 rounded p-1.5 flex gap-1 shadow-2xl backdrop-blur-sm">
          <button
            onClick={() => setViewMode("markers")}
            className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition ${
              viewMode === "markers" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Incident Markers
          </button>
          <button
            onClick={() => setViewMode("heatmap")}
            className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition ${
              viewMode === "heatmap" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            hotspots Heatmap
          </button>
        </div>

        <div className="w-full h-full">
          <MapContainer center={mapCenter} zoom={mapZoom} className="w-full h-full z-10" scrollWheelZoom>
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* Map Panning and Zooming coordinator */}
            <MapController center={mapCenter} zoom={mapZoom} />

            {/* RENDER ACTIVE MARKERS */}
            {viewMode === "markers" && cases.map((c) => {
              if (!c.lat || !c.lng || c.lat === 0 || c.lng === 0) return null;
              
              const buildPointPath = {
                color: statusColors[c.status] || "#94a3b8",
                fillColor: statusColors[c.status] || "#94a3b8",
                fillOpacity: 0.85,
                weight: 1.5,
              };

              return (
                <CircleMarker
                  key={c.id}
                  center={[c.lat, c.lng]}
                  radius={8}
                  pathOptions={buildPointPath}
                >
                  <Popup className="leaflet-popup-custom font-sans text-xs">
                    <div className="p-1 space-y-2 text-slate-800 max-w-[200px]">
                      <div className="flex gap-2 items-center">
                        <img
                          src={c.photo_url || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100"}
                          alt={c.person_name}
                          className="w-10 h-10 object-cover rounded shrink-0"
                        />
                        <div className="min-w-0">
                          <h4 className="font-bold text-slate-900 truncate">{c.person_name}</h4>
                          <p className="text-[10px] text-slate-500 font-medium">Age {c.age} | {c.gender === "M" ? "Male" : "Female"}</p>
                        </div>
                      </div>

                      <div className="text-[10px] leading-relaxed">
                        <div><strong className="text-slate-600">Last Seen:</strong> {c.last_seen_location}</div>
                        <div><strong className="text-slate-600">Status:</strong> <span className="font-semibold uppercase text-[9px] tracking-wider" style={{ color: statusColors[c.status] }}>{c.status.replace("_", " ")}</span></div>
                        {c.priority_score !== undefined && (
                          <div><strong className="text-slate-600">AI Risk:</strong> <span className="font-bold text-cyan-600">{c.priority_score}% ({c.priority})</span></div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-[9px] uppercase text-center py-1.5 rounded flex items-center justify-center gap-1 transition"
                        >
                          <NavigationArrow size={10} weight="fill" /> Directions
                        </a>
                        <button
                          onClick={() => nav(`/investigations/${c.inv_id || c.id}`)}
                          className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-[9px] uppercase py-1.5 rounded flex items-center justify-center gap-1 transition"
                        >
                          <Eye size={10} /> Case File
                        </button>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}

            {/* RENDER HEATMAP OVERLAYS */}
            {viewMode === "heatmap" && cases.map((c) => {
              if (!c.lat || !c.lng || c.lat === 0 || c.lng === 0) return null;
              
              const hotspotPath = {
                color: "#ef4444",
                fillColor: "#ef4444",
                fillOpacity: 0.12,
                weight: 1,
                dashArray: "3"
              };

              return (
                <CircleMarker
                  key={`heat-${c.id}`}
                  center={[c.lat, c.lng]}
                  radius={35} // glowing radius
                  pathOptions={hotspotPath}
                />
              );
            })}
          </MapContainer>
        </div>
      </main>

    </div>
  );
}
