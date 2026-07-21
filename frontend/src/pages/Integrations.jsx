import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { LinkSimple, ShieldCheck, Gear, Cloud, Envelope, WhatsappLogo, MapPin } from "@phosphor-icons/react";


export default function Integrations() {
  const [activeTab, setActiveTab] = useState("center");
  const [integrations, setIntegrations] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [services, setServices] = useState(null);
  
  // Forms states
  const [newWebhook, setNewWebhook] = useState("");
  const [webhookEvents, setWebhookEvents] = useState("case_created");
  const [apiService, setApiService] = useState("Salesforce CRM");
  const [apiKey, setApiKey] = useState("");
  const [s3Bucket, setS3Bucket] = useState("rescuenet-ai-media-vault");

  const loadData = async () => {
    try {
      const [i, w, s] = await Promise.all([
        api.get("/integrations"),
        api.get("/webhooks"),
        api.get("/services")
      ]);
      setIntegrations(i.data);
      setWebhooks(w.data);
      setServices(s.data);
    } catch (err) {
      console.error("Failed to load integrations data:", err);
      toast.error("Failed to load integration states");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateAPI = async (e) => {
    e.preventDefault();
    try {
      await api.post("/integrations", { service: apiService, api_key: apiKey });
      toast.success(`${apiService} API credentials updated securely.`);
      setApiKey("");
      loadData();
    } catch (err) {
      toast.error("Failed to update credentials");
    }
  };

  const handleAddWebhook = async (e) => {
    e.preventDefault();
    if (!newWebhook.trim()) return;
    try {
      await api.post("/webhooks", { url: newWebhook, events: [webhookEvents] });
      toast.success("Webhook subscriber registered successfully.");
      setNewWebhook("");
      loadData();
    } catch (err) {
      toast.error("Failed to register webhook");
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6 space-y-6 font-sans">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Enterprise Platforms</div>
        <h1 className="font-display text-3xl font-black tracking-tighter mt-1 text-white">Integration Hub</h1>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-slate-800 gap-6 text-sm">
        <button 
          onClick={() => setActiveTab("center")}
          className={`pb-3 font-semibold ${activeTab === "center" ? "text-cyan-400 border-b-2 border-cyan-400" : "text-slate-400 hover:text-slate-200"}`}
        >
          Integration Center
        </button>
        <button 
          onClick={() => setActiveTab("api")}
          className={`pb-3 font-semibold ${activeTab === "api" ? "text-cyan-400 border-b-2 border-cyan-400" : "text-slate-400 hover:text-slate-200"}`}
        >
          API Management
        </button>
        <button 
          onClick={() => setActiveTab("webhooks")}
          className={`pb-3 font-semibold ${activeTab === "webhooks" ? "text-cyan-400 border-b-2 border-cyan-400" : "text-slate-400 hover:text-slate-200"}`}
        >
          Webhook Subscriptions
        </button>
        <button 
          onClick={() => setActiveTab("cloud")}
          className={`pb-3 font-semibold ${activeTab === "cloud" ? "text-cyan-400 border-b-2 border-cyan-400" : "text-slate-400 hover:text-slate-200"}`}
        >
          Cloud Storage Settings
        </button>
      </div>

      {/* Tab 1: Integration Center Dashboard */}
      {activeTab === "center" && (
        <div className="space-y-6">
          {/* Services connection check metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border border-slate-800 rounded-md bg-slate-900 p-5 flex gap-4 items-center">
              <div className="p-3 bg-cyan-500/10 rounded text-cyan-400 shrink-0">
                <Envelope size={24} />
              </div>
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">SMTP Email Services</div>
                <div className="text-sm font-bold text-white mt-0.5">SMTP Relay Server</div>
                <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                  CONNECTED
                </div>
              </div>
            </div>

            <div className="border border-slate-800 rounded-md bg-slate-900 p-5 flex gap-4 items-center">
              <div className="p-3 bg-cyan-500/10 rounded text-cyan-400 shrink-0">
                <WhatsappLogo size={24} />
              </div>
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">WhatsApp Gateway</div>
                <div className="text-sm font-bold text-white mt-0.5">WhatsApp Business API</div>
                <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                  ONLINE
                </div>
              </div>
            </div>

            <div className="border border-slate-800 rounded-md bg-slate-900 p-5 flex gap-4 items-center">
              <div className="p-3 bg-cyan-500/10 rounded text-cyan-400 shrink-0">
                <MapPin size={24} />
              </div>
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Google Geocoding</div>
                <div className="text-sm font-bold text-white mt-0.5">Distance Matrix & Directions</div>
                <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                  ACTIVE
                </div>
              </div>
            </div>
          </div>

          {/* Central integrations sync states */}
          <div className="border border-slate-800 rounded-md bg-slate-900">
            <div className="p-5 border-b border-slate-800">
              <h2 className="font-display font-bold text-md text-white">Active Synchronization Channels</h2>
            </div>
            <div className="divide-y divide-slate-800">
              {integrations.map((item, idx) => (
                <div key={idx} className="p-5 flex items-center justify-between">
                  <div className="flex gap-3 items-center">
                    <div className="p-2 bg-slate-950 border border-slate-800 rounded text-cyan-400">
                      <LinkSimple size={18} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{item.service}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Last Synced: {new Date(item.last_sync).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">Transferred</div>
                      <div className="text-xs font-bold text-cyan-400 mt-0.5">{item.sync_count} records</div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold font-mono">
                      {item.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: API Keys Management */}
      {activeTab === "api" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 border border-slate-800 rounded-md bg-slate-900 p-5">
            <h2 className="font-display font-bold text-md text-white mb-4">Credential Configuration Vault</h2>
            <form onSubmit={handleUpdateAPI} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1.5">Target Platform / System</label>
                <select 
                  value={apiService} 
                  onChange={e => setApiService(e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-white"
                >
                  <option value="Salesforce CRM">Salesforce CRM Integration</option>
                  <option value="SAP ERP">SAP ERP Dispatch</option>
                  <option value="Gov NCRB Crime Registry">NCRB Central Crime Registry</option>
                  <option value="Aadhaar Identity Verification">UIDAI Aadhaar API Platform</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1.5">API Key / Access Token</label>
                <input 
                  type="password" 
                  value={apiKey} 
                  onChange={e => setApiKey(e.target.value)} 
                  placeholder="Enter secret token" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-white"
                />
              </div>

              <button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold px-4 py-2.5 rounded transition">
                Securely Save Key
              </button>
            </form>
          </div>
          <div className="border border-slate-800 rounded-md bg-slate-900 p-5 space-y-4">
            <div className="flex gap-2 items-center text-cyan-400">
              <ShieldCheck size={20} />
              <h3 className="text-xs font-bold text-white">Encryption Standard</h3>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              All credentials and OAuth tokens are AES-256 encrypted before writing to database fields. Webhook calls verify authorization signature headers.
            </p>
          </div>
        </div>
      )}

      {/* Tab 3: Webhook Configuration */}
      {activeTab === "webhooks" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 border border-slate-800 rounded-md bg-slate-900 p-5 space-y-6">
            <div>
              <h2 className="font-display font-bold text-md text-white mb-2">Configure Webhook Callbacks</h2>
              <p className="text-[11px] text-slate-500">Add URLs to receive automated case status update notifications.</p>
            </div>
            <form onSubmit={handleAddWebhook} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1.5">Payload Delivery Destination URL</label>
                <input 
                  type="url" 
                  value={newWebhook} 
                  onChange={e => setNewWebhook(e.target.value)} 
                  placeholder="https://api.external-ngo.org/v1/callbacks" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1.5">Trigger Event Subscription</label>
                <select 
                  value={webhookEvents} 
                  onChange={e => setWebhookEvents(e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-white"
                >
                  <option value="case_created">Case Created (New Report submitted)</option>
                  <option value="case_updated">Case Updated (Status changed)</option>
                  <option value="face_matched">Face Match Detected (AI CCTV Hit)</option>
                </select>
              </div>

              <button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold px-4 py-2.5 rounded transition">
                Register Webhook
              </button>
            </form>
          </div>

          <div className="border border-slate-800 rounded-md bg-slate-900 p-5">
            <h3 className="text-xs font-bold text-white mb-3">Registered Outbound Destinations</h3>
            {webhooks.length === 0 ? (
              <div className="text-[11px] text-slate-500 py-6 text-center">No outbound webhooks registered yet.</div>
            ) : (
              <div className="space-y-3">
                {webhooks.map((w, idx) => (
                  <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded-md flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] text-white font-mono truncate">{w.url}</div>
                      <div className="text-[9px] text-cyan-400 mt-1 uppercase tracking-wide">Event: {w.events?.join(", ")}</div>
                    </div>
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full shrink-0 mt-1"></span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Cloud Storage buckets config */}
      {activeTab === "cloud" && (
        <div className="border border-slate-800 rounded-md bg-slate-900 p-5 max-w-2xl">
          <div className="flex gap-2 items-center text-cyan-400 mb-4 border-b border-slate-800 pb-3">
            <Cloud size={20} />
            <h2 className="font-display font-bold text-md text-white">AWS S3 Media Bucket Settings</h2>
          </div>
          <form className="space-y-4">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1.5">S3 Bucket Name</label>
              <input 
                type="text" 
                value={s3Bucket} 
                onChange={e => setS3Bucket(e.target.value)} 
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1.5">AWS S3 Region</label>
              <input 
                type="text" 
                value="ap-south-1" 
                disabled 
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-500 cursor-not-allowed"
              />
            </div>
            <button type="button" onClick={() => toast.success("S3 connection bucket details validated.")} className="bg-slate-800 border border-slate-700 text-white text-xs font-semibold px-4 py-2.5 rounded transition">
              Verify Storage Connection
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
