/* ==========================================
   profile.js — Profile Management
   ========================================== */

function renderProfileOptions() {
    const sEl = document.getElementById('subjects-list');
    const cEl = document.getElementById('classes-list');

    if (sEl) {
        sEl.innerHTML = SUBJECT_OPTIONS.map(opt => `
            <label style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem;border:1px solid hsl(var(--border));border-radius:var(--radius);cursor:pointer;font-size:0.875rem;">
                <input type="checkbox" class="subject-checkbox" value="${opt}" />
                <span>${opt}</span>
            </label>
        `).join('');
    }

    if (cEl) {
        cEl.innerHTML = CLASS_OPTIONS.map(opt => `
            <label style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem;border:1px solid hsl(var(--border));border-radius:var(--radius);cursor:pointer;font-size:0.875rem;">
                <input type="checkbox" class="class-checkbox" value="${opt}" />
                <span>${opt}</span>
            </label>
        `).join('');
    }
}

function populateProfile(user) {
    document.getElementById('name-field').value = user.name || '';
    document.getElementById('bio-field').value = user.bio || '';
    
    const preview = document.getElementById('settings-avatar-preview');
    if(preview) {
        preview.src = user.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name||user.email)}&background=1e4d8c&color=fff`;
    }

    renderProfileOptions();

    try {
        const subs = user.subjects || [];
        document.querySelectorAll('.subject-checkbox').forEach(cb => cb.checked = subs.includes(cb.value));
    } catch (e) { /* ignore */ }

    try {
        const cls = user.classes || [];
        document.querySelectorAll('.class-checkbox').forEach(cb => cb.checked = cls.includes(cb.value));
    } catch (e) { /* ignore */ }

    const fileInput = document.getElementById('photo-upload');
    if(fileInput) {
        fileInput.onchange = function(e) {
            const file = e.target.files[0];
            if(!file) return;
            if(file.size > 2 * 1024 * 1024) return alert('File is too large! Max 2MB.');
            
            const reader = new FileReader();
            reader.onload = (re) => {
                document.getElementById('settings-avatar-preview').src = re.target.result;
            };
            reader.readAsDataURL(file);
        };
    }
}

/* ---------- Save handler (bound in app.js) ---------- */
function initProfileSave() {
    const btn = document.getElementById('save-profile');
    if (!btn) return;
    btn.onclick = async () => {
        const name = document.getElementById('name-field').value.trim();
        const bio = document.getElementById('bio-field').value.trim();
        const photo_url = document.getElementById('settings-avatar-preview').src || '';
        const subjects = Array.from(document.querySelectorAll('.subject-checkbox'))
            .filter(cb => cb.checked).map(cb => cb.value);
        const classes = Array.from(document.querySelectorAll('.class-checkbox'))
            .filter(cb => cb.checked).map(cb => cb.value);

        const r = await api('/api/me', { method: 'PUT', body: { name, bio, subjects, classes, photo_url } });
        if (!r.ok) return alert((r.body && r.body.error) || 'Failed to save');
        alert('Profile saved');
        setHeader(r.body.user);
    };
}

async function registerBiometrics() {
    try {
        // 1. Get options from server
        const optionsRes = await api('/api/webauthn/register-options', { method: 'POST' });
        if (!optionsRes.ok) throw new Error('Failed to get registration options');
        const options = optionsRes.body;

        // 2. Trigger browser biometric prompt
        const { startRegistration } = SimpleWebAuthnBrowser;
        const regResp = await startRegistration(options);

        // 3. Verify on server
        const verifyRes = await api('/api/webauthn/verify-registration', {
            method: 'POST',
            body: regResp
        });

        if (verifyRes.ok && verifyRes.body.verified) {
            alert('Biometrics registered successfully!');
            window._fpEnabled = true;
            if (typeof updateAuthButtons === 'function') updateAuthButtons();
        } else {
            throw new Error('Registration verification failed');
        }
    } catch (err) {
        console.error(err);
        alert('Biometric registration failed: ' + err.message);
        const cb = document.getElementById('enable-fingerprint');
        if (cb) cb.checked = false;
    }
}
