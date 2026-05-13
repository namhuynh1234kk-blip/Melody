
// ================= IMPORT =================

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();

// ================= FIX: SECRET KEY =================
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

// ================= CONNECT MYSQL =================

db.connect((err) => {

  if (err) {
    console.log('❌ MYSQL ERROR');
    console.log(err);
    return;
  }

  console.log('✅ MYSQL CONNECTED');

});

// ================= AUTH (FIXED BEARER + SECRET) =================

function auth(req, res, next) {

  let token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // FIX: remove Bearer
  if (token.startsWith('Bearer ')) {
    token = token.slice(7);
  }

  try {

    const decoded = jwt.verify(token, SECRET_KEY);

    req.user = decoded;

    next();

  } catch (err) {

    return res.status(401).json({ error: 'Invalid token' });

  }

}

// ================= ADMIN ONLY =================

function adminOnly(req, res, next) {

  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }

  next();

}

// ================= HOME =================

app.get('/', (req, res) => {

  res.sendFile(path.join(__dirname, 'index.html'));

});

// ================= REGISTER =================

app.post('/api/register', (req, res) => {

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Thiếu dữ liệu' });
  }

  db.query(
    'SELECT * FROM users WHERE username=?',
    [username],
    (err, result) => {

      if (err) return res.status(500).json(err);

      if (result.length > 0) {
        return res.status(400).json({ error: 'Username đã tồn tại' });
      }

      db.query(
        `INSERT INTO users (username, password, role)
         VALUES (?, ?, ?)`,
        [username, password, 'user'],
        (err2) => {

          if (err2) return res.status(500).json(err2);

          res.json({ success: true });

        }
      );

    }
  );

});

// ================= LOGIN =================

app.post('/api/login', (req, res) => {

  const { username, password } = req.body;

  db.query(
    'SELECT * FROM users WHERE username=?',
    [username],
    (err, result) => {

      if (err) return res.status(500).json(err);

      if (result.length === 0) {
        return res.status(401).json({ error: 'Sai tài khoản' });
      }

      const user = result[0];

      if (password !== user.password) {
        return res.status(401).json({ error: 'Sai mật khẩu' });
      }

      const token = jwt.sign(
        {
          id: user.id,
          role: user.role,
          username: user.username
        },
        SECRET_KEY,
        { expiresIn: '7d' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      });

    }
  );

});

// ================= GET SONGS =================

app.get('/api/songs', (req, res) => {

  db.query(
    `SELECT * FROM songs ORDER BY id DESC`,
    (err, result) => {

      if (err) return res.status(500).json(err);

      res.json(result || []);

    }
  );

});

// ================= ADD SONG =================

app.post('/api/songs', auth, adminOnly, (req, res) => {
  // 1. Thêm 'category' vào phần Destructuring để lấy dữ liệu từ Frontend gửi lên
  const { title, artist, src, cover, type, category } = req.body;

  // 2. Thêm cột 'category' vào câu lệnh INSERT và thêm 1 dấu chấm hỏi (?)
  db.query(
    `INSERT INTO songs (title, artist, src, cover, type, category, liked, play_count)
     VALUES (?, ?, ?, ?, ?, ?, 0, 0)`, 
    // 3. Thêm biến 'category' vào mảng tham số truyền vào (đúng thứ tự với dấu ?)
    [title, artist, src, cover, type, category], 
    (err, result) => {
      if (err) {
        console.error("Lỗi DB:", err); // Nên log lỗi ra để dễ kiểm tra
        return res.status(500).json(err);
      }

      res.json({
        success: true,
        id: result.insertId
      });
    }
  );
});
// ================= DELETE =================

app.delete('/api/songs/:id', auth, adminOnly, (req, res) => {

  db.query(
    `DELETE FROM songs WHERE id=?`,
    [req.params.id],
    (err) => {

      if (err) return res.status(500).json(err);

      res.json({ success: true });

    }
  );

});

// ================= UPDATE =================

app.put('/api/songs/:id', auth, adminOnly, (req, res) => {

  const { title, artist, src, cover, type } = req.body;

  db.query(
    `UPDATE songs
     SET title=?, artist=?, src=?, cover=?, type=?, category=?
     WHERE id=?`,
    [title, artist, src, cover, type, req.params.id],
    (err) => {

      if (err) return res.status(500).json(err);

      res.json({ success: true });

    }
  );

});

// ================= PLAY COUNT (FIXED METHOD + SAFE) =================

app.post('/api/songs/:id/play', (req, res) => {

  db.query(
    `UPDATE songs
     SET play_count = play_count + 1
     WHERE id=?`,
    [req.params.id],
    (err) => {

      if (err) return res.status(500).json(err);

      res.json({ success: true });

    }
  );

});

// ================= FAVORITE =================

app.post('/api/favorite/:songId', auth, (req, res) => {

  db.query(
    `SELECT * FROM favorites WHERE user_id=? AND song_id=?`,
    [req.user.id, req.params.songId],
    (err, result) => {

      if (err) return res.status(500).json(err);

      if (result.length > 0) {

        db.query(
          `DELETE FROM favorites WHERE user_id=? AND song_id=?`,
          [req.user.id, req.params.songId],
          () => res.json({ liked: false })
        );

      } else {

        db.query(
          `INSERT INTO favorites (user_id, song_id) VALUES (?, ?)`,
          [req.user.id, req.params.songId],
          () => res.json({ liked: true })
        );

      }

    }
  );

});

// ================= LIBRARY (SAFE ARRAY FIX) =================

app.get('/api/library', auth, (req, res) => {

  db.query(
    `SELECT songs.*
     FROM favorites
     JOIN songs ON favorites.song_id = songs.id
     WHERE favorites.user_id = ?
     ORDER BY favorites.id DESC`,
    [req.user.id],
    (err, result) => {

      if (err) return res.json([]);

      res.json(result || []);

    }
  );

});

// ================= DISCOVER =================

app.get('/api/discover', (req, res) => {

  db.query(`SELECT * FROM songs ORDER BY RAND() LIMIT 8`, (err1, recommended) => {

    db.query(`SELECT * FROM songs ORDER BY play_count DESC LIMIT 8`, (err2, trending) => {

      db.query(`SELECT * FROM songs WHERE liked=1 ORDER BY id DESC LIMIT 8`, (err3, liked) => {

        db.query(`SELECT * FROM songs ORDER BY id DESC LIMIT 3`, (err4, latest) => {

          res.json({
            recommended,
            trending,
            liked,
            latest
          });

        });

      });

    });

  });

});

// ================= FALLBACK =================

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ================= START =================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('🚀 SERVER RUNNING');
  console.log('PORT:', PORT);
});
