const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');

// Get all staff for a specific school to display on the kiosk
router.get('/users', (req, res) => {
    const schoolName = req.query.school_name;
    if (!schoolName) {
        return res.status(400).json({ error: 'School name is required for kiosk setup' });
    }

    // Only return minimum identifiable data
    db.all('SELECT id, name, photo_url, role FROM users WHERE school_name = ? ORDER BY name ASC', [schoolName], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const safeUsers = rows.map(u => ({
            id: u.id,
            name: u.name,
            role: u.role,
            photo: u.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=1e4d8c&color=fff`
        }));

        res.json({ users: safeUsers });
    });
});

// Check in/out using PIN
router.post('/checkin', async (req, res) => {
    handleKioskAuth(req, res, 'in');
});

router.post('/checkout', async (req, res) => {
    handleKioskAuth(req, res, 'out');
});

function handleKioskAuth(req, res, type) {
    const { userId, pin } = req.body;
    if (!userId || !pin) {
        return res.status(400).json({ error: 'User ID and PIN are required' });
    }

    db.get('SELECT pin_hash FROM users WHERE id = ?', [userId], async (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (!user.pin_hash) return res.status(401).json({ error: 'No PIN is set for this account. Please set it in your dashboard settings first.' });

        const match = await bcrypt.compare(pin, user.pin_hash);
        if (!match) {
            return res.status(401).json({ error: 'Incorrect PIN' });
        }

        const ts = new Date().toISOString();
        if (type === 'out') {
            db.run('INSERT INTO attendance (user_id, type, method, timestamp) VALUES (?, ?, ?, ?)',
                [userId, 'out', 'pin', ts],
                (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ success: true, message: 'Checked out successfully!' });
                }
            );
        } else {
            // Check in logic with tardiness check
            db.get('SELECT start_time, working_days FROM settings ORDER BY id DESC LIMIT 1', (err, settings) => {
                let status = 'on-time';

                if (!err && settings && settings.start_time) {
                    const now = new Date();
                    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });

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
                    [userId, 'in', 'pin', ts, status],
                    (err) => {
                        if (err) return res.status(500).json({ error: err.message });
                        res.json({ success: true, status, message: status === 'late' ? 'Checked in successfully (Marked as Late)' : 'Checked in successfully!' });
                    }
                );
            });
        }
    });
}

module.exports = router;
