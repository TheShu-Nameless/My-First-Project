-- 门诊预约与智能分诊辅助系统（MySQL 8+）
-- 连接参数：127.0.0.1:1111 / root / 123123

CREATE DATABASE IF NOT EXISTS tcm_ai_review DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE tcm_ai_review;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS inquiry;
DROP TABLE IF EXISTS medical_record;
DROP TABLE IF EXISTS appointment;
DROP TABLE IF EXISTS schedule;
DROP TABLE IF EXISTS doctor;
DROP TABLE IF EXISTS announcement;
DROP TABLE IF EXISTS department;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS system_settings;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role ENUM('admin','staff','doctor','patient') NOT NULL DEFAULT 'patient',
  phone VARCHAR(30) NULL DEFAULT NULL,
  student_no VARCHAR(64) NULL DEFAULT NULL,
  gender ENUM('male','female','unknown') NOT NULL DEFAULT 'unknown',
  register_ip VARCHAR(64) NULL DEFAULT NULL,
  last_login_ip VARCHAR(64) NULL DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_username (username),
  UNIQUE KEY uk_users_student_no (student_no),
  KEY idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE department (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(255) NULL DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_department_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE doctor (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  department_id INT UNSIGNED NOT NULL,
  title VARCHAR(80) NULL DEFAULT NULL,
  specialty VARCHAR(255) NULL DEFAULT NULL,
  intro TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_doctor_user (user_id),
  KEY idx_doctor_department (department_id),
  CONSTRAINT fk_doctor_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_doctor_department FOREIGN KEY (department_id) REFERENCES department (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE schedule (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  doctor_id INT UNSIGNED NOT NULL,
  schedule_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  total_quota INT UNSIGNED NOT NULL DEFAULT 20,
  used_quota INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('draft','published','closed') NOT NULL DEFAULT 'published',
  created_by INT UNSIGNED NULL DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_schedule_unique (doctor_id, schedule_date, start_time, end_time),
  KEY idx_schedule_date (schedule_date),
  KEY idx_schedule_status (status),
  CONSTRAINT fk_schedule_doctor FOREIGN KEY (doctor_id) REFERENCES doctor (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_schedule_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE appointment (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  schedule_id INT UNSIGNED NOT NULL,
  symptom TEXT NULL,
  status ENUM('booked','checked_in','completed','cancelled') NOT NULL DEFAULT 'booked',
  cancel_reason VARCHAR(255) NULL DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_appointment_user (user_id),
  KEY idx_appointment_schedule (schedule_id),
  KEY idx_appointment_status (status),
  CONSTRAINT fk_appointment_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_appointment_schedule FOREIGN KEY (schedule_id) REFERENCES schedule (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE medical_record (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  appointment_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  doctor_id INT UNSIGNED NOT NULL,
  diagnosis TEXT NOT NULL,
  prescription TEXT NULL,
  advice TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_record_appointment (appointment_id),
  KEY idx_record_user (user_id),
  KEY idx_record_doctor (doctor_id),
  CONSTRAINT fk_record_appointment FOREIGN KEY (appointment_id) REFERENCES appointment (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_record_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_record_doctor FOREIGN KEY (doctor_id) REFERENCES doctor (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE inquiry (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  symptom TEXT NOT NULL,
  suggestion TEXT NOT NULL,
  recommended_department_id INT UNSIGNED NULL DEFAULT NULL,
  confidence DECIMAL(5,2) NULL DEFAULT NULL,
  raw_result JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_inquiry_user (user_id),
  KEY idx_inquiry_department (recommended_department_id),
  CONSTRAINT fk_inquiry_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_inquiry_department FOREIGN KEY (recommended_department_id) REFERENCES department (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE announcement (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(160) NOT NULL,
  content TEXT NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT UNSIGNED NULL DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_announcement_active (is_active),
  CONSTRAINT fk_announcement_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE system_settings (
  `key` VARCHAR(100) NOT NULL,
  value TEXT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
