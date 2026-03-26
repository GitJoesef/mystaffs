/* ==========================================
   attendance.js — Attendance Data & Rendering
   ========================================== */

let attendance = [];

/* ---------- Helpers ---------- */
function parseTs(ts) {
    if (!ts) return null;
    // handle 'YYYY-MM-DD HH:MM:SS' -> 'YYYY-MM-DDTHH:MM:SS'
    if (typeof ts === 'string' && ts.indexOf('T') === -1 && ts.indexOf(' ') !== -1) {
        ts = ts.replace(' ', 'T');
    }
    const d = new Date(ts);
    if (isNaN(d)) return new Date();
    return d;
}

/* ---------- Fetch & Refresh ---------- */
async function refreshAttendance(queryStr = '') {
    const r = await api(`/api/attendance${queryStr}`);
    if (!r.ok) return;
    attendance = r.body.rows || [];
    renderMetrics();
    renderPersonalHistory();
}

function presetDate(type) {
    const today = new Date();
    // Use local time for correct date strings
    const offset = today.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(today - offset)).toISOString().slice(0, -1);
    const endStr = localISOTime.split('T')[0];
    let startStr = endStr;

    if (type === 'week') {
        const start = new Date(today);
        start.setDate(today.getDate() - today.getDay());
        startStr = (new Date(start - offset)).toISOString().split('T')[0];
    } else if (type === 'month') {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        startStr = (new Date(start - offset)).toISOString().split('T')[0];
    }

    document.getElementById('date-start').value = startStr;
    document.getElementById('date-end').value = endStr;
    applyDateFilter();
}

async function applyDateFilter() {
    const start = document.getElementById('date-start').value;
    const end = document.getElementById('date-end').value;
    let query = '';
    if (start && end) {
        query = `?startDate=${start}&endDate=${end}`;
    }
    await refreshAttendance(query);
}

function exportCSV() {
    if (!attendance || attendance.length === 0) return alert('No data to export');
    
    // Headers
    let csv = 'User ID,Type,Method,Timestamp,Status\n';
    
    attendance.forEach(r => {
        csv += `${escapeCsv(r.userId)},${escapeCsv(r.type)},${escapeCsv(r.method)},${escapeCsv(r.ts)},${escapeCsv(r.status || '')}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `attendance_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function escapeCsv(str) {
    if (str == null) return '';
    let res = str.toString().replace(/"/g, '""');
    if (res.search(/("|,|\n)/g) >= 0) res = `"${res}"`;
    return res;
}

/* ---------- Metrics ---------- */
function renderMetrics() {
    let totalSeconds = 0;
    const rows = (attendance || []).slice().reverse();
    let lastIn = null;

    rows.forEach(r => {
        const ts = parseTs(r.ts);
        if (!ts) return;
        if (r.type === 'in') {
            lastIn = ts;
        } else if (r.type === 'out') {
            if (lastIn) {
                const diff = (ts - lastIn) / 1000;
                if (diff > 0) totalSeconds += diff;
                lastIn = null;
            }
        }
    });

    // Count ongoing session
    if (lastIn) {
        const diff = (new Date() - lastIn) / 1000;
        if (diff > 0) totalSeconds += diff;
    }

    const hours = (totalSeconds / 3600) || 0;
    const hoursText = hours.toFixed(2) + ' h';
    const eventsText = attendance.length.toString();
    const lastText = attendance[0] ? parseTs(attendance[0].ts).toLocaleString() : '—';

    // Dashboard metrics
    document.getElementById('metric-staff').textContent = hoursText;
    document.getElementById('metric-events').textContent = eventsText;
    document.getElementById('metric-last').textContent = lastText;

    // Analytics metrics
    const ah = document.getElementById('analytics-metric-hours');
    const ae = document.getElementById('analytics-metric-events');
    const al = document.getElementById('analytics-metric-last');
    if (ah) ah.textContent = hoursText;
    if (ae) ae.textContent = eventsText;
    if (al) al.textContent = lastText;

    // Render bar chart
    renderChart(rows);
}

/* ---------- Chart Rendering ---------- */
let attendanceChart = null;

function renderChart(sortedRows) {
    const canvas = document.getElementById('attendance-chart');
    if (!canvas) return;

    // Group hours by date (YYYY-MM-DD)
    const dailyHours = {};
    let currentIn = null;

    sortedRows.forEach(r => {
        const ts = parseTs(r.ts);
        if (!ts) return;

        const dateStr = ts.toISOString().split('T')[0];
        if (!dailyHours[dateStr]) dailyHours[dateStr] = 0;

        if (r.type === 'in') {
            currentIn = ts;
        } else if (r.type === 'out' && currentIn) {
            const diffHours = (ts - currentIn) / 3600000;
            if (diffHours > 0) dailyHours[dateStr] += diffHours;
            currentIn = null;
        }
    });

    // Handle ongoing session for today
    if (currentIn) {
        const diffHours = (new Date() - currentIn) / 3600000;
        const todayStr = new Date().toISOString().split('T')[0];
        if (!dailyHours[todayStr]) dailyHours[todayStr] = 0;
        if (diffHours > 0) dailyHours[todayStr] += diffHours;
    }

    // Sort dates and prepare labels/data (last 7 days showing data, or empty if none)
    const dates = Object.keys(dailyHours).sort();
    const labels = dates.length ? dates : [new Date().toISOString().split('T')[0]];
    const data = labels.map(d => dailyHours[d] ? parseFloat(dailyHours[d].toFixed(2)) : 0);

    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? 'hsl(240, 3%, 92%)' : 'hsl(240, 5%, 12%)';
    const gridColor = isDark ? 'hsl(240, 4%, 14%)' : 'hsl(240, 4%, 90%)';

    const ctx = canvas.getContext('2d');

    if (attendanceChart) {
        attendanceChart.data.labels = labels;
        attendanceChart.data.datasets[0].data = data;
        attendanceChart.options.scales.x.ticks.color = textColor;
        attendanceChart.options.scales.y.ticks.color = textColor;
        attendanceChart.options.scales.x.grid.color = gridColor;
        attendanceChart.options.scales.y.grid.color = gridColor;
        attendanceChart.update();
        return;
    }

    attendanceChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Hours Worked',
                data: data,
                backgroundColor: 'hsl(215, 85%, 28%)',
                borderRadius: 4,
                barPercentage: 0.6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) { return context.parsed.y + ' hrs'; }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: gridColor },
                    ticks: { color: textColor }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: textColor }
                }
            }
        }
    });
}

/* ---------- Personal History ---------- */
function renderPersonalHistory() {
    const html = attendance.length
        ? attendance.map(r => {
            const statusBadge = (r.status === 'late' && r.type === 'in')
                ? '<span style="color:hsl(0, 72%, 50%);font-weight:700;margin-left:8px;font-size:0.7rem;">LATE</span>'
                : '';

            return `<div style="padding:0.5rem 0;border-bottom:1px solid hsl(var(--border));">
                <div style="font-weight:600;font-size:0.875rem;">
                    ${r.type.toUpperCase()}
                    ${statusBadge}
                </div>
                <div class="text-muted" style="font-size:0.75rem;">${new Date(r.ts).toLocaleString()} — ${r.method}</div>
            </div>`;
        }).join('')
        : '<div class="text-muted" style="font-size:0.875rem;">No history</div>';

    const el = document.getElementById('personal-history');
    if (el) el.innerHTML = html;

    const el2 = document.getElementById('analytics-personal-history');
    if (el2) el2.innerHTML = html;
}

window.addEventListener('themeChanged', () => {
    if (attendance && attendanceChart) {
        renderChart(attendance.slice().reverse());
    }
});

async function authenticateBiometrics() {
    try {
        // 1. Get auth options from server
        const optionsRes = await api('/api/webauthn/login-options', { method: 'POST' });
        if (!optionsRes.ok) throw new Error('No biometrics registered or failed to get options');
        const options = optionsRes.body;

        // 2. Trigger biometric login prompt
        const { startAuthentication } = SimpleWebAuthnBrowser;
        const authResp = await startAuthentication(options);

        // 3. Verify on server
        const verifyRes = await api('/api/webauthn/verify-authentication', {
            method: 'POST',
            body: authResp
        });

        if (verifyRes.ok && verifyRes.body.verified) {
            return true;
        } else {
            throw new Error('Biometric verification failed');
        }
    } catch (err) {
        console.error('WebAuthn Error:', err);
        let msg = err.message;
        if (err.name === 'NotAllowedError') {
            msg = 'Authentication timed out or was cancelled by the user.';
        } else if (err.name === 'SecurityError') {
            msg = 'Security error: WebAuthn requires a secure context (HTTPS or localhost).';
        }
        alert('Biometric authentication failed: ' + msg);
        return false;
    }
}
