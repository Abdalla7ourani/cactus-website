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

  /* antialias is OFF: matte cactus surfaces don't show MSAA much
     because the high RAD_SEG geometry already produces smooth
     silhouettes, and the spines/tufts are too small for MSAA to
     recover; skipping it saves a real chunk of fragment work on
     high-DPI screens.

     Pixel ratio: iPhones (and most modern Android flagships) report
     devicePixelRatio of 3.0. A cap of 1.5 was halving render
     resolution on those devices, which is visibly soft on close-up
     cacti — the user reported "low resolution cacti" on iPhone.
     We bump the cap so phones render at 2× native (still half of 3,
     but plenty for crisp spines/normal-map detail), while desktops
     stay at 1.75 like the original codebase had it. The Apple GPU
     in modern iPhones is fast enough to handle this with antialias
     off; what kills FPS on phones is overdraw + main-thread work,
     which is what the rest of this file already optimises. */
  var ren = new THREE.WebGLRenderer({
    canvas: cvs, alpha: true, antialias: false,
    powerPreference: "high-performance",
  });
  ren.setPixelRatio(Math.min(devicePixelRatio, 2.0));
  ren.toneMapping = THREE.ACESFilmicToneMapping;
  ren.outputColorSpace = THREE.SRGBColorSpace;
  ren.setClearColor(0x000000, 0);

  /* ================================================================== */
  /*  Scene / Camera                                                    */
  /* ================================================================== */
  var scene = new THREE.Scene();
  var cam = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  cam.position.z = 5;
  /* Subtle atmospheric fog. The cactus canvas is layered over the
     iridescent colour-animation canvas via DOM stacking with
     alpha:true, so any RGB tint the fog adds blends visually toward
     the iri-card colours behind. Fog `near` starts beyond the
     close-tier z (so close/mid cacti are essentially fog-free) and
     ramps to `far` past the abyss tier so the deepest cacti get
     about 35-40% colour wash that softens them into the background.
     This is what makes the far cacti read as "hanging back near the
     colour animation" — they literally bleed into it. The fog colour
     is kept neutral light grey so it works with both the colourful
     iri-card glitch and any future card variants. */
  scene.fog = new THREE.Fog(0xeeeeee, cam.position.z + 1.5, cam.position.z + 12);

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
      /* High key + low fill + low ambient = strong directional shadow
         contrast, so the deep rib troughs cast crisp dark grooves and
         the rib crests catch bright sunlight — the cinematic "form
         lighting" of the reference close-up photos. Exposure dropped
         slightly so the bright crests don't blow out against the bright
         iridescent backdrop. */
      exposure:  0.72,
      hemi:      { sky: 0xfff0d8, ground: 0x4a5828, intensity: 0.18 },
      key:       { color: 0xfff0d0, intensity: 1.55 },
      fill:      { color: 0xb8c4dc, intensity: 0.16 },
      bounce:    { color: 0xc8a878, intensity: 0.14 },
      rim:       { color: 0xffe8b8, intensity: 0.40 },
      envBoost:  0.30,
    },
    dark: {
      exposure:  0.78,
      hemi:      { sky: 0x6a78a0, ground: 0x18102a, intensity: 0.26 },
      key:       { color: 0xc8d4ff, intensity: 1.40 },
      fill:      { color: 0x9080d8, intensity: 0.22 },
      bounce:    { color: 0x6a4080, intensity: 0.18 },
      rim:       { color: 0xb898ff, intensity: 0.80 },
      envBoost:  0.85,
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
  /* compileEquirectangularShader() does a small WebGL shader compile
     (~5-15ms). Push it to an idle window so it can't hit during the
     first paint of the page. */
  if (typeof window !== "undefined" && window.requestIdleCallback) {
    window.requestIdleCallback(function () { pmrem.compileEquirectangularShader(); }, { timeout: 3000 });
  } else {
    setTimeout(function () { pmrem.compileEquirectangularShader(); }, 0);
  }
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

  /* Initial env build (uses fallback if iri hasn't painted yet).
     Deferred to an idle window — buildEnvFromIri() runs PMREM, which
     is the heaviest single operation in this module. Doing it
     immediately at module-load would hit during the page's first
     interactive frame and contribute to the freeze the user reports. */
  if (typeof window !== "undefined" && window.requestIdleCallback) {
    window.requestIdleCallback(buildEnvFromIri, { timeout: 4000 });
  } else {
    setTimeout(buildEnvFromIri, 200);
  }
  /* Refresh cadence: WebGL canvases without preserveDrawingBuffer are
     only safely readable inside the same animation frame they're drawn
     in, so we trigger refreshes from the main render loop ( see loop()
     below ) on a 1500ms interval rather than via setInterval which can
     fire mid-composite and read an empty back-buffer.

     The interval was bumped from 500ms → 1500ms to eliminate the
     periodic ~10–25ms PMREM hit that, combined with cactus geometry
     building, made the iri-card color animation look like it was
     freezing. Reflections on matte cacti barely change frame-to-frame
     so 1.5s feels visually identical. */
  var lastEnvRefresh = 0;
  /* Touch/coarse-pointer devices (phones, tablets) get a longer
     env-refresh cadence. PMREM is the single biggest periodic hitch
     in this module (~10-25ms on a desktop, more on a phone), and on
     matte cactus surfaces a 3s update is visually indistinguishable
     from 1.5s. This is a pure scheduling change — quality, species,
     density and visuals are all identical. */
  var _IS_COARSE = (typeof window !== "undefined" && window.matchMedia)
    && window.matchMedia("(pointer:coarse)").matches;
  var ENV_REFRESH_MS = _IS_COARSE ? 3000 : 1500;
  /* Skip env refreshes entirely during the page-load entrance window
     so the iri-card glitch + cactus slide-in looks perfectly fluid.
     12s lines up with the iri-card glitch finishing at ~8.7s plus
     enough buffer for the first cacti to drift into view. */
  var FIRST_ENV_REFRESH_MS = 12000;

  /* React when the user toggles dark mode. We re-apply the theme
     preset and rebuild the env so the cacti adopt the new palette.
     The env rebuild is deferred to an idle window so it can't fight
     with the iri-card's own theme transition. */
  var themeObs = new MutationObserver(function () {
    var nt = detectTheme();
    if (nt !== currentTheme) {
      applyTheme(nt);
      if (typeof window !== "undefined" && window.requestIdleCallback) {
        window.requestIdleCallback(buildEnvFromIri, { timeout: 1000 });
      } else {
        setTimeout(buildEnvFromIri, 16);
      }
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

    /* Spine geometry: a short cylinder with multiple radial segments AND
       multiple height segments. The reason for the height segments is so
       we can taper the radius non-linearly along the length (sharp needle
       tip, slightly thicker base) and add a very subtle curve — both of
       which match how real cactus spines look in close-up reference
       photos. A plain ConeGeometry tapers linearly, which reads as
       triangular and CG-like.

       Length is normalised to 1 at base (Y=0) → tip (Y=1); the per-
       instance scale.y multiplies it to the desired physical length. */
    var SEG_R = 7;   /* radial segments — 6 was visibly faceted */
    var SEG_H = 6;   /* height segments for the taper curve and bend */
    var geo = new THREE.CylinderGeometry(thick, thick, 1.0, SEG_R, SEG_H, false);
    geo.translate(0, 0.5, 0);
    {
      var pp = geo.attributes.position;
      /* Curve recipe:
           - radius(t) = thick * (1 - t)^2.2    (very sharp tip)
           - bend(t)   = small +X offset that grows ~ t^1.6
              (so spines lean forward slightly, like real ones)
           - mild taper jitter so no two spines profile identically */
      var bendX = thick * 6;
      for (var pi = 0; pi < pp.count; pi++) {
        var py = pp.getY(pi);
        if (py <= 0.001) continue;
        var px = pp.getX(pi);
        var pz = pp.getZ(pi);
        /* Current radial distance from spine axis. */
        var pr = Math.sqrt(px * px + pz * pz);
        if (pr > 1e-6) {
          /* Pinch radius. Pinch goes from 1.0 at base → ~0 at tip. */
          var pinch = Math.pow(1 - py, 2.2);
          var newR = thick * pinch;
          var s = newR / pr;
          pp.setX(pi, px * s);
          pp.setZ(pi, pz * s);
        }
        /* Subtle forward bend on +X. */
        pp.setX(pi, pp.getX(pi) + bendX * Math.pow(py, 1.6));
      }
      pp.needsUpdate = true;
      geo.computeVertexNormals();
    }
    if (tipColor != null) {
      var p = geo.attributes.position;
      var vc = new Float32Array(p.count * 3);
      var base = new THREE.Color(color);
      var tip = new THREE.Color(tipColor);
      for (var ii = 0; ii < p.count; ii++) {
        /* Color blend along length: bottom 25% stays base color (the
           spine's "wool collar"), then ramps to tip color toward the
           point. This matches reference photos where the tips catch
           the most light and read as pale amber. */
        var ty = p.getY(ii);
        var tBlend = ty < 0.25 ? 0 : (ty - 0.25) / 0.75;
        if (tBlend > 1) tBlend = 1;
        vc[ii * 3]     = base.r + (tip.r - base.r) * tBlend;
        vc[ii * 3 + 1] = base.g + (tip.g - base.g) * tBlend;
        vc[ii * 3 + 2] = base.b + (tip.b - base.b) * tBlend;
      }
      geo.setAttribute("color", new THREE.BufferAttribute(vc, 3));
    }
    /* Real cactus spines are modified leaves: dry, fibrous keratin-like
       tissue. Matte to slightly satin; never metallic-shiny. The tip
       can pick up a tiny bit more sheen — handled by sheen kicking in
       at grazing angles. */
    var mat = new THREE.MeshPhysicalMaterial({
      color: tipColor != null ? 0xffffff : color,
      vertexColors: tipColor != null,
      roughness: 0.62, metalness: 0.0,
      sheen: 0.35,
      sheenRoughness: 0.55,
      sheenColor: new THREE.Color(0xfff0d8),
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
      /* Per-areole length multiplier. ribAreoles() sets this < 1 for
         polar areoles so spines near the top/bottom of the body don't
         project so far past the silhouette that they read as a
         floating spike cluster. */
      var aLenMul = a.lenMul != null ? a.lenMul : 1;

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
      _dm.scale.set(1.0, cLen * (0.85 + Math.random() * 0.3) * aLenMul, 1.0);
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
        _dm.scale.set(0.70, rLen * (0.55 + Math.random() * 0.70) * aLenMul, 0.70);
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
        /* Pole-bias: areoles within the top/bottom 18% of the body
           (where ph is near 0 or near π) get their normal pulled
           OUTWARD/lateral by half. Without this, every "polar" areole
           around the bottom ring has its normal pointing essentially
           straight DOWN, so all of their spines pile into a single
           tight tuft hanging below the body — which reads as a
           SEPARATE spike cluster floating apart from the cactus.
           Pulling the normal toward the equator (i.e. lateral) makes
           those spines fan out radially instead of clumping straight
           down, restoring visual continuity with the body. */
        var nx = ax, ny = ay / HX, nz = az;
        var nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        nx /= nLen; ny /= nLen; nz /= nLen;
        var poleAmt = Math.abs(Math.cos(ph));   /* 0 at equator, 1 at poles */
        if (poleAmt > 0.78) {
          /* Lateral direction: project the normal onto the XZ plane
             and renormalize. Then blend with the original normal so
             we don't completely flatten the spine layout. */
          var latLen = Math.sqrt(nx * nx + nz * nz);
          if (latLen > 1e-3) {
            var lx = nx / latLen, lz = nz / latLen;
            /* Blend: at poleAmt=1 (exact pole) use ~80% lateral,
               easing back to 0% as we leave the polar zone. The
               aggressive cap is what eliminates the hanging spike
               cluster — at 0.55 the spines still pointed mostly
               down; at 0.80 they fan outward like a real polar
               spine rosette and the body silhouette stays clean. */
            var blend = (poleAmt - 0.78) / 0.22 * 0.80;
            nx = nx * (1 - blend) + lx * blend;
            ny = ny * (1 - blend);
            nz = nz * (1 - blend) + lz * blend;
            var rn = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
            nx /= rn; ny /= rn; nz /= rn;
          }
        }
        /* Also shorten spine length at poles. Even after the lateral
           normal blend, an extra-long spine pointing partially down
           still has its tip projecting below the body silhouette. A
           ~45% length cut on the bottom-most ring keeps the spines
           visually attached to the body, which is what the user reads
           as "the cactus is one piece". The penalty is invisible —
           polar spines are mostly hidden by the body silhouette in
           any normal viewing angle. */
        var lenMul = 1;
        if (poleAmt > 0.78) {
          lenMul = 1 - (poleAmt - 0.78) / 0.22 * 0.45;
        }
        out.push({
          p: new THREE.Vector3(ax, ay, az),
          n: new THREE.Vector3(nx, ny, nz),
          t: tan.clone(),
          lenMul: lenMul,
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
      var r = base.r + (rib.r - base.r) * ribAmt + jitter + bleach;
      var g = base.g + (rib.g - base.g) * ribAmt + jitter + bleach;
      var b = base.b + (rib.b - base.b) * ribAmt + jitter + bleach * 0.6;
      /* Baked AO: troughs (low ribAmt) self-shadow because they're
         recessed into the body and receive less ambient skylight. We
         multiply the color by a darken factor that scales with how far
         we are from a crest. Strength is opt-in (default 0.0 to keep
         old call sites identical) so each species can dial it in to
         match its rib geometry depth. Floor was 0.55, dropped to 0.42
         so the deepest troughs read as crisp dark grooves matching the
         reference photos. */
      var aoStrength = opts.aoStrength != null ? opts.aoStrength : 0.0;
      if (aoStrength > 0) {
        var aoDark = 1 - (1 - ribAmt) * aoStrength;
        if (aoDark < 0.42) aoDark = 0.42;
        r *= aoDark; g *= aoDark; b *= aoDark;
      }
      vc[i * 3]     = r;
      vc[i * 3 + 1] = g;
      vc[i * 3 + 2] = b;
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
      var isSkin = mat.userData && mat.userData.isCactusSkin === true;
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

  /* ================================================================== */
  /*  Procedural PBR skin texture maps                                  */
  /*                                                                    */
  /*  Cactus skin in close-up reference photos shows TWO distinct       */
  /*  scales of micro-detail layered on top of each other:              */
  /*    1. A fine pebbly grain (cuticle bumps, ~50–80 cells per cm)     */
  /*    2. A larger mottling — areas of slightly drier vs more turgid   */
  /*       tissue, water-stress wrinkles, sun-bleached patches.         */
  /*                                                                    */
  /*  Without these, a smooth shaded surface always reads as "CG plant" */
  /*  no matter how good the lighting is. We generate ALL of this once  */
  /*  at module load into shared 1K canvas textures (≈6ms total, no     */
  /*  network requests, no extra page weight) and reuse the same maps   */
  /*  across every cactus instance. The maps are wrapped seamlessly so  */
  /*  they tile invisibly across the body of any species.               */
  /*                                                                    */
  /*  The normal map is the most important — it gives the lighting      */
  /*  real bumps to react to, which produces the dark micro-shadows     */
  /*  and bright micro-highlights you see in the reference photos.      */
  /*  The roughness map varies how shiny different patches read,        */
  /*  breaking the "uniform plastic" feel.                              */
  /* ================================================================== */

  /* Tiny deterministic 2D hash + value noise — same family as the       */
  /* hash3/noise3 used for vertex micro-displacement, but in 2D so it    */
  /* tiles cleanly on a square texture.                                  */
  function _h2(x, y) {
    var s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return s - Math.floor(s);
  }
  function _vn2(x, y, freq, sx, sy) {
    /* Tileable value noise: hash on an integer lattice modulo size,
       so the noise wraps without seams. */
    var fx = x * freq, fy = y * freq;
    var ix = Math.floor(fx), iy = Math.floor(fy);
    var tx = fx - ix, ty = fy - iy;
    /* Smoothstep for smoother interp than linear. */
    var ux = tx * tx * (3 - 2 * tx);
    var uy = ty * ty * (3 - 2 * ty);
    var modX = freq | 0, modY = freq | 0;
    var x0 = ((ix % modX) + modX) % modX;
    var y0 = ((iy % modY) + modY) % modY;
    var x1 = (x0 + 1) % modX;
    var y1 = (y0 + 1) % modY;
    var a = _h2(x0, y0);
    var b = _h2(x1, y0);
    var c = _h2(x0, y1);
    var d = _h2(x1, y1);
    var ab = a + (b - a) * ux;
    var cd = c + (d - c) * ux;
    return ab + (cd - ab) * uy;
  }
  /* Multi-octave fbm so we get both large mottling and fine grain. */
  function _fbm2(x, y, baseFreq, octaves) {
    var v = 0, amp = 0.5, sum = 0, f = baseFreq;
    for (var o = 0; o < octaves; o++) {
      v += _vn2(x, y, f, 1, 1) * amp;
      sum += amp;
      amp *= 0.5;
      f *= 2;
    }
    return v / sum;
  }

  /* Generate the three shared maps once. */
  function _buildSkinMaps() {
    var SIZE = 1024;
    var normalCv = document.createElement("canvas");
    var roughCv  = document.createElement("canvas");
    normalCv.width = roughCv.width = SIZE;
    normalCv.height = roughCv.height = SIZE;
    var nCtx = normalCv.getContext("2d");
    var rCtx = roughCv.getContext("2d");
    var nImg = nCtx.createImageData(SIZE, SIZE);
    var rImg = rCtx.createImageData(SIZE, SIZE);
    var nD = nImg.data, rD = rImg.data;

    /* Compute a height field h(x,y) in [0,1]. We sample neighbours and
       take central-differences to derive the normal, then encode normal
       to RGB in the OpenGL convention (R=+X, G=+Y, B=+Z, all in [0,1]).
       Roughness varies inversely with height (peaks of cuticle bumps
       are slightly waxier/smoother, troughs are matte) plus a separate
       low-freq mottling. AO darkens the troughs. */
    function H(x, y) {
      var nx = x / SIZE, ny = y / SIZE;
      /* Cell-like cuticle pebbles — high-freq fbm. Bumped octaves and
         pushed contrast so individual cells read as raised pucker
         points, like real cactus epidermis at close range. */
      var cells = _fbm2(nx, ny, 80, 4);
      cells = Math.pow(cells, 0.85);
      /* Larger mottling — patches of stress / wax thickness. */
      var mott  = _fbm2(nx + 5.13, ny + 2.71, 6, 4);
      /* Lenticel striations — strengthened so they read as faint
         horizontal lines on the body, like the references. */
      var stria = 0.5 + 0.5 * Math.sin(ny * 220 + mott * 6.2 + cells * 1.1);
      /* Combine: cells dominate the bumps, mottling biases the height,
         striations add subtle bands. */
      var h = cells * 0.72 + mott * 0.18 + stria * 0.10;
      return h;
    }

    /* STRENGTH = how aggressively we convert height differences into
       normal tilt. Higher = bumpier shading. Bumped from 4.5 to 14 so
       the new normal map is actually visible from camera distance. */
    var STRENGTH = 14;
    for (var y = 0; y < SIZE; y++) {
      for (var x = 0; x < SIZE; x++) {
        var i = (y * SIZE + x) * 4;
        var h  = H(x, y);
        var hl = H((x - 1 + SIZE) % SIZE, y);
        var hr = H((x + 1) % SIZE, y);
        var hu = H(x, (y - 1 + SIZE) % SIZE);
        var hd = H(x, (y + 1) % SIZE);
        var dx = (hr - hl) * STRENGTH;
        var dy = (hd - hu) * STRENGTH;
        /* Normal vector = (-dx, -dy, 1) normalised. */
        var nz = 1.0;
        var len = Math.sqrt(dx * dx + dy * dy + nz * nz);
        var nrx = -dx / len;
        var nry = -dy / len;
        var nrz =  nz / len;
        nD[i]     = ((nrx * 0.5 + 0.5) * 255) | 0;
        nD[i + 1] = ((nry * 0.5 + 0.5) * 255) | 0;
        nD[i + 2] = ((nrz * 0.5 + 0.5) * 255) | 0;
        nD[i + 3] = 255;

        /* Roughness: matte everywhere (0.78 base), waxier on peaks
           (subtract a little where height is high), drier in mottled
           low patches. Tiny per-pixel jitter to avoid banding. */
        var rough = 0.78 - (h - 0.5) * 0.08 + (_h2(x * 0.31, y * 0.27) - 0.5) * 0.04;
        if (rough < 0.55) rough = 0.55;
        if (rough > 0.95) rough = 0.95;
        var rv = (rough * 255) | 0;
        rD[i] = rD[i + 1] = rD[i + 2] = rv;
        rD[i + 3] = 255;
      }
    }
    nCtx.putImageData(nImg, 0, 0);
    rCtx.putImageData(rImg, 0, 0);

    function _wrap(cv, isColor) {
      var t = new THREE.CanvasTexture(cv);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 4;
      t.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.needsUpdate = true;
      return t;
    }
    return {
      normal:    _wrap(normalCv, false),
      roughness: _wrap(roughCv,  false),
    };
  }
  var SKIN_MAPS = _buildSkinMaps();

  function cactusSkinMaterial(opts) {
    /* Real cactus skin is matte to satin — covered in fine wax (cuticle)
       that gives a soft sheen at grazing angles, not a glossy clearcoat.
       We emulate this with high diffuse roughness + low-strength sheen
       (which only kicks in at grazing angles) + minimal clearcoat for a
       very subtle waxy hint. envMapIntensity is moderate so IBL provides
       real ambient illumination but the body never reads as "shiny".

       PBR texture maps (normal + roughness + AO) drive the photoreal
       micro-detail: cuticle pebbles, water-stress mottling, faint
       lenticel striations. The maps are shared across all instances and
       all species — the per-species color comes from vertex colors and
       the per-instance shade from `tintCactus`. opts.uvScale lets
       larger species (saguaro trunk) tile the maps a few extra times so
       the cell density reads consistently. */
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

    /* Attach shared PBR maps. We clone only the texture wrapper (not the
       underlying canvas/image) so each material can have its own UV
       repeat tuned to the cactus species without affecting others.
       (We skip aoMap because that requires a uv2 channel; we already
       fake AO at rib troughs via vertex colors in cactusSkin.) */
    var repU = opts.uvScaleU != null ? opts.uvScaleU
             : (opts.uvScale != null ? opts.uvScale : 8);
    var repV = opts.uvScaleV != null ? opts.uvScaleV
             : (opts.uvScale != null ? opts.uvScale : 8);
    var nMap = SKIN_MAPS.normal.clone();
    var rMap = SKIN_MAPS.roughness.clone();
    nMap.needsUpdate = rMap.needsUpdate = true;
    nMap.repeat.set(repU, repV);
    rMap.repeat.set(repU, repV);
    m.normalMap = nMap;
    /* normalScale: how strongly the normal map perturbs lighting. Bumped
       from 0.55 (barely visible) to 1.4 (clearly visible cuticle texture
       and mottling), matching the reference photo close-up shading. */
    var ns = opts.normalScale != null ? opts.normalScale : 1.4;
    m.normalScale = new THREE.Vector2(ns, ns);
    m.roughnessMap = rMap;

    m.envMapIntensity = opts.envMapIntensity != null ? opts.envMapIntensity : 0.85;
    /* Tag this material as cactus skin so tintCactus can filter on it.
       (We can't rely on `isMeshPhysicalMaterial + vertexColors` anymore
       because spine materials also use both since the spine upgrade.) */
    m.userData.isCactusSkin = true;
    return m;
  }

  /* ================================================================== */
  /*  ULTRA-REALISM TOOLKIT                                             */
  /*                                                                    */
  /*  Opt-in upgrades that any species can apply to lift visual         */
  /*  fidelity toward photoreal close-up reference photos.              */
  /*                                                                    */
  /*  The toolkit is shared:                                            */
  /*    - One 2K dual-octave normal map (built once, GPU-uploaded once) */
  /*    - upgradeMaterialToUltra() — bumps every cactus skin material   */
  /*      already in a built mesh to use the ultra normal map and       */
  /*      stronger sheen/clearcoat                                      */
  /*    - applyCurvatureAO() — walks any geometry's vertex positions,   */
  /*      darkens vertex colors in concave regions (rib troughs,        */
  /*      tubercle valleys, arm-trunk junctions) by a real curvature    */
  /*      computation, not just a per-rib formula                       */
  /*    - addContactShadow() — DISABLED. Was a soft radial shadow      */
  /*      disk at the base, but with free-tumbling cacti the disk      */
  /*      rotates off-axis and slices through neighbours (Multiply-    */
  /*      Blending plane). Function still defined; no longer called.   */
  /*    - upgradeSpinesToUltra() — finds every InstancedMesh in the     */
  /*      cactus and lengthens spines by 25%, plus adds a tiny glossy   */
  /*      tip clearcoat                                                 */
  /*                                                                    */
  /*  These are wrapped together by makeUltra(mesh) which the per-      */
  /*  species ultra builders call after generating their base mesh.     */
  /* ================================================================== */

  /* 2K detail normal map — finer cell density and stronger relief than
     SKIN_MAPS, pre-built once at module load. */
  function _buildUltraNormalMap() {
    var SIZE = 2048;
    var cv = document.createElement("canvas");
    cv.width = cv.height = SIZE;
    var ctx = cv.getContext("2d");
    var img = ctx.createImageData(SIZE, SIZE);
    var d = img.data;

    /* Height field: very dense cuticle pebbles + medium mottling +
       sharper sun-stress crackle. Each layer is tileable so the map
       wraps without seams. */
    function H(x, y) {
      var nx = x / SIZE, ny = y / SIZE;
      /* Dense cuticle pebbles — 4 octaves of high-freq fbm. */
      var cells = _fbm2(nx, ny, 140, 4);
      cells = Math.pow(cells, 0.78);
      /* Mid mottling — wax thickness variation. */
      var mott = _fbm2(nx + 11.7, ny + 3.3, 12, 4);
      /* Sun-stress crackle — sharp thin lines, simulated by the
         derivative of fbm having abrupt jumps. */
      var crackle = _fbm2(nx + 7.1, ny + 1.9, 40, 2);
      crackle = Math.pow(crackle, 2.2);
      /* Lenticel striations — slightly off-horizontal so they don't
         look like a stripe pattern. */
      var stria = 0.5 + 0.5 * Math.sin(ny * 320 + mott * 8.0 + cells * 1.3);
      var h = cells * 0.62 + mott * 0.18 + crackle * 0.12 + stria * 0.08;
      return h;
    }

    /* Tablet-grade strength so the bumps are clearly readable from
       camera distance without going cartoonish. */
    var STRENGTH = 22;
    for (var y = 0; y < SIZE; y++) {
      for (var x = 0; x < SIZE; x++) {
        var i = (y * SIZE + x) * 4;
        var hl = H((x - 1 + SIZE) % SIZE, y);
        var hr = H((x + 1) % SIZE, y);
        var hu = H(x, (y - 1 + SIZE) % SIZE);
        var hd = H(x, (y + 1) % SIZE);
        var dx = (hr - hl) * STRENGTH;
        var dy = (hd - hu) * STRENGTH;
        var nz = 1.0;
        var len = Math.sqrt(dx * dx + dy * dy + nz * nz);
        d[i]     = ((-dx / len * 0.5 + 0.5) * 255) | 0;
        d[i + 1] = ((-dy / len * 0.5 + 0.5) * 255) | 0;
        d[i + 2] = ((nz / len * 0.5 + 0.5) * 255) | 0;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    var t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    t.colorSpace = THREE.NoColorSpace;
    t.needsUpdate = true;
    return t;
  }
  /* Defer build until first use — saves ~30ms on initial page paint
     for users who never see an ultra cactus (e.g. low-end devices). */
  var _ULTRA_NORMAL = null;
  function _ultraNormalMap() {
    if (_ULTRA_NORMAL == null) _ULTRA_NORMAL = _buildUltraNormalMap();
    return _ULTRA_NORMAL;
  }
  /* Pre-bake the 2K normal map on the first browser idle window AFTER
     the page-load animation settles. Without this, the first ultra
     cactus build would synchronously compute ~67M fbm samples on the
     main thread (200-500ms on a phone), torpedoing the iri-card color
     animation. Doing it preemptively in idle time means by the time
     ULTRA spawns are unlocked (see ULTRA_GRACE_MS), the texture is
     already on the GPU. The check is wrapped in setTimeout so it can't
     run before the iri-card has had a chance to mount. */
  if (typeof window !== "undefined") {
    var _bakeUltra = function () {
      try { _ultraNormalMap(); } catch (e) { /* ignore */ }
    };
    var _scheduleBake = function () {
      if (window.requestIdleCallback) {
        window.requestIdleCallback(_bakeUltra, { timeout: 5000 });
      } else {
        setTimeout(_bakeUltra, 32);
      }
    };
    setTimeout(_scheduleBake, 14000);
  }

  /* Upgrade every skin material in `root` to the ultra normal map and
     stronger sheen/clearcoat. Per-species UV repeats are inherited from
     the base material so cell density still reads correctly. */
  function upgradeMaterialToUltra(root) {
    root.traverse(function (ch) {
      var mat = ch.material;
      if (!mat || !mat.userData || mat.userData.isCactusSkin !== true) return;
      var nm = _ultraNormalMap().clone();
      nm.needsUpdate = true;
      /* Inherit the base material's existing repeat (per-species). */
      if (mat.normalMap) {
        nm.repeat.copy(mat.normalMap.repeat);
        nm.offset.copy(mat.normalMap.offset);
      } else {
        nm.repeat.set(12, 12);
      }
      mat.normalMap = nm;
      mat.normalScale = new THREE.Vector2(2.4, 2.4);
      /* A subtle satin clearcoat catches grazing-angle highlights along
         rib crests — what makes real cacti read as "polished green" in
         direct sun reference photos. */
      mat.clearcoat = 0.18;
      mat.clearcoatRoughness = 0.55;
      mat.sheen = 0.85;
      mat.sheenRoughness = 0.78;
      /* Slightly warmer sheen color simulates sub-surface back-scatter
         at the silhouette, the warm "inner glow" of real cactus skin. */
      mat.sheenColor = new THREE.Color(0xa8c078);
      mat.envMapIntensity = 1.05;
      mat.needsUpdate = true;
    });
  }

  /* Curvature-based vertex AO. For each vertex with a vertex-color
     attribute, sample its averaged distance-to-neighbor-plane and
     darken concave regions. This is what bakes the dark valleys at
     rib troughs, tubercle hollows, and arm-trunk junctions in offline
     renders.

     We approximate curvature cheaply: for each vertex, take its normal
     (from computeVertexNormals) and project a fixed offset position
     along that normal; if the geometry "leans inward" relative to that
     offset (i.e. the local surface is concave), the vertex's signed
     distance to its neighbors' average plane is negative. We use a
     much simpler proxy: distance from origin minus average of nearby
     distances, normalized to [0..1]. Concave = darker. */
  function applyCurvatureAO(geo, opts) {
    opts = opts || {};
    var strength = opts.strength != null ? opts.strength : 0.55;
    var floor = opts.floor != null ? opts.floor : 0.42;
    var p = geo.attributes.position;
    var col = geo.attributes.color;
    if (!col) return;
    var n = geo.attributes.normal;
    if (!n) { geo.computeVertexNormals(); n = geo.attributes.normal; }

    /* Compute per-vertex distance from a reference center (geometry
       bbox center). The center is captured BEFORE we do anything so
       vertex shifts don't pollute later iterations. */
    geo.computeBoundingBox();
    var bb = geo.boundingBox;
    var cx = (bb.min.x + bb.max.x) * 0.5;
    var cy = (bb.min.y + bb.max.y) * 0.5;
    var cz = (bb.min.z + bb.max.z) * 0.5;

    /* Mean radius (so we can normalize "deeper than mean = trough"). */
    var meanR = 0;
    var rs = new Float32Array(p.count);
    for (var i = 0; i < p.count; i++) {
      var dx = p.getX(i) - cx;
      var dy = p.getY(i) - cy;
      var dz = p.getZ(i) - cz;
      var r = Math.sqrt(dx * dx + dy * dy + dz * dz);
      rs[i] = r;
      meanR += r;
    }
    meanR /= p.count;
    if (meanR < 1e-4) return;

    var arr = col.array;
    for (var j = 0; j < p.count; j++) {
      /* "Concavity" = how much LESS this vertex sticks out than the
         mean. Troughs read as low rs[j]/meanR; crests read as high. */
      var ratio = rs[j] / meanR;
      /* Map ratio in [0.85, 1.0] (typical trough range) → [1, 0]
         AO factor. Outside this range we don't darken. */
      var t;
      if (ratio >= 1.0) t = 0;
      else if (ratio <= 0.85) t = 1;
      else t = (1.0 - ratio) / 0.15;
      var dark = 1 - t * strength;
      if (dark < floor) dark = floor;
      arr[j * 3]     *= dark;
      arr[j * 3 + 1] *= dark;
      arr[j * 3 + 2] *= dark;
    }
    col.needsUpdate = true;
  }

  /* Soft circular contact shadow disk that floats with the cactus
     (in world XY plane), giving it a sense of spatial weight against
     the iridescent backdrop. Cheap (single quad with a radial
     gradient) and uses additive-darken blending so it reads as a
     subtle drop shadow without staining the backdrop. */
  var _SHADOW_TEX = null;
  function _shadowTex() {
    if (_SHADOW_TEX != null) return _SHADOW_TEX;
    var SZ = 256;
    var cv = document.createElement("canvas");
    cv.width = cv.height = SZ;
    var ctx = cv.getContext("2d");
    var grad = ctx.createRadialGradient(SZ / 2, SZ / 2, 0, SZ / 2, SZ / 2, SZ / 2);
    grad.addColorStop(0.00, "rgba(0,0,0,0.55)");
    grad.addColorStop(0.50, "rgba(0,0,0,0.18)");
    grad.addColorStop(1.00, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SZ, SZ);
    var t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    _SHADOW_TEX = t;
    return t;
  }
  function addContactShadow(parent, radius) {
    var geo = new THREE.PlaneGeometry(radius * 3, radius * 3);
    var mat = new THREE.MeshBasicMaterial({
      map: _shadowTex(),
      transparent: true,
      depthWrite: false,
      blending: THREE.MultiplyBlending,
      /* Render the shadow disc visible from BOTH sides so it stays
         visible no matter how the cactus rotates. With a single side
         and the parent group spinning freely, the shadow would flip
         to its back face and vanish for half of every rotation. */
      side: THREE.DoubleSide,
    });
    var m = new THREE.Mesh(geo, mat);
    m.position.y = -radius * 1.05;
    m.rotation.x = -Math.PI / 2;
    /* Render BEFORE the cactus body so it sits behind the plant in
       the depth order — multiply blending against the iri backdrop
       darkens the area under the cactus without darkening the cactus
       itself. */
    m.renderOrder = -1;
    parent.add(m);
    return m;
  }

  /* Find every InstancedMesh under root that's a spine cluster (cone-
     based geometry from makeSpines) and lengthen each instance by `mul`.
     We can't add NEW spines (that'd require regenerating the source
     areole list) but we can make existing ones longer/thicker, which
     achieves most of the visual lift cheaply. */
  function upgradeSpinesToUltra(root, opts) {
    opts = opts || {};
    var lenMul = opts.lenMul != null ? opts.lenMul : 1.30;
    var thickMul = opts.thickMul != null ? opts.thickMul : 1.18;
    var _tmp = new THREE.Matrix4();
    var _pos = new THREE.Vector3();
    var _q = new THREE.Quaternion();
    var _sc = new THREE.Vector3();
    root.traverse(function (ch) {
      if (!(ch.isInstancedMesh)) return;
      /* Skip non-spine instanced meshes (tufts have a sphere geometry,
         spines have a cylinder/cone geometry — we detect by checking
         if the source geometry is roughly axially symmetric and tall:
         bounding box height >> radius). */
      ch.geometry.computeBoundingBox();
      var bb = ch.geometry.boundingBox;
      var hgt = bb.max.y - bb.min.y;
      var rad = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z);
      if (rad < 1e-6) return;
      var aspect = hgt / rad;
      if (aspect < 4) return; /* not a spine — probably a tuft/flower */
      for (var k = 0; k < ch.count; k++) {
        ch.getMatrixAt(k, _tmp);
        _tmp.decompose(_pos, _q, _sc);
        _sc.x *= thickMul;
        _sc.z *= thickMul;
        _sc.y *= lenMul;
        _tmp.compose(_pos, _q, _sc);
        ch.setMatrixAt(k, _tmp);
      }
      ch.instanceMatrix.needsUpdate = true;
      /* Slight gloss bump on the spines themselves. */
      var mat = ch.material;
      if (mat && mat.isMeshPhysicalMaterial) {
        mat.clearcoat = 0.22;
        mat.clearcoatRoughness = 0.45;
        mat.sheen = 0.55;
        mat.needsUpdate = true;
      }
    });
  }

  /* All-in-one: take a cactus root mesh and upgrade every aspect to
     "ultra" quality. Idempotent — calling twice has no extra effect. */
  function makeUltra(root, opts) {
    opts = opts || {};
    upgradeMaterialToUltra(root);
    /* Per-mesh curvature AO on every cactus skin geometry. */
    root.traverse(function (ch) {
      if (!ch.geometry) return;
      var mat = ch.material;
      if (!mat || !mat.userData || mat.userData.isCactusSkin !== true) return;
      applyCurvatureAO(ch.geometry, opts.aoOpts);
    });
    upgradeSpinesToUltra(root, opts.spineOpts);
    /* Contact-shadow disc DISABLED.
       The cacti float freely in space and tumble end-over-end (see
       ROT_PROFILE), so the shadow plane — which is a flat horizontal
       quad parented to the cactus root — rotates with the body and
       ends up pointing in arbitrary directions instead of "down".
       Worse, it's a 3× radius MultiplyBlending plane: when one
       cactus's shadow plane intersects a neighbouring cactus's body
       the neighbour gets sliced by a sharp dark band along the plane
       edge — the user reported these as "transparent cuts" showing
       the iridescent backdrop through other cacti (screenshots
       2026-04-19). Without a real ground plane there's no physical
       motivation for a contact shadow here, and removing it kills
       the slice artefact entirely. addContactShadow / _shadowTex are
       intentionally left defined in case a future grounded layout
       wants to re-enable this. */
    /* Tag so we can identify ultra meshes later (FPS auto-fallback). */
    root.userData.isUltra = true;
    return root;
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
  /* Build a rounded dome that seals one open end of a saguaro tube.

     IMPLEMENTATION NOTES — this had a long history of "missing top",
     "hollow base", and "detached dome floating below the cactus" bugs.
     Each was caused by a different subtle mismatch between the tube
     geometry and the dome geometry:

       1) Winding flip for the START cap. The original local frame was
          (N, B, -T) = left-handed for the start cap, so triangles wound
          CCW-from-OUTSIDE in the source SphereGeometry came out wound
          CCW-from-INSIDE after projection. With material.side =
          FrontSide that renders as a back-facing dome which is culled
          (i.e. invisible from the outside) — the "missing cap" artifact.

       2) Bounding box / sphere not recomputed after vertex projection.
          The geometry retained the SphereGeometry(1) bounds, which made
          centering math (Box3.setFromObject in buildSaguaro) wrong and
          could move the cap to the wrong y in trunk-local coords —
          producing a visible gap between the trunk's bottom ring and
          the floating dome.

       3) Equator radius mismatch with the tube's ribbed cross-section.
          The tube uses pow(rw, 3.2) for its rib profile while the cap
          used pow(rw, 1.8); at the seam, the cap's "valley" radius was
          ~3% larger than the tube's, so even when otherwise aligned,
          you could see a faint scalloped seam around the join.

     This rewrite addresses all three:
       * Use the SAME (T, N, B) Frenet frame for both caps and apply the
         winding flip via geometry.scale(...) on the X axis instead of
         flipping a basis vector. That guarantees the resulting frame
         remains right-handed AND triangles remain wound CCW-from-outside
         in world space, regardless of which end the cap is on.
       * Match the tube's rib exponent exactly (3.2) so the seam ribs
         line up to within float precision.
       * Push the cap's equator INWARD by half a rib depth (so it sits
         BURIED inside the tube wall) AND push the cap's "outward" face
         outward by 1.05×radius. The cap and tube now overlap by ~5% of
         the radius at the seam, hiding any residual misalignment.
       * Force frustumCulled = false on cap meshes — these are tiny
         children whose default bounding spheres can lie when the parent
         tube rotates rapidly, causing flicker-style "missing cap" pops.
       * Recompute boundingBox AND boundingSphere explicitly after
         vertex repositioning so any code that reads them later (Box3
         centering, frustum tests) gets correct numbers.                */
  function makeSaguaroCap(center, tangent, normal, binormal, radius, ribCount, ribDepth, color, isStart) {
    var SEG_W = Math.max(48, ribCount * 8);
    var SEG_H = 14;
    var hemi = new THREE.SphereGeometry(1, SEG_W, SEG_H, 0, Math.PI * 2, 0, Math.PI / 2);

    /* Winding fix without touching the basis: mirror local X. The
       SphereGeometry's triangles are CCW-from-outside in (X, Y, Z);
       mirroring X reverses winding, so we ALSO swap the per-triangle
       index order to restore CCW-from-outside in (-X, Y, Z). For the
       START cap we want outward = -T which makes the local→world map
       a reflection (det = -1) — so we have to apply the mirror
       BEFORE projection so the post-projection winding stays correct.
       For the END cap, outward = +T (det = +1), no mirror needed. */
    if (isStart) {
      var idx = hemi.index;
      if (idx) {
        var ia = idx.array;
        for (var ii = 0; ii < ia.length; ii += 3) {
          var tmp = ia[ii + 1]; ia[ii + 1] = ia[ii + 2]; ia[ii + 2] = tmp;
        }
        idx.needsUpdate = true;
      }
    }

    var pos = hemi.attributes.position;
    var vc = new Float32Array(pos.count * 3);
    var rib = new THREE.Color(color.rib);
    var base = new THREE.Color(color.base);

    /* outward = direction the dome apex points (AWAY from the tube body). */
    var outward = tangent.clone().multiplyScalar(isStart ? -1 : 1).normalize();

    /* Match the tube's rib exponent EXACTLY so the seam profile lines
       up rib-for-rib (the tube uses 3.2 in buildSaguaroSegment). */
    var RIB_EXPONENT = 3.2;
    /* Build a dome that REACHES INTO the tube by SEAM_OVERLAP×radius
       at the equator AND keeps a full radius worth of dome height
       outward. Net effect: at the curve endpoint plane (outAmount=0),
       the dome's lateral radius is essentially equal to the tube's
       ribbedR (off by < 1%) so there is no visible gap; below the
       endpoint the dome gracefully bulges out to a full hemisphere
       depth.
                  +outward direction
                       ▲
                   (apex)               apex y = +(1-0)·radius
                    /  \                  ←─ DOME_HEIGHT × radius ──┐
                   |    |                                            │
                   |    |  curve endpoint plane (tube's last ring)   │
       ...........|====|...........  ← outAmount = 0 here            │
                   |    |  (cap surface ≈ tube wall here)             │
                   \  /                                              │
                  (eq.)                 equator y = -seam·radius     │
                                       ←───── SEAM_OVERLAP×radius ──┘ */
    var SEAM_OVERLAP = 0.18;
    var DOME_HEIGHT  = 1.00;

    for (var i = 0; i < pos.count; i++) {
      var lx = pos.getX(i), ly = pos.getY(i), lz = pos.getZ(i);
      var th = Math.atan2(lz, lx);
      var rw = (Math.cos(ribCount * th) + 1) * 0.5;
      var ribBump = Math.pow(rw, RIB_EXPONENT);
      var lateral = Math.sqrt(lx * lx + lz * lz);
      var ribbedR = radius * (1 - ribDepth + ribDepth * ribBump);
      var radialAmount = ribbedR * lateral;
      /* Map ly ∈ [0, 1] to outAmount ∈ [-SEAM_OVERLAP, +DOME_HEIGHT]
         (units of radius). At ly=0 the equator sits SEAM_OVERLAP
         below the curve endpoint plane (i.e. INSIDE the tube), at
         ly=1 the apex sits DOME_HEIGHT above the endpoint (the
         outward-facing visible dome tip). */
      var outAmount = (ly * (DOME_HEIGHT + SEAM_OVERLAP) - SEAM_OVERLAP) * radius;
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
    /* Critical: reset the geometry bounds. SphereGeometry's constructor
       seeds bounds for a unit sphere at the origin; without recomputing
       them, Box3.setFromObject (used by buildSaguaro for centering)
       and three.js's frustum culling both see stale numbers and can
       either misplace the cap during centering or wrongly cull it
       during render. */
    hemi.computeBoundingBox();
    hemi.computeBoundingSphere();
    return hemi;
  }

  function addSaguaroEndCaps(parentMesh, centers, tangents, normals, binormals, baseRad, tipRad, ribDepth, ribCount, color, skinMat, opts) {
    opts = opts || {};
    var capStart = opts.capStart !== false; /* default true */
    var capEnd   = opts.capEnd   !== false; /* default true */

    if (capStart) {
      var startCap = makeSaguaroCap(
        centers[0], tangents[0], normals[0], binormals[0],
        baseRad, ribCount, ribDepth, color, true
      );
      var startMesh = new THREE.Mesh(startCap, skinMat);
      /* Cap meshes are tiny relative to the trunk and tend to live
         right at the silhouette edge after the cactus rotates. The
         default per-mesh frustum sphere can spuriously fail when the
         parent group spins quickly, causing the cap to flicker or
         disappear for a frame at a time — the "now you see it, now
         you don't" missing-cap artifact. Disabling per-mesh culling
         is cheap (the cap is < 1k tris) and the parent group's other
         children stay culled normally. */
      startMesh.frustumCulled = false;
      parentMesh.add(startMesh);
    }

    if (capEnd) {
      var lastIdx = centers.length - 1;
      var endCap = makeSaguaroCap(
        centers[lastIdx], tangents[lastIdx], normals[lastIdx], binormals[lastIdx],
        tipRad, ribCount, ribDepth, color, false
      );
      var endMesh = new THREE.Mesh(endCap, skinMat);
      endMesh.frustumCulled = false;
      parentMesh.add(endMesh);
    }
  }

  /* Areole positions on a saguaro cap dome. Mirrors the surface
     parameterisation in makeSaguaroCap so the spines we plant here
     sit on the SAME ribbed dome the cap mesh draws — without this,
     the rounded green cap at the top of the trunk and the bottom of
     each arm reads as a bare bald spot in close-up shots (see user
     screenshot: trunk's bottom dome and the rounded tops of the
     two arms / trunk apex are visibly missing the spine halo that
     covers the rest of the body).

     We pick areoles only on the OUTSIDE-facing portion of the dome
     (ly > 0 — anything below the equator is buried in the tube wall
     by SEAM_OVERLAP and would shoot spines into the trunk interior).

     One areole per rib crest × `ringsOnDome` latitudinal rings →
     32-48 fresh areoles per cap, which restores the dense halo the
     trunk has, without overwhelming the silhouette. */
  function _capAreoles(center, tangent, normal, binormal, radius, ribCount, ribDepth, isStart) {
    var out = [];
    var outward = tangent.clone().multiplyScalar(isStart ? -1 : 1).normalize();
    /* Same constants as makeSaguaroCap so positions/normals agree. */
    var SEAM_OVERLAP = 0.18;
    var DOME_HEIGHT  = 1.00;
    /* Latitudinal rings along the visible dome.
         ly=0.20 → just above the equator (where the cap meets the tube)
         ly=0.78 → near the apex (we don't go higher because every rib
                   converges to a single point at ly=1, and stacking a
                   crowded ring of spines right at the pole produces
                   the same "hanging spike cluster" artefact that
                   `ribAreoles` had to defend against on the body).
       Three rings is the saguaro sweet-spot — matches the ring spacing
       of the trunk areoles right where they meet the cap. Per-ring
       length multipliers shrink near-apex spines so they don't
       project past the dome's natural silhouette. */
    var rings    = [0.20, 0.50, 0.78];
    var ringLens = [1.00, 0.85, 0.55];
    for (var ringI = 0; ringI < rings.length; ringI++) {
      var ly = rings[ringI];
      var ringLenMul = ringLens[ringI];
      /* Areoles sit on rib CRESTS, where rw = 1. Crests occur at
         th = (k / ribCount) * 2π for integer k. */
      for (var ri = 0; ri < ribCount; ri++) {
        /* Slight phyllotactic phase per ring so consecutive rings of
           cap areoles aren't a perfect grid. */
        var phase = (ringI * 0.382) / ribCount * Math.PI * 2;
        var th = (ri / ribCount) * Math.PI * 2 + phase;
        /* Use the ribbed radius at the crest (rw = 1 → ribBump = 1). */
        var ribbedR = radius * 1.0;
        /* lateral matches the source SphereGeometry of the cap mesh:
           ly is the sphere's local Y, so the in-plane radius of the
           sphere at this ly is sqrt(1 - ly²). Using the same formula
           keeps areoles exactly on the cap surface (no floating /
           sunken spines). */
        var lateral = Math.sqrt(Math.max(0, 1 - ly * ly));
        var radialAmount = ribbedR * lateral;
        var outAmount = (ly * (DOME_HEIGHT + SEAM_OVERLAP) - SEAM_OVERLAP) * radius;
        var px = center.x
          + normal.x   * Math.cos(th) * radialAmount
          + binormal.x * Math.sin(th) * radialAmount
          + outward.x  * outAmount;
        var py = center.y
          + normal.y   * Math.cos(th) * radialAmount
          + binormal.y * Math.sin(th) * radialAmount
          + outward.y  * outAmount;
        var pz = center.z
          + normal.z   * Math.cos(th) * radialAmount
          + binormal.z * Math.sin(th) * radialAmount
          + outward.z  * outAmount;
        /* Outward surface normal: from center of dome to areole point,
           normalised. This matches the visual surface normal closely
           enough for spine planting (and avoids the cost of recomputing
           the full ribbed-surface analytic normal). */
        var dnx = px - center.x;
        var dny = py - center.y;
        var dnz = pz - center.z;
        var dl = Math.sqrt(dnx * dnx + dny * dny + dnz * dnz) || 1;
        var nor = new THREE.Vector3(dnx / dl, dny / dl, dnz / dl);
        /* Tangent for the spine fan: cross outward × dome-axis gives
           the around-the-dome direction. Saguaro radials are placed
           around `nor` so any well-defined tangent works as long as
           it's not parallel to `nor`. */
        var tan = new THREE.Vector3().crossVectors(nor, outward);
        if (tan.lengthSq() < 1e-6) tan.set(1, 0, 0);
        tan.normalize();
        out.push({ p: new THREE.Vector3(px, py, pz), n: nor, t: tan, lenMul: ringLenMul });
      }
    }
    return out;
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
        /* Sharper rib silhouette: pow exponent 3.2 (was 1.8) gives
           narrow rounded crests with deep concave V-troughs between
           them, matching real saguaro morphology in the references. */
        var rw = (Math.cos(ribCount * th) + 1) * 0.5;
        var ribBump = Math.pow(rw, 3.2);
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
        /* Color: rib crests are LIGHTER (sun-faced), valleys DARKER.
           Then BAKED AO darkens the trough further (1 - cr factor) so
           the rib grooves read as crisp shadow lines, like in close-up
           reference photos. */
        var cr = ribBump;
        var jitter = (n1 + n2) * 0.025;
        var rR = base.r + (rib.r - base.r) * cr + jitter + bleach;
        var rG = base.g + (rib.g - base.g) * cr + jitter + bleach;
        var rB = base.b + (rib.b - base.b) * cr + jitter + bleach * 0.6;
        /* Aggressive baked AO at rib troughs — multiplies skin color
           by up to 0.45 in the deepest grooves. This is what gives the
           reference photos their crisp, almost-black groove shadow
           lines that contrast against the bright crests. */
        var ao = 1 - (1 - cr) * 0.55;
        if (ao < 0.45) ao = 0.45;
        rR *= ao; rG *= ao; rB *= ao;
        vc[idx * 3]     = rR;
        vc[idx * 3 + 1] = rG;
        vc[idx * 3 + 2] = rB;
      }
    }
    tube.setAttribute("color", new THREE.BufferAttribute(vc, 3));
    tube.computeVertexNormals();

    /* Slightly less rough than other species (0.82 vs 0.90) so rib
       crests pick up a soft sheen highlight from the warm key light —
       this is the signature "polished green" look of saguaro skin in
       direct sun. UV scale 12 across the body so cuticle cells and
       lenticel striations read at proper density (the trunk is a tall
       cylinder, so without overriding uvScale the texture would stretch
       vertically into mush). */
    var skinMat = cactusSkinMaterial({
      roughness: 0.82, clearcoat: 0.10, clearcoatRoughness: 0.65,
      sheen: 0.50, sheenRoughness: 0.85, sheenColor: 0x4a5a3a,
      envMapIntensity: 0.85,
      uvScaleU: 16, uvScaleV: 12,
      normalScale: 1.6,
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

    /* Cap-dome areoles. Without these the rounded green domes at the
       tube ends look bald compared to the densely-spined trunk — see
       the user's screenshot where the bottom dome of the trunk and
       the rounded top of each arm visibly lack the spine halo that
       wraps the rest of the body. We only add areoles for the caps
       that were actually built (capStart/capEnd flags), and only on
       the OUTWARD-facing portion of the dome. */
    if (segOpts.capStart !== false) {
      var capStartAr = _capAreoles(
        centers[0], tangents[0], normals[0], binormals[0],
        baseRad, ribCount, ribDepth, true
      );
      for (var csi = 0; csi < capStartAr.length; csi++) ar.push(capStartAr[csi]);
    }
    if (segOpts.capEnd !== false) {
      var lastIdxC = centers.length - 1;
      var capEndAr = _capAreoles(
        centers[lastIdxC], tangents[lastIdxC], normals[lastIdxC], binormals[lastIdxC],
        tipRad, ribCount, ribDepth, false
      );
      for (var cei = 0; cei < capEndAr.length; cei++) ar.push(capEndAr[cei]);
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
    /* Saguaro spines tuned for photoreal silhouette:
         - Central spine length 0.075 (much longer than old 0.045 → reads
           clearly against the body even at distance)
         - Radial spine length 0.052 — also longer
         - Thicker base 0.0034 so they don't fade out
         - 12 radial spines per areole (was 7) — saguaros have a dense
           star-burst halo around each areole in the references
         - Larger amber wool tuft 0.0058 — these tufts are the most
           visible feature of saguaro spine clusters in close-up photos */
    makeSpines(mesh, ar, 0x8a5a18, 0.075, 0.052, 0.0034, 12, 0.0058, 0xf2dba0, "saguaro");
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
    /* Trunk: 16 ribs, 0.18 rib depth (deeper grooves than before for the
       sharp ribbed silhouette of the references), 32 areole rows. */
    var trunk = buildSaguaroSegment(trunkPts, trunkBaseR, trunkTipR, 16, 0.18, 32, color);
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
        armPts, armBR, armTR, armRib, 0.18, 22, color,
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
      aoStrength: 0.55,
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
      roughness: 0.84, clearcoat: 0.10, clearcoatRoughness: 0.68,
      sheen: 0.55, sheenRoughness: 0.85, sheenColor: 0x4a5a3a,
      envMapIntensity: 0.85,
      uvScaleU: 12, uvScaleV: 14,
      normalScale: 1.5,
    })));
    /* Honey-amber spines, dry straw tips. Cereus columns project spines
       outward from each rib crest (visible as a starburst at silhouette
       and as bristly clusters at center) — use "ribbed" style. */
    makeSpines(g, ribAreoles(RC, 11, R, RD, YS, 0.42), 0x946818, 0.062, 0.046, 0.0032, 7, 0.012, 0xd8b878, "ribbed");
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
      aoStrength: 0.58,
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
      roughness: 0.84, clearcoat: 0.10, clearcoatRoughness: 0.65,
      sheen: 0.55, sheenRoughness: 0.85, sheenColor: 0x4a5a38,
      envMapIntensity: 0.90,
      uvScaleU: 14, uvScaleV: 8,
      normalScale: 1.6,
    })));
    makeSpines(g, ribAreoles(RC, 10, R, RD, HX, 0.36), 0x6e2a08, 0.130, 0.090, 0.0042, 8, 0.014, 0xc8682a, "fero");
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
      roughness: 0.86, clearcoat: 0.08, clearcoatRoughness: 0.72,
      sheen: 0.55, sheenRoughness: 0.85, sheenColor: 0x3a4a28,
      envMapIntensity: 0.85,
      uvScaleU: 8, uvScaleV: 6,
      normalScale: 1.5,
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
      roughness: 0.86, clearcoat: 0.08, clearcoatRoughness: 0.72,
      sheen: 0.55, sheenRoughness: 0.85, sheenColor: 0x405038,
      envMapIntensity: 0.85,
      uvScaleU: 10, uvScaleV: 7,
      normalScale: 1.5,
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
      aoStrength: 0.60,
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
      roughness: 0.86, clearcoat: 0.08, clearcoatRoughness: 0.72,
      sheen: 0.50, sheenRoughness: 0.88, sheenColor: 0x405038,
      envMapIntensity: 0.82,
      uvScaleU: 10, uvScaleV: 7,
      normalScale: 1.5,
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
  /*  Ultra-realistic wrapper builders — one per species.                */
  /*                                                                    */
  /*  Each wrapper invokes the standard builder, then runs makeUltra()  */
  /*  to upgrade materials, AO, spines, and add a contact shadow.       */
  /*  This keeps the geometry generation logic single-sourced (so any   */
  /*  fix to a base builder propagates to its ultra variant) while      */
  /*  letting us A/B compare side-by-side at spawn time.                */
  /*                                                                    */
  /*  Per-species AO/spine tuning lives here so each plant's ultra      */
  /*  treatment can be calibrated independently — e.g. saguaros want    */
  /*  longer spines, ball cacti want stronger curvature AO at the       */
  /*  tubercle valleys.                                                  */
  /* ================================================================== */
  function buildSaguaroUltra() {
    /* Saguaros benefit most from longer spines (the dense star-burst
       halo is their iconic feature) and aggressive groove AO. */
    return makeUltra(buildSaguaro(), {
      spineOpts: { lenMul: 1.45, thickMul: 1.25 },
      aoOpts:    { strength: 0.65, floor: 0.38 },
    });
  }
  function buildColumnUltra() {
    return makeUltra(buildColumn(), {
      spineOpts: { lenMul: 1.30, thickMul: 1.20 },
      aoOpts:    { strength: 0.55, floor: 0.42 },
    });
  }
  function buildPearUltra() {
    /* Opuntia pads are nearly flat — curvature AO has little to do, but
       longer glochid spines and the contact shadow really sell it. */
    return makeUltra(buildPear(), {
      spineOpts: { lenMul: 1.25, thickMul: 1.20 },
      aoOpts:    { strength: 0.30, floor: 0.55 },
    });
  }
  function buildBarrelUltra() {
    /* Barrel cacti are textbook fishhook spines + deep ribs. */
    return makeUltra(buildBarrel(), {
      spineOpts: { lenMul: 1.40, thickMul: 1.25 },
      aoOpts:    { strength: 0.62, floor: 0.40 },
    });
  }
  function buildPinwheelUltra() {
    /* Mammillaria has tubercle bumps rather than continuous ribs;
       curvature AO darkens the hollows between bumps beautifully. */
    return makeUltra(buildPinwheel(), {
      spineOpts: { lenMul: 1.30, thickMul: 1.20 },
      aoOpts:    { strength: 0.65, floor: 0.40 },
    });
  }
  function buildStarUltra() {
    return makeUltra(buildStar(), {
      spineOpts: { lenMul: 1.30, thickMul: 1.20 },
      aoOpts:    { strength: 0.60, floor: 0.40 },
    });
  }
  function buildBallUltra() {
    return makeUltra(buildBall(), {
      spineOpts: { lenMul: 1.35, thickMul: 1.20 },
      aoOpts:    { strength: 0.62, floor: 0.40 },
    });
  }

  /* ================================================================== */
  /*  Species registry — name, builder, target on-canvas height in       */
  /*  world units. Ratios are anchored on saguaro (biggest in nature):   */
  /*    saguaro 1.00  column 0.55  pear 0.40  barrel 0.30                */
  /*    pinwheel 0.24  star 0.22  ball 0.20                              */
  /*  Final displayed size is computed from each mesh's actual bounding  */
  /*  box so different intrinsic geometry sizes don't break the ratios.  */
  /*                                                                    */
  /*  Each species also has a parallel "*_ultra" entry that goes through */
  /*  the makeUltra() pipeline. They share the same ratio so on-screen   */
  /*  size matches their regular counterpart for direct A/B comparison. */
  /*  weight = relative spawn frequency. Ultra cacti spawn at 0.5× the  */
  /*  rate of regular ones so the FPS budget stays sane and the user    */
  /*  sees a healthy mix of both.                                        */
  /* ================================================================== */
  var SAGUARO_TARGET_HEIGHT = 1.55;
  var SPECIES = [
    { name: "saguaro",      build: buildSaguaro,        ratio: 1.00, weight: 1.0, ultra: false },
    { name: "column",       build: buildColumn,         ratio: 0.55, weight: 1.0, ultra: false },
    { name: "prickly_pear", build: buildPear,           ratio: 0.40, weight: 1.0, ultra: false },
    { name: "barrel",       build: buildBarrel,         ratio: 0.30, weight: 1.0, ultra: false },
    { name: "pinwheel",     build: buildPinwheel,       ratio: 0.24, weight: 1.0, ultra: false },
    { name: "star",         build: buildStar,           ratio: 0.22, weight: 1.0, ultra: false },
    { name: "ball",         build: buildBall,           ratio: 0.20, weight: 1.0, ultra: false },
    { name: "saguaro",      build: buildSaguaroUltra,   ratio: 1.00, weight: 0.5, ultra: true  },
    { name: "column",       build: buildColumnUltra,    ratio: 0.55, weight: 0.5, ultra: true  },
    { name: "prickly_pear", build: buildPearUltra,      ratio: 0.40, weight: 0.5, ultra: true  },
    { name: "barrel",       build: buildBarrelUltra,    ratio: 0.30, weight: 0.5, ultra: true  },
    { name: "pinwheel",     build: buildPinwheelUltra,  ratio: 0.24, weight: 0.5, ultra: true  },
    { name: "star",         build: buildStarUltra,      ratio: 0.22, weight: 0.5, ultra: true  },
    { name: "ball",         build: buildBallUltra,      ratio: 0.20, weight: 0.5, ultra: true  },
  ];

  /* Weighted picker. Used in spawnOne() instead of uniform Math.random()
     across SPECIES so we can:
       - reduce ultra spawn rate when the auto-fallback decides perf is
         struggling (sets ULTRA_ENABLED = false → all ultra weights → 0)
       - keep relative species mix balanced regardless of ultra count
       - DISABLE ultra entirely for the first ~25s of life so the
         brutal 2K-normal-map build (200-500ms on phones) never lands
         while the page-load color animation is playing. After 25s the
         page is settled, the user has scrolled or interacted, and the
         pre-built normal map is already in the GPU cache so subsequent
         ultra spawns are vastly cheaper. */
  var ULTRA_ENABLED = true;
  var _PAGE_T0 = (typeof performance !== "undefined") ? performance.now() : Date.now();
  var ULTRA_GRACE_MS = 25000;
  function pickSpeciesIndex() {
    var pageMs = ((typeof performance !== "undefined") ? performance.now() : Date.now()) - _PAGE_T0;
    var ultraOk = ULTRA_ENABLED && pageMs > ULTRA_GRACE_MS;
    var total = 0;
    for (var i = 0; i < SPECIES.length; i++) {
      var w = SPECIES[i].weight;
      if (SPECIES[i].ultra && !ultraOk) w = 0;
      total += w;
    }
    if (total <= 0) return 0;
    var r = Math.random() * total;
    var acc = 0;
    for (var j = 0; j < SPECIES.length; j++) {
      var w2 = SPECIES[j].weight;
      if (SPECIES[j].ultra && !ultraOk) w2 = 0;
      acc += w2;
      if (r < acc) return j;
    }
    return SPECIES.length - 1;
  }

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
  var vH = 1.82, vW = 1.82;
  var despawnDist = 5;
  var pushRad = 1.0;
  var zoneR = 0.8;

  var _v1 = new THREE.Vector3();
  var _v2 = new THREE.Vector3();
  var _v3 = new THREE.Vector3();
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
  /*                                                                    */
  /*  Spawning is split into TWO phases so the heavy work never lands   */
  /*  inside the rAF that drives the iri-card fragment shader (the      */
  /*  visible "color animation"). If we built geometry inline in        */
  /*  spawnOne() the way we used to, building one ULTRA cactus on a     */
  /*  mid-tier phone could take 200-400ms — long enough to skip 12-24   */
  /*  iri-card frames and read as a hard FREEZE.                        */
  /*                                                                    */
  /*    1. prepareOne()  — does ALL CPU-heavy work (geometry, normals,  */
  /*       curvature AO, vertex tinting, bounding boxes, contact        */
  /*       shadow). Returns a "ready" record that can be parked in      */
  /*       buildQueue. This step runs INSIDE requestIdleCallback so     */
  /*       the browser only invokes it when the main thread has slack,  */
  /*       and never during an active frame.                            */
  /*                                                                    */
  /*    2. attachOne(rec) — pulls a ready record out of the queue,      */
  /*       picks a starting position/velocity, attaches the prebuilt    */
  /*       mesh to the scene and pushes it into the active cacti list.  */
  /*       This is O(1) cheap and safe to call from the rAF loop.       */
  /*                                                                    */
  /*  We also keep a small READY POOL (buildQueue) topped up in idle    */
  /*  time so most spawns are just a scene.add() + Object3D push.       */
  /* ================================================================== */
  var buildQueue = [];   /* ready-to-attach prebuilt cacti */
  var inflightBuild = false;

  function prepareOne(done) {
    var si = pickSpeciesIndex();
    /* Avoid two identical (same-name AND same ultra-flag) consecutive
       spawns so the variety reads quickly. We compare composite key. */
    var key = SPECIES[si].name + (SPECIES[si].ultra ? "_u" : "");
    if (key === lastSpecies) {
      var alt = pickSpeciesIndex();
      if (SPECIES[alt].name + (SPECIES[alt].ultra ? "_u" : "") !== key) si = alt;
    }
    lastSpecies = key;
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

    var box = new THREE.Box3().setFromObject(mesh);
    var sph = new THREE.Sphere();
    box.getBoundingSphere(sph);
    var colR = sph.radius * 0.75;

    var rp = rotProfileFor(sp.name);

    /* Pre-collect materials so we don't traverse during the rAF frame
       attach phase. */
    var mats = collectMats(mesh);

    if (done) done({
      mesh: mesh, mats: mats, sp: sp,
      finalScale: finalScale, colR: colR, rp: rp,
    });
  }

  /* ================================================================== */
  /*  Depth tiers (parallax)                                            */
  /* ================================================================== */
  /* Each spawn picks one of these depth tiers so cacti naturally
     stratify into "close to screen" / "midway" / "far back near the
     iri-card". The PerspectiveCamera (FOV 40, position.z = 5) means a
     cactus at z = +1.8 ends up only 3.2 units in front of the camera
     (62% the distance compared to the z=0 plane), so it visually grows
     ~60% larger and clearly reads as foreground. A cactus at z = -2.5
     is at 7.5 units (50% further than z=0), shrinks ~33% and looks
     tucked back near the colour animation behind everything else.

     scaleBias is a small extra multiplier on top of the perspective
     scaling — pushing the tiers a touch further apart so the parallax
     "pops" as the user requested ("really close" vs "really far").

     zoneMul scales the soft-zone radius so close cacti are kept in a
     tighter visible area (their world-size is small relative to
     screen) and far cacti drift through a wider area (looks more
     atmospheric and prevents them from clumping in the centre).

     Probabilities sum to 1.0. Mid-plane stays the most common so the
     scene reads roughly the same as before, just with occasional
     close/far accents that deliver the "blink and reveal layers"
     feeling from the request. */
  /* Tiers tuned so the user genuinely reads four planes:
       hero:  pressed up against the screen, can take ~⅔ of the canvas
       close: clearly in front of the action
       mid:   the default plane (most common)
       far:   visibly receding, smaller and softened by fog
       abyss: tucked right behind everything, mingling with the iri-card

     Probabilities concentrate on close/mid/far for normal scenes;
     hero and abyss are rare accents that sell the depth illusion when
     they appear. With MAX_CACTI=4 you'll see hero or abyss every few
     spawn cycles, which keeps the scene interesting without ever
     getting cluttered with extreme tiers. */
  var DEPTH_TIERS = [
    { name: "hero",  z:  2.6, scaleBias: 1.18, zoneMul: 0.40, prob: 0.10 },
    { name: "close", z:  1.4, scaleBias: 1.08, zoneMul: 0.65, prob: 0.22 },
    { name: "mid",   z:  0.0, scaleBias: 1.00, zoneMul: 1.00, prob: 0.36 },
    { name: "far",   z: -3.5, scaleBias: 0.88, zoneMul: 1.65, prob: 0.22 },
    { name: "abyss", z: -6.0, scaleBias: 0.80, zoneMul: 2.20, prob: 0.10 },
  ];
  function pickDepthTier() {
    var r = Math.random();
    var acc = 0;
    for (var i = 0; i < DEPTH_TIERS.length; i++) {
      acc += DEPTH_TIERS[i].prob;
      if (r <= acc) return DEPTH_TIERS[i];
    }
    return DEPTH_TIERS[DEPTH_TIERS.length - 1];
  }
  /* When 2+ cacti are already floating, bias the next pick toward
     missing depth bands so the user reliably sees layered parallax.
     With 5 tiers we check three buckets: foreground (hero/close),
     mid, and background (far/abyss) — the new cactus is forced into
     whichever bucket isn't represented yet so a screenshot at any
     moment shows real depth separation. */
  function pickDepthTierBalanced() {
    var hasFg = false, hasMid = false, hasBg = false;
    for (var i = 0; i < cacti.length; i++) {
      var z = cacti[i].pos.z;
      if (z > 1.0) hasFg = true;
      else if (z < -1.0) hasBg = true;
      else hasMid = true;
    }
    if (cacti.length >= 2) {
      if (!hasFg) return Math.random() < 0.55 ? DEPTH_TIERS[1] : DEPTH_TIERS[0]; // close or hero
      if (!hasBg) return Math.random() < 0.55 ? DEPTH_TIERS[3] : DEPTH_TIERS[4]; // far or abyss
    }
    return pickDepthTier();
  }

  /* Append ONE prebuilt cactus to the live cacti list. This is the
     ONLY part of spawning that touches scene state, and it's O(1). */
  function attachOne(rec) {
    if (cacti.length >= MAX_CACTI) {
      /* Slot vanished while we were preparing — dispose so we don't
         leak GPU memory. */
      rec.mesh.traverse(function (ch) {
        if (ch.geometry) ch.geometry.dispose();
        if (ch.material) ch.material.dispose();
      });
      return;
    }
    scene.add(rec.mesh);

    /* Pick a depth tier for this cactus and compute the screen-edge
       half-extents at THAT z-plane, so the spawn position is always
       just-off-screen relative to the user's view (perspective shrinks
       the visible width/height as z decreases away from camera). */
    var tier = pickDepthTierBalanced();
    var planeDist = Math.max(0.1, cam.position.z - tier.z);
    var halfH = planeDist * Math.tan((cam.fov * Math.PI) / 360);
    var halfW = halfH * cam.aspect;

    var pos = new THREE.Vector3();
    var vel = new THREE.Vector3();
    var side = Math.floor(Math.random() * 4);
    var margin = 0.80;
    var speed = 0.18 + Math.random() * 0.07;
    var drift = (Math.random() - 0.5) * 0.03;

    switch (side) {
      case 0: pos.set((Math.random() - 0.5) * halfW * 0.6, halfH + margin, tier.z); vel.set(drift, -speed, 0); break;
      case 1: pos.set(halfW + margin, (Math.random() - 0.5) * halfH * 0.5, tier.z); vel.set(-speed, drift, 0); break;
      case 2: pos.set((Math.random() - 0.5) * halfW * 0.6, -halfH - margin, tier.z); vel.set(drift, speed, 0); break;
      case 3: pos.set(-halfW - margin, (Math.random() - 0.5) * halfH * 0.5, tier.z); vel.set(speed, drift, 0); break;
    }

    /* Apply species-specific rotation behaviour:
       - tall plants spin mostly around their up-axis (Y) with a tiny
         lean instead of tumbling end-over-end
       - round plants stay isotropic
       - flat paddles (prickly pear) keep moderate tilt to show face   */
    var rp = rec.rp;
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
      mesh: rec.mesh, mats: rec.mats,
      pos: pos, vel: vel,
      angV: angV,
      quat: initQuat,
      bobPh: Math.random() * Math.PI * 2,
      age: 0,
      colR: rec.colR,
      /* Multiply the precomputed finalScale by the tier's scaleBias so
         close cacti read as clearly bigger and far ones as clearly
         smaller — perspective alone gives a real difference, this
         just dials it up so the layered effect "pops". */
      finalScale: rec.finalScale * tier.scaleBias,
      rp: rp,
      /* Depth-tier metadata used by the loop to (a) keep the cactus
         pinned to its z-plane after pointer kicks and (b) size its
         soft-zone radius proportionally to its on-screen visible
         area. Without this, every kick or repulsion would slowly
         drift cacti out of their tier and the parallax would mush
         together within a few seconds. */
      tierZ: tier.z,
      zoneMul: tier.zoneMul,
    });
  }

  /* Background pump: keep buildQueue topped up so attachOne always has
     a prebuilt cactus ready and the rAF frame doesn't have to do the
     heavy build inline. */
  var POOL_TARGET = 1;
  var _idleCb = (typeof window !== "undefined" && window.requestIdleCallback)
    ? function (fn) { window.requestIdleCallback(fn, { timeout: 1500 }); }
    : function (fn) { setTimeout(fn, 32); };

  function pumpBuildQueue() {
    if (inflightBuild) return;
    if (buildQueue.length >= POOL_TARGET) return;
    inflightBuild = true;
    _idleCb(function () {
      try {
        prepareOne(function (rec) { buildQueue.push(rec); });
      } catch (e) { /* swallow — bad build, just skip this round */ }
      inflightBuild = false;
      /* Chain the next build, but only after another idle window so we
         never hog two consecutive idle slices. */
      if (buildQueue.length < POOL_TARGET) {
        setTimeout(pumpBuildQueue, 600);
      }
    });
  }

  /* Public entry point used by the spawn scheduler + despawn timer.
     If the queue has a cactus ready, attach instantly. Otherwise kick
     a build and try again shortly. Either way, we NEVER do the heavy
     build synchronously here. */
  function spawnOne() {
    if (cacti.length >= MAX_CACTI) return;
    if (buildQueue.length > 0) {
      attachOne(buildQueue.shift());
      pumpBuildQueue();
      return;
    }
    pumpBuildQueue();
    /* Try to claim the freshly-built cactus on the next macrotask. We
       deliberately use a short retry rather than blocking — if the
       build is still inflight we just wait, the next scheduleSpawn()
       tick will pick it up. */
    setTimeout(function () {
      if (buildQueue.length > 0 && cacti.length < MAX_CACTI) {
        attachOne(buildQueue.shift());
        pumpBuildQueue();
      }
    }, 700);
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
    /* Pre-warm a replacement immediately while we're idle, then attach
       it 2-5s later. Splitting "build" from "attach" means the rAF
       loop is never blocked by geometry generation. */
    pumpBuildQueue();
    setTimeout(function () {
      if (run && cacti.length < MAX_CACTI) spawnOne();
    }, 2000 + Math.random() * 3000);
  }

  /* ================================================================== */
  /*  Pointer                                                           */
  /* ================================================================== */
  var px = 0.5, py = 0.5, pIn = false, pSpeed = 0, lastPT = 0;
  /* Cache the host bounding rect rather than recomputing it on every
     pointer/touch event. getBoundingClientRect() forces a synchronous
     layout, and on mobile a touchmove fires ~60 times per second —
     that's 60 forced layouts/sec on the page's biggest grid container.
     We invalidate the cache on resize and scroll, both passive. */
  var _hostRect = null;
  function _invalidateRect() { _hostRect = null; }
  function _getRect() {
    if (!_hostRect) _hostRect = host.getBoundingClientRect();
    return _hostRect;
  }
  window.addEventListener("resize", _invalidateRect, { passive: true });
  window.addEventListener("scroll", _invalidateRect, { passive: true });
  function onPtr(e) {
    var rect = _getRect();
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

  /* FPS auto-fallback for ultra cacti.
     The ultra pipeline (2K normal map, curvature AO, denser spines,
     contact shadow) is significantly heavier than the standard one.
     On low-end laptops/phones this can drop FPS noticeably. We sample
     the rolling median of the last N frame times: if it's worse than
     the threshold for a sustained window we flip ULTRA_ENABLED off,
     and any future ultra cacti in the spawn queue are replaced by
     their regular counterparts. We never re-enable mid-session — once
     we've decided the device is too slow, we stay safe. */
  var FRAME_SAMPLES = 90;            /* ~1.5s @ 60fps */
  /* Threshold and grace tuned generously so phones keep the ULTRA
     textures (2K normal map, curvature AO, denser spines) — the user
     specifically wants real-life-looking surface detail on iPhone.
     - 26ms (~38fps) is the boundary; below that the page already
       feels smooth on a phone, especially since most of the time
       there are 0-2 cacti visible (they spawn over time).
     - 360-frame grace window (~6s @ 60fps) lets the heavy startup
       work (PMREM bake, first cactus geometry build, env-refresh)
       settle before we judge sustained performance. */
  var ULTRA_FRAME_BUDGET_MS = 26;    /* >26ms median = struggling */
  var ULTRA_FALLBACK_GRACE = 360;    /* frames before we start checking */
  var frameTimes = new Array(FRAME_SAMPLES);
  var frameIdx = 0;
  var frameCount = 0;
  function sampleFrameAndMaybeFallback(dtMs) {
    if (!ULTRA_ENABLED) return;
    frameTimes[frameIdx] = dtMs;
    frameIdx = (frameIdx + 1) % FRAME_SAMPLES;
    frameCount++;
    if (frameCount < ULTRA_FALLBACK_GRACE) return;
    if (frameCount % 30 !== 0) return; /* check ~2x per second */
    /* Cheap median via sort of a copy. */
    var copy = frameTimes.slice(0).filter(function (v) { return v != null; });
    if (copy.length < FRAME_SAMPLES * 0.5) return;
    copy.sort(function (a, b) { return a - b; });
    var median = copy[copy.length >> 1];
    if (median > ULTRA_FRAME_BUDGET_MS) {
      ULTRA_ENABLED = false;
      /* Eagerly remove already-spawned ultra cacti so the framerate
         actually recovers. They despawn naturally on next cycle. */
      for (var ci = cacti.length - 1; ci >= 0; ci--) {
        if (cacti[ci].mesh && cacti[ci].mesh.userData && cacti[ci].mesh.userData.isUltra) {
          despawnAt(ci);
        }
      }
      /* Drop any prebuilt ultra cacti queued up — attaching them after
         the fallback already triggered would just kick the same FPS
         issue back. Dispose properly so we don't leak GPU memory. */
      for (var qi = buildQueue.length - 1; qi >= 0; qi--) {
        var qrec = buildQueue[qi];
        if (qrec.mesh && qrec.mesh.userData && qrec.mesh.userData.isUltra) {
          qrec.mesh.traverse(function (ch) {
            if (ch.geometry) ch.geometry.dispose();
            if (ch.material) ch.material.dispose();
          });
          buildQueue.splice(qi, 1);
        }
      }
    }
  }

  function loop(time) {
    requestAnimationFrame(loop);
    if (!run) return;
    var t = time * 0.001;
    var rawDtMs = time - prevT;
    var dt = Math.min(rawDtMs * 0.001, 0.05);
    prevT = time;
    if (dt <= 0) return;
    sampleFrameAndMaybeFallback(rawDtMs);
    resize();

    /* Refresh the IBL from the live iridescent backdrop on a slow cadence.
       Done inside rAF so the WebGL iri-card front buffer is still readable
       at the moment we drawImage() it.

       PMREM is expensive (compiles + draws to a render target) so we skip
       this entirely for the first 12 seconds of life so the page-load
       color animation stays buttery, and we space refreshes out further
       (~1.5s -> 3s) on devices that have already shown they can't hit
       the ultra frame budget. */
    var envInterval = ULTRA_ENABLED ? ENV_REFRESH_MS : ENV_REFRESH_MS * 2;
    if (time > FIRST_ENV_REFRESH_MS && time - lastEnvRefresh > envInterval) {
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
    /* O(n^2) but n<=MAX_CACTI=4 so it's fine. Early-out when there's
       only one (or zero) cactus saves the doubly-nested loop overhead
       on the most-common in-flight state right after first spawn.

       Depth-aware twist: each cactus's effective collision radius is
       inflated by 1 / (cam.z - tierZ) / cam.z so close cacti claim a
       larger "personal-space bubble" — they're visibly bigger so they
       need to start pushing each other away earlier. Without this,
       close cacti happily overlap on screen even though their world
       centres are still 'far enough' apart by the z=0 yardstick.
       This is exactly the issue the user pointed out from the iPhone
       screenshot. We also boost the spring force for close pairs so
       the resolution is snappy rather than mushy. */
    var nC = cacti.length;
    if (nC > 1) {
      var camZ = cam.position.z;
      for (var ai = 0; ai < nC; ai++) {
        for (var bi = ai + 1; bi < nC; bi++) {
          var ca = cacti[ai], cb = cacti[bi];
          var dx = ca.pos.x - cb.pos.x;
          var dy = ca.pos.y - cb.pos.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          var caRadMul = camZ / Math.max(0.4, camZ - ca.tierZ);
          var cbRadMul = camZ / Math.max(0.4, camZ - cb.tierZ);
          var minD = ca.colR * caRadMul + cb.colR * cbRadMul;
          if (dist < minD && dist > 0.001) {
            var overlap = minD - dist;
            var nx = dx / dist, ny = dy / dist;
            /* Stronger when at least one is in the close tier so the
               separation snaps cleanly; gentle for far pairs. */
            var pairBoost = (ca.tierZ > 1 || cb.tierZ > 1) ? 1.8 : 1.0;
            var force = overlap * 3.0 * pairBoost * dt;
            ca.vel.x += nx * force;
            ca.vel.y += ny * force;
            cb.vel.x -= nx * force;
            cb.vel.y -= ny * force;
          }
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
      /* zoneR is the global default; per-cactus zoneMul widens the
         zone for far cacti (their world position needs to span more
         units to fill the same screen area) and tightens it for
         close cacti (otherwise they'd drift off-screen quickly). */
      var spd = c.vel.length();
      if (spd < 0.22) {
        var zR = zoneR * (c.zoneMul || 1);
        var oX = Math.max(0, Math.abs(c.pos.x) - zR);
        var oY = Math.max(0, Math.abs(c.pos.y) - zR);
        if (oX > 0) c.vel.x -= Math.sign(c.pos.x) * oX * 0.45 * dt;
        if (oY > 0) c.vel.y -= Math.sign(c.pos.y) * oY * 0.45 * dt;
      }

      /* ---- pointer kick ---- */
      if (mouseW) {
        /* Re-project the pointer ray into THIS cactus's depth plane.
           The original code measured a 3D distance that included
           `-c.pos.z` as a z-component, which artificially inflated
           the distance for close cacti (z=+1.8) and made them feel
           heavy and stuck — the user explicitly reported this on
           iPhone. By computing the on-plane mouse position once per
           cactus, the touch maps cleanly to "where the user is
           pressing on this cactus's image" regardless of tier. */
        var mDir = _v3.copy(mouseW).sub(cam.position).normalize();
        var tPlane = (c.pos.z - cam.position.z) / mDir.z;
        var mPlaneX = cam.position.x + mDir.x * tPlane;
        var mPlaneY = cam.position.y + mDir.y * tPlane;
        var mdx = mPlaneX - c.pos.x;
        var mdy = mPlaneY - c.pos.y;
        var md = Math.sqrt(mdx * mdx + mdy * mdy);

        /* Per-cactus interaction radius: scale the global pushRad by
           the visible-screen size at this depth (close cacti span
           more screen so the "touching it" zone is proportionally
           bigger; far cacti span less so the zone shrinks). This
           makes close cacti easy to grab even with a quick swipe. */
        var depthScale = (cam.position.z - c.tierZ) / cam.position.z;
        var localRad = pushRad / Math.max(0.4, depthScale);

        if (md < localRad && md > 0.01) {
          var ff = 1 - md / localRad; ff *= ff;
          /* Strength multiplier by depth: close cacti get a much
             stronger kick so a single drag shoves them off-screen
             cleanly (this fixes the "feels resilient and stuck"
             complaint). Far cacti get a softer kick so they stay
             atmospheric. */
          var depthBoost = c.tierZ > 1 ? 2.4 : (c.tierZ < -1 ? 0.6 : 1.0);
          _v2.set(-mdx, -mdy, 0).divideScalar(md);
          var kick = Math.min(pSpeed * 3, 7) * ff;
          var str = (ff * BASE_PUSH + kick) * depthBoost * dt;
          c.vel.x += _v2.x * str;
          c.vel.y += _v2.y * str;
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

      /* Pin Z to the depth tier the cactus was spawned in.
         Pointer kicks and inter-cactus repulsion add small Z-axis
         components to vel; over time those would drift every cactus
         toward z = 0 and collapse the parallax. We snap pos.z back
         to its tier each frame (cheap and exact) and zero out vel.z
         so the kick is fully redirected into XY motion (which is
         what reads visually anyway in this 2.5D scene). */
      if (c.tierZ !== undefined) {
        c.pos.z = c.tierZ;
        c.vel.z = 0;
      }

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

      c.mesh.position.copy(c.pos);
      c.mesh.position.y += bob;
      c.mesh.quaternion.copy(c.quat);
      c.mesh.scale.setScalar(c.finalScale);
      /* Cacti are ALWAYS rendered fully opaque. Any opacity / scale
         fade-in is intentionally avoided here because:
           1) Each cactus is a Group of many sub-meshes (trunk, end-caps,
              arms, fruits, flowers, instanced spines and tufts). With
              transparent materials, three.js cannot reliably depth-sort
              those sub-meshes against each other inside one Group, and
              the result is the well-known "hollow" / "see-through" /
              "detached fruit" artifact (back faces showing through the
              front; arm-tip caps appearing to float separated from the
              arm; the dome cap of an arm rendering before the arm body
              so the arm looks open at the top, etc.).
           2) Cacti spawn well off-camera (distance vW + margin) and
              slide into view, so a separate opacity/scale fade adds
              nothing visually — the slide-in already provides a smooth
              entrance. Locking opacity = 1 and scale = finalScale from
              frame one eliminates every transparency-induced artifact.
         collectMats() has already set transparent=false, depthWrite=true,
         opacity=1 at spawn time, so we don't need to touch the materials
         every frame either. */

      /* Despawn based on the 2D screen-plane distance from origin so
         the trigger is independent of which depth tier the cactus is
         in (a far cactus has a non-trivial baseline length() from its
         z offset alone; using full 3D length would despawn it too
         early). */
      var dpx = c.pos.x, dpy = c.pos.y;
      if (Math.sqrt(dpx * dpx + dpy * dpy) > despawnDist) despawnAt(ci);
    }

    pSpeed *= 0.85;
    ren.render(scene, cam);
  }

  /* ================================================================== */
  /*  Visibility + periodic spawning                                    */
  /* ================================================================== */
  /* Pause the rAF loop on two independent signals:
       1) the hero card scrolls offscreen (IntersectionObserver), so the
          loop stops paying compositor cost while the user is reading
          further down the page;
       2) the tab is backgrounded (Page Visibility API), so we don't
          spend battery rendering invisible cacti and PMREM updates.
     `run` is the AND of (onscreen) AND (tab visible). When the user
     tabs back in we reset prevT so the first frame's dt isn't a giant
     number that catapults cacti across the screen. */
  var _onScreen = true;
  var _tabVisible = (typeof document !== "undefined" && !document.hidden);
  function _updateRun() {
    /* dt clamp inside loop() (Math.min(rawDtMs*0.001, 0.05)) already
       caps the first post-resume frame, so we don't need to reset
       prevT here — the cacti will resume from where they were. */
    run = _onScreen && _tabVisible;
  }
  new IntersectionObserver(
    function (ent) {
      _onScreen = ent[0].isIntersecting;
      _updateRun();
    },
    { threshold: 0, rootMargin: "200px" }
  ).observe(host);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", function () {
      _tabVisible = !document.hidden;
      _updateRun();
    });
  }

  function scheduleSpawn() {
    setTimeout(function () {
      if (run && cacti.length < MAX_CACTI) spawnOne();
      scheduleSpawn();
    }, 7000 + Math.random() * 5000);
  }

  /* Boot sequence (carefully staggered to keep the iri-card "color
     animation" perfectly smooth):

       t=    0 ms  → iri-card webgl shader starts ticking. cactus
                     module init queues PMREM compile + initial env
                     build into idle windows so the first paint of
                     the page isn't blocked by them.
       t=    0 ms  → kick off the FIRST cactus prebuild via
                     requestIdleCallback. The browser will only run
                     it when the main thread has slack (typically
                     after the page-load animation kicks off but
                     before the cacti are visible), so the user
                     never sees the heavy work.
       t≈ 8000 ms  → page-side script triggers card-glitching →
                     fades in the iridescent gradient.
       t≈ 8700 ms  → iri-card opacity = 1, glitch effect cleared.
       t=12000 ms  → env-map refreshes are unlocked (see loop()).
       t=13000 ms  → first prebuilt cactus is attached to the scene
                     and starts sliding into view. Subsequent spawns
                     happen on the 7-12s schedule and pull from the
                     prebuilt pool whenever possible.
       t≈25000 ms  → ULTRA species are unlocked (the 2K normal map
                     is already pre-baked from t=14s so the first
                     ultra spawn is now cheap).

     If the browser is slow and the prebuild isn't ready by the time
     scheduleSpawn() fires, spawnOne() will simply kick another
     prebuild and skip this turn — far better than freezing the
     visible animation. */
  pumpBuildQueue();                /* warm the pool right away (idle) */
  setTimeout(function () {
    spawnOne();
    scheduleSpawn();
  }, 13000);
  requestAnimationFrame(loop);
})();
