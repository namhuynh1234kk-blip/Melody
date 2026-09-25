/* =========================================================
   MELODY VISUALIZER
   Realtime canvas visualizer. No AI.
   ========================================================= */
(() => {
  const THEMES = {
    aurora:  { label: 'Aurora',  bg: '#061014', image: 'assets/visualizer/aurora.svg', colors: ['#8bffda','#72b7ff','#b58cff'] },
    midnight:{ label: 'Midnight',bg: '#070b14', image: 'assets/visualizer/midnight.svg', colors: ['#b8c7ff','#7288d8','#4b587d'] },
    sakura:  { label: 'Sakura',  bg: '#100b12', image: 'assets/visualizer/sakura.svg', colors: ['#ffd1e1','#ff91b5','#c9a7ff'] },
    ember:   { label: 'Ember',   bg: '#120b08', image: 'assets/visualizer/ember.svg', colors: ['#ffd29a','#ff8c66','#ff5c7a'] },
    abyss:   { label: 'Abyss',   bg: '#061015', image: 'assets/visualizer/abyss.svg', colors: ['#9ee8ff','#58b8d8','#496a9a'] }
  };

  let overlay, canvas, ctx, raf = 0, analyser = null, freq = null;
  let theme = localStorage.getItem('melodyVisualizerTheme') || 'aurora';
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
      <div class="mv-theme-background" aria-hidden="true"><img id="mv-theme-background" src="" alt=""></div><div class="mv-backdrop" aria-hidden="true"><img id="mv-backdrop-image" src="" alt=""></div>
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
        <div id="mv-icon" class="mv-icon"><img id="mv-center-cover" src="https://picsum.photos/300" alt=""></div>
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

      if (typeof window.seekMelodyPlayback === 'function') {
        window.seekMelodyPlayback(t, true);
      } else {
        const a = getAudio();
        if (a && isFinite(a.duration) && a.duration > 0) {
          a.currentTime = Math.max(0, Math.min(t, a.duration));
        }
        const yt = window.__melodyYoutubePlayer;
        if (yt?.seekTo) {
          try { yt.seekTo(Math.max(0, t), true); } catch (_) {}
        }
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
    const t = THEMES[theme] || THEMES.aurora;
    if (!THEMES[theme]) theme = 'aurora';
    overlay.dataset.theme = theme;
    const bg = overlay.querySelector('#mv-theme-background');
    if (bg) bg.src = t.image;
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

    const w = innerWidth, h = innerHeight;
    const t = THEMES[theme] || THEMES.aurora;
    const now = performance.now();
    const seconds = now / 1000;

    if (!freq && window.__melodyAnalyser) {
      analyser = window.__melodyAnalyser;
      freq = new Uint8Array(analyser.frequencyBinCount);
    }

    let bass=.16, mid=.14, treble=.12, energy=.14;
    if (analyser && freq) {
      analyser.getByteFrequencyData(freq);
      const avg=(from,to)=>{
        let sum=0,n=0;
        const a=Math.floor(freq.length*from), b=Math.max(a+1,Math.floor(freq.length*to));
        for(let i=a;i<b;i++){sum+=freq[i];n++;}
        return n ? sum/n/255 : 0;
      };
      bass=avg(0,.08); mid=avg(.08,.42); treble=avg(.42,1);
      energy=bass*.5+mid*.35+treble*.15;
    } else {
      bass=.12+.08*(Math.sin(seconds*1.7)*.5+.5);
      mid=.12+.06*(Math.sin(seconds*1.05)*.5+.5);
      treble=.10+.06*(Math.sin(seconds*3.3)*.5+.5);
      energy=(bass+mid+treble)/3;
    }

    ctx.clearRect(0,0,w,h);

    // Deep cinematic background.
    ctx.fillStyle=t.bg;
    ctx.fillRect(0,0,w,h);

    const wash=ctx.createRadialGradient(w*.5,h*.43,20,w*.5,h*.43,Math.max(w,h)*.72);
    wash.addColorStop(0,t.colors[0]+'18');
    wash.addColorStop(.38,t.colors[1]+'0c');
    wash.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=wash;
    ctx.fillRect(0,0,w,h);

    // Slow ambient light blobs.
    ctx.save();
    ctx.globalCompositeOperation='screen';
    for(let i=0;i<3;i++){
      const px=w*(.18+i*.34)+Math.sin(seconds*(.16+i*.07)+i)*w*.07;
      const py=h*(.28+i*.13)+Math.cos(seconds*(.13+i*.05)+i)*h*.05;
      const rr=Math.min(w,h)*(.20+energy*.08);
      const g=ctx.createRadialGradient(px,py,0,px,py,rr);
      g.addColorStop(0,t.colors[i%3]+'18');
      g.addColorStop(1,'transparent');
      ctx.fillStyle=g;
      ctx.beginPath();ctx.arc(px,py,rr,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();

    const cx=w/2, cy=h*.43;
    const base=Math.min(w,h)*(.12+bass*.025);
    const bars=96;

    // Thin, elegant spectrum arc.
    ctx.save();
    ctx.translate(cx,cy);
    ctx.globalCompositeOperation='screen';
    ctx.lineCap='round';

    for(let i=0;i<bars;i++){
      const angle=i/bars*Math.PI*2;
      const idx=analyser&&freq?Math.floor(i/bars*freq.length*.78):0;
      const v=analyser&&freq?freq[idx]/255:.18+.08*Math.sin(seconds*2+i*.24);
      const len=7+v*Math.min(w,h)*.075;
      const inner=base+20;
      const outer=inner+len;
      ctx.strokeStyle=t.colors[i%3] + (i%3===0?'b8':'82');
      ctx.lineWidth=1.2+v*1.6;
      ctx.shadowColor=t.colors[i%3];
      ctx.shadowBlur=7+v*8;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle)*inner,Math.sin(angle)*inner);
      ctx.lineTo(Math.cos(angle)*outer,Math.sin(angle)*outer);
      ctx.stroke();
    }

    // Soft waveform halo.
    for(let ring=0;ring<2;ring++){
      ctx.beginPath();
      for(let i=0;i<=180;i++){
        const a=i/180*Math.PI*2;
        const idx=analyser&&freq?Math.floor(i/180*(freq.length-1)):0;
        const v=analyser&&freq?freq[idx]/255:.15+.05*Math.sin(seconds*1.8+i*.08);
        const radius=base+30+ring*15+v*(ring?18:28);
        const x=Math.cos(a)*radius,y=Math.sin(a)*radius;
        i?ctx.lineTo(x,y):ctx.moveTo(x,y);
      }
      ctx.closePath();
      ctx.strokeStyle=t.colors[(ring+1)%3]+'40';
      ctx.lineWidth=1;
      ctx.shadowBlur=0;
      ctx.stroke();
    }

    // Center glow.
    const core=base*.78+bass*18;
    const cg=ctx.createRadialGradient(0,0,4,0,0,core*1.8);
    cg.addColorStop(0,t.colors[0]+'20');
    cg.addColorStop(.48,t.colors[1]+'0c');
    cg.addColorStop(1,'transparent');
    ctx.fillStyle=cg;
    ctx.beginPath();ctx.arc(0,0,core*1.8,0,Math.PI*2);ctx.fill();
    ctx.restore();

    // Minimal theme-specific atmosphere.
    if(theme==='sakura'){
      ctx.fillStyle=t.colors[1]+'72';
      for(let i=0;i<28;i++){
        const x=(i*149+seconds*10)%(w+80)-40;
        const y=(i*73+seconds*(8+i%3)+Math.sin(seconds*.6+i)*35)%(h+80)-40;
        ctx.beginPath();ctx.ellipse(x,y,3.5+energy*2,1.8+energy,Math.sin(i),0,Math.PI*2);ctx.fill();
      }
    } else if(theme==='ember'){
      ctx.fillStyle=t.colors[1]+'58';
      for(let i=0;i<26;i++){
        const x=(i*97+Math.sin(seconds*.5+i)*35)%(w+40);
        const y=h-(i*61+seconds*(16+i%4))%(h*.52);
        ctx.beginPath();ctx.arc(x,y,1.2+energy*2,0,Math.PI*2);ctx.fill();
      }
    } else if(theme==='abyss'){
      ctx.strokeStyle=t.colors[0]+'22';
      for(let i=0;i<4;i++){
        const yy=h*.66+i*34+Math.sin(seconds*.4+i)*8;
        ctx.beginPath();
        for(let x=0;x<=w;x+=18){
          const y=yy+Math.sin(x*.009+seconds*.8+i)*7*(1+energy);
          x?ctx.lineTo(x,y):ctx.moveTo(x,y);
        }
        ctx.stroke();
      }
    } else if(theme==='midnight'){
      ctx.fillStyle=t.colors[0]+'55';
      for(let i=0;i<70;i++){
        const x=(i*173)%w, y=(i*97)%Math.max(1,h*.72);
        const twinkle=.5+.5*Math.sin(seconds*(.8+(i%4)*.3)+i);
        ctx.globalAlpha=.25+twinkle*.5;
        ctx.beginPath();ctx.arc(x,y,1+twinkle*.7,0,Math.PI*2);ctx.fill();
      }
      ctx.globalAlpha=1;
    } else if(theme==='aurora'){
      ctx.save();
      ctx.globalCompositeOperation='screen';
      ctx.strokeStyle=t.colors[0]+'16';
      ctx.lineWidth=18+energy*20;
      ctx.beginPath();
      for(let x=-40;x<=w+40;x+=20){
        const y=h*.72+Math.sin(x*.003+seconds*.25)*45+Math.sin(x*.009+seconds*.4)*18;
        x===-40?ctx.moveTo(x,y):ctx.lineTo(x,y);
      }
      ctx.stroke();
      ctx.restore();
    }

    const mainSpeed=document.getElementById('speed-control');
    const mvSpeed=overlay.querySelector('#mv-speed');
    if(mvSpeed&&mainSpeed&&mvSpeed.value!==mainSpeed.value)mvSpeed.value=mainSpeed.value;

    const likeBtn=document.getElementById('like-btn');
    const mvLike=overlay.querySelector('#mv-like');
    if(likeBtn&&mvLike)mvLike.classList.toggle('active',likeBtn.classList.contains('active')||likeBtn.getAttribute('aria-pressed')==='true');

    const p=playback();
    const seek=overlay.querySelector('#mv-progress');
    if(p.duration>0){
      seek.max=p.duration;
      if(!isScrubbing)seek.value=p.current;
    }else{
      seek.max=100;
      if(!isScrubbing)seek.value=0;
    }

    overlay.querySelector('#mv-current').textContent=formatTime(isScrubbing?scrubValue:p.current);
    overlay.querySelector('#mv-duration').textContent=formatTime(p.duration);
    overlay.querySelector('#mv-play').innerHTML=window.getMelodyPlayerState?.().isPlaying
      ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';

    const song=window.songs?.[window.getMelodyPlayerState?.().currentSongIndex ?? -1];
    if(song){
      const cover=song.cover||'https://picsum.photos/300';
      overlay.querySelector('#mv-cover').src=cover;
      overlay.querySelector('#mv-center-cover').src=cover;
      const backdrop = overlay.querySelector('#mv-backdrop-image');
      if (backdrop && backdrop.src !== cover) {
        backdrop.src = cover;
      }
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