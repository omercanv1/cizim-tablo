const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Sizin belirleyeceğiniz kullanıcı adı ve şifre
const VALID_USERNAME = 'biz';
const VALID_PASSWORD = '123'; // Bunu daha sonra değiştirebilirsiniz

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    let isAuthenticated = false;

    // Login event
    socket.on('login', (data) => {
        if (data.username === VALID_USERNAME && data.password === VALID_PASSWORD) {
            isAuthenticated = true;
            socket.emit('login_success');
            console.log('User logged in successfully:', socket.id);
        } else {
            socket.emit('login_error', 'Kullanıcı adı veya şifre hatalı!');
        }
    });

    socket.on('draw', (data) => {
        if (!isAuthenticated) return;
        socket.broadcast.emit('draw', data);
    });

    socket.on('clear', () => {
        if (!isAuthenticated) return;
        io.emit('clear');
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
