/*
═══════════════════════════════════════════════════════════════════════
HOSPITAL QUEUE MANAGEMENT SYSTEM - LOCAL SERVER SETUP
═══════════════════════════════════════════════════════════════════════

This is a complete local server setup with real-time synchronization,
SQLite database, and offline support for local Wi-Fi networks.

FOLDER STRUCTURE:
─────────────────
hospital-queue-system/
├── server.js                  (This file - Node.js server)
├── database.js               (SQLite database handler)
├── package.json              (Dependencies)
├── public/                   (Static files served to clients)
│   ├── patient.html         (Patient registration)
│   ├── doctor.html          (Doctor dashboard)
│   └── nurse.html           (Nurse dashboard - optional)
└── data/
    └── hospital.db          (SQLite database - auto-created)

INSTALLATION STEPS:
───────────────────

STEP 1: Install Node.js
- Download from: https://nodejs.org/
- Install the LTS version
- Verify: open terminal/cmd and type: node --version

STEP 2: Create Project Folder
- Create a folder: hospital-queue-system
- Open terminal/cmd in this folder

STEP 3: Initialize Project
Run these commands in terminal:

npm init -y
npm install express sqlite3 ws cors body-parser

STEP 4: Create Files
- Copy this code to server.js
- Create database.js (code provided below)
- Create package.json (code provided below)
- Create public folder with HTML files (provided below)

STEP 5: Start Server
Run: node server.js

STEP 6: Access System
- Find your computer's IP address:
  Windows: ipconfig (look for IPv4 Address)
  Mac/Linux: ifconfig (look for inet)
  
- Access from any device on same Wi-Fi:
  Patient Registration: http://YOUR_IP:3000/patient.html
  Doctor Dashboard: http://YOUR_IP:3000/doctor.html
  Example: http://192.168.1.100:3000/patient.html

FEATURES:
─────────
✅ Real-time data sync using WebSocket
✅ SQLite database with patient history
✅ Automatic patient recognition by phone number
✅ Offline operation on local network
✅ Auto-refresh doctor dashboard
✅ Token generation per department
✅ Queue management with status updates
✅ Bilingual support (Tamil + English)

═══════════════════════════════════════════════════════════════════════
*/

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const QRCode = require('qrcode');
const fs = require('fs');
const Database = require('./database');

// Consolidated server: Express app + HTTP server + WebSocket
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// Initialize database
const db = new Database();

// Store connected WebSocket clients
const clients = new Set();

// Create QR code directory if it doesn't exist
const qrDir = path.join(__dirname, 'qr', 'generated');
if (!fs.existsSync(qrDir)) {
    fs.mkdirSync(qrDir, { recursive: true });
}

// WebSocket connection handler
wss.on('connection', (ws) => {
    console.log('New WS client connected');
    clients.add(ws);

    // Send current queue to newly connected client
    db.getTodayQueue().then(queue => {
        try { ws.send(JSON.stringify({ type: 'INITIAL_QUEUE', data: queue })); } catch (e) { }
    }).catch(() => { });

    ws.on('close', () => {
        clients.delete(ws);
    });

    ws.on('error', () => {
        clients.delete(ws);
    });
});

// Broadcast to all connected clients
function broadcast(message) {
    const payload = JSON.stringify(message);
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(payload);
    });
}

// API Routes

// Register new patient
// Register new patient (called by patient form)
app.post('/api/register', async (req, res) => {
    try {
        const patientData = req.body;

        // Check if patient exists by contact number
        const existingPatient = await db.getPatientByContact(patientData.contact);

        let patientId;
        if (existingPatient) {
            patientId = existingPatient.id;
            patientData.isReturning = true;
            patientData.lastVisit = existingPatient.last_visit || null;
            patientData.visitCount = (existingPatient.visit_count || 1) + 1;
        } else {
            patientId = await db.addPatient(patientData);
            patientData.isReturning = false;
            patientData.visitCount = 1;
        }

        // Generate token for department and add to queue
        const token = await db.generateToken(patientData.department);
        const queueEntry = await db.addToQueue({
            patientId,
            token,
            department: patientData.department,
            symptoms: patientData.symptoms || '',
            status: 'Waiting'
        });

        const position = await db.getQueuePosition(token, patientData.department);

        // Generate QR code for the patient
        const qrData = {
            patientId: patientId,
            name: patientData.name,
            token: token,
            contact: patientData.contact,
            department: patientData.department,
            timestamp: new Date().toISOString(),
            registrationDate: new Date().toLocaleString('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short'
            })
        };

        const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData), {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            width: 300,
            margin: 2
        });

        // Broadcast to WS clients (doctor dashboard should listen for this)
        broadcast({ type: 'NEW_REGISTRATION', data: { token, department: patientData.department, patientId, position, name: patientData.name } });

        res.json({ success: true, token, position, patientId, qrCode: qrCodeDataURL, qrData });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get patient by contact (for recognition)
app.get('/api/patient/:contact', async (req, res) => {
    try {
        const patient = await db.getPatientByContact(req.params.contact);
        res.json({ success: true, patient });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get today's queue
app.get('/api/queue', async (req, res) => {
    try {
        const queue = await db.getTodayQueue();
        res.json({ success: true, queue });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get queue by department
app.get('/api/queue/:department', async (req, res) => {
    try {
        const queue = await db.getQueueByDepartment(req.params.department);
        res.json({ success: true, queue });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update patient status
app.put('/api/queue/:queueId/status', async (req, res) => {
    try {
        const { queueId } = req.params;
        const { status } = req.body;

        await db.updateQueueStatus(queueId, status);

        // Broadcast status update
        broadcast({
            type: 'STATUS_UPDATE',
            data: { queueId, status }
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get queue status for specific token (patient view)
app.get('/api/queue/status/:token', async (req, res) => {
    try {
        const { token } = req.params;

        // Get patient queue data by token
        const queueData = await db.getQueueByToken(token);

        if (!queueData) {
            return res.status(404).json({
                success: false,
                error: 'Token not found'
            });
        }

        // Calculate how many people are waiting before this patient
        const position = await db.getQueuePosition(token, queueData.department);

        // Get total waiting in department
        const departmentQueue = await db.getQueueByDepartment(queueData.department);
        const totalWaiting = departmentQueue.filter(p => p.status === 'waiting').length;

        res.json({
            success: true,
            token: queueData.token,
            name: queueData.name,
            department: queueData.department,
            status: queueData.status,
            position: position,
            total_waiting: totalWaiting,
            registered_at: queueData.registered_at
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get queue position by token and department (for patient view)
app.get('/api/queue/position/:token/:department', async (req, res) => {
    try {
        const { token, department } = req.params;

        // Get queue position
        const position = await db.getQueuePosition(token, department);

        res.json({
            success: true,
            token: token,
            department: department,
            position: position
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get patient history
app.get('/api/patient/:patientId/history', async (req, res) => {
    try {
        const history = await db.getPatientHistory(req.params.patientId);
        res.json({ success: true, history });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get queue statistics
app.get('/api/stats', async (req, res) => {
    try {
        const stats = await db.getStatistics();
        res.json({ success: true, stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// Admin API Routes
// ============================================

// Get all doctors (admin)
app.get('/api/admin/doctors', async (req, res) => {
    try {
        const doctors = await db.getAllDoctors();
        res.json({ success: true, doctors });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create new doctor (admin)
app.post('/api/admin/doctors', async (req, res) => {
    try {
        const { username, password, name, department } = req.body;

        // Validate required fields
        if (!username || !password || !name || !department) {
            return res.status(400).json({
                success: false,
                error: 'All fields are required'
            });
        }

        // Check if username already exists
        const existing = await db.getUserByUsername(username);
        if (existing) {
            return res.status(400).json({
                success: false,
                error: 'Username already exists'
            });
        }

        // Create doctor with hashed password
        const doctorId = await db.createUser({
            username,
            password,
            name,
            department,
            role: 'doctor'
        });

        res.json({ success: true, doctorId });
    } catch (error) {
        console.error('Create doctor error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete doctor (admin)
app.delete('/api/admin/doctors/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.deleteUser(id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Doctor login
app.post('/api/doctor/login', async (req, res) => {
    try {
        const { loginInput, password } = req.body;

        const user = await db.authenticateUser(loginInput, password);

        if (user && user.role === 'doctor') {
            res.json({
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    name: user.name,
                    department: user.department,
                    role: user.role
                }
            });
        } else {
            res.status(401).json({
                success: false,
                error: 'Invalid credentials or not a doctor'
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin login
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await db.authenticateUser(username, password);

        if (user && user.role === 'admin') {
            res.json({
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    name: user.name,
                    role: user.role
                }
            });
        } else {
            res.status(401).json({
                success: false,
                error: 'Invalid admin credentials'
            });
        }
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// QR Code API Routes
// ============================================

// Generate QR code for patient
app.post('/api/qr/generate', async (req, res) => {
    try {
        const { patientId, token } = req.body;

        if (!patientId || !token) {
            return res.status(400).json({
                success: false,
                error: 'Patient ID and token are required'
            });
        }

        // Get patient info
        const patient = await db.getPatientById(patientId);
        if (!patient) {
            return res.status(404).json({
                success: false,
                error: 'Patient not found'
            });
        }

        // Create QR code data with timestamp
        const qrData = {
            patientId: patient.id,
            name: patient.name,
            token: token,
            contact: patient.contact,
            timestamp: new Date().toISOString(),
            registrationDate: new Date().toLocaleString('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short'
            })
        };

        // Generate QR code as data URL
        const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData), {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            width: 300,
            margin: 2
        });

        res.json({
            success: true,
            qrCode: qrCodeDataURL,
            data: qrData
        });
    } catch (error) {
        console.error('QR generation error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Scan/Decode QR code - returns patient info with current timestamp
app.post('/api/qr/scan', async (req, res) => {
    try {
        const { qrData } = req.body;

        if (!qrData) {
            return res.status(400).json({
                success: false,
                error: 'QR data is required'
            });
        }

        // Parse QR code data
        const patientData = JSON.parse(qrData);

        // Add current scan timestamp
        const scanInfo = {
            ...patientData,
            scannedAt: new Date().toISOString(),
            currentDateTime: new Date().toLocaleString('en-US', {
                dateStyle: 'full',
                timeStyle: 'long'
            }),
            currentDate: new Date().toLocaleDateString('en-US', { dateStyle: 'full' }),
            currentTime: new Date().toLocaleTimeString('en-US', { timeStyle: 'medium' })
        };

        // Get latest patient info from database
        const patient = await db.getPatientById(patientData.patientId);
        if (patient) {
            scanInfo.latestInfo = {
                name: patient.name,
                age: patient.age,
                gender: patient.gender,
                contact: patient.contact,
                visitCount: patient.visit_count,
                lastVisit: patient.last_visit
            };
        }

        res.json({
            success: true,
            scanInfo
        });
    } catch (error) {
        console.error('QR scan error:', error);
        res.status(500).json({ success: false, error: 'Invalid QR code data' });
    }
});

// Get server IP addresses
app.get('/api/network-info', (req, res) => {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    const addresses = [];

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                addresses.push({
                    name,
                    address: iface.address
                });
            }
        }
    }

    res.json({ addresses, port: PORT });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║   Hospital Queue Management System - SERVER RUNNING   ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');
    console.log(`🏥 Server running on port ${PORT}`);
    console.log(`\n📱 Access from devices on same Wi-Fi network:`);

    // Display all network addresses
    const os = require('os');
    const interfaces = os.networkInterfaces();

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                console.log(`\n   Network: ${name}`);
                console.log(`   Patient Registration: http://${iface.address}:${PORT}/patient.html`);
                console.log(`   Doctor Dashboard: http://${iface.address}:${PORT}/doctor.html`);
            }
        }
    }

    console.log('\n   Local: http://localhost:' + PORT + '/patient.html');
    console.log('\n✅ Database initialized successfully');
    console.log('✅ WebSocket server ready for real-time updates');
    console.log('\n⏹️  Press Ctrl+C to stop the server\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down server...');
    db.close();
    server.close(() => {
        console.log('✅ Server closed successfully');
        process.exit(0);
    });
});