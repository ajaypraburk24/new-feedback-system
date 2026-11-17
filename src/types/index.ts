export type UserRole = 'admin' | 'student' | 'faculty';

export interface AuthUser {
  id: number;
  role: UserRole;
  name: string;
  email: string;
  avatar_url?: string;
  username?: string;
  role_title?: string;
  roll_no?: string;
  employee_id?: string;
  department_id?: number;
  department_name?: string;
  department_code?: string;
  semester?: number;
  year?: number;
  phone?: string;
  designation?: string;
  qualification?: string;
  status?: string;
}

export interface Department {
  id: number;
  code: string;
  name: string;
  hod_name: string;
  student_count?: number;
  faculty_count?: number;
  subject_count?: number;
  avg_rating?: number;
  created_at?: string;
}

export interface StudentRecord {
  id: number;
  roll_no: string;
  name: string;
  email: string;
  department_id: number;
  department_name: string;
  department_code: string;
  semester: number;
  year: number;
  phone: string;
  status: string;
  created_at: string;
}

export interface FacultyRecord {
  id: number;
  employee_id: string;
  name: string;
  email: string;
  department_id: number;
  department_name: string;
  department_code: string;
  designation: string;
  qualification: string;
  status: string;
  avg_rating?: number;
  feedback_count?: number;
  assigned_subjects?: string | null;
  created_at: string;
}

export interface SubjectRecord {
  id: number;
  code: string;
  name: string;
  department_id: number;
  department_name: string;
  department_code: string;
  faculty_id: number | null;
  faculty_name: string | null;
  semester: number;
  credits: number;
  created_at: string;
}

export interface FeedbackSession {
  id: number;
  title: string;
  academic_year: string;
  semester_type: string;
  start_date: string;
  end_date: string;
  is_active: number;
  submission_count?: number;
}

export interface FeedbackRecord {
  id: number;
  session_id: number;
  session_title: string;
  student_name?: string;
  roll_no?: string;
  faculty_name: string;
  employee_id?: string;
  subject_code: string;
  subject_name: string;
  department_code: string;
  department_name?: string;
  semester: number;
  teaching_quality: number;
  subject_knowledge: number;
  communication_skills: number;
  classroom_interaction: number;
  punctuality: number;
  preparation: number;
  doubt_clarification: number;
  teaching_method: number;
  practical_knowledge: number;
  overall_rating: number;
  comments: string;
  created_at: string;
}

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning';
  is_read: number;
  created_at: string;
}

export interface EvaluationParameter {
  key:
    | 'teaching_quality'
    | 'subject_knowledge'
    | 'communication_skills'
    | 'classroom_interaction'
    | 'punctuality'
    | 'preparation'
    | 'doubt_clarification'
    | 'teaching_method'
    | 'practical_knowledge'
    | 'overall_rating';
  label: string;
  description: string;
}

export const EVALUATION_PARAMETERS: EvaluationParameter[] = [
  { key: 'teaching_quality', label: 'Teaching Quality', description: 'Clarity of explanations and structured lesson delivery' },
  { key: 'subject_knowledge', label: 'Subject Knowledge', description: 'Depth of mastery over core and advanced concepts' },
  { key: 'communication_skills', label: 'Communication Skills', description: 'Articulation, pacing, and audibility during lectures' },
  { key: 'classroom_interaction', label: 'Classroom Interaction', description: 'Encouraging student participation and discussion' },
  { key: 'punctuality', label: 'Punctuality', description: 'Timely commencement and completion of classes' },
  { key: 'preparation', label: 'Preparation', description: 'Organization of lecture notes, slides, and materials' },
  { key: 'doubt_clarification', label: 'Doubt Clarification', description: 'Responsiveness and patience in resolving questions' },
  { key: 'teaching_method', label: 'Teaching Method', description: 'Effective use of examples, visuals, and pedagogy' },
  { key: 'practical_knowledge', label: 'Practical Knowledge', description: 'Connecting theory with real-world applications and labs' },
  { key: 'overall_rating', label: 'Overall Rating', description: 'Comprehensive satisfaction with the course instruction' },
];
