// ══════════════════════════════════════════════
//  supabase.js — CatatIn
//  Satu-satunya file yang tahu tentang database.
//  Semua query ke Supabase ada di sini.
// ══════════════════════════════════════════════

// ─────────────────────────────────────────────
//  ⚙️  KONFIGURASI — ISI DI SINI
//  Dapatkan dari: Supabase Dashboard →
//  Project Settings → API
// ─────────────────────────────────────────────
const SUPABASE_URL  = 'https://vevpxvzkyppzvhsmwrtk.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZldnB4dnpreXBwenZoc213cnRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1OTMxNzcsImV4cCI6MjA5MjE2OTE3N30.EvSKjyw6j2M2qyofPVnBzHapK75Ymr43-VvRYIGIqtM';

const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);


// ══════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════

async function sbSignUp(email, password, meta) {
  return _sb.auth.signUp({
    email,
    password,
    options: { data: meta }
  });
}

async function sbSignIn(email, password) {
  return _sb.auth.signInWithPassword({ email, password });
}

async function sbSignOut() {
  return _sb.auth.signOut();
}

async function sbGetSession() {
  const { data } = await _sb.auth.getSession();
  return data.session;
}

function sbOnAuthChange(callback) {
  // onAuthStateChange sudah otomatis fire INITIAL_SESSION saat pertama load
  // Tidak perlu getSession() terpisah — satu listener sudah cukup
  _sb.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
}


// ══════════════════════════════════════════════
//  SUBJECTS  (Mata Pelajaran)
// ══════════════════════════════════════════════

async function sbGetSubjects(userId) {
  const { data, error } = await _sb
    .from('subjects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

async function sbAddSubject(userId, name, icon = '📚') {
  const { data, error } = await _sb
    .from('subjects')
    .insert({ user_id: userId, name, icon })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function sbDeleteSubject(subjectId) {
  // CASCADE di DB akan hapus topics → recordings + ai_points secara otomatis
  const { error } = await _sb
    .from('subjects')
    .delete()
    .eq('id', subjectId);
  if (error) throw error;
}


// ══════════════════════════════════════════════
//  TOPICS
// ══════════════════════════════════════════════

async function sbGetTopics(subjectId) {
  const { data, error } = await _sb
    .from('topics')
    .select('*')
    .eq('subject_id', subjectId)
    .order('date', { ascending: false });
  if (error) throw error;
  return data;
}

async function sbAddTopic(userId, subjectId, name, date) {
  const { data, error } = await _sb
    .from('topics')
    .insert({ user_id: userId, subject_id: subjectId, name, date })
    .select()
    .single();
  if (error) throw error;
  return data;
}


// ══════════════════════════════════════════════
//  RECORDINGS  (Transkrip Rekaman)
// ══════════════════════════════════════════════

async function sbSaveRecording(userId, subjectId, topicId, transcript, durationSec, wordCount) {
  const { data, error } = await _sb
    .from('recordings')
    .insert({
      user_id:          userId,
      subject_id:       subjectId,
      topic_id:         topicId,
      transcript,
      duration_seconds: durationSec,
      word_count:       wordCount
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function sbGetRecordings(userId) {
  const { data, error } = await _sb
    .from('recordings')
    .select(`
      *,
      subjects ( name, icon ),
      topics   ( name, date )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}


// ══════════════════════════════════════════════
//  AI POINTS
// ══════════════════════════════════════════════

async function sbSaveAiPoints(userId, topicId, points, source = 'record') {
  const rows = points.map(p => ({
    user_id:    userId,
    topic_id:   topicId,
    point_text: p,
    source
  }));
  const { data, error } = await _sb
    .from('ai_points')
    .insert(rows)
    .select();
  if (error) throw error;
  return data;
}

async function sbGetAiPointsByTopic(topicId) {
  const { data, error } = await _sb
    .from('ai_points')
    .select('*')
    .eq('topic_id', topicId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}


// ══════════════════════════════════════════════
//  PROFILE
// ══════════════════════════════════════════════

async function sbGetProfile(userId) {
  const { data, error } = await _sb
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  // PGRST116 = row not found (belum ada profil), bukan error fatal
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function sbUpsertProfile(userId, profileData) {
  const { data, error } = await _sb
    .from('profiles')
    .upsert({
      id:         userId,
      updated_at: new Date().toISOString(),
      ...profileData
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}


// ══════════════════════════════════════════════
//  STATS  (untuk halaman Profil)
// ══════════════════════════════════════════════

async function sbGetStats(userId) {
  const [recResult, wordResult] = await Promise.all([
    _sb
      .from('recordings')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    _sb
      .from('recordings')
      .select('word_count')
      .eq('user_id', userId)
  ]);

  const totalWords = (wordResult.data || [])
    .reduce((sum, r) => sum + (r.word_count || 0), 0);

  return {
    totalRecordings: recResult.count || 0,
    totalWords
  };
}
// ── TOPICS WITH AI POINTS (untuk history dari summarize) ──
async function sbGetTopicsWithPoints(userId) {
  const { data, error } = await _sb
    .from('topics')
    .select(`
      *,
      subjects ( name, icon ),
      ai_points ( point_text, source )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  // Hanya tampilkan topik yang punya poin AI dari summarize
  // (yang dari record sudah masuk recordings)
  return data.filter(t =>
    t.ai_points?.some(p => p.source === 'summarize')
  );
}

// ── SYNC LOCAL → SUPABASE ──────────────────────
async function sbSyncLocalEntry(userId, entry) {
  // Cari atau pakai subject pertama yang namanya cocok
  const { data: subjects } = await _sb
    .from('subjects')
    .select('id, name')
    .eq('user_id', userId);

  let subjectId = subjects?.find(
    s => s.name.toLowerCase() === entry.subject.toLowerCase()
  )?.id;

  // Kalau tidak ketemu, buat subject baru
  if (!subjectId) {
    const { data: newSubj } = await _sb
      .from('subjects')
      .insert({ user_id: userId, name: entry.subject, icon: '📚' })
      .select().single();
    subjectId = newSubj?.id;
  }

  if (!subjectId) throw new Error('Gagal membuat subject');

  const topic = await sbAddTopic(userId, subjectId, entry.topic, entry.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0]);
  await sbSaveRecording(userId, subjectId, topic.id, entry.transcript || '', entry.elapsed || 0, entry.wordCount || 0);
  if (entry.aiPoints?.length) {
    await sbSaveAiPoints(userId, topic.id, entry.aiPoints, 'record');
  }
  return true;
}
async function sbGetRecordingsByTopic(topicId) {
  const { data, error } = await _sb
    .from('recordings')
    .select('transcript, word_count, duration_seconds')
    .eq('topic_id', topicId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data || [];
}