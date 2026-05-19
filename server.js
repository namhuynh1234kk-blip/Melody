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
// ===============================================================
// ĐOẠN VIẾT THÊM: CÁC REST API ĐỂ FIX LỖI LOAD BÀI (KHÔNG SỬA CODE CŨ)
// ===============================================================

// Middleware xác thực token (Frontend dùng Bearer token)
function auth(req, res, next) {
  let token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: 'Chưa đăng nhập' });
  if (token.startsWith('Bearer ')) token = token.slice(7);
  try {
    req.user = jwt.verify(token, SECRET_KEY);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token không hợp lệ' });
  }
}

// API Đăng ký
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Thiếu dữ liệu' });
  db.query('SELECT * FROM users WHERE username=?', [username], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.length > 0) return res.status(400).json({ error: 'Username đã tồn tại' });
    db.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, password, 'user'], (err2) => {
      if (err2) return res.status(500).json(err2);
      res.json({ success: true });
    });
  });
});

// API Đăng nhập
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.query('SELECT * FROM users WHERE username=?', [username], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.length === 0) return res.status(401).json({ error: 'Sai tài khoản' });
    const user = result[0];
    if (password !== user.password) return res.status(401).json({ error: 'Sai mật khẩu' });
    const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, SECRET_KEY, { expiresIn: '7d' });
    res.json({ token: "Bearer " + token, user: { id: user.id, username: user.username, role: user.role } });
  });
});

// API LẤY BÀI HÁT (Fix lỗi GET /api/songs 404)
app.get('/api/songs', (req, res) => {
  db.query(`SELECT * FROM songs ORDER BY id DESC`, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result || []);
  });
});

// API Thêm bài hát
app.post('/api/songs', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { title, artist, src, cover, type, category } = req.body;
  db.query(`INSERT INTO songs (title, artist, src, cover, type, category, liked, play_count) VALUES (?, ?, ?, ?, ?, ?, 0, 0)`, 
    [title, artist, src, cover, type, category], (err, result) => {
      if (err) return res.status(500).json(err);
      res.json({ success: true, id: result.insertId });
    });
});

// API Cập nhật bài hát
app.put('/api/songs/:id', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { title, artist, src, cover, type, category } = req.body;
  db.query(`UPDATE songs SET title=?, artist=?, src=?, cover=?, type=?, category=? WHERE id=?`,
    [title, artist, src, cover, type, category, req.params.id], (err) => {
      if (err) return res.status(500).json(err);
      res.json({ success: true });
    });
});

// API Xóa bài hát
app.delete('/api/songs/:id', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  db.query(`DELETE FROM songs WHERE id=?`, [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ success: true });
  });
});

// API Yêu thích (Thả tim)
app.post('/api/favorite/:songId', auth, (req, res) => {
  db.query(`SELECT * FROM favorites WHERE user_id=? AND song_id=?`, [req.user.id, req.params.songId], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.length > 0) {
      db.query(`DELETE FROM favorites WHERE user_id=? AND song_id=?`, [req.user.id, req.params.songId], () => res.json({ liked: false }));
    } else {
      db.query(`INSERT INTO favorites (user_id, song_id) VALUES (?, ?)`, [req.user.id, req.params.songId], () => res.json({ liked: true }));
    }
  });
});

// API Thư viện bài hát đã thích
app.get('/api/library', auth, (req, res) => {
  db.query(`SELECT songs.* FROM favorites JOIN songs ON favorites.song_id = songs.id WHERE favorites.user_id = ? ORDER BY favorites.id DESC`,
    [req.user.id], (err, result) => {
      if (err) return res.json([]);
      res.json(result || []);
    });
});

// API Khám phá (Discover)
app.get('/api/discover', (req, res) => {
  db.query(`SELECT * FROM songs ORDER BY RAND() LIMIT 8`, (err1, recommended) => {
    db.query(`SELECT * FROM songs ORDER BY play_count DESC LIMIT 8`, (err2, trending) => {
      db.query(`SELECT * FROM songs WHERE liked=1 ORDER BY id DESC LIMIT 8`, (err3, liked) => {
        db.query(`SELECT * FROM songs ORDER BY id DESC LIMIT 3`, (err4, latest) => {
          res.json({ recommended, trending, liked, latest });
        });
      });
    });
  });
});

// Fallback nhận diện tất cả các route khác để tránh lỗi hiển thị HTML
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
// ================= START =================
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("🚀 SERVER RUNNING");
  console.log("PORT:", PORT);
});
