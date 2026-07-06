import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { MapPin } from "@phosphor-icons/react";

const priorityColor = { Critical: "#ef4444", High: "#f97316", Medium: "#f59e0b", Low: "#64748b" };
const statusColor = { open: "#3b82f6", in_progress: "#f59e0b", recovered: "#10b981", closed: "#64748b" };

export default function GeoMap({ data }) {
  if (!data) return <div className="border border-slate-800 rounded-md bg-slate-900 p-6 text-xs text-slate-500 h-96">Loading map…</div>;

  const points = data.points || [];
  const center = points.length ? [points[0].lat, points[0].lng] : [20.5937, 78.9629];

  return (
    <div className="border border-slate-800 rounded-md bg-slate-900 overflow-hidden" data-testid="geo-map">
      <div className="flex items-start justify-between px-4 py-3 border-b border-slate-800">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Geographic crime analysis</div>
          <h2 className="font-display font-bold text-lg mt-0.5 flex items-center gap-2"><MapPin size={16} className="text-blue-400" weight="fill" /> Missing person hotspots</h2>
        </div>
        <div className="flex flex-wrap gap-3 text-[10px]">
          {Object.entries(statusColor).map(([k,v]) => (
            <div key={k} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: v }} />
              <span className="uppercase tracking-wider text-slate-400">{k.replace("_"," ")}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4">
        <div className="lg:col-span-3 h-96 relative">
          <MapContainer center={center} zoom={5} className="w-full h-full" scrollWheelZoom>
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {points.map(p => (
              <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={7}
                pathOptions={{ color: statusColor[p.status]||"#94a3b8", fillColor: priorityColor[p.priority]||"#94a3b8", fillOpacity: 0.7, weight: 2 }}>
                <Popup>
                  <div className="text-xs font-medium">{p.name}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">{p.status} · {p.priority}</div>
                </Popup>
              </CircleMarker>
            ))}
            {data.hotspots?.slice(0, 6).map((h, i) => (
              <CircleMarker key={`h${i}`} center={[h.lat, h.lng]} radius={Math.min(30, 10 + h.count * 4)}
                pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.15, weight: 1, dashArray: "4" }} />
            ))}
          </MapContainer>
        </div>
        <div className="border-t lg:border-t-0 lg:border-l border-slate-800 max-h-96 overflow-y-auto" data-testid="hotspot-list">
          <div className="px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-slate-500 border-b border-slate-800 sticky top-0 bg-slate-900">Top hotspots</div>
          {data.hotspots?.slice(0, 8).map((h, i) => (
            <div key={i} data-testid={`hotspot-${i}`} className="px-4 py-3 border-b border-slate-800 last:border-b-0">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-white truncate">{h.district}</div>
                <div className="font-mono text-xs text-red-400 font-bold">{h.count}</div>
              </div>
              <div className="text-[10px] text-slate-500 truncate mt-0.5">{h.location}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
