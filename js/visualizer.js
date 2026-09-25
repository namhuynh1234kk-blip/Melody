/* =========================================================
   MELODY VISUALIZER
   Realtime canvas visualizer. No AI.
   ========================================================= */
(() => {
  const THEMES = {
    neon:  { label: '🌌 Neon',  bg: '#050816', colors: ['#00f5d4','#00bbf9','#9b5de5'] },
    ocean: { label: '🌊 Ocean', bg: '#03131d', colors: ['#38bdf8','#06b6d4','#2563eb'] },
    night: { label: '🌃 Night', bg: '#070711', colors: ['#c4b5fd','#6366f1','#334155'] },
    sakura:{ label: '🌸 Sakura',bg: '#170a12', colors: ['#fb7185','#f9a8d4','#fda4af'] },
    cyber: { label: '🔥 Cyber', bg: '#100707', colors: ['#f43f5e','#f97316','#facc15'] },
    rain:  { label: '🌧️ Rain',  bg: '#050a12', colors: ['#60a5fa','#93c5fd','#64748b'] }
  };

  let overlay, canvas, ctx, raf = 0, analyser = null, freq = null;
  let theme = localStorage.getItem('melodyVisualizerTheme') || 'neon';
  let isScrubbing = false;
  let scrubValue = 0;

  function getAudio() {
    return window.__melodyAudio || null;
  }

  function formatTime(s) {
    s = Number(s);
    if (!isFinite(s) || s < 0) s = 0;
    return Math.floor(s/60) + ':' + String(Math.floor(s%60)).padStart(2,'0');
  }

  function playback() {
    // Lấy timeline từ player chính, không tự đoán từ Visualizer.
    if (typeof window.getMelodyPlaybackPosition === 'function') {
      const state = window.getMelodyPlaybackPosition();
      if (state && (state.duration > 0 || state.current > 0)) {
        return {
          current: Number(state.current) || 0,
          duration: Number(state.duration) || 0
        };
      }
    }

    const a = getAudio();
    let current = 0, duration = 0;
    if (a && isFinite(a.duration)) {
      current = a.currentTime || 0;
      duration = a.duration || 0;
    } else if (window.__melodyYoutubePlayer?.getCurrentTime) {
      try {
        current = window.__melodyYoutubePlayer.getCurrentTime() || 0;
        duration = window.__melodyYoutubePlayer.getDuration() || 0;
      } catch (_) {}
    }
    return { current, duration };
  }

  function setupAnalyser() {
    const a = getAudio();
    if (!a || analyser || !window.AudioContext && !window.webkitAudioContext) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AC();
      const source = audioContext.createMediaElementSource(a);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;
      source.connect(analyser);
      analyser.connect(audioContext.destination);
      freq = new Uint8Array(analyser.frequencyBinCount);
      window.__melodyAudioContext = audioContext;
      window.__melodyAnalyser = analyser;
    } catch (e) {
      console.warn('Melody Visualizer: realtime analyser unavailable', e);
    }
  }

  function create() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'melody-visualizer';
    overlay.className = 'melody-visualizer hidden';
    overlay.innerHTML = `
      <div class="mv-topbar">
        <div class="mv-song">
          <img id="mv-cover" src="https://picsum.photos/300" alt="">
          <div class="min-w-0">
            <div class="mv-label">NOW VISUALIZING</div>
            <div id="mv-title" class="mv-title">Chưa phát bài nào</div>
            <div id="mv-artist" class="mv-artist">MelodyVN</div>
          </div>
        </div>
        <button class="mv-close" onclick="toggleMelodyVisualizer(false)" aria-label="Đóng">
          <i class="fas fa-xmark"></i>
        </button>
      </div>
      <canvas id="melody-visualizer-canvas"></canvas>
      <div class="mv-center">
        <div id="mv-icon" class="mv-icon"><i class="fas fa-music"></i></div>
        <div id="mv-theme-name" class="mv-theme-name"></div>
      </div>
      <div class="mv-bottom">
        <div class="mv-themes" id="mv-themes"></div>
        <div class="mv-progress">
          <span id="mv-current">0:00</span>
          <input id="mv-progress" type="range" min="0" max="100" value="0" step="0.1">
          <span id="mv-duration">0:00</span>
        </div>
        <div class="mv-toolbar">
          <div class="mv-tools-left">
            <button id="mv-mute" onclick="window.melodyVisualizerMute()" title="Tắt âm thanh"><i class="fas fa-volume-high"></i></button>
            <input id="mv-volume" type="range" min="0" max="100" value="100" title="Âm lượng">
            <select id="mv-speed" title="Tốc độ">
              <option value="0.5">0.5x</option>
              <option value="0.75">0.75x</option>
              <option value="1" selected>1x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2x</option>
            </select>
          </div>
          <div class="mv-controls">
            <button onclick="prevSong()" title="Bài trước"><i class="fas fa-backward-step"></i></button>
            <button id="mv-play" onclick="togglePlay()" title="Phát / tạm dừng"><i class="fas fa-play"></i></button>
            <button onclick="nextSong()" title="Bài tiếp theo"><i class="fas fa-forward-step"></i></button>
          </div>
          <div class="mv-tools-right">
            <button id="mv-like" onclick="window.melodyVisualizerLike()" title="Yêu thích"><i class="far fa-heart"></i></button>
            <button onclick="window.melodyVisualizerQueue()" title="Hàng đợi"><i class="fas fa-list"></i></button>
            <button onclick="window.melodyVisualizerFullscreen()" title="Toàn màn hình"><i class="fas fa-expand"></i></button>
            <button onclick="toggleMelodyVisualizer(false)" title="Đóng visualizer"><i class="fas fa-xmark"></i></button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    canvas = overlay.querySelector('#melody-visualizer-canvas');
    ctx = canvas.getContext('2d');
    renderThemes();
    const progressBar = overlay.querySelector('#mv-progress');

    // Scrub timeline: không để animation loop ghi đè giá trị khi đang kéo.
    progressBar.addEventListener('pointerdown', () => {
      isScrubbing = true;
      scrubValue = Number(progressBar.value) || 0;
    });

    progressBar.addEventListener('input', e => {
      isScrubbing = true;
      scrubValue = Number(e.target.value) || 0;
      overlay.querySelector('#mv-current').textContent = formatTime(scrubValue);
    });

    const commitSeek = () => {
      const t = Number(scrubValue) || 0;
      const a = getAudio();

      if (a && isFinite(a.duration) && a.duration > 0) {
        a.currentTime = Math.max(0, Math.min(t, a.duration));
      }

      const yt = window.__melodyYoutubePlayer;
      if (yt?.seekTo) {
        try { yt.seekTo(Math.max(0, t), true); } catch (_) {}
      }

      // DJ phải đồng bộ vị trí mới cho cả phòng.
      if (window.currentRoom && window.isRoomDJ && typeof socket !== 'undefined') {
        socket.emit('player:play', {
          roomCode: window.currentRoom.code,
          song: window.songs?.[window.getMelodyPlayerState?.().currentSongIndex ?? -1],
          currentTime: t,
          playbackRate: Number(document.getElementById('speed-control')?.value) || 1,
          isResume: true,
          sentAt: Date.now()
        });
      }

      isScrubbing = false;
    };

    progressBar.addEventListener('pointerup', commitSeek);
    progressBar.addEventListener('change', commitSeek);
    progressBar.addEventListener('pointercancel', () => {
      isScrubbing = false;
    });
    window.addEventListener('resize', resize);

    const vol = overlay.querySelector('#mv-volume');
    vol.value = Math.round((getAudio()?.volume ?? 1) * 100);
    vol.addEventListener('input', e => {
      const value = Math.max(0, Math.min(100, Number(e.target.value) || 0));
      const a = getAudio();
      if (a) a.volume = value / 100;
      if (window.__melodyYoutubePlayer?.setVolume) {
        try { window.__melodyYoutubePlayer.setVolume(value); } catch (_) {}
      }
      updateMuteIcon();
    });

    overlay.querySelector('#mv-speed').addEventListener('change', e => {
      const speed = Number(e.target.value) || 1;
      if (typeof window.setPlaybackSpeed === 'function') {
        window.setPlaybackSpeed(speed, true);
      } else {
        const a = getAudio();
        if (a) a.playbackRate = speed;
        if (window.__melodyYoutubePlayer?.setPlaybackRate) {
          try { window.__melodyYoutubePlayer.setPlaybackRate(speed); } catch (_) {}
        }
        const mainSpeed = document.getElementById('speed-control');
        if (mainSpeed) mainSpeed.value = String(speed);
      }
    });

    function updateMuteIcon() {
      const a = getAudio();
      const volume = a ? a.volume : 1;
      const icon = overlay.querySelector('#mv-mute i');
      if (!icon) return;
      icon.className = volume <= 0 ? 'fas fa-volume-xmark' : volume < .5 ? 'fas fa-volume-low' : 'fas fa-volume-high';
      vol.value = Math.round(volume * 100);
    }

    window.melodyVisualizerMute = () => {
      const a = getAudio();
      const volEl = overlay.querySelector('#mv-volume');
      if (!a || !volEl) return;
      if (a.volume > 0) {
        a.dataset.mvPreviousVolume = String(a.volume);
        a.volume = 0;
        if (window.__melodyYoutubePlayer?.mute) {
          try { window.__melodyYoutubePlayer.mute(); } catch (_) {}
        }
      } else {
        const restore = Number(a.dataset.mvPreviousVolume) || .7;
        a.volume = restore;
        if (window.__melodyYoutubePlayer?.unMute) {
          try { window.__melodyYoutubePlayer.unMute(); window.__melodyYoutubePlayer.setVolume(restore * 100); } catch (_) {}
        }
      }
      updateMuteIcon();
    };

    window.melodyVisualizerLike = () => {
      const btn = document.getElementById('like-btn');
      if (typeof window.toggleCurrentSongLike === 'function') window.toggleCurrentSongLike();
      else btn?.click();
    };

    window.melodyVisualizerQueue = () => {
      toggleMelodyVisualizer(false);
      if (typeof window.toggleQueuePanel === 'function') window.toggleQueuePanel();
    };

    window.melodyVisualizerFullscreen = async () => {
      try {
        if (!document.fullscreenElement) await overlay.requestFullscreen?.();
        else await document.exitFullscreen?.();
      } catch (_) {
        overlay.classList.toggle('mv-browser-fullscreen');
      }
    };

    updateMuteIcon();
  }

  function renderThemes() {
    const box = overlay.querySelector('#mv-themes');
    box.innerHTML = Object.entries(THEMES).map(([key,t]) =>
      '<button class="mv-theme-btn" data-theme="'+key+'">'+t.label+'</button>'
    ).join('');
    box.querySelectorAll('.mv-theme-btn').forEach(btn => {
      btn.onclick = () => {
        theme = btn.dataset.theme;
        localStorage.setItem('melodyVisualizerTheme', theme);
        syncTheme();
      };
    });
    syncTheme();
  }

  function syncTheme() {
    const t = THEMES[theme] || THEMES.neon;
    overlay.dataset.theme = theme;
    overlay.querySelector('#mv-theme-name').textContent = t.label;
    overlay.querySelectorAll('.mv-theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
  }

  function resize() {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(innerWidth*dpr);
    canvas.height = Math.floor(innerHeight*dpr);
    canvas.style.width = innerWidth+'px';
    canvas.style.height = innerHeight+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  function draw() {
    if (!overlay || overlay.classList.contains('hidden')) return;
    raf = requestAnimationFrame(draw);
    const w=innerWidth,h=innerHeight,t=THEMES[theme]||THEMES.neon;
    if (!freq && window.__melodyAnalyser) {
      analyser=window.__melodyAnalyser;
      freq=new Uint8Array(analyser.frequencyBinCount);
    }
    let bass=.2, mid=.18, treble=.16, energy=.18;
    if (analyser && freq) {
      analyser.getByteFrequencyData(freq);
      const avg=(from,to)=>{
        let sum=0,n=0;
        for(let i=Math.floor(freq.length*from);i<Math.max(i+1,Math.floor(freq.length*to));i++){sum+=freq[i];n++;}
        return n ? sum/n/255 : 0;
      };
      bass=avg(0,.08); mid=avg(.08,.42); treble=avg(.42,1);
      energy=bass*.5+mid*.35+treble*.15;
    } else {
      const now=performance.now()/1000;
      bass=.18+.12*(Math.sin(now*2.1)*.5+.5);
      mid=.18+.10*(Math.sin(now*1.3)*.5+.5);
      treble=.15+.10*(Math.sin(now*4.1)*.5+.5);
      energy=(bass+mid+treble)/3;
    }

    ctx.clearRect(0,0,w,h);
    ctx.fillStyle=t.bg; ctx.fillRect(0,0,w,h);
    const bg=ctx.createRadialGradient(w*.5,h*.45,20,w*.5,h*.45,Math.max(w,h)*.7);
    bg.addColorStop(0,t.colors[0]+'25'); bg.addColorStop(.45,t.colors[1]+'10'); bg.addColorStop(1,'transparent');
    ctx.fillStyle=bg; ctx.fillRect(0,0,w,h);

    // Spectrum ring
    const cx=w/2,cy=h*.46, base=Math.min(w,h)*(.115+bass*.06), bars=100;
    ctx.save(); ctx.translate(cx,cy); ctx.globalCompositeOperation='lighter';
    ctx.shadowColor=t.colors[0]; ctx.shadowBlur=20+energy*35;
    for(let i=0;i<bars;i++){
      const angle=i/bars*Math.PI*2;
      const value=analyser&&freq ? freq[Math.floor(i/bars*freq.length*.72)]/255 : .25+.18*Math.sin(performance.now()/220+i*.3);
      const len=10+value*Math.min(w,h)*.19;
      ctx.strokeStyle=t.colors[i%t.colors.length];
      ctx.lineWidth=1.5+value*3.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle)*base,Math.sin(angle)*base);
      ctx.lineTo(Math.cos(angle)*(base+len),Math.sin(angle)*(base+len));
      ctx.stroke();
    }
    ctx.shadowBlur=0; ctx.globalCompositeOperation='source-over';

    // Core
    const core=base*(.52+bass*.9);
    const cg=ctx.createRadialGradient(0,0,2,0,0,core);
    cg.addColorStop(0,t.colors[0]+'bb'); cg.addColorStop(.45,t.colors[1]+'55'); cg.addColorStop(1,'transparent');
    ctx.fillStyle=cg; ctx.beginPath(); ctx.arc(0,0,core,0,Math.PI*2); ctx.fill();

    // Wave rings
    for(let r=0;r<2;r++){
      ctx.beginPath();
      for(let i=0;i<=180;i++){
        const a=i/180*Math.PI*2;
        const idx=analyser&&freq?Math.floor(i/180*(freq.length-1)):0;
        const v=analyser&&freq?freq[idx]/255:.2+.1*Math.sin(performance.now()/300+i);
        const radius=base+25+r*22+v*35;
        const x=Math.cos(a)*radius,y=Math.sin(a)*radius;
        i?ctx.lineTo(x,y):ctx.moveTo(x,y);
      }
      ctx.closePath(); ctx.strokeStyle=t.colors[(r+1)%3]+'66'; ctx.lineWidth=1.5; ctx.stroke();
    }
    ctx.restore();

    // Theme effects
    if(theme==='rain'){
      ctx.strokeStyle=t.colors[0]+'55'; ctx.lineWidth=1;
      for(let i=0;i<80;i++){const x=(i*83+performance.now()/5)%(w+50)-25,y=(i*47+performance.now()/2)%(h+80)-80;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-4,y+18+energy*18);ctx.stroke();}
    } else if(theme==='sakura'){
      ctx.fillStyle=t.colors[1]+'80';
      for(let i=0;i<36;i++){const x=(i*137+performance.now()/12)%(w+80)-40,y=(i*71+performance.now()/20+Math.sin(performance.now()/900+i)*30)%(h+80)-40;ctx.beginPath();ctx.ellipse(x,y,4+energy*3,2+energy*2,.5,0,Math.PI*2);ctx.fill();}
    } else if(theme==='cyber'){
      ctx.strokeStyle=t.colors[2]+'18'; ctx.lineWidth=1;
      for(let x=0;x<w;x+=60){ctx.beginPath();ctx.moveTo(x,h*.58);ctx.lineTo(x,h);ctx.stroke();}
      for(let y=h*.58;y<h;y+=60){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
    }

    const a=getAudio();
    const mainSpeed=document.getElementById('speed-control');
    const mvSpeed=overlay.querySelector('#mv-speed');
    if (mvSpeed && mainSpeed && mvSpeed.value !== mainSpeed.value) mvSpeed.value=mainSpeed.value;
    const likeBtn=document.getElementById('like-btn');
    const mvLike=overlay.querySelector('#mv-like');
    if(likeBtn && mvLike) mvLike.classList.toggle('active', likeBtn.classList.contains('active') || likeBtn.getAttribute('aria-pressed')==='true');

    const p=playback();
    const prog=p.duration?p.current/p.duration:0;
    const seek=overlay.querySelector('#mv-progress');

    if (p.duration > 0) {
      seek.max = p.duration;
      if (!isScrubbing) {
        seek.value = p.current;
      }
    } else {
      seek.max = 100;
      if (!isScrubbing) seek.value = 0;
    }

    overlay.querySelector('#mv-current').textContent =
      formatTime(isScrubbing ? scrubValue : p.current);
    overlay.querySelector('#mv-duration').textContent=formatTime(p.duration);
    overlay.querySelector('#mv-play').innerHTML=window.getMelodyPlayerState?.().isPlaying
      ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';

    const song=window.songs?.[window.getMelodyPlayerState?.().currentSongIndex ?? -1];
    if(song){
      overlay.querySelector('#mv-cover').src=song.cover||'https://picsum.photos/300';
      overlay.querySelector('#mv-title').textContent=song.title||'Không có tên';
      overlay.querySelector('#mv-artist').textContent=song.artist||'Unknown';
    }
  }

  window.toggleMelodyVisualizer = function(force) {
    create();
    const open=typeof force==='boolean'?force:overlay.classList.contains('hidden');
    if(open){
      setupAnalyser();
      try{window.__melodyAudioContext?.resume?.();}catch(_){}
      overlay.classList.remove('hidden');
      resize(); syncTheme(); cancelAnimationFrame(raf); draw();
    } else {
      overlay.classList.add('hidden');
      cancelAnimationFrame(raf);
    }
  };
  window.initMelodyVisualizer=()=>{create();return overlay;};
})();