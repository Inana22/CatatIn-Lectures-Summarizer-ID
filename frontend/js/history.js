// ══════════════════════════════════════════════
//  history.js — CatatIn
//  Riwayat: card compact grid, expand on click
// ══════════════════════════════════════════════

async function renderHistory() {
  const el = document.getElementById('history-list');
  if (!el) return;

  el.innerHTML = '<div class="history-empty">Memuat riwayat...</div>';
  const localHistory = JSON.parse(localStorage.getItem('catatIn_local_history') || '[]');

  // Belum login
  if (!currentUser) {
    if (!localHistory.length) {
      el.innerHTML = '<div class="history-empty">Belum ada rekaman tersimpan.</div>';
      return;
    }
    el.innerHTML = _buildSyncBanner(localHistory.length) + _renderLocalGrid(localHistory);
    _updateHistoryBadge(localHistory.length);
    return;
  }

  try {
    const [recordings, summTopics] = await Promise.all([
      sbGetRecordings(currentUser.id),
      sbGetTopicsWithPoints(currentUser.id)
    ]);

    const totalServer = recordings.length + summTopics.length;
    const totalAll    = totalServer + localHistory.length;

    if (!totalAll) {
      el.innerHTML = `<div class="history-empty">
        Belum ada riwayat tersimpan.<br/>
        <small>Rekam suara atau rangkum teks, lalu tekan simpan.</small>
      </div>`;
      return;
    }

    let html = '';

    // ── Dari Rekam Suara ──
    if (recordings.length) {
      html += _sectionLabel('🎙️ Dari Rekam Suara', recordings.length);
      html += '<div class="history-grid">';
      html += recordings.map((r, i) => _cardRecording(r, 'rec-' + i)).join('');
      html += '</div>';
      // Drawers (di luar grid, muncul full width)
      html += recordings.map((r, i) => _drawerRecording(r, 'rec-' + i)).join('');
    }

    // ── Dari Ringkas AI ──
    if (summTopics.length) {
      html += _sectionLabel('✦ Dari Ringkas AI', summTopics.length);
      html += '<div class="history-grid">';
      html += summTopics.map((t, i) => _cardSummTopic(t, 'summ-' + i)).join('');
      html += '</div>';
      html += summTopics.map((t, i) => _drawerSummTopic(t, 'summ-' + i)).join('');
    }

    // ── Data lokal ──
    if (localHistory.length) {
      html += _buildSyncBanner(localHistory.length);
      html += _renderLocalGrid(localHistory);
    }

    el.innerHTML = html;
    _updateHistoryBadge(totalAll);

  } catch (e) {
    console.error('History load error:', e);
    const fallback = localHistory.length
      ? `<div class="history-empty" style="color:var(--red);margin-bottom:16px;">
           ⚠️ Gagal memuat dari server. Menampilkan data lokal.
         </div>${_buildSyncBanner(localHistory.length)}${_renderLocalGrid(localHistory)}`
      : `<div class="history-empty" style="color:var(--red)">
           Gagal memuat riwayat.<br/><small>${e.message}</small>
         </div>`;
    el.innerHTML = fallback;
    _updateHistoryBadge(localHistory.length);
  }
}

// ─── TOGGLE DRAWER ────────────────────────────
function toggleHistoryDrawer(id) {
  // Tutup semua drawer lain dulu
  document.querySelectorAll('.history-drawer.open').forEach(d => {
    if (d.id !== 'drawer-' + id) d.classList.remove('open');
  });
  const drawer = document.getElementById('drawer-' + id);
  if (drawer) drawer.classList.toggle('open');
}

// ─── CARD: RECORDING ──────────────────────────
function _cardRecording(r, id) {
  const subjName  = r.subjects?.name || 'Umum';
  const subjIcon  = r.subjects?.icon || '📚';
  const topicName = r.topics?.name   || '—';
  const topicDate = r.topics?.date
    ? formatDate(r.topics.date)
    : new Date(r.created_at).toLocaleDateString('id-ID', { day:'2-digit', month:'short' });
  const words = (r.word_count || 0).toLocaleString('id-ID');

  return `
    <div class="history-card" onclick="toggleHistoryDrawer('${id}')">
      <div class="hc-top">
        <div class="hc-subject">
          <span class="hc-subject-icon">${subjIcon}</span>
          <span class="hc-subject-name">${subjName}</span>
        </div>
        <span class="hc-time">${topicDate}</span>
      </div>
      <div class="hc-topic">${topicName}</div>
      <div class="hc-footer">
        <span class="hc-badge">${words} kata</span>
        <button class="btn-expand" onclick="event.stopPropagation(); toggleHistoryDrawer('${id}')">
          Lihat
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>
    </div>`;
}

function _drawerRecording(r, id) {
  const preview = (r.transcript || '').trim() || '(Tidak ada transkrip)';
  return `
    <div class="history-drawer" id="drawer-${id}">
      <div class="drawer-label">Transkrip</div>
      <div class="drawer-text">${preview}</div>
    </div>`;
}

// ─── CARD: TOPIK DARI RINGKAS AI ──────────────
function _cardSummTopic(t, id) {
  const subjName  = t.subjects?.name || 'Umum';
  const subjIcon  = t.subjects?.icon || '📚';
  const topicDate = t.date
    ? formatDate(t.date)
    : '';
  const points    = t.ai_points || [];

  return `
    <div class="history-card" onclick="toggleHistoryDrawer('${id}')">
      <div class="hc-top">
        <div class="hc-subject">
          <span class="hc-subject-icon">${subjIcon}</span>
          <span class="hc-subject-name">${subjName}</span>
        </div>
        <span class="hc-time">${topicDate}</span>
      </div>
      <div class="hc-topic">${t.name}</div>
      <div class="hc-footer">
        <span class="hc-badge ai">✦ ${points.length} poin AI</span>
        <button class="btn-expand" onclick="event.stopPropagation(); toggleHistoryDrawer('${id}')">
          Lihat
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>
    </div>`;
}

function _drawerSummTopic(t, id) {
  const points = t.ai_points || [];
  const pointsHtml = points.length
    ? '<ul class="drawer-points">' +
        points.map(p => `<li>${p.point_text}</li>`).join('') +
      '</ul>'
    : '<p style="color:var(--text3);font-size:13px">Belum ada poin tersimpan.</p>';
  return `
    <div class="history-drawer" id="drawer-${id}">
      <div class="drawer-label">Poin Utama AI</div>
      ${pointsHtml}
    </div>`;
}

// ─── LOCAL GRID ───────────────────────────────
function _renderLocalGrid(items) {
  let html = '<div class="history-grid">';
  html += items.map((h, i) => {
    const date = new Date(h.createdAt).toLocaleDateString('id-ID', { day:'2-digit', month:'short' });
    return `
      <div class="history-card" style="border-style:dashed" onclick="toggleHistoryDrawer('local-${i}')">
        <div class="hc-top">
          <div class="hc-subject">
            <span class="hc-subject-icon">📚</span>
            <span class="hc-subject-name">${h.subject || 'Umum'}</span>
          </div>
          <span class="hc-time">${date}</span>
        </div>
        <div class="hc-topic">${h.topic || '—'}</div>
        <div class="hc-footer">
          <span class="hc-badge">${(h.wordCount||0).toLocaleString('id-ID')} kata</span>
          <button class="btn-expand" onclick="event.stopPropagation(); toggleHistoryDrawer('local-${i}')">
            Lihat
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>
      </div>`;
  }).join('');
  html += '</div>';

  // Drawers lokal
  html += items.map((h, i) => `
    <div class="history-drawer" id="drawer-local-${i}">
      <div class="drawer-label">Transkrip</div>
      <div class="drawer-text">${(h.transcript || '').slice(0, 600) || '(Tidak ada)'}</div>
      ${currentUser ? `<button class="btn-sync-single" style="margin-top:10px" onclick="syncSingleLocal(${i})">↑ Sinkronkan ke Supabase</button>` : ''}
    </div>`).join('');

  return html;
}

// ─── SYNC ─────────────────────────────────────
function _buildSyncBanner(count) {
  if (!currentUser || !count) return '';
  return `
    <div class="sync-banner">
      <span>${count} rekaman lokal belum tersinkronisasi</span>
      <button class="btn-ghost sm" onclick="syncAllLocal()">↑ Sinkronkan Semua</button>
    </div>`;
}

async function syncAllLocal() {
  if (!currentUser) return;
  const local = JSON.parse(localStorage.getItem('catatIn_local_history') || '[]');
  if (!local.length) return;
  showToast('Menyinkronkan...', 'default');
  let ok = 0, fail = 0;
  for (const entry of local) {
    try { await sbSyncLocalEntry(currentUser.id, entry); ok++; }
    catch(e) { fail++; }
  }
  if (ok > 0) {
    localStorage.setItem('catatIn_local_history', JSON.stringify([]));
    await loadSubjects();
    showToast(`✓ ${ok} rekaman berhasil disinkronisasi!`, 'success');
  }
  if (fail > 0) showToast(`${fail} rekaman gagal.`, 'error');
  renderHistory();
}

async function syncSingleLocal(index) {
  if (!currentUser) return;
  const local = JSON.parse(localStorage.getItem('catatIn_local_history') || '[]');
  const entry = local[index];
  if (!entry) return;
  try {
    await sbSyncLocalEntry(currentUser.id, entry);
    local.splice(index, 1);
    localStorage.setItem('catatIn_local_history', JSON.stringify(local));
    await loadSubjects();
    showToast('Rekaman berhasil disinkronisasi!', 'success');
    renderHistory();
  } catch(e) {
    showToast('Gagal: ' + e.message, 'error');
  }
}

// ─── HELPERS ──────────────────────────────────
function _sectionLabel(label, count) {
  return `<div class="history-section-label">${label} <span>(${count})</span></div>`;
}
function _updateHistoryBadge(count) {
  const badge = document.getElementById('history-count');
  if (badge) badge.textContent = count;
}
async function clearHistory() {
  showToast('Gunakan Supabase dashboard untuk hapus data server.', 'default');
}