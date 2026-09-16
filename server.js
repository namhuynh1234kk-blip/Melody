// ================= IMPORT =================
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const path = require('path');
const jwt = require('jsonwebtoken');
const http = require('http');
const { Server } = require('socket.io');
const OpenAI = require('openai');

const app = express();
const server = http.createServer(app);

// ================= SOCKET =================
const io = new Server(server, {
  cors: { origin: '*' }
});

// ================= CONFIG =================
const SECRET_KEY = process.env.SECRET_KEY || "secret123";

// ================= GEMINI AI =================
const ai = new OpenAI({
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  apiKey: process.env.GEMINI_API_KEY
});
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

  // ============================================================
  // CREATE ROOM
  // ============================================================
  socket.on("room:create", ({ username, password }) => {

    const code = Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase();

    rooms[code] = {
      code,
      password: password || "",
      dj: socket.id,

      members: [
        {
          id: socket.id,
          username
        }
      ],

      song: null,
      isPlaying: false,
      currentTime: 0,
      messages: []
    };

    socket.join(code);

    socket.emit("room:created", rooms[code]);
  });


  // ============================================================
  // CHAT
  // ============================================================
  socket.on(
    "chat:send",
    ({ roomCode, username, message, isEmoji = false }) => {

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

      if (!room.messages) {
        room.messages = [];
      }

      room.messages.push(msgData);

      io.to(roomCode).emit(
        "chat:receive",
        msgData
      );
    }
  );


  // ============================================================
  // JOIN ROOM
  // ============================================================
  socket.on("room:join", (data) => {

    if (!data) return;

    const roomCode = data.roomCode
      ? data.roomCode.trim().toUpperCase()
      : null;

    const username = data.username || "Ẩn danh";

    const room = rooms[roomCode];

    if (!room) {
      socket.emit(
        "room:error",
        "Room không tồn tại"
      );

      return;
    }

    if (
      room.password &&
      data.password !== room.password
    ) {

      socket.emit(
        "room:error",
        "Sai mật khẩu phòng!"
      );

      return;
    }

    socket.join(roomCode);

    if (!room.messages) {
      room.messages = [];
    }

    const isExist = room.members.some(
      m => m.id === socket.id
    );

    if (!isExist) {

      room.members.push({
        id: socket.id,
        username
      });
    }

    io.to(roomCode).emit(
      "room:update",
      room
    );

    const joinMsg = {
      isSystem: true,
      message:
        `🎵 ${username} đã tham gia phòng nghe nhạc.`
    };

    room.messages.push(joinMsg);

    io.to(roomCode).emit(
      "chat:receive",
      joinMsg
    );
  });


  // ============================================================
  // MUSIC SYNC - PLAY
  // ============================================================
  socket.on(
    "player:play",
    ({ roomCode, song, currentTime }) => {

      const room = rooms[roomCode];

      if (!room) return;

      room.song = song;
      room.isPlaying = true;
      room.currentTime = currentTime || 0;

      io.to(roomCode).emit(
        "player:syncPlay",
        {
          song,
          currentTime,
          timestamp: Date.now()
        }
      );

      const playMsg = {
        isSystem: true,
        message:
          `▶️ DJ đang phát bài hát: ${song.title} - ${song.artist}`
      };

      if (!room.messages) {
        room.messages = [];
      }

      room.messages.push(playMsg);

      io.to(roomCode).emit(
        "chat:receive",
        playMsg
      );
    }
  );


  // ============================================================
  // MUSIC SYNC - PAUSE
  // ============================================================
  socket.on(
    "player:pause",
    ({ roomCode, currentTime }) => {

      const room = rooms[roomCode];

      if (!room) return;

      room.isPlaying = false;
      room.currentTime = currentTime || 0;

      io.to(roomCode).emit(
        "player:syncPause",
        {
          currentTime,
          timestamp: Date.now()
        }
      );

      const pauseMsg = {
        isSystem: true,
        message:
          `⏸️ DJ đã tạm dừng bài nhạc.`
      };

      if (!room.messages) {
        room.messages = [];
      }

      room.messages.push(pauseMsg);

      io.to(roomCode).emit(
        "chat:receive",
        pauseMsg
      );
    }
  );


  // ============================================================
  // ĐỔI QUYỀN DJ
  // ============================================================
  socket.on(
    "room:change-role",
    ({ roomCode, targetId, newRole }) => {

      const room = rooms[roomCode];

      if (!room) return;

      if (room.dj !== socket.id) {

        return socket.emit(
          "room:error",
          "Bạn không có quyền quản lý!"
        );
      }

      if (newRole === 'dj') {

        room.dj = targetId;

      } else if (
        newRole === 'member' &&
        room.dj === targetId
      ) {

        room.dj =
          room.members.find(
            m => m.id !== targetId
          )?.id || targetId;
      }

      io.to(roomCode).emit(
        "room:update",
        room
      );
    }
  );


  // ============================================================
  // KICK THÀNH VIÊN
  // ============================================================
  socket.on(
    "room:kick",
    ({ roomCode, targetId }) => {

      const room = rooms[roomCode];

      if (!room) return;

      if (room.dj !== socket.id) {

        return socket.emit(
          "room:error",
          "Bạn không có quyền kick người khác!"
        );
      }

      const kickedMember =
        room.members.find(
          m => m.id === targetId
        );

      if (kickedMember) {

        io.to(targetId).emit(
          "room:kicked-notice",
          "Bạn đã bị DJ kick khỏi phòng!"
        );

        const kickMsg = {
          isSystem: true,
          message:
            `❌ ${kickedMember.username} đã bị mời ra khỏi phòng.`
        };

        if (!room.messages) {
          room.messages = [];
        }

        room.messages.push(kickMsg);

        io.to(roomCode).emit(
          "chat:receive",
          kickMsg
        );
      }

      room.members =
        room.members.filter(
          m => m.id !== targetId
        );

      if (room.dj === targetId) {

        room.dj =
          room.members[0]?.id || null;
      }

      const targetSocket =
        io.sockets.sockets.get(targetId);

      if (targetSocket) {
        targetSocket.leave(roomCode);
      }

      io.to(roomCode).emit(
        "room:update",
        room
      );
    }
  );


  // ============================================================
  // DISCONNECT
  // ============================================================
  socket.on("disconnect", () => {

    for (const code in rooms) {

      const room = rooms[code];

      const leavingMember =
        room.members.find(
          m => m.id === socket.id
        );

      if (!leavingMember) continue;

      room.members =
        room.members.filter(
          m => m.id !== socket.id
        );

      // Phòng không còn ai
      if (room.members.length === 0) {

        delete rooms[code];

        console.log(
          `🧹 Đã giải phóng bộ nhớ phòng trống: ${code}`
        );

        continue;
      }

      const leaveMsg = {
        isSystem: true,
        message:
          `🚪 ${leavingMember.username} đã rời phòng.`
      };

      if (!room.messages) {
        room.messages = [];
      }

      room.messages.push(leaveMsg);

      io.to(code).emit(
        "chat:receive",
        leaveMsg
      );

      // Nếu DJ rời phòng
      if (room.dj === socket.id) {

        room.dj =
          room.members[0]?.id || null;
      }

      io.to(code).emit(
        "room:update",
        room
      );
    }
  });

});

// ============================================================
// REST API
// ============================================================

app.get('/', (req, res) => {

  res.sendFile(
    path.join(__dirname, 'index.html')
  );
});


// ============================================================
// AUTH MIDDLEWARE
// ============================================================

function auth(req, res, next) {

  let token = req.headers.authorization;

  if (!token) {

    return res.status(401).json({
      error: 'Chưa đăng nhập'
    });
  }

  if (token.startsWith('Bearer ')) {
    token = token.slice(7);
  }

  try {

    req.user = jwt.verify(
      token,
      SECRET_KEY
    );

    next();

  } catch (err) {

    return res.status(401).json({
      error: 'Token không hợp lệ'
    });
  }
}


// ============================================================
// API ME
// ============================================================

app.get("/api/me", (req, res) => {

  res.json({
    ok: true
  });
});




// ============================================================
// AI PLAYLIST - DYNAMIC
// ============================================================

app.post('/api/ai/playlist', async (req, res) => {

  try {

    const {
      message,
      conversation,
      currentQueue
    } = req.body;


    // ==========================================================
    // VALIDATE MESSAGE
    // ==========================================================

    if (!message || !String(message).trim()) {

      return res.status(400).json({
        error: 'Vui lòng nhập yêu cầu'
      });

    }


    const currentUserMessage =
      String(message).trim();


    // ==========================================================
    // CURRENT QUEUE
    // ==========================================================

    const queue =
      Array.isArray(currentQueue)
        ? currentQueue
            .filter(
              song =>
                song &&
                song.id != null
            )
            .map(song => ({
              id: Number(song.id),
              title: String(song.title || ''),
              artist: String(song.artist || '')
            }))
            .filter(
              song =>
                Number.isFinite(song.id)
            )
            .slice(0, 50)
        : [];


    const existingSongIds =
      queue
        .map(song => Number(song.id))
        .filter(
          id =>
            Number.isFinite(id)
        );


    console.log(
      '🤖 AI PLAYLIST REQUEST:',
      currentUserMessage
    );

    console.log(
      '🎵 CURRENT QUEUE:',
      existingSongIds
    );


    // ==========================================================
    // NORMALIZE USER MESSAGE
    // ==========================================================

    const normalizedUserMessage =
      currentUserMessage
        .toLowerCase()
        .normalize('NFD')
        .replace(
          /[\u0300-\u036f]/g,
          ''
        )
        .replace(
          /[.,!?;:()[\]{}"']/g,
          ' '
        )
        .replace(
          /\s+/g,
          ' '
        )
        .trim();


    // ==========================================================
    // SERVER ACTION DETECTION
    // ==========================================================

    let forcedAction = 'replace';


    const clearMatch =
      /\b(xoa het|xoa toan bo|clear playlist|clear het|xoa playlist)\b/
        .test(normalizedUserMessage);


    const removeMatch =
      /\b(bo bai|xoa bai|remove bai|bo mon|xoa mon)\b/
        .test(normalizedUserMessage);


    const appendMatch =
      /\b(them|them nua|them bai|them vai bai|them nua bai|them tiep|them tiep nua)\b/
        .test(normalizedUserMessage);


    if (clearMatch) {

      forcedAction = 'clear';

    }
    else if (removeMatch) {

      forcedAction = 'remove';

    }
    else if (appendMatch) {

      forcedAction = 'append';

    }


    console.log(
      '🎛️ SERVER ACTION:',
      {
        message:
          currentUserMessage,
        forcedAction
      }
    );


    // ==========================================================
    // CONVERSATION
    // ==========================================================

    const history =
      Array.isArray(conversation)
        ? conversation
            .filter(
              item =>
                item &&
                (
                  item.role === 'user' ||
                  item.role === 'assistant'
                ) &&
                typeof item.content === 'string' &&
                item.content.trim()
            )
            .slice(-12)
            .map(item => ({
              role: item.role,
              content:
                item.content.trim()
            }))
        : [];


    // ==========================================================
    // ENSURE CURRENT MESSAGE EXISTS
    // ==========================================================

    const lastMessage =
      history[
        history.length - 1
      ];


    if (
      !lastMessage ||
      lastMessage.role !== 'user' ||
      lastMessage.content !== currentUserMessage
    ) {

      history.push({
        role: 'user',
        content:
          currentUserMessage
      });

    }


    // ==========================================================
    // AI
    // ==========================================================

    const completion =
      await ai.chat.completions.create({

      model: 'gemini-3.5-flash' ,

        messages: [

          {

            role: 'system',

            content: `

Bạn là Melody AI của MelodyVN.

NHIỆM VỤ:

Hiểu yêu cầu nghe nhạc bằng ngôn ngữ tự nhiên.

Bạn KHÔNG trực tiếp tìm bài hát.

Bạn chỉ trả về JSON để backend sử dụng
truy vấn database.

============================================================
DATABASE
============================================================

Bảng songs chỉ có:

id
title
artist
src
cover
type
created_at
liked
play_count

KHÔNG CÓ:

category
genre
mood
language

Do đó:

- artist dùng để lọc nghệ sĩ.
- title dùng để lọc tên bài.
- mood chỉ là thông tin mô tả.
- energy chỉ là thông tin mô tả.
- Không đưa mood vào keywords.
- Không đưa activity vào keywords.
- Không bịa artist.
- Không bịa title.

============================================================
ARTIST LOCK
============================================================

Nếu user nói tên nghệ sĩ,
phải đưa nghệ sĩ đó vào artists.

Ví dụ:

"nhạc Vũ"

=> artists: ["Vũ"]

KHÔNG:

keywords: ["Vũ"]

KHÔNG tự thêm nghệ sĩ khác.

Nếu user nói:

"nhạc Sơn Tùng và Vũ"

=> artists:

["Sơn Tùng", "Vũ"]

Chỉ hai nghệ sĩ đó.

============================================================
EXACT ARTIST
============================================================

Nếu user yêu cầu một nghệ sĩ cụ thể,
backend sẽ exact-match artist.

Ví dụ:

"nhạc Vũ"

chỉ được hiểu là nghệ sĩ:

"Vũ"

Không được đổi thành:

"Vũ Cát Tường"

Không được thêm nghệ sĩ tương tự.

============================================================
MOOD
============================================================

Chỉ trả mood khi user thực sự nói.

Ví dụ:

"nhạc buồn"

=> mood: "sad"

"nhạc Vũ buồn"

=> artists: ["Vũ"]
=> mood: "sad"

"nhạc Vũ chill"

=> artists: ["Vũ"]
=> mood: "chill"

"nhạc Vũ"

=> mood: ""

Không được tự suy luận:

Vũ = chill
Vũ = buồn
Vũ = romantic

============================================================
ENERGY
============================================================

Ví dụ:

"nhạc để chạy bộ"

=> energy: "high"

"nhạc để tập gym"

=> energy: "high"

"nhạc để học"

=> energy: "low"

"nhạc để ngủ"

=> energy: "low"

Nếu user không nói hoạt động hoặc năng lượng,
energy phải để rỗng.

============================================================
KEYWORDS
============================================================

keywords CHỈ dùng cho tên bài hát.

Ví dụ:

"cho tao bài Có chắc yêu là đây"

=> keywords:

["Có chắc yêu là đây"]

Không đưa:

buồn
vui
chill
gym
học
ngủ
chạy bộ

vào keywords nếu chúng chỉ là mood/activity.

============================================================
ACTION
============================================================

Có 4 action:

replace
append
remove
clear

Mặc định:

replace

Nếu user muốn thêm bài:

"thêm bài"
"thêm vài bài"
"thêm 2 bài"
"thêm nữa"
"thêm tiếp"
"thêm tiếp nữa"

=> action: "append"

Nếu user muốn xóa playlist:

"xóa hết playlist"
"xóa playlist"

=> action: "clear"

Nếu user muốn bỏ bài:

"bỏ bài"
"xóa bài"

=> action: "remove"

============================================================
LIMIT
============================================================

limit là số bài user muốn.

Ví dụ:

"nhạc Vũ"

=> limit: 10

"thêm 2 bài"

=> action: "append"
=> limit: 2

"thêm 5 bài"

=> action: "append"
=> limit: 5

"cho 3 bài"

=> limit: 3

Nếu user không nói số lượng:

=> limit: 10

============================================================
HỘI THOẠI
============================================================

Nếu user nói:

"nhạc Vũ"

sau đó:

"chill"

hiểu là:

"nhạc Vũ chill"

Nếu user nói:

"buồn"

hiểu là:

"nhạc Vũ buồn"

Nhưng:

"nhạc Vũ"

là yêu cầu mới.

Không lấy mood cũ nếu user bắt đầu
một yêu cầu mới.

============================================================
HỎI LẠI
============================================================

Nếu user nói:

"cho tao nhạc"

có thể hỏi:

"Bạn muốn nghe nhạc theo mood hoặc hoạt động nào?"

Nhưng:

"nhạc Vũ"

đã đủ.

Không hỏi mood.

============================================================
KHÔNG FALLBACK ARTIST
============================================================

Nếu user yêu cầu nghệ sĩ cụ thể
nhưng database không có nghệ sĩ đó:

songs phải là [].

Không lấy nghệ sĩ khác.

Ví dụ:

"nhạc ABCXYZ"

nếu không có:

songs: []

Không lấy bài phổ biến khác.

============================================================
OUTPUT
============================================================

Nếu cần hỏi:

{
  "type": "question",
  "question": "..."
}

Nếu đủ:

{
  "type": "playlist",
  "action": "replace",
  "artists": [],
  "keywords": [],
  "mood": "",
  "energy": "",
  "limit": 10
}

============================================================
VÍ DỤ
============================================================

Input:

"nhạc Vũ"

Output:

{
  "type": "playlist",
  "action": "replace",
  "artists": ["Vũ"],
  "keywords": [],
  "mood": "",
  "energy": "",
  "limit": 10
}

Input:

"nhạc Vũ buồn"

Output:

{
  "type": "playlist",
  "action": "replace",
  "artists": ["Vũ"],
  "keywords": [],
  "mood": "sad",
  "energy": "",
  "limit": 10
}

Input:

"nhạc Vũ chill"

Output:

{
  "type": "playlist",
  "action": "replace",
  "artists": ["Vũ"],
  "keywords": [],
  "mood": "chill",
  "energy": "",
  "limit": 10
}

Input:

"nhạc Sơn Tùng và Vũ"

Output:

{
  "type": "playlist",
  "action": "replace",
  "artists": ["Sơn Tùng", "Vũ"],
  "keywords": [],
  "mood": "",
  "energy": "",
  "limit": 10
}

Input:

"bài Có chắc yêu là đây"

Output:

{
  "type": "playlist",
  "action": "replace",
  "artists": [],
  "keywords": ["Có chắc yêu là đây"],
  "mood": "",
  "energy": "",
  "limit": 10
}

Input:

"thêm 2 bài"

Output:

{
  "type": "playlist",
  "action": "append",
  "artists": [],
  "keywords": [],
  "mood": "",
  "energy": "",
  "limit": 2
}

Input:

"thêm 5 bài của Vũ"

Output:

{
  "type": "playlist",
  "action": "append",
  "artists": ["Vũ"],
  "keywords": [],
  "mood": "",
  "energy": "",
  "limit": 5
}

CHỈ TRẢ JSON THUẦN TÚY.

KHÔNG MARKDOWN.

KHÔNG GIẢI THÍCH.

`

          },

          ...history

        ]

      });


    // ==========================================================
    // GET AI RESPONSE
    // ==========================================================

    const content =
      completion
        ?.choices?.[0]
        ?.message
        ?.content;


    if (!content) {

      return res.status(500).json({
        error:
          'AI không trả về kết quả'
      });

    }


    // ==========================================================
    // PARSE JSON
    // ==========================================================

    let aiData;


    try {

      let cleanedContent =
        String(content).trim();


      cleanedContent =
        cleanedContent
          .replace(
            /```json/gi,
            ''
          )
          .replace(
            /```/g,
            ''
          )
          .trim();


      const jsonStart =
        cleanedContent.indexOf('{');


      const jsonEnd =
        cleanedContent.lastIndexOf('}');


      if (
        jsonStart === -1 ||
        jsonEnd === -1
      ) {

        throw new Error(
          'Không tìm thấy JSON'
        );

      }


      cleanedContent =
        cleanedContent.substring(
          jsonStart,
          jsonEnd + 1
        );


      aiData =
        JSON.parse(
          cleanedContent
        );


    }
    catch (parseError) {

      console.error(
        '❌ AI JSON ERROR:',
        content
      );


      return res.status(500).json({

        error:
          'AI trả về dữ liệu không hợp lệ',

        raw:
          content

      });

    }


    // ==========================================================
    // FINAL ACTION LOCK
    // ==========================================================

    const aiAction =
      aiData.action
        ? String(
            aiData.action
          )
            .trim()
            .toLowerCase()
        : 'replace';


    const finalAction =
      forcedAction !== 'replace'
        ? forcedAction
        : (
            [
              'replace',
              'append',
              'remove',
              'clear'
            ].includes(aiAction)
              ? aiAction
              : 'replace'
          );


    console.log(
      '🔒 FINAL ACTION:',
      finalAction
    );


    // ==========================================================
    // QUESTION
    // ==========================================================

    if (
      aiData.type === 'question'
    ) {

      const question =
        aiData.question
          ? String(
              aiData.question
            ).trim()
          : 'Bạn muốn nghe nhạc theo phong cách nào?';


      return res.json({

        success: true,

        type: 'question',

        question

      });

    }


    // ==========================================================
    // ARTISTS
    // ==========================================================

    const artists =
      Array.isArray(
        aiData.artists
      )
        ? aiData.artists
            .map(
              x =>
                String(x).trim()
            )
            .filter(Boolean)
        : [];


    // ==========================================================
    // KEYWORDS
    // ==========================================================

    const keywords =
      Array.isArray(
        aiData.keywords
      )
        ? aiData.keywords
            .map(
              x =>
                String(x).trim()
            )
            .filter(Boolean)
        : [];


    // ==========================================================
    // MOOD VALIDATION
    // ==========================================================

    let explicitMood = '';


    if (
      /\b(buon|tam trang buon|that buon|buon qua|buon hon|u buon)\b/
        .test(
          normalizedUserMessage
        )
    ) {

      explicitMood = 'sad';

    }
    else if (
      /\b(vui|vui ve|vui tuoi|happy|phan khoi|tich cuc)\b/
        .test(
          normalizedUserMessage
        )
    ) {

      explicitMood = 'happy';

    }
    else if (
      /\b(chill|thu gian|relax|relaxed|nhe nhang|em diu|de chiu)\b/
        .test(
          normalizedUserMessage
        )
    ) {

      explicitMood = 'chill';

    }
    else if (
      /\b(lang man|lang mang|tinh yeu|yeu duong|romantic|love)\b/
        .test(
          normalizedUserMessage
        )
    ) {

      explicitMood = 'romantic';

    }
    else if (
      /\b(co don|co doc|lonely|mot minh)\b/
        .test(
          normalizedUserMessage
        )
    ) {

      explicitMood = 'lonely';

    }
    else if (
      /\b(hoai niem|hoai co|nho xua|ky niem|nostalgic)\b/
        .test(
          normalizedUserMessage
        )
    ) {

      explicitMood = 'nostalgic';

    }
    else if (
      /\b(soi dong|nang luong|quay|bung no|energetic|sung)\b/
        .test(
          normalizedUserMessage
        )
    ) {

      explicitMood = 'energetic';

    }


    // ==========================================================
    // AI MOOD / ENERGY
    // ==========================================================

    const aiMood =
      aiData.mood
        ? String(
            aiData.mood
          )
            .trim()
            .toLowerCase()
        : '';


    const aiEnergy =
      aiData.energy
        ? String(
            aiData.energy
          )
            .trim()
            .toLowerCase()
        : '';


    // ==========================================================
    // FINAL MOOD
    // ==========================================================

    let finalMood =
      explicitMood;


    if (
      !explicitMood
    ) {

      finalMood = '';

    }


    // ==========================================================
    // FINAL ENERGY
    // ==========================================================

    let finalEnergy = '';


    const explicitHighEnergy =
      /\b(chay bo|di bo|tap gym|gym|tap the duc|the duc|soi dong|nang luong cao|high energy|nang dong|quay|party|tiec|bung no)\b/
        .test(
          normalizedUserMessage
        );


    const explicitLowEnergy =
      /\b(hoc|hoc bai|ngu|ngu ngon|thu gian|relax|relaxed|nhe nhang|em diu)\b/
        .test(
          normalizedUserMessage
        );


    if (
      explicitHighEnergy
    ) {

      finalEnergy = 'high';

    }
    else if (
      explicitLowEnergy
    ) {

      finalEnergy = 'low';

    }


    // ==========================================================
    // SAFE KEYWORDS
    // ==========================================================

    const safeKeywords =
      keywords
        .slice(0, 6)
        .filter(
          keyword =>
            keyword.length >= 2
        );


    // ==========================================================
    // LIMIT
    // ==========================================================

    let limit =
      parseInt(
        aiData.limit,
        10
      );


    if (
      !Number.isFinite(limit)
    ) {

      limit = 10;

    }


    // ==========================================================
    // GENERIC NUMBER EXTRACTION
    // ==========================================================

    if (
      finalAction === 'append'
    ) {

      const numericMatch =
        normalizedUserMessage.match(
          /\b(\d+)\s*(bai|bai hat)\b/
        );


      if (numericMatch) {

        limit =
          parseInt(
            numericMatch[1],
            10
          );

      }
      else {

        const vietnameseNumbers = {

          'mot': 1,
          'hai': 2,
          'ba': 3,
          'bon': 4,
          'tu': 4,
          'nam': 5,
          'sau': 6,
          'bay': 7,
          'tam': 8,
          'chin': 9,
          'muoi': 10

        };


        const numberWordMatch =
          normalizedUserMessage.match(
            /\b(mot|hai|ba|bon|tu|nam|sau|bay|tam|chin|muoi)\s*(bai|bai hat)\b/
          );


        if (
          numberWordMatch
        ) {

          limit =
            vietnameseNumbers[
              numberWordMatch[1]
            ];

        }

      }

    }


    // ==========================================================
    // LIMIT MAX
    // ==========================================================

    limit =
      Math.max(
        1,
        Math.min(
          Number(limit) || 10,
          10
        )
      );


    // ==========================================================
    // DEBUG
    // ==========================================================

    console.log(
      '🧠 AI PARSED:',
      {
        action:
          finalAction,

        artists,

        keywords:
          safeKeywords,

        mood:
          finalMood,

        energy:
          finalEnergy,

        limit
      }
    );


    // ==========================================================
    // SQL CONDITIONS
    // ==========================================================

    const conditions = [];

    const params = [];


    // ==========================================================
    // ARTIST FILTER
    // ==========================================================

    if (
      artists.length > 0
    ) {

      const artistConditions = [];


      for (
        const artist of artists
      ) {

        artistConditions.push(
          'LOWER(TRIM(artist)) = LOWER(TRIM(?))'
        );


        params.push(
          artist
        );

      }


      conditions.push(
        `(${artistConditions.join(' OR ')})`
      );

    }


    // ==========================================================
    // TITLE KEYWORDS
    // ==========================================================

    if (
      safeKeywords.length > 0
    ) {

      const keywordConditions = [];


      for (
        const keyword of safeKeywords
      ) {

        keywordConditions.push(
          'title LIKE ?'
        );


        params.push(
          `%${keyword}%`
        );

      }


      conditions.push(
        `(${keywordConditions.join(' OR ')})`
      );

    }


    // ==========================================================
    // APPEND - EXCLUDE CURRENT QUEUE
    // ==========================================================

    if (
      finalAction === 'append' &&
      existingSongIds.length > 0
    ) {

      const placeholders =
        existingSongIds
          .map(
            () => '?'
          )
          .join(', ');


      conditions.push(
        `id NOT IN (${placeholders})`
      );


      params.push(
        ...existingSongIds
      );

    }


    // ==========================================================
    // SQL
    // ==========================================================

    let sql = `

      SELECT
        id,
        title,
        artist,
        src,
        cover,
        type,
        created_at,
        liked,
        play_count

      FROM songs

    `;


    if (
      conditions.length > 0
    ) {

      sql += `

        WHERE
          ${conditions.join(' AND ')}

      `;

    }


    sql += `

      ORDER BY
        play_count DESC,
        id DESC

      LIMIT ?

    `;


    params.push(
      limit
    );


    console.log(
      '🗄️ AI SQL:',
      sql
    );


    console.log(
      '🗄️ AI PARAMS:',
      params
    );


    // ==========================================================
    // DATABASE
    // ==========================================================

    const [
      songs
    ] =
      await db
        .promise()
        .query(
          sql,
          params
        );


    // ==========================================================
    // NO SONGS
    // ==========================================================

    if (
      !songs ||
      songs.length === 0
    ) {

      console.log(
        '⚠️ Không tìm thấy bài đúng yêu cầu'
      );


      // ========================================================
      // ARTIST / TITLE
      // ========================================================

      if (
        artists.length > 0 ||
        safeKeywords.length > 0
      ) {

        let notFoundMessage =
          'Không tìm thấy bài hát phù hợp trong thư viện MelodyVN.';


        if (
          artists.length > 0
        ) {

          notFoundMessage =
            `Không tìm thấy bài hát của ${artists.join(', ')} trong thư viện MelodyVN.`;

        }


        return res.json({

          success: true,

          type: 'playlist',

          action:
            finalAction,

          query: {

            original:
              currentUserMessage,

            action:
              finalAction,

            artists,

            keywords:
              safeKeywords,

            mood:
              finalMood,

            energy:
              finalEnergy,

            limit

          },

          mood: {

            mood:
              finalMood,

            energy:
              finalEnergy

          },

          songs: [],

          fallback: false,

          message:
            notFoundMessage

        });

      }


      // ========================================================
      // APPEND WITHOUT ARTIST / TITLE
      // ========================================================

      if (
        finalAction === 'append'
      ) {

        let fallbackSql = `

          SELECT
            id,
            title,
            artist,
            src,
            cover,
            type,
            created_at,
            liked,
            play_count

          FROM songs

        `;


        const fallbackParams = [];


        if (
          existingSongIds.length > 0
        ) {

          const placeholders =
            existingSongIds
              .map(
                () => '?'
              )
              .join(', ');


          fallbackSql += `

            WHERE id NOT IN (${placeholders})

          `;


          fallbackParams.push(
            ...existingSongIds
          );

        }


        fallbackSql += `

          ORDER BY
            play_count DESC,
            id DESC

          LIMIT ?

        `;


        fallbackParams.push(
          limit
        );


        const [
          fallbackAppendSongs
        ] =
          await db
            .promise()
            .query(
              fallbackSql,
              fallbackParams
            );


        return res.json({

          success: true,

          type: 'playlist',

          action:
            'append',

          query: {

            original:
              currentUserMessage,

            action:
              'append',

            artists,

            keywords:
              safeKeywords,

            mood:
              finalMood,

            energy:
              finalEnergy,

            limit

          },

          mood: {

            mood:
              finalMood,

            energy:
              finalEnergy

          },

          songs:
            fallbackAppendSongs || [],

          fallback:
            false

        });

      }


      // ========================================================
      // NORMAL FALLBACK
      // ========================================================

      const [
        fallbackSongs
      ] =
        await db
          .promise()
          .query(

            `

            SELECT
              id,
              title,
              artist,
              src,
              cover,
              type,
              created_at,
              liked,
              play_count

            FROM songs

            ORDER BY
              play_count DESC,
              id DESC

            LIMIT ?

            `,

            [limit]

          );


      return res.json({

        success: true,

        type: 'playlist',

        action:
          finalAction,

        query: {

          original:
            currentUserMessage,

          action:
            finalAction,

          artists,

          keywords:
            safeKeywords,

          mood:
            finalMood,

          energy:
            finalEnergy,

          limit

        },

        mood: {

          mood:
            finalMood,

          energy:
            finalEnergy

        },

        songs:
          fallbackSongs || [],

        fallback:
          true

      });

    }


    // ==========================================================
    // SHUFFLE
    // ==========================================================

    const playlist =
      [...songs];


    for (
      let i =
        playlist.length - 1;

      i > 0;

      i--
    ) {

      const j =
        Math.floor(
          Math.random() *
          (i + 1)
        );


      [
        playlist[i],
        playlist[j]
      ] =
      [
        playlist[j],
        playlist[i]
      ];

    }


    // ==========================================================
    // FINAL QUERY
    // ==========================================================

    const finalQuery = {

      original:
        currentUserMessage,

      action:
        finalAction,

      artists,

      keywords:
        safeKeywords,

      mood:
        finalMood,

      energy:
        finalEnergy,

      limit

    };


    // ==========================================================
    // RESPONSE
    // ==========================================================

    console.log(
      '✅ AI PLAYLIST RESULT:',
      {
        action:
          finalAction,

        count:
          playlist.length,

        artists,

        mood:
          finalMood,

        energy:
          finalEnergy
      }
    );


    return res.json({

      success: true,

      type: 'playlist',

      action:
        finalAction,

      query:
        finalQuery,

      mood: {

        mood:
          finalMood,

        energy:
          finalEnergy

      },

      songs:
        playlist,

      fallback:
        false

    });


  }
  catch (error) {

    console.error(
      '❌ AI PLAYLIST ERROR:',
      error
    );


    return res.status(500).json({

      error:
        'Không thể tạo playlist AI',

      detail:
        error.message

    });

  }

});

// ============================================================
// REGISTER
// ============================================================

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

        `
        INSERT INTO users
        (username, password, role)
        VALUES (?, ?, ?)
        `,

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


// ============================================================
// LOGIN
// ============================================================

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

      const token =
        jwt.sign(

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

        token:
          "Bearer " + token,

        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }

      });
    }
  );
});


// ============================================================
// GET SONGS
// ============================================================

app.get('/api/songs', (req, res) => {

  db.query(
    `
    SELECT *
    FROM songs
    ORDER BY id DESC
    `,

    (err, result) => {

      if (err) {
        return res.status(500).json(err);
      }

      res.json(
        result || []
      );
    }
  );
});


// ============================================================
// ADD SONG
//
// ĐÃ BỎ category vì DB KHÔNG CÓ category
// ============================================================

app.post('/api/songs', auth, (req, res) => {

  if (req.user.role !== 'admin') {

    return res.status(403).json({
      error: 'Admin only'
    });
  }

  const {
    title,
    artist,
    src,
    cover,
    type
  } = req.body;


  db.query(

    `
    INSERT INTO songs
    (
      title,
      artist,
      src,
      cover,
      type,
      liked,
      play_count
    )
    VALUES (?, ?, ?, ?, ?, 0, 0)
    `,

    [
      title,
      artist,
      src,
      cover,
      type
    ],

    (err, result) => {

      if (err) {

        return res.status(500).json(err);
      }

      res.json({

        success: true,

        id:
          result.insertId
      });
    }
  );
});


// ============================================================
// UPDATE SONG
//
// ĐÃ BỎ category
// ============================================================

app.put('/api/songs/:id', auth, (req, res) => {

  if (req.user.role !== 'admin') {

    return res.status(403).json({
      error: 'Admin only'
    });
  }

  const {
    title,
    artist,
    src,
    cover,
    type
  } = req.body;


  db.query(

    `
    UPDATE songs
    SET
      title=?,
      artist=?,
      src=?,
      cover=?,
      type=?
    WHERE id=?
    `,

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
});


// ============================================================
// DELETE SONG
// ============================================================

app.delete('/api/songs/:id', auth, (req, res) => {

  if (req.user.role !== 'admin') {

    return res.status(403).json({
      error: 'Admin only'
    });
  }

  db.query(

    `
    DELETE FROM songs
    WHERE id=?
    `,

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


// ============================================================
// FAVORITE
// ============================================================

app.post(
  '/api/favorite/:songId',
  auth,
  (req, res) => {

    db.query(

      `
      SELECT *
      FROM favorites
      WHERE user_id=?
      AND song_id=?
      `,

      [
        req.user.id,
        req.params.songId
      ],

      (err, result) => {

        if (err) {

          return res.status(500).json(err);
        }


        // Bỏ yêu thích
        if (result.length > 0) {

          db.query(

            `
            DELETE FROM favorites
            WHERE user_id=?
            AND song_id=?
            `,

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


        } else {

          // Thêm yêu thích
          db.query(

            `
            INSERT INTO favorites
            (user_id, song_id)
            VALUES (?, ?)
            `,

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
  }
);


// ============================================================
// LIBRARY
// ============================================================

app.get(
  '/api/library',
  auth,
  (req, res) => {

    db.query(

      `
      SELECT songs.*
      FROM favorites
      JOIN songs
        ON favorites.song_id = songs.id
      WHERE favorites.user_id = ?
      ORDER BY favorites.id DESC
      `,

      [req.user.id],

      (err, result) => {

        if (err) {
          return res.json([]);
        }

        res.json(
          result || []
        );
      }
    );
  }
);


// ============================================================
// DISCOVER
// ============================================================

app.get('/api/discover', (req, res) => {

  db.query(

    `
    SELECT *
    FROM songs
    ORDER BY RAND()
    LIMIT 8
    `,

    (err1, recommended) => {

      db.query(

        `
        SELECT *
        FROM songs
        ORDER BY play_count DESC
        LIMIT 8
        `,

        (err2, trending) => {

          db.query(

            `
            SELECT *
            FROM songs
            WHERE liked=1
            ORDER BY id DESC
            LIMIT 8
            `,

            (err3, liked) => {

              db.query(

                `
                SELECT *
                FROM songs
                ORDER BY id DESC
                LIMIT 3
                `,

                (err4, latest) => {

                  res.json({

                    recommended:
                      recommended || [],

                    trending:
                      trending || [],

                    liked:
                      liked || [],

                    latest:
                      latest || []

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


// ============================================================
// SPA FALLBACK
// ============================================================

app.get('*any', (req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      'index.html'
    )
  );
});


// ============================================================
// START SERVER
// ============================================================

const PORT =
  process.env.PORT || 3000;

server.listen(
  PORT,
  () => {

    console.log(
      "🚀 SERVER RUNNING ON PORT:",
      PORT
    );
  }
);
