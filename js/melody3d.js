// Melody AI avatar
// Front-facing 3D-style SVG mascot based on the supplied Melody character reference.
// The existing chat, AI, queue and player remain untouched.

(() => {
    'use strict';

    let api = null;
    let root = null;
    let currentState = 'idle';

    const svg = `
    <svg class="melody-avatar-svg" viewBox="0 0 220 330" role="img" aria-label="Melody AI">
      <defs>
        <linearGradient id="hoodie" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#18c995"/>
          <stop offset=".55" stop-color="#07966f"/>
          <stop offset="1" stop-color="#045c4d"/>
        </linearGradient>
        <linearGradient id="visor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#071014"/>
          <stop offset=".5" stop-color="#000304"/>
          <stop offset="1" stop-color="#10171a"/>
        </linearGradient>
        <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#efffff"/>
          <stop offset=".35" stop-color="#9cb7b5"/>
          <stop offset=".7" stop-color="#566c6c"/>
          <stop offset="1" stop-color="#1a2527"/>
        </linearGradient>
        <linearGradient id="shoe" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#1c292d"/>
          <stop offset="1" stop-color="#05080a"/>
        </linearGradient>
        <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="4" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="8" stdDeviation="7" flood-opacity=".5"/>
        </filter>
      </defs>

      <!-- soft floor glow -->
      <ellipse class="avatar-floor" cx="110" cy="314" rx="66" ry="10" fill="#12dca5" opacity=".16" filter="url(#glow)"/>

      <g class="avatar-character" filter="url(#shadow)">
        <!-- realistic over-ear headphone frame -->
        <path d="M43 103 C34 58 60 31 110 31 C160 31 186 58 177 103"
              fill="none" stroke="#090e10" stroke-width="14" stroke-linecap="round"/>
        <path d="M43 103 C34 58 60 31 110 31 C160 31 186 58 177 103"
              fill="none" stroke="#253336" stroke-width="4" stroke-linecap="round"/>

        <!-- left over-ear cup -->
        <g class="ear left">
          <ellipse cx="45" cy="116" rx="27" ry="34" fill="#05090b" stroke="#172124" stroke-width="5"/>
          <ellipse cx="45" cy="116" rx="22" ry="29" fill="#11191b" stroke="#08b889" stroke-width="4"/>
          <ellipse cx="45" cy="116" rx="17" ry="24" fill="#06352d" stroke="#35f5c4" stroke-width="2"/>
          <ellipse cx="45" cy="116" rx="11" ry="18" fill="#07110f"/>
          <path d="M36 99 Q45 92 54 99 L54 133 Q45 140 36 133Z" fill="#0b1718"/>
          <path d="M34 106 Q45 99 56 106 M34 126 Q45 133 56 126" fill="none" stroke="#79ffe0" stroke-width="1.5" opacity=".8"/>
          <ellipse cx="34" cy="104" rx="4" ry="9" fill="#8affdf" opacity=".2"/>
        </g>

        <!-- right over-ear cup -->
        <g class="ear right">
          <ellipse cx="175" cy="116" rx="27" ry="34" fill="#05090b" stroke="#172124" stroke-width="5"/>
          <ellipse cx="175" cy="116" rx="22" ry="29" fill="#11191b" stroke="#08b889" stroke-width="4"/>
          <ellipse cx="175" cy="116" rx="17" ry="24" fill="#06352d" stroke="#35f5c4" stroke-width="2"/>
          <ellipse cx="175" cy="116" rx="11" ry="18" fill="#07110f"/>
          <path d="M166 99 Q175 92 184 99 L184 133 Q175 140 166 133Z" fill="#0b1718"/>
          <path d="M164 106 Q175 99 186 106 M164 126 Q175 133 186 126" fill="none" stroke="#79ffe0" stroke-width="1.5" opacity=".8"/>
          <ellipse cx="164" cy="104" rx="4" ry="9" fill="#8affdf" opacity=".2"/>
        </g>

        <!-- head -->
        <g class="head">
          <path d="M51 73 Q55 36 110 34 Q165 36 169 73 L177 126 Q173 160 110 166 Q47 160 43 126 Z"
                fill="#080d10" stroke="#1d292c" stroke-width="5"/>

          <!-- cap -->
          <path d="M54 65 Q61 19 110 17 Q159 19 166 65 Q147 49 110 48 Q73 49 54 65Z"
                fill="#0a0e10"/>
          <path d="M69 42 Q110 28 151 42 L149 51 Q110 41 71 51Z" fill="#141d20"/>
          <path d="M74 54 Q110 43 146 54 L142 65 Q110 56 78 65Z" fill="#0c1215"/>
          <path d="M91 36 L131 34 L133 45 L89 47Z" fill="#12d9a3" opacity=".9"/>
          <path d="M98 37 L101 45 M107 35 L109 44 M117 35 L118 43 M126 35 L127 43"
                stroke="#062d27" stroke-width="2"/>
          <!-- music note -->
          <path d="M143 50 v14 l-5 2 q-5 0-5-4 q0-4 6-4 l2-1 V50z"
                fill="#35f6c4" filter="url(#glow)"/>

          <!-- visor -->
          <rect x="45" y="76" width="130" height="74" rx="25" fill="url(#metal)" opacity=".95"/>
          <rect x="50" y="81" width="120" height="64" rx="21" fill="url(#visor)" stroke="#091214" stroke-width="3"/>

          <!-- glowing eyes -->
          <g class="face-eyes" fill="#50ffe0" filter="url(#glow)">
            <path class="eye eye-l" d="M67 112 Q78 95 91 111 Q80 106 67 112Z"/>
            <path class="eye eye-r" d="M129 111 Q142 95 153 112 Q140 106 129 111Z"/>
          </g>

          <!-- visor reflection -->
          <path d="M58 91 Q82 84 104 87" fill="none" stroke="#d9fffa" stroke-width="2" opacity=".14"/>
        </g>

        <!-- neck / hoodie -->
        <path d="M82 153 Q110 166 138 153 L148 180 Q110 198 72 180Z" fill="#075c4c"/>
        <path class="hoodie" d="M65 169 Q110 151 155 169 Q171 182 167 224 Q153 246 110 250 Q67 246 53 224 Q49 182 65 169Z"
              fill="url(#hoodie)" stroke="#064f43" stroke-width="4"/>

        <!-- hood -->
        <path d="M72 171 Q110 137 148 171 L140 190 Q110 178 80 190Z" fill="#08745b"/>
        <path d="M83 177 Q110 164 137 177" fill="none" stroke="#21d5a4" stroke-width="3" opacity=".5"/>

        <!-- hoodie strings -->
        <path d="M91 177 L95 210 M129 177 L125 210" stroke="#e9fffb" stroke-width="3" stroke-linecap="round"/>
        <circle cx="95" cy="211" r="4" fill="#e9fffb"/>
        <circle cx="125" cy="211" r="4" fill="#e9fffb"/>

        <!-- hoodie music logo -->
        <g transform="translate(99 190)" fill="#f4fffd">
          <rect x="12" y="0" width="4" height="24" rx="2"/>
          <path d="M15 1 L27 0 L27 5 L15 7Z"/>
          <ellipse cx="9" cy="24" rx="7" ry="5"/>
        </g>

        <!-- left arm + glove -->
        <g class="arm arm-l">
          <path d="M60 180 Q43 184 43 210 Q46 224 59 219 L73 193Z" fill="#07936f"/>
          <circle cx="48" cy="219" r="14" fill="url(#metal)"/>
          <circle cx="41" cy="211" r="6" fill="#f2ffff"/>
          <path d="M38 207 Q34 198 40 196 Q47 196 48 207" fill="#f2ffff"/>
        </g>

        <!-- right arm -->
        <g class="arm arm-r">
          <path d="M160 180 Q177 184 177 210 Q174 224 161 219 L147 193Z" fill="#07936f"/>
          <circle cx="172" cy="219" r="14" fill="url(#metal)"/>
        </g>

        <!-- pants -->
        <path d="M69 235 Q88 228 108 235 L106 279 L70 279Z" fill="#0b1114" stroke="#182327" stroke-width="4"/>
        <path d="M112 235 Q132 228 151 235 L150 279 L113 279Z" fill="#0b1114" stroke="#182327" stroke-width="4"/>
        <path d="M65 247 Q78 256 91 251 M121 251 Q136 256 151 247" stroke="#273338" stroke-width="4" fill="none"/>

        <!-- left shoe -->
        <g class="shoe shoe-l">
          <path d="M65 270 Q79 266 103 274 L101 294 Q84 302 57 294 L53 284Z" fill="url(#shoe)" stroke="#263238" stroke-width="3"/>
          <path d="M56 289 Q80 297 101 291 L104 301 Q78 310 54 301Z" fill="#eef8f7"/>
          <path d="M61 278 L91 281 M59 284 L88 287" stroke="#15dca7" stroke-width="4"/>
        </g>

        <!-- right shoe -->
        <g class="shoe shoe-r">
          <path d="M117 274 Q141 266 155 270 L167 284 L163 294 Q136 302 119 294Z" fill="url(#shoe)" stroke="#263238" stroke-width="3"/>
          <path d="M118 291 Q141 297 164 289 L166 301 Q141 310 116 301Z" fill="#eef8f7"/>
          <path d="M129 281 L159 278 M131 287 L162 284" stroke="#15dca7" stroke-width="4"/>
        </g>

        <!-- tiny green side detail -->
        <path d="M66 244 L56 250 L60 257 L70 251Z" fill="#12dca5"/>
      </g>
    </svg>`;

    function setState(state) {
        currentState = state || 'idle';
        if (!root) return;

        root.dataset.state = currentState;

        const dot = document.getElementById('melody-ai-status-dot');
        if (dot) {
            dot.className = 'melody-ai-status-dot';
            if (currentState === 'thinking') dot.classList.add('thinking');
            if (currentState === 'music') dot.classList.add('music');
            if (currentState === 'sad') dot.classList.add('sad');
        }
    }

    function init(hostId) {
        const host = document.getElementById(hostId);
        if (!host) return api;

        root = host;
        root.classList.add('melody-avatar-root');
        root.innerHTML = svg;
        setState(currentState);
        return api;
    }

    api = { init, setState };
    window.melodyAI3D = api;
})();