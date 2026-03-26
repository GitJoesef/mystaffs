/* ==========================================
   api.js — Backend Communication Layer
   ========================================== */

function getCurrentUser() {
    // Only used locally for very fast checks (e.g. if a token exists)
    return localStorage.getItem('staffsync_token');
}

/* ---------- Real API Helper ---------- */
async function api(path, opts = {}) {
    if (typeof DEMO_MODE !== 'undefined' && DEMO_MODE) {
        console.warn("DEMO_MODE still enabled. Backend requests simulated.");
        return { ok: false, body: { error: 'Demo mode is deprecated.' } };
    }

    const token = localStorage.getItem('staffsync_token');

    opts.headers = opts.headers || {};
    if (token) {
        opts.headers['Authorization'] = 'Bearer ' + token;
    }

    if (opts.body && typeof opts.body === 'object') {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(opts.body);
    }

    const res = await fetch(path, opts);
    let j = null;
    try { j = await res.json(); } catch (e) { }
    return { ok: res.ok, status: res.status, body: j };
}
