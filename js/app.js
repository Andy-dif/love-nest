/* ============================================
   恋爱小窝 - Love Nest
   李安 ❤️ 韩舒薇
   Interactive Virtual Pet Application
   ============================================ */

// ============================================
// CONFIGURATION
// ============================================

// Supabase Configuration - REPLACE with your own Supabase project credentials
// 1. Go to https://supabase.com and create a free account
// 2. Create a new project
// 3. Go to Settings -> API to find your URL and anon key
// 4. Paste them below:
const SUPABASE_CONFIG = {
    url: 'YOUR_SUPABASE_URL',        // e.g. 'https://xxxxx.supabase.co'
    anonKey: 'YOUR_SUPABASE_ANON_KEY' // e.g. 'eyJhbGciOiJIUzI1NiIs...'
};

// If you haven't configured Supabase, the app works in LOCAL MODE
// (data saved in browser, no sync between devices)
const USE_SUPABASE = SUPABASE_CONFIG.url !== 'YOUR_SUPABASE_URL';

// ============================================
// SUPABASE CLIENT
// ============================================
let supabase = null;
let supabaseChannel = null;

if (USE_SUPABASE) {
    try {
        supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    } catch (e) {
        console.warn('Supabase init failed, using local mode:', e.message);
    }
}

// ============================================
// PET STATE
// ============================================
const DEFAULT_PET = {
    name: '小团子',
    hunger: 100,
    happiness: 100,
    energy: 100,
    evolutionStage: 1,
    lastFedAt: null,
    lastPlayedAt: null,
    lastSleptAt: null,
    lastLovedAt: null,
    updatedAt: Date.now(),
    updatedBy: ''
};

// ============================================
// APP STATE
// ============================================
let appState = {
    pet: { ...DEFAULT_PET },
    identity: '李安',          // Who is using the app right now
    notes: [],                 // Love notes
    activityLog: [],           // Activity log entries
    anniversary: '2024-01-01', // Default anniversary date
    lastDecayCheck: Date.now(),
    cooldowns: {               // Cooldown timers for actions (ms)
        feed: 0,
        play: 0,
        sleep: 0,
        love: 0
    }
};

// Cooldown durations in milliseconds
const COOLDOWNS = {
    feed: 30000,    // 30 seconds
    play: 45000,    // 45 seconds
    sleep: 60000,   // 60 seconds
    love: 20000     // 20 seconds
};

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    loadLocalState();

    if (USE_SUPABASE && supabase) {
        await loadSupabaseState();
        subscribeToChanges();
    }

    updateAllUI();
    startDecayTimer();
    startHeartAnimation();
    startCooldownTimers();

    // Check URL hash for identity
    const hash = window.location.hash.slice(1);
    if (hash === 'han' || hash === '韩舒薇') {
        setIdentity('韩舒薇');
    } else if (hash === 'li' || hash === '李安') {
        setIdentity('李安');
    }

    showToast('💕 欢迎来到我们的小窝！');
    petSay('快来照顾我吧~');

    // Update online status
    updateOnlineStatus(true);

    // Notify others via BroadcastChannel (for same-device tabs)
    setupBroadcastChannel();
}

// ============================================
// LOCAL STORAGE
// ============================================
function loadLocalState() {
    try {
        const saved = localStorage.getItem('loveNestState');
        if (saved) {
            const parsed = JSON.parse(saved);
            // Merge with defaults to handle new fields
            appState.pet = { ...DEFAULT_PET, ...parsed.pet };
            appState.notes = parsed.notes || [];
            appState.activityLog = parsed.activityLog || [];
            appState.anniversary = parsed.anniversary || '2024-01-01';
            appState.identity = parsed.identity || '李安';
            appState.cooldowns = parsed.cooldowns || appState.cooldowns;

            // Apply time-based decay
            applyDecay();
        }
    } catch (e) {
        console.warn('Failed to load local state:', e);
    }
}

function saveLocalState() {
    try {
        const toSave = {
            pet: appState.pet,
            notes: appState.notes.slice(-50),  // Keep last 50 notes
            activityLog: appState.activityLog.slice(-100),  // Keep last 100 entries
            anniversary: appState.anniversary,
            identity: appState.identity,
            cooldowns: appState.cooldowns
        };
        localStorage.setItem('loveNestState', JSON.stringify(toSave));
    } catch (e) {
        console.warn('Failed to save local state:', e);
    }
}

// ============================================
// SUPABASE INTEGRATION
// ============================================
async function loadSupabaseState() {
    if (!supabase) return;

    try {
        // Load pet state
        const { data: petData, error: petError } = await supabase
            .from('pet_state')
            .select('*')
            .eq('id', 1)
            .single();

        if (petData && !petError) {
            appState.pet = {
                name: petData.name || DEFAULT_PET.name,
                hunger: petData.hunger,
                happiness: petData.happiness,
                energy: petData.energy,
                evolutionStage: petData.evolution_stage || 1,
                updatedAt: new Date(petData.updated_at).getTime(),
                updatedBy: petData.updated_by || '',
                lastFedAt: petData.last_fed_at,
                lastPlayedAt: petData.last_played_at,
                lastSleptAt: petData.last_slept_at,
                lastLovedAt: petData.last_loved_at,
            };
            applyDecay();
        }

        // Load notes
        const { data: notesData } = await supabase
            .from('love_notes')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (notesData) {
            appState.notes = notesData.map(n => ({
                id: n.id,
                author: n.author,
                text: n.text,
                createdAt: new Date(n.created_at).getTime()
            }));
        }

        // Load activity log
        const { data: logData } = await supabase
            .from('activity_log')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (logData) {
            appState.activityLog = logData.map(l => ({
                id: l.id,
                action: l.action,
                actor: l.actor,
                message: l.message,
                createdAt: new Date(l.created_at).getTime()
            }));
        }

        // Load settings
        const { data: settingsData } = await supabase
            .from('settings')
            .select('*')
            .eq('id', 1)
            .single();

        if (settingsData) {
            appState.anniversary = settingsData.anniversary || appState.anniversary;
        }

        updateAllUI();
        saveLocalState();
    } catch (e) {
        console.warn('Supabase load failed, using local data:', e.message);
    }
}

async function savePetToSupabase() {
    if (!supabase) return;
    try {
        await supabase
            .from('pet_state')
            .upsert({
                id: 1,
                name: appState.pet.name,
                hunger: appState.pet.hunger,
                happiness: appState.pet.happiness,
                energy: appState.pet.energy,
                evolution_stage: appState.pet.evolutionStage,
                last_fed_at: appState.pet.lastFedAt,
                last_played_at: appState.pet.lastPlayedAt,
                last_slept_at: appState.pet.lastSleptAt,
                last_loved_at: appState.pet.lastLovedAt,
                updated_at: new Date().toISOString(),
                updated_by: appState.pet.updatedBy
            });
    } catch (e) {
        console.warn('Supabase save pet failed:', e.message);
    }
}

async function saveNoteToSupabase(note) {
    if (!supabase) return;
    try {
        await supabase
            .from('love_notes')
            .insert({
                author: note.author,
                text: note.text,
                created_at: new Date(note.createdAt).toISOString()
            });
    } catch (e) {
        console.warn('Supabase save note failed:', e.message);
    }
}

async function saveLogToSupabase(entry) {
    if (!supabase) return;
    try {
        await supabase
            .from('activity_log')
            .insert({
                action: entry.action,
                actor: entry.actor,
                message: entry.message,
                created_at: new Date(entry.createdAt).toISOString()
            });
    } catch (e) {
        console.warn('Supabase save log failed:', e.message);
    }
}

async function saveSettingsToSupabase() {
    if (!supabase) return;
    try {
        await supabase
            .from('settings')
            .upsert({
                id: 1,
                anniversary: appState.anniversary,
                updated_at: new Date().toISOString()
            });
    } catch (e) {
        console.warn('Supabase save settings failed:', e.message);
    }
}

function subscribeToChanges() {
    if (!supabase) return;

    // Subscribe to pet state changes
    supabaseChannel = supabase
        .channel('love-nest-changes')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'pet_state' },
            (payload) => {
                const newData = payload.new;
                if (newData && newData.updated_by !== appState.identity) {
                    // Another user made a change
                    appState.pet.hunger = newData.hunger;
                    appState.pet.happiness = newData.happiness;
                    appState.pet.energy = newData.energy;
                    appState.pet.evolutionStage = newData.evolution_stage;
                    appState.pet.updatedBy = newData.updated_by;
                    appState.pet.name = newData.name;
                    appState.pet.updatedAt = new Date(newData.updated_at).getTime();
                    updateAllUI();
                    saveLocalState();
                    petSay(`${newData.updated_by}刚刚照顾了我~`);
                    updateOnlineStatus(true);
                }
            }
        )
        .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'love_notes' },
            (payload) => {
                const note = payload.new;
                if (note.author !== appState.identity) {
                    appState.notes.unshift({
                        id: note.id,
                        author: note.author,
                        text: note.text,
                        createdAt: new Date(note.created_at).getTime()
                    });
                    renderNotes();
                    showToast(`💌 ${note.author}写了一张小纸条！`);
                }
            }
        )
        .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'activity_log' },
            (payload) => {
                const entry = payload.new;
                if (entry.actor !== appState.identity) {
                    appState.activityLog.unshift({
                        id: entry.id,
                        action: entry.action,
                        actor: entry.actor,
                        message: entry.message,
                        createdAt: new Date(entry.created_at).getTime()
                    });
                    renderActivityLog();
                }
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('🔗 Real-time sync connected!');
                updateOnlineStatus(true);
            }
        });
}

// ============================================
// BROADCAST CHANNEL (Same-device cross-tab sync)
// ============================================
let bc = null;

function setupBroadcastChannel() {
    try {
        bc = new BroadcastChannel('love-nest');
        bc.onmessage = (event) => {
            const { type, data } = event.data;
            if (type === 'petUpdate' && data.updatedBy !== appState.identity) {
                appState.pet = { ...appState.pet, ...data };
                updateAllUI();
                saveLocalState();
                petSay(`${data.updatedBy}刚刚照顾了我~`);
            } else if (type === 'note' && data.author !== appState.identity) {
                appState.notes.unshift(data);
                renderNotes();
                showToast(`💌 ${data.author}写了一张小纸条！`);
            } else if (type === 'log' && data.actor !== appState.identity) {
                appState.activityLog.unshift(data);
                renderActivityLog();
            }
        };
    } catch (e) {
        // BroadcastChannel not supported
    }
}

function broadcastUpdate(type, data) {
    if (bc) {
        try {
            bc.postMessage({ type, data });
        } catch (e) {}
    }
}

// ============================================
// PET LOGIC
// ============================================

// Stats decay rates per minute
const DECAY_RATES = {
    hunger: 0.35,    // ~4.7 hours from 100 to 0
    happiness: 0.22, // ~7.5 hours
    energy: 0.18     // ~9.2 hours
};

function applyDecay() {
    const now = Date.now();
    const lastCheck = appState.lastDecayCheck || appState.pet.updatedAt || now;
    const minutesElapsed = (now - lastCheck) / 60000;

    if (minutesElapsed > 0.1) { // Only decay if more than 6 seconds passed
        appState.pet.hunger = Math.max(0, Math.round(appState.pet.hunger - DECAY_RATES.hunger * minutesElapsed));
        appState.pet.happiness = Math.max(0, Math.round(appState.pet.happiness - DECAY_RATES.happiness * minutesElapsed));
        appState.pet.energy = Math.max(0, Math.round(appState.pet.energy - DECAY_RATES.energy * minutesElapsed));
    }

    appState.lastDecayCheck = now;
    updateEvolution();
}

function updateEvolution() {
    const avg = (appState.pet.hunger + appState.pet.happiness + appState.pet.energy) / 3;
    let stage;
    if (avg >= 80) stage = 5;
    else if (avg >= 60) stage = 4;
    else if (avg >= 40) stage = 3;
    else if (avg >= 20) stage = 2;
    else stage = 1;

    if (stage !== appState.pet.evolutionStage) {
        const oldStage = appState.pet.evolutionStage;
        appState.pet.evolutionStage = stage;
        if (stage > oldStage) {
            petSay('我进化啦！✨');
            spawnEffect('🌟');
        } else if (stage < oldStage) {
            petSay('呜呜，我退化了...');
            spawnEffect('😢');
        }
    }
}

// Action effects
const ACTION_EFFECTS = {
    feed: { hunger: 30, happiness: 5, energy: 0, emoji: '🍖', message: '喂食' },
    play: { hunger: -5, happiness: 25, energy: -10, emoji: '🎾', message: '玩耍' },
    sleep: { hunger: -5, happiness: 0, energy: 40, emoji: '😴', message: '哄睡' },
    love: { hunger: 0, happiness: 20, energy: 5, emoji: '💕', message: '亲亲' }
};

function performAction(action) {
    // Check cooldown
    const now = Date.now();
    if (appState.cooldowns[action] > now) {
        const remaining = Math.ceil((appState.cooldowns[action] - now) / 1000);
        showToast(`⏳ 请等待 ${remaining} 秒后再试~`);
        shakePet();
        return;
    }

    const effect = ACTION_EFFECTS[action];

    // Apply effects
    appState.pet.hunger = Math.min(100, Math.max(0, appState.pet.hunger + effect.hunger));
    appState.pet.happiness = Math.min(100, Math.max(0, appState.pet.happiness + effect.happiness));
    appState.pet.energy = Math.min(100, Math.max(0, appState.pet.energy + effect.energy));
    appState.pet.updatedAt = now;
    appState.pet.updatedBy = appState.identity;

    // Set cooldown
    appState.cooldowns[action] = now + COOLDOWNS[action];

    // Update evolution
    updateEvolution();

    // Add activity log
    const logEntry = {
        id: Date.now(),
        action: action,
        actor: appState.identity,
        message: `${appState.identity}给${appState.pet.name}${effect.message}了`,
        createdAt: now
    };
    appState.activityLog.unshift(logEntry);

    // Update pet timestamp fields
    const fieldMap = { feed: 'lastFedAt', play: 'lastPlayedAt', sleep: 'lastSleptAt', love: 'lastLovedAt' };
    appState.pet[fieldMap[action]] = new Date(now).toISOString();

    // Update all UI
    updateAllUI();
    saveLocalState();

    // Sync
    savePetToSupabase();
    saveLogToSupabase(logEntry);
    broadcastUpdate('petUpdate', {
        hunger: appState.pet.hunger,
        happiness: appState.pet.happiness,
        energy: appState.pet.energy,
        evolutionStage: appState.pet.evolutionStage,
        updatedBy: appState.identity,
        updatedAt: now
    });
    broadcastUpdate('log', logEntry);

    // Visual feedback
    spawnEffect(effect.emoji);
    petSay(getRandomHappyPhrase(action));
    showToast(`${effect.emoji} ${appState.identity}${effect.message}了${appState.pet.name}！`);

    // Button animation
    const btnMap = { feed: 'btnFeed', play: 'btnPlay', sleep: 'btnSleep', love: 'btnLove' };
    const btn = document.getElementById(btnMap[action]);
    if (btn) {
        btn.style.transform = 'scale(1.1)';
        setTimeout(() => { btn.style.transform = ''; }, 200);
    }
}

function shakePet() {
    const petEl = document.getElementById('pet');
    petEl.style.animation = 'none';
    petEl.offsetHeight; // reflow
    petEl.style.animation = 'shake 0.5s ease';
    setTimeout(() => {
        petEl.style.animation = 'petFloat 3s ease-in-out infinite';
    }, 500);
}

function getRandomHappyPhrase(action) {
    const phrases = {
        feed: ['好好吃呀~', '吃饱饱啦！', '谢谢！美味~', '还要还要！', '嗝~好满足'],
        play: ['好开心呀！', '再来一次！', '哈哈哈~', '好好玩！', '耶！'],
        sleep: ['晚安~💤', '好舒服...', 'zzz...', '做个好梦~', '呼...呼...'],
        love: ['嘿嘿~', '我也爱你！', '好幸福~', '抱抱！', '亲亲！']
    };
    const pool = phrases[action] || ['谢谢你~'];
    return pool[Math.floor(Math.random() * pool.length)];
}

// ============================================
// UI UPDATES
// ============================================
function updateAllUI() {
    updatePetDisplay();
    updateStats();
    updateEvolutionBadge();
    updateDaysCounter();
    updatePetNameDisplay();
    renderNotes();
    renderActivityLog();
    updateCooldownButtons();
}

function updatePetDisplay() {
    const petBody = document.querySelector('.pet-body');
    const petMouth = document.getElementById('petMouth');

    // Update pet body class for evolution stage
    petBody.className = 'pet-body';
    petBody.classList.add(`stage-${appState.pet.evolutionStage}`);

    // Update mouth based on overall mood
    const avg = (appState.pet.hunger + appState.pet.happiness + appState.pet.energy) / 3;
    petMouth.className = 'pet-mouth';

    if (avg >= 60) {
        petMouth.classList.add('happy');
    } else if (avg >= 30) {
        petMouth.classList.add('neutral');
    } else {
        petMouth.classList.add('sad');
    }

    // Update pet animation speed based on happiness
    const pet = document.getElementById('pet');
    const duration = appState.pet.happiness > 60 ? 2 : appState.pet.happiness > 30 ? 3 : 4;
    pet.style.animationDuration = `${duration}s`;
}

function updateStats() {
    const hungerBar = document.getElementById('hungerBar');
    const happinessBar = document.getElementById('happinessBar');
    const energyBar = document.getElementById('energyBar');
    const hungerValue = document.getElementById('hungerValue');
    const happinessValue = document.getElementById('happinessValue');
    const energyValue = document.getElementById('energyValue');

    hungerBar.style.width = `${appState.pet.hunger}%`;
    happinessBar.style.width = `${appState.pet.happiness}%`;
    energyBar.style.width = `${appState.pet.energy}%`;

    hungerValue.textContent = appState.pet.hunger;
    happinessValue.textContent = appState.pet.happiness;
    energyValue.textContent = appState.pet.energy;

    // Color warnings for low stats
    [hungerValue, happinessValue, energyValue].forEach(el => el.style.color = '');

    if (appState.pet.hunger < 20) {
        hungerValue.style.color = '#e74c3c';
        hungerValue.textContent = appState.pet.hunger + ' ⚠️';
    }
    if (appState.pet.happiness < 20) {
        happinessValue.style.color = '#e74c3c';
        happinessValue.textContent = appState.pet.happiness + ' ⚠️';
    }
    if (appState.pet.energy < 20) {
        energyValue.style.color = '#e74c3c';
        energyValue.textContent = appState.pet.energy + ' ⚠️';
    }
}

function updateEvolutionBadge() {
    const badge = document.getElementById('evolutionBadge');
    const stages = {
        1: '🥚 蛋蛋',
        2: '🐣 幼崽',
        3: '🐥 成长期',
        4: '🌟 成熟期',
        5: '👑 完全体'
    };
    badge.textContent = stages[appState.pet.evolutionStage] || '🥚 蛋蛋';
}

function updateDaysCounter() {
    const daysCount = document.getElementById('daysCount');
    if (appState.anniversary) {
        const start = new Date(appState.anniversary);
        const now = new Date();
        const diffTime = now - start;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays >= 0) {
            daysCount.textContent = diffDays;
        } else {
            daysCount.textContent = '...';
        }
    }
}

function updatePetNameDisplay() {
    const display = document.getElementById('petNameDisplay');
    if (display) {
        display.textContent = appState.pet.name;
    }
}

function updateOnlineStatus(connected) {
    const dot = document.getElementById('onlineDot');
    const text = document.getElementById('onlineText');
    if (connected) {
        dot.classList.add('connected');
        text.textContent = USE_SUPABASE ? '实时同步已连接' : '本地模式运行中';
    } else {
        dot.classList.remove('connected');
        text.textContent = '等待连接...';
    }
}

function updateCooldownButtons() {
    const now = Date.now();
    const actions = ['feed', 'play', 'sleep', 'love'];
    const btnIds = ['btnFeed', 'btnPlay', 'btnSleep', 'btnLove'];

    actions.forEach((action, i) => {
        const btn = document.getElementById(btnIds[i]);
        if (!btn) return;

        if (appState.cooldowns[action] > now) {
            btn.disabled = true;
            btn.classList.remove('ready');
        } else {
            btn.disabled = false;
            btn.classList.add('ready');
        }
    });
}

// ============================================
// NOTES
// ============================================
function sendNote() {
    const input = document.getElementById('noteInput');
    const text = input.value.trim();
    if (!text) return;

    const note = {
        id: Date.now(),
        author: appState.identity,
        text: text,
        createdAt: Date.now()
    };

    appState.notes.unshift(note);
    input.value = '';

    renderNotes();
    saveLocalState();
    saveNoteToSupabase(note);
    broadcastUpdate('note', note);

    showToast('💌 小纸条已发送！');
}

function renderNotes() {
    const container = document.getElementById('notesContainer');
    const empty = document.getElementById('notesEmpty');

    if (appState.notes.length === 0) {
        container.innerHTML = '';
        container.appendChild(empty);
        empty.style.display = '';
        return;
    }

    empty.style.display = 'none';
    container.innerHTML = appState.notes.map(note => `
        <div class="note-card">
            <div class="note-author">${note.author === '李安' ? '👦' : '👧'} ${note.author}</div>
            <div class="note-text">${escapeHtml(note.text)}</div>
            <div class="note-time">${formatTime(note.createdAt)}</div>
        </div>
    `).join('');
}

// ============================================
// ACTIVITY LOG
// ============================================
function renderActivityLog() {
    const container = document.getElementById('logContainer');
    const empty = document.getElementById('logEmpty');

    if (appState.activityLog.length === 0) {
        container.innerHTML = '';
        container.appendChild(empty);
        empty.style.display = '';
        return;
    }

    empty.style.display = 'none';
    const emojiMap = { feed: '🍖', play: '🎾', sleep: '😴', love: '💕' };

    container.innerHTML = appState.activityLog.slice(0, 30).map(entry => `
        <div class="log-entry">
            <span class="log-emoji">${emojiMap[entry.action] || '🦋'}</span>
            <span class="log-message">${escapeHtml(entry.message)}</span>
            <span class="log-time">${formatTime(entry.createdAt)}</span>
        </div>
    `).join('');
}

// ============================================
// IDENTITY
// ============================================
function setIdentity(name) {
    appState.identity = name;
    document.getElementById('btnLiAn').classList.toggle('active', name === '李安');
    document.getElementById('btnHan').classList.toggle('active', name === '韩舒薇');

    // Update URL hash
    const hash = name === '韩舒薇' ? 'han' : 'li';
    window.location.hash = hash;

    saveLocalState();
    showToast(`👋 你好，${name}！`);
    petSay(`${name}来啦~`);
}

// ============================================
// PET SPEECH
// ============================================
let speechTimeout = null;

function petSay(message) {
    const bubble = document.getElementById('speechBubble');
    const text = document.getElementById('speechText');

    text.textContent = message;
    bubble.style.display = '';

    if (speechTimeout) clearTimeout(speechTimeout);
    speechTimeout = setTimeout(() => {
        bubble.style.display = 'none';
    }, 3000);
}

// ============================================
// EFFECTS
// ============================================
function spawnEffect(emoji) {
    const effects = document.getElementById('petEffects');
    const el = document.createElement('span');
    el.className = 'effect-heart';
    el.textContent = emoji;
    el.style.left = `${30 + Math.random() * 40}%`;
    el.style.top = `${20 + Math.random() * 40}%`;
    el.style.animationDuration = `${0.8 + Math.random() * 0.6}s`;
    effects.appendChild(el);

    setTimeout(() => el.remove(), 1500);
}

// ============================================
// FLOATING HEARTS BACKGROUND
// ============================================
function startHeartAnimation() {
    const bg = document.getElementById('heartsBg');
    const hearts = ['💕', '💖', '💗', '💝', '💘', '✨', '🌸', '🦋', '💫', '🌷'];

    function createHeart() {
        const heart = document.createElement('span');
        heart.className = 'heart-float';
        heart.textContent = hearts[Math.floor(Math.random() * hearts.length)];
        heart.style.left = `${Math.random() * 100}%`;
        heart.style.fontSize = `${14 + Math.random() * 24}px`;
        heart.style.animationDuration = `${8 + Math.random() * 12}s`;
        heart.style.animationDelay = '0s';
        bg.appendChild(heart);

        setTimeout(() => heart.remove(), 20000);
    }

    // Initial burst
    for (let i = 0; i < 10; i++) {
        setTimeout(createHeart, i * 400);
    }

    // Continuous
    setInterval(createHeart, 2000);
}

// ============================================
// DECAY TIMER
// ============================================
function startDecayTimer() {
    setInterval(() => {
        applyDecay();
        updateAllUI();
        saveLocalState();

        // Save to Supabase every 30 seconds if stats changed
        if (USE_SUPABASE && supabase) {
            // Throttled - only save occasionally
        }
    }, 10000); // Check every 10 seconds
}

// ============================================
// COOLDOWN TIMER
// ============================================
function startCooldownTimers() {
    setInterval(() => {
        updateCooldownButtons();
    }, 1000);
}

// ============================================
// TOAST
// ============================================
let toastTimeout = null;

function showToast(message) {
    const toast = document.getElementById('toast');
    const msg = document.getElementById('toastMsg');

    msg.textContent = message;
    toast.style.display = '';

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.style.display = 'none';
    }, 2500);
}

// ============================================
// SETTINGS
// ============================================
function openSettings() {
    document.getElementById('settingsModal').style.display = 'flex';
    document.getElementById('inputPetName').value = appState.pet.name;
    document.getElementById('inputAnniversary').value = appState.anniversary;
}

function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
}

function saveSettings() {
    const newName = document.getElementById('inputPetName').value.trim();
    const newDate = document.getElementById('inputAnniversary').value;

    if (newName) {
        appState.pet.name = newName;
        addLogEntry('settings', `${appState.identity}把小宠物改名为「${newName}」`);
    }
    if (newDate) {
        appState.anniversary = newDate;
    }

    updateAllUI();
    saveLocalState();
    saveSettingsToSupabase();
    savePetToSupabase();

    closeSettings();
    showToast('✅ 设置已保存！');
    if (newName) petSay(`我有新名字啦！我叫${newName}~`);
}

function addLogEntry(action, message) {
    const entry = {
        id: Date.now(),
        action: action,
        actor: appState.identity,
        message: message,
        createdAt: Date.now()
    };
    appState.activityLog.unshift(entry);
    saveLogToSupabase(entry);
}

// ============================================
// UTILS
// ============================================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin}分钟前`;

    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}小时前`;

    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return `${diffDay}天前`;

    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// ============================================
// PET CLICK INTERACTION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const petEl = document.getElementById('pet');
        if (petEl) {
            petEl.addEventListener('click', () => {
                const avg = (appState.pet.hunger + appState.pet.happiness + appState.pet.energy) / 3;
                const phrases = avg >= 60
                    ? ['嘻嘻~别挠了！', '好痒呀~', '再摸一下嘛~', '嘿嘿嘿~']
                    : avg >= 30
                    ? ['嗯...抱抱~', '有点饿了...', '陪我玩嘛~']
                    : ['呜呜...好饿...', '好困...', '快照顾我...'];

                petSay(phrases[Math.floor(Math.random() * phrases.length)]);
                spawnEffect('💕');
            });
        }
    }, 100);
});

// ============================================
// KEYBOARD SHORTCUTS
// ============================================
document.addEventListener('keydown', (e) => {
    switch(e.key.toLowerCase()) {
        case 'f': performAction('feed'); break;
        case 'p': performAction('play'); break;
        case 's':
            if (!e.ctrlKey && !e.metaKey && document.activeElement === document.body) {
                performAction('sleep');
            }
            break;
        case 'l':
            if (!e.ctrlKey && !e.metaKey && document.activeElement === document.body) {
                performAction('love');
            }
            break;
    }
});

// Add shake animation
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-8px); }
        50% { transform: translateX(8px); }
        75% { transform: translateX(-8px); }
    }
    @keyframes petFloat {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-12px); }
    }
`;
document.head.appendChild(shakeStyle);

console.log('💕 恋爱小窝已就绪！');
console.log('👦 李安 ❤️ 韩舒薇 👧');
console.log('🐾 快捷键: F=喂食 P=玩耍 S=哄睡 L=亲亲');
