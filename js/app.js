// js/app.js
const API_BASE_URL = "https://melody-ehdi.onrender.com";

let currentPage = 1;
let loadingSongs = false;

window.isMusicPlaying = false;

// Lịch sử hội thoại Melody AI
window.aiConversation = [];

document.addEventListener('DOMContentLoaded', () => {
    window.songs = [];

    const token = localStorage.getItem('token');

    if (!token) {
        document.getElementById('login-modal')?.classList.remove('hidden');
        return;
    }

    document.getElementById('login-modal')?.classList.add('hidden');

    initPlayer();
    initPlayerUI();

    loadHome();
    updateGreeting();
    fetchSongs();
    checkAdmin();
});


// ====================== UTILS & UI UPDATES ======================

function checkAdmin() {
    let user = null;

    try {
        const storedUser = localStorage.getItem('user');
        user = storedUser ? JSON.parse(storedUser) : null;
    } catch (e) {
        user = null;
    }

    const mobileCenterBox =
        document.getElementById('mobile-center-btn-box');

    if (!mobileCenterBox) return;

    if (user && user.role === 'admin') {

        mobileCenterBox.innerHTML = `
            <button
                id="mobile-upload-btn"
                onclick="uploadMusic()"
                class="absolute -top-7 w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xl shadow-xl border-4 border-black active:scale-90 transition"
            >
                <i class="fas fa-plus"></i>
            </button>
        `;

    } else {

        mobileCenterBox.innerHTML = `
            <button
                id="mobile-room-btn"
                onclick="openRoomModal()"
                class="absolute -top-7 w-12 h-12 rounded-full bg-emerald-500 text-black flex items-center justify-center text-lg shadow-xl border-4 border-black active:scale-90 transition"
            >
                <i class="fas fa-headphones"></i>
            </button>
        `;
    }
}


function updateGreeting() {
    const greetingElement =
        document.getElementById('greeting-text');

    if (!greetingElement) return;

    const hour = new Date().getHours();

    let greeting =
        (hour >= 5 && hour < 12)
            ? "Chào buổi sáng 👋"
            : (hour >= 12 && hour < 18)
                ? "Chào buổi chiều ☀️"
                : (hour >= 18 && hour < 22)
                    ? "Chào buổi tối 🌙"
                    : "Làm tí nhạc đêm khuya nào ✨";

    greetingElement.innerText = greeting;
}


function getYoutubeId(url) {
    const regExp =
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/;

    const match = url.match(regExp);

    return match ? match[1] : '';
}


// ====================== CORE RENDER ======================

function loadHome() {

    let user = null;

    try {
        user = JSON.parse(localStorage.getItem('user'));
    } catch (e) {
        user = null;
    }

    const html = `
        <div class="p-8 pb-32">

            <!-- HEADER -->
            <div class="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">

                <div>

                    <h1
                        id="greeting-text"
                        class="text-4xl font-bold mb-2"
                    >
                        Chào buổi sáng 👋
                    </h1>

                    <p class="text-zinc-400 mb-2">

                        👤 USER:

                        <span class="text-white font-medium">
                            ${user?.username || ''}
                        </span>

                        <span class="ml-2 px-2 py-1 rounded bg-emerald-600 text-xs text-white">
                            ${user?.role || ''}
                        </span>

                    </p>

                    <p
                        id="song-count"
                        class="text-zinc-400"
                    >
                        Playlist của bạn (${window.songs.length} bài)
                    </p>

                </div>


                <!-- SEARCH / FILTER -->

                <div class="flex gap-3 w-full md:w-auto">

                    <div class="relative flex-1 md:w-96">

                        <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"></i>

                        <input
                            type="text"
                            id="search-input"
                            placeholder="Tìm bài hát..."
                            class="w-full bg-zinc-900 border border-zinc-700 rounded-2xl py-3 pl-12 pr-4 outline-none focus:border-emerald-500"
                            oninput="searchSongs(this.value)"
                        >

                    </div>


                    <select
                        id="category-filter"
                        onchange="filterByCategory(this.value)"
                        class="bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-3 outline-none"
                    >

                        <option value="">
                            🎵 Tất cả
                        </option>

                        <option value="V-Pop">
                            V-Pop
                        </option>

                        <option value="US-UK">
                            US-UK
                        </option>

                        <option value="Rap">
                            Rap
                        </option>

                        <option value="Lo-fi">
                            Lo-fi
                        </option>

                        <option value="EDM">
                            EDM
                        </option>

                        <option value="Remix">
                            Remix
                        </option>

                        <option value="Ballad">
                            Ballad
                        </option>

                    </select>


                    ${
                        user?.role === 'admin'
                            ? `
                                <button
                                    onclick="uploadMusic()"
                                    class="bg-emerald-600 hover:bg-emerald-500 px-6 py-3 rounded-2xl font-medium flex items-center gap-2"
                                >
                                    <i class="fas fa-plus"></i>
                                    Thêm
                                </button>
                            `
                            : ''
                    }

                </div>

            </div>


           <!-- ================= MELODY AI ================= -->

<div
    id="melody-ai-widget"
    class="fixed right-5 bottom-[24px] z-[9999] w-[410px] h-[620px] pointer-events-none"
>

    <!-- ================= AI PANEL ================= -->

    <div
        id="melody-ai-panel"
        class="hidden absolute right-0 bottom-[92px] z-[30] w-[410px] max-w-[calc(100vw-1.25rem)] h-[500px] pointer-events-auto bg-[#0b0b0d]/[.97] backdrop-blur-2xl border border-white/[.08] rounded-[26px] shadow-[0_25px_90px_rgba(0,0,0,.65)] overflow-hidden flex flex-col"
    >

        <!-- ================= HEADER ================= -->

        <div
            class="px-5 py-4 border-b border-white/[.07] bg-gradient-to-b from-white/[.035] to-transparent flex items-center justify-between shrink-0"
        >

            <div class="flex items-center gap-3">

                <!-- AI ICON -->

                <div
                    class="relative w-11 h-11 rounded-[15px] bg-emerald-500 text-black flex items-center justify-center shadow-[0_8px_25px_rgba(16,185,129,.18)]"
                >

                    <i
                        class="fas fa-wand-magic-sparkles text-[16px]"
                    ></i>

                    <span
                        class="absolute right-[-1px] bottom-[-1px] w-[11px] h-[11px] rounded-full bg-emerald-300 border-[2px] border-[#0b0b0d]"
                    ></span>

                </div>


                <!-- TITLE -->

                <div>

                    <div class="flex items-center gap-2">

                        <span
                            class="text-white font-bold text-[15px]"
                        >
                            Melody AI
                        </span>

                        <span
                            class="px-2 py-[2px] rounded-full bg-emerald-500/[.10] border border-emerald-500/[.12] text-emerald-400 text-[9px] font-semibold tracking-wide"
                        >
                            ONLINE
                        </span>

                    </div>

                    <p
                        class="text-zinc-500 text-[11px] mt-[2px]"
                    >
                        Trợ lý âm nhạc của bạn
                    </p>

                </div>

            </div>


            <!-- CLOSE -->

            <button
                type="button"
                onclick="closeMelodyAI()"
                class="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[.06] transition"
                title="Đóng"
            >

                <i class="fas fa-xmark text-[16px]"></i>

            </button>

        </div>


        <!-- ================= CHAT AREA ================= -->

        <div
            id="ai-result"
            class="flex-1 overflow-y-auto px-4 py-3 space-y-3"
        >

            <!-- AI MESSAGE -->

            <div
                class="flex items-start gap-2.5"
            >

                <!-- AI AVATAR -->

                <div
                    class="w-8 h-8 rounded-[11px] bg-emerald-500/[.10] text-emerald-400 flex items-center justify-center shrink-0 mt-1"
                >

                    <i
                        class="fas fa-wand-magic-sparkles text-[11px]"
                    ></i>

                </div>


                <div
                    class="max-w-[84%]"
                >

                    <!-- MESSAGE -->

                    <div
                        class="bg-[#17171b] border border-white/[.055] rounded-[18px] rounded-tl-[5px] px-3.5 py-3 text-[13px] leading-[1.55] text-zinc-200 shadow-sm"
                    >

                        <p>
                            Chào 👋
                            Tao là
                            <span class="font-semibold text-white">
                                Melody AI
                            </span>
                        </p>

                        <p class="text-zinc-400 mt-1">

                            Nói tao biết mày muốn nghe gì,
                            tao sẽ tìm nhạc phù hợp trong thư viện.

                        </p>

                    </div>


                    <!-- SUGGESTIONS -->

                    <div
                        class="flex flex-wrap gap-2 mt-3"
                    >

                        <button
                            type="button"
                            onclick="
                                document.getElementById('ai-mood-input').value='Nhạc chill nghe ban đêm';
                                document.getElementById('ai-mood-input').focus();
                            "
                            class="ai-suggestion-chip"
                        >
                            🌙 Chill ban đêm
                        </button>


                        <button
                            type="button"
                            onclick="
                                document.getElementById('ai-mood-input').value='Cho tao nhạc của Vũ';
                                document.getElementById('ai-mood-input').focus();
                            "
                            class="ai-suggestion-chip"
                        >
                            🎤 Nhạc của Vũ
                        </button>


                        <button
                            type="button"
                            onclick="
                                document.getElementById('ai-mood-input').value='Cho tao Rap Việt để tập gym';
                                document.getElementById('ai-mood-input').focus();
                            "
                            class="ai-suggestion-chip"
                        >
                            🔥 Rap tập gym
                        </button>

                    </div>

                </div>

            </div>

        </div>


        <!-- ================= INPUT ================= -->

        <div
            class="px-4 pb-3 pt-3 border-t border-white/[.07] bg-[#0b0b0d]/[.96] shrink-0"
        >

            <!-- INPUT BOX -->

            <div
                class="flex items-end gap-2 bg-[#18181c] border border-white/[.07] rounded-[19px] p-2 transition focus-within:border-emerald-500/[.35] focus-within:ring-2 focus-within:ring-emerald-500/[.08]"
            >

                <textarea
                    id="ai-mood-input"
                    rows="2"
                    placeholder="Nói với Melody AI..."
                    class="flex-1 min-w-0 bg-transparent resize-none outline-none px-2 py-1.5 text-[13px] text-white placeholder:text-zinc-600 leading-relaxed"
                    onkeydown="
                        if(event.key === 'Enter' && !event.shiftKey){
                            event.preventDefault();
                            createAIPlaylist();
                        }
                    "
                ></textarea>


                <!-- SEND -->

                <button
                    id="ai-mood-btn"
                    type="button"
                    onclick="createAIPlaylist()"
                    class="w-12 h-12 rounded-[15px] bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black flex items-center justify-center shrink-0 transition shadow-[0_7px_22px_rgba(16,185,129,.16)]"
                    title="Gửi"
                >

                    <i
                        class="fas fa-paper-plane text-[13px]"
                    ></i>

                </button>

            </div>


            <!-- FOOTER -->

            <div
                class="flex items-center justify-between px-1 pt-2 text-[10px] text-zinc-600"
            >

                <span>
                    Enter để gửi
                    <span class="text-zinc-700">•</span>
                    Shift+Enter xuống dòng
                </span>


                <button
                    type="button"
                    onclick="resetMelodyAIConversation()"
                    class="hover:text-zinc-300 transition"
                >
                    <i class="fas fa-rotate-right mr-1"></i>
                    Làm mới
                </button>

            </div>

        </div>

    </div>


    <!-- ================= FLOATING BUTTON ================= -->

    <button
        id="melody-ai-drag-btn"
        type="button"
        class="melody-ai-avatar-button select-none"
        style="touch-action:none; cursor:grab;"
        title="Melody AI — bấm để mở, kéo để di chuyển"
        aria-label="Mở Melody AI"
    >
        <span class="melody-ai-avatar-glow" aria-hidden="true"></span>
        <span id="melody-ai-avatar" class="melody-ai-avatar" aria-hidden="true"></span>
        <span id="melody-ai-status-dot" class="melody-ai-status-dot" aria-hidden="true"></span>
    </button>

</div>


<!-- ================= AI STYLE ================= -->

<style>

    /*
     * SUGGESTION CHIP
     */

    .melody-ai-avatar-button {
        position: absolute;
        right: -2px;
        bottom: 0;
        width: 104px;
        height: 132px;
        border: 0;
        padding: 0;
        background: transparent;
        display: flex;
        align-items: center;
        justify-content: center;
        filter: drop-shadow(0 14px 30px rgba(16,185,129,.20));
        transition: transform .2s ease, filter .2s ease;
    }

    .melody-ai-avatar-button:hover {
        transform: translateY(-3px) scale(1.03);
        filter: drop-shadow(0 18px 36px rgba(16,185,129,.30));
    }

    .melody-ai-avatar-button:active {
        transform: scale(.97);
    }

    .melody-ai-avatar {
        position: absolute;
        inset: 0;
        z-index: 2;
        pointer-events: none;
    }

    .melody-ai-avatar canvas {
        width: 100% !important;
        height: 100% !important;
        display: block;
    }

    .melody-ai-avatar-root {
        overflow: visible;
        display: flex;
        align-items: flex-end;
        justify-content: center;
    }

    .melody-avatar-svg {
        width: 104px;
        height: 132px;
        overflow: visible;
        display: block;
        transform-origin: 50% 88%;
        animation: melodyAvatarFloat 3.2s ease-in-out infinite;
    }

    .melody-avatar-svg .avatar-character {
        transform-origin: 110px 210px;
    }

    .melody-avatar-svg .face-eyes {
        transform-origin: 110px 112px;
    }

    .melody-avatar-svg .ear {
        transform-origin: 110px 120px;
    }

    .melody-avatar-svg .avatar-floor {
        animation: melodyAvatarGlow 2s ease-in-out infinite;
    }

    .melody-avatar-svg .eye {
        transition: opacity .2s ease;
    }

    .melody-avatar-svg .arm-l {
        transform-origin: 60px 195px;
    }

    .melody-avatar-svg .arm-r {
        transform-origin: 160px 195px;
    }

    .melody-avatar-svg .shoe-l,
    .melody-avatar-svg .shoe-r {
        transform-origin: 110px 285px;
    }

    .melody-avatar-root[data-state="thinking"] .melody-avatar-svg {
        animation-duration: 1.2s;
    }

    .melody-avatar-root[data-state="thinking"] .face-eyes {
        animation: melodyThinkingEyes .65s ease-in-out infinite alternate;
    }

    .melody-avatar-root[data-state="music"] .melody-avatar-svg {
        animation: melodyDance .42s ease-in-out infinite alternate;
    }

    .melody-avatar-root[data-state="music"] .arm-l {
        animation: melodyArmL .42s ease-in-out infinite alternate;
    }

    .melody-avatar-root[data-state="music"] .arm-r {
        animation: melodyArmR .42s ease-in-out infinite alternate;
    }

    .melody-avatar-root[data-state="sad"] .face-eyes {
        transform: translateY(4px) scaleY(.72);
    }

    @keyframes melodyAvatarFloat {
        0%, 100% { transform: translateY(0) rotate(-1deg); }
        50% { transform: translateY(-5px) rotate(1deg); }
    }

    @keyframes melodyAvatarGlow {
        0%, 100% { opacity: .10; transform: scaleX(.92); }
        50% { opacity: .24; transform: scaleX(1.05); }
    }

    @keyframes melodyThinkingEyes {
        from { transform: translateX(-7px); }
        to { transform: translateX(7px); }
    }

    @keyframes melodyDance {
        from { transform: translateY(2px) rotate(-3deg) scale(1); }
        to { transform: translateY(-5px) rotate(3deg) scale(1.015); }
    }

    @keyframes melodyArmL {
        from { transform: rotate(-4deg); }
        to { transform: rotate(16deg); }
    }

    @keyframes melodyArmR {
        from { transform: rotate(4deg); }
        to { transform: rotate(-16deg); }
    }



    .melody-ai-avatar-glow {
        position: absolute;
        width: 68px;
        height: 68px;
        border-radius: 999px;
        background: radial-gradient(circle, rgba(16,185,129,.25), rgba(16,185,129,0) 68%);
        filter: blur(2px);
        z-index: 1;
        pointer-events: none;
    }

    .melody-ai-status-dot {
        position: absolute;
        right: 4px;
        bottom: 4px;
        width: 11px;
        height: 11px;
        border-radius: 999px;
        background: #34d399;
        border: 2px solid #09090b;
        box-shadow: 0 0 14px rgba(52,211,153,.85);
        z-index: 5;
        pointer-events: none;
    }

    .melody-ai-status-dot.thinking {
        background: #fbbf24;
        box-shadow: 0 0 14px rgba(251,191,36,.85);
    }

    .melody-ai-status-dot.music {
        background: #22d3ee;
        box-shadow: 0 0 16px rgba(34,211,238,.9);
    }

    .melody-ai-status-dot.sad {
        background: #94a3b8;
        box-shadow: 0 0 10px rgba(148,163,184,.65);
    }

    @media (max-width: 640px) {
        .melody-ai-avatar-button {
            width: 92px;
            height: 116px;
            right: 0;
            bottom: 0;
        }

        .melody-avatar-svg {
            width: 92px;
            height: 116px;
        }
    }

    .ai-suggestion-chip {

        padding:
            7px
            11px;

        border-radius:
            999px;

        background:
            rgba(39,39,42,.72);

        border:
            1px solid
            rgba(255,255,255,.07);

        color:
            #a1a1aa;

        font-size:
            11px;

        line-height:
            1;

        transition:
            all
            .2s
            ease;

    }


    .ai-suggestion-chip:hover {

        background:
            rgba(16,185,129,.10);

        border-color:
            rgba(16,185,129,.28);

        color:
            #d1fae5;

        transform:
            translateY(-1px);

    }


    /*
     * AI RESULT SCROLLBAR
     */

    #ai-result::-webkit-scrollbar {

        width:
            5px;

    }


    #ai-result::-webkit-scrollbar-track {

        background:
            transparent;

    }


    #ai-result::-webkit-scrollbar-thumb {

        background:
            rgba(113,113,122,.35);

        border-radius:
            999px;

    }


    #ai-result::-webkit-scrollbar-thumb:hover {

        background:
            rgba(161,161,170,.45);

    }


    /*
     * TEXTAREA SCROLLBAR
     */

    #ai-mood-input::-webkit-scrollbar {

        width:
            4px;

    }


    #ai-mood-input::-webkit-scrollbar-thumb {

        background:
            rgba(113,113,122,.35);

        border-radius:
            999px;

    }


    /*
     * MOBILE
     */

    @media (max-width: 640px) {

        #melody-ai-panel {

            width:
                calc(100vw - 20px);

            max-width:
                calc(100vw - 20px);

            height:
                min(500px, calc(100vh - 150px));

        }

    }

</style>


            <!-- SONG LIST -->

            <div
                id="song-list"
                class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6"
            ></div>

        </div>
    `;

    const mainContent =
        document.getElementById('main-content');

    if (!mainContent) return;

    mainContent.innerHTML = html;

    /*
     * Đưa Melody AI ra khỏi main-content.
     * Tránh việc các container cha làm mất fixed position
     * hoặc che widget.
     */
   const aiWidget =
    document.getElementById('melody-ai-widget');

if (aiWidget) {
    document.body.appendChild(aiWidget);

    // Khởi tạo kéo-thả + avatar 3D Melody AI
    initMelodyAIDrag();
    window.melodyAI3D?.init('melody-ai-avatar');
}

    updateGreeting();

    renderSongList();
}


// ====================== MELODY AI ======================

function escapeHtml(value) {

    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}


function formatAIMood(mood) {

    const raw =
        typeof mood === 'object'
            ? (
                mood?.mood ||
                mood?.label ||
                mood?.name ||
                ''
            )
            : mood;

    const value =
        String(raw || '')
            .toLowerCase()
            .trim();

    const labels = {

        sad: 'Buồn 😢',

        happy: 'Vui vẻ 😊',

        relaxed: 'Thư giãn 😌',

        romantic: 'Lãng mạn ❤️',

        energetic: 'Năng lượng 🔥',

        chill: 'Chill 🎧',

        focus: 'Tập trung 🎯',

        angry: 'Bực bội 😤',

        nostalgic: 'Hoài niệm 🌙',

        lonely: 'Cô đơn 🌧️',

        neutral: 'Thư giãn 🎵'

    };

    return labels[value]
        || (
            raw
                ? escapeHtml(raw)
                : 'Không xác định 🎵'
        );
}


/* ====================== MELODY AI DRAG ====================== */
function initMelodyAIDrag() {

    const widget =
        document.getElementById('melody-ai-widget');

    const button =
        document.getElementById('melody-ai-drag-btn');

    if (!widget || !button) return;

    // Không gắn event nhiều lần khi loadHome() chạy lại
    if (button.dataset.dragReady === '1') return;
    button.dataset.dragReady = '1';

    let dragging = false;
    let moved = false;
    let suppressClick = false;

    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    button.addEventListener('pointerdown', (event) => {

        if (
            event.pointerType === 'mouse' &&
            event.button !== 0
        ) {
            return;
        }

        const rect =
            widget.getBoundingClientRect();

        // Chuyển vị trí hiện tại từ right/bottom
        // sang left/top để kéo chính xác.
        widget.style.left =
            `${rect.left}px`;

        widget.style.top =
            `${rect.top}px`;

        widget.style.right = 'auto';
        widget.style.bottom = 'auto';

        startX = event.clientX;
        startY = event.clientY;

        startLeft = rect.left;
        startTop = rect.top;

        dragging = true;
        moved = false;
        suppressClick = false;

        button.style.cursor = 'grabbing';

        try {
            button.setPointerCapture(
                event.pointerId
            );
        } catch (_) {}
    });


    button.addEventListener('pointermove', (event) => {

        if (!dragging) return;

        const dx =
            event.clientX - startX;

        const dy =
            event.clientY - startY;

        // Chỉ xem là kéo khi di chuyển > 5px
        if (
            Math.abs(dx) > 5 ||
            Math.abs(dy) > 5
        ) {
            moved = true;
            suppressClick = true;
        }

        if (!moved) return;

        event.preventDefault();

        const maxLeft =
            Math.max(
                0,
                window.innerWidth -
                widget.offsetWidth
            );

        const maxTop =
            Math.max(
                0,
                window.innerHeight -
                widget.offsetHeight
            );

        const nextLeft =
            Math.min(
                maxLeft,
                Math.max(
                    0,
                    startLeft + dx
                )
            );

        const nextTop =
            Math.min(
                maxTop,
                Math.max(
                    0,
                    startTop + dy
                )
            );

        widget.style.left =
            `${nextLeft}px`;

        widget.style.top =
            `${nextTop}px`;
    });


    button.addEventListener('pointerup', (event) => {

        if (!dragging) return;

        dragging = false;

        button.style.cursor = 'grab';

        try {
            button.releasePointerCapture(
                event.pointerId
            );
        } catch (_) {}

        /*
         * KHÔNG mở chat ở đây.
         *
         * Nếu chỉ click:
         *    pointerdown → pointerup → click
         *
         * Nếu kéo:
         *    pointerdown → pointermove → pointerup → click
         *    nhưng suppressClick = true
         */
    });


    button.addEventListener('pointercancel', (event) => {

        dragging = false;

        button.style.cursor = 'grab';

        try {
            button.releasePointerCapture(
                event.pointerId
            );
        } catch (_) {}

        suppressClick = true;

        setTimeout(() => {
            suppressClick = false;
        }, 50);
    });


    // CLICK mới là thứ mở/đóng khung chat
    button.addEventListener('click', (event) => {

        if (suppressClick) {

            event.preventDefault();
            event.stopPropagation();

            // Chặn click sinh ra sau thao tác kéo
            setTimeout(() => {
                suppressClick = false;
            }, 50);

            return;
        }

        openMelodyAI();
    });


    // Giữ bóng AI luôn nằm trong màn hình khi resize
    window.addEventListener('resize', () => {

        const rect =
            widget.getBoundingClientRect();

        const maxLeft =
            Math.max(
                0,
                window.innerWidth -
                widget.offsetWidth
            );

        const maxTop =
            Math.max(
                0,
                window.innerHeight -
                widget.offsetHeight
            );

        widget.style.left =
            `${Math.min(
                Math.max(0, rect.left),
                maxLeft
            )}px`;

        widget.style.top =
            `${Math.min(
                Math.max(0, rect.top),
                maxTop
            )}px`;

        widget.style.right = 'auto';
        widget.style.bottom = 'auto';
    });
}


/*
 * ======================
 * OPEN / CLOSE MELODY AI
 * ======================
 */

function openMelodyAI() {

    const panel =
        document.getElementById(
            'melody-ai-panel'
        );

    const input =
        document.getElementById(
            'ai-mood-input'
        );


    if (!panel) return;


    /*
     * Đang mở → đóng.
     */
    if (
        !panel.classList.contains(
            'hidden'
        )
    ) {

        panel.classList.add(
            'hidden'
        );

        return;
    }


    /*
     * Đang đóng → mở.
     */
    panel.classList.remove(
        'hidden'
    );


    setTimeout(() => {

        input?.focus();

    }, 100);

}

function closeMelodyAI() {

    document
        .getElementById('melody-ai-panel')
        ?.classList.add('hidden');
}


function createAIInputPlaceholder() {

    const input =
        document.getElementById('ai-mood-input');

    if (!input) return;

    input.placeholder =
        "Bạn muốn nghe gì? Nói tự nhiên cho Melody AI biết...";
}


// ====================== AI PLAYLIST ======================

async function createAIPlaylist() {

    const input =
        document.getElementById('ai-mood-input');

    const button =
        document.getElementById('ai-mood-btn');

    const result =
        document.getElementById('ai-result');

    if (!input || !button || !result) return;

    const message =
        input.value.trim();

    if (!message) {

        input.focus();

        return;
    }


    /*
     * =========================================================
     * LƯU LỊCH SỬ HỘI THOẠI
     * =========================================================
     *
     * Ví dụ:
     *
     * User:
     *   "Tao muốn nhạc nhẹ nhàng"
     *
     * AI:
     *   "Bạn thích nghệ sĩ nào?"
     *
     * User:
     *   "Vũ"
     *
     * Backend sẽ nhận được toàn bộ lịch sử.
     */

    if (!Array.isArray(window.aiConversation)) {
        window.aiConversation = [];
    }


    window.aiConversation.push({
        role: 'user',
        content: message
    });


    input.value = '';

    button.disabled = true;

    button.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i>';

    window.melodyAI3D?.setState('thinking');


    result.classList.remove('hidden');

    result.innerHTML = `
        <div class="flex items-center gap-3 text-zinc-400 text-sm py-3">

            <i class="fas fa-wand-magic-sparkles text-emerald-400"></i>

            <span>
                Melody AI đang suy nghĩ...
            </span>

        </div>
    `;


    try {

        const res =
            await fetch(
                `${API_BASE_URL}/api/ai/playlist`,
                {
                    method: 'POST',

                    headers: {
                        'Content-Type': 'application/json',

                        'Authorization':
                            localStorage.getItem('token') || ''
                    },

                    body: JSON.stringify({

                        message,

                        conversation:
                            window.aiConversation

                    })
                }
            );


        const text =
            await res.text();


        let data;


        try {

            data = JSON.parse(text);

        } catch (e) {

            throw new Error(
                `Server trả về dữ liệu không hợp lệ: ${text.substring(0, 150)}`
            );

        }


        if (!res.ok || !data.success) {

            throw new Error(
                data.error ||
                data.detail ||
                'Không thể xử lý yêu cầu AI'
            );

        }


        /*
         * =========================================================
         * AI MUỐN HỎI THÊM
         * =========================================================
         */

        if (data.type === 'question') {

            const question =
                data.question ||
                'Bạn muốn playlist này theo phong cách nào?';


            /*
             * Ghi câu hỏi AI vào conversation.
             */

            window.aiConversation.push({

                role: 'assistant',

                content: question

            });


            result.innerHTML = `

                <div class="mb-4">

                    <div class="flex items-center gap-3 mb-3">

                        <div
                            class="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center"
                        >
                            <i class="fas fa-wand-magic-sparkles text-emerald-400"></i>
                        </div>


                        <div>

                            <p class="text-white font-semibold">
                                Melody AI
                            </p>

                            <p class="text-xs text-zinc-500">
                                Cần thêm một chút thông tin
                            </p>

                        </div>

                    </div>


                    <div
                        class="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-zinc-200"
                    >
                        ${escapeHtml(question)}
                    </div>

                </div>

            `;


            input.placeholder =
                'Trả lời Melody AI...';

            window.melodyAI3D?.setState('idle');


            input.focus();


            return;
        }


        /*
         * =========================================================
         * AI ĐÃ ĐỦ THÔNG TIN → PLAYLIST
         * =========================================================
         */

        const songs =
            Array.isArray(data.songs)
                ? data.songs
                : [];


        /*
         * =========================================================
         * FRONTEND ARTIST LOCK
         * =========================================================
         *
         * Nếu backend nói request là:
         *
         * artists: ["Vũ"]
         *
         * thì frontend CHỈ được phép hiển thị:
         *
         * artist === "Vũ"
         *
         * Không cho:
         *
         * Vũ Cát Tường
         * Vũ.
         * nghệ sĩ khác
         * bài popular khác
         *
         * lọt vào playlist.
         */

        const requestedArtists =
            Array.isArray(data.query?.artists)

                ? data.query.artists
                    .map(
                        artist =>
                            String(
                                artist || ''
                            )
                            .trim()
                            .toLowerCase()
                    )
                    .filter(Boolean)

                : [];


        const filteredSongs =
            requestedArtists.length > 0

                ? songs.filter(song => {

                    const dbArtist =
                        String(
                            song?.artist || ''
                        )
                        .trim()
                        .toLowerCase();


                    return requestedArtists.includes(
                        dbArtist
                    );

                })

                : songs;


        /*
         * Nếu user yêu cầu nghệ sĩ cụ thể mà không có bài:
         * KHÔNG được lấy bài phổ biến của nghệ sĩ khác.
         */

        if (filteredSongs.length === 0) {

            result.innerHTML = `

                <div
                    class="text-zinc-400 text-sm py-3"
                >

                    😢 ${escapeHtml(
                        data.message ||
                        'Không tìm thấy bài phù hợp trong thư viện MelodyVN.'
                    )}

                </div>

            `;

            /*
             * Không push playlist rỗng vào conversation.
             */

            return;
        }


        /*
         * =========================================================
         * ĐƯA SONG VÀO WINDOW.SONGS
         * =========================================================
         */
if (data.action === 'append') {

    /*
     * APPEND:
     * Thêm bài mới vào queue AI hiện tại.
     * Không xóa danh sách cũ.
     */
    if (typeof window.appendAIQueue === 'function') {

        window.appendAIQueue(filteredSongs);

    } else {

        /*
         * Nếu player.js chưa có appendAIQueue
         * thì báo lỗi rõ ràng thay vì tự ghi đè queue.
         */
        throw new Error(
            'Player chưa hỗ trợ appendAIQueue.'
        );
    }

} else {

    /*
     * REPLACE:
     * Đây là hành vi mặc định.
     * Playlist AI mới sẽ thay playlist AI cũ.
     */
    if (typeof window.setAIQueue === 'function') {

        const started = window.setAIQueue(
            filteredSongs,
            true
        );

        if (!started) {

            throw new Error(
                'Không thể khởi động AI DJ queue.'
            );
        }

    } else {

        /*
         * FALLBACK:
         * Nếu player.js chưa expose setAIQueue
         * thì vẫn đảm bảo bài hát có trong window.songs.
         */

        if (!Array.isArray(window.songs)) {
            window.songs = [];
        }

        const existingIds = new Set(
            window.songs.map(
                song => Number(song.id)
            )
        );

        filteredSongs.forEach(song => {

            if (!existingIds.has(Number(song.id))) {

                window.songs.push(song);

            }

        });

    }

}


        window.melodyAI3D?.setState(data.action === 'append' ? 'music' : 'happy');

        /*
         * =========================================================
         * HIỂN THỊ MOOD
         * =========================================================
         */

        const moodText =
            formatAIMood(
                data.mood
            );


        const query =
            data.query || {};


        const descriptionParts = [];


        /*
         * ARTISTS
         */

        if (
            Array.isArray(query.artists) &&
            query.artists.length
        ) {

            descriptionParts.push(

                `🎤 ${
                    query.artists
                        .map(escapeHtml)
                        .join(', ')
                }`

            );

        } else if (query.artist) {

            descriptionParts.push(

                `🎤 ${
                    escapeHtml(
                        query.artist
                    )
                }`

            );

        }


        /*
         * KEYWORDS
         */

        if (
            Array.isArray(query.keywords) &&
            query.keywords.length
        ) {

            descriptionParts.push(

                `🔎 ${
                    query.keywords
                        .map(escapeHtml)
                        .join(', ')
                }`

            );

        }


        /*
         * ENERGY
         */

        if (query.energy) {

            const energyLabels = {

                low:
                    'Nhẹ nhàng',

                medium:
                    'Vừa phải',

                high:
                    'Năng lượng'

            };


            descriptionParts.push(

                energyLabels[query.energy] ||

                escapeHtml(
                    query.energy
                )

            );

        }


        /*
         * =========================================================
         * RENDER HEADER PLAYLIST
         * =========================================================
         */

        result.innerHTML = `

            <div class="mb-4">

                <div
                    class="flex items-center justify-between gap-3"
                >

                    <div>

                        <p
                            class="text-white font-semibold"
                        >
                            🎧 Playlist dành cho bạn
                        </p>


                        <p
                            class="text-xs text-zinc-400 mt-1"
                        >

                            ${moodText}

                            ${
                                descriptionParts.length

                                    ? ` · ${
                                        descriptionParts.join(
                                            ' · '
                                        )
                                    }`

                                    : ''
                            }

                            · ${filteredSongs.length} bài

                        </p>

                    </div>


                    <button
                        onclick="closeMelodyAI()"
                        class="text-zinc-500 hover:text-white"
                        title="Đóng"
                    >

                        <i class="fas fa-xmark"></i>

                    </button>

                </div>

            </div>


            <div
                id="ai-song-list"
                class="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-1"
            ></div>


            <button
                onclick="resetMelodyAIConversation()"
                class="mt-3 w-full py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs transition"
            >

                <i class="fas fa-rotate-right mr-1"></i>

                Tạo yêu cầu mới

            </button>

        `;


        /*
         * Render bài hát
         */

       renderCustomList(
    'ai-song-list',
    filteredSongs
);

if (
    typeof window.renderMelodyAIQueue === 'function'
) {
    window.renderMelodyAIQueue();
}


        /*
         * Ghi trạng thái vào conversation.
         */

        window.aiConversation.push({

            role: 'assistant',

            content:
                `Đã tạo playlist gồm ${filteredSongs.length} bài.`

        });


    } catch (err) {

        console.error(
            'AI PLAYLIST ERROR:',
            err
        );


        window.melodyAI3D?.setState('sad');

        result.innerHTML = `

            <div
                class="bg-red-500/10 border border-red-500/20 rounded-2xl p-3 text-sm text-red-300"
            >

                ❌ ${
                    escapeHtml(
                        err.message ||
                        'Có lỗi xảy ra với Melody AI.'
                    )
                }

            </div>

        `;

    } finally {

        button.disabled = false;

        button.innerHTML =
            '<i class="fas fa-paper-plane"></i>';

    }
}


// ====================== RESET AI ======================

function resetMelodyAIConversation() {

    window.aiConversation = [];
    window.melodyAI3D?.setState('idle');


    const input =
        document.getElementById(
            'ai-mood-input'
        );


    const result =
        document.getElementById(
            'ai-result'
        );


    if (input) {

        input.value = '';

        input.placeholder =
            'Bạn muốn nghe gì? Nói tự nhiên cho Melody AI biết...';

    }


    if (result) {

        result.classList.add(
            'hidden'
        );

        result.innerHTML = '';

    }


    input?.focus();
}


// ====================== SONG RENDER ======================

function renderSongList(
    songArray = window.songs
) {

    const container =
        document.getElementById(
            'song-list'
        );


    if (!container) return;


    if (
        !songArray ||
        songArray.length === 0
    ) {

        container.innerHTML = `

            <div
                class="col-span-full py-20 text-center text-zinc-400"
            >
                Không tìm thấy bài hát nào.
            </div>

        `;

        return;
    }


    container.innerHTML = '';


    let user = null;


    try {

        user =
            JSON.parse(
                localStorage.getItem(
                    'user'
                )
            );

    } catch (e) {

        user = null;

    }


    songArray.forEach(song => {

        const realIndex =
            window.songs.findIndex(
                s =>
                    Number(s.id) ===
                    Number(song.id)
            );


        const card =
            document.createElement(
                'div'
            );


        card.className =
            "song-card bg-zinc-900 rounded-2xl overflow-hidden cursor-pointer group relative";


        card.innerHTML = `

            <div
                class="relative group"
            >

                <img
                    src="${escapeHtml(song.cover)}"
                    class="w-full aspect-square object-cover transition group-hover:brightness-50"
                    onerror="this.src='https://picsum.photos/300/300'"
                >


                <div
                    class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                >

                    <i
                        class="fas fa-play text-white text-3xl"
                    ></i>

                </div>


                <iframe
                    id="preview-${song.id}"
                    class="absolute inset-0 w-full h-full opacity-0 pointer-events-none transition"
                    src=""
                    allow="autoplay"
                ></iframe>

            </div>


            <div class="p-4">

                <p
                    class="font-medium truncate text-white"
                >
                    ${escapeHtml(song.title)}
                </p>


                <p
                    class="text-sm text-zinc-400 truncate"
                >
                    ${escapeHtml(song.artist)}
                </p>

            </div>


            <div
                class="absolute top-3 right-3 flex flex-col gap-2 z-20"
            >

                <button
                    onclick="event.stopImmediatePropagation(); toggleLike(${song.id});"
                    class="bg-zinc-800/80 w-10 h-10 rounded-full flex items-center justify-center transition"
                >

                    <i
                        class="fas fa-heart ${
                            song.liked
                                ? 'text-red-500'
                                : 'text-white'
                        }"
                    ></i>

                </button>


                <button
                    onclick="event.stopImmediatePropagation(); addToQueue(${song.id});"
                    class="bg-emerald-500 w-10 h-10 rounded-full hidden group-hover:flex items-center justify-center transition"
                >

                    <i
                        class="fas fa-plus"
                    ></i>

                </button>


                ${
                    user?.role === 'admin'

                        ? `

                            <button
                                onclick="event.stopImmediatePropagation(); editSong(${realIndex});"
                                class="bg-yellow-500/90 w-10 h-10 rounded-full hidden group-hover:flex items-center justify-center transition"
                            >

                                <i
                                    class="fas fa-pen text-xs"
                                ></i>

                            </button>


                            <button
                                onclick="event.stopImmediatePropagation(); deleteSong(${song.id});"
                                class="bg-red-600/90 w-10 h-10 rounded-full hidden group-hover:flex items-center justify-center transition"
                            >

                                <i
                                    class="fas fa-trash-can text-xs"
                                ></i>

                            </button>

                        `

                        : ''
                }

            </div>

        `;


        card.onclick = () => {

            if (
                typeof playSong === 'function' &&
                realIndex >= 0
            ) {

                playSong(realIndex);

            }

        };


        /*
         * YouTube preview khi hover
         */

        card.onmouseenter = () => {

            if (
                !song.src ||
                (
                    !song.src.includes(
                        "youtube.com"
                    ) &&
                    !song.src.includes(
                        "youtu.be"
                    )
                )
            ) {

                return;

            }


            const videoId =
                getYoutubeId(
                    song.src
                );


            const iframe =
                document.getElementById(
                    `preview-${song.id}`
                );


            if (
                iframe &&
                videoId
            ) {

                iframe.src =
                    `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&controls=0&playsinline=1&rel=0&modestbranding=1`;


                iframe.classList.remove(
                    'opacity-0'
                );

            }

        };


        card.onmouseleave = () => {

            const iframe =
                document.getElementById(
                    `preview-${song.id}`
                );


            if (iframe) {

                iframe.src = '';

                iframe.classList.add(
                    'opacity-0'
                );

            }

        };


        container.appendChild(
            card
        );

    });
}


// ====================== DATA ACTIONS ======================

async function fetchSongs() {

    try {

        const res =
            await fetch(
                `${API_BASE_URL}/api/songs`
            );


        if (!res.ok) {

            throw new Error(
                `HTTP ${res.status}`
            );

        }


        const data =
            await res.json();


        const token =
            localStorage.getItem(
                'token'
            );


        let likedIds = [];


        if (token) {

            const libRes =
                await fetch(
                    `${API_BASE_URL}/api/library`,
                    {
                        headers: {
                            Authorization:
                                token
                        }
                    }
                );


            if (libRes.ok) {

                const library =
                    await libRes.json();


                likedIds =
                    library.map(
                        s => s.id
                    );

            }

        }


        window.songs =
            data.map(
                s => ({
                    ...s,

                    liked:
                        likedIds.includes(
                            s.id
                        )
                })
            );


        const countEl =
            document.getElementById(
                'song-count'
            );


        if (countEl) {

            countEl.innerText =
                `Playlist của bạn (${window.songs.length} bài)`;

        }


        renderSongList();

    } catch (err) {

        console.error(
            "Lỗi khi tải nhạc:",
            err
        );

    }
}


// ====================== SONG CRUD ======================

async function submitSong() {

    const title =
        document.getElementById(
            'song-title'
        ).value.trim();


    const artist =
        document.getElementById(
            'song-artist'
        ).value.trim();


    const src =
        document.getElementById(
            'song-src'
        ).value.trim();


    const category =
        document.getElementById(
            'song-category'
        ).value;


    const cover =
        document.getElementById(
            'song-cover'
        ).value.trim()
        ||
        `https://picsum.photos/seed/${Math.floor(Math.random() * 1000)}/300/300`;


    if (!title || !src) {

        return alert(
            "Thiếu Tên bài hoặc Link nhạc!"
        );

    }


    try {

        const res =
            await fetch(
                `${API_BASE_URL}/api/songs`,
                {

                    method: 'POST',

                    headers: {

                        'Content-Type':
                            'application/json',

                        Authorization:
                            localStorage.getItem(
                                'token'
                            )

                    },

                    body:
                        JSON.stringify({

                            title,

                            artist:
                                artist ||
                                "Nghệ sĩ ẩn danh",

                            src,

                            cover,

                            category,

                            type:
                                (
                                    src.includes(
                                        "youtube.com"
                                    ) ||
                                    src.includes(
                                        "youtu.be"
                                    )
                                )

                                    ? 'youtube'
                                    : 'mp3'

                        })

                }
            );


        if (res.ok) {

            await fetchSongs();

            closeAddSongModal();

            alert(
                "✅ Thành công!"
            );

        }

    } catch (err) {

        alert(
            "❌ Lỗi kết nối"
        );

    }
}


async function deleteSong(id) {

    if (
        !confirm(
            "Xóa bài hát này?"
        )
    ) return;


    try {

        await fetch(
            `${API_BASE_URL}/api/songs/${id}`,
            {

                method: 'DELETE',

                headers: {

                    Authorization:
                        localStorage.getItem(
                            'token'
                        )

                }

            }
        );


        fetchSongs();

    } catch (err) {

        console.log(
            err
        );

    }
}


async function updateSong() {

    const index =
        window.editingIndex;


    if (
        index === undefined ||
        !window.songs[index]
    ) {

        return;

    }


    const songId =
        window.songs[index].id;


    const body = {

        title:
            document.getElementById(
                'edit-song-title'
            ).value.trim(),

        artist:
            document.getElementById(
                'edit-song-artist'
            ).value.trim(),

        src:
            document.getElementById(
                'edit-song-src'
            ).value.trim(),

        cover:
            document.getElementById(
                'edit-song-cover'
            ).value.trim(),

        category:
            document.getElementById(
                'edit-song-category'
            ).value

    };


    try {

        const res =
            await fetch(
                `${API_BASE_URL}/api/songs/${songId}`,
                {

                    method: 'PUT',

                    headers: {

                        'Content-Type':
                            'application/json',

                        Authorization:
                            localStorage.getItem(
                                'token'
                            )

                    },

                    body:
                        JSON.stringify(
                            body
                        )

                }
            );


        if (res.ok) {

            alert(
                "✅ Cập nhật thành công!"
            );


            closeEditSongModal();


            await fetchSongs();

        }

    } catch (err) {

        alert(
            "❌ Lỗi kết nối"
        );

    }
}


async function toggleLike(id) {
    try {
        const token = localStorage.getItem('token');

        if (!token) {
            alert('⚠️ Vui lòng đăng nhập để sử dụng thư viện yêu thích');
            return;
        }

        const song = window.songs?.find(
            s => Number(s.id) === Number(id)
        );

        const currentLiked = !!song?.liked;

        const res = await fetch(
            `${API_BASE_URL}/api/favorite/${id}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token
                }
            }
        );

        const data = await res.json();

        if (!res.ok) {
            throw new Error(
                data.error || 'Không thể cập nhật thư viện'
            );
        }

        // Cập nhật trạng thái ngay trên frontend
        if (song) {
            song.liked = !!data.liked;
        }

        alert(
            data.liked
                ? '❤️ Đã thêm vào thư viện'
                : '💔 Đã xóa khỏi thư viện'
        );

        // Đồng bộ lại dữ liệu sau khi thao tác
        await fetchSongs();

    } catch (err) {
        console.error('❌ FAVORITE ERROR:', err);
        alert(`❌ ${err.message}`);
    }
}

// ====================== NAVIGATION ======================

async function showLibrary() {

    try {

        const res =
            await fetch(
                `${API_BASE_URL}/api/library`,
                {

                    headers: {

                        Authorization:
                            localStorage.getItem(
                                'token'
                            )

                    }

                }
            );


        const likedSongs =
            await res.json();


        document.getElementById(
            'main-content'
        ).innerHTML = `

            <div class="p-8 pb-32">

                <h1
                    class="text-4xl font-bold mb-2"
                >
                    ❤️ Thư viện yêu thích
                </h1>


                <p
                    class="text-zinc-400 mb-8"
                >
                    ${likedSongs.length} bài hát
                </p>


                <div
                    id="song-list"
                    class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"
                ></div>

            </div>

        `;


        renderSongList(
            likedSongs
        );

    } catch (err) {

        console.log(
            err
        );

    }
}


async function showDiscover() {

    try {

        const res =
            await fetch(
                `${API_BASE_URL}/api/discover`
            );


        const data =
            await res.json();


        document.getElementById(
            'main-content'
        ).innerHTML = `

            <div
                class="p-8 space-y-12 pb-32"
            >

                <div
                    class="rounded-3xl p-10 bg-gradient-to-r from-emerald-500 to-cyan-500"
                >

                    <h1
                        class="text-5xl font-black mb-3"
                    >
                        🎵 KHÁM PHÁ
                    </h1>


                    <p
                        class="text-lg text-white/90"
                    >
                        Dành riêng cho bạn
                    </p>

                </div>


                <div>

                    <h2
                        class="text-2xl font-bold mb-6"
                    >
                        🎧 Dành cho bạn
                    </h2>


                    <div
                        id="recommended-list"
                        class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"
                    ></div>

                </div>


                <div>

                    <h2
                        class="text-2xl font-bold mb-6"
                    >
                        🔥 Trending
                    </h2>


                    <div
                        id="trending-list"
                        class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"
                    ></div>

                </div>

            </div>

        `;


        renderCustomList(
            'recommended-list',
            data.recommended || []
        );


        renderCustomList(
            'trending-list',
            data.trending || []
        );

    } catch (err) {

        console.log(
            err
        );

    }
}


// ====================== CUSTOM SONG LIST ======================

function renderCustomList(
    containerId,
    songs
) {

    const container =
        document.getElementById(
            containerId
        );


    if (!container) return;


    if (
        !songs ||
        songs.length === 0
    ) {

        container.innerHTML = `

            <div
                class="col-span-full text-zinc-400 py-5"
            >
                Không tìm thấy bài phù hợp.
            </div>

        `;

        return;
    }


    container.innerHTML = '';


    songs.forEach(song => {

        const realIndex =
            window.songs.findIndex(
                s =>
                    Number(s.id) ===
                    Number(song.id)
            );


        const card =
            document.createElement(
                'div'
            );


        card.className =
            "song-card bg-zinc-900 rounded-2xl overflow-hidden cursor-pointer group relative";


        card.innerHTML = `

            <div
                class="relative"
            >

                <img
                    src="${escapeHtml(song.cover)}"
                    class="w-full aspect-square object-cover"
                    onerror="this.src='https://picsum.photos/300/300'"
                >

            </div>


            <div
                class="p-4 flex justify-between items-center"
            >

                <div class="min-w-0">

                    <p
                        class="font-medium truncate"
                    >
                        ${escapeHtml(song.title)}
                    </p>


                    <p
                        class="text-sm text-zinc-400 truncate"
                    >
                        ${escapeHtml(song.artist)}
                    </p>

                </div>


                <button
                    onclick="event.stopPropagation(); addToQueue(${song.id})"
                    class="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0"
                >

                    <i
                        class="fas fa-plus text-sm"
                    ></i>

                </button>

            </div>

        `;


        card.onclick = () => {

            if (
                typeof playSong === 'function' &&
                realIndex >= 0
            ) {

                playSong(
                    realIndex
                );

            }

        };


        container.appendChild(
            card
        );

    });
}


// ====================== AUTH ======================

async function login() {

    const username =
        document.getElementById(
            'login-username'
        ).value;


    const password =
        document.getElementById(
            'login-password'
        ).value;


    try {

        const res =
            await fetch(
                `${API_BASE_URL}/api/login`,
                {

                    method: 'POST',

                    headers: {

                        'Content-Type':
                            'application/json'

                    },

                    body:
                        JSON.stringify({

                            username,

                            password

                        })

                }
            );


        const data =
            await res.json();


        if (!data.token) {

            return alert(
                'Sai tài khoản'
            );

        }


        localStorage.setItem(
            'token',
            data.token
        );


        localStorage.setItem(
            'user',
            JSON.stringify(
                data.user
            )
        );


        location.reload();

    } catch (err) {

        console.log(
            err
        );

    }
}


async function register() {

    const username =
        document.getElementById(
            'register-username'
        ).value;


    const password =
        document.getElementById(
            'register-password'
        ).value;


    const confirmPassword =
        document.getElementById(
            'register-confirm-password'
        ).value;


    if (
        password !==
        confirmPassword
    ) {

        return alert(
            '❌ Mật khẩu không khớp'
        );

    }


    try {

        const res =
            await fetch(
                `${API_BASE_URL}/api/register`,
                {

                    method: 'POST',

                    headers: {

                        'Content-Type':
                            'application/json'

                    },

                    body:
                        JSON.stringify({

                            username,

                            password

                        })

                }
            );


        const data =
            await res.json();


        if (!data.success) {

            return alert(

                data.error ||

                'Thất bại'

            );

        }


        alert(
            '✅ Đăng ký thành công'
        );


        closeRegister();

    } catch (err) {

        console.log(
            err
        );

    }
}


function logout() {

    let userData = null;


    try {

        userData =
            JSON.parse(
                localStorage.getItem(
                    'user'
                )
            );

    } catch (e) {}


    if (
        confirm(
            `${userData?.username || 'Bạn'} muốn đăng xuất à?`
        )
    ) {

        localStorage.removeItem(
            'token'
        );


        localStorage.removeItem(
            'user'
        );


        location.reload();

    }
}


function showProfile() {

    let user = null;


    try {

        user =
            JSON.parse(
                localStorage.getItem(
                    'user'
                )
            );

    } catch (e) {}


    document.getElementById(
        'main-content'
    ).innerHTML = `

        <div
            class="p-6"
        >

            <div
                class="bg-zinc-900 rounded-3xl p-6 flex flex-col items-center text-center"
            >

                <div
                    class="w-24 h-24 rounded-full bg-emerald-500 flex items-center justify-center text-4xl font-bold mb-4"
                >

                    ${
                        user?.username
                            ?.charAt(0)
                            ?.toUpperCase() ||
                        'U'
                    }

                </div>


                <h1
                    class="text-3xl font-bold mb-2"
                >
                    ${escapeHtml(
                        user?.username ||
                        'Unknown'
                    )}
                </h1>


                <p
                    class="text-zinc-400"
                >

                    Role:

                    <span
                        class="text-emerald-400"
                    >
                        ${escapeHtml(
                            user?.role ||
                            'user'
                        )}
                    </span>

                </p>


                <button
                    onclick="logout()"
                    class="mt-6 bg-red-500 px-6 py-3 rounded-2xl font-semibold"
                >

                    <i
                        class="fas fa-right-from-bracket mr-2"
                    ></i>

                    Đăng xuất

                </button>

            </div>

        </div>

    `;
}


// ====================== ROOM BUBBLE ======================

async function checkRoomBubble() {

    const token =
        localStorage.getItem(
            "token"
        );


    const btn =
        document.getElementById(
            "room-bubble-btn"
        );


    if (!btn) return;


    if (!token) {

        btn.classList.add(
            "hidden"
        );

        return;
    }


    try {

        const res =
            await fetch(
                "http://localhost:3000/api/me",
                {

                    headers: {

                        Authorization:
                            "Bearer " +
                            token

                    }

                }
            );


        const user =
            await res.json();


        if (
            user.role === "admin"
        ) {

            btn.classList.add(
                "hidden"
            );

        } else {

            btn.classList.remove(
                "hidden"
            );

        }

    } catch (err) {

        btn.classList.add(
            "hidden"
        );

    }
}


// ====================== GLOBAL EXPORTS ======================

Object.assign(window, {

    goHome: () => {

        loadHome();

        updateGreeting();

        fetchSongs();

        checkAdmin();


        document
            .getElementById(
                'main-content'
            )
            ?.scrollTo({

                top: 0,

                behavior: 'smooth'

            });

    },


    uploadMusic: () =>
        document
            .getElementById(
                'add-song-modal'
            )
            ?.classList.replace(
                'hidden',
                'flex'
            ),


    closeAddSongModal: () =>
        document
            .getElementById(
                'add-song-modal'
            )
            ?.classList.replace(
                'flex',
                'hidden'
            ),


    editSong: (index) => {

        const s =
            window.songs[index];


        if (!s) return;


        window.editingIndex =
            index;


        [
            'edit-song-title',
            'edit-song-artist',
            'edit-song-src',
            'edit-song-cover',
            'edit-song-category'
        ].forEach(id => {

            const el =
                document.getElementById(
                    id
                );


            if (el) {

                el.value =
                    s[
                        id.replace(
                            'edit-song-',
                            ''
                        )
                    ] || "";

            }

        });


        document
            .getElementById(
                'edit-song-modal'
            )
            ?.classList.replace(
                'hidden',
                'flex'
            );

    },


    closeEditSongModal: () =>
        document
            .getElementById(
                'edit-song-modal'
            )
            ?.classList.replace(
                'flex',
                'hidden'
            ),


    searchSongs: (kw) => {

        kw =
            kw
                .toLowerCase()
                .trim();


        renderSongList(

            kw

                ? window.songs.filter(
                    s =>

                        s.title
                            .toLowerCase()
                            .includes(
                                kw
                            ) ||

                        s.artist
                            .toLowerCase()
                            .includes(
                                kw
                            )
                )

                : window.songs

        );

    },


    filterByCategory: (cat) => {

        renderSongList(

            cat

                ? window.songs.filter(
                    s =>

                        (
                            s.category ||
                            ""
                        )
                        .toLowerCase() ===
                        cat.toLowerCase()

                )

                : window.songs

        );

    },


    focusSearch: () => {

        window.goHome();


        setTimeout(() => {

            const input =
                document.getElementById(
                    'search-input'
                );


            if (input) {

                input.focus();


                input.scrollIntoView({

                    behavior:
                        'smooth'

                });

            }

        }, 400);

    },


    setActiveMobileNav: (btn) => {

        document
            .querySelectorAll(
                '.mobile-nav-btn'
            )
            .forEach(
                b =>
                    b.classList.remove(
                        'active-mobile-nav'
                    )
            );


        btn.classList.add(
            'active-mobile-nav'
        );

    },



    showRegister: () =>
        document
            .getElementById(
                'register-modal'
            )
            .classList.replace(
                'hidden',
                'flex'
            ),


    closeRegister: () =>
        document
            .getElementById(
                'register-modal'
            )
            .classList.replace(
                'flex',
                'hidden'
            ),


    login,

    register,

    logout,

    showProfile,

    showLibrary,

    showDiscover,

    toggleLike,

    submitSong,

    updateSong,

    deleteSong,

    fetchSongs,

    checkRoomBubble,


    createAIPlaylist,

    openMelodyAI,

    closeMelodyAI,

    resetMelodyAIConversation

});
function renderMelodyAIQueue() {

    const container =
        document.getElementById('ai-song-list');

    if (
        !container ||
        typeof window.getCurrentPlayQueue !== 'function'
    ) {
        return;
    }

    const queue =
        window.getCurrentPlayQueue();

    const ids =
        Array.isArray(window.aiQueueSongIds)
            ? window.aiQueueSongIds
            : [];

    const queueSongs =
        queue.filter(song =>
            ids.includes(Number(song.id))
        );

    // AI DJ đã phát hết
    if (queueSongs.length === 0) {

        container.innerHTML = `
            <div
                class="col-span-full text-center text-zinc-500 text-sm py-5"
            >
                AI DJ đã phát hết danh sách 🎧
            </div>
        `;

        return;
    }

   container.innerHTML = queueSongs.map(song => {

    const cover =
        song.cover ||
        'https://placehold.co/300x300?text=Music';

    return `
        <div
            class="group relative bg-zinc-900/70 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition"
        >

            <!-- Ảnh -->
            <div
                class="aspect-square overflow-hidden cursor-pointer"
                onclick="playSong(window.songs.findIndex(s => Number(s.id) === Number(${song.id})))"
            >
                <img
                    src="${escapeHtml(cover)}"
                    alt="${escapeHtml(song.title || '')}"
                    class="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                >
            </div>

            <!-- Thông tin -->
            <div class="p-2.5">

                <p
                    class="text-white text-sm font-medium truncate"
                    title="${escapeHtml(song.title || '')}"
                >
                    ${escapeHtml(song.title || 'Không có tên')}
                </p>

                <p
                    class="text-zinc-500 text-xs truncate mt-0.5"
                    title="${escapeHtml(song.artist || '')}"
                >
                    ${escapeHtml(song.artist || 'Unknown')}
                </p>

            </div>

            <!-- Nút xóa -->
            <button
                onclick="event.stopPropagation(); removeMelodyAIQueue(${Number(song.id)})"
                class="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 hover:bg-red-500 text-zinc-300 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                title="Xóa khỏi AI Playlist"
            >
                <i class="fas fa-xmark text-xs"></i>
            </button>

        </div>
    `;
}).join('');
}

window.renderMelodyAIQueue =
    renderMelodyAIQueue;

    function removeMelodyAIQueue(songId) {

    const queue =
        typeof window.getCurrentPlayQueue === 'function'
            ? window.getCurrentPlayQueue()
            : [];

    const index = queue.findIndex(
        song => Number(song.id) === Number(songId)
    );

    if (index === -1) {
        return;
    }

    // Dùng hàm removeQueue() có sẵn trong player.js
    if (typeof window.removeQueue === 'function') {
        window.removeQueue(index);
    }

    // Cập nhật lại danh sách AI
    if (typeof window.renderMelodyAIQueue === 'function') {
        window.renderMelodyAIQueue();
    }
}

window.removeMelodyAIQueue =
    removeMelodyAIQueue;