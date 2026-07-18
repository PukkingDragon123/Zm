/* ================================================================
   workbench.js — THE ASSEMBLY BENCH as a fully diegetic canvas scene.
   Build a gunpla-style plastic mech on the turntable: pick a category
   tab, tap a piece to CLIP it off the runner (sprue) with the nippers,
   then DRAG it onto the matching glowing socket on the mech — it SNAPS
   in with a satisfying click and equips for real. Tap an equipped part
   to POP it back onto the runner (unequip). A parts box in the corner
   tallies your spares. Single pointer, touch friendly. No chrome UI —
   only the bench-hud readout DOM stays.
   ================================================================ */
Z.workbench = (function () {
  const U = Z.util, $ = U.$, D = Z.data, PAL = D.PAL;
  // category order + mech-term labels (from data)
  const CATS = ['chassis', 'generator', 'motor', 'wheels', 'weapon', 'armor', 'utility'];
  const LABEL = D.CAT_LABEL;                              // {chassis:'FRAME',...}

  let overlay = null;                                    // invisible pointer catcher
  let W = 0, H = 0, px = 0, groundY = 0, turnX = 1;
  let comp = null;
  let sockets = [], tabs = [], pieces = [], arrows = [];
  let box = { x: 0, y: 0, w: 0, h: 0 };
  let sprue = { x: 0, y: 0, w: 0, h: 0, barY: 0, pieceY: 0, ps: 60 };
  let openCat = 'weapon', catList = [], page = 0, pages = 1, visN = 6;
  let drag = null, flying = [], snapFx = [];
  let turnPhase = 0, lampT = 0;
  const icons = new Map();

  // ---- build helpers (state behaviour identical to the old bench) ----
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
      (c.ready ? '' : ' · <span class="over">NEEDS SERVO+LEGS</span>');
  }

  // ---- part icon cache (offscreen canvases via Z.render.drawPartIcon) ----
  function icon(it) {
    let cv = icons.get(it.id);
    if (!cv) { cv = document.createElement('canvas'); cv.width = cv.height = 46; Z.render.drawPartIcon(cv, it); icons.set(it.id, cv); }
    return cv;
  }

  // ---- runner contents for the open category ----
  function refreshCat() {
    catList = [];
    Object.keys(Z.state.inventory).forEach((id) => {
      const it = D.itemById(id); if (!it) return;
      const cat = it.slots ? 'chassis' : it.category;
      if (cat !== openCat) return;
      if (Z.state.invCount(id) <= 0) return;
      catList.push({ it, avail: Z.state.availableCount(id) });
    });
    catList.sort((a, b) => (D.rarityRank(b.it.rarity) - D.rarityRank(a.it.rarity)) || a.it.name.localeCompare(b.it.name));
    pages = Math.max(1, Math.ceil(catList.length / Math.max(1, visN)));
    if (page >= pages) page = pages - 1;
    if (page < 0) page = 0;
  }
  function spareCount() { let n = 0; catList.forEach((e) => { if (e.avail > 0) n += e.avail; }); return n; }

  function mechScale() { return Math.min(W, H) / 440 + 0.55; }

  // ---- layout (recomputed every frame; fully responsive) ----
  function layout() {
    W = Z.render.W; H = Z.render.H;
    px = W * 0.5;
    groundY = Math.max(H * 0.40, Math.min(H * 0.60, H - 250));

    // parts box, bottom-left corner
    box.w = U.clamp(W * 0.15, 96, 148); box.h = U.clamp(H * 0.14, 74, 106);
    box.x = 18; box.y = H - box.h - 16;

    // sprue piece row lives to the right of the box, along the bottom
    const fromX = box.x + box.w + 22, toX = W - 22;
    const ps = W < 620 ? 52 : 60;
    const gap = 12;
    visN = U.clamp(((toX - fromX + gap) / (ps + gap)) | 0, 2, 7);
    refreshCatBounds();
    const pieceY = H - ps - 40;
    const rowW = visN * (ps + gap) - gap;
    const rowStart = fromX + Math.max(0, ((toX - fromX) - rowW) / 2);
    sprue = { x: rowStart - 14, y: pieceY - 14, w: rowW + 28, h: ps + 44, barY: pieceY + ps + 12, pieceY, ps };
    pieces = [];
    const slice = catList.slice(page * visN, page * visN + visN);
    slice.forEach((en, j) => {
      const x = rowStart + j * (ps + gap);
      pieces.push({ en, x, y: pieceY, w: ps, cx: x + ps / 2, cy: pieceY + ps / 2 });
    });
    // page arrows (only if the runner overflows)
    arrows = [];
    if (pages > 1) {
      const ay = sprue.y - 8;
      arrows.push({ dir: -1, x: sprue.x + 14, y: ay });
      arrows.push({ dir: 1, x: sprue.x + sprue.w - 14, y: ay });
    }

    // category tabs, centred row above the runner
    tabs = [];
    const availW = W - 36, tg = 6;
    const tw = U.clamp((availW - tg * (CATS.length - 1)) / CATS.length, 42, 74);
    const th = 26;
    const totalW = CATS.length * tw + tg * (CATS.length - 1);
    const tx0 = (W - totalW) / 2;
    const ty = sprue.y - th - 16;
    CATS.forEach((cat, i) => tabs.push({ cat, label: LABEL[cat], x: tx0 + i * (tw + tg), y: ty, w: tw, h: th }));

    buildSockets();
  }
  function refreshCatBounds() {
    pages = Math.max(1, Math.ceil(catList.length / Math.max(1, visN)));
    if (page >= pages) page = pages - 1;
    if (page < 0) page = 0;
  }

  // ---- sockets on the mech (feet-anchored proportions match drawBotSide) ----
  function buildSockets() {
    sockets.length = 0;
    const spec = comp.spec, scale = mechScale(), s = scale * (spec.radius / 40);
    const legH = 26 * s, torsoW = 30 * s, torsoH = 30 * s;
    const hipY = groundY - legH, chestY = hipY - torsoH;
    const ch = D.chassisById(Z.state.build.chassis);
    const rBig = U.clamp(20 * s, 26, 40), rSm = U.clamp(13 * s, 18, 26);
    const gapV = U.clamp(24 * s, 30, 44);
    const add = (cat, index, dx, y, r) => sockets.push({ cat, index, x: px + dx * turnX, y, r, dx });
    add('chassis', 0, 0, chestY + torsoH * 0.52, rBig);
    add('generator', 0, 0, chestY + torsoH * 0.30, rSm);
    add('motor', 0, 0, hipY - 2 * s, rSm);
    add('wheels', 0, 5 * s, groundY - 2 * s, rSm);
    for (let i = 0; i < ch.slots.weapon; i++) add('weapon', i, torsoW * 0.98, chestY + torsoH * 0.12 + i * gapV, rSm);
    for (let i = 0; i < ch.slots.armor; i++) add('armor', i, -torsoW * 1.0, chestY + torsoH * 0.12 + i * gapV, rSm);
    for (let i = 0; i < ch.slots.utility; i++) add('utility', i, -torsoW * 0.56, chestY + torsoH * 0.66 + i * gapV, rSm);
  }
  function socketOf(cat, index) { for (const s of sockets) if (s.cat === cat && s.index === index) return s; return null; }

  // ---- drop targeting ----
  function nearestSocket(cat, x, y) {
    let best = null, bd = 1e9;
    for (const s of sockets) {
      if (s.cat !== cat) continue;
      const d = Math.hypot(x - s.x, y - s.y), r = Math.max(46, s.r + 18);
      if (d < r && d < bd) { bd = d; best = s; }
    }
    return best;
  }
  function tapSocket(x, y) {
    let best = null, bd = 1e9;
    for (const s of sockets) {
      if (!slotVal(s)) continue;                          // only filled sockets store
      if (s.cat === 'chassis') continue;                  // frame can't be removed
      const d = Math.hypot(x - s.x, y - s.y), r = Math.max(34, s.r + 8);
      if (d < r && d < bd) { bd = d; best = s; }
    }
    return best;
  }

  // ================= actions =================
  function pop(pc) {                                       // clip a piece off the runner
    const it = pc.en.it;
    if (pc.en.avail <= 0) { Z.audio.sfx.error(); return; }
    drag = {
      item: it, cat: it.slots ? 'chassis' : it.category, srcId: it.id,
      x: pc.cx, y: pc.cy, tx: pc.cx, ty: pc.cy, vx: 0, rot: 0, popT: 0,
      homeX: pc.cx, homeY: pc.cy,
    };
    Z.audio.sfx.click();                                  // nipper snip
    Z.fx.sparks(pc.cx, pc.cy + pc.w * 0.4, -Math.PI / 2, 6, '#e7e1d2', 1.5, 130);
    Z.fx.dust(pc.cx, pc.cy + pc.w * 0.4, 3, '#b9b2a0');
    Z.fx.popText(pc.cx, pc.cy - pc.w * 0.4, 'SNIP', '#fff6df');
  }

  function drop(d) {
    const soc = nearestSocket(d.cat, d.tx, d.ty);
    if (!soc) { Z.audio.sfx.back(); flyBack(d); return; }
    let ok = false;
    if (d.cat === 'chassis') ok = swapChassis(d.item.id);
    else if (Z.state.availableCount(d.item.id) < 1) { Z.audio.sfx.error(); ok = false; }
    else { setSlot(soc, d.item.id); Z.state.persist(); ok = true; }
    if (!ok) { flyBack(d); return; }
    snap(soc, d.item);
    readout(); refreshCat();
  }
  function snap(soc, item) {
    Z.audio.sfx.hit(0.7); Z.audio.sfx.found(item.rarity);
    Z.fx.ring(soc.x, soc.y, '#fff6df', 8, soc.r + 24, 0.3);
    Z.fx.sparks(soc.x, soc.y, -Math.PI / 2, 12, D.rarityColor(item.rarity), Math.PI, 220);
    Z.fx.screenFlash(0.16, '#fff6df');
    Z.fx.addShake(3);
    snapFx.push({ x: soc.x, y: soc.y, r: soc.r, t: 0, dur: 0.26 });
  }
  function store(soc) {                                    // pop an equipped part back to the runner
    const id = slotVal(soc); if (!id) return;
    const item = D.itemById(id);
    setSlot(soc, null); Z.state.persist();
    Z.audio.sfx.flip();
    Z.fx.dust(soc.x, soc.y, 6, '#c3bbaa');
    Z.fx.ring(soc.x, soc.y, '#9fe6c8', 6, 34, 0.28);
    openCat = soc.cat; page = 0; refreshCat();
    flying.push({ item, x0: soc.x, y0: soc.y, t: 0, dur: 0.5, rot: U.rand(-0.4, 0.4), toSprue: true });
    readout();
  }
  function flyBack(d) { flying.push({ item: d.item, x0: d.x, y0: d.y, x1: d.homeX, y1: d.homeY, t: 0, dur: 0.42, rot: U.rand(-0.3, 0.3) }); }

  // ================= pointer (single pointer, touch friendly) =================
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
    if (drag) return;
    // 1) category tabs
    for (const tb of tabs) {
      if (p.x > tb.x - 3 && p.x < tb.x + tb.w + 3 && p.y > tb.y - 6 && p.y < tb.y + tb.h + 6) {
        if (openCat !== tb.cat) { openCat = tb.cat; page = 0; refreshCat(); Z.audio.sfx.click(); }
        else Z.audio.sfx.hover();
        return;
      }
    }
    // 2) page arrows
    for (const ar of arrows) {
      if (Math.hypot(p.x - ar.x, p.y - ar.y) < 22) {
        const np = U.clamp(page + ar.dir, 0, pages - 1);
        if (np !== page) { page = np; Z.audio.sfx.click(); } else Z.audio.sfx.hover();
        return;
      }
    }
    // 3) clip a piece off the runner
    for (const pc of pieces) {
      if (p.x > pc.x - 6 && p.x < pc.x + pc.w + 6 && p.y > pc.y - 6 && p.y < pc.y + pc.w + 6) { pop(pc); return; }
    }
    // 4) store an equipped part back to the runner
    const soc = tapSocket(p.x, p.y);
    if (soc) { store(soc); return; }
  }
  function onMove(e) { if (drag) { const p = pt(e); drag.tx = p.x; drag.ty = p.y; } }
  function onUp() { if (!drag) return; const d = drag; drag = null; drop(d); }
  function onCancel() { if (drag) { const d = drag; drag = null; flyBack(d); } }

  // ================= frame (called by the game loop) =================
  function frame(dt, t) {
    const ctx = Z.render.ctx; if (!ctx) return;
    comp = Z.Bot.compute(Z.state.build);
    // turntable pauses while a piece is in hand so sockets stay steady
    if (!drag) turnPhase += dt * 0.55;
    turnX = 0.72 + 0.28 * Math.cos(turnPhase);
    lampT += dt;
    layout();

    for (let i = flying.length - 1; i >= 0; i--) { const f = flying[i]; f.t += dt; if (f.t >= f.dur) flying.splice(i, 1); }
    for (let i = snapFx.length - 1; i >= 0; i--) { const sf = snapFx[i]; sf.t += dt; if (sf.t >= sf.dur) snapFx.splice(i, 1); }
    if (drag) {
      drag.popT = Math.min(1, drag.popT + dt * 7);
      const k = 1 - Math.exp(-15 * dt);                   // springy lag toward the pointer
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
    // --- backdrop: the tool-wall bench, fit-cover, dimmed for the lamp pool ---
    if (!Z.assets.cover(ctx, 'world.workbench', 0, 0, W, H, 0.5)) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#3a2c1c'); g.addColorStop(1, '#241a10'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    ctx.fillStyle = 'rgba(20,13,7,.5)'; ctx.fillRect(0, 0, W, H);

    // --- hanging desk lamp + warm pool over the turntable ---
    const ly = Math.max(70, H * 0.12);
    ctx.strokeStyle = 'rgba(18,11,6,.85)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, ly); ctx.stroke();
    Z.render.paperFill(ctx, () => { ctx.beginPath(); ctx.moveTo(px - 30, ly + 20); ctx.lineTo(px - 12, ly); ctx.lineTo(px + 12, ly); ctx.lineTo(px + 30, ly + 20); ctx.closePath(); }, '#3f2f1c', { cut: 3 });
    ctx.fillStyle = '#ffd98a'; ctx.beginPath(); ctx.arc(px, ly + 22, 5, 0, U.TAU); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const flick = 0.17 + Math.sin(lampT * 2.1) * 0.015;
    const lg = ctx.createRadialGradient(px, groundY - 60, 24, px, groundY - 60, Math.max(W, H) * 0.46);
    lg.addColorStop(0, U.rgba('#ffcd82', flick)); lg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H); ctx.restore();

    // --- turntable disc under the mech (squashes with the faux-3D spin) ---
    const scale = mechScale(), s = scale * (comp.spec.radius / 40);
    const discR = 42 * s;
    ctx.save();
    ctx.fillStyle = 'rgba(12,8,4,.45)'; ctx.beginPath(); ctx.ellipse(px, groundY + 12 * s, discR * (0.7 + 0.3 * turnX), 9 * s, 0, 0, U.TAU); ctx.fill();
    const tg = ctx.createLinearGradient(px - discR, 0, px + discR, 0);
    tg.addColorStop(0, '#4a4038'); tg.addColorStop(0.5, '#6d6154'); tg.addColorStop(1, '#4a4038');
    ctx.fillStyle = tg; ctx.beginPath(); ctx.ellipse(px, groundY + 8 * s, discR * turnX, 8 * s, 0, 0, U.TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(20,14,8,.6)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(px, groundY + 8 * s, discR * turnX, 8 * s, 0, 0, U.TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(245,236,215,.14)'; ctx.beginPath(); ctx.ellipse(px, groundY + 6 * s, discR * 0.6 * turnX, 5 * s, 0, 0, U.TAU); ctx.stroke();
    ctx.restore();

    // --- empty-socket target hints (subtle, always on) ---
    for (const sc of sockets) {
      if (slotVal(sc)) continue;
      if (drag && drag.cat === sc.cat) continue;          // strong glow handled below
      ctx.save();
      ctx.strokeStyle = U.rgba(PAL.spirit, 0.28); ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 5]); ctx.lineDashOffset = -t * 10;
      ctx.beginPath(); ctx.arc(sc.x, sc.y, sc.r * 0.8, 0, U.TAU); ctx.stroke();
      ctx.restore();
    }

    // --- the assembled mech on the turntable (squashed horizontally) ---
    ctx.save();
    ctx.translate(px, 0); ctx.scale(turnX < 0.02 ? 0.02 : turnX, 1); ctx.translate(-px, 0);
    Z.render.drawBotSide(px, groundY, 1, comp.spec, { t, spin: t * 10, wheel: 0, moving: false }, { scale });
    ctx.restore();

    // --- socket rings: glow the valid targets while a piece is in hand ---
    if (drag) {
      const hot = nearestSocket(drag.cat, drag.x, drag.y);
      for (const sc of sockets) {
        if (sc.cat !== drag.cat) continue;
        const isHot = hot === sc;
        const r = sc.r + (isHot ? 4 + Math.sin(t * 9) * 1.6 : 0);
        ctx.save();
        ctx.strokeStyle = isHot ? PAL.amber : U.rgba(PAL.spirit, 0.85);
        ctx.lineWidth = isHot ? 3.4 : 2.2;
        ctx.setLineDash([5, 5]); ctx.lineDashOffset = -t * 18;
        ctx.beginPath(); ctx.arc(sc.x, sc.y, r, 0, U.TAU); ctx.stroke();
        ctx.setLineDash([]);
        if (isHot) {
          ctx.strokeStyle = U.rgba(PAL.amber, 0.9); ctx.lineWidth = 1.8;
          ctx.beginPath(); ctx.moveTo(sc.x - 7, sc.y); ctx.lineTo(sc.x + 7, sc.y); ctx.moveTo(sc.x, sc.y - 7); ctx.lineTo(sc.x, sc.y + 7); ctx.stroke();
        }
        Z.render.pxText(ctx, LABEL[sc.cat], sc.x, sc.y - r - 6, 7, isHot ? PAL.amber : PAL.dim, 'center');
        ctx.restore();
      }
    } else {
      // equipped sockets: a small tap-to-store bolt node
      for (const sc of sockets) {
        if (sc.cat === 'chassis' || !slotVal(sc)) continue;
        boltStud(ctx, sc.x, sc.y, t);
      }
    }

    // --- snap flashes ---
    for (const sf of snapFx) {
      const p = U.clamp(sf.t / sf.dur, 0, 1);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - p) * 0.9;
      ctx.fillStyle = '#fff6df'; ctx.beginPath(); ctx.arc(sf.x, sf.y, sf.r * (0.4 + p * 0.9), 0, U.TAU); ctx.fill();
      ctx.restore();
    }

    // --- parts box (corner, spare tally) ---
    drawBox(ctx, t);

    // --- category tabs ---
    for (const tb of tabs) {
      const on = openCat === tb.cat, y = tb.y - (on ? 3 : 0);
      Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, tb.x, y, tb.w, tb.h, 6), on ? '#8a6a45' : '#5a4630', { cut: 3, noShadow: !on });
      Z.render.pxText(ctx, tb.label, tb.x + tb.w / 2, y + tb.h - 8, tb.w < 58 ? 6 : 7, on ? '#ffd98a' : '#d8c8a4', 'center');
    }

    // --- the runner / sprue with the category's pieces ---
    drawSprue(ctx, t);
    for (const pc of pieces) drawPiece(ctx, pc.en, pc.x, pc.y, pc.w, drag && drag.srcId === pc.en.it.id);
    if (!catList.length) Z.render.pxText(ctx, 'NO ' + LABEL[openCat] + ' PARTS IN THE BOX', px, sprue.pieceY + sprue.ps * 0.5, 8, PAL.dim, 'center');

    // --- page arrows ---
    for (const ar of arrows) {
      Z.render.paperFill(ctx, () => { ctx.beginPath(); ctx.arc(ar.x, ar.y, 13, 0, U.TAU); }, '#5a4630', { cut: 3, noShadow: true });
      Z.render.pxText(ctx, ar.dir < 0 ? '<' : '>', ar.x, ar.y + 5, 10, '#e6d6b2', 'center');
    }
    if (arrows.length) Z.render.pxText(ctx, (page + 1) + '/' + pages, px, sprue.y - 4, 7, PAL.dim, 'center');

    // --- pieces easing back / popping home ---
    for (const f of flying) {
      const p = U.clamp(f.t / f.dur, 0, 1), e2 = U.ease.outCubic(p);
      let x, y, sc2 = 1;
      if (f.toSprue) {
        const tx = px, ty = sprue.pieceY + sprue.ps / 2;
        const cx = (f.x0 + tx) / 2, cy = Math.min(f.y0, ty) - 70;
        x = U.lerp(U.lerp(f.x0, cx, e2), U.lerp(cx, tx, e2), e2);
        y = U.lerp(U.lerp(f.y0, cy, e2), U.lerp(cy, ty, e2), e2);
        sc2 = 1 - 0.4 * e2;
      } else {
        x = U.lerp(f.x0, f.x1, e2); y = U.lerp(f.y0, f.y1, e2);
      }
      ctx.save(); ctx.translate(x, y); ctx.rotate(f.rot + Math.sin(p * 8) * 0.25 * (1 - p)); ctx.scale(sc2, sc2);
      drawPiece(ctx, { it: f.item, avail: 1 }, -sprue.ps / 2, -sprue.ps / 2, sprue.ps, false);
      ctx.restore();
    }

    // --- the piece in hand rides on top, tilting with speed ---
    if (drag) {
      const ps = sprue.ps * (1.1 + 0.08 * U.ease.outBack(drag.popT));
      ctx.save();
      ctx.globalAlpha = 0.3; ctx.fillStyle = '#18100a';
      ctx.beginPath(); ctx.ellipse(drag.x, drag.y + ps * 0.62, ps * 0.5, 8, 0, 0, U.TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.translate(drag.x, drag.y); ctx.rotate(drag.rot);
      drawPiece(ctx, { it: drag.item, avail: 1 }, -ps / 2, -ps / 2, ps, false);
      ctx.restore();
    }

    Z.fx.render(ctx);
  }

  // grey plastic runner frame holding the pieces by little gates
  function drawSprue(ctx, t) {
    if (!pieces.length && !catList.length) { return; }
    const barY = sprue.barY;
    // shadow
    ctx.fillStyle = 'rgba(10,7,4,.35)';
    Z.render.roundRect(ctx, sprue.x + 3, sprue.y + 4, sprue.w, sprue.h, 10); ctx.fill();
    // runner rails
    ctx.fillStyle = '#8b8378';
    Z.render.roundRect(ctx, sprue.x, barY - 6, sprue.w, 12, 6); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.14)'; Z.render.roundRect(ctx, sprue.x + 4, barY - 5, sprue.w - 8, 3, 2); ctx.fill();
    ctx.fillStyle = 'rgba(20,16,10,.35)'; Z.render.roundRect(ctx, sprue.x + 4, barY + 2, sprue.w - 8, 2, 1); ctx.fill();
    // end posts + a tiny sprue label tab
    ctx.fillStyle = '#7a7267';
    Z.render.roundRect(ctx, sprue.x, sprue.y + 4, 9, sprue.h - 8, 4); ctx.fill();
    Z.render.roundRect(ctx, sprue.x + sprue.w - 9, sprue.y + 4, 9, sprue.h - 8, 4); ctx.fill();
    Z.render.pxText(ctx, 'RUNNER ' + LABEL[openCat], sprue.x + sprue.w - 14, barY + 3, 6, '#efe3c4', 'right');
    // gates from each piece to the bar
    ctx.strokeStyle = '#8b8378'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (const pc of pieces) {
      if (drag && drag.srcId === pc.en.it.id) continue;
      ctx.beginPath(); ctx.moveTo(pc.cx, pc.y + pc.w); ctx.lineTo(pc.cx, barY - 4); ctx.stroke();
    }
  }

  // a single moulded plastic piece (part icon on a rarity-bordered tile)
  function drawPiece(ctx, en, x, y, w, hidden) {
    const it = en.it, col = D.rarityColor(it.rarity), dim = en.avail <= 0;
    if (hidden) {                                          // its gate slot is empty while it's in hand
      ctx.save();
      ctx.strokeStyle = 'rgba(120,112,100,.7)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
      Z.render.roundRect(ctx, x, y, w, w, 9); ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.globalAlpha = dim ? 0.45 : 1;
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, x, y, w, w, 9), '#f5ecd7', { cut: 3 });
    ctx.strokeStyle = col; ctx.lineWidth = 2.4;
    Z.render.roundRect(ctx, x + 3.5, y + 3.5, w - 7, w - 7, 6); ctx.stroke();
    ctx.drawImage(icon(it), x + 7, y + 7, w - 14, w - 14);
    // spare-count badge
    if (en.avail > 1) {
      ctx.fillStyle = PAL.verm; ctx.beginPath(); ctx.arc(x + w - 5, y + 5, 9, 0, U.TAU); ctx.fill();
      ctx.strokeStyle = '#f5ecd7'; ctx.lineWidth = 2; ctx.stroke();
      Z.render.pxText(ctx, 'x' + en.avail, x + w - 5, y + 9, 6, '#fff6df', 'center');
    } else if (dim) {
      Z.render.pxText(ctx, 'ON MECH', x + w / 2, y + w + 11, 5.5, PAL.dim, 'center');
    }
    ctx.restore();
  }

  function drawBox(ctx, t) {
    // drop shadow
    ctx.fillStyle = 'rgba(12,8,4,.4)';
    ctx.beginPath(); ctx.ellipse(box.x + box.w / 2, box.y + box.h - 2, box.w * 0.54, 8, 0, 0, U.TAU); ctx.fill();
    // crate body
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, box.x, box.y, box.w, box.h, 8), '#7a5836');
    ctx.strokeStyle = 'rgba(35,22,10,.4)'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(box.x + 6, box.y + box.h * 0.4); ctx.lineTo(box.x + box.w - 6, box.y + box.h * 0.4);
    ctx.stroke();
    ctx.fillStyle = 'rgba(35,22,10,.2)';
    ctx.fillRect(box.x + box.w * 0.16, box.y + 3, 8, box.h - 6);
    ctx.fillRect(box.x + box.w * 0.78, box.y + 3, 8, box.h - 6);
    Z.render.pxText(ctx, 'PARTS BOX', box.x + box.w / 2, box.y + box.h * 0.28, 8, '#f0e2c0', 'center');
    Z.render.pxText(ctx, LABEL[openCat], box.x + box.w / 2, box.y + box.h * 0.62, 7, '#ffd98a', 'center');
    // spare-count badge
    const spares = spareCount();
    const bx = box.x + box.w - 12, by = box.y + 2;
    ctx.fillStyle = spares > 0 ? PAL.spirit : '#6a5030'; ctx.beginPath(); ctx.arc(bx, by, 12, 0, U.TAU); ctx.fill();
    ctx.strokeStyle = '#f5ecd7'; ctx.lineWidth = 2; ctx.stroke();
    Z.render.pxText(ctx, '' + spares, bx, by + 4, 8, '#fff6df', 'center');
    Z.render.pxText(ctx, 'SPARES', box.x + box.w / 2, box.y + box.h * 0.9, 5.5, PAL.dim, 'center');
  }

  function boltStud(ctx, x, y, t) {
    const pulse = 0.6 + 0.4 * Math.sin(t * 4);
    ctx.save();
    ctx.strokeStyle = U.rgba('#9fe6c8', 0.35 * pulse); ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(x, y, 11, 0, U.TAU); ctx.stroke();
    ctx.fillStyle = '#5a4a30';
    ctx.beginPath(); ctx.arc(x, y, 4.5, 0, U.TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(245,236,215,.6)'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(x - 2.6, y); ctx.lineTo(x + 2.6, y); ctx.moveTo(x, y - 2.6); ctx.lineTo(x, y + 2.6); ctx.stroke();
    ctx.restore();
  }

  // ================= lifecycle =================
  function enter() {
    ensure();
    drag = null; flying.length = 0; snapFx.length = 0; page = 0; turnPhase = 0;
    if (!CATS.includes(openCat)) openCat = 'weapon';
    comp = Z.Bot.compute(Z.state.build);
    refreshCat();
    const bt = $('#benchTools'); if (bt) bt.style.display = 'none';
    const nm = $('#benchName');
    if (nm) { nm.value = Z.state.botName; nm.onchange = () => { Z.state.botName = (nm.value || 'UNIT').toUpperCase().slice(0, 14); Z.state.persist(); }; }
    readout();
  }
  function init() {
    Z.ui.onEnter('workbench', enter);
    U.bus.on('inventory', () => { if (Z.ui.current === 'workbench') { refreshCat(); readout(); } });
  }
  return {
    init, frame, enter,
    // read-only introspection for tests/tools (not used by the game)
    get dbg() { return { tabs, pieces, sockets, box, arrows, openCat, page, pages, drag: !!drag }; },
  };
})();
