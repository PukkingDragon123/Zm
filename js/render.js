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

  // ---------- spritesheet animation (grids from uploaded art) ----------
  // frame names -> [col,row]. Frames are auto-trimmed to their content box
  // and scaled by ONE per-sheet factor, so poses never float or resize.
  const SHEETS = {
    'char.tanuki': { key: 'sheet.tanuki', cols: 4, rows: 2, anims: { walk: [[0, 0], [1, 0], [2, 0], [3, 0]], idle: [[1, 1], [3, 1]], jump: [[0, 1]], happy: [[2, 1]], talk: [[2, 1], [1, 1]] } },
    'char.kappa': { key: 'sheet.kappa', cols: 4, rows: 2, anims: { walk: [[0, 1], [1, 1]], idle: [[0, 0], [1, 0]], jump: [[3, 1]], happy: [[3, 1]], talk: [[2, 0], [3, 0], [2, 1]] } },
    'glide.tanuki': { key: 'sheet.glide', cols: 3, rows: 1, anims: { glide: [[0, 0], [1, 0], [2, 0]] } },
  };
  // Pre-baked per-frame content boxes (source px) for the uploaded sheets, so
  // the walk animation works WITHOUT reading canvas pixels — getImageData throws
  // on a tainted canvas (opening the game from file://), which used to silently
  // drop the animation. Values were measured once from the art.
  const SHEET_BB = {
    'sheet.tanuki': { fw: 384, fh: 512, refW: 285, refH: 436, bb: { '0,0': { x: 77, y: 76, w: 285, h: 436 }, '1,0': { x: 433, y: 76, w: 279, h: 392 }, '2,0': { x: 779, y: 76, w: 373, h: 393 }, '3,0': { x: 1152, y: 82, w: 248, h: 386 }, '0,1': { x: 77, y: 512, w: 286, h: 346 }, '1,1': { x: 443, y: 537, w: 279, h: 386 }, '2,1': { x: 789, y: 547, w: 363, h: 376 }, '3,1': { x: 1152, y: 571, w: 235, h: 352 } } },
    'sheet.kappa': { fw: 384, fh: 512, refW: 278, refH: 426, bb: { '0,0': { x: 106, y: 76, w: 251, h: 419 }, '1,0': { x: 465, y: 78, w: 243, h: 419 }, '2,0': { x: 787, y: 73, w: 278, h: 426 }, '3,0': { x: 1168, y: 75, w: 274, h: 419 }, '0,1': { x: 87, y: 542, w: 278, h: 403 }, '1,1': { x: 433, y: 543, w: 308, h: 395 }, '2,1': { x: 826, y: 539, w: 326, h: 403 }, '3,1': { x: 1152, y: 542, w: 300, h: 403 } } },
    'sheet.glide': { fw: 629, fh: 512, refW: 436, refH: 500, bb: { '0,0': { x: 97, y: 6, w: 436, h: 500 }, '1,0': { x: 635, y: 29, w: 617, h: 455 }, '2,0': { x: 1335, y: 49, w: 475, h: 415 } } },
  };
  // Per-sheet content bounding boxes. Uses the pre-baked table when available
  // (no pixel read); otherwise measures once, guarded against taint/empty.
  const sheetCache = new Map();
  function sheetInfo(def) {
    const im = Z.assets.img(def.key); if (!im) return null;
    const cached = sheetCache.get(def.key);
    if (cached) return cached.bad ? null : cached;
    const baked = SHEET_BB[def.key];
    if (baked) { const info = { fw: baked.fw, fh: baked.fh, bb: baked.bb, refW: baked.refW, refH: baked.refH }; sheetCache.set(def.key, info); return info; }
    let info;
    try {
      const scv = document.createElement('canvas'); scv.width = im.naturalWidth; scv.height = im.naturalHeight;
      const sc = scv.getContext('2d', { willReadFrequently: true }); sc.drawImage(im, 0, 0);
      const fw = im.naturalWidth / def.cols, fh = im.naturalHeight / def.rows;
      const bb = {}; let refH = 0, refW = 0, found = 0;
      for (let row = 0; row < def.rows; row++) for (let col = 0; col < def.cols; col++) {
        const d = sc.getImageData(col * fw | 0, row * fh | 0, fw | 0, fh | 0).data;   // may throw (taint)
        let minx = fw, miny = fh, maxx = 0, maxy = 0, any = false;
        const W = fw | 0;
        for (let y = 0; y < (fh | 0); y++) for (let x = 0; x < W; x++) {
          if (d[(y * W + x) * 4 + 3] > 24) { any = true; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
        }
        if (!any) { bb[col + ',' + row] = { x: col * fw, y: row * fh, w: fw, h: fh }; continue; }
        found++;
        const bw = maxx - minx + 1, bh = maxy - miny + 1;
        bb[col + ',' + row] = { x: col * fw + minx, y: row * fh + miny, w: bw, h: bh };
        if (bh > refH) { refH = bh; refW = bw; }
      }
      if (!found || refW < 2 || refH < 2) throw new Error('empty sheet');   // nothing readable -> use cutout
      info = { fw, fh, bb, refW, refH };
      sheetCache.set(def.key, info);
    } catch (e) {
      sheetCache.set(def.key, { bad: true });                              // remember: never retry, always cutout
      return null;
    }
    return info;
  }
  const frameCache = new Map();
  // Cutout (cream+ink border) of ONE trimmed frame. `w` = on-screen width of the
  // tallest reference pose; every frame uses the same scale so the body is stable.
  function getSheetFrame(spriteKey, anim, fi, w) {
    const def = SHEETS[spriteKey]; if (!def) return null;
    const im = Z.assets.img(def.key); if (!im) return null;
    const info = sheetInfo(def); if (!info) return null;
    const frames = def.anims[anim] || def.anims.idle; if (!frames || !frames.length) return null;
    const [col, row] = frames[fi % frames.length];
    const bb = info.bb[col + ',' + row]; if (!bb) return null;
    const ck = def.key + '|' + anim + '|' + (fi % frames.length) + '|' + (w | 0);
    let cv = frameCache.get(ck); if (cv) return cv;
    const k = w / info.refW;                                   // one scale for the whole sheet
    const dw = Math.max(2, Math.round(bb.w * k)), dh = Math.max(2, Math.round(bb.h * k));
    const border = Math.max(2.5, dw * 0.045), pad = border + 4;
    cv = document.createElement('canvas'); cv.width = Math.ceil(dw + pad * 2); cv.height = Math.ceil(dh + pad * 2);
    const c = cv.getContext('2d');
    const stamp = (r, target) => { for (let i = 0; i < 16; i++) { const a = i / 16 * U.TAU; target.drawImage(im, bb.x, bb.y, bb.w, bb.h, pad + Math.cos(a) * r, pad + Math.sin(a) * r, dw, dh); } };
    stamp(border, c);
    c.globalCompositeOperation = 'source-in'; c.fillStyle = 'rgba(47,36,24,.9)'; c.fillRect(0, 0, cv.width, cv.height);
    c.globalCompositeOperation = 'source-over';
    const cv2 = document.createElement('canvas'); cv2.width = cv.width; cv2.height = cv.height;
    const c2 = cv2.getContext('2d'); stamp(border - 1.8, c2);
    c2.globalCompositeOperation = 'source-in'; c2.fillStyle = '#f5ecd7'; c2.fillRect(0, 0, cv2.width, cv2.height);
    c.drawImage(cv2, 0, 0);
    c.drawImage(im, bb.x, bb.y, bb.w, bb.h, pad, pad, dw, dh);
    cv._pad = pad; cv._w = dw; cv._h = dh;
    frameCache.set(ck, cv);
    return cv;
  }
  // The tanuki hang-glider (3 poses) — held overhead, so anchor at body centre.
  function drawGlide(x, y, opts) {
    opts = opts || {};
    const w = opts.w || 130, facing = opts.facing == null ? 1 : opts.facing;
    const fi = Math.floor((opts.animT || 0) * 4);
    const fr = getSheetFrame('glide.tanuki', 'glide', fi, w);
    ctx.save();
    ctx.translate(x, y); ctx.rotate(opts.tilt || 0); ctx.scale(facing, 1);
    if (fr) ctx.drawImage(fr, -fr._w / 2 - fr._pad, -fr._h * 0.62 - fr._pad);
    else { ctx.fillStyle = '#7a5a3a'; ctx.fillRect(-18, -30, 36, 44); }
    ctx.restore();
    return !!fr;
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
      let fr = null; try { fr = getSheetFrame(key, opts.anim, fi, w); } catch (e) { fr = null; }
      // anchor the trimmed frame by its OWN width/height so feet sit on groundY
      if (fr) { ctx.drawImage(fr, -fr._w / 2 - fr._pad, -fr._h - fr._pad); drawn = true; }
    }
    if (!drawn) {
      let cut = null; try { cut = getCutout(key, w); } catch (e) { cut = null; }
      if (cut) ctx.drawImage(cut, -w / 2 - cut._pad, -h - cut._pad);
      else ctx.drawImage(im, -w / 2, -h, w, h);          // last resort: raw art, always visible
    }
    ctx.restore();
    return true;
  }

  // =================================================================
  //  SMALL GUNPLA MECH  — panel-shaded metal, booster pack, thrusters,
  //  fluid idle / stride / lunge / flight. (x, groundY) = feet.
  //  anim: {t, moving, wheel, attackT, fly, spin, flip}
  // =================================================================
  function getVisual(spec) {
    const v = spec._vis; if (v) return v;
    const b = spec.build;
    let plate = 0;
    if (b) plate = (b.armor || []).filter(Boolean).length; else plate = U.clamp(Math.round((spec.armor || 0) / 14), 0, 4);
    const corp = !b;                                       // enemies = KANE-CO grunt frames
    const accent = spec.accent || (corp ? '#ff4436' : PAL.spirit);
    // hero mech: bright ceramic armor + accent trim · corp mech: gunmetal + red optics
    const pal = corp
      ? { base: '#79808c', lit: '#9aa2ad', shad: '#4a5058', dark: '#33383f', trim: accent, optic: '#ff5a44' }
      : { base: '#eef1f6', lit: '#ffffff', shad: '#aeb8c6', dark: '#7d8798', trim: accent, optic: '#bdecff' };
    const nv = { plate, weapons: (spec.weapons || []).map((w) => w.type), accent, radius: spec.radius || 40, corp, pal };
    spec._vis = nv; return nv;
  }

  function drawBotSide(x, groundY, facing, spec, anim, opts) {
    opts = opts || {}; anim = anim || {};
    const v = getVisual(spec), P = v.pal;
    const s = (opts.scale || 1) * (v.radius / 40);
    const accent = v.accent, t = anim.t || 0;
    const moving = !!anim.moving, flying = !!anim.fly, atk = anim.attackT || 0;
    const walk = anim.wheel || 0;
    const INK = 'rgba(18,15,12,.9)';

    // ---- beveled metal plate helpers (light from upper-left => 3D read) ----
    function plateRR(bx, by, bw, bh, r, base) {
      roundRect(ctx, bx, by, bw, bh, r); ctx.fillStyle = base; ctx.fill();
      ctx.save(); roundRect(ctx, bx, by, bw, bh, r); ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw - bh * 0.5, by + bh * 0.3); ctx.lineTo(bx, by + bh * 0.42); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(20,22,28,.28)'; ctx.beginPath(); ctx.moveTo(bx + bw, by + bh); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + bw * 0.42, by + bh * 0.64); ctx.lineTo(bx + bw, by + bh * 0.5); ctx.closePath(); ctx.fill();
      ctx.restore();
      roundRect(ctx, bx, by, bw, bh, r); ctx.lineWidth = 1.5 * s; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke();
    }
    function poly(pts, base, opt) {
      opt = opt || {};
      ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
      ctx.fillStyle = base; ctx.fill();
      if (opt.lit) { ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(-100 * s, pts[0][1] - 40 * s, 200 * s, 20 * s); ctx.restore(); }
      ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
      ctx.lineWidth = (opt.lw || 1.5) * s; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke();
    }
    function glow(cx, cy, r, col, a) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, r); g.addColorStop(0, U.rgba(col, a)); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, U.TAU); ctx.fill(); ctx.restore();
    }

    // proportions
    const legH = 26 * s, torsoW = 30 * s, torsoH = 30 * s, headW = 20 * s, headH = 17 * s;
    const hover = flying ? Math.sin(t * 3.4) * 3.5 * s : 0;
    const hop = flying ? 0 : (moving ? Math.abs(Math.sin(walk * 3)) * 6 * s : Math.sin(t * 2.4) * 2 * s);
    const lift = flying ? 30 * s : 0;                     // whole mech rises when flying
    const baseY = groundY - lift + hover;
    const lean = (atk > 0 ? 0.18 * (1 - atk) : 0) + (moving ? 0.05 : 0) + (flying ? 0.1 : 0);
    const hipY = baseY - legH - hop;
    const chestY = hipY - torsoH;
    const thrust = flying ? 1 : (atk > 0 ? 0.5 : 0.12 + 0.06 * Math.sin(t * 9));   // booster intensity

    // ground shadow (shrinks + fades with altitude; never a negative radius)
    ctx.save(); ctx.globalAlpha = Math.max(0, 0.3 * (1 - lift / (40 * s))); ctx.fillStyle = '#12100c';
    const shR = Math.max(0.5, torsoW * (0.85 - lift / (120 * s)));
    ctx.beginPath(); ctx.ellipse(x, groundY + 3, shR, 5.5 * s, 0, 0, U.TAU); ctx.fill(); ctx.restore();

    ctx.save();
    ctx.translate(x, 0); ctx.scale(facing, 1); ctx.rotate(lean * 0.35);
    const step = moving ? Math.sin(walk * 3) : Math.sin(t * 2.2) * 0.1;

    // ================= BACKPACK / BOOSTER (behind everything) =================
    (function booster() {
      const bx = -torsoW * 0.5, by = chestY + 3 * s;
      plateRR(bx - 7 * s, by, 12 * s, torsoH * 0.72, 3 * s, P.shad);
      // two thruster nozzles
      for (let i = 0; i < 2; i++) {
        const ny = by + torsoH * (0.2 + i * 0.42);
        poly([[bx - 3 * s, ny], [bx - 3 * s, ny + 7 * s], [bx - 9 * s, ny + 10 * s], [bx - 9 * s, ny - 3 * s]], P.dark);
        // flame
        const fl = thrust * (0.7 + 0.3 * Math.sin(t * 30 + i));
        if (fl > 0.05) {
          glow(bx - 9 * s, ny + 3.5 * s, 13 * s * fl, accent, 0.6 * fl);
          ctx.fillStyle = U.rgba(accent, 0.9);
          ctx.beginPath(); ctx.moveTo(bx - 8 * s, ny - 1 * s); ctx.lineTo(bx - 9 * s - 22 * s * fl, ny + 3.5 * s); ctx.lineTo(bx - 8 * s, ny + 8 * s); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.9)';
          ctx.beginPath(); ctx.moveTo(bx - 8 * s, ny + 1 * s); ctx.lineTo(bx - 9 * s - 11 * s * fl, ny + 3.5 * s); ctx.lineTo(bx - 8 * s, ny + 6 * s); ctx.closePath(); ctx.fill();
        }
      }
    })();

    // back limbs
    drawArm(-step, -1, false, true);
    drawLeg(-step, true);

    // ================= TORSO =================
    // waist / hip block
    plateRR(-torsoW * 0.4, hipY - 8 * s, torsoW * 0.8, 12 * s, 3 * s, P.shad);
    // chest
    plateRR(-torsoW / 2, chestY, torsoW, torsoH * 0.72, 6 * s, P.base);
    // collar / neck vents
    poly([[-torsoW * 0.34, chestY + 2 * s], [torsoW * 0.34, chestY + 2 * s], [torsoW * 0.26, chestY + 8 * s], [-torsoW * 0.26, chestY + 8 * s]], P.dark);
    // side intake vents
    ctx.strokeStyle = 'rgba(20,20,26,.5)'; ctx.lineWidth = 1.3 * s;
    for (let i = 0; i < 3; i++) { const vy = chestY + torsoH * (0.26 + i * 0.12); ctx.beginPath(); ctx.moveTo(torsoW * 0.3, vy); ctx.lineTo(torsoW * 0.44, vy); ctx.stroke(); }
    // cockpit core (glowing)
    const cy = chestY + torsoH * 0.34, pulse = 0.7 + 0.3 * Math.sin(t * 5);
    glow(0, cy, 12 * s, accent, 0.7 * pulse);
    poly([[-5 * s, cy - 6 * s], [5 * s, cy - 6 * s], [6.5 * s, cy], [5 * s, cy + 6 * s], [-5 * s, cy + 6 * s], [-6.5 * s, cy]], accent);
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(-1.5 * s, cy - 1.5 * s, 2 * s, 0, U.TAU); ctx.fill();
    // extra armor plates by plate level (layered on the chest)
    for (let i = 0; i < Math.min(v.plate, 3); i++) {
      plateRR(torsoW * 0.16 + i * 4 * s, chestY + 4 * s, 5 * s, torsoH * 0.5, 2 * s, P.trim === accent ? P.dark : P.trim);
    }

    // front leg over torso base
    drawLeg(step, false);

    // ================= SHOULDER (front pauldron) =================
    plateRR(torsoW * 0.28, chestY + 1 * s, 14 * s, 13 * s, 4 * s, P.base);
    poly([[torsoW * 0.3, chestY + 2 * s], [torsoW * 0.3 + 12 * s, chestY + 2 * s], [torsoW * 0.3 + 9 * s, chestY + 6 * s], [torsoW * 0.3, chestY + 6 * s]], P.trim === accent ? accent : P.trim, { lw: 1.2 });

    // ================= HEAD =================
    const headBob = Math.sin(t * 2.8 + 0.6) * 1.2 * s + (moving ? Math.abs(Math.sin(walk * 3 + 0.5)) * 1.6 * s : 0);
    const hy = chestY - headH - 1 * s - headBob;
    plateRR(-headW / 2, hy, headW, headH, 4 * s, P.base);
    // cheek guards
    poly([[-headW / 2, hy + headH * 0.4], [-headW / 2 - 3 * s, hy + headH * 0.55], [-headW / 2, hy + headH * 0.9]], P.shad);
    poly([[headW / 2, hy + headH * 0.4], [headW / 2 + 3 * s, hy + headH * 0.55], [headW / 2, hy + headH * 0.9]], P.shad);
    // visor (single wide optic band, glowing)
    const vy = hy + headH * 0.5;
    glow(0, vy, 7 * s, P.optic, 0.55);
    poly([[-headW * 0.42, vy - 2.4 * s], [headW * 0.42, vy - 2.4 * s], [headW * 0.36, vy + 2.4 * s], [-headW * 0.36, vy + 2.4 * s]], P.optic, { lw: 1.2 });
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(headW * 0.1, vy - 1.6 * s, headW * 0.16, 1.6 * s);
    // V-fin crest
    ctx.save(); ctx.translate(0, hy);
    poly([[-1.5 * s, 0], [-9 * s, -8 * s], [-6 * s, -8.5 * s], [-1 * s, -2 * s]], accent, { lw: 1.2 });
    poly([[1.5 * s, 0], [9 * s, -8 * s], [6 * s, -8.5 * s], [1 * s, -2 * s]], accent, { lw: 1.2 });
    ctx.fillStyle = accent; ctx.fillRect(-1.6 * s, -3 * s, 3.2 * s, 3 * s);
    // forehead sensor gem
    ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(0, 3 * s, 1.7 * s, 0, U.TAU); ctx.fill();
    ctx.restore();

    // ================= FRONT ARM + WEAPON =================
    drawArm(step, 1, true, false);

    // damage sparks + hit flash
    const hp = opts.hpFrac == null ? 1 : opts.hpFrac;
    if (hp < 0.5) {
      ctx.strokeStyle = 'rgba(20,16,12,.7)'; ctx.lineWidth = 1.6 * s;
      ctx.beginPath(); ctx.moveTo(-torsoW * 0.28, chestY + 5 * s); ctx.lineTo(-torsoW * 0.1, chestY + 12 * s); ctx.lineTo(-torsoW * 0.24, chestY + 18 * s); ctx.stroke();
      if (Math.sin(t * 22) > 0.6) glow(-torsoW * 0.16, chestY + 12 * s, 6 * s, '#ffcf6a', 0.7);
    }
    if (opts.flash) {
      ctx.save(); ctx.globalAlpha = opts.flash; ctx.globalCompositeOperation = 'lighter';
      roundRect(ctx, -torsoW * 0.7, hy, torsoW * 1.4, groundY - hy, 8 * s); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
    }
    ctx.restore();

    // ---- limbs ----
    function drawLeg(ph, back) {
      const col = back ? P.shad : P.base, colD = back ? P.dark : P.shad;
      const swing = ph * (moving ? 9 : 1.5) * s;
      const legLift = flying ? 10 * s : Math.max(0, ph) * (moving ? 6 : 0) * s;
      const hipX = 0, kneeX = swing, kneeY = hipY + legH * 0.5 - legLift * 0.5;
      const footX = swing * 1.5, footY = baseY - legLift + (flying ? 6 * s : 0);
      // thigh
      poly([[hipX - 4.5 * s, hipY - 2 * s], [hipX + 4.5 * s, hipY - 2 * s], [kneeX + 4 * s, kneeY], [kneeX - 4 * s, kneeY]], col);
      // knee
      plateRR(kneeX - 4 * s, kneeY - 3 * s, 8 * s, 7 * s, 2.5 * s, colD);
      // shin
      poly([[kneeX - 3.6 * s, kneeY], [kneeX + 3.6 * s, kneeY], [footX + 3.4 * s, footY - 5 * s], [footX - 3.4 * s, footY - 5 * s]], col);
      // thruster foot
      plateRR(footX - 6 * s, footY - 5 * s, 13 * s, 6 * s, 2 * s, colD);
      if (flying) { const fl = 0.6 + 0.3 * Math.sin(t * 26 + (back ? 1 : 0)); glow(footX, footY + 1 * s, 9 * s * fl, accent, 0.4 * fl); ctx.fillStyle = U.rgba(accent, 0.8); ctx.beginPath(); ctx.moveTo(footX - 3 * s, footY); ctx.lineTo(footX, footY + 12 * s * fl); ctx.lineTo(footX + 3 * s, footY); ctx.closePath(); ctx.fill(); }
    }
    function drawArm(ph, side, withWeapon, back) {
      const col = back ? P.shad : P.base, colD = back ? P.dark : P.shad;
      const baseAng = withWeapon ? -0.35 : 0.4;
      let aAng = baseAng + ph * 0.45 * side;
      if (withWeapon && atk > 0) aAng = -1.7 + (1 - atk) * 2.6;      // wind-up -> swing
      if (flying && withWeapon) aAng = -0.15;
      const shX = side * torsoW * 0.34, shY = chestY + torsoH * 0.18;
      const elX = shX + Math.cos(aAng) * 12 * s * side, elY = shY + Math.sin(aAng) * 12 * s + 5 * s;
      const haX = elX + Math.cos(aAng + 0.3) * 11 * s * side, haY = elY + Math.sin(aAng + 0.3) * 11 * s + 3 * s;
      // shoulder pauldron
      plateRR(shX - 5 * s * side - 5 * s, shY - 6 * s, 12 * s, 12 * s, 3.5 * s, col);
      // upper arm
      ctx.strokeStyle = INK; ctx.lineWidth = 8.5 * s; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(shX, shY); ctx.lineTo(elX, elY); ctx.stroke();
      ctx.strokeStyle = colD; ctx.lineWidth = 6 * s; ctx.beginPath(); ctx.moveTo(shX, shY); ctx.lineTo(elX, elY); ctx.stroke();
      // forearm
      ctx.strokeStyle = INK; ctx.lineWidth = 8.5 * s; ctx.beginPath(); ctx.moveTo(elX, elY); ctx.lineTo(haX, haY); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 6 * s; ctx.beginPath(); ctx.moveTo(elX, elY); ctx.lineTo(haX, haY); ctx.stroke();
      // fist
      plateRR(haX - 3.5 * s, haY - 3.5 * s, 7 * s, 7 * s, 2 * s, colD);
      if (withWeapon && v.weapons.length) drawWeapon(v.weapons[0], haX, haY, aAng);
    }
    function drawWeapon(type, hx, hy2, aAng) {
      ctx.save(); ctx.translate(hx, hy2);
      if (type === 'spinner') {                            // gatling / vulcan
        ctx.rotate(-0.1);
        plateRR(0, -6 * s, 26 * s, 12 * s, 3 * s, P.dark);
        ctx.save(); ctx.translate(6 * s, 0); ctx.rotate(anim.spin || 0);
        for (let i = 0; i < 5; i++) { const a = i / 5 * U.TAU; ctx.fillStyle = i % 2 ? '#8a929c' : '#5a616b'; ctx.beginPath(); ctx.arc(Math.cos(a) * 4 * s, Math.sin(a) * 4 * s, 2.2 * s, 0, U.TAU); ctx.fill(); }
        ctx.restore();
        ctx.fillStyle = P.shad; ctx.fillRect(20 * s, -3 * s, 10 * s, 6 * s);
        if (atk > 0) { glow(30 * s, 0, 8 * s, '#ffd66a', 0.8); }
      } else if (type === 'hammer') {                      // heat maul
        ctx.rotate(aAng * 0.35 + 0.5);
        ctx.strokeStyle = INK; ctx.lineWidth = 6 * s; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(20 * s, -8 * s); ctx.stroke();
        ctx.strokeStyle = P.shad; ctx.lineWidth = 4 * s; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(20 * s, -8 * s); ctx.stroke();
        plateRR(15 * s, -22 * s, 15 * s, 18 * s, 3 * s, P.base);
        ctx.fillStyle = U.rgba(accent, 0.5 + 0.5 * Math.abs(Math.sin(t * 4))); ctx.fillRect(17 * s, -20 * s, 3 * s, 14 * s);
      } else if (type === 'flipper') {                     // energy shield
        ctx.rotate(-(anim.flip || 0) * 0.8 + 0.1);
        plateRR(2 * s, -14 * s, 9 * s, 28 * s, 4 * s, P.base);
        ctx.strokeStyle = accent; ctx.lineWidth = 2 * s; ctx.strokeRect(4 * s, -10 * s, 5 * s, 20 * s);
        glow(6 * s, 0, 10 * s, accent, 0.3);
      } else if (type === 'flamer') {                      // beam cannon
        plateRR(0, -5 * s, 22 * s, 11 * s, 3 * s, P.dark);
        plateRR(4 * s, -4 * s, 8 * s, 9 * s, 2 * s, P.shad);
        const em = 0.5 + 0.5 * Math.abs(Math.sin(t * 6));
        glow(24 * s, 0, 9 * s, accent, 0.5 + em * 0.4);
        ctx.fillStyle = U.rgba(accent, 0.9); ctx.beginPath(); ctx.arc(22 * s, 0, 3.4 * s, 0, U.TAU); ctx.fill();
        if (atk > 0) { ctx.fillStyle = U.rgba(accent, 0.8); ctx.fillRect(24 * s, -2.4 * s, 40 * s, 4.8 * s); ctx.fillStyle = '#fff'; ctx.fillRect(24 * s, -1 * s, 40 * s, 2 * s); }
      } else {                                             // beam saber (blade)
        ctx.rotate(aAng * 0.3);
        // hilt
        plateRR(0, -2.6 * s, 8 * s, 5 * s, 1.6 * s, P.dark);
        // energy blade
        const blen = 30 * s;
        glow(8 * s + blen * 0.5, 0, 10 * s, accent, 0.6);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = U.rgba(accent, 0.85); ctx.beginPath(); ctx.moveTo(8 * s, -3.2 * s); ctx.lineTo(8 * s + blen, -1 * s); ctx.lineTo(8 * s + blen + 4 * s, 0); ctx.lineTo(8 * s + blen, 1 * s); ctx.lineTo(8 * s, 3.2 * s); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.beginPath(); ctx.moveTo(8 * s, -1.4 * s); ctx.lineTo(8 * s + blen, 0); ctx.lineTo(8 * s, 1.4 * s); ctx.closePath(); ctx.fill();
        ctx.restore();
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
    pxText, roundRect, paperFill, drawSprite, drawGlide, drawBotSide, drawBotPreview, drawPartIcon, drawFoodIcon, getVisual,
    get ctx() { return ctx; }, get W() { return W; }, get H() { return H; },
  };
})();
