/* ==========================================
   staff.js — Staff Directory
   ========================================== */

let staff = [];

function renderStaff(list = staff) {
    const el = document.getElementById('staff-list');
    if (!el) return;
    el.innerHTML = '';

    list.forEach(s => {
        const card = document.createElement('div');
        card.className = 'feature-card hover-elevate';
        card.style.cssText = 'display:flex;align-items:center;gap:0.75rem;cursor:pointer;padding:0.75rem;';
        card.innerHTML = `
            <img src="${s.photo}" style="width:3rem;height:3rem;border-radius:9999px;object-fit:cover;" />
            <div>
                <div style="font-weight:600;font-size:0.875rem;">${s.fullName}</div>
                <div class="text-muted" style="font-size:0.75rem;">${s.role}</div>
            </div>`;
        card.onclick = () => showStaffDetail(s);
        el.appendChild(card);
    });
}

function handleStaffSearch(e) {
    const q = e.target.value.toLowerCase();
    const filtered = staff.filter(s =>
        s.fullName.toLowerCase().includes(q) ||
        s.role.toLowerCase().includes(q) ||
        (s.subjects && s.subjects.some(sub => sub.toLowerCase().includes(q)))
    );
    renderStaff(filtered);
}

function handleDashboardSearch(e) {
    const q = e.target.value.toLowerCase().trim();
    const resultsEl = document.getElementById('dash-search-results');
    if (!resultsEl) return;

    if (!q) {
        resultsEl.style.display = 'none';
        return;
    }

    const filtered = staff.filter(s =>
        s.fullName.toLowerCase().includes(q) ||
        (s.subjects && s.subjects.some(sub => sub.toLowerCase().includes(q))) ||
        (s.classes && s.classes.some(cls => cls.toLowerCase().includes(q)))
    );

    if (filtered.length === 0) {
        resultsEl.innerHTML = '<div class="text-muted" style="padding:0.5rem;font-size:0.875rem;">No staff found.</div>';
    } else {
        resultsEl.innerHTML = filtered.map(s => {
            const subs = (s.subjects || []).join(', ') || 'No subjects';
            const clss = (s.classes || []).join(', ') || 'No classes';
            return `
                <div class="search-result-item flex items-center gap-3" 
                     style="padding:0.5rem; cursor:pointer; border-radius:var(--radius);" 
                     onclick="showStaffFromSearch('${s.id}')">
                    <img src="${s.photo}" style="width:2.5rem;height:2.5rem;border-radius:9999px;" />
                    <div style="flex:1;">
                        <div style="font-weight:600;font-size:0.875rem;">${s.fullName}</div>
                        <div class="text-muted" style="font-size:0.75rem;">${s.role}</div>
                        <div class="text-muted" style="font-size:0.7rem; margin-top:0.125rem;">
                            ${subs} • ${clss}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    resultsEl.style.display = 'block';
}

function showStaffFromSearch(id) {
    const s = staff.find(x => x.id === id);
    if (!s) return;

    // Hide search results
    document.getElementById('dash-search-results').style.display = 'none';
    document.getElementById('dash-staff-search').value = '';

    // Switch to staff section and show detail
    showSection('staff');
    showStaffDetail(s);
}

// Global click to close search results
document.addEventListener('click', (e) => {
    const results = document.getElementById('dash-search-results');
    const search = document.getElementById('dash-staff-search');
    if (results && search && !search.contains(e.target) && !results.contains(e.target)) {
        results.style.display = 'none';
    }
});

async function showStaffDetail(s) {
    // Hide list, show detail
    document.getElementById('staff-list-view').style.display = 'none';
    document.getElementById('staff-detail-view').style.display = 'block';

    // Populate static profile info
    document.getElementById('detail-photo').src = s.photo;
    document.getElementById('detail-name').textContent = s.fullName;
    document.getElementById('detail-role').textContent = s.role;
    document.getElementById('detail-bio').textContent = s.bio || 'No bio provided.';

    // Subjects
    const subContainer = document.getElementById('detail-subjects');
    subContainer.innerHTML = (s.subjects || []).map(t => `<span class="badge">${t}</span>`).join('') || '<span class="text-muted" style="font-size:0.75rem;">None</span>';

    // Classes
    const clsContainer = document.getElementById('detail-classes');
    clsContainer.innerHTML = (s.classes || []).map(t => `<span class="badge" style="background:hsl(var(--secondary)); color:hsl(var(--secondary-foreground)); border-color:hsl(var(--secondary));">${t}</span>`).join('') || '<span class="text-muted" style="font-size:0.75rem;">None</span>';

    // Admin Notes Block
    const noteCard = document.getElementById('detail-admin-note').closest('.card');
    if (window.isAdmin) {
        noteCard.style.display = 'block';
        document.getElementById('detail-admin-note').value = s.admin_note || '';
    } else {
        noteCard.style.display = 'none';
    }

    // Set globally for saving
    window.currentStaffId = s.id;

    // Fetch their history
    loadStaffHistory(s.id);
}

function closeStaffDetail() {
    document.getElementById('staff-detail-view').style.display = 'none';
    document.getElementById('staff-list-view').style.display = 'block';
}

let detailChart = null;

async function loadStaffHistory(userId) {
    const historyContainer = document.getElementById('detail-history');
    if (!historyContainer) return;

    const [attRes, leavesRes] = await Promise.all([
        api('/api/attendance?userId=' + encodeURIComponent(userId)),
        api('/api/leaves')
    ]);

    if (!attRes.ok) {
        historyContainer.innerHTML = '<div style="color:hsl(var(--destructive));">Failed to load attendance records.</div>';
        return;
    }

    const attRows = attRes.body.rows || [];
    const leaves = leavesRes.ok ? leavesRes.body.leaves.filter(l => l.user_id === userId) : [];

    // format leaves to match shapes for sorting
    leaves.forEach(l => {
        attRows.push({
            isLeave: true,
            ts: l.date + 'T00:00:00.000Z',
            type: 'absent',
            method: 'leave request',
            status: l.status,
            reason: l.reason,
            leaveType: l.type
        });
    });

    // sort by timestamp descending
    attRows.sort((a,b) => new Date(b.ts) - new Date(a.ts));
    const rows = attRows;

    // 1. Render History List
    historyContainer.innerHTML = rows.length
        ? rows.map(row => {
            if (row.isLeave) {
                return `<div style="padding:0.5rem 0;border-bottom:1px solid hsl(var(--border)); background:hsl(var(--destructive)/0.05); padding-left:0.5rem; border-left:3px solid hsl(var(--destructive));">
                            <div style="font-weight:600;font-size:0.875rem;color:hsl(var(--destructive));">
                                ABSENT - ${row.leaveType.toUpperCase()}
                            </div>
                            <div class="text-muted" style="font-size:0.75rem;">${new Date(row.ts).toLocaleDateString()} — Reason: ${row.reason} (${row.status.toUpperCase()})</div>
                        </div>`;
            }

            const statusBadge = row.status === 'late' 
                ? '<span style="color:hsl(0, 72%, 50%);font-weight:700;margin-left:8px;font-size:0.7rem;">LATE</span>'
                : '<span style="color:hsl(142, 60%, 40%);font-weight:700;margin-left:8px;font-size:0.7rem;">ON-TIME</span>';

            return `<div style="padding:0.5rem 0;border-bottom:1px solid hsl(var(--border));">
                        <div style="font-weight:600;font-size:0.875rem;">
                            ${row.type.toUpperCase()}
                            ${row.type === 'in' ? statusBadge : ''}
                        </div>
                        <div class="text-muted" style="font-size:0.75rem;">${new Date(row.ts).toLocaleString()} — ${row.method}</div>
                    </div>`;
        }).join('')
        : '<div class="text-muted" style="font-size:0.875rem;">No recent records.</div>';

    // 2. Render Check In/Out Chart
    renderDetailChart(rows);

    // 3. Render Monthly Summary Calendar
    renderMonthlyCalendar(rows);
}

function renderDetailChart(sortedRows) {
    const canvas = document.getElementById('staff-detail-chart');
    if (!canvas) return;

    // Group hours by date (YYYY-MM-DD)
    const dailyHours = {};
    let currentIn = null;

    sortedRows.forEach(r => {
        const ts = parseTs(r.ts); // from attendance.js
        if (!ts) return;
        const dateStr = ts.toISOString().split('T')[0];
        if (!dailyHours[dateStr]) dailyHours[dateStr] = 0;

        if (r.type === 'in') currentIn = ts;
        else if (r.type === 'out' && currentIn) {
            dailyHours[dateStr] += (ts - currentIn) / 3600000;
            currentIn = null;
        }
    });

    if (currentIn) {
        const str = new Date().toISOString().split('T')[0];
        if (!dailyHours[str]) dailyHours[str] = 0;
        dailyHours[str] += (new Date() - currentIn) / 3600000;
    }

    const dates = Object.keys(dailyHours).sort();
    const labels = dates.length ? dates : [new Date().toISOString().split('T')[0]];
    const data = labels.map(d => dailyHours[d] ? parseFloat(dailyHours[d].toFixed(2)) : 0);

    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? 'hsl(240, 3%, 92%)' : 'hsl(240, 5%, 12%)';
    const gridColor = isDark ? 'hsl(240, 4%, 14%)' : 'hsl(240, 4%, 90%)';

    const ctx = canvas.getContext('2d');

    if (detailChart) {
        detailChart.data.labels = labels;
        detailChart.data.datasets[0].data = data;
        detailChart.options.scales.x.ticks.color = textColor;
        detailChart.options.scales.y.ticks.color = textColor;
        detailChart.options.scales.x.grid.color = gridColor;
        detailChart.options.scales.y.grid.color = gridColor;
        detailChart.update();
        return;
    }

    detailChart = new Chart(ctx, {
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
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor } },
                x: { grid: { display: false }, ticks: { color: textColor } }
            }
        }
    });
}

// ---------------- Admin Notes ----------------
async function saveAdminNote() {
    if (!window.currentStaffId) return;
    const note = document.getElementById('detail-admin-note').value;
    const res = await api('/api/staff/' + window.currentStaffId + '/note', {
        method: 'POST',
        body: { note }
    });
    if (res.ok) {
        alert('Note saved successfully!');
        // Update local object
        const s = staff.find(x => x.id === window.currentStaffId);
        if (s) s.admin_note = note;
    } else {
        alert('Failed to save note');
    }
}

// ---------------- Monthly Calendar summary ----------------
function renderMonthlyCalendar(rows) {
    const grid = document.getElementById('monthly-summary-grid');
    if (!grid) return;

    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    document.getElementById('current-month-name').textContent = today.toLocaleString('default', { month: 'long', year: 'numeric' });

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Group attendance by date
    const attendanceByDate = {};
    rows.forEach(r => {
        const ts = parseTs(r.ts); // uses parseTs from attendance.js
        if (!ts) return;
        if (ts.getFullYear() === year && ts.getMonth() === month) {
            const day = ts.getDate();
            if (!attendanceByDate[day]) {
                attendanceByDate[day] = { present: false, late: false, out: false };
            }
            if (r.type === 'in') {
                attendanceByDate[day].present = true;
                if (r.status === 'late') attendanceByDate[day].late = true;
            } else if (r.type === 'out') {
                attendanceByDate[day].out = true;
            }
        }
    });

    let html = '';
    // Optional: add blank spots for start of month (e.g. if 1st is Wednesday)
    // For simplicity, just rendering 1 to N blocks.
    for (let i = 1; i <= daysInMonth; i++) {
        const data = attendanceByDate[i];
        let bgColor = 'hsl(var(--muted))';
        let tooltip = `No record`;

        if (data) {
            if (data.late) {
                bgColor = 'hsl(35, 90%, 50%)'; // Orange
                tooltip = 'Late';
            } else if (data.present) {
                bgColor = 'hsl(142, 70%, 45%)'; // Green
                tooltip = 'Present';
            } else if (data.out) {
                // clocked out without a tracked start today, still present
                bgColor = 'hsl(142, 70%, 45%)'; 
                tooltip = 'Present Out';
            }
        }
        
        // TODO: Could also check 'leaves' if integrated into `rows` or merged.
        
        const isToday = i === today.getDate() ? 'border:2px solid hsl(var(--foreground));' : '';

        html += `<div title="\${i} - \${tooltip}" style="aspect-ratio:1; background:\${bgColor}; border-radius:4px; \${isToday} display:flex; align-items:center; justify-content:center; font-size:0.7rem; font-weight:600; color:\${data ? 'white' : 'hsl(var(--muted-foreground))'};">\${i}</div>`;
    }

    grid.innerHTML = html;
}

