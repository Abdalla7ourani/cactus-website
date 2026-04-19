/**
 * 3-D Floating Cacti — hero iridescent card overlay
 * Six species · realistic relative scale · low-gravity physics · mouse-kick
 *
 * Each species is built procedurally from PBR-shaded geometry with dense
 * spine clusters, areole tufts, micro-displaced skin, and species-specific
 * shape language (saguaro arms, barrel ribs, opuntia paddles, etc.).
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
  ren.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  ren.toneMapping = THREE.ACESFilmicToneMapping;
  ren.toneMappingExposure = 0.78;
  ren.outputColorSpace = THREE.SRGBColorSpace;
  ren.setClearColor(0x000000, 0);

  /* ================================================================== */
  /*  Scene / Camera / Environment / Lights                             */
  /* ================================================================== */
  var scene = new THREE.Scene();
  var cam = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  cam.position.z = 5;

  scene.add(new THREE.HemisphereLight(0xfff2dd, 0x1a3310, 0.40));
  var kL = new THREE.DirectionalLight(0xffe8c0, 1.05);
  kL.position.set(3, 5, 6); scene.add(kL);
  var fL = new THREE.DirectionalLight(0xc8d8ff, 0.30);
  fL.position.set(-4, -1, 3); scene.add(fL);
  var rL = new THREE.DirectionalLight(0xffd8a0, 0.20);
  rL.position.set(0, -3, -4); scene.add(rL);
  /* Subtle back rim — just enough to separate spines from the body. */
  var rimL = new THREE.DirectionalLight(0xfff0d0, 0.40);
  rimL.position.set(-2, 4, -5); scene.add(rimL);

  /* ================================================================== */
  /*  Iridescent environment — synthetic equirectangular gradient that  */
  /*  the cactus skin reflects, so the cacti pick up the same pinks /   */
  /*  peach / lavender / mint of the iridescent backdrop.               */
  /* ================================================================== */
  function makeIridescentEnvTexture() {
    var W = 512, H = 256;
    var c = document.createElement("canvas");
    c.width = W; c.height = H;
    var ctx = c.getContext("2d");
    /* Vertical gradient: top (sky) → middle (peach/pink/mint) → bottom (warm) */
    var v = ctx.createLinearGradient(0, 0, 0, H);
    v.addColorStop(0.00, "#a8c0ff");
    v.addColorStop(0.18, "#c8a8ff");
    v.addColorStop(0.36, "#ffb0d4");
    v.addColorStop(0.52, "#ffc0a0");
    v.addColorStop(0.70, "#fde08c");
    v.addColorStop(0.85, "#a8e8c0");
    v.addColorStop(1.00, "#80c0d8");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    /* Horizontal hue wash to add iridescent rainbow streaks */
    var h = ctx.createLinearGradient(0, 0, W, 0);
    h.addColorStop(0.00, "rgba(255,120,180,0.55)");
    h.addColorStop(0.20, "rgba(140,170,255,0.50)");
    h.addColorStop(0.40, "rgba(255,180,120,0.55)");
    h.addColorStop(0.60, "rgba(150,255,200,0.50)");
    h.addColorStop(0.80, "rgba(200,150,255,0.55)");
    h.addColorStop(1.00, "rgba(255,140,200,0.55)");
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = h;
    ctx.fillRect(0, 0, W, H);
    /* Soft blob highlights for the wavy iridescent effect */
    ctx.globalCompositeOperation = "lighter";
    var blobs = [
      [0.20, 0.30, 0.32, "rgba(255,180,220,0.65)"],
      [0.55, 0.40, 0.38, "rgba(200,225,255,0.65)"],
      [0.78, 0.55, 0.32, "rgba(255,210,170,0.65)"],
      [0.35, 0.70, 0.38, "rgba(190,255,210,0.60)"],
      [0.85, 0.85, 0.30, "rgba(255,190,230,0.55)"],
    ];
    for (var bi = 0; bi < blobs.length; bi++) {
      var bx = blobs[bi][0] * W, by = blobs[bi][1] * H;
      var br = blobs[bi][2] * Math.min(W, H);
      var rg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      rg.addColorStop(0, blobs[bi][3]);
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
    }
    var tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  var pmrem = new THREE.PMREMGenerator(ren);
  var iridescentTex = makeIridescentEnvTexture();
  var envRT = pmrem.fromEquirectangular(iridescentTex);
  scene.environment = envRT.texture;
  iridescentTex.dispose();
  pmrem.dispose();

  /* ================================================================== */
  /*  Helpers                                                           */
  /* ================================================================== */
  var _up = new THREE.Vector3(0, 1, 0);
  var _dm = new THREE.Object3D();

  /* Tiny 3D value noise for skin micro-displacement and color jitter. */
  function hash3(x, y, z) {
    var n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
    return n - Math.floor(n);
  }
  function noise3(x, y, z) {
    var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    var xf = x - xi, yf = y - yi, zf = z - zi;
    var u = xf * xf * (3 - 2 * xf);
    var v = yf * yf * (3 - 2 * yf);
    var w = zf * zf * (3 - 2 * zf);
    var c000 = hash3(xi, yi, zi);
    var c100 = hash3(xi + 1, yi, zi);
    var c010 = hash3(xi, yi + 1, zi);
    var c110 = hash3(xi + 1, yi + 1, zi);
    var c001 = hash3(xi, yi, zi + 1);
    var c101 = hash3(xi + 1, yi, zi + 1);
    var c011 = hash3(xi, yi + 1, zi + 1);
    var c111 = hash3(xi + 1, yi + 1, zi + 1);
    var x00 = c000 * (1 - u) + c100 * u;
    var x10 = c010 * (1 - u) + c110 * u;
    var x01 = c001 * (1 - u) + c101 * u;
    var x11 = c011 * (1 - u) + c111 * u;
    var y0 = x00 * (1 - v) + x10 * v;
    var y1 = x01 * (1 - v) + x11 * v;
    return y0 * (1 - w) + y1 * w;
  }

  /* Areole tuft — small white woolly puff at the spine origin. */
  var _tuftGeo = new THREE.SphereGeometry(1, 6, 5);
  var _tuftMat = new THREE.MeshStandardMaterial({
    color: 0xfff8e8, roughness: 0.95, metalness: 0,
    transparent: true, depthWrite: true,
  });

  /* Generic spine cluster builder ----------------------------------- *
   *   parent      THREE.Object3D to attach the InstancedMesh to       *
   *   areoles     [{p:Vec3, n:Vec3, t?:Vec3}]                          *
   *   color       hex tint                                             *
   *   cLen        central spine length                                 *
   *   rLen        radial spine length                                  *
   *   thick       cone radius                                          *
   *   rCount      base radial count (jittered ±3)                      *
   *   tuftScale   areole tuft puff radius (0 to disable)               *
   *   tipColor    optional tip color hex (lighter for natural fade)    *
   * ----------------------------------------------------------------- */
  function makeSpines(parent, areoles, color, cLen, rLen, thick, rCount, tuftScale, tipColor) {
    cLen = cLen || 0.11;
    rLen = rLen || 0.06;
    thick = thick || 0.004;
    rCount = rCount || 4;
    tuftScale = tuftScale != null ? tuftScale : thick * 1.6;

    var geo = new THREE.ConeGeometry(thick, 1.0, 6);
    geo.translate(0, 0.5, 0);
    if (tipColor != null) {
      var p = geo.attributes.position;
      var vc = new Float32Array(p.count * 3);
      var base = new THREE.Color(color);
      var tip = new THREE.Color(tipColor);
      for (var ii = 0; ii < p.count; ii++) {
        var t = p.getY(ii);
        vc[ii * 3]     = base.r + (tip.r - base.r) * t;
        vc[ii * 3 + 1] = base.g + (tip.g - base.g) * t;
        vc[ii * 3 + 2] = base.b + (tip.b - base.b) * t;
      }
      geo.setAttribute("color", new THREE.BufferAttribute(vc, 3));
    }
    var mat = new THREE.MeshStandardMaterial({
      color: tipColor != null ? 0xffffff : color,
      vertexColors: tipColor != null,
      roughness: 0.40, metalness: 0.10,
      transparent: true, depthWrite: true,
    });
    mat.envMapIntensity = 0.55;

    var maxRad = rCount + 4;
    var max = areoles.length * (maxRad + 1);
    var inst = new THREE.InstancedMesh(geo, mat, max);
    var idx = 0;

    var tufts = null;
    if (tuftScale > 0) {
      tufts = new THREE.InstancedMesh(_tuftGeo, _tuftMat, areoles.length);
    }

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
      _dm.scale.set(1.0, cLen * (0.85 + Math.random() * 0.3), 1.0);
      _dm.updateMatrix();
      inst.setMatrixAt(idx++, _dm.matrix);

      if (tufts) {
        _dm.position.copy(a.p).addScaledVector(n, -tuftScale * 0.25);
        _dm.quaternion.identity();
        _dm.scale.setScalar(tuftScale * (0.7 + Math.random() * 0.6));
        _dm.updateMatrix();
        tufts.setMatrixAt(i, _dm.matrix);
      }

      var rc = rCount + ((Math.random() * 5 - 2) | 0);
      if (rc < 2) rc = 2;
      var bA = Math.random() * Math.PI * 2;
      for (var k = 0; k < rc && idx < max; k++) {
        var ang = bA + (k / rc) * Math.PI * 2;
        var spr = 0.55 + Math.random() * 0.30;
        var dir = n.clone()
          .addScaledVector(tan, Math.cos(ang) * spr)
          .addScaledVector(bin, Math.sin(ang) * spr)
          .normalize();
        _dm.position.copy(a.p);
        _dm.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(_up, dir));
        _dm.scale.set(0.55, rLen * (0.40 + Math.random() * 0.75), 0.55);
        _dm.updateMatrix();
        inst.setMatrixAt(idx++, _dm.matrix);
      }
    }
    inst.count = idx;
    inst.instanceMatrix.needsUpdate = true;
    parent.add(inst);
    if (tufts) {
      tufts.instanceMatrix.needsUpdate = true;
      parent.add(tufts);
    }
  }

  /* Areole sample positions on a ribbed body of revolution. */
  function ribAreoles(RC, APR, R, RD, HX, jitter) {
    jitter = jitter || 0;
    var out = [];
    for (var ri = 0; ri < RC; ri++) {
      var th = (ri / RC) * Math.PI * 2;
      var tan = new THREE.Vector3(-Math.sin(th), 0, Math.cos(th));
      for (var aj = 1; aj <= APR; aj++) {
        var jit = (Math.random() - 0.5) * jitter;
        var ph = ((aj + jit) / (APR + 1)) * Math.PI;
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

  /* Add organic skin micro-displacement + base+rib color blending.
     Call this AFTER any rib/shape transformations are applied so noise
     and color are computed from the final geometry. */
  function applyCactusSkin(geo, opts) {
    var p = geo.attributes.position;
    var base = opts.base, rib = opts.rib;
    var vc = new Float32Array(p.count * 3);
    var noiseFreq = opts.noiseFreq || 14;
    var noiseAmp = opts.noiseAmp || 0.005;
    var preX = new Float32Array(p.count);
    var preY = new Float32Array(p.count);
    var preZ = new Float32Array(p.count);
    for (var pi = 0; pi < p.count; pi++) {
      preX[pi] = p.getX(pi);
      preY[pi] = p.getY(pi);
      preZ[pi] = p.getZ(pi);
    }
    for (var i = 0; i < p.count; i++) {
      var x = preX[i], y = preY[i], z = preZ[i];
      var len = Math.sqrt(x * x + y * y + z * z) || 1;
      var nx = x / len, ny = y / len, nz = z / len;
      var n1 = noise3(x * noiseFreq, y * noiseFreq, z * noiseFreq) - 0.5;
      var n2 = (noise3(x * noiseFreq * 2.7, y * noiseFreq * 2.7, z * noiseFreq * 2.7) - 0.5) * 0.5;
      var disp = (n1 + n2) * noiseAmp;
      p.setX(i, x + nx * disp);
      p.setY(i, y + ny * disp);
      p.setZ(i, z + nz * disp);

      var ribAmt = opts.ribAmt != null ? opts.ribAmt(x, y, z) : 0;
      var hf = opts.hf != null ? opts.hf(x, y, z) : 0.5;
      var jitter = (n1 + n2) * (opts.colorJitter || 0.04);
      var bleach = (1 - hf) * (opts.bleach || 0.0);
      vc[i * 3]     = base.r + (rib.r - base.r) * ribAmt + jitter + bleach;
      vc[i * 3 + 1] = base.g + (rib.g - base.g) * ribAmt + jitter + bleach;
      vc[i * 3 + 2] = base.b + (rib.b - base.b) * ribAmt + jitter + bleach * 0.6;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(vc, 3));
    geo.computeVertexNormals();
  }

  function cactusSkinMaterial(opts) {
    var m = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: opts.roughness != null ? opts.roughness : 0.65,
      metalness: 0.0,
      clearcoat: opts.clearcoat != null ? opts.clearcoat : 0.85,
      /* Clearcoat must be near-glossy for the env map to read as visible
         iridescent color rather than a blurred grey tint. */
      clearcoatRoughness: opts.clearcoatRoughness != null ? opts.clearcoatRoughness : 0.10,
      sheen: opts.sheen || 0.0,
      sheenRoughness: 0.6,
      sheenColor: new THREE.Color(opts.sheenColor || 0x335522),
      transparent: true, depthWrite: true,
    });
    m.envMapIntensity = opts.envMapIntensity != null ? opts.envMapIntensity : 1.20;
    return m;
  }

  /* ================================================================== */
  /*  Species 1 — Saguaro (Carnegiea gigantea) — tall column + arms     */
  /*  Reference scale: 1.00 (largest, the standard)                     */
  /*                                                                    */
  /*  Modeled as a TubeGeometry along a Catmull-Rom curve (so arms can  */
  /*  J-curve naturally). The cross-section is a smooth ribbed circle:  */
  /*  ribs are gentle round bumps (high angular tessellation), not      */
  /*  sharp ridges. Areoles sit ON each rib crest in clean rows.        */
  /* ================================================================== */
  function buildSaguaroSegment(curvePts, baseRad, tipRad, ribCount, ribDepth, areolesPerRib, color) {
    var curve = new THREE.CatmullRomCurve3(curvePts, false, "catmullrom", 0.5);
    var TUBE_SEG = 64;
    var RAD_SEG = 144;
    var rTube = Math.max(baseRad, tipRad) * 1.20;
    var tube = new THREE.TubeGeometry(curve, TUBE_SEG, rTube, RAD_SEG, false);

    /* TubeGeometry uses Frenet frames internally. We need the same per-
       vertex "arc length t" and "around angle θ". TubeGeometry indexes
       vertices as (t row × RAD_SEG col), top-to-bottom, with one extra
       column at θ=2π. We re-derive (t, θ) from the indexed grid. */
    var p = tube.attributes.position;
    var vc = new Float32Array(p.count * 3);
    var rib = new THREE.Color(color.rib);
    var base = new THREE.Color(color.base);

    /* Pre-sample centerline points + frames so we can re-radius vertices
       toward their centerline (replacing the constant-radius cylinder
       with a tapered, ribbed one). */
    var centers = new Array(TUBE_SEG + 1);
    var tangents = new Array(TUBE_SEG + 1);
    var normals = new Array(TUBE_SEG + 1);
    var binormals = new Array(TUBE_SEG + 1);
    var frenet = curve.computeFrenetFrames(TUBE_SEG, false);
    for (var ti = 0; ti <= TUBE_SEG; ti++) {
      centers[ti] = curve.getPointAt(ti / TUBE_SEG);
      tangents[ti] = frenet.tangents[ti];
      normals[ti] = frenet.normals[ti];
      binormals[ti] = frenet.binormals[ti];
    }

    /* Vertex layout: row-major. Index i = ti * (RAD_SEG + 1) + rj. */
    for (var ti2 = 0; ti2 <= TUBE_SEG; ti2++) {
      var t = ti2 / TUBE_SEG;
      /* Saguaro radius profile: subtle bulge mid-column, smooth taper toward tip */
      var bulge = 1 + 0.07 * Math.sin(t * Math.PI);
      var taperedRad = (baseRad + (tipRad - baseRad) * t) * bulge;
      var c = centers[ti2], n = normals[ti2], b = binormals[ti2];
      var hf = t;
      /* Slight color bleach near the top */
      var bleach = Math.max(0, hf - 0.55) * 0.12;
      for (var rj = 0; rj <= RAD_SEG; rj++) {
        var th = (rj / RAD_SEG) * Math.PI * 2;
        /* Smooth round rib bumps via cosine of (ribCount * th).
           Map cosine [-1,1] → ribAmt [0,1] then a smooth bump curve. */
        var rw = (Math.cos(ribCount * th) + 1) * 0.5;
        var ribBump = Math.pow(rw, 1.8);
        var radial = taperedRad * (1 - ribDepth + ribDepth * ribBump);
        var nx = Math.cos(th), nz = Math.sin(th);
        /* Skin micro-noise — tiny, doesn't break the ribs */
        var wx = c.x + (n.x * nx + b.x * nz) * radial;
        var wy = c.y + (n.y * nx + b.y * nz) * radial;
        var wz = c.z + (n.z * nx + b.z * nz) * radial;
        var n1 = noise3(wx * 22, wy * 22, wz * 22) - 0.5;
        var n2 = (noise3(wx * 55, wy * 55, wz * 55) - 0.5) * 0.5;
        var disp = (n1 + n2) * 0.0030;
        var dx = wx - c.x, dy = wy - c.y, dz = wz - c.z;
        var dlen = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        wx += (dx / dlen) * disp;
        wy += (dy / dlen) * disp;
        wz += (dz / dlen) * disp;
        var idx = ti2 * (RAD_SEG + 1) + rj;
        p.setXYZ(idx, wx, wy, wz);
        /* Color: rib crests are LIGHTER (sun-faced), valleys DARKER */
        var cr = ribBump;
        var jitter = (n1 + n2) * 0.025;
        vc[idx * 3]     = base.r + (rib.r - base.r) * cr + jitter + bleach;
        vc[idx * 3 + 1] = base.g + (rib.g - base.g) * cr + jitter + bleach;
        vc[idx * 3 + 2] = base.b + (rib.b - base.b) * cr + jitter + bleach * 0.6;
      }
    }
    tube.setAttribute("color", new THREE.BufferAttribute(vc, 3));
    tube.computeVertexNormals();

    var mesh = new THREE.Mesh(tube, cactusSkinMaterial({
      roughness: 0.62, clearcoat: 0.85, clearcoatRoughness: 0.10,
      sheen: 0.30, sheenColor: 0x445533,
    }));

    /* Areoles ON the rib crests, spaced in clean vertical rows. */
    var ar = [];
    for (var ri = 0; ri < ribCount; ri++) {
      var ribTh = (ri / ribCount) * Math.PI * 2;
      var nx2 = Math.cos(ribTh), nz2 = Math.sin(ribTh);
      for (var ai2 = 1; ai2 <= areolesPerRib; ai2++) {
        var t2 = (ai2 - 0.5) / areolesPerRib;
        var c2 = curve.getPointAt(t2);
        var fIdx = Math.min(TUBE_SEG, Math.floor(t2 * TUBE_SEG));
        var n0 = normals[fIdx], b0 = binormals[fIdx];
        var bulge2 = 1 + 0.07 * Math.sin(t2 * Math.PI);
        var taperedRad2 = (baseRad + (tipRad - baseRad) * t2) * bulge2;
        var radCrest = taperedRad2 * (1 - ribDepth + ribDepth * 1.0);
        var pos = new THREE.Vector3(
          c2.x + (n0.x * nx2 + b0.x * nz2) * radCrest,
          c2.y + (n0.y * nx2 + b0.y * nz2) * radCrest,
          c2.z + (n0.z * nx2 + b0.z * nz2) * radCrest
        );
        var nor = new THREE.Vector3(
          n0.x * nx2 + b0.x * nz2,
          n0.y * nx2 + b0.y * nz2,
          n0.z * nx2 + b0.z * nz2
        ).normalize();
        ar.push({ p: pos, n: nor, t: tangents[fIdx].clone() });
      }
    }
    /* Saguaro spines: short, hair-like, dark base → ivory tip, NO big tuft */
    makeSpines(mesh, ar, 0x6a4a1a, 0.026, 0.020, 0.0019, 5, 0.0035, 0xf5e3a8);
    return mesh;
  }

  function buildSaguaro() {
    var g = new THREE.Group();
    var color = {
      base: new THREE.Color(0.18, 0.36, 0.16),
      rib:  new THREE.Color(0.32, 0.55, 0.20),
    };

    /* Trunk: nearly vertical centerline with a soft bend so it doesn't
       look perfectly cylindrical. */
    var trunkH = 1.55;
    var trunkPts = [
      new THREE.Vector3(0, 0,           0),
      new THREE.Vector3(0.005, trunkH * 0.30, 0.01),
      new THREE.Vector3(0,    trunkH * 0.55, -0.01),
      new THREE.Vector3(-0.005, trunkH * 0.80, 0),
      new THREE.Vector3(0,    trunkH,        0),
    ];
    var trunk = buildSaguaroSegment(trunkPts, 0.18, 0.13, 16, 0.10, 22, color);
    g.add(trunk);

    /* Arms: J-curves that exit the trunk outward then arc upward.
       Two opposite arms minimum; small chance of a third asymmetric. */
    var armCount = 2 + ((Math.random() < 0.4) ? 1 : 0);
    var azimuthOffset = Math.random() * Math.PI * 2;
    for (var ai = 0; ai < armCount; ai++) {
      var armSide = ai % 2 === 0 ? 1 : -1;
      /* Place arms at distinct azimuths around the trunk */
      var az = azimuthOffset + ai * (Math.PI * 0.85);
      var aSin = Math.sin(az), aCos = Math.cos(az);
      var startY = 0.55 + Math.random() * 0.40;
      var outDist = 0.22 + Math.random() * 0.08;
      var elbowY = startY + 0.05 + Math.random() * 0.04;
      var upY = startY + 0.55 + Math.random() * 0.30;
      var attachR = 0.155;
      /* J-curve control points (in world XYZ around the trunk) */
      var armPts = [
        new THREE.Vector3(aSin * attachR * 0.6,        startY,             aCos * attachR * 0.6),
        new THREE.Vector3(aSin * attachR * 1.05,       startY + 0.02,       aCos * attachR * 1.05),
        new THREE.Vector3(aSin * (attachR + outDist * 0.55), startY + 0.05, aCos * (attachR + outDist * 0.55)),
        new THREE.Vector3(aSin * (attachR + outDist),  elbowY,              aCos * (attachR + outDist)),
        new THREE.Vector3(aSin * (attachR + outDist * 0.95), elbowY + 0.20, aCos * (attachR + outDist * 0.95)),
        new THREE.Vector3(aSin * (attachR + outDist * 0.92), upY,           aCos * (attachR + outDist * 0.92)),
      ];
      var armRib = 14;
      var arm = buildSaguaroSegment(armPts, 0.105, 0.090, armRib, 0.10, 16, color);
      g.add(arm);
    }

    /* Center the saguaro on its bounding box for proper rotation pivot. */
    var bb = new THREE.Box3().setFromObject(g);
    var cy = (bb.min.y + bb.max.y) * 0.5;
    g.children.forEach(function (c) { c.position.y -= cy; });
    return g;
  }

  /* ================================================================== */
  /*  Species 2 — Column / Cereus                                       */
  /*  Reference scale: 0.60                                             */
  /* ================================================================== */
  function buildColumn() {
    var g = new THREE.Group();
    var RC = 11, RD = 0.18, R = 0.14, YS = 2.6;
    var geo = new THREE.SphereGeometry(R, RC * 8, 60);
    var p = geo.attributes.position;
    /* 1) Rib displacement + elongation */
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
      var ribShape = rw >= 0 ? Math.pow(rw, 0.55) : -Math.pow(-rw, 1.7);
      var rm = (1 + RD * ribShape * pf * pf) * taper;
      if (r > 1e-4) { x *= rm; z *= rm; }
      p.setX(i, x); p.setY(i, y); p.setZ(i, z);
    }
    /* 2) Skin noise + color */
    applyCactusSkin(geo, {
      base: new THREE.Color(0.08, 0.28, 0.10),
      rib: new THREE.Color(0.18, 0.45, 0.16),
      noiseFreq: 16, noiseAmp: 0.0040,
      colorJitter: 0.030, bleach: 0.08,
      ribAmt: function (x, y, z) {
        var r = Math.sqrt(x * x + z * z);
        if (r < 1e-4) return 0.5;
        var th = Math.atan2(z, x);
        var rw = Math.cos(RC * th);
        return rw >= 0 ? Math.pow(rw, 0.55) : 0.0;
      },
      hf: function (x, y, z) { return (y / (R * YS) + 1) * 0.5; },
    });

    g.add(new THREE.Mesh(geo, cactusSkinMaterial({
      roughness: 0.62, clearcoat: 0.85, clearcoatRoughness: 0.10,
      sheen: 0.35, sheenColor: 0x445533,
    })));
    makeSpines(g, ribAreoles(RC, 9, R, RD, YS, 0.4), 0xd9a838, 0.060, 0.040, 0.0028, 5, 0.012, 0xfff0c0);
    return g;
  }

  /* ================================================================== */
  /*  Species 3 — Prickly Pear (Opuntia) with flower buds                */
  /*  Reference scale: 0.45                                              */
  /* ================================================================== */
  function makePad(radius, ovalY, flatZ) {
    var geo = new THREE.SphereGeometry(radius, 32, 22);
    var p = geo.attributes.position;
    var vc = new Float32Array(p.count * 3);
    var base = new THREE.Color(0.06, 0.28, 0.10);
    var top  = new THREE.Color(0.13, 0.42, 0.16);
    for (var i = 0; i < p.count; i++) {
      var oy = p.getY(i);
      var ox = p.getX(i);
      var oz = p.getZ(i);
      var n1 = noise3(ox * 18, oy * 18, oz * 18) - 0.5;
      var n2 = (noise3(ox * 42, oy * 42, oz * 42) - 0.5) * 0.5;
      var disp = (n1 + n2) * 0.006;
      p.setY(i, oy * ovalY + (disp * Math.sign(oy || 1)));
      p.setZ(i, oz * flatZ + disp * Math.sign(oz || 1) * 0.2);
      p.setX(i, ox + disp * Math.sign(ox || 1) * 0.4);
      var hf = (oy / radius + 1) * 0.5;
      var jitter = (n1 + n2) * 0.05;
      vc[i * 3]     = base.r + (top.r - base.r) * hf + jitter;
      vc[i * 3 + 1] = base.g + (top.g - base.g) * hf + jitter;
      vc[i * 3 + 2] = base.b + (top.b - base.b) * hf + jitter * 0.5;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(vc, 3));
    geo.computeVertexNormals();
    return geo;
  }

  function padAreoles(radius, ovalY, flatZ, density) {
    density = density || 1;
    var out = [];
    var rows = Math.round(7 * density);
    var cols = Math.round(5 * density);
    for (var iy = -rows; iy <= rows; iy++) {
      for (var ix = -cols; ix <= cols; ix++) {
        var ax = ix * 0.030, ay = iy * 0.030 * ovalY;
        var d = (ax * ax) / (radius * radius) +
                (ay * ay) / (radius * radius * ovalY * ovalY);
        if (d > 0.85) continue;
        var sz = radius * flatZ * Math.sqrt(Math.max(0, 1 - d));
        var jx = (Math.random() - 0.5) * 0.012;
        var jy = (Math.random() - 0.5) * 0.012;
        out.push({
          p: new THREE.Vector3(ax + jx, ay + jy, sz * 0.95),
          n: new THREE.Vector3(0.05 * Math.random(), 0, 1).normalize(),
        });
        out.push({
          p: new THREE.Vector3(ax + jx, ay + jy, -sz * 0.95),
          n: new THREE.Vector3(0.05 * Math.random(), 0, -1).normalize(),
        });
      }
    }
    return out;
  }

  function addFlowers(parent, areoles, count) {
    if (count <= 0) return;
    var petGeo = new THREE.SphereGeometry(0.022, 10, 8);
    var cols = [0xe83520, 0xd54080, 0xf0a020, 0xf05030, 0xffd040];
    var col = cols[(Math.random() * cols.length) | 0];
    var fM = new THREE.MeshStandardMaterial({
      color: col, roughness: 0.45, metalness: 0,
      transparent: true, depthWrite: true,
    });
    for (var fi = 0; fi < count; fi++) {
      var a = areoles[(Math.random() * areoles.length) | 0];
      var fl = new THREE.Mesh(petGeo, fM);
      fl.position.copy(a.p).addScaledVector(a.n, 0.015);
      fl.scale.set(1.1, 0.7 + Math.random() * 0.4, 1.1);
      parent.add(fl);
    }
  }

  function buildPear() {
    var g = new THREE.Group();
    var padMat = cactusSkinMaterial({
      roughness: 0.62, clearcoat: 0.85, clearcoatRoughness: 0.10,
      sheen: 0.30, sheenColor: 0x335522,
    });
    var pad1G = makePad(0.30, 1.45, 0.16);
    var pad1 = new THREE.Mesh(pad1G, padMat);
    g.add(pad1);
    var a1 = padAreoles(0.30, 1.45, 0.16, 1.6);
    makeSpines(pad1, a1, 0xc8a26a, 0.022, 0.014, 0.0014, 2, 0.006, 0xfff0d0);
    addFlowers(pad1, a1, 2 + ((Math.random() * 2) | 0));

    var pad2G = makePad(0.21, 1.30, 0.15);
    var pad2 = new THREE.Mesh(pad2G, padMat);
    pad2.position.set(0.06, 0.34, 0.025);
    pad2.rotation.set(0, 0.45, -0.30);
    g.add(pad2);
    var a2 = padAreoles(0.21, 1.30, 0.15, 1.6);
    makeSpines(pad2, a2, 0xc8a26a, 0.020, 0.012, 0.0014, 2, 0.006, 0xfff0d0);
    addFlowers(pad2, a2, 1 + ((Math.random() * 2) | 0));

    var pad3G = makePad(0.16, 1.25, 0.14);
    var pad3 = new THREE.Mesh(pad3G, padMat);
    pad3.position.set(-0.04, 0.30, -0.04);
    pad3.rotation.set(0, -0.50, 0.30);
    g.add(pad3);
    var a3 = padAreoles(0.16, 1.25, 0.14, 1.4);
    makeSpines(pad3, a3, 0xc8a26a, 0.018, 0.011, 0.0014, 2, 0.006, 0xfff0d0);

    return g;
  }

  /* ================================================================== */
  /*  Species 4 — Barrel (Ferocactus)                                   */
  /*  Reference scale: 0.35                                             */
  /* ================================================================== */
  function buildBarrel() {
    var g = new THREE.Group();
    var RC = 22, RD = 0.20, R = 0.30, HX = 0.85;
    var geo = new THREE.SphereGeometry(R, RC * 9, 64);
    var p = geo.attributes.position;
    /* Apply ribs first */
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
    }
    /* Then noise displacement + skin colour */
    applyCactusSkin(geo, {
      base: new THREE.Color(0.06, 0.30, 0.05),
      rib: new THREE.Color(0.18, 0.46, 0.10),
      noiseFreq: 18, noiseAmp: 0.0050,
      colorJitter: 0.035, bleach: 0.05,
      ribAmt: function (x, y, z) {
        var r = Math.sqrt(x * x + z * z);
        if (r < 1e-4) return 0.5;
        var th = Math.atan2(z, x);
        var rw = Math.cos(RC * th);
        return rw >= 0 ? Math.pow(rw, 0.55) : 0.0;
      },
      hf: function (x, y, z) { return (y / (R * HX) + 1) * 0.5; },
    });

    g.add(new THREE.Mesh(geo, cactusSkinMaterial({
      roughness: 0.58, clearcoat: 0.90, clearcoatRoughness: 0.08,
      sheen: 0.40, sheenColor: 0x335522,
    })));
    makeSpines(g, ribAreoles(RC, 9, R, RD, HX, 0.35), 0xb84a14, 0.110, 0.075, 0.0036, 6, 0.013, 0xff8a40);
    return g;
  }

  /* ================================================================== */
  /*  Species 5 — Ball / Pincushion (Mammillaria) with crown of flowers */
  /*  Reference scale: 0.18                                             */
  /* ================================================================== */
  function buildBall() {
    var g = new THREE.Group();
    var R = 0.24, TF = 14, PF = 9;
    var geo = new THREE.SphereGeometry(R, 64, 44);
    var p = geo.attributes.position;
    var vc = new Float32Array(p.count * 3);
    var base = new THREE.Color(0.04, 0.22, 0.05);
    var tip  = new THREE.Color(0.16, 0.42, 0.10);
    for (var i = 0; i < p.count; i++) {
      var x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      var r = Math.sqrt(x * x + z * z);
      var th = Math.atan2(z, x);
      var nY = Math.max(-1, Math.min(1, y / R));
      var phi = Math.acos(nY);
      var b1 = Math.cos(TF * th) * Math.cos(PF * phi - th * 3);
      var bump = 1 + Math.max(0, b1) * b1 * 0.10;
      if (r > 1e-4) { p.setX(i, (x / r) * r * bump); p.setZ(i, (z / r) * r * bump); }
      var n1 = noise3(x * 22, y * 22, z * 22) - 0.5;
      var n2 = (noise3(x * 50, y * 50, z * 50) - 0.5) * 0.5;
      var disp = (n1 + n2) * 0.005;
      var nx = x / Math.max(r, 1e-4);
      var nz = z / Math.max(r, 1e-4);
      p.setX(i, p.getX(i) + nx * disp);
      p.setZ(i, p.getZ(i) + nz * disp);
      var tb = bump - 1;
      var hf = (nY + 1) * 0.5;
      var jitter = (n1 + n2) * 0.04;
      vc[i * 3]     = base.r + (tip.r - base.r) * (tb * 6 + hf * 0.3) + jitter;
      vc[i * 3 + 1] = base.g + (tip.g - base.g) * (tb * 6 + hf * 0.3) + jitter;
      vc[i * 3 + 2] = base.b + (tip.b - base.b) * (tb * 6 + hf * 0.3) + jitter * 0.5;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(vc, 3));
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, cactusSkinMaterial({
      roughness: 0.62, clearcoat: 0.85, clearcoatRoughness: 0.10,
      sheen: 0.30, sheenColor: 0x224422,
    })));
    var areoles = [];
    for (var ti = 0; ti < TF; ti++) {
      var tA = (ti / TF) * Math.PI * 2;
      var tan = new THREE.Vector3(-Math.sin(tA), 0, Math.cos(tA));
      for (var pi = 1; pi < PF; pi++) {
        var pA = (pi / PF) * Math.PI;
        var spf = Math.sin(pA);
        var rr = R * spf * (1 + Math.max(0, Math.cos(TF * tA) * Math.cos(PF * pA - tA * 3)) * 0.10);
        areoles.push({
          p: new THREE.Vector3(rr * Math.cos(tA), R * Math.cos(pA), rr * Math.sin(tA)),
          n: new THREE.Vector3(rr * Math.cos(tA), R * Math.cos(pA), rr * Math.sin(tA)).normalize(),
          t: tan.clone(),
        });
      }
    }
    makeSpines(g, areoles, 0xf2e6c4, 0.055, 0.038, 0.0024, 6, 0.011, 0xfffadc);

    /* Crown of pink flowers near the top */
    var flowerMat = new THREE.MeshStandardMaterial({
      color: 0xe54a92, roughness: 0.45, metalness: 0,
      transparent: true, depthWrite: true,
    });
    var fGeo = new THREE.SphereGeometry(0.022, 10, 8);
    var crownN = 9;
    for (var fi = 0; fi < crownN; fi++) {
      var ang = (fi / crownN) * Math.PI * 2;
      var rr = R * 0.55;
      var fl = new THREE.Mesh(fGeo, flowerMat);
      fl.position.set(rr * Math.cos(ang), R * 0.78, rr * Math.sin(ang));
      fl.scale.set(1.3, 0.8, 1.3);
      g.add(fl);
    }

    return g;
  }

  /* ================================================================== */
  /*  Species 6 — Star (Astrophytum) with yellow flower                  */
  /*  Reference scale: 0.20                                              */
  /* ================================================================== */
  function buildStar() {
    var g = new THREE.Group();
    var PT = 5, R = 0.27, HX = 0.65, SD = 0.42;
    var geo = new THREE.SphereGeometry(R, PT * 14, 44);
    var p = geo.attributes.position;
    /* Star ribs first */
    for (var i = 0; i < p.count; i++) {
      var x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      var r = Math.sqrt(x * x + z * z);
      var th = Math.atan2(z, x);
      var nY = Math.max(-1, Math.min(1, y / R));
      var phi = Math.acos(nY);
      y *= HX;
      var pf = Math.sin(phi);
      var starW = Math.cos(PT * th);
      var starShape = starW >= 0 ? Math.pow(starW, 0.5) : -Math.pow(-starW, 1.6);
      var rm = 1 + SD * starShape * pf;
      if (r > 1e-4) { x *= rm; z *= rm; }
      p.setX(i, x); p.setY(i, y); p.setZ(i, z);
    }
    /* Then noise + base color */
    applyCactusSkin(geo, {
      base: new THREE.Color(0.05, 0.18, 0.07),
      rib: new THREE.Color(0.13, 0.28, 0.10),
      noiseFreq: 22, noiseAmp: 0.0040,
      colorJitter: 0.025, bleach: 0.04,
      ribAmt: function (x, y, z) {
        var r = Math.sqrt(x * x + z * z);
        if (r < 1e-4) return 0.5;
        var th = Math.atan2(z, x);
        var rw = Math.cos(PT * th);
        return rw >= 0 ? Math.pow(rw, 0.5) : 0.0;
      },
      hf: function (x, y, z) { return (y / (R * HX) + 1) * 0.5; },
    });
    g.add(new THREE.Mesh(geo, cactusSkinMaterial({
      roughness: 0.65, clearcoat: 0.85, clearcoatRoughness: 0.12,
    })));

    /* Astrophytum white flecks scattered across the body */
    var fleckGeo = new THREE.SphereGeometry(0.0055, 5, 4);
    var fleckMat = new THREE.MeshStandardMaterial({
      color: 0xfff8e8, roughness: 0.85, metalness: 0,
      transparent: true, depthWrite: true,
    });
    var fleckCount = 320;
    var fleckInst = new THREE.InstancedMesh(fleckGeo, fleckMat, fleckCount);
    var dummyM = new THREE.Object3D();
    for (var fi = 0; fi < fleckCount; fi++) {
      var th = Math.random() * Math.PI * 2;
      var ph = Math.acos(2 * Math.random() - 1);
      var pf = Math.sin(ph);
      var rw = Math.cos(PT * th);
      var ribShape = rw >= 0 ? Math.pow(rw, 0.5) : 0.0;
      var rm = 1 + SD * ribShape * pf;
      var rad = R * pf * rm * 1.005;
      var px2 = rad * Math.cos(th);
      var pz2 = rad * Math.sin(th);
      var py2 = R * Math.cos(ph) * HX;
      dummyM.position.set(px2, py2, pz2);
      dummyM.scale.setScalar(0.7 + Math.random() * 0.7);
      dummyM.updateMatrix();
      fleckInst.setMatrixAt(fi, dummyM.matrix);
    }
    fleckInst.instanceMatrix.needsUpdate = true;
    g.add(fleckInst);

    /* Sparser short spines along ribs */
    makeSpines(g, ribAreoles(PT, 5, R, SD, HX, 0.5), 0x6a3f1c, 0.060, 0.040, 0.0034, 3, 0.014, 0xc88040);

    /* Yellow flower cluster on top */
    var petGeo = new THREE.SphereGeometry(0.030, 10, 8);
    var petMat = new THREE.MeshStandardMaterial({
      color: 0xffd735, roughness: 0.40, metalness: 0,
      transparent: true, depthWrite: true,
    });
    var pet = 9;
    for (var pi2 = 0; pi2 < pet; pi2++) {
      var aA = (pi2 / pet) * Math.PI * 2;
      var fl2 = new THREE.Mesh(petGeo, petMat);
      fl2.position.set(Math.cos(aA) * 0.05, R * HX + 0.025, Math.sin(aA) * 0.05);
      fl2.scale.set(1.4, 0.55, 1.4);
      g.add(fl2);
    }
    var corMat = new THREE.MeshStandardMaterial({
      color: 0xff5020, roughness: 0.45, metalness: 0,
      transparent: true, depthWrite: true,
    });
    var core = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), corMat);
    core.position.set(0, R * HX + 0.030, 0);
    g.add(core);

    return g;
  }

  /* ================================================================== */
  /*  Species registry — name, builder, target on-canvas height in       */
  /*  world units. Ratios are anchored on saguaro (biggest in nature):   */
  /*    saguaro 1.00  column 0.55  pear 0.40  barrel 0.30                */
  /*    star 0.22  ball 0.20                                             */
  /*  Final displayed size is computed from each mesh's actual bounding  */
  /*  box so different intrinsic geometry sizes don't break the ratios.  */
  /* ================================================================== */
  var SAGUARO_TARGET_HEIGHT = 1.55;
  var SPECIES = [
    { name: "saguaro",      build: buildSaguaro, ratio: 1.00 },
    { name: "column",       build: buildColumn,  ratio: 0.55 },
    { name: "prickly_pear", build: buildPear,    ratio: 0.40 },
    { name: "barrel",       build: buildBarrel,  ratio: 0.30 },
    { name: "star",         build: buildStar,    ratio: 0.22 },
    { name: "ball",         build: buildBall,    ratio: 0.20 },
  ];

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
  /*  Spawn — slide in from edge with enough velocity to enter view     */
  /* ================================================================== */
  function spawnOne() {
    if (cacti.length >= MAX_CACTI) return;

    var si = Math.floor(Math.random() * SPECIES.length);
    if (si === lastSpecies) si = (si + 1) % SPECIES.length;
    lastSpecies = si;
    var sp = SPECIES[si];

    var mesh = sp.build();
    /* Compute the mesh's natural height (already includes the per-instance
       jitter set inside the builder), then rescale so the displayed height
       matches sp.ratio * SAGUARO_TARGET_HEIGHT. This locks the relative
       size ratios independent of intrinsic geometry. */
    var bbox = new THREE.Box3().setFromObject(mesh);
    var natH = Math.max(bbox.max.y - bbox.min.y, 1e-3);
    var jitter = 0.92 + Math.random() * 0.16;
    var targetH = sp.ratio * SAGUARO_TARGET_HEIGHT * jitter;
    var finalScale = targetH / natH;
    mesh.scale.setScalar(finalScale);
    scene.add(mesh);

    var pos = new THREE.Vector3();
    var vel = new THREE.Vector3();
    var side = Math.floor(Math.random() * 4);
    var margin = 0.80;
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
        (Math.random() - 0.5) * 0.30,
        (Math.random() - 0.5) * 0.20,
        (Math.random() - 0.5) * 0.30
      ),
      quat: new THREE.Quaternion(),
      bobPh: Math.random() * Math.PI * 2,
      age: 0,
      colR: colR,
      finalScale: finalScale,
    });
  }

  /* ================================================================== */
  /*  Despawn + schedule replacement                                    */
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
      var fadeIn = Math.min(c.age / FADE_DUR, 1);
      var sc = c.finalScale * (0.45 + fadeIn * 0.55);
      var op = Math.min(fadeIn * 2.5, 1);

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
