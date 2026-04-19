// ══════════════════════════════════════════════
//  record.js — CatatIn
//  Halaman Rekam Suara: speech recognition,
//  simpan transkrip, simpan poin AI ke topik
// ══════════════════════════════════════════════

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition     = null;
let isListening     = false;
let finalTranscript = '';
let timerInterval   = null;
let elapsed         = 0;
let lastAiPoints    = [];   // cache hasil AI terakhir

// ─── INIT (dipanggil saat page record aktif) ──
function initRecordPage() {
  buildWaveform();
  setDateField();
}

function setDateField() {
  const el = document.getElementById('rec-date');
  if (el) el.value = todayISO();
}

// ─── WAVEFORM ─────────────────────────────────
function buildWaveform() {
  const waveformEl = document.getElementById('waveform');
  if (!waveformEl || waveformEl.children.length > 0) return;
  for (let i = 0; i < 28; i++) {
    const b = document.createElement('div');
    b.className = 'wave-bar';
    b.style.setProperty('--spd', (0.25 + Math.random() * 0.5).toFixed(2) + 's');
    b.style.setProperty('--min', (3 + Math.random() * 4).toFixed(0) + 'px');
    b.style.setProperty('--max', (18 + Math.random() * 24).toFixed(0) + 'px');
    b.style.animationDelay = (Math.random() * 0.5).toFixed(2) + 's';
    waveformEl.appendChild(b);
  }
}

// ─── RECORDING STATE ──────────────────────────
function setListening(val) {
  isListening = val;
  const waveformEl = document.getElementById('waveform');
  const btn        = document.getElementById('micBtn');
  const micCard    = btn?.closest('.mic-card');

  btn?.classList.toggle('listening', val);
  micCard?.classList.toggle('recording', val);

  document.getElementById('icon-mic').style.display  = val ? 'none'  : 'block';
  document.getElementById('icon-stop').style.display = val ? 'block' : 'none';

  const statusDot  = document.getElementById('mic-status-dot');
  const statusText = document.getElementById('micStatus');
  if (statusDot)  statusDot.classList.toggle('active', val);
  if (statusText) statusText.textContent = val ? 'Merekam suara...' : 'Siap mendengarkan...';

  const instr = document.getElementById('mic-instruction');
  if (instr) instr.textContent = val
    ? 'Tekan stop untuk menghentikan rekaman'
    : 'Tekan tombol mikrofon untuk mulai merekam';

  waveformEl?.classList.toggle('active', val);

  const scDot = document.getElementById('sc-dot');
  if (scDot) scDot.classList.toggle('recording', val);

  const liveLabel = document.getElementById('live-label');
  const liveStat  = document.getElementById('live-stat');
  if (liveLabel) liveLabel.textContent = val ? 'Sedang merekam...' : 'Siap merekam';
  if (liveStat) {
    const dot = liveStat.querySelector('.stat-dot');
    if (dot) { dot.classList.toggle('recording', val); dot.classList.toggle('idle', !val); }
  }

  // Timer
  if (val) {
    elapsed = 0;
    timerInterval = setInterval(() => {
      elapsed++;
      const el = document.getElementById('sess-timer');
      if (el) el.textContent = fmtTime(elapsed);
    }, 1000);
  } else {
    clearInterval(timerInterval);
  }

  updateSession();
}

// ─── SPEECH RECOGNITION ───────────────────────
function toggleRecording() {
  if (!SR) { showToast('Browser tidak support Web Speech API. Gunakan Chrome!', 'error'); return; }
  isListening ? stopRec() : startRec();
}

function startRec() {
  if (!SR) return;
  recognition = new SR();
  const langEl = document.getElementById('pref-lang');
  recognition.lang              = langEl ? langEl.value : 'id-ID';
  recognition.continuous        = true;
  recognition.interimResults    = true;

  recognition.onstart = () => {
    setListening(true);
    const el = document.getElementById('transcript-text');
    if (el && el.querySelector('.placeholder')) el.innerHTML = '';
  };

  recognition.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript + ' ';
      else interim += e.results[i][0].transcript;
    }
    const tt = document.getElementById('transcript-text');
    if (tt) tt.textContent = finalTranscript;
    const it = document.getElementById('interim-text');
    if (it) it.textContent = interim;
    const tcBody = document.querySelector('.tc-body');
    if (tcBody) tcBody.scrollTop = 9999;
    updateWordCount();
  };

  recognition.onerror = e => {
    if (e.error === 'no-speech') return;
    if (e.error === 'not-allowed') showToast('Akses mikrofon ditolak. Izinkan di browser.', 'error');
    else showToast('Error: ' + e.error, 'error');
    stopRec();
  };

  recognition.onend = () => { if (isListening) recognition.start(); };
  recognition.start();
}

function stopRec() {
  if (recognition) { recognition.onend = null; recognition.stop(); recognition = null; }
  const it = document.getElementById('interim-text');
  if (it) it.textContent = '';
  setListening(false);

  // Otomatis tampilkan tombol simpan kalau ada transkrip
  if (finalTranscript.trim()) {
    const btnSave = document.getElementById('btn-save-record');
    if (btnSave) btnSave.style.display = 'flex';
    showToast('Rekaman selesai! Jangan lupa simpan.', 'success');
  } else {
    showToast('Rekaman selesai!', 'success');
  }
}
// ─── HELPERS ──────────────────────────────────
function updateWordCount() {
  const w = finalTranscript.trim().split(/\s+/).filter(x => x.length > 0);
  const el = document.getElementById('wordCount');
  if (el) el.textContent = w.length + ' kata';
}

function fmtTime(s) {
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

async function clearTranscript() {
  // Kalau ada transkrip, simpan dulu sebelum dihapus
  if (finalTranscript.trim()) {
    const subjectId = document.getElementById('rec-subject-sel')?.value;
    const topicName = document.getElementById('rec-topic')?.value.trim();

if (currentUser && subjectId && topicName) {
  try {
    // Pakai _getOrCreateTopic agar tidak buat topik duplikat
    const topic = await _getOrCreateTopic();
    if (topic && !_recordingSaved) {
      const wordCount = finalTranscript.trim().split(/\s+/).filter(Boolean).length;
      await sbSaveRecording(currentUser.id, topic.subject_id, topic.id, finalTranscript.trim(), elapsed, wordCount);
      _recordingSaved = true;
      if (lastAiPoints.length) {
        await sbSaveAiPoints(currentUser.id, topic.id, lastAiPoints, 'record');
      }
      showToast('Rekaman tersimpan otomatis ke riwayat!', 'success');
      await loadSubjects();
    } else if (_recordingSaved) {
      showToast('Sesi dihapus. Data sudah tersimpan sebelumnya.', 'default');
    }

      } catch (e) {
        // Gagal simpan ke Supabase → fallback ke local
        _saveToLocalFallback();
        showToast('Tersimpan lokal (Supabase gagal).', 'default');
        console.error('Auto-save gagal:', e);
      }
    } else {
      // Info kurang (belum pilih mapel/topik) → simpan ke local fallback
      _saveToLocalFallback();
      showToast('Tersimpan ke riwayat lokal. Isi mapel & topik untuk simpan ke server.', 'default');
    }
  }

  // Reset semua state & UI
  finalTranscript = '';
  lastAiPoints    = [];
  _savedTopicId   = null;
  _savedSubjectId = null;
  _recordingSaved = false;
  const tt = document.getElementById('transcript-text');
  if (tt) tt.innerHTML = '<span class="placeholder">Transkripsi akan muncul di sini setelah Anda mulai merekam...</span>';
  const it = document.getElementById('interim-text');
  if (it) it.textContent = '';
  const timer = document.getElementById('sess-timer');
  if (timer) timer.textContent = '00:00';
  const kp = document.getElementById('keypoints-card');
  if (kp) kp.style.display = 'none';
  updateWordCount();
  const btnSaveR = document.getElementById('btn-save-record');
  const btnSaveA = document.getElementById('btn-save-ai');
  if (btnSaveR) btnSaveR.style.display = 'none';
  if (btnSaveA) btnSaveA.style.display = 'none';
}

// ─── LOCAL FALLBACK HISTORY ───────────────────
// Dipakai kalau Supabase belum tersedia atau info rekaman belum lengkap
let _localHistory = JSON.parse(localStorage.getItem('catatIn_local_history') || '[]');

function _saveToLocalFallback() {
  if (!finalTranscript.trim()) return;
  const subjectEl = document.getElementById('rec-subject-sel');
  const topicEl   = document.getElementById('rec-topic');
  const subjName  = subjectEl?.options[subjectEl.selectedIndex]?.text || 'Umum';
  const topicName = topicEl?.value.trim() || '—';

  const entry = {
    id:         'local-' + Date.now(),
    subject:    subjName,
    topic:      topicName,
    transcript: finalTranscript.trim(),
    wordCount:  finalTranscript.trim().split(/\s+/).filter(Boolean).length,
    aiPoints:   lastAiPoints,
    elapsed:    elapsed,
    createdAt:  new Date().toISOString()
  };

  _localHistory.unshift(entry);
  // Batasi 50 entri lokal
  if (_localHistory.length > 50) _localHistory = _localHistory.slice(0, 50);
  localStorage.setItem('catatIn_local_history', JSON.stringify(_localHistory));

  // Update badge di sidebar
  _updateLocalHistoryBadge();
}

function _updateLocalHistoryBadge() {
  const badge = document.getElementById('history-count');
  if (badge) {
    // Tampilkan jumlah local + server (server count sudah diset di renderHistory)
    const cur = parseInt(badge.textContent) || 0;
    if (_localHistory.length > 0 && cur === 0) badge.textContent = _localHistory.length;
  }
}

function copyTranscript() {
  if (!finalTranscript.trim()) { showToast('Belum ada transkrip!'); return; }
  navigator.clipboard.writeText(finalTranscript.trim())
    .then(() => showToast('Transkrip berhasil disalin!', 'success'))
    .catch(() => showToast('Gagal menyalin. Coba Ctrl+C manual.', 'error'));
}

function updateSession() {
  const sel  = document.getElementById('rec-subject-sel');
  const sub  = document.getElementById('sess-sub');
  const selName = sel ? (sel.options[sel.selectedIndex]?.text || '') : '';

  if (!isListening && sub) {
    sub.textContent = selName ? selName + ' · Siap dimulai' : 'Pilih mata pelajaran & mulai rekam';
  } else if (isListening && sub) {
    sub.textContent = (selName || 'Umum') + ' · Sedang merekam...';
  }
}

// ─── AI SUMMARIZE (dari rekaman) ──────────────
async function doSummarize() {
  const text = finalTranscript.trim();
  if (!text) { showToast('Rekam sesuatu dulu sebelum menganalisa!'); return; }

  const btn     = document.getElementById('summ-btn');
  const loading = document.getElementById('summ-loading');
  const kpCard  = document.getElementById('keypoints-card');

  btn.disabled = true;
  loading.classList.add('show');
  kpCard.style.display = 'none';

  try {
    const res = await fetch('http://127.0.0.1:8080/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, num_sentences: 0 })
    });
    const data = await res.json();
    if (res.status !== 200) throw new Error(data.detail || 'Gagal menganalisa');

    lastAiPoints = data.points || [];
    renderKeypoints('keypoints-list', lastAiPoints, text, kpCard);

    // Tampilkan tombol simpan
    document.getElementById('btn-save-record').style.display = 'flex';
    document.getElementById('btn-save-ai').style.display     = 'flex';

  } catch (err) {
    const kpList = document.getElementById('keypoints-list');
    if (kpList) kpList.innerHTML = `<li style="color:var(--red);font-size:12px;">Gagal menghubungi AI. Pastikan backend berjalan.</li>`;
    kpCard.style.display = 'block';
    console.error(err);
  } finally {
    loading.classList.remove('show');
    btn.disabled = false;
  }
}

function renderKeypoints(listId, points, fallbackText, cardEl) {
  const kpList = document.getElementById(listId);
  if (!kpList) return;
  kpList.innerHTML = '';
  const data = points.length ? points : [fallbackText.slice(0, 500) + (fallbackText.length > 500 ? '...' : '')];
  data.forEach(p => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="kp-dot"></span>${p}`;
    kpList.appendChild(li);
  });
  cardEl.style.display = 'block';
}

// ─── SHARED TOPIC STATE ───────────────────────
// Supaya saveRecording & saveAiPoints tidak buat topik duplikat
let _recordingSaved = false;
let _savedTopicId   = null;
let _savedSubjectId = null;

async function _getOrCreateTopic() {
  const subjectId = document.getElementById('rec-subject-sel').value;
  const topicName = document.getElementById('rec-topic').value.trim();
  const dateVal   = document.getElementById('rec-date').value;

  if (!subjectId) { showToast('Pilih mata pelajaran dulu!', 'error'); return null; }
  if (!topicName) { showToast('Isi topik spesifik dulu!', 'error'); return null; }

  // Kalau topik untuk session ini sudah dibuat, reuse
  if (_savedTopicId && _savedSubjectId === subjectId) {
    return { id: _savedTopicId, subject_id: subjectId };
  }

  const topic = await sbAddTopic(currentUser.id, subjectId, topicName, dateVal || todayISO());
  _savedTopicId   = topic.id;
  _savedSubjectId = subjectId;
  return topic;
}

// ─── SIMPAN TRANSKRIP ─────────────────────────
async function saveRecording() {
  console.log('=== saveRecording() dipanggil ===');
  console.log('finalTranscript:', finalTranscript.trim().slice(0,50));
  console.log('currentUser:', currentUser?.id);
  console.log('_recordingSaved:', _recordingSaved);

  if (!finalTranscript.trim()) { showToast('Tidak ada transkrip!', 'error'); return; }
  if (!currentUser)            { showToast('Silakan login dulu!', 'error'); return; }
  if (_recordingSaved)         { showToast('Transkrip sudah tersimpan!', 'default'); return; }

  const btn = document.getElementById('btn-save-record');
  if (btn) btn.disabled = true;

  try {
    console.log('Memanggil _getOrCreateTopic...');
    const topic = await _getOrCreateTopic();
    console.log('Topic result:', topic);

    if (!topic) { 
      console.log('Topic null, berhenti');
      if (btn) btn.disabled = false; 
      return; 
    }

    const wordCount = finalTranscript.trim().split(/\s+/).filter(Boolean).length;
    console.log('Memanggil sbSaveRecording...', {
      userId: currentUser.id,
      subjectId: topic.subject_id,
      topicId: topic.id,
      wordCount
    });

    const result = await sbSaveRecording(
      currentUser.id,
      topic.subject_id,
      topic.id,
      finalTranscript.trim(),
      elapsed,
      wordCount
    );
    console.log('sbSaveRecording result:', result);
    _recordingSaved = true;

    showToast('Transkrip berhasil disimpan!', 'success');
    if (btn) btn.textContent = '✓ Tersimpan';
    await loadSubjects();

  } catch (e) {
    console.error('=== ERROR di saveRecording ===', e);
    showToast('Gagal menyimpan: ' + e.message, 'error');
    if (btn) btn.disabled = false;
  }
}
// ─── SIMPAN POIN AI ───────────────────────────
async function saveAiPoints() {
  if (!lastAiPoints.length) { showToast('Dapatkan poin AI dulu!', 'error'); return; }
  if (!currentUser)         { showToast('Silakan login dulu!', 'error'); return; }

  const btn = document.getElementById('btn-save-ai');
  btn.disabled = true;

  try {
    const topic = await _getOrCreateTopic();
    if (!topic) { btn.disabled = false; return; }

    // Selalu simpan recording kalau ada transkrip & belum pernah disimpan
    if (finalTranscript.trim() && !_recordingSaved) {
      const wordCount = finalTranscript.trim().split(/\s+/).filter(Boolean).length;
      await sbSaveRecording(
        currentUser.id,
        topic.subject_id,
        topic.id,
        finalTranscript.trim(),
        elapsed,
        wordCount
      );
      _recordingSaved = true;

      // Update tombol simpan transkrip juga
      const btnR = document.getElementById('btn-save-record');
      if (btnR) btnR.textContent = '✓ Tersimpan';
    }

    await sbSaveAiPoints(currentUser.id, topic.id, lastAiPoints, 'record');

    showToast('Poin AI + transkrip tersimpan ke Supabase!', 'success');
    btn.textContent = '✓ Poin Tersimpan';
    await loadSubjects();

  } catch (e) {
    showToast('Gagal menyimpan: ' + e.message, 'error');
    btn.disabled = false;
  }
}