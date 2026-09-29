-- =====================================================================
-- NG Financial System - MariaDB 10.11.7 Winx64 Schema
-- نظام الإدارة المالية لأكاديمية NG Academy
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `ng_financial`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `ng_financial`;

-- 1. جدول المستخدمين والصلاحيات
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(100) NOT NULL,
  `role` ENUM('admin', 'manager', 'viewer') NOT NULL DEFAULT 'viewer',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. جدول الحسابات المالية (الخزينة، الحسابات البنكية، البريد)
CREATE TABLE IF NOT EXISTS `financial_accounts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(30) NOT NULL UNIQUE,
  `name_ar` VARCHAR(100) NOT NULL,
  `name_en` VARCHAR(100) NOT NULL,
  `account_type` ENUM('CASH', 'CCP', 'BANK', 'DIGITAL') NOT NULL DEFAULT 'CASH',
  `balance` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. جدول طرق ووسائل الدفع
CREATE TABLE IF NOT EXISTS `payment_methods` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(30) NOT NULL UNIQUE,
  `name_ar` VARCHAR(100) NOT NULL,
  `name_en` VARCHAR(100) NOT NULL,
  `default_account_id` INT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (`default_account_id`) REFERENCES `financial_accounts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. جدول تصنيفات المصروفات (قابلة للإضافة والتعديل)
CREATE TABLE IF NOT EXISTS `expense_categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE,
  `is_system` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. جدول الدورات التدريبية
CREATE TABLE IF NOT EXISTS `courses` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `default_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `age_group` VARCHAR(100) NULL,
  `duration` VARCHAR(100) NULL,
  `description` TEXT NULL,
  `status` ENUM('active', 'completed', 'archived') NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. جدول الأساتذة والمؤطرين
CREATE TABLE IF NOT EXISTS `teachers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `full_name` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(50) NULL,
  `email` VARCHAR(100) NULL,
  `specialty` VARCHAR(100) NULL,
  `notes` TEXT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. جدول الأفواج (Cohorts) ونظام أجر الأستاذ المخصص لكل فوج
CREATE TABLE IF NOT EXISTS `cohorts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `course_id` INT NOT NULL,
  `teacher_id` INT NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `start_date` DATE NULL,
  `end_date` DATE NULL,
  `max_students` INT NOT NULL DEFAULT 20,
  `compensation_type` ENUM('PERCENTAGE', 'FIXED') NOT NULL DEFAULT 'PERCENTAGE',
  `compensation_value` DECIMAL(12,2) NOT NULL DEFAULT 60.00,
  `status` ENUM('upcoming', 'active', 'completed', 'cancelled') NOT NULL DEFAULT 'active',
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`id`) ON DELETE RESTRICT,
  INDEX `idx_cohorts_course` (`course_id`),
  INDEX `idx_cohorts_teacher` (`teacher_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. جدول الطلاب
CREATE TABLE IF NOT EXISTS `students` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `full_name` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(50) NULL,
  `guardian_phone` VARCHAR(50) NULL,
  `email` VARCHAR(100) NULL,
  `notes` TEXT NULL,
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. جدول تسجيل الطلاب في الأفواج (Enrollments)
CREATE TABLE IF NOT EXISTS `enrollments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `student_id` INT NOT NULL,
  `cohort_id` INT NOT NULL,
  `agreed_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `net_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `paid_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `remaining_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `payment_status` ENUM('PAID', 'PARTIAL', 'UNPAID', 'OVERDUE') NOT NULL DEFAULT 'UNPAID',
  `enrollment_date` DATE NOT NULL,
  `status` ENUM('enrolled', 'completed', 'dropped') NOT NULL DEFAULT 'enrolled',
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`cohort_id`) REFERENCES `cohorts` (`id`) ON DELETE RESTRICT,
  UNIQUE KEY `uniq_student_cohort` (`student_id`, `cohort_id`),
  INDEX `idx_enrollments_payment_status` (`payment_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. جدول مدفوعات الطلاب (إيرادات التشغيل)
CREATE TABLE IF NOT EXISTS `payments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `payment_code` VARCHAR(40) NOT NULL UNIQUE,
  `enrollment_id` INT NOT NULL,
  `student_id` INT NOT NULL,
  `cohort_id` INT NOT NULL,
  `financial_account_id` INT NOT NULL,
  `payment_method_id` INT NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `payment_date` DATE NOT NULL,
  `reference_no` VARCHAR(100) NULL,
  `notes` TEXT NULL,
  `status` ENUM('completed', 'voided') NOT NULL DEFAULT 'completed',
  `void_reason` TEXT NULL,
  `voided_at` DATETIME NULL,
  `voided_by` INT NULL,
  `created_by` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`cohort_id`) REFERENCES `cohorts` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`financial_account_id`) REFERENCES `financial_accounts` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  INDEX `idx_payments_date` (`payment_date`),
  INDEX `idx_payments_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. جدول المصروفات التشغيلية
CREATE TABLE IF NOT EXISTS `expenses` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `expense_code` VARCHAR(40) NOT NULL UNIQUE,
  `category_id` INT NOT NULL,
  `financial_account_id` INT NOT NULL,
  `payment_method_id` INT NOT NULL,
  `cohort_id` INT NULL,
  `teacher_id` INT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `expense_date` DATE NOT NULL,
  `description` VARCHAR(255) NOT NULL,
  `reference_no` VARCHAR(100) NULL,
  `notes` TEXT NULL,
  `status` ENUM('completed', 'voided') NOT NULL DEFAULT 'completed',
  `void_reason` TEXT NULL,
  `voided_at` DATETIME NULL,
  `voided_by` INT NULL,
  `created_by` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`category_id`) REFERENCES `expense_categories` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`financial_account_id`) REFERENCES `financial_accounts` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`cohort_id`) REFERENCES `cohorts` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  INDEX `idx_expenses_date` (`expense_date`),
  INDEX `idx_expenses_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. جدول الحساب الجاري للمالك (ضخ وسحب - مفصول محاسبياً تماماً عن الإيرادات والمصروفات)
CREATE TABLE IF NOT EXISTS `owner_transactions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `transaction_code` VARCHAR(40) NOT NULL UNIQUE,
  `transaction_type` ENUM('CONTRIBUTION', 'WITHDRAWAL') NOT NULL,
  `financial_account_id` INT NOT NULL,
  `payment_method_id` INT NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `transaction_date` DATE NOT NULL,
  `reference_no` VARCHAR(100) NULL,
  `notes` TEXT NULL,
  `status` ENUM('completed', 'voided') NOT NULL DEFAULT 'completed',
  `void_reason` TEXT NULL,
  `voided_at` DATETIME NULL,
  `voided_by` INT NULL,
  `created_by` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`financial_account_id`) REFERENCES `financial_accounts` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  INDEX `idx_owner_tx_date` (`transaction_date`),
  INDEX `idx_owner_tx_type` (`transaction_type`),
  INDEX `idx_owner_tx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. دفتر الأستاذ المالي الموحد (Financial Ledger)
-- هذا الجدول هو المصدر الحقيقي لجميع التقارير والأرصدة لضمان الاتساق المحاسبي وعدم التناقض
CREATE TABLE IF NOT EXISTS `financial_ledger` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `entry_code` VARCHAR(50) NOT NULL UNIQUE,
  `entry_date` DATE NOT NULL,
  `ledger_category` ENUM(
    'STUDENT_PAYMENT',
    'OPERATING_EXPENSE',
    'TEACHER_PAYOUT',
    'OWNER_CONTRIBUTION',
    'OWNER_WITHDRAWAL',
    'VOID_REVERSAL'
  ) NOT NULL,
  `source_table` VARCHAR(50) NOT NULL,
  `source_id` INT NOT NULL,
  `financial_account_id` INT NOT NULL,
  `debit_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,  -- تدفق نقدي وارد للنظام Cash In
  `credit_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00, -- تدفق نقدي خارج من النظام Cash Out
  `cohort_id` INT NULL,
  `teacher_id` INT NULL,
  `student_id` INT NULL,
  `is_operating_revenue` TINYINT(1) NOT NULL DEFAULT 0,
  `is_operating_expense` TINYINT(1) NOT NULL DEFAULT 0,
  `is_owner_equity` TINYINT(1) NOT NULL DEFAULT 0,
  `is_voided` TINYINT(1) NOT NULL DEFAULT 0,
  `reversal_entry_id` INT NULL,
  `description` VARCHAR(255) NOT NULL,
  `created_by` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`financial_account_id`) REFERENCES `financial_accounts` (`id`) ON DELETE RESTRICT,
  INDEX `idx_ledger_date` (`entry_date`),
  INDEX `idx_ledger_category` (`ledger_category`),
  INDEX `idx_ledger_operating` (`is_operating_revenue`, `is_operating_expense`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. جدول استحقاقات الأساتذة وتسوياتها (Teacher Compensations Ledger)
CREATE TABLE IF NOT EXISTS `teacher_compensations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `cohort_id` INT NOT NULL,
  `teacher_id` INT NOT NULL,
  `payment_id` INT NULL,
  `expense_id` INT NULL,
  `entry_type` ENUM('ACCRUAL', 'PAYOUT', 'VOID_REVERSAL') NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `calculation_basis` VARCHAR(255) NOT NULL,
  `entry_date` DATE NOT NULL,
  `status` ENUM('active', 'voided') NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`cohort_id`) REFERENCES `cohorts` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`expense_id`) REFERENCES `expenses` (`id`) ON DELETE SET NULL,
  INDEX `idx_tc_cohort` (`cohort_id`),
  INDEX `idx_tc_teacher` (`teacher_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. جدول سجل التدقيق والمراقبة (Audit Log)
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL,
  `username` VARCHAR(50) NOT NULL,
  `action_type` ENUM('CREATE', 'UPDATE', 'VOID', 'DELETE', 'LOGIN', 'BACKUP', 'RESTORE') NOT NULL,
  `entity_name` VARCHAR(50) NOT NULL,
  `entity_id` INT NULL,
  `old_values` LONGTEXT NULL,
  `new_values` LONGTEXT NULL,
  `details` VARCHAR(255) NULL,
  `ip_address` VARCHAR(50) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_audit_created` (`created_at`),
  INDEX `idx_audit_action` (`action_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. جدول إعدادات النظام
CREATE TABLE IF NOT EXISTS `settings` (
  `key_name` VARCHAR(100) PRIMARY KEY,
  `value_data` TEXT NOT NULL,
  `description` VARCHAR(255) NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
