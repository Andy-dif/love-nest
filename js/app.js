/* ============================================
   恋爱小窝 - Love Nest  v2.0
   李安 ❤️ 韩舒薇
   With login system & real-time interaction
   ============================================ */

// ============================================
// USER ACCOUNTS
// ============================================
const USERS = {
    '李安': {
        password: 'lian520',
        emoji: '👦',
        theme: 'li',  // blue-ish theme
        color: '#667eea'
    },
    '韩舒薇': {
        password: 'shuwei520',
        emoji: '👧',
        theme: 'han',  // pink theme
        color: '#f5576c'
    }
};

// ============================================
// APP STATE
// ============================================
let appState = {
    // Current session
    loggedInUser: null,    // '李安' or '韩舒薇' or null

    // Pet data
    pet: {
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
    },

    // Content
    notes: [],
    activityLog: [],
    anniversary: '2024-01-01',
    lastDecayCheck: Date.now(),

    // Cooldowns
    cooldowns: { feed: 0, play: 0, sleep: 0, love: 0 }
};

const DEFAULT_PET = { ...appState.pet };
const COOLDOWNS = { feed: 30000, play: 45000, sleep: 60000, love: 20000 };

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    loadAllData();
    startHeartAnimation();

    // Check if already logged in this session
    const sessionUser = sessionStorage.getItem('loveNestUser');
    if (sessionUser && USERS[sessionUser]) {
        loginUser(sessionUser, false); // skip password, already verified
    } else {
        showLoginScreen();
    }

    // Keyboard shortcut: Esc to logout
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && e.ctrlKey) {
            logout();
        }
    });
});

// ============================================
// LOGIN SYSTEM
// ============================================
function showLoginScreen() {
    document.getElementById('loginOverlay').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('loginError').style.display = 'none';
    document.getElementById('loginName').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginName').focus();
}

function hideLoginScreen() {
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('mainApp').style.display = '';
}

function attemptLogin() {
    const name = document.getElementById('loginName').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const errorEl = document.getElementById('loginError');

    if (!name || !password) {
        errorEl.textContent = '请输入名字和密码 💕';
        errorEl.style.display = '';
        return;
    }

    const user = USERS[name];
    if (!user) {
        errorEl.textContent = '用户不存在，请输入"李安"或"韩舒薇"';
        errorEl.style.display = '';
        return;
    }

    if (password !== user.password) {
        errorEl.textContent = '密码错误，再试一次~';
        errorEl.style.display = '';
        document.getElementById('loginPassword').value = '';
        document.getElementById('loginPassword').focus();
        return;
    }

    loginUser(name, true);
}

function loginUser(name, showWelcome) {
    const user = USERS[name];
    appState.loggedInUser = name;
    sessionStorage.setItem('loveNestUser', name);

    // Apply theme
    document.body.className = '';
    document.body.classList.add(`theme-${user.theme}`);

    hideLoginScreen();
    updateLoginUI();
    updateAllUI();
    startDecayTimer();
    startCooldownTimers();
    setupBroadcastChannel();

    // Keyboard shortcuts for actions
    document.addEventListener('keydown', handleActionKeys);

    if (showWelcome) {
        showToast(`${user.emoji} 欢迎回来，${name}！`);
        petSay(`${name}来啦~ 好想你！`);
    }
}

function handleActionKeys(e) {
    // Don't trigger when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch(e.key.toLowerCase()) {
        case 'f': performAction('feed'); break;
        case 'p': performAction('play'); break;
        case 's': performAction('sleep'); break;
        case 'l': performAction('love'); break;
    }
}

function logout() {
    appState.loggedInUser = null;
    sessionStorage.removeItem('loveNestUser');
    document.body.className = '';
    showLoginScreen();
    document.removeEventListener('keydown', handleActionKeys);
    showToast('👋 已退出登录');
}

function switchUser() {
    if (confirm('确定要切换用户吗？')) {
        logout();
    }
}

function updateLoginUI() {
    const user = USERS[appState.loggedInUser];
    if (!user) return;

    document.getElementById('headerUserName').textContent = appState.loggedInUser;
    document.getElementById('headerUserEmoji').textContent = user.emoji;

    // Update identity buttons (if they exist in the page)
    const btnLi = document.getElementById('btnLiAn');
    const btnHan = document.getElementById('btnHan');
    if (btnLi) btnLi.classList.toggle('active', appState.loggedInUser === '李安');
    if (btnHan) btnHan.classList.toggle('active', appState.loggedInUser === '韩舒薇');
}

function setIdentity(name) {
    if (appState.loggedInUser !== name) {
        // Need to re-login as the other user
        if (confirm(`切换到${name}需要重新登录，确定吗？`)) {
            logout();
            // Pre-fill the name
            setTimeout(() => {
                document.getElementById('loginName').value = name;
                document.getElementById('loginPassword').focus();
            }, 200);
        }
    }
}

// ============================================
// DATA PERSISTENCE (localStorage)
// ============================================
function loadAllData() {
    try {
        const saved = localStorage.getItem('loveNestData');
        if (saved) {
            const data = JSON.parse(saved);
            appState.pet = { ...DEFAULT_PET, ...data.pet };
            appState.notes = data.notes || [];
            appState.activityLog = data.activityLog || [];
            appState.anniversary = data.anniversary || '2024-01-01';
            appState.cooldowns = data.cooldowns || appState.cooldowns;
            applyDecay();
        }
    } catch (e) {
        console.warn('Load error:', e);
    }
}

function saveAllData() {
    try {
        localStorage.setItem('loveNestData', JSON.stringify({
            pet: appState.pet,
            notes: appState.notes.slice(-50),
            activityLog: appState.activityLog.slice(-100),
            anniversary: appState.anniversary,
            cooldowns: appState.cooldowns
        }));
    } catch (e) {
        console.warn('Save error:', e);
    }
}

// ============================================
// PET LOGIC
// ============================================
const DECAY_RATES = { hunger: 0.35, happiness: 0.22, energy: 0.18 };

function applyDecay() {
    const now = Date.now();
    const lastCheck = appState.lastDecayCheck || appState.pet.updatedAt || now;
    const minutesElapsed = (now - lastCheck) / 60000;

    if (minutesElapsed > 0.1) {
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

const ACTION_EFFECTS = {
    feed: { hunger: 30, happiness: 5,  energy: 0,  emoji: '🍖', verb: '喂食' },
    play: { hunger: -5, happiness: 25, energy: -10, emoji: '🎾', verb: '玩耍' },
    sleep:{ hunger: -5, happiness: 0,  energy: 40,  emoji: '😴', verb: '哄睡' },
    love: { hunger: 0,  happiness: 20, energy: 5,   emoji: '💕', verb: '亲亲' }
};

function performAction(action) {
    if (!appState.loggedInUser) {
        showToast('请先登录~');
        return;
    }

    const now = Date.now();
    if (appState.cooldowns[action] > now) {
        const remaining = Math.ceil((appState.cooldowns[action] - now) / 1000);
        showToast(`⏳ 冷却中，等 ${remaining} 秒~`);
        shakePet();
        return;
    }

    const eff = ACTION_EFFECTS[action];
    appState.pet.hunger = Math.min(100, Math.max(0, appState.pet.hunger + eff.hunger));
    appState.pet.happiness = Math.min(100, Math.max(0, appState.pet.happiness + eff.happiness));
    appState.pet.energy = Math.min(100, Math.max(0, appState.pet.energy + eff.energy));
    appState.pet.updatedAt = now;
    appState.pet.updatedBy = appState.loggedInUser;
    appState.cooldowns[action] = now + COOLDOWNS[action];

    updateEvolution();

    // Log
    const logEntry = {
        id: Date.now() + Math.random(),
        action: action,
        actor: appState.loggedInUser,
        message: `${appState.loggedInUser}给${appState.pet.name}${eff.verb}了`,
        createdAt: now
    };
    appState.activityLog.unshift(logEntry);

    // Timestamps
    const fieldMap = { feed: 'lastFedAt', play: 'lastPlayedAt', sleep: 'lastSleptAt', love: 'lastLovedAt' };
    appState.pet[fieldMap[action]] = new Date(now).toISOString();

    updateAllUI();
    saveAllData();
    broadcastUpdate('petUpdate', {
        hunger: appState.pet.hunger,
        happiness: appState.pet.happiness,
        energy: appState.pet.energy,
        evolutionStage: appState.pet.evolutionStage,
        updatedBy: appState.loggedInUser,
        updatedAt: now
    });
    broadcastUpdate('log', logEntry);

    spawnEffect(eff.emoji);
    petSay(getPetPhrase(action));
    showToast(`${eff.emoji} ${appState.loggedInUser}${eff.verb}了${appState.pet.name}！`);

    // Button bounce
    const btnMap = { feed: 'btnFeed', play: 'btnPlay', sleep: 'btnSleep', love: 'btnLove' };
    const btn = document.getElementById(btnMap[action]);
    if (btn) {
        btn.style.transform = 'scale(1.15)';
        setTimeout(() => { btn.style.transform = ''; }, 180);
    }
}

function shakePet() {
    const petEl = document.getElementById('pet');
    if (!petEl) return;
    petEl.style.animation = 'none';
    petEl.offsetHeight;
    petEl.style.animation = 'shake 0.5s ease';
    setTimeout(() => { petEl.style.animation = 'petFloat 3s ease-in-out infinite'; }, 500);
}

function getPetPhrase(action) {
    const phrases = {
        feed:  ['好好吃呀~', '吃饱饱啦！', '谢谢！美味~', '还要还要！', '嗝~好满足'],
        play:  ['好开心呀！', '再来一次！', '哈哈哈~', '好好玩！', '耶！跑起来！'],
        sleep: ['晚安~💤', '好舒服...', 'zzZZ...', '做个好梦~', '呼...呼...'],
        love:  ['嘿嘿~', '我也爱你！', '好幸福~', '抱抱！', '亲亲！mua~']
    };
    const pool = phrases[action] || ['谢谢你~'];
    return pool[Math.floor(Math.random() * pool.length)];
}

// ============================================
// UI UPDATES
// ============================================
function updateAllUI() {
    if (!appState.loggedInUser) return;
    updateLoginUI();
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
    if (!petBody || !petMouth) return;

    petBody.className = 'pet-body';
    petBody.classList.add(`stage-${appState.pet.evolutionStage}`);

    const avg = (appState.pet.hunger + appState.pet.happiness + appState.pet.energy) / 3;
    petMouth.className = 'pet-mouth';
    if (avg >= 60) petMouth.classList.add('happy');
    else if (avg >= 30) petMouth.classList.add('neutral');
    else petMouth.classList.add('sad');

    const pet = document.getElementById('pet');
    const dur = appState.pet.happiness > 60 ? 2 : appState.pet.happiness > 30 ? 3 : 4;
    if (pet) pet.style.animationDuration = `${dur}s`;
}

function updateStats() {
    const els = {
        hungerBar: document.getElementById('hungerBar'),
        happinessBar: document.getElementById('happinessBar'),
        energyBar: document.getElementById('energyBar'),
        hungerValue: document.getElementById('hungerValue'),
        happinessValue: document.getElementById('happinessValue'),
        energyValue: document.getElementById('energyValue')
    };

    if (els.hungerBar) els.hungerBar.style.width = `${appState.pet.hunger}%`;
    if (els.happinessBar) els.happinessBar.style.width = `${appState.pet.happiness}%`;
    if (els.energyBar) els.energyBar.style.width = `${appState.pet.energy}%`;

    // Reset colors
    [els.hungerValue, els.happinessValue, els.energyValue].forEach(el => {
        if (el) { el.style.color = ''; el.textContent = ''; }
    });

    if (els.hungerValue) {
        els.hungerValue.textContent = appState.pet.hunger;
        if (appState.pet.hunger < 20) { els.hungerValue.style.color = '#e74c3c'; els.hungerValue.textContent += ' ⚠️'; }
    }
    if (els.happinessValue) {
        els.happinessValue.textContent = appState.pet.happiness;
        if (appState.pet.happiness < 20) { els.happinessValue.style.color = '#e74c3c'; els.happinessValue.textContent += ' ⚠️'; }
    }
    if (els.energyValue) {
        els.energyValue.textContent = appState.pet.energy;
        if (appState.pet.energy < 20) { els.energyValue.style.color = '#e74c3c'; els.energyValue.textContent += ' ⚠️'; }
    }
}

function updateEvolutionBadge() {
    const badge = document.getElementById('evolutionBadge');
    if (!badge) return;
    const stages = { 1: '🥚 蛋蛋', 2: '🐣 幼崽', 3: '🐥 成长期', 4: '🌟 成熟期', 5: '👑 完全体' };
    badge.textContent = stages[appState.pet.evolutionStage] || '🥚 蛋蛋';
}

function updateDaysCounter() {
    const el = document.getElementById('daysCount');
    if (!el || !appState.anniversary) return;
    const start = new Date(appState.anniversary);
    const diffDays = Math.floor((Date.now() - start) / 86400000);
    el.textContent = diffDays >= 0 ? diffDays : '...';
}

function updatePetNameDisplay() {
    const el = document.getElementById('petNameDisplay');
    if (el) el.textContent = appState.pet.name;
}

function updateCooldownButtons() {
    const now = Date.now();
    ['feed','play','sleep','love'].forEach((action, i) => {
        const btn = document.getElementById(['btnFeed','btnPlay','btnSleep','btnLove'][i]);
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
// NOTES (FIXED - preserves empty element)
// ============================================
function sendNote() {
    if (!appState.loggedInUser) {
        showToast('请先登录~');
        return;
    }

    const input = document.getElementById('noteInput');
    const text = input.value.trim();
    if (!text) return;

    const note = {
        id: Date.now() + Math.random(),
        author: appState.loggedInUser,
        text: text,
        createdAt: Date.now()
    };

    appState.notes.unshift(note);
    input.value = '';
    renderNotes();
    saveAllData();
    broadcastUpdate('note', note);
    showToast('💌 小纸条已发送！');
}

function renderNotes() {
    const container = document.getElementById('notesContainer');
    if (!container) return;

    if (appState.notes.length === 0) {
        container.innerHTML = '<div class="notes-empty">还没有小纸条，快来写一张吧~</div>';
        return;
    }

    container.innerHTML = appState.notes.map(note => {
        const isLi = note.author === '李安';
        return `
        <div class="note-card ${isLi ? 'note-li' : 'note-han'}">
            <div class="note-author">${isLi ? '👦' : '👧'} ${note.author}</div>
            <div class="note-text">${escapeHtml(note.text)}</div>
            <div class="note-time">${formatTime(note.createdAt)}</div>
        </div>`;
    }).join('');
}

// ============================================
// ACTIVITY LOG (FIXED - preserves empty element)
// ============================================
function renderActivityLog() {
    const container = document.getElementById('logContainer');
    if (!container) return;

    if (appState.activityLog.length === 0) {
        container.innerHTML = '<div class="log-empty">还没有动态，快来互动吧~</div>';
        return;
    }

    const emojiMap = { feed: '🍖', play: '🎾', sleep: '😴', love: '💕', settings: '⚙️' };
    container.innerHTML = appState.activityLog.slice(0, 40).map(entry => `
        <div class="log-entry">
            <span class="log-emoji">${emojiMap[entry.action] || '🦋'}</span>
            <span class="log-message">${escapeHtml(entry.message)}</span>
            <span class="log-time">${formatTime(entry.createdAt)}</span>
        </div>
    `).join('');
}

// ============================================
// BROADCAST CHANNEL (Cross-tab sync)
// ============================================
let bc = null;
function setupBroadcastChannel() {
    try {
        bc = new BroadcastChannel('love-nest-v2');
        bc.onmessage = (event) => {
            const { type, data } = event.data;
            if (type === 'petUpdate' && data.updatedBy !== appState.loggedInUser) {
                Object.assign(appState.pet, data);
                updateAllUI();
                saveAllData();
                petSay(`${data.updatedBy}刚刚照顾了我~`);
                showToast(`🔄 ${data.updatedBy}在另一个窗口互动了！`);
            } else if (type === 'note' && data.author !== appState.loggedInUser) {
                appState.notes.unshift(data);
                renderNotes();
                saveAllData();
                showToast(`💌 ${data.author}写了一张小纸条！`);
            } else if (type === 'log' && data.actor !== appState.loggedInUser) {
                appState.activityLog.unshift(data);
                renderActivityLog();
                saveAllData();
            }
        };
    } catch (e) { /* not supported */ }
}

function broadcastUpdate(type, data) {
    if (bc) {
        try { bc.postMessage({ type, data }); } catch (e) {}
    }
}

// ============================================
// PET SPEECH & EFFECTS
// ============================================
let speechTimeout = null;
function petSay(message) {
    const bubble = document.getElementById('speechBubble');
    const text = document.getElementById('speechText');
    if (!bubble || !text) return;
    text.textContent = message;
    bubble.style.display = '';
    if (speechTimeout) clearTimeout(speechTimeout);
    speechTimeout = setTimeout(() => { bubble.style.display = 'none'; }, 3500);
}

function spawnEffect(emoji) {
    const effects = document.getElementById('petEffects');
    if (!effects) return;
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
// HEARTS BACKGROUND
// ============================================
function startHeartAnimation() {
    const bg = document.getElementById('heartsBg');
    if (!bg) return;
    const hearts = ['💕','💖','💗','💝','💘','✨','🌸','🦋','💫','🌷','💓','💞'];

    function createHeart() {
        const h = document.createElement('span');
        h.className = 'heart-float';
        h.textContent = hearts[Math.floor(Math.random() * hearts.length)];
        h.style.left = `${Math.random() * 100}%`;
        h.style.fontSize = `${14 + Math.random() * 24}px`;
        h.style.animationDuration = `${8 + Math.random() * 12}s`;
        bg.appendChild(h);
        setTimeout(() => h.remove(), 20000);
    }

    for (let i = 0; i < 8; i++) setTimeout(createHeart, i * 500);
    setInterval(createHeart, 2200);
}

// ============================================
// TIMERS
// ============================================
let decayInterval = null;
function startDecayTimer() {
    if (decayInterval) clearInterval(decayInterval);
    decayInterval = setInterval(() => {
        applyDecay();
        updateAllUI();
        saveAllData();
    }, 10000);
}

let cooldownInterval = null;
function startCooldownTimers() {
    if (cooldownInterval) clearInterval(cooldownInterval);
    cooldownInterval = setInterval(updateCooldownButtons, 1000);
}

// ============================================
// TOAST
// ============================================
let toastTimeout = null;
function showToast(message) {
    const toast = document.getElementById('toast');
    const msg = document.getElementById('toastMsg');
    if (!toast || !msg) return;
    msg.textContent = message;
    toast.style.display = '';
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => { toast.style.display = 'none'; }, 2500);
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
        const entry = {
            id: Date.now() + Math.random(),
            action: 'settings',
            actor: appState.loggedInUser,
            message: `${appState.loggedInUser}把宠物名字改为「${newName}」`,
            createdAt: Date.now()
        };
        appState.activityLog.unshift(entry);
        broadcastUpdate('log', entry);
        petSay(`我有新名字啦！我叫${newName}~`);
    }
    if (newDate) {
        appState.anniversary = newDate;
    }

    updateAllUI();
    saveAllData();
    closeSettings();
    showToast('✅ 设置已保存！');
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
    const diffMin = Math.floor((Date.now() - date) / 60000);
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin}分钟前`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}小时前`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return `${diffDay}天前`;
    return `${date.getMonth()+1}/${date.getDate()} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
}

// ============================================
// PET CLICK
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const petEl = document.getElementById('pet');
        if (petEl) {
            petEl.addEventListener('click', () => {
                if (!appState.loggedInUser) return;
                const avg = (appState.pet.hunger + appState.pet.happiness + appState.pet.energy) / 3;
                const phrases = avg >= 60
                    ? ['嘻嘻~别挠了！', '好痒呀~', '再摸一下嘛~', '嘿嘿嘿~', '好开心！']
                    : avg >= 30
                    ? ['嗯...抱抱~', '有点饿了...', '陪我玩嘛~', '呼...']
                    : ['呜呜...好饿...', '好困...', '快照顾我嘛...', '好难受...'];
                petSay(phrases[Math.floor(Math.random() * phrases.length)]);
                spawnEffect('💕');
            });
        }
    }, 200);
});

// Enter key to login
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const pwInput = document.getElementById('loginPassword');
        const nameInput = document.getElementById('loginName');
        if (pwInput) {
            pwInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') attemptLogin();
            });
        }
        if (nameInput) {
            nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') document.getElementById('loginPassword').focus();
            });
        }
        // Note send on Ctrl+Enter
        const noteInput = document.getElementById('noteInput');
        if (noteInput) {
            noteInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.ctrlKey) sendNote();
            });
        }
    }, 300);
});

// Inject shake keyframe if needed
const styleEl = document.createElement('style');
styleEl.textContent = `
    @keyframes shake {
        0%,100%{transform:translateX(0)}
        25%{transform:translateX(-8px)}
        50%{transform:translateX(8px)}
        75%{transform:translateX(-8px)}
    }
    @keyframes petFloat {
        0%,100%{transform:translateY(0)}
        50%{transform:translateY(-12px)}
    }
`;
document.head.appendChild(styleEl);

console.log('💕 恋爱小窝 v2.0 已就绪');
console.log('👦 李安 | 密码: lian520');
console.log('👧 韩舒薇 | 密码: shuwei520');
