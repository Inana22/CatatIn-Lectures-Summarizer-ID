// ══════════════════════════════════════════════
//  supjek.js — CatatIn
//  Subjects: shared state, CRUD, render dropdown
//  Dipakai oleh: record.js, summarize.js, subjects page
// ══════════════════════════════════════════════

let subjectsList = [];   // cache subjects user

// ─── LOAD SUBJECTS ────────────────────────────
async function loadSubjects() {
  if (!currentUser) return;
  try {
    subjectsList = await sbGetSubjects(currentUser.id);
    refreshAllSubjectDropdowns();
    updateSubjectsBadge();
  } catch (e) {
    console.error('Gagal load subjects:', e);
  }
}

// ─── REFRESH SEMUA DROPDOWN ───────────────────
function refreshAllSubjectDropdowns() {
  const dropdowns = document.querySelectorAll('.subject-dropdown');
  dropdowns.forEach(sel => {
    const current = sel.value;
    sel.innerHTML = '<option value="">— Pilih mata pelajaran —</option>';
    subjectsList.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.icon + ' ' + s.name;
      sel.appendChild(opt);
    });
    if (current) sel.value = current;
  });
}

function updateSubjectsBadge() {
  const badge = document.querySelector('#nav-subjects .sb-badge');
  if (badge) badge.textContent = subjectsList.length;
}

// ─── MODAL: TAMBAH MATA PELAJARAN ─────────────
function openAddSubjectModal(returnDropdownId) {
  document.getElementById('modal-add-subject').style.display = 'flex';
  document.getElementById('modal-return-dropdown').value = returnDropdownId || '';
  document.getElementById('new-subject-name').value = '';
  document.getElementById('new-subject-icon').value = '📚';
  setTimeout(() => document.getElementById('new-subject-name').focus(), 100);
}

function closeAddSubjectModal() {
  document.getElementById('modal-add-subject').style.display = 'none';
}

async function saveNewSubject() {
  const name = document.getElementById('new-subject-name').value.trim();
  if (!currentUser) { showToast('Kamu harus login dulu!', 'error'); closeAddSubjectModal(); return; }
  const icon = document.getElementById('new-subject-icon').value.trim() || '📚';
  const returnId = document.getElementById('modal-return-dropdown').value;

  if (!name) { showToast('Masukkan nama mata pelajaran!', 'error'); return; }

  const btn = document.getElementById('btn-save-subject');
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';

  try {
    const newSubject = await sbAddSubject(currentUser.id, name, icon);
    subjectsList.push(newSubject);
    refreshAllSubjectDropdowns();
    updateSubjectsBadge();

    if (returnId) {
      const sel = document.getElementById(returnId);
      if (sel) sel.value = newSubject.id;
    }

    showToast(`"${name}" berhasil ditambahkan!`, 'success');
    closeAddSubjectModal();

    if (document.getElementById('subpage-subjects').style.display !== 'none') {
      renderSubjectsPage();
    }
  } catch (e) {
    showToast('Gagal menambah mata pelajaran: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Simpan';
  }
}

// ─── PAGE: MATA PELAJARAN ─────────────────────
async function renderSubjectsPage() {
  const grid = document.getElementById('subjects-grid');
  if (!grid) return;

  // FIX: Auto-cleanup ghost subjects (nama placeholder dari dropdown) secara diam-diam
  await _autoCleanupGhosts();

  if (!subjectsList.length) {
    grid.innerHTML = `
      <div class="subjects-empty">
        <p>Belum ada mata pelajaran.</p>
        <button class="btn-primary sm" onclick="openAddSubjectModal()">+ Tambah Pertama</button>
      </div>`;
    return;
  }

  grid.innerHTML = '<div class="subjects-loading">Memuat...</div>';

  const withTopics = await Promise.all(
    subjectsList.map(async s => {
      const topics = await sbGetTopics(s.id);
      return { ...s, topics };
    })
  );

  grid.innerHTML = '';
  withTopics.forEach(s => {
    const card = document.createElement('div');
    card.className = 'subject-card-v2';
    card.id = 'subj-card-' + s.id;

    const topicsHtml = s.topics.map(t => {
      // ✅ FIX: Gunakan safe ID (ganti - dengan _ untuk querySelector compatibility)
      const safeId = 'tid_' + t.id.replace(/-/g, '_');
      return `
        <div class="topic-item" id="topic-${safeId}">
          <div class="topic-header" onclick="toggleTopic('${safeId}', '${t.id}')">
            <div class="topic-info">
              <span class="topic-name">${escapeHtml(t.name)}</span>
              <span class="topic-date">${formatDate(t.date)}</span>
            </div>
            <svg class="topic-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
          <div class="topic-points" id="points-${safeId}" style="display:none">
            <div class="points-loading">Memuat poin...</div>
          </div>
        </div>
      `;
    }).join('');

    // ✅ FIX: Simpan id dan name di data attribute, bukan di inline onclick string
    card.innerHTML = `
      <div class="sc2-header">
        <div class="sc2-icon">${s.icon}</div>
        <div class="sc2-info">
          <div class="sc2-name">${escapeHtml(s.name)}</div>
          <div class="sc2-count">${s.topics.length} topik</div>
        </div>
        <button class="sc2-delete"
          data-subject-id="${s.id}"
          data-subject-name="${escapeAttr(s.name)}"
          onclick="handleDeleteSubject(this)"
          title="Hapus">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          </svg>
        </button>
      </div>
      <div class="sc2-topics">
        ${s.topics.length ? topicsHtml : '<p class="sc2-empty">Belum ada topik tersimpan</p>'}
      </div>
    `;
    grid.appendChild(card);
  });
}

// ✅ FIX: Handler delete pakai data attribute, bukan string inline
function handleDeleteSubject(btn) {
  const id   = btn.dataset.subjectId;
  const name = btn.dataset.subjectName;
  if (!id) return;
  showDeleteConfirm(id, name);
}

// ✅ FIX: Custom confirm modal — bukan native confirm() yang sering diblokir
function showDeleteConfirm(id, name) {
  // Buat overlay konfirmasi custom
  let overlay = document.getElementById('delete-confirm-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'delete-confirm-overlay';
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;
      display:flex;align-items:center;justify-content:center;
    `;
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div style="
      background:var(--surface,#1e1e2e);border:1px solid rgba(255,255,255,0.12);
      border-radius:16px;padding:24px;max-width:320px;width:90%;text-align:center;
    ">
      <div style="font-size:28px;margin-bottom:12px">🗑️</div>
      <div style="font-weight:600;margin-bottom:8px;color:var(--text1,#fff)">Hapus Mata Pelajaran?</div>
      <div style="font-size:13px;color:var(--text3,#aaa);margin-bottom:20px;line-height:1.5">
        <strong>${escapeHtml(name)}</strong> beserta semua topik dan poin AI-nya akan terhapus permanen.
      </div>
      <div style="display:flex;gap:10px;justify-content:center">
        <button onclick="closeDeleteConfirm()" style="
          flex:1;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.15);
          background:transparent;color:var(--text1,#fff);cursor:pointer;font-size:14px;
        ">Batal</button>
        <button onclick="confirmDeleteNow('${id}', '${escapeAttr(name)}')" style="
          flex:1;padding:10px;border-radius:10px;border:none;
          background:#e05060;color:#fff;cursor:pointer;font-size:14px;font-weight:600;
        ">Hapus</button>
      </div>
    </div>
  `;
  overlay.style.display = 'flex';
}

function closeDeleteConfirm() {
  const overlay = document.getElementById('delete-confirm-overlay');
  if (overlay) overlay.style.display = 'none';
}

async function confirmDeleteNow(id, name) {
  closeDeleteConfirm();
  await deleteSubject(id, name);
}

async function deleteSubject(id, name) {
  try {
    await sbDeleteSubject(id);
    subjectsList = subjectsList.filter(s => s.id !== id);
    refreshAllSubjectDropdowns();
    updateSubjectsBadge();
    renderSubjectsPage();
    showToast(`"${name}" berhasil dihapus.`, 'success');
  } catch (e) {
    showToast('Gagal menghapus: ' + e.message, 'error');
  }
}

// ✅ FIX: toggleTopic pakai dua parameter: safeId (untuk DOM) dan realId (untuk Supabase)
async function toggleTopic(safeId, realTopicId) {
  const container = document.getElementById('points-' + safeId);
  const topicEl   = document.getElementById('topic-' + safeId);
  const arrow     = topicEl ? topicEl.querySelector('.topic-arrow') : null;

  if (!container) { console.warn('Container not found:', 'points-' + safeId); return; }

  const isOpen = container.style.display !== 'none';

  if (isOpen) {
    container.style.display = 'none';
    if (arrow) arrow.style.transform = '';
  } else {
    container.style.display = 'block';
    if (arrow) arrow.style.transform = 'rotate(180deg)';

    // Load poin hanya jika belum pernah dimuat
    if (container.querySelector('.points-loading')) {
      try {
        const points = await sbGetAiPointsByTopic(realTopicId);

        // ✅ Juga cek apakah ada transkrip dari recordings
        const recordings = await sbGetRecordingsByTopic(realTopicId);

        let html = '';

        if (points.length) {
          html += '<ul class="kp-list">' +
            points.map(p => `<li><span class="kp-dot"></span>${escapeHtml(p.point_text)}</li>`).join('') +
            '</ul>';
        }

        if (recordings.length && recordings[0].transcript) {
          html += `
            <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(232,56,122,0.08)">
              <div style="font-size:11px;color:var(--text3,#aaa);margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Transkrip Rekaman</div>
              <div style="font-size:13px;color:var(--text2,#ccc);line-height:1.6;max-height:160px;overflow-y:auto">
                ${escapeHtml(recordings[0].transcript.slice(0, 600))}${recordings[0].transcript.length > 600 ? '...' : ''}
              </div>
            </div>`;
        } else if (recordings.length) {
          // Rekaman ada tapi transcript kosong — tampilkan info singkat
          const wc = recordings[0].word_count || 0;
          const dur = recordings[0].duration_seconds || 0;
          html += `
            <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(232,56,122,0.08)">
              <div style="font-size:12px;color:var(--text3);font-style:italic">
                🎙️ Rekaman tersimpan — ${wc} kata, ${Math.floor(dur/60)}:${String(dur%60).padStart(2,'0')} menit
              </div>
            </div>`;
        }

        if (!html) {
          html = '<p class="points-empty">Belum ada poin AI atau transkrip untuk topik ini.</p>';
        }

        container.innerHTML = html;

      } catch (e) {
        console.error('toggleTopic error:', e);
        container.innerHTML = '<p class="points-empty" style="color:var(--red)">Gagal memuat data.</p>';
      }
    }
  }
}

// ─── AUTO CLEANUP (silent, dipanggil otomatis) ───────────────────
async function _autoCleanupGhosts() {
  if (!currentUser || !subjectsList.length) return;
  const INVALID = ['', '—', '-', '- pilih mata pelajaran -', '— pilih mata pelajaran —'];
  const ghosts = subjectsList.filter(s => {
    const n = s.name.toLowerCase().trim();
    return INVALID.includes(n) || n.startsWith('— pilih') || n.startsWith('- pilih');
  });
  if (!ghosts.length) return;
  for (const g of ghosts) {
    try { await sbDeleteSubject(g.id); } catch(e) { console.warn('Gagal hapus ghost:', g.name, e); }
  }
  subjectsList = subjectsList.filter(s => !ghosts.find(g => g.id === s.id));
  refreshAllSubjectDropdowns();
  updateSubjectsBadge();
  showToast(`${ghosts.length} mata pelajaran bermasalah dihapus otomatis.`, 'default');
}

// ─── FILTER SUBJECTS ──────────────────────────
function filterSubjects(q) {
  const cards = document.querySelectorAll('.subject-card-v2');
  const query = q.toLowerCase();
  cards.forEach(card => {
    const name = card.querySelector('.sc2-name')?.textContent.toLowerCase() || '';
    card.style.display = name.includes(query) ? '' : 'none';
  });
}

// ✅ FIX: Bersihkan subject hantu (nama kosong / placeholder)
async function cleanupGhostSubjects() {
  if (!currentUser) return;
  const INVALID_NAMES = ['', '—', '- pilih mata pelajaran -', '— pilih mata pelajaran —'];
  const ghosts = subjectsList.filter(s =>
    INVALID_NAMES.includes(s.name.toLowerCase().trim()) ||
    s.name.trim().startsWith('— Pilih')
  );
  if (!ghosts.length) {
    showToast('Tidak ada subject bermasalah ditemukan.', 'default');
    return;
  }
  showToast(`Menghapus ${ghosts.length} subject bermasalah...`, 'default');
  for (const g of ghosts) {
    try { await sbDeleteSubject(g.id); } catch(e) { console.warn('Gagal hapus ghost:', e); }
  }
  subjectsList = subjectsList.filter(s =>
    !ghosts.find(g => g.id === s.id)
  );
  refreshAllSubjectDropdowns();
  updateSubjectsBadge();
  renderSubjectsPage();
  showToast('Subject bermasalah berhasil dihapus!', 'success');
}

// ─── ESCAPE HELPERS ───────────────────────────
// (Catatan: _saveToLocalFallback di record.js juga sudah dipatch)
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ─── HELPERS ──────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}