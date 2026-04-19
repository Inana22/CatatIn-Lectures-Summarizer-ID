// ══════════════════════════════════════════════
//  auth.js — CatatIn
//  Login, register, logout, session handling
// ══════════════════════════════════════════════

let currentUser = null;

// ─── INIT AUTH LISTENER ───────────────────────
// Dipanggil sekali saat app.js init
function initAuth() {
  sbOnAuthChange(async (session) => {
    if (session) {
      currentUser = session.user;
      await onUserLoggedIn();
    } else {
      currentUser = null;
      onUserLoggedOut();
    }
  });
}

async function onUserLoggedIn() {
  // Load profile dari DB
  try {
    const profile = await sbGetProfile(currentUser.id);
    if (profile) {
      updateSidebarUser(profile);
    } else {
      // Profil belum ada — pakai data dari auth metadata
      const meta = currentUser.user_metadata || {};
      updateSidebarUser({ full_name: meta.full_name || 'Pengguna', role: meta.role || 'Pelajar' });
    }
  } catch (e) { console.warn('Profile load error:', e); }

  // Tampilkan app, sembunyikan login
  document.getElementById('page-login').classList.remove('active');
  document.getElementById('page-app').classList.add('active');

  // Load subjects (dipakai di semua page)
  await loadSubjects();

  // Init halaman pertama
  showPage('record');
}

function onUserLoggedOut() {
  document.getElementById('page-app').classList.remove('active');
  document.getElementById('page-login').classList.add('active');
  switchToLogin();
}

// ─── LOGIN ────────────────────────────────────
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;

  if (!email || !pass) { showToast('Isi email dan password!', 'error'); return; }

  const btn = document.querySelector('#login-card .btn-login');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Masuk...';

  try {
    const { error } = await sbSignIn(email, pass);
    if (error) throw error;
    // onAuthChange akan handle redirect otomatis
  } catch (e) {
    showToast(e.message || 'Login gagal!', 'error');
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Masuk Sekarang';
  }
}

// ─── REGISTER ─────────────────────────────────
async function doRegister() {
  const name  = document.getElementById('reg-name').value.trim();
  const role  = document.getElementById('reg-role').value;
  const email = document.getElementById('reg-email').value.trim();
  const inst  = document.getElementById('reg-institusi').value.trim();
  const pass  = document.getElementById('reg-pass').value;
  const pass2 = document.getElementById('reg-pass2').value;

  if (!name)           { showToast('Masukkan nama lengkap!', 'error'); return; }
  if (!email)          { showToast('Masukkan email!', 'error'); return; }
  if (pass.length < 8) { showToast('Password minimal 8 karakter!', 'error'); return; }
  if (pass !== pass2)  { showToast('Konfirmasi password tidak cocok!', 'error'); return; }

  const btn = document.querySelector('#register-card .btn-login');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Mendaftar...';

  try {
    const { error } = await sbSignUp(email, pass, { full_name: name, role, institusi: inst });
    if (error) throw error;
    showToast('Akun berhasil dibuat! Silakan masuk.', 'success');
    switchToLogin();
  } catch (e) {
    showToast(e.message || 'Pendaftaran gagal!', 'error');
  } finally {
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Daftar Sekarang';
  }
}

// ─── LOGOUT ───────────────────────────────────
async function logout(e) {
  if (e) e.stopPropagation();
  await sbSignOut();
  // onAuthChange akan handle redirect otomatis
}

// ─── SWITCH FORM ──────────────────────────────
function switchToRegister() {
  const lc = document.getElementById('login-card');
  const rc = document.getElementById('register-card');
  lc.style.display = 'none';
  rc.style.display = 'block';
  triggerCardAnim(rc);
}

function switchToLogin() {
  const lc = document.getElementById('login-card');
  const rc = document.getElementById('register-card');
  rc.style.display = 'none';
  lc.style.display = 'block';
  triggerCardAnim(lc);
}

function triggerCardAnim(el) {
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = '';
}

// ─── UPDATE SIDEBAR ───────────────────────────
function updateSidebarUser(profile) {
  const name   = profile.full_name || 'Pengguna';
  const role   = profile.role      || 'Pelajar';
  const initials = name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();

  const sbName   = document.getElementById('sb-name-display');
  const sbRole   = document.getElementById('sb-role-display');
  const sbAvatar = document.getElementById('sb-avatar-display');

  if (sbName)   sbName.textContent   = name;
  if (sbRole)   sbRole.textContent   = role;
  if (sbAvatar) sbAvatar.textContent = initials;
}