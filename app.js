/**
 * StudyPulse - Student Daily Goal Tracker & Wellness Sanctuary
 * Multi-Page Application with Supabase Cloud Database, User Authentication,
 * "Me Time" Special Relaxation Oasis, Box Breathing, 30-Day Activity Heatmap,
 * and Exam Countdown Schedule.
 */

(function () {
  'use strict';

  // ==========================================
  // 1. Initial State & Constants
  // ==========================================
  const DEFAULT_CATEGORIES = [
    { id: 'academics', name: 'Academics & Studies', icon: '📚', color: '#6366F1', isDefault: true },
    { id: 'coding', name: 'Coding & Tech Skills', icon: '💻', color: '#06B6D4', isDefault: true },
    { id: 'health', name: 'Health & Fitness', icon: '🏃', color: '#10B981', isDefault: true },
    { id: 'personal', name: 'Personal & Mindset', icon: '🧘', color: '#EC4899', isDefault: true },
    { id: 'career', name: 'Career & Prep', icon: '🚀', color: '#F59E0B', isDefault: true }
  ];

  const MOTIVATIONAL_QUOTES = [
    { quote: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
    { quote: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
    { quote: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
    { quote: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
    { quote: "The expert in anything was once a beginner.", author: "Helen Hayes" },
    { quote: "Small daily improvements over time lead to stunning results.", author: "Robin Sharma" },
    { quote: "Do what you have to do until you can do what you want to do.", author: "Oprah Winfrey" }
  ];

  const RELAXING_AFFIRMATIONS = [
    "Your worth is not defined by grades. You are capable, resilient, and learning every day.",
    "Breathe. You have overcome challenging days before, and you will navigate this one too.",
    "Rest is not a reward for work; it is an essential part of growth and peak focus.",
    "One clear intention at a time. Let go of what you cannot control today.",
    "Trust your preparation. Be kind to yourself in moments of exhaustion."
  ];

  // Storage Keys
  const STORAGE_KEY_CONFIG = 'studypulse_supabase_config_v1';
  const STORAGE_KEY_LOCAL_GOALS = 'studypulse_local_goals_v1';
  const STORAGE_KEY_LOCAL_CATS = 'studypulse_local_cats_v1';
  const STORAGE_KEY_LOCAL_REFLECTIONS = 'studypulse_local_reflections_v1';
  const STORAGE_KEY_DEADLINES = 'studypulse_deadlines_v1';
  const STORAGE_KEY_SELF_CARE = 'studypulse_self_care_v1';
  const STORAGE_KEY_GRATITUDE = 'studypulse_gratitude_v1';
  const STORAGE_KEY_MOOD = 'studypulse_user_mood_v1';
  const STORAGE_KEY_THEME = 'studypulse_theme_v1';
  const STORAGE_KEY_SOUND = 'studypulse_sound_v1';
  const STORAGE_KEY_BANNER_DISMISSED = 'studypulse_banner_dismissed_v1';

  // Application State
  let activePage = 'goals'; // 'goals' | 'metime' | 'analytics' | 'schedule' | 'settings'
  let currentDate = new Date();
  let selectedCategoryFilter = 'all';
  let selectedStatusFilter = 'all';
  let searchQuery = '';
  let currentViewMode = 'list'; // 'list' | 'board'
  let isSoundEnabled = true;

  // In-memory records
  let categories = [...DEFAULT_CATEGORIES];
  let goals = [];
  let reflections = {};
  let deadlines = [];

  // Audio Context & Sound Generators
  let audioCtx = null;
  let activeSoundscape = 'off';
  let soundscapeNodes = null;

  // Box Breathing State
  let breathInterval = null;
  let breathIsRunning = false;
  let breathMode = 'box'; // 'box' (4-4-4-4) | 'relax' (4-7-8)
  let breathPhaseIndex = 0;
  let breathSecondsRemaining = 4;

  // Pomodoro Timer State
  let pomoTimer = null;
  let pomoSecondsLeft = 25 * 60;
  let pomoTotalSeconds = 25 * 60;
  let pomoIsRunning = false;
  let pomoMode = 'focus';
  let pomoActiveGoal = null;
  let ambientNode = null;
  let ambientGainNode = null;

  // Supabase Handle
  let supabaseClient = null;
  let currentUser = null;
  let isSupabaseConfigured = false;

  // ==========================================
  // 2. Date Helpers
  // ==========================================
  function formatDateKey(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getReadableDate(d) {
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  // ==========================================
  // 3. Database Layer (Supabase + LocalStorage)
  // ==========================================
  const DB = {
    getCredentials() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_CONFIG);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.url && parsed.key) return parsed;
        }
      } catch (e) {}

      if (window.STUDYPULSE_CONFIG && window.STUDYPULSE_CONFIG.SUPABASE_URL && window.STUDYPULSE_CONFIG.SUPABASE_ANON_KEY) {
        return {
          url: window.STUDYPULSE_CONFIG.SUPABASE_URL,
          key: window.STUDYPULSE_CONFIG.SUPABASE_ANON_KEY
        };
      }
      return null;
    },

    saveCredentials(url, key) {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify({ url: url.trim(), key: key.trim() }));
    },

    clearCredentials() {
      localStorage.removeItem(STORAGE_KEY_CONFIG);
      if (window.STUDYPULSE_CONFIG) {
        window.STUDYPULSE_CONFIG.SUPABASE_URL = "";
        window.STUDYPULSE_CONFIG.SUPABASE_ANON_KEY = "";
      }
    },

    async init() {
      const creds = DB.getCredentials();
      if (creds && window.supabase) {
        try {
          supabaseClient = window.supabase.createClient(creds.url, creds.key, {
            auth: { persistSession: true, autoRefreshToken: true }
          });
          isSupabaseConfigured = true;

          const { data: { session } } = await supabaseClient.auth.getSession();
          if (session && session.user) currentUser = session.user;

          supabaseClient.auth.onAuthStateChange((event, session) => {
            currentUser = session && session.user ? session.user : null;
            updateAuthUI();
            DB.loadAllData();
          });

          updateDBStatusUI('connected');
        } catch (err) {
          isSupabaseConfigured = false;
          updateDBStatusUI('error');
        }
      } else {
        isSupabaseConfigured = false;
        currentUser = null;
        updateDBStatusUI('local');
      }

      await DB.loadAllData();
    },

    async testConnection(url, key) {
      if (!window.supabase) return { success: false, error: 'Supabase client library not found' };
      try {
        const testClient = window.supabase.createClient(url.trim(), key.trim());
        const { error } = await testClient.from('goals').select('id', { count: 'exact', head: true });
        if (error && error.code !== '42P01' && error.message.includes('Invalid API key')) {
          return { success: false, error: 'Invalid API Key or URL' };
        }
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message || 'Connection failed' };
      }
    },

    async loadAllData() {
      if (isSupabaseConfigured && currentUser && supabaseClient) {
        try {
          // Categories
          const { data: catData } = await supabaseClient.from('categories').select('*').order('created_at', { ascending: true });
          if (catData && catData.length > 0) {
            const merged = [...DEFAULT_CATEGORIES];
            catData.forEach(c => {
              if (!merged.some(m => m.id === c.id)) {
                merged.push({ id: c.id, name: c.name, icon: c.icon, color: c.color, isDefault: false });
              }
            });
            categories = merged;
          } else {
            categories = [...DEFAULT_CATEGORIES];
          }

          // Goals
          const { data: goalData } = await supabaseClient
            .from('goals')
            .select('*, subtasks(*)')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });

          if (goalData) {
            goals = goalData.map(g => ({
              id: g.id,
              dateKey: g.date_key,
              title: g.title,
              categoryId: g.category_id,
              priority: g.priority,
              targetTime: g.target_time,
              durationMinutes: g.duration_minutes,
              notes: g.notes,
              completed: g.completed,
              completedAt: g.completed_at ? new Date(g.completed_at).getTime() : null,
              createdAt: g.created_at ? new Date(g.created_at).getTime() : Date.now(),
              subtasks: (g.subtasks || []).map(st => ({
                id: st.id,
                text: st.text,
                completed: st.completed
              }))
            }));
          }

          // Reflections
          const { data: refData } = await supabaseClient.from('daily_reflections').select('*').eq('user_id', currentUser.id);
          reflections = {};
          if (refData) refData.forEach(r => { reflections[r.date_key] = r.content; });

        } catch (e) {
          DB.loadLocalFallback();
        }
      } else {
        DB.loadLocalFallback();
      }

      // Load Deadlines from localStorage
      try {
        const storedDl = localStorage.getItem(STORAGE_KEY_DEADLINES);
        deadlines = storedDl ? JSON.parse(storedDl) : generateSampleDeadlines();
      } catch (e) {
        deadlines = generateSampleDeadlines();
      }

      refreshAllViews();
    },

    loadLocalFallback() {
      try {
        const storedCats = localStorage.getItem(STORAGE_KEY_LOCAL_CATS);
        categories = storedCats ? JSON.parse(storedCats) : [...DEFAULT_CATEGORIES];

        const storedGoals = localStorage.getItem(STORAGE_KEY_LOCAL_GOALS);
        goals = storedGoals ? JSON.parse(storedGoals) : [];

        const storedRefs = localStorage.getItem(STORAGE_KEY_LOCAL_REFLECTIONS);
        reflections = storedRefs ? JSON.parse(storedRefs) : {};
      } catch (e) {
        categories = [...DEFAULT_CATEGORIES];
        goals = [];
        reflections = {};
      }
    },

    saveLocalState() {
      try {
        localStorage.setItem(STORAGE_KEY_LOCAL_CATS, JSON.stringify(categories));
        localStorage.setItem(STORAGE_KEY_LOCAL_GOALS, JSON.stringify(goals));
        localStorage.setItem(STORAGE_KEY_LOCAL_REFLECTIONS, JSON.stringify(reflections));
        localStorage.setItem(STORAGE_KEY_DEADLINES, JSON.stringify(deadlines));
      } catch (e) {}
    },

    async saveGoal(goalData) {
      if (isSupabaseConfigured && currentUser && supabaseClient) {
        try {
          const isEdit = goals.some(g => g.id === goalData.id);
          const payload = {
            id: goalData.id,
            user_id: currentUser.id,
            date_key: goalData.dateKey,
            title: goalData.title,
            category_id: goalData.categoryId,
            priority: goalData.priority,
            target_time: goalData.targetTime || null,
            duration_minutes: goalData.durationMinutes || 30,
            notes: goalData.notes || '',
            completed: goalData.completed || false,
            completed_at: goalData.completedAt ? new Date(goalData.completedAt).toISOString() : null,
            updated_at: new Date().toISOString()
          };

          if (isEdit) {
            await supabaseClient.from('goals').update(payload).eq('id', goalData.id);
            await supabaseClient.from('subtasks').delete().eq('goal_id', goalData.id);
          } else {
            await supabaseClient.from('goals').insert(payload);
          }

          if (goalData.subtasks && goalData.subtasks.length > 0) {
            const subPayloads = goalData.subtasks.map(st => ({
              id: st.id,
              goal_id: goalData.id,
              user_id: currentUser.id,
              text: st.text,
              completed: st.completed
            }));
            await supabaseClient.from('subtasks').insert(subPayloads);
          }
        } catch (err) {
          showToast('Saved locally.', 'warning');
        }
      }

      const idx = goals.findIndex(g => g.id === goalData.id);
      if (idx >= 0) goals[idx] = goalData;
      else goals.unshift(goalData);
      DB.saveLocalState();
    },

    async toggleGoal(goalId) {
      const goal = goals.find(g => g.id === goalId);
      if (!goal) return;

      goal.completed = !goal.completed;
      goal.completedAt = goal.completed ? Date.now() : null;

      if (isSupabaseConfigured && currentUser && supabaseClient) {
        try {
          await supabaseClient
            .from('goals')
            .update({
              completed: goal.completed,
              completed_at: goal.completedAt ? new Date(goal.completedAt).toISOString() : null
            })
            .eq('id', goal.id);
        } catch (err) {}
      }

      DB.saveLocalState();
      return goal;
    },

    async toggleSubtask(goalId, subId) {
      const goal = goals.find(g => g.id === goalId);
      if (!goal || !goal.subtasks) return;

      const sub = goal.subtasks.find(s => s.id === subId);
      if (!sub) return;

      sub.completed = !sub.completed;
      const allDone = goal.subtasks.every(s => s.completed);
      if (allDone && !goal.completed) {
        goal.completed = true;
        goal.completedAt = Date.now();
      }

      if (isSupabaseConfigured && currentUser && supabaseClient) {
        try {
          await supabaseClient.from('subtasks').update({ completed: sub.completed }).eq('id', sub.id);
          if (goal.completed) {
            await supabaseClient.from('goals').update({ completed: true, completed_at: new Date(goal.completedAt).toISOString() }).eq('id', goal.id);
          }
        } catch (err) {}
      }

      DB.saveLocalState();
      return { goal, sub, allDone };
    },

    async deleteGoal(goalId) {
      if (isSupabaseConfigured && currentUser && supabaseClient) {
        try {
          await supabaseClient.from('goals').delete().eq('id', goalId);
        } catch (err) {}
      }
      goals = goals.filter(g => g.id !== goalId);
      DB.saveLocalState();
    },

    async saveReflection(dateKey, content) {
      reflections[dateKey] = content;
      DB.saveLocalState();

      if (isSupabaseConfigured && currentUser && supabaseClient) {
        try {
          await supabaseClient
            .from('daily_reflections')
            .upsert({
              id: `ref_${currentUser.id}_${dateKey}`,
              user_id: currentUser.id,
              date_key: dateKey,
              content: content,
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id, date_key' });
        } catch (err) {}
      }
    },

    async addCategory(cat) {
      categories.push(cat);
      DB.saveLocalState();
      if (isSupabaseConfigured && currentUser && supabaseClient) {
        try {
          await supabaseClient.from('categories').insert({
            id: cat.id,
            user_id: currentUser.id,
            name: cat.name,
            icon: cat.icon,
            color: cat.color,
            is_default: false
          });
        } catch (err) {}
      }
    },

    async deleteCategory(catId) {
      goals.forEach(g => { if (g.categoryId === catId) g.categoryId = 'academics'; });
      categories = categories.filter(c => c.id !== catId);
      DB.saveLocalState();
      if (isSupabaseConfigured && currentUser && supabaseClient) {
        try {
          await supabaseClient.from('categories').delete().eq('id', catId);
          await supabaseClient.from('goals').update({ category_id: 'academics' }).eq('category_id', catId);
        } catch (err) {}
      }
    },

    saveDeadline(dl) {
      deadlines.unshift(dl);
      DB.saveLocalState();
    },

    deleteDeadline(dlId) {
      deadlines = deadlines.filter(d => d.id !== dlId);
      DB.saveLocalState();
    }
  };

  function generateSampleDeadlines() {
    const d1 = new Date();
    d1.setDate(d1.getDate() + 5);
    const d2 = new Date();
    d2.setDate(d2.getDate() + 14);

    return [
      {
        id: 'dl_sample_1',
        title: 'Algorithms & Complexity Midterm Exam',
        subject: 'CS 302',
        type: 'exam',
        targetDate: formatDateKey(d1),
        targetTime: '10:00',
        notes: 'Covers Dynamic Programming, Graphs, and Greedy heuristics.'
      },
      {
        id: 'dl_sample_2',
        title: 'Database Architecture Project Submission',
        subject: 'CS 340',
        type: 'project',
        targetDate: formatDateKey(d2),
        targetTime: '23:59',
        notes: 'Submit GitHub repository and normalized schema PDF on Canvas.'
      }
    ];
  }

  // ==========================================
  // 4. Audio Synthesizer Engine (Web Audio)
  // ==========================================
  function initAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playTone(freq, duration, type = 'sine', gainVal = 0.15) {
    if (!isSoundEnabled) return;
    try {
      initAudioContext();
      if (!audioCtx) return;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  }

  function playCompleteChime() {
    if (!isSoundEnabled) return;
    setTimeout(() => playTone(523.25, 0.18, 'sine', 0.2), 0);
    setTimeout(() => playTone(659.25, 0.18, 'sine', 0.2), 120);
    setTimeout(() => playTone(783.99, 0.35, 'sine', 0.25), 240);
  }

  function playUncheckChime() {
    if (!isSoundEnabled) return;
    playTone(320, 0.12, 'triangle', 0.1);
  }

  function playPomoFinishBell() {
    if (!isSoundEnabled) return;
    [0, 250, 500].forEach(delay => {
      setTimeout(() => playTone(880, 0.4, 'sine', 0.3), delay);
    });
  }

  // Mindful Soundscapes Synthesizer
  function startSoundscape(type) {
    stopSoundscape();
    activeSoundscape = type;

    const statusEl = document.getElementById('soundscape-status-text');
    if (type === 'off') {
      if (statusEl) statusEl.textContent = 'Audio: Off';
      return;
    }

    try {
      initAudioContext();
      if (!audioCtx) return;

      if (statusEl) statusEl.textContent = `Playing: ${type.toUpperCase()}`;

      if (type === 'zen432') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.setValueAtTime(432, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        soundscapeNodes = osc;
        return;
      }

      const bufferSize = audioCtx.sampleRate * 2;
      const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const noise = audioCtx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;

      const filter = audioCtx.createBiquadFilter();
      const gain = audioCtx.createGain();

      if (type === 'rain') {
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.14, audioCtx.currentTime);
      } else if (type === 'ocean') {
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(320, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      } else if (type === 'breeze') {
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(700, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.09, audioCtx.currentTime);
      }

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);
      noise.start();
      soundscapeNodes = noise;
    } catch (e) {}
  }

  function stopSoundscape() {
    if (soundscapeNodes) {
      try {
        soundscapeNodes.stop();
        if (soundscapeNodes.disconnect) soundscapeNodes.disconnect();
      } catch (e) {}
      soundscapeNodes = null;
    }
  }

  // ==========================================
  // 5. Confetti Engine (Canvas)
  // ==========================================
  const confettiCanvas = document.getElementById('confetti-canvas');
  let confettiCtx = null;
  let confettiParticles = [];
  let confettiAnimationId = null;

  function resizeConfetti() {
    if (!confettiCanvas) return;
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeConfetti);
  resizeConfetti();

  function triggerConfettiBurst() {
    if (!confettiCanvas) return;
    if (!confettiCtx) confettiCtx = confettiCanvas.getContext('2d');

    const colors = ['#8B5CF6', '#06B6D4', '#10B981', '#EC4899', '#F59E0B', '#3B82F6', '#FFFFFF'];
    for (let i = 0; i < 120; i++) {
      confettiParticles.push({
        x: confettiCanvas.width / 2 + (Math.random() * 200 - 100),
        y: confettiCanvas.height / 3 + (Math.random() * 100 - 50),
        w: Math.random() * 9 + 5,
        h: Math.random() * 7 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 0.8) * 14,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 8,
        opacity: 1,
        life: 0.98
      });
    }
    if (!confettiAnimationId) updateConfetti();
  }

  function updateConfetti() {
    if (!confettiCtx) return;
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

    for (let i = confettiParticles.length - 1; i >= 0; i--) {
      const p = confettiParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35;
      p.rotation += p.rotationSpeed;
      p.opacity *= p.life;

      confettiCtx.save();
      confettiCtx.translate(p.x, p.y);
      confettiCtx.rotate((p.rotation * Math.PI) / 180);
      confettiCtx.fillStyle = p.color;
      confettiCtx.globalAlpha = Math.max(0, p.opacity);
      confettiCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      confettiCtx.restore();

      if (p.opacity < 0.05 || p.y > confettiCanvas.height) {
        confettiParticles.splice(i, 1);
      }
    }

    if (confettiParticles.length > 0) confettiAnimationId = requestAnimationFrame(updateConfetti);
    else {
      confettiAnimationId = null;
      confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    }
  }

  // ==========================================
  // 6. Toasts & Helper
  // ==========================================
  const toastContainer = document.getElementById('toast-container');

  function showToast(message, type = 'normal') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let icon = 'ℹ️';
    if (type === 'success') icon = '✨';
    if (type === 'warning') icon = '⚠️';
    if (type === 'danger') icon = '🛑';

    toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ==========================================
  // 7. Streak & Metrics Engine
  // ==========================================
  function calculateRealStreak() {
    const completedDates = new Set();
    goals.forEach(g => {
      if (g.completed && g.dateKey) completedDates.add(g.dateKey);
    });

    if (completedDates.size === 0) return { streak: 0, bestStreak: 0, totalCompleted: 0 };

    const todayStr = formatDateKey(new Date());
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatDateKey(yesterday);

    let currentStreak = 0;
    let checkDate = new Date();

    if (completedDates.has(todayStr)) {
      currentStreak = 1;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (completedDates.has(yesterdayStr)) {
      currentStreak = 1;
      checkDate.setDate(checkDate.getDate() - 2);
    }

    if (currentStreak > 0) {
      while (true) {
        const key = formatDateKey(checkDate);
        if (completedDates.has(key)) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else break;
      }
    }

    let maxStreak = 0;
    let tempStreak = 0;
    const sortedDays = Array.from(completedDates)
      .map(str => new Date(str + 'T00:00:00'))
      .sort((a, b) => a - b);

    for (let i = 0; i < sortedDays.length; i++) {
      if (i === 0) tempStreak = 1;
      else {
        const diffDays = Math.round((sortedDays[i] - sortedDays[i - 1]) / (1000 * 3600 * 24));
        if (diffDays === 1) tempStreak++;
        else if (diffDays > 1) tempStreak = 1;
      }
      if (tempStreak > maxStreak) maxStreak = tempStreak;
    }

    const totalCompleted = goals.filter(g => g.completed).length;
    return { streak: currentStreak, bestStreak: Math.max(maxStreak, currentStreak), totalCompleted };
  }

  // ==========================================
  // 8. Multi-Page Navigation Router
  // ==========================================
  function switchPage(pageId) {
    activePage = pageId;

    // Update nav tab buttons
    document.querySelectorAll('.page-nav-item').forEach(btn => {
      const isMatch = btn.dataset.page === pageId;
      btn.classList.toggle('active', isMatch);
      btn.setAttribute('aria-selected', isMatch);
    });

    // Update page view containers
    document.querySelectorAll('.page-view').forEach(view => {
      if (view.id === `page-${pageId}`) {
        view.classList.remove('hidden');
      } else {
        view.classList.add('hidden');
      }
    });

    // Update URL hash
    window.location.hash = pageId;

    // Trigger page-specific renders
    if (pageId === 'goals') {
      refreshAllViews();
    } else if (pageId === 'analytics') {
      renderAnalyticsPage();
    } else if (pageId === 'schedule') {
      renderDeadlinesPage();
    } else if (pageId === 'settings') {
      renderSettingsPage();
    }
  }

  // ==========================================
  // 9. "Me Time" Special Oasis & Mindful Menu
  // ==========================================
  const breathingOrb = document.getElementById('breathing-orb');
  const breathInstruction = document.getElementById('breath-instruction-text');
  const breathCountdown = document.getElementById('breath-countdown-timer');
  const btnStartBreathing = document.getElementById('btn-start-breathing');
  const btnResetBreathing = document.getElementById('btn-reset-breathing');

  const BOX_CYCLES = [
    { label: 'Inhale', duration: 4, cls: 'inhale', freq: 440 },
    { label: 'Hold', duration: 4, cls: 'hold', freq: 520 },
    { label: 'Exhale', duration: 4, cls: 'exhale', freq: 360 },
    { label: 'Hold', duration: 4, cls: 'hold', freq: 400 }
  ];

  const RELAX_CYCLES = [
    { label: 'Inhale', duration: 4, cls: 'inhale', freq: 440 },
    { label: 'Hold', duration: 7, cls: 'hold', freq: 520 },
    { label: 'Exhale', duration: 8, cls: 'exhale', freq: 340 }
  ];

  function startBreathing() {
    initAudioContext();
    breathIsRunning = true;
    btnStartBreathing.textContent = 'Pause';
    btnStartBreathing.classList.add('btn-secondary');
    btnStartBreathing.classList.remove('btn-primary');

    advanceBreathingPhase();
    breathInterval = setInterval(() => {
      if (breathSecondsRemaining > 1) {
        breathSecondsRemaining--;
        breathCountdown.textContent = breathSecondsRemaining;
      } else {
        breathPhaseIndex++;
        advanceBreathingPhase();
      }
    }, 1000);
  }

  function pauseBreathing() {
    breathIsRunning = false;
    clearInterval(breathInterval);
    breathInterval = null;
    btnStartBreathing.textContent = 'Resume';
    btnStartBreathing.classList.remove('btn-secondary');
    btnStartBreathing.classList.add('btn-primary');
  }

  function resetBreathing() {
    pauseBreathing();
    breathPhaseIndex = 0;
    breathSecondsRemaining = 4;
    breathingOrb.className = 'breathing-orb';
    breathInstruction.textContent = 'Ready';
    breathCountdown.textContent = '4';
    btnStartBreathing.textContent = 'Begin Breathwork';
  }

  function advanceBreathingPhase() {
    const cycles = breathMode === 'box' ? BOX_CYCLES : RELAX_CYCLES;
    const currentPhase = cycles[breathPhaseIndex % cycles.length];

    breathSecondsRemaining = currentPhase.duration;
    breathInstruction.textContent = currentPhase.label;
    breathCountdown.textContent = breathSecondsRemaining;

    breathingOrb.className = `breathing-orb ${currentPhase.cls}`;
    playTone(currentPhase.freq, 0.25, 'sine', 0.12);
  }

  // Academic Stress Dissolver / Worry Burner
  const worryTextInput = document.getElementById('worry-text-input');
  const btnBurnWorry = document.getElementById('btn-burn-worry');
  const worryAffirmation = document.getElementById('worry-release-affirmation');

  btnBurnWorry.addEventListener('click', () => {
    const val = worryTextInput.value.trim();
    if (!val) {
      showToast('Please type a study worry or fear to release.');
      return;
    }

    initAudioContext();
    playTone(280, 0.4, 'sawtooth', 0.1);
    worryTextInput.classList.add('burning');

    setTimeout(() => {
      worryTextInput.value = '';
      worryTextInput.classList.remove('burning');
      triggerConfettiBurst();

      const randAffirm = RELAXING_AFFIRMATIONS[Math.floor(Math.random() * RELAXING_AFFIRMATIONS.length)];
      worryAffirmation.innerHTML = `✨ <em>"${randAffirm}"</em>`;
      worryAffirmation.classList.remove('hidden');
      showToast('Worry dissolved & released. Breathe deeply.', 'success');
    }, 600);
  });

  // Soundscape buttons in Me Time
  document.querySelectorAll('.soundscape-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.soundscape-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const soundType = btn.dataset.sound;
      startSoundscape(soundType);
    });
  });

  // Mood selector in Me Time
  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mood = btn.dataset.mood;
      localStorage.setItem(STORAGE_KEY_MOOD, mood);
      showToast(`Mood noted: feeling ${btn.textContent.trim()}`);
    });
  });

  // Gratitude save
  document.getElementById('btn-save-gratitude').addEventListener('click', () => {
    const val = document.getElementById('gratitude-input-text').value.trim();
    if (val) {
      localStorage.setItem(STORAGE_KEY_GRATITUDE, val);
      showToast('Gratitude recorded! What we focus on grows.', 'success');
      playTone(660, 0.2, 'sine', 0.15);
    }
  });

  // Self care checklist reset
  document.getElementById('btn-reset-care-checklist').addEventListener('click', () => {
    document.querySelectorAll('.care-checkbox').forEach(cb => cb.checked = false);
    localStorage.removeItem(STORAGE_KEY_SELF_CARE);
    showToast('Checklist refreshed for today');
  });

  // Breathing controls
  btnStartBreathing.addEventListener('click', () => {
    breathIsRunning ? pauseBreathing() : startBreathing();
  });
  btnResetBreathing.addEventListener('click', resetBreathing);

  document.querySelectorAll('.breath-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.breath-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      breathMode = btn.dataset.mode;
      const desc = document.getElementById('breath-technique-desc');
      if (breathMode === 'box') {
        desc.textContent = 'Used by high performers to instantly lower cortisol, steady heart rate, and clear mental fog.';
      } else {
        desc.textContent = 'Deep parasympathetic nervous system activation. Perfect for releasing bedtime or pre-exam tension.';
      }
      resetBreathing();
    });
  });

  // ==========================================
  // 10. Analytics Page & 30-Day Activity Heatmap
  // ==========================================
  function renderAnalyticsPage() {
    const stats = calculateRealStreak();
    document.getElementById('analytics-total-completed').textContent = stats.totalCompleted;
    document.getElementById('analytics-current-streak').textContent = `${stats.streak} Days`;
    document.getElementById('analytics-best-streak').textContent = `${stats.bestStreak} Days`;

    // Top Category
    const catCounts = {};
    goals.filter(g => g.completed).forEach(g => {
      catCounts[g.categoryId] = (catCounts[g.categoryId] || 0) + 1;
    });

    let topCatId = null, maxCount = -1;
    for (const cid in catCounts) {
      if (catCounts[cid] > maxCount) {
        maxCount = catCounts[cid];
        topCatId = cid;
      }
    }
    const topCat = categories.find(c => c.id === topCatId);
    document.getElementById('analytics-top-category').textContent = topCat ? `${topCat.icon} ${topCat.name}` : 'None yet';

    // 30-Day Heatmap
    renderHeatmapMatrix();

    // 7-Day Bar Chart on page
    renderWeeklyPageChart();
  }

  function renderHeatmapMatrix() {
    const container = document.getElementById('heatmap-matrix-container');
    container.innerHTML = '';

    const thirtyDays = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      thirtyDays.push(d);
    }

    thirtyDays.forEach(d => {
      const key = formatDateKey(d);
      const dayGoals = goals.filter(g => g.dateKey === key);
      const done = dayGoals.filter(g => g.completed).length;

      let lvl = 0;
      if (done >= 5) lvl = 3;
      else if (done >= 3) lvl = 2;
      else if (done >= 1) lvl = 1;

      const cell = document.createElement('div');
      cell.className = `heatmap-cell lvl-${lvl}`;
      cell.title = `${getReadableDate(d)}: ${done} goals completed`;

      cell.addEventListener('click', () => {
        currentDate = new Date(d);
        switchPage('goals');
        showToast(`Jumped to ${getReadableDate(d)}`);
      });

      container.appendChild(cell);
    });
  }

  function renderWeeklyPageChart() {
    const container = document.getElementById('weekly-chart-page-container');
    container.innerHTML = '';

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d);
    }

    days.forEach(d => {
      const key = formatDateKey(d);
      const dayGoals = goals.filter(g => g.dateKey === key);
      const total = dayGoals.length;
      const done = dayGoals.filter(g => g.completed).length;
      const pct = total === 0 ? 0 : Math.round((done / total) * 100);

      const col = document.createElement('div');
      col.className = 'weekly-bar-col';
      col.innerHTML = `
        <div style="font-size:0.68rem; font-weight:700; color:var(--text-muted);">${pct}%</div>
        <div class="bar-tube-wrap" title="${getReadableDate(d)}: ${done}/${total} goals completed">
          <div class="bar-tube-fill" style="height: ${pct}%;"></div>
        </div>
        <span class="bar-day-name">${d.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
      `;
      container.appendChild(col);
    });
  }

  // ==========================================
  // 11. Exams & Deadlines Page
  // ==========================================
  const deadlineModal = document.getElementById('deadline-modal');
  const deadlineForm = document.getElementById('deadline-form');

  function renderDeadlinesPage() {
    const container = document.getElementById('deadlines-list-container');
    const emptyState = document.getElementById('deadlines-empty-state');
    container.innerHTML = '';

    if (deadlines.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    }
    emptyState.classList.add('hidden');

    deadlines.forEach(dl => {
      const targetTime = new Date(`${dl.targetDate}T${dl.targetTime || '00:00'}:00`).getTime();
      const now = Date.now();
      const diffMs = targetTime - now;

      let daysLeft = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      let hoursLeft = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      let isPast = diffMs < 0;

      const card = document.createElement('div');
      card.className = 'deadline-card';

      card.innerHTML = `
        <div class="deadline-top-row">
          <div>
            <span class="deadline-subject">${escapeHtml(dl.subject)}</span>
            <h3 class="deadline-title">${escapeHtml(dl.title)}</h3>
          </div>
          <span class="deadline-type-badge ${dl.type}">${dl.type}</span>
        </div>

        <div class="countdown-box">
          <div class="countdown-unit">
            <div class="count-num">${isPast ? '0' : Math.max(0, daysLeft)}</div>
            <div class="count-label">Days</div>
          </div>
          <div class="countdown-unit">
            <div class="count-num">${isPast ? '0' : Math.max(0, hoursLeft)}</div>
            <div class="count-label">Hours</div>
          </div>
          <div class="countdown-unit">
            <div class="count-num">${isPast ? 'Passed' : 'Pending'}</div>
            <div class="count-label">Status</div>
          </div>
        </div>

        ${dl.notes ? `<p style="font-size:0.8rem; color:var(--text-muted);">${escapeHtml(dl.notes)}</p>` : ''}

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.25rem;">
          <span style="font-size:0.75rem; color:var(--text-dim);">Due: ${dl.targetDate} at ${dl.targetTime || '09:00'}</span>
          <button class="icon-btn-ghost delete btn-del-dl" title="Delete Milestone">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;

      card.querySelector('.btn-del-dl').addEventListener('click', () => {
        if (confirm(`Remove milestone "${dl.title}"?`)) {
          DB.deleteDeadline(dl.id);
          renderDeadlinesPage();
          showToast('Milestone removed');
        }
      });

      container.appendChild(card);
    });
  }

  function openDeadlineModal() {
    deadlineForm.reset();
    document.getElementById('dl-date-input').value = formatDateKey(new Date());
    deadlineModal.classList.remove('hidden');
  }

  deadlineForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('dl-title-input').value.trim();
    const subject = document.getElementById('dl-subject-input').value.trim();
    const type = document.getElementById('dl-type-select').value;
    const targetDate = document.getElementById('dl-date-input').value;
    const targetTime = document.getElementById('dl-time-input').value;
    const notes = document.getElementById('dl-notes-input').value.trim();

    if (!title || !targetDate) return;

    DB.saveDeadline({
      id: 'dl_' + Date.now(),
      title,
      subject,
      type,
      targetDate,
      targetTime,
      notes
    });

    deadlineModal.classList.add('hidden');
    renderDeadlinesPage();
    showToast('Exam milestone countdown added!', 'success');
  });

  document.getElementById('btn-add-deadline-modal').addEventListener('click', openDeadlineModal);
  document.getElementById('btn-empty-add-deadline').addEventListener('click', openDeadlineModal);
  document.getElementById('btn-close-dl-modal').addEventListener('click', () => deadlineModal.classList.add('hidden'));
  document.getElementById('btn-cancel-dl-modal').addEventListener('click', () => deadlineModal.classList.add('hidden'));

  // ==========================================
  // 12. Settings Page
  // ==========================================
  function renderSettingsPage() {
    const creds = DB.getCredentials();
    if (creds) {
      document.getElementById('settings-supabase-url').value = creds.url;
      document.getElementById('settings-supabase-key').value = creds.key;
    }
  }

  document.getElementById('settings-db-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = document.getElementById('settings-supabase-url').value.trim();
    const key = document.getElementById('settings-supabase-key').value.trim();
    const feedback = document.getElementById('settings-db-feedback');

    feedback.className = 'conn-feedback info';
    feedback.textContent = '🔄 Testing connection to Supabase...';
    feedback.classList.remove('hidden');

    const result = await DB.testConnection(url, key);
    if (result.success) {
      DB.saveCredentials(url, key);
      feedback.className = 'conn-feedback success';
      feedback.textContent = '✅ Connected successfully! Supabase Cloud Database is active.';
      await DB.init();
      showToast('Supabase Cloud Database connected!', 'success');
    } else {
      feedback.className = 'conn-feedback error';
      feedback.textContent = `❌ Connection Error: ${result.error}`;
    }
  });

  document.getElementById('btn-settings-disconnect-db').addEventListener('click', () => {
    if (confirm('Disconnect Supabase and switch to Local Database mode?')) {
      DB.clearCredentials();
      document.getElementById('settings-supabase-url').value = '';
      document.getElementById('settings-supabase-key').value = '';
      DB.init();
      showToast('Switched to Local Database Mode', 'warning');
    }
  });

  document.getElementById('btn-settings-copy-sql').addEventListener('click', async () => {
    try {
      const response = await fetch('schema.sql');
      const text = await response.text();
      await navigator.clipboard.writeText(text);
      showToast('schema.sql copied to clipboard! Paste in Supabase SQL Editor.', 'success');
    } catch (err) {
      showToast('Open schema.sql file in workspace to copy SQL.', 'normal');
    }
  });

  document.getElementById('btn-settings-export').addEventListener('click', exportData);
  document.getElementById('btn-settings-import').addEventListener('click', () => document.getElementById('import-file-input').click());
  document.getElementById('btn-settings-load-sample').addEventListener('click', loadSampleStudentGoals);
  document.getElementById('btn-settings-clear-data').addEventListener('click', clearCurrentDayGoals);

  // ==========================================
  // 13. Goals Page Rendering
  // ==========================================
  function updateDBStatusUI(status) {
    const pill = document.getElementById('btn-db-status');
    const label = document.getElementById('db-status-label');
    const banner = document.getElementById('supabase-banner-notice');
    const modalBanner = document.getElementById('db-modal-status-banner');
    const connTitle = document.getElementById('db-conn-title');
    const connDesc = document.getElementById('db-conn-desc');

    pill.className = `db-status-pill status-${status}`;

    if (status === 'connected') {
      label.textContent = currentUser ? `Cloud: ${currentUser.email.split('@')[0]}` : 'Cloud DB';
      pill.title = `Supabase Connected (${currentUser ? currentUser.email : 'Cloud'})`;
      if (banner) banner.classList.add('hidden');
      if (connTitle) connTitle.textContent = '🟢 Connected to Supabase Cloud';
      if (connDesc) connDesc.textContent = `Cloud persistence active. User: ${currentUser ? currentUser.email : 'Authenticated'}`;
    } else if (status === 'connecting') {
      label.textContent = 'Connecting...';
    } else if (status === 'error') {
      label.textContent = 'DB Error';
      pill.title = 'Supabase connection error';
    } else {
      label.textContent = 'Local DB Mode';
      pill.title = 'Running in browser Local Database mode';
      const isDismissed = localStorage.getItem(STORAGE_KEY_BANNER_DISMISSED) === 'true';
      if (banner && !isDismissed) banner.classList.remove('hidden');
      if (connTitle) connTitle.textContent = '🟡 Local Database Mode';
      if (connDesc) connDesc.textContent = 'Goals are stored privately in your browser local storage.';
    }
  }

  function updateAuthUI() {
    const authBtn = document.getElementById('btn-auth-trigger');
    const authAvatar = document.getElementById('auth-avatar');
    const authLabel = document.getElementById('auth-label');

    if (currentUser) {
      const email = currentUser.email || 'Student';
      authAvatar.textContent = email.charAt(0).toUpperCase();
      authLabel.textContent = email.split('@')[0];
      authBtn.title = `Logged in as ${email}. Click to Sign Out.`;
    } else {
      authAvatar.textContent = '👤';
      authLabel.textContent = isSupabaseConfigured ? 'Sign In' : 'Account';
      authBtn.title = 'Sign In or Create Account with Supabase';
    }
  }

  function renderHeaderAndDates() {
    const currentDateTextEl = document.getElementById('current-date-text');
    const dayBadgeEl = document.getElementById('day-badge');
    const hiddenDateInput = document.getElementById('date-picker-hidden');

    const todayStr = formatDateKey(new Date());
    const selectedKey = formatDateKey(currentDate);

    currentDateTextEl.textContent = getReadableDate(currentDate);
    hiddenDateInput.value = selectedKey;

    if (selectedKey === todayStr) {
      dayBadgeEl.textContent = 'Today';
      dayBadgeEl.className = 'badge-today';
    } else {
      const today = new Date(todayStr + 'T00:00:00');
      const curr = new Date(selectedKey + 'T00:00:00');
      const diff = Math.round((curr - today) / (1000 * 3600 * 24));

      if (diff === -1) {
        dayBadgeEl.textContent = 'Yesterday';
        dayBadgeEl.className = 'badge-today badge-past';
      } else if (diff === 1) {
        dayBadgeEl.textContent = 'Tomorrow';
        dayBadgeEl.className = 'badge-today badge-future';
      } else if (diff < -1) {
        dayBadgeEl.textContent = `${Math.abs(diff)}d ago`;
        dayBadgeEl.className = 'badge-today badge-past';
      } else {
        dayBadgeEl.textContent = `In ${diff}d`;
        dayBadgeEl.className = 'badge-today badge-future';
      }
    }

    const streakStats = calculateRealStreak();
    document.getElementById('streak-val').textContent = streakStats.streak;
  }

  function renderHeroProgress() {
    const selectedKey = formatDateKey(currentDate);
    const dayGoals = goals.filter(g => g.dateKey === selectedKey);

    const total = dayGoals.length;
    const completed = dayGoals.filter(g => g.completed).length;
    const pending = total - completed;
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

    const circle = document.getElementById('progress-circle');
    const circumference = 2 * Math.PI * 42;
    const offset = circumference - (pct / 100) * circumference;
    circle.style.strokeDashoffset = offset;

    document.getElementById('progress-percentage').textContent = `${pct}%`;
    document.getElementById('progress-ratio').textContent = `${completed} of ${total} goals`;
    document.getElementById('stat-completed-num').textContent = completed;
    document.getElementById('stat-pending-num').textContent = pending;

    const chip = document.getElementById('daily-status-chip');
    if (total === 0) {
      chip.textContent = 'No Goals';
      chip.className = 'card-chip';
    } else if (completed === total) {
      chip.textContent = 'All Completed! 🌟';
      chip.className = 'card-chip completed';
    } else if (completed > 0) {
      chip.textContent = 'In Progress';
      chip.className = 'card-chip';
    } else {
      chip.textContent = 'To Do';
      chip.className = 'card-chip';
    }

    let completedMinutes = 0;
    dayGoals.forEach(g => {
      if (g.completed) completedMinutes += Number(g.durationMinutes || 0);
    });

    const hours = Math.floor(completedMinutes / 60);
    const mins = completedMinutes % 60;
    document.getElementById('stat-focus-time').textContent = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    renderCategoryBars(dayGoals);

    const reflectionInput = document.getElementById('daily-quick-note');
    if (reflectionInput) reflectionInput.value = reflections[selectedKey] || '';
  }

  function renderCategoryBars(dayGoals) {
    const container = document.getElementById('category-progress-bars');
    container.innerHTML = '';

    if (categories.length === 0) {
      container.innerHTML = '<div style="font-size:0.8rem;color:var(--text-muted);">No categories created.</div>';
      return;
    }

    categories.forEach(cat => {
      const catGoals = dayGoals.filter(g => g.categoryId === cat.id);
      const catTotal = catGoals.length;
      const catDone = catGoals.filter(g => g.completed).length;
      const pct = catTotal === 0 ? 0 : Math.round((catDone / catTotal) * 100);

      const barItem = document.createElement('div');
      barItem.className = 'cat-bar-item';
      barItem.innerHTML = `
        <div class="cat-bar-label-row">
          <span class="cat-bar-name">
            <span>${cat.icon}</span>
            <span>${escapeHtml(cat.name)}</span>
          </span>
          <span class="cat-bar-stats">${catDone}/${catTotal} (${pct}%)</span>
        </div>
        <div class="cat-bar-track">
          <div class="cat-bar-fill" style="width: ${pct}%; background: ${cat.color};"></div>
        </div>
      `;
      container.appendChild(barItem);
    });
  }

  function renderFilterPills() {
    const container = document.getElementById('category-filter-pills');
    const selectedKey = formatDateKey(currentDate);
    const dayGoals = goals.filter(g => g.dateKey === selectedKey);
    const activeCat = selectedCategoryFilter;

    container.innerHTML = `
      <button class="filter-pill ${activeCat === 'all' ? 'active' : ''}" data-category="all" role="tab" aria-selected="${activeCat === 'all'}">
        <span class="pill-icon">✨</span>
        <span class="pill-label">All Categories</span>
        <span class="pill-count" id="count-all">${dayGoals.length}</span>
      </button>
    `;

    categories.forEach(cat => {
      const catCount = dayGoals.filter(g => g.categoryId === cat.id).length;
      const isSelected = activeCat === cat.id;

      const pill = document.createElement('button');
      pill.className = `filter-pill ${isSelected ? 'active' : ''}`;
      pill.dataset.category = cat.id;
      pill.setAttribute('role', 'tab');
      pill.setAttribute('aria-selected', isSelected);
      if (isSelected) {
        pill.style.background = cat.color;
        pill.style.borderColor = cat.color;
      }

      pill.innerHTML = `
        <span class="pill-icon">${cat.icon}</span>
        <span class="pill-label">${escapeHtml(cat.name)}</span>
        <span class="pill-count">${catCount}</span>
      `;

      pill.addEventListener('click', () => {
        selectedCategoryFilter = cat.id;
        renderFilterPills();
        renderGoals();
      });

      container.appendChild(pill);
    });

    container.querySelector('[data-category="all"]').addEventListener('click', () => {
      selectedCategoryFilter = 'all';
      renderFilterPills();
      renderGoals();
    });
  }

  function filterDayGoals() {
    const selectedKey = formatDateKey(currentDate);
    let list = goals.filter(g => g.dateKey === selectedKey);

    if (selectedCategoryFilter !== 'all') list = list.filter(g => g.categoryId === selectedCategoryFilter);
    if (selectedStatusFilter === 'pending') list = list.filter(g => !g.completed);
    else if (selectedStatusFilter === 'completed') list = list.filter(g => g.completed);
    else if (selectedStatusFilter === 'high-priority') list = list.filter(g => g.priority === 'high');

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(g => {
        const titleMatch = g.title && g.title.toLowerCase().includes(q);
        const notesMatch = g.notes && g.notes.toLowerCase().includes(q);
        const cat = categories.find(c => c.id === g.categoryId);
        const catMatch = cat && cat.name.toLowerCase().includes(q);
        return titleMatch || notesMatch || catMatch;
      });
    }

    return list;
  }

  function renderGoals() {
    const filtered = filterDayGoals();
    const listViewContainer = document.getElementById('goals-list-view');
    const boardViewContainer = document.getElementById('goals-board-view');
    const emptyStateView = document.getElementById('empty-state-view');

    if (filtered.length === 0) {
      listViewContainer.classList.add('hidden');
      boardViewContainer.classList.add('hidden');
      emptyStateView.classList.remove('hidden');
      return;
    }

    emptyStateView.classList.add('hidden');

    if (currentViewMode === 'list') {
      boardViewContainer.classList.add('hidden');
      listViewContainer.classList.remove('hidden');
      renderListView(filtered, listViewContainer);
    } else {
      listViewContainer.classList.add('hidden');
      boardViewContainer.classList.remove('hidden');
      renderBoardView(filtered, boardViewContainer);
    }
  }

  function renderListView(filteredGoals, container) {
    container.innerHTML = '';
    const grouped = {};
    categories.forEach(c => { grouped[c.id] = []; });
    filteredGoals.forEach(g => {
      if (!grouped[g.categoryId]) grouped[g.categoryId] = [];
      grouped[g.categoryId].push(g);
    });

    categories.forEach(cat => {
      const catGoals = grouped[cat.id] || [];
      if (catGoals.length === 0) return;

      const groupBlock = document.createElement('div');
      groupBlock.className = 'category-group-block';
      groupBlock.style.setProperty('--group-color', cat.color);

      const completedCount = catGoals.filter(g => g.completed).length;

      groupBlock.innerHTML = `
        <div class="category-group-header">
          <div class="category-group-title">
            <span>${cat.icon}</span>
            <span>${escapeHtml(cat.name)}</span>
            <span class="category-badge-chip" style="background: ${cat.color};">${completedCount}/${catGoals.length} Done</span>
          </div>
          <span class="category-group-count">${catGoals.length} ${catGoals.length === 1 ? 'goal' : 'goals'}</span>
        </div>
        <div class="goals-grid" id="group-grid-${cat.id}"></div>
      `;

      const grid = groupBlock.querySelector(`#group-grid-${cat.id}`);
      catGoals.forEach(goal => grid.appendChild(createGoalCardElement(goal, cat)));
      container.appendChild(groupBlock);
    });
  }

  function renderBoardView(filteredGoals, container) {
    container.innerHTML = '';
    let catsToShow = categories;
    if (selectedCategoryFilter !== 'all') catsToShow = categories.filter(c => c.id === selectedCategoryFilter);

    catsToShow.forEach(cat => {
      const colGoals = filteredGoals.filter(g => g.categoryId === cat.id);
      const col = document.createElement('div');
      col.className = 'board-column';
      col.style.setProperty('--col-color', cat.color);

      col.innerHTML = `
        <div class="board-col-header">
          <span class="board-col-title">
            <span>${cat.icon}</span>
            <span>${escapeHtml(cat.name)}</span>
          </span>
          <span class="pill-count" style="background:${cat.color}; color:#fff;">${colGoals.length}</span>
        </div>
        <div class="board-col-cards" id="board-cards-${cat.id}"></div>
      `;

      const cardsContainer = col.querySelector(`#board-cards-${cat.id}`);
      if (colGoals.length === 0) {
        cardsContainer.innerHTML = '<div style="font-size:0.8rem;color:var(--text-dim);text-align:center;padding:2rem 0;">No goals in this category</div>';
      } else {
        colGoals.forEach(goal => cardsContainer.appendChild(createGoalCardElement(goal, cat)));
      }
      container.appendChild(col);
    });
  }

  function createGoalCardElement(goal, cat) {
    const card = document.createElement('div');
    card.className = `goal-card ${goal.completed ? 'is-completed' : ''}`;
    card.style.setProperty('--goal-accent', cat ? cat.color : 'var(--primary)');
    card.dataset.id = goal.id;

    const hasSubtasks = goal.subtasks && goal.subtasks.length > 0;
    const completedSubtasks = hasSubtasks ? goal.subtasks.filter(s => s.completed).length : 0;
    const totalSubtasks = hasSubtasks ? goal.subtasks.length : 0;

    let priorityClass = 'medium';
    let priorityText = 'Medium ⚡';
    if (goal.priority === 'high') { priorityClass = 'high'; priorityText = 'High 🔥'; }
    else if (goal.priority === 'low') { priorityClass = 'low'; priorityText = 'Low 🌱'; }

    card.innerHTML = `
      <div class="goal-card-top">
        <label class="custom-checkbox-wrap" title="${goal.completed ? 'Mark incomplete' : 'Mark complete'}">
          <input type="checkbox" class="goal-checkbox" ${goal.completed ? 'checked' : ''} aria-label="Toggle goal complete">
        </label>
        
        <div class="goal-main-info">
          <h3 class="goal-title">${escapeHtml(goal.title)}</h3>
          
          <div class="goal-tags-row">
            <span class="priority-tag ${priorityClass}">${priorityText}</span>
            ${goal.targetTime ? `<span class="time-tag">⏰ ${goal.targetTime}</span>` : ''}
            ${goal.durationMinutes ? `<span class="time-tag">⏱️ ${goal.durationMinutes}m</span>` : ''}
          </div>

          ${goal.notes ? `<p class="goal-notes">${escapeHtml(goal.notes)}</p>` : ''}
        </div>
      </div>

      ${hasSubtasks ? `
        <div class="goal-subtasks-section">
          <div class="subtasks-header-row">
            <span>Subtasks (${completedSubtasks}/${totalSubtasks})</span>
            <span>${totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0}%</span>
          </div>
          <div class="subtasks-items-list">
            ${goal.subtasks.map(st => `
              <label class="subtask-item">
                <input type="checkbox" class="subtask-checkbox" data-sub-id="${st.id}" ${st.completed ? 'checked' : ''}>
                <span class="subtask-text ${st.completed ? 'is-done' : ''}">${escapeHtml(st.text)}</span>
              </label>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="goal-card-actions">
        <button class="btn-pomo-trigger-sm" title="Start Focus Pomodoro session for this goal">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>Focus (25m)</span>
        </button>

        <div class="card-action-icons">
          <button class="icon-btn-ghost btn-edit-goal" title="Edit Goal" aria-label="Edit Goal">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
            </svg>
          </button>
          <button class="icon-btn-ghost delete btn-delete-goal" title="Delete Goal" aria-label="Delete Goal">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `;

    card.querySelector('.goal-checkbox').addEventListener('change', async (e) => {
      e.stopPropagation();
      const updated = await DB.toggleGoal(goal.id);
      if (updated.completed) {
        playCompleteChime();
        showToast(`Completed: "${updated.title}"`, 'success');
        const selectedKey = formatDateKey(currentDate);
        const dayGoals = goals.filter(g => g.dateKey === selectedKey);
        if (dayGoals.length > 0 && dayGoals.every(g => g.completed)) {
          setTimeout(() => {
            triggerConfettiBurst();
            showToast('🎉 All goals for today are completed!', 'success');
          }, 300);
        }
      } else {
        playUncheckChime();
      }
      refreshAllViews();
    });

    card.querySelectorAll('.subtask-checkbox').forEach(cb => {
      cb.addEventListener('change', async (e) => {
        e.stopPropagation();
        const res = await DB.toggleSubtask(goal.id, cb.dataset.subId);
        if (res) {
          playTone(res.sub.completed ? 600 : 400, 0.1, 'sine', 0.1);
          if (res.allDone && res.goal.completed) {
            playCompleteChime();
            showToast(`All subtasks finished: "${res.goal.title}"`, 'success');
          }
        }
        refreshAllViews();
      });
    });

    card.querySelector('.btn-pomo-trigger-sm').addEventListener('click', (e) => {
      e.stopPropagation();
      openPomodoroForGoal(goal);
    });

    card.querySelector('.btn-edit-goal').addEventListener('click', (e) => {
      e.stopPropagation();
      openEditGoalModal(goal);
    });

    card.querySelector('.btn-delete-goal').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`Delete "${goal.title}"?`)) {
        await DB.deleteGoal(goal.id);
        showToast('Goal deleted', 'warning');
        refreshAllViews();
      }
    });

    return card;
  }

  function refreshAllViews() {
    renderHeaderAndDates();
    renderHeroProgress();
    renderFilterPills();
    renderGoals();
  }

  // ==========================================
  // 14. Modals & Forms Logic
  // ==========================================
  const goalModal = document.getElementById('goal-modal');
  const goalForm = document.getElementById('goal-form');
  const subtasksBuilderList = document.getElementById('subtasks-builder-list');

  function openAddGoalModal() {
    initAudioContext();
    document.getElementById('modal-title').textContent = 'Add Daily Goal';
    document.getElementById('form-goal-id').value = '';
    goalForm.reset();
    populateCategorySelect();
    subtasksBuilderList.innerHTML = '';
    addSubtaskRow();
    goalModal.classList.remove('hidden');
    document.getElementById('goal-title-input').focus();
  }

  function openEditGoalModal(goal) {
    initAudioContext();
    document.getElementById('modal-title').textContent = 'Edit Daily Goal';
    document.getElementById('form-goal-id').value = goal.id;

    populateCategorySelect(goal.categoryId);
    document.getElementById('goal-title-input').value = goal.title;
    document.getElementById('goal-priority-select').value = goal.priority || 'medium';
    document.getElementById('goal-time-input').value = goal.targetTime || '';
    document.getElementById('goal-duration-input').value = goal.durationMinutes || 30;
    document.getElementById('goal-notes-input').value = goal.notes || '';

    subtasksBuilderList.innerHTML = '';
    if (goal.subtasks && goal.subtasks.length > 0) {
      goal.subtasks.forEach(st => addSubtaskRow(st.text, st.completed, st.id));
    } else {
      addSubtaskRow();
    }
    goalModal.classList.remove('hidden');
  }

  function closeGoalModal() {
    goalModal.classList.add('hidden');
  }

  function populateCategorySelect(selectedId = '') {
    const select = document.getElementById('goal-category-select');
    select.innerHTML = '';
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = `${cat.icon} ${cat.name}`;
      if (cat.id === selectedId || (!selectedId && cat.id === selectedCategoryFilter && selectedCategoryFilter !== 'all')) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });
  }

  function addSubtaskRow(text = '', completed = false, id = null) {
    const row = document.createElement('div');
    row.className = 'subtask-input-row';
    const subId = id || 'sub_' + Math.random().toString(36).substr(2, 9);

    row.innerHTML = `
      <input type="text" class="form-control subtask-text-input" placeholder="e.g. Read pages 10-25" value="${escapeHtml(text)}" maxlength="100">
      <button type="button" class="btn-remove-subtask" title="Remove subtask" aria-label="Remove subtask">✕</button>
    `;

    row.querySelector('.btn-remove-subtask').addEventListener('click', () => row.remove());
    row.dataset.subId = subId;
    row.dataset.completed = completed ? 'true' : 'false';
    subtasksBuilderList.appendChild(row);
  }

  goalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('form-goal-id').value;
    const title = document.getElementById('goal-title-input').value.trim();
    const categoryId = document.getElementById('goal-category-select').value;
    const priority = document.getElementById('goal-priority-select').value;
    const targetTime = document.getElementById('goal-time-input').value;
    const durationMinutes = parseInt(document.getElementById('goal-duration-input').value, 10) || 30;
    const notes = document.getElementById('goal-notes-input').value.trim();

    if (!title) return;

    const subtaskRows = subtasksBuilderList.querySelectorAll('.subtask-input-row');
    const subtasks = [];
    subtaskRows.forEach(row => {
      const input = row.querySelector('.subtask-text-input');
      const val = input.value.trim();
      if (val) {
        subtasks.push({
          id: row.dataset.subId || 'sub_' + Math.random().toString(36).substr(2, 9),
          text: val,
          completed: row.dataset.completed === 'true'
        });
      }
    });

    const selectedKey = formatDateKey(currentDate);

    const goalObj = {
      id: editId || 'goal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      dateKey: selectedKey,
      title,
      categoryId,
      priority,
      targetTime,
      durationMinutes,
      notes,
      subtasks,
      completed: editId ? (goals.find(g => g.id === editId)?.completed || false) : false,
      createdAt: editId ? (goals.find(g => g.id === editId)?.createdAt || Date.now()) : Date.now()
    };

    await DB.saveGoal(goalObj);
    showToast(editId ? 'Goal updated!' : 'Goal created!', 'success');
    closeGoalModal();
    refreshAllViews();
  });

  // DB Config Modal
  const dbConfigModal = document.getElementById('db-config-modal');
  const dbCredentialsForm = document.getElementById('db-credentials-form');
  const dbConnFeedback = document.getElementById('db-conn-feedback');
  const inputSupabaseUrl = document.getElementById('input-supabase-url');
  const inputSupabaseKey = document.getElementById('input-supabase-key');

  function openDbConfigModal() {
    const creds = DB.getCredentials();
    if (creds) {
      inputSupabaseUrl.value = creds.url;
      inputSupabaseKey.value = creds.key;
    }
    dbConnFeedback.classList.add('hidden');
    dbConfigModal.classList.remove('hidden');
  }

  dbCredentialsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = inputSupabaseUrl.value.trim();
    const key = inputSupabaseKey.value.trim();

    dbConnFeedback.className = 'conn-feedback info';
    dbConnFeedback.textContent = '🔄 Testing connection...';
    dbConnFeedback.classList.remove('hidden');

    const result = await DB.testConnection(url, key);
    if (result.success) {
      DB.saveCredentials(url, key);
      dbConnFeedback.className = 'conn-feedback success';
      dbConnFeedback.textContent = '✅ Connected successfully! Supabase Cloud Database is active.';
      await DB.init();
      showToast('Supabase Cloud Database connected!', 'success');
      setTimeout(() => dbConfigModal.classList.add('hidden'), 1200);
    } else {
      dbConnFeedback.className = 'conn-feedback error';
      dbConnFeedback.textContent = `❌ Connection Error: ${result.error}`;
    }
  });

  document.getElementById('btn-clear-db-credentials').addEventListener('click', () => {
    if (confirm('Disconnect Supabase and switch to Local Database mode?')) {
      DB.clearCredentials();
      inputSupabaseUrl.value = '';
      inputSupabaseKey.value = '';
      DB.init();
      showToast('Switched to Local Database Mode', 'warning');
      dbConfigModal.classList.add('hidden');
    }
  });

  document.getElementById('btn-copy-schema-sql').addEventListener('click', async () => {
    try {
      const response = await fetch('schema.sql');
      const text = await response.text();
      await navigator.clipboard.writeText(text);
      showToast('schema.sql copied to clipboard! Paste in Supabase SQL Editor.', 'success');
    } catch (err) {
      showToast('Open schema.sql file in workspace to copy SQL.', 'normal');
    }
  });

  // Auth Modal
  const authModal = document.getElementById('auth-modal');
  const authForm = document.getElementById('auth-form');
  const tabSignIn = document.getElementById('tab-sign-in');
  const tabSignUp = document.getElementById('tab-sign-up');
  const groupAuthName = document.getElementById('group-auth-name');
  const authFeedback = document.getElementById('auth-feedback');
  const btnAuthSubmit = document.getElementById('btn-auth-submit');
  const inputAuthEmail = document.getElementById('input-auth-email');
  const inputAuthPassword = document.getElementById('input-auth-password');
  const inputAuthName = document.getElementById('input-auth-name');
  let authMode = 'signIn';

  function openAuthModal() {
    if (currentUser) {
      if (confirm(`Logged in as ${currentUser.email}.\nDo you want to Sign Out?`)) {
        supabaseClient.auth.signOut().then(() => {
          currentUser = null;
          updateAuthUI();
          updateDBStatusUI('connected');
          DB.loadAllData();
          showToast('Signed out successfully');
        });
      }
      return;
    }

    if (!isSupabaseConfigured) {
      if (confirm('User accounts require a Supabase project. Would you like to configure your Supabase credentials now?')) {
        openDbConfigModal();
      }
      return;
    }

    authMode = 'signIn';
    tabSignIn.classList.add('active');
    tabSignUp.classList.remove('active');
    groupAuthName.classList.add('hidden');
    btnAuthSubmit.textContent = 'Sign In';
    authFeedback.classList.add('hidden');
    authForm.reset();
    authModal.classList.remove('hidden');
  }

  tabSignIn.addEventListener('click', () => {
    authMode = 'signIn';
    tabSignIn.classList.add('active');
    tabSignUp.classList.remove('active');
    groupAuthName.classList.add('hidden');
    btnAuthSubmit.textContent = 'Sign In';
    authFeedback.classList.add('hidden');
  });

  tabSignUp.addEventListener('click', () => {
    authMode = 'signUp';
    tabSignUp.classList.add('active');
    tabSignIn.classList.remove('active');
    groupAuthName.classList.remove('hidden');
    btnAuthSubmit.textContent = 'Create Account';
    authFeedback.classList.add('hidden');
  });

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!supabaseClient) return;

    const email = inputAuthEmail.value.trim();
    const password = inputAuthPassword.value.trim();
    const fullName = inputAuthName.value.trim();

    authFeedback.className = 'conn-feedback info';
    authFeedback.textContent = authMode === 'signIn' ? 'Authenticating...' : 'Creating student account...';
    authFeedback.classList.remove('hidden');

    try {
      if (authMode === 'signIn') {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        currentUser = data.user;
        showToast(`Welcome back, ${email}!`, 'success');
        authModal.classList.add('hidden');
      } else {
        const { data, error } = await supabaseClient.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } }
        });
        if (error) throw error;
        if (data.session) {
          currentUser = data.user;
          showToast('Account created and logged in!', 'success');
          authModal.classList.add('hidden');
        } else {
          authFeedback.className = 'conn-feedback success';
          authFeedback.textContent = 'Registration successful! If confirmation is required, check your email.';
        }
      }
      updateAuthUI();
      updateDBStatusUI('connected');
      await DB.loadAllData();
    } catch (err) {
      authFeedback.className = 'conn-feedback error';
      authFeedback.textContent = err.message || 'Authentication error occurred.';
    }
  });

  document.getElementById('btn-continue-guest').addEventListener('click', () => {
    authModal.classList.add('hidden');
    showToast('Continuing in Guest / Local Database mode');
  });

  // Pomodoro
  const pomodoroModal = document.getElementById('pomodoro-modal');
  const pomoClockEl = document.getElementById('pomo-clock');
  const pomoStartBtn = document.getElementById('btn-pomo-start');
  const pomoResetBtn = document.getElementById('btn-pomo-reset');
  const pomoStatusLabel = document.getElementById('pomo-status-label');
  const pomoGoalContext = document.getElementById('pomodoro-goal-context');
  const pomoDisplayCircle = document.querySelector('.pomo-timer-display');

  function openPomodoroModal() {
    initAudioContext();
    pomoGoalContext.textContent = 'Stay deeply focused without distractions.';
    pomoActiveGoal = null;
    pomodoroModal.classList.remove('hidden');
    updatePomoDisplay();
  }

  function openPomodoroForGoal(goal) {
    initAudioContext();
    pomoActiveGoal = goal;
    pomoGoalContext.textContent = `🎯 Focus Session for: "${goal.title}"`;
    pomodoroModal.classList.remove('hidden');
    setPomoMode('focus', 25);
  }

  function setPomoMode(mode, minutes) {
    pomoMode = mode;
    pomoTotalSeconds = minutes * 60;
    pomoSecondsLeft = pomoTotalSeconds;
    pausePomo();

    document.querySelectorAll('.pomo-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.mode === mode);
    });

    if (mode === 'focus') pomoStatusLabel.textContent = 'Ready to Focus';
    else if (mode === 'shortBreak') pomoStatusLabel.textContent = 'Short Recharge Break';
    else pomoStatusLabel.textContent = 'Long Rest & Hydrate';
    updatePomoDisplay();
  }

  function updatePomoDisplay() {
    const mins = Math.floor(pomoSecondsLeft / 60);
    const secs = pomoSecondsLeft % 60;
    pomoClockEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function startPomo() {
    if (pomoIsRunning) return;
    pomoIsRunning = true;
    pomoStartBtn.textContent = 'Pause';
    pomoStartBtn.classList.add('btn-secondary');
    pomoStartBtn.classList.remove('btn-primary');
    pomoDisplayCircle.classList.add('is-running');
    pomoStatusLabel.textContent = pomoMode === 'focus' ? 'Focus in Session...' : 'Break in Session...';

    pomoTimer = setInterval(() => {
      if (pomoSecondsLeft > 0) {
        pomoSecondsLeft--;
        updatePomoDisplay();
      } else {
        finishPomo();
      }
    }, 1000);
  }

  function pausePomo() {
    pomoIsRunning = false;
    clearInterval(pomoTimer);
    pomoTimer = null;
    pomoStartBtn.textContent = 'Start Focus';
    pomoStartBtn.classList.remove('btn-secondary');
    pomoStartBtn.classList.add('btn-primary');
    pomoDisplayCircle.classList.remove('is-running');
  }

  function resetPomo() {
    pausePomo();
    pomoSecondsLeft = pomoTotalSeconds;
    updatePomoDisplay();
    pomoStatusLabel.textContent = pomoMode === 'focus' ? 'Ready to Focus' : 'Break Ready';
  }

  function finishPomo() {
    pausePomo();
    playPomoFinishBell();
    triggerConfettiBurst();

    if (pomoMode === 'focus') {
      showToast('🎉 Focus session completed!', 'success');
      if (pomoActiveGoal) {
        if (confirm(`Mark "${pomoActiveGoal.title}" as completed?`)) {
          DB.toggleGoal(pomoActiveGoal.id).then(() => refreshAllViews());
        }
      }
      setPomoMode('shortBreak', 5);
    } else {
      showToast('Break finished! Ready to jump back in?');
      setPomoMode('focus', 25);
    }
  }

  pomoStartBtn.addEventListener('click', () => {
    initAudioContext();
    pomoIsRunning ? pausePomo() : startPomo();
  });
  pomoResetBtn.addEventListener('click', resetPomo);

  document.querySelectorAll('.pomo-tab').forEach(tab => {
    tab.addEventListener('click', () => setPomoMode(tab.dataset.mode, parseInt(tab.dataset.time, 10)));
  });

  // Category Manager Modal
  const categoryModal = document.getElementById('category-modal');
  const catManageList = document.getElementById('categories-manage-list');
  const addCategoryForm = document.getElementById('add-category-form');

  function openCategoryModal() {
    renderCategoryManageList();
    categoryModal.classList.remove('hidden');
  }

  function renderCategoryManageList() {
    catManageList.innerHTML = '';
    categories.forEach(cat => {
      const isDefault = DEFAULT_CATEGORIES.some(dc => dc.id === cat.id);
      const count = goals.filter(g => g.categoryId === cat.id).length;

      const row = document.createElement('div');
      row.className = 'cat-manage-row';
      row.innerHTML = `
        <div class="cat-manage-info">
          <div class="cat-color-dot" style="background: ${cat.color};"></div>
          <span>${cat.icon}</span>
          <span>${escapeHtml(cat.name)}</span>
          <span style="font-size:0.75rem; color:var(--text-muted);">(${count} goals)</span>
        </div>
        ${!isDefault ? `
          <button class="icon-btn-ghost delete btn-delete-cat" title="Delete Category" data-cat-id="${cat.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        ` : '<span style="font-size:0.72rem; color:var(--text-dim);">Built-in</span>'}
      `;

      if (!isDefault) {
        row.querySelector('.btn-delete-cat').addEventListener('click', async () => {
          if (confirm(`Delete category "${cat.name}"?`)) {
            await DB.deleteCategory(cat.id);
            renderCategoryManageList();
            refreshAllViews();
          }
        });
      }
      catManageList.appendChild(row);
    });
  }

  addCategoryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emoji = document.getElementById('new-cat-emoji').value.trim() || '📌';
    const name = document.getElementById('new-cat-name').value.trim();
    const color = document.getElementById('new-cat-color').value;

    if (!name) return;
    await DB.addCategory({ id: 'cat_' + Date.now(), name, icon: emoji, color, isDefault: false });
    addCategoryForm.reset();
    document.getElementById('new-cat-emoji').value = '🚀';
    showToast('New category created!', 'success');
    renderCategoryManageList();
    refreshAllViews();
  });

  // ==========================================
  // 15. Export / Import / Samples
  // ==========================================
  function exportData() {
    const exportObj = {
      app: 'StudyPulse',
      version: '3.0',
      exportedAt: new Date().toISOString(),
      user: currentUser ? currentUser.email : 'local',
      categories,
      goals,
      reflections,
      deadlines
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportObj, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `StudyPulse_Backup_${formatDateKey(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Data exported successfully!', 'success');
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (parsed.goals && Array.isArray(parsed.goals)) {
          goals = parsed.goals;
          if (parsed.categories) categories = parsed.categories;
          if (parsed.reflections) reflections = parsed.reflections;
          if (parsed.deadlines) deadlines = parsed.deadlines;
          DB.saveLocalState();
          showToast('Data imported successfully!', 'success');
          refreshAllViews();
        } else alert('Invalid JSON structure.');
      } catch (err) { alert('Failed to parse backup JSON file.'); }
    };
    reader.readAsText(file);
  }

  async function loadSampleStudentGoals() {
    const todayKey = formatDateKey(currentDate);
    const yest = new Date(currentDate);
    yest.setDate(yest.getDate() - 1);
    const yestKey = formatDateKey(yest);

    const samples = [
      {
        id: 'sample_' + Date.now() + '_1',
        dateKey: todayKey,
        title: 'Revise Operating Systems: Process Scheduling & Deadlocks',
        categoryId: 'academics',
        priority: 'high',
        targetTime: '11:00',
        durationMinutes: 60,
        subtasks: [
          { id: 'sub_s1', text: 'Read Chapter 4 slides (pages 1-35)', completed: true },
          { id: 'sub_s2', text: 'Solve Banker Algorithm practice questions', completed: false }
        ],
        notes: 'Final exam revision milestone.',
        completed: false,
        createdAt: Date.now() - 3600000 * 3
      },
      {
        id: 'sample_' + Date.now() + '_2',
        dateKey: todayKey,
        title: 'Solve 2 LeetCode Mediums on Binary Search Trees',
        categoryId: 'coding',
        priority: 'high',
        targetTime: '15:30',
        durationMinutes: 45,
        subtasks: [
          { id: 'sub_s3', text: 'Problem 98: Validate BST', completed: true },
          { id: 'sub_s4', text: 'Problem 230: Kth Smallest Element in BST', completed: true }
        ],
        notes: 'Recursive and iterative depth-first search.',
        completed: true,
        completedAt: Date.now() - 3600000,
        createdAt: Date.now() - 3600000 * 4
      },
      {
        id: 'sample_' + Date.now() + '_3',
        dateKey: todayKey,
        title: '30-minute Evening Cardio & Core Workout',
        categoryId: 'health',
        priority: 'medium',
        targetTime: '18:00',
        durationMinutes: 30,
        subtasks: [],
        notes: 'Stay hydrated!',
        completed: false,
        createdAt: Date.now() - 3600000 * 2
      },
      {
        id: 'sample_' + Date.now() + '_4',
        dateKey: yestKey,
        title: 'Calculus III Problem Set 4',
        categoryId: 'academics',
        priority: 'high',
        targetTime: '16:00',
        durationMinutes: 60,
        subtasks: [],
        notes: 'Completed all 10 problems.',
        completed: true,
        completedAt: Date.now() - 86400000,
        createdAt: Date.now() - 90000000
      }
    ];

    for (const s of samples) await DB.saveGoal(s);
    showToast('Loaded realistic student goals!', 'success');
    refreshAllViews();
  }

  async function clearCurrentDayGoals() {
    const selectedKey = formatDateKey(currentDate);
    const dayGoals = goals.filter(g => g.dateKey === selectedKey);
    if (dayGoals.length === 0) return showToast('No goals to clear for this date');

    if (confirm(`Delete all ${dayGoals.length} goals for ${getReadableDate(currentDate)}?`)) {
      for (const g of dayGoals) await DB.deleteGoal(g.id);
      showToast('Cleared goals for this date', 'warning');
      refreshAllViews();
    }
  }

  function shuffleQuote() {
    const rand = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
    document.getElementById('quote-text').textContent = `"${rand.quote}"`;
    document.getElementById('quote-author').textContent = `— ${rand.author}`;
  }

  function setTheme(theme) {
    if (theme === 'light') {
      document.body.classList.remove('theme-dark');
      document.body.classList.add('theme-light');
      document.getElementById('theme-icon').textContent = '☀️';
      localStorage.setItem(STORAGE_KEY_THEME, 'light');
    } else {
      document.body.classList.remove('theme-light');
      document.body.classList.add('theme-dark');
      document.getElementById('theme-icon').textContent = '🌙';
      localStorage.setItem(STORAGE_KEY_THEME, 'dark');
    }
  }

  // ==========================================
  // 16. Event Listeners
  // ==========================================
  function bindEvents() {
    // Multi-page navigation tabs
    document.querySelectorAll('.page-nav-item').forEach(btn => {
      btn.addEventListener('click', () => switchPage(btn.dataset.page));
    });

    // Date navigator
    document.getElementById('btn-prev-day').addEventListener('click', () => {
      currentDate.setDate(currentDate.getDate() - 1);
      refreshAllViews();
    });
    document.getElementById('btn-next-day').addEventListener('click', () => {
      currentDate.setDate(currentDate.getDate() + 1);
      refreshAllViews();
    });
    document.getElementById('btn-today-jump').addEventListener('click', () => {
      currentDate = new Date();
      refreshAllViews();
    });

    const datePickerWrapper = document.getElementById('date-display-wrapper');
    const hiddenDateInput = document.getElementById('date-picker-hidden');
    datePickerWrapper.addEventListener('click', () => {
      hiddenDateInput.showPicker ? hiddenDateInput.showPicker() : hiddenDateInput.click();
    });
    hiddenDateInput.addEventListener('change', (e) => {
      if (e.target.value) {
        const parts = e.target.value.split('-');
        currentDate = new Date(parts[0], parts[1] - 1, parts[2]);
        refreshAllViews();
      }
    });

    // Header buttons
    document.getElementById('btn-db-status').addEventListener('click', openDbConfigModal);
    document.getElementById('btn-auth-trigger').addEventListener('click', openAuthModal);
    document.getElementById('btn-open-pomodoro').addEventListener('click', openPomodoroModal);
    document.getElementById('btn-open-add-modal').addEventListener('click', openAddGoalModal);
    document.getElementById('btn-empty-add-goal').addEventListener('click', openAddGoalModal);
    document.getElementById('btn-empty-load-sample').addEventListener('click', loadSampleStudentGoals);

    // Theme & Sound
    document.getElementById('btn-theme-toggle').addEventListener('click', () => {
      const isLight = document.body.classList.contains('theme-light');
      setTheme(isLight ? 'dark' : 'light');
      showToast(`Switched to ${isLight ? 'Dark' : 'Light'} Mode`);
    });
    document.getElementById('btn-sound-toggle').addEventListener('click', () => {
      isSoundEnabled = !isSoundEnabled;
      localStorage.setItem(STORAGE_KEY_SOUND, JSON.stringify(isSoundEnabled));
      document.getElementById('sound-icon').textContent = isSoundEnabled ? '🔊' : '🔇';
      showToast(`Sound ${isSoundEnabled ? 'Enabled 🔊' : 'Muted 🔇'}`);
      if (isSoundEnabled) playTone(500, 0.1, 'sine', 0.1);
    });

    // Reflection & Quote
    document.getElementById('btn-save-note').addEventListener('click', async () => {
      const text = document.getElementById('daily-quick-note').value.trim();
      await DB.saveReflection(formatDateKey(currentDate), text);
      showToast('Reflection saved!', 'success');
    });
    document.getElementById('btn-refresh-quote').addEventListener('click', shuffleQuote);

    // Search & Filters
    const searchInput = document.getElementById('search-goals-input');
    const clearSearchBtn = document.getElementById('btn-clear-search');
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      clearSearchBtn.classList.toggle('sr-only', !searchQuery);
      renderGoals();
    });
    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      clearSearchBtn.classList.add('sr-only');
      renderGoals();
    });

    document.getElementById('status-filter-select').addEventListener('change', (e) => {
      selectedStatusFilter = e.target.value;
      renderGoals();
    });

    // View toggles
    const btnViewList = document.getElementById('btn-view-list');
    const btnViewBoard = document.getElementById('btn-view-board');
    btnViewList.addEventListener('click', () => {
      currentViewMode = 'list';
      btnViewList.classList.add('active');
      btnViewBoard.classList.remove('active');
      renderGoals();
    });
    btnViewBoard.addEventListener('click', () => {
      currentViewMode = 'board';
      btnViewBoard.classList.add('active');
      btnViewList.classList.remove('active');
      renderGoals();
    });

    // More options menu
    const btnMoreOptions = document.getElementById('btn-more-options');
    const moreMenu = document.getElementById('more-options-menu');
    btnMoreOptions.addEventListener('click', (e) => {
      e.stopPropagation();
      moreMenu.classList.toggle('hidden');
    });
    document.addEventListener('click', () => {
      if (!moreMenu.classList.contains('hidden')) moreMenu.classList.add('hidden');
    });

    document.getElementById('btn-menu-db-config').addEventListener('click', openDbConfigModal);
    document.getElementById('btn-menu-load-sample').addEventListener('click', loadSampleStudentGoals);
    document.getElementById('btn-menu-export-data').addEventListener('click', exportData);
    document.getElementById('btn-menu-clear-all').addEventListener('click', clearCurrentDayGoals);

    const importFileInput = document.getElementById('import-file-input');
    document.getElementById('btn-menu-import-data').addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) importData(e.target.files[0]);
    });

    // Banner setup
    const bannerSetupBtn = document.getElementById('btn-banner-setup');
    if (bannerSetupBtn) bannerSetupBtn.addEventListener('click', openDbConfigModal);
    const bannerDismissBtn = document.getElementById('btn-banner-dismiss');
    if (bannerDismissBtn) {
      bannerDismissBtn.addEventListener('click', () => {
        document.getElementById('supabase-banner-notice').classList.add('hidden');
        localStorage.setItem(STORAGE_KEY_BANNER_DISMISSED, 'true');
      });
    }

    // Modal closers
    document.getElementById('btn-close-db-modal').addEventListener('click', () => dbConfigModal.classList.add('hidden'));
    document.getElementById('btn-close-auth-modal').addEventListener('click', () => authModal.classList.add('hidden'));
    document.getElementById('btn-close-modal').addEventListener('click', closeGoalModal);
    document.getElementById('btn-cancel-modal').addEventListener('click', closeGoalModal);
    document.getElementById('btn-add-subtask-row').addEventListener('click', () => addSubtaskRow());
    document.getElementById('btn-manage-categories').addEventListener('click', openCategoryModal);
    document.getElementById('btn-close-cat-modal').addEventListener('click', () => categoryModal.classList.add('hidden'));
    document.getElementById('btn-close-pomodoro').addEventListener('click', () => {
      pomodoroModal.classList.add('hidden');
      if (ambientNode) stopAmbientNoise();
    });

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      const targetTag = e.target.tagName.toLowerCase();
      const isInput = targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select';

      if (e.key === 'Escape') {
        closeGoalModal();
        pomodoroModal.classList.add('hidden');
        categoryModal.classList.add('hidden');
        dbConfigModal.classList.add('hidden');
        authModal.classList.add('hidden');
        deadlineModal.classList.add('hidden');
        stopSoundscape();
        pauseBreathing();
      }

      if (!isInput) {
        if (e.key.toLowerCase() === 'n') {
          e.preventDefault();
          openAddGoalModal();
        } else if (e.key.toLowerCase() === 'p') {
          e.preventDefault();
          openPomodoroModal();
        } else if (e.key.toLowerCase() === 'm') {
          e.preventDefault();
          switchPage('metime');
        }
      }
    });

    // Listen to hash changes
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '');
      if (['goals', 'metime', 'analytics', 'schedule', 'settings'].includes(hash)) {
        switchPage(hash);
      }
    });
  }

  // ==========================================
  // 17. App Initialization
  // ==========================================
  async function init() {
    const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) || 'dark';
    setTheme(savedTheme);

    const savedSound = localStorage.getItem(STORAGE_KEY_SOUND);
    isSoundEnabled = savedSound !== null ? JSON.parse(savedSound) : true;
    document.getElementById('sound-icon').textContent = isSoundEnabled ? '🔊' : '🔇';

    bindEvents();
    shuffleQuote();

    await DB.init();

    // Check URL hash for initial page
    const initialHash = window.location.hash.replace('#', '');
    if (['goals', 'metime', 'analytics', 'schedule', 'settings'].includes(initialHash)) {
      switchPage(initialHash);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
