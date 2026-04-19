/**
 * Floating Photo-Real Cacti — hero iridescent card overlay
 * Six real cactus species rendered as transparent-PNG billboards
 * with low-gravity physics, gentle 2D sway, and mouse-kick interaction.
 */
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.162.0/build/three.module.min.js";

(function () {
  var host = document.getElementById("hero-sequencer");
  if (!host) return;

  /* ================================================================== */
  /*  Canvas + Renderer                                                 */
  /* ================================================================== */
  var cvs = document.createElement("canvas");
  cvs.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;z-index:3;" +
    "pointer-events:none;border-radius:inherit;";
  host.appendChild(cvs);

  var ren = new THREE.WebGLRenderer({
    canvas: cvs, alpha: true, antialias: true,
    powerPreference: "high-performance",
  });
  ren.setPixelRatio(Math.min(devicePixelRatio, 2));
  ren.outputColorSpace = THREE.SRGBColorSpace;
  ren.setClearColor(0x000000, 0);

  /* ================================================================== */
  /*  Scene / Camera                                                    */
  /* ================================================================== */
  var scene = new THREE.Scene();
  var cam = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  cam.position.z = 5;

  /* ================================================================== */
  /*  Cactus species — real-photo transparent PNGs                      */
  /*  worldSize is the on-canvas height in world units; aspect is auto. */
  /* ================================================================== */
  var SPECIES = [
    { name: "saguaro",      src: "cactus-real-saguaro.png",      worldSize: 1.55 },
    { name: "barrel",       src: "cactus-real-barrel.png",       worldSize: 1.10 },
    { name: "prickly_pear", src: "cactus-real-prickly-pear.png", worldSize: 1.35 },
    { name: "ball",         src: "cactus-real-ball.png",         worldSize: 1.00 },
    { name: "column",       src: "cactus-real-column.png",       worldSize: 1.45 },
    { name: "star",         src: "cactus-real-star.png",         worldSize: 1.05 },
  ];

  /* ================================================================== */
  /*  Texture loader — preload all species before first spawn           */
  /* ================================================================== */
  var loader = new THREE.TextureLoader();
  loader.crossOrigin = "anonymous";
  var loadedCount = 0;
  var ready = false;

  function loadSpecies(s) {
    return new Promise(function (resolve) {
      loader.load(
        s.src,
        function (tex) {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = Math.min(8, ren.capabilities.getMaxAnisotropy());
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.generateMipmaps = true;
          s.texture = tex;
          var iw = tex.image && tex.image.width || 1;
          var ih = tex.image && tex.image.height || 1;
          s.aspect = iw / ih;
          loadedCount++;
          resolve();
        },
        undefined,
        function () {
          loadedCount++;
          resolve();
        }
      );
    });
  }

  Promise.all(SPECIES.map(loadSpecies)).then(function () {
    SPECIES = SPECIES.filter(function (s) { return !!s.texture; });
    ready = true;
  });

  /* ================================================================== */
  /*  Cactus state                                                      */
  /* ================================================================== */
  var cacti = [];
  var MAX_CACTI = 4;
  var GRAV = -0.025;
  var LIN_DAMP = 0.995;
  var ANG_DAMP = 0.992;
  var BOB_AMP = 0.014;
  var BOB_FREQ = 0.40;
  var BASE_PUSH = 4.5;
  var FADE_DUR = 1.0;
  var vH = 1.82, vW = 1.82;
  var despawnDist = 5;
  var pushRad = 1.0;
  var zoneR = 0.8;

  var _v1 = new THREE.Vector3();
  var _v2 = new THREE.Vector3();

  var lastSpecies = -1;

  /* ================================================================== */
  /*  Build a billboard cactus mesh from a species entry                */
  /* ================================================================== */
  function buildCactus(s) {
    var h = s.worldSize;
    var w = h * s.aspect;
    var geo = new THREE.PlaneGeometry(w, h);
    var mat = new THREE.MeshBasicMaterial({
      map: s.texture,
      transparent: true,
      alphaTest: 0.05,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    mat.opacity = 0;
    var mesh = new THREE.Mesh(geo, mat);
    mesh.userData.baseSize = h;
    mesh.userData.collisionRadius = Math.max(w, h) * 0.42;
    return mesh;
  }

  /* ================================================================== */
  /*  Spawn — slide in from edge with enough velocity to enter view     */
  /* ================================================================== */
  function spawnOne() {
    if (!ready || cacti.length >= MAX_CACTI || SPECIES.length === 0) return;

    var si = Math.floor(Math.random() * SPECIES.length);
    if (si === lastSpecies && SPECIES.length > 1) si = (si + 1) % SPECIES.length;
    lastSpecies = si;

    var mesh = buildCactus(SPECIES[si]);
    scene.add(mesh);

    var pos = new THREE.Vector3();
    var vel = new THREE.Vector3();
    var side = Math.floor(Math.random() * 4);
    var margin = 0.6;
    var speed = 0.18 + Math.random() * 0.07;
    var drift = (Math.random() - 0.5) * 0.03;

    switch (side) {
      case 0: pos.set((Math.random() - 0.5) * vW * 0.6, vH + margin, 0); vel.set(drift, -speed, 0); break;
      case 1: pos.set(vW + margin, (Math.random() - 0.5) * vH * 0.5, 0); vel.set(-speed, drift, 0); break;
      case 2: pos.set((Math.random() - 0.5) * vW * 0.6, -vH - margin, 0); vel.set(drift, speed, 0); break;
      case 3: pos.set(-vW - margin, (Math.random() - 0.5) * vH * 0.5, 0); vel.set(speed, drift, 0); break;
    }

    cacti.push({
      mesh: mesh,
      mat: mesh.material,
      pos: pos, vel: vel,
      angZ: (Math.random() - 0.5) * 0.20,
      rotZ: (Math.random() - 0.5) * 0.35,
      bobPh: Math.random() * Math.PI * 2,
      age: 0,
      colR: mesh.userData.collisionRadius,
      baseSize: mesh.userData.baseSize,
    });
  }

  /* ================================================================== */
  /*  Despawn + schedule replacement                                    */
  /* ================================================================== */
  function despawnAt(idx) {
    var c = cacti[idx];
    scene.remove(c.mesh);
    if (c.mesh.geometry) c.mesh.geometry.dispose();
    if (c.mat) c.mat.dispose();
    cacti.splice(idx, 1);
    setTimeout(function () {
      if (run && cacti.length < MAX_CACTI) spawnOne();
    }, 2000 + Math.random() * 3000);
  }

  /* ================================================================== */
  /*  Pointer                                                           */
  /* ================================================================== */
  var px = 0.5, py = 0.5, pIn = false, pSpeed = 0, lastPT = 0;
  function onPtr(e) {
    var rect = host.getBoundingClientRect();
    var nx = (e.clientX - rect.left) / rect.width;
    var ny = (e.clientY - rect.top) / rect.height;
    var now = performance.now() * 0.001;
    var pd = now - lastPT;
    if (pd > 0.002 && pd < 0.15) {
      pSpeed = Math.sqrt((nx - px) * (nx - px) + (ny - py) * (ny - py)) / pd;
    }
    px = nx; py = ny; lastPT = now; pIn = true;
  }
  host.addEventListener("pointermove", onPtr, { passive: true });
  host.addEventListener("pointerdown", onPtr, { passive: true });
  host.addEventListener("pointerleave", function () { pIn = false; }, { passive: true });
  host.addEventListener("pointerup", function (e) {
    if (e.pointerType === "touch") pIn = false;
  }, { passive: true });

  /* ================================================================== */
  /*  Resize                                                            */
  /* ================================================================== */
  var _lw = 0, _lh = 0;
  function resize() {
    var w = cvs.clientWidth, h = cvs.clientHeight;
    if (!w || !h || (w === _lw && h === _lh)) return;
    _lw = w; _lh = h;
    ren.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    vH = cam.position.z * Math.tan((cam.fov * Math.PI) / 360);
    vW = vH * cam.aspect;
    despawnDist = Math.max(vW, vH) * 1.5 + 1;
    pushRad = Math.min(vW, vH) * 0.55;
    zoneR = Math.min(vW, vH) * 0.45;
  }

  /* ================================================================== */
  /*  Main loop                                                         */
  /* ================================================================== */
  var prevT = 0, run = true;

  function loop(time) {
    requestAnimationFrame(loop);
    if (!run) return;
    var t = time * 0.001;
    var dt = Math.min((time - prevT) * 0.001, 0.05);
    prevT = time;
    if (dt <= 0) return;
    resize();

    var mouseW = null;
    if (pIn) {
      _v1.set(px * 2 - 1, -(py * 2 - 1), 0.5).unproject(cam);
      _v1.sub(cam.position).normalize();
      var tP = -cam.position.z / _v1.z;
      mouseW = new THREE.Vector3(
        cam.position.x + _v1.x * tP, cam.position.y + _v1.y * tP, 0
      );
    }

    /* ---- inter-cactus repulsion ---- */
    for (var ai = 0; ai < cacti.length; ai++) {
      for (var bi = ai + 1; bi < cacti.length; bi++) {
        var ca = cacti[ai], cb = cacti[bi];
        var dx = ca.pos.x - cb.pos.x;
        var dy = ca.pos.y - cb.pos.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var minD = ca.colR + cb.colR;
        if (dist < minD && dist > 0.001) {
          var overlap = minD - dist;
          var nx = dx / dist, ny = dy / dist;
          var force = overlap * 3.0 * dt;
          ca.vel.x += nx * force;
          ca.vel.y += ny * force;
          cb.vel.x -= nx * force;
          cb.vel.y -= ny * force;
        }
      }
    }

    for (var ci = cacti.length - 1; ci >= 0; ci--) {
      var c = cacti[ci];
      c.age += dt;

      c.vel.y += GRAV * dt;

      if (Math.random() < dt * 1.5) {
        c.vel.x += (Math.random() - 0.5) * 0.012;
        c.vel.y += (Math.random() - 0.40) * 0.012;
      }

      var ld = Math.pow(LIN_DAMP, dt * 60);
      var ad = Math.pow(ANG_DAMP, dt * 60);
      c.vel.multiplyScalar(ld);
      c.angZ *= ad;

      /* ---- soft zone: keep cacti floating in visible area ---- */
      var spd = c.vel.length();
      if (spd < 0.22) {
        var oX = Math.max(0, Math.abs(c.pos.x) - zoneR);
        var oY = Math.max(0, Math.abs(c.pos.y) - zoneR);
        if (oX > 0) c.vel.x -= Math.sign(c.pos.x) * oX * 0.45 * dt;
        if (oY > 0) c.vel.y -= Math.sign(c.pos.y) * oY * 0.45 * dt;
      }

      /* ---- pointer kick ---- */
      if (mouseW) {
        _v2.set(mouseW.x - c.pos.x, mouseW.y - c.pos.y, -c.pos.z);
        var md = _v2.length();
        if (md < pushRad && md > 0.01) {
          var ff = 1 - md / pushRad; ff *= ff;
          _v2.normalize().negate();
          var kick = Math.min(pSpeed * 3, 7) * ff;
          var str = (ff * BASE_PUSH + kick) * dt;
          c.vel.addScaledVector(_v2, str);
          var spin = (ff * 1.4 + kick * 0.7) * dt;
          c.angZ += (_v2.x - _v2.y) * spin * 0.6;
        }
      }

      c.pos.addScaledVector(c.vel, dt);
      c.rotZ += c.angZ * dt;

      var bob = Math.sin(t * BOB_FREQ * Math.PI * 2 + c.bobPh) * BOB_AMP;
      var sway = Math.sin(t * 0.7 + c.bobPh) * 0.05;
      var si = Math.min(c.age / FADE_DUR, 1);
      var sc = 0.7 + si * 0.3;
      var op = Math.min(si * 2.5, 1);

      c.mesh.position.copy(c.pos);
      c.mesh.position.y += bob;
      c.mesh.rotation.set(0, 0, c.rotZ + sway);
      c.mesh.scale.setScalar(sc);
      c.mat.opacity = op;

      if (c.pos.length() > despawnDist) despawnAt(ci);
    }

    pSpeed *= 0.85;
    ren.render(scene, cam);
  }

  /* ================================================================== */
  /*  Visibility + periodic spawning                                    */
  /* ================================================================== */
  new IntersectionObserver(
    function (ent) { run = ent[0].isIntersecting; },
    { threshold: 0, rootMargin: "200px" }
  ).observe(host);

  function scheduleSpawn() {
    setTimeout(function () {
      if (run && cacti.length < MAX_CACTI) spawnOne();
      scheduleSpawn();
    }, 7000 + Math.random() * 5000);
  }

  /* Wait until textures load AND the iridescent reveal has had a moment */
  function startWhenReady() {
    if (!ready) {
      setTimeout(startWhenReady, 200);
      return;
    }
    spawnOne();
    setTimeout(spawnOne, 2200);
    scheduleSpawn();
  }
  setTimeout(startWhenReady, 11000);
  requestAnimationFrame(loop);
})();
