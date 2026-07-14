/* ================================================================
   render.js — canvas setup, atmospheric cyberpunk scene, and the
   procedural bot renderer (draws the exact machine you assembled).
   ================================================================ */
Z.render = (function () {
  const U = Z.util;
  const PAL = Z.data.PAL;

  let canvas, ctx, W = 0, H = 0, DPR = 1;
  let city = null;       // cached parallax skyline
  let rainDrops = [];
  let embers = [];
  let scene = 'ambient';
  let sceneTint = PAL.neonA;
  let frameDt = 0.016;   // real per-frame dt, set by the main loop
  let resizeTimer = 0;
  function setFrameDt(d) { frameDt = d > 0 && d < 0.1 ? d : 0.016; }

  // ---------- setup ----------
  function init(cv) {
    canvas = cv; ctx = canvas.getContext('2d');
    window.addEventListener('resize', resize, { passive: true });
    resize();
  }
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // build the (randomised) scene once; on later resizes debounce so dragging a
    // window edge doesn't re-randomise the skyline every frame (flicker + GC churn)
    if (!city) { buildCity(); buildWeather(); }
    else { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { buildCity(); buildWeather(); }, 180); }
  }
  function buildCity() {
    city = [];
    // three parallax layers of skyline
    const layers = [
      { depth: 0.25, base: H * 0.62, col: '#0a1020', minH: 60, maxH: 220, w: 90, gap: 6, win: 0.08 },
      { depth: 0.5, base: H * 0.70, col: '#0c1428', minH: 90, maxH: 320, w: 70, gap: 8, win: 0.14 },
      { depth: 1.0, base: H * 0.80, col: '#0e1730', minH: 120, maxH: 420, w: 54, gap: 10, win: 0.2 },
    ];
    for (const L of layers) {
      const buildings = [];
      let x = -40;
      while (x < W + 60) {
        const bw = L.w * U.rand(0.7, 1.4);
        const bh = U.rand(L.minH, L.maxH);
        const windows = [];
        const cols = Math.max(1, Math.floor(bw / 12));
        const rows = Math.max(2, Math.floor(bh / 16));
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          if (Math.random() < L.win) windows.push({ cx: c, cy: r, cols, on: Math.random(), hue: Math.random() < 0.3 ? PAL.neonB : PAL.neonA });
        }
        buildings.push({ x, w: bw, h: bh, windows });
        x += bw + U.rand(2, L.gap);
      }
      city.push({ ...L, buildings });
    }
  }
  function buildWeather() {
    rainDrops = [];
    const n = Math.floor((W * H) / 9000);
    for (let i = 0; i < n; i++) rainDrops.push({ x: U.rand(0, W), y: U.rand(0, H), len: U.rand(8, 20), sp: U.rand(700, 1200), o: U.rand(0.05, 0.25) });
    embers = [];
    const en = Math.floor((W * H) / 60000);
    for (let i = 0; i < en; i++) embers.push({ x: U.rand(0, W), y: U.rand(0, H), vy: U.rand(-18, -6), vx: U.rand(-8, 8), r: U.rand(0.6, 2), o: U.rand(0.2, 0.7), hue: Math.random() < 0.5 ? PAL.neonA : PAL.warn });
  }

  function setScene(name, tint) { scene = name; if (tint) sceneTint = tint; }
  function clear() { ctx.clearRect(0, 0, W, H); }

  // ---------- atmospheric background ----------
  let rainOn = true;
  function setRain(on) { rainOn = on; }

  function background(t) {
    // sky
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#070b16');
    g.addColorStop(0.45, '#0a1024');
    g.addColorStop(1, PAL.bg);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // distant moon / haze glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gm = ctx.createRadialGradient(W * 0.7, H * 0.28, 10, W * 0.7, H * 0.28, Math.max(W, H) * 0.5);
    gm.addColorStop(0, U.rgba(PAL.neonB, 0.10)); gm.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gm; ctx.fillRect(0, 0, W, H);
    const gc = ctx.createRadialGradient(W * 0.2, H * 0.4, 10, W * 0.2, H * 0.4, Math.max(W, H) * 0.5);
    gc.addColorStop(0, U.rgba(PAL.neonA, 0.08)); gc.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gc; ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // parallax skyline
    if (city) {
      for (const L of city) {
        const drift = Math.sin(t * 0.05) * 6 * L.depth;
        for (const b of L.buildings) {
          const bx = b.x + drift;
          ctx.fillStyle = L.col;
          ctx.fillRect(bx, b.base - b.h, b.w, b.h);
          // roof neon edge
          ctx.fillStyle = U.rgba(L.depth > 0.7 ? PAL.neonA : PAL.neonB, 0.10 * L.depth);
          ctx.fillRect(bx, b.base - b.h, b.w, 2);
          // windows
          for (const win of b.windows) {
            const flick = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2 + win.cx * 3 + win.cy));
            ctx.globalAlpha = 0.5 * L.depth * win.on * flick;
            ctx.fillStyle = win.hue;
            const wx = bx + 4 + win.cx * (b.w / win.cols);
            const wy = b.base - b.h + 6 + win.cy * 14;
            ctx.fillRect(wx, wy, 4, 6);
          }
          ctx.globalAlpha = 1;
        }
      }
    }

    // volumetric light beams
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const bx = W * (0.2 + i * 0.3) + Math.sin(t * 0.2 + i) * 30;
      const grd = ctx.createLinearGradient(bx, 0, bx + 60, H * 0.8);
      const col = i === 1 ? PAL.neonB : PAL.neonA;
      grd.addColorStop(0, U.rgba(col, 0.06)); grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx + 40, 0); ctx.lineTo(bx + 160, H * 0.85); ctx.lineTo(bx - 120, H * 0.85); ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    // wet reflective floor with a receding neon grid
    const horizon = H * 0.8;
    const fg = ctx.createLinearGradient(0, horizon, 0, H);
    fg.addColorStop(0, '#0a1022'); fg.addColorStop(1, '#05070e');
    ctx.fillStyle = fg; ctx.fillRect(0, horizon, W, H - horizon);
    ctx.save();
    ctx.strokeStyle = U.rgba(sceneTint, 0.14); ctx.lineWidth = 1;
    const cx = W / 2;
    for (let i = -10; i <= 10; i++) {
      const x0 = cx + i * (W / 12);
      ctx.beginPath(); ctx.moveTo(cx + i * 24, horizon); ctx.lineTo(x0, H); ctx.stroke();
    }
    for (let j = 0; j < 8; j++) {
      const yy = horizon + Math.pow(j / 8, 2) * (H - horizon);
      ctx.globalAlpha = 1 - j / 9;
      ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // rain
    if (rainOn) {
      ctx.save(); ctx.strokeStyle = '#bfe9ff'; ctx.lineWidth = 1;
      for (const d of rainDrops) {
        d.y += d.sp * frameDt; d.x -= 60 * frameDt;
        if (d.y > H) { d.y = -20; d.x = U.rand(0, W + 100); }
        if (d.x < -20) d.x = W + 20;
        ctx.globalAlpha = d.o;
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 4, d.y + d.len); ctx.stroke();
      }
      ctx.restore();
    }

    // embers
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const e of embers) {
      e.x += e.vx * frameDt; e.y += e.vy * frameDt;
      if (e.y < -10) { e.y = H + 10; e.x = U.rand(0, W); }
      ctx.globalAlpha = e.o * (0.5 + 0.5 * Math.sin(t * 3 + e.x));
      ctx.fillStyle = e.hue;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, U.TAU); ctx.fill();
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }

  // =================================================================
  //  PROCEDURAL BOT RENDERER
  // =================================================================
  // Derive a visual descriptor from a fighter spec (player build or enemy).
  function getVisual(spec) {
    const v = { radius: spec.radius || 40, accent: spec.accent || PAL.neonA };
    const b = spec.build;
    // wheel style
    let wheels = 'wheel';
    if (b && b.wheels) {
      const id = b.wheels;
      if (/tread|maglock|titan/.test(id)) wheels = 'track';
      else if (/gription/.test(id)) wheels = 'omni';
      else wheels = 'wheel';
    } else {
      wheels = (spec.tractionStat || 0) > 45 ? 'track' : 'wheel';
    }
    v.wheels = wheels;
    // armor plating level 0..4
    let plate = 0;
    if (b) { plate = (b.armor || []).filter(Boolean).length; }
    else { plate = U.clamp(Math.round((spec.armor || 0) / 14), 0, 4); }
    v.plate = plate;
    // chassis silhouette family + size
    let fam = 'box';
    const cid = spec.chassisId || (b && b.chassis) || '';
    if (/alleycat|viper/.test(cid)) fam = 'wedge';
    else if (/ronin/.test(cid)) fam = 'wedge';
    else if (/bulwark|juggernaut/.test(cid)) fam = 'heavy';
    else if (/oni/.test(cid)) fam = 'demon';
    else if (/scrapjaw/.test(cid)) fam = 'jaw';
    else {
      // enemy: infer from mass/archetype
      if (spec.mass > 130) fam = 'heavy';
      else if (spec.mass < 45) fam = 'wedge';
      else fam = 'box';
      if (spec.archetype === 'berserker') fam = 'jaw';
    }
    v.fam = fam;
    // weapons list of types
    v.weapons = (spec.weapons || []).map((w) => w.type);
    v.hasSpikes = !!(b && (b.utility || []).some((u) => u === 'utl_gripspikes'));
    v.legendary = /oni|antimatter|fusion|ragnarok|adamant/.test(cid);
    return v;
  }

  function metalGrad(g, x, y, r, base, light) {
    const grd = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    grd.addColorStop(0, light); grd.addColorStop(0.5, base); grd.addColorStop(1, U.shade(base, -0.35));
    return grd;
  }

  // Draw a bot in world space. anim carries per-frame animation phases.
  // opts: { scale, hpFrac, preview }
  function drawBot(x, y, angle, spec, anim, opts) {
    opts = opts || {}; anim = anim || {};
    const v = spec._vis || (spec._vis = getVisual(spec));
    const scale = opts.scale || 1;
    const hpFrac = opts.hpFrac == null ? 1 : opts.hpFrac;
    const r = v.radius * scale;
    const accent = v.accent;
    const metal = '#5a6b7d';

    ctx.save();
    ctx.translate(x, y);

    // ground shadow (before rotation)
    ctx.save();
    ctx.globalAlpha = 0.4; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(4, 8, r * 1.05, r * 0.7, 0, 0, U.TAU); ctx.fill();
    ctx.restore();

    ctx.rotate(angle);

    const bodyL = r * 1.7;   // length along facing (x)
    const bodyW = r * 1.35;  // width (y)

    // ---- wheels / tracks (drawn under the hull) ----
    ctx.save();
    if (v.wheels === 'track') {
      ctx.fillStyle = '#161c26';
      for (const sy of [-1, 1]) {
        const ty = sy * (bodyW * 0.5 + 3);
        roundRect(-bodyL * 0.42, ty - 6 * scale, bodyL * 0.84, 12 * scale, 4 * scale);
        ctx.fill();
        // tread ticks
        ctx.fillStyle = '#2a3444';
        const ticks = 8;
        for (let i = 0; i < ticks; i++) {
          const tx = -bodyL * 0.4 + (i / (ticks - 1)) * bodyL * 0.8;
          ctx.fillRect(tx, ty - 6 * scale, 2 * scale, 12 * scale);
        }
        ctx.fillStyle = '#161c26';
      }
    } else {
      const wr = (v.wheels === 'omni' ? 8 : 7) * scale;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        const wx = sx * bodyL * 0.32, wy = sy * (bodyW * 0.5 + 2);
        // tire
        ctx.fillStyle = '#0e1219';
        ctx.beginPath(); ctx.ellipse(wx, wy, wr, wr * 1.45, 0, 0, U.TAU); ctx.fill();
        ctx.strokeStyle = '#39465a'; ctx.lineWidth = 1.5 * scale; ctx.stroke();
        // hub cap
        ctx.fillStyle = '#54677b';
        ctx.beginPath(); ctx.ellipse(wx, wy, wr * 0.44, wr * 0.62, 0, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#9db1c4';
        ctx.beginPath(); ctx.arc(wx, wy, wr * 0.16, 0, U.TAU); ctx.fill();
        if (v.wheels === 'omni') { ctx.strokeStyle = U.rgba(accent, 0.6); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(wx, wy, wr * 0.72, wr * 0.98, 0, 0, U.TAU); ctx.stroke(); }
      }
    }
    ctx.restore();

    // ---- hull ----
    ctx.save();
    ctx.beginPath();
    hullPath(v.fam, bodyL, bodyW);
    ctx.closePath();
    ctx.fillStyle = metalGrad(ctx, 0, 0, r, metal, '#8ea3b8');
    ctx.fill();
    // top light sheen
    ctx.save(); ctx.clip();
    const sheen = ctx.createLinearGradient(0, -bodyW * 0.5, 0, bodyW * 0.2);
    sheen.addColorStop(0, 'rgba(255,255,255,.22)'); sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen; ctx.fillRect(-bodyL, -bodyW, bodyL * 2, bodyW * 1.2);
    // panel lines
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-bodyL * 0.1, -bodyW * 0.5); ctx.lineTo(-bodyL * 0.1, bodyW * 0.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bodyL * 0.2, -bodyW * 0.5); ctx.lineTo(bodyL * 0.2, bodyW * 0.5); ctx.stroke();
    ctx.restore();
    // rebuild the hull path (save/restore does NOT restore the current path, and the
    // panel-line strokes above left it pointing at a stray segment)
    ctx.beginPath(); hullPath(v.fam, bodyL, bodyW); ctx.closePath();
    // hull outline (rarity/accent rim)
    ctx.lineWidth = 2 * scale; ctx.strokeStyle = U.shade(metal, -0.3); ctx.stroke();

    // armor plating rim (scaled by plate level)
    if (v.plate > 0) {
      ctx.lineWidth = (1 + v.plate * 1.4) * scale;
      ctx.strokeStyle = U.rgba(accent, 0.35 + v.plate * 0.12);
      ctx.stroke();
      // bolts
      ctx.fillStyle = '#cdd8e4';
      const bolts = 4 + v.plate * 2;
      for (let i = 0; i < bolts; i++) {
        const a = (i / bolts) * U.TAU;
        const bx = Math.cos(a) * bodyL * 0.42, by = Math.sin(a) * bodyW * 0.46;
        ctx.beginPath(); ctx.arc(bx, by, 1.6 * scale, 0, U.TAU); ctx.fill();
      }
    }
    ctx.restore();

    // ---- glowing core ----
    const pulse = 0.6 + 0.4 * Math.sin((anim.t || 0) * 4);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const cg = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 0.7);
    cg.addColorStop(0, U.rgba(accent, 0.9 * pulse)); cg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, U.TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.16, 0, U.TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.07, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1;

    // ---- front accent strip (shows facing) ----
    ctx.save();
    ctx.strokeStyle = accent; ctx.lineWidth = 2.5 * scale; ctx.shadowColor = accent; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.moveTo(bodyL * 0.32, -bodyW * 0.28); ctx.lineTo(bodyL * 0.48, 0); ctx.lineTo(bodyL * 0.32, bodyW * 0.28); ctx.stroke();
    ctx.restore();

    // ---- weapons ----
    drawWeapons(v, bodyL, bodyW, scale, accent, anim);

    // ---- demon horns for oni ----
    if (v.fam === 'demon') {
      ctx.fillStyle = U.shade(metal, -0.2);
      for (const sy of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(bodyL * 0.3, sy * bodyW * 0.4);
        ctx.lineTo(bodyL * 0.58, sy * bodyW * 0.62);
        ctx.lineTo(bodyL * 0.42, sy * bodyW * 0.3);
        ctx.closePath(); ctx.fill();
      }
    }

    // ---- damage state (scorch when hurt) ----
    if (hpFrac < 0.65) {
      ctx.save(); ctx.globalAlpha = (0.65 - hpFrac) * 1.2; ctx.fillStyle = '#0a0a0a';
      for (let i = 0; i < 3; i++) {
        const a = i * 2.1 + 1; const dx = Math.cos(a) * r * 0.4, dy = Math.sin(a) * r * 0.4;
        ctx.beginPath(); ctx.arc(dx, dy, r * 0.22, 0, U.TAU); ctx.fill();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  function hullPath(fam, L, Wd) {
    const hl = L * 0.5, hw = Wd * 0.5;
    if (fam === 'wedge') {
      ctx.moveTo(hl * 1.05, 0);
      ctx.lineTo(hl * 0.2, -hw); ctx.lineTo(-hl, -hw * 0.8);
      ctx.lineTo(-hl, hw * 0.8); ctx.lineTo(hl * 0.2, hw);
    } else if (fam === 'heavy') {
      roundRectPath(-hl, -hw, L, Wd, hw * 0.35);
    } else if (fam === 'jaw') {
      ctx.moveTo(hl, -hw * 0.5); ctx.lineTo(hl * 1.15, 0); ctx.lineTo(hl, hw * 0.5);
      ctx.lineTo(hl * 0.3, hw); ctx.lineTo(-hl, hw * 0.7);
      ctx.lineTo(-hl, -hw * 0.7); ctx.lineTo(hl * 0.3, -hw);
    } else if (fam === 'demon') {
      ctx.moveTo(hl * 1.1, 0); ctx.lineTo(hl * 0.4, -hw); ctx.lineTo(-hl * 0.7, -hw);
      ctx.lineTo(-hl, -hw * 0.3); ctx.lineTo(-hl, hw * 0.3); ctx.lineTo(-hl * 0.7, hw);
      ctx.lineTo(hl * 0.4, hw);
    } else { // box
      roundRectPath(-hl, -hw, L, Wd, Math.min(hl, hw) * 0.5);
    }
  }

  function drawWeapons(v, L, Wd, scale, accent, anim) {
    const hl = L * 0.5, hw = Wd * 0.5;
    v.weapons.forEach((type, idx) => {
      const mountY = v.weapons.length > 1 ? (idx - (v.weapons.length - 1) / 2) * hw * 0.9 : 0;
      ctx.save();
      ctx.translate(hl * 0.6, mountY);
      if (type === 'spinner') {
        const spin = anim.spin || 0;
        ctx.save(); ctx.rotate(spin);
        // motion-blur disc
        ctx.globalAlpha = 0.5; ctx.fillStyle = U.rgba(accent, 0.25);
        ctx.beginPath(); ctx.arc(0, 0, 15 * scale, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = '#cfd8e2';
        for (let i = 0; i < 3; i++) {
          ctx.rotate(U.TAU / 3);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(15 * scale, -3 * scale); ctx.lineTo(15 * scale, 3 * scale); ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = '#2a3444'; ctx.beginPath(); ctx.arc(0, 0, 5 * scale, 0, U.TAU); ctx.fill();
        ctx.restore();
      } else if (type === 'blade') {
        ctx.fillStyle = '#d7dee6';
        for (const sy of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(0, sy * 3 * scale); ctx.lineTo(18 * scale, sy * 6 * scale); ctx.lineTo(16 * scale, sy * 1 * scale); ctx.closePath(); ctx.fill();
        }
        ctx.strokeStyle = U.rgba(accent, 0.6); ctx.lineWidth = 1; ctx.stroke();
      } else if (type === 'hammer') {
        const sw = anim.hammer || 0; // 0..1 swing
        ctx.rotate(-0.6 + sw * 1.2);
        ctx.strokeStyle = '#3a4453'; ctx.lineWidth = 4 * scale;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(16 * scale, 0); ctx.stroke();
        ctx.fillStyle = '#8ea3b8';
        roundRect(14 * scale, -6 * scale, 12 * scale, 12 * scale, 2 * scale); ctx.fill();
        ctx.strokeStyle = U.rgba(accent, 0.7); ctx.lineWidth = 1.5; ctx.stroke();
      } else if (type === 'flipper') {
        const fire = anim.flip || 0; // 0..1
        ctx.fillStyle = '#7d8ea0';
        ctx.save(); ctx.translate(6 * scale, 0); ctx.rotate(-fire * 0.9);
        ctx.beginPath(); ctx.moveTo(0, -hw * 0.7); ctx.lineTo(16 * scale, 0); ctx.lineTo(0, hw * 0.7); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = U.rgba(accent, 0.7); ctx.lineWidth = 1.5; ctx.stroke();
        ctx.restore();
      } else if (type === 'flamer') {
        ctx.fillStyle = '#2a3444';
        roundRect(0, -4 * scale, 12 * scale, 8 * scale, 2 * scale); ctx.fill();
        ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(12 * scale, 0, 2.5 * scale, 0, U.TAU); ctx.fill();
      }
      ctx.restore();
    });
  }

  // path helpers
  function roundRectPath(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); roundRectPath(x, y, w, h, r); }

  // =================================================================
  //  BOT PREVIEW (into an arbitrary canvas element)
  // =================================================================
  const previewCtxCache = new WeakMap();
  function drawBotPreview(cv, spec, t, opts) {
    opts = opts || {};
    let c = previewCtxCache.get(cv);
    if (!c) { c = cv.getContext('2d'); previewCtxCache.set(cv, c); }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = cv.clientWidth || 200, chh = cv.clientHeight || 200;
    if (cv.width !== Math.floor(cw * dpr) || cv.height !== Math.floor(chh * dpr)) {
      cv.width = Math.floor(cw * dpr); cv.height = Math.floor(chh * dpr);
    }
    // temporarily swap module ctx to the preview ctx so drawBot uses it
    const savedCtx = ctx; ctx = c;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, cw, chh);
    // subtle pedestal glow
    c.save(); c.globalCompositeOperation = 'lighter';
    const gg = c.createRadialGradient(cw / 2, chh * 0.55, 4, cw / 2, chh * 0.55, cw * 0.5);
    gg.addColorStop(0, U.rgba(spec.accent || PAL.neonA, 0.12)); gg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gg; c.fillRect(0, 0, cw, chh); c.restore();

    const baseR = spec.radius || 40;
    const fit = Math.min(cw, chh) * 0.42;
    const scale = fit / (baseR * 1.7);
    const bob = opts.bob === false ? 0 : Math.sin(t * 1.6) * 4;
    const angle = opts.angle != null ? opts.angle : (opts.spinView ? 0 : -Math.PI / 2 + Math.sin(t * 0.5) * 0.25);
    drawBot(cw / 2, chh * 0.55 + bob, angle, spec, { t, spin: t * 16 }, { scale });
    ctx = savedCtx;
  }

  // Small procedural icon for a part/chassis (rendered into a canvas).
  function drawPartIcon(cv, item) {
    let c = previewCtxCache.get(cv);
    if (!c) { c = cv.getContext('2d'); previewCtxCache.set(cv, c); }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const s = cv.clientWidth || 44;
    if (cv.width !== Math.floor(s * dpr)) { cv.width = Math.floor(s * dpr); cv.height = Math.floor(s * dpr); }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, s, s);
    const col = Z.data.rarityColor(item.rarity);
    // bg glow
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
    g.addColorStop(0, U.rgba(col, 0.35)); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, s, s); c.restore();
    c.translate(s / 2, s / 2);
    c.strokeStyle = col; c.fillStyle = U.rgba(col, 0.9); c.lineWidth = 2;
    const cat = item.category || (item.slots ? 'chassis' : 'utility');
    const wtype = item.weapon && item.weapon.type;
    c.save();
    if (cat === 'weapon' && wtype === 'spinner') { for (let i = 0; i < 3; i++) { c.rotate(U.TAU / 3); c.beginPath(); c.moveTo(0, 0); c.lineTo(12, -3); c.lineTo(12, 3); c.closePath(); c.fill(); } c.fillStyle = '#2a3444'; c.beginPath(); c.arc(0, 0, 4, 0, U.TAU); c.fill(); }
    else if (cat === 'weapon' && wtype === 'hammer') { c.lineWidth = 3; c.beginPath(); c.moveTo(-8, 8); c.lineTo(4, -4); c.stroke(); c.fillRect(2, -12, 10, 10); }
    else if (cat === 'weapon' && wtype === 'flipper') { c.beginPath(); c.moveTo(-10, 8); c.lineTo(12, -8); c.lineTo(-8, -6); c.closePath(); c.fill(); }
    else if (cat === 'weapon' && wtype === 'blade') { c.beginPath(); c.moveTo(-10, 6); c.lineTo(12, -8); c.lineTo(8, -2); c.lineTo(-6, 10); c.closePath(); c.fill(); }
    else if (cat === 'weapon' && wtype === 'flamer') { c.beginPath(); c.moveTo(-10, 0); c.quadraticCurveTo(0, -10, 12, 0); c.quadraticCurveTo(0, 10, -10, 0); c.fill(); }
    else if (cat === 'generator') { c.beginPath(); c.moveTo(2, -12); c.lineTo(-6, 2); c.lineTo(0, 2); c.lineTo(-2, 12); c.lineTo(6, -2); c.lineTo(0, -2); c.closePath(); c.fill(); }
    else if (cat === 'motor') { c.beginPath(); c.arc(0, 0, 9, 0, U.TAU); c.stroke(); for (let i = 0; i < 8; i++) { const a = i / 8 * U.TAU; c.beginPath(); c.moveTo(Math.cos(a) * 9, Math.sin(a) * 9); c.lineTo(Math.cos(a) * 12, Math.sin(a) * 12); c.stroke(); } c.beginPath(); c.arc(0, 0, 3, 0, U.TAU); c.fill(); }
    else if (cat === 'wheels') { for (const sx of [-1, 1]) { c.beginPath(); c.arc(sx * 6, 0, 6, 0, U.TAU); c.stroke(); c.beginPath(); c.arc(sx * 6, 0, 2, 0, U.TAU); c.fill(); } }
    else if (cat === 'armor') { c.beginPath(); c.moveTo(0, -12); c.lineTo(10, -6); c.lineTo(8, 8); c.lineTo(0, 13); c.lineTo(-8, 8); c.lineTo(-10, -6); c.closePath(); c.stroke(); c.globalAlpha = 0.4; c.fill(); }
    else if (cat === 'chassis') { roundRect(-11, -8, 22, 16, 5); c.stroke(); c.globalAlpha = 0.25; c.fill(); }
    else { c.beginPath(); c.arc(0, 0, 9, 0, U.TAU); c.stroke(); c.beginPath(); c.arc(0, 0, 3, 0, U.TAU); c.fill(); } // utility
    c.restore();
  }

  return {
    init, resize, setScene, clear, background, setRain, setFrameDt,
    drawBot, drawBotPreview, drawPartIcon, getVisual, roundRect,
    get ctx() { return ctx; }, get W() { return W; }, get H() { return H; },
  };
})();
