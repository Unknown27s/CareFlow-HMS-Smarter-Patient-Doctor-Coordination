# Hospital Management System - Admin Panel Setup Guide

## 🎉 What's New

### 1. Admin Panel
- **Access**: http://localhost:3000/adminLogin.html
- **Default Credentials**:
  - Username: `admin`
  - Password: `admin123`

### 2. Doctor Management
- Admins can now create doctor accounts
- Each doctor is assigned a department
- Doctors no longer select their department at login
- Password encryption using bcrypt

### 3. Department-Based Patient Filtering
- Doctors automatically see only patients from their department
- No manual department selection required
- Real-time updates for department-specific patients

## 🚀 Complete Workflow

### Step 1: Admin Login
1. Navigate to http://localhost:3000/adminLogin.html
2. Login with admin credentials (admin/admin123)
3. Access the admin panel

### Step 2: Create Doctor Accounts
1. In the admin panel, fill in the form:
   - **Name**: Full name of the doctor (e.g., Dr. Smith)
   - **Username**: Login username (e.g., drsmith)
   - **Password**: Secure password (will be hashed)
   - **Department**: Select from dropdown
     - GEN - General Medicine
     - ENT - ENT (Ear, Nose, Throat)
     - CAR - Cardiology
     - ORT - Orthopedics
     - PED - Pediatrics
     - DER - Dermatology
     - NEU - Neurology

2. Click "Add Doctor"
3. The doctor appears in the doctors list below

### Step 3: Doctor Login
1. Navigate to http://localhost:3000/doctorLogin.html
2. Enter username and password (created by admin)
3. Department is automatically assigned from database
4. Redirected to doctor dashboard

### Step 4: Doctor Dashboard
1. Doctor sees only patients from their department
2. Real-time updates via WebSocket
3. Welcome message shows: "Welcome, Dr. [Name]" and department
4. Logout button to return to login page

## 📁 Files Modified

### New Files
- `adminLogin.html` - Admin login page
- `admin.html` - Admin panel for doctor management
- `ADMIN_SETUP_GUIDE.md` - This file

### Updated Files
- `server.js` - Added admin API routes:
  - `POST /api/admin/doctors` - Create doctor
  - `GET /api/admin/doctors` - List all doctors
  - `DELETE /api/admin/doctors/:id` - Delete doctor
  - `POST /api/doctor/login` - Doctor authentication

- `database.js` - Updated user authentication:
  - `createUser()` - Now hashes passwords with bcrypt
  - `authenticateUser()` - Verifies hashed passwords
  - `getUserByUsername()` - Get user details
  - `getAllDoctors()` - List all doctors
  - `deleteUser()` - Delete user by ID

- `doctorLogin.html` - Removed department selection:
  - Department field removed from form
  - Integrated with server API
  - Async login with error handling

- `doctor.html` - Department-based filtering:
  - `getFilteredQueue()` - Automatically filters by doctor's department
  - No manual department selection
  - Uses `doctorSession.department` from login

- `index.html` - Added navigation:
  - Admin Panel link in header
  - Doctor Login button (instead of direct dashboard access)

## 🔐 Security Features

### Password Encryption
- All passwords are hashed using bcryptjs with salt rounds of 10
- Passwords are never stored in plain text
- Password verification during login

### Session Management
- Doctor session stored in localStorage
- Contains: id, username, name, department, role, loginTime
- Logout clears session and redirects to login

### Admin Authentication
- Simple localStorage-based admin session
- Can be upgraded to server-side authentication in production

## 🔧 API Endpoints

### Admin Routes
```
GET    /api/admin/doctors           - List all doctors
POST   /api/admin/doctors           - Create new doctor
DELETE /api/admin/doctors/:id       - Delete doctor
```

### Doctor Routes
```
POST   /api/doctor/login            - Authenticate doctor
```

### Patient Routes (existing)
```
POST   /api/register                - Register patient
GET    /api/queue                   - Get all queue
GET    /api/queue/:department       - Get queue by department
PUT    /api/queue/:queueId/status   - Update patient status
```

## 🎯 Department Codes

| Code | Department Name        |
|------|------------------------|
| GEN  | General Medicine       |
| ENT  | ENT (Ear, Nose, Throat)|
| CAR  | Cardiology             |
| ORT  | Orthopedics            |
| PED  | Pediatrics             |
| DER  | Dermatology            |
| NEU  | Neurology              |

## 📊 Database Schema

### users table
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('doctor', 'nurse', 'admin')),
    department TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

## 🧪 Testing Guide

### Test Admin Panel
1. Login to admin panel
2. Create a test doctor:
   - Name: Dr. Test Cardiology
   - Username: testdoc
   - Password: test123
   - Department: CAR (Cardiology)

### Test Doctor Login
1. Logout from admin panel
2. Go to doctorLogin.html
3. Login with: testdoc / test123
4. Verify department shows as "Cardiology"

### Test Patient Filtering
1. Create patients in different departments
2. Login as different doctors
3. Verify each doctor sees only their department's patients

### Test Real-time Updates
1. Login as doctor in one browser
2. Register patient in same department from another browser/tab
3. Verify patient appears immediately in doctor dashboard

## 🐛 Troubleshooting

### "Invalid username or password"
- Verify admin created the doctor account
- Check username and password match exactly
- Check database has bcryptjs installed: `npm install bcryptjs`

### "Connection error"
- Ensure server is running: `node server.js`
- Check server console for errors
- Verify API endpoints are responding

### Patients not appearing
- Check doctor's department matches patient's department
- Verify WebSocket connection (check browser console)
- Refresh the page to reconnect WebSocket

### Admin panel not loading
- Clear localStorage: `localStorage.clear()` in browser console
- Check adminSession is set correctly
- Verify admin.html is calling API endpoints

## 🔄 Logout Functionality

### Doctor Logout
- Click "Logout" button in doctor dashboard
- Clears doctorSession from localStorage
- Redirects to doctorLogin.html
- Confirmation dialog before logout

### Admin Logout
- Click "Logout" button in admin panel
- Clears adminSession from localStorage
- Redirects to adminLogin.html

## 📝 Notes

### Production Deployment
For production use, consider:
1. Move admin credentials to database
2. Implement JWT tokens for API authentication
3. Add HTTPS/SSL certificates
4. Rate limiting on login endpoints
5. Password reset functionality
6. Audit logs for admin actions

### Future Enhancements
- Role-based permissions (head doctor, junior doctor)
- Multi-department support for senior doctors
- Doctor schedule management
- Patient appointment booking
- Email notifications
- SMS alerts

## 📞 Support

For issues or questions:
- Check server console for errors
- Verify database connection
- Ensure all npm packages are installed
- Test with demo admin credentials first

---

**Status**: ✅ All features integrated and tested
**Server**: Running on http://localhost:3000
**Database**: SQLite at f:\Git floder\HMS3\data\hospital.db
