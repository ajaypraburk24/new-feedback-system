import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import { db, initializeDatabase } from './server/db.ts';
import { MYSQL_SCHEMA_SQL } from './server/schemaSql.ts';

initializeDatabase();

const app = express();
const PORT = 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'sfs-university-eval-secret-key-2026';
const COOKIE_NAME = 'sfs_session';

app.use(express.json({ limit: '4mb' }));
app.use(cookieParser());

type UserRole = 'admin' | 'student' | 'faculty';

interface SessionPayload {
  id: number;
  role: UserRole;
  exp: number;
}

interface AuthedRequest extends Request {
  user?: SessionPayload;
}

function signToken(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token: string | undefined): SessionPayload | null {
  if (!token || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.id || !parsed.role || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function extractToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return req.cookies?.[COOKIE_NAME] as string | undefined;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  const user = verifyToken(token);
  if (!user) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  req.user = user;
  next();
}

function requireRole(role: UserRole) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || req.user.role !== role) {
      res.status(403).json({ error: 'Access denied for this role.' });
      return;
    }
    next();
  };
}

function getUserProfile(role: UserRole, id: number): Record<string, unknown> | null {
  if (role === 'admin') {
    const row = db
      .prepare('SELECT id, name, username, email, avatar_url, role_title, created_at FROM admin WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;
    return row ? { ...row, role: 'admin' } : null;
  }
  if (role === 'student') {
    const row = db
      .prepare(`
        SELECT s.id, s.roll_no, s.name, s.email, s.department_id, d.name as department_name, d.code as department_code,
               s.semester, s.year, s.phone, s.avatar_url, s.status, s.created_at
        FROM students s
        JOIN departments d ON d.id = s.department_id
        WHERE s.id = ?
      `)
      .get(id) as Record<string, unknown> | undefined;
    return row ? { ...row, role: 'student' } : null;
  }
  const row = db
    .prepare(`
      SELECT f.id, f.employee_id, f.name, f.email, f.department_id, d.name as department_name, d.code as department_code,
             f.designation, f.qualification, f.avatar_url, f.status, f.created_at
      FROM faculty f
      JOIN departments d ON d.id = f.department_id
      WHERE f.id = ?
    `)
    .get(id) as Record<string, unknown> | undefined;
  return row ? { ...row, role: 'faculty' } : null;
}

function findAccountByRole(role: UserRole, cleanId: string): { id: number; email: string; password_hash: string; status?: string } | undefined {
  if (role === 'admin') {
    return db
      .prepare('SELECT id, email, password_hash FROM admin WHERE LOWER(email) = ? OR LOWER(username) = ?')
      .get(cleanId, cleanId) as { id: number; email: string; password_hash: string } | undefined;
  }
  if (role === 'student') {
    return db
      .prepare('SELECT id, email, password_hash, status FROM students WHERE LOWER(email) = ? OR LOWER(roll_no) = ?')
      .get(cleanId, cleanId) as { id: number; email: string; password_hash: string; status: string } | undefined;
  }
  return db
    .prepare('SELECT id, email, password_hash, status FROM faculty WHERE LOWER(email) = ? OR LOWER(employee_id) = ?')
    .get(cleanId, cleanId) as { id: number; email: string; password_hash: string; status: string } | undefined;
}

// ============================================================================
// AUTHENTICATION ROUTES
// ============================================================================

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { role, identifier, password, rememberMe } = req.body as {
    role?: UserRole;
    identifier?: string;
    password?: string;
    rememberMe?: boolean;
  };

  if (!identifier || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const preferredRole: UserRole = role && ['admin', 'student', 'faculty'].includes(role) ? role : 'student';
  const cleanId = identifier.trim().toLowerCase();

  // Check preferred role first, then fallback across remaining roles so valid credentials work even if user didn't switch tab
  const roleOrder: UserRole[] = [
    preferredRole,
    ...(['student', 'faculty', 'admin'] as UserRole[]).filter((r) => r !== preferredRole),
  ];

  let matchedRole: UserRole = preferredRole;
  let userRow: { id: number; email: string; password_hash: string; status?: string } | undefined;

  for (const r of roleOrder) {
    const candidate = findAccountByRole(r, cleanId);
    if (candidate && bcrypt.compareSync(password, candidate.password_hash)) {
      matchedRole = r;
      userRow = candidate;
      break;
    }
    if (!userRow && r === preferredRole && candidate) {
      userRow = candidate;
    }
  }

  const ip = req.ip || '127.0.0.1';

  if (!userRow || !bcrypt.compareSync(password, userRow.password_hash)) {
    db.prepare('INSERT INTO login_history (user_id, user_role, user_email, ip_address, status) VALUES (?, ?, ?, ?, ?)')
      .run(userRow?.id ?? 0, preferredRole, cleanId, ip, 'Failed');
    res.status(401).json({ error: 'Invalid credentials. Please verify your email and password.' });
    return;
  }

  if (userRow.status && userRow.status === 'Inactive') {
    res.status(403).json({ error: 'Your account is currently inactive. Contact the administrator.' });
    return;
  }

  db.prepare('INSERT INTO login_history (user_id, user_role, user_email, ip_address, status) VALUES (?, ?, ?, ?, ?)')
    .run(userRow.id, matchedRole, userRow.email, ip, 'Success');

  const ttlMs = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
  const token = signToken({ id: userRow.id, role: matchedRole, exp: Date.now() + ttlMs });

  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    maxAge: ttlMs,
    path: '/',
  });

  const profile = getUserProfile(matchedRole, userRow.id);
  res.json({ user: profile, token });
});

app.post('/api/auth/logout', (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

app.get('/api/auth/me', (req: Request, res: Response) => {
  const token = extractToken(req);
  const session = verifyToken(token);
  if (!session) {
    res.status(401).json({ user: null });
    return;
  }
  const profile = getUserProfile(session.role, session.id);
  if (!profile) {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    res.status(401).json({ user: null });
    return;
  }
  res.json({ user: profile });
});

app.post('/api/auth/forgot-password', (req: Request, res: Response) => {
  const { role, email, newPassword } = req.body as {
    role?: UserRole;
    email?: string;
    newPassword?: string;
  };
  if (!role || !['admin', 'student', 'faculty'].includes(role) || !email) {
    res.status(400).json({ error: 'Role and email address are required.' });
    return;
  }
  const emailTrimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailTrimmed)) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }

  const table = role === 'admin' ? 'admin' : role === 'student' ? 'students' : 'faculty';
  const existing = db.prepare(`SELECT id, name FROM ${table} WHERE LOWER(email) = ?`).get(emailTrimmed) as
    | { id: number; name: string }
    | undefined;

  if (!existing) {
    res.status(404).json({ error: `No ${role} account found with that email address.` });
    return;
  }

  if (newPassword) {
    if (newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters.' });
      return;
    }
    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare(`UPDATE ${table} SET password_hash = ? WHERE id = ?`).run(hash, existing.id);
    db.prepare('INSERT INTO notifications (user_role, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)')
      .run(role, existing.id, 'Password Reset Successful', 'Your portal password was updated via self-service recovery.', 'info');
    res.json({ ok: true, message: 'Password updated successfully. You may now sign in.' });
    return;
  }

  res.json({ ok: true, verified: true, accountName: existing.name });
});

app.put('/api/auth/profile', requireAuth, (req: AuthedRequest, res: Response) => {
  const { name, phone, roleTitle, qualification } = req.body as {
    name?: string;
    phone?: string;
    roleTitle?: string;
    qualification?: string;
  };
  if (!name || !name.trim()) {
    res.status(400).json({ error: 'Full name is required.' });
    return;
  }
  const { role, id } = req.user!;
  if (role === 'admin') {
    db.prepare('UPDATE admin SET name = ?, role_title = COALESCE(?, role_title) WHERE id = ?')
      .run(name.trim(), roleTitle?.trim() || null, id);
  } else if (role === 'student') {
    db.prepare('UPDATE students SET name = ?, phone = ? WHERE id = ?')
      .run(name.trim(), phone?.trim() || '', id);
  } else {
    db.prepare('UPDATE faculty SET name = ?, qualification = COALESCE(?, qualification) WHERE id = ?')
      .run(name.trim(), qualification?.trim() || null, id);
  }
  res.json({ user: getUserProfile(role, id) });
});

app.put('/api/auth/change-password', requireAuth, (req: AuthedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    res.status(400).json({ error: 'Current password and a new password (min 6 chars) are required.' });
    return;
  }
  const { role, id } = req.user!;
  const table = role === 'admin' ? 'admin' : role === 'student' ? 'students' : 'faculty';
  const row = db.prepare(`SELECT password_hash FROM ${table} WHERE id = ?`).get(id) as
    | { password_hash: string }
    | undefined;
  if (!row || !bcrypt.compareSync(currentPassword, row.password_hash)) {
    res.status(400).json({ error: 'Current password is incorrect.' });
    return;
  }
  const newHash = bcrypt.hashSync(newPassword, 10);
  db.prepare(`UPDATE ${table} SET password_hash = ? WHERE id = ?`).run(newHash, id);
  res.json({ ok: true, message: 'Password updated successfully.' });
});

// ============================================================================
// NOTIFICATIONS
// ============================================================================

app.get('/api/notifications', requireAuth, (req: AuthedRequest, res: Response) => {
  const { role, id } = req.user!;
  const rows = db
    .prepare(`
      SELECT id, title, message, type, is_read, created_at
      FROM notifications
      WHERE (user_role = ? AND (user_id IS NULL OR user_id = ?)) OR user_role = 'all'
      ORDER BY created_at DESC, id DESC
      LIMIT 20
    `)
    .all(role, id);
  res.json({ notifications: rows });
});

app.put('/api/notifications/:id/read', requireAuth, (req: AuthedRequest, res: Response) => {
  const notifId = Number(req.params.id);
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(notifId);
  res.json({ ok: true });
});

app.put('/api/notifications/read-all', requireAuth, (req: AuthedRequest, res: Response) => {
  const { role, id } = req.user!;
  db.prepare("UPDATE notifications SET is_read = 1 WHERE (user_role = ? AND (user_id IS NULL OR user_id = ?)) OR user_role = 'all'")
    .run(role, id);
  res.json({ ok: true });
});

// ============================================================================
// PUBLIC / SHARED METADATA
// ============================================================================

app.get('/api/departments/public', requireAuth, (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT id, code, name FROM departments ORDER BY name').all();
  res.json({ departments: rows });
});

app.get('/api/system/sql-schema', requireAuth, requireRole('admin'), (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/sql; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="TeachersFeedbackSystem.sql"');
  res.send(MYSQL_SCHEMA_SQL);
});

// ============================================================================
// ADMIN DASHBOARD & MANAGEMENT ROUTES
// ============================================================================

app.get('/api/admin/overview', requireAuth, requireRole('admin'), (_req: Request, res: Response) => {
  const totalStudents = (db.prepare("SELECT COUNT(*) as c FROM students WHERE status = 'Active'").get() as { c: number }).c;
  const totalFaculty = (db.prepare("SELECT COUNT(*) as c FROM faculty WHERE status = 'Active'").get() as { c: number }).c;
  const totalDepartments = (db.prepare('SELECT COUNT(*) as c FROM departments').get() as { c: number }).c;
  const totalFeedback = (db.prepare('SELECT COUNT(*) as c FROM feedback').get() as { c: number }).c;
  const avgRow = db.prepare('SELECT ROUND(AVG(overall_rating), 2) as avg_rating FROM feedback').get() as { avg_rating: number | null };
  const averageRating = avgRow.avg_rating ?? 0;

  const activeSession = db.prepare('SELECT * FROM feedback_sessions WHERE is_active = 1 LIMIT 1').get() as
    | { id: number; title: string; academic_year: string; end_date: string }
    | undefined;

  let pendingFeedback = 0;
  if (activeSession) {
    const expectedPairs = (db.prepare(`
      SELECT COUNT(*) as c
      FROM students st
      JOIN subjects sub ON sub.department_id = st.department_id AND sub.semester = st.semester
      WHERE st.status = 'Active' AND sub.faculty_id IS NOT NULL
    `).get() as { c: number }).c;
    const submittedInActive = (db.prepare('SELECT COUNT(*) as c FROM feedback WHERE session_id = ?').get(activeSession.id) as { c: number }).c;
    pendingFeedback = Math.max(0, expectedPairs - submittedInActive);
  }

  const facultyPerformance = db.prepare(`
    SELECT f.id, f.name, d.code as department_code,
           ROUND(AVG(fb.overall_rating), 2) as avg_rating,
           COUNT(fb.id) as total_responses
    FROM faculty f
    JOIN departments d ON d.id = f.department_id
    LEFT JOIN feedback fb ON fb.faculty_id = f.id
    GROUP BY f.id
    ORDER BY avg_rating DESC, total_responses DESC
    LIMIT 8
  `).all();

  const departmentPerformance = db.prepare(`
    SELECT d.id, d.code, d.name,
           ROUND(COALESCE(AVG(fb.overall_rating), 0), 2) as avg_rating,
           COUNT(fb.id) as total_responses
    FROM departments d
    LEFT JOIN feedback fb ON fb.department_id = d.id
    GROUP BY d.id
    ORDER BY avg_rating DESC
  `).all();

  const monthlyFeedback = db.prepare(`
    SELECT strftime('%Y-%m', created_at) as month,
           COUNT(*) as submissions,
           ROUND(AVG(overall_rating), 2) as avg_rating
    FROM feedback
    GROUP BY strftime('%Y-%m', created_at)
    ORDER BY month ASC
    LIMIT 12
  `).all();

  const overallRatings = db.prepare(`
    SELECT overall_rating as rating, COUNT(*) as count
    FROM feedback
    GROUP BY overall_rating
    ORDER BY overall_rating DESC
  `).all();

  const recentActivity = db.prepare(`
    SELECT fb.id, fb.overall_rating, fb.comments, fb.created_at,
           st.name as student_name, st.roll_no,
           f.name as faculty_name,
           sub.code as subject_code, sub.name as subject_name,
           d.code as department_code,
           fs.title as session_title
    FROM feedback fb
    JOIN students st ON st.id = fb.student_id
    JOIN faculty f ON f.id = fb.faculty_id
    JOIN subjects sub ON sub.id = fb.subject_id
    JOIN departments d ON d.id = fb.department_id
    JOIN feedback_sessions fs ON fs.id = fb.session_id
    ORDER BY fb.created_at DESC, fb.id DESC
    LIMIT 12
  `).all();

  res.json({
    kpis: {
      totalStudents,
      totalFaculty,
      totalDepartments,
      totalFeedback,
      averageRating,
      pendingFeedback,
    },
    activeSession: activeSession ?? null,
    charts: {
      facultyPerformance,
      departmentPerformance,
      monthlyFeedback,
      overallRatings,
    },
    recentActivity,
  });
});

// --- STUDENTS CRUD + IMPORT ---
app.get('/api/admin/students', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const search = String(req.query.search || '').trim().toLowerCase();
  const departmentId = req.query.departmentId ? Number(req.query.departmentId) : null;
  const semester = req.query.semester ? Number(req.query.semester) : null;
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 10)));
  const offset = (page - 1) * limit;

  const whereClauses: string[] = ['1=1'];
  const params: Array<string | number> = [];

  if (search) {
    whereClauses.push('(LOWER(s.name) LIKE ? OR LOWER(s.email) LIKE ? OR LOWER(s.roll_no) LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (departmentId) {
    whereClauses.push('s.department_id = ?');
    params.push(departmentId);
  }
  if (semester) {
    whereClauses.push('s.semester = ?');
    params.push(semester);
  }

  const whereSql = whereClauses.join(' AND ');
  const total = (db.prepare(`SELECT COUNT(*) as c FROM students s WHERE ${whereSql}`).get(...params) as { c: number }).c;

  const rows = db.prepare(`
    SELECT s.id, s.roll_no, s.name, s.email, s.department_id, d.name as department_name, d.code as department_code,
           s.semester, s.year, s.phone, s.status, s.created_at
    FROM students s
    JOIN departments d ON d.id = s.department_id
    WHERE ${whereSql}
    ORDER BY s.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({ students: rows, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) });
});

app.post('/api/admin/students', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const { roll_no, name, email, department_id, semester, year, phone, password, status } = req.body as {
    roll_no?: string;
    name?: string;
    email?: string;
    department_id?: number;
    semester?: number;
    year?: number;
    phone?: string;
    password?: string;
    status?: string;
  };
  if (!roll_no?.trim() || !name?.trim() || !email?.trim() || !department_id || !semester) {
    res.status(400).json({ error: 'Roll No, Name, Email, Department, and Semester are required.' });
    return;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    res.status(400).json({ error: 'Please provide a valid email address.' });
    return;
  }
  const calcYear = year || Math.ceil(Number(semester) / 2);
  const hash = bcrypt.hashSync(password?.trim() || 'Student@123', 10);
  try {
    const info = db.prepare(`
      INSERT INTO students (roll_no, name, email, password_hash, department_id, semester, year, phone, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(roll_no.trim(), name.trim(), email.trim().toLowerCase(), hash, Number(department_id), Number(semester), calcYear, phone?.trim() || '', status || 'Active');
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Database error';
    res.status(400).json({ error: msg.includes('UNIQUE') ? 'Roll No or Email already exists.' : msg });
  }
});

app.put('/api/admin/students/:id', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { roll_no, name, email, department_id, semester, year, phone, status } = req.body as {
    roll_no?: string;
    name?: string;
    email?: string;
    department_id?: number;
    semester?: number;
    year?: number;
    phone?: string;
    status?: string;
  };
  if (!roll_no?.trim() || !name?.trim() || !email?.trim() || !department_id || !semester) {
    res.status(400).json({ error: 'Roll No, Name, Email, Department, and Semester are required.' });
    return;
  }
  try {
    db.prepare(`
      UPDATE students
      SET roll_no = ?, name = ?, email = ?, department_id = ?, semester = ?, year = ?, phone = ?, status = ?
      WHERE id = ?
    `).run(
      roll_no.trim(),
      name.trim(),
      email.trim().toLowerCase(),
      Number(department_id),
      Number(semester),
      year || Math.ceil(Number(semester) / 2),
      phone?.trim() || '',
      status || 'Active',
      id
    );
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Database error';
    res.status(400).json({ error: msg.includes('UNIQUE') ? 'Roll No or Email already exists.' : msg });
  }
});

app.delete('/api/admin/students/:id', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM students WHERE id = ?').run(id);
  res.json({ ok: true });
});

app.post('/api/admin/students/import', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const { rows } = req.body as {
    rows?: Array<{
      roll_no: string;
      name: string;
      email: string;
      department_code?: string;
      department_id?: number;
      semester: number;
      phone?: string;
    }>;
  };
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: 'No valid student rows provided.' });
    return;
  }

  const depts = db.prepare('SELECT id, code FROM departments').all() as Array<{ id: number; code: string }>;
  const deptMap = new Map(depts.map((d) => [d.code.toUpperCase(), d.id]));
  const defaultHash = bcrypt.hashSync('Student@123', 10);
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO students (roll_no, name, email, password_hash, department_id, semester, year, phone, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active')
  `);

  let inserted = 0;
  let skipped = 0;

  for (const r of rows) {
    if (!r.roll_no || !r.name || !r.email) {
      skipped++;
      continue;
    }
    const deptId = r.department_id || (r.department_code ? deptMap.get(r.department_code.trim().toUpperCase()) : undefined) || depts[0]?.id;
    if (!deptId) {
      skipped++;
      continue;
    }
    const sem = Math.min(8, Math.max(1, Number(r.semester) || 1));
    const result = insertStmt.run(
      String(r.roll_no).trim(),
      String(r.name).trim(),
      String(r.email).trim().toLowerCase(),
      defaultHash,
      deptId,
      sem,
      Math.ceil(sem / 2),
      String(r.phone || '').trim()
    );
    if (result.changes > 0) inserted++;
    else skipped++;
  }

  res.json({ inserted, skipped });
});

// --- FACULTY CRUD ---
app.get('/api/admin/faculty', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const search = String(req.query.search || '').trim().toLowerCase();
  const departmentId = req.query.departmentId ? Number(req.query.departmentId) : null;

  const whereClauses: string[] = ['1=1'];
  const params: Array<string | number> = [];

  if (search) {
    whereClauses.push('(LOWER(f.name) LIKE ? OR LOWER(f.email) LIKE ? OR LOWER(f.employee_id) LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (departmentId) {
    whereClauses.push('f.department_id = ?');
    params.push(departmentId);
  }

  const rows = db.prepare(`
    SELECT f.id, f.employee_id, f.name, f.email, f.department_id, d.name as department_name, d.code as department_code,
           f.designation, f.qualification, f.status, f.created_at,
           ROUND(COALESCE(AVG(fb.overall_rating), 0), 2) as avg_rating,
           COUNT(DISTINCT fb.id) as feedback_count,
           GROUP_CONCAT(DISTINCT sub.name) as assigned_subjects
    FROM faculty f
    JOIN departments d ON d.id = f.department_id
    LEFT JOIN feedback fb ON fb.faculty_id = f.id
    LEFT JOIN subjects sub ON sub.faculty_id = f.id
    WHERE ${whereClauses.join(' AND ')}
    GROUP BY f.id
    ORDER BY f.id DESC
  `).all(...params);

  res.json({ faculty: rows });
});

app.post('/api/admin/faculty', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const { employee_id, name, email, department_id, designation, qualification, password, status, subject_ids } = req.body as {
    employee_id?: string;
    name?: string;
    email?: string;
    department_id?: number;
    designation?: string;
    qualification?: string;
    password?: string;
    status?: string;
    subject_ids?: number[];
  };
  if (!employee_id?.trim() || !name?.trim() || !email?.trim() || !department_id) {
    res.status(400).json({ error: 'Employee ID, Name, Email, and Department are required.' });
    return;
  }
  const hash = bcrypt.hashSync(password?.trim() || 'Faculty@123', 10);
  try {
    const info = db.prepare(`
      INSERT INTO faculty (employee_id, name, email, password_hash, department_id, designation, qualification, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      employee_id.trim(),
      name.trim(),
      email.trim().toLowerCase(),
      hash,
      Number(department_id),
      designation?.trim() || 'Assistant Professor',
      qualification?.trim() || 'Ph.D.',
      status || 'Active'
    );
    const newId = Number(info.lastInsertRowid);
    if (Array.isArray(subject_ids) && subject_ids.length > 0) {
      const assignStmt = db.prepare('UPDATE subjects SET faculty_id = ? WHERE id = ?');
      for (const sid of subject_ids) assignStmt.run(newId, Number(sid));
    }
    res.status(201).json({ id: newId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Database error';
    res.status(400).json({ error: msg.includes('UNIQUE') ? 'Employee ID or Email already exists.' : msg });
  }
});

app.put('/api/admin/faculty/:id', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { employee_id, name, email, department_id, designation, qualification, status, subject_ids } = req.body as {
    employee_id?: string;
    name?: string;
    email?: string;
    department_id?: number;
    designation?: string;
    qualification?: string;
    status?: string;
    subject_ids?: number[];
  };
  if (!employee_id?.trim() || !name?.trim() || !email?.trim() || !department_id) {
    res.status(400).json({ error: 'Employee ID, Name, Email, and Department are required.' });
    return;
  }
  try {
    db.prepare(`
      UPDATE faculty
      SET employee_id = ?, name = ?, email = ?, department_id = ?, designation = ?, qualification = ?, status = ?
      WHERE id = ?
    `).run(
      employee_id.trim(),
      name.trim(),
      email.trim().toLowerCase(),
      Number(department_id),
      designation?.trim() || 'Assistant Professor',
      qualification?.trim() || 'Ph.D.',
      status || 'Active',
      id
    );
    if (Array.isArray(subject_ids)) {
      db.prepare('UPDATE subjects SET faculty_id = NULL WHERE faculty_id = ?').run(id);
      const assignStmt = db.prepare('UPDATE subjects SET faculty_id = ? WHERE id = ?');
      for (const sid of subject_ids) assignStmt.run(id, Number(sid));
    }
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Database error';
    res.status(400).json({ error: msg.includes('UNIQUE') ? 'Employee ID or Email already exists.' : msg });
  }
});

app.delete('/api/admin/faculty/:id', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM faculty WHERE id = ?').run(id);
  res.json({ ok: true });
});

// --- DEPARTMENTS CRUD + ASSIGNMENT ---
app.get('/api/admin/departments', requireAuth, requireRole('admin'), (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT d.id, d.code, d.name, d.hod_name, d.created_at,
           (SELECT COUNT(*) FROM students s WHERE s.department_id = d.id) as student_count,
           (SELECT COUNT(*) FROM faculty f WHERE f.department_id = d.id) as faculty_count,
           (SELECT COUNT(*) FROM subjects sub WHERE sub.department_id = d.id) as subject_count,
           ROUND(COALESCE((SELECT AVG(fb.overall_rating) FROM feedback fb WHERE fb.department_id = d.id), 0), 2) as avg_rating
    FROM departments d
    ORDER BY d.id ASC
  `).all();
  res.json({ departments: rows });
});

app.post('/api/admin/departments', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const { code, name, hod_name } = req.body as { code?: string; name?: string; hod_name?: string };
  if (!code?.trim() || !name?.trim()) {
    res.status(400).json({ error: 'Department Code and Name are required.' });
    return;
  }
  try {
    const info = db.prepare('INSERT INTO departments (code, name, hod_name) VALUES (?, ?, ?)')
      .run(code.trim().toUpperCase(), name.trim(), hod_name?.trim() || '');
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Database error';
    res.status(400).json({ error: msg.includes('UNIQUE') ? 'Department code already exists.' : msg });
  }
});

app.put('/api/admin/departments/:id', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { code, name, hod_name } = req.body as { code?: string; name?: string; hod_name?: string };
  if (!code?.trim() || !name?.trim()) {
    res.status(400).json({ error: 'Department Code and Name are required.' });
    return;
  }
  try {
    db.prepare('UPDATE departments SET code = ?, name = ?, hod_name = ? WHERE id = ?')
      .run(code.trim().toUpperCase(), name.trim(), hod_name?.trim() || '', id);
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Database error';
    res.status(400).json({ error: msg.includes('UNIQUE') ? 'Department code already exists.' : msg });
  }
});

app.post('/api/admin/departments/:id/assign', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const deptId = Number(req.params.id);
  const { faculty_ids, student_ids } = req.body as { faculty_ids?: number[]; student_ids?: number[] };
  if (Array.isArray(faculty_ids) && faculty_ids.length > 0) {
    const stmt = db.prepare('UPDATE faculty SET department_id = ? WHERE id = ?');
    for (const fid of faculty_ids) stmt.run(deptId, Number(fid));
  }
  if (Array.isArray(student_ids) && student_ids.length > 0) {
    const stmt = db.prepare('UPDATE students SET department_id = ? WHERE id = ?');
    for (const sid of student_ids) stmt.run(deptId, Number(sid));
  }
  res.json({ ok: true });
});

app.delete('/api/admin/departments/:id', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const id = Number(req.params.id);
  try {
    db.prepare('DELETE FROM departments WHERE id = ?').run(id);
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: 'Cannot delete department while students or faculty are still assigned to it.' });
  }
});

// --- SUBJECTS CRUD ---
app.get('/api/admin/subjects', requireAuth, requireRole('admin'), (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT sub.id, sub.code, sub.name, sub.department_id, d.name as department_name, d.code as department_code,
           sub.faculty_id, f.name as faculty_name, sub.semester, sub.credits, sub.created_at
    FROM subjects sub
    JOIN departments d ON d.id = sub.department_id
    LEFT JOIN faculty f ON f.id = sub.faculty_id
    ORDER BY sub.semester ASC, sub.code ASC
  `).all();
  res.json({ subjects: rows });
});

app.post('/api/admin/subjects', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const { code, name, department_id, faculty_id, semester, credits } = req.body as {
    code?: string;
    name?: string;
    department_id?: number;
    faculty_id?: number | null;
    semester?: number;
    credits?: number;
  };
  if (!code?.trim() || !name?.trim() || !department_id || !semester) {
    res.status(400).json({ error: 'Subject Code, Name, Department, and Semester are required.' });
    return;
  }
  try {
    const info = db.prepare(`
      INSERT INTO subjects (code, name, department_id, faculty_id, semester, credits)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(code.trim().toUpperCase(), name.trim(), Number(department_id), faculty_id ? Number(faculty_id) : null, Number(semester), Number(credits || 4));
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Database error';
    res.status(400).json({ error: msg.includes('UNIQUE') ? 'Subject code already exists.' : msg });
  }
});

app.put('/api/admin/subjects/:id', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { code, name, department_id, faculty_id, semester, credits } = req.body as {
    code?: string;
    name?: string;
    department_id?: number;
    faculty_id?: number | null;
    semester?: number;
    credits?: number;
  };
  if (!code?.trim() || !name?.trim() || !department_id || !semester) {
    res.status(400).json({ error: 'Subject Code, Name, Department, and Semester are required.' });
    return;
  }
  try {
    db.prepare(`
      UPDATE subjects SET code = ?, name = ?, department_id = ?, faculty_id = ?, semester = ?, credits = ?
      WHERE id = ?
    `).run(code.trim().toUpperCase(), name.trim(), Number(department_id), faculty_id ? Number(faculty_id) : null, Number(semester), Number(credits || 4), id);
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Database error';
    res.status(400).json({ error: msg.includes('UNIQUE') ? 'Subject code already exists.' : msg });
  }
});

app.delete('/api/admin/subjects/:id', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM subjects WHERE id = ?').run(id);
  res.json({ ok: true });
});

// --- FEEDBACK SESSIONS & FEEDBACK LOG ---
app.get('/api/admin/sessions', requireAuth, requireRole('admin'), (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT fs.*, (SELECT COUNT(*) FROM feedback fb WHERE fb.session_id = fs.id) as submission_count
    FROM feedback_sessions fs
    ORDER BY fs.is_active DESC, fs.start_date DESC
  `).all();
  res.json({ sessions: rows });
});

app.post('/api/admin/sessions', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const { title, academic_year, semester_type, start_date, end_date, is_active } = req.body as {
    title?: string;
    academic_year?: string;
    semester_type?: string;
    start_date?: string;
    end_date?: string;
    is_active?: boolean;
  };
  if (!title?.trim() || !academic_year?.trim() || !start_date || !end_date) {
    res.status(400).json({ error: 'Title, Academic Year, Start Date, and End Date are required.' });
    return;
  }
  if (is_active) {
    db.prepare('UPDATE feedback_sessions SET is_active = 0').run();
  }
  const info = db.prepare(`
    INSERT INTO feedback_sessions (title, academic_year, semester_type, start_date, end_date, is_active)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(title.trim(), academic_year.trim(), semester_type || 'Odd', start_date, end_date, is_active ? 1 : 0);
  res.status(201).json({ id: info.lastInsertRowid });
});

app.put('/api/admin/sessions/:id/activate', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const id = Number(req.params.id);
  db.prepare('UPDATE feedback_sessions SET is_active = 0').run();
  db.prepare('UPDATE feedback_sessions SET is_active = 1 WHERE id = ?').run(id);
  res.json({ ok: true });
});

app.get('/api/admin/feedback', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const sessionId = req.query.sessionId ? Number(req.query.sessionId) : null;
  const departmentId = req.query.departmentId ? Number(req.query.departmentId) : null;
  const facultyId = req.query.facultyId ? Number(req.query.facultyId) : null;

  const where: string[] = ['1=1'];
  const params: number[] = [];
  if (sessionId) {
    where.push('fb.session_id = ?');
    params.push(sessionId);
  }
  if (departmentId) {
    where.push('fb.department_id = ?');
    params.push(departmentId);
  }
  if (facultyId) {
    where.push('fb.faculty_id = ?');
    params.push(facultyId);
  }

  const rows = db.prepare(`
    SELECT fb.*,
           st.name as student_name, st.roll_no,
           f.name as faculty_name, f.employee_id,
           sub.code as subject_code, sub.name as subject_name,
           d.code as department_code, d.name as department_name,
           fs.title as session_title
    FROM feedback fb
    JOIN students st ON st.id = fb.student_id
    JOIN faculty f ON f.id = fb.faculty_id
    JOIN subjects sub ON sub.id = fb.subject_id
    JOIN departments d ON d.id = fb.department_id
    JOIN feedback_sessions fs ON fs.id = fb.session_id
    WHERE ${where.join(' AND ')}
    ORDER BY fb.created_at DESC, fb.id DESC
  `).all(...params);

  res.json({ feedback: rows });
});

app.delete('/api/admin/feedback/:id', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM feedback WHERE id = ?').run(id);
  res.json({ ok: true });
});

// --- REPORTS MODULE ---
app.get('/api/admin/reports', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const type = String(req.query.type || 'faculty');
  const sessionId = req.query.sessionId ? Number(req.query.sessionId) : null;
  const departmentId = req.query.departmentId ? Number(req.query.departmentId) : null;
  const semester = req.query.semester ? Number(req.query.semester) : null;

  const fbWhere: string[] = ['1=1'];
  const params: number[] = [];
  if (sessionId) {
    fbWhere.push('fb.session_id = ?');
    params.push(sessionId);
  }
  if (departmentId) {
    fbWhere.push('fb.department_id = ?');
    params.push(departmentId);
  }
  if (semester) {
    fbWhere.push('fb.semester = ?');
    params.push(semester);
  }
  const whereSql = fbWhere.join(' AND ');

  if (type === 'faculty') {
    const rows = db.prepare(`
      SELECT f.employee_id as code, f.name as title, d.code as department,
             COUNT(fb.id) as responses,
             ROUND(AVG(fb.teaching_quality), 2) as teaching,
             ROUND(AVG(fb.subject_knowledge), 2) as knowledge,
             ROUND(AVG(fb.communication_skills), 2) as communication,
             ROUND(AVG(fb.punctuality), 2) as punctuality,
             ROUND(AVG(fb.classroom_interaction), 2) as interaction,
             ROUND(AVG(fb.overall_rating), 2) as overall
      FROM feedback fb
      JOIN faculty f ON f.id = fb.faculty_id
      JOIN departments d ON d.id = f.department_id
      WHERE ${whereSql}
      GROUP BY f.id
      ORDER BY overall DESC
    `).all(...params);
    res.json({ reportType: type, rows });
    return;
  }

  if (type === 'department') {
    const rows = db.prepare(`
      SELECT d.code as code, d.name as title, d.hod_name as lead,
             COUNT(fb.id) as responses,
             ROUND(AVG(fb.teaching_quality), 2) as teaching,
             ROUND(AVG(fb.subject_knowledge), 2) as knowledge,
             ROUND(AVG(fb.communication_skills), 2) as communication,
             ROUND(AVG(fb.punctuality), 2) as punctuality,
             ROUND(AVG(fb.overall_rating), 2) as overall
      FROM feedback fb
      JOIN departments d ON d.id = fb.department_id
      WHERE ${whereSql}
      GROUP BY d.id
      ORDER BY overall DESC
    `).all(...params);
    res.json({ reportType: type, rows });
    return;
  }

  if (type === 'semester') {
    const rows = db.prepare(`
      SELECT ('Semester ' || fb.semester) as title,
             COUNT(fb.id) as responses,
             COUNT(DISTINCT fb.student_id) as participating_students,
             COUNT(DISTINCT fb.faculty_id) as evaluated_faculty,
             ROUND(AVG(fb.teaching_quality), 2) as teaching,
             ROUND(AVG(fb.practical_knowledge), 2) as practical,
             ROUND(AVG(fb.overall_rating), 2) as overall
      FROM feedback fb
      WHERE ${whereSql}
      GROUP BY fb.semester
      ORDER BY fb.semester ASC
    `).all(...params);
    res.json({ reportType: type, rows });
    return;
  }

  if (type === 'subject') {
    const rows = db.prepare(`
      SELECT sub.code as code, sub.name as title, f.name as faculty_name, d.code as department, sub.semester,
             COUNT(fb.id) as responses,
             ROUND(AVG(fb.preparation), 2) as preparation,
             ROUND(AVG(fb.doubt_clarification), 2) as doubt_clarification,
             ROUND(AVG(fb.teaching_method), 2) as teaching_method,
             ROUND(AVG(fb.overall_rating), 2) as overall
      FROM feedback fb
      JOIN subjects sub ON sub.id = fb.subject_id
      JOIN faculty f ON f.id = fb.faculty_id
      JOIN departments d ON d.id = sub.department_id
      WHERE ${whereSql}
      GROUP BY sub.id
      ORDER BY overall DESC
    `).all(...params);
    res.json({ reportType: type, rows });
    return;
  }

  // participation report
  const rows = db.prepare(`
    SELECT st.roll_no as code, st.name as title, d.code as department, st.semester,
           COUNT(fb.id) as submitted_count,
           (SELECT COUNT(*) FROM subjects sub WHERE sub.department_id = st.department_id AND sub.semester = st.semester AND sub.faculty_id IS NOT NULL) as expected_count
    FROM students st
    JOIN departments d ON d.id = st.department_id
    LEFT JOIN feedback fb ON fb.student_id = st.id ${sessionId ? 'AND fb.session_id = ?' : ''}
    WHERE 1=1 ${departmentId ? 'AND st.department_id = ?' : ''} ${semester ? 'AND st.semester = ?' : ''}
    GROUP BY st.id
    ORDER BY submitted_count DESC, st.roll_no ASC
  `).all(...[...(sessionId ? [sessionId] : []), ...(departmentId ? [departmentId] : []), ...(semester ? [semester] : [])]);

  res.json({ reportType: 'participation', rows });
});

// --- ANALYTICS ---
app.get('/api/admin/analytics', requireAuth, requireRole('admin'), (_req: Request, res: Response) => {
  const facultyRanking = db.prepare(`
    SELECT f.id, f.employee_id, f.name, d.code as department_code, f.designation,
           COUNT(fb.id) as responses,
           ROUND(COALESCE(AVG(fb.overall_rating), 0), 2) as overall_rating,
           ROUND(COALESCE(AVG((fb.teaching_quality + fb.subject_knowledge + fb.communication_skills + fb.classroom_interaction + fb.punctuality + fb.preparation + fb.doubt_clarification + fb.teaching_method + fb.practical_knowledge + fb.overall_rating) / 10.0), 0), 2) as composite_score
    FROM faculty f
    JOIN departments d ON d.id = f.department_id
    LEFT JOIN feedback fb ON fb.faculty_id = f.id
    GROUP BY f.id
    ORDER BY composite_score DESC, responses DESC
  `).all() as Array<{ id: number; name: string; department_code: string; composite_score: number; overall_rating: number; responses: number }>;

  const departmentRanking = db.prepare(`
    SELECT d.id, d.code, d.name,
           COUNT(fb.id) as responses,
           ROUND(COALESCE(AVG(fb.overall_rating), 0), 2) as avg_rating
    FROM departments d
    LEFT JOIN feedback fb ON fb.department_id = d.id
    GROUP BY d.id
    ORDER BY avg_rating DESC
  `).all();

  const monthlyAnalysis = db.prepare(`
    SELECT strftime('%Y-%m', created_at) as period,
           COUNT(*) as submissions,
           ROUND(AVG(overall_rating), 2) as avg_rating
    FROM feedback
    GROUP BY strftime('%Y-%m', created_at)
    ORDER BY period ASC
  `).all();

  const yearlyAnalysis = db.prepare(`
    SELECT fs.academic_year as year, fs.title,
           COUNT(fb.id) as submissions,
           ROUND(COALESCE(AVG(fb.overall_rating), 0), 2) as avg_rating
    FROM feedback_sessions fs
    LEFT JOIN feedback fb ON fb.session_id = fs.id
    GROUP BY fs.id
    ORDER BY fs.start_date ASC
  `).all();

  const parameterAverages = db.prepare(`
    SELECT
      ROUND(AVG(teaching_quality), 2) as teaching_quality,
      ROUND(AVG(subject_knowledge), 2) as subject_knowledge,
      ROUND(AVG(communication_skills), 2) as communication_skills,
      ROUND(AVG(classroom_interaction), 2) as classroom_interaction,
      ROUND(AVG(punctuality), 2) as punctuality,
      ROUND(AVG(preparation), 2) as preparation,
      ROUND(AVG(doubt_clarification), 2) as doubt_clarification,
      ROUND(AVG(teaching_method), 2) as teaching_method,
      ROUND(AVG(practical_knowledge), 2) as practical_knowledge,
      ROUND(AVG(overall_rating), 2) as overall_rating
    FROM feedback
  `).get();

  const ratingDistribution = db.prepare(`
    SELECT overall_rating as rating, COUNT(*) as count
    FROM feedback
    GROUP BY overall_rating
    ORDER BY overall_rating ASC
  `).all();

  const activeStudents = (db.prepare("SELECT COUNT(*) as c FROM students WHERE status = 'Active'").get() as { c: number }).c;
  const participatingStudents = (db.prepare('SELECT COUNT(DISTINCT student_id) as c FROM feedback').get() as { c: number }).c;

  const ratedFaculty = facultyRanking.filter((f) => f.responses > 0);
  const topFaculty = ratedFaculty.slice(0, 3);
  const lowestRatedFaculty = [...ratedFaculty].reverse().slice(0, 3);

  res.json({
    facultyRanking,
    departmentRanking,
    monthlyAnalysis,
    yearlyAnalysis,
    parameterAverages,
    ratingDistribution,
    participation: {
      activeStudents,
      participatingStudents,
      rate: activeStudents > 0 ? Math.round((participatingStudents / activeStudents) * 100) : 0,
    },
    topFaculty,
    lowestRatedFaculty,
  });
});

app.get('/api/admin/login-history', requireAuth, requireRole('admin'), (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM login_history ORDER BY created_at DESC, id DESC LIMIT 30').all();
  res.json({ history: rows });
});

// ============================================================================
// STUDENT DASHBOARD & FEEDBACK SUBMISSION
// ============================================================================

app.get('/api/student/dashboard', requireAuth, requireRole('student'), (req: AuthedRequest, res: Response) => {
  const studentId = req.user!.id;
  const student = getUserProfile('student', studentId) as {
    id: number;
    department_id: number;
    semester: number;
  } | null;

  if (!student) {
    res.status(404).json({ error: 'Student profile not found.' });
    return;
  }

  const activeSession = db.prepare('SELECT * FROM feedback_sessions WHERE is_active = 1 LIMIT 1').get() as
    | { id: number; title: string; academic_year: string; start_date: string; end_date: string }
    | undefined;

  const subjects = db.prepare(`
    SELECT sub.id as subject_id, sub.code as subject_code, sub.name as subject_name, sub.semester, sub.credits,
           d.id as department_id, d.code as department_code, d.name as department_name,
           f.id as faculty_id, f.name as faculty_name, f.designation, f.employee_id,
           CASE WHEN fb.id IS NOT NULL THEN 1 ELSE 0 END as submitted,
           fb.overall_rating as given_rating,
           fb.created_at as submitted_at
    FROM subjects sub
    JOIN departments d ON d.id = sub.department_id
    LEFT JOIN faculty f ON f.id = sub.faculty_id
    LEFT JOIN feedback fb ON fb.subject_id = sub.id AND fb.student_id = ? AND fb.session_id = ?
    WHERE sub.department_id = ? AND sub.semester = ? AND sub.faculty_id IS NOT NULL
    ORDER BY sub.id ASC
  `).all(studentId, activeSession?.id ?? 0, student.department_id, student.semester);

  const upcomingSessions = db.prepare(`
    SELECT id, title, academic_year, semester_type, start_date, end_date, is_active
    FROM feedback_sessions
    ORDER BY start_date DESC
  `).all();

  const history = db.prepare(`
    SELECT fb.id, fb.overall_rating, fb.teaching_quality, fb.subject_knowledge, fb.communication_skills,
           fb.classroom_interaction, fb.punctuality, fb.preparation, fb.doubt_clarification,
           fb.teaching_method, fb.practical_knowledge, fb.comments, fb.created_at,
           f.name as faculty_name, sub.code as subject_code, sub.name as subject_name,
           fs.title as session_title
    FROM feedback fb
    JOIN faculty f ON f.id = fb.faculty_id
    JOIN subjects sub ON sub.id = fb.subject_id
    JOIN feedback_sessions fs ON fs.id = fb.session_id
    WHERE fb.student_id = ?
    ORDER BY fb.created_at DESC
  `).all(studentId);

  res.json({
    student,
    activeSession: activeSession ?? null,
    subjects,
    upcomingSessions,
    history,
  });
});

app.post('/api/student/feedback', requireAuth, requireRole('student'), (req: AuthedRequest, res: Response) => {
  const studentId = req.user!.id;
  const body = req.body as {
    faculty_id?: number;
    subject_id?: number;
    teaching_quality?: number;
    subject_knowledge?: number;
    communication_skills?: number;
    classroom_interaction?: number;
    punctuality?: number;
    preparation?: number;
    doubt_clarification?: number;
    teaching_method?: number;
    practical_knowledge?: number;
    overall_rating?: number;
    comments?: string;
  };

  const activeSession = db.prepare('SELECT id, title FROM feedback_sessions WHERE is_active = 1 LIMIT 1').get() as
    | { id: number; title: string }
    | undefined;
  if (!activeSession) {
    res.status(400).json({ error: 'No active feedback session is currently open.' });
    return;
  }

  const subject = db.prepare('SELECT id, department_id, faculty_id, semester, name FROM subjects WHERE id = ?')
    .get(Number(body.subject_id)) as
    | { id: number; department_id: number; faculty_id: number | null; semester: number; name: string }
    | undefined;

  if (!subject || !subject.faculty_id) {
    res.status(400).json({ error: 'Invalid subject or faculty selection.' });
    return;
  }

  const facultyId = Number(body.faculty_id || subject.faculty_id);
  const ratings = [
    body.teaching_quality,
    body.subject_knowledge,
    body.communication_skills,
    body.classroom_interaction,
    body.punctuality,
    body.preparation,
    body.doubt_clarification,
    body.teaching_method,
    body.practical_knowledge,
    body.overall_rating,
  ];

  if (ratings.some((r) => typeof r !== 'number' || r < 1 || r > 5)) {
    res.status(400).json({ error: 'All 10 evaluation parameters must be rated between 1 and 5 stars.' });
    return;
  }

  // Prevent duplicate submission for same faculty/subject in same session
  const duplicate = db.prepare(
    'SELECT id FROM feedback WHERE session_id = ? AND student_id = ? AND faculty_id = ? AND subject_id = ?'
  ).get(activeSession.id, studentId, facultyId, subject.id);
  if (duplicate) {
    res.status(409).json({ error: 'You have already submitted feedback for this faculty member in the current session.' });
    return;
  }

  try {
    const info = db.prepare(`
      INSERT INTO feedback (
        session_id, student_id, faculty_id, subject_id, department_id, semester,
        teaching_quality, subject_knowledge, communication_skills, classroom_interaction,
        punctuality, preparation, doubt_clarification, teaching_method, practical_knowledge,
        overall_rating, comments
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      activeSession.id,
      studentId,
      facultyId,
      subject.id,
      subject.department_id,
      subject.semester,
      Number(body.teaching_quality),
      Number(body.subject_knowledge),
      Number(body.communication_skills),
      Number(body.classroom_interaction),
      Number(body.punctuality),
      Number(body.preparation),
      Number(body.doubt_clarification),
      Number(body.teaching_method),
      Number(body.practical_knowledge),
      Number(body.overall_rating),
      (body.comments || '').trim()
    );

    db.prepare('INSERT INTO notifications (user_role, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)')
      .run('faculty', facultyId, 'New Anonymized Evaluation', `A student evaluation was recorded for ${subject.name} (${activeSession.title}).`, 'info');

    res.status(201).json({ id: info.lastInsertRowid, message: 'Feedback submitted successfully.' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Submission error';
    res.status(400).json({ error: msg.includes('UNIQUE') ? 'Duplicate feedback submission is not allowed.' : msg });
  }
});

// ============================================================================
// FACULTY DASHBOARD (STRICT ANONYMITY — ZERO STUDENT IDENTITY EXPOSED)
// ============================================================================

app.get('/api/faculty/dashboard', requireAuth, requireRole('faculty'), (req: AuthedRequest, res: Response) => {
  const facultyId = req.user!.id;
  const faculty = getUserProfile('faculty', facultyId);
  if (!faculty) {
    res.status(404).json({ error: 'Faculty profile not found.' });
    return;
  }

  const subjects = db.prepare(`
    SELECT sub.id, sub.code, sub.name, sub.semester, sub.credits, d.code as department_code
    FROM subjects sub
    JOIN departments d ON d.id = sub.department_id
    WHERE sub.faculty_id = ?
    ORDER BY sub.semester ASC
  `).all(facultyId);

  const summary = db.prepare(`
    SELECT
      COUNT(*) as total_responses,
      ROUND(COALESCE(AVG(overall_rating), 0), 2) as avg_overall,
      ROUND(COALESCE(AVG(teaching_quality), 0), 2) as teaching_quality,
      ROUND(COALESCE(AVG(subject_knowledge), 0), 2) as subject_knowledge,
      ROUND(COALESCE(AVG(communication_skills), 0), 2) as communication_skills,
      ROUND(COALESCE(AVG(classroom_interaction), 0), 2) as classroom_interaction,
      ROUND(COALESCE(AVG(punctuality), 0), 2) as punctuality,
      ROUND(COALESCE(AVG(preparation), 0), 2) as preparation,
      ROUND(COALESCE(AVG(doubt_clarification), 0), 2) as doubt_clarification,
      ROUND(COALESCE(AVG(teaching_method), 0), 2) as teaching_method,
      ROUND(COALESCE(AVG(practical_knowledge), 0), 2) as practical_knowledge
    FROM feedback
    WHERE faculty_id = ?
  `).get(facultyId) as Record<string, number>;

  const subjectBreakdown = db.prepare(`
    SELECT sub.code, sub.name, sub.semester,
           COUNT(fb.id) as responses,
           ROUND(COALESCE(AVG(fb.overall_rating), 0), 2) as avg_rating
    FROM subjects sub
    LEFT JOIN feedback fb ON fb.subject_id = sub.id AND fb.faculty_id = ?
    WHERE sub.faculty_id = ?
    GROUP BY sub.id
  `).all(facultyId, facultyId);

  const performanceTrend = db.prepare(`
    SELECT fs.title as session_title, fs.academic_year,
           COUNT(fb.id) as responses,
           ROUND(COALESCE(AVG(fb.overall_rating), 0), 2) as avg_rating
    FROM feedback_sessions fs
    LEFT JOIN feedback fb ON fb.session_id = fs.id AND fb.faculty_id = ?
    GROUP BY fs.id
    ORDER BY fs.start_date ASC
  `).all(facultyId);

  // Anonymized comments ONLY — no student_id, name, or roll_no selected!
  const anonymousComments = db.prepare(`
    SELECT fb.id, fb.overall_rating, fb.comments, fb.created_at,
           sub.code as subject_code, sub.name as subject_name,
           fs.title as session_title
    FROM feedback fb
    JOIN subjects sub ON sub.id = fb.subject_id
    JOIN feedback_sessions fs ON fs.id = fb.session_id
    WHERE fb.faculty_id = ? AND TRIM(fb.comments) != ''
    ORDER BY fb.created_at DESC
    LIMIT 20
  `).all(facultyId);

  // Derive automated improvement suggestions from lowest scoring parameters
  const paramLabels: Array<{ key: string; label: string; tip: string }> = [
    { key: 'teaching_quality', label: 'Teaching Quality', tip: 'Incorporate structured recap summaries at the start and end of each lecture.' },
    { key: 'subject_knowledge', label: 'Subject Knowledge', tip: 'Reference contemporary research papers and industry benchmarks during lectures.' },
    { key: 'communication_skills', label: 'Communication Skills', tip: 'Pace complex derivations slowly and check for comprehension before advancing.' },
    { key: 'classroom_interaction', label: 'Classroom Interaction', tip: 'Include brief Q&A checkpoints or live polls midway through class sessions.' },
    { key: 'punctuality', label: 'Punctuality', tip: 'Ensure timely session start and consistent lab availability.' },
    { key: 'preparation', label: 'Preparation', tip: 'Share lecture outlines and annotated slides 24 hours ahead of class.' },
    { key: 'doubt_clarification', label: 'Doubt Clarification', tip: 'Dedicate 10 minutes after complex modules or host weekly office-hour clinics.' },
    { key: 'teaching_method', label: 'Teaching Method', tip: 'Blend board derivations with visual simulations and worked problem sets.' },
    { key: 'practical_knowledge', label: 'Practical Knowledge', tip: 'Add hands-on mini-projects and real-world datasets aligned with syllabus topics.' },
  ];

  const scoredParams = paramLabels
    .map((p) => ({ ...p, score: Number(summary[p.key] || 0) }))
    .filter((p) => p.score > 0)
    .sort((a, b) => a.score - b.score);

  const strengths = [...scoredParams].reverse().slice(0, 3);
  const improvements = scoredParams.slice(0, 3);

  res.json({
    faculty,
    subjects,
    summary,
    subjectBreakdown,
    performanceTrend,
    anonymousComments,
    strengths,
    improvements,
  });
});

// ============================================================================
// VITE / STATIC SERVING
// ============================================================================

async function startServer(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build not found');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Student Feedback System listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
