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
      currentTime: 0,
      messages: [] // Khởi tạo mảng lưu lịch sử chat
    };

    socket.join(code);
    socket.emit("room:created", rooms[code]);
  });

  // ================= CHAT =================
  socket.on("chat:send", ({ roomCode, username, message, isEmoji = false }) => {
    const room = rooms[roomCode];
    if (!room) return;

    const isDj = room.dj === socket.id;

    const msgData = {
      username,
      message,
      time: Date.now(),
      senderId: socket.id,
      isEmoji,
      role: isDj ? 'dj' : 'member'
    };

    // Đảm bảo mảng messages tồn tại trước khi push
    if (!room.messages) room.messages = [];
    room.messages.push(msgData); 

    io.to(roomCode).emit("chat:receive", msgData);
  }); 

  // ================= JOIN ROOM =================
  socket.on("room:join", (data) => {
    if (!data) return;
    
    const roomCode = data.roomCode ? data.roomCode.trim().toUpperCase() : null;
    const username = data.username || "Ẩn danh";

    const room = rooms[roomCode];
    if (!room) {
      socket.emit("room:error", "Room không tồn tại");
      return;
    }

    if (room.password && data.password !== room.password) {
      socket.emit("room:error", "Sai mật khẩu phòng!");
      return;
    }

    socket.join(roomCode);

    // Kiểm tra và khởi tạo mảng nếu chưa có
    if (!room.messages) {
      room.messages = [];
    }

    const isExist = room.members.some(m => m.id === socket.id);
    if (!isExist) {
      room.members.push({ id: socket.id, username });
    }

    io.to(roomCode).emit("room:update", room);
    
    // Tạo tin nhắn hệ thống thông báo người dùng vào phòng
    const joinMsg = {
      isSystem: true,
      message: `🎵 ${username} đã tham gia phòng nghe nhạc.`
    };
    room.messages.push(joinMsg);

    io.to(roomCode).emit("chat:receive", joinMsg);
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

    // Lưu thông báo hệ thống khi phát bài hát vào lịch sử chat
    const playMsg = {
      isSystem: true,
      message: `▶️ DJ đang phát bài hát: ${song.title} - ${song.artist}`
    };
    if (!room.messages) room.messages = [];
    room.messages.push(playMsg);

    io.to(roomCode).emit("chat:receive", playMsg);
  });

  socket.on("player:pause", ({ roomCode, currentTime }) => {
    const room = rooms[roomCode];
    if (!room) return;

    room.isPlaying = false;
    room.currentTime = currentTime || 0;

    io.to(roomCode).emit("player:pause", {
      currentTime
    });

    // Lưu thông báo hệ thống khi tạm dừng vào lịch sử chat
    const pauseMsg = {
      isSystem: true,
      message: `⏸️ DJ đã tạm dừng bài nhạc.`
    };
    if (!room.messages) room.messages = [];
    room.messages.push(pauseMsg);

    io.to(roomCode).emit("chat:receive", pauseMsg);
  });

  // ================= ĐỔI QUYỀN DJ =================
  socket.on("room:change-role", ({ roomCode, targetId, newRole }) => {
    const room = rooms[roomCode];
    if (!room) return;

    if (room.dj !== socket.id) {
      return socket.emit("room:error", "Bạn không có quyền quản lý!");
    }

    if (newRole === 'dj') {
      room.dj = targetId;
    } else if (newRole === 'member' && room.dj === targetId) {
      room.dj = room.members.find(m => m.id !== targetId)?.id || targetId;
    }

    io.to(roomCode).emit("room:update", room);
  });

  // ================= KICK THÀNH VIÊN =================
  socket.on("room:kick", ({ roomCode, targetId }) => {
    const room = rooms[roomCode];
    if (!room) return;

    if (room.dj !== socket.id) {
      return socket.emit("room:error", "Bạn không có quyền kick người khác!");
    }

    const kickedMember = room.members.find(m => m.id === targetId);
    if (kickedMember) {
      io.to(targetId).emit("room:kicked-notice", "Bạn đã bị DJ kick khỏi phòng!");
    }

    room.members = room.members.filter(m => m.id !== targetId);

    if (room.dj === targetId) {
      room.dj = room.members[0]?.id || null;
    }

    const targetSocket = io.sockets.sockets.get(targetId);
    if (targetSocket) {
      targetSocket.leave(roomCode);
    }

    io.to(roomCode).emit("room:update", room);
  });

  // ================= DISCONNECT =================
  socket.on("disconnect", () => {
    for (const code in rooms) {
      const room = rooms[code];
      room.members = room.members.filter(m => m.id !== socket.id);

      if (room.dj === socket.id) {
        room.dj = room.members[0]?.id || null;
      }

      if (room.members.length === 0) {
        delete rooms[code];
        continue;
      }

      io.to(code).emit("room:update", room);
    }
  });
}); // 👈 DẤU ĐÓNG KHỐI IO.ON QUAN TRỌNG ĐÃ ĐƯỢC DỜI XUỐNG ĐÂY!

// ================= REST API =================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get("/api/me", (req, res) => {
  res.json({ ok: true });
});
socket.on('player:play', (data) => {

    socket.to(data.roomCode)
        .emit('player:play', data);

});
socket.on('player:pause', (data) => {

    socket.to(data.roomCode)
        .emit('player:pause', data);

});

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

app.get('/api/songs', (req, res) => {
  db.query(`SELECT * FROM songs ORDER BY id DESC`, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result || []);
  });
});

app.post('/api/songs', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { title, artist, src, cover, type, category } = req.body;
  db.query(`INSERT INTO songs (title, artist, src, cover, type, category, liked, play_count) VALUES (?, ?, ?, ?, ?, ?, 0, 0)`, 
    [title, artist, src, cover, type, category], (err, result) => {
      if (err) return res.status(500).json(err);
      res.json({ success: true, id: result.insertId });
    });
});

app.put('/api/songs/:id', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { title, artist, src, cover, type, category } = req.body;
  db.query(`UPDATE songs SET title=?, artist=?, src=?, cover=?, type=?, category=? WHERE id=?`,
    [title, artist, src, cover, type, category, req.params.id], (err) => {
      if (err) return res.status(500).json(err);
      res.json({ success: true });
    });
});

app.delete('/api/songs/:id', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  db.query(`DELETE FROM songs WHERE id=?`, [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ success: true });
  });
});

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

app.get('/api/library', auth, (req, res) => {
  db.query(`SELECT songs.* FROM favorites JOIN songs ON favorites.song_id = songs.id WHERE favorites.user_id = ? ORDER BY favorites.id DESC`,
    [req.user.id], (err, result) => {
      if (err) return res.json([]);
      res.json(result || []);
    });
});

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

app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ================= START =================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("🚀 SERVER RUNNING ON PORT:", PORT);
});
