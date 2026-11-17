import React, { useCallback, useEffect, useState } from 'react';
import { Edit2, Plus, Trash2, X } from 'lucide-react';
import type { Department, FacultyRecord, SubjectRecord } from '../../types';
import { apiFetch } from '../../utils/api';
import { useToast } from '../ToastContext';

export function SubjectsManager() {
  const { showToast } = useToast();
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [faculty, setFaculty] = useState<FacultyRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SubjectRecord | null>(null);
  const [form, setForm] = useState({
    code: '',
    name: '',
    department_id: '',
    faculty_id: '',
    semester: '6',
    credits: '4',
  });
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [subRes, deptRes, facRes] = await Promise.all([
        apiFetch<{ subjects: SubjectRecord[] }>('/api/admin/subjects'),
        apiFetch<{ departments: Department[] }>('/api/departments/public'),
        apiFetch<{ faculty: FacultyRecord[] }>('/api/admin/faculty'),
      ]);
      setSubjects(subRes.subjects);
      setDepartments(deptRes.departments);
      setFaculty(facRes.faculty);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const openAdd = () => {
    setEditing(null);
    setForm({
      code: '',
      name: '',
      department_id: departments[0]?.id ? String(departments[0].id) : '',
      faculty_id: '',
      semester: '6',
      credits: '4',
    });
    setModalOpen(true);
  };

  const openEdit = (sub: SubjectRecord) => {
    setEditing(sub);
    setForm({
      code: sub.code,
      name: sub.name,
      department_id: String(sub.department_id),
      faculty_id: sub.faculty_id ? String(sub.faculty_id) : '',
      semester: String(sub.semester),
      credits: String(sub.credits),
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        code: form.code,
        name: form.name,
        department_id: Number(form.department_id),
        faculty_id: form.faculty_id ? Number(form.faculty_id) : null,
        semester: Number(form.semester),
        credits: Number(form.credits),
      };
      if (editing) {
        await apiFetch(`/api/admin/subjects/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast('Subject updated.', 'success');
      } else {
        await apiFetch('/api/admin/subjects', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('Subject created.', 'success');
      }
      setModalOpen(false);
      loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Save failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sub: SubjectRecord) => {
    await apiFetch(`/api/admin/subjects/${sub.id}`, { method: 'DELETE' });
    showToast(`Deleted subject ${sub.code}.`, 'info');
    loadAll();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Subjects Module
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage curriculum courses, semester mapping, and faculty instructors
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Subject
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500">
                <th className="py-2.5 pr-4">Code</th>
                <th className="py-2.5 pr-4">Subject Title</th>
                <th className="py-2.5 pr-4">Department</th>
                <th className="py-2.5 pr-4">Assigned Faculty</th>
                <th className="py-2.5 pr-4 text-right">Semester</th>
                <th className="py-2.5 pr-4 text-right">Credits</th>
                <th className="py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">Loading subjects...</td>
                </tr>
              ) : subjects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">No subjects configured.</td>
                </tr>
              ) : (
                subjects.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3 pr-4 font-mono text-slate-600 dark:text-slate-400">{sub.code}</td>
                    <td className="py-3 pr-4 font-semibold text-slate-900 dark:text-white">{sub.name}</td>
                    <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">{sub.department_code}</td>
                    <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">
                      {sub.faculty_name || <span className="text-amber-600 font-medium">Unassigned</span>}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums">Sem {sub.semester}</td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums">{sub.credits}</td>
                    <td className="py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(sub)}
                          aria-label={`Edit ${sub.name}`}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#2563EB] dark:hover:bg-slate-800"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(sub)}
                          aria-label={`Delete ${sub.name}`}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editing ? 'Edit Subject' : 'Add Subject'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Subject Code</label>
                  <input
                    required
                    placeholder="e.g. CS3605"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Credits</label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={form.credits}
                    onChange={(e) => setForm({ ...form, credits: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Subject Name</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Department</label>
                  <select
                    value={form.department_id}
                    onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.code}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Semester</label>
                  <select
                    value={form.semester}
                    onChange={(e) => setForm({ ...form, semester: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s}>Semester {s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Assign Faculty</label>
                <select
                  value={form.faculty_id}
                  onChange={(e) => setForm({ ...form, faculty_id: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                >
                  <option value="">-- Unassigned --</option>
                  {faculty.map((f) => (
                    <option key={f.id} value={f.id}>{f.name} ({f.department_code})</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700">
                  {saving ? 'Saving...' : 'Save Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
