/* ==========================================
   theme.js — Light / Dark Theme Management
   ========================================== */

function applyTheme(t) {
    if (t === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('staffsync_theme', t);
    updateThemeIcon(t);
    window.dispatchEvent(new Event('themeChanged'));
}

function updateThemeIcon(t) {
    // Update all theme icons on the page (landing + dashboard may have different elements)
    const icons = document.querySelectorAll('.theme-icon-svg');
    icons.forEach(icon => {
        const path = icon.querySelector('.theme-icon-path');
        if (!path) return;

        if (t === 'dark') {
            // Sun icon (show sun in dark mode to switch to light)
            path.setAttribute('d', 'M12 3v1m0 16v1m8.66-12.34l-.7.7M4.04 19.96l-.7.7M21 12h-1M4 12H3m15.66 4.66l-.7-.7M4.04 4.04l-.7-.7');
            icon.style.color = 'hsl(45, 90%, 55%)';
        } else {
            // Moon icon (show moon in light mode to switch to dark)
            path.setAttribute('d', 'M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z');
            icon.style.color = 'hsl(var(--muted-foreground))';
        }
    });
}

function initTheme() {
    const t = localStorage.getItem('staffsync_theme') || 'light';
    applyTheme(t);

    // Bind all theme toggle buttons
    document.querySelectorAll('.theme-toggle').forEach(btn => {
        btn.onclick = () => {
            const current = localStorage.getItem('staffsync_theme') || 'light';
            applyTheme(current === 'dark' ? 'light' : 'dark');
        };
    });
}
