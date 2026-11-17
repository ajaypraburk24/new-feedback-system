import { useCallback, useEffect, useState } from 'react';
import { FileSpreadsheet, FileText, Printer, Table2 } from 'lucide-react';
import type { Department, FeedbackSession } from '../../types';
import { apiFetch } from '../../utils/api';
import { exportToCSV, exportToExcel, exportToPDF } from '../../utils/exportUtils';
import { useToast } from '../ToastContext';

type ReportType = 'faculty' | 'department' | 'semester' | 'subject' | 'participation';

const REPORT_TABS: Array<{ id: ReportType; label: string }> = [
  { id: 'faculty', label: 'Faculty Report' },
  { id: 'department', label: 'Department Report' },
  { id: 'semester', label: 'Semester Report' },
  { id: 'subject', label: 'Subject Report' },
  { id: 'participation', label: 'Student Participation' },
];

export function ReportsModule() {
  const { showToast } = useToast();
  const [reportType, setReportType] = useState<ReportType>('faculty');
  const [sessions, setSessions] = useState<FeedbackSession[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [semester, setSemester] = useState('');
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<{ sessions: FeedbackSession[] }>('/api/admin/sessions'),
      apiFetch<{ departments: Department[] }>('/api/departments/public'),
    ]).then(([sRes, dRes]) => {
      setSessions(sRes.sessions);
      setDepartments(dRes.departments);
    });
  }, []);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: reportType });
      if (sessionId) params.set('sessionId', sessionId);
      if (departmentId) params.set('departmentId', departmentId);
      if (semester) params.set('semester', semester);
      const res = await apiFetch<{ rows: Array<Record<string, unknown>> }>(`/api/admin/reports?${params.toString()}`);
      setRows(res.rows);
    } finally {
      setLoading(false);
    }
  }, [reportType, sessionId, departmentId, semester]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  const prettyHeader = (col: string) =>
    col.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const activeTitle = REPORT_TABS.find((t) => t.id === reportType)?.label || 'Institutional Report';

  const handlePDF = () => {
    if (rows.length === 0) return;
    exportToPDF(
      activeTitle,
      `Student Feedback Evaluation Report`,
      columns.map(prettyHeader),
      rows.map((r) => columns.map((c) => String(r[c] ?? ''))),
      `${reportType}_report.pdf`
    );
    showToast('Downloaded PDF report.', 'success');
  };

  const handleExcel = () => {
    if (rows.length === 0) return;
    exportToExcel(`${reportType}_report.xlsx`, activeTitle, rows);
    showToast('Downloaded Excel (.xlsx) report.', 'success');
  };

  const handleCSV = () => {
    if (rows.length === 0) return;
    exportToCSV(
      `${reportType}_report.csv`,
      columns.map(prettyHeader),
      rows.map((r) => columns.map((c) => String(r[c] ?? '')))
    );
    showToast('Downloaded CSV report.', 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Reports &amp; Exports
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Generate faculty, department, semester, subject, and participation reports
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          <button
            type="button"
            onClick={handlePDF}
            disabled={rows.length === 0}
            className="flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5" />
            Export PDF
          </button>
          <button
            type="button"
            onClick={handleExcel}
            disabled={rows.length === 0}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            Excel
          </button>
          <button
            type="button"
            onClick={handleCSV}
            disabled={rows.length === 0}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer"
          >
            <Table2 className="h-3.5 w-3.5" />
            CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </button>
        </div>
      </div>

      {/* Report Type Tabs + Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 space-y-5">
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100 p-1 dark:bg-slate-800 no-print">
          {REPORT_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setReportType(t.id)}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                reportType === t.id
                  ? 'bg-white text-[#2563EB] shadow-xs dark:bg-slate-900 dark:text-blue-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 no-print">
          <select
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          >
            <option value="">All Academic Sessions</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
            ))}
          </select>
          <select
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          >
            <option value="">All Semesters</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <option key={s} value={s}>Semester {s}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500">
                {columns.map((col) => (
                  <th key={col} className="py-2.5 pr-4 whitespace-nowrap">
                    {prettyHeader(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={Math.max(1, columns.length)} className="py-8 text-center text-slate-500">
                    Generating report...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={1} className="py-8 text-center text-slate-500">
                    No evaluation records match the selected filters.
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    {columns.map((col) => {
                      const val = row[col];
                      const isNumeric = typeof val === 'number';
                      return (
                        <td
                          key={col}
                          className={`py-3 pr-4 ${
                            isNumeric ? 'font-mono tabular-nums font-medium text-slate-800 dark:text-slate-200' : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {val === null || val === undefined ? '—' : String(val)}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
