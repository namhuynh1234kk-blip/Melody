let currentPage = 1;
let loadingSongs = false;
window.isMusicPlaying = false;

// ====================== START ======================

document.addEventListener('DOMContentLoaded', () => {

  window.songs = [];

  const token = localStorage.getItem('token');

  // chưa login
  if (!token) {
    document.getElementById('login-modal')?.classList.remove('hidden');
    return;
  }

  // đã login
  document.getElementById('login-modal')?.classList.add('hidden');

  initPlayer?.();
  initPlayerUI?.();

  loadHome();
  updateGreeting();
  fetchSongs();

});

// ====================== GREETING ======================

function updateGreeting() {
  const greetingElement = document.getElementById('greeting-text');
  if (!greetingElement) return;

  const hour = new Date().getHours();

  let greeting = "";

  if (hour >= 5 && hour < 12) greeting = "Chào buổi sáng 👋";
  else if (hour >= 12 && hour < 18) greeting = "Chào buổi chiều ☀️";
  else if (hour >= 18 && hour < 22) greeting = "Chào buổi tối 🌙";
  else greeting = "Làm tí nhạc đêm khuya nào ✨";

  greetingElement.innerText = greeting;
}

// ====================== NAVIGATION FIX ======================

function goHome() {
  loadHome();
}

function showLibrary() {
  renderSongList(window.songs);
}

function showDiscover() {
  renderSongList(window.songs);
}

// gắn global để HTML onclick không lỗi
window.goHome = goHome;
window.showLibrary = showLibrary;
window.showDiscover = showDiscover;

// ====================== HOME ======================

function loadHome() {

  const user = JSON.parse(localStorage.getItem('user'));

  const html = `
    <div class="p-8">

      <div class="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">

        <div>

          <h1 id="greeting-text" class="text-4xl font-bold mb-2">
            Chào 👋
          </h1>

          <p class="text-zinc-400 mb-2">
            👤 USER:
            <span class="text-white font-medium">
              ${user?.username || 'Guest'}
            </span>

            <span class="ml-2 px-2 py-1 rounded bg-emerald-600 text-xs text-white">
              ${user?.role || 'user'}
            </span>
          </p>

          <p id="song-count" class="text-zinc-400">
            Playlist của bạn (${window.songs.length} bài)
          </p>

        </div>

      </div>

      <div id="song-list" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"></div>

    </div>
  `;

  document.getElementById('main-content').innerHTML = html;

  renderSongList();
}

// ====================== FETCH SONGS ======================

async function fetchSongs() {

  try {

    const res = await fetch('/api/songs');

    window.songs = await res.json();

    // fallback nếu không phải array
    if (!Array.isArray(window.songs)) {
      window.songs = [];
    }

    const libraryRes = await fetch('/api/library', {
      headers: {
        Authorization: localStorage.getItem('token')
      }
    });

    let librarySongs = [];

    if (libraryRes.ok) {
      const data = await libraryRes.json();
      librarySongs = Array.isArray(data) ? data : [];
    }

    const likedIds = librarySongs.map(song => song.id);

    window.songs = window.songs.map(song => ({
      ...song,
      liked: likedIds.includes(song.id)
    }));

    const countEl = document.getElementById('song-count');
    if (countEl) {
      countEl.innerText = `Playlist của bạn (${window.songs.length} bài)`;
    }

    renderSongList();

  } catch (err) {
    console.log('Lỗi tải nhạc:', err);
    window.songs = [];
  }
}

// ====================== RENDER SONG ======================

function renderSongList(songArray = window.songs) {

  const container = document.getElementById('song-list');
  if (!container) return;

  container.innerHTML = '';

  if (!songArray || songArray.length === 0) {
    container.innerHTML = `
      <p class="text-zinc-400 text-center py-20 col-span-full">
        Không tìm thấy bài hát nào.
      </p>
    `;
    return;
  }

  songArray.forEach(song => {

    const realIndex = window.songs.findIndex(s => s.id === song.id);

    const card = document.createElement('div');

    card.className =
      "song-card bg-zinc-900 rounded-2xl overflow-hidden cursor-pointer group relative";

    card.innerHTML = `
      <img src="${song.cover}" class="w-full aspect-square object-cover">

      <div class="p-4">
        <p class="font-medium truncate">${song.title}</p>
        <p class="text-sm text-zinc-400">${song.artist}</p>
      </div>
    `;

    card.addEventListener('click', () => playSong?.(realIndex));

    container.appendChild(card);

  });
}

// ====================== SEARCH ======================

function searchSongs(keyword) {

  keyword = keyword.toLowerCase().trim();

  if (!keyword) {
    renderSongList(window.songs);
    return;
  }

  const filtered = window.songs.filter(song =>
    song.title.toLowerCase().includes(keyword) ||
    song.artist.toLowerCase().includes(keyword)
  );

  renderSongList(filtered);
}

// ====================== AUTH ======================

async function login() {
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (!data.token) {
      alert('Sai tài khoản');
      return;
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    location.reload();

  } catch (err) {
    console.log(err);
  }
}

async function register() {

  const username = document.getElementById('register-username').value;
  const password = document.getElementById('register-password').value;
  const confirmPassword = document.getElementById('register-confirm-password').value;

  if (password !== confirmPassword) {
    alert('❌ Mật khẩu không khớp');
    return;
  }

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (!data.success) {
      alert(data.error || 'Đăng ký thất bại');
      return;
    }

    alert('✅ Đăng ký thành công');

  } catch (err) {
    console.log(err);
  }
}

// ====================== LOGOUT ======================

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  location.reload();
}

// ====================== EXPORT ======================

window.loadHome = loadHome;
window.searchSongs = searchSongs;
window.login = login;
window.register = register;
window.logout = logout;
