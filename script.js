const socket = io();

// --- UI Elements ---
const loginScreen = document.getElementById('loginScreen');
const appScreen = document.getElementById('appScreen');
const loginBtn = document.getElementById('loginBtn');
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const errorMsg = document.getElementById('errorMsg');

const canvas = document.getElementById('drawingCanvas');
const ctx = canvas.getContext('2d');
const laserCanvas = document.getElementById('laserCanvas');
const laserCtx = laserCanvas.getContext('2d');

let currentColor = '#ffffff';

const sizePicker = document.getElementById('sizePicker');

// Tools & Actions
const penBtn = document.getElementById('penBtn');
const eraserBtn = document.getElementById('eraserBtn');
const rainbowBtn = document.getElementById('rainbowBtn');
const laserBtn = document.getElementById('laserBtn');
const mirrorBtn = document.getElementById('mirrorBtn');
const noteBtn = document.getElementById('noteBtn');
const undoBtn = document.getElementById('undoBtn');
const saveBtn = document.getElementById('saveBtn');
const clearBtn = document.getElementById('clearBtn');
const bgBtn = document.getElementById('bgBtn');
const gameBtn = document.getElementById('gameBtn');
const imageBtn = document.getElementById('imageBtn');
const imageUpload = document.getElementById('imageUpload');
const wheelToggleBtn = document.getElementById('wheelToggleBtn');
const galleryToggleBtn = document.getElementById('galleryToggleBtn');
const confettiBtn = document.getElementById('confettiBtn');
const moodSelect = document.getElementById('moodSelect');

// Quick Colors
const quickColorBtns = document.querySelectorAll('.qc-btn');

// Modals & Containers
const wheelModal = document.getElementById('wheelModal');
const closeWheelBtn = document.getElementById('closeWheelBtn');
const wheelEl = document.getElementById('wheel');
const spinBtn = document.getElementById('spinBtn');
const wheelResult = document.getElementById('wheelResult');
const promptList = document.getElementById('promptList');
const newPromptInput = document.getElementById('newPromptInput');
const addPromptBtn = document.getElementById('addPromptBtn');

const galleryModal = document.getElementById('galleryModal');
const closeGalleryBtn = document.getElementById('closeGalleryBtn');
const galleryGrid = document.getElementById('galleryGrid');

const notesContainer = document.getElementById('notesContainer');

const toggleSpotifyBtn = document.getElementById('toggleSpotifyBtn');
const spotifyContainer = document.getElementById('spotifyContainer');
const closeSpotifyBtn = document.getElementById('closeSpotifyBtn');
const spotifyEmbedWrapper = document.getElementById('spotifyEmbedWrapper');
const spotifySearchInput = document.getElementById('spotifySearchInput');
const searchResults = document.getElementById('searchResults');
const surpriseBtn = document.getElementById('surpriseBtn');
const reactBtns = document.querySelectorAll('.react-btn');

// Night Mode & Background
const nightModeBtn = document.getElementById('nightModeBtn');
const starfield = document.getElementById('starfield');
const gameContainer = document.getElementById('gameContainer');
const closeGameBtn = document.getElementById('closeGameBtn');
const tttGrid = document.getElementById('tttGrid');
const gameStatus = document.getElementById('gameStatus');
const gameWinner = document.getElementById('gameWinner');
const resetGameBtn = document.getElementById('resetGameBtn');
const cells = document.querySelectorAll('.ttt-cell');

// State
let isAuthenticated = false;
let currentTool = 'pen';
let isMirrorMode = false;
const bgClasses = ['bg-dark', 'bg-grid', 'bg-dots', 'bg-paper'];
let currentBgIndex = 0;
let rainbowHue = 0;
let drawingHistory = [];
let laserPaths = [];
let wheelPrompts = [];
let localNotes = {}; 
let remoteMoods = {}; // { id: '❤️' }

// --- LOGIN LOGIC ---
loginBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    if(!username || !password) return;
    socket.emit('login', { username, password });
});
passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') loginBtn.click(); });

// --- CANVAS RESIZE (defined early so login_success can call it) ---
function resizeCanvas() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width; tempCanvas.height = canvas.height;
    tempCanvas.getContext('2d').drawImage(canvas, 0, 0);
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    laserCanvas.width = window.innerWidth; laserCanvas.height = window.innerHeight;
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
}

socket.on('login_success', () => {
    isAuthenticated = true;
    loginScreen.style.display = 'none';
    appScreen.style.display = 'block';
    
    // EXPLICITLY HIDE XOX ON STARTUP
    gameContainer.classList.add('hidden'); 
    gameContainer.style.display = 'none';
    
    resizeCanvas();
    saveState();
    initNightMode();
    requestAnimationFrame(renderLasers);
    
    // Request current canvas from others
    socket.emit('request_canvas_state', socket.id);
});

socket.on('request_canvas_state', (toId) => {
    if (toId === socket.id) return;
    const dataUrl = canvas.toDataURL();
    socket.emit('canvas_state_send', { to: toId, image: dataUrl });
});

socket.on('canvas_state_receive', (image) => {
    const img = new Image();
    img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        saveState();
    };
    img.src = image;
});
socket.on('login_error', (msg) => { errorMsg.textContent = msg; });

// --- TOOLBAR LOGIC ---
function setTool(toolName, btnElement) {
    currentTool = toolName;
    document.querySelectorAll('.tool-btn:not(.action-btn):not(.danger-btn)').forEach(b => b.classList.remove('active'));
    btnElement.classList.add('active');
    ctx.globalCompositeOperation = toolName === 'eraser' ? 'destination-out' : 'source-over';
}

penBtn.addEventListener('click', () => setTool('pen', penBtn));
eraserBtn.addEventListener('click', () => setTool('eraser', eraserBtn));
rainbowBtn.addEventListener('click', () => setTool('rainbow', rainbowBtn));
laserBtn.addEventListener('click', () => setTool('laser', laserBtn));

document.getElementById('syncBtn').addEventListener('click', () => {
    socket.emit('request_canvas_state', socket.id);
    spawnPing(window.innerWidth/2, window.innerHeight/2, '🔄');
});

bgBtn.addEventListener('click', () => {
    currentBgIndex = (currentBgIndex + 1) % bgClasses.length;
    const newBg = bgClasses[currentBgIndex];
    document.body.className = newBg;
    socket.emit('bg_change', newBg);
});
socket.on('bg_change', (bgClass) => { document.body.className = bgClass; currentBgIndex = bgClasses.indexOf(bgClass); });

// --- QUICK COLORS & MOOD & CONFETTI ---
quickColorBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const c = e.target.getAttribute('data-color');
        pickr.setColor(c);
        quickColorBtns.forEach(b => b.classList.remove('selected'));
        e.target.classList.add('selected');
        if(currentTool === 'eraser') penBtn.click();
    });
});

// Pickr Initialization
const pickr = Pickr.create({
    el: '#colorPicker',
    theme: 'nano',
    default: '#ffffff',
    swatches: ['#ff4d4d', '#ffa64d', '#ffff4d', '#4dff4d', '#4dffff', '#4d4dff', '#e600e6'],
    components: { preview: true, opacity: true, hue: true, interaction: { hex: true, rgba: true, input: true, save: true } }
});
pickr.on('change', (color) => {
    currentColor = color.toHEXA().toString();
    quickColorBtns.forEach(b => b.classList.remove('selected'));
});
pickr.on('save', (color) => { pickr.hide(); });

moodSelect.addEventListener('change', (e) => {
    const val = e.target.value === 'none' ? '' : e.target.value;
    socket.emit('mood_change', val);
    if (val) socket.emit('youtube_mood_sync', val);
});
socket.on('mood_change', (data) => {
    remoteMoods[data.id] = data.mood;
    // Update cursor if it exists
    if(remoteCursors[data.id]) {
        const nameEl = remoteCursors[data.id].querySelector('.cursor-name');
        nameEl.textContent = data.mood ? `Karşı Taraf ${data.mood}` : `Karşı Taraf`;
    }
});

confettiBtn.addEventListener('click', () => {
    fireConfetti();
    socket.emit('confetti');
});
socket.on('confetti', () => fireConfetti());

function fireConfetti() {
    var duration = 3 * 1000;
    var animationEnd = Date.now() + duration;
    var defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };
    function randomInRange(min, max) { return Math.random() * (max - min) + min; }
    var interval = setInterval(function() {
        var timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);
        var particleCount = 50 * (timeLeft / duration);
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
    }, 250);
}

// --- SAVE & SHARED ALBUM ---
saveBtn.addEventListener('click', async () => {
    const tempCanvas = document.createElement('canvas');
    const tCtx = tempCanvas.getContext('2d');
    tempCanvas.width = canvas.width; tempCanvas.height = canvas.height;
    const bgColorMap = { 'bg-dark': '#121212', 'bg-grid': '#1a1a1a', 'bg-dots': '#161616', 'bg-paper': '#f4f4f4' };
    tCtx.fillStyle = bgColorMap[bgClasses[currentBgIndex]];
    tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    tCtx.drawImage(canvas, 0, 0);

    const dataUrl = tempCanvas.toDataURL('image/png');
    
    // Save to shared album (server)
    try {
        await fetch('/api/gallery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: dataUrl })
        });
        saveBtn.style.color = '#4dff4d';
        socket.emit('gallery_update');
        setTimeout(() => saveBtn.style.color = '', 1000);
        
        // Local feedback
        spawnPing(window.innerWidth/2, window.innerHeight/2, '✅');
    } catch (e) { console.error(e); }
    
    // NOTE: Auto-download removed as requested. User can download from the Album modal.
});

socket.on('gallery_update', () => {
    // Show notification to other user
    const notification = document.createElement('div');
    notification.className = 'vibe-notif';
    notification.innerHTML = '🖼️ Karşı taraf albüme yeni bir resim ekledi!';
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);

    if (!galleryModal.classList.contains('hidden')) {
        refreshGallery();
    }
});

async function refreshGallery() {
    galleryGrid.innerHTML = '<div style="color:#aaa; padding:20px;">Anılar yükleniyor...</div>';
    try {
        const res = await fetch('/api/gallery');
        const images = await res.json();
        if (images.length === 0) {
            galleryGrid.innerHTML = '<div style="color:#aaa; padding:20px; grid-column: 1/-1;">Henüz hiç anı biriktirmemişsiniz... 🥺</div>';
            return;
        }
        galleryGrid.innerHTML = images.map(img => `
            <div class="gallery-item-container" id="gallery-item-${img.replace(/\W/g, '')}">
                <img src="/gallery/${img}" class="gallery-item" loading="lazy">
                <div class="gallery-item-actions">
                    <a href="/gallery/${img}" download="cizim-${img}" class="album-action-btn download" title="İndir">
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    </a>
                    <button onclick="deleteImage('${img}')" class="album-action-btn delete" title="Sil">
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </div>
            </div>
        `).join('');
    } catch (e) { galleryGrid.innerHTML = '<div style="color:var(--danger); padding:20px;">Hata oluştu.</div>'; }
}

window.deleteImage = async (filename) => {
    if (!confirm('Bu anıyı silmek istediğine emin misin? 🥺')) return;
    try {
        const res = await fetch(`/api/gallery/${filename}`, { method: 'DELETE' });
        if (res.ok) {
            refreshGallery();
            socket.emit('gallery_update');
        }
    } catch (e) { console.error(e); }
};

galleryToggleBtn.addEventListener('click', () => {
    galleryModal.classList.remove('hidden');
    refreshGallery();
});
closeGalleryBtn.addEventListener('click', () => galleryModal.classList.add('hidden'));

// --- YOUTUBE MUSIC (Replaced Spotify) ---
toggleSpotifyBtn.addEventListener('click', () => spotifyContainer.classList.toggle('hidden'));
closeSpotifyBtn.addEventListener('click', () => spotifyContainer.classList.add('hidden'));

// --- YOUTUBE PLAYER API ---
let player;
window.onYouTubeIframeAPIReady = () => {
    // Player will be initialized when needed
};

function updateYouTubeIframe(data) {
    if (!data || !data.id) return;
    currentYouTubeId = data;
    
    if (player) {
        if (data.isPlaylist) player.loadPlaylist({list: data.id});
        else player.loadVideoById(data.id);
    } else {
        spotifyEmbedWrapper.innerHTML = '<div id="yt-player"></div>';
        player = new YT.Player('yt-player', {
            height: '200',
            width: '100%',
            videoId: data.isPlaylist ? null : data.id,
            playerVars: { 
                autoplay: 1, 
                mute: 0, 
                rel: 0, 
                listType: data.isPlaylist ? 'playlist' : null, 
                list: data.isPlaylist ? data.id : null 
            },
            events: {
                'onStateChange': onPlayerStateChange
            }
        });
    }
    spotifyContainer.classList.add('spotify-vibe-active');
    setTimeout(() => spotifyContainer.classList.remove('spotify-vibe-active'), 5000);
    spawnMusicNotes();
}

let isExternalUpdate = false;
function onPlayerStateChange(event) {
    if (isExternalUpdate) return;
    const state = event.data;
    const time = player.getCurrentTime();
    // 1: playing, 2: paused
    if (state === 1 || state === 2) {
        socket.emit('youtube_control', { action: state === 1 ? 'play' : 'pause', time });
    }
}

socket.on('youtube_control', (data) => {
    if (!player) return;
    isExternalUpdate = true;
    if (data.action === 'play') {
        player.seekTo(data.time, true);
        player.playVideo();
    } else if (data.action === 'pause') {
        player.pauseVideo();
    }
    setTimeout(() => { isExternalUpdate = false; }, 500);
});

socket.on('youtube_update', (data) => updateYouTubeIframe(data));

spotifySearchInput.addEventListener('input', () => {
    const query = spotifySearchInput.value.trim();
    clearTimeout(searchTimeout);
    if (query.includes('youtube.com') || query.includes('youtu.be')) {
        let vidId = '';
        if (query.includes('v=')) vidId = query.split('v=')[1].split('&')[0];
        else if (query.includes('list=')) vidId = query.split('list=')[1].split('&')[0];
        else vidId = query.split('/').pop().split('?')[0];
        if (vidId) { socket.emit('youtube_set', vidId, query.includes('list=')); spotifySearchInput.value = ''; return; }
    }
    if (query.length < 2) { searchResults.classList.add('hidden'); return; }
    searchTimeout = setTimeout(() => socket.emit('youtube_search', query), 300);
});

socket.on('youtube_search_results', (results) => {
    if (results.length === 0) { searchResults.innerHTML = '<div class="search-item">Bulunamadı</div>'; }
    else {
        searchResults.innerHTML = results.map(s => `
            <div class="search-item" data-id="${s.id}" data-isplaylist="${s.isPlaylist}">
                <div class="search-item-info">
                    <div class="search-item-name">${s.name}</div>
                    <div class="search-item-type">${s.type} ${s.isPlaylist ? 'Playlist' : 'Şarkı'}</div>
                </div>
            </div>
        `).join('');
    }
    searchResults.classList.remove('hidden');
});

searchResults.addEventListener('pointerdown', (e) => {
    const item = e.target.closest('.search-item');
    if (item) {
        socket.emit('youtube_set', item.dataset.id, item.dataset.isplaylist === 'true');
        searchResults.classList.add('hidden');
        spotifySearchInput.value = '';
    }
});

surpriseBtn.addEventListener('click', () => socket.emit('youtube_surprise'));

// Reactions
reactBtns.forEach(btn => {
    btn.onclick = () => socket.emit('youtube_reaction', btn.getAttribute('data-reaction'));
});

socket.on('youtube_reaction', (data) => {
    if (data.id !== socket.id) spawnPing(window.innerWidth/2, window.innerHeight/2, data.reaction);
});

function spawnMusicNotes() {
    const symbols = ['♫', '♪', '♯', '♩'];
    for (let i = 0; i < 6; i++) {
        setTimeout(() => {
            const note = document.createElement('div');
            note.className = 'music-note';
            note.textContent = symbols[Math.floor(Math.random() * symbols.length)];
            note.style.left = (90 + (Math.random() * 40)) + 'px'; 
            note.style.top = (30 + (Math.random() * 40)) + 'px';
            note.style.color = '#ff0000';
            document.body.appendChild(note);
            setTimeout(() => note.remove(), 2000);
        }, i * 200);
    }
}

// Modify existing spawnPing to accept emoji
const originalSpawnPing = window.spawnPing;
window.spawnPing = (x, y, emoji) => {
    const emojis = emoji ? [emoji] : ['❤️', '✨', '🔥', '🥰'];
    for(let i=0; i<(emoji ? 5 : 3); i++) {
        setTimeout(() => {
            const ping = document.createElement('div'); ping.className = 'ping-anim';
            ping.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            ping.style.left = x + 'px'; ping.style.top = y + 'px'; ping.style.marginLeft = (Math.random() * 60 - 30) + 'px';
            document.getElementById('pingsContainer').appendChild(ping);
            setTimeout(() => ping.remove(), 1500);
        }, i * 150);
    }
};

// Hide search results when clicking outside
document.addEventListener('click', (e) => {
    if (!spotifyContainer.contains(e.target)) {
        searchResults.classList.add('hidden');
    }
});

// --- WHEEL ---
wheelToggleBtn.addEventListener('click', () => wheelModal.classList.remove('hidden'));
closeWheelBtn.addEventListener('click', () => wheelModal.classList.add('hidden'));

function renderWheelPrompts() {
    // Generate conic gradient colors dynamically
    let gradient = 'conic-gradient(from 0deg, ';
    const step = 360 / Math.max(1, wheelPrompts.length);
    const colors = ['#ff4d4d', '#ffa64d', '#ffff4d', '#4dff4d', '#4dffff', '#4d4dff', '#e600e6'];
    
    wheelPrompts.forEach((p, i) => {
        const c = colors[i % colors.length];
        gradient += `${c} ${i*step}deg ${(i+1)*step}deg${i === wheelPrompts.length-1 ? ')' : ', '}`;
    });
    wheelEl.style.background = wheelPrompts.length > 0 ? gradient : '#333';
    
    // Update Editor UI
    promptList.innerHTML = '';
    wheelPrompts.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = 'prompt-item';
        div.innerHTML = `<span>${p}</span><button onclick="removePrompt(${i})"><i data-lucide="trash"></i></button>`;
        promptList.appendChild(div);
    });
    lucide.createIcons();
}

window.removePrompt = (i) => {
    wheelPrompts.splice(i, 1);
    socket.emit('wheel_prompts_update', wheelPrompts);
};

addPromptBtn.addEventListener('click', () => {
    const val = newPromptInput.value.trim();
    if(val) {
        wheelPrompts.push(val);
        newPromptInput.value = '';
        socket.emit('wheel_prompts_update', wheelPrompts);
    }
});

socket.on('wheel_prompts_update', (prompts) => {
    wheelPrompts = prompts;
    renderWheelPrompts();
});

let currentRotation = 0;
spinBtn.addEventListener('click', () => {
    if(wheelPrompts.length === 0) return;
    const spins = Math.floor(Math.random() * 5) + 5; // 5 to 10 full spins
    const deg = Math.floor(Math.random() * 360);
    const totalRotation = currentRotation + (spins * 360) + deg;
    
    const slice = 360 / wheelPrompts.length;
    // Calculate which slice is at the top (pointer is at 0 degrees theoretically, but CSS rotate goes clockwise)
    const normalizedDeg = (totalRotation % 360);
    const winnerIndex = wheelPrompts.length - 1 - Math.floor(normalizedDeg / slice);
    
    socket.emit('wheel_spin', { rotation: totalRotation, winnerIndex: winnerIndex >= 0 ? winnerIndex : 0 });
});

socket.on('wheel_spin', (data) => {
    currentRotation = data.rotation;
    wheelEl.style.transform = `rotate(${currentRotation}deg)`;
    wheelResult.textContent = "Çevriliyor...";
    spinBtn.disabled = true;
    setTimeout(() => {
        wheelResult.textContent = `🎯 ${wheelPrompts[data.winnerIndex]}`;
        spinBtn.disabled = false;
        // Spawn ping around wheel for celebration
        spawnPing(window.innerWidth/2, window.innerHeight/2);
    }, 4000); // 4s CSS transition
});

// --- STICKY NOTES ---
noteBtn.addEventListener('click', () => {
    const id = 'note_' + Date.now();
    const note = { id, x: window.innerWidth/2, y: window.innerHeight/2, text: '', color: ['#fff9b1', '#ffc1cc', '#b8e1ff'][Math.floor(Math.random()*3)] };
    socket.emit('note_add', note);
});

socket.on('notes_sync', (notes) => {
    Object.values(notes).forEach(n => createNoteElement(n));
});

socket.on('note_add', (note) => { createNoteElement(note); });
socket.on('note_move', (data) => {
    const el = document.getElementById(data.id);
    if(el) { el.style.left = data.x + 'px'; el.style.top = data.y + 'px'; }
});
socket.on('note_edit', (data) => {
    const el = document.getElementById(data.id);
    if(el) { el.querySelector('textarea').value = data.text; }
});
socket.on('note_delete', (id) => {
    const el = document.getElementById(id);
    if(el) el.remove();
});

function createNoteElement(note) {
    if(document.getElementById(note.id)) return;
    const div = document.createElement('div');
    div.id = note.id;
    div.className = 'sticky-note';
    div.style.left = note.x + 'px';
    div.style.top = note.y + 'px';
    div.style.backgroundColor = note.color;
    
    div.innerHTML = `
        <div class="note-handle"></div>
        <div class="note-close">X</div>
        <textarea placeholder="Yaz...">${note.text}</textarea>
    `;
    notesContainer.appendChild(div);
    
    const handle = div.querySelector('.note-handle');
    const closeBtn = div.querySelector('.note-close');
    const ta = div.querySelector('textarea');
    
    closeBtn.onclick = () => socket.emit('note_delete', note.id);
    ta.oninput = () => socket.emit('note_edit', { id: note.id, text: ta.value });
    
    // Drag logic
    let isDragging = false, startX, startY;
    handle.onmousedown = (e) => { isDragging = true; startX = e.clientX - div.offsetLeft; startY = e.clientY - div.offsetTop; };
    document.addEventListener('mousemove', (e) => {
        if(!isDragging) return;
        let x = e.clientX - startX; let y = e.clientY - startY;
        div.style.left = x + 'px'; div.style.top = y + 'px';
        socket.emit('note_move', { id: note.id, x, y });
    });
    document.addEventListener('mouseup', () => isDragging = false);
    
    // Touch drag
    handle.addEventListener('touchstart', (e) => { isDragging = true; startX = e.touches[0].clientX - div.offsetLeft; startY = e.touches[0].clientY - div.offsetTop; }, {passive: true});
    document.addEventListener('touchmove', (e) => {
        if(!isDragging) return;
        let x = e.touches[0].clientX - startX; let y = e.touches[0].clientY - startY;
        div.style.left = x + 'px'; div.style.top = y + 'px';
        socket.emit('note_move', { id: note.id, x, y });
    }, {passive: true});
    document.addEventListener('touchend', () => isDragging = false);
}


// --- OTHER EXISTING LOGIC (Images, Draw, Pings) ---
imageBtn.addEventListener('click', () => imageUpload.click());
imageUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const dataUrl = event.target.result;
        drawImageToCanvas(dataUrl);
        socket.emit('image_upload', dataUrl);
    };
    reader.readAsDataURL(file);
});
socket.on('image_upload', (dataUrl) => drawImageToCanvas(dataUrl));

function drawImageToCanvas(dataUrl) {
    saveState();
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
        const scale = Math.min(1, (canvas.width * 0.8) / img.width, (canvas.height * 0.8) / img.height);
        const w = img.width * scale; const h = img.height * scale;
        const x = (canvas.width - w) / 2; const y = (canvas.height - h) / 2;
        ctx.drawImage(img, x, y, w, h);
        saveState();
    };
}

gameBtn.addEventListener('click', () => { 
    gameContainer.style.display = 'block';
    gameContainer.classList.remove('hidden'); 
    socket.emit('game_open'); 
});
socket.on('game_open', () => {
    // Only open if NOT on startup or if user is active
    // We'll keep it manual for now to satisfy the user request
    console.log('Game open request received');
});
closeGameBtn.addEventListener('click', () => {
    gameContainer.style.display = 'none';
    gameContainer.classList.add('hidden');
});

// --- NIGHT MODE & STARS ---
function initNightMode() {
    const hour = new Date().getHours();
    const isNight = hour >= 20 || hour < 7;
    if (isNight) setNightMode(true);
}

function setNightMode(active) {
    if (active) {
        document.body.classList.add('bg-night');
        document.body.classList.remove('bg-dark');
        nightModeBtn.innerHTML = '<i data-lucide="sun"></i>';
        generateStars();
    } else {
        document.body.classList.remove('bg-night');
        document.body.classList.add('bg-dark');
        nightModeBtn.innerHTML = '<i data-lucide="moon"></i>';
        starfield.innerHTML = '';
    }
    lucide.createIcons();
}

nightModeBtn.addEventListener('click', () => {
    const isNight = document.body.classList.contains('bg-night');
    setNightMode(!isNight);
    socket.emit('night_mode', !isNight);
});
socket.on('night_mode', (active) => setNightMode(active));

function generateStars() {
    starfield.innerHTML = '';
    const count = 150;
    for (let i = 0; i < count; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        const size = Math.random() * 2 + 1;
        const duration = Math.random() * 3 + 2;
        const opacity = Math.random() * 0.5 + 0.3;
        
        star.style.left = x + '%';
        star.style.top = y + '%';
        star.style.width = size + 'px';
        star.style.height = size + 'px';
        star.style.setProperty('--duration', duration + 's');
        star.style.setProperty('--opacity', opacity);
        starfield.appendChild(star);
    }
}

// --- MINI GAME (X-O-X) ---
let gameActive = true;
let currentPlayer = "X"; // Host is X usually
let gameState = ["", "", "", "", "", "", "", "", ""];
const winConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

cells.forEach(cell => {
    cell.addEventListener('click', () => {
        const index = cell.getAttribute('data-index');
        if (gameState[index] !== "" || !gameActive) return;
        
        // In this simple version, anyone can click, but let's try to sync
        socket.emit('ttt_move', { index, player: currentPlayer });
    });
});

socket.on('ttt_move', (data) => {
    gameState[data.index] = data.player;
    const cell = cells[data.index];
    cell.innerText = data.player;
    cell.classList.add(data.player.toLowerCase());
    
    checkResult();
    if (gameActive) {
        currentPlayer = data.player === "X" ? "O" : "X";
        gameStatus.innerText = `Sıra: ${currentPlayer}`;
    }
});

function checkResult() {
    let roundWon = false;
    for (let i = 0; i < winConditions.length; i++) {
        const winCondition = winConditions[i];
        let a = gameState[winCondition[0]];
        let b = gameState[winCondition[1]];
        let c = gameState[winCondition[2]];
        if (a === '' || b === '' || c === '') continue;
        if (a === b && b === c) { roundWon = true; break; }
    }

    if (roundWon) {
        gameWinner.innerText = `Kazanan: ${currentPlayer}! 🎉`;
        gameActive = false;
        if (currentPlayer === "X") fireConfetti();
        return;
    }

    let roundDraw = !gameState.includes("");
    if (roundDraw) {
        gameWinner.innerText = "Berabere! 🤝";
        gameActive = false;
        return;
    }
}

resetGameBtn.addEventListener('click', () => socket.emit('ttt_reset'));
socket.on('ttt_reset', () => {
    gameActive = true;
    currentPlayer = "X";
    gameState = ["", "", "", "", "", "", "", "", ""];
    gameWinner.innerText = "";
    gameStatus.innerText = "Sıra: X";
    cells.forEach(cell => {
        cell.innerText = "";
        cell.classList.remove('x', 'o');
    });
});

mirrorBtn.addEventListener('click', () => {
    isMirrorMode = !isMirrorMode;
    mirrorBtn.classList.toggle('active', isMirrorMode);
});

let isDrawing = false; let currentX = 0; let currentY = 0;

// Single, authoritative resize handler — no duplicate
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 300));

function saveState() {
    if (drawingHistory.length > 20) drawingHistory.shift();
    drawingHistory.push(canvas.toDataURL());
}

function restoreState(dataUrl) {
    const img = new Image(); img.src = dataUrl;
    img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const prevOp = ctx.globalCompositeOperation;
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(img, 0, 0);
        ctx.globalCompositeOperation = prevOp;
    };
}

function performUndo(emit) {
    if (!isAuthenticated || drawingHistory.length <= 1) return;
    drawingHistory.pop();
    restoreState(drawingHistory[drawingHistory.length - 1]);
    if (emit) socket.emit('undo');
}
undoBtn.addEventListener('click', () => performUndo(true));
socket.on('undo', () => performUndo(false));

function draw(x0, y0, x1, y1, color, size, toolType, emit, isMirroredCall = false) {
    if (!isAuthenticated) return;
    if (toolType === 'rainbow') {
        rainbowHue = (rainbowHue + 5) % 360;
        color = `hsl(${rainbowHue}, 100%, 50%)`;
    }
    if (toolType === 'laser') {
        laserPaths.push({ x0, y0, x1, y1, color, size, time: Date.now() });
    } else {
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
        ctx.strokeStyle = toolType === 'eraser' ? 'rgba(0,0,0,1)' : color;
        ctx.lineWidth = size; ctx.lineCap = 'round';
        const prevOp = ctx.globalCompositeOperation;
        ctx.globalCompositeOperation = toolType === 'eraser' ? 'destination-out' : 'source-over';
        ctx.stroke(); ctx.globalCompositeOperation = prevOp; ctx.closePath();
    }
    
    // Mirror logic
    if (isMirrorMode && !isMirroredCall) {
        const mx0 = canvas.width - x0;
        const mx1 = canvas.width - x1;
        draw(mx0, y0, mx1, y1, color, size, toolType, false, true);
    }
    
    if (emit && !isMirroredCall) socket.emit('draw', { x0, y0, x1, y1, color, size, toolType });
}

function renderLasers() {
    if (!isAuthenticated) return requestAnimationFrame(renderLasers);
    laserCtx.clearRect(0, 0, laserCanvas.width, laserCanvas.height);
    const now = Date.now();
    laserPaths = laserPaths.filter(p => now - p.time < 1500);
    laserPaths.forEach(p => {
        const opacity = 1 - ((now - p.time) / 1500);
        laserCtx.beginPath(); laserCtx.moveTo(p.x0, p.y0); laserCtx.lineTo(p.x1, p.y1);
        laserCtx.strokeStyle = p.color; laserCtx.globalAlpha = opacity; laserCtx.lineWidth = p.size; laserCtx.lineCap = 'round';
        laserCtx.shadowBlur = 10; laserCtx.shadowColor = p.color; laserCtx.stroke();
        laserCtx.globalAlpha = 1; laserCtx.shadowBlur = 0;
    });
    requestAnimationFrame(renderLasers);
}

function startDrawing(x, y) { isDrawing = true; currentX = x; currentY = y; }
function continueDrawing(x, y) {
    if (!isDrawing) return;
    draw(currentX, currentY, x, y, currentColor, sizePicker.value, currentTool, true);
    currentX = x; currentY = y;
}
function stopDrawing() { if (isDrawing && currentTool !== 'laser') saveState(); isDrawing = false; }

// --- DRAWING LISTENERS (UNIFIED POINTER EVENTS) ---
laserCanvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') e.preventDefault();
    startDrawing(e.clientX, e.clientY);
});

laserCanvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') e.preventDefault();
    continueDrawing(e.clientX, e.clientY);
    emitCursor(e.clientX, e.clientY);
});

laserCanvas.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'touch') e.preventDefault();
    stopDrawing();
});

laserCanvas.addEventListener('pointercancel', stopDrawing);
laserCanvas.addEventListener('pointerout', stopDrawing);

// (Resize handled by the single authoritative resizeCanvas listener above)

socket.on('draw', (data) => draw(data.x0, data.y0, data.x1, data.y1, data.color, data.size, data.toolType, false));

function clearCanvas(emit) {
    if (!isAuthenticated) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    saveState();
    if (emit) socket.emit('clear');
}
clearBtn.addEventListener('click', () => clearCanvas(true));
socket.on('clear', () => clearCanvas(false));

let lastCursorEmit = 0;
const remoteCursors = {};
const cursorsContainerEl = document.getElementById('cursorsContainer');

function createTrailParticle(x, y, color) {
    const particle = document.createElement('div');
    particle.className = 'trail-particle';
    particle.style.left = x + 'px';
    particle.style.top = y + 'px';
    // Match current color if possible
    particle.style.background = color || 'rgba(255, 255, 255, 0.8)';
    particle.style.boxShadow = `0 0 8px ${particle.style.background}`;
    document.body.appendChild(particle);
    setTimeout(() => particle.remove(), 800);
}

function emitCursor(x, y) {
    if (!isAuthenticated) return;
    const now = Date.now();
    if (now - lastCursorEmit > 30) {
        socket.emit('cursor', { x, y });
        lastCursorEmit = now;
        
        // Spawn trail locally
        if (Math.random() > 0.5) createTrailParticle(x, y, currentColor);
    }
}
socket.on('cursor', (data) => {
    if (data.id === socket.id) return;
    let cursorEl = remoteCursors[data.id];
    if (!cursorEl) {
        cursorEl = document.createElement('div'); cursorEl.className = 'remote-cursor';
        const mood = remoteMoods[data.id] ? ` ${remoteMoods[data.id]}` : '';
        // High visibility SVG cursor
        cursorEl.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 3L10.07 19.97L12.58 12.58L19.97 10.07L3 3Z" fill="#ff4d4d" stroke="white" stroke-width="2" stroke-linejoin="round"/>
            </svg>
            <div class="cursor-name">Karşı Taraf${mood}</div>
        `;
        cursorsContainerEl.appendChild(cursorEl); remoteCursors[data.id] = cursorEl;
    }
    cursorEl.style.left = data.x + 'px';
    cursorEl.style.top = data.y + 'px';
    cursorEl.style.display = 'block'; // Ensure visible
    if (Math.random() > 0.6) createTrailParticle(data.x, data.y, '#ff4d4d');
});
socket.on('user_disconnected', (id) => { 
    if (remoteCursors[id]) { remoteCursors[id].remove(); delete remoteCursors[id]; } 
    delete remoteMoods[id];
});

laserCanvas.addEventListener('dblclick', (e) => { spawnPing(e.clientX, e.clientY); socket.emit('ping_action', { x: e.clientX, y: e.clientY }); });

// --- GALLERY SYNC & SAVE ---
saveBtn.addEventListener('click', async () => {
    const dataUrl = canvas.toDataURL();
    try {
        const res = await fetch('/api/gallery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: dataUrl })
        });
        if (res.ok) {
            spawnPing(window.innerWidth/2, window.innerHeight/2, '✅');
            socket.emit('gallery_update');
        }
    } catch (e) { console.error(e); }
});

socket.on('gallery_update', () => {
    if (!galleryModal.classList.contains('hidden')) {
        refreshGallery();
    }
});

socket.on('ping_action', (data) => { if (data.id !== socket.id) spawnPing(data.x, data.y); });
function spawnPing(x, y) {
    const emojis = ['❤️', '✨', '🔥', '🥰'];
    for(let i=0; i<3; i++) {
        setTimeout(() => {
            const ping = document.createElement('div'); ping.className = 'ping-anim';
            ping.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            ping.style.left = x + 'px'; ping.style.top = y + 'px'; ping.style.marginLeft = (Math.random() * 40 - 20) + 'px';
            document.getElementById('pingsContainer').appendChild(ping);
            setTimeout(() => ping.remove(), 1500);
        }, i * 150);
    }
}

// Chat toggle handlers (exists in previous implementation, kept simple here to avoid duplication)
const chatPanelEl = document.getElementById('chatPanel');
document.getElementById('chatToggleBtn').addEventListener('click', () => chatPanelEl.classList.remove('hidden'));
document.getElementById('closeChatBtn').addEventListener('click', () => chatPanelEl.classList.add('hidden'));

let typingTimeout;
const chatInput = document.getElementById('chatInput');
chatInput.addEventListener('input', () => {
    socket.emit('typing', true);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => socket.emit('typing', false), 2000);
});

socket.on('typing', (data) => {
    const ind = document.getElementById('typingIndicator');
    if (data.isTyping && data.id !== socket.id) {
        ind.classList.remove('hidden');
    } else {
        ind.classList.add('hidden');
    }
});

// Chat logic from previous version
document.getElementById('sendChatBtn').addEventListener('click', () => {
    const text = chatInput.value.trim();
    if (!text) return; 
    socket.emit('chat_message', text); 
    chatInput.value = '';
    socket.emit('typing', false);
    clearTimeout(typingTimeout);
});
chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') document.getElementById('sendChatBtn').click(); });
socket.on('chat_message', (data) => {
    const isMine = data.id === socket.id;
    const msgDiv = document.createElement('div');
    msgDiv.className = `msg-bubble ${isMine ? 'msg-mine' : 'msg-theirs'}`;
    msgDiv.textContent = data.text;
    document.getElementById('chatMessages').appendChild(msgDiv);
    document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;
});
