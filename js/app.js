// ====================== GLOBAL STATE ======================
let currentPage = 1;
let loadingSongs = false;
window.isMusicPlaying = false;
window.songs = [];

// ====================== GLOBAL EDITING STATE ======================
let editingSongId = null;

// ====================== API BASE ======================
const API = window.location.hostname.includes('localhost')
  ? 'http://localhost:3000'
  : 'https://melody-ehdi.onrender.com';

// ====================== INIT ======================
document.addEventListener('DOMContentLoaded', () => {

  window.songs = [];

  const token = localStorage.getItem('token');

  // chưa login
  if (!token) {

    document
      .getElementById('login-modal')
      ?.classList.remove('hidden');

    return;
  }

  // đã login
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

  const greetingElement =
    document.getElementById('greeting-text');

  if (!greetingElement) return;

  const hour = new Date().getHours();

  let greeting = "";

  if (hour >= 5 && hour < 12) {
    greeting = "Chào buổi sáng 👋";
  }

  else if (hour >= 12 && hour < 18) {
    greeting = "Chào buổi chiều ☀️";
  }

  else if (hour >= 18 && hour < 22) {
    greeting = "Chào buổi tối 🌙";
  }

  else {
    greeting = "Làm tí nhạc đêm khuya nào ✨";
  }

  greetingElement.innerText = greeting;
}

// ====================== HOME ======================
function loadHome() {

  const user = JSON.parse(localStorage.getItem('user'));

  const html = `

    <div class="p-8">

      <div class="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">

        <div>

          <h1 id="greeting-text"
              class="text-4xl font-bold mb-2">

            Chào 👋

          </h1>

          <p class="text-zinc-400 mb-2">

            👤 USER:

            <span class="text-white font-medium">
              ${user?.username}
            </span>

            <span class="ml-2 px-2 py-1 rounded bg-emerald-600 text-xs text-white">
              ${user?.role}
            </span>

          </p>

          <p id="song-count"
             class="text-zinc-400">

            Playlist của bạn (${window.songs.length} bài)

          </p>

        </div>

        <div class="flex gap-3 w-full md:w-auto">

          <div class="relative flex-1 md:w-96">

            <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"></i>

            <input
              type="text"
              id="search-input"
              placeholder="Tìm bài hát..."
              class="w-full bg-zinc-900 border border-zinc-700 rounded-2xl py-3 pl-12 pr-4"
              oninput="searchSongs(this.value)"
            >

          </div>

          ${user?.role === 'admin' ? `
            <button onclick="uploadMusic()"
              class="bg-emerald-600 px-5 py-3 rounded-xl">
              + Thêm
            </button>
          ` : ''}

        </div>

      </div>

      <div id="song-list"
           class="grid grid-cols-2 md:grid-cols-4 gap-4">
      </div>

    </div>

  `;

  document.getElementById('main-content').innerHTML = html;

  renderSongList();
}

// ====================== FETCH SONGS ======================
async function fetchSongs() {

  try {

    const res = await fetch(`${API}/api/songs`);
    window.songs = await res.json();

    const libraryRes = await fetch(`${API}/api/library`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    });

    const library = libraryRes.ok ? await libraryRes.json() : [];

    const likedIds = library.map(x => x.id);

    window.songs = window.songs.map(s => ({
      ...s,
      liked: likedIds.includes(s.id)
    }));

    renderSongList();

  } catch (err) {
    console.log('Lỗi tải nhạc:', err);
    window.songs = [];
    renderSongList();
  }
}

// ====================== RENDER ======================
function renderSongList(list = window.songs) {

  const container = document.getElementById('song-list');
  if (!container) return;

  container.innerHTML = '';

  list.forEach(song => {

    const index = window.songs.findIndex(s => s.id === song.id);

    const user = JSON.parse(localStorage.getItem('user'));

    container.innerHTML += `
      <div class="bg-zinc-900 p-3 rounded-xl relative cursor-pointer"
           onclick="playSong(${index})">

        <img src="${song.cover}" class="w-full aspect-square rounded-lg">

        <p class="font-bold">${song.title}</p>
        <p class="text-sm text-zinc-400">${song.artist}</p>

        <button onclick="event.stopPropagation(); toggleLike(${song.id})"
                class="absolute top-2 right-2 text-red-500">
          ❤️
        </button>

        ${user?.role === 'admin' ? `
          <div class="absolute bottom-2 right-2 flex gap-2">

            <button onclick="event.stopPropagation(); editSong(${index})">✏️</button>
            <button onclick="event.stopPropagation(); deleteSong(${song.id})">🗑</button>

          </div>
        ` : ''}

      </div>
    `;
  });
}

// ====================== PLAY COUNT ======================
async function increasePlayCount(id) {
  try {
    await fetch(`${API}/api/songs/${id}/play`, {
      method: 'PUT'
    });
  } catch (e) {
    console.log(e);
  }
}

// ====================== PLAY ======================
function playSong(index) {

  const song = window.songs[index];

  if (!song) return;

  increasePlayCount(song.id);

  if (song.type === 'youtube') {

    const iframe = document.getElementById('youtube-player');
    if (!iframe) return;

    iframe.src = `https://www.youtube.com/embed/${getYoutubeId(song.src)}?autoplay=1`;
  }

}

// ====================== LIKE ======================
async function toggleLike(id) {

  await fetch(`${API}/api/favorite/${id}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`
    }
  });

  fetchSongs();
}

// ====================== DELETE ======================
async function deleteSong(id) {

  await fetch(`${API}/api/songs/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`
    }
  });

  fetchSongs();
}

// ====================== EDIT ======================
function editSong(index) {

  const s = window.songs[index];

  editingSongId = s.id;

  document.getElementById('edit-song-title').value = s.title;
  document.getElementById('edit-song-artist').value = s.artist;
  document.getElementById('edit-song-src').value = s.src;
  document.getElementById('edit-song-cover').value = s.cover;

  document.getElementById('edit-song-modal').classList.remove('hidden');
}

// ====================== DISCOVER ======================
async function showDiscover() {

  try {

    const res = await fetch(`${API}/api/discover`);
    const data = await res.json();

    document.getElementById('main-content').innerHTML = `
      <div class="p-8">
        <h1 class="text-3xl font-bold mb-6">🔥 Khám phá</h1>

        <h2>🎧 Dành cho bạn</h2>
        ${data.recommended?.map(renderMini).join('') || ''}

        <h2>🔥 Trending</h2>
        ${data.trending?.map(renderMini).join('') || ''}

        <h2>🆕 Mới nhất</h2>
        ${data.latest?.map(renderMini).join('') || ''}
      </div>
    `;

  } catch (e) {
    console.log('discover error:', e);
  }
}

function renderMini(s) {

  const i = window.songs.findIndex(x => x.id === s.id);

  if (i === -1) return '';

  return `
    <div onclick="playSong(${i})" class="p-2 bg-zinc-800 rounded mb-2">
      ${s.title}
    </div>
  `;
}

// ====================== UTIL ======================
function getYoutubeId(url) {
  const m = url.match(/(?:youtu\.be\/|v=)([^&]+)/);
  return m ? m[1] : '';
}

// ====================== GLOBAL EXPORT ======================
window.goHome = loadHome;
window.loadHome = loadHome;
window.fetchSongs = fetchSongs;
window.renderSongList = renderSongList;
window.uploadMusic = uploadMusic;
window.toggleLike = toggleLike;
window.deleteSong = deleteSong;
window.editSong = editSong;
window.showDiscover = showDiscover;
window.showLibrary = showLibrary;
window.increasePlayCount = increasePlayCount;
window.playSong = playSong;
