const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../staffsync.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');

        // Create users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            school_name TEXT NOT NULL,
            role TEXT DEFAULT 'Staff',
            bio TEXT DEFAULT '',
            subjects TEXT DEFAULT '[]',
            classes TEXT DEFAULT '[]'
        )`, (err) => {
            if (err) console.error("Error creating users table", err);
        });

        // Create attendance table
        db.run(`CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            type TEXT NOT NULL,
            method TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`, (err) => {
            if (err) console.error("Error creating attendance table", err);
        });

        // Create credentials table for WebAuthn
        db.run(`CREATE TABLE IF NOT EXISTS credentials (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            public_key TEXT NOT NULL,
            counter INTEGER DEFAULT 0,
            transports TEXT DEFAULT '[]',
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`, (err) => {
            if (err) console.error("Error creating credentials table", err);
        });

        // Create settings table
        db.run(`CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            school_name TEXT DEFAULT 'TeacherTime School',
            start_time TEXT DEFAULT '08:30',
            working_days TEXT DEFAULT 'Monday,Tuesday,Wednesday,Thursday,Friday',
            available_classes TEXT DEFAULT '[]',
            available_subjects TEXT DEFAULT '[]'
        )`, (err) => {
            if (err) console.error("Error creating settings table", err);
            else {
                // Insert default setting row if it doesn't exist
                db.get(`SELECT COUNT(*) as count FROM settings`, (err, row) => {
                    if (!err && row.count === 0) {
                        db.run(`INSERT INTO settings (school_name, start_time, working_days) VALUES ('TeacherTime School', '08:30', 'Monday,Tuesday,Wednesday,Thursday,Friday')`);
                    }
                });
            }
        });

        // Create leaves table
        db.run(`CREATE TABLE IF NOT EXISTS leaves (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            date TEXT NOT NULL,
            reason TEXT,
            type TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`, (err) => {
            if (err) console.error("Error creating leaves table", err);
        });

        // Apply migrations (safe to run multiple times, they silently fail or act idempotent if the column exists)
        db.run(`ALTER TABLE attendance ADD COLUMN status TEXT DEFAULT 'on-time'`, () => {});
        db.run(`ALTER TABLE users ADD COLUMN photo_url TEXT DEFAULT ''`, () => {});
        db.run(`ALTER TABLE users ADD COLUMN admin_note TEXT DEFAULT ''`, () => {});
        db.run(`ALTER TABLE users ADD COLUMN pin_hash TEXT DEFAULT ''`, () => {});
        db.run(`ALTER TABLE settings ADD COLUMN available_classes TEXT DEFAULT '[]'`, () => {});
        db.run(`ALTER TABLE settings ADD COLUMN available_subjects TEXT DEFAULT '[]'`, () => {});
    }
});

module.exports = db;
