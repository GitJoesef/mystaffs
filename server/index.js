require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const apiRoutes = require('./routes/apiRoutes');
const webauthnRoutes = require('./routes/webauthnRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const kioskRoutes = require('./routes/kioskRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Add cache-control globally to completely prevent HTML/JS caching issues locally
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});

// API Routes
app.use('/api/kiosk', kioskRoutes);
app.use('/api', authRoutes);
app.use('/api', apiRoutes);
app.use('/api/webauthn', webauthnRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/leaves', leaveRoutes);

// Define the root of the frontend application (one directory up from /server)
const frontendPath = path.join(__dirname, '../');

// Serve static frontend files (HTML, CSS, JS, etc.)
app.use(express.static(frontendPath));

// Fallback to landing.html if route not found
app.use((req, res) => {
    res.sendFile(path.join(frontendPath, 'landing.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`TeacherTime Backend Server running on http://localhost:${PORT}`);
});
