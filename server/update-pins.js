const bcrypt = require('bcrypt');
const db = require('./db');

async function updatePins() {
    console.log('Updating all users with default PIN 1234...');
    const pinHash = await bcrypt.hash('1234', 10);

    db.run(`UPDATE users SET pin_hash = ? WHERE pin_hash IS NULL OR pin_hash = ''`, [pinHash], function(err) {
        if (err) {
            console.error('Error updating PINs:', err);
        } else {
            console.log(`Updated ${this.changes} users with default PIN.`);
        }
        process.exit(0);
    });
}

updatePins();
