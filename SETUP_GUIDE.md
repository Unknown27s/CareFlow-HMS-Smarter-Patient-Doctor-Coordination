# CareFlow HMS - Complete Setup Guide

## 🚀 Quick Start

### Prerequisites
- Node.js (v14.0.0 or higher)
- npm or yarn
- Modern web browser

### Installation Steps

1. **Clone the repository:**
```bash
git clone https://github.com/Unknown27s/CareFlow-HMS-Smarter-Patient-Doctor-Coordination.git
cd CareFlow-HMS-Smarter-Patient-Doctor-Coordination
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure environment (Optional):**
```bash
cp .env.example .env
# Edit .env with your settings
```

4. **Start the server:**
```bash
npm start
```

5. **Access the system:**
- Main Page: http://localhost:3000/index.html
- Patient Registration: http://localhost:3000/patient.html
- QR Scanner: http://localhost:3000/qrScanner.html
- Doctor Login: http://localhost:3000/doctorLogin.html
- Admin Panel: http://localhost:3000/adminLogin.html

## 📱 Features

### 🆕 New QR Code Features
- **Automatic QR Code Generation**: Every patient registration generates a unique QR code
- **Real-Time Clock**: QR scanner displays current date and time (updates every second)
- **Patient Verification**: Scan QR codes to instantly verify patient information
- **Timestamp Recording**: Each scan records the exact date and time
- **Patient History**: View patient visit history through QR scan

### Core Features
- ✅ Patient Registration & Queue Management
- ✅ Doctor Dashboard with Department Filtering
- ✅ Admin Panel for Doctor Management
- ✅ Real-time Updates via WebSocket
- ✅ Multi-language Support (English/Tamil)
- ✅ Secure Password Hashing
- ✅ Database Backup & Restore
- ✅ AI Medical Assistant Chatbot

## 🏥 User Workflows

### For Patients
1. Visit `patient.html`
2. Fill in registration form
3. Submit and receive:
   - Token number
   - QR code (screenshot/save it!)
   - Queue position
4. Use QR code for quick check-in at hospital

### For Doctors
1. Login at `doctorLogin.html`
2. View patients filtered by your department
3. Update patient status (Waiting → In Progress → Completed)
4. View patient history and details

### For Administrators
1. Login at `adminLogin.html` (default: admin/admin123)
2. Create doctor accounts with departments
3. Manage existing doctors
4. Monitor system statistics

### For Front Desk / Nurses
1. Open `qrScanner.html`
2. Patient shows their QR code
3. Paste/scan QR data
4. Instantly view:
   - Patient information
   - Current date and time
   - Visit history
   - Token number

## 🔧 Database Management

### Backup Database
```bash
npm run backup
```
Creates a timestamped backup in `data/backups/`

### Restore Database
```bash
npm run restore data/backups/hospital_backup_2025-11-12.db
```

### Health Check
```bash
npm run health
```
Shows statistics for all tables

### Export to JSON
```bash
npm run export
```
Exports all data to JSON format

### Clean Old Queue Entries
```bash
npm run clean
# Or specify days to keep
npm run clean 14
```

## 🌐 Network Access

### Access from Other Devices on Same Wi-Fi

When you start the server, it displays network addresses:

```
Network: Wi-Fi
Patient Registration: http://192.168.1.100:3000/patient.html
Doctor Dashboard: http://192.168.1.100:3000/doctor.html
QR Scanner: http://192.168.1.100:3000/qrScanner.html
```

Use these URLs from phones, tablets, or other computers on the same network.

## 📊 Department Codes

- **GEN** - General Medicine
- **ENT** - ENT (Ear, Nose, Throat)
- **CAR** - Cardiology
- **ORT** - Orthopedics
- **PED** - Pediatrics
- **DER** - Dermatology
- **NEU** - Neurology

## 🔐 Security

### Default Credentials

**Admin:**
- Username: `admin`
- Password: `admin123`
- **⚠️ CHANGE IMMEDIATELY IN PRODUCTION!**

### Password Security
- All passwords are hashed using bcrypt
- Never stored in plain text
- Salt rounds: 10

### Session Management
- Doctor/admin sessions stored in localStorage
- Sessions cleared on logout
- Auto-redirect if not authenticated

## 🛠️ Development

### Run in Development Mode
```bash
npm run dev
```
Uses nodemon for auto-restart on file changes.

### Project Structure
```
CareFlow-HMS/
├── server.js              # Main server file
├── database.js           # SQLite database handler
├── migrate.js            # Database migration tool
├── package.json          # Dependencies
├── .env.example          # Environment template
├── .gitignore           # Git ignore rules
├── API_DOCUMENTATION.md  # API docs
├── data/
│   ├── hospital.db      # Main database
│   └── backups/         # Database backups
├── qr/
│   ├── image.png        # Static QR
│   └── generated/       # Generated QR codes
├── index.html           # Home page
├── patient.html         # Patient registration
├── qrScanner.html       # QR code scanner
├── doctor.html          # Doctor dashboard
├── doctorLogin.html     # Doctor login
├── admin.html           # Admin panel
├── adminLogin.html      # Admin login
└── nurse.html          # Nurse dashboard
```

## 🔌 API Endpoints

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for complete API reference.

### Key Endpoints:
- `POST /api/register` - Register patient (returns QR code)
- `POST /api/qr/scan` - Scan QR code (returns info + real-time timestamp)
- `POST /api/qr/generate` - Generate QR code for patient
- `GET /api/queue` - Get today's queue
- `POST /api/doctor/login` - Doctor authentication
- `POST /api/admin/login` - Admin authentication

## 🚨 Troubleshooting

### Server won't start
```bash
# Check if port 3000 is in use
lsof -i :3000

# Use different port
PORT=4000 npm start
```

### Database errors
```bash
# Run health check
npm run health

# Create backup before fixing
npm run backup

# Rebuild SQLite bindings
npm rebuild sqlite3
```

### QR Code not showing
- Ensure server is running
- Check browser console for errors
- Verify patient registration was successful
- QR code is generated automatically on successful registration

## 📈 Performance Tips

1. **Clean old queue entries regularly:**
   ```bash
   npm run clean 7
   ```

2. **Create backups before major changes:**
   ```bash
   npm run backup
   ```

3. **Monitor database size:**
   ```bash
   npm run health
   ```

## 🔄 Updates and Maintenance

### Updating Dependencies
```bash
npm update
```

### Database Maintenance
Run weekly:
```bash
npm run backup
npm run clean
npm run health
```

## 📞 Support

For issues and questions:
1. Check this guide
2. Review API documentation
3. Check server logs
4. Create an issue on GitHub

## 🎯 Production Deployment

### Important Changes for Production:

1. **Change Admin Password:**
   - Login as admin
   - Change password immediately
   - Update .env file

2. **Environment Variables:**
   ```bash
   NODE_ENV=production
   PORT=3000
   ADMIN_PASSWORD=<strong-password>
   ```

3. **Security:**
   - Enable HTTPS
   - Configure CORS properly
   - Add rate limiting
   - Set up firewall rules

4. **Database:**
   - Set up automated backups
   - Configure backup retention
   - Test restore procedures

5. **Monitoring:**
   - Set up server monitoring
   - Configure error logging
   - Track system metrics

## 🆕 What's New in This Version

### QR Code System
- ✅ Automatic QR code generation on registration
- ✅ QR scanner with real-time clock
- ✅ Patient verification via QR scan
- ✅ Timestamp recording on every scan

### Infrastructure
- ✅ Database backup/restore utilities
- ✅ Health check and monitoring
- ✅ JSON export functionality
- ✅ Automated queue cleanup
- ✅ Environment configuration support

### Documentation
- ✅ Complete API documentation
- ✅ Comprehensive setup guide
- ✅ Migration scripts
- ✅ Deployment guidelines

## 📝 License

MIT License - see LICENSE file for details

## 👥 Contributors

- Unknown27s - Original Author

---

**CareFlow HMS** - Efficient Care, Seamless Flow 🏥
