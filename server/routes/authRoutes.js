const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

router.post('/signup', async (req, res) => {
    const { name, email, password, role, school_name, subjects, classes } = req.body;

    if (!email || !password || !name || !school_name) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const hash = await bcrypt.hash(password, 10);
        const userId = 'u' + Date.now();
        const userRole = role || 'Staff';
        const subsStr = JSON.stringify(subjects || []);
        const clsStr = JSON.stringify(classes || []);

        db.run(
            `INSERT INTO users (id, name, email, password_hash, school_name, role, subjects, classes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, name, email, hash, school_name, userRole, subsStr, clsStr],
            function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: 'Email already exists' });
                    }
                    return res.status(500).json({ error: err.message });
                }

                // Generate JWT
                const userPayload = { id: userId, email, role: userRole, school_name };
                const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' });

                res.status(200).json({ token, user: { id: userId, name, email, role: userRole, school_name } });
            }
        );
    } catch (e) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/login', (req, res) => {
    const { email, password, school_name } = req.body;

    if (!email || !password || !school_name) {
        return res.status(400).json({ error: 'Missing email, password, or school name' });
    }

    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        if (user.school_name !== school_name) return res.status(401).json({ error: 'Invalid School Name' });

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).json({ error: 'Invalid credentials' });

        const userPayload = { id: user.id, email: user.email, role: user.role, school_name: user.school_name };
        const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' });

        // omit password hash in response
        const { password_hash, ...safeUser } = user;

        // parse arrays
        safeUser.subjects = JSON.parse(safeUser.subjects || '[]');
        safeUser.classes = JSON.parse(safeUser.classes || '[]');

        res.status(200).json({ token, user: safeUser });
    });
});

router.post('/recover-password', async (req, res) => {
    const { email, school_name, new_password } = req.body;

    if (!email || !school_name || !new_password) {
        return res.status(400).json({ error: 'Missing required recovery fields' });
    }

    if (new_password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    db.get('SELECT id FROM users WHERE email = ? AND school_name = ?', [email, school_name], async (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: 'No account found matching that email and school.' });

        try {
            const hash = await bcrypt.hash(new_password, 10);
            db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, user.id], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.status(200).json({ success: true, message: 'Password reset successfully. You can now log in.' });
            });
        } catch (e) {
            res.status(500).json({ error: 'Internal server error while hashing password' });
        }
    });
});

router.get('/public/school', (req, res) => {
    const name = req.query.name;
    if (!name) return res.status(400).json({ error: 'School name required' });
    
    // In our single-instance setup, there's usually 1 setting row. 
    // We match the name loosely to allow users to verify it exists.
    db.get('SELECT school_name, available_classes, available_subjects FROM settings WHERE school_name LIKE ? ORDER BY id DESC LIMIT 1', [name], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!row) return res.status(404).json({ error: 'School not found or not configured yet.' });
        
        try {
            res.json({
                school_name: row.school_name,
                classes: JSON.parse(row.available_classes || '[]'),
                subjects: JSON.parse(row.available_subjects || '[]')
            });
        } catch (e) {
            res.json({ school_name: row.school_name, classes: [], subjects: [] });
        }
    });
});

module.exports = router;
