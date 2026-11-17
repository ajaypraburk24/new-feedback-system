import { useEffect, useState } from 'react';
import { Database, Download, KeyRound, Shield } from 'lucide-react';
import { apiFetch, getAuthToken } from '../../utils/api';

interface LoginHistoryRow {
  id: number;
  user_id: number;
  user_role: string;
  user_email: string;
  ip_address: string;
  status: string;
  created_at: string;
}

export function AdminSettings({ onOpenProfileModal }: { onOpenProfileModal: () => void }) {
  const [history, setHistory] = useState<LoginHistoryRow[]>([]);

  useEffect(() => {
    apiFetch<{ history: LoginHistoryRow[] }>('/api/admin/login-history')
      .then((res) => setHistory(res.history))
      .catch(() => {});
  }, []);

  const handleDownloadSql = async () => {
    const token = getAuthToken();
    const res = await fetch('/api/system/sql-schema', {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return;
    const text = await res.text();
    const blob = new Blob([text], { type: 'application/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'TeachersFeedbackSystem.sql';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          System Settings &amp; Security
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Manage administrator credentials, audit login history, and export relational SQL schema
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center gap-2.5">
            <KeyRound className="h-5 w-5 text-[#2563EB]" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Account &amp; Password Management
            </h2>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Update your administrator profile title, display name, or rotate your bcrypt-encrypted portal password.
          </p>
          <button
            type="button"
            onClick={onOpenProfileModal}
            className="rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
          >
            Open Profile &amp; Password Settings
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center gap-2.5">
            <Database className="h-5 w-5 text-[#2563EB]" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Relational Database Schema Export
            </h2>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Download the normalized MySQL DDL script (`TeachersFeedbackSystem.sql`) containing all 9 relational tables (`Admin`, `Students`, `Faculty`, `Departments`, `Subjects`, `Feedback`, `FeedbackSession`, `LoginHistory`, `Notifications`) with foreign keys.
          </p>
          <button
            type="button"
            onClick={handleDownloadSql}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Download database.sql
          </button>
        </div>
      </div>

      {/* Login History Audit */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-4 w-4 text-[#2563EB]" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Authentication Audit Log (LoginHistory)
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500">
                <th className="py-2.5 pr-4">Timestamp</th>
                <th className="py-2.5 pr-4">Email / Identifier</th>
                <th className="py-2.5 pr-4">Role</th>
                <th className="py-2.5 pr-4">IP Address</th>
                <th className="py-2.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {history.map((row) => (
                <tr key={row.id}>
                  <td className="py-2.5 pr-4 font-mono text-slate-500 tabular-nums">{row.created_at}</td>
                  <td className="py-2.5 pr-4 font-medium text-slate-800 dark:text-slate-200">{row.user_email}</td>
                  <td className="py-2.5 pr-4 capitalize text-slate-600 dark:text-slate-400">{row.user_role}</td>
                  <td className="py-2.5 pr-4 font-mono text-slate-500">{row.ip_address}</td>
                  <td className="py-2.5 text-right">
                    <span
                      className={`font-semibold ${
                        row.status === 'Success'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
