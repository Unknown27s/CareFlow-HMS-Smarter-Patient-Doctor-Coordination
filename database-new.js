// ==================== database.js ====================
// Using sql.js for cloud deployment compatibility (pure JavaScript SQLite)

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

class DatabaseWrapper {
    constructor() {
        this.db = null;
        this.dbPath = path.join(__dirname, 'data', 'hospital.db');

        // Create data directory if it doesn't exist
        const dataDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        this.initializeDatabase();
    }

    async initializeDatabase() {
        try {
            const SQL = await initSqlJs();
            let filebuffer = null;

            // Load existing database if it exists
            if (fs.existsSync(this.dbPath)) {
                filebuffer = fs.readFileSync(this.dbPath);
            }

            this.db = new SQL.Database(filebuffer);
            console.log('✅ Connected to SQLite database');

            this.initializeTables();
            this.saveDatabase(); // Save initial state
        } catch (err) {
            console.error('Error opening database:', err);
            throw err;
        }
    }

    saveDatabase() {
        if (this.db) {
            const data = this.db.export();
            const buffer = Buffer.from(data);
            fs.writeFileSync(this.dbPath, buffer);
        }
    }

    // Initialize database tables
    initializeTables() {
        // Patients table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS patients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                age INTEGER NOT NULL,
                gender TEXT NOT NULL,
                contact TEXT UNIQUE NOT NULL,
                email TEXT,
                address TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_visit DATETIME DEFAULT CURRENT_TIMESTAMP,
                visit_count INTEGER DEFAULT 1
            )
        `);

        // Queue table
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

        // Users table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                name TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('doctor', 'nurse', 'admin')),
                department TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Appointments table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS appointments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER NOT NULL,
                doctor_id INTEGER NOT NULL,
                appointment_date DATE NOT NULL,
                appointment_time TIME NOT NULL,
                status TEXT CHECK (status IN ('scheduled', 'waiting', 'checked-in', 'completed', 'cancelled')),
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (patient_id) REFERENCES patients(id),
                FOREIGN KEY (doctor_id) REFERENCES users(id)
            )
        `);

        // Languages table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS languages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                is_active BOOLEAN DEFAULT 1
            )
        `);

        // Translations table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS translations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                language_id INTEGER NOT NULL,
                key_name TEXT NOT NULL,
                translation_text TEXT NOT NULL,
                FOREIGN KEY (language_id) REFERENCES languages(id),
                UNIQUE(language_id, key_name)
            )
        `);

        // Create indexes
        try {
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_queue_date ON queue(registered_at)`);
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_queue_department ON queue(department)`);
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_queue_status ON queue(status)`);
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date)`);
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id)`);
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_translations_lang ON translations(language_id)`);
        } catch (e) {
            // Indexes may already exist
        }

        // Create default admin user if doesn't exist
        this.createDefaultAdmin();
    }

    createDefaultAdmin() {
        const adminExists = this.db.prepare(`SELECT id FROM users WHERE username = 'admin' AND role = 'admin'`).get();

        if (!adminExists) {
            const hash = bcrypt.hashSync('admin123', 10);
            this.db.prepare(`
                INSERT INTO users (username, password_hash, name, role)
                VALUES ('admin', ?, 'System Administrator', 'admin')
            `).run(hash);
            console.log('✅ Default admin user created (username: admin, password: admin123)');
        }
    }

    // ========== Patient Methods ==========

    async addPatient(patientData) {
        const { name, age, gender, contact } = patientData;

        try {
            // Try to insert, on conflict update
            const stmt = this.db.prepare(`
                INSERT INTO patients (name, age, gender, contact)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(contact) DO UPDATE SET
                    last_visit = CURRENT_TIMESTAMP,
                    visit_count = visit_count + 1
            `);
            stmt.run(name, age, gender, contact);

            const patient = this.db.prepare('SELECT id FROM patients WHERE contact = ?').get(contact);
            return patient.id;
        } catch (error) {
            console.error('Error adding patient:', error);
            throw error;
        }
    }

    async getPatientByContact(contact) {
        return this.db.prepare('SELECT * FROM patients WHERE contact = ?').get(contact);
    }

    async getPatientById(patientId) {
        return this.db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);
    }

    // ========== Token & Queue Methods ==========

    async generateToken(department) {
        const today = new Date().toISOString().split('T')[0];

        const result = this.db.prepare(`
            SELECT COUNT(*) as count 
            FROM queue 
            WHERE department = ? 
            AND DATE(registered_at) = ?
        `).get(department, today);

        const tokenNumber = String(result.count + 1).padStart(3, '0');
        return `${department}${tokenNumber}`;
    }

    async addToQueue(queueData) {
        const { patientId, token, department, symptoms, status } = queueData;

        const result = this.db.prepare(`
            INSERT INTO queue (patient_id, token, department, symptoms, status)
            VALUES (?, ?, ?, ?, ?)
        `).run(patientId, token, department, symptoms, status);

        return { id: result.lastInsertRowid };
    }

    async getTodayQueue() {
        const today = new Date().toISOString().split('T')[0];

        return this.db.prepare(`
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
        `).all(today);
    }

    async getQueueByDepartment(department) {
        const today = new Date().toISOString().split('T')[0];

        return this.db.prepare(`
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
        `).all(department, today);
    }

    async getQueuePosition(token, department) {
        const today = new Date().toISOString().split('T')[0];

        const result = this.db.prepare(`
            SELECT COUNT(*) as position
            FROM queue
            WHERE department = ?
            AND status = 'Waiting'
            AND token < ?
            AND DATE(registered_at) = ?
        `).get(department, token, today);

        return result.position;
    }

    async getQueueByToken(token) {
        const today = new Date().toISOString().split('T')[0];

        return this.db.prepare(`
            SELECT 
                q.id,
                q.token,
                q.department,
                q.status,
                q.registered_at,
                q.called_at,
                q.completed_at,
                p.name,
                p.age,
                p.gender,
                p.contact
            FROM queue q
            JOIN patients p ON q.patient_id = p.id
            WHERE q.token = ?
            AND DATE(q.registered_at) = ?
        `).get(token, today);
    }

    async updateQueueStatus(queueId, status) {
        const timestamp = new Date().toISOString();

        if (status === 'In Progress') {
            return this.db.prepare(`UPDATE queue SET status = ?, called_at = ? WHERE id = ?`).run(status, timestamp, queueId);
        } else if (status === 'Completed') {
            return this.db.prepare(`UPDATE queue SET status = ?, completed_at = ? WHERE id = ?`).run(status, timestamp, queueId);
        } else {
            return this.db.prepare(`UPDATE queue SET status = ? WHERE id = ?`).run(status, queueId);
        }
    }

    // ========== Patient History ==========

    async getPatientHistory(patientId) {
        return this.db.prepare(`
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
        `).all(patientId);
    }

    // ========== Statistics ==========

    async getStatistics() {
        const today = new Date().toISOString().split('T')[0];

        const waiting = this.db.prepare(`
            SELECT COUNT(*) as count FROM queue WHERE status = 'Waiting' AND DATE(registered_at) = ?
        `).get(today);

        const inProgress = this.db.prepare(`
            SELECT COUNT(*) as count FROM queue WHERE status = 'In Progress' AND DATE(registered_at) = ?
        `).get(today);

        const completed = this.db.prepare(`
            SELECT COUNT(*) as count FROM queue WHERE status = 'Completed' AND DATE(registered_at) = ?
        `).get(today);

        const totalToday = this.db.prepare(`
            SELECT COUNT(*) as count FROM queue WHERE DATE(registered_at) = ?
        `).get(today);

        const totalPatients = this.db.prepare(`SELECT COUNT(*) as count FROM patients`).get();

        const departmentStats = this.db.prepare(`
            SELECT 
                department,
                COUNT(*) as count,
                SUM(CASE WHEN status = 'Waiting' THEN 1 ELSE 0 END) as waiting,
                SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed
            FROM queue
            WHERE DATE(registered_at) = ?
            GROUP BY department
        `).all(today);

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

    // ========== User/Auth Methods ==========

    async createUser(userData) {
        const { username, password, name, role, department } = userData;
        const password_hash = bcrypt.hashSync(password, 10);

        const result = this.db.prepare(`
            INSERT INTO users (username, password_hash, name, role, department)
            VALUES (?, ?, ?, ?, ?)
        `).run(username, password_hash, name, role, department);

        return result.lastInsertRowid;
    }

    async authenticateUser(loginInput, password) {
        // Try username first
        let user = this.db.prepare(`
            SELECT id, username, password_hash, name, role, department
            FROM users WHERE username = ?
        `).get(loginInput);

        // Try by name for doctors
        if (!user) {
            user = this.db.prepare(`
                SELECT id, username, password_hash, name, role, department
                FROM users WHERE name = ? AND role = 'doctor'
            `).get(loginInput);
        }

        if (!user) return null;

        const isValid = bcrypt.compareSync(password, user.password_hash);
        if (!isValid) return null;

        const { password_hash, ...userWithoutPassword } = user;
        return userWithoutPassword;
    }

    async getUserByUsername(username) {
        return this.db.prepare(`
            SELECT id, username, name, role, department, created_at
            FROM users WHERE username = ?
        `).get(username);
    }

    async getAllDoctors() {
        return this.db.prepare(`
            SELECT id, username, name, department, created_at
            FROM users WHERE role = 'doctor'
            ORDER BY created_at DESC
        `).all();
    }

    async deleteUser(userId) {
        return this.db.prepare(`DELETE FROM users WHERE id = ?`).run(userId);
    }

    // ========== Appointment Methods ==========

    async createAppointment(appointmentData) {
        const { patient_id, doctor_id, appointment_date, appointment_time, notes } = appointmentData;
        return this.db.prepare(`
            INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, status, notes)
            VALUES (?, ?, ?, ?, 'scheduled', ?)
        `).run(patient_id, doctor_id, appointment_date, appointment_time, notes);
    }

    async getDoctorAppointments(doctorId, date) {
        return this.db.prepare(`
            SELECT 
                a.*,
                p.name as patient_name,
                p.age as patient_age,
                p.gender as patient_gender,
                p.contact as patient_contact
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            WHERE a.doctor_id = ? AND a.appointment_date = ?
            ORDER BY a.appointment_time
        `).all(doctorId, date);
    }

    async updateAppointmentStatus(appointmentId, status) {
        return this.db.prepare(`
            UPDATE appointments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(status, appointmentId);
    }

    // ========== Translation Methods ==========

    async getTranslations(languageCode) {
        return this.db.prepare(`
            SELECT t.key_name, t.translation_text
            FROM translations t
            JOIN languages l ON t.language_id = l.id
            WHERE l.code = ? AND l.is_active = 1
        `).all(languageCode);
    }

    async addTranslation(languageCode, keyName, translationText) {
        return this.db.prepare(`
            INSERT INTO translations (language_id, key_name, translation_text)
            SELECT l.id, ?, ?
            FROM languages l WHERE l.code = ?
        `).run(keyName, translationText, languageCode);
    }

    // ========== Cleanup ==========

    close() {
        try {
            this.db.close();
            console.log('✅ Database connection closed');
        } catch (err) {
            console.error('Error closing database:', err);
        }
    }
}

module.exports = DatabaseWrapper;
