import React, { useCallback, useEffect, useState } from 'react';
import { Download, Edit2, Plus, Search, Trash2, X } from 'lucide-react';
import type { Department, FacultyRecord, SubjectRecord } from '../../types';
import { apiFetch } from '../../utils/api';
import { exportToExcel } from '../../utils/exportUtils';
import { useToast } from '../ToastContext';

export function FacultyManager() {
  const { showToast } = useToast();
  const [faculty, setFaculty] = useState<FacultyRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FacultyRecord | null>(null);
  const [form, setForm] = useState({
    employee_id: '',
    name: '',
    email: '',
    department_id: '',
    designation: 'Assistant Professor',
    qualification: 'Ph.D.',
    status: 'Active',
    password: '',
    subject_ids: [] as number[],
  });
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (departmentId) params.set('departmentId', departmentId);
      const [facRes, deptRes, subRes] = await Promise.all([
        apiFetch<{ faculty: FacultyRecord[] }>(`/api/admin/faculty?${params.toString()}`),
        apiFetch<{ departments: Department[] }>('/api/departments/public'),
        apiFetch<{ subjects: SubjectRecord[] }>('/api/admin/subjects'),
      ]);
      setFaculty(facRes.faculty);
      setDepartments(deptRes.departments);
      setSubjects(subRes.subjects);
    } finally {
      setLoading(false);
    }
  }, [search, departmentId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const openAdd = () => {
    setEditing(null);
    setForm({
      employee_id: '',
      name: '',
      email: '',
      department_id: departments[0]?.id ? String(departments[0].id) : '',
      designation: 'Assistant Professor',
      qualification: 'Ph.D.',
      status: 'Active',
      password: '',
      subject_ids: [],
    });
    setModalOpen(true);
  };

  const openEdit = (f: FacultyRecord) => {
    setEditing(f);
    const assignedIds = subjects.filter((s) => s.faculty_id === f.id).map((s) => s.id);
    setForm({
      employee_id: f.employee_id,
      name: f.name,
      email: f.email,
      department_id: String(f.department_id),
      designation: f.designation,
      qualification: f.qualification,
      status: f.status,
      password: '',
      subject_ids: assignedIds,
    });
    setModalOpen(true);
  };

  const toggleSubject = (sid: number) => {
    setForm((prev) => ({
      ...prev,
      subject_ids: prev.subject_ids.includes(sid)
        ? prev.subject_ids.filter((id) => id !== sid)
        : [...prev.subject_ids, sid],
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        department_id: Number(form.department_id),
      };
      if (editing) {
        await apiFetch(`/api/admin/faculty/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast('Faculty record updated.', 'success');
      } else {
        await apiFetch('/api/admin/faculty', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('New faculty member added.', 'success');
      }
      setModalOpen(false);
      loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Save failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (f: FacultyRecord) => {
    await apiFetch(`/api/admin/faculty/${f.id}`, { method: 'DELETE' });
    showToast(`Deleted ${f.name}.`, 'info');
    loadAll();
  };

  const handleExport = () => {
    exportToExcel(
      'Faculty_Directory.xlsx',
      'Faculty',
      faculty.map((f) => ({
        'Employee ID': f.employee_id,
        Name: f.name,
        Email: f.email,
        Department: f.department_code,
        Designation: f.designation,
        Qualification: f.qualification,
        'Assigned Subjects': f.assigned_subjects || 'None',
        'Avg Rating': f.avg_rating || 0,
        Responses: f.feedback_count || 0,
      }))
    );
    showToast('Exported faculty directory.', 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Faculty Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage faculty profiles, department assignments, and course allocations
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Export Data
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Faculty
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search faculty by name, ID, or email..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500">
                <th className="py-2.5 pr-4">ID</th>
                <th className="py-2.5 pr-4">Faculty Member</th>
                <th className="py-2.5 pr-4">Department</th>
                <th className="py-2.5 pr-4">Assigned Subjects</th>
                <th className="py-2.5 pr-4 text-right">Avg Rating</th>
                <th className="py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">Loading faculty list...</td>
                </tr>
              ) : faculty.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">No faculty members found.</td>
                </tr>
              ) : (
                faculty.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3 pr-4 font-mono text-slate-600 dark:text-slate-400">{f.employee_id}</td>
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-slate-900 dark:text-white">{f.name}</p>
                      <p className="text-[11px] text-slate-500">{f.designation} · {f.email}</p>
                    </td>
                    <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">{f.department_code}</td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                      {f.assigned_subjects || 'Unassigned'}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono font-bold text-[#2563EB] tabular-nums">
                      {f.avg_rating ? `${Number(f.avg_rating).toFixed(2)} / 5` : '—'}
                    </td>
                    <td className="py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(f)}
                          aria-label={`Edit ${f.name}`}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#2563EB] dark:hover:bg-slate-800"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(f)}
                          aria-label={`Delete ${f.name}`}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl my-8 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editing ? 'Edit Faculty & Subject Assignment' : 'Add New Faculty Member'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Employee ID</label>
                  <input
                    required
                    value={form.employee_id}
                    onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Department</label>
                  <select
                    value={form.department_id}
                    onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Designation</label>
                  <input
                    value={form.designation}
                    onChange={(e) => setForm({ ...form, designation: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Qualification</label>
                  <input
                    value={form.qualification}
                    onChange={(e) => setForm({ ...form, qualification: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Assign Subjects
                </label>
                <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 p-2.5 space-y-1.5 dark:border-slate-700">
                  {subjects.map((sub) => (
                    <label key={sub.id} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.subject_ids.includes(sub.id)}
                        onChange={() => toggleSubject(sub.id)}
                        className="rounded border-slate-300 text-[#2563EB]"
                      />
                      <span className="font-mono text-[11px] text-slate-500">{sub.code}</span>
                      <span className="truncate">{sub.name} (Sem {sub.semester})</span>
                    </label>
                  ))}
                </div>
              </div>

              {!editing && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Initial Password (defaults to Faculty@123)
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700">
                  {saving ? 'Saving...' : 'Save Faculty'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
