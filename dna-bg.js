(function() {
    const container = document.getElementById('bg-dna');
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    camera.position.z = 30;

    const dnaGroup = new THREE.Group();
    scene.add(dnaGroup);

    const numPoints = 80;
    const heightSpan = 100;
    const radius = 3;
    const turnCount = 10;

    const strandMat = new THREE.MeshPhongMaterial({
        color: 0x555558,
        shininess: 40,
        transparent: true,
        opacity: 0.35
    });

    const baseColors = [0x5a7a8a, 0x8a6a5a, 0x5a8a6a, 0x8a5a7a];

    const points1 = [];
    const points2 = [];

    for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        const y = (t - 0.5) * heightSpan;
        const angle = t * Math.PI * 2 * turnCount;

        const x1 = Math.cos(angle) * radius;
        const z1 = Math.sin(angle) * radius;
        const x2 = Math.cos(angle + Math.PI) * radius;
        const z2 = Math.sin(angle + Math.PI) * radius;

        points1.push(new THREE.Vector3(x1, y, z1));
        points2.push(new THREE.Vector3(x2, y, z2));

        // Backbone spheres
        const sphere1 = new THREE.Mesh(
            new THREE.SphereGeometry(0.22, 8, 8),
            new THREE.MeshPhongMaterial({ color: 0x444448, shininess: 30, transparent: true, opacity: 0.4 })
        );
        sphere1.position.set(x1, y, z1);
        dnaGroup.add(sphere1);

        const sphere2 = new THREE.Mesh(
            new THREE.SphereGeometry(0.22, 8, 8),
            new THREE.MeshPhongMaterial({ color: 0x444448, shininess: 30, transparent: true, opacity: 0.4 })
        );
        sphere2.position.set(x2, y, z2);
        dnaGroup.add(sphere2);

        // Base pair rungs
        if (i % 2 === 0 && i < numPoints) {
            const colorIdx = i % baseColors.length;
            const bpLen = radius * 2;
            const bpGeo = new THREE.CylinderGeometry(0.4, 0.4, bpLen, 8);
            const bpMat = new THREE.MeshPhongMaterial({
                color: baseColors[colorIdx],
                transparent: true,
                opacity: 0.35,
                shininess: 20
            });
            const bp = new THREE.Mesh(bpGeo, bpMat);
            bp.position.set(0, y, 0);
            bp.rotation.x = Math.PI / 2;
            bp.rotation.z = angle;
            dnaGroup.add(bp);
        }
    }

    // Strands as tubes
    const curve1 = new THREE.CatmullRomCurve3(points1);
    const curve2 = new THREE.CatmullRomCurve3(points2);
    dnaGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve1, 200, 0.1, 6, false), strandMat));
    dnaGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve2, 200, 0.1, 6, false), strandMat));

    // Lights
    scene.add(new THREE.AmbientLight(0x404040, 1));
    const pl = new THREE.PointLight(0xffffff, 0.6);
    pl.position.set(5, 10, 10);
    scene.add(pl);

    dnaGroup.position.x = 8;
    dnaGroup.position.z = -5;

    let mx = 0, my = 0;
    document.addEventListener('mousemove', e => {
        mx = (e.clientX / window.innerWidth - 0.5) * 2;
        my = (e.clientY / window.innerHeight - 0.5) * 2;
    });

    function animate() {
        requestAnimationFrame(animate);
        dnaGroup.rotation.y += 0.003;
        dnaGroup.rotation.x = Math.sin(Date.now() * 0.0003) * 0.1;
        camera.position.x += (mx * 2 - camera.position.x) * 0.02;
        camera.position.y += (-my * 2 - camera.position.y) * 0.02;
        camera.lookAt(0, 0, -5);
        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
})();
