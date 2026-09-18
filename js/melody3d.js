// Melody AI 3D mascot
// Procedural Three.js model inspired by the provided Melody character sheet.
// No change to the existing chat/AI logic is required.

(() => {
    'use strict';

    const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

    let api = null;
    let started = false;

    const state = {
        mode: 'idle',
        scene: null,
        camera: null,
        renderer: null,
        root: null,
        head: null,
        body: null,
        leftArm: null,
        rightArm: null,
        leftLeg: null,
        rightLeg: null,
        eyes: [],
        leds: [],
        clock: null,
        raf: 0
    };

    function mat(THREE, color, options = {}) {
        return new THREE.MeshStandardMaterial({
            color,
            roughness: options.roughness ?? 0.42,
            metalness: options.metalness ?? 0.18,
            emissive: options.emissive ?? 0x000000,
            emissiveIntensity: options.emissiveIntensity ?? 0
        });
    }

    function roundedRectGeometry(THREE, width, height, depth, radius = 0.16) {
        const shape = new THREE.Shape();
        const x = -width / 2;
        const y = -height / 2;
        const r = Math.min(radius, width / 2, height / 2);

        shape.moveTo(x + r, y);
        shape.lineTo(x + width - r, y);
        shape.quadraticCurveTo(x + width, y, x + width, y + r);
        shape.lineTo(x + width, y + height - r);
        shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
        shape.lineTo(x + r, y + height);
        shape.quadraticCurveTo(x, y + height, x, y + height - r);
        shape.lineTo(x, y + r);
        shape.quadraticCurveTo(x, y, x + r, y);

        return new THREE.ExtrudeGeometry(shape, {
            depth,
            bevelEnabled: true,
            bevelSegments: 3,
            bevelSize: Math.min(0.07, r * 0.35),
            bevelThickness: Math.min(0.06, depth * 0.2),
            curveSegments: 6
        });
    }

    function makeEye(THREE, material, x, y, z) {
        const eye = new THREE.Mesh(
            new THREE.SphereGeometry(0.095, 16, 12),
            material
        );
        eye.scale.set(1.35, 0.72, 0.45);
        eye.position.set(x, y, z);
        state.eyes.push(eye);
        return eye;
    }

    function buildModel(THREE) {
        const root = new THREE.Group();
        root.position.y = -0.48;

        const black = mat(THREE, 0x080b0d, { roughness: 0.28, metalness: 0.38 });
        const dark = mat(THREE, 0x10161a, { roughness: 0.4, metalness: 0.22 });
        const green = mat(THREE, 0x0b9f78, { roughness: 0.38, metalness: 0.2 });
        const brightGreen = mat(THREE, 0x16d6a0, {
            roughness: 0.24,
            metalness: 0.15,
            emissive: 0x075d4b,
            emissiveIntensity: 1.6
        });
        const visor = mat(THREE, 0x010406, {
            roughness: 0.08,
            metalness: 0.5,
            emissive: 0x001c17,
            emissiveIntensity: 0.35
        });
        const white = mat(THREE, 0xe8eeee, { roughness: 0.55, metalness: 0.05 });

        // Body / hoodie
        const body = new THREE.Group();
        body.position.y = 0.12;
        const torso = new THREE.Mesh(
            roundedRectGeometry(THREE, 0.9, 0.9, 0.58, 0.2),
            green
        );
        torso.position.z = 0;
        torso.rotation.x = 0.02;
        body.add(torso);

        const pocket = new THREE.Mesh(
            roundedRectGeometry(THREE, 0.48, 0.25, 0.035, 0.08),
            dark
        );
        pocket.position.set(0, -0.16, 0.31);
        body.add(pocket);

        // Hoodie strings
        for (const x of [-0.13, 0.13]) {
            const string = new THREE.Mesh(
                new THREE.CylinderGeometry(0.014, 0.014, 0.28, 8),
                white
            );
            string.position.set(x, 0.42, 0.31);
            string.rotation.z = x > 0 ? -0.08 : 0.08;
            body.add(string);
        }

        // Music-note logo
        const note = new THREE.Group();
        const stem = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.025, 0.24, 8),
            white
        );
        stem.position.y = 0.06;
        const flag = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.035, 0.035),
            white
        );
        flag.position.set(0.045, 0.17, 0);
        const noteHead = new THREE.Mesh(
            new THREE.SphereGeometry(0.065, 12, 8),
            white
        );
        noteHead.position.set(-0.045, -0.07, 0);
        note.add(stem, flag, noteHead);
        note.position.set(0, 0.04, 0.34);
        note.rotation.z = -0.18;
        body.add(note);

        root.add(body);
        state.body = body;

        // Head
        const head = new THREE.Group();
        head.position.y = 1.02;

        const headShell = new THREE.Mesh(
            new THREE.SphereGeometry(0.78, 32, 24),
            black
        );
        headShell.scale.set(1.0, 0.88, 0.9);
        head.add(headShell);

        // Visor
        const visorMesh = new THREE.Mesh(
            roundedRectGeometry(THREE, 1.15, 0.55, 0.18, 0.16),
            visor
        );
        visorMesh.position.set(0, -0.03, 0.66);
        head.add(visorMesh);

        // Visor rim
        const rim = new THREE.Mesh(
            roundedRectGeometry(THREE, 1.24, 0.64, 0.045, 0.18),
            dark
        );
        rim.position.set(0, -0.03, 0.635);
        head.add(rim);
        visorMesh.position.z = 0.70;

        // Eyes
        const eyeMat = mat(THREE, 0x55ffe0, {
            roughness: 0.18,
            metalness: 0.08,
            emissive: 0x0bbf92,
            emissiveIntensity: 3
        });
        makeEye(THREE, eyeMat, -0.26, 0.0, 0.82);
        makeEye(THREE, eyeMat, 0.26, 0.0, 0.82);

        // Cap
        const cap = new THREE.Group();
        cap.position.set(0, 0.59, 0.02);
        const crown = new THREE.Mesh(
            new THREE.CylinderGeometry(0.59, 0.68, 0.22, 24),
            black
        );
        crown.rotation.x = -0.05;
        cap.add(crown);

        const strap = new THREE.Mesh(
            new THREE.BoxGeometry(0.62, 0.075, 0.04),
            brightGreen
        );
        strap.position.set(0, 0.0, 0.64);
        cap.add(strap);

        const brim = new THREE.Mesh(
            new THREE.CylinderGeometry(0.32, 0.38, 0.06, 24),
            black
        );
        brim.scale.set(1.4, 1, 0.55);
        brim.rotation.x = 0.02;
        brim.position.set(0, -0.08, 0.61);
        cap.add(brim);
        head.add(cap);

        // Headphone band + cups
        const band = new THREE.Mesh(
            new THREE.TorusGeometry(0.72, 0.065, 10, 32, Math.PI),
            dark
        );
        band.rotation.z = Math.PI;
        band.position.y = 0.02;
        head.add(band);

        for (const x of [-0.76, 0.76]) {
            const cup = new THREE.Mesh(
                new THREE.CylinderGeometry(0.23, 0.23, 0.18, 24),
                dark
            );
            cup.rotation.z = Math.PI / 2;
            cup.position.set(x, -0.02, 0.02);
            head.add(cup);

            const led = new THREE.Mesh(
                new THREE.TorusGeometry(0.145, 0.025, 8, 24),
                brightGreen
            );
            led.rotation.y = Math.PI / 2;
            led.position.set(x + (x < 0 ? -0.095 : 0.095), -0.02, 0.02);
            head.add(led);
            state.leds.push(led);
        }

        root.add(head);
        state.head = head;

        // Arms
        function arm(x) {
            const group = new THREE.Group();
            group.position.set(x, 0.13, 0);
            const sleeve = new THREE.Mesh(
                new THREE.CapsuleGeometry(0.15, 0.42, 5, 12),
                green
            );
            sleeve.rotation.z = x < 0 ? -0.18 : 0.18;
            sleeve.position.y = -0.04;
            group.add(sleeve);

            const glove = new THREE.Mesh(
                new THREE.SphereGeometry(0.14, 16, 12),
                white
            );
            glove.position.y = -0.31;
            group.add(glove);
            return group;
        }

        state.leftArm = arm(-0.57);
        state.rightArm = arm(0.57);
        root.add(state.leftArm, state.rightArm);

        // Legs + sneakers
        function leg(x) {
            const group = new THREE.Group();
            group.position.set(x, -0.56, 0);
            const pants = new THREE.Mesh(
                new THREE.CapsuleGeometry(0.18, 0.35, 5, 12),
                dark
            );
            group.add(pants);

            const shoe = new THREE.Mesh(
                roundedRectGeometry(THREE, 0.43, 0.25, 0.56, 0.08),
                black
            );
            shoe.position.set(0, -0.31, 0.12);
            shoe.rotation.x = -0.05;
            group.add(shoe);

            const sole = new THREE.Mesh(
                new THREE.BoxGeometry(0.46, 0.055, 0.57),
                white
            );
            sole.position.set(0, -0.44, 0.12);
            group.add(sole);

            const shoeLed = new THREE.Mesh(
                new THREE.BoxGeometry(0.23, 0.035, 0.045),
                brightGreen
            );
            shoeLed.position.set(0, -0.30, 0.42);
            group.add(shoeLed);
            return group;
        }

        state.leftLeg = leg(-0.24);
        state.rightLeg = leg(0.24);
        root.add(state.leftLeg, state.rightLeg);

        // Small floating music notes
        const notes = new THREE.Group();
        for (let i = 0; i < 3; i++) {
            const n = new THREE.Mesh(
                new THREE.TorusGeometry(0.045, 0.018, 6, 12),
                brightGreen
            );
            n.position.set(-0.85 + i * 0.9, 0.25 + (i % 2) * 0.4, 0.1);
            n.scale.set(1, 1.5, 1);
            notes.add(n);
        }
        root.add(notes);

        return root;
    }

    function setEyeExpression(mode) {
        const [left, right] = state.eyes;
        if (!left || !right) return;

        if (mode === 'thinking') {
            left.scale.set(0.65, 1.45, 0.45);
            right.scale.set(0.65, 1.45, 0.45);
        } else if (mode === 'sad') {
            left.scale.set(1.35, 0.52, 0.45);
            right.scale.set(1.35, 0.52, 0.45);
            left.rotation.z = -0.15;
            right.rotation.z = 0.15;
        } else if (mode === 'sleep') {
            left.scale.set(1.45, 0.22, 0.45);
            right.scale.set(1.45, 0.22, 0.45);
        } else {
            left.scale.set(1.35, 0.72, 0.45);
            right.scale.set(1.35, 0.72, 0.45);
            left.rotation.z = 0;
            right.rotation.z = 0;
        }
    }

    function setState(mode) {
        state.mode = mode || 'idle';
        setEyeExpression(state.mode);
        const dot = document.getElementById('melody-ai-status-dot');
        if (!dot) return;
        dot.className = 'melody-ai-status-dot';
        if (state.mode === 'thinking') dot.classList.add('thinking');
        if (state.mode === 'music') dot.classList.add('music');
        if (state.mode === 'sad') dot.classList.add('sad');
    }

    function resize() {
        if (!state.renderer || !state.camera) return;
        const host = state.renderer.domElement.parentElement;
        const w = Math.max(1, host?.clientWidth || 92);
        const h = Math.max(1, host?.clientHeight || 92);
        state.camera.aspect = w / h;
        state.camera.updateProjectionMatrix();
        state.renderer.setSize(w, h, false);
        state.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    }

    function animate() {
        if (!state.renderer) return;

        const t = state.clock.getElapsedTime();
        const playing = Boolean(window.isMusicPlaying);

        let bounce = Math.sin(t * 2.2) * 0.018;
        let sway = Math.sin(t * 1.6) * 0.018;

        if (state.mode === 'thinking') {
            bounce = Math.sin(t * 4.5) * 0.035;
            sway = Math.sin(t * 3.1) * 0.03;
        } else if (state.mode === 'music' || playing) {
            bounce = Math.abs(Math.sin(t * 5.2)) * 0.075;
            sway = Math.sin(t * 5.2) * 0.07;
        } else if (state.mode === 'happy') {
            bounce = Math.abs(Math.sin(t * 3.5)) * 0.04;
            sway = Math.sin(t * 3.5) * 0.035;
        } else if (state.mode === 'sleep') {
            bounce = Math.sin(t * 0.9) * 0.008;
            sway = 0.015;
        }

        state.root.position.y = -0.48 + bounce;
        state.root.rotation.z = sway * 0.35;
        state.head.rotation.y = Math.sin(t * 0.9) * 0.045;
        state.head.rotation.x = Math.sin(t * 1.4) * 0.018;

        if (state.leftArm && state.rightArm) {
            state.leftArm.rotation.z = -0.10 + Math.sin(t * (playing ? 5.2 : 1.8)) * (playing ? 0.28 : 0.035);
            state.rightArm.rotation.z = 0.10 + Math.sin(t * (playing ? 5.2 : 1.8) + 1.3) * (playing ? 0.28 : 0.035);
        }

        if (state.leftLeg && state.rightLeg && playing) {
            state.leftLeg.rotation.z = Math.sin(t * 5.2) * 0.12;
            state.rightLeg.rotation.z = Math.sin(t * 5.2 + Math.PI) * 0.12;
        }

        for (const led of state.leds) {
            led.material.emissiveIntensity = 1.2 + Math.sin(t * 5) * 0.7;
        }

        state.renderer.render(state.scene, state.camera);
        state.raf = requestAnimationFrame(animate);
    }

    async function init(hostId) {
        if (started) return api;
        const host = document.getElementById(hostId);
        if (!host) return null;

        started = true;

        try {
            const THREE = await import(THREE_URL);

            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
            camera.position.set(0, 0.25, 5.2);
            camera.lookAt(0, 0.35, 0);

            const renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true,
                powerPreference: 'high-performance'
            });
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            renderer.setClearColor(0x000000, 0);
            host.replaceChildren(renderer.domElement);

            const hemi = new THREE.HemisphereLight(0xcffdf3, 0x07110f, 2.0);
            scene.add(hemi);

            const key = new THREE.DirectionalLight(0xffffff, 2.8);
            key.position.set(2, 4, 4);
            scene.add(key);

            const rim = new THREE.PointLight(0x16d6a0, 9, 6);
            rim.position.set(-2, 1, 3);
            scene.add(rim);

            state.scene = scene;
            state.camera = camera;
            state.renderer = renderer;
            state.clock = new THREE.Clock();
            state.root = buildModel(THREE);
            scene.add(state.root);

            setState('idle');
            resize();
            window.addEventListener('resize', resize, { passive: true });

            const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
            if (reduced) {
                renderer.render(scene, camera);
            } else {
                animate();
            }

            return api;
        } catch (error) {
            console.error('Melody AI 3D init failed:', error);
            host.innerHTML = '<span aria-hidden="true" style="font-size:42px;line-height:1">🤖</span>';
            return api;
        }
    }

    api = { init, setState };

    window.melodyAI3D = api;
})();
