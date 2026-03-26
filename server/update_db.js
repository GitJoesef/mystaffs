const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../staffsync.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
        return;
    }
    console.log('Connected to the SQLite database.');

    // 1. Create settings table
    db.run(`CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        school_name TEXT DEFAULT 'TeacherTime School',
        start_time TEXT DEFAULT '08:30',
        working_days TEXT DEFAULT 'Monday,Tuesday,Wednesday,Thursday,Friday'
    )`, (err) => {
        if (err) console.error("Error creating settings table", err);
        else {
            console.log("Settings table ready.");
            // Insert default settings if empty
            db.get(`SELECT COUNT(*) as count FROM settings`, (err, row) => {
                if (!err && row.count === 0) {
                    db.run(`INSERT INTO settings (school_name, start_time, working_days) VALUES ('TeacherTime School', '08:30', 'Monday,Tuesday,Wednesday,Thursday,Friday')`);
                }
            });
        }
    });

    // 2. Create leaves table
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
        else console.log("Leaves table ready.");
    });

    // 3. Add status to attendance
    db.run(`ALTER TABLE attendance ADD COLUMN status TEXT DEFAULT 'on-time'`, (err) => {
        if (err) {
            if (err.message.includes("duplicate column name")) {
               console.log("Column 'status' already exists in attendance.");
            } else {
               console.error("Error adding status to attendance", err);
            }
        } else console.log("Added 'status' to attendance.");
    });

    // 4. Add photo_url to users
    db.run(`ALTER TABLE users ADD COLUMN photo_url TEXT DEFAULT ''`, (err) => {
        if (err) {
            if (err.message.includes("duplicate column name")) {
               console.log("Column 'photo_url' already exists in users.");
            } else {
               console.error("Error adding photo_url to users", err);
            }
        } else console.log("Added 'photo_url' to users.");
    });
    
    setTimeout(() => {
        db.close();
        console.log("Database update complete.");
    }, 1000);
});
