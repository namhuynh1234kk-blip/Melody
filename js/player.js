// js/player.js
let audio = null;
let youtubePlayer = null;
let currentSongIndex = 0;
let isPlaying = false;
let playQueue = [];
let nextPopupLocked = false;

// ====================== INIT ======================
function initPlayer() {
    audio = new Audio();
    audio.volume = 1;
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', nextSong);
    audio.addEventListener('error', () => { alert("Không phát được file MP3 này"); });
} 

// ====================== PLAYER UI ======================
function initPlayerUI() {
    const playerHTML = `
    <!-- LEFT -->
    <div class="flex items-center gap-4 w-80">
       <img id="now-cover"
     src="https://picsum.photos/id/1015/300/300"
     class="w-14 h-14 rounded-lg object-cover record-spin paused">
        <div class="min-w-0 flex-1">
            <div id="now-title" class="font-medium text-sm truncate">Chưa phát bài nào</div>
            <div id="now-artist" class="text-xs text-zinc-400">MelodyVN</div>
        </div>
    </div>

    <!-- CENTER -->
    <div class="flex-1 flex flex-col items-center justify-center gap-3">
        <!-- PLAYER BUTTONS -->
        <div class="flex items-center gap-8 text-2xl">
            <button onclick="prevSong()" class="hover:text-emerald-400"><i class="fas fa-backward"></i></button>
            <button id="play-btn" onclick="togglePlay()" class="text-4xl hover:scale-110 transition"><i class="fas fa-play"></i></button>
            <button onclick="nextSong()" class="hover:text-emerald-400"><i class="fas fa-forward"></i></button>
        </div>

        <!-- PROGRESS -->
        <div class="w-full max-w-md flex items-center gap-3 text-xs">
            <span id="current-time">0:00</span>
            <input type="range" id="progress" value="0" min="0" max="100" class="flex-1 accent-emerald-500">
            <span id="duration">0:00</span>
        </div>

        <!-- EXTRA CONTROLS -->
        <div class="flex items-center gap-5">
            <div class="flex items-center gap-2">
                <i class="fas fa-gauge-high text-zinc-400"></i>
                <select id="speed-control" class="bg-zinc-800 text-white rounded-lg px-2 py-1 outline-none">
                    <option value="0.5">0.5x</option><option value="0.75">0.75x</option>
                    <option value="1" selected>1x</option><option value="1.25">1.25x</option>
                    <option value="1.5">1.5x</option><option value="2">2x</option>
                </select>
            </div>
            <div class="flex items-center gap-2">
                <i class="fas fa-volume-high text-zinc-400"></i>
                <input id="volume-control" type="range" min="0" max="100" value="100" class="w-24">
            </div>
            <button id="like-btn" onclick="toggleCurrentSongLike()" class="text-2xl text-zinc-400 hover:text-red-500 transition">
                <i class="fas fa-heart"></i>
            </button>
            <button onclick="toggleQueuePanel()" class="text-xl text-zinc-400 hover:text-emerald-400 transition">
                <i class="fas fa-list"></i>
            </button>
        </div>
    </div>

    <!-- YOUTUBE & QUEUE -->
    <div id="youtube-player" style="width:1px;height:1px;opacity:0;position:absolute;"></div>
    <div id="queue-panel" class="hidden fixed bottom-[130px] right-5 w-[320px] bg-zinc-900 rounded-2xl border border-zinc-700 shadow-2xl p-4 z-[9999]">
        <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2 font-semibold"><i class="fas fa-list text-emerald-400"></i>Playlists</div>
            <button onclick="toggleQueuePanel()"><i class="fas fa-xmark"></i></button>
        </div>
        <div id="queue-list" class="space-y-2 max-h-[300px] overflow-y-auto">
            <div class="text-center text-zinc-500 py-6">Hàng đợi trống</div>
        </div>
    </div>
    <div id="next-popup" class="hidden fixed bottom-40 right-5 w-80 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700 rounded-2xl p-4 z-[99999] shadow-2xl">
  <div class="text-sm text-zinc-400 mb-2">Tiếp theo</div>

  <div class="flex gap-3 items-center">
   <img id="next-popup-cover"
     class="w-14 h-14 rounded-full object-cover record-spin paused border-2 border-zinc-700">
    <div class="flex-1 min-w-0">
      <div id="next-popup-title" class="font-medium truncate"></div>
      <div id="next-popup-artist" class="text-sm text-zinc-500 truncate"></div>
    </div>
  </div>

  <div class="flex gap-2 mt-4">
    <button onclick="nextSong()" class="flex-1 bg-emerald-500 hover:bg-emerald-400 rounded-xl py-2">
      Phát ngay
    </button>
    <button onclick="hideNextPopup()" class="px-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl">
      Đóng
    </button>
  </div>
</div>
    `;
    document.getElementById('player').innerHTML = playerHTML;

    setTimeout(() => {
        const progress = document.getElementById('progress');
        progress.addEventListener('input', () => {
            if (audio?.duration) audio.currentTime = progress.value;
            if (youtubePlayer?.seekTo) youtubePlayer.seekTo(progress.value, true);
        });

        const volumeControl = document.getElementById('volume-control');
        volumeControl.addEventListener('input', () => {
            const v = volumeControl.value / 100;
            audio.volume = v;
            if (youtubePlayer?.setVolume) youtubePlayer.setVolume(volumeControl.value);
        });

        const speedControl = document.getElementById('speed-control');
        speedControl.addEventListener('change', () => {
            const speed = parseFloat(speedControl.value);
            audio.playbackRate = speed;
            if (youtubePlayer?.setPlaybackRate) youtubePlayer.setPlaybackRate(speed);
        });
    }, 100);
}

// ====================== PLAY SONG ======================
function playSong(index) {
    const song = window.songs[index];
    if (!song) return;
    currentSongIndex = index;
    renderQueue();

    document.getElementById('now-cover').src = song.cover;
    document.getElementById('now-title').textContent = song.title;
    document.getElementById('now-artist').textContent = song.artist;

    const likeBtn = document.getElementById('like-btn');
    if (likeBtn) {
        likeBtn.innerHTML = `<i class="fas fa-heart ${song.liked ? 'text-red-500' : ''}"></i>`;
    }

    const isYoutube = song.src.includes("youtube.com") || song.src.includes("youtu.be") || 
                      song.src.includes("music.youtube.com") || song.src.includes("/shorts/");
    if (isYoutube) playYouTube(song.src);
    else playMP3(song.src);
    // reset trạng thái spin khi đổi bài
document.getElementById('now-cover')?.classList.remove('paused');
document.getElementById('now-cover')?.classList.add('record-spin');
nextPopupLocked = false;
nextPopupShown = false;
}

function playMP3(src) {
    clearInterval(window.youtubeProgressInterval);
    if (youtubePlayer?.stopVideo) youtubePlayer.stopVideo();

    audio.src = src;
    audio.play();
    isPlaying = true;

    document.getElementById('play-btn').innerHTML =
        `<i class="fas fa-pause"></i>`;

    // 👉 bật xoay
    document.getElementById('now-cover')?.classList.remove('paused');
    document.getElementById('next-popup-cover')?.classList.remove('paused');
}

function extractYouTubeId(url) {
    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.hostname.includes('youtu.be')) return parsedUrl.pathname.slice(1);
        if (parsedUrl.pathname.includes('/shorts/')) return parsedUrl.pathname.split('/shorts/')[1];
        if (parsedUrl.searchParams.get('v')) return parsedUrl.searchParams.get('v');
        return null;
    } catch (e) { return null; }
}

function playYouTube(url) {
    audio.pause();

    const videoId = extractYouTubeId(url);
    if (!videoId) return alert("Link YouTube không hợp lệ");

    clearInterval(window.youtubeProgressInterval);

    if (!youtubePlayer) {
        youtubePlayer = new YT.Player('youtube-player', {
            height: '1',
            width: '1',
            videoId: videoId,
            host: 'https://www.youtube.com',
            playerVars: {
                autoplay: 1,
                playsinline: 1,
                enablejsapi: 1
            },
            events: {
                onReady: (e) => e.target.playVideo(),
                onStateChange: (e) => {
                    if (e.data === YT.PlayerState.ENDED) nextSong();
                }
            }
        });
    } else {
        youtubePlayer.loadVideoById(videoId);
        youtubePlayer.playVideo();
    }

    isPlaying = true;

    document.getElementById('play-btn').innerHTML =
        `<i class="fas fa-pause"></i>`;

    // 👉 bật xoay
    document.getElementById('now-cover')?.classList.remove('paused');
    document.getElementById('next-popup-cover')?.classList.remove('paused');

    window.youtubeProgressInterval = setInterval(updateProgress, 500);
}

function togglePlay() {
    if (youtubePlayer) {
        try {
            const state = youtubePlayer.getPlayerState();

            if (state === 1) {
                youtubePlayer.pauseVideo();
                isPlaying = false;

                document.getElementById('play-btn').innerHTML =
                    `<i class="fas fa-play"></i>`;

                document.getElementById('now-cover')?.classList.add('paused');
            } else {
                youtubePlayer.playVideo();
                isPlaying = true;

                document.getElementById('play-btn').innerHTML =
                    `<i class="fas fa-pause"></i>`;

                document.getElementById('now-cover')?.classList.remove('paused');
            }
            return;
        } catch (e) {}
    }

    if (!audio.src) return;

    if (audio.paused) {
        audio.play();
        isPlaying = true;

        document.getElementById('play-btn').innerHTML =
            `<i class="fas fa-pause"></i>`;

        document.getElementById('now-cover')?.classList.remove('paused');
    } else {
        audio.pause();
        isPlaying = false;

        document.getElementById('play-btn').innerHTML =
            `<i class="fas fa-play"></i>`;

        document.getElementById('now-cover')?.classList.add('paused');
    }
}

function updateProgress() {
    const progress = document.getElementById('progress');
    const currentTime = document.getElementById('current-time');
    const duration = document.getElementById('duration');

    if (audio && audio.duration && !isNaN(audio.duration)) {
        progress.max = audio.duration;
        progress.value = audio.currentTime;
        currentTime.textContent = formatTime(audio.currentTime);
        duration.textContent = formatTime(audio.duration);
    }

    if (youtubePlayer?.getCurrentTime) {
        try {
            const current = youtubePlayer.getCurrentTime();
            const total = youtubePlayer.getDuration();
            if (!isNaN(total) && total > 0) {
                progress.max = total;
                progress.value = current;
                currentTime.textContent = formatTime(current);
                duration.textContent = formatTime(total);
            }
        } catch (e) {}
    }
    updateLyrics();
    let remain=0;


// mp3
if(audio && audio.duration){

remain=
audio.duration-
audio.currentTime;

}


// youtube
if(
youtubePlayer &&
typeof youtubePlayer.getDuration
=== 'function'
){

try{

remain=
youtubePlayer.getDuration()
-
youtubePlayer.getCurrentTime();

}catch(e){}

}


// còn 15s

if (remain <= 15 && !nextPopupShown && !nextPopupLocked) { 
    showNextPopup();
}
}

function updateLyrics() {
    const song = window.songs[currentSongIndex];
    const lyricsBox = document.getElementById('lyrics');
    if (!song || !song.lyrics || !lyricsBox) return;

    let current = 0;
    if (audio && audio.duration) current = audio.currentTime;
    if (youtubePlayer?.getCurrentTime) {
        try { current = youtubePlayer.getCurrentTime(); } catch (e) {}
    }

    lyricsBox.innerHTML = song.lyrics.map(line => `
        <div class="transition-all duration-300 ${current >= line.time ? 'text-white text-2xl font-bold' : 'text-zinc-500'}">
            ${line.text}
        </div>`).join('');
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function nextSong() {
    if (playQueue.length > 1) {
        playQueue.shift();
        const nextSongData = playQueue[0];
        renderQueue();
        if (nextSongData) {
            const nextIdx = window.songs.findIndex(s => s.id === nextSongData.id);
            if (nextIdx !== -1) playSong(nextIdx);
        }
        return;
    }
    currentSongIndex = (currentSongIndex + 1) % window.songs.length;
    playSong(currentSongIndex);
}

function prevSong() {
    currentSongIndex = (currentSongIndex - 1 + window.songs.length) % window.songs.length;
    playSong(currentSongIndex);
}

async function toggleCurrentSongLike() {
    const song = window.songs[currentSongIndex];
    if (!song) return;
    try {
        await window.toggleLike(song.id);
        song.liked = !song.liked;
        const btn = document.getElementById('like-btn');
        if (btn) btn.innerHTML = `<i class="fas fa-heart ${song.liked ? 'text-red-500' : ''}"></i>`;
    } catch (err) { console.log(err); }
}

// ================= QUEUE LOGIC =================
function toggleQueuePanel() {
    const panel = document.getElementById('queue-panel');
    if (panel) panel.classList.toggle('hidden');
}

function addToQueue(songId) {
    const song = window.songs.find(s => s.id === songId);
    if (!song) return;
    if (playQueue.find(s => s.id === song.id)) return alert('Đã có trong hàng đợi');
    playQueue.push(song);
    renderQueue();
}

function removeQueue(index) { playQueue.splice(index, 1); renderQueue(); }

function moveQueueUp(index) {
    if (index <= 0) return;
    [playQueue[index - 1], playQueue[index]] = [playQueue[index], playQueue[index - 1]];
    renderQueue();
}

function moveQueueDown(index) {
    if (index >= playQueue.length - 1) return;
    [playQueue[index + 1], playQueue[index]] = [playQueue[index], playQueue[index + 1]];
    renderQueue();
}

function clearQueue() { playQueue = []; renderQueue(); }

function renderQueue() {
    const queue = document.getElementById('queue-list');
    if (!queue) return;
    if (playQueue.length === 0) {
        queue.innerHTML = `<div class="text-zinc-500 text-center py-5">Hàng đợi trống</div>`;
        return;
    }
    queue.innerHTML = `<button onclick="clearQueue()" class="w-full mb-3 bg-red-500 rounded-lg py-2">Xóa tất cả</button>` + 
        playQueue.map((song, index) => `
        <div class="flex gap-3 items-center bg-zinc-800 rounded-xl p-2">
            <img src="${song.cover}" class="w-12 h-12 rounded-lg object-cover">
            <div class="flex-1 min-w-0">
                <div class="truncate text-sm">${song.title}</div>
                <div class="truncate text-xs text-zinc-500">${song.artist}</div>
            </div>
            <button onclick="currentSongIndex=${window.songs.findIndex(s=>s.id===song.id)};playSong(currentSongIndex)" class="text-emerald-400">▶</button>
            <button onclick="moveQueueUp(${index})" class="text-blue-400">↑</button>
            <button onclick="moveQueueDown(${index})" class="text-yellow-400">↓</button>
            <button onclick="removeQueue(${index})" class="text-red-500">×</button>
        </div>`).join('');
}
let nextPopupShown = false;

function showNextPopup() {
    if (nextPopupShown) return;

    const nextIndex = (currentSongIndex + 1) % window.songs.length;
    const nextSongData = window.songs[nextIndex];
    if (!nextSongData) return;

    // Cập nhật thông tin UI
    document.getElementById('next-popup-cover').src = nextSongData.cover;
    document.getElementById('next-popup-title').textContent = nextSongData.title;
    document.getElementById('next-popup-artist').textContent = nextSongData.artist;

    // Hiển thị popup
    document.getElementById('next-popup').classList.remove('hidden');
    nextPopupShown = true;
}
function hideNextPopup() {
    document.getElementById('next-popup').classList.add('hidden');
    nextPopupShown = false;
    nextPopupLocked = true; // Khóa lại, không cho hiện ở bài này nữa
}

// EXPORTS
window.toggleQueuePanel = toggleQueuePanel;
window.addToQueue = addToQueue;
window.removeQueue = removeQueue;
window.moveQueueUp = moveQueueUp;
window.moveQueueDown = moveQueueDown;
window.clearQueue = clearQueue;
window.renderQueue = renderQueue;
  window.hideNextPopup = hideNextPopup;
window.nextSong = nextSong;
