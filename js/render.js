/* ================================================================
   render.js — paper-cutout renderer: bouncy sprites, humanoid
   wood-and-rune spirit puppets, warm ambient, chunky text.
   ================================================================ */
Z.render = (function () {
  const U = Z.util;
  const PAL = Z.data.PAL;
  let canvas, ctx, W = 0, H = 0, DPR = 1;
  let petals = [], hills = null;
  let frameDt = 0.016, resizeTimer = 0, petalsOn = true;

  function init(cv) { canvas = cv; ctx = canvas.getContext('2d'); window.addEventListener('resize', resize, { passive: true }); resize(); }
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (!hills) buildScene();
    else { clearTimeout(resizeTimer); resizeTimer = setTimeout(buildScene, 180); }
  }
  function buildScene() {
    hills = [];
    for (let L = 0; L < 3; L++) {
      const pts = []; let x = -60;
      while (x < W + 120) { pts.push({ x, y: U.rand(0.16, 0.4) }); x += U.rand(120, 260); }
      hills.push({ pts, col: ['#3d3226', '#4d3f2c', '#5d4c33'][L], depth: 0.3 + L * 0.3 });
    }
    petals = [];
    const n = Math.max(10, (W * H) / 46000 | 0);
    for (let i = 0; i < n; i++) petals.push(newPetal(true));
  }
  function newPetal(anyY) {
    return { x: U.rand(-40, W + 40), y: anyY ? U.rand(0, H) : -20, vx: U.rand(-36, -14), vy: U.rand(18, 44), rot: U.rand(0, U.TAU), vr: U.rand(-3, 3), s: U.rand(3, 6.5), sway: U.rand(0, U.TAU), col: U.choice(['#f2b8c6', '#f7cdd7', '#eaa3b5', '#ffe1e8']) };
  }
  function setFrameDt(d) { frameDt = d > 0 && d < 0.1 ? d : 0.016; }
  function setRain(on) { petalsOn = on; }
  function clear() { ctx.clearRect(0, 0, W, H); }
  function setScene() {}

  // ---------- falling cherry petals (screen-space ambience) ----------
  function drawPetals(t) {
    if (!petalsOn || !petals.length) return;
    ctx.save();
    for (const p of petals) {
      p.sway += frameDt * 2.2;
      p.x += (p.vx + Math.sin(p.sway) * 22) * frameDt; p.y += p.vy * frameDt; p.rot += p.vr * frameDt;
      if (p.y > H + 20 || p.x < -60) Object.assign(p, newPetal(false));
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.col; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * 0.62, 0, 0, U.TAU); ctx.fill();
      ctx.restore();
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }

  // ---------- ambient (menus / interiors behind panels) ----------
  function ambient(t) {
    if (Z.assets.cover(ctx, 'world.street', 0, 0, W, H, 0.5)) {
      ctx.fillStyle = 'rgba(38,24,12,.45)'; ctx.fillRect(0, 0, W, H);
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#f0b26a'); g.addColorStop(0.5, '#d98d55'); g.addColorStop(1, '#8a5a3a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // paper sun
      ctx.fillStyle = '#f6e3b0'; ctx.beginPath(); ctx.arc(W * 0.7, H * 0.34, 60, 0, U.TAU); ctx.fill();
      if (hills) hills.forEach((L, i) => {
        ctx.fillStyle = L.col; ctx.beginPath(); ctx.moveTo(-60, H);
        L.pts.forEach((p) => ctx.lineTo(p.x, H * (0.5 + p.y * (1 - i * 0.12))));
        ctx.lineTo(W + 60, H); ctx.closePath(); ctx.fill();
      });
    }
    drawPetals(t);
  }

  // ---------- chunky outlined text ----------
  function pxText(c, text, x, y, size, color, align) {
    c.save(); c.font = `${size + 4}px "Mochiy Pop One", sans-serif`;
    c.textAlign = align || 'left'; c.textBaseline = 'alphabetic';
    c.lineWidth = Math.max(3, size * 0.34); c.lineJoin = 'round';
    c.strokeStyle = 'rgba(35,22,10,.9)'; c.strokeText(text, x, y);
    c.fillStyle = color; c.fillText(text, x, y); c.restore();
  }

  function roundRect(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

  // paper shape: fill + cream cut-out border + ink line + drop shadow
  function paperFill(c, path, fill, opts) {
    opts = opts || {};
    c.save();
    if (!opts.noShadow) { c.save(); c.translate(3, 4); path(); c.fillStyle = 'rgba(35,22,10,.3)'; c.fill(); c.restore(); }
    path(); c.fillStyle = fill; c.fill();
    path(); c.lineWidth = opts.cut || 5; c.strokeStyle = opts.cutColor || '#f5ecd7'; c.lineJoin = 'round'; c.stroke();
    path(); c.lineWidth = opts.ink || 2.5; c.strokeStyle = opts.inkColor || '#2f2418'; c.stroke();
    c.restore();
  }

  // ---------- bouncy image sprite (paper-mario feel) ----------
  // opts: {w, h, facing, bob (0-1), squash, turn (0..1 flip), shadow, sway}
  function drawSprite(key, x, groundY, opts) {
    opts = opts || {};
    const im = Z.assets.img(key); if (!im) return false;
    const w = opts.w || 90, h = opts.h || (w * (im.naturalHeight / im.naturalWidth));
    const bob = opts.bob || 0, squash = 1 + (opts.squash || 0);
    const sy = squash, sxv = 1 / Math.max(0.6, squash);
    let facing = opts.facing == null ? 1 : opts.facing;
    let flip = facing;
    if (opts.turn != null) flip = facing * Math.cos(opts.turn * Math.PI); // paper flip on turn
    // shadow
    if (opts.shadow !== false) {
      ctx.save(); ctx.globalAlpha = 0.32; ctx.fillStyle = '#20140a';
      ctx.beginPath(); ctx.ellipse(x, groundY + 3, w * 0.34 * (1 + bob * 0.2), w * 0.09, 0, 0, U.TAU); ctx.fill(); ctx.restore();
    }
    ctx.save();
    ctx.translate(x, groundY - bob);
    ctx.rotate(opts.sway || 0);
    ctx.scale(flip * sxv, sy);
    ctx.drawImage(im, -w / 2, -h, w, h);
    ctx.restore();
    return true;
  }

  // =================================================================
  //  HUMANOID SPIRIT PUPPET (wood + rope + rune stones), paper style
  // =================================================================
  function getVisual(spec) {
    const v = spec._vis; if (v) return v;
    const b = spec.build;
    let plate = 0;
    if (b) plate = (b.armor || []).filter(Boolean).length; else plate = U.clamp(Math.round((spec.armor || 0) / 14), 0, 4);
    const nv = {
      plate, weapons: (spec.weapons || []).map((w) => w.type),
      accent: spec.accent || PAL.spirit, radius: spec.radius || 40,
      corp: !spec.build,                                    // enemies = corporate robots
      wood: spec.build ? '#a9805a' : '#8b8fa3',             // yokai puppets warm wood; corp units cold steel-grey
      wood2: spec.build ? '#7d5b3c' : '#666b80',
    };
    spec._vis = nv; return nv;
  }

  // Side-view humanoid. (x, groundY) = feet. anim: {t, walk(moving), wheel, attackT, hammer, flip, spin}
  function drawBotSide(x, groundY, facing, spec, anim, opts) {
    opts = opts || {}; anim = anim || {};
    const v = getVisual(spec);
    const s = (opts.scale || 1) * (v.radius / 40);
    const accent = v.accent, wood = v.wood, wood2 = v.wood2;
    const t = anim.t || 0;
    const moving = !!anim.moving;
    const walk = anim.wheel || 0;                       // walk phase
    const hop = moving ? Math.abs(Math.sin(walk * 3)) * 7 * s : Math.sin(t * 2.4) * 2.4 * s;
    const breathe = 1 + Math.sin(t * 2.8) * 0.02 + (moving ? Math.abs(Math.sin(walk * 3)) * 0.06 : 0);
    const lean = (anim.attackT > 0 ? 0.16 : 0) + (moving ? 0.06 : 0);

    // proportions
    const legH = 26 * s, torsoW = 34 * s, torsoH = 34 * s, headW = 24 * s, headH = 20 * s;
    const hipY = groundY - legH - hop;
    const chestY = hipY - torsoH * breathe;

    ctx.save();
    // shadow
    ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#20140a';
    ctx.beginPath(); ctx.ellipse(x, groundY + 3, torsoW * 0.9, 6 * s, 0, 0, U.TAU); ctx.fill(); ctx.restore();

    ctx.translate(x, 0); ctx.scale(facing, 1); ctx.rotate(lean * 0.4);

    const step = moving ? Math.sin(walk * 3) : Math.sin(t * 2.4) * 0.14;
    const P = (path, fill, o) => paperFill(ctx, path, fill, o);

    // ---- back arm (swings opposite) ----
    drawArm(-step, -1);
    // ---- back leg ----
    drawLeg(-step);
    // ---- torso: wood plank chest + rope belt + rune core ----
    P(() => roundRect(ctx, -torsoW / 2, chestY, torsoW, hipY - chestY + 4 * s, 8 * s), wood);
    // plank seams
    ctx.strokeStyle = 'rgba(35,22,10,.35)'; ctx.lineWidth = 1.6 * s;
    ctx.beginPath(); ctx.moveTo(-torsoW / 2 + 4 * s, chestY + (hipY - chestY) * 0.45); ctx.lineTo(torsoW / 2 - 4 * s, chestY + (hipY - chestY) * 0.45); ctx.stroke();
    // rope belt
    ctx.fillStyle = '#d8c08a'; ctx.fillRect(-torsoW / 2, hipY - 6 * s, torsoW, 5 * s);
    ctx.strokeStyle = '#8f7845'; ctx.lineWidth = 1.4; for (let i = 0; i < 5; i++) { const bx = -torsoW / 2 + i * torsoW / 4.6; ctx.beginPath(); ctx.moveTo(bx, hipY - 6 * s); ctx.lineTo(bx + 3 * s, hipY - s); ctx.stroke(); }
    // armor planks by plate level
    if (v.plate > 0) {
      for (let i = 0; i < Math.min(v.plate, 3); i++) {
        P(() => roundRect(ctx, torsoW * 0.5 - 3 * s + i * 4 * s, chestY + 3 * s, 6 * s, torsoH * 0.72, 3 * s), wood2, { cut: 3, noShadow: true });
      }
    }
    // glowing rune core
    const pulse = 0.7 + 0.3 * Math.sin(t * 5);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const cg = ctx.createRadialGradient(0, chestY + torsoH * 0.42, 1, 0, chestY + torsoH * 0.42, 13 * s);
    cg.addColorStop(0, U.rgba(accent, 0.85 * pulse)); cg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, chestY + torsoH * 0.42, 13 * s, 0, U.TAU); ctx.fill(); ctx.restore();
    P(() => { ctx.beginPath(); ctx.arc(0, chestY + torsoH * 0.42, 6.4 * s, 0, U.TAU); }, accent, { cut: 3, noShadow: true });
    // rune tick on core
    ctx.strokeStyle = '#fff8ea'; ctx.lineWidth = 1.8 * s; ctx.beginPath(); ctx.moveTo(-2.6 * s, chestY + torsoH * 0.42); ctx.lineTo(2.6 * s, chestY + torsoH * 0.42); ctx.moveTo(0, chestY + torsoH * 0.42 - 2.6 * s); ctx.lineTo(0, chestY + torsoH * 0.42 + 2.6 * s); ctx.stroke();

    // ---- front leg ----
    drawLeg(step);
    // ---- head: wooden mask block w/ rune eye + shide tassel ----
    const headBob = Math.sin(t * 2.8 + 0.6) * 1.6 * s + (moving ? Math.abs(Math.sin(walk * 3 + 0.5)) * 2.2 * s : 0);
    const hy = chestY - headH - 3 * s - headBob;
    P(() => roundRect(ctx, -headW * 0.42, hy, headW, headH, 6 * s), v.corp ? wood : '#c39a6b');
    // eye visor / rune eye
    if (v.corp) { P(() => roundRect(ctx, headW * 0.02, hy + headH * 0.28, headW * 0.34, 5.4 * s, 2.6 * s), accent, { cut: 2.5, noShadow: true }); }
    else {
      ctx.fillStyle = '#2f2418'; ctx.beginPath(); ctx.arc(headW * 0.16, hy + headH * 0.42, 2.8 * s, 0, U.TAU); ctx.fill();
      ctx.strokeStyle = '#2f2418'; ctx.lineWidth = 1.6 * s; ctx.beginPath(); ctx.arc(headW * 0.16, hy + headH * 0.6, 3.4 * s, 0.15, Math.PI - 0.4); ctx.stroke(); // little smile
    }
    // paper shide zigzag tassel on head
    ctx.save(); ctx.translate(-headW * 0.3, hy - 1 * s); ctx.rotate(Math.sin(t * 3) * 0.18 - 0.2);
    ctx.fillStyle = '#fff8ea'; ctx.strokeStyle = '#2f2418'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(4 * s, -7 * s); ctx.lineTo(-1 * s, -8 * s); ctx.lineTo(3 * s, -14 * s); ctx.lineTo(-4 * s, -12 * s); ctx.lineTo(-2 * s, -5 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();

    // ---- front arm + weapon ----
    drawArm(step, 1, true);

    // damage cracks + hit flash
    const hp = opts.hpFrac == null ? 1 : opts.hpFrac;
    if (hp < 0.55) {
      ctx.strokeStyle = 'rgba(35,22,10,.75)'; ctx.lineWidth = 1.8 * s;
      ctx.beginPath(); ctx.moveTo(-torsoW * 0.3, chestY + 4 * s); ctx.lineTo(-torsoW * 0.12, chestY + 12 * s); ctx.lineTo(-torsoW * 0.28, chestY + 18 * s); ctx.stroke();
    }
    if (opts.flash) {
      ctx.save(); ctx.globalAlpha = opts.flash; ctx.globalCompositeOperation = 'lighter';
      roundRect(ctx, -torsoW * 0.7, hy, torsoW * 1.4, groundY - hy, 10 * s); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
    }
    ctx.restore();

    function drawLeg(ph) {
      const swing = ph * (moving ? 10 : 2) * s;
      const lift = Math.max(0, ph) * (moving ? 7 : 0) * s;
      const kx = swing, ky = groundY - legH * 0.52 - hop * 0.6 - lift * 0.4;
      const fx2 = swing * 1.7, fy = groundY - lift;
      // thigh + shin as rounded wooden sticks
      ctx.strokeStyle = '#f5ecd7'; ctx.lineWidth = 9.5 * s; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, hipY - 2 * s); ctx.lineTo(kx, ky); ctx.lineTo(fx2, fy - 4 * s); ctx.stroke();
      ctx.strokeStyle = wood2; ctx.lineWidth = 6 * s;
      ctx.beginPath(); ctx.moveTo(0, hipY - 2 * s); ctx.lineTo(kx, ky); ctx.lineTo(fx2, fy - 4 * s); ctx.stroke();
      // geta foot
      P(() => roundRect(ctx, fx2 - 7 * s, fy - 5 * s, 15 * s, 5 * s, 2 * s), '#5b4630', { cut: 3, noShadow: true });
    }
    function drawArm(ph, side, withWeapon) {
      const base = withWeapon ? -0.5 : 0.3;
      let aAng = base + ph * 0.5 * side;
      if (withWeapon && anim.attackT > 0) aAng = -1.5 + (1 - anim.attackT) * 2.4;   // wind-up -> swing
      const sx2 = side * torsoW * 0.42, sy2 = chestY + torsoH * 0.24;
      const ex = sx2 + Math.cos(aAng) * 15 * s * side, ey = sy2 + Math.sin(aAng) * 15 * s + 6 * s;
      ctx.strokeStyle = '#f5ecd7'; ctx.lineWidth = 8.6 * s; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx2, sy2); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = wood; ctx.lineWidth = 5.2 * s;
      ctx.beginPath(); ctx.moveTo(sx2, sy2); ctx.lineTo(ex, ey); ctx.stroke();
      // paw/hand
      ctx.fillStyle = wood2; ctx.beginPath(); ctx.arc(ex, ey, 4 * s, 0, U.TAU); ctx.fill();
      if (withWeapon && v.weapons.length) drawWeapon(v.weapons[0], ex, ey, aAng);
    }
    function drawWeapon(type, hx, hy2, aAng) {
      ctx.save(); ctx.translate(hx, hy2);
      if (type === 'spinner') {
        ctx.rotate(anim.spin || 0);
        // prayer-wheel saw
        P(() => { ctx.beginPath(); ctx.arc(0, 0, 13 * s, 0, U.TAU); }, '#c9a35f', { cut: 3.4, noShadow: true });
        ctx.strokeStyle = '#2f2418'; ctx.lineWidth = 2 * s;
        for (let i = 0; i < 4; i++) { const a = i / 4 * U.TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 5 * s, Math.sin(a) * 5 * s); ctx.lineTo(Math.cos(a) * 12 * s, Math.sin(a) * 12 * s); ctx.stroke(); }
        ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(0, 0, 3.4 * s, 0, U.TAU); ctx.fill();
      } else if (type === 'hammer') {
        ctx.rotate(aAng * 0.4 + 0.5);
        ctx.strokeStyle = '#f5ecd7'; ctx.lineWidth = 8 * s; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(20 * s, -8 * s); ctx.stroke();
        ctx.strokeStyle = '#8a6a45'; ctx.lineWidth = 4.6 * s; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(20 * s, -8 * s); ctx.stroke();
        P(() => roundRect(ctx, 14 * s, -22 * s, 15 * s, 18 * s, 4 * s), '#b0844f', { cut: 3.4, noShadow: true });
        ctx.strokeStyle = 'rgba(35,22,10,.4)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(16 * s, -13 * s); ctx.lineTo(27 * s, -13 * s); ctx.stroke();
      } else if (type === 'flipper') {
        ctx.rotate(-(anim.flip || 0) * 1.1 + 0.2);
        // war fan (harisen)
        P(() => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(20 * s, -12 * s); ctx.lineTo(23 * s, 2 * s); ctx.closePath(); }, '#e8d3a0', { cut: 3, noShadow: true });
        ctx.strokeStyle = 'rgba(35,22,10,.45)'; ctx.lineWidth = 1.3;
        for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(2 * s, -s); ctx.lineTo(20 * s, -12 * s + i * 4.4 * s); ctx.stroke(); }
      } else if (type === 'flamer') {
        // flame gourd
        P(() => { ctx.beginPath(); ctx.arc(8 * s, 2 * s, 6.4 * s, 0, U.TAU); ctx.arc(14 * s, -3 * s, 4.4 * s, 0, U.TAU); }, '#c96f3a', { cut: 3, noShadow: true });
        ctx.fillStyle = PAL.red; ctx.beginPath(); ctx.arc(17 * s, -5 * s, 2.4 * s, 0, U.TAU); ctx.fill();
      } else { // blade — wooden katana
        ctx.rotate(aAng * 0.3);
        P(() => { ctx.beginPath(); ctx.moveTo(2 * s, 0); ctx.lineTo(26 * s, -7 * s); ctx.lineTo(25 * s, -2.4 * s); ctx.lineTo(3 * s, 4 * s); ctx.closePath(); }, '#ddc188', { cut: 3, noShadow: true });
        ctx.fillStyle = '#8a4a3a'; ctx.fillRect(-1 * s, -2 * s, 5 * s, 6 * s);
      }
      ctx.restore();
    }
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
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, cw, chh);
    c.strokeStyle = 'rgba(58,45,30,.45)'; c.lineWidth = 3; c.beginPath(); c.moveTo(6, chh * 0.86); c.lineTo(cw - 6, chh * 0.86); c.stroke();
    const scale = Math.min(cw, chh) / 130;
    drawBotSide(cw / 2, chh * 0.86, opts.facing || 1, spec, { t, spin: t * 10, wheel: t * 1.4, moving: false }, { scale });
    ctx = saved;
  }

  // ---- part icon (ink on paper) ----
  function drawPartIcon(cv, item) {
    let c = pcache.get(cv); if (!c) { c = cv.getContext('2d'); pcache.set(cv, c); }
    const dpr = Math.min(2, window.devicePixelRatio || 1); const sz = cv.clientWidth || 46;
    if (cv.width !== (sz * dpr | 0)) { cv.width = sz * dpr | 0; cv.height = sz * dpr | 0; }
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, sz, sz);
    const col = Z.data.rarityColor(item.rarity);
    c.translate(sz / 2, sz / 2); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 2.6; c.lineJoin = 'round';
    const cat = item.slots ? 'chassis' : item.category; const wt = item.weapon && item.weapon.type;
    c.save();
    if (cat === 'weapon' && wt === 'spinner') { c.beginPath(); c.arc(0, 0, 10, 0, U.TAU); c.stroke(); for (let i = 0; i < 4; i++) { const a = i / 4 * U.TAU; c.beginPath(); c.moveTo(Math.cos(a) * 4, Math.sin(a) * 4); c.lineTo(Math.cos(a) * 13, Math.sin(a) * 13); c.stroke(); } }
    else if (cat === 'weapon' && wt === 'hammer') { c.lineWidth = 3.4; c.beginPath(); c.moveTo(-9, 10); c.lineTo(3, -3); c.stroke(); c.fillRect(1, -13, 12, 10); }
    else if (cat === 'weapon' && wt === 'flipper') { c.beginPath(); c.moveTo(-10, 9); c.lineTo(12, -9); c.lineTo(13, 3); c.closePath(); c.fill(); }
    else if (cat === 'weapon' && wt === 'blade') { c.beginPath(); c.moveTo(-10, 8); c.lineTo(12, -9); c.lineTo(9, -3); c.lineTo(-7, 11); c.closePath(); c.fill(); }
    else if (cat === 'weapon' && wt === 'flamer') { c.beginPath(); c.arc(-2, 3, 6, 0, U.TAU); c.arc(4, -4, 4, 0, U.TAU); c.fill(); }
    else if (cat === 'generator') { c.beginPath(); c.arc(0, 0, 9, 0, U.TAU); c.stroke(); c.beginPath(); c.moveTo(-3, 0); c.lineTo(3, 0); c.moveTo(0, -3); c.lineTo(0, 3); c.stroke(); c.globalAlpha = .3; c.fill(); }
    else if (cat === 'motor') { for (let i = 0; i < 4; i++) { c.rotate(U.TAU / 4); c.beginPath(); c.moveTo(0, 0); c.lineTo(11, -4); c.lineTo(11, 4); c.closePath(); c.fill(); } }
    else if (cat === 'wheels') { c.beginPath(); c.moveTo(-10, 8); c.lineTo(10, 8); c.stroke(); c.fillRect(-8, -2, 6, 10); c.fillRect(2, -2, 6, 10); }
    else if (cat === 'armor') { c.beginPath(); c.moveTo(0, -12); c.lineTo(10, -6); c.lineTo(8, 8); c.lineTo(0, 13); c.lineTo(-8, 8); c.lineTo(-10, -6); c.closePath(); c.stroke(); c.globalAlpha = 0.3; c.fill(); }
    else if (cat === 'chassis') { roundRect(c, -12, -8, 24, 16, 5); c.stroke(); c.globalAlpha = 0.22; c.fill(); }
    else { roundRect(c, -8, -11, 16, 22, 7); c.stroke(); c.beginPath(); c.arc(0, 0, 3, 0, U.TAU); c.fill(); }
    c.restore();
  }

  return {
    init, resize, setFrameDt, setRain, clear, ambient, drawPetals, setScene,
    pxText, roundRect, paperFill, drawSprite, drawBotSide, drawBotPreview, drawPartIcon, getVisual,
    get ctx() { return ctx; }, get W() { return W; }, get H() { return H; },
  };
})();
