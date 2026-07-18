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
    if (Z.assets.cover(ctx, Z.assets.ready('world.konbini') ? 'world.konbini' : 'world.street', 0, 0, W, H, 0.5)) {
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

  // ---------- cardboard cut-out cache ----------
  // Builds an offscreen canvas of the sprite with an ink + cream paper border
  // stamped around its silhouette (classic cardboard-cutout look).
  const cutCache = new Map();
  function getCutout(key, w) {
    const im = Z.assets.img(key); if (!im) return null;
    const ck = key + '|' + (w | 0);
    let cv = cutCache.get(ck); if (cv) return cv;
    const h = w * (im.naturalHeight / im.naturalWidth);
    const border = Math.max(3, w * 0.05), pad = border + 4;
    cv = document.createElement('canvas');
    cv.width = Math.ceil(w + pad * 2); cv.height = Math.ceil(h + pad * 2);
    const c = cv.getContext('2d');
    // stamp silhouette at radius r in 16 directions
    const stamp = (r) => { for (let i = 0; i < 16; i++) { const a = i / 16 * U.TAU; c.drawImage(im, pad + Math.cos(a) * r, pad + Math.sin(a) * r, w, h); } };
    // ink line (outermost)
    stamp(border);
    c.globalCompositeOperation = 'source-in'; c.fillStyle = 'rgba(47,36,24,.9)'; c.fillRect(0, 0, cv.width, cv.height);
    c.globalCompositeOperation = 'source-over';
    // cream cut edge
    const cv2 = document.createElement('canvas'); cv2.width = cv.width; cv2.height = cv.height;
    const c2 = cv2.getContext('2d');
    for (let i = 0; i < 16; i++) { const a = i / 16 * U.TAU; c2.drawImage(im, pad + Math.cos(a) * (border - 1.8), pad + Math.sin(a) * (border - 1.8), w, h); }
    c2.globalCompositeOperation = 'source-in'; c2.fillStyle = '#f5ecd7'; c2.fillRect(0, 0, cv2.width, cv2.height);
    c.drawImage(cv2, 0, 0);
    // the art itself
    c.drawImage(im, pad, pad, w, h);
    cv._pad = pad; cv._w = w; cv._h = h;
    cutCache.set(ck, cv);
    return cv;
  }

  // ---------- spritesheet animation (4x2 grids from uploaded art) ----------
  // frame names -> [col,row]. Row 0 = walk cycle, row 1 = poses.
  const SHEETS = {
    'char.tanuki': { key: 'sheet.tanuki', cols: 4, rows: 2, anims: { walk: [[0, 0], [1, 0], [2, 0], [3, 0]], idle: [[1, 1], [3, 1]], jump: [[0, 1]], happy: [[2, 1]], talk: [[2, 1], [1, 1]] } },
    'char.kappa': { key: 'sheet.kappa', cols: 4, rows: 2, anims: { walk: [[0, 1], [1, 1]], idle: [[0, 0], [1, 0]], jump: [[3, 1]], happy: [[3, 1]], talk: [[2, 0], [3, 0], [2, 1]] } },
  };
  const frameCache = new Map();
  // returns a cutout canvas for one sheet frame (cream+ink border), or null
  function getSheetFrame(spriteKey, anim, fi, w) {
    const def = SHEETS[spriteKey]; if (!def) return null;
    const im = Z.assets.img(def.key); if (!im) return null;
    const frames = def.anims[anim] || def.anims.idle; if (!frames || !frames.length) return null;
    const [col, row] = frames[fi % frames.length];
    const ck = spriteKey + '|' + anim + '|' + (fi % frames.length) + '|' + (w | 0);
    let cv = frameCache.get(ck); if (cv) return cv;
    const fw = im.naturalWidth / def.cols, fh = im.naturalHeight / def.rows;
    // slice the frame, then trim: build source canvas
    const src = document.createElement('canvas'); src.width = fw; src.height = fh;
    src.getContext('2d').drawImage(im, col * fw, row * fh, fw, fh, 0, 0, fw, fh);
    const h = w * (fh / fw), border = Math.max(3, w * 0.05), pad = border + 4;
    cv = document.createElement('canvas'); cv.width = Math.ceil(w + pad * 2); cv.height = Math.ceil(h + pad * 2);
    const c = cv.getContext('2d');
    const stamp = (r, target) => { for (let i = 0; i < 16; i++) { const a = i / 16 * U.TAU; target.drawImage(src, pad + Math.cos(a) * r, pad + Math.sin(a) * r, w, h); } };
    stamp(border, c);
    c.globalCompositeOperation = 'source-in'; c.fillStyle = 'rgba(47,36,24,.9)'; c.fillRect(0, 0, cv.width, cv.height);
    c.globalCompositeOperation = 'source-over';
    const cv2 = document.createElement('canvas'); cv2.width = cv.width; cv2.height = cv.height;
    const c2 = cv2.getContext('2d'); stamp(border - 1.8, c2);
    c2.globalCompositeOperation = 'source-in'; c2.fillStyle = '#f5ecd7'; c2.fillRect(0, 0, cv2.width, cv2.height);
    c.drawImage(cv2, 0, 0);
    c.drawImage(src, pad, pad, w, h);
    cv._pad = pad; cv._w = w; cv._h = h;
    frameCache.set(ck, cv);
    return cv;
  }

  // ---------- bouncy image sprite (paper-mario feel) ----------
  // opts: {w, h, facing, bob (0-1), squash, turn (0..1 flip), shadow, sway,
  //        anim ('walk'|'idle'|'jump'|'happy'|'talk'), animT (seconds)}
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
    // animation frames from the uploaded sheet, when present
    let drawn = false;
    if (opts.anim) {
      const fps = opts.anim === 'walk' ? 9 : 3;
      const fi = Math.floor((opts.animT || 0) * fps);
      const fr = getSheetFrame(key, opts.anim, fi, w);
      if (fr) { ctx.drawImage(fr, -w / 2 - fr._pad, -fr._h - fr._pad); drawn = true; }
    }
    if (!drawn) {
      const cut = getCutout(key, w);
      if (cut) ctx.drawImage(cut, -w / 2 - cut._pad, -h - cut._pad);
      else ctx.drawImage(im, -w / 2, -h, w, h);
    }
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

    // proportions (chibi/anime: big head, compact body)
    const legH = 24 * s, torsoW = 33 * s, torsoH = 30 * s, headW = 31 * s, headH = 26 * s;
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
    // face: corp = cold visor · yokai puppet = big anime eye + blush + smile
    if (v.corp) {
      P(() => roundRect(ctx, headW * 0.02, hy + headH * 0.3, headW * 0.36, 5.8 * s, 2.8 * s), accent, { cut: 2.5, noShadow: true });
      ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.7; ctx.fillRect(headW * 0.06, hy + headH * 0.33, headW * 0.08, 2 * s); ctx.globalAlpha = 1;
    } else {
      const ex = headW * 0.18, ey = hy + headH * 0.42;
      ctx.fillStyle = '#fff8ea'; ctx.beginPath(); ctx.ellipse(ex, ey, 4.6 * s, 5.4 * s, 0, 0, U.TAU); ctx.fill();
      ctx.strokeStyle = '#2f2418'; ctx.lineWidth = 1.4 * s; ctx.stroke();
      ctx.fillStyle = '#2f2418'; ctx.beginPath(); ctx.ellipse(ex + 1.2 * s, ey + 0.4 * s, 2.6 * s, 3.2 * s, 0, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + 2.2 * s, ey - 1.2 * s, 1.1 * s, 0, U.TAU); ctx.fill();   // eye shine
      ctx.fillStyle = 'rgba(230,110,90,.5)'; ctx.beginPath(); ctx.ellipse(ex - 5.5 * s, ey + 4.6 * s, 2.6 * s, 1.5 * s, 0, 0, U.TAU); ctx.fill(); // blush
      ctx.strokeStyle = '#2f2418'; ctx.lineWidth = 1.7 * s; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(headW * 0.1, hy + headH * 0.68, 3.2 * s, 0.2, Math.PI - 0.5); ctx.stroke(); // smile
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

  // ---- part icons: little paper-craft illustrations ----
  const INK = '#2f2418', WOOD = '#b0844f', WOOD2 = '#8a6a45';
  function iconCtx(cv) {
    let c = pcache.get(cv); if (!c) { c = cv.getContext('2d'); pcache.set(cv, c); }
    const dpr = Math.min(2, window.devicePixelRatio || 1); const sz = cv.clientWidth || 46;
    if (cv.width !== (sz * dpr | 0)) { cv.width = sz * dpr | 0; cv.height = sz * dpr | 0; }
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, sz, sz);
    return { c, sz };
  }
  function ip(c, path, fill, lw) { path(); c.fillStyle = fill; c.fill(); path(); c.lineWidth = lw || 2.2; c.lineJoin = 'round'; c.strokeStyle = INK; c.stroke(); }

  function drawPartIcon(cv, item) {
    const { c, sz } = iconCtx(cv);
    const col = Z.data.rarityColor(item.rarity);
    // soft rarity glow behind the art
    const g = c.createRadialGradient(sz / 2, sz / 2, 2, sz / 2, sz / 2, sz * 0.55);
    g.addColorStop(0, U.rgba(col, 0.35)); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, sz, sz);
    c.translate(sz / 2, sz / 2);
    const cat = item.slots ? 'chassis' : item.category; const wt = item.weapon && item.weapon.type;
    if (cat === 'generator') {           // rune stone: glowing pebble
      ip(c, () => { c.beginPath(); c.ellipse(0, 2, 11, 9.5, 0, 0, U.TAU); }, '#9aa3a8');
      c.strokeStyle = col; c.lineWidth = 2.4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-4, 2); c.lineTo(4, 2); c.moveTo(0, -2.5); c.lineTo(0, 6.5); c.moveTo(-3, -1); c.lineTo(3, 5); c.stroke();
      c.fillStyle = U.rgba(col, 0.55); c.beginPath(); c.arc(0, 2, 3, 0, U.TAU); c.fill();
    } else if (cat === 'motor') {        // prayer wheel with handle
      ip(c, () => { c.beginPath(); c.rect(-2, 4, 4, 11); }, WOOD2);
      ip(c, () => { c.beginPath(); c.ellipse(0, -3, 10, 8, 0, 0, U.TAU); }, WOOD);
      c.strokeStyle = INK; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(-10, -3); c.lineTo(10, -3); c.stroke();
      c.fillStyle = col; c.beginPath(); c.arc(0, -3, 2.4, 0, U.TAU); c.fill();
      c.beginPath(); c.moveTo(10, -3); c.lineTo(13, 1); c.strokeStyle = INK; c.stroke();
      c.fillStyle = INK; c.beginPath(); c.arc(13, 1.6, 1.6, 0, U.TAU); c.fill();
    } else if (cat === 'wheels') {       // geta sandal
      ip(c, () => roundRect(c, -11, -2, 22, 6, 2.4), WOOD);
      ip(c, () => { c.beginPath(); c.rect(-7, 4, 4, 7); }, WOOD2, 1.8);
      ip(c, () => { c.beginPath(); c.rect(4, 4, 4, 7); }, WOOD2, 1.8);
      c.strokeStyle = '#c0392b'; c.lineWidth = 2.2; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, -8); c.lineTo(-6, -1); c.moveTo(0, -8); c.lineTo(6, -1); c.stroke();
    } else if (cat === 'weapon' && wt === 'blade') {   // wooden katana
      c.rotate(-0.7);
      ip(c, () => { c.beginPath(); c.moveTo(-3, -14); c.quadraticCurveTo(4, -4, 2.6, 8); c.lineTo(-1.8, 8); c.quadraticCurveTo(-1.4, -4, -3, -14); c.closePath(); }, '#ddc188');
      ip(c, () => roundRect(c, -3.6, 8, 7, 3.4, 1), col, 1.6);
      ip(c, () => roundRect(c, -2.4, 11, 4.8, 7, 1.6), '#8a4a3a', 1.6);
    } else if (cat === 'weapon' && wt === 'hammer') {  // shrine mallet
      c.rotate(0.5);
      ip(c, () => roundRect(c, -1.8, -2, 3.6, 16, 1.6), WOOD2, 1.8);
      ip(c, () => roundRect(c, -9, -14, 18, 12, 3.4), WOOD);
      c.strokeStyle = INK; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-9, -8); c.lineTo(9, -8); c.stroke();
      c.fillStyle = col; c.beginPath(); c.arc(0, -8, 2, 0, U.TAU); c.fill();
    } else if (cat === 'weapon' && wt === 'spinner') { // prayer-wheel saw
      ip(c, () => { c.beginPath(); c.arc(0, 0, 10, 0, U.TAU); }, WOOD);
      c.fillStyle = WOOD2;
      for (let i = 0; i < 8; i++) { const a = i / 8 * U.TAU; c.save(); c.translate(Math.cos(a) * 10, Math.sin(a) * 10); c.rotate(a + 0.7); c.beginPath(); c.moveTo(0, 0); c.lineTo(4.6, -1.6); c.lineTo(1.6, 3); c.closePath(); c.fill(); c.strokeStyle = INK; c.lineWidth = 1.2; c.stroke(); c.restore(); }
      c.fillStyle = col; c.beginPath(); c.arc(0, 0, 3.2, 0, U.TAU); c.fill();
      c.strokeStyle = INK; c.lineWidth = 1.6; c.beginPath(); c.arc(0, 0, 6, 0, U.TAU); c.stroke();
    } else if (cat === 'weapon' && wt === 'flipper') { // war fan
      ip(c, () => { c.beginPath(); c.moveTo(-4, 12); c.lineTo(-11, -9); c.quadraticCurveTo(0, -15, 11, -9); c.lineTo(4, 12); c.closePath(); }, '#e8d3a0');
      c.strokeStyle = INK; c.lineWidth = 1.3;
      for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(0, 12); c.lineTo(i * 7, -11); c.stroke(); }
      c.fillStyle = col; c.beginPath(); c.arc(0, -6, 3, 0, U.TAU); c.fill();
      ip(c, () => roundRect(c, -2, 12, 4, 5, 1.6), '#8a4a3a', 1.4);
    } else if (cat === 'weapon' && wt === 'flamer') {  // flame gourd
      ip(c, () => { c.beginPath(); c.arc(0, 5, 7.5, 0, U.TAU); c.arc(0, -5, 5, 0, U.TAU); }, '#c96f3a');
      c.strokeStyle = '#8a4a3a'; c.lineWidth = 2; c.beginPath(); c.moveTo(-5, 0); c.quadraticCurveTo(0, 2, 5, 0); c.stroke();
      ip(c, () => { c.beginPath(); c.moveTo(0, -16); c.quadraticCurveTo(5, -11, 1.5, -8.6); c.quadraticCurveTo(4, -8, 0, -5.4); c.quadraticCurveTo(-4.5, -9.5, 0, -16); }, '#e8632f', 1.6);
    } else if (cat === 'armor') {        // cypress plank shield
      ip(c, () => roundRect(c, -9, -12, 18, 24, 4), WOOD);
      c.strokeStyle = 'rgba(47,36,24,.5)'; c.lineWidth = 1.3;
      c.beginPath(); c.moveTo(-3, -12); c.lineTo(-3, 12); c.moveTo(3, -12); c.lineTo(3, 12); c.stroke();
      c.fillStyle = col; [[-6, -8], [6, -8], [-6, 8], [6, 8]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 1.6, 0, U.TAU); c.fill(); });
    } else if (cat === 'chassis') {      // mini puppet frame
      ip(c, () => roundRect(c, -7, -13, 14, 9, 3), '#c39a6b', 1.8);
      ip(c, () => roundRect(c, -9, -3, 18, 13, 3.4), WOOD);
      c.fillStyle = col; c.beginPath(); c.arc(0, 3, 2.6, 0, U.TAU); c.fill();
      c.strokeStyle = INK; c.lineWidth = 1.8; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-9, 2); c.lineTo(-13, 7); c.moveTo(9, 2); c.lineTo(13, 7); c.stroke();
    } else {                             // omamori charm
      ip(c, () => { c.beginPath(); c.moveTo(-7, -8); c.quadraticCurveTo(0, -13, 7, -8); c.lineTo(7, 9); c.lineTo(0, 13); c.lineTo(-7, 9); c.closePath(); }, '#c0392b');
      c.strokeStyle = '#ffd98a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-4, -4); c.lineTo(4, -4); c.stroke();
      c.fillStyle = col; c.beginPath(); c.arc(0, 2, 2.8, 0, U.TAU); c.fill();
      c.strokeStyle = INK; c.lineWidth = 1.4; c.beginPath(); c.moveTo(0, -13); c.arc(0, -15, 2, 0, U.TAU); c.stroke();
    }
  }

  // ---- food icons for AO's menu ----
  function drawFoodIcon(cv, snack) {
    const { c, sz } = iconCtx(cv);
    c.translate(sz / 2, sz / 2);
    const id = (snack.id + ' ' + snack.name).toLowerCase();
    const steam = (x) => { c.strokeStyle = 'rgba(120,110,95,.75)'; c.lineWidth = 1.8; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, -8); c.quadraticCurveTo(x - 3, -12, x, -16); c.stroke(); };
    if (/taiyaki|fish/.test(id)) {
      ip(c, () => { c.beginPath(); c.ellipse(-2, 0, 11, 7.5, 0, 0, U.TAU); c.moveTo(8, 0); c.lineTo(15, -6); c.lineTo(15, 6); c.closePath(); }, '#d9a35a');
      c.strokeStyle = INK; c.lineWidth = 1.3; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(-8 + i * -1, -6 + (i + 1) * 4); c.lineTo(2, -6 + (i + 1) * 4); c.stroke(); }
      c.fillStyle = INK; c.beginPath(); c.arc(-9, -2.6, 1.2, 0, U.TAU); c.fill();
    } else if (/onigiri|rice/.test(id)) {
      ip(c, () => { c.beginPath(); c.moveTo(0, -12); c.quadraticCurveTo(12, 8, 0, 11); c.quadraticCurveTo(-12, 8, 0, -12); }, '#f6f1e4');
      ip(c, () => roundRect(c, -5, 2, 10, 9, 1.6), '#2c3a2a', 1.6);
    } else if (/dango/.test(id)) {
      c.rotate(0.6);
      c.strokeStyle = WOOD2; c.lineWidth = 2.4; c.beginPath(); c.moveTo(0, -15); c.lineTo(0, 15); c.stroke();
      [['#f2b8c6', -8], ['#f6f1e4', 0], ['#9eb86a', 8]].forEach(([col2, y]) => ip(c, () => { c.beginPath(); c.arc(0, y, 5.4, 0, U.TAU); }, col2, 1.8));
    } else if (/oden/.test(id)) {
      c.rotate(0.5);
      c.strokeStyle = WOOD2; c.lineWidth = 2.2; c.beginPath(); c.moveTo(0, -15); c.lineTo(0, 14); c.stroke();
      ip(c, () => { c.beginPath(); c.moveTo(-6, -13); c.lineTo(6, -13); c.lineTo(4, -5); c.lineTo(-4, -5); c.closePath(); }, '#e8d3a0', 1.7);
      ip(c, () => { c.beginPath(); c.arc(0, 1, 4.6, 0, U.TAU); }, '#f6f1e4', 1.7);
      ip(c, () => roundRect(c, -5, 7, 10, 7, 2), '#b98a5a', 1.7);
    } else if (/cup/.test(id)) {
      ip(c, () => { c.beginPath(); c.moveTo(-8, -8); c.lineTo(8, -8); c.lineTo(6, 12); c.lineTo(-6, 12); c.closePath(); }, '#f6f1e4');
      c.fillStyle = '#c0392b'; c.fillRect(-7.4, -5, 14.8, 4);
      steam(-3); steam(3);
    } else if (/tea|matcha/.test(id)) {
      ip(c, () => { c.beginPath(); c.moveTo(-8, -4); c.quadraticCurveTo(-8, 10, 0, 10); c.quadraticCurveTo(8, 10, 8, -4); c.closePath(); }, '#7f9e6a');
      c.fillStyle = '#4a6a3a'; c.beginPath(); c.ellipse(0, -4, 8, 2.4, 0, 0, U.TAU); c.fill();
      steam(0);
    } else { // ramen bowl
      ip(c, () => { c.beginPath(); c.moveTo(-12, -2); c.quadraticCurveTo(-11, 12, 0, 12); c.quadraticCurveTo(11, 12, 12, -2); c.closePath(); }, '#c0392b');
      c.fillStyle = '#f6ecd2'; c.beginPath(); c.ellipse(0, -2.4, 11.4, 3.6, 0, 0, U.TAU); c.fill();
      c.strokeStyle = '#d9a35a'; c.lineWidth = 1.5;
      for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 5 - 2, -3.4); c.quadraticCurveTo(i * 5, -1, i * 5 - 1, -1.4); c.stroke(); }
      ip(c, () => { c.beginPath(); c.arc(4, -4, 3, 0, U.TAU); }, '#f2b8c6', 1.4);  // naruto swirl
      c.strokeStyle = '#c0392b'; c.lineWidth = 1.2; c.beginPath(); c.arc(4, -4, 1.2, 0, U.TAU); c.stroke();
      c.strokeStyle = INK; c.lineWidth = 1.6; c.beginPath(); c.moveTo(2, -14); c.lineTo(9, -5); c.moveTo(5, -15); c.lineTo(11, -6); c.stroke(); // chopsticks
      steam(-5);
    }
  }

  return {
    init, resize, setFrameDt, setRain, clear, ambient, drawPetals, setScene,
    pxText, roundRect, paperFill, drawSprite, drawBotSide, drawBotPreview, drawPartIcon, drawFoodIcon, getVisual,
    get ctx() { return ctx; }, get W() { return W; }, get H() { return H; },
  };
})();
