import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'student_feedback.db');
export const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA foreign_keys = ON;');

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      hod_name TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      avatar_url TEXT DEFAULT '',
      role_title TEXT DEFAULT 'Administrator',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      roll_no TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      department_id INTEGER NOT NULL,
      semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 8),
      year INTEGER NOT NULL CHECK (year BETWEEN 1 AND 4),
      phone TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      status TEXT DEFAULT 'Active',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS faculty (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      department_id INTEGER NOT NULL,
      designation TEXT DEFAULT 'Assistant Professor',
      qualification TEXT DEFAULT 'M.E.',
      avatar_url TEXT DEFAULT '',
      status TEXT DEFAULT 'Active',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      department_id INTEGER NOT NULL,
      faculty_id INTEGER,
      semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 8),
      credits INTEGER DEFAULT 4,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
      FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS feedback_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      semester_type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_active INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      faculty_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      department_id INTEGER NOT NULL,
      semester INTEGER NOT NULL,
      teaching_quality INTEGER NOT NULL CHECK (teaching_quality BETWEEN 1 AND 5),
      subject_knowledge INTEGER NOT NULL CHECK (subject_knowledge BETWEEN 1 AND 5),
      communication_skills INTEGER NOT NULL CHECK (communication_skills BETWEEN 1 AND 5),
      classroom_interaction INTEGER NOT NULL CHECK (classroom_interaction BETWEEN 1 AND 5),
      punctuality INTEGER NOT NULL CHECK (punctuality BETWEEN 1 AND 5),
      preparation INTEGER NOT NULL CHECK (preparation BETWEEN 1 AND 5),
      doubt_clarification INTEGER NOT NULL CHECK (doubt_clarification BETWEEN 1 AND 5),
      teaching_method INTEGER NOT NULL CHECK (teaching_method BETWEEN 1 AND 5),
      practical_knowledge INTEGER NOT NULL CHECK (practical_knowledge BETWEEN 1 AND 5),
      overall_rating INTEGER NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
      comments TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE (session_id, student_id, faculty_id, subject_id),
      FOREIGN KEY (session_id) REFERENCES feedback_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS login_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      user_role TEXT NOT NULL,
      user_email TEXT NOT NULL,
      ip_address TEXT DEFAULT '127.0.0.1',
      status TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_role TEXT NOT NULL,
      user_id INTEGER,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  const hasUpdatedSeed = db
    .prepare(
      "SELECT 1 FROM students WHERE LOWER(email) = '814725148004@trp.srmtrichy.edu.in' AND EXISTS (SELECT 1 FROM subjects WHERE code = 'CS25C11') AND EXISTS (SELECT 1 FROM faculty WHERE name = 'Dr. R. Pichailakshmi') LIMIT 1"
    )
    .get();

  if (hasUpdatedSeed) {
    return;
  }

  // Reset tables cleanly to apply SRM TRP Engineering College Sem 3 / Year 2 dataset
  db.exec(`
    PRAGMA foreign_keys = OFF;
    DELETE FROM notifications;
    DELETE FROM login_history;
    DELETE FROM feedback;
    DELETE FROM feedback_sessions;
    DELETE FROM subjects;
    DELETE FROM students;
    DELETE FROM faculty;
    DELETE FROM admin;
    DELETE FROM departments;
    DELETE FROM sqlite_sequence;
    PRAGMA foreign_keys = ON;
  `);

  seedInitialData();
}

function seedInitialData(): void {
  const adminPass = bcrypt.hashSync('Admin@123', 10);
  const facultyPass = bcrypt.hashSync('Faculty@123', 10);
  const studentPass = bcrypt.hashSync('trpstudents@123', 10);

  // 1. Department
  db.prepare('INSERT INTO departments (code, name, hod_name) VALUES (?, ?, ?)').run(
    'CSE',
    'SRM TRP Engineering College — CSE',
    'Mr. S. Rajesh'
  );

  // 2. Admin
  db.prepare(
    'INSERT INTO admin (name, username, email, password_hash, avatar_url, role_title) VALUES (?, ?, ?, ?, ?, ?)'
  ).run('Admin', 'admin', 'admin@trp.srmtrichy.edu.in', adminPass, '', 'System Administrator');

  // 3. Faculty (Exact 5 requested members with initials 1 to 5)
  const insertFaculty = db.prepare(
    'INSERT INTO faculty (employee_id, name, email, password_hash, department_id, designation, qualification, avatar_url, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const facultyRows = [
    ['FAC-01', 'Mr. S. Rajesh', 'rajesh@trp.srmtrichy.edu.in', facultyPass, 1, 'Faculty', 'M.E.', '', 'Active'],
    ['FAC-02', 'Mrs. B. Renga Devi', 'rengadevi@trp.srmtrichy.edu.in', facultyPass, 1, 'Faculty', 'M.E.', '', 'Active'],
    ['FAC-03', 'Mr. R. Tamilkudimagan', 'tamilkudimagan@trp.srmtrichy.edu.in', facultyPass, 1, 'Faculty', 'M.Tech.', '', 'Active'],
    ['FAC-04', 'S. Varshini', 'varshini@trp.srmtrichy.edu.in', facultyPass, 1, 'Faculty', 'M.A.', '', 'Active'],
    ['FAC-05', 'Dr. R. Pichailakshmi', 'pichailakshmi@trp.srmtrichy.edu.in', facultyPass, 1, 'Faculty', 'Ph.D.', '', 'Active'],
  ];
  for (const f of facultyRows) insertFaculty.run(...f);

  // 4. Subjects (Exact 5 requested codes & subjects for Semester 3)
  const insertSubject = db.prepare(
    'INSERT INTO subjects (code, name, department_id, faculty_id, semester, credits) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const subjectRows = [
    ['CS25C11', 'OS', 1, 1, 3, 4],
    ['CS25C03', 'DSA', 1, 2, 3, 4],
    ['CS25C09', 'Java Programming', 1, 3, 3, 4],
    ['EN25C03', 'English', 1, 4, 3, 3],
    ['MA25C14', 'Maths', 1, 5, 3, 4],
  ];
  for (const s of subjectRows) insertSubject.run(...s);

  // 5. Student (AJAY PRABU.R.K, Sem 3, Year 2, Roll No 814725148004)
  const insertStudent = db.prepare(
    'INSERT INTO students (roll_no, name, email, password_hash, department_id, semester, year, phone, avatar_url, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  insertStudent.run(
    '814725148004',
    'AJAY PRABU.R.K',
    '814725148004@trp.srmtrichy.edu.in',
    studentPass,
    1,
    3,
    2,
    '',
    '',
    'Active'
  );

  // 6. Active Feedback Session
  db.prepare(
    'INSERT INTO feedback_sessions (title, academic_year, semester_type, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?, ?)'
  ).run('Semester 3 Feedback (Year 2)', '2026-27', 'Odd', '2026-11-01', '2026-12-15', 1);
}
