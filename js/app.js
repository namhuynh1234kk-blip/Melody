// js/app.js
const API_BASE_URL = "https://melody-ehdi.onrender.com";
let currentPage = 1, loadingSongs = false;
window.isMusicPlaying = false;

document.addEventListener('DOMContentLoaded', () => {
    window.songs = [];
    const token = localStorage.getItem('token');
    if (!token) {
        document.getElementById('login-modal')?.classList.remove('hidden');
        return;
    }
    document.getElementById('login-modal')?.classList.add('hidden');
    initPlayer(); initPlayerUI(); loadHome(); updateGreeting(); fetchSongs(); checkAdmin();
});

// ====================== UTILS & UI UPDATES ======================
function checkAdmin() {
    const user = JSON.parse(localStorage.getItem('user'));
    const uploadBtnMobile = document.getElementById('mobile-upload-btn');
    if (user?.role !== 'admin' && uploadBtnMobile) uploadBtnMobile.style.display = 'none';
}

function updateGreeting() {
    const greetingElement = document.getElementById('greeting-text');
    if (!greetingElement) return;
    const hour = new Date().getHours();
    let greeting = (hour >= 5 && hour < 12) ? "Chào buổi sáng 👋" : 
                   (hour >= 12 && hour < 18) ? "Chào buổi chiều ☀️" : 
                   (hour >= 18 && hour < 22) ? "Chào buổi tối 🌙" : "Làm tí nhạc đêm khuya nào ✨";
    greetingElement.innerText = greeting;
}

function getYoutubeId(url) {
    const regExp = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/;
    const match = url.match(regExp);
    return match ? match[1] : '';
}

// ====================== CORE RENDER ======================
function loadHome() {
    const user = JSON.parse(localStorage.getItem('user'));
    const html = `
    <div class="p-8 pb-32">
        <div class="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
            <div>
                <h1 id="greeting-text" class="text-4xl font-bold mb-2">Chào buổi sáng 👋</h1>
                <p class="text-zinc-400 mb-2">👤 USER: <span class="text-white font-medium">${user?.username}</span>
                <span class="ml-2 px-2 py-1 rounded bg-emerald-600 text-xs text-white">${user?.role}</span></p>
                <p id="song-count" class="text-zinc-400">Playlist của bạn (${window.songs.length} bài)</p>
            </div>
            <div class="flex gap-3 w-full md:w-auto">
                <div class="relative flex-1 md:w-96">
                    <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"></i>
                    <input type="text" id="search-input" placeholder="Tìm bài hát..." class="w-full bg-zinc-900 border border-zinc-700 rounded-2xl py-3 pl-12 pr-4 outline-none focus:border-emerald-500" oninput="searchSongs(this.value)">
                </div>
                <select id="category-filter" onchange="filterByCategory(this.value)" class="bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-3 outline-none">
                    <option value="">🎵 Tất cả</option>
                    <option value="V-Pop">V-Pop</option><option value="US-UK">US-UK</option><option value="Rap">Rap</option>
                    <option value="Lo-fi">Lo-fi</option><option value="EDM">EDM</option><option value="Remix">Remix</option><option value="Ballad">Ballad</option>
                </select>
                ${user?.role === 'admin' ? `<button onclick="uploadMusic()" class="bg-emerald-600 hover:bg-emerald-500 px-6 py-3 rounded-2xl font-medium flex items-center gap-2"><i class="fas fa-plus"></i> Thêm</button>` : ''}
            </div>
        </div>
        <div id="song-list" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"></div>
    </div>`;
    document.getElementById('main-content').innerHTML = html;
    renderSongList();
}

function renderSongList(songArray = window.songs) {
    const container = document.getElementById('song-list');
    if (!container) return;
    container.innerHTML = (!songArray || songArray.length === 0) ? `<div class="col-span-full py-20 text-center text-zinc-400">Không tìm thấy bài hát nào.</div>` : '';
    
    const user = JSON.parse(localStorage.getItem('user'));
    songArray.forEach((song) => {
        const realIndex = window.songs.findIndex(s => s.id === song.id);
        const card = document.createElement('div');
        card.className = "song-card bg-zinc-900 rounded-2xl overflow-hidden cursor-pointer group relative";
        card.innerHTML = `
            <div class="relative group">
                <img src="${song.cover}" class="w-full aspect-square object-cover transition group-hover:brightness-50" onerror="this.src='https://picsum.photos/300/300'">
                <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"><i class="fas fa-play text-white text-3xl"></i></div>
                <iframe id="preview-${song.id}" class="absolute inset-0 w-full h-full opacity-0 pointer-events-none transition" src="" allow="autoplay"></iframe>
            </div>
            <div class="p-4"><p class="font-medium truncate text-white">${song.title}</p><p class="text-sm text-zinc-400 truncate">${song.artist}</p></div>
            <div class="absolute top-3 right-3 flex flex-col gap-2 z-20">
                <button onclick="event.stopImmediatePropagation(); toggleLike(${song.id});" class="bg-zinc-800/80 w-10 h-10 rounded-full flex items-center justify-center transition">
                    <i class="fas fa-heart ${song.liked ? 'text-red-500' : 'text-white'}"></i>
                </button>
                <button onclick="event.stopImmediatePropagation(); addToQueue(${song.id});" class="bg-emerald-500 w-10 h-10 rounded-full hidden group-hover:flex items-center justify-center transition"><i class="fas fa-plus"></i></button>
                ${user?.role === 'admin' ? `
                    <button onclick="event.stopImmediatePropagation(); editSong(${realIndex});" class="bg-yellow-500/90 w-10 h-10 rounded-full hidden group-hover:flex items-center justify-center transition"><i class="fas fa-pen text-xs"></i></button>
                    <button onclick="event.stopImmediatePropagation(); deleteSong(${song.id});" class="bg-red-600/90 w-10 h-10 rounded-full hidden group-hover:flex items-center justify-center transition"><i class="fas fa-trash-can text-xs"></i></button>
                ` : ''}
            </div>`;
        card.onclick = () => { if (typeof playSong === 'function') playSong(realIndex); };
        card.onmouseenter = () => {
            if (song.src.includes("youtube.com") || song.src.includes("youtu.be")) {
                const videoId = getYoutubeId(song.src);
                const iframe = document.getElementById(`preview-${song.id}`);
                if (iframe && videoId) {
                    iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&controls=0&playsinline=1&rel=0&modestbranding=1`;
                    iframe.classList.remove('opacity-0');
                }
            }
        };
        card.onmouseleave = () => {
            const iframe = document.getElementById(`preview-${song.id}`);
            if (iframe) { iframe.src = ''; iframe.classList.add('opacity-0'); }
        };
        container.appendChild(card);
    });
}

// ====================== DATA ACTIONS (API) ======================
async function fetchSongs() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/songs`);
        const data = await res.json();
        const token = localStorage.getItem('token');
        let likedIds = [];
        if (token) {
            const libRes = await fetch(`${API_BASE_URL}/api/library`, { headers: { Authorization: token } });
            likedIds = (await libRes.json()).map(s => s.id);
        }
        window.songs = data.map(s => ({ ...s, liked: likedIds.includes(s.id) }));
        const countEl = document.getElementById('song-count');
        if (countEl) countEl.innerText = `Playlist của bạn (${window.songs.length} bài)`;
        renderSongList();
    } catch (err) { console.error("Lỗi khi tải nhạc:", err); }
}

async function submitSong() {
    const title = document.getElementById('song-title').value.trim();
    const artist = document.getElementById('song-artist').value.trim();
    const src = document.getElementById('song-src').value.trim();
    const category = document.getElementById('song-category').value;
    let cover = document.getElementById('song-cover').value.trim() || `https://picsum.photos/seed/${Math.floor(Math.random()*1000)}/300/300`;

    if (!title || !src) return alert("Thiếu Tên bài hoặc Link nhạc!");
    try {
        const res = await fetch(`${API_BASE_URL}/api/songs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: localStorage.getItem('token') },
            body: JSON.stringify({ title, artist: artist || "Nghệ sĩ ẩn danh", src, cover, category, type: (src.includes("youtube.com") || src.includes("youtu.be")) ? 'youtube' : 'mp3' })
        });
        if (res.ok) { await fetchSongs(); closeAddSongModal(); alert("✅ Thành công!"); }
    } catch (err) { alert("❌ Lỗi kết nối"); }
}

async function deleteSong(id) {
    if (!confirm("Xóa bài hát này?")) return;
    try {
        await fetch(`${API_BASE_URL}/api/songs/${id}`, { method: 'DELETE', headers: { Authorization: localStorage.getItem('token') } });
        fetchSongs();
    } catch (err) { console.log(err); }
}

async function updateSong() {
    const index = window.editingIndex;
    if (index === undefined || !window.songs[index]) return;
    const songId = window.songs[index].id;
    const body = {
        title: document.getElementById('edit-song-title').value.trim(),
        artist: document.getElementById('edit-song-artist').value.trim(),
        src: document.getElementById('edit-song-src').value.trim(),
        cover: document.getElementById('edit-song-cover').value.trim(),
        category: document.getElementById('edit-song-category').value
    };
    try {
        const res = await fetch(`${API_BASE_URL}/api/songs/${songId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: localStorage.getItem('token') },
            body: JSON.stringify(body)
        });
        if (res.ok) { alert("✅ Cập nhật thành công!"); closeEditSongModal(); await fetchSongs(); }
    } catch (err) { alert("❌ Lỗi kết nối"); }
}

async function toggleLike(id) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/favorite/${id}`, { method: 'POST', headers: { Authorization: localStorage.getItem('token') } });
        const data = await res.json();
        alert(data.liked ? '❤️ Đã thêm vào thư viện' : '💔 Đã xóa khỏi thư viện');
        await fetchSongs();
    } catch (err) { console.log(err); }
}

// ====================== NAVIGATION & PAGES ======================
async function showLibrary() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/library`, { headers: { Authorization: localStorage.getItem('token') } });
        const likedSongs = await res.json();
        document.getElementById('main-content').innerHTML = `
            <div class="p-8 pb-32"><h1 class="text-4xl font-bold mb-2">❤️ Thư viện yêu thích</h1>
            <p class="text-zinc-400 mb-8">${likedSongs.length} bài hát</p>
            <div id="song-list" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"></div></div>`;
        renderSongList(likedSongs);
    } catch (err) { console.log(err); }
}

async function showDiscover() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/discover`);
        const data = await res.json();
        document.getElementById('main-content').innerHTML = `
            <div class="p-8 space-y-12 pb-32">
                <div class="rounded-3xl p-10 bg-gradient-to-r from-emerald-500 to-cyan-500">
                    <h1 class="text-5xl font-black mb-3">🎵 KHÁM PHÁ</h1><p class="text-lg text-white/90">Dành riêng cho bạn</p>
                </div>
                <div><h2 class="text-2xl font-bold mb-6">🎧 Dành cho bạn</h2><div id="recommended-list" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"></div></div>
                <div><h2 class="text-2xl font-bold mb-6">🔥 Trending</h2><div id="trending-list" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"></div></div>
            </div>`;
        renderCustomList('recommended-list', data.recommended);
        renderCustomList('trending-list', data.trending);
    } catch (err) { console.log(err); }
}

function renderCustomList(containerId, songs) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = songs.map(song => {
        const realIndex = window.songs.findIndex(s => s.id === song.id);
        return `
            <div onclick="playSong(${realIndex})" class="song-card bg-zinc-900 rounded-2xl overflow-hidden cursor-pointer group relative">
                <img src="${song.cover}" class="w-full aspect-square object-cover">
                <div class="p-4 flex justify-between items-center">
                    <div class="min-w-0"><p class="font-medium truncate">${song.title}</p><p class="text-sm text-zinc-400">${song.artist}</p></div>
                    <button onclick="event.stopPropagation(); addToQueue(${song.id})" class="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center"><i class="fas fa-plus text-sm"></i></button>
                </div>
            </div>`;
    }).join('');
}

// ====================== AUTH & PROFILE ======================
async function login() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    try {
        const res = await fetch(`${API_BASE_URL}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
        const data = await res.json();
        if (!data.token) return alert('Sai tài khoản');
        localStorage.setItem('token', data.token); localStorage.setItem('user', JSON.stringify(data.user));
        location.reload();
    } catch (err) { console.log(err); }
}

async function register() {
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    if (password !== document.getElementById('register-confirm-password').value) return alert('❌ Mật khẩu không khớp');
    try {
        const res = await fetch(`${API_BASE_URL}/api/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
        const data = await res.json();
        if (!data.success) return alert(data.error || 'Thất bại');
        alert('✅ Đăng ký thành công'); closeRegister();
    } catch (err) { console.log(err); }
}

function logout() {
    const userData = JSON.parse(localStorage.getItem('user'));
    if (confirm(`${userData?.username || 'Bạn'} muốn đăng xuất à?`)) {
        localStorage.removeItem('token'); localStorage.removeItem('user'); location.reload();
    }
}

function showProfile() {
    const user = JSON.parse(localStorage.getItem('user'));
    document.getElementById('main-content').innerHTML = `
        <div class="p-6"><div class="bg-zinc-900 rounded-3xl p-6 flex flex-col items-center text-center">
            <div class="w-24 h-24 rounded-full bg-emerald-500 flex items-center justify-center text-4xl font-bold mb-4">${user?.username?.charAt(0)?.toUpperCase() || 'U'}</div>
            <h1 class="text-3xl font-bold mb-2">${user?.username || 'Unknown'}</h1>
            <p class="text-zinc-400">Role: <span class="text-emerald-400">${user?.role || 'user'}</span></p>
            <button onclick="logout()" class="mt-6 bg-red-500 px-6 py-3 rounded-2xl font-semibold"><i class="fas fa-right-from-bracket mr-2"></i> Đăng xuất</button>
        </div></div>`;
}

// ====================== GLOBAL EXPORTS ======================
Object.assign(window, {
    goHome: () => { loadHome(); updateGreeting(); fetchSongs(); checkAdmin(); document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' }); },
    uploadMusic: () => document.getElementById('add-song-modal')?.classList.replace('hidden', 'flex'),
    closeAddSongModal: () => document.getElementById('add-song-modal')?.classList.replace('flex', 'hidden'),
    editSong: (index) => {
        const s = window.songs[index]; if (!s) return; window.editingIndex = index;
        ['edit-song-title','edit-song-artist','edit-song-src','edit-song-cover','edit-song-category'].forEach(id => {
            const el = document.getElementById(id); if(el) el.value = s[id.replace('edit-song-','')] || "";
        });
        document.getElementById('edit-song-modal')?.classList.replace('hidden', 'flex');
    },
    closeEditSongModal: () => document.getElementById('edit-song-modal')?.classList.replace('flex', 'hidden'),
    searchSongs: (kw) => {
        kw = kw.toLowerCase().trim();
        renderSongList(kw ? window.songs.filter(s => s.title.toLowerCase().includes(kw) || s.artist.toLowerCase().includes(kw)) : window.songs);
    },
    filterByCategory: (cat) => renderSongList(cat ? window.songs.filter(s => (s.category||"").toLowerCase() === cat.toLowerCase()) : window.songs),
    focusSearch: () => { window.goHome(); setTimeout(() => { const i = document.getElementById('search-input'); if(i) { i.focus(); i.scrollIntoView({behavior:'smooth'}); }}, 400); },
    setActiveMobileNav: (btn) => { document.querySelectorAll('.mobile-nav-btn').forEach(b => b.classList.remove('active-mobile-nav')); btn.classList.add('active-mobile-nav'); },
    showRegister: () => document.getElementById('register-modal').classList.replace('hidden', 'flex'),
    closeRegister: () => document.getElementById('register-modal').classList.replace('flex', 'hidden'),
    login, register, logout, showProfile, showLibrary, showDiscover, toggleLike, submitSong, updateSong, deleteSong, fetchSongs
});
