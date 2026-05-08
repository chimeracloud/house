import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import PendingApproval from './pages/PendingApproval';
import Dashboard from './pages/Dashboard';
import Tickets from './pages/Tickets';
import TicketDetail from './pages/TicketDetail';
import Quotes from './pages/Quotes';
import Contractors from './pages/Contractors';
import Payments from './pages/Payments';
import Reports from './pages/Reports';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';
import Documents from './pages/Documents';
import Approvals from './pages/admin/Approvals';

function FullScreenSpinner() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function RequireAuth({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const loading = useAuthStore((s) => s.loading);
  const isApproved = useAuthStore((s) => s.isApproved);
  if (loading) return <FullScreenSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isApproved) return <Navigate to="/pending-approval" replace />;
  return children;
}

function RequireGuest({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const loading = useAuthStore((s) => s.loading);
  const isApproved = useAuthStore((s) => s.isApproved);
  if (loading) return null;
  if (isAuthenticated) {
    if (!isApproved) return <Navigate to="/pending-approval" replace />;
    return <Navigate to="/" replace />;
  }
  return children;
}

function RequirePending({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const loading = useAuthStore((s) => s.loading);
  const isApproved = useAuthStore((s) => s.isApproved);
  if (loading) return <FullScreenSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isApproved) return <Navigate to="/" replace />;
  return children;
}

function RequireStaff({ children }) {
  const isStaff = useAuthStore((s) => s.isStaff);
  if (!isStaff) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const initAuth = useAuthStore((s) => s.initAuth);

  useEffect(() => {
    const unsubscribe = initAuth();
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, [initAuth]);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <RequireGuest>
              <Login />
            </RequireGuest>
          }
        />
        <Route
          path="/pending-approval"
          element={
            <RequirePending>
              <PendingApproval />
            </RequirePending>
          }
        />
        <Route
          path="/"
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="tickets" element={<Tickets />} />
          <Route path="tickets/:id" element={<TicketDetail />} />
          <Route path="quotes" element={<Quotes />} />
          <Route path="contractors" element={<Contractors />} />
          <Route path="payments" element={<Payments />} />
          <Route path="reports" element={<Reports />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="documents" element={<Documents />} />
          <Route path="settings" element={<Settings />} />
          <Route path="admin/approvals" element={<RequireStaff><Approvals /></RequireStaff>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
