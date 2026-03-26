const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'mystaff-super-secret-key-123';

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Unauthorized (No Token)' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Forbidden (Invalid Token)' });
        req.user = user; // attach user payload to request
        next();
    });
}

module.exports = { authenticateToken, JWT_SECRET };
