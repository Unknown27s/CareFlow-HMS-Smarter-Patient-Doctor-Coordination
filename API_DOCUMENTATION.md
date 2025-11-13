# CareFlow HMS API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication
Currently uses session-based authentication for doctors and admins.

---

## Patient APIs

### Register Patient
**POST** `/register`

Register a new patient or returning patient.

**Request Body:**
```json
{
  "name": "John Doe",
  "age": 35,
  "gender": "Male",
  "department": "CAR",
  "contact": "1234567890",
  "symptoms": "Chest pain"
}
```

**Response:**
```json
{
  "success": true,
  "token": "CAR001",
  "position": 1,
  "patientId": 123,
  "qrCode": "data:image/png;base64,...",
  "qrData": {
    "patientId": 123,
    "name": "John Doe",
    "token": "CAR001",
    "contact": "1234567890",
    "department": "CAR",
    "timestamp": "2025-11-12T12:00:00.000Z",
    "registrationDate": "Nov 12, 2025, 12:00 PM"
  }
}
```

### Get Patient by Contact
**GET** `/patient/:contact`

Retrieve patient information by contact number.

**Response:**
```json
{
  "success": true,
  "patient": {
    "id": 123,
    "name": "John Doe",
    "age": 35,
    "gender": "Male",
    "contact": "1234567890",
    "visit_count": 3,
    "last_visit": "2025-11-12"
  }
}
```

### Get Patient History
**GET** `/patient/:patientId/history`

Get patient's visit history.

---

## Queue APIs

### Get Today's Queue
**GET** `/queue`

Get all patients in today's queue.

**Response:**
```json
{
  "success": true,
  "queue": [
    {
      "queue_id": 1,
      "token": "CAR001",
      "department": "CAR",
      "symptoms": "Chest pain",
      "status": "Waiting",
      "patient_id": 123,
      "name": "John Doe",
      "age": 35,
      "gender": "Male",
      "contact": "1234567890"
    }
  ]
}
```

### Get Queue by Department
**GET** `/queue/:department`

Get queue for a specific department.

### Update Queue Status
**PUT** `/queue/:queueId/status`

Update patient status in queue.

**Request Body:**
```json
{
  "status": "In Progress"
}
```

**Status Values:**
- `Waiting`
- `In Progress`
- `Completed`
- `Cancelled`

---

## QR Code APIs

### Generate QR Code
**POST** `/qr/generate`

Generate a QR code for a patient.

**Request Body:**
```json
{
  "patientId": 123,
  "token": "CAR001"
}
```

**Response:**
```json
{
  "success": true,
  "qrCode": "data:image/png;base64,...",
  "data": {
    "patientId": 123,
    "name": "John Doe",
    "token": "CAR001",
    "contact": "1234567890",
    "timestamp": "2025-11-12T12:00:00.000Z",
    "registrationDate": "Nov 12, 2025, 12:00 PM"
  }
}
```

### Scan QR Code
**POST** `/qr/scan`

Scan and decode a patient QR code with real-time timestamp.

**Request Body:**
```json
{
  "qrData": "{\"patientId\":123,\"name\":\"John Doe\",\"token\":\"CAR001\",...}"
}
```

**Response:**
```json
{
  "success": true,
  "scanInfo": {
    "patientId": 123,
    "name": "John Doe",
    "token": "CAR001",
    "contact": "1234567890",
    "timestamp": "2025-11-12T12:00:00.000Z",
    "scannedAt": "2025-11-12T13:30:00.000Z",
    "currentDateTime": "Tuesday, November 12, 2025 at 1:30:00 PM EST",
    "currentDate": "Tuesday, November 12, 2025",
    "currentTime": "1:30:00 PM",
    "latestInfo": {
      "name": "John Doe",
      "age": 35,
      "gender": "Male",
      "contact": "1234567890",
      "visitCount": 3,
      "lastVisit": "2025-11-12"
    }
  }
}
```

---

## Doctor APIs

### Doctor Login
**POST** `/doctor/login`

Authenticate a doctor.

**Request Body:**
```json
{
  "loginInput": "drjohn",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "drjohn",
    "name": "Dr. John Smith",
    "department": "CAR",
    "role": "doctor"
  }
}
```

---

## Admin APIs

### Admin Login
**POST** `/admin/login`

Authenticate an admin user.

**Request Body:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

### Get All Doctors
**GET** `/admin/doctors`

Get list of all doctors.

### Create Doctor
**POST** `/admin/doctors`

Create a new doctor account.

**Request Body:**
```json
{
  "username": "drjohn",
  "password": "password123",
  "name": "Dr. John Smith",
  "department": "CAR"
}
```

### Delete Doctor
**DELETE** `/admin/doctors/:id`

Delete a doctor account.

---

## Statistics APIs

### Get Statistics
**GET** `/stats`

Get system statistics.

---

## Network Info

### Get Network Information
**GET** `/network-info`

Get server network addresses for device access.

**Response:**
```json
{
  "addresses": [
    {
      "name": "Wi-Fi",
      "address": "192.168.1.100"
    }
  ],
  "port": 3000
}
```

---

## WebSocket Events

### Connection
Connect to WebSocket server:
```javascript
const ws = new WebSocket('ws://localhost:3000');
```

### Events Received

#### INITIAL_QUEUE
Sent when client connects, contains current queue.
```json
{
  "type": "INITIAL_QUEUE",
  "data": [/* queue items */]
}
```

#### NEW_REGISTRATION
Broadcast when new patient registers.
```json
{
  "type": "NEW_REGISTRATION",
  "data": {
    "token": "CAR001",
    "department": "CAR",
    "patientId": 123,
    "position": 1,
    "name": "John Doe"
  }
}
```

#### STATUS_UPDATE
Broadcast when patient status changes.
```json
{
  "type": "STATUS_UPDATE",
  "data": {
    "queueId": 1,
    "status": "In Progress"
  }
}
```

---

## Department Codes

- **GEN** - General Medicine
- **ENT** - ENT (Ear, Nose, Throat)
- **CAR** - Cardiology
- **ORT** - Orthopedics
- **PED** - Pediatrics
- **DER** - Dermatology
- **NEU** - Neurology

---

## Error Responses

All endpoints return errors in this format:
```json
{
  "success": false,
  "error": "Error message here"
}
```

Common HTTP Status Codes:
- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `500` - Internal Server Error

---

## Rate Limiting

Currently no rate limiting implemented. Should be added in production.

## CORS

CORS is enabled for all origins. Configure in production.
