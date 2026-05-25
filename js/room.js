// js/room.js
const socket = io('https://melody-ehdi.onrender.com/');

let currentRoom = null;
let isRoomDJ = false;
let totalMessages = 0;

function renderRoomUI() {
  if (!currentRoom) return;
  const members = Array.isArray(currentRoom.members) ? currentRoom.members : [];

  document.getElementById('music-room')?.classList.remove('hidden');
  document.getElementById('room-code-text').textContent = currentRoom.code;

  isRoomDJ = (currentRoom.dj === socket.id);
  window.isRoomDJ = isRoomDJ; // Cập nhật liên tục vào window cho player.js đọc

  const membersBox = document.getElementById('room-members');
  if (!membersBox) return;

  membersBox.innerHTML = members.map(member => {
    const isTargetDj = (currentRoom.dj === member.id);
    const roleText = isTargetDj ? "DJ" : "Member";
    const roleBadge = isTargetDj 
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
      : "bg-zinc-800 text-zinc-400 border-zinc-700/50";

    return `
      <div class="bg-zinc-900/50 border border-zinc-800/40 p-2.5 rounded-xl flex items-center justify-between group transition-all duration-200 hover:bg-zinc-850">
        <div class="flex items-center gap-2 min-w-0">
          <div class="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center font-medium text-xs text-zinc-300">
            ${member.username.charAt(0).toUpperCase()}
          </div>
          <div class="truncate flex flex-col">
            <span class="text-sm font-medium text-zinc-200 truncate">${member.username}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded border ${roleBadge} w-max font-semibold mt-0.5">${roleText}</span>
          </div>
        </div>

        ${isRoomDJ && member.id !== socket.id ? `
          <div class="relative">
            <button onclick="toggleActionMenu('${member.id}')" class="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition">
              <i class="fas fa-ellipsis-v text-xs"></i>
            </button>
            <div id="menu-${member.id}" class="hidden absolute right-0 mt-1 w-44 bg-zinc-900 border border-zinc-800/80 rounded-xl shadow-2xl z-50 p-1 animate-fadeIn">
              <button onclick="changeUserRole('${member.id}', '${isTargetDj ? 'member' : 'dj'}')" 
                      class="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 rounded-lg flex items-center gap-2 transition">
                <i class="fas fa-exchange-alt text-zinc-400"></i> Chỉ định làm ${isTargetDj ? 'Thành viên' : 'Quản phòng (DJ)'}
              </button>
              <button onclick="kickUser('${member.id}')" 
                      class="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-lg mt-0.5 flex items-center gap-2 transition">
                <i class="fas fa-user-slash"></i> Mời khỏi phòng
              </button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  updateDJControls();
}

function toggleActionMenu(memberId) {
  const menu = document.getElementById(`menu-${memberId}`);
  if (menu) menu.classList.toggle("hidden");
}

function changeUserRole(targetId, newRole) {
  if (!currentRoom) return;
  socket.emit("room:change-role", {
    roomCode: currentRoom.code,
    targetId,
    newRole
  });
}

function kickUser(targetId) {
  if (!currentRoom) return;
  if (confirm("Bạn có chắc muốn kick thành viên này không?")) {
    socket.emit("room:kick", {
      roomCode: currentRoom.code,
      targetId
    });
  }
}

function openRoomModal() {
  const modal = document.getElementById('room-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeRoomModal() {
  const modal = document.getElementById('room-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

// ================= CREATE ROOM =================
function createRoom() {
  const passwordInput = document.getElementById('room-password-create');
  const password = passwordInput ? passwordInput.value : "";

  let username = "Ẩn danh";
  try {
    const localUser = localStorage.getItem('user');
    if (localUser) {
      const user = JSON.parse(localUser);
      if (user && user.username) username = user.username;
    }
  } catch (e) { console.error("Lỗi đọc localStorage:", e); }

  console.log("🚀 Đang gửi yêu cầu tạo phòng với tên:", username);
  socket.emit('room:create', { username, password });
}

// ================= JOIN ROOM =================
function joinRoom() {
  const codeInput = document.getElementById('room-code-join');
  const passwordInput = document.getElementById('room-password-join');
  
  const roomCode = codeInput ? codeInput.value.trim().toUpperCase() : "";
  const password = passwordInput ? passwordInput.value : "";

  if (!roomCode) {
    alert("Vui lòng nhập mã phòng!");
    return;
  }

  let username = "Ẩn danh";
  try {
    const localUser = localStorage.getItem('user');
    if (localUser) {
      const user = JSON.parse(localUser);
      if (user && user.username) username = user.username;
    }
  } catch (e) { console.error("Lỗi đọc localStorage:", e); }

  console.log("🚀 Đang gửi yêu cầu vào phòng:", roomCode, "với tên:", username);
  socket.emit('room:join', { roomCode, password, username });
}

function leaveRoom() {
  location.reload();
}

function showToast(message, username = "System") {
  const toast = document.createElement("div");
  toast.className = "fixed top-5 right-5 z-[99999] min-w-[260px] bg-zinc-900/95 text-white px-4 py-3 rounded-2xl shadow-2xl border border-zinc-700 backdrop-blur-md animate-fadeIn";
  toast.innerHTML = `
    <div class="flex items-center gap-2">
      <div class="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
      <div class="text-sm font-semibold text-emerald-400">${username}</div>
    </div>
    <div class="text-sm mt-1 text-zinc-200">${message}</div>
  `;

  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(20px)";
    toast.style.transition = "all 0.4s ease";
    setTimeout(() => toast.remove(), 400);
  }, 2500);
}

function renderRoomSongs() {
  const box = document.getElementById('room-song-list');
  if (!box || !window.songs) return;

  box.innerHTML = window.songs.map(song => `
    <div onclick="roomPlaySong(${song.id})" 
         class="flex items-center gap-3 bg-zinc-900/40 border border-zinc-900/80 p-3 rounded-xl transition-all duration-300 group ${isRoomDJ ? 'hover:bg-zinc-800/60 cursor-pointer hover:border-emerald-500/20 hover:translate-y-[-1px]' : 'opacity-60 cursor-not-allowed'}">
      <div class="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 shadow-md">
        <img src="${song.cover}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
        ${isRoomDJ ? `
          <div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <i class="fas fa-play text-white text-xs"></i>
          </div>
        ` : ''}
      </div>
      <div class="flex-1 min-w-0">
        <div class="truncate text-sm font-medium text-zinc-200 group-hover:text-emerald-400 transition-colors">${song.title}</div>
        <div class="truncate text-xs text-zinc-400 mt-0.5">${song.artist}</div>
      </div>
    </div>
  `).join('');
}

function roomPlaySong(songId) {
  if (!isRoomDJ || !currentRoom) return;

  const song = window.songs.find(s => s.id === songId);
  if (!song) return;

  window.currentSong = song; 
  currentRoom.song = song;

  const idx = window.songs.findIndex(s => s.id === songId);
  if (typeof playSong === "function") {
    playSong(idx, 0); // Kích hoạt phát nhạc cục bộ ngay lập tức cho DJ
  }

  socket.emit('player:play', {
    roomCode: currentRoom.code,
    song,
    currentTime: 0,
    sentAt: Date.now()
  });
}

function updateDJControls() {
  const disabled = !isRoomDJ;
  const djElements = document.querySelectorAll('#room-play-btn, #play-btn, #progress, #speed-control, [onclick="nextSong()"], [onclick="prevSong()"]');

  djElements.forEach(el => {
    el.disabled = disabled;
    el.style.opacity = disabled ? "0.4" : "1";
    el.style.pointerEvents = disabled ? "none" : "auto";
  });
  
  const systemButtons = document.querySelectorAll('[onclick="leaveRoom()"], [onclick^="toggleActionMenu"]');
  systemButtons.forEach(el => {
    el.disabled = false;
    el.style.opacity = "1";
    el.style.pointerEvents = "auto";
  });
}

// ================= SEND CHAT LOGIC =================
function sendChat() {
  const input = document.getElementById("chat-input");
  const message = input.value.trim();
  if (!message || !currentRoom) return;

  let username = "Ẩn danh";
  try {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user && user.username) username = user.username;
  } catch (e) { console.error(e); }

  socket.emit("chat:send", {
    roomCode: currentRoom.code,
    username,
    message,
    isEmoji: false
  });
  input.value = "";
}

function sendQuickEmoji(emoji) {
  if (!currentRoom) return;

  let username = "Ẩn danh";
  try {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user && user.username) username = user.username;
  } catch (e) { console.error(e); }

  socket.emit("chat:send", {
    roomCode: currentRoom.code,
    username,
    message: emoji,
    isEmoji: true
  });
}

function toggleMessengerChat() {
  const chatBox = document.getElementById("chat-messenger-box");
  const chatDot = document.getElementById("chat-dot");
  const boxMessages = document.getElementById("chat-messages");
  if (!chatBox) return;

  chatBox.classList.toggle("hidden");

  if (!chatBox.classList.contains("hidden")) {
    if (chatDot) chatDot.classList.add("hidden");
    if (boxMessages) {
      setTimeout(() => { boxMessages.scrollTop = boxMessages.scrollHeight; }, 80);
    }
  }
}

// ================= SOCKET LISTENERS =================
socket.on('room:update', (room) => {
  currentRoom = room;
  window.currentRoom = room; // Đồng bộ liên tục ra môi trường ngoài
  
  renderRoomUI();
  renderRoomSongs();
  closeRoomModal();

  if (typeof updatePlayerVisibility === "function") {
    updatePlayerVisibility();
  }

  // Khôi phục nạp lịch sử chat cũ
  const box = document.getElementById("chat-messages");
  if (box && room.messages && room.messages.length > 0) {
    box.innerHTML = ""; 
    totalMessages = 0;   

    room.messages.forEach(data => {
      if (data.isSystem) {
        const sysDiv = document.createElement("div");
        sysDiv.className = "w-full text-center my-1 text-[11px] text-zinc-500 font-medium tracking-wide bg-zinc-900/40 py-1 px-3 rounded-lg border border-zinc-800/30 self-center max-w-[90%] truncate shadow-sm";
        sysDiv.innerHTML = data.message;
        box.appendChild(sysDiv);
        return;
      }

      totalMessages++;
      const isMe = data.senderId === socket.id;
      const mainDiv = document.createElement("div");
      mainDiv.className = `flex flex-col max-w-[75%] ${isMe ? 'self-end items-end' : 'self-start items-start'} mb-1.5 animate-fadeIn`;
      let roleBadge = data.role === 'dj' ? `<span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] px-1 rounded font-bold ml-1">DJ</span>` : '';

      if (data.isEmoji) {
        mainDiv.innerHTML = `
          ${!isMe ? `<span class="text-[10px] text-zinc-500 mb-0.5 ml-1">${data.username} ${roleBadge}</span>` : ''}
          <div class="text-3xl my-1 animate-bounce">${data.message}</div>
        `;
      } else {
        const bubbleBg = isMe ? 'bg-emerald-600 text-white rounded-2xl rounded-tr-sm' : 'bg-zinc-800 text-zinc-200 rounded-2xl rounded-tl-sm';
        mainDiv.innerHTML = `
          ${!isMe ? `<span class="text-[10px] text-zinc-500 mb-0.5 ml-1">${data.username} ${roleBadge}</span>` : ''}
          <div class="${bubbleBg} px-3 py-2 text-sm shadow-md break-all leading-relaxed">
            ${data.message}
          </div>
        `;
      }
      box.appendChild(mainDiv);
    });

    const countEl = document.getElementById("chat-count");
    if (countEl) countEl.textContent = `${totalMessages} tin nhắn`;
    box.scrollTop = box.scrollHeight;
  }
});

socket.on('room:created', (room) => {
  console.log("✅ Đã tạo phòng thành công từ Server:", room);
  currentRoom = room;
  window.currentRoom = room;
  isRoomDJ = true;
  window.isRoomDJ = true;
  
  closeRoomModal();
  renderRoomUI();
  renderRoomSongs();
  updateDJControls();
  
  if (typeof updatePlayerVisibility === "function") {
    updatePlayerVisibility(); 
  }
});

socket.on("room:kicked-notice", (msg) => {
  alert(msg);
  location.reload(); 
});

socket.on('room:error', (msg) => {
  alert(msg);
});

socket.on("user-joined", (data) => {
  console.log("JOIN EVENT:", data);
  showToast(data.message, data.username || "System");
});

socket.on("chat:receive", (data) => {
  const chatBox = document.getElementById("chat-messenger-box");
  if (chatBox && chatBox.classList.contains("hidden") && !data.isSystem) {
    document.getElementById("chat-dot")?.classList.remove("hidden");
  }

  const box = document.getElementById("chat-messages");
  if (!box) return;

  if (data.isSystem) {
    const sysDiv = document.createElement("div");
    sysDiv.className = "w-full text-center my-2 text-[11px] text-zinc-500 font-medium tracking-wide bg-zinc-900/40 py-1 px-3 rounded-lg border border-zinc-800/30 self-center max-w-[90%] truncate shadow-sm";
    sysDiv.innerHTML = data.message;
    box.appendChild(sysDiv);
    box.scrollTop = box.scrollHeight;
    return;
  }

  totalMessages++;
  const countEl = document.getElementById("chat-count");
  if (countEl) countEl.textContent = `${totalMessages} tin nhắn`;

  const isMe = data.senderId === socket.id;
  const mainDiv = document.createElement("div");
  mainDiv.className = `flex flex-col w-full ${isMe ? 'items-end' : 'items-start'} mb-2 animate-fadeIn`;
  let roleBadge = data.role === 'dj' ? `<span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] px-1 rounded font-bold ml-1">DJ</span>` : '';

  if (data.isEmoji) {
    mainDiv.innerHTML = `
      ${!isMe ? `<span class="text-[11px] text-zinc-400 mb-0.5 ml-1 font-medium">${data.username} ${roleBadge}</span>` : ''}
      <div class="text-4xl my-1 select-none transform hover:scale-110 transition active:scale-95 duration-150">${data.message}</div>
    `;
  } else {
    const bubbleClass = isMe ? 'bg-emerald-600 text-white rounded-2xl rounded-tr-none ml-12' : 'bg-zinc-800 text-zinc-100 rounded-2xl rounded-tl-none mr-12';
    mainDiv.innerHTML = `
      ${!isMe ? `<span class="text-[11px] text-zinc-400 mb-1 ml-1 font-medium">${data.username} ${roleBadge}</span>` : ''}
      <div class="${bubbleClass} px-3.5 py-2 text-sm shadow-md break-all max-w-[75%] leading-relaxed tracking-wide">
        ${data.message}
      </div>
    `;
  }

  box.appendChild(mainDiv);
  box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
});


// ================= ĐỒNG BỘ PHÁT NHẠC (ĐÃ FIX TRIỆT ĐỂ LỖI REPLAY) =================
socket.on('player:play', (data) => {
    if (!data || !data.song) return;
    
    // Nếu là DJ thì tuyệt đối không xử lý lệnh này để tránh vòng lặp vô hạn
    if (window.currentRoom && window.isRoomDJ) return; 

    // 1. Cập nhật giao diện tên bài hát, ca sĩ, cover cho Member
    const nowCover = document.getElementById('now-cover');
    const nowTitle = document.getElementById('now-title');
    const nowArtist = document.getElementById('now-artist');

    if (nowCover) nowCover.src = data.song.cover || "https://picsum.photos/id/1015/300/300";
    if (nowTitle) nowTitle.textContent = data.song.title || "Chưa phát bài nào";
    if (nowArtist) nowArtist.textContent = data.song.artist || "MelodyVN";

    // 2. Tìm chính xác index của bài hát trong danh sách gốc của hệ thống
    let foundIdx = 0;
    if (window.songs) {
        const idx = window.songs.findIndex(s => s.id === data.song.id);
        if (idx !== -1) {
            foundIdx = idx;
            window.currentSongIndex = idx; // Ghi đè trực tiếp vào bộ nhớ dùng chung toàn cục
        }
    }

    // 3. Tính toán thời gian DJ gửi xuống + độ trễ mạng cực nhanh
    const rawTime = parseFloat(data.currentTime);
    const djTime = isNaN(rawTime) ? 0 : rawTime;
    const latency = data.sentAt ? (Date.now() - data.sentAt) / 1000 : 0;
    const safeLatency = (latency > 0 && latency < 4) ? latency : 0;
    const calculatedTime = djTime + safeLatency;

    isPlaying = true;
    const btn = document.getElementById('play-btn');
    if (btn) btn.innerHTML = `<i class="fas fa-pause"></i>`;
    if (nowCover) nowCover.classList.remove('paused');

    // 4. Phân loại nguồn bài hát
    const srcLower = (data.song.src || "").toLowerCase();
    const isYouTube = srcLower.includes("youtube.com") || srcLower.includes("youtu.be");

    if (isYouTube) {
        // --- XỬ LÝ YOUTUBE ---
        if (!youtubePlayer || typeof youtubePlayer.loadVideoById !== 'function') {
            // Không có trình phát hoặc đổi bài mới hoàn toàn -> Load mới
            if (typeof playYouTube === "function") playYouTube(data.song.src, calculatedTime, false);
        } else {
            const currentVideoId = youtubePlayer.getVideoData ? youtubePlayer.getVideoData().video_id : "";
            const newVideoId = extractYouTubeId ? extractYouTubeId(data.song.src) : "";

            // Đồng bộ cả 2 ID về dạng chữ thường để so sánh chuẩn xác tuyệt đối
            if (currentVideoId && currentVideoId.toLowerCase() === newVideoId.toLowerCase()) {
                youtubePlayer.playVideo();
                setTimeout(() => {
                    try {
                        if (Math.abs(youtubePlayer.getCurrentTime() - calculatedTime) > 3) {
                            youtubePlayer.seekTo(calculatedTime, true);
                        }
                    } catch(e){}
                }, 100);
            } else {
                if (typeof playYouTube === "function") playYouTube(data.song.src, calculatedTime, false);
            }
        }
    } else {
        // --- XỬ LÝ MP3 / HTML5 AUDIO (ĐÃ FIX LỖI ĐỘ LỆCH URL MÃ HÓA) ---
        if (audio) {
            const tempLink = document.createElement('a');
            tempLink.href = data.song.src;
            
            // Ép cả 2 chuỗi URL về dạng giải mã văn bản thô để triệt tiêu các ký tự tự động biến đổi (%20,...)
            const cleanCurrentSrc = decodeURIComponent(audio.src || "").trim();
            const cleanTargetSrc = decodeURIComponent(tempLink.href || "").trim();
            const timeDiff = Math.abs(audio.currentTime - calculatedTime);

            if (cleanCurrentSrc && cleanCurrentSrc === cleanTargetSrc) {
                // Đang mở chuẩn bài hát cũ -> CHỈ bấm play tiếp, cấm gán lại .src gây reload phát lại từ đầu
                if (audio.paused) {
                    audio.play().catch(e => console.log("Lỗi tiếp tục phát MP3:", e));
                }
                
                // Chỉ nhảy tiến trình nhạc nếu lệch quá nặng (> 2.5 giây) nhằm triệt tiêu hiện tượng giật giật
                if (timeDiff > 2.5) {
                    audio.currentTime = calculatedTime;
                }
            } else {
                // Đổi sang bài mới hoàn toàn -> Ép trình phát nạp tài nguyên mới
                audio.pause();
                audio.src = data.song.src;
                audio.load();
                audio.currentTime = calculatedTime;
                audio.play().catch(e => console.log("Lỗi tự động phát bài mới MP3:", e));
            }
        }
    }
});

socket.on('player:pause', ({ currentTime }) => {
    if (window.currentRoom && window.isRoomDJ) return; 

    isPlaying = false;
    
    const btn = document.getElementById('play-btn');
    if (btn) btn.innerHTML = `<i class="fas fa-play"></i>`;
    
    const nowCover = document.getElementById('now-cover');
    if (nowCover) nowCover.classList.add('paused');

    const parsedTime = parseFloat(currentTime);
    const safeTime = (isNaN(parsedTime) || parsedTime < 0) ? 0 : parsedTime;

    // Đọc bài hát dựa trên biến window đã đồng bộ chuẩn xác
    const currentSong = window.songs ? window.songs[window.currentSongIndex] : null;
    const srcLower = (currentSong?.src || "").toLowerCase();
    const isYouTube = srcLower.includes("youtube.com") || srcLower.includes("youtu.be");

    if (isYouTube && youtubePlayer) {
        try {
            if (typeof youtubePlayer.pauseVideo === 'function') {
                youtubePlayer.pauseVideo();
            }
            setTimeout(() => {
                if (typeof youtubePlayer.seekTo === 'function') {
                    youtubePlayer.seekTo(safeTime, false); // false để không bắt nó nạp lại dữ liệu tiếp
                }
            }, 50);
        } catch (e) { console.log(e); }
    } else if (!isYouTube && audio) {
        try {
            audio.pause();
            audio.currentTime = safeTime;
        } catch (e) { console.log(e); }
    }
});

// ================= UTILS & KEY EVENTS =================
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const input = document.getElementById("chat-input");
    if (document.activeElement === input) {
      sendChat();
    }
  }
});

// Gán các hàm ra global để HTML onclick đọc được
Object.assign(window, {
  toggleActionMenu, changeUserRole, kickUser,
  openRoomModal, closeRoomModal, createRoom, joinRoom, leaveRoom,
  roomPlaySong, toggleMessengerChat, sendQuickEmoji, sendChat
});
