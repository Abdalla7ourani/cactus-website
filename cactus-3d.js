/**
 * 3-D Floating Cacti — hero iridescent card overlay
 * Seven species · botanically realistic skin / spines / scale · low-gravity
 * physics · mouse-kick repulsion · phyllotactic spine arrangement.
 *
 * Each species is built procedurally from PBR-shaded geometry with dense
 * spine clusters, areole tufts, micro-displaced skin, and species-specific
 * shape language (saguaro arms, barrel ribs, opuntia paddles, mammillaria
 * pinwheel rosettes, etc.). Materials use a matte/satin cuticle model
 * (high diffuse roughness + low-strength sheen + minimal clearcoat) so the
 * cacti read as living plant tissue and not glossy 3-D prop renders.
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
  ren.outputColorSpace = THREE.SRGBColorSpace;
  ren.setClearColor(0x000000, 0);

  /* ================================================================== */
  /*  Scene / Camera                                                    */
  /* ================================================================== */
  var scene = new THREE.Scene();
  var cam = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  cam.position.z = 5;

  /* ================================================================== */
  /*  Theme-aware lighting + environment                                */
  /*                                                                    */
  /*  The cactus canvas sits on top of the iridescent background canvas */
  /*  ( #iri-card ). The page toggles dark mode via html.classList.dark */
  /*  and the iri shader uses the same flag to switch between bright    */
  /*  pastel and deep purple/blue palettes. The cacti below adapt:      */
  /*    • Lights and exposure swap between sunlit and dusk presets so   */
  /*      the cacti remain legible against either backdrop.             */
  /*    • The env map ( IBL ) is rebuilt periodically by sampling the   */
  /*      live iri-card pixels — so the cacti pick up a *natural,       */
  /*      subtle reflection* of the actual animation behind them,       */
  /*      attenuated by their high diffuse roughness ( = matte plant    */
  /*      tissue, not a polished surface ).                             */
  /* ================================================================== */
  var iriCanvas = document.getElementById("iri-card");

  /* Lighting rig — references kept so we can update intensity/color
     when the theme changes. Real saguaro scene = warm sun key + cool sky
     fill + warm ground bounce + faint back rim. */
  var hemiL = new THREE.HemisphereLight(0xffeacc, 0x2a3014, 0.85);
  scene.add(hemiL);
  var kL = new THREE.DirectionalLight(0xfff0d8, 1.55);
  kL.position.set(3, 5, 6); scene.add(kL);
  var fL = new THREE.DirectionalLight(0xb8c8e8, 0.55);
  fL.position.set(-4, -1, 3); scene.add(fL);
  var rL = new THREE.DirectionalLight(0xe8c898, 0.35);
  rL.position.set(0, -3, -4); scene.add(rL);
  var rimL = new THREE.DirectionalLight(0xfff0c8, 0.55);
  rimL.position.set(-2, 4, -5); scene.add(rimL);

  /* Per-theme presets. The light-mode iri-card is a near-white pastel
     wash, so naively adding sunlit-desert lighting on top blows the
     cacti out to chalky pastel. Real plants viewed against a bright
     sky look *darker* than the sky — they read as saturated green
     silhouettes with form. So in light mode we keep direct lights
     modest and let the bright env IBL provide most of the ambient
     wrap, with reduced exposure so we don't crush the iri backdrop's
     subtle hues. envBoost scales scene.environmentIntensity. */
  var THEMES = {
    light: {
      exposure:  0.78,
      hemi:      { sky: 0xfff0d8, ground: 0x4a5828, intensity: 0.32 },
      key:       { color: 0xfff0d0, intensity: 0.95 },
      fill:      { color: 0xb8c4dc, intensity: 0.30 },
      bounce:    { color: 0xc8a878, intensity: 0.18 },
      rim:       { color: 0xffe8b8, intensity: 0.28 },
      envBoost:  0.35,
    },
    dark: {
      exposure:  0.78,
      hemi:      { sky: 0x6a78a0, ground: 0x18102a, intensity: 0.42 },
      key:       { color: 0xc8d4ff, intensity: 0.90 },
      fill:      { color: 0x9080d8, intensity: 0.40 },
      bounce:    { color: 0x6a4080, intensity: 0.25 },
      rim:       { color: 0xb898ff, intensity: 0.65 },
      envBoost:  0.95,
    },
  };

  var currentTheme = "light";
  function applyTheme(name) {
    var t = THEMES[name];
    if (!t) return;
    currentTheme = name;
    ren.toneMappingExposure = t.exposure;
    hemiL.color.setHex(t.hemi.sky);
    hemiL.groundColor.setHex(t.hemi.ground);
    hemiL.intensity = t.hemi.intensity;
    kL.color.setHex(t.key.color);   kL.intensity = t.key.intensity;
    fL.color.setHex(t.fill.color);  fL.intensity = t.fill.intensity;
    rL.color.setHex(t.bounce.color); rL.intensity = t.bounce.intensity;
    rimL.color.setHex(t.rim.color); rimL.intensity = t.rim.intensity;
    scene.environmentIntensity = t.envBoost;
  }
  function detectTheme() {
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  }
  applyTheme(detectTheme());

  /* ----- live iridescent backdrop → equirectangular env texture -----
   *
   * envCanvas is a small (512×256) offscreen 2D canvas. Each refresh:
   *   1. Read the current iri-card pixels into a fallback tinted grad.
   *   2. Tile the iri-card image horizontally so the equirect map wraps
   *      smoothly (no visible seam at θ=0).
   *   3. Stamp a brighter "sky" band on the upper third + a darker
   *      "ground" band on the lower third, blended over the iri image,
   *      to keep PBR diffuse looking outdoor-natural.
   *   4. Push the canvas into a CanvasTexture, run PMREM, and swap it
   *      onto scene.environment. Old env render-targets are disposed.
   *
   * The CSS-pixel sample size of iri-card is ~halved when reading to
   * keep this cheap. We refresh ~ every 500ms (period adjustable),
   * which is plenty since reflections on matte cacti barely change
   * frame-to-frame anyway.                                           */
  var ENV_W = 512, ENV_H = 256;
  var envCanvas = document.createElement("canvas");
  envCanvas.width = ENV_W; envCanvas.height = ENV_H;
  var envCtx = envCanvas.getContext("2d");
  var sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = 256; sampleCanvas.height = 128;
  var sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });

  var pmrem = new THREE.PMREMGenerator(ren);
  pmrem.compileEquirectangularShader();
  var currentEnvRT = null;
  var envTex = new THREE.CanvasTexture(envCanvas);
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  envTex.colorSpace = THREE.SRGBColorSpace;

  /* Fallback gradient — used if iri-card hasn't rendered any pixels yet,
     or when sampling fails (cross-origin / blank canvas). Light mode
     uses a dim warm-grey sky→earth so the IBL's diffuse contribution
     stays subdued — the cactus body is supposed to read *darker* than
     the bright pastel iri backdrop, not paler than it. */
  function paintFallback(theme) {
    var g = envCtx.createLinearGradient(0, 0, 0, ENV_H);
    if (theme === "dark") {
      g.addColorStop(0.00, "#1a1638");
      g.addColorStop(0.30, "#2a1a48");
      g.addColorStop(0.50, "#2e1a3a");
      g.addColorStop(0.70, "#1a0e22");
      g.addColorStop(1.00, "#0a0610");
    } else {
      g.addColorStop(0.00, "#7a7468");
      g.addColorStop(0.30, "#8a7e6a");
      g.addColorStop(0.50, "#807058");
      g.addColorStop(0.70, "#5a4838");
      g.addColorStop(1.00, "#382818");
    }
    envCtx.globalCompositeOperation = "source-over";
    envCtx.fillStyle = g;
    envCtx.fillRect(0, 0, ENV_W, ENV_H);
  }

  function buildEnvFromIri() {
    var theme = currentTheme;
    /* 1) Paint sky/ground fallback first so the env is never black if
          sampling fails. */
    paintFallback(theme);

    /* 2) Try sampling the live iri-card canvas. WebGL canvases that
          weren't created with preserveDrawingBuffer can occasionally
          return an empty buffer if our rAF runs before the iri-card's
          rAF on a given frame. We probe a few pixels and reject the
          sample if it's effectively black so we don't poison the IBL
          with momentary nulls. */
    var sampled = false;
    if (iriCanvas && iriCanvas.width > 4 && iriCanvas.height > 4) {
      try {
        sampleCtx.clearRect(0, 0, sampleCanvas.width, sampleCanvas.height);
        sampleCtx.drawImage(iriCanvas, 0, 0, sampleCanvas.width, sampleCanvas.height);
        var probe = sampleCtx.getImageData(
          (sampleCanvas.width * 0.5) | 0, (sampleCanvas.height * 0.5) | 0, 4, 4
        ).data;
        var lum = 0;
        for (var pi = 0; pi < probe.length; pi += 4) {
          lum += probe[pi] + probe[pi + 1] + probe[pi + 2];
        }
        if (lum > 32) sampled = true;
      } catch (e) { sampled = false; }
    }

    /* 3) Composite the iri image onto the equirect canvas. We tile it
          horizontally twice (so the equirect map wraps smoothly) and
          place it in a *narrower* mid-band so the bright iri pixels
          don't dominate the env's hemispherical integration. The dark-
          mode iri is naturally dim, but the light-mode iri is near-white
          pastel — so we drop its alpha and keep the band tighter to
          stop it from over-lifting the cactus diffuse term. */
    if (sampled) {
      envCtx.globalCompositeOperation = "source-over";
      var bandAlpha = theme === "dark" ? 0.95 : 0.55;
      envCtx.globalAlpha = bandAlpha;
      var iw = sampleCanvas.width, ih = sampleCanvas.height;
      /* Narrower band in light mode so most of the env is still the
         (dim) fallback sky/ground rather than the bright iri pastels. */
      var bandY = theme === "dark" ? ENV_H * 0.18 : ENV_H * 0.32;
      var bandH = theme === "dark" ? ENV_H * 0.64 : ENV_H * 0.40;
      var halfW = ENV_W * 0.5;
      envCtx.drawImage(sampleCanvas, 0, 0, iw, ih, 0, bandY, halfW, bandH);
      envCtx.drawImage(sampleCanvas, 0, 0, iw, ih, halfW, bandY, halfW, bandH);
      envCtx.globalAlpha = 1.0;

      /* Soft top/bottom feathering so iri band blends into sky/ground */
      var topFade = envCtx.createLinearGradient(0, bandY - 16, 0, bandY + 32);
      topFade.addColorStop(0.0, theme === "dark" ? "rgba(10,6,16,1)" : "rgba(122,116,104,1)");
      topFade.addColorStop(1.0, "rgba(0,0,0,0)");
      envCtx.fillStyle = topFade;
      envCtx.fillRect(0, bandY - 16, ENV_W, 48);
      var botFade = envCtx.createLinearGradient(0, bandY + bandH - 32, 0, bandY + bandH + 16);
      botFade.addColorStop(0.0, "rgba(0,0,0,0)");
      botFade.addColorStop(1.0, theme === "dark" ? "rgba(10,6,16,1)" : "rgba(56,40,24,1)");
      envCtx.fillStyle = botFade;
      envCtx.fillRect(0, bandY + bandH - 32, ENV_W, 48);
    }

    /* 4) Push to PMREM and swap. Dispose previous render-target so we
          don't leak GPU memory across refreshes. */
    envTex.needsUpdate = true;
    var newRT = pmrem.fromEquirectangular(envTex);
    if (currentEnvRT) currentEnvRT.dispose();
    currentEnvRT = newRT;
    scene.environment = newRT.texture;
  }

  /* Initial env build (uses fallback if iri hasn't painted yet). */
  buildEnvFromIri();
  /* Refresh cadence: WebGL canvases without preserveDrawingBuffer are
     only safely readable inside the same animation frame they're drawn
     in, so we trigger refreshes from the main render loop ( see loop()
     below ) on a ~500ms interval rather than via setInterval which can
     fire mid-composite and read an empty back-buffer. */
  var lastEnvRefresh = 0;
  var ENV_REFRESH_MS = 500;

  /* React when the user toggles dark mode. We re-apply the theme
     preset and immediately rebuild the env so the cacti adopt the new
     palette in the same frame as the iri-card. */
  var themeObs = new MutationObserver(function () {
    var nt = detectTheme();
    if (nt !== currentTheme) {
      applyTheme(nt);
      buildEnvFromIri();
    }
  });
  themeObs.observe(document.documentElement, {
    attributes: true, attributeFilter: ["class"],
  });

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

  /* Areole tuft — small woolly puff at the spine origin.
     Real areoles are off-white / cream, slightly dingy from desert dust,
     not a glowing snow-white. */
  var _tuftGeo = new THREE.SphereGeometry(1, 6, 5);
  var _tuftMat = new THREE.MeshStandardMaterial({
    color: 0xe8d8b8, roughness: 0.98, metalness: 0,
    transparent: false, depthWrite: true,
  });
  _tuftMat.envMapIntensity = 0.65;

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
  /* Spine cluster generator.

     Each areole gets:
       - 1 central spine pointing along the areole's outward normal
       - rCount radial spines fanning around the central one
       - 1 wool tuft sphere at the base (if tuftScale > 0)

     The `style` parameter (final, optional argument) controls the
     radial fan geometry to fit different cactus species:
       "saguaro"  — strong tangential (spines hug body crests)
       "ribbed"   — moderate, like a cereus column
       "fero"     — dramatic outward (long curved fishhooks)
       "opuntia"  — bristly straight quills, mostly outward
       "mammillaria" — pinwheel-flat (very tangential)
       "balanced" (default) — middle ground

     Even within a style we add per-spine random jitter so no two spines
     point exactly the same way. */
  function makeSpines(parent, areoles, color, cLen, rLen, thick, rCount, tuftScale, tipColor, style) {
    cLen = cLen || 0.11;
    rLen = rLen || 0.06;
    thick = thick || 0.004;
    rCount = rCount || 4;
    tuftScale = tuftScale != null ? tuftScale : thick * 1.6;
    style = style || "balanced";

    /* Style → (normalAmt range, tangentialAmt range, anchorLiftMul). */
    var STYLE = {
      saguaro:     { nMin: 0.15, nMax: 0.25, tMin: 0.92, tMax: 0.98, anchor: -1.5 },
      ribbed:      { nMin: 0.30, nMax: 0.45, tMin: 0.78, tMax: 0.90, anchor: -1.2 },
      fero:        { nMin: 0.55, nMax: 0.78, tMin: 0.55, tMax: 0.78, anchor: -1.0 },
      opuntia:     { nMin: 0.65, nMax: 0.85, tMin: 0.45, tMax: 0.65, anchor: -0.9 },
      mammillaria: { nMin: 0.10, nMax: 0.18, tMin: 0.96, tMax: 1.02, anchor: -1.4 },
      balanced:    { nMin: 0.30, nMax: 0.45, tMin: 0.78, tMax: 0.92, anchor: -1.2 },
    };
    var sty = STYLE[style] || STYLE.balanced;

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
    /* Real cactus spines are modified leaves: dry, fibrous keratin-like
       tissue. Matte to slightly satin; never metallic-shiny. */
    var mat = new THREE.MeshStandardMaterial({
      color: tipColor != null ? 0xffffff : color,
      vertexColors: tipColor != null,
      roughness: 0.78, metalness: 0.0,
      transparent: false, depthWrite: true,
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

      /* Anchor spines slightly INTO the body. This is what makes spines
         look "rooted" rather than floating on top: the cone's base is
         buried just below the surface so its bottom edge doesn't show
         as a visible disc, and the body skin appears to grow up around
         the spine. Other species (Mammillaria, etc.) use the same trick
         with `lift > 0`; here we use a small NEGATIVE lift to bury the
         base because the saguaro's central spine geometry sits right
         at the rib crest. */
      var anchorLift = thick * sty.anchor;

      _dm.position.copy(a.p).addScaledVector(n, anchorLift);
      _dm.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(_up, n));
      _dm.scale.set(1.0, cLen * (0.85 + Math.random() * 0.3), 1.0);
      _dm.updateMatrix();
      inst.setMatrixAt(idx++, _dm.matrix);

      if (tufts) {
        /* Tuft sits AT the surface, slightly recessed so its bottom half
           is buried in the body — looks like wool growing from the areole
           rather than a sphere stuck on top. */
        _dm.position.copy(a.p).addScaledVector(n, -tuftScale * 0.55);
        _dm.quaternion.identity();
        _dm.scale.setScalar(tuftScale * (0.7 + Math.random() * 0.6));
        _dm.updateMatrix();
        tufts.setMatrixAt(i, _dm.matrix);
      }

      /* Radial spine fan — the spines that radiate AROUND the central
         spine at each areole. Real saguaro radials lie close to the body
         surface, fanning out like a star from each areole. They DO stick
         out a little (so they're visible from grazing angles) but they
         hug the body much more than they project outward.

         Direction recipe:
           tangentialAmt ≈ 0.92 (strong) — spines lay along the surface
           normalAmt     ≈ 0.18 (mild)   — small lift so they read
                                            against the body silhouette,
                                            not so much that they look
                                            like floating quills.
         Each radial is anchored slightly into the body (same as the
         central spine) so its base doesn't show. */
      var rc = rCount + ((Math.random() * 5 - 2) | 0);
      if (rc < 2) rc = 2;
      var bA = Math.random() * Math.PI * 2;
      for (var k = 0; k < rc && idx < max; k++) {
        var ang = bA + (k / rc) * Math.PI * 2;
        var tangentialAmt = sty.tMin + Math.random() * (sty.tMax - sty.tMin);
        var normalAmt     = sty.nMin + Math.random() * (sty.nMax - sty.nMin);
        var dir = n.clone().multiplyScalar(normalAmt)
          .addScaledVector(tan, Math.cos(ang) * tangentialAmt)
          .addScaledVector(bin, Math.sin(ang) * tangentialAmt)
          .normalize();
        _dm.position.copy(a.p).addScaledVector(n, anchorLift);
        _dm.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(_up, dir));
        _dm.scale.set(0.70, rLen * (0.55 + Math.random() * 0.70), 0.70);
        _dm.updateMatrix();
        inst.setMatrixAt(idx++, _dm.matrix);
      }
    }
    inst.count = idx;
    inst.instanceMatrix.needsUpdate = true;
    /* Disable frustum culling on the instanced spines.
       InstancedMesh's bounding sphere is derived from the source GEOMETRY
       (a single tiny cone) and is NOT recomputed from the per-instance
       matrices. As the parent cactus rotates, the renderer may decide
       the (tiny) sphere is off-screen and CULL the entire InstancedMesh
       — even though the actual instances span the full body. The
       perceived effect is "the spines blink in and out as the body
       rotates", or "the spines rotate at a different speed than the
       body". Disabling per-mesh frustum culling forces the renderer to
       always draw these spines (the parent body's culling still applies
       so off-screen cacti are skipped).                                */
    inst.frustumCulled = false;
    parent.add(inst);
    if (tufts) {
      tufts.instanceMatrix.needsUpdate = true;
      tufts.frustumCulled = false;
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

  /* Per-instance vertex-color tint.

     Real-world cacti of the SAME species rarely have identical hues —
     even within a single Sonoran-desert stand of saguaros you'll see
     plants ranging from dusty sage to deep forest green to slightly
     blue-green, depending on age, sun exposure, soil mineral uptake,
     and surface waxy bloom. Same goes for opuntia, ferocactus, etc.

     `tintCactus` walks every child mesh of the cactus group, reads its
     vertex-color attribute, and re-blends it toward a target color in
     RGB space. The blend amount (mixRGB) is mild (typically 0.15–0.35)
     so the species' core identity is preserved — only the OVERALL hue
     drifts along the realistic green band.

     Skin meshes only — we exclude small accent meshes (spines, flowers,
     tufts, white flecks) so those keep their species-specific palette. */
  function tintCactus(root, opts) {
    var t = new THREE.Color(opts.r, opts.g, opts.b);
    var mix = opts.mix != null ? opts.mix : 0.22;
    var valShift = opts.valShift != null ? opts.valShift : 0.0; /* darker (-) or brighter (+) overall */
    root.traverse(function (ch) {
      if (!ch.geometry) return;
      var attr = ch.geometry.getAttribute("color");
      if (!attr) return;
      /* Heuristic: only retint a mesh if it uses cactusSkinMaterial
         (vertexColors:true MeshPhysicalMaterial) AND has a meaningful
         vertex count. Spine InstancedMeshes either have no color attr
         or use a tiny per-vertex gradient (ConeGeometry) we want left
         alone so the warm spine palette survives. */
      var mat = ch.material;
      if (!mat) return;
      var isSkin = (mat.isMeshPhysicalMaterial === true) && (mat.vertexColors === true);
      if (!isSkin) return;
      var arr = attr.array;
      for (var i = 0; i < arr.length; i += 3) {
        var r = arr[i], g = arr[i + 1], b = arr[i + 2];
        r = r + (t.r - r) * mix + valShift;
        g = g + (t.g - g) * mix + valShift;
        b = b + (t.b - b) * mix + valShift;
        if (r < 0) r = 0; else if (r > 1) r = 1;
        if (g < 0) g = 0; else if (g > 1) g = 1;
        if (b < 0) b = 0; else if (b > 1) b = 1;
        arr[i] = r; arr[i + 1] = g; arr[i + 2] = b;
      }
      attr.needsUpdate = true;
    });
  }

  /* Per-species "realistic green" palette.

     Each entry defines a range of plausible tint shifts: tints[i] is one
     concrete RGB target the cactus may drift toward. mixRange controls
     how strongly the tint is applied (small = subtle, large = obvious).
     valRange shifts the overall brightness (some plants are paler from
     waxy bloom, others darker from rich water/nitrogen).

     Selection is uniform random per spawn, so two cacti of the same
     species rarely look identical. */
  var SHADE_PRESETS = {
    saguaro: {
      /* Sonoran saguaros: warm sage / yellow-sage. Some lean cooler
         (blue-sage) when waxy bloom is heavy. */
      tints: [
        { r: 0.40, g: 0.50, b: 0.28 }, /* warm sage (default-ish) */
        { r: 0.34, g: 0.46, b: 0.24 }, /* slightly deeper sage */
        { r: 0.38, g: 0.50, b: 0.32 }, /* cooler sage with waxy hint */
        { r: 0.32, g: 0.42, b: 0.22 }, /* darker mature trunk */
      ],
      mixRange: [0.15, 0.32],
      valRange: [-0.04, 0.03],
    },
    column: {
      /* Cereus / Pachycereus columns: usually deep forest green to almost
         blue-green from heavy bloom. */
      tints: [
        { r: 0.10, g: 0.28, b: 0.14 }, /* deep forest */
        { r: 0.13, g: 0.32, b: 0.16 }, /* mid forest */
        { r: 0.10, g: 0.26, b: 0.18 }, /* blue-green */
        { r: 0.16, g: 0.34, b: 0.14 }, /* slightly olive */
      ],
      mixRange: [0.18, 0.35],
      valRange: [-0.05, 0.03],
    },
    prickly_pear: {
      /* Opuntia pads: cool grey-green from heavy waxy bloom; sometimes
         olive or even slightly purple-toned at the edges. */
      tints: [
        { r: 0.16, g: 0.32, b: 0.18 }, /* default cool grey-green */
        { r: 0.20, g: 0.34, b: 0.16 }, /* warm olive */
        { r: 0.14, g: 0.30, b: 0.20 }, /* extra-bloomy blue-green */
        { r: 0.22, g: 0.36, b: 0.18 }, /* sun-faded yellow-green */
      ],
      mixRange: [0.18, 0.30],
      valRange: [-0.04, 0.04],
    },
    barrel: {
      /* Ferocactus: deep forest with subtle blue undertone, can be more
         olive-yellow on sun-faced sides. */
      tints: [
        { r: 0.12, g: 0.28, b: 0.10 }, /* deep matte */
        { r: 0.14, g: 0.30, b: 0.12 }, /* mid forest */
        { r: 0.16, g: 0.34, b: 0.10 }, /* yellow-leaning */
        { r: 0.10, g: 0.26, b: 0.14 }, /* cool blue-green */
      ],
      mixRange: [0.18, 0.32],
      valRange: [-0.05, 0.04],
    },
    ball: {
      /* Mammillaria: dark green, almost emerald in fresh growth, blue-
         green in mature plants. */
      tints: [
        { r: 0.08, g: 0.24, b: 0.10 }, /* deep matte */
        { r: 0.12, g: 0.28, b: 0.14 }, /* mid emerald */
        { r: 0.08, g: 0.22, b: 0.16 }, /* blue-green */
        { r: 0.14, g: 0.30, b: 0.10 }, /* yellow-emerald */
      ],
      mixRange: [0.20, 0.35],
      valRange: [-0.05, 0.04],
    },
    pinwheel: {
      /* Mammillaria spinosissima / Rebutia: mid green, sometimes with
         a coppery flush in strong sun. */
      tints: [
        { r: 0.10, g: 0.26, b: 0.14 },
        { r: 0.14, g: 0.30, b: 0.16 },
        { r: 0.12, g: 0.24, b: 0.18 },
        { r: 0.16, g: 0.30, b: 0.12 },
      ],
      mixRange: [0.18, 0.30],
      valRange: [-0.04, 0.04],
    },
    star: {
      /* Astrophytum: characteristically darker, more grey from heavy
         trichome flecks. */
      tints: [
        { r: 0.12, g: 0.22, b: 0.14 },
        { r: 0.15, g: 0.26, b: 0.14 },
        { r: 0.10, g: 0.20, b: 0.16 },
        { r: 0.16, g: 0.24, b: 0.12 },
      ],
      mixRange: [0.20, 0.35],
      valRange: [-0.04, 0.04],
    },
  };
  function pickShadePreset(name) {
    var p = SHADE_PRESETS[name];
    if (!p) return null;
    var tint = p.tints[(Math.random() * p.tints.length) | 0];
    var mix = p.mixRange[0] + Math.random() * (p.mixRange[1] - p.mixRange[0]);
    var valShift = p.valRange[0] + Math.random() * (p.valRange[1] - p.valRange[0]);
    return { r: tint.r, g: tint.g, b: tint.b, mix: mix, valShift: valShift };
  }

  function cactusSkinMaterial(opts) {
    /* Real cactus skin is matte to satin — covered in fine wax (cuticle)
       that gives a soft sheen at grazing angles, not a glossy clearcoat.
       We emulate this with high diffuse roughness + low-strength sheen
       (which only kicks in at grazing angles) + minimal clearcoat for a
       very subtle waxy hint. envMapIntensity is moderate so IBL provides
       real ambient illumination but the body never reads as "shiny".    */
    var m = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: opts.roughness != null ? opts.roughness : 0.88,
      metalness: 0.0,
      clearcoat: opts.clearcoat != null ? opts.clearcoat : 0.10,
      clearcoatRoughness: opts.clearcoatRoughness != null ? opts.clearcoatRoughness : 0.65,
      sheen: opts.sheen != null ? opts.sheen : 0.55,
      sheenRoughness: opts.sheenRoughness != null ? opts.sheenRoughness : 0.85,
      sheenColor: new THREE.Color(opts.sheenColor || 0x607048),
      transparent: false, depthWrite: true,
      side: THREE.FrontSide,
    });
    m.envMapIntensity = opts.envMapIntensity != null ? opts.envMapIntensity : 0.85;
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
  /* Build a rounded dome that seals one open end of a saguaro tube. The
     cap is a unit hemisphere (top half of a sphere) re-radiused per-rib to
     match the tube's ribbed cross-section, then oriented so the flat side
     faces inward along the tube's tangent at that endpoint. With caps in
     place, the tube reads as a solid plant body — no hollow interior. */
  function makeSaguaroCap(center, tangent, normal, binormal, radius, ribCount, ribDepth, color, isStart) {
    /* Hemisphere = top half of a sphere along +Y. */
    var SEG_W = Math.max(48, ribCount * 8);
    var SEG_H = 14;
    var hemi = new THREE.SphereGeometry(1, SEG_W, SEG_H, 0, Math.PI * 2, 0, Math.PI / 2);
    var pos = hemi.attributes.position;
    var vc = new Float32Array(pos.count * 3);
    var rib = new THREE.Color(color.rib);
    var base = new THREE.Color(color.base);

    /* Build TBN basis where +Y in the hemi maps to the OUTWARD tangent
       direction (away from the tube body), and X/Z map to the cross-
       section's normal/binormal. */
    var outward = tangent.clone().multiplyScalar(isStart ? -1 : 1).normalize();

    for (var i = 0; i < pos.count; i++) {
      var lx = pos.getX(i), ly = pos.getY(i), lz = pos.getZ(i);
      /* θ around the cross-section axis (atan2 of the local x,z plane) */
      var th = Math.atan2(lz, lx);
      /* Match the tube's rib profile so the cap blends seamlessly with
         the ribs at the seam. */
      var rw = (Math.cos(ribCount * th) + 1) * 0.5;
      var ribBump = Math.pow(rw, 1.8);
      /* Lateral radius factor: shrinks toward the dome top so the dome
         narrows naturally rather than ending in a flat disc. */
      var lateral = Math.sqrt(lx * lx + lz * lz);
      var ribbedR = radius * (1 - ribDepth + ribDepth * ribBump);
      /* Recompose: lateral component is in the normal/binormal plane,
         scaled by ribbedR; outward component is along the tube tangent.
         Real saguaro arm tips are noticeably ROUNDED — almost a half-
         sphere — not a shallow puck. Use ~1.0× radius for proper
         hemisphere proportions. */
      var DOME_HEIGHT_FACTOR = 1.00;
      var radialAmount = ribbedR * lateral;
      var outAmount = ly * radius * DOME_HEIGHT_FACTOR;
      var wx = center.x
        + normal.x   * Math.cos(th) * radialAmount
        + binormal.x * Math.sin(th) * radialAmount
        + outward.x  * outAmount;
      var wy = center.y
        + normal.y   * Math.cos(th) * radialAmount
        + binormal.y * Math.sin(th) * radialAmount
        + outward.y  * outAmount;
      var wz = center.z
        + normal.z   * Math.cos(th) * radialAmount
        + binormal.z * Math.sin(th) * radialAmount
        + outward.z  * outAmount;
      /* Subtle skin micro-displacement, same scale as the tube */
      var n1 = noise3(wx * 22, wy * 22, wz * 22) - 0.5;
      var n2 = (noise3(wx * 55, wy * 55, wz * 55) - 0.5) * 0.5;
      var disp = (n1 + n2) * 0.0030;
      var dnx = wx - center.x, dny = wy - center.y, dnz = wz - center.z;
      var dlen = Math.sqrt(dnx * dnx + dny * dny + dnz * dnz) || 1;
      wx += (dnx / dlen) * disp;
      wy += (dny / dlen) * disp;
      wz += (dnz / dlen) * disp;
      pos.setXYZ(i, wx, wy, wz);
      var cr = ribBump;
      var jitter = (n1 + n2) * 0.025;
      vc[i * 3]     = base.r + (rib.r - base.r) * cr + jitter;
      vc[i * 3 + 1] = base.g + (rib.g - base.g) * cr + jitter;
      vc[i * 3 + 2] = base.b + (rib.b - base.b) * cr + jitter;
    }
    hemi.setAttribute("color", new THREE.BufferAttribute(vc, 3));
    hemi.computeVertexNormals();
    return hemi;
  }

  function addSaguaroEndCaps(parentMesh, centers, tangents, normals, binormals, baseRad, tipRad, ribDepth, ribCount, color, skinMat, opts) {
    opts = opts || {};
    var capStart = opts.capStart !== false; /* default true */
    var capEnd   = opts.capEnd   !== false; /* default true */

    /* IMPORTANT — winding/handedness fix:
       The cap is built from a unit hemisphere whose triangles are wound
       CCW-from-outside in its local (X, Y, Z) frame, where +Y is the
       dome apex. We remap that local frame into world space using the
       basis (normal, binormal, outward). For the basis to preserve
       outward-facing winding we need
           det(normal, binormal, outward) = +1  (right-handed)
       Since the Frenet frame guarantees (T, N, B) is right-handed,
           N × B = T   ⇒   det = T · outward = ±1
       For the START cap, outward = -T  ⇒  det = -1 (left-handed)
       and every triangle ends up wound CCW-from-INSIDE the dome. With
       material.side = FrontSide that renders the dome as a hollow bowl
       (the visible artifact in the previous build).

       Fix: pass a flipped binormal to the start cap so the local frame
       becomes (N, -B, -T)  ⇒  det = +1, restoring outward-facing
       winding without touching SphereGeometry's index buffer. */
    if (capStart) {
      var bnFlipped = binormals[0].clone().multiplyScalar(-1);
      var startCap = makeSaguaroCap(
        centers[0], tangents[0], normals[0], bnFlipped,
        baseRad, ribCount, ribDepth, color, true
      );
      parentMesh.add(new THREE.Mesh(startCap, skinMat));
    }

    if (capEnd) {
      var lastIdx = centers.length - 1;
      var endCap = makeSaguaroCap(
        centers[lastIdx], tangents[lastIdx], normals[lastIdx], binormals[lastIdx],
        tipRad, ribCount, ribDepth, color, false
      );
      parentMesh.add(new THREE.Mesh(endCap, skinMat));
    }
  }

  function buildSaguaroSegment(curvePts, baseRad, tipRad, ribCount, ribDepth, areolesPerRib, color, segOpts) {
    segOpts = segOpts || {};
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

    var skinMat = cactusSkinMaterial({
      roughness: 0.90, clearcoat: 0.08, clearcoatRoughness: 0.70,
      sheen: 0.50, sheenRoughness: 0.85, sheenColor: 0x4a5a3a,
      envMapIntensity: 0.85,
    });
    var mesh = new THREE.Mesh(tube, skinMat);

    /* Cap the open tube ends with rounded domes so the saguaro is visibly
       solid (TubeGeometry leaves t=0 and t=1 wide open — without caps you
       can see straight down the hollow interior of the trunk and arms).
       Caller can suppress either cap; arms suppress their start cap so
       they appear to fuse into the trunk rather than show a visible
       disc/bowl at the attachment point. */
    addSaguaroEndCaps(
      mesh, centers, tangents, normals, binormals,
      baseRad, tipRad, ribDepth, ribCount, color, skinMat,
      { capStart: segOpts.capStart !== false, capEnd: segOpts.capEnd !== false }
    );

    /* Areoles ON the rib crests, spaced in vertical rows.

       PHYLLOTAXIS — real saguaro spine spirals follow an irrational angle
       (close to the golden angle) as you move from one rib to the next.
       This produces a smooth, organic spiral pattern where neighbouring
       ribs are gently offset relative to each other but no two ribs
       repeat their alignment.

       Earlier the offset was (ri % 2) * 0.5 — a hard alternation between
       0 and 0.5 — which produced a very obvious ZIGZAG pattern (like
       chevrons or stitching on the trunk). That's not how real plants
       look. Switching to GOLDEN-RATIO offsets per rib gives a quasi-
       random distribution that reads as the natural saguaro spine spiral
       without forming any visible repeating pattern.

       Suppress areoles in the BURIED portion of arms (areoleStart > 0)
       so spines don't stab through the trunk wall at the junction. */
    var areoleStart = (segOpts.areoleStart != null) ? segOpts.areoleStart : 0;
    var GOLDEN = 0.6180339887; /* irrational fractional spiral step per rib */
    var ar = [];
    for (var ri = 0; ri < ribCount; ri++) {
      var ribTh = (ri / ribCount) * Math.PI * 2;
      var nx2 = Math.cos(ribTh), nz2 = Math.sin(ribTh);
      /* Each rib is offset by GOLDEN×ri (modulo 1) — quasi-random spiral. */
      var ribPhase = (ri * GOLDEN) % 1;
      for (var ai2 = 1; ai2 <= areolesPerRib; ai2++) {
        var t2 = (ai2 - 0.5 + ribPhase) / areolesPerRib;
        if (t2 >= 1.0) continue; /* skip any areole that gets pushed past the tip */
        if (t2 < areoleStart) continue; /* skip buried base */
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
    /* Saguaro spines: dense golden-amber clusters along every rib —
       the golden stripes you see in reference photos are clusters of
       these spines. Warm honey base fading to pale straw tips.
       Tuned values:
         cLen 0.045 — longer central spine so it remains visible even
                      when its rib faces the camera (foreshortened)
         rLen 0.030 — radial spines slightly shorter; lay close to body
         thick 0.0024 — slim spines (saguaros have fine needle spines)
         rCount 7   — slightly fewer radials per areole
         tuftScale 0.0040 — small areole wool, mostly recessed into body
         tipColor — pale straw tips for the natural sun-bleached look */
    makeSpines(mesh, ar, 0x8a5a18, 0.045, 0.030, 0.0024, 7, 0.0040, 0xf2dba0, "saguaro");
    return mesh;
  }

  /* Saguaro shade palette — different real-world variants seen in the
     Sonoran desert. Per-instance one of these palettes is selected so
     successive saguaros look genuinely different in color, not just
     differently sized. (Per-instance vertex tinting in `tintCactus`
     adds further drift on top of these.)

     Each palette has matched (base = shaded valley, rib = sun-faced
     crest) so the warm rib stripes that make a saguaro readable from
     a distance are preserved across all variants. */
  var SAGUARO_PALETTES = [
    /* Warm sage — classic Sonoran (default-ish). */
    { base: [0.235, 0.345, 0.175], rib: [0.475, 0.555, 0.270] },
    /* Deep forest — older, mature trunk; darker overall. */
    { base: [0.175, 0.295, 0.150], rib: [0.395, 0.475, 0.235] },
    /* Yellow-sage — sun-stressed plant on south-facing slopes. */
    { base: [0.275, 0.370, 0.180], rib: [0.520, 0.580, 0.270] },
    /* Cool blue-green — younger plant with heavy waxy bloom. */
    { base: [0.205, 0.335, 0.225], rib: [0.430, 0.530, 0.330] },
    /* Olive-grey — high-elevation or drought-stressed plant. */
    { base: [0.230, 0.305, 0.165], rib: [0.450, 0.510, 0.255] },
  ];

  function buildSaguaro() {
    var g = new THREE.Group();
    /* Pick a per-instance saguaro palette. Calibrated so rib crests are
       always clearly warmer than the valleys (the contrast is what
       gives a saguaro its readable vertical stripes from any distance). */
    var pal = SAGUARO_PALETTES[(Math.random() * SAGUARO_PALETTES.length) | 0];
    var color = {
      base: new THREE.Color(pal.base[0], pal.base[1], pal.base[2]),
      rib:  new THREE.Color(pal.rib[0],  pal.rib[1],  pal.rib[2]),
    };

    /* Trunk: nearly vertical centerline with a soft bend so it doesn't
       look perfectly cylindrical. Per-instance height jitter so we get
       short stocky, average, and tall lanky individuals. */
    var trunkH = 1.40 + Math.random() * 0.40; /* 1.40 – 1.80 */
    var trunkBaseR = 0.165 + Math.random() * 0.025; /* 0.165 – 0.190 */
    var trunkTipR  = trunkBaseR * (0.70 + Math.random() * 0.10);
    /* Soft random bend in a random azimuth (subtle so the trunk still
       reads as upright). */
    var bendAz = Math.random() * Math.PI * 2;
    var bendAmt = (Math.random() - 0.5) * 0.025;
    var bx = Math.sin(bendAz) * bendAmt;
    var bz = Math.cos(bendAz) * bendAmt;
    var trunkPts = [
      new THREE.Vector3(0, 0,           0),
      new THREE.Vector3(bx * 0.5, trunkH * 0.30, bz * 0.5),
      new THREE.Vector3(bx,       trunkH * 0.55, bz),
      new THREE.Vector3(bx * 0.6, trunkH * 0.80, bz * 0.6),
      new THREE.Vector3(0,        trunkH,        0),
    ];
    var trunk = buildSaguaroSegment(trunkPts, trunkBaseR, trunkTipR, 16, 0.10, 32, color);
    g.add(trunk);

    /* ARM COUNT — natural distribution.

       In nature, a saguaro takes 50-100 years to grow its first arm,
       and most mature individuals have 0-5 arms. The very iconic
       multi-armed candelabra (5+ arms) are rare but visually striking.
       Distribution roughly:
         0 arms : young/lone     – 12%
         1 arm                    – 18%
         2 arms (classic logo)    – 28%
         3 arms                   – 22%
         4 arms                   – 12%
         5 arms (full candelabra) –  8%
    */
    var armRoll = Math.random();
    var armCount;
    if      (armRoll < 0.12) armCount = 0;
    else if (armRoll < 0.30) armCount = 1;
    else if (armRoll < 0.58) armCount = 2;
    else if (armRoll < 0.80) armCount = 3;
    else if (armRoll < 0.92) armCount = 4;
    else                     armCount = 5;

    var trunkR = trunkBaseR * 0.94; /* effective wall radius for arm contact */
    var armBaseRad = 0.078 + Math.random() * 0.018;

    /* Distribute arms around the trunk WITHOUT collision.

       Strategy:
       1) Each arm gets its own equal-share azimuth slot (360°/armCount).
          The slot WIDTH is the angular distance between adjacent arms.
          With 5 arms that's 72°; with 2 arms that's 180°.
       2) Each arm is centered in its slot and may jitter ±20% of the
          slot width — so worst-case spacing between adjacent arms is
          slot * 0.6, which is generous enough to prevent visual overlap
          (e.g. 5 arms → min spacing 43°, comfortably more than the
          arm's 30° angular footprint).
       3) Pick `armCount` distinct startY heights from a vertical ladder
          along the trunk (avoid two arms at the same height).
       4) Random global rotation so the cactus isn't always facing the
          same direction.                                              */
    var azBase = Math.random() * Math.PI * 2;
    var slotW = (armCount > 0) ? (Math.PI * 2 / armCount) : 0;
    /* Vertical ladder: spread arms across the upper 60% of the trunk.
       The lowest arm is around 35% of trunk height (mature saguaros
       grow arms only after the trunk is well-established) and the
       highest is around 85% (so the arm tips don't overshoot the trunk
       top). Within those bounds we sample evenly with random jitter. */
    var yLo = trunkH * 0.35;
    var yHi = trunkH * 0.85;
    var ySlots = [];
    if (armCount > 0) {
      var span = yHi - yLo;
      for (var yi = 0; yi < armCount; yi++) {
        var t = (armCount === 1) ? (0.45 + Math.random() * 0.20)
                                 : (yi / (armCount - 1));
        var jitter = (Math.random() - 0.5) * (span / Math.max(armCount, 2)) * 0.30;
        ySlots.push(yLo + span * t + jitter);
      }
      /* Shuffle so lowest azimuth slot doesn't always get lowest height. */
      for (var sy = ySlots.length - 1; sy > 0; sy--) {
        var syj = (Math.random() * (sy + 1)) | 0;
        var syw = ySlots[sy]; ySlots[sy] = ySlots[syj]; ySlots[syj] = syw;
      }
    }

    for (var ai = 0; ai < armCount; ai++) {
      /* Azimuth: ai-th equal slot around the trunk, jittered by at most
         ±20% of the slot width so arms can never bleed into each other. */
      var az = azBase + ai * slotW
             + (Math.random() - 0.5) * slotW * 0.40;
      var aSin = Math.sin(az), aCos = Math.cos(az);
      var startY = ySlots[ai];

      /* Cap arm rise so the arm tip stays at or below the trunk top. */
      var maxRise = (trunkH - 0.04) - startY;
      var armRise = Math.max(0.32, Math.min(0.50 + Math.random() * 0.25, maxRise));

      /* Arm geometry — clean smooth-J curve, sitting entirely outside the
         trunk wall.

         Critical: the radial coordinates of the control points must be
         MONOTONICALLY NON-DECREASING from p0 → p_elbow. If the radius
         goes OUT then comes BACK IN at the elbow (which happens when
         p2 is at a larger radius than p3), the Catmull-Rom curve forms
         a visible BUMP at p2 — looks like a kinked / zigzag arm.

         Radial progression (where rOut >= rContact + armBaseRad):
           p0: rContact       (at trunk wall)
           p1: ~halfway out   (defines start tangent)
           p2: rOut * 0.85    (lower than rOut to avoid overshoot)
           p3: rOut           (elbow, arm now fully outward)
           p4: rOut           (vertical candelabrum)
           p5: rOut * 0.97    (tip subtly curled back)
           p6: rOut * 0.93    (tip apex)
         All Y-coordinates monotonically increase. */
      var rContact = trunkR + armBaseRad * 0.05;
      var rOut     = trunkR + armBaseRad + 0.07 + Math.random() * 0.05;
      var rMid1    = rContact + (rOut - rContact) * 0.45;
      var rMid2    = rContact + (rOut - rContact) * 0.78;

      var yBud   = startY;
      var yBend1 = startY + 0.07;
      var yBend2 = startY + 0.16;
      var yElbow = startY + 0.26;
      var yMid   = startY + armRise * 0.65;
      var yTip   = startY + armRise;

      /* Control points: smooth radial progression, monotonic Y.
           p0  — contact point at the trunk wall.
           p1  — partway out, defines a smooth start tangent that points
                 mostly upward with a moderate outward component.
           p2  — closer to rOut but not yet there (avoids overshoot).
           p3  — elbow: arm reaches its maximum outward radius.
           p4  — candelabrum mid-section (parallel to trunk).
           p5  — pre-tip, slightly curled back.
           p6  — tip apex, curled back toward trunk axis.                */
      var armPts = [
        new THREE.Vector3(aSin * rContact, yBud,    aCos * rContact),
        new THREE.Vector3(aSin * rMid1,    yBend1,  aCos * rMid1),
        new THREE.Vector3(aSin * rMid2,    yBend2,  aCos * rMid2),
        new THREE.Vector3(aSin * rOut,     yElbow,  aCos * rOut),
        new THREE.Vector3(aSin * rOut,     yMid,    aCos * rOut),
        new THREE.Vector3(aSin * rOut * 0.97, yTip - 0.05, aCos * rOut * 0.97),
        new THREE.Vector3(aSin * rOut * 0.93, yTip,        aCos * rOut * 0.93),
      ];
      var armRib = 14;
      /* Slight per-arm radius jitter so multi-armed saguaros don't have
         identical clones (real plants have older/larger and younger/
         thinner arms on the same trunk). */
      var armBR = armBaseRad * (0.92 + Math.random() * 0.16);
      var armTR = armBR * (0.70 + Math.random() * 0.08);
      var arm = buildSaguaroSegment(
        armPts, armBR, armTR, armRib, 0.10, 22, color,
        { capStart: true, capEnd: true, areoleStart: 0.05 }
      );
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

  /* Build a single column stem — extracted so it can be combined into
     multi-stem clusters (Pachycereus marginatus, Stenocereus thurberi,
     etc.). Returns a Group containing the body mesh and its spines. */
  function makeColumnStem(opts) {
    var g = new THREE.Group();
    var RC = opts.RC || 11;
    var RD = opts.RD != null ? opts.RD : 0.18;
    var R  = opts.R  || 0.14;
    var YS = opts.YS || 2.6;
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
    /* 2) Skin noise + color (deep matte forest green, mossy).
       The base color is intentionally deep — per-instance tint
       (`tintCactus`) will lift some plants toward warmer olive or
       cooler blue-green for variety. */
    applyCactusSkin(geo, {
      base: new THREE.Color(0.085, 0.245, 0.115),
      rib: new THREE.Color(0.225, 0.420, 0.195),
      noiseFreq: 18, noiseAmp: 0.0048,
      colorJitter: 0.045, bleach: 0.08,
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
      roughness: 0.90, clearcoat: 0.08, clearcoatRoughness: 0.70,
      sheen: 0.55, sheenRoughness: 0.85, sheenColor: 0x4a5a3a,
      envMapIntensity: 0.85,
    })));
    /* Honey-amber spines, dry straw tips. Cereus columns project spines
       outward from each rib crest (visible as a starburst at silhouette
       and as bristly clusters at center) — use "ribbed" style. */
    makeSpines(g, ribAreoles(RC, 11, R, RD, YS, 0.42), 0x946818, 0.058, 0.044, 0.0030, 5, 0.012, 0xd8b878, "ribbed");
    return g;
  }

  /* Column variants — based on real cereus-family habits:
       "solitary"  (50%) — single tall column (classic).
       "paired"    (25%) — two columns of slightly different heights.
       "trio"      (15%) — three columns in a small arc.
       "cluster"   (10%) — 4-5 columns clumped tight (Stenocereus
                            thurberi / "organ pipe" habit).
     Stems are placed at separate (x,z) anchors so they never overlap
     visually, and all are aligned to the same baseline so the cluster
     reads as a single plant rather than separate plants. */
  function buildColumn() {
    var g = new THREE.Group();
    var roll = Math.random();
    var variant;
    if      (roll < 0.50) variant = "solitary";
    else if (roll < 0.75) variant = "paired";
    else if (roll < 0.90) variant = "trio";
    else                  variant = "cluster";

    var azBase = Math.random() * Math.PI * 2;

    function addStem(rxFactor, rzFactor, scaleY, scaleR, offsetAz) {
      var R  = 0.14 * scaleR;
      var YS = 2.6 * scaleY;
      var stem = makeColumnStem({ RC: 11, RD: 0.18, R: R, YS: YS });
      /* Tilt/turn each stem subtly outward so cluster doesn't look like
         a regular grid of rods. */
      var az = azBase + offsetAz;
      stem.position.set(Math.cos(az) * rxFactor, 0, Math.sin(az) * rzFactor);
      /* Slight tilt away from cluster center (organ-pipe stems lean
         slightly outward as they grow). */
      var tiltAmt = (rxFactor + rzFactor) * 0.5;
      stem.rotation.x = Math.sin(az) * tiltAmt * 0.20;
      stem.rotation.z = -Math.cos(az) * tiltAmt * 0.20;
      stem.rotation.y = Math.random() * Math.PI * 2;
      g.add(stem);
    }

    if (variant === "solitary") {
      addStem(0, 0, 1.0 + Math.random() * 0.10, 1.0, 0);
    } else if (variant === "paired") {
      var sepP = 0.16 + Math.random() * 0.04;
      addStem(sepP, sepP * 0.3, 0.95 + Math.random() * 0.10, 0.95, 0);
      addStem(sepP, sepP * 0.3, 0.85 + Math.random() * 0.10, 0.92, Math.PI);
    } else if (variant === "trio") {
      var sepT = 0.18 + Math.random() * 0.04;
      for (var ti = 0; ti < 3; ti++) {
        var az3 = (ti / 3) * Math.PI * 2;
        var sY = 0.85 + Math.random() * 0.20;
        var sR = 0.85 + Math.random() * 0.10;
        addStem(sepT, sepT, sY, sR, az3);
      }
    } else { /* cluster */
      /* 4-5 stems in a tight ring (organ-pipe style) — outer stems
         shorter than the central one. */
      var nC = 4 + ((Math.random() * 2) | 0);
      addStem(0, 0, 1.0 + Math.random() * 0.10, 1.0, 0);
      var sepC = 0.20 + Math.random() * 0.04;
      for (var ci = 0; ci < nC; ci++) {
        var azc = (ci / nC) * Math.PI * 2;
        var sY2 = 0.65 + Math.random() * 0.25;
        var sR2 = 0.78 + Math.random() * 0.10;
        addStem(sepC, sepC, sY2, sR2, azc);
      }
    }

    /* Center the cluster on its bbox so rotation is balanced. */
    var bb = new THREE.Box3().setFromObject(g);
    var cy = (bb.min.y + bb.max.y) * 0.5;
    var cx = (bb.min.x + bb.max.x) * 0.5;
    var cz = (bb.min.z + bb.max.z) * 0.5;
    g.children.forEach(function (c) {
      c.position.x -= cx;
      c.position.y -= cy;
      c.position.z -= cz;
    });
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
    /* Opuntia pad: cool grey-green from heavy waxy bloom — pads on the
       same plant often differ in tone (older pads bloom cooler, younger
       pads warm sage). The vertex-color gradient base→top fakes that. */
    var base = new THREE.Color(0.135, 0.285, 0.165);
    var top  = new THREE.Color(0.265, 0.445, 0.245);
    for (var i = 0; i < p.count; i++) {
      var oy = p.getY(i);
      var ox = p.getX(i);
      var oz = p.getZ(i);
      var n1 = noise3(ox * 20, oy * 20, oz * 20) - 0.5;
      var n2 = (noise3(ox * 48, oy * 48, oz * 48) - 0.5) * 0.5;
      var n3 = (noise3(ox * 110, oy * 110, oz * 110) - 0.5) * 0.30;
      var disp = (n1 + n2 + n3) * 0.0060;
      p.setY(i, oy * ovalY + (disp * Math.sign(oy || 1)));
      p.setZ(i, oz * flatZ + disp * Math.sign(oz || 1) * 0.2);
      p.setX(i, ox + disp * Math.sign(ox || 1) * 0.4);
      var hf = (oy / radius + 1) * 0.5;
      var jitter = (n1 + n2) * 0.06;
      vc[i * 3]     = base.r + (top.r - base.r) * hf + jitter;
      vc[i * 3 + 1] = base.g + (top.g - base.g) * hf + jitter;
      vc[i * 3 + 2] = base.b + (top.b - base.b) * hf + jitter * 0.55;
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
    /* Slightly desaturated naturalistic flower colors — opuntia blooms
       are vivid but not neon. */
    var cols = [0xc8341a, 0xb8366e, 0xd88820, 0xc8442a, 0xe8b428];
    var col = cols[(Math.random() * cols.length) | 0];
    var fM = new THREE.MeshStandardMaterial({
      color: col, roughness: 0.65, metalness: 0,
      transparent: false, depthWrite: true,
    });
    fM.envMapIntensity = 0.75;
    for (var fi = 0; fi < count; fi++) {
      var a = areoles[(Math.random() * areoles.length) | 0];
      var fl = new THREE.Mesh(petGeo, fM);
      fl.position.copy(a.p).addScaledVector(a.n, 0.015);
      fl.scale.set(1.1, 0.7 + Math.random() * 0.4, 1.1);
      parent.add(fl);
    }
  }

  /* Opuntia "tuna" (cactus fruit / pear) — the iconic red-orange-pink
     elongated berries that grow ringed along the upper rim of a prickly
     pear pad. Each tuna is a slightly elongated egg shape with a flat
     "navel" depression at the tip (the dried remains of the flower).

     Per-fruit color picked from a desert-realistic palette: ripe ruby,
     orange-red, pink, sun-bleached salmon, and just-ripening greenish-
     yellow. Their distribution is along the UPPER perimeter of the pad
     (in the pad's local coordinate frame) where the original flowers
     bloomed. */
  function addOpuntiaTunas(parent, padRadius, padOvalY, padFlatZ, count) {
    if (count <= 0) return;
    /* Slightly elongated body — taller than wide. */
    var bodyGeo = new THREE.SphereGeometry(1.0, 16, 14);
    var bp = bodyGeo.attributes.position;
    var bvc = new Float32Array(bp.count * 3);
    /* Per-vertex color = base + random tone shift. We'll pick the base
       color per-fruit at instantiation time and bake it via material
       color, so the geo only carries the shading variation. */
    for (var i = 0; i < bp.count; i++) {
      var oy = bp.getY(i);
      bp.setY(i, oy * 1.30); /* elongate along Y */
      var fy = (oy + 1) * 0.5;
      /* Vertex color = grayscale shade so MeshStandardMaterial.color
         can multiply it. Top of fruit slightly lighter from sun
         exposure, bottom slightly deeper. Subtle noise for skin
         mottling. */
      var ox = bp.getX(i), oz = bp.getZ(i);
      var nz = noise3(ox * 6, oy * 6, oz * 6) - 0.5;
      var shade = 0.85 + fy * 0.20 + nz * 0.10;
      if (shade < 0.55) shade = 0.55;
      if (shade > 1.15) shade = 1.15;
      bvc[i * 3] = bvc[i * 3 + 1] = bvc[i * 3 + 2] = shade;
    }
    bodyGeo.setAttribute("color", new THREE.BufferAttribute(bvc, 3));
    bodyGeo.computeVertexNormals();

    /* Tiny "navel" disc on the tip — the persistent dried floral cup */
    var navelGeo = new THREE.CylinderGeometry(0.55, 0.65, 0.18, 12, 1, true);

    /* Fruit tone palette — covering the realistic spectrum:
         ripe ruby red, orange-red, pink-magenta, salmon, ripening yellow */
    var FRUIT_COLORS = [
      0xb8281e, /* ruby red */
      0xc44a1e, /* orange red */
      0xa42a48, /* magenta pink */
      0xd66238, /* salmon */
      0xc83a30, /* deep ruby */
      0xb8531c, /* burnt orange */
      0xa5331e, /* dark wine */
      0xd0904a, /* ripening tan-yellow */
    ];

    /* The pad is in the X-Y plane (with thickness on Z). The "rim"
       (where flowers/fruit appear) is the upper edge — top half of the
       ellipse. We sample uniformly along the upper arc. */
    for (var fi = 0; fi < count; fi++) {
      var color = FRUIT_COLORS[(Math.random() * FRUIT_COLORS.length) | 0];

      /* Slight color jitter per-fruit so even within one rim cluster
         no two berries are identically colored. */
      var c = new THREE.Color(color);
      c.offsetHSL(
        (Math.random() - 0.5) * 0.04,
        (Math.random() - 0.5) * 0.10,
        (Math.random() - 0.5) * 0.08
      );
      var fruitMat = new THREE.MeshStandardMaterial({
        color: c, vertexColors: true,
        roughness: 0.72, metalness: 0.0,
        transparent: false, depthWrite: true,
      });
      fruitMat.envMapIntensity = 0.55;
      var navelMat = new THREE.MeshStandardMaterial({
        color: 0x4a2818, roughness: 0.92, metalness: 0,
        transparent: false, depthWrite: true,
      });
      navelMat.envMapIntensity = 0.40;

      /* Rim position: pick angle in upper half of the pad outline (slight
         randomness around top edge). Real opuntia tunas crown the upper
         rim of the pad in a ring. */
      var ang = -Math.PI * 0.05 + Math.random() * Math.PI * 1.10;
      /* Slightly inside the ellipse so the fruit base is anchored on the
         pad surface, not floating off the edge. */
      var rimR = 0.94 + Math.random() * 0.06;
      var rx = Math.cos(ang) * padRadius * rimR;
      var ry = Math.sin(ang) * padRadius * padOvalY * rimR;
      /* Pick which face of the pad (front or back) */
      var face = Math.random() < 0.5 ? 1 : -1;
      var rz = face * padRadius * padFlatZ * 0.9;

      /* Fruit size — varied (some berries fresh & full, some shriveled). */
      var fr = 0.030 + Math.random() * 0.018;
      /* Outward direction for the fruit: from rim point, mostly OUT
         (away from pad center) and slightly OFF the pad surface (so it
         sits PROUD of the pad rather than embedded). */
      var outVec = new THREE.Vector3(rx, ry, 0).normalize();
      var faceVec = new THREE.Vector3(0, 0, face);
      var dirVec = outVec.clone().multiplyScalar(0.65)
        .add(faceVec.clone().multiplyScalar(0.55))
        .add(new THREE.Vector3(0, 1, 0).multiplyScalar(0.20))
        .normalize();
      /* Anchor: just at the rim edge */
      var anchor = new THREE.Vector3(rx, ry, rz)
        .addScaledVector(dirVec, fr * 0.85);
      var qOut = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0), dirVec
      );
      var body = new THREE.Mesh(bodyGeo, fruitMat);
      body.position.copy(anchor);
      body.quaternion.copy(qOut);
      body.scale.set(fr * 0.9, fr * 1.15, fr * 0.9);
      parent.add(body);

      var navel = new THREE.Mesh(navelGeo, navelMat);
      navel.position.copy(anchor)
        .addScaledVector(dirVec, fr * 1.18);
      navel.quaternion.copy(qOut);
      navel.scale.set(fr * 0.55, fr * 0.18, fr * 0.55);
      parent.add(navel);
    }
  }

  /* ----- Prickly pear pad attachment helper ----- */
  function makeOpuntiaPad(parent, mat, params) {
    var R = params.r, ovalY = params.ovalY, flatZ = params.flatZ;
    var pos = params.pos, rot = params.rot;
    var density = params.density != null ? params.density : 1.5;
    var spineLen = params.spineLen != null ? params.spineLen : 0.024;
    var spineRLen = params.spineRLen != null ? params.spineRLen : 0.018;
    var withFlowers = params.flowers != null ? params.flowers : 0;
    var withFruit = params.fruit != null ? params.fruit : 0;

    var padG = makePad(R, ovalY, flatZ);
    var pad = new THREE.Mesh(padG, mat);
    if (pos) pad.position.copy(pos);
    if (rot) pad.rotation.copy(rot);
    parent.add(pad);
    var ar = padAreoles(R, ovalY, flatZ, density);
    makeSpines(pad, ar, 0xa8895a, spineLen, spineRLen, 0.0016, 3, 0.006, 0xe8d8b0, "opuntia");
    if (withFlowers > 0) addFlowers(pad, ar, withFlowers);
    if (withFruit > 0) addOpuntiaTunas(pad, R, ovalY, flatZ, withFruit);
    return pad;
  }

  /* Prickly pear with realistic shape variants. Real opuntia clumps are
     enormously varied — some are a single pad, others are dense fans of
     5-7 pads, others sprawl in a chain. We pick one of these silhouettes
     per spawn. */
  function buildPear() {
    var g = new THREE.Group();
    var padMat = cactusSkinMaterial({
      roughness: 0.92, clearcoat: 0.06, clearcoatRoughness: 0.75,
      sheen: 0.55, sheenRoughness: 0.85, sheenColor: 0x4a5a3a,
      envMapIntensity: 0.85,
    });

    /* Variant selector */
    var roll = Math.random();
    var variant;
    if      (roll < 0.20) variant = "single";   /* one big pad */
    else if (roll < 0.45) variant = "classic";  /* 3 pads (current) */
    else if (roll < 0.70) variant = "fan";      /* 4-5 fanned pads */
    else if (roll < 0.88) variant = "chain";    /* sprawling 4 pads */
    else                  variant = "cluster";  /* dense 5-6 pads */

    /* Per-instance: ~50% chance of carrying ripe fruit; otherwise just
       flowers; small chance of bare. */
    var fruitRoll = Math.random();
    var hasFruit = fruitRoll < 0.55;
    var hasFlowers = !hasFruit && fruitRoll < 0.85;

    var FR = function (n) { return hasFruit ? n : 0; };
    var FL = function (n) { return hasFlowers ? n : 0; };

    if (variant === "single") {
      makeOpuntiaPad(g, padMat, {
        r: 0.34, ovalY: 1.50, flatZ: 0.17,
        density: 1.7, spineLen: 0.026, spineRLen: 0.020,
        flowers: FL(3), fruit: FR(4 + ((Math.random() * 3) | 0)),
      });
    } else if (variant === "classic") {
      makeOpuntiaPad(g, padMat, {
        r: 0.30, ovalY: 1.45, flatZ: 0.16,
        density: 1.6, flowers: FL(2), fruit: FR(3 + ((Math.random() * 2) | 0)),
      });
      makeOpuntiaPad(g, padMat, {
        r: 0.21, ovalY: 1.30, flatZ: 0.15,
        pos: new THREE.Vector3(0.06, 0.34, 0.025),
        rot: new THREE.Euler(0, 0.45, -0.30),
        density: 1.6, flowers: FL(2), fruit: FR(2 + ((Math.random() * 2) | 0)),
      });
      makeOpuntiaPad(g, padMat, {
        r: 0.16, ovalY: 1.25, flatZ: 0.14,
        pos: new THREE.Vector3(-0.04, 0.30, -0.04),
        rot: new THREE.Euler(0, -0.50, 0.30),
        density: 1.4, fruit: FR(1 + ((Math.random() * 2) | 0)),
      });
    } else if (variant === "fan") {
      /* Big base pad with 3-4 daughter pads radiating from its top
         edge — like an open hand. */
      makeOpuntiaPad(g, padMat, {
        r: 0.30, ovalY: 1.45, flatZ: 0.16,
        density: 1.6, flowers: FL(2), fruit: FR(3 + ((Math.random() * 2) | 0)),
      });
      var fanCount = 3 + ((Math.random() * 2) | 0);
      for (var fi = 0; fi < fanCount; fi++) {
        /* Fan from -0.7 to +0.7 radians off vertical */
        var t = fanCount === 1 ? 0 : (fi / (fanCount - 1));
        var angle = -0.7 + t * 1.4;
        var dist = 0.36 + Math.random() * 0.05;
        var px = Math.sin(angle) * dist;
        var py = 0.28 + Math.cos(angle) * dist * 0.50;
        var rPad = 0.18 + Math.random() * 0.05;
        makeOpuntiaPad(g, padMat, {
          r: rPad, ovalY: 1.30, flatZ: 0.15,
          pos: new THREE.Vector3(px, py, (Math.random() - 0.5) * 0.06),
          rot: new THREE.Euler(0, angle * 0.5, angle * 0.7),
          density: 1.5, flowers: FL(1),
          fruit: FR(1 + ((Math.random() * 2) | 0)),
        });
      }
    } else if (variant === "chain") {
      /* Sprawling 3-4 pads stacked diagonally, each tilted from the
         last — like a chain growing sideways. */
      var chainLen = 3 + ((Math.random() * 2) | 0);
      var px2 = 0, py2 = 0;
      var dir = (Math.random() < 0.5 ? 1 : -1);
      for (var ci = 0; ci < chainLen; ci++) {
        var rPad2 = 0.28 - ci * 0.04;
        if (rPad2 < 0.16) rPad2 = 0.16;
        makeOpuntiaPad(g, padMat, {
          r: rPad2, ovalY: 1.40 - ci * 0.05, flatZ: 0.15,
          pos: new THREE.Vector3(px2, py2, (Math.random() - 0.5) * 0.04),
          rot: new THREE.Euler(0, dir * (ci * 0.25), dir * (-0.20 - ci * 0.10)),
          density: 1.55,
          flowers: FL(ci === chainLen - 1 ? 2 : 0),
          fruit: FR(ci === chainLen - 1 ? 3 + ((Math.random() * 2) | 0) : 1),
        });
        px2 += dir * (0.20 + Math.random() * 0.05);
        py2 += 0.20 + Math.random() * 0.06;
      }
    } else { /* cluster */
      /* Dense round bouquet — 5-6 pads packed close, multiple orientations,
         lots of fruit. */
      makeOpuntiaPad(g, padMat, {
        r: 0.27, ovalY: 1.35, flatZ: 0.16,
        density: 1.7, flowers: FL(2), fruit: FR(3 + ((Math.random() * 2) | 0)),
      });
      var cN = 4 + ((Math.random() * 2) | 0);
      for (var cidx = 0; cidx < cN; cidx++) {
        var aA = (cidx / cN) * Math.PI * 2 + Math.random() * 0.30;
        var rDist = 0.22 + Math.random() * 0.06;
        var px3 = Math.cos(aA) * rDist;
        var pz3 = Math.sin(aA) * rDist * 0.40;
        var py3 = 0.18 + Math.random() * 0.20;
        var rPad3 = 0.17 + Math.random() * 0.05;
        makeOpuntiaPad(g, padMat, {
          r: rPad3, ovalY: 1.30, flatZ: 0.14,
          pos: new THREE.Vector3(px3, py3, pz3),
          rot: new THREE.Euler(0, aA, (Math.random() - 0.5) * 0.6),
          density: 1.5,
          flowers: FL(Math.random() < 0.4 ? 1 : 0),
          fruit: FR(2 + ((Math.random() * 2) | 0)),
        });
      }
    }

    return g;
  }

  /* ================================================================== */
  /*  Species 4 — Barrel (Ferocactus)                                   */
  /*  Reference scale: 0.35                                             */
  /* ================================================================== */
  /* Single barrel stem — extracted so multi-stem clumps are possible.
     Returns a Group with body + spines, centered at origin. */
  function makeBarrelStem(opts) {
    var g = new THREE.Group();
    var RC = opts.RC || 22;
    var RD = opts.RD != null ? opts.RD : 0.20;
    var R  = opts.R  || 0.30;
    var HX = opts.HX || 0.85;
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
    applyCactusSkin(geo, {
      base: new THREE.Color(0.090, 0.260, 0.090),
      rib: new THREE.Color(0.235, 0.445, 0.150),
      noiseFreq: 20, noiseAmp: 0.0058,
      colorJitter: 0.045, bleach: 0.05,
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
      roughness: 0.88, clearcoat: 0.10, clearcoatRoughness: 0.65,
      sheen: 0.55, sheenRoughness: 0.85, sheenColor: 0x4a5a38,
      envMapIntensity: 0.90,
    })));
    makeSpines(g, ribAreoles(RC, 10, R, RD, HX, 0.36), 0x6e2a08, 0.115, 0.080, 0.0038, 6, 0.013, 0xc8682a, "fero");
    return g;
  }

  /* ================================================================== */
  /*  Species 4 — Barrel (Ferocactus / Echinocactus) variants           */
  /*    "classic"  (40%) — one wide barrel, classic ferocactus.
        "tall"     (20%) — taller cylindrical barrel (F. pilosus look).
        "squat"    (20%) — wide low golden-barrel (E. grusonii).
        "duo"      (12%) — two barrels of different sizes.
        "clump"     (8%) — 3 small offset barrels (mature ferocactus
                            often produce small basal pups).             */
  /* ================================================================== */
  function buildBarrel() {
    var g = new THREE.Group();
    var roll = Math.random();
    var variant;
    if      (roll < 0.40) variant = "classic";
    else if (roll < 0.60) variant = "tall";
    else if (roll < 0.80) variant = "squat";
    else if (roll < 0.92) variant = "duo";
    else                  variant = "clump";

    function add(R, HX, x, y, z) {
      var stem = makeBarrelStem({ RC: 22, RD: 0.20, R: R, HX: HX });
      stem.position.set(x, y, z);
      stem.rotation.y = Math.random() * Math.PI * 2;
      g.add(stem);
      return stem;
    }

    if (variant === "classic") {
      add(0.30, 0.85 + Math.random() * 0.10, 0, 0, 0);
    } else if (variant === "tall") {
      add(0.26 + Math.random() * 0.02, 1.20 + Math.random() * 0.20, 0, 0, 0);
    } else if (variant === "squat") {
      /* Echinocactus grusonii (golden barrel) — perfectly round, low. */
      add(0.34 + Math.random() * 0.03, 0.65 + Math.random() * 0.08, 0, 0, 0);
    } else if (variant === "duo") {
      var az2 = Math.random() * Math.PI * 2;
      var sep = 0.32;
      add(0.28, 0.88, Math.cos(az2) * sep, 0, Math.sin(az2) * sep);
      add(0.22, 0.78, -Math.cos(az2) * sep, -0.04, -Math.sin(az2) * sep);
    } else { /* clump */
      add(0.27, 0.85, 0, 0, 0);
      var nB = 3;
      for (var bi = 0; bi < nB; bi++) {
        var azB = (bi / nB) * Math.PI * 2 + Math.random() * 0.30;
        var sepB = 0.34 + Math.random() * 0.03;
        var rB = 0.16 + Math.random() * 0.05;
        add(rB, 0.75 + Math.random() * 0.10,
          Math.cos(azB) * sepB,
          -0.06 + (Math.random() - 0.5) * 0.04,
          Math.sin(azB) * sepB);
      }
    }

    /* Center on bbox so rotation is balanced. */
    var bb = new THREE.Box3().setFromObject(g);
    var cy = (bb.min.y + bb.max.y) * 0.5;
    var cx = (bb.min.x + bb.max.x) * 0.5;
    var cz = (bb.min.z + bb.max.z) * 0.5;
    g.children.forEach(function (c) {
      c.position.x -= cx;
      c.position.y -= cy;
      c.position.z -= cz;
    });
    return g;
  }

  /* ================================================================== */
  /*  Species 5 — Ball / Pincushion (Mammillaria) with crown of flowers */
  /*  Reference scale: 0.18                                             */
  /* ================================================================== */
  function buildBall() {
    var g = new THREE.Group();
    /* Per-instance shape variation:
         R    — radius (0.20 — 0.28): smaller juveniles vs larger adults.
         aspY — vertical aspect (0.85 — 1.15): squat vs slightly elongated.
         TF   — tubercle frequency around (12 — 16): denser/sparser grids.
         PF   — tubercle frequency along latitudes (8 — 10).
       Together these produce mammillarias that look genuinely different
       in proportion (not just different in tint). */
    var R    = 0.20 + Math.random() * 0.08;
    var aspY = 0.85 + Math.random() * 0.30;
    var TF   = 12 + ((Math.random() * 5) | 0);
    var PF   = 8  + ((Math.random() * 3) | 0);
    var geo = new THREE.SphereGeometry(R, 64, 44);
    var p = geo.attributes.position;
    var vc = new Float32Array(p.count * 3);
    /* Mammillaria: deep matte green, slightly bluish tinge. The
       per-instance tint will pull some plants toward fresh emerald,
       others toward blue-green or olive. */
    var base = new THREE.Color(0.065, 0.215, 0.095);
    var tip  = new THREE.Color(0.225, 0.430, 0.180);
    for (var i = 0; i < p.count; i++) {
      var x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      var r = Math.sqrt(x * x + z * z);
      var th = Math.atan2(z, x);
      var nY = Math.max(-1, Math.min(1, y / R));
      var phi = Math.acos(nY);
      var b1 = Math.cos(TF * th) * Math.cos(PF * phi - th * 3);
      var bump = 1 + Math.max(0, b1) * b1 * 0.10;
      if (r > 1e-4) { p.setX(i, (x / r) * r * bump); p.setZ(i, (z / r) * r * bump); }
      var n1 = noise3(x * 24, y * 24, z * 24) - 0.5;
      var n2 = (noise3(x * 56, y * 56, z * 56) - 0.5) * 0.55;
      var n3 = (noise3(x * 130, y * 130, z * 130) - 0.5) * 0.30;
      var disp = (n1 + n2 + n3) * 0.0058;
      var nx = x / Math.max(r, 1e-4);
      var nz = z / Math.max(r, 1e-4);
      p.setX(i, p.getX(i) + nx * disp);
      p.setZ(i, p.getZ(i) + nz * disp);
      var tb = bump - 1;
      var hf = (nY + 1) * 0.5;
      var jitter = (n1 + n2) * 0.05;
      vc[i * 3]     = base.r + (tip.r - base.r) * (tb * 6 + hf * 0.3) + jitter;
      vc[i * 3 + 1] = base.g + (tip.g - base.g) * (tb * 6 + hf * 0.3) + jitter;
      vc[i * 3 + 2] = base.b + (tip.b - base.b) * (tb * 6 + hf * 0.3) + jitter * 0.55;
    }
    /* Apply per-instance aspect ratio AFTER the rib/noise pass so the
       rib geometry computes correctly in the unscaled frame, then we
       stretch the whole body in Y. */
    for (var sy = 0; sy < p.count; sy++) {
      p.setY(sy, p.getY(sy) * aspY);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(vc, 3));
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, cactusSkinMaterial({
      roughness: 0.90, clearcoat: 0.06, clearcoatRoughness: 0.75,
      sheen: 0.55, sheenRoughness: 0.85, sheenColor: 0x3a4a28,
      envMapIntensity: 0.85,
    })));
    var areoles = [];
    for (var ti = 0; ti < TF; ti++) {
      var tA = (ti / TF) * Math.PI * 2;
      var tan = new THREE.Vector3(-Math.sin(tA), 0, Math.cos(tA));
      for (var pi = 1; pi < PF; pi++) {
        var pA = (pi / PF) * Math.PI;
        var spf = Math.sin(pA);
        var rr = R * spf * (1 + Math.max(0, Math.cos(TF * tA) * Math.cos(PF * pA - tA * 3)) * 0.10);
        var ay = R * Math.cos(pA) * aspY;
        areoles.push({
          p: new THREE.Vector3(rr * Math.cos(tA), ay, rr * Math.sin(tA)),
          n: new THREE.Vector3(rr * Math.cos(tA), ay, rr * Math.sin(tA)).normalize(),
          t: tan.clone(),
        });
      }
    }
    /* Mammillaria spines: cream-white, slightly amber from age. Use the
       "mammillaria" style so radials lay flat against the body in a clear
       pinwheel/star pattern around each tubercle. */
    makeSpines(g, areoles, 0xd8c89a, 0.052, 0.040, 0.0024, 7, 0.011, 0xeadcb2, "mammillaria");

    /* Crown of magenta flowers near the top — desaturated to look natural.
       60% of mammillarias bloom; 40% are bare in any given snapshot. */
    if (Math.random() < 0.60) {
      var flowerMat = new THREE.MeshStandardMaterial({
        color: 0xb8366e, roughness: 0.65, metalness: 0,
        transparent: false, depthWrite: true,
      });
      flowerMat.envMapIntensity = 0.75;
      var fGeo = new THREE.SphereGeometry(0.022, 10, 8);
      var crownN = 7 + ((Math.random() * 4) | 0);
      for (var fi = 0; fi < crownN; fi++) {
        var ang = (fi / crownN) * Math.PI * 2;
        var rr = R * 0.55;
        var fl = new THREE.Mesh(fGeo, flowerMat);
        fl.position.set(rr * Math.cos(ang), R * aspY * 0.78, rr * Math.sin(ang));
        fl.scale.set(1.3, 0.8, 1.3);
        g.add(fl);
      }
    }

    return g;
  }

  /* ================================================================== */
  /*  Species 7 — Pinwheel Mammillaria (M. spinosissima / "Red-headed   */
  /*  Irishman" / Rebutia heliosa style) — small ovoid body covered in  */
  /*  tightly packed areoles arranged on golden-angle spirals, each      */
  /*  emitting a flat radial rosette of cream spines tipped red-orange.  */
  /*  Reference scale: 0.20                                              */
  /*                                                                    */
  /*  Visual signature: dozens of visible "stars" / pinwheels covering   */
  /*  the body, with spines pressed flat against the surface (very low   */
  /*  central spine, very long radial spines).                           */
  /* ================================================================== */
  function buildPinwheel() {
    var g = new THREE.Group();
    /* Per-instance shape: some pinwheels are nearly spherical, some
       distinctly elongated columns, some squat flat-tops. */
    var R   = 0.18 + Math.random() * 0.08;
    var HX  = 0.85 + Math.random() * 0.50;
    var geo = new THREE.SphereGeometry(R, 56, 40);
    var p = geo.attributes.position;
    var vc = new Float32Array(p.count * 3);
    /* Pinwheel base — mid green with slight tip-warmth on tubercle crests.
       Per-instance tint takes some plants toward emerald, others coppery. */
    var base = new THREE.Color(0.085, 0.235, 0.115);
    var tip  = new THREE.Color(0.235, 0.420, 0.210);

    /* Tubercle bumps — Mammillarias have round tubercles, not ribs.
       Use a 3D pattern that creates ~spiral-arranged bumps so the
       silhouette has subtle round nubs the spine rosettes sit on top of.
       TF/PF are jittered so different pinwheels show different tubercle
       densities and spiral patterns. */
    var TF = 11 + ((Math.random() * 5) | 0);
    var PF = 7 + ((Math.random() * 3) | 0);
    for (var i = 0; i < p.count; i++) {
      var x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      var r = Math.sqrt(x * x + z * z);
      var th = Math.atan2(z, x);
      var nY = Math.max(-1, Math.min(1, y / R));
      var phi = Math.acos(nY);
      var b1 = Math.cos(TF * th) * Math.cos(PF * phi - th * 2.5);
      var bump = 1 + Math.max(0, b1) * Math.max(0, b1) * 0.075;
      if (r > 1e-4) {
        p.setX(i, (x / r) * r * bump);
        p.setZ(i, (z / r) * r * bump);
      }
      p.setY(i, y * HX);
      var n1 = noise3(x * 26, y * 26, z * 26) - 0.5;
      var n2 = (noise3(x * 64, y * 64, z * 64) - 0.5) * 0.55;
      var n3 = (noise3(x * 145, y * 145, z * 145) - 0.5) * 0.32;
      var disp = (n1 + n2 + n3) * 0.0048;
      var nx = x / Math.max(r, 1e-4);
      var nz = z / Math.max(r, 1e-4);
      p.setX(i, p.getX(i) + nx * disp);
      p.setZ(i, p.getZ(i) + nz * disp);
      var hf = (nY + 1) * 0.5;
      var jitter = (n1 + n2) * 0.05;
      var t01 = Math.max(0, b1) * 5 + hf * 0.25;
      vc[i * 3]     = base.r + (tip.r - base.r) * t01 + jitter;
      vc[i * 3 + 1] = base.g + (tip.g - base.g) * t01 + jitter;
      vc[i * 3 + 2] = base.b + (tip.b - base.b) * t01 + jitter * 0.5;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(vc, 3));
    geo.computeVertexNormals();

    g.add(new THREE.Mesh(geo, cactusSkinMaterial({
      roughness: 0.92, clearcoat: 0.05, clearcoatRoughness: 0.80,
      sheen: 0.50, sheenRoughness: 0.90, sheenColor: 0x405038,
      envMapIntensity: 0.80,
    })));

    /* Phyllotactic areole layout — golden-angle spirals around the ovoid.
       This mimics the natural Fibonacci packing of Mammillaria areoles.
       Bumped from 90 → 120 so the pinwheel rosettes form a denser
       starscape that reads more like a real M. spinosissima at distance. */
    var areoleCount = 120;
    var GA = Math.PI * (3 - Math.sqrt(5));
    var areoles = [];
    for (var ai = 0; ai < areoleCount; ai++) {
      /* Latitude from -1..1 (skip exact poles), spiral azimuth */
      var v01 = (ai + 0.5) / areoleCount;
      var nyA = 1 - 2 * v01;
      var phiA = Math.acos(Math.max(-0.985, Math.min(0.985, nyA)));
      var thA = ai * GA;
      var spfA = Math.sin(phiA);
      /* Match the body bump so areoles sit on tubercle crests */
      var bA = Math.cos(TF * thA) * Math.cos(PF * phiA - thA * 2.5);
      var bumpA = 1 + Math.max(0, bA) * Math.max(0, bA) * 0.075;
      var rrA = R * spfA * bumpA;
      var pos = new THREE.Vector3(
        rrA * Math.cos(thA),
        R * Math.cos(phiA) * HX,
        rrA * Math.sin(thA)
      );
      var nor = new THREE.Vector3(
        Math.sin(phiA) * Math.cos(thA),
        Math.cos(phiA),
        Math.sin(phiA) * Math.sin(thA)
      ).normalize();
      var tan = new THREE.Vector3(-Math.sin(thA), 0, Math.cos(thA));
      areoles.push({ p: pos, n: nor, t: tan });
    }

    /* Custom pinwheel rosette: each areole gets a tiny tuft + ~12-14
       radial spines pressed nearly FLAT against the body surface (so
       the rosette reads as a clear star), plus 1 short central spine. */
    pinwheelRosettes(g, areoles);

    return g;
  }

  /* Pinwheel rosette spine cluster: spines lay almost flat (radial in the
     surface tangent plane) so each areole reads as a flat star/disc.
     The tips are tinted red-orange (Mammillaria spinosissima look). */
  function pinwheelRosettes(parent, areoles) {
    var radialColor = 0xefe2c0;
    var tipColor    = 0xb8421c;
    var centerColor = 0x9a3014;

    var radialLen   = 0.045;
    var radialThick = 0.0014;
    var centralLen  = 0.012;
    var centralThick = 0.0019;
    var radialPerAreole = 13;

    /* Build the cone geometry once with vertex-color cream→red gradient */
    function makeSpineGeo(thick, base, tip) {
      var geo = new THREE.ConeGeometry(thick, 1.0, 6);
      geo.translate(0, 0.5, 0);
      var p = geo.attributes.position;
      var vc = new Float32Array(p.count * 3);
      var bC = new THREE.Color(base);
      var tC = new THREE.Color(tip);
      for (var ii = 0; ii < p.count; ii++) {
        var t = p.getY(ii);
        /* Radial spines: cream for first 60% of length, then ramp to red */
        var k = Math.max(0, (t - 0.55) / 0.45);
        vc[ii * 3]     = bC.r + (tC.r - bC.r) * k;
        vc[ii * 3 + 1] = bC.g + (tC.g - bC.g) * k;
        vc[ii * 3 + 2] = bC.b + (tC.b - bC.b) * k;
      }
      geo.setAttribute("color", new THREE.BufferAttribute(vc, 3));
      return geo;
    }

    var radialGeo = makeSpineGeo(radialThick, radialColor, tipColor);
    var centralGeo = makeSpineGeo(centralThick, centerColor, tipColor);

    var radialMat = new THREE.MeshStandardMaterial({
      vertexColors: true, color: 0xffffff,
      roughness: 0.78, metalness: 0,
      transparent: false, depthWrite: true,
    });
    radialMat.envMapIntensity = 0.55;
    var centralMat = radialMat;

    var totalRadial = areoles.length * radialPerAreole;
    var radInst = new THREE.InstancedMesh(radialGeo, radialMat, totalRadial);
    var ctrInst = new THREE.InstancedMesh(centralGeo, centralMat, areoles.length);
    var tufts = new THREE.InstancedMesh(_tuftGeo, _tuftMat, areoles.length);
    var dummy = new THREE.Object3D();
    var rIdx = 0;

    for (var i = 0; i < areoles.length; i++) {
      var a = areoles[i];
      var n = a.n;
      var tan = a.t.clone();
      /* Re-orthogonalize tan against n */
      tan.addScaledVector(n, -tan.dot(n)).normalize();
      var bin = new THREE.Vector3().crossVectors(n, tan).normalize();

      /* Tiny cream tuft */
      dummy.position.copy(a.p).addScaledVector(n, -0.002);
      dummy.quaternion.identity();
      var tufR = 0.0030 * (0.7 + Math.random() * 0.6);
      dummy.scale.setScalar(tufR);
      dummy.updateMatrix();
      tufts.setMatrixAt(i, dummy.matrix);

      /* Central spine — short, sticks straight out */
      dummy.position.copy(a.p).addScaledVector(n, 0.001);
      dummy.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(_up, n));
      dummy.scale.set(1.0, centralLen * (0.85 + Math.random() * 0.30), 1.0);
      dummy.updateMatrix();
      ctrInst.setMatrixAt(i, dummy.matrix);

      /* Radial spines pressed almost flat — strong tangent component, tiny
         normal component, with a small lift so they don't clip into the
         body. This is what makes each rosette read as a clear star /
         pinwheel from any angle. */
      var phaseOffset = Math.random() * Math.PI * 2;
      var lift = 0.0025;
      for (var k = 0; k < radialPerAreole; k++) {
        var ang = phaseOffset + (k / radialPerAreole) * Math.PI * 2
                + (Math.random() - 0.5) * 0.10;
        /* dir is normalized; tan/bin contribution dominates so the spine
           lies in the tangent plane. The small normal component (0.10)
           lifts the tip slightly outward. */
        var dir = n.clone().multiplyScalar(0.10)
          .addScaledVector(tan, Math.cos(ang) * 0.995)
          .addScaledVector(bin, Math.sin(ang) * 0.995)
          .normalize();
        /* Anchor base just slightly above the surface so the cone body
           does not clip into the cactus skin. */
        dummy.position.copy(a.p).addScaledVector(n, lift);
        dummy.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(_up, dir));
        var lenJ = radialLen * (0.78 + Math.random() * 0.30);
        dummy.scale.set(0.85 + Math.random() * 0.25, lenJ, 0.85 + Math.random() * 0.25);
        dummy.updateMatrix();
        radInst.setMatrixAt(rIdx++, dummy.matrix);
      }
    }
    radInst.count = rIdx;
    radInst.instanceMatrix.needsUpdate = true;
    ctrInst.instanceMatrix.needsUpdate = true;
    tufts.instanceMatrix.needsUpdate = true;
    /* Disable per-instance frustum culling — see makeSpines for full
       explanation. The InstancedMesh's bounding sphere comes from the
       single-instance geometry and doesn't reflect the actual spread
       of all instances, causing premature culling during rotation. */
    radInst.frustumCulled = false;
    ctrInst.frustumCulled = false;
    tufts.frustumCulled = false;
    parent.add(tufts);
    parent.add(radInst);
    parent.add(ctrInst);
  }

  /* ================================================================== */
  /*  Species 6 — Star (Astrophytum) with yellow flower                  */
  /*  Reference scale: 0.20                                              */
  /* ================================================================== */
  function buildStar() {
    var g = new THREE.Group();
    /* Per-instance shape variation — Astrophytum species have very
       distinctive variation by point count: A. myriostigma has 4-8 ribs,
       A. asterias has only 5-8 flat segments, A. ornatum is taller.
         PT — number of star points (4 — 7)
         R  — body radius (0.24 — 0.30)
         HX — vertical aspect (0.55 — 0.95): squat star vs taller column
         SD — star depth (0.35 — 0.50): subtle vs sharply defined ribs.   */
    var PT = 4 + ((Math.random() * 4) | 0);
    var R  = 0.24 + Math.random() * 0.06;
    var HX = 0.55 + Math.random() * 0.40;
    var SD = 0.35 + Math.random() * 0.15;
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
    /* Then noise + base color (Astrophytum is naturally darker, more matte
       grey-green from heavy bloom + dense white flecks). Tint widens the
       palette toward bluish or warm olive variants. */
    applyCactusSkin(geo, {
      base: new THREE.Color(0.095, 0.205, 0.120),
      rib: new THREE.Color(0.205, 0.330, 0.175),
      noiseFreq: 26, noiseAmp: 0.0048,
      colorJitter: 0.040, bleach: 0.05,
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
      roughness: 0.92, clearcoat: 0.05, clearcoatRoughness: 0.80,
      sheen: 0.45, sheenRoughness: 0.90, sheenColor: 0x405038,
      envMapIntensity: 0.80,
    })));

    /* Astrophytum white flecks scattered across the body — slightly off
       white, like real plant trichomes (not pure 0xffffff) */
    var fleckGeo = new THREE.SphereGeometry(0.0055, 5, 4);
    var fleckMat = new THREE.MeshStandardMaterial({
      color: 0xe8dcc0, roughness: 0.95, metalness: 0,
      transparent: false, depthWrite: true,
    });
    fleckMat.envMapIntensity = 0.65;
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
    fleckInst.frustumCulled = false;
    g.add(fleckInst);

    /* Sparser short spines along ribs. Astrophytum spines are short,
       slightly curled, mid-tangential — "ribbed" works well. */
    makeSpines(g, ribAreoles(PT, 5, R, SD, HX, 0.5), 0x4a2a14, 0.058, 0.044, 0.0034, 4, 0.014, 0x9a5a30, "ribbed");

    /* Yellow flower cluster on top — warm honey yellow, not lemon neon.
       Only ~55% of stars bloom in any snapshot (rest are between flowers). */
    if (Math.random() < 0.55) {
      var petGeo = new THREE.SphereGeometry(0.030, 10, 8);
      var petMat = new THREE.MeshStandardMaterial({
        color: 0xe8b820, roughness: 0.65, metalness: 0,
        transparent: false, depthWrite: true,
      });
      petMat.envMapIntensity = 0.75;
      var pet = 7 + ((Math.random() * 4) | 0);
      for (var pi2 = 0; pi2 < pet; pi2++) {
        var aA = (pi2 / pet) * Math.PI * 2;
        var fl2 = new THREE.Mesh(petGeo, petMat);
        fl2.position.set(Math.cos(aA) * 0.05, R * HX + 0.025, Math.sin(aA) * 0.05);
        fl2.scale.set(1.4, 0.55, 1.4);
        g.add(fl2);
      }
      var corMat = new THREE.MeshStandardMaterial({
        color: 0xc83818, roughness: 0.65, metalness: 0,
        transparent: false, depthWrite: true,
      });
      corMat.envMapIntensity = 0.75;
      var core = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), corMat);
      core.position.set(0, R * HX + 0.030, 0);
      g.add(core);
    }

    return g;
  }

  /* ================================================================== */
  /*  Species registry — name, builder, target on-canvas height in       */
  /*  world units. Ratios are anchored on saguaro (biggest in nature):   */
  /*    saguaro 1.00  column 0.55  pear 0.40  barrel 0.30                */
  /*    pinwheel 0.24  star 0.22  ball 0.20                              */
  /*  Final displayed size is computed from each mesh's actual bounding  */
  /*  box so different intrinsic geometry sizes don't break the ratios.  */
  /* ================================================================== */
  var SAGUARO_TARGET_HEIGHT = 1.55;
  var SPECIES = [
    { name: "saguaro",      build: buildSaguaro,  ratio: 1.00 },
    { name: "column",       build: buildColumn,   ratio: 0.55 },
    { name: "prickly_pear", build: buildPear,     ratio: 0.40 },
    { name: "barrel",       build: buildBarrel,   ratio: 0.30 },
    { name: "pinwheel",     build: buildPinwheel, ratio: 0.24 },
    { name: "star",         build: buildStar,     ratio: 0.22 },
    { name: "ball",         build: buildBall,     ratio: 0.20 },
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
        /* Start opaque; we briefly toggle to transparent only while fading
           in or out. This prevents the back faces of tube/saguaro arms
           from being visible through the front (the "hollow" look). */
        ch.material.transparent = false;
        ch.material.depthWrite = true;
        ch.material.opacity = 1;
        m.push(ch.material);
      }
    });
    return m;
  }

  var lastSpecies = -1;

  /* Per-species rotation profile.
   *
   * Real cacti are NOT isotropic. A saguaro is a tall vertical pole;
   * spinning it end-over-end (X/Z tumble) reads as completely wrong —
   * the silhouette becomes unrecognisable and the eye registers it as
   * a falling stick rather than a floating plant. A barrel cactus, on
   * the other hand, IS roughly spherical, so isotropic spin is fine.
   *
   * Profile fields:
   *   yawBias    – multiplier on Y (long-axis) angular velocity
   *   tumbleBias – multiplier on X/Z (tumble) angular velocity
   *   maxTilt    – upper bound on initial off-vertical tilt (radians)
   *
   * Tall species (saguaro, column) → strong yawBias, low tumbleBias,
   *   small maxTilt → they spin like floating pillars, not flipping
   *   sticks.
   * Round species (ball, barrel, pinwheel) → isotropic.
   * Flat species (prickly_pear, star) → moderate tumbleBias to show
   *   off the paddle/star faces while still mostly yawing.            */
  var ROT_PROFILE = {
    /* Saguaro / column: a touch more tumble + lean so the body's rib
       pattern visibly shifts during rotation. With pure yaw on a near-
       cylindrical trunk, the silhouette barely changes and the brain
       perceives the spines (which DO move around the silhouette) as
       rotating "faster" than the body. A small tumble + tilt makes the
       body's motion clearly co-rotating with its spines. */
    saguaro:      { yawBias: 1.00, tumbleBias: 0.30, maxTilt: 0.30 },
    column:       { yawBias: 1.00, tumbleBias: 0.30, maxTilt: 0.32 },
    prickly_pear: { yawBias: 0.85, tumbleBias: 0.55, maxTilt: 0.50 },
    barrel:       { yawBias: 1.00, tumbleBias: 1.00, maxTilt: 1.20 },
    ball:         { yawBias: 1.00, tumbleBias: 1.00, maxTilt: 1.20 },
    pinwheel:     { yawBias: 1.00, tumbleBias: 1.00, maxTilt: 1.20 },
    star:         { yawBias: 0.95, tumbleBias: 0.65, maxTilt: 0.60 },
  };
  function rotProfileFor(name) {
    return ROT_PROFILE[name] || { yawBias: 1, tumbleBias: 1, maxTilt: 1.20 };
  }

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
    /* Apply per-instance shade variation so two cacti of the same species
       look distinct — sage vs deep forest vs blue-green vs olive, etc.
       Done BEFORE bbox/scale because it doesn't change geometry. */
    var shade = pickShadePreset(sp.name);
    if (shade) tintCactus(mesh, shade);
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

    /* Apply species-specific rotation behaviour:
       - tall plants spin mostly around their up-axis (Y) with a tiny
         lean instead of tumbling end-over-end
       - round plants stay isotropic
       - flat paddles (prickly pear) keep moderate tilt to show face   */
    var rp = rotProfileFor(sp.name);
    var angV = new THREE.Vector3(
      (Math.random() - 0.5) * 0.30 * rp.tumbleBias,
      (Math.random() - 0.5) * 0.45 * rp.yawBias,
      (Math.random() - 0.5) * 0.30 * rp.tumbleBias
    );
    /* Initial orientation: random yaw plus a small random lean within
       the species' max-tilt range. Tilt direction itself is random.   */
    var initQuat = new THREE.Quaternion();
    initQuat.setFromAxisAngle(_up, Math.random() * Math.PI * 2);
    if (rp.maxTilt > 1e-3) {
      var tiltAxis = new THREE.Vector3(
        Math.random() - 0.5, 0, Math.random() - 0.5
      ).normalize();
      var tiltAngle = (Math.random() - 0.5) * 2 * rp.maxTilt;
      var tiltQ = new THREE.Quaternion().setFromAxisAngle(tiltAxis, tiltAngle);
      initQuat.premultiply(tiltQ);
    }

    cacti.push({
      mesh: mesh, mats: collectMats(mesh),
      pos: pos, vel: vel,
      angV: angV,
      quat: initQuat,
      bobPh: Math.random() * Math.PI * 2,
      age: 0,
      colR: colR,
      finalScale: finalScale,
      rp: rp,
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

    /* Refresh the IBL from the live iridescent backdrop on a slow cadence.
       Done inside rAF so the WebGL iri-card front buffer is still readable
       at the moment we drawImage() it. */
    if (time - lastEnvRefresh > ENV_REFRESH_MS) {
      buildEnvFromIri();
      lastEnvRefresh = time;
    }

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
          /* Kick spin respects the species rotation profile so a poke
             on a saguaro doesn't send it tumbling sideways — it just
             yaws faster / leans a touch. */
          var spin = (ff * 1.4 + kick * 0.7) * dt;
          var tb = c.rp ? c.rp.tumbleBias : 1;
          var yb = c.rp ? c.rp.yawBias : 1;
          c.angV.x += _v2.y * spin * tb;
          c.angV.z -= _v2.x * spin * tb;
          /* A bit of yaw kick too — feels alive when you poke them. */
          c.angV.y += (_v2.x - _v2.y) * spin * 0.4 * yb;
        }
      }

      c.pos.addScaledVector(c.vel, dt);

      var as = c.angV.length();
      if (as > 1e-4) {
        _v1.copy(c.angV).divideScalar(as);
        _q1.setFromAxisAngle(_v1, as * dt);
        c.quat.premultiply(_q1).normalize();
      }

      /* Buoy uprighting for tall species: when a saguaro/column drifts
         too far from vertical, apply a gentle restoring torque around
         its current up vector × world up. This keeps the long axis
         "weighted" without forbidding tilt entirely — a kick can still
         lean the cactus, it just slowly returns to upright like a
         buoyant fishing float. Round species (maxTilt ≥ 1.0) skip
         this entirely so they keep tumbling freely. */
      if (c.rp && c.rp.maxTilt < 0.7) {
        _v1.set(0, 1, 0).applyQuaternion(c.quat);
        var dot = _v1.y;
        if (dot < 0.999) {
          var restoreAxis = _v2.set(0, 1, 0).cross(_v1);
          var restoreLen = restoreAxis.length();
          if (restoreLen > 1e-4) {
            restoreAxis.divideScalar(restoreLen);
            var tilt = Math.acos(Math.max(-1, Math.min(1, dot)));
            var excess = Math.max(0, tilt - c.rp.maxTilt * 0.6);
            if (excess > 1e-4) {
              var restoreA = -excess * 1.2 * dt;
              _q1.setFromAxisAngle(restoreAxis, restoreA);
              c.quat.premultiply(_q1).normalize();
            }
          }
        }
      }

      var bob = Math.sin(t * BOB_FREQ * Math.PI * 2 + c.bobPh) * BOB_AMP;
      var fadeIn = Math.min(c.age / FADE_DUR, 1);
      var sc = c.finalScale * (0.45 + fadeIn * 0.55);
      var op = Math.min(fadeIn * 2.5, 1);

      c.mesh.position.copy(c.pos);
      c.mesh.position.y += bob;
      c.mesh.quaternion.copy(c.quat);
      c.mesh.scale.setScalar(sc);
      /* Only flip into transparent mode while actually fading in.
         When fully visible, render fully opaque (depth-writing front face
         only) so the cactus body is solid and never see-through.        */
      var needTransparent = op < 1;
      for (var mi = 0; mi < c.mats.length; mi++) {
        var mat = c.mats[mi];
        if (needTransparent !== mat.transparent) {
          mat.transparent = needTransparent;
          mat.needsUpdate = true;
        }
        mat.opacity = op;
      }

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
