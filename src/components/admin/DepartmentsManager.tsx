import React, { useCallback, useEffect, useState } from 'react';
import { Building2, Edit2, Plus, Trash2, UserPlus, X } from 'lucide-react';
import type { Department, FacultyRecord, StudentRecord } from '../../types';
import { apiFetch } from '../../utils/api';
import { useToast } from '../ToastContext';

export function DepartmentsManager() {
  const { showToast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allFaculty, setAllFaculty] = useState<FacultyRecord[]>([]);
  const [allStudents, setAllStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState({ code: '', name: '', hod_name: '' });
  const [saving, setSaving] = useState(false);

  const [assignDept, setAssignDept] = useState<Department | null>(null);
  const [selectedFacultyIds, setSelectedFacultyIds] = useState<number[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dRes, fRes, sRes] = await Promise.all([
        apiFetch<{ departments: Department[] }>('/api/admin/departments'),
        apiFetch<{ faculty: FacultyRecord[] }>('/api/admin/faculty'),
        apiFetch<{ students: StudentRecord[] }>('/api/admin/students?page=1&limit=100'),
      ]);
      setDepartments(dRes.departments);
      setAllFaculty(fRes.faculty);
      setAllStudents(sRes.students);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openAdd = () => {
    setEditing(null);
    setForm({ code: '', name: '', hod_name: '' });
    setModalOpen(true);
  };

  const openEdit = (d: Department) => {
    setEditing(d);
    setForm({ code: d.code, name: d.name, hod_name: d.hod_name || '' });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await apiFetch(`/api/admin/departments/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
        showToast('Department updated.', 'success');
      } else {
        await apiFetch('/api/admin/departments', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        showToast('Department created.', 'success');
      }
      setModalOpen(false);
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Save failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (d: Department) => {
    try {
      await apiFetch(`/api/admin/departments/${d.id}`, { method: 'DELETE' });
      showToast(`Deleted department ${d.code}.`, 'info');
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Cannot delete department.', 'error');
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignDept) return;
    await apiFetch(`/api/admin/departments/${assignDept.id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ faculty_ids: selectedFacultyIds, student_ids: selectedStudentIds }),
    });
    showToast(`Updated assignments for ${assignDept.code}.`, 'success');
    setAssignDept(null);
    setSelectedFacultyIds([]);
    setSelectedStudentIds([]);
    loadData();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Departments Module
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Create academic departments and allocate faculty and student cohorts
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Department
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-2xl bg-slate-200/70 animate-pulse dark:bg-slate-800" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((d) => (
            <div
              key={d.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-between gap-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0 dark:bg-blue-950/50">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-mono font-bold text-[#2563EB]">{d.code}</p>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">{d.name}</h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(d)}
                      aria-label={`Edit ${d.name}`}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[#2563EB] dark:hover:bg-slate-800"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(d)}
                      aria-label={`Delete ${d.name}`}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                  Head of Dept: <span className="font-medium text-slate-700 dark:text-slate-200">{d.hod_name || 'Unassigned'}</span>
                </p>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-slate-500">Students</p>
                    <p className="font-bold font-mono text-slate-900 dark:text-white tabular-nums">{d.student_count}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Faculty</p>
                    <p className="font-bold font-mono text-slate-900 dark:text-white tabular-nums">{d.faculty_count}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Avg Score</p>
                    <p className="font-bold font-mono text-[#2563EB] tabular-nums">{Number(d.avg_rating || 0).toFixed(2)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAssignDept(d);
                    setSelectedFacultyIds([]);
                    setSelectedStudentIds([]);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Assign Faculty &amp; Students
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editing ? 'Edit Department' : 'Add Department'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Department Code</label>
                <input
                  required
                  placeholder="e.g. CSE-AIML"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Department Name</label>
                <input
                  required
                  placeholder="e.g. Computer Science & Engineering"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Head of Department</label>
                <input
                  placeholder="Dr. ..."
                  value={form.hod_name}
                  onChange={(e) => setForm({ ...form, hod_name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700">
                  {saving ? 'Saving...' : 'Save Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Faculty / Students Modal */}
      {assignDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl my-8 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Assign Members to {assignDept.code}
                </h3>
                <p className="text-xs text-slate-500">{assignDept.name}</p>
              </div>
              <button type="button" onClick={() => setAssignDept(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Transfer Faculty</p>
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 p-2.5 space-y-1.5 dark:border-slate-700">
                    {allFaculty.map((f) => (
                      <label key={f.id} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedFacultyIds.includes(f.id)}
                          onChange={() =>
                            setSelectedFacultyIds((prev) =>
                              prev.includes(f.id) ? prev.filter((id) => id !== f.id) : [...prev, f.id]
                            )
                          }
                        />
                        <span className="truncate">{f.name} ({f.department_code})</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Transfer Students</p>
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 p-2.5 space-y-1.5 dark:border-slate-700">
                    {allStudents.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.includes(s.id)}
                          onChange={() =>
                            setSelectedStudentIds((prev) =>
                              prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                            )
                          }
                        />
                        <span className="truncate">{s.name} ({s.department_code})</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setAssignDept(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300">
                  Cancel
                </button>
                <button type="submit" className="rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700">
                  Apply Assignments
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
