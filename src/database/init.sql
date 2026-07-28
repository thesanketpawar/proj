-- ============================================
-- Three-Tier Project - Database Initialization
-- This runs automatically on first MySQL container start
-- ============================================

CREATE DATABASE IF NOT EXISTS employeedb;
USE employeedb;

CREATE TABLE IF NOT EXISTS employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO employees (name, role, department) VALUES
('Sanket Patel', 'DevOps Engineer', 'Infrastructure'),
('Priya Sharma', 'Backend Developer', 'Engineering'),
('Rahul Verma', 'Frontend Developer', 'Engineering');
