// js/app.js

// Khai báo URL server Render của bạn
const API_BASE_URL = "https://melody-ehdi.onrender.com";

let currentPage = 1;
let loadingSongs = false;
window.isMusicPlaying = false;

document.addEventListener('DOMContentLoaded', () => {
  window.songs = [];
  const token = localStorage.getItem('token');

  // chưa login thì hiện modal
  if (!token) {
    document.getElementById('login-modal')?.classList.remove('hidden');
    return;
  }

  // đã login thì ẩn modal
  document.getElementById('login-modal')?.classList.add('hidden');

  initPlayer();
  initPlayerUI();
  loadHome();
  updateGreeting();
  fetchSongs();
  checkAdmin(); // <-- THÊM MỚI: Kiểm tra quyền để ẩn/hiện nút Upload
});

// ====================== KIỂM TRA QUYỀN ADMIN (MỚI) ======================
function checkAdmin() {
  const user = JSON.parse(localStorage.getItem('user'));
  const uploadBtnMobile = document.getElementById('mobile-upload-btn');

  // Nếu không phải admin, ẩn nút upload trên mobile
  if (user?.role !== 'admin' && uploadBtnMobile) {
    uploadBtnMobile.style.display = 'none';
  }
}

// ====================== CẬP NHẬT CÂU CHÀO ======================
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
  const user = JSON.parse(localStorage.getItem('user'));

  const html = `
    <div class="p-8 pb-32"> <!-- Thêm pb-32 để không bị Mobile Nav che -->
      <div class="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
        <div>
          <h1 id="greeting-text" class="text-4xl font-bold mb-2">Chào buổi sáng 👋</h1>
          <p class="text-zinc-400 mb-2">
            👤 USER: <span class="text-white font-medium">${user?.username}</span>
            <span class="ml-2 px-2 py-1 rounded bg-emerald-600 text-xs text-white">${user?.role}</span>
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
          <select
            id="category-filter"
            onchange="filterByCategory(this.value)"
            class="bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-3 outline-none focus:border-emerald-500"
          >
            <option value="">🎵 Tất cả thể loại</option>
            <option value="V-Pop">V-Pop</option>
            <option value="US-UK">US-UK</option>
            <option value="Rap">Rap</option>
            <option value="Lo-fi">Lo-fi</option>
            <option value="EDM">EDM</option>
            <option value="Remix">Remix</option>
            <option value="Ballad">Ballad</option>
          </select>

          ${user?.role === 'admin' ? `
            <button id="admin-upload-btn" onclick="uploadMusic()" class="bg-emerald-600 hover:bg-emerald-500 px-6 py-3 rounded-2xl font-medium flex items-center gap-2 whitespace-nowrap">
              <i class="fas fa-plus"></i> Thêm bài hát
            </button>
          ` : ''}
        </div>
      </div>
      <div id="song-list" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"></div>
    </div>
  `;
  document.getElementById('main-content').innerHTML = html;
  renderSongList();
}
// ====================== RENDER SONG ======================
function renderSongList(songArray = window.songs) {
  const container = document.getElementById('song-list');
  
  if (!container) {
    console.error("Không tìm thấy phần tử có id 'song-list' trên giao diện.");
    return;
  }

  container.innerHTML = '';

  if (!songArray || songArray.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-20 text-center">
        <p class="text-zinc-400 text-lg">Không tìm thấy bài hát nào phù hợp.</p>
      </div>
    `;
    return;
  }

  const user = JSON.parse(localStorage.getItem('user'));

  songArray.forEach((song) => {
    const realIndex = window.songs.findIndex(s => s.id === song.id);
    
    const card = document.createElement('div');
   card.className = "song-card bg-zinc-900 rounded-2xl overflow-hidden cursor-pointer relative group";
    
    card.innerHTML = `
      <div class="relative group">
        <img src="${song.cover}" class="w-full aspect-square object-cover transition duration-300 group-hover:brightness-50" onerror="this.src='https://picsum.photos/300/300'">
        
        <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
           <i class="fas fa-play text-white text-3xl"></i>
        </div>

        <iframe id="preview-${song.id}" 
                class="absolute inset-0 w-full h-full opacity-0 pointer-events-none transition" 
                src="" 
                allow="autoplay">
        </iframe>
      </div>

      <div class="p-4">
        <p class="font-medium truncate text-white">${song.title}</p>
        <p class="text-sm text-zinc-400 truncate">${song.artist}</p>
      </div>

      <div class="absolute top-3 right-3 flex gap-2">
        <button onclick="event.stopImmediatePropagation(); toggleLike(${song.id});" 
                class="bg-zinc-800/80 hover:bg-zinc-700 text-white w-8 h-8 rounded-full flex items-center justify-center transition">
          <i class="fas fa-heart ${song.liked ? 'text-red-500' : 'text-white'}"></i>
        </button>

        ${user?.role === 'admin' ? `
      <button onclick="event.stopPropagation(); editSong(${realIndex}); return false;"
                  class="bg-yellow-500/90 hover:bg-yellow-400 text-white w-8 h-8 rounded-full hidden group-hover:flex items-center justify-center transition">
            <i class="fas fa-pen text-xs"></i>
          </button>
          <button onclick="event.stopPropagation(); deleteSong(${song.id}); return false;"
                  class="bg-red-600/90 hover:bg-red-500 text-white w-8 h-8 rounded-full hidden group-hover:flex items-center justify-center transition">
            <i class="fas fa-trash-can text-xs"></i>
          </button>
        ` : ''}
      </div>
    `;

   card.addEventListener('click', (e) => {
  if (
    e.target.closest('button') ||
    e.target.closest('iframe')
  ) return;

  if (typeof playSong === 'function') {
    playSong(realIndex);
  }
});

    card.onmouseenter = () => {
      if (song.src.includes("youtube.com") || song.src.includes("youtu.be")) {
        const videoId = getYoutubeId(song.src);
        const iframe = document.getElementById(`preview-${song.id}`);
        if (iframe && videoId) {
          iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&start=30`;
          iframe.classList.remove('opacity-0');
        }
      }
    };

    card.onmouseleave = () => {
      const iframe = document.getElementById(`preview-${song.id}`);
      if (iframe) {
        iframe.src = '';
        iframe.classList.add('opacity-0');
      }
    };

    container.appendChild(card);
  });
}

// ====================== FETCH SONGS ======================
async function fetchSongs() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/songs`);
    const data = await res.json();

    const token = localStorage.getItem('token');
    let likedIds = [];
    if (token) {
      const libraryRes = await fetch(`${API_BASE_URL}/api/library`, {
        headers: { Authorization: token }
      });
      const librarySongs = await libraryRes.json();
      likedIds = librarySongs.map(s => s.id);
    }

    window.songs = data.map(song => ({
      ...song,
      liked: likedIds.includes(song.id)
    }));

    const countEl = document.getElementById('song-count');
    if (countEl) countEl.innerText = `Playlist của bạn (${window.songs.length} bài)`;

    renderSongList();
  } catch (err) {
    console.error("Lỗi khi tải nhạc:", err);
  }
}


// ====================== EDIT SONG ======================
function editSong(index) {
  if (!window.songs || window.songs.length === 0) return;

  const song = window.songs[index];
  if (!song) return;

  window.editingIndex = index;

  const fields = {
    'edit-song-title': song.title,
    'edit-song-artist': song.artist,
    'edit-song-src': song.src,
    'edit-song-cover': song.cover,
    'edit-song-category': song.category || "V-Pop"
  };

  for (const [id, value] of Object.entries(fields)) {
    const el = document.getElementById(id);
    if (el) el.value = value || "";
  }

  const modal = document.getElementById('edit-song-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}


// ====================== SEARCH ======================
function searchSongs(keyword) {
  keyword = keyword.toLowerCase().trim();
  if (!keyword) {
    renderSongList(window.songs);
    return;
  }

  const filteredSongs = window.songs.filter(song => {
    const title = (song.title || "").toLowerCase();
    const artist = (song.artist || "").toLowerCase();
    const category = (song.category || "").toLowerCase();
    return (title.includes(keyword) || artist.includes(keyword) || category.includes(keyword));
  });

  renderSongList(filteredSongs);
}

//===============filterbycat====
function filterByCategory(category) {
  if (!category) {
    renderSongList(window.songs);
    return;
  }
  const filteredSongs = window.songs.filter(song =>
    (song.category || "").toLowerCase() === category.toLowerCase()
  );
  renderSongList(filteredSongs);
}

// ====================== ADD SONG ======================
function uploadMusic() {
  const modal = document.getElementById('add-song-modal');
  if(modal) modal.classList.replace('hidden', 'flex');
}

function closeAddSongModal() {
  const modal = document.getElementById('add-song-modal');
  if(modal) modal.classList.replace('flex', 'hidden');
}

async function submitSong() {
  const title = document.getElementById('song-title').value.trim();
  const artist = document.getElementById('song-artist').value.trim();
  const src = document.getElementById('song-src').value.trim();
  const category = document.getElementById('song-category').value;
  let cover = document.getElementById('song-cover').value.trim();

  if (!title || !src) return alert("Thiếu dữ liệu (Tên bài hát và Link nhạc là bắt buộc)");

  if (!cover) {
    const randomId = Math.floor(Math.random() * 1000);
    cover = `https://picsum.photos/seed/${randomId}/300/300`;
  }

  const isYoutube = src.includes("youtube.com") || src.includes("youtu.be");

  try {
    const res = await fetch(`${API_BASE_URL}/api/songs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: localStorage.getItem('token')
      },
      body: JSON.stringify({
        title,
        artist: artist || "Nghệ sĩ ẩn danh",
        src,
        cover: cover,
        category: category,
        type: isYoutube ? 'youtube' : 'mp3'
      })
    });

    if (res.ok) {
      await fetchSongs();
      closeAddSongModal();
      ['song-title', 'song-artist', 'song-src', 'song-cover'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = "";
      });
      alert("✅ Thêm bài hát thành công!");
    } else {
      alert("❌ Lỗi server khi thêm bài hát");
    }
  } catch (err) {
    console.error(err);
    alert("❌ Không thể kết nối tới server");
  }
}

// ====================== DELETE ======================
async function deleteSong(id) {
  if (!confirm("Xóa bài hát này?")) return;
  try {
    await fetch(`${API_BASE_URL}/api/songs/${id}`, {
      method: 'DELETE',
      headers: { Authorization: localStorage.getItem('token') }
    });
    fetchSongs();
  } catch (err) {
    console.log(err);
  }
}

function closeEditSongModal() {
  const modal = document.getElementById('edit-song-modal');
  if(modal) modal.classList.replace('flex', 'hidden');
}

// ====================== UPDATE SONG ======================
async function updateSong() {
  const index = window.editingIndex;
  if (index === undefined || !window.songs[index]) return;

  const songId = window.songs[index].id;
  const title = document.getElementById('edit-song-title').value.trim();
  const artist = document.getElementById('edit-song-artist').value.trim();
  const src = document.getElementById('edit-song-src').value.trim();
  const cover = document.getElementById('edit-song-cover').value.trim();
  const category = document.getElementById('edit-song-category').value;

  if (!title || !src) return alert("Bạn ơi, đừng để trống Tên bài và Link nhạc nhé!");

  try {
    const res = await fetch(`${API_BASE_URL}/api/songs/${songId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: localStorage.getItem('token')
      },
      body: JSON.stringify({ title, artist, src, cover, category })
    });

    if (res.ok) {
      alert("✅ Cập nhật thành công!");
      closeEditSongModal();
      await fetchSongs();
    } else {
      alert("❌ Lỗi khi lưu thay đổi");
    }
  } catch (err) {
    console.error(err);
    alert("❌ Lỗi kết nối server");
  }
}

// ====================== TOGGLE LIKE ======================
async function toggleLike(id) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/favorite/${id}`, {
      method: 'POST',
      headers: { Authorization: localStorage.getItem('token') }
    });
    const data = await res.json();
    data.liked ? alert('❤️ Đã thêm vào thư viện') : alert('💔 Đã xóa khỏi thư viện');
    await fetchSongs();
  } catch (err) {
    console.log(err);
  }
}

// ====================== LIBRARY ======================
async function showLibrary() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/library`, {
      headers: { Authorization: localStorage.getItem('token') }
    });
    const likedSongs = await res.json();
    const html = `
      <div class="p-8 pb-32">
        <h1 class="text-4xl font-bold mb-2">❤️ Thư viện yêu thích</h1>
        <p class="text-zinc-400 mb-8">${likedSongs.length} bài hát đã thích</p>
        <div id="song-list" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"></div>
      </div>
    `;
    document.getElementById('main-content').innerHTML = html;
    renderSongList(likedSongs);
  } catch (err) {
    console.log(err);
  }
}

// ====================== DISCOVER ======================
async function showDiscover() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/discover`);
    const data = await res.json();
    const html = `
      <div class="p-8 space-y-12 pb-32">
        <div class="rounded-3xl p-10 bg-gradient-to-r from-emerald-500 to-cyan-500">
          <h1 class="text-5xl font-black mb-3">🎵 KHÁM PHÁ</h1>
          <p class="text-lg text-white/90">Âm nhạc dành riêng cho bạn</p>
        </div>
        <div>
          <h2 class="text-2xl font-bold mb-6">🎧 Dành cho bạn</h2>
          <div id="recommended-list" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"></div>
        </div>
        <div>
          <h2 class="text-2xl font-bold mb-6">🔥 Trending</h2>
          <div id="trending-list" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"></div>
        </div>
      </div>
    `;
    document.getElementById('main-content').innerHTML = html;
    renderCustomList('recommended-list', data.recommended);
    renderCustomList('trending-list', data.trending);
  } catch (err) {
    console.log(err);
  }
}

function renderCustomList(containerId, songs) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = songs.map(song => {
    const realIndex = window.songs.findIndex(s => s.id === song.id);
    return `
      <div onclick="playSong(${realIndex})" class="song-card bg-zinc-900 rounded-2xl overflow-hidden cursor-pointer group relative">
        <img src="${song.cover}" class="w-full aspect-square object-cover">
        <div class="p-4">
          <p class="font-medium truncate">${song.title}</p>
          <p class="text-sm text-zinc-400">${song.artist}</p>
        </div>
      </div>
    `;
  }).join('');
}

// ====================== AUTH ======================
async function login() {
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  try {
    const res = await fetch(`${API_BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!data.token) return alert('Sai tài khoản');
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
  if (password !== confirmPassword) return alert('❌ Mật khẩu không khớp');

  try {
    const res = await fetch(`${API_BASE_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!data.success) return alert(data.error || 'Đăng ký thất bại');
    alert('✅ Đăng ký thành công');
    closeRegister();
  } catch (err) {
    console.log(err);
  }
}
function logout() {
  // Lấy dữ liệu user từ localStorage trước khi hiện confirm
  const userData = JSON.parse(localStorage.getItem('user'));
  
  // Sử dụng biến vừa lấy được (dùng userData thay vì user)
  if (confirm(`${userData?.username || 'Bạn'} muốn đăng xuất à?`)) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    location.reload();
  }
}

function goHome() {
  loadHome();
  updateGreeting();
  fetchSongs();
  checkAdmin(); // Gọi lại để đảm bảo trạng thái nút upload
  document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
}

function getYoutubeId(url) {
  const regExp = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/;
  const match = url.match(regExp);
  return match ? match[1] : '';
}

// ====================== TĂNG LƯỢT NGHE ======================
async function increasePlayCount(id) {
  try {
    await fetch(`${API_BASE_URL}/api/songs/${id}/play`, {
      method: 'PUT'
    });
    console.log(`Đã tăng lượt nghe cho bài hát ID: ${id}`);
  } catch (err) {
    console.log("Lỗi khi tăng lượt nghe:", err);
  }
}

// ====================== MOBILE NAV ACTIVE (MỚI) ======================
function setActiveMobileNav(button) {
  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    btn.classList.remove('active-mobile-nav');
  });
  button.classList.add('active-mobile-nav');
}

// ====================== SEARCH MOBILE (MỚI) ======================
function focusSearch() {
  goHome();
  setTimeout(() => {
    const input = document.getElementById('search-input');
    if (input) {
      input.focus();
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 400);
}

// ====================== PROFILE (MỚI) ======================
function showProfile() {
  const user = JSON.parse(localStorage.getItem('user'));
  document.getElementById('main-content').innerHTML = `
    <div class="p-6">
      <div class="bg-zinc-900 rounded-3xl p-6">
        <div class="flex flex-col items-center text-center">
          <div class="w-24 h-24 rounded-full bg-emerald-500 flex items-center justify-center text-4xl font-bold mb-4">
            ${user?.username?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <h1 class="text-3xl font-bold mb-2">${user?.username || 'Unknown'}</h1>
          <p class="text-zinc-400 mb-2">Role: <span class="text-emerald-400">${user?.role || 'user'}</span></p>
          <button onclick="logout()" class="mt-6 bg-red-500 hover:bg-red-400 px-6 py-3 rounded-2xl font-semibold transition">
            <i class="fas fa-right-from-bracket mr-2"></i> Đăng xuất
          </button>
        </div>
      </div>
    </div>
  `;
}

// Export functions to window
Object.assign(window, {
  goHome, loadHome, uploadMusic, closeAddSongModal, submitSong,
  deleteSong, renderSongList, editSong, updateSong, closeEditSongModal,
  searchSongs, toggleLike, showLibrary, showDiscover, increasePlayCount, 
  login, logout, filterByCategory, setActiveMobileNav, checkAdmin,
  focusSearch, showProfile, register, 
  showRegister: () => document.getElementById('register-modal').classList.replace('hidden', 'flex'),
  closeRegister: () => document.getElementById('register-modal').classList.replace('flex', 'hidden')
});
