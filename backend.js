const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 5500;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize SQLite Database
const db = new sqlite3.Database('./hospital.db', (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

// Create tables
function initializeDatabase() {
    db.run(`
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      age INTEGER NOT NULL,
      gender TEXT NOT NULL,
      department TEXT NOT NULL,
      contact TEXT NOT NULL,
      status TEXT DEFAULT 'waiting',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      doctor_name TEXT,
      notes TEXT,
      status TEXT DEFAULT 'waiting',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id)
    )
  `);
}

// API Routes

// Get all patients
app.get('/api/patients', (req, res) => {
    const { department, status, date } = req.query;
    let query = 'SELECT * FROM patients WHERE 1=1';
    const params = [];

    if (department && department !== 'all') {
        query += ' AND department = ?';
        params.push(department);
    }

    if (status) {
        query += ' AND status = ?';
        params.push(status);
    }

    if (date) {
        query += ' AND DATE(created_at) = DATE(?)';
        params.push(date);
    }

    query += ' ORDER BY created_at DESC';

    db.all(query, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

// Get patient by ID
app.get('/api/patients/:id', (req, res) => {
    db.get('SELECT * FROM patients WHERE id = ?', [req.params.id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (!row) {
            res.status(404).json({ error: 'Patient not found' });
        } else {
            res.json(row);
        }
    });
});

// Create new patient
app.post('/api/patients', (req, res) => {
    const { name, age, gender, department, contact } = req.body;

    if (!name || !age || !gender || !department || !contact) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const query = `
    INSERT INTO patients (name, age, gender, department, contact, status)
    VALUES (?, ?, ?, ?, ?, 'waiting')
  `;

    db.run(query, [name, age, gender, department, contact], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.status(201).json({
                id: this.lastID,
                name,
                age,
                gender,
                department,
                contact,
                status: 'waiting'
            });
        }
    });
});

// Update patient status
app.patch('/api/patients/:id/status', (req, res) => {
    const { status } = req.body;
    const validStatuses = ['waiting', 'in_progress', 'completed'];

    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    const query = `
    UPDATE patients 
    SET status = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `;

    db.run(query, [status, req.params.id], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (this.changes === 0) {
            res.status(404).json({ error: 'Patient not found' });
        } else {
            res.json({ id: req.params.id, status });
        }
    });
});

// Get dashboard statistics
app.get('/api/dashboard/stats', (req, res) => {
    const { department, date } = req.query;
    const today = date || new Date().toISOString().split('T')[0];

    let baseQuery = 'SELECT status, COUNT(*) as count FROM patients WHERE DATE(created_at) = DATE(?)';
    const params = [today];

    if (department && department !== 'all') {
        baseQuery += ' AND department = ?';
        params.push(department);
    }

    baseQuery += ' GROUP BY status';

    db.all(baseQuery, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            const stats = {
                waiting: 0,
                in_progress: 0,
                completed: 0,
                total: 0
            };

            rows.forEach(row => {
                stats[row.status] = row.count;
                stats.total += row.count;
            });

            res.json(stats);
        }
    });
});

// Get today's queue
app.get('/api/queue/today', (req, res) => {
    const { department } = req.query;
    const today = new Date().toISOString().split('T')[0];

    let query = `
    SELECT * FROM patients 
    WHERE DATE(created_at) = DATE(?) 
    AND status IN ('waiting', 'in_progress')
  `;
    const params = [today];

    if (department && department !== 'all') {
        query += ' AND department = ?';
        params.push(department);
    }

    query += ' ORDER BY created_at ASC';

    db.all(query, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

// Delete patient
app.delete('/api/patients/:id', (req, res) => {
    db.run('DELETE FROM patients WHERE id = ?', [req.params.id], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (this.changes === 0) {
            res.status(404).json({ error: 'Patient not found' });
        } else {
            res.json({ message: 'Patient deleted successfully' });
        }
    });
});

// Get departments list
app.get('/api/departments', (req, res) => {
    const departments = [
        'General',
        'ENT',
        'Cardiology',
        'Orthopedics',
        'Pediatrics',
        'Dermatology',
        'Neurology'
    ];
    res.json(departments);
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve HTML pages
app.get('/patient.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'patient.html'));
});

app.get('/doctor.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'doctor.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://127.0.0.1:${PORT}`);
    console.log(`Patient Registration: http://127.0.0.1:${PORT}/patient.html`);
    console.log(`Doctor Dashboard: http://127.0.0.1:${PORT}/doctor.html`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('Database connection closed');
        }
        process.exit(0);
    });
});