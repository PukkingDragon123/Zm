/* ================================================================
   render.js — gritty street ambient, pixel helpers, and the
   procedural SIDE-VIEW bot renderer (used in battle, bench, previews).
   ================================================================ */
Z.render = (function () {
  const U = Z.util;
  const PAL = Z.data.PAL;
  let canvas, ctx, W = 0, H = 0, DPR = 1;
  let skyline = null, dust = [];
  let frameDt = 0.016, resizeTimer = 0;
  let dustOn = true;

  function init(cv) { canvas = cv; ctx = canvas.getContext('2d'); window.addEventListener('resize', resize, { passive: true }); resize(); }
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = false;
    if (!skyline) buildScene();
    else { clearTimeout(resizeTimer); resizeTimer = setTimeout(buildScene, 180); }
  }
  function buildScene() {
    skyline = [];
    let x = -40;
    while (x < W + 60) {
      const bw = U.rand(40, 110), bh = U.rand(60, H * 0.42);
      const wins = [];
      const cols = Math.max(1, (bw / 16) | 0), rows = Math.max(2, (bh / 22) | 0);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (Math.random() < 0.08) wins.push({ c, r, cols });
      skyline.push({ x, w: bw, h: bh, wins, broken: Math.random() < 0.5 });
      x += bw + U.rand(2, 14);
    }
    dust = [];
    const n = (W * H) / 42000 | 0;
    for (let i = 0; i < n; i++) dust.push({ x: U.rand(0, W), y: U.rand(0, H), vx: U.rand(-14, -4), vy: U.rand(-6, 6), r: U.rand(0.5, 2), o: U.rand(0.1, 0.4) });
  }
  function setFrameDt(d) { frameDt = d > 0 && d < 0.1 ? d : 0.016; }
  function setRain(on) { dustOn = on; }
  function clear() { ctx.clearRect(0, 0, W, H); }
  function setScene() {}

  // ---- gritty dusk ambient (behind menus + interiors) ----
  function ambient(t) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#241a14'); g.addColorStop(0.4, '#1c1610'); g.addColorStop(1, PAL.bg);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // hazy sun low on the horizon
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const sun = ctx.createRadialGradient(W * 0.72, H * 0.5, 8, W * 0.72, H * 0.5, Math.max(W, H) * 0.5);
    sun.addColorStop(0, U.rgba(PAL.amber, 0.14)); sun.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H); ctx.restore();
    // ruined skyline
    const horizon = H * 0.78;
    if (skyline) for (const b of skyline) {
      ctx.fillStyle = '#161009';
      const top = horizon - b.h;
      if (b.broken) { ctx.beginPath(); ctx.moveTo(b.x, horizon); ctx.lineTo(b.x, top + U.rand(0, 0)); ctx.lineTo(b.x + b.w * 0.6, top); ctx.lineTo(b.x + b.w, top + b.h * 0.25); ctx.lineTo(b.x + b.w, horizon); ctx.closePath(); ctx.fill(); }
      else ctx.fillRect(b.x, top, b.w, b.h);
      for (const w of b.wins) { ctx.fillStyle = U.rgba(PAL.amber, 0.5); ctx.fillRect(b.x + 4 + w.c * (b.w / w.cols), top + 6 + w.r * 22, 4, 6); }
    }
    // ground haze
    const fg = ctx.createLinearGradient(0, horizon, 0, H);
    fg.addColorStop(0, 'rgba(20,14,8,.4)'); fg.addColorStop(1, '#0c0805');
    ctx.fillStyle = fg; ctx.fillRect(0, horizon, W, H - horizon);
    drawDust(t);
  }
  function drawDust(t) {
    if (!dustOn || !dust.length) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const d of dust) {
      d.x += d.vx * frameDt; d.y += (d.vy + Math.sin(t + d.y) * 3) * frameDt;
      if (d.x < -6) { d.x = W + 6; d.y = U.rand(0, H); }
      ctx.globalAlpha = d.o; ctx.fillStyle = PAL.amber;
      ctx.fillRect(d.x | 0, d.y | 0, d.r, d.r);
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }

  // ---- pixel text ----
  function pxText(c, text, x, y, size, color, align) {
    c.save(); c.font = size + 'px "Press Start 2P", monospace';
    c.textAlign = align || 'left'; c.textBaseline = 'alphabetic';
    c.fillStyle = '#000'; c.fillText(text, x + 2, y + 2);
    c.fillStyle = color; c.fillText(text, x, y); c.restore();
  }

  function roundRect(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

  // =================================================================
  //  SIDE-VIEW BOT
  // =================================================================
  function getVisual(spec) {
    const v = spec._vis; if (v) return v;
    const b = spec.build;
    let wheels = 'wheel';
    if (b && b.wheels) { if (/tread|maglock|titan/.test(b.wheels)) wheels = 'track'; else if (/gription/.test(b.wheels)) wheels = 'omni'; }
    else wheels = (spec.tractionStat || 0) > 45 ? 'track' : 'wheel';
    let plate = 0;
    if (b) plate = (b.armor || []).filter(Boolean).length; else plate = U.clamp(Math.round((spec.armor || 0) / 14), 0, 4);
    const weapons = (spec.weapons || []).map((w) => w.type);
    const nv = { wheels, plate, weapons, accent: spec.accent || PAL.amber, radius: spec.radius || 40, rust: U.rand(0.2, 0.6) };
    spec._vis = nv; return nv;
  }

  // Draw a side-view bot. (x, groundY) = where the wheels touch the floor.
  function drawBotSide(x, groundY, facing, spec, anim, opts) {
    opts = opts || {}; anim = anim || {};
    const v = getVisual(spec);
    const s = opts.scale || 1;
    const r = v.radius * s;
    const hp = opts.hpFrac == null ? 1 : opts.hpFrac;
    const accent = v.accent;
    const bodyW = r * 2.5, bodyH = r * 1.15, wheelR = r * 0.52;
    const cy = groundY - wheelR;              // wheel centre
    const by = cy - wheelR * 0.5 - bodyH;     // body top

    ctx.save();
    ctx.translate(x, 0);
    ctx.scale(facing, 1);                     // face left/right
    const bob = anim.moving ? Math.sin((anim.t || 0) * 14) * 1.6 * s : 0;

    // shadow
    ctx.save(); ctx.globalAlpha = 0.45; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(0, groundY + 2, bodyW * 0.55, wheelR * 0.5, 0, 0, U.TAU); ctx.fill(); ctx.restore();

    // wheels / track
    const wxs = [-bodyW * 0.3, bodyW * 0.3];
    if (v.wheels === 'track') {
      ctx.fillStyle = '#14100b';
      roundRect(ctx, -bodyW * 0.46, cy - wheelR * 0.7, bodyW * 0.92, wheelR * 1.5, wheelR * 0.5); ctx.fill();
      ctx.strokeStyle = '#2c2318'; ctx.lineWidth = 2 * s;
      for (let i = 0; i < 7; i++) { const tx = -bodyW * 0.42 + i * (bodyW * 0.84 / 6); ctx.beginPath(); ctx.moveTo(tx, cy - wheelR * 0.6); ctx.lineTo(tx, cy + wheelR * 0.6); ctx.stroke(); }
    } else {
      for (const wx of wxs) {
        ctx.save(); ctx.translate(wx, cy); ctx.rotate((anim.wheel || 0) * facing);
        ctx.fillStyle = '#0f0b07'; ctx.beginPath(); ctx.arc(0, 0, wheelR, 0, U.TAU); ctx.fill();
        ctx.strokeStyle = '#38301f'; ctx.lineWidth = 3 * s; ctx.stroke();
        ctx.fillStyle = '#5a5040'; ctx.beginPath(); ctx.arc(0, 0, wheelR * 0.4, 0, U.TAU); ctx.fill();
        ctx.strokeStyle = '#2c2318'; ctx.lineWidth = 2 * s;
        for (let i = 0; i < 4; i++) { const a = i / 4 * U.TAU; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * wheelR * 0.9, Math.sin(a) * wheelR * 0.9); ctx.stroke(); }
        ctx.restore();
      }
    }

    // hull
    ctx.save(); ctx.translate(0, bob);
    const grd = ctx.createLinearGradient(0, by, 0, by + bodyH);
    grd.addColorStop(0, '#9a917f'); grd.addColorStop(0.5, '#6f6653'); grd.addColorStop(1, '#3f382b');
    roundRect(ctx, -bodyW / 2, by, bodyW, bodyH, r * 0.28); ctx.fillStyle = grd; ctx.fill();
    // rust streaks
    ctx.save(); ctx.clip(); ctx.globalAlpha = v.rust * 0.5; ctx.fillStyle = PAL.rust;
    for (let i = 0; i < 4; i++) { const rx = -bodyW / 2 + U.rand(0, bodyW); ctx.fillRect(rx, by, 3 * s, bodyH); }
    ctx.restore();
    // panel line + rivets
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1.5 * s;
    ctx.beginPath(); ctx.moveTo(-bodyW * 0.1, by); ctx.lineTo(-bodyW * 0.1, by + bodyH); ctx.stroke();
    ctx.fillStyle = '#c9bfa8'; for (let i = 0; i < 4; i++) { ctx.fillRect(-bodyW / 2 + 4 + i * (bodyW / 4), by + 3, 2 * s, 2 * s); }
    // outline + armor rim
    roundRect(ctx, -bodyW / 2, by, bodyW, bodyH, r * 0.28);
    ctx.lineWidth = (1.5 + v.plate) * s; ctx.strokeStyle = v.plate > 0 ? U.mixHex('#2c2318', accent, 0.3 + v.plate * 0.12) : '#2c2318'; ctx.stroke();
    // cockpit / core (subtle, not neon)
    ctx.fillStyle = accent; ctx.globalAlpha = 0.85;
    roundRect(ctx, bodyW * 0.12, by + bodyH * 0.22, r * 0.5, r * 0.36, 3); ctx.fill(); ctx.globalAlpha = 1;

    // front armor slope
    if (v.plate > 0) { ctx.fillStyle = '#57503f'; ctx.beginPath(); ctx.moveTo(bodyW * 0.5, by + bodyH); ctx.lineTo(bodyW * 0.5 + r * (0.2 + v.plate * 0.12), by + bodyH); ctx.lineTo(bodyW * 0.5, by + bodyH * 0.3); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#2c2318'; ctx.lineWidth = 1.5 * s; ctx.stroke(); }

    drawWeaponSide(v, bodyW, by, bodyH, r, s, accent, anim);

    // damage smoke / scorch
    if (hp < 0.6) { ctx.globalAlpha = (0.6 - hp); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-bodyW * 0.1, by + bodyH * 0.4, r * 0.3, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1; }
    // hit flash
    if (opts.flash) { ctx.globalAlpha = opts.flash; roundRect(ctx, -bodyW / 2, by, bodyW, bodyH, r * 0.28); ctx.fillStyle = '#fff'; ctx.fill(); ctx.globalAlpha = 1; }
    ctx.restore();
    ctx.restore();
  }

  function drawWeaponSide(v, bodyW, by, bodyH, r, s, accent, anim) {
    const fx = bodyW * 0.5, fy = by + bodyH * 0.45;
    v.weapons.forEach((type, i) => {
      const oy = i * r * 0.5;
      ctx.save(); ctx.translate(fx, fy - oy);
      if (type === 'spinner') {
        ctx.save(); ctx.rotate(anim.spin || 0);
        ctx.fillStyle = 'rgba(200,190,168,.25)'; ctx.beginPath(); ctx.arc(r * 0.4, 0, r * 0.5, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#b9b099';
        for (let k = 0; k < 4; k++) { ctx.rotate(U.TAU / 4); ctx.beginPath(); ctx.moveTo(r * 0.2, 0); ctx.lineTo(r * 0.55, -r * 0.12); ctx.lineTo(r * 0.55, r * 0.12); ctx.closePath(); ctx.fill(); }
        ctx.restore();
        ctx.fillStyle = '#2c2318'; ctx.beginPath(); ctx.arc(r * 0.4, 0, r * 0.16, 0, U.TAU); ctx.fill();
      } else if (type === 'hammer') {
        const sw = anim.hammer || 0; ctx.rotate(-0.9 + sw * 1.6);
        ctx.strokeStyle = '#4a4130'; ctx.lineWidth = 5 * s; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 0.9, 0); ctx.stroke();
        ctx.fillStyle = '#8a8577'; roundRect(ctx, r * 0.8, -r * 0.32, r * 0.5, r * 0.64, 2); ctx.fill(); ctx.strokeStyle = '#2c2318'; ctx.lineWidth = 2 * s; ctx.stroke();
      } else if (type === 'flipper') {
        const f = anim.flip || 0; ctx.rotate(-f * 1.0);
        ctx.fillStyle = '#7d7565'; ctx.beginPath(); ctx.moveTo(0, r * 0.35); ctx.lineTo(r * 0.95, -r * 0.1); ctx.lineTo(0, -r * 0.35); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#2c2318'; ctx.lineWidth = 2 * s; ctx.stroke();
      } else if (type === 'blade') {
        ctx.fillStyle = '#c2b9a3'; ctx.beginPath(); ctx.moveTo(0, -r * 0.2); ctx.lineTo(r * 0.95, -r * 0.05); ctx.lineTo(r * 0.85, r * 0.08); ctx.lineTo(0, r * 0.2); ctx.closePath(); ctx.fill();
      } else if (type === 'flamer') {
        ctx.fillStyle = '#2c2318'; roundRect(ctx, 0, -r * 0.16, r * 0.6, r * 0.32, 2); ctx.fill();
        ctx.fillStyle = PAL.red; ctx.beginPath(); ctx.arc(r * 0.6, 0, r * 0.12, 0, U.TAU); ctx.fill();
      }
      ctx.restore();
    });
  }

  // ---- preview into any canvas ----
  const pcache = new WeakMap();
  function drawBotPreview(cv, spec, t, opts) {
    opts = opts || {};
    let c = pcache.get(cv); if (!c) { c = cv.getContext('2d'); pcache.set(cv, c); }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = cv.clientWidth || 200, chh = cv.clientHeight || 200;
    if (cv.width !== (cw * dpr | 0)) { cv.width = cw * dpr | 0; cv.height = chh * dpr | 0; }
    const saved = ctx; ctx = c;
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.imageSmoothingEnabled = false; c.clearRect(0, 0, cw, chh);
    // floor line
    c.strokeStyle = 'rgba(74,63,48,.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, chh * 0.82); c.lineTo(cw, chh * 0.82); c.stroke();
    const baseR = spec.radius || 40; const fit = Math.min(cw, chh) * 0.5; const scale = fit / (baseR * 2.5);
    drawBotSide(cw / 2, chh * 0.82, opts.facing || 1, spec, { t, spin: t * 14, wheel: t * 6, moving: false }, { scale });
    ctx = saved;
  }

  // ---- procedural part icon (no emoji) ----
  function drawPartIcon(cv, item) {
    let c = pcache.get(cv); if (!c) { c = cv.getContext('2d'); pcache.set(cv, c); }
    const dpr = Math.min(2, window.devicePixelRatio || 1); const sz = cv.clientWidth || 46;
    if (cv.width !== (sz * dpr | 0)) { cv.width = sz * dpr | 0; cv.height = sz * dpr | 0; }
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.imageSmoothingEnabled = false; c.clearRect(0, 0, sz, sz);
    const col = Z.data.rarityColor(item.rarity);
    c.translate(sz / 2, sz / 2); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 2;
    const cat = item.slots ? 'chassis' : item.category; const wt = item.weapon && item.weapon.type;
    c.save();
    if (cat === 'weapon' && wt === 'spinner') { for (let i = 0; i < 4; i++) { c.rotate(U.TAU / 4); c.beginPath(); c.moveTo(0, 0); c.lineTo(12, -3); c.lineTo(12, 3); c.closePath(); c.fill(); } c.fillStyle = '#2c2318'; c.beginPath(); c.arc(0, 0, 4, 0, U.TAU); c.fill(); }
    else if (cat === 'weapon' && wt === 'hammer') { c.lineWidth = 3; c.beginPath(); c.moveTo(-8, 8); c.lineTo(4, -4); c.stroke(); c.fillRect(2, -12, 10, 10); }
    else if (cat === 'weapon' && wt === 'flipper') { c.beginPath(); c.moveTo(-10, 8); c.lineTo(12, -8); c.lineTo(-8, -6); c.closePath(); c.fill(); }
    else if (cat === 'weapon' && wt === 'blade') { c.beginPath(); c.moveTo(-10, 6); c.lineTo(12, -8); c.lineTo(8, -2); c.lineTo(-6, 10); c.closePath(); c.fill(); }
    else if (cat === 'weapon' && wt === 'flamer') { c.beginPath(); c.moveTo(-10, 0); c.quadraticCurveTo(0, -10, 12, 0); c.quadraticCurveTo(0, 10, -10, 0); c.fill(); }
    else if (cat === 'generator') { c.beginPath(); c.moveTo(2, -12); c.lineTo(-6, 2); c.lineTo(0, 2); c.lineTo(-2, 12); c.lineTo(6, -2); c.lineTo(0, -2); c.closePath(); c.fill(); }
    else if (cat === 'motor') { c.beginPath(); c.arc(0, 0, 9, 0, U.TAU); c.stroke(); for (let i = 0; i < 8; i++) { const a = i / 8 * U.TAU; c.beginPath(); c.moveTo(Math.cos(a) * 9, Math.sin(a) * 9); c.lineTo(Math.cos(a) * 12, Math.sin(a) * 12); c.stroke(); } c.beginPath(); c.arc(0, 0, 3, 0, U.TAU); c.fill(); }
    else if (cat === 'wheels') { for (const sx of [-1, 1]) { c.beginPath(); c.arc(sx * 6, 2, 6, 0, U.TAU); c.stroke(); c.beginPath(); c.arc(sx * 6, 2, 2, 0, U.TAU); c.fill(); } }
    else if (cat === 'armor') { c.beginPath(); c.moveTo(0, -12); c.lineTo(10, -6); c.lineTo(8, 8); c.lineTo(0, 13); c.lineTo(-8, 8); c.lineTo(-10, -6); c.closePath(); c.stroke(); c.globalAlpha = 0.35; c.fill(); }
    else if (cat === 'chassis') { roundRect(c, -12, -7, 24, 14, 4); c.stroke(); c.globalAlpha = 0.2; c.fill(); }
    else { roundRect(c, -10, -8, 20, 16, 3); c.stroke(); c.beginPath(); c.arc(0, 0, 3, 0, U.TAU); c.fill(); }
    c.restore();
  }

  return {
    init, resize, setFrameDt, setRain, clear, ambient, drawDust, setScene,
    pxText, roundRect, drawBotSide, drawBotPreview, drawPartIcon, getVisual,
    get ctx() { return ctx; }, get W() { return W; }, get H() { return H; },
  };
})();
