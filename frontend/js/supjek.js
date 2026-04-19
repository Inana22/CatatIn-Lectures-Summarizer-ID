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

    // Set dropdown ke subject baru
    if (returnId) {
      const sel = document.getElementById(returnId);
      if (sel) sel.value = newSubject.id;
    }

    showToast(`"${name}" berhasil ditambahkan!`, 'success');
    closeAddSubjectModal();

    // Kalau lagi di page subjects, render ulang
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

  if (!subjectsList.length) {
    grid.innerHTML = `
      <div class="subjects-empty">
        <p>Belum ada mata pelajaran.</p>
        <button class="btn-primary sm" onclick="openAddSubjectModal()">+ Tambah Pertama</button>
      </div>`;
    return;
  }

  grid.innerHTML = '<div class="subjects-loading">Memuat...</div>';

  // Load semua topics untuk setiap subject
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

    const topicsHtml = s.topics.map(t => `
      <div class="topic-item" id="topic-${t.id}">
        <div class="topic-header" onclick="toggleTopic('${t.id}')">
          <div class="topic-info">
            <span class="topic-name">${t.name}</span>
            <span class="topic-date">${formatDate(t.date)}</span>
          </div>
          <svg class="topic-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
        <div class="topic-points" id="points-${t.id}" style="display:none">
          <div class="points-loading">Memuat poin...</div>
        </div>
      </div>
    `).join('');

    card.innerHTML = `
      <div class="sc2-header">
        <div class="sc2-icon">${s.icon}</div>
        <div class="sc2-info">
          <div class="sc2-name">${s.name}</div>
          <div class="sc2-count">${s.topics.length} topik</div>
        </div>
        <button class="sc2-delete" onclick="confirmDeleteSubject('${s.id}', '${s.name}')" title="Hapus">
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

async function toggleTopic(topicId) {
  const container = document.getElementById('points-' + topicId);
  const arrow = document.querySelector(`#topic-${topicId} .topic-arrow`);
  const isOpen = container.style.display !== 'none';

  if (isOpen) {
    container.style.display = 'none';
    if (arrow) arrow.style.transform = '';
  } else {
    container.style.display = 'block';
    if (arrow) arrow.style.transform = 'rotate(180deg)';

    // Load poin jika belum
    if (container.querySelector('.points-loading')) {
      try {
        const points = await sbGetAiPointsByTopic(topicId);
        if (!points.length) {
          container.innerHTML = '<p class="points-empty">Belum ada poin AI tersimpan untuk topik ini.</p>';
        } else {
          container.innerHTML = '<ul class="kp-list">' +
            points.map(p => `<li><span class="kp-dot"></span>${p.point_text}</li>`).join('') +
            '</ul>';
        }
      } catch (e) {
        container.innerHTML = '<p class="points-empty" style="color:var(--red)">Gagal memuat poin.</p>';
      }
    }
  }
}

function confirmDeleteSubject(id, name) {
  if (!confirm(`Hapus mata pelajaran "${name}"?\nSemua topik dan poin terkait juga akan terhapus.`)) return;
  deleteSubject(id, name);
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

// ─── FILTER SUBJECTS ──────────────────────────
function filterSubjects(q) {
  const cards = document.querySelectorAll('.subject-card-v2');
  const query = q.toLowerCase();
  cards.forEach(card => {
    const name = card.querySelector('.sc2-name')?.textContent.toLowerCase() || '';
    card.style.display = name.includes(query) ? '' : 'none';
  });
}

// ─── HELPER ───────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}