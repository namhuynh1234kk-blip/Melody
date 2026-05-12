// js/app.js
let currentPage = 1;

let loadingSongs = false;
window.isMusicPlaying = false;

document.addEventListener('DOMContentLoaded', () => {

  window.songs = [];

  const token =
    localStorage.getItem('token');

  // chưa login thì hiện modal
  if (!token) {

    document
      .getElementById('login-modal')
      ?.classList.remove('hidden');

    return;
  }

  // đã login thì ẩn modal
  document
    .getElementById('login-modal')
    ?.classList.add('hidden');

  initPlayer();

  initPlayerUI();

  loadHome();

  updateGreeting();

  fetchSongs();

});
// ====================== CẬP NHẬT CÂU CHÀO ======================
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
  const user =
  JSON.parse(
    localStorage.getItem('user')
  );

  const html = `

    <div class="p-8">

      <div class="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">

        <div>

  <h1 id="greeting-text"
      class="text-4xl font-bold mb-2">

    Chào buổi sáng 👋

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

          <!-- SEARCH -->
          <div class="relative flex-1 md:w-96">

            <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"></i>

            <input
              type="text"
              id="search-input"
              placeholder="Tìm bài hát hoặc ca sĩ..."
              class="w-full bg-zinc-900 border border-zinc-700 rounded-2xl py-3 pl-12 pr-4 outline-none focus:border-emerald-500"
              oninput="searchSongs(this.value)"
            >

          </div>

          ${user?.role === 'admin' ? `

  <button
    onclick="uploadMusic()"

    class="bg-emerald-600 hover:bg-emerald-500 px-6 py-3 rounded-2xl font-medium flex items-center gap-2 whitespace-nowrap">

    <i class="fas fa-plus"></i>

    Thêm bài hát

  </button>

` : ''}

        </div>

      </div>

      <!-- LIST SONG -->
      <div
        id="song-list"
        class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
      </div>

    </div>

  `;

  document.getElementById('main-content').innerHTML = html;

  renderSongList();
}

// ====================== FETCH SONGS ======================
async function fetchSongs() {

  try {

    // LOAD ALL SONGS
    const res =
      await fetch(
        'http://172.26.60.196:3000/api/songs'
      );

    window.songs =
      await res.json();

    // LOAD USER LIBRARY
    const libraryRes =
      await fetch(

        'http://172.26.60.196:3000/api/library',

        {
          headers: {
            Authorization:
              localStorage.getItem('token')
          }
        }

      );

    const librarySongs =
      await libraryRes.json();

    // ARRAY ID ĐÃ LIKE
    const likedIds =
      librarySongs.map(song => song.id);

    // GẮN liked=true
    window.songs =
      window.songs.map(song => ({

        ...song,

        liked:
          likedIds.includes(song.id)

      }));

    // UPDATE COUNT
    const countEl =
      document.getElementById('song-count');

    if (countEl) {

      countEl.innerText =
        `Playlist của bạn (${window.songs.length} bài)`;

    }

    // RENDER
    renderSongList();

  }

  catch (err) {

    console.log(
      "Lỗi tải nhạc:",
      err
    );

  }

}

// ====================== RENDER SONG ======================
function renderSongList(songArray = window.songs) {

  const container =
    document.getElementById('song-list');

  if (!container) return;

  container.innerHTML = '';

  if (songArray.length === 0) {

    container.innerHTML = `
      <p class="text-zinc-400 text-center py-20 col-span-full">
        Không tìm thấy bài hát nào.
      </p>
    `;

    return;
  }

  songArray.forEach((song) => {

    const realIndex =
      window.songs.findIndex(s => s.id === song.id);

    const card =
      document.createElement('div');

    card.className =
      "song-card bg-zinc-900 rounded-2xl overflow-hidden cursor-pointer group relative";

    card.innerHTML = `

      <div class="relative">

  <img
    src="${song.cover}"
    class="w-full aspect-square object-cover">

  <iframe
    id="preview-${song.id}"

    class="absolute inset-0 w-full h-full opacity-0 pointer-events-none transition"

    src=""
    allow="autoplay">

  </iframe>

</div>
      <div class="p-4">

        <p class="font-medium truncate">
          ${song.title}
        </p>

        <p class="text-sm text-zinc-400">
          ${song.artist}
        </p>

      </div>

  <div class="absolute top-3 right-3 flex gap-2">

  <!-- HEART -->
  <button
    onclick="event.stopImmediatePropagation(); toggleLike(${song.id});"

    class="bg-zinc-800 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm">

    <i class="fas fa-heart"></i>

  </button>

  ${JSON.parse(localStorage.getItem('user'))?.role === 'admin' ? `

    <!-- EDIT -->
    <button
      onclick="event.stopImmediatePropagation(); editSong(${realIndex});"

      class="bg-yellow-500 text-white w-7 h-7 rounded-full hidden group-hover:flex items-center justify-center text-sm">

      <i class="fas fa-pen"></i>

    </button>

    <!-- DELETE -->
    <button
      onclick="event.stopImmediatePropagation(); deleteSong(${song.id});"

      class="bg-red-600 text-white w-7 h-7 rounded-full hidden group-hover:flex items-center justify-center text-sm">

      ×

    </button>

  ` : ''}

</div>
    `;

    card.addEventListener('click', () => {

      playSong(realIndex);

    });
  card.addEventListener('mouseenter', () => {

  if (song.type === 'youtube') {

    const iframe =
      document.getElementById(
        `preview-${song.id}`
      );

    const videoId =
      getYoutubeId(song.src);

    const isPlaying =
      window.audio &&
      !window.audio.paused;

    iframe.src =

      `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${isPlaying ? 1 : 0}`;

    iframe.classList.remove('opacity-0');

  }

});
card.addEventListener('mouseleave', () => {

  const iframe =
    document.getElementById(
      `preview-${song.id}`
    );

  iframe.src = '';

  iframe.classList.add('opacity-0');

});

    container.appendChild(card);

  });
}

// ====================== SEARCH ======================
function searchSongs(keyword) {

  keyword =
    keyword.toLowerCase().trim();

  if (!keyword) {

    renderSongList(window.songs);

    return;
  }

  const filteredSongs =
    window.songs.filter(song => {

      return (

        song.title
          .toLowerCase()
          .includes(keyword)

        ||

        song.artist
          .toLowerCase()
          .includes(keyword)

      );

    });

  renderSongList(filteredSongs);
}

// ====================== ADD SONG ======================
function uploadMusic() {

  const modal =
    document.getElementById('add-song-modal');

  modal.classList.replace('hidden', 'flex');
}

function closeAddSongModal() {

  const modal =
    document.getElementById('add-song-modal');

  modal.classList.replace('flex', 'hidden');
}

async function submitSong() {

  const title =
    document.getElementById('song-title').value.trim();

  const artist =
    document.getElementById('song-artist').value.trim();

  const src =
    document.getElementById('song-src').value.trim();

  const cover =
    document.getElementById('song-cover').value.trim();

  if (!title || !src)
    return alert("Thiếu dữ liệu");

  const isYoutube =
    src.includes("youtube.com")
    ||
    src.includes("youtu.be");

  try {

    await fetch(
      'http://172.26.60.196:3000/api/songs',
      {
        method: 'POST',

      headers: {

  'Content-Type': 'application/json',

  Authorization:
    localStorage.getItem('token')

},
        body: JSON.stringify({

          title,

          artist:
            artist || "Unknown Artist",

          src,

          cover:
            cover ||
            `https://picsum.photos/300?sig=${Math.random()}`,

          type:
            isYoutube ? 'youtube' : 'mp3'
        })
      }
    );

    await fetchSongs();

    closeAddSongModal();

    [
      'song-title',
      'song-artist',
      'song-src',
      'song-cover'
    ].forEach(id => {

      document.getElementById(id).value = "";

    });

  }

  catch (err) {

    alert("Lỗi thêm bài hát");

  }
}

// ====================== DELETE ======================
async function deleteSong(id) {

  if (!confirm("Xóa bài hát này?"))
    return;

  try {

    await fetch(
      `http://172.26.60.196:3000/api/songs/${id}`,
     {
  method: 'DELETE',

  headers: {
    Authorization:
      localStorage.getItem('token')
  }
}
    );

    fetchSongs();

  }

  catch (err) {

    console.log(err);

  }
}

// ====================== EDIT ======================
let editingSongId = null;

function editSong(index) {

  const song =
    window.songs[index];

  editingSongId =
    song.id;

  document.getElementById('edit-song-title').value =
    song.title;

  document.getElementById('edit-song-artist').value =
    song.artist;

  document.getElementById('edit-song-src').value =
    song.src;

  document.getElementById('edit-song-cover').value =
    song.cover;

  document
    .getElementById('edit-song-modal')
    .classList.replace('hidden', 'flex');
}

function closeEditSongModal() {

  document
    .getElementById('edit-song-modal')
    .classList.replace('flex', 'hidden');
}

async function updateSong() {

  if (editingSongId === null)
    return;

  const title =
    document.getElementById('edit-song-title').value.trim();

  const artist =
    document.getElementById('edit-song-artist').value.trim();

  const src =
    document.getElementById('edit-song-src').value.trim();

  const cover =
    document.getElementById('edit-song-cover').value.trim();

  const isYoutube =
    src.includes("youtube.com")
    ||
    src.includes("youtu.be");

  try {

    await fetch(
      `http://172.26.60.196:3000/api/songs/${editingSongId}`,
      {
        method: 'PUT',
headers: {

  'Content-Type': 'application/json',

  Authorization:
    localStorage.getItem('token')

},

        body: JSON.stringify({

          title,
          artist,
          src,
          cover,

          type:
            isYoutube ? 'youtube' : 'mp3'
        })
      }
    );

    await fetchSongs();

    closeEditSongModal();

    alert("✅ Đã cập nhật");

  }

  catch (err) {

    alert("❌ Lỗi cập nhật");

  }
}

// ====================== HOME ======================
function goHome() {

  loadHome();

  updateGreeting();

  fetchSongs();

  const mainContent =
    document.getElementById('main-content');

  if (mainContent) {

    mainContent.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

  }
}
// ====================== TOGGLE LIKE ======================
async function toggleLike(id) {

  try {

    const res =
      await fetch(

        `http://localhost:3000/api/favorite/${id}`,

        {
          method: 'POST',

          headers: {
            Authorization:
              localStorage.getItem('token')
          }
        }

      );

    const data =
      await res.json();

    if (data.liked) {

      alert('❤️ Đã thêm vào thư viện');

    }

    else {

      alert('💔 Đã xóa khỏi thư viện');

    }

    await fetchSongs();

  }

  catch (err) {

    console.log(err);

  }

}
// ====================== LIBRARY ======================
async function showLibrary() {

  try {

    const res =
      await fetch(
  'http://localhost:3000/api/library',
  {
    headers: {
      Authorization:
        localStorage.getItem('token')
    }
  }
);

    const likedSongs =
      await res.json();

    const html = `

      <div class="p-8">

        <h1 class="text-4xl font-bold mb-2">
          ❤️ Thư viện yêu thích
        </h1>

        <p class="text-zinc-400 mb-8">
          ${likedSongs.length} bài hát đã thích
        </p>

        <div
          id="song-list"
          class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        </div>

      </div>

    `;

    document.getElementById('main-content').innerHTML = html;

    renderSongList(likedSongs);

  }

  catch (err) {

    console.log(err);

  }
}
// ====================== PLAY COUNT ======================
async function increasePlayCount(id) {

  try {

    await fetch(

      `http://localhost:3000/api/songs/${id}/play`,

      {
        method: 'PUT'
      }

    );

  }

  catch (err) {

    console.log(err);

  }
}
// ====================== DISCOVER ======================
async function showDiscover() {

  try {

    const res =
      await fetch('http://localhost:3000/api/discover');

    const data =
      await res.json();

    const html = `

      <div class="p-8 space-y-12">

        <!-- HERO -->
        <div
          class="rounded-3xl p-10 bg-gradient-to-r from-emerald-500 to-cyan-500">

          <h1 class="text-5xl font-black mb-3">
            🎵 KHÁM PHÁ ÂM NHẠC THEO SỞ THÍCH CỦA BẠN
          </h1>

          <p class="text-lg text-white/90">
            Khám phá âm nhạc dành cho bạn
          </p>

        </div>

        <!-- RANDOM -->
        <div>

          <h2 class="text-2xl font-bold mb-6">
            🎧 Dành cho bạn
          </h2>

          <div
            id="recommended-list"
            class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          </div>

        </div>

        <!-- TRENDING -->
        <div>

          <h2 class="text-2xl font-bold mb-6">
            🔥 Trending
          </h2>

          <div
            id="trending-list"
            class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          </div>

        </div>

        <!-- LATEST -->
        <div>

          <h2 class="text-2xl font-bold mb-6">
            🆕 Mới thêm
          </h2>

          <div
            id="latest-list"
            class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          </div>

        </div>

      </div>

    `;

    document.getElementById('main-content').innerHTML = html;

    renderCustomList(
      'recommended-list',
      data.recommended
    );

    renderCustomList(
      'trending-list',
      data.trending
    );

    renderCustomList(
      'latest-list',
      data.latest
    );

  }

  catch (err) {

    console.log(err);

  }
}
// ====================== CUSTOM LIST ======================
function renderCustomList(containerId, songs) {

  const container =
    document.getElementById(containerId);

  if (!container) return;

  container.innerHTML = '';

  songs.forEach(song => {

    const realIndex =
      window.songs.findIndex(
        s => s.id === song.id
      );

    container.innerHTML += `

      <div
        onclick="playSong(${realIndex})"

        class="song-card bg-zinc-900 rounded-2xl overflow-hidden cursor-pointer group relative">

        <img
          src="${song.cover}"
          class="w-full aspect-square object-cover">

        <div class="p-4">

          <p class="font-medium truncate">
            ${song.title}
          </p>

          <p class="text-sm text-zinc-400">
            ${song.artist}
          </p>

        </div>

      </div>

    `;

  });

}
// ====================== LOGIN ======================

async function login() {

  const username =
    document.getElementById('login-username').value;

  const password =
    document.getElementById('login-password').value;

  try {

    const res =
      await fetch(
        'http://localhost:3000/api/login',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json'
          },

          body: JSON.stringify({
            username,
            password
          })
        }
      );

    const data =
      await res.json();

    if (!data.token) {

      alert('Sai tài khoản');

      return;
    }

    localStorage.setItem(
      'token',
      data.token
    );

    localStorage.setItem(
      'user',
      JSON.stringify(data.user)
    );

    location.reload();

  }

  catch (err) {

    console.log(err);

  }
}
// ====================== LOGOUT ======================

function logout() {

  localStorage.removeItem('token');

  localStorage.removeItem('user');

  location.reload();
}
// ====================== REGISTER ======================

function showRegister() {

  document
    .getElementById('register-modal')
    .classList.replace('hidden', 'flex');
}

function closeRegister() {

  document
    .getElementById('register-modal')
    .classList.replace('flex', 'hidden');
}

async function register() {

  const username =
    document
      .getElementById('register-username')
      .value;

  const password =
    document
      .getElementById('register-password')
      .value;

  const confirmPassword =
    document
      .getElementById('register-confirm-password')
      .value;

  if (password !== confirmPassword) {

    alert('❌ Mật khẩu không khớp');

    return;

  }

  try {

    const res =
      await fetch(
        'http://localhost:3000/api/register',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json'
          },

          body: JSON.stringify({
            username,
            password
          })
        }
      );

    const data =
      await res.json();

    if (!data.success) {

      alert(
        data.error || 'Đăng ký thất bại'
      );

      return;
    }

    alert('✅ Đăng ký thành công');

    closeRegister();

  }

  catch (err) {

    console.log(err);

  }
}
function getYoutubeId(url) {

  const regExp =
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/;

  const match =
    url.match(regExp);

  return match
    ? match[1]
    : '';

}

// ====================== EXPORT ======================
window.goHome = goHome;
window.loadHome = loadHome;

window.uploadMusic = uploadMusic;
window.closeAddSongModal = closeAddSongModal;
window.submitSong = submitSong;

window.deleteSong = deleteSong;

window.renderSongList = renderSongList;

window.editSong = editSong;
window.updateSong = updateSong;
window.closeEditSongModal = closeEditSongModal;

window.searchSongs = searchSongs;
window.toggleLike = toggleLike;
window.showLibrary = showLibrary;
window.showDiscover = showDiscover;
window.increasePlayCount = increasePlayCount;
window.login = login;
window.logout = logout;
window.register = register;

window.showRegister = showRegister;

window.closeRegister = closeRegister;
