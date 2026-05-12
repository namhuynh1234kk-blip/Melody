// ================= STATE =================
let currentPage = 1;
let loadingSongs = false;
window.isMusicPlaying = false;

let editingSongId = null;

// ================= INIT =================
document.addEventListener('DOMContentLoaded', () => {

  window.songs = [];

  const token = localStorage.getItem('token');

  if (!token) {
    document.getElementById('login-modal')?.classList.remove('hidden');
    return;
  }

  document.getElementById('login-modal')?.classList.add('hidden');

  initPlayer?.();
  initPlayerUI?.();

  loadHome?.();
  updateGreeting?.();
  fetchSongs();

});

// ================= GREETING =================
function updateGreeting() {

  const el = document.getElementById('greeting-text');
  if (!el) return;

  const h = new Date().getHours();

  let text = "Chào 👋";

  if (h < 12) text = "Chào buổi sáng 👋";
  else if (h < 18) text = "Chào buổi chiều ☀️";
  else text = "Chào buổi tối 🌙";

  el.innerText = text;
}

// ================= FETCH SONGS =================
async function fetchSongs() {

  try {

    const res = await fetch('/api/songs');
    const data = await res.json();

    window.songs = Array.isArray(data) ? data : [];

    const token = localStorage.getItem('token');

    let librarySongs = [];

    const libRes = await fetch('/api/library', {
      headers: { Authorization: token }
    });

    if (libRes.ok) {
      const libData = await libRes.json();
      librarySongs = Array.isArray(libData) ? libData : [];
    }

    const likedIds = librarySongs.map(s => s.id);

    window.songs = window.songs.map(s => ({
      ...s,
      liked: likedIds.includes(s.id)
    }));

    renderSongList();

  } catch (err) {
    console.log("fetchSongs error:", err);
    window.songs = [];
  }
}

// ================= RENDER =================
function renderSongList(list = window.songs) {

  const container = document.getElementById('song-list');
  if (!container) return;

  container.innerHTML = '';

  const user = JSON.parse(localStorage.getItem('user'));

  if (!list || list.length === 0) {
    container.innerHTML = `<p class="text-center text-zinc-400 col-span-full">Không có bài hát</p>`;
    return;
  }

  list.forEach(song => {

    const div = document.createElement('div');

    div.className = "song-card bg-zinc-900 rounded-xl p-3 cursor-pointer";

    div.innerHTML = `
      <img src="${song.cover}" class="w-full aspect-square object-cover rounded-lg">
      <p class="mt-2 font-medium truncate">${song.title}</p>
      <p class="text-sm text-zinc-400">${song.artist}</p>

      ${user?.role === 'admin' ? `
        <div class="flex gap-2 mt-2">

          <button onclick="openEditSong(${song.id}); event.stopPropagation();"
            class="text-xs bg-yellow-500 px-2 py-1 rounded">
            Sửa
          </button>

          <button onclick="deleteSong(${song.id}); event.stopPropagation();"
            class="text-xs bg-red-500 px-2 py-1 rounded">
            Xóa
          </button>

        </div>
      ` : ''}
    `;

    div.onclick = () => playSong(window.songs.findIndex(s => s.id === song.id));

    container.appendChild(div);

  });

}

// ================= PLAY =================
function playSong(index) {

  const song = window.songs[index];
  if (!song) return;

  increasePlayCount(song.id);

  window.playMusic?.(song);
}

window.playSong = playSong;

// ================= PLAY COUNT =================
function increasePlayCount(songId) {

  fetch(`/api/songs/${songId}/play`, {
    method: 'PUT',
    headers: {
      Authorization: localStorage.getItem('token')
    }
  }).catch(err => console.log(err));

}

window.increasePlayCount = increasePlayCount;

// ================= SEARCH =================
function searchSongs(keyword) {

  if (!keyword) return renderSongList();

  const k = keyword.toLowerCase();

  const filtered = window.songs.filter(s =>
    s.title.toLowerCase().includes(k) ||
    s.artist.toLowerCase().includes(k)
  );

  renderSongList(filtered);
}

window.searchSongs = searchSongs;

// ================= HOME =================
function loadHome() {
  renderSongList(window.songs);
}

window.loadHome = loadHome;

// ================= LIBRARY =================
function showLibrary() {
  renderSongList(window.songs.filter(s => s.liked));
}

window.showLibrary = showLibrary;

// ================= DISCOVER =================
function showDiscover() {
  renderSongList(window.songs);
}

window.showDiscover = showDiscover;

// ================= LOGIN =================
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

window.login = login;

// ================= LOGOUT =================
function logout() {
  localStorage.clear();
  location.reload();
}

window.logout = logout;

// ================= ADD SONG =================
function uploadMusic() {
  document.getElementById('add-song-modal')?.classList.remove('hidden');
  document.getElementById('add-song-modal')?.classList.add('flex');
}

function closeAddSongModal() {
  document.getElementById('add-song-modal')?.classList.add('hidden');
}

window.uploadMusic = uploadMusic;
window.closeAddSongModal = closeAddSongModal;

// ================= EDIT SONG =================
function openEditSong(id) {

  const song = window.songs.find(s => s.id === id);
  if (!song) return;

  editingSongId = id;

  document.getElementById('edit-song-title').value = song.title;
  document.getElementById('edit-song-artist').value = song.artist;
  document.getElementById('edit-song-src').value = song.src;
  document.getElementById('edit-song-cover').value = song.cover;

  document.getElementById('edit-song-modal').classList.remove('hidden');
  document.getElementById('edit-song-modal').classList.add('flex');
}

window.openEditSong = openEditSong;

function closeEditSongModal() {
  document.getElementById('edit-song-modal').classList.add('hidden');
}

window.closeEditSongModal = closeEditSongModal;

// ================= UPDATE SONG =================
async function updateSong() {

  await fetch(`/api/songs/${editingSongId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: localStorage.getItem('token')
    },
    body: JSON.stringify({
      title: document.getElementById('edit-song-title').value,
      artist: document.getElementById('edit-song-artist').value,
      src: document.getElementById('edit-song-src').value,
      cover: document.getElementById('edit-song-cover').value
    })
  });

  closeEditSongModal();
  fetchSongs();
}

window.updateSong = updateSong;

// ================= DELETE =================
async function deleteSong(id) {

  if (!confirm("Xóa bài hát?")) return;

  await fetch(`/api/songs/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: localStorage.getItem('token')
    }
  });

  fetchSongs();
}

window.deleteSong = deleteSong;
