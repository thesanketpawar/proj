from pathlib import Path

content = r'''/**
 * Three-Tier DevOps Project - Backend API
 * Simple Employee Management REST API (Express + MySQL)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// ---- MySQL connection pool ----
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'mysql-service',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'rootpassword',
  database: process.env.DB_NAME || 'employeedb',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const db = pool.promise();

// ---- Retry DB connection on startup ----
async function waitForDb(retries = 10, delay = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      await db.query('SELECT 1');
      console.log('✅ Connected to MySQL database');
      return;
    } catch (err) {
      console.log(`⏳ Waiting for DB... attempt ${i + 1}/${retries}`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }

  console.error('❌ Could not connect to database after retries');
}

// ---- Routes ----
app.get('/', (req, res) => {
  res.json({
    message: 'Three-Tier Backend API is running',
    status: 'OK'
  });
});

// Kubernetes health probe endpoint
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.status(200).json({
      status: 'healthy',
      db: 'connected'
    });
  } catch (err) {
    res.status(500).json({
      status: 'unhealthy',
      db: 'disconnected',
      error: err.message
    });
  }
});

// Get all employees
app.get('/api/employees', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM employees ORDER BY id DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Failed to fetch employees'
    });
  }
});

// Add employee
app.post('/api/employees', async (req, res) => {
  try {
    const { name, role, department } = req.body;

    if (!name || !role || !department) {
      return res.status(400).json({
        error: 'name, role and department are required'
      });
    }

    const [result] = await db.query(
      'INSERT INTO employees (name, role, department) VALUES (?, ?, ?)',
      [name, role, department]
    );

    res.status(201).json({
      id: result.insertId,
      name,
      role,
      department
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Failed to add employee'
    });
  }
});

// Delete employee
app.delete('/api/employees/:id', async (req, res) => {
  try {
    await db.query(
      'DELETE FROM employees WHERE id = ?',
      [req.params.id]
    );

    res.json({
      message: 'Deleted successfully'
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Failed to delete employee'
    });
  }
});

// ---- Start server ----
let server;

if (require.main === module) {
  waitForDb();

  server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Backend server running on port ${PORT}`);
  });
}

module.exports = {
  app,
  server,
  pool
};
'''

path = Path("/mnt/data/server.js")
path.write_text(content, encoding="utf-8")

str(path)
