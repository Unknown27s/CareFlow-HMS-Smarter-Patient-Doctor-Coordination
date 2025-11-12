#!/usr/bin/env node

/**
 * Database Migration and Backup Script
 * 
 * This script provides utilities for:
 * - Creating database backups
 * - Restoring from backups
 * - Running data migrations
 * - Database health checks
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, 'data', 'hospital.db');
const BACKUP_DIR = path.join(__dirname, 'data', 'backups');

// Create backup directory if it doesn't exist
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Create a backup of the current database
 */
function backupDatabase() {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(DB_PATH)) {
            reject(new Error('Database file not found'));
            return;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(BACKUP_DIR, `hospital_backup_${timestamp}.db`);

        const readStream = fs.createReadStream(DB_PATH);
        const writeStream = fs.createWriteStream(backupPath);

        readStream.pipe(writeStream);

        writeStream.on('finish', () => {
            console.log(`✅ Backup created successfully: ${backupPath}`);
            resolve(backupPath);
        });

        writeStream.on('error', reject);
        readStream.on('error', reject);
    });
}

/**
 * Restore database from a backup
 */
function restoreDatabase(backupPath) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(backupPath)) {
            reject(new Error('Backup file not found'));
            return;
        }

        // Create backup of current DB before restoring
        const currentBackupPath = path.join(BACKUP_DIR, `pre_restore_${Date.now()}.db`);
        if (fs.existsSync(DB_PATH)) {
            fs.copyFileSync(DB_PATH, currentBackupPath);
            console.log(`📦 Current database backed up to: ${currentBackupPath}`);
        }

        const readStream = fs.createReadStream(backupPath);
        const writeStream = fs.createWriteStream(DB_PATH);

        readStream.pipe(writeStream);

        writeStream.on('finish', () => {
            console.log(`✅ Database restored successfully from: ${backupPath}`);
            resolve();
        });

        writeStream.on('error', reject);
        readStream.on('error', reject);
    });
}

/**
 * Run database health check
 */
function healthCheck() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                reject(err);
                return;
            }

            console.log('\n🔍 Running database health check...\n');

            const checks = [
                { name: 'patients', query: 'SELECT COUNT(*) as count FROM patients' },
                { name: 'queue', query: 'SELECT COUNT(*) as count FROM queue' },
                { name: 'users', query: 'SELECT COUNT(*) as count FROM users' },
                { name: 'appointments', query: 'SELECT COUNT(*) as count FROM appointments' }
            ];

            let completed = 0;
            const results = {};

            checks.forEach(check => {
                db.get(check.query, (err, row) => {
                    if (err) {
                        results[check.name] = 'ERROR: ' + err.message;
                    } else {
                        results[check.name] = row.count;
                    }

                    completed++;
                    if (completed === checks.length) {
                        console.log('Table Statistics:');
                        console.log('─────────────────');
                        Object.keys(results).forEach(table => {
                            console.log(`  ${table.padEnd(15)}: ${results[table]}`);
                        });
                        console.log('─────────────────\n');

                        db.close();
                        resolve(results);
                    }
                });
            });
        });
    });
}

/**
 * Export data to JSON
 */
function exportToJSON(outputPath) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                reject(err);
                return;
            }

            const exportData = {};

            db.all('SELECT * FROM patients', (err, rows) => {
                if (err) {
                    db.close();
                    reject(err);
                    return;
                }
                exportData.patients = rows;

                db.all('SELECT * FROM queue', (err, rows) => {
                    if (err) {
                        db.close();
                        reject(err);
                        return;
                    }
                    exportData.queue = rows;

                    db.all('SELECT * FROM users', (err, rows) => {
                        if (err) {
                            db.close();
                            reject(err);
                            return;
                        }
                        exportData.users = rows;

                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                        const finalPath = outputPath || path.join(BACKUP_DIR, `export_${timestamp}.json`);

                        fs.writeFileSync(finalPath, JSON.stringify(exportData, null, 2));
                        console.log(`✅ Data exported to: ${finalPath}`);

                        db.close();
                        resolve(finalPath);
                    });
                });
            });
        });
    });
}

/**
 * Clean old queue entries
 */
function cleanOldQueues(daysToKeep = 7) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                reject(err);
                return;
            }

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
            const cutoffISO = cutoffDate.toISOString().split('T')[0];

            const query = `DELETE FROM queue WHERE DATE(registered_at) < ?`;

            db.run(query, [cutoffISO], function (err) {
                if (err) {
                    db.close();
                    reject(err);
                    return;
                }

                console.log(`✅ Cleaned ${this.changes} old queue entries (older than ${daysToKeep} days)`);
                db.close();
                resolve(this.changes);
            });
        });
    });
}

// CLI Interface
const args = process.argv.slice(2);
const command = args[0];

async function main() {
    try {
        switch (command) {
            case 'backup':
                await backupDatabase();
                break;

            case 'restore':
                if (!args[1]) {
                    console.error('❌ Please provide backup file path');
                    console.log('Usage: node migrate.js restore <backup-file-path>');
                    process.exit(1);
                }
                await restoreDatabase(args[1]);
                break;

            case 'health':
                await healthCheck();
                break;

            case 'export':
                await exportToJSON(args[1]);
                break;

            case 'clean':
                const days = parseInt(args[1]) || 7;
                await cleanOldQueues(days);
                break;

            case 'help':
            default:
                console.log(`
╔════════════════════════════════════════════════════════════╗
║          CareFlow HMS Database Migration Tool              ║
╚════════════════════════════════════════════════════════════╝

Commands:
  backup              Create a backup of the current database
  restore <file>      Restore database from backup file
  health              Run database health check
  export [file]       Export data to JSON
  clean [days]        Clean old queue entries (default: 7 days)
  help                Show this help message

Examples:
  node migrate.js backup
  node migrate.js restore ./data/backups/hospital_backup_2025-11-12.db
  node migrate.js health
  node migrate.js export
  node migrate.js clean 14

For more information, see the documentation.
                `);
                break;
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = {
    backupDatabase,
    restoreDatabase,
    healthCheck,
    exportToJSON,
    cleanOldQueues
};
