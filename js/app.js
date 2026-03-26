/* ==========================================
   app.js — Application Entry Point
   ========================================== */

/* ---------- Header ---------- */
function setHeader(user) {
    document.getElementById('hdr-name').textContent = user.name || user.email;
    document.getElementById('hdr-role').textContent = `${user.role || 'Staff'} • ${user.school_name || 'Unknown School'}`;
    document.getElementById('hdr-avatar').src =
        `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.email)}&background=1e4d8c&color=fff`;

    const sideRole = document.getElementById('sidebar-role');
    if (sideRole) sideRole.textContent = `${user.role || 'Staff'} • ${user.school_name || 'Unknown School'}`;
}

/* ---------- Main Initialization ---------- */
async function loadInitial() {
    const r = await api('/api/me');
    if (!r.ok) {
        localStorage.removeItem('staffsync_token');
        location.href = 'login.html?v=' + Date.now();
        return;
    }

    const me = r.body.user;
    setHeader(me);
    populateProfile(me);

    // Configure Role-Based Dashboard UI
    const isAdmin = me.role.toLowerCase() === 'admin';
    window.isAdmin = isAdmin;
    if (isAdmin) {
        // Admin: hide personal history and personal analytics since they don't check in
        const dPersonal = document.getElementById('dash-personal');
        if (dPersonal) dPersonal.style.display = 'none';

        // Fetch staff list for Admin
        const staffRes = await api('/api/staff');
        if (staffRes.ok) {
            staff = staffRes.body.staff;
            renderStaff();
        }

        // Fetch School Settings for Admin
        const settingsRes = await api('/api/settings');
        if (settingsRes.ok && settingsRes.body.settings) {
            const setts = settingsRes.body.settings;
            document.getElementById('school-name-field').value = setts.school_name || '';
            document.getElementById('start-time-field').value = setts.start_time || '';
            
            const wdList = (setts.working_days || '').split(',');
            document.querySelectorAll('.work-day-cb').forEach(cb => {
                cb.checked = wdList.includes(cb.value);
            });
        }

        // Admin sees all leaves
        loadAdminLeaves();

        // Load Alerts
        loadAdminAlerts();
        document.getElementById('dash-alerts-card').style.display = 'block';

        // Start Live Check-in Feed Polling
        startLiveFeed();

    } else {
        // Staff: hide admin elements
        const dAdmin = document.getElementById('dash-admin');
        if (dAdmin) dAdmin.style.display = 'none';

        const aAdminCard = document.getElementById('analytics-admin-card');
        if (aAdminCard) aAdminCard.style.display = 'none';
    }

    // Still fetch personal attendance (Staff gets their history, Admin gets empty since they don't clock in)
    await refreshAttendance();
    renderMetrics();
    renderPersonalHistory();

    // Role-aware navigation
    makeNav(me.role || 'Staff');

    // Show/Hide admin search in header
    const searchContainer = document.getElementById('dash-search-container');
    if (searchContainer) {
        searchContainer.style.display = isAdmin ? 'block' : 'none';
    }

    // Profile button opens Settings
    document.getElementById('profile-btn').onclick = () => {
        showSection('settings');
        setTimeout(() => {
            const el = document.getElementById('name-field');
            if (el) el.focus();
        }, 60);
    };

    // Theme
    initTheme();

    // PIN / Fingerprint status
    const pinStatus = await api('/api/pin');
    if (pinStatus && pinStatus.ok) {
        window._hasPin = !!pinStatus.body.hasPin;
        window._fpEnabled = !!pinStatus.body.fingerprint_enabled;
    } else {
        window._hasPin = false;
        window._fpEnabled = false;
    }
    updateAuthButtons();

    // Fingerprint toggle in Settings
    const fpCheckbox = document.getElementById('enable-fingerprint');
    if (fpCheckbox) {
        fpCheckbox.checked = !!window._fpEnabled;
        fpCheckbox.onchange = async function () {
            if (this.checked) {
                // Trigger real registration
                await registerBiometrics();
            } else {
                // For demo/simplicity, we just turn off the toggle, 
                // but ideally we'd remove credentials on server.
                const r2 = await api('/api/set-fingerprint', { method: 'POST', body: { enabled: false } });
                if (r2.ok) {
                    window._fpEnabled = false;
                    updateAuthButtons();
                    alert('Biometrics disabled for check-in.');
                }
            }
        };
    }
}

/* ---------- Bind Shared UI Events ---------- */
function initApp() {
    // Logout buttons (sidebar + mobile)
    document.querySelectorAll('.logout-btn').forEach(b => {
        b.onclick = () => {
            localStorage.removeItem('staffsync_token');
            location.href = 'login.html?v=' + Date.now();
        };
    });

    // PIN modal
    initPinModal();

    // Profile save
    initProfileSave();

    // Password change
    initPasswordChange();

    // Build initial nav (will be overwritten once role is known)
    makeNav();

    // Strip ?v= from URL so it doesn't clutter or break refresh
    if (window.location.search.includes('v=')) {
        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
    }

    // Boot
    loadInitial();

    // Restore section from hash if it's valid
    const hash = window.location.hash.substring(1);
    if (sections.includes(hash)) {
        showSection(hash);
    } else {
        showSection('dashboard');
    }

    // Leave Binding
    const lf = document.getElementById('leave-form');
    if (lf) lf.onsubmit = submitLeave;
    
    // Admin Settings Binding
    const sss = document.getElementById('save-school-settings');
    if (sss) sss.onclick = saveSchoolSettings;
}

// ======================== NEW LOGIC ======================== //

async function saveSchoolSettings() {
    const sname = document.getElementById('school-name-field').value;
    const stime = document.getElementById('start-time-field').value;
    
    const wd = [];
    document.querySelectorAll('.work-day-cb').forEach(cb => {
        if(cb.checked) wd.push(cb.value);
    });

    const body = {
        school_name: sname,
        start_time: stime,
        working_days: wd.join(',')
    };

    const r = await api('/api/settings', { method: 'POST', body });
    if (r.ok) {
        alert('School Settings Saved successfully!');
    } else {
        alert(r.body.error || 'Failed to save configure.');
    }
}

async function submitLeave(e) {
    e.preventDefault();
    const date = document.getElementById('leave-date').value;
    const type = document.getElementById('leave-type').value;
    const reason = document.getElementById('leave-reason').value;
    
    if(!date || !type) return alert('Date and type required.');
    
    const r = await api('/api/leaves', { method: 'POST', body: { date, type, reason } });
    if(r.ok) {
        alert('Leave logged successfully!');
        e.target.reset();
    } else {
        alert('Failed to log leave: ' + r.body.error);
    }
}

async function loadAdminLeaves() {
    const listEl = document.getElementById('admin-leaves-list');
    if(!listEl) return;
    listEl.parentElement.style.display = 'block';

    const res = await api('/api/leaves');
    if(!res.ok || !res.body.leaves) return;

    if(res.body.leaves.length === 0) {
        listEl.innerHTML = '<div class="text-muted" style="font-size:0.875rem;">No leave requests found.</div>';
        return;
    }

    listEl.innerHTML = res.body.leaves.map(l => `
        <div class="flex items-center justify-between" style="padding:0.75rem; border:1px solid hsl(var(--border)); border-radius:var(--radius);">
            <div class="flex items-center gap-3">
                <img src="${escapeHtml(l.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(l.user_name)}&background=1e4d8c&color=fff`)}" style="width:2rem;height:2rem;border-radius:50%;" />
                <div>
                    <div style="font-weight:600;font-size:0.875rem;">${escapeHtml(l.user_name)}</div>
                    <div class="text-muted" style="font-size:0.75rem;">${escapeHtml(new Date(l.date).toLocaleDateString())} • ${escapeHtml(l.type.toUpperCase())}</div>
                    <div class="text-muted" style="font-size:0.75rem;">${escapeHtml(l.reason || 'No reason provided')}</div>
                </div>
            </div>
            <div style="font-size:0.75rem;font-weight:600;padding:0.2rem 0.5rem;border-radius:4px;background:hsl(var(--muted));">
               ${escapeHtml(l.status.toUpperCase())}
            </div>
        </div>
    `).join('');
}

let liveFeedTimer = null;
async function startLiveFeed() {
    const feedEl = document.getElementById('live-feed');
    if(!feedEl) return;

    try {
        const r = await api('/api/attendance/live');
        if(r.ok && r.body.feed) {
            if(r.body.feed.length === 0) {
                feedEl.innerHTML = '<div class="text-muted" style="font-size:0.875rem;">No recent check-ins.</div>';
            } else {
                feedEl.innerHTML = r.body.feed.map(item => {
                    const timeStr = new Date(item.ts).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    
                    const statusBadge = (item.status === 'late' && item.type === 'in')
                        ? '<span style="color:hsl(0, 72%, 50%);font-weight:700;margin-left:8px;font-size:0.7rem;">LATE</span>'
                        : '';

                    const actionColor = item.type === 'in' ? 'hsl(142, 60%, 40%)' : 'hsl(var(--destructive))';

                    return `
                        <div class="flex items-center justify-between" style="padding:0.5rem 0; border-bottom:1px solid hsl(var(--border));">
                            <div class="flex items-center gap-2">
                                <img src="${escapeHtml(item.photo)}" style="width:1.75rem;height:1.75rem;border-radius:50%;object-fit:cover;" />
                                <div>
                                    <div style="font-weight:600;font-size:0.875rem;">${escapeHtml(item.userName)}</div>
                                    <div class="text-muted" style="font-size:0.75rem;">
                                        <span style="color:${actionColor};font-weight:600;">${item.type.toUpperCase()}</span> 
                                        at ${timeStr} 
                                        ${statusBadge}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }
    } catch(e) { }

    // Auto-refresh every 5 seconds
    clearTimeout(liveFeedTimer);
    liveFeedTimer = setTimeout(startLiveFeed, 5000);
}

function initPasswordChange() {
    const form = document.getElementById('change-password-form');
    if (!form) return;

    form.onsubmit = async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button');
        const err = document.getElementById('password-error');
        const success = document.getElementById('password-success');
        const current_password = document.getElementById('current-password').value;
        const new_password = document.getElementById('new-password').value;

        btn.disabled = true;
        btn.textContent = 'Updating...';
        err.style.display = 'none';
        success.style.display = 'none';

        const r = await api('/api/change-password', { method: 'POST', body: { current_password, new_password } });

        btn.disabled = false;
        btn.textContent = 'Update Password';

        if (r.ok) {
            success.textContent = 'Password updated successfully';
            success.style.display = 'block';
            form.reset();
        } else {
            err.textContent = r.body.error || 'Failed to update password';
            err.style.display = 'block';
        }
    };
}

// Start the app when the DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
