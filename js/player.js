// js/player.js
let audio = null;
let youtubePlayer = null;
let currentSongIndex = 0; 
let isPlaying = false;
    window.melodyAIPlaybackChanged?.(false); 
let playQueue = [];
let nextPopupLocked = false;
let currentQueueIndex = -1;
let nextPopupShown = false;

// ====================== INIT ======================
function initPlayer() {
    audio = new Audio();
    audio.volume = 1;
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', handleSongEnded); 
    audio.addEventListener('error', () => { alert("Không phát được file MP3 này"); });
}

// ====================== PLAYER UI ======================
function initPlayerUI() {
    const playerHTML = `
    <div class="player-shell">
      <div class="player-track-info flex items-center gap-3">
        <div class="player-cover-wrap">
          <img id="now-cover" src="https://picsum.photos/id/1015/300/300"
               class="player-cover w-14 h-14 rounded-xl object-cover record-spin paused">
          <span class="player-cover-glow"></span>
        </div>
        <div class="min-w-0">
          <div class="player-eyebrow"><span></span> ĐANG PHÁT</div>
          <div id="now-title" class="font-semibold text-sm truncate">Chưa phát bài nào</div>
          <div id="now-artist" class="text-xs text-zinc-400 truncate">MelodyVN</div>
        </div>
      </div>

      <div class="player-main">
        <div class="player-controls">
          <button onclick="prevSong()" aria-label="Bài trước"><i class="fas fa-backward-step"></i></button>
          <button id="play-btn" onclick="togglePlay()" aria-label="Phát hoặc tạm dừng">
            <i class="fas fa-play"></i>
          </button>
          <button onclick="nextSong()" aria-label="Bài tiếp theo"><i class="fas fa-forward-step"></i></button>
        </div>

        <div class="player-progress">
          <span id="current-time">0:00</span>
          <input type="range" id="progress" value="0" min="0" max="100" step="0.1" aria-label="Tiến trình">
          <span id="duration">0:00</span>
        </div>
      </div>

      <div class="player-options">
        <div class="player-option">
          <i class="fas fa-gauge-high"></i>
          <select id="speed-control" aria-label="Tốc độ phát">
            <option value="0.5">0.5x</option><option value="0.75">0.75x</option>
            <option value="1" selected>1x</option><option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option><option value="2">2x</option>
          </select>
        </div>
        <div class="player-option player-volume">
          <i class="fas fa-volume-high"></i>
          <input id="volume-control" type="range" min="0" max="100" value="100" aria-label="Âm lượng">
        </div>
        <button id="like-btn" onclick="toggleCurrentSongLike()" aria-label="Yêu thích">
          <i class="fas fa-heart"></i>
        </button>
        
        <button id="visualizer-btn" onclick="toggleMelodyVisualizer()" aria-label="Visualizer" title="Visualizer">
          <i class="fas fa-wave-square"></i>
        </button>

<button onclick="toggleQueuePanel()" aria-label="Hàng đợi">
          <i class="fas fa-list"></i>
        </button>
      </div>
    </div>

    <div id="youtube-player" style="width:1px;height:1px;opacity:0;position:absolute;pointer-events:none;"></div>
    <div id="queue-panel" class="hidden fixed bottom-[130px] right-5 w-[320px] bg-zinc-900 rounded-2xl border border-zinc-700 shadow-2xl p-4 z-[9999]">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2 font-semibold"><i class="fas fa-list text-emerald-400"></i> Playlists</div>
        <button onclick="toggleQueuePanel()"><i class="fas fa-xmark"></i></button>
      </div>
      <div id="queue-list" class="space-y-2 max-h-[300px] overflow-y-auto">
        <div class="text-center text-zinc-500 py-6">Hàng đợi trống</div>
      </div>
    </div>
    <div id="next-popup" class="hidden fixed bottom-40 right-5 w-80 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700 rounded-2xl p-4 z-[99999] shadow-2xl">
      <div class="text-sm text-zinc-400 mb-2">Tiếp theo</div>
      <div class="flex gap-3 items-center">
        <img id="next-popup-cover" class="w-14 h-14 rounded-full object-cover record-spin paused border-2 border-zinc-700">
        <div class="flex-1 min-w-0">
          <div id="next-popup-title" class="font-medium truncate"></div>
          <div id="next-popup-artist" class="text-sm text-zinc-500 truncate"></div>
        </div>
      </div>
      <div class="flex gap-2 mt-4">
        <button onclick="playNextNow()" class="flex-1 bg-emerald-500 hover:bg-emerald-400 rounded-xl py-2">Phát ngay</button>
        <button onclick="hideNextPopup()" class="px-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl">Đóng</button>
      </div>
    </div>
    `;
    document.getElementById('player').innerHTML = playerHTML;

    setTimeout(() => {
        const progress = document.getElementById('progress');
        progress.addEventListener('input', () => {
            const val = parseFloat(progress.value) || 0;
            if (audio?.duration) audio.currentTime = val;
            if (youtubePlayer?.seekTo) youtubePlayer.seekTo(val, true);

            if (window.currentRoom && window.isRoomDJ) {
                socket.emit("player:play", {
                    roomCode: window.currentRoom.code,
                    song: window.songs[currentSongIndex],
                    currentTime: val,
                    playbackRate: parseFloat(document.getElementById('speed-control')?.value) || 1,
                    isResume: true,
                    sentAt: Date.now()
                });
            }
        });

        const volumeControl = document.getElementById('volume-control');
        volumeControl.addEventListener('input', () => {
            const v = volumeControl.value / 100;
            if (audio) audio.volume = v;
            if (youtubePlayer?.setVolume) youtubePlayer.setVolume(volumeControl.value);
        });

        const speedControl = document.getElementById('speed-control');
        speedControl.addEventListener('change', () => {
            const speed = parseFloat(speedControl.value) || 1;
            if (audio) audio.playbackRate = speed;
            if (youtubePlayer?.setPlaybackRate) youtubePlayer.setPlaybackRate(speed);

            if (window.currentRoom && window.isRoomDJ) {
                socket.emit("player:play", {
                    roomCode: window.currentRoom.code,
                    song: window.songs[currentSongIndex],
                    currentTime: audio ? audio.currentTime : (youtubePlayer?.getCurrentTime() || 0),
                    playbackRate: speed,
                    isResume: true,
                    sentAt: Date.now()
                });
            }
        });

        updatePlayerVisibility();
    }, 100);
}
// ====================== PLAY SONG ======================
function playSong(index, startTime = 0, isResume = false) {
    const song = window.songs[index];
    if (!song) return;

    currentSongIndex = index;
    renderQueue();

    document.getElementById('next-popup')?.classList.add('hidden');
    nextPopupShown = false;
    nextPopupLocked = false;

    const nowCover = document.getElementById('now-cover');
    if (nowCover) nowCover.src = song.cover;
    document.getElementById('now-title').textContent = song.title;
    document.getElementById('now-artist').textContent = song.artist;

    const isYoutube = song.src.includes("youtube.com") || song.src.includes("youtu.be");

    if (isYoutube) {
        playYouTube(song.src, startTime, isResume);
    } else {
        playMP3(song.src, startTime, isResume);
    }
}

async function playMP3(src, startTime = 0, isResume = false) {
    clearInterval(window.youtubeProgressInterval);

    try {
        if (youtubePlayer && typeof youtubePlayer.stopVideo === 'function') {
            youtubePlayer.stopVideo();
        }
    } catch (e) { console.log(e); }

    try {
        if (!isResume || audio.src !== src) {
            if (audio && !audio.paused) {
                audio.pause();
            }
            audio.src = src;
            audio.load();
            audio.currentTime = startTime;
        } else {
            if (Math.abs(audio.currentTime - startTime) > 2) {
                audio.currentTime = startTime;
            }
        }

        const speed = parseFloat(document.getElementById('speed-control')?.value) || 1;
        audio.playbackRate = speed;

        await audio.play();
        isPlaying = true;
        window.melodyAIPlaybackChanged?.(true);

        const btn = document.getElementById('play-btn');
        if (btn) btn.innerHTML = `<i class="fas fa-pause"></i>`;

        document.getElementById('now-cover')?.classList.remove('paused');
        document.getElementById('next-popup-cover')?.classList.remove('paused');

    } catch (err) {
        console.log("PLAY MP3 ERROR:", err);
    }
}

function playYouTube(url, startTime = 0, isResume = false) {
    if (audio) audio.pause();
    const videoId = extractYouTubeId(url);
    if (!videoId) return alert("Link YouTube không hợp lệ");

    clearInterval(window.youtubeProgressInterval);

    const speed = parseFloat(document.getElementById('speed-control')?.value) || 1;

    if (!youtubePlayer) {
        youtubePlayer = new YT.Player('youtube-player', {
            height: '1',
            width: '1',
            videoId: videoId,
            host: 'https://www.youtube.com',
            playerVars: {
                autoplay: 1,
                playsinline: 1,
                enablejsapi: 1,
                start: Math.floor(startTime) 
            },
            events: {
                onReady: (e) => {
                    e.target.setPlaybackRate(speed);
                    e.target.playVideo();
                    if (startTime > 0) e.target.seekTo(startTime, true);
                },
                onStateChange: (e) => {
                    if (e.data === YT.PlayerState.ENDED) handleSongEnded();
                }
            }
        });
    } else {
        if (isResume) {
            youtubePlayer.playVideo();
            setTimeout(() => {
                try {
                    youtubePlayer.setPlaybackRate(speed);
                    const curr = youtubePlayer.getCurrentTime();
                    if (Math.abs(curr - startTime) > 2) {
                        youtubePlayer.seekTo(startTime, true);
                    }
                } catch (e) {}
            }, 100);
        } else {
            youtubePlayer.loadVideoById({
                videoId: videoId,
                startSeconds: Math.floor(startTime) 
            });
            setTimeout(() => {
                try { youtubePlayer.setPlaybackRate(speed); } catch(e){}
            }, 150);
            youtubePlayer.playVideo();
        }
    }

    isPlaying = true;
        window.melodyAIPlaybackChanged?.(true);
    document.getElementById('play-btn').innerHTML = `<i class="fas fa-pause"></i>`;
    document.getElementById('now-cover')?.classList.remove('paused');
    document.getElementById('next-popup-cover')?.classList.remove('paused');

    window.youtubeProgressInterval = setInterval(updateProgress, 500);
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

function pausePlayback() {
  if (window.currentRoom && !window.isRoomDJ) return false;
  const wasPlaying = isPlaying;
  try { audio?.pause(); } catch (_) {}
  try { youtubePlayer?.pauseVideo?.(); } catch (_) {}
  isPlaying = false;
  window.isMusicPlaying = false;
  window.melodyAIPlaybackChanged?.(false);
  const playBtn = document.getElementById('play-btn');
  if (playBtn) playBtn.innerHTML = '<i class="fas fa-play"></i>';
  document.getElementById('now-cover')?.classList.add('paused');
  document.getElementById('next-popup-cover')?.classList.add('paused');
  if (window.currentRoom && window.isRoomDJ) {
    let currentTrackTime = 0;
    if (audio && !isNaN(audio.currentTime)) currentTrackTime = audio.currentTime;
    else if (youtubePlayer?.getCurrentTime) {
      try { currentTrackTime = youtubePlayer.getCurrentTime(); } catch (_) {}
    }
    socket.emit('player:pause', {
      roomCode: window.currentRoom.code,
      currentTime: currentTrackTime
    });
  }
  return wasPlaying;
}

function togglePlay() {
  let currentTrackTime = 0;
  if (audio && !isNaN(audio.currentTime)) {
    currentTrackTime = audio.currentTime;
  } else if (youtubePlayer && typeof youtubePlayer.getCurrentTime === 'function') {
    currentTrackTime = youtubePlayer.getCurrentTime();
  }

  if (window.currentRoom && !window.isRoomDJ) {
     alert("Bạn không phải DJ, không có quyền điều khiển nhạc!");
     return; 
  }

  const playBtn = document.getElementById('play-btn');
  const speed = parseFloat(document.getElementById('speed-control')?.value) || 1;

  if (isPlaying) {
    if (audio) audio.pause();
    if (youtubePlayer?.pauseVideo) youtubePlayer.pauseVideo();
    
    isPlaying = false;
    window.melodyAIPlaybackChanged?.(false);
    if (playBtn) playBtn.innerHTML = `<i class="fas fa-play"></i>`;
    document.getElementById('now-cover')?.classList.add('paused');

    if (window.currentRoom && window.isRoomDJ) {
      socket.emit('player:pause', {
        roomCode: window.currentRoom.code,
        currentTime: currentTrackTime
      });
    }
  } else {
    if (audio) {
        audio.playbackRate = speed;
        audio.play().catch(e => console.log(e));
    }
    if (youtubePlayer?.playVideo) {
        youtubePlayer.playVideo();
        try { youtubePlayer.setPlaybackRate(speed); } catch(e){}
    }
    
    isPlaying = true;
        window.melodyAIPlaybackChanged?.(true);
    if (playBtn) playBtn.innerHTML = `<i class="fas fa-pause"></i>`;
    document.getElementById('now-cover')?.classList.remove('paused');

    if (window.currentRoom && window.isRoomDJ) {
      socket.emit('player:play', {
        roomCode: window.currentRoom.code,
        song: window.songs[currentSongIndex], 
        currentTime: currentTrackTime,
        playbackRate: speed,
        isResume: true, 
        sentAt: Date.now()
      });
    }
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
        } catch (e) { }
    }
    updateLyrics();
    
    let remain = 0;
    if (audio && audio.duration) {
        remain = audio.duration - audio.currentTime;
    }
    if (youtubePlayer && typeof youtubePlayer.getDuration === 'function') {
        try { remain = youtubePlayer.getDuration() - youtubePlayer.getCurrentTime(); } catch (e) { }
    }

    if (remain <= 15 && remain > 0 && !nextPopupShown && !nextPopupLocked) {
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
        try { current = youtubePlayer.getCurrentTime(); } catch (e) { }
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

function handleSongEnded() {
    window.isMusicPlaying = false; // Melody AI sync
    window.melodyAIPlaybackChanged?.(false);
    if (window.currentRoom) {
        if (window.isRoomDJ) {
            nextSong();
        }
    } else {
        nextSong();
    }
}

function nextSong() {
    let nextIdx = currentSongIndex + 1;

    if (nextIdx >= window.songs.length) {
        nextIdx = 0;
    }

    // =========================================================
    // LISTENING ROOM
    // Chỉ DJ mới được chuyển bài
    // =========================================================

    if (window.currentRoom && window.isRoomDJ) {

        playSong(nextIdx);

        socket.emit('player:play', {
            roomCode: window.currentRoom.code,
            song: window.songs[nextIdx],
            currentTime: 0,
            playbackRate:
                parseFloat(
                    document.getElementById('speed-control')?.value
                ) || 1,
            sentAt: Date.now()
        });

        return;
    }


    // =========================================================
    // AI DJ / QUEUE
    // =========================================================

    if (playQueue.length > 0) {

        const currentSong =
            window.songs[currentSongIndex];

        if (currentSong) {

            const qIdx =
                playQueue.findIndex(
                    song =>
                        Number(song.id) ===
                        Number(currentSong.id)
                );

            // Bài vừa phát xong → xóa khỏi queue
            if (qIdx !== -1) {

                playQueue.splice(qIdx, 1);

                // Cập nhật vị trí queue
                if (playQueue.length === 0) {

                    currentQueueIndex = -1;

                } else if (
                    currentQueueIndex > qIdx
                ) {

                    currentQueueIndex--;

                } else if (
                    currentQueueIndex >=
                    playQueue.length
                ) {

                    currentQueueIndex =
                        playQueue.length - 1;
                }
            }
        }


        // =====================================================
        // RENDER QUEUE CHÍNH
        // =====================================================

        renderQueue();


        // =====================================================
        // RENDER AI PLAYLIST
        // =====================================================

        if (
            typeof window.renderMelodyAIQueue ===
            'function'
        ) {
            window.renderMelodyAIQueue();
        }


        // =====================================================
        // CÒN BÀI TRONG QUEUE
        // → PHÁT BÀI TIẾP THEO
        // =====================================================

        if (playQueue.length > 0) {

            const nextQueueSong =
                playQueue[0];

            const nextIndex =
                window.songs.findIndex(
                    song =>
                        Number(song.id) ===
                        Number(nextQueueSong.id)
                );

            if (nextIndex !== -1) {

                playSong(nextIndex);

                return;
            }
        }
    }


    // =========================================================
    // QUEUE HẾT
    // → QUAY LẠI CƠ CHẾ PHÁT NHẠC BÌNH THƯỜNG
    // =========================================================

    playSong(nextIdx);
}

function prevSong() {
    let prevIdx = (currentSongIndex - 1 + window.songs.length) % window.songs.length;

    if (window.currentRoom && window.isRoomDJ) {
        playSong(prevIdx);
        socket.emit('player:play', {
            roomCode: window.currentRoom.code,
            song: window.songs[prevIdx],
            currentTime: 0,
            playbackRate: parseFloat(document.getElementById('speed-control')?.value) || 1,
            sentAt: Date.now()
        });
        return;
    }

    if (playQueue.length > 0 && currentQueueIndex > 0) {
        currentQueueIndex--;
        const qPrevIdx = window.songs.findIndex(s => s.id === playQueue[currentQueueIndex].id);
        if (qPrevIdx !== -1) {
            playSong(qPrevIdx);
            return;
        }
    }

    currentQueueIndex = -1;
    playSong(prevIdx);
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

    if (playQueue.find(s => s.id === song.id)) {
        return alert('Đã có trong hàng đợi');
    }

    playQueue.push(song);
    if (currentQueueIndex === -1) currentQueueIndex = 0;
    renderQueue();
}

function removeQueue(index) {
    if (index < 0 || index >= playQueue.length) return;

    const removed = playQueue[index];

    const wasCurrent =
        Number(removed?.id) ===
        Number(window.songs?.[currentSongIndex]?.id);

    // Xóa bài khỏi queue
    playQueue.splice(index, 1);

    // Cập nhật vị trí queue hiện tại
    if (playQueue.length === 0) {
        currentQueueIndex = -1;
    } else if (currentQueueIndex > index) {
        currentQueueIndex--;
    } else if (currentQueueIndex >= playQueue.length) {
        currentQueueIndex = playQueue.length - 1;
    }

    // Render queue chính
    renderQueue();

    // Render lại danh sách AI
    if (typeof window.renderMelodyAIQueue === 'function') {
        window.renderMelodyAIQueue();
    }

    // Nếu xóa đúng bài đang phát
    // thì chuyển sang bài tiếp theo
    if (wasCurrent && !window.currentRoom) {
        nextSong();
    }
}

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

function clearQueue() {
    playQueue = [];
    currentQueueIndex = -1;

    renderQueue();

    if (typeof window.renderMelodyAIQueue === 'function') {
        window.renderMelodyAIQueue();
    }
}
// =========================================================
// AI DJ QUEUE
// =========================================================

// ============================================================
// AI DJ QUEUE
// ============================================================

// AI dùng chung playQueue thật của player.
// AI playlist mới -> thay queue + phát bài đầu.
// AI append -> thêm cuối queue, KHÔNG đổi bài đang phát.

function setAIQueue(songs, autoPlay = true) {

    if (
        !Array.isArray(songs) ||
        songs.length === 0
    ) {
        return false;
    }

    // Không cho AI điều khiển Listening Room
    if (window.currentRoom) {

        alert(
            'AI DJ hiện không điều khiển nhạc trong Listening Room.'
        );

        return false;
    }


    // --------------------------------------------------------
    // LOẠI BÀI TRÙNG
    // --------------------------------------------------------

    const seen = new Set();

    const uniqueSongs =
        songs.filter(song => {

            const id =
                Number(song?.id);

            if (
                !Number.isFinite(id) ||
                seen.has(id)
            ) {
                return false;
            }

            seen.add(id);

            return true;
        });


    if (
        uniqueSongs.length === 0
    ) {
        return false;
    }


    // --------------------------------------------------------
    // ĐẢM BẢO SONG TỒN TẠI TRONG window.songs
    // --------------------------------------------------------

    uniqueSongs.forEach(song => {

        const exists =
            window.songs.some(
                s =>
                    Number(s.id) ===
                    Number(song.id)
            );

        if (!exists) {

            window.songs.push(song);

        }

    });


    // --------------------------------------------------------
    // REPLACE QUEUE
    // --------------------------------------------------------

    playQueue =
        [...uniqueSongs];


    currentQueueIndex = 0;


    nextPopupShown = false;
    nextPopupLocked = false;


    document
        .getElementById('next-popup')
        ?.classList.add('hidden');


    renderQueue();


    if (
        typeof window.renderMelodyAIQueue ===
        'function'
    ) {

        window.renderMelodyAIQueue();

    }


    // --------------------------------------------------------
    // KHÔNG AUTO PLAY
    // --------------------------------------------------------

    if (!autoPlay) {

        return true;

    }


    // --------------------------------------------------------
    // PHÁT BÀI ĐẦU
    // --------------------------------------------------------

    const firstIndex =
        window.songs.findIndex(
            song =>
                Number(song.id) ===
                Number(uniqueSongs[0].id)
        );


    if (
        firstIndex === -1
    ) {

        return false;

    }


    playSong(
        firstIndex,
        0,
        false
    );


    return true;

}


// ============================================================
// AI APPEND
// ============================================================

// Thêm bài vào CUỐI queue hiện tại.
//
// QUAN TRỌNG:
// - Không xóa queue cũ.
// - Không gọi playSong().
// - Không pause audio.
// - Không đổi currentSongIndex.
// - Không làm gián đoạn bài đang phát.

function appendAIQueue(songs) {

    if (
        !Array.isArray(songs) ||
        songs.length === 0
    ) {

        return false;

    }


    // Không dùng AI DJ trong Listening Room
    if (window.currentRoom) {

        return false;

    }


    // --------------------------------------------------------
    // LẤY ID CÁC BÀI ĐÃ CÓ TRONG QUEUE
    // --------------------------------------------------------

    const existingIds =
        new Set(
            playQueue.map(
                song =>
                    Number(song.id)
            )
        );


    // --------------------------------------------------------
    // CHỈ LẤY BÀI CHƯA CÓ
    // --------------------------------------------------------

    const additions =
        songs.filter(song => {

            const id =
                Number(song?.id);


            if (
                !Number.isFinite(id)
            ) {

                return false;

            }


            if (
                existingIds.has(id)
            ) {

                return false;

            }


            existingIds.add(id);

            return true;

        });


    if (
        additions.length === 0
    ) {

        return false;

    }


    // --------------------------------------------------------
    // THÊM VÀO window.songs + playQueue
    // --------------------------------------------------------

    additions.forEach(song => {

        const exists =
            window.songs.some(
                s =>
                    Number(s.id) ===
                    Number(song.id)
            );


        if (!exists) {

            window.songs.push(song);

        }


        // CHỈ PUSH
        // KHÔNG playSong()
        // KHÔNG load audio
        // KHÔNG đổi bài hiện tại

        playQueue.push(song);

    });


    // --------------------------------------------------------
    // GIỮ NGUYÊN BÀI ĐANG PHÁT
    // --------------------------------------------------------

    // Nếu trước đó queue rỗng
    // thì mới đặt currentQueueIndex.

    if (
        currentQueueIndex === -1 &&
        playQueue.length > 0
    ) {

        currentQueueIndex = 0;

    }


    // --------------------------------------------------------
    // RENDER
    // --------------------------------------------------------

    renderQueue();


    if (
        typeof window.renderMelodyAIQueue ===
        'function'
    ) {

        window.renderMelodyAIQueue();

    }


    console.log(
        '➕ AI APPEND:',
        additions.map(
            song => ({
                id: song.id,
                title: song.title,
                artist: song.artist
            })
        )
    );


    console.log(
        '🎵 QUEUE AFTER APPEND:',
        playQueue.map(
            song => ({
                id: song.id,
                title: song.title,
                artist: song.artist
            })
        )
    );


    return true;

}


// ============================================================
// EXPOSE AI QUEUE FUNCTIONS
// ============================================================

window.setAIQueue =
    setAIQueue;


window.appendAIQueue =
    appendAIQueue;


window.getCurrentPlayQueue = function () {
    return [...playQueue];
};

window.pausePlayback = pausePlayback;

window.getMelodyPlayerState = () => ({
    isPlaying,
    currentSongIndex,
    song: window.songs?.[currentSongIndex] || null,
    queueLength: playQueue.length,
    volume: Number(document.getElementById('volume-control')?.value ?? 100),
    speed: Number(document.getElementById('speed-control')?.value ?? 1)
});
function renderQueue() {
    const queue = document.getElementById('queue-list');
    if (!queue) return;
    if (playQueue.length === 0) {
        queue.innerHTML = `<div class="text-zinc-500 text-center py-5">Hàng đợi trống</div>`;
        return;
    }
    queue.innerHTML = `<button onclick="clearQueue()" class="w-full mb-3 bg-red-500 rounded-lg py-2 text-sm">Xóa tất cả</button>` +
        playQueue.map((song, index) => `
        <div class="flex gap-3 items-center bg-zinc-800 rounded-xl p-2">
            <img src="${song.cover}" class="w-12 h-12 rounded-lg object-cover">
            <div class="flex-1 min-w-0">
                <div class="truncate text-sm">${song.title}</div>
                <div class="truncate text-xs text-zinc-500">${song.artist}</div>
            </div>
            <button onclick="const idx = window.songs.findIndex(s=>s.id===${song.id}); if(idx!==-1) playSong(idx);" class="text-emerald-400">▶</button>
            <button onclick="moveQueueUp(${index})" class="text-blue-400">↑</button>
            <button onclick="moveQueueDown(${index})" class="text-yellow-400">↓</button>
            <button onclick="removeQueue(${index})" class="text-red-500">×</button>
        </div>`).join('');
}

function showNextPopup() {
    if (nextPopupShown) return;

    let nextSongData = null;
    if (playQueue.length > 0) {
        nextSongData = playQueue[0];
    } else {
        let nextIndex = currentSongIndex + 1;
        if (nextIndex >= window.songs.length) nextIndex = 0;
        nextSongData = window.songs[nextIndex];
    }

    if (!nextSongData) return;

    document.getElementById('next-popup-cover').src = nextSongData.cover;
    document.getElementById('next-popup-title').textContent = nextSongData.title;
    document.getElementById('next-popup-artist').textContent = nextSongData.artist;
    document.getElementById('next-popup')?.classList.remove('hidden');

    nextPopupShown = true;
}

function hideNextPopup() {
    document.getElementById('next-popup').classList.add('hidden');
    nextPopupShown = false;
    nextPopupLocked = true;
}

function playNextNow() {
    hideNextPopup();
    nextSong();
}

function playSongFromQueue(index) {
    const song = playQueue[index];
    if (!song) return;

    currentQueueIndex = index;
    const realIndex = window.songs.findIndex(s => s.id === song.id);
    if (realIndex !== -1) playSong(realIndex);
}

// ====================== LISTEN TO SOCKET SYNC ======================
socket.on('player:pause', ({ currentTime }) => {
    if (window.currentRoom && window.isRoomDJ) return; 

    isPlaying = false;
    window.melodyAIPlaybackChanged?.(false);
    
    const btn = document.getElementById('play-btn');
    if (btn) btn.innerHTML = `<i class="fas fa-play"></i>`;
    
    const nowCover = document.getElementById('now-cover');
    if (nowCover) nowCover.classList.add('paused');

    const parsedTime = parseFloat(currentTime);
    const safeTime = (isNaN(parsedTime) || parsedTime < 0) ? 0 : parsedTime;

    if (youtubePlayer && typeof youtubePlayer.pauseVideo === 'function') {
        try {
            youtubePlayer.pauseVideo();
            setTimeout(() => {
                if (typeof youtubePlayer.seekTo === 'function') {
                    youtubePlayer.seekTo(safeTime, false); // false để khóa buffer dừng hẳn
                }
            }, 50);
        } catch (e) { console.log(e); }
    } else if (audio) {
        try {
            audio.pause();
            audio.currentTime = safeTime;
        } catch (e) { console.log(e); }
    }
});

socket.on('player:play', (data) => {
    if (!data || !data.song || !window.songs) return;
    if (window.currentRoom && window.isRoomDJ) return; 

    const idx = window.songs.findIndex(s => s.id === data.song.id);
    if (idx === -1) return;

    // 1. Đồng bộ giao diện Text & Image cho Member trước
    const nowCover = document.getElementById('now-cover');
    const nowTitle = document.getElementById('now-title');
    const nowArtist = document.getElementById('now-artist');

    if (nowCover) nowCover.src = data.song.cover || "https://picsum.photos/id/1015/300/300";
    if (nowTitle) nowTitle.textContent = data.song.title || "Chưa phát bài nào";
    if (nowArtist) nowArtist.textContent = data.song.artist || "MelodyVN";

    // 2. Đồng bộ trạng thái nút bấm
    isPlaying = true;
        window.melodyAIPlaybackChanged?.(true);
    const btn = document.getElementById('play-btn');
    if (btn) btn.innerHTML = `<i class="fas fa-pause"></i>`;
    if (nowCover) nowCover.classList.remove('paused');

    // 3. Tính toán thời gian thực tế kèm độ trễ mạng
    const rawTime = parseFloat(data.currentTime);
    const djTime = isNaN(rawTime) ? 0 : rawTime;
    const latency = data.sentAt ? (Date.now() - data.sentAt) / 1000 : 0;
    const safeLatency = (latency > 0 && latency < 4) ? latency : 0;
    const calculatedTime = djTime + safeLatency;

    // 4. Đồng bộ tốc độ phát
    const targetSpeed = parseFloat(data.playbackRate) || 1;
    const speedControl = document.getElementById('speed-control');
    if (speedControl) speedControl.value = targetSpeed.toString();

    const srcLower = (data.song.src || "").toLowerCase();
    const isYouTube = srcLower.includes("youtube.com") || srcLower.includes("youtu.be");

    // KIỂM TRA XEM CÓ THẬT SỰ LÀ ĐỔI BÀI MỚI KHÔNG
    const isSameSong = (idx === currentSongIndex);
    currentSongIndex = idx; // Cập nhật vị trí bài hát chạy ngầm

    if (isYouTube) {
        // --- XỬ LÝ ĐỒNG BỘ YOUTUBE ---
        if (!youtubePlayer || typeof youtubePlayer.loadVideoById !== 'function') {
            // Nếu chưa có trình phát YouTube, bắt buộc phải khởi tạo lần đầu thông qua playSong
            playSong(idx, calculatedTime, false);
        } else {
            const currentVideoId = youtubePlayer.getVideoData ? youtubePlayer.getVideoData().video_id : "";
            const newVideoId = extractYouTubeId(data.song.src);

            if (currentVideoId === newVideoId) {
                // Bài cũ đang chạy dở -> Chỉ play và seek, CẤM gọi loadVideoById
                youtubePlayer.playVideo();
                setTimeout(() => {
                    try {
                        youtubePlayer.setPlaybackRate(targetSpeed);
                        if (Math.abs(youtubePlayer.getCurrentTime() - calculatedTime) > 2 || data.isResume) {
                            youtubePlayer.seekTo(calculatedTime, true);
                        }
                    } catch (e) {}
                }, 100);
            } else {
                // Đổi bài mới hoàn toàn -> Load video mới
                playSong(idx, calculatedTime, false);
            }
        }
    } else {
        // --- XỬ LÝ ĐỒNG BỘ MP3 (HTML5 AUDIO) ---
        // Chuẩn hóa URL để so sánh chính xác (tránh lệch dấu gạch chéo hoặc giao thức http/https)
        const tempLink = document.createElement('a');
        tempLink.href = data.song.src;
        const targetSrc = tempLink.href;
        
        const currentSrc = audio ? audio.src : "";

        if (currentSrc === targetSrc && audio.src !== "") {
            // ĐÚNG BÀI CŨ ĐANG PHÁT -> Chỉ bật chạy và gán timeline trực tiếp, KHÔNG nạp lại src
            audio.playbackRate = targetSpeed;
            audio.play().then(() => {
                if (Math.abs(audio.currentTime - calculatedTime) > 2 || data.isResume) {
                    audio.currentTime = calculatedTime;
                }
            }).catch(e => {
                // Phòng hờ bị trình duyệt chặn autoplay
                audio.currentTime = calculatedTime;
            });
        } else {
            // BÀI MỚI HOÀN TOÀN -> Lúc này mới được phép dùng playSong để thay đổi nguồn cội src
            playSong(idx, calculatedTime, false);
        }
    }
});

function updatePlayerVisibility() {
    const controlButtons = document.querySelector('.flex-1.flex.flex-col.items-center.justify-center .text-2xl');
    const progressBar = document.querySelector('.w-full.max-w-md.flex.items-center.gap-3');

    if (window.currentRoom && !window.isRoomDJ) {
        if (controlButtons) controlButtons.style.visibility = "hidden";
        if (progressBar) progressBar.style.pointerEvents = "none"; 
    } else {
        if (controlButtons) controlButtons.style.visibility = "visible";
        if (progressBar) progressBar.style.pointerEvents = "auto";
    }
}

// EXPORTS
Object.assign(window, {

    initPlayer,

    initPlayerUI,

    playSong,

    togglePlay,

    nextSong,

    prevSong,

    toggleQueuePanel,

    addToQueue,

    removeQueue,

    moveQueueUp,

    moveQueueDown,

    clearQueue,

    renderQueue,

    hideNextPopup,

    playNextNow,

    playSongFromQueue,

    updatePlayerVisibility,

    // AI DJ
    setAIQueue,

    appendAIQueue,

    getCurrentPlayQueue

});