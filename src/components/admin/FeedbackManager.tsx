import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, CheckCircle2, Plus, Trash2, X } from 'lucide-react';
import type { Department, FacultyRecord, FeedbackRecord, FeedbackSession } from '../../types';
import { apiFetch } from '../../utils/api';
import { useToast } from '../ToastContext';

export function FeedbackManager() {
  const { showToast } = useToast();
  const [sessions, setSessions] = useState<FeedbackSession[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [faculty, setFaculty] = useState<FacultyRecord[]>([]);

  const [sessionId, setSessionId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [loading, setLoading] = useState(true);

  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [sessForm, setSessForm] = useState({
    title: '',
    academic_year: '2026-27',
    semester_type: 'Odd',
    start_date: '2026-11-01',
    end_date: '2026-12-15',
    is_active: true,
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (sessionId) params.set('sessionId', sessionId);
      if (departmentId) params.set('departmentId', departmentId);
      if (facultyId) params.set('facultyId', facultyId);

      const [sessRes, fbRes, deptRes, facRes] = await Promise.all([
        apiFetch<{ sessions: FeedbackSession[] }>('/api/admin/sessions'),
        apiFetch<{ feedback: FeedbackRecord[] }>(`/api/admin/feedback?${params.toString()}`),
        apiFetch<{ departments: Department[] }>('/api/departments/public'),
        apiFetch<{ faculty: FacultyRecord[] }>('/api/admin/faculty'),
      ]);
      setSessions(sessRes.sessions);
      setFeedback(fbRes.feedback);
      setDepartments(deptRes.departments);
      setFaculty(facRes.faculty);
    } finally {
      setLoading(false);
    }
  }, [sessionId, departmentId, facultyId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/admin/sessions', {
      method: 'POST',
      body: JSON.stringify(sessForm),
    });
    showToast('Feedback session created.', 'success');
    setSessionModalOpen(false);
    loadAll();
  };

  const handleActivateSession = async (id: number) => {
    await apiFetch(`/api/admin/sessions/${id}/activate`, { method: 'PUT' });
    showToast('Active feedback session updated.', 'success');
    loadAll();
  };

  const handleDeleteFeedback = async (id: number) => {
    await apiFetch(`/api/admin/feedback/${id}`, { method: 'DELETE' });
    showToast('Feedback record deleted.', 'info');
    loadAll();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Feedback &amp; Sessions
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Control evaluation windows and audit submitted student feedback
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSessionModalOpen(true)}
          className="flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5" />
          New Feedback Session
        </button>
      </div>

      {/* Feedback Sessions Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sessions.map((s) => (
          <div
            key={s.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-between gap-3 dark:border-slate-800 dark:bg-slate-900"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono text-slate-500">{s.academic_year} · {s.semester_type}</span>
                {s.is_active ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Active
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">Archived</span>
                )}
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1">{s.title}</h3>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 font-mono">
                <Calendar className="h-3.5 w-3.5" />
                {s.start_date} to {s.end_date}
              </p>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-mono text-slate-600 dark:text-slate-400 tabular-nums">
                {s.submission_count ?? 0} submissions
              </span>
              {!s.is_active && (
                <button
                  type="button"
                  onClick={() => handleActivateSession(s.id)}
                  className="text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
                >
                  Set Active
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Feedback Submissions Log */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Submitted Evaluations ({feedback.length})
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value="">All Sessions</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.code}</option>
              ))}
            </select>
            <select
              value={facultyId}
              onChange={(e) => setFacultyId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value="">All Faculty</option>
              {faculty.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500">
                <th className="py-2.5 pr-4">Student</th>
                <th className="py-2.5 pr-4">Faculty &amp; Subject</th>
                <th className="py-2.5 pr-4">Session</th>
                <th className="py-2.5 pr-4">Comments</th>
                <th className="py-2.5 pr-4 text-right">Overall</th>
                <th className="py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">Loading feedback records...</td>
                </tr>
              ) : feedback.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">No feedback entries match these filters.</td>
                </tr>
              ) : (
                feedback.map((fb) => (
                  <tr key={fb.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-slate-900 dark:text-white">{fb.student_name}</p>
                      <p className="text-[11px] font-mono text-slate-500">{fb.roll_no}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <p className="font-medium text-slate-800 dark:text-slate-200">{fb.faculty_name}</p>
                      <p className="text-[11px] text-slate-500">{fb.subject_code} · {fb.subject_name}</p>
                    </td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">{fb.session_title}</td>
                    <td className="py-3 pr-4 max-w-xs truncate text-slate-600 dark:text-slate-400">
                      {fb.comments || '—'}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono font-bold text-[#2563EB] tabular-nums">
                      {fb.overall_rating}.0 / 5
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteFeedback(fb.id)}
                        aria-label="Delete feedback entry"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {sessionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Create Feedback Session</h3>
              <button type="button" onClick={() => setSessionModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateSession} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Session Title</label>
                <input
                  required
                  placeholder="e.g. End-Semester Feedback — Even 2027"
                  value={sessForm.title}
                  onChange={(e) => setSessForm({ ...sessForm, title: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Academic Year</label>
                  <input
                    required
                    value={sessForm.academic_year}
                    onChange={(e) => setSessForm({ ...sessForm, academic_year: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Semester Type</label>
                  <select
                    value={sessForm.semester_type}
                    onChange={(e) => setSessForm({ ...sessForm, semester_type: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    <option value="Odd">Odd</option>
                    <option value="Even">Even</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={sessForm.start_date}
                    onChange={(e) => setSessForm({ ...sessForm, start_date: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={sessForm.end_date}
                    onChange={(e) => setSessForm({ ...sessForm, end_date: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sessForm.is_active}
                  onChange={(e) => setSessForm({ ...sessForm, is_active: e.target.checked })}
                />
                Set as currently active feedback cycle
              </label>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setSessionModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300">
                  Cancel
                </button>
                <button type="submit" className="rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700">
                  Create Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
