/**
 * 3-D Floating Cacti — hero iridescent card overlay
 * Multiple species · low-gravity physics · mouse-kick interaction
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
  ren.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  ren.toneMapping = THREE.ACESFilmicToneMapping;
  ren.toneMappingExposure = 1.25;
  ren.outputColorSpace = THREE.SRGBColorSpace;
  ren.setClearColor(0x000000, 0);

  /* ================================================================== */
  /*  Scene / Camera / Lights                                           */
  /* ================================================================== */
  var scene = new THREE.Scene();
  var cam = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  cam.position.z = 5;

  scene.add(new THREE.HemisphereLight(0xfff2dd, 0x1a3310, 0.75));
  var kL = new THREE.DirectionalLight(0xffe8c0, 1.6);
  kL.position.set(3, 5, 6); scene.add(kL);
  var fL = new THREE.DirectionalLight(0xc8d8ff, 0.45);
  fL.position.set(-4, -1, 3); scene.add(fL);
  var rL = new THREE.DirectionalLight(0xffd8a0, 0.25);
  rL.position.set(0, -3, -4); scene.add(rL);

  /* ================================================================== */
  /*  Spine builder — central + radial cluster per areole               */
  /* ================================================================== */
  var _up = new THREE.Vector3(0, 1, 0);
  var _dm = new THREE.Object3D();

  function makeSpines(parent, areoles, color, cLen, rLen, thick, rCount) {
    cLen = cLen || 0.11; rLen = rLen || 0.06;
    thick = thick || 0.004; rCount = rCount || 4;

    var geo = new THREE.ConeGeometry(thick, 1.0, 5);
    geo.translate(0, 0.5, 0);
    var mat = new THREE.MeshStandardMaterial({
      color: color, roughness: 0.22, metalness: 0.12,
      transparent: true, depthWrite: true,
    });

    var max = areoles.length * (rCount + 4);
    var inst = new THREE.InstancedMesh(geo, mat, max);
    var idx = 0;

    for (var i = 0; i < areoles.length; i++) {
      var a = areoles[i], n = a.n;
      var tan = a.t;
      if (!tan) {
        tan = new THREE.Vector3();
        if (Math.abs(n.y) < 0.9) tan.crossVectors(n, _up).normalize();
        else tan.crossVectors(n, new THREE.Vector3(1, 0, 0)).normalize();
      }
      var bin = new THREE.Vector3().crossVectors(n, tan).normalize();

      _dm.position.copy(a.p);
      _dm.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(_up, n));
      _dm.scale.set(1, cLen * (0.85 + Math.random() * 0.3), 1);
      _dm.updateMatrix();
      inst.setMatrixAt(idx++, _dm.matrix);

      var rc = rCount - 1 + ((Math.random() * 3) | 0);
      var bA = Math.random() * Math.PI * 2;
      for (var k = 0; k < rc && idx < max; k++) {
        var ang = bA + (k / rc) * Math.PI * 2;
        var spr = 0.30 + Math.random() * 0.15;
        var dir = n.clone()
          .addScaledVector(tan, Math.cos(ang) * spr)
          .addScaledVector(bin, Math.sin(ang) * spr)
          .normalize();
        _dm.position.copy(a.p);
        _dm.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(_up, dir));
        _dm.scale.set(0.65, rLen * (0.45 + Math.random() * 0.65), 0.65);
        _dm.updateMatrix();
        inst.setMatrixAt(idx++, _dm.matrix);
      }
    }
    inst.count = idx;
    inst.instanceMatrix.needsUpdate = true;
    parent.add(inst);
  }

  function ribAreoles(RC, APR, R, RD, HX) {
    var out = [];
    for (var ri = 0; ri < RC; ri++) {
      var th = (ri / RC) * Math.PI * 2;
      var tan = new THREE.Vector3(-Math.sin(th), 0, Math.cos(th));
      for (var aj = 1; aj <= APR; aj++) {
        var ph = (aj / (APR + 1)) * Math.PI;
        var pf = Math.sin(ph);
        var rr = R * pf * (1 + RD * pf * pf);
        var ax = rr * Math.cos(th), az = rr * Math.sin(th);
        var ay = R * Math.cos(ph) * HX;
        out.push({
          p: new THREE.Vector3(ax, ay, az),
          n: new THREE.Vector3(ax, ay / HX, az).normalize(),
          t: tan.clone(),
        });
      }
    }
    return out;
  }

  /* ================================================================== */
  /*  Species 1 — Barrel Cactus (Ferocactus)                           */
  /* ================================================================== */
  function buildBarrel() {
    var g = new THREE.Group();
    var RC = 20, RD = 0.22, R = 0.30, HX = 0.82;
    var geo = new THREE.SphereGeometry(R, RC * 8, 56);
    var p = geo.attributes.position;
    var vc = new Float32Array(p.count * 3);

    for (var i = 0; i < p.count; i++) {
      var x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      var r = Math.sqrt(x * x + z * z);
      var th = Math.atan2(z, x);
      var nY = Math.max(-1, Math.min(1, y / R));
      var phi = Math.acos(nY);
      y *= HX;
      var pf = Math.sin(phi);
      var rw = Math.cos(RC * th);
      var ribShape = rw >= 0 ? Math.pow(rw, 0.55) : -Math.pow(-rw, 1.8);
      var rm = 1 + RD * ribShape * pf * pf;
      if (r > 1e-4) { x *= rm; z *= rm; }
      p.setX(i, x); p.setY(i, y); p.setZ(i, z);

      var cr = ribShape * 0.5 + 0.5;
      var hf = (nY + 1) * 0.5;
      var gR = 0.020, gG = 0.055, gB = 0.010;
      var cR = 0.105, cG = 0.250, cB = 0.040;
      var colR = gR + (cR - gR) * cr + hf * 0.028 + (1 - hf) * 0.012;
      var colG = gG + (cG - gG) * cr + hf * 0.032 - (1 - hf) * 0.008;
      var colB = gB + (cB - gB) * cr - hf * 0.005;
      var ns = (Math.random() - 0.5) * 0.007;
      vc[i * 3] = colR + ns;
      vc[i * 3 + 1] = colG + ns;
      vc[i * 3 + 2] = colB + ns * 0.5;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(vc, 3));
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({
      vertexColors: true, roughness: 0.45, metalness: 0.02,
      clearcoat: 0.38, clearcoatRoughness: 0.28,
      transparent: true, depthWrite: true,
    })));
    makeSpines(g, ribAreoles(RC, 7, R, RD, HX), 0xc4601a, 0.13, 0.07, 0.005, 5);
    g.scale.setScalar(0.85 + Math.random() * 0.3);
    return g;
  }

  /* ================================================================== */
  /*  Species 2 — Column Cactus (Cereus)                               */
  /* ================================================================== */
  function buildColumn() {
    var g = new THREE.Group();
    var RC = 9, RD = 0.18, R = 0.14, YS = 2.3;
    var geo = new THREE.SphereGeometry(R, RC * 7, 44);
    var p = geo.attributes.position;
    var vc = new Float32Array(p.count * 3);
    for (var i = 0; i < p.count; i++) {
      var x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      var r = Math.sqrt(x * x + z * z);
      var th = Math.atan2(z, x);
      var nY = Math.max(-1, Math.min(1, y / R));
      var phi = Math.acos(nY);
      y *= YS;
      var taper = 1.0 - (1 - (y / (R * YS))) * 0.07;
      var pf = Math.sin(phi);
      var rw = Math.cos(RC * th);
      var ribShape = rw >= 0 ? Math.pow(rw, 0.6) : -Math.pow(-rw, 1.6);
      var rm = (1 + RD * ribShape * pf * pf) * taper;
      if (r > 1e-4) { x *= rm; z *= rm; }
      p.setX(i, x); p.setY(i, y); p.setZ(i, z);
      var cr = ribShape * 0.5 + 0.5;
      var hf = (nY + 1) * 0.5;
      var colR = 0.03 + cr * 0.06 + hf * 0.02;
      var colG = 0.12 + cr * 0.16 + hf * 0.03;
      var colB = 0.02 + cr * 0.03;
      var ns = (Math.random() - 0.5) * 0.006;
      vc[i * 3] = colR + ns; vc[i * 3 + 1] = colG + ns; vc[i * 3 + 2] = colB + ns * 0.4;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(vc, 3));
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({
      vertexColors: true, roughness: 0.48, metalness: 0.02,
      clearcoat: 0.28, clearcoatRoughness: 0.38,
      transparent: true, depthWrite: true,
    })));
    makeSpines(g, ribAreoles(RC, 5, R, RD, YS), 0xd4a030, 0.09, 0.05, 0.004, 3);
    g.scale.setScalar(0.85 + Math.random() * 0.3);
    return g;
  }

  /* ================================================================== */
  /*  Species 3 — Prickly Pear (Opuntia) with flowers                  */
  /* ================================================================== */
  function makePad(radius, ovalY, flatZ) {
    var geo = new THREE.SphereGeometry(radius, 26, 20);
    var p = geo.attributes.position;
    var vc = new Float32Array(p.count * 3);
    for (var i = 0; i < p.count; i++) {
      var oy = p.getY(i);
      p.setY(i, oy * ovalY);
      p.setZ(i, p.getZ(i) * flatZ);
      var hf = (oy / radius + 1) * 0.5;
      var ns = (Math.random() - 0.5) * 0.02;
      vc[i * 3] = 0.04 + hf * 0.025 + ns;
      vc[i * 3 + 1] = 0.18 + hf * 0.09 + ns;
      vc[i * 3 + 2] = 0.06 + hf * 0.04 + ns * 0.5;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(vc, 3));
    geo.computeVertexNormals();
    return geo;
  }

  function padAreoles(radius, ovalY, flatZ) {
    var out = [];
    for (var iy = -3; iy <= 3; iy++) {
      for (var ix = -2; ix <= 2; ix++) {
        var ax = ix * 0.07, ay = iy * 0.07 * ovalY;
        var d = (ax * ax) / (radius * radius) +
          (ay * ay) / (radius * radius * ovalY * ovalY);
        if (d > 0.6) continue;
        var sz = radius * flatZ * Math.sqrt(Math.max(0, 1 - d));
        out.push({ p: new THREE.Vector3(ax, ay, sz * 0.90), n: new THREE.Vector3(0, 0, 1) });
        out.push({ p: new THREE.Vector3(ax, ay, -sz * 0.90), n: new THREE.Vector3(0, 0, -1) });
      }
    }
    return out;
  }

  function addFlowers(parent, areoles, count) {
    var petGeo = new THREE.SphereGeometry(0.024, 8, 6);
    var cols = [0xe03520, 0xd94080, 0xf0a020, 0xf05030];
    var col = cols[(Math.random() * cols.length) | 0];
    var fM = new THREE.MeshStandardMaterial({
      color: col, roughness: 0.40, transparent: true, depthWrite: true,
    });
    for (var fi = 0; fi < count; fi++) {
      var a = areoles[(Math.random() * areoles.length) | 0];
      var fl = new THREE.Mesh(petGeo, fM);
      fl.position.copy(a.p).addScaledVector(a.n, 0.02);
      fl.scale.set(1, 0.7 + Math.random() * 0.5, 1);
      parent.add(fl);
    }
  }

  function buildPear() {
    var g = new THREE.Group();
    var padMat = new THREE.MeshPhysicalMaterial({
      vertexColors: true, roughness: 0.48, metalness: 0.01,
      clearcoat: 0.20, clearcoatRoughness: 0.42,
      transparent: true, depthWrite: true,
    });
    var pad1G = makePad(0.22, 1.35, 0.18);
    var pad1 = new THREE.Mesh(pad1G, padMat);
    g.add(pad1);
    var a1 = padAreoles(0.22, 1.35, 0.18);
    makeSpines(pad1, a1, 0x8b6914, 0.04, 0.025, 0.002, 2);
    addFlowers(pad1, a1, 2 + ((Math.random() * 2) | 0));

    var pad2G = makePad(0.16, 1.25, 0.16);
    var pad2 = new THREE.Mesh(pad2G, padMat);
    pad2.position.set(0.04, 0.25, 0.015);
    pad2.rotation.set(0, 0.45, -0.28);
    g.add(pad2);
    var a2 = padAreoles(0.16, 1.25, 0.16);
    makeSpines(pad2, a2, 0x8b6914, 0.035, 0.02, 0.002, 2);
    addFlowers(pad2, a2, 1 + ((Math.random() * 2) | 0));

    g.scale.setScalar(0.85 + Math.random() * 0.3);
    return g;
  }

  /* ================================================================== */
  /*  Species 4 — Ball Cactus (Mammillaria)                            */
  /* ================================================================== */
  function buildBall() {
    var g = new THREE.Group();
    var R = 0.24, TF = 13, PF = 8;
    var geo = new THREE.SphereGeometry(R, 56, 40);
    var p = geo.attributes.position;
    var vc = new Float32Array(p.count * 3);
    for (var i = 0; i < p.count; i++) {
      var x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      var r = Math.sqrt(x * x + z * z);
      var th = Math.atan2(z, x);
      var nY = Math.max(-1, Math.min(1, y / R));
      var phi = Math.acos(nY);
      var b1 = Math.cos(TF * th) * Math.cos(PF * phi - th * 3);
      var bump = 1 + Math.max(0, b1) * b1 * 0.08;
      if (r > 1e-4) { p.setX(i, (x / r) * r * bump); p.setZ(i, (z / r) * r * bump); }
      var hf = (nY + 1) * 0.5;
      var tb = bump - 1;
      var ns = (Math.random() - 0.5) * 0.005;
      vc[i * 3] = 0.025 + tb * 0.18 + hf * 0.012 + ns;
      vc[i * 3 + 1] = 0.09 + tb * 0.38 + hf * 0.025 + ns;
      vc[i * 3 + 2] = 0.018 + tb * 0.08 + ns * 0.4;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(vc, 3));
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({
      vertexColors: true, roughness: 0.50, metalness: 0.02,
      clearcoat: 0.25, clearcoatRoughness: 0.40,
      transparent: true, depthWrite: true,
    })));
    var areoles = [];
    for (var ti = 0; ti < TF; ti++) {
      var tA = (ti / TF) * Math.PI * 2;
      var tan = new THREE.Vector3(-Math.sin(tA), 0, Math.cos(tA));
      for (var pi = 1; pi < PF; pi++) {
        var pA = (pi / PF) * Math.PI;
        var spf = Math.sin(pA);
        var rr = R * spf * (1 + Math.max(0, Math.cos(TF * tA) * Math.cos(PF * pA - tA * 3)) * 0.08);
        areoles.push({
          p: new THREE.Vector3(rr * Math.cos(tA), R * Math.cos(pA), rr * Math.sin(tA)),
          n: new THREE.Vector3(rr * Math.cos(tA), R * Math.cos(pA), rr * Math.sin(tA)).normalize(),
          t: tan.clone(),
        });
      }
    }
    makeSpines(g, areoles, 0xf0e0c8, 0.07, 0.04, 0.003, 4);
    g.scale.setScalar(0.85 + Math.random() * 0.3);
    return g;
  }

  /* ================================================================== */
  /*  Species 5 — Star Cactus (Astrophytum)                            */
  /* ================================================================== */
  function buildStar() {
    var g = new THREE.Group();
    var PT = 5, R = 0.27, HX = 0.70, SD = 0.40;
    var geo = new THREE.SphereGeometry(R, PT * 12, 40);
    var p = geo.attributes.position;
    var vc = new Float32Array(p.count * 3);
    for (var i = 0; i < p.count; i++) {
      var x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      var r = Math.sqrt(x * x + z * z);
      var th = Math.atan2(z, x);
      var nY = Math.max(-1, Math.min(1, y / R));
      var phi = Math.acos(nY);
      y *= HX;
      var pf = Math.sin(phi);
      var starW = Math.cos(PT * th);
      var starShape = starW >= 0 ? Math.pow(starW, 0.5) : -Math.pow(-starW, 1.5);
      var rm = 1 + SD * starShape * pf;
      if (r > 1e-4) { x *= rm; z *= rm; }
      p.setX(i, x); p.setY(i, y); p.setZ(i, z);
      var cr = starShape * 0.5 + 0.5;
      var hf = (nY + 1) * 0.5;
      var fleck = Math.random() > 0.84 ? 0.20 : 0;
      vc[i * 3] = (0.06 + cr * 0.05 + fleck + hf * 0.02) * (0.78 + cr * 0.22);
      vc[i * 3 + 1] = (0.13 + cr * 0.10 + fleck * 0.55 + hf * 0.035) * (0.78 + cr * 0.22);
      vc[i * 3 + 2] = (0.04 + cr * 0.03 + fleck * 0.3) * (0.78 + cr * 0.22);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(vc, 3));
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({
      vertexColors: true, roughness: 0.55, metalness: 0.01,
      clearcoat: 0.18, clearcoatRoughness: 0.48,
      transparent: true, depthWrite: true,
    })));
    makeSpines(g, ribAreoles(PT, 4, R, SD, HX), 0x5c3a1e, 0.10, 0.06, 0.006, 2);
    g.scale.setScalar(0.85 + Math.random() * 0.3);
    return g;
  }

  /* ================================================================== */
  /*  Builders                                                          */
  /* ================================================================== */
  var builders = [buildBarrel, buildColumn, buildPear, buildBall, buildStar];

  /* ================================================================== */
  /*  Multi-cactus state                                                */
  /* ================================================================== */
  var cacti = [];
  var MAX_CACTI = 4;
  var GRAV = -0.025;
  var LIN_DAMP = 0.995;
  var ANG_DAMP = 0.997;
  var BOB_AMP = 0.010;
  var BOB_FREQ = 0.45;
  var BASE_PUSH = 4.5;
  var FADE_DUR = 1.0;
  var vH = 1.82, vW = 1.82;
  var despawnDist = 5;
  var pushRad = 1.0;
  var zoneR = 0.8;

  var _v1 = new THREE.Vector3();
  var _v2 = new THREE.Vector3();
  var _q1 = new THREE.Quaternion();

  function collectMats(mesh) {
    var m = [];
    mesh.traverse(function (ch) {
      if (ch.material && m.indexOf(ch.material) === -1) {
        ch.material.transparent = true;
        ch.material.depthWrite = true;
        m.push(ch.material);
      }
    });
    return m;
  }

  var lastSpecies = -1;

  /* ================================================================== */
  /*  Spawn — slide in from edge with enough velocity to enter view    */
  /* ================================================================== */
  function spawnOne() {
    if (cacti.length >= MAX_CACTI) return;

    var si = Math.floor(Math.random() * builders.length);
    if (si === lastSpecies) si = (si + 1) % builders.length;
    lastSpecies = si;

    var mesh = builders[si]();
    scene.add(mesh);

    var pos = new THREE.Vector3();
    var vel = new THREE.Vector3();
    var side = Math.floor(Math.random() * 4);
    var margin = 0.35;
    var speed = 0.18 + Math.random() * 0.07;
    var drift = (Math.random() - 0.5) * 0.03;

    switch (side) {
      case 0: pos.set((Math.random() - 0.5) * vW * 0.6, vH + margin, 0); vel.set(drift, -speed, 0); break;
      case 1: pos.set(vW + margin, (Math.random() - 0.5) * vH * 0.5, 0); vel.set(-speed, drift, 0); break;
      case 2: pos.set((Math.random() - 0.5) * vW * 0.6, -vH - margin, 0); vel.set(drift, speed, 0); break;
      case 3: pos.set(-vW - margin, (Math.random() - 0.5) * vH * 0.5, 0); vel.set(speed, drift, 0); break;
    }

    var box = new THREE.Box3().setFromObject(mesh);
    var sph = new THREE.Sphere();
    box.getBoundingSphere(sph);
    var colR = sph.radius * 0.75;

    cacti.push({
      mesh: mesh, mats: collectMats(mesh),
      pos: pos, vel: vel,
      angV: new THREE.Vector3(
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.15,
        (Math.random() - 0.5) * 0.3
      ),
      quat: new THREE.Quaternion(),
      bobPh: Math.random() * Math.PI * 2,
      age: 0,
      colR: colR,
    });
  }

  /* ================================================================== */
  /*  Despawn + schedule replacement                                   */
  /* ================================================================== */
  function despawnAt(idx) {
    var c = cacti[idx];
    scene.remove(c.mesh);
    c.mesh.traverse(function (ch) {
      if (ch.geometry) ch.geometry.dispose();
      if (ch.material) ch.material.dispose();
    });
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
      c.angV.multiplyScalar(ad);

      /* ---- soft zone: keep cacti floating in visible area ---- */
      var speed = c.vel.length();
      if (speed < 0.22) {
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
          c.angV.x += _v2.y * spin;
          c.angV.z -= _v2.x * spin;
        }
      }

      c.pos.addScaledVector(c.vel, dt);

      var as = c.angV.length();
      if (as > 1e-4) {
        _v1.copy(c.angV).divideScalar(as);
        _q1.setFromAxisAngle(_v1, as * dt);
        c.quat.premultiply(_q1).normalize();
      }

      var bob = Math.sin(t * BOB_FREQ * Math.PI * 2 + c.bobPh) * BOB_AMP;
      var si = Math.min(c.age / FADE_DUR, 1);
      var sc = 0.3 + si * 0.7;
      var op = Math.min(si * 2.5, 1);

      c.mesh.position.copy(c.pos);
      c.mesh.position.y += bob;
      c.mesh.quaternion.copy(c.quat);
      c.mesh.scale.setScalar(sc);
      for (var mi = 0; mi < c.mats.length; mi++) c.mats[mi].opacity = op;

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

  setTimeout(function () { spawnOne(); scheduleSpawn(); }, 11000);
  requestAnimationFrame(loop);
})();
