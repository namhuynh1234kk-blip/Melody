// js/player.js

let audio = null;
let youtubePlayer = null;
let currentSongIndex = 0;
let isPlaying = false;

// ====================== INIT ======================

function initPlayer() {

  audio = new Audio();

  audio.volume = 1;

  audio.addEventListener('timeupdate', updateProgress);

  audio.addEventListener('ended', nextSong);

  audio.addEventListener('error', () => {

    alert("Không phát được file MP3 này");

  });

}

// ====================== PLAYER UI ======================

function initPlayerUI() {

  const playerHTML = `

  <div class="
      w-full
      h-full
      flex flex-col md:flex-row
      items-center
      justify-between
      gap-2 md:gap-6">

    <!-- LEFT -->
    <div class="
        flex items-center gap-3
        w-full md:w-72
        min-w-0">

      <img id="now-cover"
           src="https://picsum.photos/200"
           class="
             w-14 h-14
             rounded-xl
             object-cover
             shrink-0">

      <div class="min-w-0 flex-1">

        <div id="now-title"
             class="
               text-sm md:text-base
               font-semibold
               truncate">

          Chưa phát bài nào

        </div>

        <div id="now-artist"
             class="
               text-xs md:text-sm
               text-zinc-400
               truncate">

          MelodyVN

        </div>

      </div>

    </div>

    <!-- CENTER -->
    <div class="
        flex-1
        w-full
        flex flex-col
        items-center">

      <!-- CONTROLS -->
      <div class="
          flex items-center justify-center
          gap-8 md:gap-10
          text-2xl md:text-3xl">

        <button onclick="prevSong()"
                class="
                  hover:text-emerald-400
                  transition">

          <i class="fas fa-backward"></i>

        </button>

        <button id="play-btn"
                onclick="togglePlay()"
                class="
                  w-14 h-14
                  rounded-full
                  bg-white text-black
                  flex items-center justify-center
                  text-2xl
                  hover:scale-105
                  transition">

          <i class="fas fa-play"></i>

        </button>

        <button onclick="nextSong()"
                class="
                  hover:text-emerald-400
                  transition">

          <i class="fas fa-forward"></i>

        </button>

      </div>

      <!-- PROGRESS -->
      <div class="
          w-full
          flex items-center
          gap-2
          mt-2
          text-xs">

        <span id="current-time"
              class="w-10 text-center">

          0:00

        </span>

        <input type="range"
               id="progress"
               min="0"
               max="100"
               value="0"
               class="
                 flex-1
                 accent-emerald-500">

        <span id="duration"
              class="w-10 text-center">

          0:00

        </span>

      </div>

    </div>

    <!-- RIGHT -->
    <div class="
        flex items-center justify-end
        gap-3
        w-full md:w-72">

      <!-- SPEED -->
      <select id="speed-control"
              class="
                bg-zinc-800
                rounded-lg
                px-2 py-1
                text-sm
                outline-none">

        <option value="0.5">0.5x</option>
        <option value="0.75">0.75x</option>
        <option value="1" selected>1x</option>
        <option value="1.25">1.25x</option>
        <option value="1.5">1.5x</option>
        <option value="2">2x</option>

      </select>

      <!-- VOLUME -->
      <div class="
          flex items-center gap-2
          flex-1 md:flex-none">

        <i class="fas fa-volume-high text-zinc-400"></i>

        <input type="range"
               id="volume-control"
               min="0"
               max="100"
               value="100"
               class="
                 flex-1 md:w-28
                 accent-emerald-500">

      </div>

      <!-- LIKE -->
      <button id="player-like-btn"
              class="
                text-3xl
                text-zinc-400
                hover:text-red-500
                transition">

        <i class="fas fa-heart"></i>

      </button>

    </div>

  </div>

  `;

  document.getElementById('player').innerHTML = playerHTML;



  setTimeout(() => {

    // ================= SEEK =================

    const progress =
      document.getElementById('progress');

    progress.addEventListener('input', () => {

      // MP3
      if (audio && audio.duration) {

        audio.currentTime =
          progress.value;

      }

      // YOUTUBE
      if (youtubePlayer &&
          typeof youtubePlayer.seekTo === 'function') {

        youtubePlayer.seekTo(
          progress.value,
          true
        );

      }

    });

    // ================= VOLUME =================

    const volumeControl =
      document.getElementById('volume-control');

    volumeControl.addEventListener('input', () => {

      const volume =
        volumeControl.value / 100;

      // MP3
      audio.volume = volume;

      // YOUTUBE
      if (youtubePlayer &&
          typeof youtubePlayer.setVolume === 'function') {

        youtubePlayer.setVolume(
          volumeControl.value
        );

      }

    });

    // ================= SPEED =================

    const speedControl =
      document.getElementById('speed-control');

    speedControl.addEventListener('change', () => {

      const speed =
        parseFloat(speedControl.value);

      // MP3
      audio.playbackRate = speed;

      // YOUTUBE
      if (youtubePlayer &&
          typeof youtubePlayer.setPlaybackRate === 'function') {

        youtubePlayer.setPlaybackRate(speed);

      }

    });

  }, 100);

}

// ====================== PLAY SONG ======================

function playSong(index) {

  const song = window.songs[index];

  if (!song) return;

  increasePlayCount(song.id);

  currentSongIndex = index;

  // ================= UI =================

  document.getElementById('now-cover').src =
    song.cover;

  document.getElementById('now-title').textContent =
    song.title;

  document.getElementById('now-artist').textContent =
    song.artist;

  // update like icon
  const likeBtn =
    document.getElementById('like-btn');

  if (likeBtn) {

    likeBtn.innerHTML = `
      <i class="fas fa-heart ${
        song.liked ? 'text-red-500' : ''
      }"></i>
    `;

  }

  // ================= DETECT =================

  const isYoutube =

    song.src.includes("youtube.com") ||
    song.src.includes("youtu.be") ||
    song.src.includes("music.youtube.com") ||
    song.src.includes("m.youtube.com") ||
    song.src.includes("/shorts/");

  const isTikTok =
  song.src.includes("tiktok.com");  
  // ================= PLAY =================

 if (isYoutube) {

  playYouTube(song.src);

}

else if (isTikTok) {

  playTikTok(song.src);

}

else {

  playMP3(song.src);

}

}


function getTikTokId(url) {

  const match =
    url.match(/video\/(\d+)/);

  return match ? match[1] : null;

}
//==========Play Tiktok============

function playTikTok(url) {

  const videoId =
    getTikTokId(url);

  if (!videoId) {

    alert("Link TikTok không hợp lệ");

    return;

  }

  // pause mp3
  const audio =
    document.getElementById('audio-player');

  if (audio) {

    audio.pause();

  }

  // hiện player
  const player =
    document.getElementById('youtube-player');

  const container =
    document.getElementById('video-container');

  player.classList.remove('hidden');

  container.innerHTML = `
    <iframe
      src="https://www.tiktok.com/embed/v2/${videoId}"
      class="w-full h-full"
      allowfullscreen>
    </iframe>
  `;

}
// ====================== PLAY MP3 ======================

function playMP3(src) {

  clearInterval(window.youtubeProgressInterval);

  // stop youtube
  if (youtubePlayer &&
      typeof youtubePlayer.stopVideo === 'function') {

    youtubePlayer.stopVideo();

  }

  audio.src = src;

  audio.play();

  isPlaying = true;

  document.getElementById('play-btn').innerHTML =
    `<i class="fas fa-pause"></i>`;

}

// ====================== EXTRACT YOUTUBE ID ======================

function extractYouTubeId(url) {

  try {

    const parsedUrl =
      new URL(url);

    // youtu.be
    if (parsedUrl.hostname.includes('youtu.be')) {

      return parsedUrl.pathname.slice(1);

    }

    // shorts
    if (parsedUrl.pathname.includes('/shorts/')) {

      return parsedUrl.pathname
        .split('/shorts/')[1];

    }

    // watch?v=
    if (parsedUrl.searchParams.get('v')) {

      return parsedUrl.searchParams.get('v');

    }

    return null;

  }

  catch (e) {

    return null;

  }

}

// ====================== PLAY YOUTUBE ======================

function playYouTube(url) {

  audio.pause();

  const videoId =
    extractYouTubeId(url);

  if (!videoId) {

    alert("Link YouTube không hợp lệ");

    return;

  }

  clearInterval(window.youtubeProgressInterval);

  // create player
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

        onReady: (event) => {

          event.target.playVideo();

        },

        onStateChange: (event) => {

          // ended
          if (event.data === YT.PlayerState.ENDED) {

            nextSong();

          }

        }

      }

    });

  }

  // existing player
  else {

    youtubePlayer.loadVideoById(videoId);

    youtubePlayer.playVideo();

  }

  isPlaying = true;

  document.getElementById('play-btn').innerHTML =
    `<i class="fas fa-pause"></i>`;

  // realtime progress
  window.youtubeProgressInterval = setInterval(() => {

    updateProgress();

  }, 500);

}

// ====================== TOGGLE PLAY ======================

function togglePlay() {

  // YOUTUBE
  if (youtubePlayer) {

    try {

      const state =
        youtubePlayer.getPlayerState();

      // playing
      if (state === 1) {

        youtubePlayer.pauseVideo();

        isPlaying = false;

        document.getElementById('play-btn').innerHTML =
          `<i class="fas fa-play"></i>`;

      }

      // paused
      else {

        youtubePlayer.playVideo();

        isPlaying = true;

        document.getElementById('play-btn').innerHTML =
          `<i class="fas fa-pause"></i>`;

      }

      return;

    }

    catch (e) {}

  }

  // MP3
  if (!audio.src) return;

  if (audio.paused) {

    audio.play();

    isPlaying = true;

    document.getElementById('play-btn').innerHTML =
      `<i class="fas fa-pause"></i>`;

  }

  else {

    audio.pause();

    isPlaying = false;

    document.getElementById('play-btn').innerHTML =
      `<i class="fas fa-play"></i>`;

  }

}

// ====================== UPDATE PROGRESS ======================

function updateProgress() {

  const progress =
    document.getElementById('progress');

  const currentTime =
    document.getElementById('current-time');

  const duration =
    document.getElementById('duration');

  // ================= MP3 =================

  if (audio &&
      audio.duration &&
      !isNaN(audio.duration)) {

    progress.max =
      audio.duration;

    progress.value =
      audio.currentTime;

    currentTime.textContent =
      formatTime(audio.currentTime);

    duration.textContent =
      formatTime(audio.duration);

  }

  // ================= YOUTUBE =================

  if (youtubePlayer &&
      typeof youtubePlayer.getCurrentTime === 'function') {

    try {

      const current =
        youtubePlayer.getCurrentTime();

      const total =
        youtubePlayer.getDuration();

      if (!isNaN(total) &&
          total > 0) {

        progress.max =
          total;

        progress.value =
          current;

        currentTime.textContent =
          formatTime(current);

        duration.textContent =
          formatTime(total);

      }

    }

    catch (e) {}

  }

  updateLyrics();

}

// ====================== LYRICS ======================

function updateLyrics() {

  const song =
    window.songs[currentSongIndex];

  if (!song ||
      !song.lyrics) return;

  const lyricsBox =
    document.getElementById('lyrics');

  if (!lyricsBox) return;

  let current = 0;

  // mp3
  if (audio &&
      audio.duration) {

    current =
      audio.currentTime;

  }

  // youtube
  if (youtubePlayer &&
      typeof youtubePlayer.getCurrentTime === 'function') {

    try {

      current =
        youtubePlayer.getCurrentTime();

    }

    catch (e) {}

  }

  let html = "";

  song.lyrics.forEach(line => {

    const active =
      current >= line.time;

    html += `

      <div class="
        transition-all duration-300
        ${active
          ? 'text-white text-2xl font-bold'
          : 'text-zinc-500'}
      ">

        ${line.text}

      </div>

    `;

  });

  lyricsBox.innerHTML =
    html;

}

// ====================== FORMAT TIME ======================

function formatTime(seconds) {

  if (!seconds ||
      isNaN(seconds)) {

    return "0:00";

  }

  const mins =
    Math.floor(seconds / 60);

  const secs =
    Math.floor(seconds % 60);

  return `${mins}:${secs
    .toString()
    .padStart(2, '0')}`;

}

// ====================== NEXT ======================

function nextSong() {

  currentSongIndex =
    (currentSongIndex + 1)
    % window.songs.length;

  playSong(currentSongIndex);

}

// ====================== PREV ======================

function prevSong() {

  currentSongIndex =
    (currentSongIndex - 1 + window.songs.length)
    % window.songs.length;

  playSong(currentSongIndex);

}

// ====================== LIKE CURRENT SONG ======================

async function toggleCurrentSongLike() {

  const song =
    window.songs[currentSongIndex];

  if (!song) return;

  try {

    await window.toggleLike(song.id);

    song.liked = !song.liked;

    const likeBtn =
      document.getElementById('like-btn');

    if (likeBtn) {

      likeBtn.innerHTML = `
        <i class="fas fa-heart ${
          song.liked ? 'text-red-500' : ''
        }"></i>
      `;

    }

  }

  catch (err) {

    console.log(err);

  }

}

// ====================== EXPORT ======================

window.playSong = playSong;

window.togglePlay = togglePlay;

window.nextSong = nextSong;

window.prevSong = prevSong;

window.initPlayer = initPlayer;

window.initPlayerUI = initPlayerUI;

window.toggleCurrentSongLike =
  toggleCurrentSongLike;
