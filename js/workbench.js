/* ================================================================
   workbench.js — YOUR DEN as a fully diegetic canvas scene.
   The spirit puppet stands on the bench under a warm lamp; a
   wooden gear box holds your spare parts. Tap a plank tab to open
   the box, drag a paper tile onto a rune socket, then tighten the
   two screws (drag circles around them, or tap five times) to
   bolt the part in for real. Tap a bolted part twice to unbolt.
   No chrome UI — only the bench-hud readout DOM stays.
   ================================================================ */
Z.workbench = (function () {
  const U = Z.util, $ = U.$, D = Z.data, PAL = D.PAL;
  const TURNS = 2.5;                                   // clockwise turns per screw
  const CATS = [
    ['chassis', 'FRAME'], ['generator', 'RUNE'], ['motor', 'MOTOR'], ['wheels', 'GETA'],
    ['weapon', 'WEAPON'], ['armor', 'ARMOR'], ['utility', 'CHARM'],
  ];
  const LABEL = {}; CATS.forEach(([k, l]) => (LABEL[k] = l));

  let overlay = null;                                  // invisible pointer catcher
  let W = 0, H = 0, benchY = 0, groundY = 0, px = 0, tabsTop = 0;
  let comp = null, slots = [], tabs = [], tiles = [], arrows = [], crate = { x: 0, y: 0, w: 0, h: 0 };
  let lid = 0, openCat = null, lastCat = null, page = 0, pages = 1, visN = 6, catList = [];
  let drag = null, loose = null, screwing = null, pendingUn = null, unbolt = null;
  let flying = [], opened = false;
  const icons = new Map();

  // ---- build helpers (state behavior identical to the old bench) ----
  function slotVal(s) {
    const b = Z.state.build;
    if (s.cat === 'chassis') return b.chassis;
    if (s.cat === 'generator' || s.cat === 'motor' || s.cat === 'wheels') return b[s.cat];
    return (b[s.cat] || [])[s.index];
  }
  function setSlot(s, id) {
    const b = Z.state.build;
    if (s.cat === 'generator' || s.cat === 'motor' || s.cat === 'wheels') b[s.cat] = id;
    else b[s.cat][s.index] = id;
  }
  function swapChassis(id) {
    if (Z.state.build.chassis === id) return false;
    if (Z.state.availableCount(id) < 1) { Z.audio.sfx.error(); return false; }
    const ob = Z.state.build, nch = D.chassisById(id);
    const nb = { chassis: id, generator: ob.generator, motor: ob.motor, wheels: ob.wheels, weapon: [], armor: [], utility: [] };
    ['weapon', 'armor', 'utility'].forEach((k) => { nb[k] = new Array(nch.slots[k]).fill(null); for (let i = 0; i < nch.slots[k] && i < (ob[k] || []).length; i++) nb[k][i] = ob[k][i]; });
    Z.state.build = nb; Z.state.persist();
    return true;
  }

  // ---- readout DOM (same format as the old bench) ----
  function readout() {
    const c = Z.Bot.compute(Z.state.build), sp = c.spec, agg = c.agg;
    const el = $('#benchReadout'); if (!el) return;
    const over = sp.overdraw;
    el.innerHTML = `HP <b>${Math.round(sp.maxHp)}</b> · PWR <b>${Math.round(sp.power)}</b> · SPD <b>${Math.round(sp.speedStat)}</b><br>` +
      `GRIP <b>${Math.round(sp.tractionStat)}</b> · ARM <b>${sp.armor}%</b> · WT <b>${Math.round(sp.mass)}</b><br>` +
      `<span class="${over ? 'over' : ''}">PWR ${agg.energyDraw}/${agg.energyProvide}${over ? ' OVERDRAWN' : ''}</span> · RATING <b>${sp.rating}</b>` +
      (c.ready ? '' : ' · <span class="over">NEEDS WHEEL+SANDALS</span>');
  }

  // ---- part icon cache (offscreen canvases via Z.render.drawPartIcon) ----
  function icon(it) {
    let cv = icons.get(it.id);
    if (!cv) { cv = document.createElement('canvas'); Z.render.drawPartIcon(cv, it); icons.set(it.id, cv); }
    return cv;
  }

  // ---- gear box contents ----
  function refreshCat() {
    catList = [];
    if (openCat) {
      Object.keys(Z.state.inventory).forEach((id) => {
        const it = D.itemById(id); if (!it) return;
        const cat = it.slots ? 'chassis' : it.category;
        if (cat !== openCat) return;
        const n = Z.state.availableCount(id);
        if (n > 0) catList.push({ it, avail: n, a: 1 });
      });
      catList.sort((a, b) => D.rarityRank(b.it.rarity) - D.rarityRank(a.it.rarity));
    }
    pages = Math.max(1, Math.ceil(catList.length / Math.max(1, visN)));
    if (page >= pages) page = pages - 1;
    stagger();
  }
  function stagger() {
    const st = page * visN;
    catList.forEach((en, i) => { en.a = (i >= st && i < st + visN) ? -((i - st) * 0.05) : 1; en.avail = Z.state.availableCount(en.it.id); });
  }

  // ---- layout (recomputed every frame; everything responsive) ----
  function layout() {
    W = Z.render.W; H = Z.render.H;
    benchY = Math.max(H * 0.44, Math.min(H * 0.68, H - 236));
    groundY = benchY + Math.min(30, H * 0.05);
    px = W * 0.36;
    const spec = comp.spec, scale = Math.min(W, H) / 520 + 0.6, s = scale * (spec.radius / 40);
    const legH = 24 * s, torsoW = 33 * s, torsoH = 30 * s;
    const hipY = groundY - legH, chestY = hipY - torsoH;
    const ch = D.chassisById(Z.state.build.chassis);
    slots.length = 0;
    const add = (cat, index, x, y) => slots.push({ cat, index, x, y });
    add('chassis', 0, px, chestY + torsoH * 0.6);
    add('generator', 0, px, chestY + torsoH * 0.34);
    add('motor', 0, px, hipY + 4);
    add('wheels', 0, px + torsoW * 0.6, groundY + 4);
    for (let i = 0; i < ch.slots.weapon; i++) add('weapon', i, px + torsoW * 1.3, chestY - 4 + i * 46);
    for (let i = 0; i < ch.slots.armor; i++) add('armor', i, px - torsoW * 1.25, chestY + torsoH * 0.05 - i * 44);
    for (let i = 0; i < ch.slots.utility; i++) add('utility', i, px - torsoW * 0.65 - i * 46, hipY + 30);
    // gear box crate, bottom-right
    const cw = U.clamp(W * 0.17, 132, 186), chh = U.clamp(H * 0.15, 78, 112);
    crate = { x: W - cw - 20, y: H - chh - 16, w: cw, h: chh };
    // plank tabs above the crate (right-aligned, wrap on narrow screens)
    tabs.length = 0;
    const tw = 62, th = 26, tg = 6;
    const per = Math.max(3, Math.min(CATS.length, (Math.min(W - 32, 520) / (tw + tg)) | 0));
    const rows = Math.ceil(CATS.length / per);
    CATS.forEach(([k, l], i) => {
      const r = (i / per) | 0, ci = i % per, inRow = Math.min(per, CATS.length - r * per);
      const x0 = W - 20 - (inRow * (tw + tg) - tg);
      tabs.push({ cat: k, label: l, x: x0 + ci * (tw + tg), y: crate.y - 8 - (rows - r) * (th + 7), w: tw, h: th });
    });
    tabsTop = crate.y - 8 - rows * (th + 7);
    // tile row that slides out of the crate, above the tabs
    const ts = W < 620 ? 52 : 60, tg2 = 10;
    visN = U.clamp(((W - 40 - 86) / (ts + tg2)) | 0, 2, 6);
    pages = Math.max(1, Math.ceil(catList.length / visN));
    if (page >= pages) page = pages - 1;
    tiles.length = 0;
    const rowY = tabsTop - ts - 10, right = W - 20;
    catList.slice(page * visN, page * visN + visN).forEach((en, j) => {
      tiles.push({ en, x: right - ts - j * (ts + tg2), y: rowY, w: ts, h: ts });
    });
    arrows.length = 0;
    if (openCat && pages > 1) {
      const ax = right - visN * (ts + tg2) - 26, ay = rowY + ts / 2;
      arrows.push({ dir: -1, x: ax - 42, y: ay });
      arrows.push({ dir: 1, x: ax, y: ay });
    }
  }
  function slotXY(cat, index) { for (const s of slots) if (s.cat === cat && s.index === index) return s; return null; }

  // ---- drop targets ----
  function validFor(cat) {
    return slots.filter((s) => {
      if (s.cat !== cat) return false;
      if (cat === 'chassis' || cat === 'generator' || cat === 'motor' || cat === 'wheels') return true;
      return !slotVal(s);
    });
  }
  function nearestValid(cat, x, y, rad) {
    let best = null, bd = 1e9;
    for (const s of validFor(cat)) {
      const d = Math.hypot(x - s.x, y - s.y), r = s.cat === 'chassis' ? rad + 26 : rad;
      if (d < r && d < bd) { bd = d; best = s; }
    }
    return best;
  }
  function tapSlot(p) {
    let best = null, bd = 34;
    for (const s of slots) {
      if (s.cat === 'chassis' || !slotVal(s)) continue;
      if (loose && loose.cat === s.cat && loose.index === s.index) continue;
      const d = Math.hypot(p.x - s.x, p.y - s.y);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  // ---- seating + screws ----
  function seat(item, s) {
    if (loose) { const os = slotXY(loose.cat, loose.index); flyBack(loose.item, os ? os.x : px, os ? os.y : groundY); }
    loose = {
      item, cat: s.cat, index: s.index, doneT: null,
      tilt: (Math.random() < 0.5 ? -1 : 1) * U.rand(0.08, 0.14),
      screws: [{ dx: -26, dy: -26, sum: 0, turn: 0, done: false }, { dx: 26, dy: 26, sum: 0, turn: 0, done: false }],
    };
    pendingUn = null;
    Z.audio.sfx.hit(0.6);
    Z.fx.dust(s.x, s.y + 14, 6, '#8f7845');
  }
  function addTurn(sc, delta) {
    if (sc.done) return;
    sc.sum = Math.max(0, sc.sum + delta);
    const nt = (sc.sum / U.TAU) | 0;
    if (nt > sc.turn) {
      sc.turn = nt; Z.audio.sfx.click();
      if (loose) { const s = slotXY(loose.cat, loose.index); if (s) Z.fx.dust(s.x + sc.dx, s.y + sc.dy, 2, '#6e5335'); }
    }
    if (sc.sum >= TURNS * U.TAU) {
      sc.done = true; sc.sum = TURNS * U.TAU; Z.audio.sfx.coin();
      if (loose && loose.screws.every((x) => x.done)) loose.doneT = 0;
    }
  }
  function completeLoose() {
    const L = loose; loose = null; screwing = null;
    const s = slotXY(L.cat, L.index) || { x: px, y: groundY - 40 };
    let ok = true;
    if (L.cat === 'chassis') ok = swapChassis(L.item.id);
    else if (Z.state.availableCount(L.item.id) < 1) { Z.audio.sfx.error(); ok = false; }
    else { setSlot(L, L.item.id); Z.state.persist(); }
    if (ok) {
      Z.audio.sfx.buy();
      Z.fx.ring(s.x, s.y, '#ffd98a', 8, 46, 0.3);
      Z.fx.sparks(s.x, s.y, -Math.PI / 2, 12, '#ffe9b0', Math.PI, 220);
      Z.fx.screenFlash(0.16, '#fff6df');
    }
    readout(); refreshCat();
  }

  // ---- unbolt ----
  function startUnbolt(s) {
    const id = slotVal(s); if (!id) return;
    unbolt = { cat: s.cat, index: s.index, item: D.itemById(id), t: 0, dur: 0.45 };
    Z.audio.sfx.click();
  }
  function finishUnbolt() {
    const ub = unbolt; unbolt = null;
    const s = slotXY(ub.cat, ub.index) || { x: px, y: groundY - 40 };
    setSlot(ub, null); Z.state.persist(); readout();
    Z.audio.sfx.flip();
    Z.fx.dust(s.x, s.y, 5, '#8f7845');
    flyBack(ub.item, s.x, s.y, refreshCat);
  }
  function flyBack(item, x, y, onEnd) { flying.push({ item, x0: x, y0: y, t: 0, dur: 0.55, rot: U.rand(-0.4, 0.4), onEnd }); }

  // ---- pointer input (single pointer, touch friendly) ----
  function ensure() {
    if (overlay) return;
    overlay = U.el('div');
    overlay.style.cssText = 'position:absolute;inset:0;touch-action:none;z-index:0';
    const scr = document.querySelector('[data-screen=workbench]');
    scr.insertBefore(overlay, scr.firstChild);
    overlay.addEventListener('pointerdown', onDown);
    overlay.addEventListener('pointermove', onMove);
    overlay.addEventListener('pointerup', onUp);
    overlay.addEventListener('pointercancel', onCancel);
  }
  function pt(e) { return { x: e.clientX, y: e.clientY }; }
  function onDown(e) {
    if (Z.cutscene && Z.cutscene.active) return;
    e.preventDefault();
    if (Z.audio) Z.audio.resume();
    try { overlay.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
    const p = pt(e);
    // 1) grab a screw of the loose part
    if (loose && loose.doneT == null) {
      const s = slotXY(loose.cat, loose.index);
      if (s) for (const sc of loose.screws) {
        if (sc.done) continue;
        const sx = s.x + sc.dx, sy = s.y + sc.dy;
        if (Math.hypot(p.x - sx, p.y - sy) < 30) {
          screwing = { sc, last: Math.atan2(p.y - sy, p.x - sx), moved: 0, px: p.x, py: p.y, t0: performance.now() };
          return;
        }
      }
    }
    // 2) plank tabs
    for (const tb of tabs) {
      if (p.x > tb.x - 4 && p.x < tb.x + tb.w + 4 && p.y > tb.y - 8 && p.y < tb.y + tb.h + 8) {
        Z.audio.sfx.click(); opened = true;
        if (openCat === tb.cat) openCat = null;
        else { openCat = lastCat = tb.cat; page = 0; refreshCat(); }
        return;
      }
    }
    // 3) page arrows
    for (const ar of arrows) {
      if (Math.hypot(p.x - ar.x, p.y - ar.y) < 20) {
        const np = U.clamp(page + ar.dir, 0, pages - 1);
        if (np !== page) { page = np; Z.audio.sfx.click(); stagger(); } else Z.audio.sfx.hover();
        return;
      }
    }
    // 4) lift a tile out of the box
    for (const tl of tiles) {
      if (p.x > tl.x - 5 && p.x < tl.x + tl.w + 5 && p.y > tl.y - 5 && p.y < tl.y + tl.h + 5) {
        const it = tl.en.it;
        drag = { item: it, cat: it.slots ? 'chassis' : it.category, srcId: it.id, x: tl.x + tl.w / 2, y: tl.y + tl.h / 2, tx: p.x, ty: p.y, vx: 0, rot: 0 };
        Z.audio.sfx.click();
        return;
      }
    }
    // 5) tap the crate itself
    if (p.x > crate.x && p.x < crate.x + crate.w && p.y > crate.y - 14 && p.y < crate.y + crate.h) {
      Z.audio.sfx.click(); opened = true;
      if (openCat) openCat = null; else { openCat = lastCat || 'weapon'; page = 0; refreshCat(); }
      return;
    }
    // 6) tap a bolted part -> UNBOLT? tag, second tap unbolts
    const s = tapSlot(p);
    if (s) {
      if (pendingUn && pendingUn.cat === s.cat && pendingUn.index === s.index) { startUnbolt(s); pendingUn = null; }
      else { pendingUn = { cat: s.cat, index: s.index, t: 1.2 }; Z.audio.sfx.hover(); }
      return;
    }
    pendingUn = null;
  }
  function onMove(e) {
    const p = pt(e);
    if (screwing && loose) {
      const s = slotXY(loose.cat, loose.index);
      if (s) {
        const sx = s.x + screwing.sc.dx, sy = s.y + screwing.sc.dy;
        screwing.moved += Math.abs(p.x - screwing.px) + Math.abs(p.y - screwing.py);
        screwing.px = p.x; screwing.py = p.y;
        const dx = p.x - sx, dy = p.y - sy, a = Math.atan2(dy, dx);
        if (Math.hypot(dx, dy) > 9) addTurn(screwing.sc, U.angDiff(screwing.last, a));
        screwing.last = a;
      }
      return;
    }
    if (drag) { drag.tx = p.x; drag.ty = p.y; }
  }
  function onUp() {
    if (screwing) {
      const sc = screwing.sc, quick = screwing.moved < 14 && performance.now() - screwing.t0 < 320;
      screwing = null;
      if (quick) addTurn(sc, Math.PI);          // accessibility: 5 quick taps = tight
      return;
    }
    if (!drag) return;
    const d = drag; drag = null;
    const s = nearestValid(d.cat, d.tx, d.ty, 58);
    if (s && !(d.cat === 'chassis' && d.item.id === Z.state.build.chassis)) seat(d.item, s);
    else { Z.audio.sfx.back(); flyBack(d.item, d.x, d.y); }
  }
  function onCancel() {
    if (drag) { const d = drag; drag = null; flyBack(d.item, d.x, d.y); }
    screwing = null;
  }

  // ================= frame (called by game loop) =================
  function frame(dt, t) {
    const ctx = Z.render.ctx; if (!ctx) return;
    comp = Z.Bot.compute(Z.state.build);
    layout();
    // advance timers
    lid += ((openCat ? 1 : 0) - lid) * Math.min(1, dt * 9);
    if (pendingUn) { pendingUn.t -= dt; if (pendingUn.t <= 0) pendingUn = null; }
    if (unbolt) { unbolt.t += dt; if (unbolt.t >= unbolt.dur) finishUnbolt(); }
    if (loose && loose.doneT != null) { loose.doneT += dt; if (loose.doneT >= 0.22) completeLoose(); }
    catList.forEach((en) => { en.a += dt; });
    for (let i = flying.length - 1; i >= 0; i--) {
      const f = flying[i]; f.t += dt;
      if (f.t >= f.dur) { const cb = f.onEnd; flying.splice(i, 1); if (cb) cb(); }
    }
    if (drag) {
      const k = 1 - Math.exp(-14 * dt);          // springy lag toward the pointer
      const nx = drag.x + (drag.tx - drag.x) * k, ny = drag.y + (drag.ty - drag.y) * k;
      drag.vx = (nx - drag.x) / Math.max(dt, 0.001);
      drag.x = nx; drag.y = ny;
      const targ = U.clamp(drag.vx * 0.00085, -0.34, 0.34);
      drag.rot += (targ - drag.rot) * Math.min(1, dt * 10);
    }
    draw(ctx, t);
  }

  // ================= drawing =================
  function draw(ctx, t) {
    // --- den interior wash over the ambient art ---
    ctx.fillStyle = 'rgba(24,16,9,.55)'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(245,236,215,.04)'; ctx.lineWidth = 2;
    for (let x = 48; x < W; x += 96) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, benchY); ctx.stroke(); }

    // --- hanging lamp + warm pool of light over the puppet ---
    const ly = Math.max(88, H * 0.15);
    ctx.strokeStyle = 'rgba(18,11,6,.85)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, ly); ctx.stroke();
    Z.render.paperFill(ctx, () => {
      ctx.beginPath(); ctx.moveTo(px - 26, ly + 18); ctx.lineTo(px - 10, ly); ctx.lineTo(px + 10, ly); ctx.lineTo(px + 26, ly + 18); ctx.closePath();
    }, '#3f2f1c', { cut: 3 });
    ctx.fillStyle = '#ffd98a'; ctx.beginPath(); ctx.arc(px, ly + 21, 5, 0, U.TAU); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const flick = 0.16 + Math.sin(t * 2.1) * 0.015;
    const lg = ctx.createRadialGradient(px, groundY - 70, 24, px, groundY - 70, Math.max(W, H) * 0.42);
    lg.addColorStop(0, U.rgba('#ffcd82', flick)); lg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // --- wooden bench across the lower third ---
    const fg = ctx.createLinearGradient(0, benchY + 28, 0, H);
    fg.addColorStop(0, '#4a3722'); fg.addColorStop(1, '#33250f');
    ctx.fillStyle = fg; ctx.fillRect(0, benchY + 28, W, H - benchY - 28);
    ctx.fillStyle = '#7d6040'; ctx.fillRect(0, benchY, W, 28);
    ctx.fillStyle = 'rgba(245,236,215,.10)'; ctx.fillRect(0, benchY, W, 3);
    ctx.strokeStyle = 'rgba(35,22,10,.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, benchY + 28); ctx.lineTo(W, benchY + 28); ctx.stroke();
    // front planks: verticals + a long horizontal rail + a few nail heads
    ctx.strokeStyle = 'rgba(35,22,10,.28)'; ctx.lineWidth = 1.6;
    for (let x = 70; x < W; x += 150) { ctx.beginPath(); ctx.moveTo(x, benchY + 32); ctx.lineTo(x - 8, H); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(35,22,10,.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, benchY + 92); ctx.lineTo(W, benchY + 92); ctx.stroke();
    ctx.strokeStyle = 'rgba(245,236,215,.05)';
    ctx.beginPath(); ctx.moveTo(0, benchY + 94); ctx.lineTo(W, benchY + 94); ctx.stroke();
    ctx.fillStyle = 'rgba(35,22,10,.5)';
    for (let x = 96; x < W; x += 150) { ctx.beginPath(); ctx.arc(x - 12, benchY + 60, 2, 0, U.TAU); ctx.fill(); }
    // a few scattered tool scratches near the puppet
    ctx.strokeStyle = 'rgba(35,22,10,.3)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(px - 70, benchY + 14); ctx.lineTo(px - 34, benchY + 18); ctx.moveTo(px + 44, benchY + 10); ctx.lineTo(px + 78, benchY + 13); ctx.stroke();

    // --- rune sockets: dashed circles while dragging, tiny studs when bolted ---
    if (drag) {
      const hot = nearestValid(drag.cat, drag.x, drag.y, 58);
      for (const s of validFor(drag.cat)) {
        const isHot = hot === s;
        const r = (s.cat === 'chassis' ? 30 : 20) + (isHot ? 3 + Math.sin(t * 9) * 1.5 : 0);
        ctx.save();
        ctx.strokeStyle = isHot ? PAL.amber : U.rgba(PAL.spirit, 0.85);
        ctx.lineWidth = isHot ? 3 : 2;
        ctx.setLineDash([5, 5]); ctx.lineDashOffset = -t * 16;
        ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, U.TAU); ctx.stroke();
        ctx.setLineDash([]);
        if (isHot) {
          ctx.strokeStyle = U.rgba(PAL.amber, 0.9); ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(s.x - 6, s.y); ctx.lineTo(s.x + 6, s.y); ctx.moveTo(s.x, s.y - 6); ctx.lineTo(s.x, s.y + 6); ctx.stroke();
        }
        Z.render.pxText(ctx, LABEL[s.cat], s.x, s.y - r - 6, 7, isHot ? PAL.amber : PAL.dim, 'center');
        ctx.restore();
      }
    } else {
      for (const s of slots) {
        if (s.cat === 'chassis' || !slotVal(s)) continue;
        if (loose && loose.cat === s.cat && loose.index === s.index) continue;
        boltStud(ctx, s.x, s.y);
      }
    }

    // --- the spirit puppet, breathing on the bench ---
    const scale = Math.min(W, H) / 520 + 0.6;
    Z.render.drawBotSide(px, groundY, 1, comp.spec, { t, spin: t * 10, wheel: 0, moving: false }, { scale });

    // --- unbolt spin animation ---
    if (unbolt) {
      const s = slotXY(unbolt.cat, unbolt.index);
      if (s && unbolt.item) {
        const p = unbolt.t / unbolt.dur;
        ctx.save();
        ctx.translate(s.x, s.y - p * 12); ctx.rotate(-p * 7);
        const sc2 = 1 - p * 0.2, ic = icon(unbolt.item);
        ctx.globalAlpha = 1 - p * 0.25;
        ctx.drawImage(ic, -23 * sc2, -23 * sc2, 46 * sc2, 46 * sc2);
        ctx.restore();
      }
    }

    // --- UNBOLT? paper tag ---
    if (pendingUn) {
      const s = slotXY(pendingUn.cat, pendingUn.index);
      if (s) {
        const tw2 = 78, th2 = 22, tx2 = s.x - tw2 / 2, ty2 = s.y - 48;
        Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, tx2, ty2, tw2, th2, 5), '#f5ecd7', { cut: 3 });
        Z.render.pxText(ctx, 'UNBOLT?', s.x, ty2 + 15, 8, PAL.verm, 'center');
        ctx.fillStyle = PAL.verm;
        ctx.fillRect(tx2 + 4, ty2 + th2 - 3, (tw2 - 8) * U.clamp(pendingUn.t / 1.2, 0, 1), 2);
      } else pendingUn = null;
    }

    // --- loose part + screw mini-game ---
    if (loose) {
      const s = slotXY(loose.cat, loose.index);
      if (!s) { loose = null; screwing = null; }
      else {
        const snap = loose.doneT != null ? U.clamp(loose.doneT / 0.12, 0, 1) : 0;
        const tilt = loose.tilt * (1 - U.ease.outCubic(snap));
        // socket ring: amber while loose, mint when snapping tight
        ctx.save();
        ctx.strokeStyle = loose.doneT != null ? '#9fe6c8' : PAL.amber;
        ctx.lineWidth = 2.5; ctx.setLineDash([4, 4]); ctx.lineDashOffset = -t * 12;
        ctx.beginPath(); ctx.arc(s.x, s.y, 30, 0, U.TAU); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        // the part itself, tilted until tight
        ctx.save();
        ctx.translate(s.x, s.y); ctx.rotate(tilt);
        ctx.drawImage(icon(loose.item), -23, -23, 46, 46);
        if (snap > 0) {
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - snap) * 0.85;
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 30, 0, U.TAU); ctx.fill();
        }
        ctx.restore();
        // screws + guides
        if (loose.doneT == null) {
          for (const sc of loose.screws) screwHead(ctx, s.x + sc.dx, s.y + sc.dy, sc, screwing && screwing.sc === sc, t);
          Z.render.pxText(ctx, 'TIGHTEN: CIRCLE THE SCREWS OR TAP', s.x, s.y - 58, 7, PAL.dim, 'center');
        }
      }
    }

    // --- gear box crate ---
    ctx.fillStyle = 'rgba(16,10,5,.4)';
    ctx.beginPath(); ctx.ellipse(crate.x + crate.w / 2, crate.y + crate.h - 2, crate.w * 0.56, 8, 0, 0, U.TAU); ctx.fill();
    if (lid > 0.04) { ctx.fillStyle = '#20160c'; ctx.fillRect(crate.x + 5, crate.y - 5, crate.w - 10, 12); }
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, crate.x, crate.y, crate.w, crate.h, 8), '#7a5836');
    ctx.strokeStyle = 'rgba(35,22,10,.4)'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(crate.x + 6, crate.y + crate.h * 0.36); ctx.lineTo(crate.x + crate.w - 6, crate.y + crate.h * 0.36);
    ctx.moveTo(crate.x + 6, crate.y + crate.h * 0.72); ctx.lineTo(crate.x + crate.w - 6, crate.y + crate.h * 0.72);
    ctx.stroke();
    ctx.fillStyle = 'rgba(35,22,10,.22)';
    ctx.fillRect(crate.x + crate.w * 0.16, crate.y + 3, 9, crate.h - 6);
    ctx.fillRect(crate.x + crate.w * 0.76, crate.y + 3, 9, crate.h - 6);
    Z.render.pxText(ctx, 'GEAR BOX', crate.x + crate.w / 2, crate.y + crate.h * 0.6, 9, '#f0e2c0', 'center');
    // swinging lid
    ctx.save();
    ctx.translate(crate.x + 2, crate.y + 1); ctx.rotate(-U.ease.outCubic(lid) * 1.7);
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, -2, -13, crate.w, 15, 5), '#8a6a45', { cut: 3, noShadow: true });
    ctx.fillStyle = 'rgba(35,22,10,.5)';
    ctx.beginPath(); ctx.arc(crate.w * 0.5 - 2, -6, 2, 0, U.TAU); ctx.fill();
    ctx.restore();
    if (!opened) Z.render.pxText(ctx, 'TAP A PLANK: OPEN THE GEAR BOX', crate.x + crate.w - 4, tabsTop - 10, 7, PAL.dim, 'right');

    // --- plank tabs ---
    for (const tb of tabs) {
      const on = openCat === tb.cat, y = tb.y - (on ? 4 : 0);
      Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, tb.x, y, tb.w, tb.h, 6), on ? '#8a6a45' : '#5f4930', { cut: 3, noShadow: !on });
      ctx.fillStyle = 'rgba(35,22,10,.6)';
      ctx.beginPath(); ctx.arc(tb.x + 7, y + 7, 1.6, 0, U.TAU); ctx.arc(tb.x + tb.w - 7, y + 7, 1.6, 0, U.TAU); ctx.fill();
      Z.render.pxText(ctx, tb.label, tb.x + tb.w / 2, y + tb.h - 8, 7, on ? '#ffd98a' : '#d8c8a4', 'center');
    }

    // --- tiles sliding out of the crate ---
    const mouthX = crate.x + crate.w / 2, mouthY = crate.y + 2;
    for (const tl of tiles) {
      const en = tl.en, ap = U.clamp(en.a / 0.3, 0, 1);
      if (ap <= 0) continue;
      const e2 = U.ease.outCubic(ap);
      const x = U.lerp(mouthX - tl.w / 2, tl.x, e2), y = U.lerp(mouthY, tl.y, e2);
      drawTile(ctx, en, x, y, tl.w, 0.6 + 0.4 * e2, drag && drag.srcId === en.it.id);
    }
    if (openCat && !catList.length && lid > 0.7) {
      Z.render.pxText(ctx, 'NOTHING SPARE IN ' + LABEL[openCat], W - 24, tabsTop - 30, 8, PAL.dim, 'right');
    }
    // page arrows
    for (const ar of arrows) {
      Z.render.paperFill(ctx, () => { ctx.beginPath(); ctx.arc(ar.x, ar.y, 15, 0, U.TAU); }, '#5f4930', { cut: 3, noShadow: true });
      Z.render.pxText(ctx, ar.dir < 0 ? '<' : '>', ar.x, ar.y + 5, 10, '#e6d6b2', 'center');
    }
    if (arrows.length) Z.render.pxText(ctx, (page + 1) + '/' + pages, arrows[0].x + 21, arrows[0].y + 32, 7, PAL.dim, 'center');

    // --- tiles hopping back into the crate ---
    for (const f of flying) {
      const p = U.clamp(f.t / f.dur, 0, 1), e2 = U.ease.inOut(p);
      const cx2 = (f.x0 + mouthX) / 2, cy2 = Math.min(f.y0, mouthY) - 90;
      const x = U.lerp(U.lerp(f.x0, cx2, e2), U.lerp(cx2, mouthX, e2), e2);
      const y = U.lerp(U.lerp(f.y0, cy2, e2), U.lerp(cy2, mouthY, e2), e2);
      ctx.save();
      ctx.translate(x, y); ctx.rotate(f.rot + Math.sin(p * 9) * 0.3 * (1 - p)); ctx.scale(1 - 0.5 * e2, 1 - 0.5 * e2);
      drawTile(ctx, { it: f.item, avail: 1 }, -28, -28, 56, 1, false);
      ctx.restore();
    }

    // --- the dragged tile rides on top, tilting with speed ---
    if (drag) {
      ctx.save();
      ctx.globalAlpha = 0.28; ctx.fillStyle = '#20140a';
      ctx.beginPath(); ctx.ellipse(drag.x, drag.y + 42, 34, 8, 0, 0, U.TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.translate(drag.x, drag.y); ctx.rotate(drag.rot); ctx.scale(1.14, 1.14);
      drawTile(ctx, { it: drag.item, avail: 1 }, -28, -28, 56, 1, false);
      ctx.restore();
    }

    Z.fx.render(ctx);
  }

  function drawTile(ctx, en, x, y, w, sc, dim) {
    const it = en.it, col = D.rarityColor(it.rarity);
    ctx.save();
    ctx.globalAlpha = dim ? 0.35 : 1;
    ctx.translate(x + w / 2, y + w / 2); ctx.scale(sc, sc); ctx.translate(-w / 2, -w / 2);
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, 0, 0, w, w, 9), '#f5ecd7', { cut: 3 });
    ctx.strokeStyle = col; ctx.lineWidth = 2.4;
    Z.render.roundRect(ctx, 3.5, 3.5, w - 7, w - 7, 6); ctx.stroke();
    ctx.drawImage(icon(it), 7, 7, w - 14, w - 14);
    if (en.avail > 1) {
      ctx.fillStyle = PAL.verm; ctx.beginPath(); ctx.arc(w - 4, 4, 9, 0, U.TAU); ctx.fill();
      ctx.strokeStyle = '#f5ecd7'; ctx.lineWidth = 2; ctx.stroke();
      Z.render.pxText(ctx, 'x' + en.avail, w - 4, 8, 6, '#fff6df', 'center');
    }
    ctx.restore();
  }

  function boltStud(ctx, x, y) {
    ctx.save();
    ctx.fillStyle = '#57432b';
    ctx.beginPath(); ctx.arc(x, y, 4, 0, U.TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(245,236,215,.5)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x - 2.4, y); ctx.lineTo(x + 2.4, y); ctx.moveTo(x, y - 2.4); ctx.lineTo(x, y + 2.4); ctx.stroke();
    ctx.restore();
  }

  function screwHead(ctx, x, y, sc, active, t) {
    const prog = U.clamp(sc.sum / (TURNS * U.TAU), 0, 1);
    const r = 9 - prog * 3;
    ctx.save();
    if (active) {                                   // circular motion guide
      ctx.strokeStyle = U.rgba(PAL.amber, 0.55); ctx.lineWidth = 1.6;
      ctx.setLineDash([3, 5]); ctx.lineDashOffset = -t * 26;
      ctx.beginPath(); ctx.arc(x, y, 24, 0, U.TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (prog > 0) {                                 // progress arc
      ctx.strokeStyle = sc.done ? '#9fe6c8' : PAL.amber; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, 14, -Math.PI / 2, -Math.PI / 2 + prog * U.TAU); ctx.stroke();
    }
    ctx.fillStyle = sc.done ? '#4a3722' : '#8a7148';
    ctx.beginPath(); ctx.arc(x, y, r, 0, U.TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(35,22,10,.9)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.translate(x, y); ctx.rotate(sc.sum);        // the cross turns as you screw
    ctx.strokeStyle = sc.done ? 'rgba(245,236,215,.35)' : 'rgba(245,236,215,.75)'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(-r * 0.6, 0); ctx.lineTo(r * 0.6, 0); ctx.moveTo(0, -r * 0.6); ctx.lineTo(0, r * 0.6); ctx.stroke();
    ctx.restore();
  }

  // ================= lifecycle =================
  function enter() {
    ensure();
    drag = null; loose = null; screwing = null; pendingUn = null; unbolt = null;
    flying.length = 0; openCat = null; lastCat = null; page = 0; catList = []; lid = 0; opened = false;
    const bt = $('#benchTools'); if (bt) bt.style.display = 'none';
    const nm = $('#benchName');
    if (nm) { nm.value = Z.state.botName; nm.onchange = () => { Z.state.botName = (nm.value || 'RIG').toUpperCase().slice(0, 14); Z.state.persist(); }; }
    readout();
  }
  function init() {
    Z.ui.onEnter('workbench', enter);
    U.bus.on('inventory', () => { if (Z.ui.current === 'workbench') { refreshCat(); readout(); } });
  }
  return {
    init, frame, enter,
    // read-only introspection for tests/tools (not used by the game)
    get dbg() { return { tabs, tiles, slots, crate, arrows, openCat, page, pages, loose, drag: !!drag }; },
  };
})();
