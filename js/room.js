const socket = io('http://localhost:3000');

let currentRoom = null;
let isRoomDJ = false;

function renderRoomUI() {

  if (!currentRoom) return;

  const members = Array.isArray(currentRoom.members)
    ? currentRoom.members
    : [];

  document
    .getElementById('music-room')
    ?.classList.remove('hidden');

  document
    .getElementById('room-code-text')
    .textContent =
      'Mã: ' + currentRoom.code;

  const membersBox =
    document.getElementById('room-members');

  if (!membersBox) return;

  membersBox.innerHTML =
    members.map(member => `
      <div class="bg-zinc-800 p-3 rounded-xl">
        👤 ${member.username}
      </div>
    `).join('');
}
function sendChat() {

  const input = document.getElementById("chat-input");
  const message = input.value.trim();

  if (!message || !currentRoom) return;

  const user = JSON.parse(localStorage.getItem("user"));

  socket.emit("chat:send", {
    roomCode: currentRoom.code,
    username: user.username,
    message
  });

  input.value = "";
}
// ================= MODAL =================

function openRoomModal() {
  document
    .getElementById('room-modal')
    ?.classList.remove('hidden');

  document
    .getElementById('room-modal')
    ?.classList.add('flex');
}

function closeRoomModal() {
  document
    .getElementById('room-modal')
    ?.classList.add('hidden');

  document
    .getElementById('room-modal')
    ?.classList.remove('flex');
}

// ================= CREATE ROOM =================

function createRoom() {

  const password =
    document.getElementById(
      'room-password-create'
    ).value;

  const user =
    JSON.parse(
      localStorage.getItem('user')
    );

  socket.emit('room:create', {
    username: user.username,
    password
  });

}

// ================= JOIN ROOM =================

function joinRoom() {

  const roomCode =
    document.getElementById(
      'room-code-join'
    ).value
      .trim()
      .toUpperCase();

  const password =
    document.getElementById(
      'room-password-join'
    ).value;

  const user =
    JSON.parse(
      localStorage.getItem('user')
    );

  socket.emit('room:join', {
    roomCode,
    password,
      username: user.username
  });

}function leaveRoom() {

  location.reload();

}
function showToast(message, username = "System") {
  const toast = document.createElement("div");

  toast.className = `
    fixed top-5 right-5 z-[99999]
    min-w-[260px]
    bg-zinc-900/95
    text-white
    px-4 py-3
    rounded-2xl
    shadow-2xl
    border border-zinc-700
    backdrop-blur-md
    animate-fadeIn
  `;

  toast.innerHTML = `
    <div class="flex items-center gap-2">
      <div class="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
      <div class="text-sm font-semibold text-emerald-400">
        ${username}
      </div>
    </div>

    <div class="text-sm mt-1 text-zinc-200">
      ${message}
    </div>
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

  const box =
    document.getElementById(
      'room-song-list'
    );

  if (!box) return;

  box.innerHTML =
    window.songs.map(song => `

      <div
        onclick="roomPlaySong(${song.id})"
       class="
  flex
  items-center
  gap-3
  bg-zinc-900
  ${isRoomDJ ? 'hover:bg-zinc-800 cursor-pointer' : 'opacity-60 cursor-not-allowed'}
          p-3
          rounded-2xl
          cursor-pointer
          transition
        ">

        <img
          src="${song.cover}"
          class="w-14 h-14 rounded-xl object-cover">

        <div class="flex-1 min-w-0">

          <div class="truncate font-medium">
            ${song.title}
          </div>

          <div class="truncate text-sm text-zinc-400">
            ${song.artist}
          </div>

        </div>

      </div>

    `).join('');

    
}
function roomPlaySong(songId) {

  // KHÔNG PHẢI DJ => KHÔNG CHO PHÁT
  if (!isRoomDJ) return;

  if (!currentRoom) return;

  const song =
    window.songs.find(
      s => s.id === songId
    );

  if (!song) return;

  const idx =
    window.songs.findIndex(
      s => s.id === songId
    );

  playSong(idx);

  socket.emit(
    'player:play',
    {
      roomCode: currentRoom.code,
      song,
      currentTime: 0
    }
  );

}
function updateDJControls() {

  const disabled = !isRoomDJ;

  document.querySelectorAll("button, input, select").forEach(el => {
    el.disabled = disabled;
    el.style.opacity = disabled ? "0.4" : "1";
    el.style.pointerEvents = disabled ? "none" : "auto";
  });
}

// ================= SOCKET =================

socket.on('room:update', (room) => {

  currentRoom = room;

  renderRoomUI();

  renderRoomSongs();
    closeRoomModal();
 updatePlayerVisibility();
});

socket.on('room:created', (room) => {

  currentRoom = room;

  isRoomDJ = true;

  closeRoomModal();

  renderRoomUI();

  renderRoomSongs();

  updateDJControls();
  closeRoomModal(); 
   updatePlayerVisibility(); 
});

socket.on('room:error', (msg) => {

  alert(msg);

});
socket.on(
  'player:play',
  ({
    song,
    currentTime
  }) => {

    const idx =
      window.songs.findIndex(
        s => s.id === song.id
      );

    if (idx === -1) return;

    playSong(idx);

    setTimeout(() => {

      if (audio?.duration) {
        audio.currentTime =
          currentTime;
      }

    }, 1000);

  }
);
socket.on('player:pause', ({ currentTime }) => {

  console.log('PAUSE RECEIVED');

  if (youtubePlayer?.pauseVideo) {
    youtubePlayer.pauseVideo();
  }

  if (audio) {
    audio.pause();
    audio.currentTime = currentTime || audio.currentTime;
  }

  isPlaying = false;

  document.getElementById('play-btn').innerHTML =
    `<i class="fas fa-play"></i>`;
});
socket.on('player:play', ({ song, currentTime }) => {

  if (!song) return;

  const idx = window.songs.findIndex(s => s.id === song.id);
  if (idx !== -1) {
    playSong(idx);
  }

  setTimeout(() => {

    if (audio) {
      audio.currentTime = currentTime || 0;
      audio.play();
    }

    if (youtubePlayer?.seekTo) {
      youtubePlayer.seekTo(currentTime || 0, true);
      youtubePlayer.playVideo();
    }

    isPlaying = true;

    document.getElementById('play-btn').innerHTML =
      `<i class="fas fa-pause"></i>`;

  }, 300);
});
socket.on("chat:receive", (data) => {

  const box = document.getElementById("chat-messages");
  if (!box) return;

  const div = document.createElement("div");

  div.className = "bg-zinc-800 p-2 rounded-lg text-sm";

  div.innerHTML = `
    <div class="text-emerald-400 text-xs">${data.username}</div>
    <div>${data.message}</div>
  `;

  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const input = document.getElementById("chat-input");
    if (document.activeElement === input) {
      sendChat();
    }
  }
});
socket.on("user-joined", (data) => {
  console.log("JOIN EVENT:", data);
  showToast(data.message);
});
socket.off("user-joined"); // QUAN TRỌNG

socket.on("user-joined", (data) => {
  console.log("JOIN EVENT:", data);

  showToast(data.message, data.username);
});

// ================= EXPORT =================

window.openRoomModal =
  openRoomModal;

window.closeRoomModal =
  closeRoomModal;

window.createRoom =
  createRoom;

window.joinRoom =
  joinRoom;
window.leaveRoom =
  leaveRoom;
  window.roomPlaySong =
  roomPlaySong;
window.isRoomDJ = isRoomDJ;
window.currentRoom = currentRoom;

window.sendChat = sendChat;