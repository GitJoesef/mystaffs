const { fork } = require('child_process');
const path = require('path');

const serverPath = path.join(__dirname, 'index.js');

console.log('🔄 Starting Dual Server Mode for Testing...');
console.log('----------------------------------------------------');

// Admin Server (Port 3000)
const adminEnv = Object.assign({}, process.env, { PORT: 3000 });
const adminServer = fork(serverPath, [], { env: adminEnv });
adminServer.on('message', (msg) => console.log('[Admin Server]', msg));

// Staff Server (Port 3001)
const staffEnv = Object.assign({}, process.env, { PORT: 3001 });
const staffServer = fork(serverPath, [], { env: staffEnv });
staffServer.on('message', (msg) => console.log('[Staff Server]', msg));

console.log('🚀 Admin Dashboard running at: http://localhost:3000');
console.log('🚀 Staff Dashboard running at: http://localhost:3001');
console.log('----------------------------------------------------');
console.log('Press Ctrl+C to stop both servers.');

process.on('SIGINT', () => {
    adminServer.kill();
    staffServer.kill();
    process.exit();
});
