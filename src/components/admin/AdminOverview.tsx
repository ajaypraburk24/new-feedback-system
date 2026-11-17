import { useEffect, useState } from 'react';
import { apiFetch } from '../../utils/api';
import type { FeedbackSession } from '../../types';

interface OverviewResponse {
  kpis: {
    totalStudents: number;
    totalFaculty: number;
    totalDepartments: number;
    totalFeedback: number;
    averageRating: number;
    pendingFeedback: number;
  };
  activeSession: FeedbackSession | null;
  charts: {
    facultyPerformance: Array<{ id: number; name: string; department_code: string; avg_rating: number; total_responses: number }>;
    departmentPerformance: Array<{ id: number; code: string; name: string; avg_rating: number; total_responses: number }>;
  };
  recentActivity: Array<{
    id: number;
    overall_rating: number;
    comments: string;
    created_at: string;
    student_name: string;
    roll_no: string;
    faculty_name: string;
    subject_code: string;
    subject_name: string;
    department_code: string;
    session_title: string;
  }>;
}

export function AdminOverview({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    apiFetch<OverviewResponse>('/api/admin/overview')
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading && !data) {
    return <p className="text-sm">Loading dashboard summary...</p>;
  }

  const kpis = data?.kpis;
  const activity = (data?.recentActivity ?? []).filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.student_name.toLowerCase().includes(q) ||
      item.faculty_name.toLowerCase().includes(q) ||
      item.subject_name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold">Dashboard Summary</h2>
          <p className="text-xs text-gray-700">
            Active Session: {data?.activeSession?.title || 'None'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('reports')}
          className="border border-gray-700 bg-gray-100 px-3 py-1 text-xs font-bold hover:bg-gray-200 cursor-pointer"
        >
          Open Reports
        </button>
      </div>

      {/* Plain Summary Counts Table */}
      <table className="plain-table">
        <thead>
          <tr>
            <th>Total Students</th>
            <th>Total Faculty</th>
            <th>Departments</th>
            <th>Feedback Submitted</th>
            <th>Average Rating</th>
            <th>Pending Feedback</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="font-mono">{kpis?.totalStudents ?? 0}</td>
            <td className="font-mono">{kpis?.totalFaculty ?? 0}</td>
            <td className="font-mono">{kpis?.totalDepartments ?? 0}</td>
            <td className="font-mono">{kpis?.totalFeedback ?? 0}</td>
            <td className="font-mono font-bold">{Number(kpis?.averageRating ?? 0).toFixed(2)} / 5</td>
            <td className="font-mono">{kpis?.pendingFeedback ?? 0}</td>
          </tr>
        </tbody>
      </table>

      {/* Faculty Performance Table */}
      <div>
        <h3 className="text-sm font-bold mb-2">Faculty Performance Summary</h3>
        <table className="plain-table">
          <thead>
            <tr>
              <th>Faculty Name</th>
              <th>Department</th>
              <th>Total Responses</th>
              <th>Average Rating</th>
            </tr>
          </thead>
          <tbody>
            {(data?.charts.facultyPerformance ?? []).map((f) => (
              <tr key={f.id}>
                <td className="font-bold">{f.name}</td>
                <td>{f.department_code}</td>
                <td className="font-mono">{f.total_responses}</td>
                <td className="font-mono">{f.avg_rating ? `${Number(f.avg_rating).toFixed(2)} / 5` : 'No ratings'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent Feedback Table */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-sm font-bold">Recent Feedback Activity</h3>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by student, faculty, subject..."
            className="border border-gray-500 px-2.5 py-1 text-xs w-64"
          />
        </div>
        <table className="plain-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Faculty</th>
              <th>Subject</th>
              <th>Rating</th>
              <th>Comments</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {activity.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-gray-500">
                  No matching records found.
                </td>
              </tr>
            ) : (
              activity.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.student_name} ({row.roll_no})
                  </td>
                  <td className="font-bold">{row.faculty_name}</td>
                  <td>{row.subject_name}</td>
                  <td className="font-mono">{row.overall_rating} / 5</td>
                  <td>{row.comments || '—'}</td>
                  <td className="font-mono text-xs">{new Date(row.created_at).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
