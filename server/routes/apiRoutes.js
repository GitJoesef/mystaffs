const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// All routes here require authentication
router.use(authenticateToken);

router.get('/me', (req, res) => {
    db.get('SELECT * FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const { password_hash, ...safeUser } = user;
        safeUser.subjects = JSON.parse(safeUser.subjects || '[]');
        safeUser.classes = JSON.parse(safeUser.classes || '[]');

        res.json({ user: safeUser });
    });
});

router.put('/me', (req, res) => {
    const { name, bio, subjects, classes, photo_url } = req.body;
    db.run(
        'UPDATE users SET name = ?, bio = ?, subjects = ?, classes = ?, photo_url = ? WHERE id = ?',
        [
            name,
            bio || '',
            JSON.stringify(subjects || []),
            JSON.stringify(classes || []),
            photo_url || null,
            req.user.id
        ],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });

            db.get('SELECT * FROM users WHERE id = ?', [req.user.id], (err, user) => {
                const { password_hash, ...safeUser } = user;
                safeUser.subjects = JSON.parse(safeUser.subjects || '[]');
                safeUser.classes = JSON.parse(safeUser.classes || '[]');
                res.json({ user: safeUser });
            });
        }
    );
});

router.get('/staff', (req, res) => {
    if (req.user.role.toLowerCase() !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }

    db.all('SELECT id, name, role, bio, subjects, classes, photo_url FROM users WHERE school_name = ?', [req.user.school_name], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const staffProfiles = rows.map(u => ({
            id: u.id,
            fullName: u.name,
            role: u.role,
            photo: u.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=1e4d8c&color=fff`,
            subjects: JSON.parse(u.subjects || '[]'),
            classes: JSON.parse(u.classes || '[]'),
            bio: u.bio
        }));

        res.json({ staff: staffProfiles });
    });
});

router.get('/attendance', (req, res) => {
    const reqUserId = req.query.userId;
    const startDate = req.query.startDate; // YYYY-MM-DD
    const endDate = req.query.endDate;     // YYYY-MM-DD

    let targetUserId = req.user.id;
    if (reqUserId && req.user.role.toLowerCase() === 'admin') {
        targetUserId = reqUserId;
    }

    let query = 'SELECT * FROM attendance WHERE user_id = ?';
    let params = [targetUserId];

    if (startDate && endDate) {
        // SQLite timestamps are ISO strings, so >= '2026-03-24' and <= '2026-03-25T23:59:59' works.
        query += ' AND timestamp >= ? AND timestamp <= ?';
        params.push(`${startDate}T00:00:00.000Z`, `${endDate}T23:59:59.999Z`);
    }

    query += ' ORDER BY timestamp DESC';

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const mapped = rows.map(r => ({
            userId: r.user_id,
            type: r.type,
            method: r.method,
            ts: r.timestamp,
            status: r.status // 'on-time' or 'late'
        }));
        res.json({ rows: mapped });
    });
});

router.get('/attendance/live', (req, res) => {
    if (req.user.role.toLowerCase() !== 'admin') return res.status(403).json({ error: 'Admin only' });
    
    const query = `
        SELECT a.*, u.name as user_name, u.photo_url 
        FROM attendance a 
        JOIN users u ON a.user_id = u.id 
        WHERE u.school_name = ?
        ORDER BY a.timestamp DESC 
        LIMIT 20
    `;
    
    db.all(query, [req.user.school_name], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const mapped = rows.map(r => ({
            id: r.id,
            userId: r.user_id,
            userName: r.user_name,
            photo: r.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.user_name)}&background=1e4d8c&color=fff`,
            type: r.type,
            ts: r.timestamp,
            status: r.status
        }));
        res.json({ feed: mapped });
    });
});

router.post('/checkin', (req, res) => {
    const method = req.body.method || 'token';
    const ts = new Date().toISOString();
    
    // Check school settings for tardiness
    db.get('SELECT start_time, working_days FROM settings ORDER BY id DESC LIMIT 1', (err, settings) => {
        let status = 'on-time';

        if (!err && settings && settings.start_time) {
            // Compare current time with start_time (format "HH:MM")
            const now = new Date();
            const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });

            // Only flag late if today is a working day
            if (settings.working_days.includes(currentDay)) {
                const [startHour, startMin] = settings.start_time.split(':').map(Number);
                const currentTime = now.getHours() * 60 + now.getMinutes();
                const expectedTime = startHour * 60 + startMin;

                if (currentTime > expectedTime) {
                    status = 'late';
                }
            }
        }

        db.run('INSERT INTO attendance (user_id, type, method, timestamp, status) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'in', method, ts, status],
            (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, status });
            }
        );
    });
});

router.post('/checkout', (req, res) => {
    const method = req.body.method || 'token';
    const ts = new Date().toISOString();
    db.run('INSERT INTO attendance (user_id, type, method, timestamp) VALUES (?, ?, ?, ?)',
        [req.user.id, 'out', method, ts],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

router.post('/change-password', async (req, res) => {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
        return res.status(400).json({ error: 'Current and new password are required' });
    }

    if (new_password.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    db.get('SELECT password_hash FROM users WHERE id = ?', [req.user.id], async (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const bcrypt = require('bcrypt');
        const match = await bcrypt.compare(current_password, user.password_hash);

        if (!match) {
            return res.status(401).json({ error: 'Incorrect current password' });
        }

        try {
            const hash = await bcrypt.hash(new_password, 10);
            db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.status(200).json({ success: true, message: 'Password updated successfully.' });
            });
        } catch (e) {
            res.status(500).json({ error: 'Internal server error while hashing password' });
        }
    });
});

router.get('/pin', (req, res) => {
    db.get('SELECT pin_hash FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ hasPin: !!(user && user.pin_hash), fingerprint_enabled: false });
    });
});

router.post('/set-pin', async (req, res) => {
    const { pin } = req.body;
    if (!pin || pin.length < 4) return res.status(400).json({ error: 'PIN must be at least 4 digits' });
    const hash = await require('bcrypt').hash(pin, 10);
    db.run('UPDATE users SET pin_hash = ? WHERE id = ?', [hash, req.user.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

router.post('/set-fingerprint', (req, res) => { res.json({ success: true }); });

router.post('/staff/:id/note', (req, res) => {
    if (req.user.role.toLowerCase() !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { note } = req.body;
    db.run('UPDATE users SET admin_note = ? WHERE id = ?', [note || '', req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

router.get('/alerts', (req, res) => {
    if (req.user.role.toLowerCase() !== 'admin') return res.status(403).json({ error: 'Admin only' });
    
    const today = new Date().toISOString().split('T')[0];
    const alerts = [];

    db.all(`SELECT a.*, u.name as user_name, u.photo_url FROM attendance a JOIN users u ON a.user_id = u.id WHERE u.school_name = ? AND a.timestamp LIKE ? AND a.status = 'late'`, [req.user.school_name, today + '%'], (err, attRows) => {
        if (!err && attRows) {
            attRows.forEach(r => alerts.push({ type: 'late', userName: r.user_name, photo: r.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.user_name)}&background=1e4d8c&color=fff`, ts: r.timestamp }));
        }
        
        db.all(`SELECT l.*, u.name as user_name, u.photo_url FROM leaves l JOIN users u ON l.user_id = u.id WHERE u.school_name = ? AND l.date = ?`, [req.user.school_name, today], (err, leaveRows) => {
            if (!err && leaveRows) {
                leaveRows.forEach(r => alerts.push({ type: 'absent', reason: r.reason, leaveType: r.type, userName: r.user_name, photo: r.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.user_name)}&background=1e4d8c&color=fff`, date: r.date }));
            }
            res.json({ alerts });
        });
    });
});

module.exports = router;
