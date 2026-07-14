import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/layout/Sidebar';
import LoginPage from './pages/auth/LoginPage';
import HomePage from './pages/HomePage';
import LeavePage from './pages/leave/LeavePage';
import TaskListPage from './pages/tasks/TaskListPage';
import TaskDetailPage from './pages/tasks/TaskDetailPage';
import ExpensePage from './pages/expense/ExpensePage';
import DirectoryPage from './pages/directory/DirectoryPage';
import ApprovalsPage from './pages/ApprovalsPage';
import DocumentsPage from './pages/documents/DocumentsPage';
import PayslipsPage from './pages/payslips/PayslipsPage';
import MyAssetsPage from './pages/assets/MyAssetsPage';
import AssetManagementPage from './pages/assets/AssetManagementPage';
import InventoryPage from './pages/inventory/InventoryPage';
import StorekeeperPage from './pages/inventory/StorekeeperPage';
import UsersPage from './pages/admin/UsersPage';
import BroadcastsPage from './pages/admin/BroadcastsPage';
import PushNotificationBanner from './components/PushNotificationBanner';
import NotificationBell from './components/NotificationBell';
import { onForegroundMessage } from './services/firebase';
import './index.css';

function ProtectedLayout() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)' }}>
      Loading…
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="app-layout">
      <Sidebar />
      <NotificationBell className="desktop-notif-bell" />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

function ManagerRoute() {
  const { user } = useAuth();
  if (!['manager', 'admin'].includes(user?.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}

function StorekeeperRoute() {
  const { user } = useAuth();
  if (!['storekeeper', 'admin'].includes(user?.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}

function AdminRoute() {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return <Outlet />;
}

function PublicRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/leave" element={<LeavePage />} />
        <Route path="/tasks" element={<TaskListPage />} />
        <Route path="/tasks/:id" element={<TaskDetailPage />} />
        <Route path="/expenses" element={<ExpensePage />} />
        <Route path="/directory" element={<DirectoryPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/payslips" element={<PayslipsPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/my-assets" element={<MyAssetsPage />} />
        <Route element={<ManagerRoute />}>
          <Route path="/manager/approvals" element={<ApprovalsPage />} />
        </Route>
        <Route element={<StorekeeperRoute />}>
          <Route path="/storekeeper" element={<StorekeeperPage />} />
          <Route path="/storekeeper/assets" element={<AssetManagementPage />} />
        </Route>
        <Route element={<AdminRoute />}>
          <Route path="/admin/users" element={<UsersPage />} />
          <Route path="/admin/broadcasts" element={<BroadcastsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  const [pushNotification, setPushNotification] = useState(null);

  useEffect(() => {
    // Listen for foreground push messages and show the banner
    let unsubscribe;
    onForegroundMessage((payload) => {
      setPushNotification({
        title: payload.notification?.title || 'TEDLinx Intranet',
        body: payload.notification?.body || '',
        type: payload.data?.type || 'default',
        url: payload.data?.url || '/',
      });
    }).then(fn => { unsubscribe = fn; });

    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: { fontSize: 14, borderRadius: 10, fontFamily: 'inherit' },
            success: { iconTheme: { primary: '#2AACBB', secondary: '#fff' } },
          }}
        />
        <PushNotificationBanner
          notification={pushNotification}
          onDismiss={() => setPushNotification(null)}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}