// ══════════════════════════════════════════════
//  summarize.js — CatatIn
//  Halaman Ringkas AI:
//  - Input teks manual
//  - Upload & parsing PDF (PDF.js)
//  - Drag & drop PDF
//  - Kirim ke backend /summarize
//  - Simpan poin AI ke mata pelajaran
// ══════════════════════════════════════════════

let lastSummPoints = [];   // cache poin AI terakhir dari halaman ini

// ─── INIT (dipanggil saat page summarize aktif) ───
function initSummarizePage() {
  const dateEl = document.getElementById('summ-date');
  if (dateEl && !dateEl.value) dateEl.value = todayISO();

  // Reset state output kalau kosong
  const kpCard = document.getElementById('text-keypoints-card');
  const empty  = document.getElementById('output-empty');
  if (kpCard && kpCard.style.display === 'none' && empty) {
    empty.style.display = 'flex';
  }
}

// ─── DRAG & DROP ──────────────────────────────
function setupDragDrop() {
  const zone = document.getElementById('upload-zone');
  if (!zone || zone.dataset.ddReady) return;
  zone.dataset.ddReady = '1';

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('drag-over');
  });

  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      showToast('Hanya file PDF yang didukung!', 'error');
      return;
    }
    processPdfFile(file);
  });
}

// ─── FILE INPUT HANDLER ───────────────────────
function handleFileSelect(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  processPdfFile(file);
  // Reset input supaya file yang sama bisa dipilih lagi
  e.target.value = '';
}

// ─── PROSES PDF ───────────────────────────────
async function processPdfFile(file) {
  if (file.size > 10 * 1024 * 1024) {
    showToast('File terlalu besar! Maksimal 10MB.', 'error');
    return;
  }

  const statusEl = document.getElementById('upload-status');
  if (statusEl) statusEl.textContent = `Memuat "${file.name}"...`;

  try {
    const text = await extractTextFromPdf(file);

    if (!text.trim()) {
      showToast('PDF tidak mengandung teks yang bisa dibaca (mungkin hasil scan).', 'error');
      if (statusEl) statusEl.textContent = 'Gagal membaca teks dari PDF.';
      return;
    }

    // Masukkan teks ke textarea
    const textarea = document.getElementById('summarize-text-input');
    if (textarea) textarea.value = text;

    if (statusEl) statusEl.textContent = `✓ "${file.name}" berhasil dimuat (${text.split(/\s+/).length.toLocaleString('id-ID')} kata)`;
    showToast('PDF berhasil dimuat! Klik "Rangkum" untuk menganalisa.', 'success');

  } catch (err) {
    console.error('PDF parse error:', err);
    if (statusEl) statusEl.textContent = 'Gagal membaca file PDF.';
    showToast('Gagal membaca PDF: ' + err.message, 'error');
  }
}

async function extractTextFromPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    fullText += pageText + '\n\n';
  }
  return fullText.trim();
}

// ─── RINGKAS TEKS ─────────────────────────────
async function doTextSummarize() {
  const textarea = document.getElementById('summarize-text-input');
  const text     = textarea?.value.trim();

  if (!text) {
    showToast('Tempelkan teks atau unggah PDF dulu!', 'error');
    return;
  }
  if (text.length < 50) {
    showToast('Teks terlalu pendek untuk diringkas!', 'error');
    return;
  }

  const loadingEl = document.getElementById('text-summ-loading');
  const kpCard    = document.getElementById('text-keypoints-card');
  const emptyEl   = document.getElementById('output-empty');
  const saveSection = document.getElementById('summ-save-section');
  const savBtn    = document.getElementById('btn-summ-save');

  // Tampilkan loading
  if (loadingEl)   loadingEl.classList.add('show');
  if (kpCard)      kpCard.style.display    = 'none';
  if (emptyEl)     emptyEl.style.display   = 'none';
  if (saveSection) saveSection.style.display = 'none';
  if (savBtn)      savBtn.style.display    = 'none';
  lastSummPoints = [];

  try {
    const res = await fetch('http://127.0.0.1:8080/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, num_sentences: 0 })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Gagal menganalisa');

    lastSummPoints = data.points || [];
    renderKeypoints('text-keypoints-list', lastSummPoints, text, kpCard);

    // Tampilkan section simpan
    if (saveSection) saveSection.style.display = 'block';
    if (savBtn)      savBtn.style.display      = 'flex';

  } catch (err) {
    const kpList = document.getElementById('text-keypoints-list');
    if (kpList) kpList.innerHTML = `
      <li style="color:var(--red);font-size:13px;list-style:none;padding:8px 0">
        ⚠️ Gagal menghubungi AI backend.<br/>
        <small>Pastikan server berjalan di <code>http://127.0.0.1:8080</code></small>
      </li>`;
    if (kpCard) kpCard.style.display = 'block';
    console.error('Summarize error:', err);
  } finally {
    if (loadingEl) loadingEl.classList.remove('show');
  }
}

// ─── SIMPAN POIN AI KE MATA PELAJARAN ─────────
async function saveSummPoints() {
  if (!lastSummPoints.length) {
    showToast('Dapatkan poin AI dulu!', 'error');
    return;
  }
  if (!currentUser) {
    showToast('Silakan login dulu!', 'error');
    return;
  }

  const subjectId = document.getElementById('summ-subject-sel')?.value;
  const topicName = document.getElementById('summ-topic')?.value.trim();
  const dateVal   = document.getElementById('summ-date')?.value;

  if (!subjectId) { showToast('Pilih mata pelajaran dulu!', 'error'); return; }
  if (!topicName) { showToast('Isi topik spesifik dulu!', 'error'); return; }

  const btn = document.getElementById('btn-summ-save');
  if (btn) { 
    btn.disabled = true;
    const sp = btn.querySelector('span');
    if (sp) sp.textContent = 'Menyimpan...';
  }

  try {
    const topic = await sbAddTopic(
      currentUser.id,
      subjectId,
      topicName,
      dateVal || todayISO()
    );
    await sbSaveAiPoints(currentUser.id, topic.id, lastSummPoints, 'summarize');

    showToast('Poin AI berhasil disimpan ke mata pelajaran!', 'success');
    await loadSubjects();

    // Reset form simpan
    if (document.getElementById('summ-topic'))   document.getElementById('summ-topic').value = '';
    if (document.getElementById('summ-subject-sel')) document.getElementById('summ-subject-sel').value = '';

  } catch (e) {
    showToast('Gagal menyimpan: ' + e.message, 'error');
    console.error(e);
  } finally {
if (btn) {
      btn.disabled = false;
      const sp = btn.querySelector('span');
      if (sp) sp.textContent = 'Simpan Poin ke Mata Pelajaran';
    }
  }
}

// ─── BERSIHKAN HALAMAN ────────────────────────
function clearSummarize() {
  const textarea = document.getElementById('summarize-text-input');
  if (textarea) textarea.value = '';

  const statusEl = document.getElementById('upload-status');
  if (statusEl) statusEl.textContent = 'Klik untuk pilih PDF atau seret file ke sini';

  const kpCard  = document.getElementById('text-keypoints-card');
  const emptyEl = document.getElementById('output-empty');
  const saveSection = document.getElementById('summ-save-section');
  const savBtn  = document.getElementById('btn-summ-save');

  if (kpCard)      kpCard.style.display      = 'none';
  if (emptyEl)     emptyEl.style.display     = 'flex';
  if (saveSection) saveSection.style.display = 'none';
  if (savBtn)      savBtn.style.display      = 'none';

  lastSummPoints = [];
}