import { useEffect, useState } from 'react';
import type { AuthUser } from './types';
import { apiFetch, clearAuthToken } from './utils/api';
import { ToastProvider, useToast } from './components/ToastContext';
import { LoginPage } from './components/LoginPage';
import { AdminPortal } from './components/admin/AdminPortal';
import { StudentPortal } from './components/student/StudentPortal';
import { FacultyPortal } from './components/faculty/FacultyPortal';
import { ProfileSettingsModal } from './components/ProfileSettingsModal';

function AppContent() {
  const { showToast } = useToast();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    apiFetch<{ user: AuthUser }>('/api/auth/me')
      .then((res) => setUser(res.user))
      .catch(() => {
        clearAuthToken();
        setUser(null);
      })
      .finally(() => setCheckingAuth(false));
  }, []);

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      clearAuthToken();
      setUser(null);
      showToast('Logged out.', 'info');
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-white text-black p-8 text-sm">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLoginSuccess={setUser} />;
  }

  return (
    <>
      {user.role === 'student' && (
        <StudentPortal user={user} onLogout={handleLogout} />
      )}
      {user.role === 'admin' && (
        <AdminPortal
          user={user}
          onLogout={handleLogout}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}
      {user.role === 'faculty' && (
        <FacultyPortal
          user={user}
          onLogout={handleLogout}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      {settingsOpen && (
        <ProfileSettingsModal
          user={user}
          onClose={() => setSettingsOpen(false)}
          onUserUpdated={setUser}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
