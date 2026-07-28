(function() {
    // Navbar scroll
    const nav = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        nav.classList.toggle('scrolled', window.scrollY > 50);

        const sections = document.querySelectorAll('section[id]');
        let current = '';
        sections.forEach(s => {
            if (window.scrollY >= s.offsetTop - 200) current = s.id;
        });
        document.querySelectorAll('.nav-links a').forEach(a => {
            a.classList.toggle('active', a.getAttribute('href') === '#' + current);
        });
    });

    // Fade in
    const obs = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    document.querySelectorAll('.fade-in').forEach(el => obs.observe(el));

    // Counters
    const statsObs = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                document.querySelectorAll('[data-target]').forEach(el => {
                    const target = parseInt(el.dataset.target);
                    const start = performance.now();
                    function update(now) {
                        const p = Math.min((now - start) / 2000, 1);
                        const eased = 1 - Math.pow(1 - p, 3);
                        el.textContent = target >= 1000 ? Math.round(eased * target).toLocaleString() : Math.round(eased * target);
                        if (p < 1) requestAnimationFrame(update);
                    }
                    requestAnimationFrame(update);
                });
                statsObs.unobserve(e.target);
            }
        });
    }, { threshold: 0.3 });
    const sb = document.querySelector('.stats-bar');
    if (sb) statsObs.observe(sb);

    // DNA repair visual
    const canvas = document.getElementById('repair-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        const parent = canvas.parentElement;
        function resize() {
            canvas.width = parent.clientWidth * devicePixelRatio;
            canvas.height = parent.clientHeight * devicePixelRatio;
            canvas.style.width = parent.clientWidth + 'px';
            canvas.style.height = parent.clientHeight + 'px';
            ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
        }
        resize();
        window.addEventListener('resize', resize);

        let time = 0;
        const bases = ['A', 'T', 'G', 'C'];
        const pairs = { A: 'T', T: 'A', G: 'C', C: 'G' };

        function draw() {
            time += 0.02;
            const w = parent.clientWidth, h = parent.clientHeight;
            ctx.clearRect(0, 0, w, h);
            const cx = w / 2, cy = h / 2;
            const n = 12, sp = 28, amp = 30;

            for (let i = 0; i < n; i++) {
                const y = (i - n / 2) * sp + 20;
                const o1 = Math.sin(time + i * 0.5) * amp;
                const o2 = Math.sin(time + i * 0.5 + Math.PI) * amp;
                const b1 = bases[i % 4], b2 = pairs[b1];
                const dmg = i === 4 || i === 5;

                // Backbone segments
                ctx.strokeStyle = '#3a3a3e';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(cx + o1 - 8, y); ctx.lineTo(cx + o1 + 8, y);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(cx + o2 - 8, y); ctx.lineTo(cx + o2 + 8, y);
                ctx.stroke();

                // Base labels
                ctx.fillStyle = dmg ? '#b85a5a' : '#5a9ab8';
                ctx.font = '600 11px "JetBrains Mono", monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(b1, cx + o1 - 18, y);
                ctx.fillText(b2, cx + o2 + 18, y);

                // Connection
                ctx.beginPath();
                ctx.strokeStyle = dmg ? 'rgba(184,90,90,0.6)' : 'rgba(90,154,184,0.3)';
                ctx.lineWidth = dmg ? 2 : 1;
                if (dmg) ctx.setLineDash([3, 3]);
                ctx.moveTo(cx + o1 + 8, y);
                ctx.lineTo(cx + o2 - 8, y);
                ctx.stroke();
                ctx.setLineDash([]);

                if (dmg) {
                    ctx.beginPath();
                    ctx.arc((cx + o1 + cx + o2) / 2, y, 3, 0, Math.PI * 2);
                    ctx.fillStyle = '#b85a5a';
                    ctx.fill();
                }
            }

            // Repair enzyme
            ctx.fillStyle = '#6aab7a';
            const ry = Math.floor((Math.sin(time * 2) * 0.5 + 0.5) * (n - 1));
            if (ry >= 4 && ry <= 5) {
                const yy = (ry - n / 2) * sp + 20;
                const rx = cx + Math.sin(time * 2) * 40 + 50;
                ctx.beginPath();
                ctx.arc(rx, yy, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.font = '500 8px Inter, sans-serif';
                ctx.fillText('NER', rx, yy + 15);
            }

            requestAnimationFrame(draw);
        }
        draw();
    }
})();
