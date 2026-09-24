/* js/voice.js - Melody Voice Assistant. Wake phrase: Hey Melody. */
(() => {
    'use strict';

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    const state = {
        supported: !!SpeechRecognition,
        enabled: false,
        listening: false,
        armed: false,
        speaking: false,
        recognition: null,
        restartTimer: null,
        armTimer: null
    };

    const els = {};

    const normalize = text =>
        String(text || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[.,!?;:]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

    function setStatus(text, type = 'idle') {
        if (els.status) {
            els.status.textContent = text;
            els.status.dataset.state = type;
        }

        const root = document.getElementById('melody-ai-widget');
        root?.classList.toggle('melody-voice-listening', type === 'listening');
        root?.classList.toggle('melody-voice-enabled', state.enabled);

        if (type === 'listening') {
            window.melodyAI3D?.setState('listening');
        }
    }

    function speak(text) {
        if (!('speechSynthesis' in window) || !text) return;

        state.speaking = true;

        try {
            state.recognition?.stop();
        } catch (_) {}

        speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'vi-VN';
        utterance.rate = 1.03;
        utterance.pitch = 1.02;

        utterance.onend = utterance.onerror = () => {
            state.speaking = false;
            if (state.enabled) startRecognition();
        };

        speechSynthesis.speak(utterance);
    }

    function flashListening() {
        state.armed = true;
        clearTimeout(state.armTimer);

        setStatus('🎙️ Listening...', 'listening');
        window.melodyAI3D?.setState('listening');

        state.armTimer = setTimeout(() => {
            state.armed = false;

            if (state.enabled) {
                setStatus('Say “Hey Melody”...');
                window.melodyAI3D?.setState(
                    window.isMusicPlaying ? 'music' : 'idle'
                );
            }
        }, 9000);
    }

    function getVolume() {
        const input = document.getElementById('volume-control');
        return input ? Number(input.value) : 100;
    }

    function setVolume(value) {
        const volume = Math.max(0, Math.min(100, Number(value)));
        const input = document.getElementById('volume-control');

        if (input) {
            input.value = String(volume);
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }

        return volume;
    }

    function runPlayerCommand(command) {
        const c = normalize(command);
        const playerState = window.getMelodyPlayerState?.() || {};

        // Tạm dừng: hỗ trợ câu tự nhiên như
        // "tạm dừng bài đang hát", "dừng bài này", "pause nhạc".
        if (/(tam dung|dung nhac|dung bai|dung lai|pause|stop|ngung nhac)/.test(c)) {
            if (typeof window.pausePlayback === 'function') {
                const changed = window.pausePlayback();
                speak(changed ? 'Đã tạm dừng bài đang phát.' : 'Nhạc hiện đang tạm dừng rồi.');
            } else if (playerState.isPlaying) {
                window.togglePlay?.();
                speak('Đã tạm dừng bài đang phát.');
            } else {
                speak('Nhạc hiện đang tạm dừng rồi.');
            }
            return true;
        }

        // Xóa toàn bộ các bài đã thêm vào AI Playlist / hàng đợi.
        // Không xóa bài đang phát; chỉ làm sạch queue.
        if (
            /(xoa|xoa het|xoa tat ca|clear|delete|remove)/.test(c) &&
            /(playlist|hang doi|danh sach|bai da them|bai vua them)/.test(c)
        ) {
            if (typeof window.clearQueue === 'function') {
                window.clearQueue();
                speak('Đã xóa các bài đã thêm vào playlist.');
            } else {
                speak('Melody chưa thể xóa playlist lúc này.');
            }
            return true;
        }

        if (/^(phat nhac|phat tiep|tiep tuc|resume|play)/.test(c)) {
            if (!playerState.isPlaying) window.togglePlay?.();
            speak('Đang phát nhạc.');
            return true;
        }

        if (/^(bai tiep|bai hat tiep|next|chuyen bai|qua bai)/.test(c)) {
            window.nextSong?.();
            speak('Đã chuyển bài.');
            return true;
        }

        if (/^(bai truoc|quay lai bai truoc|previous|prev)/.test(c)) {
            window.prevSong?.();
            speak('Đã quay lại bài trước.');
            return true;
        }

        if (/^(mo chat|mo tro ly|mo melody)/.test(c)) {
            window.openMelodyAI?.();
            return true;
        }

        if (/^(dong chat|dong tro ly)/.test(c)) {
            window.closeMelodyAI?.();
            return true;
        }

        if (/^(tang am luong|am luong tang|to hon|tang volume)/.test(c)) {
            speak('Âm lượng ' + setVolume(getVolume() + 10) + ' phần trăm.');
            return true;
        }

        if (/^(giam am luong|am luong giam|nho hon|giam volume)/.test(c)) {
            speak('Âm lượng ' + setVolume(getVolume() - 10) + ' phần trăm.');
            return true;
        }

        if (/^(tat am thanh|mute|im lang)/.test(c)) {
            setVolume(0);
            speak('Đã tắt âm thanh.');
            return true;
        }

        const volumeMatch = c.match(
            /(?:am luong|volume)\s*(?:con|o muc|la)?\s*(\d{1,3})/
        );

        if (volumeMatch) {
            speak('Âm lượng ' + setVolume(volumeMatch[1]) + ' phần trăm.');
            return true;
        }

        const speedMatch = c.match(
            /(?:toc do|speed)\s*(0\.5|0\.75|1|1\.25|1\.5|2)/
        );

        if (speedMatch) {
            const input = document.getElementById('speed-control');

            if (input) {
                input.value = speedMatch[1];
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }

            speak('Tốc độ ' + speedMatch[1] + ' lần.');
            return true;
        }

        if (/^(yeu thich|like bai nay|them vao yeu thich)/.test(c)) {
            window.toggleCurrentSongLike?.();
            speak('Đã cập nhật bài hát yêu thích.');
            return true;
        }

        return false;
    }

    async function runCommand(raw) {
        const command = String(raw || '').trim();
        if (!command) return;

        if (runPlayerCommand(command)) return;

        const input = document.getElementById('ai-mood-input');

        if (!input || typeof window.createAIPlaylist !== 'function') {
            speak('Melody chưa sẵn sàng xử lý yêu cầu này.');
            return;
        }

        input.value = command;
        window.melodyAI3D?.setState('thinking');
        setStatus('🤔 Thinking...', 'thinking');

        try {
            await window.createAIPlaylist();
            speak('Xong rồi. Melody đã xử lý yêu cầu của bạn.');
        } catch (error) {
            console.error('Melody voice command error:', error);
            window.melodyAI3D?.setState('sad');
            speak('Melody chưa xử lý được yêu cầu này.');
        } finally {
            if (state.enabled) setStatus('Say “Hey Melody”...');
        }
    }

    function handleFinalTranscript(text) {
        if (!text || state.speaking) return;

        const value = normalize(text);

        // SpeechRecognition đôi khi nhận "Hey Melody" thành các biến thể
        // như "hey melodi", "hay melody", "he melody", "hey melly".
        const wakePatterns = [
            'hey melody',
            'hey melodi',
            'hay melody',
            'hay melodi',
            'he melody',
            'hê melody',
            'hey melly',
            'hey mel'
        ];

        let wakeIndex = -1;
        let wakePhrase = '';

        for (const phrase of wakePatterns) {
            const i = value.indexOf(phrase);
            if (i !== -1 && (wakeIndex === -1 || i < wakeIndex)) {
                wakeIndex = i;
                wakePhrase = phrase;
            }
        }

        if (wakeIndex !== -1) {
            const after = value.slice(wakeIndex + wakePhrase.length).trim();

            if (!after) {
                flashListening();
                speak('Tôi nghe đây. Nói đi.');
                return;
            }

            state.armed = false;
            clearTimeout(state.armTimer);
            runCommand(after);
            return;
        }

        if (state.armed) {
            state.armed = false;
            clearTimeout(state.armTimer);
            runCommand(text);
        }
    }

    function createRecognition() {
        if (!SpeechRecognition) return null;

        const recognition = new SpeechRecognition();

        recognition.lang = 'vi-VN';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 3;

        recognition.onstart = () => {
            state.listening = true;

            if (!state.armed && !state.speaking) {
                setStatus('Say “Hey Melody”...');
            }
        };

        recognition.onresult = event => {
            let transcript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    transcript += ' ' + event.results[i][0].transcript;
                }
            }

            if (transcript.trim()) {
                handleFinalTranscript(transcript.trim());
            }
        };

        recognition.onerror = event => {
            console.warn('Melody voice:', event.error);

            if (
                event.error === 'not-allowed' ||
                event.error === 'service-not-allowed'
            ) {
                state.enabled = false;
                state.listening = false;
                setStatus('Microphone chưa được cấp quyền', 'error');
                updateButton();
                return;
            }

            if (event.error !== 'aborted') {
                setStatus('Voice tạm ngắt — đang thử lại...', 'error');
            }
        };

        recognition.onend = () => {
            state.listening = false;

            if (state.enabled && !state.speaking) {
                clearTimeout(state.restartTimer);
                state.restartTimer = setTimeout(startRecognition, 350);
            }
        };

        return recognition;
    }

    function startRecognition() {
        if (!state.enabled || state.speaking || !SpeechRecognition) return;

        if (!state.recognition) {
            state.recognition = createRecognition();
        }

        try {
            state.recognition.start();
        } catch (_) {}
    }

    function stopRecognition() {
        clearTimeout(state.restartTimer);
        clearTimeout(state.armTimer);

        state.armed = false;

        try {
            state.recognition?.stop();
        } catch (_) {}

        state.listening = false;
    }

    function toggle() {
        if (!state.supported) {
            setStatus('Browser này không hỗ trợ Voice', 'error');
            return;
        }

        if (state.enabled) {
            state.enabled = false;
            stopRecognition();
            setStatus('Voice đang tắt');
            window.melodyAI3D?.setState(
                window.isMusicPlaying ? 'music' : 'idle'
            );
        } else {
            state.enabled = true;
            updateButton();
            setStatus('Say “Hey Melody”...');
            speak('Melody đang sẵn sàng. Hãy nói Hey Melody.');
            startRecognition();
        }

        updateButton();
    }

    function updateButton() {
        // Voice chạy nền, không có nút hiển thị.
    }

    function mount() {
        const widget = document.getElementById('melody-ai-widget');

        if (!widget) return;

        // Không tạo button/status UI nữa: Voice chạy nền để không che giao diện.
        // Giữ một phần tử ẩn để hệ thống có thể cập nhật trạng thái.
        if (!els.status) {
            const status = document.createElement('div');
            status.className = 'melody-voice-status melody-voice-status-hidden';
            status.setAttribute('aria-hidden', 'true');
            status.style.display = 'none';
            widget.appendChild(status);
            els.status = status;
        }

        if (!state.supported) return;

        // Tự động bật microphone và bắt đầu chờ "Hey Melody".
        state.enabled = true;
        setStatus('Say “Hey Melody”...');
        startRecognition();
    }

    window.melodyVoice = {
        init: mount,
        mount,
        toggle,
        start: () => {
            if (!state.enabled) toggle();
            else startRecognition();
        },
        stop: () => {
            state.enabled = false;
            stopRecognition();
            updateButton();
        },
        isSupported: () => state.supported,
        isEnabled: () => state.enabled
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount, { once: true });
    } else {
        setTimeout(mount, 0);
    }

    // Melody AI widget được tạo động trong app.js, nên thử lại vài lần.
    let mountAttempts = 0;
    const autoMountTimer = setInterval(() => {
        if (document.getElementById('melody-ai-widget')) {
            mount();
            clearInterval(autoMountTimer);
        } else if (++mountAttempts >= 20) {
            clearInterval(autoMountTimer);
        }
    }, 500);
})();
