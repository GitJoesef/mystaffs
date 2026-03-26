const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Get current school settings (accessible by any authenticated user)
router.get('/', authenticateToken, (req, res) => {
    db.get('SELECT * FROM settings ORDER BY id DESC LIMIT 1', (err, row) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ settings: row });
    });
});

// Update school settings (Admin only)
router.post('/', authenticateToken, (req, res) => {
    // Only Admin can update settings
    if (req.user.role !== 'Admin') {
        return res.status(403).json({ error: 'Forbidden. Admin access required.' });
    }

    const { school_name, start_time, working_days, available_classes, available_subjects } = req.body;
    const clsStr = JSON.stringify(available_classes || []);
    const subStr = JSON.stringify(available_subjects || []);

    // Check if a row exists
    db.get('SELECT id FROM settings ORDER BY id DESC LIMIT 1', (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });

        if (row) {
            // Update
            db.run(
                'UPDATE settings SET school_name = ?, start_time = ?, working_days = ?, available_classes = ?, available_subjects = ? WHERE id = ?',
                [school_name, start_time, working_days, clsStr, subStr, row.id],
                function(err) {
                    if (err) return res.status(500).json({ error: 'Error updating settings' });
                    res.json({ message: 'Settings updated successfully' });
                }
            );
        } else {
            // Insert
            db.run(
                'INSERT INTO settings (school_name, start_time, working_days, available_classes, available_subjects) VALUES (?, ?, ?, ?, ?)',
                [school_name, start_time, working_days, clsStr, subStr],
                function(err) {
                    if (err) return res.status(500).json({ error: 'Error inserting settings' });
                    res.json({ message: 'Settings saved successfully' });
                }
            );
        }
    });
});

module.exports = router;
