import { useCallback, useEffect, useState } from 'react';
import type { AuthUser } from '../../types';
import { apiFetch } from '../../utils/api';
import { exportToPDF } from '../../utils/exportUtils';

interface FacultyDashboardResponse {
  faculty: AuthUser;
  subjects: Array<{ id: number; code: string; name: string; semester: number }>;
  summary: Record<string, number>;
  anonymousComments: Array<{
    id: number;
    overall_rating: number;
    comments: string;
    created_at: string;
    subject_code: string;
    subject_name: string;
    session_title: string;
  }>;
}

interface FacultyPortalProps {
  user: AuthUser;
  onLogout: () => void;
  onOpenSettings: () => void;
}

export function FacultyPortal({ user, onLogout, onOpenSettings }: FacultyPortalProps) {
  const [data, setData] = useState<FacultyDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<FacultyDashboardResponse>('/api/faculty/dashboard');
      setData(res);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const summary = data?.summary;
  const avgOverall = Number(summary?.avg_overall || 0);

  const rows = [
    ['Teaching Quality', summary?.teaching_quality ?? 0],
    ['Subject Knowledge', summary?.subject_knowledge ?? 0],
    ['Communication Skills', summary?.communication_skills ?? 0],
    ['Classroom Interaction', summary?.classroom_interaction ?? 0],
    ['Punctuality', summary?.punctuality ?? 0],
    ['Preparation', summary?.preparation ?? 0],
    ['Doubt Clarification', summary?.doubt_clarification ?? 0],
    ['Teaching Method', summary?.teaching_method ?? 0],
    ['Practical Knowledge', summary?.practical_knowledge ?? 0],
    ['Overall Average Rating', avgOverall],
  ];

  const handleDownloadPDF = () => {
    if (!data) return;
    exportToPDF(
      `Faculty Feedback Report — ${data.faculty.name}`,
      `Department: ${data.faculty.department_code} · Total Responses: ${summary?.total_responses ?? 0}`,
      ['Parameter', 'Average Score (out of 5)'],
      rows.map(([k, v]) => [String(k), `${v} / 5`]),
      `${data.faculty.name.replace(/\s+/g, '_')}_Report.pdf`
    );
  };

  return (
    <div className="min-h-screen bg-white text-black px-4 py-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="border-b-2 border-black pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold">Faculty Feedback Report</h1>
            <p className="text-xs text-gray-800">
              Faculty: <strong>{data?.faculty.name || user.name}</strong> | ID:{' '}
              <strong className="font-mono">{data?.faculty.employee_id || user.employee_id}</strong> | Dept:{' '}
              <strong>{data?.faculty.department_code || user.department_code}</strong>
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs no-print">
            <button type="button" onClick={handleDownloadPDF} className="underline font-bold cursor-pointer">
              Download PDF
            </button>
            <span>|</span>
            <button type="button" onClick={() => window.print()} className="underline cursor-pointer">
              Print
            </button>
            <span>|</span>
            <button type="button" onClick={onOpenSettings} className="underline cursor-pointer">
              Profile / Password
            </button>
            <span>|</span>
            <button type="button" onClick={onLogout} className="text-red-700 underline font-bold cursor-pointer">
              Logout
            </button>
          </div>
        </header>

        {loading && !data ? (
          <p className="text-sm">Loading faculty report...</p>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="text-xs mb-2">
                <strong>Assigned Subjects:</strong>{' '}
                {(data?.subjects ?? []).map((s) => `${s.name} (${s.code})`).join(', ') || 'None'} ·{' '}
                <strong>Total Anonymized Submissions:</strong> {summary?.total_responses ?? 0} ·{' '}
                <strong>Overall Rating:</strong> {avgOverall.toFixed(2)} / 5
              </p>

              <table className="plain-table">
                <thead>
                  <tr>
                    <th>Evaluation Criterion</th>
                    <th>Average Score (1–5)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([label, score]) => (
                    <tr key={String(label)}>
                      <td className="font-bold">{label}</td>
                      <td className="font-mono">{Number(score).toFixed(2)} / 5.00</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h2 className="text-sm font-bold mb-2">
                Anonymous Student Comments (Identities Hidden)
              </h2>
              {(data?.anonymousComments ?? []).length === 0 ? (
                <p className="text-xs text-gray-600">No comments submitted yet.</p>
              ) : (
                <table className="plain-table">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Rating</th>
                      <th>Comment</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.anonymousComments ?? []).map((c) => (
                      <tr key={c.id}>
                        <td>{c.subject_name}</td>
                        <td className="font-mono">{c.overall_rating} / 5</td>
                        <td>{c.comments}</td>
                        <td className="font-mono text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
