const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Submit a new leave request (Staff)
router.post('/', authenticateToken, (req, res) => {
    const { date, reason, type } = req.body;
    const userId = req.user.id;

    if (!date || !type) {
        return res.status(400).json({ error: 'Date and Type are required.' });
    }

    db.run(
        'INSERT INTO leaves (user_id, date, reason, type, status) VALUES (?, ?, ?, ?, ?)',
        [userId, date, reason || '', type, 'pending'],
        function(err) {
            if (err) {
                console.error("Error creating leave:", err);
                return res.status(500).json({ error: 'Error submitting leave request' });
            }
            res.status(201).json({ message: 'Leave request submitted successfully', id: this.lastID });
        }
    );
});

// Get leaves (Admin views all, Staff views their own)
router.get('/', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const role = req.user.role;

    if (role === 'Admin') {
        // Admin gets all leaves with user info
        db.all(`
            SELECT leaves.*, users.name as user_name, users.photo_url 
            FROM leaves 
            JOIN users ON leaves.user_id = users.id 
            ORDER BY leaves.date DESC
        `, (err, rows) => {
            if (err) return res.status(500).json({ error: 'Error fetching leaves' });
            res.json({ leaves: rows });
        });
    } else {
        // Staff gets only their own
        db.all('SELECT * FROM leaves WHERE user_id = ? ORDER BY date DESC', [userId], (err, rows) => {
            if (err) return res.status(500).json({ error: 'Error fetching leaves' });
            res.json({ leaves: rows });
        });
    }
});

// Admin review/update leave status
router.post('/review', authenticateToken, (req, res) => {
    if (req.user.role !== 'Admin') {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const { leaveId, status } = req.body; // status: 'approved' or 'rejected'

    if (!leaveId || !status) {
        return res.status(400).json({ error: 'Leave ID and Status required' });
    }

    db.run('UPDATE leaves SET status = ? WHERE id = ?', [status, leaveId], function(err) {
        if (err) return res.status(500).json({ error: 'Error updating leave' });
        res.json({ message: 'Leave status updated successfully' });
    });
});

module.exports = router;
