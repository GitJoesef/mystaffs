/* ==========================================
   navigation.js — Sidebar Navigation
   ========================================== */

const sections = ['dashboard', 'check', 'analytics', 'settings', 'staff', 'leaves'];

function makeNav(role = 'Staff') {
    const nav = document.getElementById('sidebar-nav');
    nav.innerHTML = '';

    const isAdmin = role && role.toLowerCase() === 'admin';
    const items = [
        { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1' }
    ];

    if (isAdmin) {
        items.push({ id: 'staff', label: 'Staff Directory', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' });
    } else {
        items.push({ id: 'check', label: 'Check In/Out', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' });
        items.push({ id: 'analytics', label: 'My Analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' });
    }
    items.push({ id: 'leaves', label: 'Absences', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' });

    items.push({ id: 'settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z M15 12a3 3 0 11-6 0 3 3 0 016 0z' });

    items.forEach(it => {
        const btn = document.createElement('button');
        btn.className = 'nav-btn hover-elevate';
        btn.id = 'nav-' + it.id;
        btn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
                <path d="${it.icon}"/>
            </svg>
            <span>${it.label}</span>`;
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.gap = '0.75rem';
        btn.onclick = () => showSection(it.id);
        nav.appendChild(btn);
    });
}

function showSection(id) {
    // Toggle section visibility
    sections.forEach(s => {
        const el = document.getElementById(s + '-section');
        if (!el) return;
        el.style.display = (s === id) ? '' : 'none';
    });

    // Highlight active sidebar button
    sections.forEach(s => {
        const b = document.getElementById('nav-' + s);
        if (!b) return;
        if (s === id) {
            b.classList.add('sidebar-active');
        } else {
            b.classList.remove('sidebar-active');
        }
    });

    // Update URL hash without jumping if possible
    if (window.location.hash !== '#' + id) {
        history.replaceState(null, null, '#' + id);
    }

    // Update page title & subtitle
    const titles = {
        dashboard: 'Dashboard',
        check: 'Check In / Out',
        analytics: 'My Analytics',
        settings: 'Settings',
        staff: 'Staff Directory',
        leaves: 'Absences & Leaves'
    };
    const subtitles = {
        dashboard: "Welcome back! Here's your attendance overview.",
        check: 'Record your attendance using one of the methods below.',
        analytics: 'View your attendance history and stats.',
        settings: 'Manage your profile and preferences.',
        staff: 'Browse and manage staff attendance records.',
        leaves: 'Log sick days or personal time off.'
    };

    const titleEl = document.getElementById('title');
    const subtitleEl = document.getElementById('subtitle');
    if (titleEl) titleEl.textContent = titles[id] || 'Dashboard';
    if (subtitleEl) subtitleEl.textContent = subtitles[id] || '';
}
