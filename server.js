const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { maxHttpBufferSize: 1e7 });

const VALID_USERNAME = 'biz';
const VALID_PASSWORD = '123';

app.use(express.json({ limit: '50mb' })); // For gallery uploads

app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Gallery API
const galleryPath = path.join(__dirname, 'public', 'gallery');
if (!fs.existsSync(galleryPath)) {
    fs.mkdirSync(galleryPath, { recursive: true });
}

app.post('/api/gallery', (req, res) => {
    const { image } = req.body;
    if (!image) return res.status(400).send('No image provided');
    
    const base64Data = image.replace(/^data:image\/png;base64,/, "");
    const filename = `cizim_${Date.now()}.png`;
    
    fs.writeFile(path.join(galleryPath, filename), base64Data, 'base64', (err) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error saving image');
        }
        res.json({ success: true, filename });
    });
});

app.get('/api/gallery', (req, res) => {
    fs.readdir(galleryPath, (err, files) => {
        if (err) return res.status(500).send('Error reading gallery');
        const images = files.filter(f => f.endsWith('.png')).sort().reverse();
        res.json(images);
    });
});

app.delete('/api/gallery/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(galleryPath, filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});


// State
let wheelPrompts = [
    "Bir şarkı söyle", 
    "En sevdiğin anımızı çiz", 
    "Bana komik bir selfie at", 
    "Sol elinle bir kedi çiz", 
    "Bana bir soru sor", 
    "En son dinlediğin şarkıyı aç"
];
let notes = {}; // { id: {x, y, text, color} }
let currentSpotifyUrl = "https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM3M"; // Default chill playlist

const songLibrary = [
    { name: "Perfect - Ed Sheeran", id: "2Vv-BfVoq4g", type: "romantic" },
    { name: "Blinding Lights - The Weeknd", id: "4NRXx6U8ABQ", type: "upbeat" },
    { name: "Beni Çok Sev - Tarkan", id: "NoV-_VupGHU", type: "romantic" },
    { name: "Aşkın Olayım - Simge", id: "VREnTCTeS4k", type: "upbeat" },
    { name: "Antidepresan - Mabel Matiz", id: "i6CSvLvSNZ4", type: "chill" },
    { name: "Bi' Tek Ben Anlarım - KÖFN", id: "9TSf2k03HPA", type: "upbeat" },
    { name: "Seni Dert Etmeler - Madrigal", id: "h5oHhGlWKf0", type: "chill" },
    { name: "Dünyadan Uzak - Pinhani", id: "cKLzfnf6Y_Y", type: "chill" },
    { name: "Senden Daha Güzel - Duman", id: "3bfkyXtuIXk", type: "upbeat" },
    { name: "Bir Kadın Çizeceksin - maNga", id: "M-rZ3602Lm8", type: "upbeat" },
    { name: "Mert Demir - Ateşe Düştüm", id: "0tgVpS96YAnpXDORuS9Z6n", type: "chill" },
    { name: "Zeynep Bastık - Lan", id: "1dGrvSjrRSyebev4MWBqZ1", type: "upbeat" },
    { name: "Hadise - Feryat", id: "5uCax9HTjHqARLY00MBIoj", type: "romantic" },
    { name: "Teoman - Papatya", id: "4Cu8eFxrKBhmkVdMVEH7Kj", type: "chill" },
    { name: "Mor ve Ötesi - Bir Derdim Var", id: "47m9fV9XqY7xR8W7Z1v9Cq", type: "upbeat" },
    { name: "Starboy - The Weeknd", id: "34Na4j8AVgA", type: "upbeat" },
    { name: "All of Me - John Legend", id: "450p7goxZqg", type: "romantic" },
    { name: "Flowers - Miley Cyrus", id: "G7KNmW9a75Y", type: "upbeat" },
    { name: "As It Was - Harry Styles", id: "H5v3kku4y6Q", type: "upbeat" },
    { name: "Anti-Hero - Taylor Swift", id: "b1kbLwvqugk", type: "upbeat" },
    { name: "Cruel Summer - Taylor Swift", id: "1BxfuBpkRfST7UIYvYpG01", type: "upbeat" },
    { name: "Die For You - The Weeknd", id: "u9n7L6S5Kk8", type: "romantic" },
    { name: "Levitating - Dua Lipa", id: "TUVcZfQe-Kw", type: "upbeat" },
    { name: "Uptown Funk - Bruno Mars", id: "OPf0YbXqDm0", type: "upbeat" },
    { name: "Believer - Imagine Dragons", id: "7wtfhZwyrp8", type: "upbeat" },
    { name: "Yellow - Coldplay", id: "yKNxeF4KMsY", type: "romantic" },
    { name: "Do I Wanna Know? - Arctic Monkeys", id: "bpOSxM0rNPM", type: "upbeat" },
    { name: "Bohemian Rhapsody - Queen", id: "fJ9rUzIMcZQ", type: "upbeat" },
    { name: "Heat Waves - Glass Animals", id: "mRD0-GxqHVo", type: "chill" },
    { name: "Vampire - Olivia Rodrigo", id: "RlPNh_PB6Ww", type: "romantic" },
    // Playlists (YouTube Playlists use list=ID)
    { name: "Lo-fi Chill Beats", id: "jfKfPfyJRdk", type: "chill", isPlaylist: true },
    { name: "Turkish Pop Hits 2024", id: "85u6rF8L0QY", type: "upbeat", isPlaylist: true },
    { name: "Deep Focus", id: "MT06A9Z3H2s", type: "focus", isPlaylist: true },
    { name: "90s Turkish Pop", id: "yW3BAt9B6p8", type: "upbeat", isPlaylist: true },
    { name: "Romantic Dinner", id: "37i9dQZF1DXbm07Umg9f9N", type: "romantic", isPlaylist: true }
];

// Map moods to library types
const moodToType = {
    '❤️': 'romantic',
    '🎨': 'focus',
    '💤': 'chill',
    '🤣': 'upbeat',
    '🤔': 'chill'
};


io.on('connection', (socket) => {
    let isAuthenticated = false;

    socket.on('login', (data) => {
        if (data.username === VALID_USERNAME && data.password === VALID_PASSWORD) {
            isAuthenticated = true;
            socket.emit('login_success');
            console.log('User logged in successfully:', socket.id);
            
            // Send current state
            socket.emit('wheel_prompts_update', wheelPrompts);
            socket.emit('notes_sync', notes);
            if(currentSpotifyUrl) socket.emit('spotify_update', currentSpotifyUrl);
        } else {
            socket.emit('login_error', 'Kullanıcı adı veya şifre hatalı!');
        }
    });

    // Basic Drawing
    socket.on('draw', (data) => { if (isAuthenticated) socket.broadcast.emit('draw', data); });
    socket.on('clear', () => { if (isAuthenticated) io.emit('clear'); });
    socket.on('undo', () => { if (isAuthenticated) io.emit('undo'); });
    socket.on('bg_change', (bgClass) => { if (isAuthenticated) io.emit('bg_change', bgClass); });
    socket.on('chat_message', (msg) => { if (isAuthenticated) io.emit('chat_message', { id: socket.id, text: msg }); });
    socket.on('cursor', (data) => { if (isAuthenticated) socket.broadcast.emit('cursor', { id: socket.id, x: data.x, y: data.y }); });
    socket.on('ping_action', (data) => { if (isAuthenticated) io.emit('ping_action', { id: socket.id, x: data.x, y: data.y }); });
    socket.on('image_upload', (dataUrl) => { if (isAuthenticated) socket.broadcast.emit('image_upload', dataUrl); });

    // --- NEW FEATURES ---

    // YouTube Media Sync
    socket.on('yt_load', (videoId) => {
        if (!isAuthenticated) return;
        io.emit('yt_load', { id: socket.id, videoId });
    });
    socket.on('yt_state', (data) => {
        if (!isAuthenticated) return;
        // Broadcast play/pause state and current time
        socket.broadcast.emit('yt_state', { ...data, id: socket.id });
    });
    socket.on('yt_sync', (time) => {
        if (!isAuthenticated) return;
        socket.broadcast.emit('yt_sync', { time, id: socket.id });
    });

    // Wheel
    socket.on('wheel_spin', (data) => {
        if (!isAuthenticated) return;
        io.emit('wheel_spin', data); // data: { rotation, winnerIndex }
    });
    
    socket.on('wheel_prompts_update', (prompts) => {
        if (!isAuthenticated) return;
        wheelPrompts = prompts;
        io.emit('wheel_prompts_update', prompts);
    });

    // Sticky Notes
    socket.on('note_add', (note) => {
        if (!isAuthenticated) return;
        notes[note.id] = note;
        io.emit('note_add', note);
    });
    
    socket.on('note_move', (data) => {
        if (!isAuthenticated || !notes[data.id]) return;
        notes[data.id].x = data.x;
        notes[data.id].y = data.y;
        socket.broadcast.emit('note_move', data);
    });
    
    socket.on('note_edit', (data) => {
        if (!isAuthenticated || !notes[data.id]) return;
        notes[data.id].text = data.text;
        socket.broadcast.emit('note_edit', data);
    });
    
    socket.on('note_delete', (id) => {
        if (!isAuthenticated) return;
        delete notes[id];
        io.emit('note_delete', id);
    });

    // Confetti
    socket.on('confetti', () => {
        if (!isAuthenticated) return;
        io.emit('confetti', socket.id);
    });

    // Mood
    socket.on('mood_change', (mood) => {
        if (!isAuthenticated) return;
        io.emit('mood_change', { id: socket.id, mood });
    });

    // Typing
    socket.on('typing', (isTyping) => {
        if (!isAuthenticated) return;
        socket.broadcast.emit('typing', { id: socket.id, isTyping });
    });

    // YouTube Music (Shared Playback)
    socket.on('youtube_set', (id, isPlaylist = false) => {
        if (!isAuthenticated) return;
        currentYouTubeId = { id, isPlaylist };
        io.emit('youtube_update', currentYouTubeId);
    });

    socket.on('youtube_control', (data) => {
        // data: { action: 'play'|'pause'|'seek', time: number }
        if (!isAuthenticated) return;
        socket.broadcast.emit('youtube_control', data);
    });

    socket.on('youtube_search', (query) => {
        if (!isAuthenticated) return;
        const results = songLibrary.filter(s => 
            s.name.toLowerCase().includes(query.toLowerCase()) || 
            s.type.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 10); // Show more results
        socket.emit('youtube_search_results', results);
    });

    socket.on('youtube_surprise', () => {
        if (!isAuthenticated) return;
        const randomSong = songLibrary[Math.floor(Math.random() * songLibrary.length)];
        currentYouTubeId = { id: randomSong.id, isPlaylist: randomSong.isPlaylist };
        io.emit('youtube_update', currentYouTubeId);
    });

    socket.on('youtube_mood_sync', (mood) => {
        if (!isAuthenticated) return;
        const type = moodToType[mood];
        if (type) {
            const matches = songLibrary.filter(s => s.type === type);
            if (matches.length > 0) {
                const pick = matches[Math.floor(Math.random() * matches.length)];
                currentYouTubeId = { id: pick.id, isPlaylist: pick.isPlaylist };
                io.emit('youtube_update', currentYouTubeId);
            }
        }
    });

    socket.on('youtube_reaction', (reaction) => {
        if (!isAuthenticated) return;
        io.emit('youtube_reaction', { id: socket.id, reaction });
    });

    // Mini Games (Tic-Tac-Toe)
    socket.on('game_open', () => {
        if (!isAuthenticated) return;
        socket.broadcast.emit('game_open');
    });

    socket.on('ttt_move', (data) => {
        if (!isAuthenticated) return;
        io.emit('ttt_move', data);
    });

    socket.on('ttt_reset', () => {
        if (!isAuthenticated) return;
        io.emit('ttt_reset');
    });

    // Sync State for New Joiners
    socket.on('request_canvas_state', (toId) => {
        socket.broadcast.emit('request_canvas_state', toId);
    });
    socket.on('canvas_state_send', (data) => {
        io.to(data.to).emit('canvas_state_receive', data.image);
    });

    // Night Mode
    socket.on('night_mode', (active) => {
        if (!isAuthenticated) return;
        socket.broadcast.emit('night_mode', active);
    });

    socket.on('gallery_update', () => {
        if (!isAuthenticated) return;
        socket.broadcast.emit('gallery_update');
    });

    socket.on('disconnect', () => {
        io.emit('user_disconnected', socket.id);
    });
});

// Final 404 Handler
app.use((req, res) => {
    console.warn(`[${new Date().toLocaleTimeString()}] 404 NOT FOUND: ${req.url}`);
    res.status(404).sendFile(path.join(__dirname, 'public', 'index.html')); // Fallback to index if something is weird
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on all interfaces at http://0.0.0.0:${PORT}`);
});
