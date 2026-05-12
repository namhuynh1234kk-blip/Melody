// ================= IMPORT =================

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();

const SECRET_KEY =
  process.env.SECRET_KEY || 'melody-secret';

// ================= MIDDLEWARE =================

app.use(cors());

app.use(express.json());

app.use(
  express.static(
    path.join(__dirname)
  )
);

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

// ================= AUTH =================

function auth(req, res, next) {

  const token =
    req.headers.authorization;

  if (!token) {

    return res.status(401).json({
      error: 'Unauthorized'
    });

  }

  try {

    const decoded =
      jwt.verify(token, SECRET_KEY);

    req.user = decoded;

    next();

  }

  catch {

    return res.status(401).json({
      error: 'Invalid token'
    });

  }

}

// ================= ADMIN ONLY =================

function adminOnly(req, res, next) {

  if (req.user.role !== 'admin') {

    return res.status(403).json({
      error: 'Admin only'
    });

  }

  next();

}

// ================= HOME =================

app.get('/', (req, res) => {

  res.sendFile(
    path.join(__dirname, 'index.html')
  );

});

// ================= REGISTER =================

app.post('/api/register', (req, res) => {

  const {
    username,
    password
  } = req.body;

  if (!username || !password) {

    return res.status(400).json({
      error: 'Thiếu dữ liệu'
    });

  }

  db.query(

    'SELECT * FROM users WHERE username=?',

    [username],

    (err, result) => {

      if (err) {

        return res.status(500).json(err);

      }

      if (result.length > 0) {

        return res.status(400).json({
          error: 'Username đã tồn tại'
        });

      }

      db.query(

        `INSERT INTO users
        (
          username,
          password,
          role
        )
        VALUES (?, ?, ?)`,

        [
          username,
          password,
          'user'
        ],

        (err2) => {

          if (err2) {

            return res.status(500).json(err2);

          }

          res.json({
            success: true
          });

        }

      );

    }

  );

});

// ================= LOGIN =================

app.post('/api/login', (req, res) => {

  const {
    username,
    password
  } = req.body;

  db.query(

    'SELECT * FROM users WHERE username=?',

    [username],

    (err, result) => {

      if (err) {

        return res.status(500).json(err);

      }

      if (result.length === 0) {

        return res.status(401).json({
          error: 'Sai tài khoản'
        });

      }

      const user = result[0];

      if (password !== user.password) {

        return res.status(401).json({
          error: 'Sai mật khẩu'
        });

      }

      const token = jwt.sign(

        {
          id: user.id,
          role: user.role,
          username: user.username
        },

        SECRET_KEY,

        {
          expiresIn: '7d'
        }

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

  const page =
    parseInt(req.query.page) || 1;

  const limit =
    parseInt(req.query.limit) || 20;

  const offset =
    (page - 1) * limit;

  db.query(

    `SELECT *
     FROM songs
     ORDER BY id DESC
     LIMIT ?
     OFFSET ?`,

    [limit, offset],

    (err, result) => {

      if (err) {

        return res.status(500).json(err);

      }

      res.json(result);

    }

  );

});

// ================= ADD SONG =================

app.post(
  '/api/songs',
  auth,
  adminOnly,

  (req, res) => {

    const {

      title,
      artist,
      src,
      cover,
      type

    } = req.body;

    db.query(

      `INSERT INTO songs
      (
        title,
        artist,
        src,
        cover,
        type,
        liked,
        play_count
      )

      VALUES (?, ?, ?, ?, ?, ?, ?)`,

      [

        title,
        artist,
        src,
        cover,
        type,
        0,
        0

      ],

      (err, result) => {

        if (err) {

          return res.status(500).json(err);

        }

        res.json({

          success: true,
          id: result.insertId

        });

      }

    );

  }

);

// ================= DELETE SONG =================

app.delete(
  '/api/songs/:id',
  auth,
  adminOnly,

  (req, res) => {

    db.query(

      `DELETE FROM songs
       WHERE id = ?`,

      [req.params.id],

      (err) => {

        if (err) {

          return res.status(500).json(err);

        }

        res.json({
          success: true
        });

      }

    );

  }

);

// ================= UPDATE SONG =================

app.put(
  '/api/songs/:id',
  auth,
  adminOnly,

  (req, res) => {

    const {

      title,
      artist,
      src,
      cover,
      type

    } = req.body;

    db.query(

      `UPDATE songs
       SET
        title = ?,
        artist = ?,
        src = ?,
        cover = ?,
        type = ?
       WHERE id = ?`,

      [

        title,
        artist,
        src,
        cover,
        type,
        req.params.id

      ],

      (err) => {

        if (err) {

          return res.status(500).json(err);

        }

        res.json({
          success: true
        });

      }

    );

  }

);

// ================= TOGGLE LIKE =================

app.put('/api/songs/:id/like', (req, res) => {

  db.query(

    `UPDATE songs
     SET liked = NOT liked
     WHERE id = ?`,

    [req.params.id],

    (err) => {

      if (err) {

        return res.status(500).json(err);

      }

      res.json({
        success: true
      });

    }

  );

});

// ================= PLAY COUNT =================

app.put('/api/songs/:id/play', (req, res) => {

  db.query(

    `UPDATE songs
     SET play_count = play_count + 1
     WHERE id = ?`,

    [req.params.id],

    (err) => {

      if (err) {

        return res.status(500).json(err);

      }

      res.json({
        success: true
      });

    }

  );

});

// ================= FAVORITE =================

app.post('/api/favorite/:songId', auth, (req, res) => {

  db.query(

    `SELECT *
     FROM favorites
     WHERE user_id=?
     AND song_id=?`,

    [
      req.user.id,
      req.params.songId
    ],

    (err, result) => {

      if (err) {

        return res.status(500).json(err);

      }

      if (result.length > 0) {

        db.query(

          `DELETE FROM favorites
           WHERE user_id=?
           AND song_id=?`,

          [
            req.user.id,
            req.params.songId
          ],

          () => {

            res.json({
              liked: false
            });

          }

        );

      }

      else {

        db.query(

          `INSERT INTO favorites
          (
            user_id,
            song_id
          )
          VALUES (?, ?)`,

          [
            req.user.id,
            req.params.songId
          ],

          () => {

            res.json({
              liked: true
            });

          }

        );

      }

    }

  );

});

// ================= LIBRARY =================

app.get('/api/library', auth, (req, res) => {

  db.query(

    `SELECT songs.*
     FROM favorites
     JOIN songs
     ON favorites.song_id = songs.id
     WHERE favorites.user_id = ?
     ORDER BY favorites.id DESC`,

    [req.user.id],

    (err, result) => {

      if (err) {

        return res.status(500).json(err);

      }

      res.json(result);

    }

  );

});

// ================= DISCOVER =================

app.get('/api/discover', (req, res) => {

  db.query(

    `SELECT *
     FROM songs
     ORDER BY RAND()
     LIMIT 8`,

    (err1, recommended) => {

      if (err1) {

        return res.status(500).json(err1);

      }

      db.query(

        `SELECT *
         FROM songs
         ORDER BY play_count DESC
         LIMIT 8`,

        (err2, trending) => {

          if (err2) {

            return res.status(500).json(err2);

          }

          db.query(

            `SELECT *
             FROM songs
             WHERE liked = 1
             ORDER BY id DESC
             LIMIT 8`,

            (err3, liked) => {

              if (err3) {

                return res.status(500).json(err3);

              }

              db.query(

                `SELECT *
                 FROM songs
                 ORDER BY id DESC
                 LIMIT 3`,

                (err4, latest) => {

                  if (err4) {

                    return res.status(500).json(err4);

                  }

                  res.json({

                    recommended,
                    trending,
                    liked,
                    latest

                  });

                }

              );

            }

          );

        }

      );

    }

  );

});

// ================= FALLBACK =================

app.get('*', (req, res) => {

  res.sendFile(
    path.join(__dirname, 'index.html')
  );

});

// ================= START SERVER =================

const PORT =
  process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log('🚀 SERVER RUNNING');

  console.log(
    'PORT:',
    PORT
  );

});
