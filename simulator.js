(function() {
    'use strict';

    // ============================================================
    // STATE
    // ============================================================
    const S = {
        uvOn: true,
        uvIntensity: 5,
        speed: 1,
        time: 0,
        normalTotalRepaired: 0,
        mutantTotalRepaired: 0,
    };

    // ============================================================
    // DOM REFS
    // ============================================================
    const $ = id => document.getElementById(id);
    const uvSlider = $('uv-slider');
    const toggleBtn = $('toggle-uv');
    const resetBtn = $('reset-sim');
    const uvDisplay = $('uv-intensity-display');
    const normalRepairDisplay = $('normal-repair-display');
    const mutantDamageDisplay = $('mutant-damage-display');

    // ============================================================
    // THREE.JS FACTORY
    // ============================================================
    function createScene(containerId) {
        const container = $(containerId);
        if (!container) return null;

        const w = container.clientWidth || 400;
        const h = container.clientHeight || 400;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a1d);

        const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 500);
        camera.position.set(0, 0, 16);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.insertBefore(renderer.domElement, container.firstChild);

        scene.add(new THREE.AmbientLight(0x606060, 2));
        const dl = new THREE.DirectionalLight(0xffffff, 0.8);
        dl.position.set(5, 8, 10);
        scene.add(dl);
        const dl2 = new THREE.DirectionalLight(0xffffff, 0.3);
        dl2.position.set(-5, -4, -6);
        scene.add(dl2);

        return { scene, camera, renderer, container, w: () => container.clientWidth, h: () => container.clientHeight };
    }

    // ============================================================
    // CREATE 3D DNA DOUBLE HELIX
    // ============================================================
    function buildDNA(scene, opts) {
        const {
            numPairs = 24,
            radius = 2.0,
            height = 12,
            turns = 3,
            strandColor = 0x5a9ab8,
            baseColors = [0x5a9ab8, 0x7a6a9a, 0x6a9a7a, 0x9a7a6a],
            damagedColor = 0xb85a5a,
            repairColor = 0x6aab7a
        } = opts;

        const group = new THREE.Group();
        const bases = [];

        // Geometry cache
        const sphereGeo = new THREE.SphereGeometry(0.2, 12, 12);
        const baseGeo = new THREE.SphereGeometry(0.32, 10, 10);
        const connectGeo = new THREE.CylinderGeometry(0.05, 0.05, 1, 6);

        // Backbone material
        const strandMat = new THREE.MeshPhongMaterial({
            color: strandColor,
            shininess: 80,
            transparent: true,
            opacity: 0.85
        });

        // Darker backbone
        const backMat = new THREE.MeshPhongMaterial({
            color: new THREE.Color(strandColor).multiplyScalar(0.5),
            shininess: 40,
            transparent: true,
            opacity: 0.7
        });

        const pts1 = [], pts2 = [];

        for (let i = 0; i <= numPairs; i++) {
            const t = i / numPairs;
            const y = (t - 0.5) * height;
            const angle = t * Math.PI * 2 * turns;

            const x1 = Math.cos(angle) * radius;
            const z1 = Math.sin(angle) * radius;
            const x2 = Math.cos(angle + Math.PI) * radius;
            const z2 = Math.sin(angle + Math.PI) * radius;

            pts1.push(new THREE.Vector3(x1, y, z1));
            pts2.push(new THREE.Vector3(x2, y, z2));

            // Backbone spheres
            const s1 = new THREE.Mesh(sphereGeo, backMat.clone());
            s1.position.set(x1, y, z1);
            group.add(s1);

            const s2 = new THREE.Mesh(sphereGeo, backMat.clone());
            s2.position.set(x2, y, z2);
            group.add(s2);

            // Base pairs (the rungs)
            if (i < numPairs) {
                const ci = i % baseColors.length;
                const mat1 = new THREE.MeshPhongMaterial({
                    color: baseColors[ci],
                    shininess: 50,
                    transparent: true,
                    opacity: 0.8
                });
                const mat2 = new THREE.MeshPhongMaterial({
                    color: baseColors[(ci + 2) % baseColors.length],
                    shininess: 50,
                    transparent: true,
                    opacity: 0.8
                });

                // Each base pair has two halves meeting in the middle
                const halfLen = radius * 0.85;

                // Left half (from strand 1 toward center)
                const bp1 = new THREE.Mesh(baseGeo, mat1);
                bp1.scale.set(1, 0.6, 1);
                const mx1 = x1 * 0.45;
                const mz1 = z1 * 0.45;
                bp1.position.set(mx1, y, mz1);
                group.add(bp1);

                // Right half (from strand 2 toward center)
                const bp2 = new THREE.Mesh(baseGeo, mat2);
                bp2.scale.set(1, 0.6, 1);
                const mx2 = x2 * 0.45;
                const mz2 = z2 * 0.45;
                bp2.position.set(mx2, y, mz2);
                group.add(bp2);

                // Hydrogen bond line (thin cylinder connecting them)
                const dx = mx2 - mx1, dy = 0, dz = mz2 - mz1;
                const bondLen = Math.sqrt(dx * dx + dz * dz);
                const bond = new THREE.Mesh(connectGeo, new THREE.MeshPhongMaterial({
                    color: 0x555558,
                    transparent: true,
                    opacity: 0.4
                }));
                bond.position.set((mx1 + mx2) / 2, y, (mz1 + mz2) / 2);
                bond.scale.set(1, bondLen, 1);
                bond.lookAt(new THREE.Vector3(mx2, y, mz2));
                bond.rotateX(Math.PI / 2);
                group.add(bond);

                bases.push({
                    bp1, bp2, bond,
                    origColor1: baseColors[ci],
                    origColor2: baseColors[(ci + 2) % baseColors.length],
                    damaged: false,
                    repairProg: 0,
                    idx: i,
                    group
                });
            }
        }

        // Backbone strand tubes
        const c1 = new THREE.CatmullRomCurve3(pts1);
        const c2 = new THREE.CatmullRomCurve3(pts2);
        const tubeMat = new THREE.MeshPhongMaterial({
            color: strandColor,
            shininess: 60,
            transparent: true,
            opacity: 0.5
        });
        group.add(new THREE.Mesh(new THREE.TubeGeometry(c1, 200, 0.08, 8, false), tubeMat.clone()));
        group.add(new THREE.Mesh(new THREE.TubeGeometry(c2, 200, 0.08, 8, false), tubeMat.clone()));

        scene.add(group);
        return { group, bases, damagedColor, repairColor };
    }

    // ============================================================
    // UV PARTICLE SYSTEM
    // ============================================================
    function buildUVParticles(scene, count) {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        const vel = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            pos[i * 3]     = (Math.random() - 0.5) * 16;
            pos[i * 3 + 1] = Math.random() * 20 + 5;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 8;
            vel[i * 3]     = (Math.random() - 0.5) * 0.03;
            vel[i * 3 + 1] = -0.08 - Math.random() * 0.2;
            vel[i * 3 + 2] = (Math.random() - 0.5) * 0.03;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

        const mat = new THREE.PointsMaterial({
            color: 0xe8b44a,
            size: 0.18,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const points = new THREE.Points(geo, mat);
        scene.add(points);
        return { points, vel, count };
    }

    // ============================================================
    // UV BEAM (cone of light)
    // ============================================================
    function buildUVBeam(scene) {
        const g = new THREE.Group();
        const coneGeo = new THREE.ConeGeometry(2.5, 10, 16, 1, true);
        const coneMat = new THREE.MeshBasicMaterial({
            color: 0xe8b44a,
            transparent: true,
            opacity: 0.06,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.position.y = 8;
        g.add(cone);
        scene.add(g);
        return g;
    }

    // ============================================================
    // REPAIR ENZYME (NER) — animated molecule
    // ============================================================
    function buildEnzyme(scene) {
        const g = new THREE.Group();

        // Core body
        const body = new THREE.Mesh(
            new THREE.SphereGeometry(0.4, 16, 16),
            new THREE.MeshPhongMaterial({ color: 0x6aab7a, shininess: 100, transparent: true, opacity: 0.9 })
        );
        g.add(body);

        // 4 arms
        const armGeo = new THREE.SphereGeometry(0.15, 8, 8);
        const armMat = new THREE.MeshPhongMaterial({ color: 0x6aab7a, shininess: 80, transparent: true, opacity: 0.8 });
        for (let i = 0; i < 4; i++) {
            const arm = new THREE.Mesh(armGeo, armMat);
            const a = (i / 4) * Math.PI * 2;
            arm.position.set(Math.cos(a) * 0.6, 0, Math.sin(a) * 0.6);
            g.add(arm);
        }

        g.visible = false;
        scene.add(g);
        return g;
    }

    // ============================================================
    // INIT BOTH SCENES
    // ============================================================
    const nScene = createScene('normal-dna-wrap');
    const mScene = createScene('mutant-dna-wrap');
    if (!nScene || !mScene) return;

    const dnaOpts = {
        numPairs: 24,
        radius: 2.0,
        height: 12,
        turns: 3,
    };

    const nDNA = buildDNA(nScene.scene, {
        ...dnaOpts,
        strandColor: 0x5a9ab8,
        baseColors: [0x5a9ab8, 0x7a6a9a, 0x6a9a7a, 0x9a7a6a]
    });

    const mDNA = buildDNA(mScene.scene, {
        ...dnaOpts,
        strandColor: 0xb87a7a,
        baseColors: [0xb87a7a, 0x9a6a8a, 0x6a9a7a, 0x9a8a6a]
    });

    const nUV = buildUVParticles(nScene.scene, 150);
    const mUV = buildUVParticles(mScene.scene, 150);

    const nBeam = buildUVBeam(nScene.scene);
    const mBeam = buildUVBeam(mScene.scene);

    const nEnzyme = buildEnzyme(nScene.scene);
    const mEnzyme = buildEnzyme(mScene.scene);

    // Mouse tracking for camera
    let mxN = 0, myN = 0, mxM = 0, myM = 0;
    nScene.container.addEventListener('mousemove', e => {
        const r = nScene.container.getBoundingClientRect();
        mxN = ((e.clientX - r.left) / r.width - 0.5) * 2;
        myN = ((e.clientY - r.top) / r.height - 0.5) * 2;
    });
    mScene.container.addEventListener('mousemove', e => {
        const r = mScene.container.getBoundingClientRect();
        mxM = ((e.clientX - r.left) / r.width - 0.5) * 2;
        myM = ((e.clientY - r.top) / r.height - 0.5) * 2;
    });

    // ============================================================
    // CONTROLS
    // ============================================================
    uvSlider.addEventListener('input', e => {
        S.uvIntensity = parseInt(e.target.value);
        uvDisplay.textContent = 'UV: ' + S.uvIntensity;
    });

    toggleBtn.addEventListener('click', () => {
        S.uvOn = !S.uvOn;
        toggleBtn.classList.toggle('active', S.uvOn);
        toggleBtn.textContent = S.uvOn ? 'UV Activo \u2600' : 'UV Inactivo \u2601';

        nUV.points.visible = S.uvOn;
        mUV.points.visible = S.uvOn;
        nBeam.visible = S.uvOn;
        mBeam.visible = S.uvOn;
        $('normal-uv-badge').style.display = S.uvOn ? 'flex' : 'none';
        $('mutant-uv-badge').style.display = S.uvOn ? 'flex' : 'none';
    });

    resetBtn.addEventListener('click', () => {
        S.normalTotalRepaired = 0;
        S.mutantTotalRepaired = 0;
        [...nDNA.bases, ...mDNA.bases].forEach(b => {
            b.damaged = false;
            b.repairProg = 0;
            b.bp1.material.color.setHex(b.origColor1);
            b.bp1.material.opacity = 0.8;
            b.bp2.material.color.setHex(b.origColor2);
            b.bp2.material.opacity = 0.8;
            b.bond.material.opacity = 0.4;
        });
    });

    document.querySelectorAll('.speed-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            S.speed = parseFloat(btn.dataset.speed);
        });
    });

    // ============================================================
    // DAMAGE & REPAIR LOGIC
    // ============================================================
    function tickDNA(dna, repairRate) {
        if (!S.uvOn) return;

        // Try to damage a random undamaged base
        const dmgChance = S.uvIntensity * 0.006 * S.speed;
        if (Math.random() < dmgChance) {
            const undmg = dna.bases.filter(b => !b.damaged);
            if (undmg.length > 0) {
                const target = undmg[Math.floor(Math.random() * undmg.length)];
                target.damaged = true;
                target.repairProg = 0;
            }
        }

        // Process each base
        dna.bases.forEach(b => {
            if (b.damaged) {
                // Try repair
                if (Math.random() < repairRate * S.speed) {
                    b.repairProg = Math.min(1, b.repairProg + 0.015 * S.speed);
                    if (b.repairProg >= 1) {
                        b.damaged = false;
                        b.repairProg = 0;
                        b.bp1.material.color.setHex(b.origColor1);
                        b.bp1.material.opacity = 0.8;
                        b.bp2.material.color.setHex(b.origColor2);
                        b.bp2.material.opacity = 0.8;
                        b.bond.material.opacity = 0.4;
                        if (repairRate > 0.05) S.normalTotalRepaired++;
                        else S.mutantTotalRepaired++;
                    } else {
                        // Lerp from damaged red to original color
                        const dc = new THREE.Color(dna.damagedColor);
                        const oc1 = new THREE.Color(b.origColor1);
                        const oc2 = new THREE.Color(b.origColor2);
                        b.bp1.material.color.copy(dc).lerp(oc1, b.repairProg);
                        b.bp2.material.color.copy(dc).lerp(oc2, b.repairProg);
                        b.bp1.material.opacity = 0.8;
                        b.bp2.material.opacity = 0.8;
                        b.bond.material.opacity = 0.3 + b.repairProg * 0.3;
                    }
                } else {
                    // Still damaged — show red
                    const pulse = Math.sin(S.time * 5 + b.idx) * 0.15 + 0.85;
                    b.bp1.material.color.setHex(dna.damagedColor);
                    b.bp2.material.color.setHex(dna.damagedColor);
                    b.bp1.material.opacity = pulse;
                    b.bp2.material.opacity = pulse;
                    b.bond.material.opacity = 0.7;
                    b.bond.material.color.setHex(dna.damagedColor);
                }
            } else {
                // Healthy — subtle pulse
                const pulse = Math.sin(S.time * 2 + b.idx * 0.7) * 0.05;
                b.bp1.material.opacity = 0.75 + pulse;
                b.bp2.material.opacity = 0.75 + pulse;
                b.bond.material.color.setHex(0x555558);
                b.bond.material.opacity = 0.35 + pulse;
            }
        });
    }

    // ============================================================
    // UV PARTICLES UPDATE
    // ============================================================
    function tickUV(uv) {
        if (!S.uvOn) { uv.points.visible = false; return; }
        uv.points.visible = true;
        const pos = uv.points.geometry.attributes.position.array;
        for (let i = 0; i < uv.count; i++) {
            pos[i * 3]     += uv.vel[i * 3] * S.speed;
            pos[i * 3 + 1] += uv.vel[i * 3 + 1] * S.speed;
            pos[i * 3 + 2] += uv.vel[i * 3 + 2] * S.speed;
            if (pos[i * 3 + 1] < -12) {
                pos[i * 3]     = (Math.random() - 0.5) * 16;
                pos[i * 3 + 1] = 12 + Math.random() * 5;
                pos[i * 3 + 2] = (Math.random() - 0.5) * 8;
            }
        }
        uv.points.geometry.attributes.position.needsUpdate = true;
        uv.points.material.opacity = S.uvOn ? 0.3 + S.uvIntensity * 0.06 : 0;
    }

    // ============================================================
    // UPDATE STATS
    // ============================================================
    function updateStats() {
        const nTotal = nDNA.bases.length;
        const mTotal = mDNA.bases.length;
        const nDmg = nDNA.bases.filter(b => b.damaged).length;
        const mDmg = mDNA.bases.filter(b => b.damaged).length;

        $('normal-active').textContent = nDmg;
        $('normal-fixed').textContent = S.normalTotalRepaired;
        $('normal-eff').textContent = S.uvOn ? Math.max(1, 99 - nDmg * 3) + '%' : '100%';
        $('normal-damage-count').textContent = nDmg + ' da\u00f1os';

        $('mutant-active').textContent = mDmg;
        $('mutant-fixed').textContent = S.mutantTotalRepaired;
        $('mutant-eff').textContent = Math.max(0, 15 - mDmg) + '%';
        $('mutant-damage-count').textContent = mDmg + ' da\u00f1os';

        normalRepairDisplay.textContent = Math.round(((nTotal - nDmg) / nTotal) * 100) + '%';
        mutantDamageDisplay.textContent = Math.round((mDmg / mTotal) * 100) + '%';
    }

    // ============================================================
    // MAIN LOOP
    // ============================================================
    let frameCount = 0;

    function animate() {
        requestAnimationFrame(animate);
        S.time += 0.016 * S.speed;
        frameCount++;

        // Rotate DNA
        nDNA.group.rotation.y += 0.006 * S.speed;
        mDNA.group.rotation.y += 0.006 * S.speed;
        nDNA.group.rotation.x = Math.sin(S.time * 0.4) * 0.08;
        mDNA.group.rotation.x = Math.sin(S.time * 0.4 + 1) * 0.08;

        // Camera follow mouse
        nScene.camera.position.x += (mxN * 1.2 - nScene.camera.position.x) * 0.03;
        nScene.camera.position.y += (-myN * 0.8 - nScene.camera.position.y) * 0.03;
        nScene.camera.lookAt(0, 0, 0);

        mScene.camera.position.x += (mxM * 1.2 - mScene.camera.position.x) * 0.03;
        mScene.camera.position.y += (-myM * 0.8 - mScene.camera.position.y) * 0.03;
        mScene.camera.lookAt(0, 0, 0);

        // Damage & repair
        tickDNA(nDNA, 0.12);   // Normal: ~99% repair
        tickDNA(mDNA, 0.012);  // Mutant: ~15% repair

        // UV particles
        tickUV(nUV);
        tickUV(mUV);

        // UV beam pulse
        if (S.uvOn) {
            const bp = 0.06 + Math.sin(S.time * 3) * 0.02;
            nBeam.children[0].material.opacity = bp;
            mBeam.children[0].material.opacity = bp;
        }

        // Repair enzymes
        [nDNA, mDNA].forEach((dna, di) => {
            const enzyme = di === 0 ? nEnzyme : mEnzyme;
            const damaged = dna.bases.filter(b => b.damaged);

            if (damaged.length > 0 && S.uvOn) {
                enzyme.visible = true;
                const target = damaged[di === 0 ? 0 : Math.floor(Math.random() * damaged.length)];
                const worldPos = new THREE.Vector3();
                target.bp1.getWorldPosition(worldPos);
                enzyme.position.lerp(worldPos, 0.04);

                // Rotate enzyme
                enzyme.rotation.y += di === 0 ? 0.08 : 0.02;

                // Mutant enzyme flickers (failing)
                if (di === 1) {
                    enzyme.children.forEach(c => {
                        if (c.material) c.material.opacity = Math.random() > 0.6 ? 0.25 : 0.85;
                    });
                }
            } else {
                enzyme.visible = false;
            }
        });

        // Stats every 3 frames
        if (frameCount % 3 === 0) updateStats();

        // Render
        nScene.renderer.render(nScene.scene, nScene.camera);
        mScene.renderer.render(mScene.scene, mScene.camera);
    }

    // ============================================================
    // RESIZE
    // ============================================================
    function onResize() {
        [nScene, mScene].forEach(s => {
            const w = s.container.clientWidth;
            const h = s.container.clientHeight;
            if (w && h) {
                s.camera.aspect = w / h;
                s.camera.updateProjectionMatrix();
                s.renderer.setSize(w, h);
            }
        });
    }
    window.addEventListener('resize', onResize);

    // Initial resize after DOM settles
    setTimeout(onResize, 100);

    // ============================================================
    // FADE-IN OBSERVER
    // ============================================================
    const obs = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    document.querySelectorAll('.fade-in').forEach(el => obs.observe(el));

    // ============================================================
    // START
    // ============================================================
    animate();
    updateStats();

})();
