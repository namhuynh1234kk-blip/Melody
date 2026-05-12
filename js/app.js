
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

  renderSongList(data.recommended || []);
}

// ====================== LIBRARY ======================

function showLibrary() {
  renderSongList(window.songs.filter(s => s.liked));
}

// ====================== ADMIN UPLOAD ======================

function uploadMusic() {

  const user = JSON.parse(localStorage.getItem('user'));
  if (user?.role !== 'admin') return alert('Không có quyền');

  const title = prompt("Tên bài hát");
  const artist = prompt("Ca sĩ");
  const src = prompt("Link nhạc");
  const cover = prompt("Ảnh");

  fetch('/api/songs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify({ title, artist, src, cover, type: 'mp3' })
  }).then(() => fetchSongs());
}

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

window.login = login;
window.register = register;
window.logout = logout;
window.showDiscover = showDiscover;
window.showLibrary = showLibrary;
window.uploadMusic = uploadMusic;
window.toggleLike = toggleLike;
