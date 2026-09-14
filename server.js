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

// ================= OPENROUTER AI =================
const ai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY
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
// AI MOOD ANALYSIS
// ============================================================

app.post('/api/ai/mood', async (req, res) => {

  try {

    const { message } = req.body;

    if (!message || !message.trim()) {

      return res.status(400).json({
        error: 'Vui lòng nhập yêu cầu'
      });
    }

    const completion =
      await ai.chat.completions.create({

        model: 'openrouter/free',

        messages: [

          {
            role: 'system',

            content: `
Bạn là Melody AI, trợ lý âm nhạc của website MelodyVN.

Phân tích yêu cầu của người dùng.

Xác định:
- mood
- energy
- genres
- language

Nếu người dùng nhắc đến nghệ sĩ,
bài hát hoặc mục đích nghe nhạc,
hãy cố gắng hiểu ngữ cảnh.

Chỉ trả về JSON.
Không markdown.
Không giải thích.

Format:

{
  "mood": "sad",
  "energy": "low",
  "genres": ["Ballad", "Lo-fi"],
  "language": "VN",
  "reason": "..."
}

Mood có thể là:
happy, sad, romantic, chill,
energetic, angry, nostalgic,
lonely, relaxed

Energy:
low, medium, high

Language:
VN, US-UK, mixed
`
          },

          {
            role: 'user',
            content: message.trim()
          }

        ]
      });

    const content =
      completion?.choices?.[0]?.message?.content;

    if (!content) {

      return res.status(500).json({
        error: 'AI không trả về kết quả'
      });
    }

    let result;

    try {

      let cleanedContent =
        content.trim();

      cleanedContent =
        cleanedContent
          .replace(/```json/gi, '')
          .replace(/```/g, '')
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
          'Không tìm thấy JSON trong response của AI'
        );
      }

      cleanedContent =
        cleanedContent.substring(
          jsonStart,
          jsonEnd + 1
        );

      result =
        JSON.parse(cleanedContent);

    } catch (parseError) {

      console.error(
        '❌ AI JSON ERROR:',
        content
      );

      return res.status(500).json({
        error:
          'AI trả về dữ liệu không hợp lệ',
        raw: content
      });
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {

    console.error(
      '❌ OPENROUTER ERROR:',
      error
    );

    res.status(500).json({
      error: 'Không thể kết nối AI',
      detail: error.message
    });
  }
});


// ============================================================
// AI PLAYLIST - DYNAMIC
// ============================================================

app.post('/api/ai/playlist', async (req, res) => {

  try {

    const { message, conversation } = req.body;

    if (!message || !String(message).trim()) {

      return res.status(400).json({
        error: 'Vui lòng nhập yêu cầu'
      });

    }

    const currentUserMessage =
      String(message).trim();

    console.log(
      '🤖 AI PLAYLIST REQUEST:',
      currentUserMessage
    );


    // ==========================================================
    // CHUẨN HÓA TEXT CỦA USER
    // ==========================================================

    const normalizedUserMessage =
      currentUserMessage
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[.,!?;:()[\]{}"']/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();


    // ==========================================================
    // CHUẨN HÓA CONVERSATION
    // ==========================================================

    const history = Array.isArray(conversation)

      ? conversation
          .filter(item =>
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
            content: item.content.trim()
          }))

      : [];


    // ==========================================================
    // ĐẢM BẢO MESSAGE HIỆN TẠI LUÔN CÓ TRONG HISTORY
    // ==========================================================

    const lastMessage =
      history[history.length - 1];

    if (
      !lastMessage ||
      lastMessage.role !== 'user' ||
      lastMessage.content !== currentUserMessage
    ) {

      history.push({
        role: 'user',
        content: currentUserMessage
      });

    }


    // ==========================================================
    // AI
    // ==========================================================

    const completion =
      await ai.chat.completions.create({

        model: 'openrouter/free',

        messages: [

          {
            role: 'system',

            content: `
Bạn là Melody AI của MelodyVN.

NHIỆM VỤ:
Hiểu yêu cầu nghe nhạc bằng ngôn ngữ tự nhiên và trả về bộ lọc
để backend tìm bài hát trong database.

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

Vì vậy:

- artist dùng để lọc nghệ sĩ.
- title dùng để lọc tên bài hát.
- mood chỉ mô tả cảm xúc người dùng muốn nghe.
- energy chỉ mô tả mức năng lượng.
- Không được đưa mood vào keywords.
- Không được đưa activity vào keywords.
- Không được bịa tên bài hát.
- Không được bịa nghệ sĩ.

============================================================
ARTIST LOCK
============================================================

Nếu người dùng nói tên nghệ sĩ,
phải đưa tên đó vào artists.

Ví dụ:

"nhạc Vũ"

=> artists: ["Vũ"]

KHÔNG được:

keywords: ["Vũ"]

KHÔNG được tự thêm nghệ sĩ khác.

KHÔNG được đề xuất nghệ sĩ tương tự nếu người dùng
không yêu cầu.

============================================================
NGHIÊM CẤM SUY DIỄN MOOD TỪ NGHỆ SĨ
============================================================

Tên nghệ sĩ KHÔNG phải mood.

"nhạc Vũ"

=> artists: ["Vũ"]
=> mood: ""
=> energy: ""

Không được tự suy luận:

Vũ = chill
Vũ = buồn
Vũ = hoài niệm
Vũ = lãng mạn

Tương tự:

"nhạc Sơn Tùng"

Không được tự suy luận:

Sơn Tùng = vui
Sơn Tùng = pop
Sơn Tùng = energetic

"nhạc Đen Vâu"

Không được tự suy luận:

Đen Vâu = rap
Đen Vâu = chill
Đen Vâu = buồn

nếu người dùng không nói.

============================================================
MOOD
============================================================

Chỉ trả mood khi người dùng thực sự yêu cầu.

Ví dụ:

"nhạc buồn"

=> mood: "sad"

"nhạc Vũ buồn"

=> artists: ["Vũ"]
=> mood: "sad"

"nhạc Vũ chill"

=> artists: ["Vũ"]
=> mood: "chill"

"nhạc lãng mạn"

=> mood: "romantic"

Không được đổi mood người dùng yêu cầu.

Ví dụ:

"buồn"

KHÔNG được trả:

mood: "romantic"

"buồn"

KHÔNG được trả:

mood: "nostalgic"

"chill"

KHÔNG được trả:

mood: "sad"

============================================================
MOOD PRIORITY
============================================================

Nếu người dùng trực tiếp nói mood,
mood của người dùng có độ ưu tiên cao nhất.

USER > AI

Ví dụ:

User:
"nhạc buồn"

AI:
mood: "romantic"

SAI.

Phải hiểu:
mood: "sad"

============================================================
ACTIVITY
============================================================

Nếu người dùng yêu cầu hoạt động:

"nhạc để chạy bộ"

=> energy: "high"

"nhạc để tập gym"

=> energy: "high"

"nhạc để học"

=> energy: "low"

"nhạc để ngủ"

=> energy: "low"

Không được tự suy luận energy nếu user không nói.

============================================================
KEYWORDS
============================================================

keywords chỉ dùng cho tên bài hát.

Ví dụ:

"Cho tao bài Có chắc yêu là đây"

=> keywords:
["Có chắc yêu là đây"]

Không được đưa:

chill
buồn
vui
chạy bộ
gym
học
ngủ

vào keywords nếu chúng chỉ là mood hoặc activity.

============================================================
NHIỀU NGHỆ SĨ
============================================================

"nhạc Sơn Tùng và Vũ"

=> artists:
["Sơn Tùng", "Vũ"]

Chỉ hai nghệ sĩ này.

Không thêm nghệ sĩ khác.

============================================================
HỘI THOẠI
============================================================

Nếu user nói:

"nhạc Vũ"

=> tạo playlist Vũ.

Nếu user tiếp tục:

"chill"

=> hiểu là:

"nhạc Vũ chill"

Nếu user tiếp tục:

"buồn"

=> hiểu là:

"nhạc Vũ buồn"

Nhưng nếu user bắt đầu một yêu cầu mới:

"nhạc Vũ"

thì không được lấy mood từ yêu cầu cũ.

============================================================
HỎI LẠI
============================================================

Nếu yêu cầu quá chung:

"cho tao nhạc"

có thể hỏi:

"Bạn muốn nghe nhạc theo mood hoặc hoạt động nào?"

Nhưng:

"nhạc Vũ"

đã đủ thông tin.

Không hỏi lại mood.

"nhạc Vũ buồn"

đã đủ thông tin.

"bài Có chắc yêu là đây"

đã đủ thông tin.

============================================================
OUTPUT
============================================================

Nếu cần hỏi:

{
  "type": "question",
  "question": "..."
}

Nếu đủ thông tin:

{
  "type": "playlist",
  "artists": [],
  "keywords": [],
  "mood": "",
  "energy": "",
  "limit": 10
}

CHỈ TRẢ JSON THUẦN TÚY.

KHÔNG MARKDOWN.

KHÔNG GIẢI THÍCH.

============================================================
VÍ DỤ BẮT BUỘC
============================================================

Input:
"nhạc Vũ"

Output:

{
  "type": "playlist",
  "artists": ["Vũ"],
  "keywords": [],
  "mood": "",
  "energy": "",
  "limit": 10
}

Input:
"nhạc Vũ chill"

Output:

{
  "type": "playlist",
  "artists": ["Vũ"],
  "keywords": [],
  "mood": "chill",
  "energy": "",
  "limit": 10
}

Input:
"nhạc Vũ buồn"

Output:

{
  "type": "playlist",
  "artists": ["Vũ"],
  "keywords": [],
  "mood": "sad",
  "energy": "",
  "limit": 10
}

Input:
"nhạc buồn"

Output:

{
  "type": "playlist",
  "artists": [],
  "keywords": [],
  "mood": "sad",
  "energy": "",
  "limit": 10
}

Input:
"nhạc lãng mạn"

Output:

{
  "type": "playlist",
  "artists": [],
  "keywords": [],
  "mood": "romantic",
  "energy": "",
  "limit": 10
}

Input:
"nhạc Sơn Tùng và Vũ"

Output:

{
  "type": "playlist",
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
  "artists": [],
  "keywords": ["Có chắc yêu là đây"],
  "mood": "",
  "energy": "",
  "limit": 10
}

Input:
"nhạc Vũ để chạy bộ"

Output:

{
  "type": "playlist",
  "artists": ["Vũ"],
  "keywords": [],
  "mood": "",
  "energy": "high",
  "limit": 10
}

============================================================
QUY TẮC CUỐI
============================================================

Không bịa artist.
Không bịa title.
Không thêm artist ngoài yêu cầu.
Không dùng mood/activity làm SQL keyword.
Không suy diễn mood từ artist.
Nếu user nói mood trực tiếp thì phải giữ đúng mood đó.
Nếu user không nói mood thì mood phải để rỗng.
Nếu có artist cụ thể thì backend phải khóa kết quả vào artist đó.
Nếu không tìm thấy artist/title cụ thể thì trả songs rỗng.
Không fallback sang nghệ sĩ khác.

CHỈ TRẢ JSON.
`
          },

          ...history

        ]
      });


    // ==========================================================
    // LẤY RESPONSE AI
    // ==========================================================

    const content =
      completion?.choices?.[0]?.message?.content;


    if (!content) {

      return res.status(500).json({
        error: 'AI không trả về kết quả'
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
          .replace(/```json/gi, '')
          .replace(/```/g, '')
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
        JSON.parse(cleanedContent);


    } catch (parseError) {

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
    // AI HỎI LẠI
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
      Array.isArray(aiData.artists)

        ? aiData.artists
            .map(
              x => String(x).trim()
            )
            .filter(Boolean)

        : [];


    // ==========================================================
    // KEYWORDS
    // ==========================================================

    const keywords =
      Array.isArray(aiData.keywords)

        ? aiData.keywords
            .map(
              x => String(x).trim()
            )
            .filter(Boolean)

        : [];


    // ==========================================================
    // SERVER MOOD VALIDATION
    // ==========================================================
    //
    // Không tin hoàn toàn mood mà AI trả.
    //
    // Server tự đọc câu user hiện tại.
    //
    // Ví dụ:
    //
    // user: "buồn"
    // AI: "romantic"
    //
    // => server: "sad"
    //
    // user: "nhạc Vũ"
    // AI: "chill"
    //
    // => server: ""
    //

    let explicitMood = '';


    // ==========================================================
    // SAD
    // ==========================================================

    if (
      /\b(buon|tam trang buon|that buon|buon qua|buon hon|u buon)\b/
        .test(normalizedUserMessage)
    ) {

      explicitMood = 'sad';

    }


    // ==========================================================
    // HAPPY
    // ==========================================================

    else if (
      /\b(vui|vui ve|vui tuoi|happy|phan khoi|tich cuc)\b/
        .test(normalizedUserMessage)
    ) {

      explicitMood = 'happy';

    }


    // ==========================================================
    // CHILL
    // ==========================================================

    else if (
      /\b(chill|thu gian|relax|relaxed|nhe nhang|em diu|de chiu)\b/
        .test(normalizedUserMessage)
    ) {

      explicitMood = 'chill';

    }


    // ==========================================================
    // ROMANTIC
    // ==========================================================

    else if (
      /\b(lang man|lang mang|tinh yeu|yeu duong|romantic|love)\b/
        .test(normalizedUserMessage)
    ) {

      explicitMood = 'romantic';

    }


    // ==========================================================
    // LONELY
    // ==========================================================

    else if (
      /\b(co don|co doc|lonely|mot minh)\b/
        .test(normalizedUserMessage)
    ) {

      explicitMood = 'lonely';

    }


    // ==========================================================
    // NOSTALGIC
    // ==========================================================

    else if (
      /\b(hoai niem|hoai co|nho xua|ky niem|nostalgic)\b/
        .test(normalizedUserMessage)
    ) {

      explicitMood = 'nostalgic';

    }


    // ==========================================================
    // ENERGETIC
    // ==========================================================

    else if (
      /\b(soi dong|nang luong|quay|bung no|energetic|sung)\b/
        .test(normalizedUserMessage)
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
          ).trim().toLowerCase()
        : '';


    const aiEnergy =
      aiData.energy
        ? String(
            aiData.energy
          ).trim().toLowerCase()
        : '';


    // ==========================================================
    // FINAL MOOD
    // ==========================================================
    //
    // USER > AI
    //
    // User nói gì thì server giữ đúng ý đó.
    //
    // User không nói mood:
    // => không có mood.
    //

    let finalMood =
      explicitMood;


    // ==========================================================
    // FINAL ENERGY
    // ==========================================================

    let finalEnergy = '';


    const explicitHighEnergy =
      /\b(chay bo|di bo|tap gym|gym|tap the duc|the duc|soi dong|nang luong cao|high energy|nang dong|quay|party|tiec|bung no)\b/
        .test(normalizedUserMessage);


    const explicitLowEnergy =
      /\b(hoc|hoc bai|ngu|ngu ngon|thu gian|relax|relaxed|nhe nhang|em diu)\b/
        .test(normalizedUserMessage);


    if (
      explicitHighEnergy
    ) {

      finalEnergy =
        'high';

    }

    else if (
      explicitLowEnergy
    ) {

      finalEnergy =
        'low';

    }


    // ==========================================================
    // ARTIST KHÔNG ĐƯỢC TỰ BIẾN THÀNH MOOD
    // ==========================================================

    if (
      artists.length > 0 &&
      !explicitMood
    ) {

      finalMood = '';

    }


    // ==========================================================
    // DEBUG
    // ==========================================================

    console.log(
      '🔒 FINAL MOOD LOCK:',
      {

        userMessage:
          currentUserMessage,

        normalizedUserMessage,

        explicitMood,

        aiMood,

        aiEnergy,

        finalMood,

        finalEnergy,

        artists

      }
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


    limit =
      Math.max(
        1,
        Math.min(
          limit,
          10
        )
      );


    // ==========================================================
    // DEBUG AI PARSED
    // ==========================================================

    console.log(
      '🧠 AI PARSED:',
      {

        artists,

        keywords,

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
    //
    // Exact artist.
    //
    // "Vũ" chỉ match "Vũ".
    //
    // Không dùng:
    //
    // artist LIKE "%Vũ%"
    //
    // vì sẽ có nguy cơ match nghệ sĩ khác.
    //

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

    const safeKeywords =
      keywords
        .slice(0, 6)
        .filter(
          keyword =>
            keyword.length >= 2
        );


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
        WHERE ${conditions.join(' AND ')}
      `;

    }


    sql += `
      ORDER BY play_count DESC, id DESC
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
    // KHÔNG TÌM THẤY
    // ==========================================================

    if (
      !songs ||
      songs.length === 0
    ) {

      console.log(
        '⚠️ Không tìm thấy bài đúng yêu cầu'
      );


      // ========================================================
      // CÓ ARTIST / TITLE
      // ========================================================
      //
      // TUYỆT ĐỐI KHÔNG FALLBACK.
      //

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

          query: {

            original:
              currentUserMessage,

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
      // KHÔNG CÓ ARTIST / TITLE
      // ========================================================
      //
      // Chỉ trường hợp này mới được lấy bài phổ biến.
      //

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
            ORDER BY play_count DESC, id DESC
            LIMIT ?
            `,

            [limit]

          );


      return res.json({

        success: true,

        type: 'playlist',

        query: {

          original:
            currentUserMessage,

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
    // TRỘN PLAYLIST
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
        count:
          playlist.length,

        artists,

        mood:
          finalMood,

        energy:
          finalEnergy
      }
    );


    res.json({

      success: true,

      type: 'playlist',

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


  } catch (error) {

    console.error(
      '❌ AI PLAYLIST ERROR:',
      error
    );


    res.status(500).json({

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
