const socket = io();

// UI Elements
const loginScreen = document.getElementById('loginScreen');
const appScreen = document.getElementById('appScreen');
const loginBtn = document.getElementById('loginBtn');
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const errorMsg = document.getElementById('errorMsg');

const canvas = document.getElementById('drawingCanvas');
const ctx = canvas.getContext('2d');
const colorPicker = document.getElementById('colorPicker');
const sizePicker = document.getElementById('sizePicker');
const clearBtn = document.getElementById('clearBtn');

let isAuthenticated = false;

// --- LOGIN LOGIC ---
loginBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    
    if(!username || !password) {
        errorMsg.textContent = 'Lütfen tüm alanları doldurun.';
        return;
    }
    
    errorMsg.textContent = 'Giriş yapılıyor...';
    socket.emit('login', { username, password });
});

// Also allow pressing Enter to login
passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loginBtn.click();
});

socket.on('login_success', () => {
    isAuthenticated = true;
    loginScreen.style.display = 'none';
    appScreen.style.display = 'block';
    resizeCanvas(); // Ensure canvas is sized properly when revealed
});

socket.on('login_error', (msg) => {
    errorMsg.textContent = msg;
});

// --- DRAWING LOGIC ---
let isDrawing = false;
let currentX = 0;
let currentY = 0;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);

function draw(x0, y0, x1, y1, color, size, emit) {
    if (!isAuthenticated) return;
    
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.closePath();

    if (!emit) { return; }
    
    socket.emit('draw', {
        x0: x0,
        y0: y0,
        x1: x1,
        y1: y1,
        color: color,
        size: size
    });
}

// Mouse events
canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    currentX = e.clientX;
    currentY = e.clientY;
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) { return; }
    draw(currentX, currentY, e.clientX, e.clientY, colorPicker.value, sizePicker.value, true);
    currentX = e.clientX;
    currentY = e.clientY;
});

canvas.addEventListener('mouseup', () => {
    isDrawing = false;
});

canvas.addEventListener('mouseout', () => {
    isDrawing = false;
});

// Touch events for mobile support (iPhone)
canvas.addEventListener('touchstart', (e) => {
    isDrawing = true;
    currentX = e.touches[0].clientX;
    currentY = e.touches[0].clientY;
}, { passive: true });

canvas.addEventListener('touchmove', (e) => {
    if (!isDrawing) { return; }
    draw(currentX, currentY, e.touches[0].clientX, e.touches[0].clientY, colorPicker.value, sizePicker.value, true);
    currentX = e.touches[0].clientX;
    currentY = e.touches[0].clientY;
}, { passive: true });

canvas.addEventListener('touchend', () => {
    isDrawing = false;
});

canvas.addEventListener('touchcancel', () => {
    isDrawing = false;
});

// Clear canvas logic
function clearCanvas(emit) {
    if (!isAuthenticated) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!emit) { return; }
    socket.emit('clear');
}

clearBtn.addEventListener('click', () => {
    clearCanvas(true);
});

// Receive data from server
socket.on('draw', (data) => {
    draw(data.x0, data.y0, data.x1, data.y1, data.color, data.size, false);
});

socket.on('clear', () => {
    clearCanvas(false);
});
