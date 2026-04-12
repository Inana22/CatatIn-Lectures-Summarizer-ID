// ══════════════════════════════════════
//  CatatIn — app.js
// ══════════════════════════════════════

// ─── SUBJECTS DATA ───────────────────
const SUBJECTS = [
  { name: 'Fisika',          desc: 'Mekanika, Termodinamika, Gelombang, Optik',  icon: '⚛️', color: '#e8edf5', count: 32, topics: 'Gerak, Energi, Listrik, Magnetisme' },
  { name: 'Teologi & Agama', desc: 'Ilmu Kalam, Fiqh, Perbandingan Agama',       icon: '✦',  color: '#e5edf5', count: 18, topics: 'Islam, Kristen, Hindu, Buddha' },
  { name: 'Sejarah',         desc: 'Sejarah Indonesia & Dunia',                   icon: '📜', color: '#edf2f7', count: 31, topics: 'Kolonialisme, Kemerdekaan, Perang Dunia' },
];

// ─── STATE ───────────────────────────
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition    = null;
let isListening    = false;
let finalTranscript = '';
let timerInterval  = null;
let elapsed        = 0;
let history_sessions = [];

// ─── DOM REFS ────────────────────────
const waveformEl = document.getElementById('waveform');

// ─── INIT: WAVEFORM BARS ─────────────
(function buildWaveform() {
  if (!waveformEl) return;
  for (let i = 0; i < 22; i++) {
    const b = document.createElement('div');
    b.className = 'wave-bar';
    b.style.setProperty('--spd',  (0.3 + Math.random() * 0.5).toFixed(2) + 's');
    b.style.setProperty('--min',  (3   + Math.random() * 5  ).toFixed(0) + 'px');
    b.style.setProperty('--max',  (14  + Math.random() * 26 ).toFixed(0) + 'px');
    b.style.animationDelay = (Math.random() * 0.5).toFixed(2) + 's';
    waveformEl.appendChild(b);
  }
})();

// ─── NAVIGATION ──────────────────────
function showPage(name) {
  ['record', 'subjects', 'history', 'summarize'].forEach(p => {
    const el = document.getElementById('subpage-' + p);
    if (el) el.style.display = 'none';
    const nav = document.getElementById('nav-' + p);
    if (nav) nav.classList.remove('active');
  });
  const page = document.getElementById('subpage-' + name);
  if (page) page.style.display = 'block';
  const nav = document.getElementById('nav-' + name);
  if (nav) nav.classList.add('active');

  if (name === 'subjects') renderSubjects('');
  if (name === 'history')  renderHistory();
}

function doLogin() {
  document.getElementById('page-login').classList.remove('active');
  document.getElementById('page-app').classList.add('active');
}

function logout() {
  document.getElementById('page-app').classList.remove('active');
  document.getElementById('page-login').classList.add('active');
}

// ─── TOAST ───────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ─── HELPERS ─────────────────────────
function updateWordCount() {
  const w = finalTranscript.trim().split(/\s+/).filter(x => x.length > 0);
  document.getElementById('wordCount').textContent = w.length + ' kata';
}

function fmtTime(s) {
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

// ─── RECORDING STATE ─────────────────
function setListening(val) {
  isListening = val;
  const btn = document.getElementById('micBtn');
  btn.classList.toggle('listening', val);
  document.getElementById('icon-mic').style.display  = val ? 'none'  : 'block';
  document.getElementById('icon-stop').style.display = val ? 'block' : 'none';
  document.getElementById('micStatus').textContent = val ? 'Merekam suara...' : 'Siap mendengarkan...';
  document.getElementById('micStatus').classList.toggle('active', val);
  waveformEl.classList.toggle('active', val);
  waveformEl.classList.toggle('idle',   !val);
  document.getElementById('mic-instruction').textContent = val
    ? 'Tekan stop untuk menghentikan rekaman'
    : 'Tekan tombol mikrofon untuk mulai merekam';

  if (val) {
    elapsed = 0;
    timerInterval = setInterval(() => {
      elapsed++;
      document.getElementById('sess-timer').textContent = fmtTime(elapsed);
    }, 1000);
  } else {
    clearInterval(timerInterval);
  }

  const sub = document.getElementById('sess-sub');
  const sel = document.getElementById('subject-sel').value;
  if (val) sub.textContent = (sel || 'Umum') + ' · Merekam...';
  else     sub.textContent = sel ? (sel + ' · Siap dimulai') : 'Pilih mata pelajaran & mulai rekam';
}

// ─── SPEECH RECOGNITION ──────────────
function startRec() {
  if (!SR) { showToast('Browser tidak support! Gunakan Chrome/Edge.'); return; }

  recognition = new SR();
  recognition.lang = 'id-ID';
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onstart = () => {
    setListening(true);
    const el = document.getElementById('transcript-text');
    if (el.querySelector('.placeholder')) el.innerHTML = '';
  };

  recognition.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript + ' ';
      else interim += e.results[i][0].transcript;
    }
    document.getElementById('transcript-text').textContent = finalTranscript;
    document.getElementById('interim-text').textContent = interim;
    document.getElementById('transcript-text').closest('.transcript-card').scrollTop = 9999;
    updateWordCount();
    saveToHistory();
  };

  recognition.onerror = e => {
    if (e.error === 'no-speech') return;
    if (e.error === 'not-allowed') showToast('Akses mikrofon ditolak. Izinkan di browser.');
    else showToast('Error: ' + e.error);
    stopRec();
  };

  recognition.onend = () => { if (isListening) recognition.start(); };
  recognition.start();
}

function stopRec() {
  if (recognition) { recognition.onend = null; recognition.stop(); recognition = null; }
  document.getElementById('interim-text').textContent = '';
  setListening(false);
}

function toggleRecording() {
  if (!SR) { showToast('Browser tidak support Web Speech API. Gunakan Chrome!'); return; }
  isListening ? stopRec() : startRec();
}

function clearTranscript() {
  finalTranscript = '';
  document.getElementById('transcript-text').innerHTML =
    '<span class="placeholder">Transkripsi akan muncul di sini setelah Anda mulai merekam...</span>';
  document.getElementById('interim-text').textContent = '';
  updateWordCount();
  document.getElementById('sess-timer').textContent = '00:00';
}

function copyTranscript() {
  if (!finalTranscript.trim()) { showToast('Belum ada transkrip!'); return; }
  navigator.clipboard.writeText(finalTranscript.trim())
    .then(() => showToast('Transkrip berhasil disalin!'))
    .catch(() => showToast('Gagal menyalin. Coba Ctrl+C manual.'));
}

function updateSession() {
  if (!isListening) {
    const sel = document.getElementById('subject-sel').value;
    const top = document.getElementById('topic-input').value;
    document.getElementById('sess-sub').textContent =
      (sel || 'Belum dipilih') + (top ? ' · ' + top : ' · Siap dimulai');
  }
}

// ─── AI SUMMARIZE (Recording) ────────────────────
async function doSummarize() {
  const text = finalTranscript.trim();
  if (!text) { showToast('Rekam sesuatu dulu sebelum merangkum!'); return; }

  const subj    = document.getElementById('subject-sel').value || 'umum';
  const btn     = document.getElementById('summ-btn');
  const loading = document.getElementById('summ-loading');
  const output  = document.getElementById('summary-output');

  btn.disabled = true;
  loading.classList.add('show');
  output.innerHTML = '';
  document.getElementById('keypoints-card').style.display = 'none';

  try {
    const res = await fetch('http://localhost:8080/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text,
        num_sentences: 3
      })
    });

    const data = await res.json();
    if (res.status !== 200) throw new Error(data.detail || 'Gagal merangkum');

    output.textContent = data.summary;

    if (data.points && data.points.length) {
      const kpList = document.getElementById('keypoints-list');
      kpList.innerHTML = '';
      data.points.forEach(p => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="kp-dot"></span>${p}`;
        kpList.appendChild(li);
      });
      document.getElementById('keypoints-card').style.display = 'block';
    }
  } catch (err) {
    output.textContent = 'Terjadi kesalahan saat merangkum. Pastikan backend Python sudah berjalan.';
    console.error(err);
  } finally {
    loading.classList.remove('show');
    btn.disabled = false;
  }
}

// ─── TEXT & PDF SUMMARIZE ─────────────
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

async function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.type !== 'application/pdf') { showToast('Hanya mendukung file PDF!'); return; }

  const status = document.getElementById('upload-status');
  status.textContent = 'Mengekstrak teks dari PDF...';
  
  try {
    const text = await extractTextFromPdf(file);
    document.getElementById('summarize-text-input').value = text;
    status.textContent = `Berhasil: ${file.name}`;
    showToast('Teks berhasil diekstrak!');
  } catch (err) {
    console.error(err);
    status.textContent = 'Gagal membaca PDF.';
    showToast('Gagal mengekstrak PDF.');
  }
}

async function extractTextFromPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str);
    fullText += strings.join(' ') + '\n';
  }
  return fullText;
}

async function doTextSummarize() {
  const text = document.getElementById('summarize-text-input').value.trim();
  if (!text) { showToast('Masukkan teks atau unggah PDF dulu!'); return; }

  const btn     = document.querySelector('#subpage-summarize .summarize-btn.primary');
  const loading = document.getElementById('text-summ-loading');
  const output  = document.getElementById('text-summary-output');
  const kpCard  = document.getElementById('text-keypoints-card');

  btn.disabled = true;
  loading.classList.add('show');
  output.textContent = '';
  kpCard.style.display = 'none';

  try {
    const res = await fetch('http://localhost:8080/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text, num_sentences: 5 })
    });

    const data = await res.json();
    if (res.status !== 200) throw new Error(data.detail || 'Gagal merangkum');

    output.textContent = data.summary;

    if (data.points && data.points.length) {
      const kpList = document.getElementById('text-keypoints-list');
      kpList.innerHTML = '';
      data.points.forEach(p => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="kp-dot"></span>${p}`;
        kpList.appendChild(li);
      });
      kpCard.style.display = 'block';
    }
  } catch (err) {
    output.textContent = 'Error: Gagal menghubungi backend AI.';
    console.error(err);
  } finally {
    loading.classList.remove('show');
    btn.disabled = false;
  }
}

function clearSummarize() {
  document.getElementById('summarize-text-input').value = '';
  document.getElementById('pdf-file').value = '';
  document.getElementById('upload-status').textContent = 'Klik untuk pilih PDF atau seret file ke sini';
  document.getElementById('text-summary-output').innerHTML = '<span class="summary-placeholder">Hasil rangkuman akan muncul di sini...</span>';
  document.getElementById('text-keypoints-card').style.display = 'none';
}

// ─── SUBJECTS ────────────────────────
function renderSubjects(q) {
  const filtered = SUBJECTS.filter(s =>
    s.name.toLowerCase().includes(q.toLowerCase()) ||
    s.desc.toLowerCase().includes(q.toLowerCase())
  );
  const grid = document.getElementById('subjects-grid');
  grid.innerHTML = '';
  filtered.forEach(s => {
    const card = document.createElement('div');
    card.className = 'subject-card';
    card.innerHTML = `
      <div class="subject-icon" style="background:${s.color}">${s.icon}</div>
      <div class="subject-name">${s.name}</div>
      <div class="subject-desc">${s.desc}</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:10px;">${s.topics}</div>
      <div class="subject-footer">
        <span class="subject-count">${s.count} topik</span>
        <span class="subject-arrow">→</span>
      </div>
    `;
    card.onclick = () => {
      document.getElementById('subject-sel').value = s.name;
      updateSession();
      showPage('record');
    };
    grid.appendChild(card);
  });
}

function filterSubjects(q) {
  renderSubjects(q);
}

// ─── HISTORY ─────────────────────────
function saveToHistory() {
  if (!finalTranscript.trim()) return;
  const sel = document.getElementById('subject-sel').value || 'Umum';
  const now = new Date();
  const existing = history_sessions.find(h => h.id === 'current');
  if (existing) {
    existing.text = finalTranscript;
    existing.subject = sel;
  } else {
    history_sessions.unshift({
      id: 'current',
      subject: sel,
      text: finalTranscript,
      time: now.toLocaleString('id-ID')
    });
  }
}

function renderHistory() {
  const el = document.getElementById('history-list');
  if (!history_sessions.length) {
    el.innerHTML = '<p style="color:var(--muted);font-size:14px;">Belum ada rekaman tersimpan.</p>';
    return;
  }
  el.innerHTML = history_sessions.map(h => `
    <div class="history-item">
      <div class="history-item-header">
        <span class="history-item-subject">${h.subject}</span>
        <span class="history-item-time">${h.time}</span>
      </div>
      <p class="history-item-text">${h.text.trim().slice(0, 200)}${h.text.length > 200 ? '...' : ''}</p>
      <span class="history-item-badge">${h.text.trim().split(/\s+/).filter(Boolean).length} kata</span>
    </div>
  `).join('');
}