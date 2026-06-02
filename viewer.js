// Three.js based viewer for container loading visualization.
// All inputs are in mm; the viewer scales internally for camera comfort.
// Uses InstancedMesh per product for performance, render-on-demand to stay light.

const Viewer = (() => {
  let scene, camera, renderer, controls;
  let containerGroup, cartonGroup;
  let currentContainer = null;
  const SCALE = 0.01; // mm -> view units
  let needsRender = true;

  function init(domEl) {
    const w = domEl.clientWidth;
    const h = domEl.clientHeight;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d12);

    camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 5000);
    camera.position.set(160, 110, 130);

    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    domEl.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.target.set(60, 12, 12);
    controls.addEventListener('change', () => { needsRender = true; });

    // Lights — directional + ambient, no shadows for performance
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 0.8);
    key.position.set(120, 200, 100);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x88aacc, 0.35);
    fill.position.set(-100, 80, -100);
    scene.add(fill);

    // Ground grid
    const grid = new THREE.GridHelper(400, 40, 0x2a3445, 0x1a2030);
    grid.position.y = -0.01;
    scene.add(grid);

    containerGroup = new THREE.Group();
    scene.add(containerGroup);
    cartonGroup = new THREE.Group();
    scene.add(cartonGroup);

    window.addEventListener('resize', () => onResize(domEl));

    requestAnimationFrame(animate);
  }

  function onResize(domEl) {
    const w = domEl.clientWidth;
    const h = domEl.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    needsRender = true;
  }

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    if (needsRender) {
      renderer.render(scene, camera);
      needsRender = false;
    }
  }

  function drawContainer(container) {
    while (containerGroup.children.length) {
      const c = containerGroup.children.pop();
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    }
    currentContainer = container;

    const L = container.L * SCALE;
    const H = container.H * SCALE;
    const W = container.W * SCALE;

    // Floor
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(L, 0.4, W),
      new THREE.MeshBasicMaterial({ color: 0x2a3543 })
    );
    floor.position.set(L / 2, -0.2, W / 2);
    containerGroup.add(floor);

    // Wireframe edges
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(L, H, W)),
      new THREE.LineBasicMaterial({ color: 0x4fc3f7 })
    );
    edges.position.set(L / 2, H / 2, W / 2);
    containerGroup.add(edges);

    // Back wall (translucent)
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(W, H),
      new THREE.MeshBasicMaterial({ color: 0x1a2535, transparent: true, opacity: 0.2, side: THREE.DoubleSide })
    );
    back.rotation.y = Math.PI / 2;
    back.position.set(L, H / 2, W / 2);
    containerGroup.add(back);

    // Door frame (highlight) at x = 0
    const doorMat = new THREE.LineBasicMaterial({ color: 0xffc107 });
    const doorPts = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, H, 0),
      new THREE.Vector3(0, H, W),
      new THREE.Vector3(0, 0, W),
      new THREE.Vector3(0, 0, 0),
    ];
    containerGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(doorPts), doorMat));

    // Length markers every 1m
    const gridMat = new THREE.LineBasicMaterial({ color: 0x2a3445, transparent: true, opacity: 0.5 });
    for (let x = 1000; x < container.L; x += 1000) {
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x * SCALE, 0.001, 0),
        new THREE.Vector3(x * SCALE, 0.001, W),
      ]);
      containerGroup.add(new THREE.Line(g, gridMat));
    }

    // Frame camera
    controls.target.set(L / 2, H * 0.35, W / 2);
    const dist = Math.max(L, W, H) * 1.4;
    camera.position.set(L * 0.9, H * 1.5, W + dist * 0.6);
    controls.update();
    needsRender = true;
  }

  function drawCartons(placements) {
    // Dispose old meshes
    while (cartonGroup.children.length) {
      const c = cartonGroup.children.pop();
      if (c.geometry) c.geometry.dispose();
      if (c.material) {
        if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
        else c.material.dispose();
      }
    }

    // Group placements by (productIndex + dimensions) so we can use InstancedMesh.
    // Each unique (productIndex, dx, dy, dz) becomes one instanced mesh.
    const groups = new Map();
    for (const p of placements) {
      const key = `${p.box.productIndex}|${p.dx}|${p.dy}|${p.dz}`;
      if (!groups.has(key)) groups.set(key, { color: p.box.color, dx: p.dx, dy: p.dy, dz: p.dz, items: [] });
      groups.get(key).items.push(p);
    }

    for (const g of groups.values()) {
      const dx = g.dx * SCALE, dy = g.dy * SCALE, dz = g.dz * SCALE;
      const geo = new THREE.BoxGeometry(dx, dy, dz);
      const mat = new THREE.MeshLambertMaterial({
        color: new THREE.Color(g.color),
        transparent: true,
        opacity: 0.95,
      });
      const mesh = new THREE.InstancedMesh(geo, mat, g.items.length);
      const dummy = new THREE.Object3D();
      g.items.forEach((p, i) => {
        dummy.position.set(p.x * SCALE + dx / 2, p.y * SCALE + dy / 2, p.z * SCALE + dz / 2);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      cartonGroup.add(mesh);
    }

    // For small counts, draw individual outlines; skip for large counts to keep perf.
    if (placements.length <= 200) {
      const outlineMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 });
      for (const p of placements) {
        const dx = p.dx * SCALE, dy = p.dy * SCALE, dz = p.dz * SCALE;
        const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(dx, dy, dz));
        const line = new THREE.LineSegments(geo, outlineMat);
        line.position.set(p.x * SCALE + dx / 2, p.y * SCALE + dy / 2, p.z * SCALE + dz / 2);
        cartonGroup.add(line);
      }
    }

    needsRender = true;
  }

  function setView(mode) {
    if (!currentContainer) return;
    const c = currentContainer;
    const L = c.L * SCALE, H = c.H * SCALE, W = c.W * SCALE;
    controls.target.set(L / 2, H / 2, W / 2);

    if (mode === 'top')       camera.position.set(L / 2, Math.max(L, W) * 1.3, W / 2 + 0.001);
    else if (mode === 'side') camera.position.set(L / 2, H / 2, W * 3.5);
    else                       camera.position.set(L * 0.9, H * 1.6, W + Math.max(L, W) * 0.7);

    controls.update();
    needsRender = true;
  }

  // Render the current scene immediately and return a PNG data-URL.
  // Used by the print/report function to embed 3D snapshots. The renderer
  // was initialized with preserveDrawingBuffer:true, which makes toDataURL valid.
  function captureCurrent() {
    if (!renderer) return null;
    renderer.render(scene, camera);
    try {
      return renderer.domElement.toDataURL('image/png');
    } catch (e) {
      console.warn('[Viewer.captureCurrent] failed', e);
      return null;
    }
  }

  // Convenience: redraw a specific container + placements, then capture.
  // Used to walk every container in a fleet and snapshot each one for the report.
  function captureContainer(container, placements) {
    drawContainer(container);
    drawCartons(placements || []);
    return captureCurrent();
  }

  return { init, drawContainer, drawCartons, setView, captureCurrent, captureContainer };
})();
