// ══════════════════════════════════════════════
//  auth.js — CatatIn
//  Login, register, logout, session handling
//  + OTP verification via EmailJS & Duplicate Email Check
// ══════════════════════════════════════════════

// ─── CONFIG EMAILJS ───────────────────────────
const EMAILJS_PUBLIC_KEY  = 'l0Rip2Yk6TklckB0W';
const EMAILJS_SERVICE_ID  = 'service_a468mtw';
const EMAILJS_TEMPLATE_ID = 'template_ut0bp6x';

let currentUser = null;
let pendingOTP  = null;

// ─── INIT AUTH LISTENER ───────────────────────
function initAuth() {
  emailjs.init(EMAILJS_PUBLIC_KEY);

  sbOnAuthChange(async (session) => {
    if (session) {
      currentUser = session.user;
      await onUserLoggedIn();
    } else {
      currentUser = null;
      onUserLoggedOut();
    }
  });

  initOTPInputs();
}

async function onUserLoggedIn() {
  try {
    const profile = await sbGetProfile(currentUser.id);
    if (profile) {
      updateSidebarUser(profile);
    } else {
      const meta = currentUser.user_metadata || {};
      updateSidebarUser({ full_name: meta.full_name || 'Pengguna', role: meta.role || 'Pelajar' });
    }
  } catch (e) { console.warn('Profile load error:', e); }

  document.getElementById('page-login').classList.remove('active');
  document.getElementById('page-app').classList.add('active');

  await loadSubjects();
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
  } catch (e) {
    showToast(e.message || 'Login gagal!', 'error');
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Masuk Sekarang';
  }
}

// ─── REGISTER (WITH EMAIL CHECK — FIXED) ──────
async function doRegister() {
  const name  = document.getElementById('reg-name').value.trim();
  const role  = document.getElementById('reg-role').value;
  const email = document.getElementById('reg-email').value.trim();
  const inst  = document.getElementById('reg-institusi').value.trim();
  const pass  = document.getElementById('reg-pass').value;
  const pass2 = document.getElementById('reg-pass2').value;

  // Validasi Input
  if (!name)           { showToast('Masukkan nama lengkap!', 'error'); return; }
  if (!email)          { showToast('Masukkan email!', 'error'); return; }
  if (pass.length < 8) { showToast('Password minimal 8 karakter!', 'error'); return; }
  if (pass !== pass2)  { showToast('Konfirmasi password tidak cocok!', 'error'); return; }

  const btn = document.querySelector('#register-card .btn-login');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Mengecek email...';

  try {
    // ─── PERBAIKAN: cek email via RPC langsung ke auth.users ───
    let isExist = false;

    try {
      isExist = await sbCheckEmailExists(email);
    } catch (checkErr) {
      // Jika fungsi cek sendiri error, HENTIKAN proses (jangan kirim OTP)
      console.error('Gagal mengecek email:', checkErr);
      showToast('Gagal memverifikasi email. Coba lagi!', 'error');
      btn.disabled = false;
      btn.querySelector('span').textContent = 'Daftar Sekarang';
      return;
    }

    // Blokir total jika email sudah ada
    if (isExist) {
      showToast('Email sudah terdaftar! Silakan login atau gunakan email lain.', 'error');
      btn.disabled = false;
      btn.querySelector('span').textContent = 'Daftar Sekarang';
      return; // ← STOP: tidak lanjut ke OTP
    }

    // ─── Email aman, lanjut generate & kirim OTP ───────────────
    btn.querySelector('span').textContent = 'Mengirim kode...';
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email:  email,
      to_name:   name,
      otp_code:  otp,
    });

    pendingOTP = {
      code:    otp,
      email,
      name,
      role,
      inst,
      pass,
      expires: Date.now() + 5 * 60 * 1000,
      timer:   null,
    };

    showToast('Kode OTP dikirim ke email kamu!', 'success');
    switchToOTP(email);
    startOTPTimer();

  } catch (e) {
    console.error(e);
    showToast('Terjadi kesalahan. Coba lagi!', 'error');
  } finally {
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Daftar Sekarang';
  }
}

// ─── OTP: TAMPILKAN CARD ──────────────────────
function switchToOTP(email) {
  document.getElementById('register-card').style.display = 'none';
  const card = document.getElementById('otp-card');
  card.style.display = 'block';
  document.getElementById('otp-email-display').textContent = email;

  document.querySelectorAll('.otp-digit').forEach(i => i.value = '');
  document.querySelector('.otp-digit').focus();

  const resendBtn = document.getElementById('btn-resend-otp');
  resendBtn.disabled = true;
  resendBtn.textContent = 'Kirim Ulang';

  triggerCardAnim(card);
}

// ─── OTP: TIMER COUNTDOWN ─────────────────────
function startOTPTimer() {
  if (pendingOTP.timer) clearInterval(pendingOTP.timer);

  let seconds = 300;
  updateOTPTimerUI(seconds);

  pendingOTP.timer = setInterval(() => {
    seconds--;
    updateOTPTimerUI(seconds);
    if (seconds <= 0) {
      clearInterval(pendingOTP.timer);
      document.getElementById('btn-resend-otp').disabled = false;
    }
  }, 1000);
}

function updateOTPTimerUI(seconds) {
  const el = document.getElementById('otp-timer');
  if (!el) return;
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  el.textContent = seconds > 0 ? `${m}:${s}` : 'Kadaluarsa';
}

function getOTPValue() {
  return Array.from(document.querySelectorAll('.otp-digit'))
    .map(i => i.value).join('');
}

// ─── OTP: VERIFIKASI ──────────────────────────
async function verifyOTP() {
  const entered = getOTPValue();

  if (entered.length < 6) { return; }

  if (!pendingOTP) {
    showToast('Sesi kadaluarsa. Silakan daftar ulang.', 'error');
    switchToRegister();
    return;
  }

  if (Date.now() > pendingOTP.expires) {
    showToast('Kode kadaluarsa! Silakan daftar ulang.', 'error');
    clearOTPState();
    switchToRegister();
    return;
  }

  if (entered !== pendingOTP.code) {
    showToast('Kode salah! Coba lagi.', 'error');
    document.querySelectorAll('.otp-digit').forEach(i => {
      i.classList.add('otp-shake');
      setTimeout(() => i.classList.remove('otp-shake'), 500);
      i.value = '';
    });
    document.querySelector('.otp-digit').focus();
    return;
  }

  const btn = document.getElementById('btn-verify-otp');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Membuat akun...';

  try {
    const { error } = await sbSignUp(pendingOTP.email, pendingOTP.pass, {
      full_name: pendingOTP.name,
      role:      pendingOTP.role,
      institusi: pendingOTP.inst,
    });
    if (error) throw error;

    clearOTPState();
    showToast('Akun berhasil dibuat! Silakan masuk.', 'success');
    switchToLogin();

  } catch (e) {
    showToast(e.message || 'Pendaftaran gagal!', 'error');
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Verifikasi';
  }
}

// ─── OTP: KIRIM ULANG ─────────────────────────
async function resendOTP() {
  if (!pendingOTP) { switchToRegister(); return; }

  const btn = document.getElementById('btn-resend-otp');
  btn.disabled = true;
  btn.textContent = 'Mengirim...';

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email: pendingOTP.email,
      to_name:  pendingOTP.name,
      otp_code: otp,
    });

    pendingOTP.code    = otp;
    pendingOTP.expires = Date.now() + 5 * 60 * 1000;

    document.querySelectorAll('.otp-digit').forEach(i => i.value = '');
    document.querySelector('.otp-digit').focus();

    showToast('Kode baru telah dikirim!', 'success');
    startOTPTimer();

  } catch (e) {
    showToast('Gagal kirim ulang. Coba lagi!', 'error');
    btn.disabled = false;
  }

  btn.textContent = 'Kirim Ulang';
}

function backToRegister() {
  clearOTPState();
  document.getElementById('otp-card').style.display = 'none';
  const rc = document.getElementById('register-card');
  rc.style.display = 'block';
  triggerCardAnim(rc);
}

function clearOTPState() {
  if (pendingOTP && pendingOTP.timer) clearInterval(pendingOTP.timer);
  pendingOTP = null;
}

// ─── OTP: INPUT UX ────────────────────────────
function initOTPInputs() {
  const inputs = document.querySelectorAll('.otp-digit');

  inputs.forEach((input, idx) => {
    input.addEventListener('input', (e) => {
      const val = e.target.value.replace(/\D/g, '').slice(-1);
      e.target.value = val;
      if (val && idx < inputs.length - 1) inputs[idx + 1].focus();
      if (getOTPValue().length === 6) verifyOTP();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && idx > 0) {
        inputs[idx - 1].value = '';
        inputs[idx - 1].focus();
      }
    });

    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData)
        .getData('text').replace(/\D/g, '').slice(0, 6);
      text.split('').forEach((c, i) => { if (inputs[i]) inputs[i].value = c; });
      const last = Math.min(text.length, inputs.length - 1);
      if (inputs[last]) inputs[last].focus();
      if (text.length === 6) verifyOTP();
    });
  });
}

// ─── LOGOUT ───────────────────────────────────
async function logout(e) {
  if (e) e.stopPropagation();
  await sbSignOut();
}

// ─── SWITCH FORM ──────────────────────────────
function switchToRegister() {
  document.getElementById('login-card').style.display = 'none';
  document.getElementById('otp-card').style.display = 'none';
  const rc = document.getElementById('register-card');
  rc.style.display = 'block';
  triggerCardAnim(rc);
}

function switchToLogin() {
  document.getElementById('register-card').style.display = 'none';
  document.getElementById('otp-card').style.display = 'none';
  const lc = document.getElementById('login-card');
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
  const name     = profile.full_name || 'Pengguna';
  const role     = profile.role      || 'Pelajar';
  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  const sbName   = document.getElementById('sb-name-display');
  const sbRole   = document.getElementById('sb-role-display');
  const sbAvatar = document.getElementById('sb-avatar-display');

  if (sbName)   sbName.textContent   = name;
  if (sbRole)   sbRole.textContent   = role;
  if (sbAvatar) sbAvatar.textContent = initials;
}