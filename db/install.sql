-- /modules/objects/db/install.sql

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Roles for Objects Module
INSERT IGNORE INTO `roles` (`role_name`) VALUES 
('objects_admin'),
('objects_editor'),
('objects_viewer');

-- 2. Clients Table
CREATE TABLE IF NOT EXISTS `clients_main` (
    `client_id` INT AUTO_INCREMENT PRIMARY KEY,
    `client_name` VARCHAR(255) NOT NULL,
    `client_address` TEXT,
    `primary_contact_name` VARCHAR(255) NOT NULL,
    `primary_contact_phone` VARCHAR(50) NOT NULL,
    `primary_contact_email` VARCHAR(255) NOT NULL,
    `primary_contact_notes` TEXT DEFAULT NULL,
    `additional_contacts` JSON DEFAULT NULL,
    `general_notes` TEXT DEFAULT NULL,
    `internal_notes` TEXT DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_client_name` (`client_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Heavy Machines Table
CREATE TABLE IF NOT EXISTS `heavy_machines` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `machine_name` VARCHAR(255) NOT NULL,
    `date_created` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `date_modified` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Activity Types Table
CREATE TABLE IF NOT EXISTS `objects_activity_types` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `activity_name` VARCHAR(255) NOT NULL COMMENT 'Име на дейността',
  `unit_of_measure` VARCHAR(50) NOT NULL COMMENT 'Мерна единица',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initial data for activity types
INSERT IGNORE INTO `objects_activity_types` (`id`, `activity_name`, `unit_of_measure`) VALUES
(1, 'Профили', 'бр'),
(2, 'Обединителна греда', 'м'),
(3, 'Талпи', 'м3'),
(4, 'Мрежи', 'бр'),
(5, 'Почвени гвоздеи', 'бр'),
(6, 'Анкери', 'бр'),
(7, 'Армопакети', 'бр'),
(9, 'Торкрет', 'м3'),
(10, 'Сондиране', 'м');

-- 5. Project Schedules Table
CREATE TABLE IF NOT EXISTS `objects_project_schedules` (
  `schedule_id` INT NOT NULL AUTO_INCREMENT,
  `client_id` INT DEFAULT NULL COMMENT 'Опционално - клиентът вече не се избира при създаване на обект',
  `request_id` INT NOT NULL,
  `activity_type_id` INT DEFAULT NULL COMMENT 'Връзка с objects_activity_types',
  `capability_name` VARCHAR(255) DEFAULT NULL,
  `activity_subtype` VARCHAR(255) DEFAULT NULL COMMENT 'Вид дейност',
  `total_quantity` DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Общо количество (напр. 120)',
  `dimension_info` DECIMAL(10,2) DEFAULT NULL COMMENT 'Допълнителен размер (напр. 18 за 18м)',
  `daily_productivity_plan` DECIMAL(10,2) NOT NULL COMMENT 'План за дневна производителност (напр. 20)',
  `planned_days` DECIMAL(10,2) NOT NULL COMMENT 'Планувани дни по договор',
  `estimated_start_date` DATE DEFAULT NULL COMMENT 'Прогнозна начална дата',
  `start_date` DATE DEFAULT NULL COMMENT 'Старт на обекта от дата',
  `estimated_end_date` DATE DEFAULT NULL COMMENT 'Прогнозна крайна дата',
  `end_date` DATE DEFAULT NULL COMMENT 'Крайна дата',
  `status` VARCHAR(100) DEFAULT 'не стартирали' COMMENT 'Статус',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
  PRIMARY KEY (`schedule_id`),
  CONSTRAINT `fk_ops_client` FOREIGN KEY (`client_id`) REFERENCES `clients_main` (`client_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ops_request` FOREIGN KEY (`request_id`) REFERENCES `requests_main` (`request_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ops_activity` FOREIGN KEY (`activity_type_id`) REFERENCES `objects_activity_types` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Machine Movements Table
CREATE TABLE IF NOT EXISTS `objects_machine_movements` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `schedule_id` INT DEFAULT NULL,
    `movement_date` DATE NOT NULL,
    `arrival_date` DATE DEFAULT NULL,
    `departure_date` DATE DEFAULT NULL,
    `machine_id` INT NOT NULL, 
    `from_site_id` INT DEFAULT NULL, 
    `to_site_id` INT DEFAULT NULL, 
    `departure_from` VARCHAR(255) DEFAULT NULL,
    `arrive_to` VARCHAR(255) DEFAULT NULL,
    `carrier` VARCHAR(255) DEFAULT NULL,
    `notes` TEXT DEFAULT NULL,
    `date_created` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `date_modified` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`machine_id`) REFERENCES `heavy_machines`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`from_site_id`) REFERENCES `requests_main`(`request_id`) ON DELETE CASCADE,
    FOREIGN KEY (`to_site_id`) REFERENCES `requests_main`(`request_id`) ON DELETE CASCADE,
    FOREIGN KEY (`schedule_id`) REFERENCES `objects_project_schedules`(`schedule_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Machine Assignments Table (Multi-machine & History)
CREATE TABLE IF NOT EXISTS `objects_machine_assignments` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `schedule_id` INT NOT NULL,
    `machine_id` INT NOT NULL,
    `start_date` DATE DEFAULT NULL,
    `end_date` DATE DEFAULT NULL,
    `movement_id` INT DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`schedule_id`) REFERENCES `objects_project_schedules`(`schedule_id`) ON DELETE CASCADE,
    FOREIGN KEY (`machine_id`) REFERENCES `heavy_machines`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`movement_id`) REFERENCES `objects_machine_movements`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Daily Progress Logs Table
CREATE TABLE IF NOT EXISTS `objects_daily_progress_logs` (
  `log_id` INT NOT NULL AUTO_INCREMENT,
  `schedule_id` INT NOT NULL COMMENT 'Връзка с objects_project_schedules',
  `work_date` DATE NOT NULL COMMENT 'Дата на отчета',
  `quantity_completed` DECIMAL(10,2) NOT NULL COMMENT 'Изработено количество за деня',
  `notes` TEXT DEFAULT NULL COMMENT 'Забележка/Обяснение при проблеми или изоставане',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
  `updated_by` INT DEFAULT NULL COMMENT 'ID на потребителя, въвел данните',
  PRIMARY KEY (`log_id`),
  CONSTRAINT `fk_log_schedule` FOREIGN KEY (`schedule_id`) REFERENCES `objects_project_schedules` (`schedule_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Schedule Notes Table
CREATE TABLE IF NOT EXISTS `objects_schedule_notes` (
  `note_id` INT NOT NULL AUTO_INCREMENT,
  `schedule_id` INT NOT NULL,
  `category` ENUM('quantity', 'plan', 'period', 'estimated_start', 'estimated_end', 'end', 'status', 'general') NOT NULL COMMENT 'За коя колона се отнася',
  `note_text` TEXT NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
  `created_by` INT DEFAULT NULL,
  PRIMARY KEY (`note_id`),
  CONSTRAINT `fk_schedule_note` FOREIGN KEY (`schedule_id`) REFERENCES `objects_project_schedules` (`schedule_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Machine Schedules Table
CREATE TABLE IF NOT EXISTS `objects_machine_schedules` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `machine_id` INT NOT NULL,
  `request_id` INT DEFAULT NULL COMMENT 'Връзка с requests_main (Обект)',
  `object_name` VARCHAR(255) DEFAULT NULL COMMENT 'Ръчно въведено име на обект (за прогнози)',
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `notes` TEXT,
  `activity_type_id` INT DEFAULT NULL,
  `capability_name` VARCHAR(255) DEFAULT NULL,
  `activity_subtype` VARCHAR(255) DEFAULT NULL,
  `status` ENUM('completed','active','upcoming') NOT NULL DEFAULT 'upcoming',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP(),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_ms_machine` FOREIGN KEY (`machine_id`) REFERENCES `heavy_machines`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ms_request` FOREIGN KEY (`request_id`) REFERENCES `requests_main`(`request_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Machine Activities Table
CREATE TABLE IF NOT EXISTS `objects_machine_activities` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `machine_id` INT NOT NULL,
  `activity_type_id` INT NOT NULL,
  `capability_name` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_ma_machine` FOREIGN KEY (`machine_id`) REFERENCES `heavy_machines` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ma_activity` FOREIGN KEY (`activity_type_id`) REFERENCES `objects_activity_types` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

