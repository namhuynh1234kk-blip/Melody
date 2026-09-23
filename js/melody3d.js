// Melody AI mascot
// Interactive 3D-style SVG character with expressive states.
// States: idle, thinking, done, music, happy, surprised, sad, sleep.

(() => {
    'use strict';

    let api = null;
    let root = null;
    let currentState = 'idle';
    let blinkTimer = null;

    const labels = {
        idle: 'AI hỗ trợ Âm nhạc',
        thinking: 'Đang nghĩ...',
        done: '✓ Xong rồi',
        music: '♪ Feeling theo nhạc',
        happy: 'Melody vui nè ✨',
        surprised: 'Ồ! 👀',
        sad: 'Melody hơi buồn',
        sleep: 'Melody đang nghỉ...'
    };

    const svg = `
    <svg class="melody-avatar-svg" viewBox="0 0 220 330" role="img" aria-label="Melody AI">
      <defs>
        <linearGradient id="hoodie" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#22e4ab"/>
          <stop offset=".48" stop-color="#07966f"/>
          <stop offset="1" stop-color="#034c42"/>
        </linearGradient>
        <linearGradient id="visor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#0d1c20"/>
          <stop offset=".48" stop-color="#010405"/>
          <stop offset="1" stop-color="#111b1e"/>
        </linearGradient>
        <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#f5ffff"/>
          <stop offset=".28" stop-color="#a7c4c2"/>
          <stop offset=".7" stop-color="#53696b"/>
          <stop offset="1" stop-color="#172124"/>
        </linearGradient>
        <linearGradient id="shoe" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#1b292d"/>
          <stop offset="1" stop-color="#05080a"/>
        </linearGradient>
        <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="3.8" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="8" stdDeviation="7" flood-opacity=".52"/>
        </filter>
        <style>
          .state-only { opacity: 0; transition: opacity .18s ease; }
          .eye { transition: opacity .16s ease, transform .16s ease; transform-box: fill-box; transform-origin: center; }
          .melody-avatar-root.is-blinking .eye { transform: scaleY(.12); }

          .melody-avatar-root[data-state="thinking"] .avatar-character {
            animation: thinkBob .8s ease-in-out infinite alternate;
          }
          .melody-avatar-root[data-state="thinking"] .face-eyes {
            animation: thinkLook .62s ease-in-out infinite alternate;
            transform-box: fill-box; transform-origin: center;
          }
          .melody-avatar-root[data-state="thinking"] .thinking-only { opacity: 1; }
          .melody-avatar-root[data-state="thinking"] .hoodie { animation: hoodiePulse .75s ease-in-out infinite alternate; transform-origin: center; }
          .melody-avatar-root[data-state="thinking"] .head { animation: headThink .9s ease-in-out infinite alternate; transform-origin: center; }
          .melody-avatar-root[data-state="happy"] .avatar-character,
          .melody-avatar-root[data-state="surprised"] .avatar-character { animation: happyBounce .55s ease-in-out infinite alternate; transform-origin: center bottom; }
          .melody-avatar-root[data-state="happy"] .arm-l { animation: happyArmL .7s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: right top; }
          .melody-avatar-root[data-state="happy"] .arm-r { animation: happyArmR .7s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: left top; }
          .melody-avatar-root[data-state="surprised"] .head { animation: surprisedHead .5s ease-out infinite alternate; transform-origin: center; }
          .melody-avatar-root[data-state="sad"] .avatar-character { animation: sadSway 1.8s ease-in-out infinite alternate; transform-origin: center bottom; }
          .melody-avatar-root[data-state="done"] .done-only { animation: donePop .55s ease-out both; }
          .melody-avatar-root[data-state="music"] .head { animation: musicHead .52s ease-in-out infinite alternate; transform-origin: center; }
          .melody-avatar-root[data-state="happy"] .head { animation: happyHead .7s ease-in-out infinite alternate; transform-origin: center; }
          .melody-avatar-root[data-state="sad"] .head { animation: sadHead 1.1s ease-in-out infinite alternate; transform-origin: center; }
          .melody-avatar-root[data-state="surprised"] .ear { animation: earPulse .5s ease-in-out infinite alternate; transform-origin: center; }
          .melody-avatar-root:hover:not([data-state="thinking"]):not([data-state="music"]):not([data-state="happy"]):not([data-state="sad"]):not([data-state="surprised"]) .head { animation: hoverTilt .9s ease-in-out infinite alternate; transform-origin: center; }

          @keyframes hoodiePulse { from { transform: scale(1); } to { transform: scale(1.018); } }
          @keyframes headThink { from { transform: translateX(-2px) rotate(-2deg); } to { transform: translateX(2px) rotate(2deg); } }
          @keyframes happyBounce { from { transform: translateY(0) rotate(-1deg); } to { transform: translateY(-7px) rotate(1deg); } }
          @keyframes happyArmL { from { transform: rotate(-5deg); } to { transform: rotate(28deg); } }
          @keyframes happyArmR { from { transform: rotate(5deg); } to { transform: rotate(-28deg); } }
          @keyframes surprisedHead { from { transform: scale(1) translateY(0); } to { transform: scale(1.035) translateY(-2px); } }
          @keyframes sadSway { from { transform: rotate(-1deg); } to { transform: rotate(1deg) translateY(2px); } }
          @keyframes donePop { from { opacity: .2; transform: scale(.65); } to { opacity: 1; transform: scale(1); } }
          @keyframes musicHead { from { transform: rotate(-5deg) translateY(1px); } to { transform: rotate(5deg) translateY(-2px); } }
          @keyframes hoverTilt { from { transform: rotate(-1deg); } to { transform: rotate(1deg); } }
          @keyframes happyHead { from { transform: rotate(-3deg) translateY(0); } to { transform: rotate(3deg) translateY(-2px); } }
          @keyframes sadHead { from { transform: rotate(-1deg) translateY(1px); } to { transform: rotate(2deg) translateY(4px); } }
          @keyframes earPulse { from { transform: scale(1); } to { transform: scale(1.04); } }

          .melody-avatar-root[data-state="done"] .done-only,
          .melody-avatar-root[data-state="happy"] .happy-only,
          .melody-avatar-root[data-state="surprised"] .surprised-only,
          .melody-avatar-root[data-state="sad"] .sad-only,
          .melody-avatar-root[data-state="sleep"] .sleep-only,
          .melody-avatar-root[data-state="music"] .music-only { opacity: 1; }

          .melody-avatar-root[data-state="done"] .eye,
          .melody-avatar-root[data-state="happy"] .eye,
          .melody-avatar-root[data-state="sleep"] .eye { opacity: 0; }

          .melody-avatar-root[data-state="surprised"] .eye,
          .melody-avatar-root[data-state="sad"] .eye { opacity: 0; }

          .melody-avatar-root[data-state="music"] .avatar-character {
            transform-box: fill-box;
            transform-origin: center bottom;
            animation: groove .52s ease-in-out infinite alternate;
          }
          .melody-avatar-root[data-state="music"] .arm-l {
            transform-box: fill-box; transform-origin: right top;
            animation: armLeft .52s ease-in-out infinite alternate;
          }
          .melody-avatar-root[data-state="music"] .arm-r {
            transform-box: fill-box; transform-origin: left top;
            animation: armRight .52s ease-in-out infinite alternate;
          }
          .melody-avatar-root[data-state="music"] .music-note {
            animation: noteFloat 1s ease-in-out infinite alternate;
            transform-box: fill-box; transform-origin: center;
          }
          .melody-avatar-root[data-state="music"] .note-r { animation-delay: .28s; }

          .melody-avatar-root[data-state="sleep"] .avatar-character {
            animation: sleepBreath 2.2s ease-in-out infinite;
            transform-box: fill-box; transform-origin: center bottom;
          }
          .melody-avatar-root[data-state="sleep"] .sleep-z {
            animation: zFloat 1.5s ease-in-out infinite;
            transform-box: fill-box; transform-origin: center;
          }

          @keyframes thinkBob { from { transform: translateY(0) rotate(-1deg); } to { transform: translateY(-3px) rotate(1deg); } }
          @keyframes thinkLook { from { transform: translateX(-7px); } to { transform: translateX(7px); } }
          @keyframes groove { from { transform: translateY(2px) rotate(-3deg); } to { transform: translateY(-6px) rotate(3deg); } }
          @keyframes armLeft { from { transform: rotate(-4deg); } to { transform: rotate(18deg); } }
          @keyframes armRight { from { transform: rotate(4deg); } to { transform: rotate(-18deg); } }
          @keyframes noteFloat { from { transform: translateY(4px) scale(.9); opacity: .65; } to { transform: translateY(-7px) scale(1.08); opacity: 1; } }
          @keyframes sleepBreath { 0%,100% { transform: translateY(0) scaleY(1); } 50% { transform: translateY(2px) scaleY(.99); } }
          @keyframes zFloat { 0% { transform: translate(0,5px) scale(.85); opacity: .35; } 100% { transform: translate(7px,-7px) scale(1.08); opacity: 1; } }
        </style>
      </defs>

      <ellipse class="avatar-floor" cx="110" cy="314" rx="66" ry="10" fill="#12dca5" opacity=".16" filter="url(#glow)"/>

      <g class="avatar-character" filter="url(#shadow)">
        <path d="M43 103 C34 58 60 31 110 31 C160 31 186 58 177 103" fill="none" stroke="#090e10" stroke-width="14" stroke-linecap="round"/>
        <path d="M43 103 C34 58 60 31 110 31 C160 31 186 58 177 103" fill="none" stroke="#253336" stroke-width="4" stroke-linecap="round"/>

        <g class="ear left">
          <ellipse cx="45" cy="116" rx="27" ry="34" fill="#05090b" stroke="#172124" stroke-width="5"/>
          <ellipse cx="45" cy="116" rx="22" ry="29" fill="#11191b" stroke="#08b889" stroke-width="4"/>
          <ellipse cx="45" cy="116" rx="17" ry="24" fill="#06352d" stroke="#35f5c4" stroke-width="2"/>
          <ellipse cx="45" cy="116" rx="11" ry="18" fill="#07110f"/>
          <path d="M36 99 Q45 92 54 99 L54 133 Q45 140 36 133Z" fill="#0b1718"/>
          <path d="M34 106 Q45 99 56 106 M34 126 Q45 133 56 126" fill="none" stroke="#79ffe0" stroke-width="1.5" opacity=".8"/>
          <ellipse cx="34" cy="104" rx="4" ry="9" fill="#8affdf" opacity=".2"/>
        </g>

        <g class="ear right">
          <ellipse cx="175" cy="116" rx="27" ry="34" fill="#05090b" stroke="#172124" stroke-width="5"/>
          <ellipse cx="175" cy="116" rx="22" ry="29" fill="#11191b" stroke="#08b889" stroke-width="4"/>
          <ellipse cx="175" cy="116" rx="17" ry="24" fill="#06352d" stroke="#35f5c4" stroke-width="2"/>
          <ellipse cx="175" cy="116" rx="11" ry="18" fill="#07110f"/>
          <path d="M166 99 Q175 92 184 99 L184 133 Q175 140 166 133Z" fill="#0b1718"/>
          <path d="M164 106 Q175 99 186 106 M164 126 Q175 133 186 126" fill="none" stroke="#79ffe0" stroke-width="1.5" opacity=".8"/>
          <ellipse cx="164" cy="104" rx="4" ry="9" fill="#8affdf" opacity=".2"/>
        </g>

        <g class="head">
          <path d="M51 73 Q55 36 110 34 Q165 36 169 73 L177 126 Q173 160 110 166 Q47 160 43 126 Z" fill="#080d10" stroke="#1d292c" stroke-width="5"/>
          <path d="M54 65 Q61 19 110 17 Q159 19 166 65 Q147 49 110 48 Q73 49 54 65Z" fill="#0a0e10"/>
          <path d="M69 42 Q110 28 151 42 L149 51 Q110 41 71 51Z" fill="#141d20"/>
          <path d="M74 54 Q110 43 146 54 L142 65 Q110 56 78 65Z" fill="#0c1215"/>
          <path d="M91 36 L131 34 L133 45 L89 47Z" fill="#12d9a3" opacity=".9"/>
          <path d="M98 37 L101 45 M107 35 L109 44 M117 35 L118 43 M126 35 L127 43" stroke="#062d27" stroke-width="2"/>
          <path d="M143 50 v14 l-5 2 q-5 0-5-4 q0-4 6-4 l2-1 V50z" fill="#35f6c4" filter="url(#glow)"/>

          <rect x="45" y="76" width="130" height="74" rx="25" fill="url(#metal)" opacity=".95"/>
          <rect x="50" y="81" width="120" height="64" rx="21" fill="url(#visor)" stroke="#091214" stroke-width="3"/>

          <g class="face-eyes" fill="#50ffe0" filter="url(#glow)">
            <path class="eye eye-l" d="M67 112 Q78 95 91 111 Q80 106 67 112Z"/>
            <path class="eye eye-r" d="M129 111 Q142 95 153 112 Q140 106 129 111Z"/>
          </g>

          <g class="state-only done-only happy-only" fill="none" stroke="#55ffe0" stroke-width="3.2" stroke-linecap="round" filter="url(#glow)">
            <path d="M68 108 Q79 118 91 108"/>
            <path d="M129 108 Q141 118 153 108"/>
            <path d="M91 129 Q110 142 129 129"/>
          </g>

          <g class="state-only surprised-only" fill="#55ffe0" filter="url(#glow)">
            <circle cx="80" cy="110" r="7"/><circle cx="140" cy="110" r="7"/>
            <ellipse cx="110" cy="132" rx="7" ry="4"/>
          </g>

          <g class="state-only sad-only" fill="none" stroke="#8fffe5" stroke-width="3" stroke-linecap="round" filter="url(#glow)">
            <path d="M68 113 Q80 102 91 111"/><path d="M129 111 Q141 102 152 113"/>
            <path d="M94 136 Q110 126 126 136"/>
          </g>

          <g class="state-only sleep-only" fill="none" stroke="#64ffe0" stroke-width="3" stroke-linecap="round" filter="url(#glow)">
            <path d="M68 112 Q80 117 91 112"/><path d="M129 112 Q141 117 152 112"/>
          </g>

          <path class="state-only music-only" d="M91 129 Q110 141 129 129" fill="none" stroke="#55ffe0" stroke-width="3" stroke-linecap="round" filter="url(#glow)"/>
          <g class="state-only music-only music-note note-l" fill="#35f6c4" filter="url(#glow)">
            <path d="M24 76 V59 L36 56 V61 L29 63 V75 Q29 80 24 80 Q19 80 19 76 Q19 72 24 72Z"/>
          </g>
          <g class="state-only music-only music-note note-r" fill="#35f6c4" filter="url(#glow)">
            <path d="M184 76 V59 L196 56 V61 L189 63 V75 Q189 80 184 80 Q179 80 179 76 Q179 72 184 72Z"/>
          </g>

          <g class="state-only thinking-only" fill="#fbbf24" filter="url(#glow)">
            <circle cx="84" cy="132" r="2.6"/><circle cx="110" cy="132" r="2.6"/><circle cx="136" cy="132" r="2.6"/>
          </g>

          <g class="state-only done-only" filter="url(#glow)">
            <circle cx="157" cy="68" r="14" fill="#10b981"/>
            <path d="M150 68 l5 5 10-12" fill="none" stroke="#eafff8" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
          </g>

          <g class="state-only sleep-only sleep-z" fill="#7df9df" font-family="system-ui,sans-serif" font-weight="800">
            <text x="166" y="83" font-size="16">Z</text><text x="181" y="68" font-size="12">z</text>
          </g>

          <path d="M58 91 Q82 84 104 87" fill="none" stroke="#d9fffa" stroke-width="2" opacity=".14"/>
        </g>

        <path d="M82 153 Q110 166 138 153 L148 180 Q110 198 72 180Z" fill="#075c4c"/>
        <path class="hoodie" d="M65 169 Q110 151 155 169 Q171 182 167 224 Q153 246 110 250 Q67 246 53 224 Q49 182 65 169Z" fill="url(#hoodie)" stroke="#064f43" stroke-width="4"/>
        <path d="M72 171 Q110 137 148 171 L140 190 Q110 178 80 190Z" fill="#08745b"/>
        <path d="M83 177 Q110 164 137 177" fill="none" stroke="#21d5a4" stroke-width="3" opacity=".5"/>
        <path d="M91 177 L95 210 M129 177 L125 210" stroke="#e9fffb" stroke-width="3" stroke-linecap="round"/>
        <circle cx="95" cy="211" r="4" fill="#e9fffb"/><circle cx="125" cy="211" r="4" fill="#e9fffb"/>
        <g transform="translate(99 190)" fill="#f4fffd"><rect x="12" y="0" width="4" height="24" rx="2"/><path d="M15 1 L27 0 L27 5 L15 7Z"/><ellipse cx="9" cy="24" rx="7" ry="5"/></g>

        <g class="arm arm-l"><path d="M60 180 Q43 184 43 210 Q46 224 59 219 L73 193Z" fill="#07936f"/><circle cx="48" cy="219" r="14" fill="url(#metal)"/><circle cx="41" cy="211" r="6" fill="#f2ffff"/><path d="M38 207 Q34 198 40 196 Q47 196 48 207" fill="#f2ffff"/></g>
        <g class="arm arm-r"><path d="M160 180 Q177 184 177 210 Q174 224 161 219 L147 193Z" fill="#07936f"/><circle cx="172" cy="219" r="14" fill="url(#metal)"/></g>

        <path d="M69 235 Q88 228 108 235 L106 279 L70 279Z" fill="#0b1114" stroke="#182327" stroke-width="4"/>
        <path d="M112 235 Q132 228 151 235 L150 279 L113 279Z" fill="#0b1114" stroke="#182327" stroke-width="4"/>
        <path d="M65 247 Q78 256 91 251 M121 251 Q136 256 151 247" stroke="#273338" stroke-width="4" fill="none"/>

        <g class="shoe shoe-l"><path d="M65 270 Q79 266 103 274 L101 294 Q84 302 57 294 L53 284Z" fill="url(#shoe)" stroke="#263238" stroke-width="3"/><path d="M56 289 Q80 297 101 291 L104 301 Q78 310 54 301Z" fill="#eef8f7"/><path d="M61 278 L91 281 M59 284 L88 287" stroke="#15dca7" stroke-width="4"/></g>
        <g class="shoe shoe-r"><path d="M117 274 Q141 266 155 270 L167 284 L163 294 Q136 302 119 294Z" fill="url(#shoe)" stroke="#263238" stroke-width="3"/><path d="M118 291 Q141 297 164 289 L166 301 Q141 310 116 301Z" fill="#eef8f7"/><path d="M129 281 L159 278 M131 287 L162 284" stroke="#15dca7" stroke-width="4"/></g>
        <path d="M66 244 L56 250 L60 257 L70 251Z" fill="#12dca5"/>
      </g>
    </svg>`;

    function updateLabel() {
        const label = document.querySelector('#melody-ai-widget .melody-ai-avatar-label > span');
        if (!label) return;
        label.textContent = labels[currentState] || labels.idle;
        label.dataset.state = currentState;
    }

    function updateDot() {
        const dot = document.getElementById('melody-ai-status-dot');
        if (!dot) return;
        dot.className = 'melody-ai-status-dot';
        if (currentState === 'thinking') dot.classList.add('thinking');
        else if (currentState === 'music') dot.classList.add('music');
        else if (currentState === 'sad') dot.classList.add('sad');
        else if (currentState === 'done' || currentState === 'happy') dot.classList.add('done');
        else if (currentState === 'sleep') dot.classList.add('sleep');
    }

    function setState(state) {
        const allowed = ['idle','thinking','done','music','happy','surprised','sad','sleep'];
        currentState = allowed.includes(state) ? state : 'idle';
        if (root) root.dataset.state = currentState;
        updateLabel();
        updateDot();
        return currentState;
    }

    function getState() {
        return currentState;
    }

    function blink() {
        if (!root || ['thinking','music','sleep'].includes(currentState)) return;
        root.classList.add('is-blinking');
        setTimeout(() => root?.classList.remove('is-blinking'), 140);
    }

    function scheduleBlink() {
        clearTimeout(blinkTimer);
        blinkTimer = setTimeout(() => {
            blink();
            scheduleBlink();
        }, 2600 + Math.random() * 2600);
    }

    function react(state, duration = 1200) {
        const previous = currentState;
        setState(state);
        setTimeout(() => {
            if (currentState !== state) return;
            if (window.isMusicPlaying) setState('music');
            else setState(previous === 'music' ? 'idle' : 'idle');
        }, duration);
    }

    function interact() {
        if (['thinking','sleep'].includes(currentState)) return;
        if (window.isMusicPlaying) {
            setState('music');
            return;
        }
        const reaction = currentState === 'sad' ? 'happy' : 'happy';
        react(reaction, 900);
    }

    function init(hostId) {
        const host = document.getElementById(hostId);
        if (!host) return api;
        root = host;
        root.classList.add('melody-avatar-root');
        root.innerHTML = svg;
        setState(currentState);
        scheduleBlink();
        return api;
    }

    api = { init, setState, getState, react, blink, interact };
    window.melodyAI3D = api;

    // Player integration. Thinking/done feedback has priority over playback state.
    window.melodyAIPlaybackChanged = (playing) => {
        window.isMusicPlaying = !!playing;
        if (!root) return;

        if (playing) {
            if (!['thinking','done'].includes(currentState)) setState('music');
        } else if (currentState === 'music') {
            setState('idle');
        }
    };

    document.addEventListener('visibilitychange', () => {
        if (!root) return;
        if (document.hidden && !window.isMusicPlaying && currentState === 'idle') setState('sleep');
        else if (!document.hidden && currentState === 'sleep') setState(window.isMusicPlaying ? 'music' : 'idle');
    });
})();
