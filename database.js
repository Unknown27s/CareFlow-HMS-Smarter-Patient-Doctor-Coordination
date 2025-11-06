// ==================== database.js ====================

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class Database {
    constructor() {
        // Create data directory if it doesn't exist
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir);
        }
        
        // Initialize database
        const dbPath = path.join(dataDir, 'hospital.db');
        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err);
            } else {
                console.log('✅ Connected to SQLite database');
                this.initializeTables();
            }
        });
    }
    
    // Initialize database tables
    initializeTables() {
        // Patients table (stores patient master data)
        this.db.run(`
            CREATE TABLE IF NOT EXISTS patients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                age INTEGER NOT NULL,
                gender TEXT NOT NULL,
                contact TEXT UNIQUE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_visit DATETIME DEFAULT CURRENT_TIMESTAMP,
                visit_count INTEGER DEFAULT 1
            )
        `);
        
        // Queue table (stores daily queue entries)
        this.db.run(`
            CREATE TABLE IF NOT EXISTS queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER NOT NULL,
                token TEXT NOT NULL,
                department TEXT NOT NULL,
                symptoms TEXT,
                status TEXT DEFAULT 'Waiting',
                registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                called_at DATETIME,
                completed_at DATETIME,
                FOREIGN KEY (patient_id) REFERENCES patients(id)
            )
        `);
        
        // Create index for faster queries
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_queue_date 
                     ON queue(registered_at)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_queue_department 
                     ON queue(department)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_queue_status 
                     ON queue(status)`);
    }
    
    // Promisify database operations
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }
    
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }
    
    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
    
    // Add new patient or update existing
    async addPatient(patientData) {
        const { name, age, gender, contact } = patientData;
        
        try {
            const result = await this.run(`
                INSERT INTO patients (name, age, gender, contact)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(contact) DO UPDATE SET
                    last_visit = CURRENT_TIMESTAMP,
                    visit_count = visit_count + 1
            `, [name, age, gender, contact]);
            
            // Get the patient ID
            const patient = await this.get(
                'SELECT id FROM patients WHERE contact = ?',
                [contact]
            );
            
            return patient.id;
        } catch (error) {
            console.error('Error adding patient:', error);
            throw error;
        }
    }
    
    // Get patient by contact number
    async getPatientByContact(contact) {
        return await this.get(
            'SELECT * FROM patients WHERE contact = ?',
            [contact]
        );
    }
    
    // Generate token for department
    async generateToken(department) {
        const today = new Date().toISOString().split('T')[0];
        
        // Count today's tokens for this department
        const result = await this.get(`
            SELECT COUNT(*) as count 
            FROM queue 
            WHERE department = ? 
            AND DATE(registered_at) = ?
        `, [department, today]);
        
        const tokenNumber = String(result.count + 1).padStart(3, '0');
        return `${department}${tokenNumber}`;
    }
    
    // Add patient to queue
    async addToQueue(queueData) {
        const { patientId, token, department, symptoms, status } = queueData;
        
        const result = await this.run(`
            INSERT INTO queue (patient_id, token, department, symptoms, status)
            VALUES (?, ?, ?, ?, ?)
        `, [patientId, token, department, symptoms, status]);
        
        return { id: result.lastID };
    }
    
    // Get today's queue with patient details
    async getTodayQueue() {
        const today = new Date().toISOString().split('T')[0];
        
        return await this.all(`
            SELECT 
                q.id as queue_id,
                q.token,
                q.department,
                q.symptoms,
                q.status,
                q.registered_at,
                q.called_at,
                q.completed_at,
                p.id as patient_id,
                p.name,
                p.age,
                p.gender,
                p.contact,
                p.visit_count
            FROM queue q
            JOIN patients p ON q.patient_id = p.id
            WHERE DATE(q.registered_at) = ?
            ORDER BY q.registered_at ASC
        `, [today]);
    }
    
    // Get queue by department
    async getQueueByDepartment(department) {
        const today = new Date().toISOString().split('T')[0];
        
        return await this.all(`
            SELECT 
                q.id as queue_id,
                q.token,
                q.department,
                q.symptoms,
                q.status,
                q.registered_at,
                p.id as patient_id,
                p.name,
                p.age,
                p.gender,
                p.contact,
                p.visit_count
            FROM queue q
            JOIN patients p ON q.patient_id = p.id
            WHERE q.department = ?
            AND DATE(q.registered_at) = ?
            ORDER BY q.registered_at ASC
        `, [department, today]);
    }
    
    // Get queue position
    async getQueuePosition(token, department) {
        const today = new Date().toISOString().split('T')[0];
        
        const result = await this.get(`
            SELECT COUNT(*) as position
            FROM queue
            WHERE department = ?
            AND status = 'Waiting'
            AND token < ?
            AND DATE(registered_at) = ?
        `, [department, token, today]);
        
        return result.position;
    }
    
    // Update queue status
    async updateQueueStatus(queueId, status) {
        const timestamp = new Date().toISOString();
        
        let updateField = '';
        if (status === 'In Progress') {
            updateField = ', called_at = ?';
        } else if (status === 'Completed') {
            updateField = ', completed_at = ?';
        }
        
        const sql = `UPDATE queue SET status = ?${updateField} WHERE id = ?`;
        const params = updateField 
            ? [status, timestamp, queueId] 
            : [status, queueId];
        
        return await this.run(sql, params);
    }
    
    // Get patient history
    async getPatientHistory(patientId) {
        return await this.all(`
            SELECT 
                q.token,
                q.department,
                q.symptoms,
                q.status,
                q.registered_at,
                q.completed_at
            FROM queue q
            WHERE q.patient_id = ?
            ORDER BY q.registered_at DESC
            LIMIT 10
        `, [patientId]);
    }
    
    // Get statistics
    async getStatistics() {
        const today = new Date().toISOString().split('T')[0];
        
        const waiting = await this.get(`
            SELECT COUNT(*) as count 
            FROM queue 
            WHERE status = 'Waiting' 
            AND DATE(registered_at) = ?
        `, [today]);
        
        const inProgress = await this.get(`
            SELECT COUNT(*) as count 
            FROM queue 
            WHERE status = 'In Progress' 
            AND DATE(registered_at) = ?
        `, [today]);
        
        const completed = await this.get(`
            SELECT COUNT(*) as count 
            FROM queue 
            WHERE status = 'Completed' 
            AND DATE(registered_at) = ?
        `, [today]);
        
        const totalToday = await this.get(`
            SELECT COUNT(*) as count 
            FROM queue 
            WHERE DATE(registered_at) = ?
        `, [today]);
        
        const totalPatients = await this.get(`
            SELECT COUNT(*) as count FROM patients
        `);
        
        const departmentStats = await this.all(`
            SELECT 
                department,
                COUNT(*) as count,
                SUM(CASE WHEN status = 'Waiting' THEN 1 ELSE 0 END) as waiting,
                SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed
            FROM queue
            WHERE DATE(registered_at) = ?
            GROUP BY department
        `, [today]);
        
        return {
            today: {
                waiting: waiting.count,
                inProgress: inProgress.count,
                completed: completed.count,
                total: totalToday.count
            },
            totalPatients: totalPatients.count,
            departments: departmentStats
        };
    }
    
    // Close database connection
    close() {
        this.db.close((err) => {
            if (err) {
                console.error('Error closing database:', err);
            } else {
                console.log('✅ Database connection closed');
            }
        });
    }
}

module.exports = Database;