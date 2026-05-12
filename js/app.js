
let currentPage = 1;
let loadingSongs = false;
window.isMusicPlaying = false;

// ====================== START ======================

document.addEventListener('DOMContentLoaded', () => {

  window.songs = [];

  const token = localStorage.getItem('token');

  if (!token) {

    document
      .getElementById('login-modal')
      ?.classList.remove('hidden');

    return;
  }

  document
    .getElementById('login-modal')
    ?.classList.add('hidden');

  initPlayer?.();
  initPlayerUI?.();

  loadHome();
  updateGreeting();
  fetchSongs();

});

// ====================== GREETING ======================

function updateGreeting() {

  const el = document.getElementById('greeting-text');
  if (!el) return;

  const h = new Date().getHours();

  el.innerText =
    h < 12 ? "Chào buổi sáng 👋"
    : h < 18 ? "Chào buổi chiều ☀️"
    : h < 22 ? "Chào buổi tối 🌙"
    : "Làm tí nhạc đêm khuya nào ✨";
}

// ====================== HOME ======================

function loadHome() {

  const user = JSON.parse(localStorage.getItem('user'));

  document.getElementById('main-content').innerHTML = `

    <div class="p-8">

      <div class="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">

        <div>

          <h1 id="greeting-text" class="text-4xl font-bold mb-2">
            Chào 👋
          </h1>

          <p class="text-zinc-400">
            👤 ${user?.username}
            <span class="ml-2 px-2 py-1 bg-emerald-600 text-white text-xs rounded">
              ${user?.role}
            </span>
          </p>

          <p class="text-zinc-400 mt-1">
            Playlist (${window.songs.length} bài)
          </p>

        </div>

        <div class="flex gap-2 flex-wrap">

          <button onclick="showDiscover()"
            class="bg-purple-600 px-4 py-2 rounded text-white">
            Khám phá
          </button>

          <button onclick="showLibrary()"
            class="bg-blue-600 px-4 py-2 rounded text-white">
            Thư viện
          </button>

          ${user?.role === 'admin' ? `
            <button onclick="uploadMusic()"
              class="bg-emerald-600 px-4 py-2 rounded text-white">
              + Thêm bài hát
            </button>
          ` : ''}

        </div>

      </div>

      <div id="song-list"
        class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
      </div>

    </div>

  `;

  renderSongList();
}

// ====================== FETCH SONGS ======================

async function fetchSongs() {

  try {

    const res = await fetch('/api/songs');
    const songs = await res.json();

    window.songs = Array.isArray(songs) ? songs : [];

    const libRes = await fetch('/api/library', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    });

    let liked = [];

    if (libRes.ok) {
      liked = await libRes.json();
      liked = Array.isArray(liked) ? liked : [];
    }

    const likedIds = liked.map(s => s.id);

    window.songs = window.songs.map(s => ({
      ...s,
      liked: likedIds.includes(s.id)
    }));

    renderSongList();

  } catch (err) {
    console.log(err);
    window.songs = [];
  }
}

// ====================== RENDER ======================

function renderSongList(list = window.songs) {

  const el = document.getElementById('song-list');
  if (!el) return;

  el.innerHTML = '';

  if (!list.length) {
    el.innerHTML = `<p class="text-zinc-400 col-span-full text-center">Không có bài hát</p>`;
    return;
  }

  list.forEach(song => {

    const index = window.songs.findIndex(s => s.id === song.id);

    const div = document.createElement('div');

    div.className = "bg-zinc-900 p-3 rounded-xl cursor-pointer";

    div.innerHTML = `

      <img src="${song.cover}" class="w-full aspect-square rounded-lg">

      <p class="font-medium mt-2">${song.title}</p>
      <p class="text-sm text-zinc-400">${song.artist}</p>

      <button onclick="toggleLike(${song.id}); event.stopPropagation();"
        class="mt-2 text-sm">

        ${song.liked ? "❤️ Đã thích" : "🤍 Thích"}

      </button>

    `;

    div.onclick = () => playSong(index);

    el.appendChild(div);

  });
}

// ====================== LIKE ======================

async function toggleLike(id) {

  await fetch(`/api/favorite/${id}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`
    }
  });

  fetchSongs();
}

// ====================== DISCOVER ======================
async function showDiscover() {

  const res = await fetch('/api/discover');
  const data = await res.json();

  const html = `

    <div class="p-8 space-y-10">

      <!-- RECOMMENDED -->
      <div>
        <h2 class="text-xl font-bold mb-4">🎯 Gợi ý cho bạn</h2>
        <div id="rec-list" class="grid grid-cols-5 gap-4"></div>
      </div>

      <!-- TRENDING -->
      <div>
        <h2 class="text-xl font-bold mb-4">🔥 Trending</h2>
        <div id="trend-list" class="grid grid-cols-5 gap-4"></div>
      </div>

      <!-- NEW -->
      <div>
        <h2 class="text-xl font-bold mb-4">🆕 Mới nhất</h2>
        <div id="new-list" class="grid grid-cols-5 gap-4"></div>
      </div>

    </div>

  `;

  document.getElementById('main-content').innerHTML = html;

  renderMiniList("rec-list", data.recommended);
  renderMiniList("trend-list", data.trending);
  renderMiniList("new-list", data.latest);
}

function renderMiniList(id, list) {

  const el = document.getElementById(id);
  if (!el) return;

  el.innerHTML = "";

  (list || []).forEach(song => {

    const div = document.createElement("div");

    div.className = "bg-zinc-900 p-2 rounded cursor-pointer";

    div.innerHTML = `
      <img src="${song.cover}" class="w-full aspect-square rounded">
      <p class="text-sm mt-1">${song.title}</p>
    `;

    div.onclick = () => playSong(song.id);

    el.appendChild(div);
  });
}
// ====================== LIBRARY ======================

function showLibrary() {
  renderSongList(window.songs.filter(s => s.liked));
}

// ====================== ADMIN UPLOAD ======================

function uploadMusic() {

  const user = JSON.parse(localStorage.getItem('user'));

  // check role admin
  if (!user || user.role !== 'admin') {
    alert('❌ Bạn không có quyền thêm bài hát');
    return;
  }

  // mở modal
  const modal = document.getElementById('add-song-modal');
  if (!modal) return;

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

window.uploadMusic = uploadMusic;
function closeAddSongModal() {

  const modal = document.getElementById('add-song-modal');
  if (!modal) return;

  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

window.closeAddSongModal = closeAddSongModal;
async function submitSong() {

  const token = localStorage.getItem('token');

  const title = document.getElementById('song-title').value;
  const artist = document.getElementById('song-artist').value;
  const src = document.getElementById('song-src').value;
  const cover = document.getElementById('song-cover').value;

  if (!title || !artist || !src || !cover) {
    alert('❌ Thiếu thông tin');
    return;
  }

  try {

    const res = await fetch('/api/songs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token
      },
      body: JSON.stringify({
        title,
        artist,
        src,
        cover,
        type: 'mp3'
      })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Upload thất bại');
      return;
    }

    alert('✅ Thêm bài hát thành công');

    closeAddSongModal();
    fetchSongs(); // reload list

  } catch (err) {
    console.log(err);
    alert('❌ Lỗi server');
  }
}

window.submitSong = submitSong;
// ====================== LOGIN ======================

async function login() {

  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;

  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();

  if (!data.token) return alert("Sai tài khoản");

  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));

  location.reload();
}

// ====================== REGISTER ======================

async function register() {

  const username = document.getElementById('register-username').value;
  const password = document.getElementById('register-password').value;

  await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  alert("Đăng ký thành công");
}

// ====================== LOGOUT ======================

function logout() {
  localStorage.clear();
  location.reload();
}

// ====================== GLOBAL ======================

window.loadHome = loadHome;
window.searchSongs = (k) => {
  renderSongList(
    window.songs.filter(s =>
      s.title.toLowerCase().includes(k.toLowerCase()) ||
      s.artist.toLowerCase().includes(k.toLowerCase())
    )
  );
};
function goHome() {
  loadHome();
  fetchSongs();
}

window.goHome = goHome;

window.login = login;
window.register = register;
window.logout = logout;
window.showDiscover = showDiscover;
window.showLibrary = showLibrary;
window.uploadMusic = uploadMusic;
window.toggleLike = toggleLike;
