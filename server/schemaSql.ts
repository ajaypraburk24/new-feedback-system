export const MYSQL_SCHEMA_SQL = `-- ============================================================================
-- Student Feedback System — MySQL Relational Database Schema
-- Compatible with MySQL 8.0+ / MariaDB (XAMPP)
-- ============================================================================

CREATE DATABASE IF NOT EXISTS TeachersFeedbackSystem
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE TeachersFeedbackSystem;

-- 1. Departments Table
CREATE TABLE IF NOT EXISTS Departments (
  department_id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  department_name VARCHAR(120) NOT NULL,
  hod_name VARCHAR(100) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Admin Table
CREATE TABLE IF NOT EXISTS Admin (
  admin_id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role_title VARCHAR(80) DEFAULT 'System Administrator',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Students Table
CREATE TABLE IF NOT EXISTS Students (
  student_id INT AUTO_INCREMENT PRIMARY KEY,
  roll_no VARCHAR(30) NOT NULL UNIQUE,
  student_name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  department_id INT NOT NULL,
  semester INT NOT NULL CHECK (semester BETWEEN 1 AND 8),
  year INT NOT NULL CHECK (year BETWEEN 1 AND 4),
  phone VARCHAR(20) NULL,
  status ENUM('Active', 'Inactive') DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_student_dept FOREIGN KEY (department_id) REFERENCES Departments(department_id) ON DELETE RESTRICT
);

-- 4. Faculty Table
CREATE TABLE IF NOT EXISTS Faculty (
  faculty_id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id VARCHAR(30) NOT NULL UNIQUE,
  faculty_name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  department_id INT NOT NULL,
  designation VARCHAR(80) DEFAULT 'Assistant Professor',
  qualification VARCHAR(100) NULL,
  status ENUM('Active', 'On Leave') DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_faculty_dept FOREIGN KEY (department_id) REFERENCES Departments(department_id) ON DELETE RESTRICT
);

-- 5. Subjects Table
CREATE TABLE IF NOT EXISTS Subjects (
  subject_id INT AUTO_INCREMENT PRIMARY KEY,
  subject_code VARCHAR(20) NOT NULL UNIQUE,
  subject_name VARCHAR(120) NOT NULL,
  department_id INT NOT NULL,
  faculty_id INT NULL,
  semester INT NOT NULL CHECK (semester BETWEEN 1 AND 8),
  credits INT DEFAULT 4,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_subject_dept FOREIGN KEY (department_id) REFERENCES Departments(department_id) ON DELETE CASCADE,
  CONSTRAINT fk_subject_faculty FOREIGN KEY (faculty_id) REFERENCES Faculty(faculty_id) ON DELETE SET NULL
);

-- 6. FeedbackSession Table
CREATE TABLE IF NOT EXISTS FeedbackSession (
  session_id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  academic_year VARCHAR(20) NOT NULL,
  semester_type ENUM('Odd', 'Even') NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Feedback Table (Prevents duplicate submissions per session/student/faculty/subject)
CREATE TABLE IF NOT EXISTS Feedback (
  feedback_id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  student_id INT NOT NULL,
  faculty_id INT NOT NULL,
  subject_id INT NOT NULL,
  department_id INT NOT NULL,
  semester INT NOT NULL,
  teaching_quality TINYINT NOT NULL CHECK (teaching_quality BETWEEN 1 AND 5),
  subject_knowledge TINYINT NOT NULL CHECK (subject_knowledge BETWEEN 1 AND 5),
  communication_skills TINYINT NOT NULL CHECK (communication_skills BETWEEN 1 AND 5),
  classroom_interaction TINYINT NOT NULL CHECK (classroom_interaction BETWEEN 1 AND 5),
  punctuality TINYINT NOT NULL CHECK (punctuality BETWEEN 1 AND 5),
  preparation TINYINT NOT NULL CHECK (preparation BETWEEN 1 AND 5),
  doubt_clarification TINYINT NOT NULL CHECK (doubt_clarification BETWEEN 1 AND 5),
  teaching_method TINYINT NOT NULL CHECK (teaching_method BETWEEN 1 AND 5),
  practical_knowledge TINYINT NOT NULL CHECK (practical_knowledge BETWEEN 1 AND 5),
  overall_rating TINYINT NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  comments TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_feedback_once UNIQUE (session_id, student_id, faculty_id, subject_id),
  CONSTRAINT fk_fb_session FOREIGN KEY (session_id) REFERENCES FeedbackSession(session_id) ON DELETE CASCADE,
  CONSTRAINT fk_fb_student FOREIGN KEY (student_id) REFERENCES Students(student_id) ON DELETE CASCADE,
  CONSTRAINT fk_fb_faculty FOREIGN KEY (faculty_id) REFERENCES Faculty(faculty_id) ON DELETE CASCADE,
  CONSTRAINT fk_fb_subject FOREIGN KEY (subject_id) REFERENCES Subjects(subject_id) ON DELETE CASCADE,
  CONSTRAINT fk_fb_dept FOREIGN KEY (department_id) REFERENCES Departments(department_id) ON DELETE CASCADE
);

-- 8. LoginHistory Table
CREATE TABLE IF NOT EXISTS LoginHistory (
  history_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  user_role ENUM('admin', 'student', 'faculty') NOT NULL,
  user_email VARCHAR(120) NOT NULL,
  ip_address VARCHAR(45) NULL,
  status ENUM('Success', 'Failed') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Notifications Table
CREATE TABLE IF NOT EXISTS Notifications (
  notification_id INT AUTO_INCREMENT PRIMARY KEY,
  user_role ENUM('admin', 'student', 'faculty', 'all') NOT NULL,
  user_id INT NULL,
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('info', 'success', 'warning') DEFAULT 'info',
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;
