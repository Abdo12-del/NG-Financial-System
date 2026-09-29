-- Seed Data for NG Financial System

USE `ng_financial`;

-- 1. Default Admin User (Password: admin123, hashed with bcrypt)
INSERT INTO `users` (`id`, `username`, `password_hash`, `full_name`, `role`, `is_active`) VALUES
(1, 'admin', '$2b$10$j914DCkfbxNPVuBG1CgOgu2ZlzfYf4TrTndTSrwmwJ/5bz28Nb1Ha', 'مدير النظام - NG Academy', 'admin', 1)
ON DUPLICATE KEY UPDATE `full_name`=VALUES(`full_name`);

-- 2. Financial Accounts
INSERT INTO `financial_accounts` (`id`, `code`, `name_ar`, `name_en`, `account_type`, `balance`, `is_active`) VALUES
(1, 'CASH_SAFE', 'الخزينة النقدية (الصندوق الرئيسي)', 'Main Cash Safe', 'CASH', 0.00, 1),
(2, 'CCP_ACCOUNT', 'حساب البريد الجاري (CCP)', 'Post Office CCP Account', 'CCP', 0.00, 1),
(3, 'BANK_ACCOUNT', 'الحساب البنكي', 'Bank Account', 'BANK', 0.00, 1),
(4, 'DIGITAL_WALLET', 'المحفظة الإلكترونية', 'Digital Wallet / BaridiMob', 'DIGITAL', 0.00, 1)
ON DUPLICATE KEY UPDATE `name_ar`=VALUES(`name_ar`);

-- 3. Payment Methods
INSERT INTO `payment_methods` (`id`, `code`, `name_ar`, `name_en`, `default_account_id`, `is_active`) VALUES
(1, 'CASH', 'نقدًا', 'Cash', 1, 1),
(2, 'CCP', 'CCP', 'CCP', 2, 1),
(3, 'BANK_TRANSFER', 'تحويل بنكي', 'Bank Transfer', 3, 1),
(4, 'ELECTRONIC_TRANSFER', 'تحويل إلكتروني', 'Electronic Transfer', 4, 1),
(5, 'OTHER', 'أخرى', 'Other', 1, 1)
ON DUPLICATE KEY UPDATE `name_ar`=VALUES(`name_ar`);

-- 4. Expense Categories
INSERT INTO `expense_categories` (`id`, `name`, `is_system`, `is_active`) VALUES
(1, 'أجور الأساتذة', 1, 1),
(2, 'الإعلانات', 1, 1),
(3, 'المنصات والخدمات', 1, 1),
(4, 'البرامج والاشتراكات', 1, 1),
(5, 'المعدات', 1, 1),
(6, 'المصاريف الإدارية', 1, 1),
(7, 'التسويق', 1, 1),
(8, 'أخرى', 1, 1)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

-- 5. System Settings
INSERT INTO `settings` (`key_name`, `value_data`, `description`) VALUES
('currency_code', 'DZD', 'رمز العملة الرسمية للنظام'),
('academy_name', 'NG Academy', 'اسم الأكاديمية'),
('allow_overpayment', 'false', 'السماح بالدفع الزائد عن السعر المستحق'),
('mariadb_host', 'localhost', 'عنوان خادم MariaDB المحلي'),
('mariadb_port', '3306', 'منفذ خادم MariaDB المحلي'),
('mariadb_database', 'ng_financial', 'اسم قاعدة البيانات'),
('mariadb_user', 'root', 'اسم مستخدم قاعدة البيانات'),
('theme_color', '#38B6FF', 'اللون الأساسي للنظام')
ON DUPLICATE KEY UPDATE `value_data`=VALUES(`value_data`);
