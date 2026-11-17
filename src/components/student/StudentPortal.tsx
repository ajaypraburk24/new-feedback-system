import React, { useCallback, useEffect, useState } from 'react';
import { EVALUATION_PARAMETERS } from '../../types';
import type { AuthUser, EvaluationParameter, FeedbackSession } from '../../types';
import { apiFetch } from '../../utils/api';
import { useToast } from '../ToastContext';

interface StudentSubjectItem {
  subject_id: number;
  subject_code: string;
  subject_name: string;
  semester: number;
  credits: number;
  department_id: number;
  department_code: string;
  department_name: string;
  faculty_id: number;
  faculty_name: string;
  designation: string;
  employee_id: string;
  submitted: number;
  given_rating: number | null;
  submitted_at: string | null;
}

interface StudentDashboardResponse {
  student: AuthUser;
  activeSession: FeedbackSession | null;
  subjects: StudentSubjectItem[];
}

interface StudentPortalProps {
  user: AuthUser;
  onLogout: () => void;
}

type RatingsMap = Record<EvaluationParameter['key'], number>;

const EMPTY_RATINGS: RatingsMap = {
  teaching_quality: 0,
  subject_knowledge: 0,
  communication_skills: 0,
  classroom_interaction: 0,
  punctuality: 0,
  preparation: 0,
  doubt_clarification: 0,
  teaching_method: 0,
  practical_knowledge: 0,
  overall_rating: 0,
};

export function StudentPortal({ user, onLogout }: StudentPortalProps) {
  const { showToast } = useToast();
  const [data, setData] = useState<StudentDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedSubjectId, setSelectedSubjectId] = useState<number>(0);
  const [ratings, setRatings] = useState<RatingsMap>(EMPTY_RATINGS);
  const [comments, setComments] = useState('');
  const [confirmStep, setConfirmStep] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<StudentDashboardResponse>('/api/student/dashboard');
      setData(res);
      const firstPending = res.subjects.find((s) => !s.submitted);
      if (firstPending) {
        setSelectedSubjectId(firstPending.subject_id);
      } else if (res.subjects[0]) {
        setSelectedSubjectId(res.subjects[0].subject_id);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const subjects = data?.subjects ?? [];
  const selectedTarget = subjects.find((s) => s.subject_id === selectedSubjectId) || null;
  const submittedCount = subjects.filter((s) => s.submitted).length;

  const handleReviewClick = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!selectedTarget) {
      setFormError('Please select a faculty member.');
      return;
    }
    if (selectedTarget.submitted) {
      setFormError('Feedback already submitted for this faculty.');
      return;
    }
    const missing = EVALUATION_PARAMETERS.filter((p) => ratings[p.key] < 1);
    if (missing.length > 0) {
      setFormError(`Please rate all 10 parameters from 1 to 5 (${missing.length} remaining).`);
      return;
    }
    setConfirmStep(true);
  };

  const handleFinalSubmit = async () => {
    if (!selectedTarget) return;
    setSubmitting(true);
    try {
      await apiFetch('/api/student/feedback', {
        method: 'POST',
        body: JSON.stringify({
          faculty_id: selectedTarget.faculty_id,
          subject_id: selectedTarget.subject_id,
          ...ratings,
          comments,
        }),
      });
      showToast(`Feedback submitted for ${selectedTarget.faculty_name} (${selectedTarget.subject_code}).`, 'success');
      setRatings(EMPTY_RATINGS);
      setComments('');
      setConfirmStep(false);
      await loadDashboard();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to submit feedback.');
      setConfirmStep(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-black px-4 py-6">
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Header */}
        <header className="border-b-2 border-black pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold uppercase">
              SRM TRP Engineering College — Student Feedback
            </h1>
            <p className="text-xs text-gray-800 mt-0.5">
              Name: <strong>{data?.student.name || user.name}</strong> | Roll No:{' '}
              <strong className="font-mono">{data?.student.roll_no || user.roll_no}</strong> | Sem:{' '}
              <strong>{data?.student.semester || user.semester}</strong> | Year:{' '}
              <strong>{data?.student.year || user.year}</strong>
            </p>
          </div>
          <div className="text-xs">
            <button type="button" onClick={onLogout} className="text-red-700 underline font-bold cursor-pointer">
              Logout
            </button>
          </div>
        </header>

        {loading && !data ? (
          <p className="text-sm">Loading feedback page...</p>
        ) : (
          <div className="space-y-6">
            {/* Faculty Feedback Status Table (1 to 5) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold">
                  Faculty Feedback Status (Sem {data?.student.semester} / Year {data?.student.year})
                </h2>
                <span className="text-xs font-mono">
                  Completed: {submittedCount} / {subjects.length}
                </span>
              </div>
              <table className="plain-table">
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>Code</th>
                    <th>Subject</th>
                    <th>Faculty Name</th>
                    <th>Feedback Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((sub, idx) => (
                    <tr key={sub.subject_id}>
                      <td>{idx + 1}</td>
                      <td className="font-mono">{sub.subject_code}</td>
                      <td>{sub.subject_name}</td>
                      <td className="font-bold">{sub.faculty_name}</td>
                      <td>
                        {sub.submitted ? (
                          <span className="text-green-800 font-bold">
                            Submitted ({sub.given_rating}/5)
                          </span>
                        ) : (
                          <span className="text-amber-800">Pending</span>
                        )}
                      </td>
                      <td>
                        {sub.submitted ? (
                          <span className="text-xs text-gray-500">Completed</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSubjectId(sub.subject_id);
                              setConfirmStep(false);
                              setFormError('');
                            }}
                            className={`border px-2.5 py-0.5 text-xs cursor-pointer ${
                              selectedSubjectId === sub.subject_id
                                ? 'border-black bg-gray-200 font-bold'
                                : 'border-gray-600 bg-white hover:bg-gray-100'
                            }`}
                          >
                            {selectedSubjectId === sub.subject_id ? 'Selected' : 'Give Feedback'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Feedback Form */}
            <fieldset className="border border-gray-600 p-4">
              <legend className="px-2 font-bold text-sm">
                Feedback Form
              </legend>

              {subjects.length > 0 && submittedCount === subjects.length ? (
                <p className="text-sm font-bold text-green-800 py-2">
                  All {subjects.length} faculty feedbacks for Semester {data?.student.semester} have been submitted successfully.
                </p>
              ) : (
                <>
                  {formError && (
                    <div className="mb-3 border border-red-600 bg-red-50 px-3 py-2 text-xs text-red-800">
                      {formError}
                    </div>
                  )}

                  {!confirmStep ? (
                    <form onSubmit={handleReviewClick} className="space-y-4 text-sm">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="fb-select" className="block text-xs font-bold mb-1">
                            Faculty &amp; Subject:
                          </label>
                          <select
                            id="fb-select"
                            value={selectedSubjectId}
                            onChange={(e) => {
                              setSelectedSubjectId(Number(e.target.value));
                              setFormError('');
                            }}
                            className="w-full border border-gray-500 bg-white px-2.5 py-1.5 text-sm"
                          >
                            {subjects.map((sub, idx) => (
                              <option key={sub.subject_id} value={sub.subject_id}>
                                {idx + 1}. {sub.faculty_name} — {sub.subject_code} ({sub.subject_name}){' '}
                                {sub.submitted ? '[Submitted]' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold mb-1">Student Details:</label>
                          <input
                            type="text"
                            readOnly
                            value={`${data?.student.name} · Sem ${data?.student.semester} · Year ${data?.student.year}`}
                            className="w-full border border-gray-400 bg-gray-100 px-2.5 py-1.5 text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-bold mb-2">
                          Evaluation Parameters (1 = Poor, 5 = Excellent):
                        </p>
                        <table className="plain-table">
                          <thead>
                            <tr>
                              <th>Parameter</th>
                              <th>1</th>
                              <th>2</th>
                              <th>3</th>
                              <th>4</th>
                              <th>5</th>
                            </tr>
                          </thead>
                          <tbody>
                            {EVALUATION_PARAMETERS.map((param, idx) => (
                              <tr key={param.key}>
                                <td>
                                  {idx + 1}. <strong>{param.label}</strong>
                                </td>
                                {[1, 2, 3, 4, 5].map((score) => (
                                  <td key={score} className="text-center">
                                    <input
                                      type="radio"
                                      name={param.key}
                                      value={score}
                                      checked={ratings[param.key] === score}
                                      onChange={() =>
                                        setRatings((prev) => ({ ...prev, [param.key]: score }))
                                      }
                                      aria-label={`${param.label} ${score} out of 5`}
                                    />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div>
                        <label htmlFor="fb-comments" className="block text-xs font-bold mb-1">
                          Comments (Optional):
                        </label>
                        <textarea
                          id="fb-comments"
                          rows={3}
                          value={comments}
                          onChange={(e) => setComments(e.target.value)}
                          placeholder="Enter comments or suggestions..."
                          className="w-full border border-gray-500 bg-white p-2 text-sm"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="submit"
                          disabled={Boolean(selectedTarget?.submitted)}
                          className="border border-gray-800 bg-gray-200 px-4 py-1.5 text-xs font-bold hover:bg-gray-300 disabled:opacity-50 cursor-pointer"
                        >
                          Submit Feedback
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRatings(EMPTY_RATINGS);
                            setComments('');
                            setFormError('');
                          }}
                          className="border border-gray-500 bg-white px-3 py-1.5 text-xs hover:bg-gray-100 cursor-pointer"
                        >
                          Reset
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-3 text-sm">
                      <p className="font-bold text-sm">Confirm Feedback Submission</p>
                      <p className="text-xs">
                        Faculty: <strong>{selectedTarget?.faculty_name}</strong> · Subject:{' '}
                        <strong>
                          {selectedTarget?.subject_code} ({selectedTarget?.subject_name})
                        </strong>
                      </p>
                      <table className="plain-table">
                        <thead>
                          <tr>
                            <th>Parameter</th>
                            <th>Rating</th>
                          </tr>
                        </thead>
                        <tbody>
                          {EVALUATION_PARAMETERS.map((p) => (
                            <tr key={p.key}>
                              <td>{p.label}</td>
                              <td className="font-mono">{ratings[p.key]} / 5</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={handleFinalSubmit}
                          className="border border-gray-800 bg-gray-200 px-4 py-1.5 text-xs font-bold hover:bg-gray-300 cursor-pointer"
                        >
                          {submitting ? 'Submitting...' : 'Confirm & Submit'}
                        </button>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => setConfirmStep(false)}
                          className="border border-gray-500 bg-white px-4 py-1.5 text-xs hover:bg-gray-100 cursor-pointer"
                        >
                          Back
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </fieldset>
          </div>
        )}
      </div>
    </div>
  );
}
