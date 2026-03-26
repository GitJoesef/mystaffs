/* ==========================================
   auth.js — Check In / Out & Authentication
   ========================================== */

/* ---------- Check In ---------- */
async function doCheckIn(method) {
    let body = { method };
    if (method === 'pin') {
        const p = prompt('Enter PIN:');
        if (!p) return;
        body.pin = p;
    }

    if (method === 'fingerprint') {
        const success = await authenticateBiometrics();
        if (!success) return;
    }

    const r = await api('/api/checkin', { method: 'POST', body });
    if (!r.ok) return alert((r.body && r.body.error) || 'Check-in failed');
    alert('Checked in successfully!');
    await refreshAttendance();
}

/* ---------- Check Out ---------- */
async function doCheckOut(method) {
    let body = { method };
    if (method === 'pin') {
        const p = prompt('Enter PIN:');
        if (!p) return;
        body.pin = p;
    }

    if (method === 'fingerprint') {
        const success = await authenticateBiometrics();
        if (!success) return;
    }

    const r = await api('/api/checkout', { method: 'POST', body });
    if (!r.ok) return alert((r.body && r.body.error) || 'Check-out failed');
    alert('Checked out successfully!');
    await refreshAttendance();
}

/* ---------- Auth Button Visibility ---------- */
function updateAuthButtons() {
    const pinCheckin = document.getElementById('pin-checkin-btn');
    const fpCheckin = document.getElementById('fingerprint-checkin-btn');
    const pinCheckout = document.getElementById('pin-checkout-btn');
    const fpCheckout = document.getElementById('fingerprint-checkout-btn');

    if (pinCheckin) pinCheckin.closest('.feature-card').style.display = (window._hasPin ? '' : 'none');
    if (fpCheckin) fpCheckin.closest('.feature-card').style.display = (window._fpEnabled ? '' : 'none');
    if (pinCheckout) pinCheckout.closest('.feature-card').style.display = (window._hasPin ? '' : 'none');
    if (fpCheckout) fpCheckout.closest('.feature-card').style.display = (window._fpEnabled ? '' : 'none');
}

/* ---------- PIN Modal ---------- */
function showPinModal() {
    document.getElementById('pin-field').value = '';
    document.getElementById('pin-modal').style.display = 'flex';
}

function initPinModal() {
    document.getElementById('pin-cancel').onclick = () => {
        document.getElementById('pin-modal').style.display = 'none';
    };

    document.getElementById('pin-save').onclick = async () => {
        const pin = document.getElementById('pin-field').value.trim();
        if (pin.length < 4) { alert('PIN must be at least 4 characters'); return; }
        const r = await api('/api/set-pin', { method: 'POST', body: { pin } });
        if (!r.ok) return alert((r.body && r.body.error) || 'Failed');
        alert('PIN saved');
        window._hasPin = true;
        updateAuthButtons();
        document.getElementById('pin-modal').style.display = 'none';
    };
}
