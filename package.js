{
  "name": "hospital-queue-management",
  "version": "1.0.0",
  "description": "Local WiFi-based Hospital Queue Management System with Real-time Sync",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "keywords": [
    "hospital",
    "queue",
    "management",
    "websocket",
    "sqlite",
    "realtime"
  ],
  "author": "Hospital Queue Team",
  "license": "MIT",
  "dependencies": {
    "express": "^4.18.2",
    "sqlite3": "^5.1.6",
    "ws": "^8.14.2",
    "cors": "^2.8.5",
    "body-parser": "^1.20.2"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  },
  "engines": {
    "node": ">=14.0.0"
  }
}