import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Toaster } from "sonner";
import { lazy, Suspense } from "react";
import Layout from "./components/Layout";

// Lazy-loaded pages
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Investigations = lazy(() => import("./pages/Investigations"));
const InvestigationDetail = lazy(() => import("./pages/InvestigationDetail"));
const Reports = lazy(() => import("./pages/Reports"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));
const Integrations = lazy(() => import("./pages/Integrations"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase"));
const VoiceHistory = lazy(() => import("./pages/VoiceHistory"));
const LiveMapPage = lazy(() => import("./pages/LiveMapPage"));
const CommunityPortal = lazy(() => import("./pages/CommunityPortal"));
const PublicCaseView = lazy(() => import("./pages/PublicCaseView"));

function Protected({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="p-8 text-slate-500 text-sm">Loading security profiles...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  
  return <Layout>{children}</Layout>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster theme="dark" position="top-right" richColors closeButton />
        <Suspense fallback={
          <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-3 font-sans">
            <div className="w-8 h-8 rounded-full border-4 border-slate-800 border-t-blue-500 animate-spin" />
            <div className="text-xs text-slate-500 font-medium">Loading Sentinel Command space...</div>
          </div>
        }>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<Protected><Dashboard /></Protected>} />
            <Route path="/investigations" element={<Protected><Investigations /></Protected>} />
            <Route path="/investigations/:id" element={<Protected><InvestigationDetail /></Protected>} />
            
            {/* Protected Route Segments */}
            <Route path="/reports" element={<Protected allowedRoles={["admin", "police"]}><Reports /></Protected>} />
            <Route path="/admin/panel" element={<Protected allowedRoles={["admin"]}><AdminPanel /></Protected>} />
            <Route path="/admin/users" element={<Protected allowedRoles={["admin"]}><UserManagement /></Protected>} />
            <Route path="/admin/audit-logs" element={<Protected allowedRoles={["admin"]}><AuditLogs /></Protected>} />
            <Route path="/admin/integrations" element={<Protected allowedRoles={["admin"]}><Integrations /></Protected>} />
            <Route path="/admin/knowledge-base" element={<Protected allowedRoles={["admin", "police"]}><KnowledgeBase /></Protected>} />
            <Route path="/maps" element={<Protected><LiveMapPage /></Protected>} />
            <Route path="/community" element={<Protected><CommunityPortal /></Protected>} />
            <Route path="/public-case/:id" element={<PublicCaseView />} />
            <Route path="/voice-history" element={<Protected><VoiceHistory /></Protected>} />
            
            {/* Fallback segment */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
export default App;
