import { useState } from 'react';
import type { AuthUser } from '../../types';
import { AdminOverview } from './AdminOverview';
import { StudentsManager } from './StudentsManager';
import { FacultyManager } from './FacultyManager';
import { DepartmentsManager } from './DepartmentsManager';
import { SubjectsManager } from './SubjectsManager';
import { FeedbackManager } from './FeedbackManager';
import { ReportsModule } from './ReportsModule';
import { AdminSettings } from './AdminSettings';

interface AdminPortalProps {
  user: AuthUser;
  onLogout: () => void;
  onOpenSettings: () => void;
}

const ADMIN_TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'students', label: 'Students' },
  { id: 'faculty', label: 'Faculty' },
  { id: 'departments', label: 'Departments' },
  { id: 'subjects', label: 'Subjects' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'reports', label: 'Reports' },
  { id: 'settings', label: 'Settings' },
];

export function AdminPortal({ user, onLogout, onOpenSettings }: AdminPortalProps) {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="min-h-screen bg-white text-black px-4 py-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="border-b-2 border-black pb-3 space-y-2 no-print">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold">Student Feedback System — Admin Panel</h1>
              <p className="text-xs text-gray-700">
                Logged in as: <strong>{user.name}</strong> ({user.email})
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <button type="button" onClick={onOpenSettings} className="underline cursor-pointer">
                Profile / Password
              </button>
              <span>|</span>
              <button type="button" onClick={onLogout} className="text-red-700 underline font-bold cursor-pointer">
                Logout
              </button>
            </div>
          </div>

          <nav className="flex flex-wrap gap-2 pt-1 text-xs">
            {ADMIN_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`border px-3 py-1 cursor-pointer ${
                  activeTab === t.id
                    ? 'border-black bg-gray-200 font-bold'
                    : 'border-gray-400 bg-white hover:bg-gray-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </header>

        <main>
          {activeTab === 'dashboard' && <AdminOverview onNavigate={setActiveTab} />}
          {activeTab === 'students' && <StudentsManager />}
          {activeTab === 'faculty' && <FacultyManager />}
          {activeTab === 'departments' && <DepartmentsManager />}
          {activeTab === 'subjects' && <SubjectsManager />}
          {activeTab === 'feedback' && <FeedbackManager />}
          {activeTab === 'reports' && <ReportsModule />}
          {activeTab === 'settings' && <AdminSettings onOpenProfileModal={onOpenSettings} />}
        </main>
      </div>
    </div>
  );
}
