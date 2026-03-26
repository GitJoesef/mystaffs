const express = require('express');
const router = express.Router();
const {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const rpID = 'localhost';
const origin = `http://${rpID}:3000`; // Adjust if port changes

// --- Helper Functions ---
function getUserCredentials(userId) {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM credentials WHERE user_id = ?', [userId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows.map(row => ({
                id: row.id,
                publicKey: Buffer.from(row.public_key, 'base64'),
                counter: row.counter,
                transports: JSON.parse(row.transports),
            })));
        });
    });
}

/**
 * Registration: Step 1 - Generate Options
 */
router.post('/register-options', authenticateToken, async (req, res) => {
    const user = req.user;
    const userCredentials = await getUserCredentials(user.id);

    const options = await generateRegistrationOptions({
        rpName: 'TeacherTime',
        rpID,
        userID: user.id,
        userName: user.email,
        attestationType: 'none',
        excludeCredentials: userCredentials.map(cred => ({
            id: cred.id,
            type: 'public-key',
        })),
        authenticatorSelection: {
            residentKey: 'preferred',
            userVerification: 'preferred',
        },
    });

    // Store challenge in session (simulated via global for demo, should be Redis/Session)
    req.app.locals[`challenge_${user.id}`] = options.challenge;

    res.json(options);
});

/**
 * Registration: Step 2 - Verify
 */
router.post('/verify-registration', authenticateToken, async (req, res) => {
    const user = req.user;
    const body = req.body;
    const expectedChallenge = req.app.locals[`challenge_${user.id}`];

    try {
        const verification = await verifyRegistrationResponse({
            response: body,
            expectedChallenge,
            expectedOrigin: [origin, 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001'],
            expectedRPID: rpID,
        });

        if (verification.verified) {
            const { registrationInfo } = verification;
            const { credentialID, credentialPublicKey, counter } = registrationInfo;

            // Save to DB
            db.run(
                'INSERT INTO credentials (id, user_id, public_key, counter, transports) VALUES (?, ?, ?, ?, ?)',
                [
                    credentialID,
                    user.id,
                    Buffer.from(credentialPublicKey).toString('base64'),
                    counter,
                    JSON.stringify(body.response.transports || []),
                ]
            );

            // Mark user as having fingerprint enabled
            db.run('UPDATE users SET fingerprint_enabled = 1 WHERE id = ?', [user.id]);

            res.json({ verified: true });
        } else {
            res.status(400).json({ verified: false });
        }
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * Authentication: Step 1 - Generate Options
 */
router.post('/login-options', authenticateToken, async (req, res) => {
    const user = req.user;
    const userCredentials = await getUserCredentials(user.id);

    const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: userCredentials.map(cred => ({
            id: cred.id,
            type: 'public-key',
            transports: cred.transports,
        })),
        userVerification: 'preferred',
    });

    req.app.locals[`auth_challenge_${user.id}`] = options.challenge;

    res.json(options);
});

/**
 * Authentication: Step 2 - Verify
 */
router.post('/verify-authentication', authenticateToken, async (req, res) => {
    const user = req.user;
    const body = req.body;
    const expectedChallenge = req.app.locals[`auth_challenge_${user.id}`];

    try {
        // Find the credential in DB
        const cred = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM credentials WHERE id = ?', [body.id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!cred) throw new Error('Credential not found');

        const verification = await verifyAuthenticationResponse({
            response: body,
            expectedChallenge,
            expectedOrigin: [origin, 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001'],
            expectedRPID: rpID,
            authenticator: {
                credentialID: cred.id,
                credentialPublicKey: Buffer.from(cred.public_key, 'base64'),
                counter: cred.counter,
            },
        });

        if (verification.verified) {
            const { authenticationInfo } = verification;
            const { newCounter } = authenticationInfo;

            // Update counter
            db.run('UPDATE credentials SET counter = ? WHERE id = ?', [newCounter, cred.id]);

            res.json({ verified: true });
        } else {
            res.status(400).json({ verified: false });
        }
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
