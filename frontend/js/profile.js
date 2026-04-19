// ══════════════════════════════════════════════
//  profile.js — CatatIn
//  Profil user: load, simpan, stats
// ══════════════════════════════════════════════

async function renderProfile() {
  if (!currentUser) return;

  try {
    const profile = await sbGetProfile(currentUser.id);
    const meta    = currentUser.user_metadata || {};

    const name  = profile?.full_name   || meta.full_name   || '';
    const role  = profile?.role        || meta.role        || 'Mahasiswa';
    const email = currentUser.email    || '';
    const inst  = profile?.institusi   || meta.institusi   || '';
    const bio   = profile?.bio         || '';

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    setVal('prof-name', name);
    setVal('prof-role', role);
    setVal('prof-email', email);
    setVal('prof-institusi', inst);
    setVal('prof-bio', bio);

    // Avatar
    const avatarEl = document.getElementById('profile-avatar-display');
    if (avatarEl) {
      if (profile?.avatar_url) {
        avatarEl.innerHTML = `<img src="${profile.avatar_url}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
      } else {
        avatarEl.textContent = getInitials(name || 'U');
      }
    }
  } catch (e) { console.warn('Profile load error:', e); }

  await renderProfileStats();
}

async function renderProfileStats() {
  try {
    const stats = await sbGetStats(currentUser.id);
    const sEl = document.getElementById('stat-sessions');
    const wEl = document.getElementById('stat-words');
    if (sEl) sEl.textContent = stats.totalRecordings;
    if (wEl) wEl.textContent = stats.totalWords.toLocaleString('id-ID');

    const subjEl = document.getElementById('stat-subjects');
    if (subjEl) subjEl.textContent = subjectsList.length;
  } catch (e) { console.warn(e); }
}

async function saveProfile() {
  if (!currentUser) return;

  const data = {
    full_name: document.getElementById('prof-name')?.value.trim()  || '',
    role:      document.getElementById('prof-role')?.value         || 'Mahasiswa',
    institusi: document.getElementById('prof-institusi')?.value.trim() || '',
    bio:       document.getElementById('prof-bio')?.value.trim()   || '',
  };

  const btn = document.querySelector('#subpage-profile .btn-primary');
  if (btn) { btn.disabled = true; }

  try {
    await sbUpsertProfile(currentUser.id, data);
    updateSidebarUser(data);
    showToast('Profil berhasil disimpan!', 'success');
  } catch (e) {
    showToast('Gagal menyimpan profil: ' + e.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function handleAvatarUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('File harus berupa gambar!', 'error'); return; }
  const reader = new FileReader();
  reader.onload = ev => {
    const avatarEl = document.getElementById('profile-avatar-display');
    if (avatarEl) avatarEl.innerHTML = `<img src="${ev.target.result}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
    showToast('Foto profil diperbarui! (Belum tersimpan ke server)', 'success');
  };
  reader.readAsDataURL(file);
}

function getInitials(name) {
  return name.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
}