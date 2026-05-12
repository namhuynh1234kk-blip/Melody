// js/data.js
let songs = [];

function loadSongs() {
  const saved = localStorage.getItem('myPlaylist');
  if (saved) songs = JSON.parse(saved);
  window.songs = songs;
}

function saveSongs() {
  localStorage.setItem('myPlaylist', JSON.stringify(songs));
  window.songs = songs;
}

function addSong(title, artist, cover, src) {
const isYoutube =
  src.includes("youtube.com") ||
  src.includes("youtu.be") ||
  src.includes("music.youtube.com") ||
  src.includes("m.youtube.com");
  const newSong = {
    id: Date.now(),
    title,
    artist,
    cover: cover || "https://picsum.photos/id/237/300/300",
    src,
    type: isYoutube ? "youtube" : "mp3"
  };
  songs.unshift(newSong);
  saveSongs();
  alert(`✅ Đã thêm: ${title}`);
}

loadSongs();