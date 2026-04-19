// ══════════════════════════════════════════════
//  app.js — CatatIn
//  Navigasi, toast, clock, cursor glow, init
//  (logika bisnis ada di file masing-masing)
// ══════════════════════════════════════════════

// ─── CURSOR GLOW ──────────────────────────────
document.addEventListener('mousemove', e => {
  const glow = document.getElementById('cursorGlow');
  if (glow) { glow.style.left = e.clientX + 'px'; glow.style.top = e.clientY + 'px'; }
});

// ─── CLOCK ────────────────────────────────────
function updateClock() {
  const el = document.getElementById('header-time');
  if (!el) return;
  const now = new Date();
  el.textContent = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
}
updateClock();
setInterval(updateClock, 10000);

// ─── TOAST ────────────────────────────────────
function showToast(msg, type = 'default') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.borderColor = type === 'error'   ? 'rgba(224,80,96,0.4)'
                      : type === 'success' ? 'rgba(95,184,122,0.4)'
                      : 'rgba(255,255,255,0.12)';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ─── SIDEBAR TOGGLE (mobile) ──────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ─── NAVIGATION ───────────────────────────────
const PAGE_TITLES = {
  record:    'Rekam Suara',
  summarize: 'Ringkas AI',
  subjects:  'Mata Pelajaran',
  history:   'Riwayat Rekaman',
  profile:   'Profil Saya'
};

function showPage(name) {
  const pages = ['record', 'summarize', 'subjects', 'history', 'profile'];

  pages.forEach(p => {
    const el  = document.getElementById('subpage-' + p);
    const nav = document.getElementById('nav-' + p);
    if (el)  { el.style.display = 'none'; el.classList.remove('active'); }
    if (nav) nav.classList.remove('active');
  });

  const page = document.getElementById('subpage-' + name);
  if (page) {
    page.style.display = 'block';
    page.classList.add('active');
    page.style.animation = 'none';
    page.offsetHeight;
    page.style.animation = '';
  }

  const nav = document.getElementById('nav-' + name);
  if (nav) nav.classList.add('active');

  const titleEl = document.getElementById('header-title');
  if (titleEl) titleEl.textContent = PAGE_TITLES[name] || '';

  // Per-page init
  if (name === 'record')    initRecordPage();
  if (name === 'summarize') { initSummarizePage(); setupDragDrop(); }
  if (name === 'subjects')  renderSubjectsPage();
  if (name === 'history')   renderHistory();
  if (name === 'profile')   renderProfile();

  document.getElementById('sidebar')?.classList.remove('open');
}

// ─── INIT ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initAuth();   // auth.js — cek session, redirect jika sudah login
});