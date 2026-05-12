// js/app.js

let currentPage = 1;
let loadingSongs = false;
window.isMusicPlaying = false;
window.songs = []; // Khởi tạo mảng toàn cục

// ====================== START ======================
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');

  // Kiểm tra login
  if (!token) {
    document.getElementById('login-modal')?.classList.remove('hidden');
    return;
  }

  // Đã login
  document.getElementById('login-modal')?.classList.add('hidden');

  // Khởi tạo Player (Đảm bảo các hàm này có trong player.js)
  if (typeof initPlayer === 'function') initPlayer();
  if (typeof initPlayerUI === 'function') initPlayerUI();

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

// ====================== HOME ======================
function loadHome() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const html = `
    <div class="p-8">
      <div class="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
        <div>
          <h1 id="greeting-text" class="text-4xl font-bold mb-2">Chào 👋</h1>
          <p class="text-zinc-400 mb-2">
            👤 USER: <span class="text-white font-medium">${user?.username || 'Khách'}</span>
            <span class="ml-2 px-2 py-1 rounded bg-emerald-600 text-xs text-white">${user?.role || 'user'}</span>
          </p>
          <p id="song-count" class="text-zinc-400">Playlist của bạn (${window.songs.length} bài)</p>
        </div>
        <div class="flex gap-3 w-full md:w-auto">
          <div class="relative flex-1 md:w-96">
            <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"></i>
            <input type="text" id="search-input" placeholder="Tìm bài hát hoặc ca sĩ..." 
                   class="w-full bg-zinc-900 border border-zinc-700 rounded-2xl py-3 pl-12 pr-4 outline-none focus:border-emerald-500"
                   oninput="searchSongs(this.value)">
          </div>
          ${user?.role === 'admin' ? `
            <button onclick="uploadMusic()" class="bg-emerald-600 hover:bg-emerald-500 px-6 py-3 rounded-2xl font-medium flex items-center gap-2 whitespace-nowrap">
              <i class="fas fa-plus"></i> Thêm bài hát
            </button>
          ` : ''}
        </div>
      </div>
      <div id="song-list" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"></div>
    </div>
  `;

  const mainContent = document.getElementById('main-content');
  if (mainContent) {
    mainContent.innerHTML = html;
    updateGreeting();
    renderSongList();
  }
}

// ====================== NAVIGATION FUNCTIONS (FIX LỖI DEFINED) ======================
function showDiscover() {
  loadHome();
}

function showLibrary() {
  const likedSongs = window.songs.filter(s => s.liked);
  renderSongList(likedSongs);
  
  const countEl = document.getElementById('song-count');
  if (countEl) countEl.innerText = `Thư viện yêu thích (${likedSongs.length} bài)`;
}

// ====================== FETCH SONGS ======================
async function fetchSongs() {
  try {
    const token = localStorage.getItem('token');
    
    // Tải danh sách bài hát chung
    const res = await fetch('/api/songs');
    const allSongs = await res.json();

    // Tải thư viện cá nhân
    const libraryRes = await fetch('/api/library', {
      headers: { 
        'Authorization': `Bearer ${token}` // Dùng Bearer để chuẩn hóa
      }
    });

    // Xử lý lỗi 401 Unauthorized
    if (libraryRes.status === 401) {
      console.warn("Phiên đăng nhập hết hạn.");
      logout();
      return;
    }

    const libraryData = await libraryRes.json();
    
    // FIX LỖI .map is not a function: Kiểm tra libraryData có phải mảng không
    const librarySongs = Array.isArray(libraryData) ? libraryData : [];
    const likedIds = librarySongs.map(song => song.id || song._id);

    // Hợp nhất trạng thái "liked" vào danh sách bài hát
    window.songs = allSongs.map(song => ({
      ...song,
      liked: likedIds.includes(song.id || song._id)
    }));

    const countEl = document.getElementById('song-count');
    if (countEl) {
      countEl.innerText = `Playlist của bạn (${window.songs.length} bài)`;
    }

    renderSongList();
  } catch (err) {
    console.error('Lỗi tải nhạc:', err);
  }
}

// ====================== RENDER SONG ======================
function renderSongList(songArray = window.songs) {
  const container = document.getElementById('song-list');
  if (!container) return;

  container.innerHTML = '';

  if (songArray.length === 0) {
    container.innerHTML = `<p class="text-zinc-400 text-center py-20 col-span-full">Không tìm thấy bài hát nào.</p>`;
    return;
  }

  songArray.forEach(song => {
    const realIndex = window.songs.findIndex(s => (s.id || s._id) === (song.id || song._id));
    const card = document.createElement('div');
    card.className = "song-card bg-zinc-900 rounded-2xl overflow-hidden cursor-pointer group relative hover:bg-zinc-800 transition-all";
    card.innerHTML = `
      <img src="${song.cover}" class="w-full aspect-square object-cover" onerror="this.src='https://placehold.co/400x400?text=No+Cover'">
      <div class="p-4">
        <p class="font-medium truncate">${song.title}</p>
        <p class="text-sm text-zinc-400">${song.artist}</p>
      </div>
    `;

    card.addEventListener('click', () => {
      if (typeof playSong === 'function') playSong(realIndex);
    });

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

  const filteredSongs = window.songs.filter(song => 
    song.title.toLowerCase().includes(keyword) || 
    song.artist.toLowerCase().includes(keyword)
  );
  renderSongList(filteredSongs);
}

// ====================== LOGIN ======================
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
      alert('Sai tài khoản hoặc mật khẩu');
      return;
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    location.reload();
  } catch (err) {
    console.error(err);
  }
}

// ====================== REGISTER ======================
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
    if (typeof closeRegister === 'function') closeRegister();
  } catch (err) {
    console.error(err);
  }
}

// ====================== LOGOUT ======================
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  location.reload();
}

// ====================== EXPORT TO GLOBAL ======================
window.loadHome = loadHome;
window.showDiscover = showDiscover;
window.showLibrary = showLibrary;
window.searchSongs = searchSongs;
window.login = login;
window.register = register;
window.logout = logout;
