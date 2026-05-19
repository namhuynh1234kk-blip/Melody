// ================= IMPORT =================
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const path = require('path');
const jwt = require('jsonwebtoken');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// ================= SOCKET =================
const io = new Server(server, {
  cors: { origin: '*' }
});

// ================= CONFIG =================
const SECRET_KEY = process.env.SECRET_KEY || "secret123";

// ================= MIDDLEWARE =================
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ================= MYSQL =================
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect(err => {
  if (err) {
    console.log('❌ MYSQL ERROR', err);
    return;
  }
  console.log('✅ MYSQL CONNECTED');
});

// ================= ROOMS MEMORY =================
const rooms = {};

// ================= SOCKET LOGIC =================
io.on("connection", (socket) => {

  console.log("User connected:", socket.id);

  // ================= CREATE ROOM =================
  socket.on("room:create", ({ username, password }) => {

    const code = Math.random().toString(36).substring(2, 6).toUpperCase();

    rooms[code] = {
      code,
      password: password || "",
      dj: socket.id,
      members: [
        { id: socket.id, username }
      ],
      song: null,
      isPlaying: false,
      currentTime: 0
    };

    socket.join(code);

    socket.emit("room:created", rooms[code]);
  });
socket.on("chat:send", ({ roomCode, username, message }) => {

  const room = rooms[roomCode];
  if (!room) return;

  io.to(roomCode).emit("chat:receive", {
    username,
    message,
    time: Date.now()
  });

}); 
  // ================= JOIN ROOM =================
  socket.on("room:join", ({ roomCode, username }) => {

  const room = rooms[roomCode];
  if (!room) {
    socket.emit("room:error", "Room không tồn tại");
    return;
  }

  socket.join(roomCode);

  room.members.push({ username, id: socket.id });

  io.to(roomCode).emit("room:update", room);

  // ✅ FIRE EVENT CHO TOÀN PHÒNG
  io.to(roomCode).emit("user-joined", {
    username,
    message: `${username} vừa tham gia phòng 🎧`
  });

});

  // ================= LEAVE ROOM =================
  socket.on("disconnect", () => {

    for (const code in rooms) {

      const room = rooms[code];

      room.members = room.members.filter(m => m.id !== socket.id);

      // nếu DJ out → chuyển DJ
      if (room.dj === socket.id) {
        room.dj = room.members[0]?.id || null;
      }

      // xoá room nếu trống
      if (room.members.length === 0) {
        delete rooms[code];
        continue;
      }

      io.to(code).emit("room:update", room);
    }
  });

  // ================= MUSIC SYNC =================
  socket.on("player:play", ({ roomCode, song, currentTime }) => {

    const room = rooms[roomCode];
    if (!room) return;

    room.song = song;
    room.isPlaying = true;
    room.currentTime = currentTime || 0;

    io.to(roomCode).emit("player:play", {
      song,
      currentTime
    });
  });

  socket.on("player:pause", ({ roomCode, currentTime }) => {

  const room = rooms[roomCode];
  if (!room) return;

  room.isPlaying = false;
  room.currentTime = currentTime || 0;

  io.to(roomCode).emit("player:pause", {
    currentTime
  });
});

});
// io.on('connection', (socket) => {

//   socket.on('room:join', (data) => {
//     socket.join(data.roomCode);
//   });

//   socket.on('chat:send', (data) => {
//     // data = { roomCode, username, message }

//     io.to(data.roomCode).emit('chat:new', {
//       username: data.username,
//       message: data.message,
//       time: Date.now()
//     });
//   });

// });
// socket.on("join-room", ({ roomCode, username }) => {
//   socket.join(roomCode);

//   // báo cho tất cả trong phòng
//   io.to(roomCode).emit("user-joined", {
//     username,
//     message: `${username} vừa tham gia phòng 🎧`
//   });
// });
// ================= REST API =================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get("/api/me", (req, res) => {
  res.json({ ok: true });
});
// ================= START =================
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("🚀 SERVER RUNNING");
  console.log("PORT:", PORT);
});
