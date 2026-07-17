/* ================================================================
   workbench.js — HOME bench. Physics-based drag: grab a junk part,
   it swings with weight, drop it on a mount to bolt it in (or in the
   scrap bin to sell). Live stat readout. No chrome UI.
   ================================================================ */
Z.workbench = (function () {
  const U = Z.util, $ = U.$, D = Z.data, PAL = Z.data.PAL;
  let cv, ctx, W = 0, H = 0, DPR = 1;
  let slots = [], tray = [], bin = null, chassisChip = null;
  let drag = null, hoverSlot = null, filter = 'all';
  let bolt = null;

  function spec() { return Z.Bot.compute(Z.state.build).spec; }

  function ensure() {
    if (cv) return;
    cv = U.el('canvas'); cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:1;touch-action:none';
    const scr = document.querySelector('[data-screen=workbench]');
    scr.insertBefore(cv, scr.firstChild);
    ctx = cv.getContext('2d');
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);
  }
  function resize() {
    DPR = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * DPR | 0; cv.height = H * DPR | 0; ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.imageSmoothingEnabled = false;
  }

  // ---- layout of mounts + tray ----
  function relayout() {
    const b = Z.state.build, ch = D.chassisById(b.chassis);
    const cx = W * 0.42, groundY = H * 0.56, r = (spec().radius) * (Math.min(W, H) / 520 + 0.6);
    const bw = r * 2.5, bh = r * 1.15, by = groundY - r * 0.78 - bh;
    slots = [];
    const add = (cat, index, x, y, label) => slots.push({ cat, index, x, y, r: 30, label });
    add('generator', 0, cx - bw * 0.28, by + bh * 0.3, 'RUNE');
    add('motor', 0, cx, groundY - 6, 'WHEEL');
    add('wheels', 0, cx + bw * 0.1, groundY + 6, 'FEET');
    for (let i = 0; i < ch.slots.weapon; i++) add('weapon', i, cx + bw * 0.5 + 10, by + bh * 0.35 + i * 40, 'WPN');
    for (let i = 0; i < ch.slots.armor; i++) add('armor', i, cx - bw * 0.1 + i * 34, by - 12, 'ARM');
    for (let i = 0; i < ch.slots.utility; i++) add('utility', i, cx - bw * 0.5 - 6, by + bh * 0.4 + i * 38, 'UTL');
    // scrap bin (bottom-right)
    bin = { x: W - 78, y: H - 96, w: 64, h: 78 };
    // chassis chip target = bot body center
    chassisChip = { x: cx, y: by + bh * 0.5, r: bw * 0.4 };
    buildTray();
  }

  function buildTray() {
    tray = [];
    const items = [];
    Object.keys(Z.state.inventory).forEach((id) => {
      const it = D.itemById(id); if (!it) return;
      const cat = it.slots ? 'chassis' : it.category;
      if (filter !== 'all' && cat !== filter) return;
      if (Z.state.availableCount(id) > 0) items.push({ it, cat });
    });
    items.sort((a, b) => D.rarityRank(b.it.rarity) - D.rarityRank(a.it.rarity));
    const cw = 116, chh = 40, pad = 8, x0 = 16, y0 = H - 92;
    const perRow = Math.max(1, ((W - 120) / (cw + pad)) | 0);
    items.forEach((o, i) => { const col = i % perRow, row = (i / perRow) | 0; tray.push({ item: o.it, cat: o.cat, x: x0 + col * (cw + pad), y: y0 + row * (chh + pad), w: cw, h: chh, avail: Z.state.availableCount(o.it.id) }); });
  }

  // ---- pointer ----
  function pt(e) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function onDown(e) {
    e.preventDefault(); if (Z.audio) Z.audio.resume();
    const p = pt(e);
    // from a filled slot?
    for (const s of slots) { const id = slotVal(s); if (id && Math.hypot(p.x - s.x, p.y - s.y) < s.r) { pickup(D.itemById(id), s, p); unequip(s); return; } }
    // chassis on body
    if (Math.hypot(p.x - chassisChip.x, p.y - chassisChip.y) < chassisChip.r) { /* body: nothing to pick, frame swaps by dropping a frame here */ }
    // from tray?
    for (const c of tray) { if (p.x > c.x && p.x < c.x + c.w && p.y > c.y && p.y < c.y + c.h) { pickup(c.item, null, p); return; } }
  }
  function pickup(item, fromSlot, p) {
    drag = { item, cat: item.slots ? 'chassis' : item.category, from: fromSlot, x: p.x, y: p.y, vx: 0, vy: 0, weight: (item.stats && item.stats.weight) || item.weight || 8 };
    Z.audio.sfx.click();
  }
  function onMove(e) { if (!drag) return; const p = pt(e); drag.tx = p.x; drag.ty = p.y; }
  function onUp() {
    if (!drag) return;
    const d = drag; drag = null;
    // bin?
    if (over(d, bin)) { sell(d.item); return; }
    // chassis onto body
    if (d.cat === 'chassis' && Math.hypot(d.x - chassisChip.x, d.y - chassisChip.y) < chassisChip.r) { swapChassis(d.item.id); return; }
    // nearest compatible slot
    let best = null, bd = 44;
    for (const s of slots) { if (s.cat !== d.cat) continue; const dist = Math.hypot(d.x - s.x, d.y - s.y); if (dist < bd) { bd = dist; best = s; } }
    if (best) equip(best, d.item.id);
    else if (d.from) { /* dropped nowhere: it was unequipped, stays in inventory pool */ Z.audio.sfx.back(); relayout(); }
    else relayout();
  }
  function over(d, box) { return box && d.x > box.x && d.x < box.x + box.w && d.y > box.y && d.y < box.y + box.h; }

  function slotVal(s) { const b = Z.state.build; if (s.cat === 'generator' || s.cat === 'motor' || s.cat === 'wheels') return b[s.cat]; return (b[s.cat] || [])[s.index]; }
  function setSlot(s, id) { const b = Z.state.build; if (s.cat === 'generator' || s.cat === 'motor' || s.cat === 'wheels') b[s.cat] = id; else b[s.cat][s.index] = id; }
  function equip(s, id) {
    if (Z.state.availableCount(id) < 1) { Z.audio.sfx.error(); relayout(); return; }
    setSlot(s, id); Z.state.persist(); Z.audio.sfx.buy();
    bolt = { x: s.x, y: s.y, t: 0.7 };                 // transmutation flourish
    relayout(); readout();
  }
  function unequip(s) { setSlot(s, null); Z.state.persist(); readout(); }
  function sell(item) {
    if (Z.state.availableCount(item.id) < 1) { Z.audio.sfx.error(); relayout(); return; }
    Z.state.removeItem(item.id, 1); Z.state.addCredits(item.salvage, true); Z.state.addScrap(Math.ceil(item.salvage / 6));
    Z.audio.sfx.coin(); Z.ui.toast('Scrapped ' + item.name + ' +' + item.salvage); relayout(); readout();
  }
  function swapChassis(id) {
    if (Z.state.build.chassis === id) return;
    if (Z.state.availableCount(id) < 1) { Z.audio.sfx.error(); return; }
    const ob = Z.state.build, nch = D.chassisById(id);
    const nb = { chassis: id, generator: ob.generator, motor: ob.motor, wheels: ob.wheels, weapon: [], armor: [], utility: [] };
    ['weapon', 'armor', 'utility'].forEach((k) => { nb[k] = new Array(nch.slots[k]).fill(null); for (let i = 0; i < nch.slots[k] && i < (ob[k] || []).length; i++) nb[k][i] = ob[k][i]; });
    Z.state.build = nb; Z.state.persist(); Z.audio.sfx.buy(); relayout(); readout();
  }

  // ---- readout DOM ----
  function readout() {
    const c = Z.Bot.compute(Z.state.build), sp = c.spec, agg = c.agg;
    const el = $('#benchReadout'); if (!el) return;
    const over = sp.overdraw;
    el.innerHTML = `HP <b>${Math.round(sp.maxHp)}</b> · PWR <b>${Math.round(sp.power)}</b> · SPD <b>${Math.round(sp.speedStat)}</b><br>` +
      `GRIP <b>${Math.round(sp.tractionStat)}</b> · ARM <b>${sp.armor}%</b> · WT <b>${Math.round(sp.mass)}</b><br>` +
      `<span class="${over ? 'over' : ''}">PWR ${agg.energyDraw}/${agg.energyProvide}${over ? ' OVERDRAWN' : ''}</span> · RATING <b>${sp.rating}</b>` +
      (c.ready ? '' : ' · <span class="over">NEEDS WHEEL+SANDALS</span>');
  }

  // ---- draw (called by game loop) ----
  function draw(t) {
    if (!cv) return; if (cv.clientWidth !== W || cv.clientHeight !== H) resize();
    ctx.clearRect(0, 0, W, H);
    // bench table
    ctx.fillStyle = 'rgba(20,15,10,.55)'; ctx.fillRect(0, H - 100, W, 100);
    ctx.strokeStyle = 'rgba(74,63,48,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, H - 100); ctx.lineTo(W, H - 100); ctx.stroke();
    Z.render.pxText(ctx, 'PARTS BIN', 16, H - 106, 9, PAL.dim, 'left');

    // physics step for drag
    if (drag) {
      const stiff = 22 * U.clamp(1 - drag.weight / 320, 0.4, 1), damp = 9;
      const ax = (drag.tx - drag.x) * stiff - drag.vx * damp;
      const ay = (drag.ty - drag.y) * stiff - drag.vy * damp;
      drag.vx += ax * 0.016; drag.vy += ay * 0.016; drag.x += drag.vx * 0.016; drag.y += drag.vy * 0.016;
    }
    // find hover slot
    hoverSlot = null;
    if (drag) { let bd = 44; for (const s of slots) { if (s.cat !== drag.cat) continue; const dd = Math.hypot(drag.x - s.x, drag.y - s.y); if (dd < bd) { bd = dd; hoverSlot = s; } } }

    // bot
    const b = Z.state.build, ch = D.chassisById(b.chassis);
    const cx = W * 0.42, groundY = H * 0.56, r = spec().radius * (Math.min(W, H) / 520 + 0.6);
    // stand
    ctx.fillStyle = '#2a2118'; ctx.fillRect(cx - r, groundY + 2, r * 2, 10);
    ctx.fillStyle = '#1c160e'; ctx.fillRect(cx - r * 0.7, groundY + 12, 12, 40); ctx.fillRect(cx + r * 0.7 - 12, groundY + 12, 12, 40);
    Z.render.drawBotSide(cx, groundY, 1, spec(), { t, spin: t * 10, wheel: 0, moving: false }, { scale: (Math.min(W, H) / 520 + 0.6) });

    // slots
    for (const s of slots) {
      const filled = !!slotVal(s); const hot = hoverSlot === s;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.6, 0, U.TAU);
      ctx.fillStyle = hot ? U.rgba(PAL.amber, 0.3) : filled ? 'rgba(60,52,38,.5)' : 'rgba(30,24,16,.5)';
      ctx.fill();
      ctx.strokeStyle = hot ? PAL.amber : filled ? PAL.steel : (drag && drag.cat === s.cat ? PAL.amber : 'rgba(74,63,48,.8)');
      ctx.setLineDash(filled ? [] : [4, 4]); ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
      Z.render.pxText(ctx, s.label, s.x, s.y - s.r * 0.6 - 4, 7, filled ? PAL.ink : PAL.dim, 'center');
    }

    // scrap bin
    ctx.fillStyle = drag ? U.rgba(PAL.red, 0.25) : 'rgba(30,24,16,.6)'; ctx.fillRect(bin.x, bin.y, bin.w, bin.h);
    ctx.strokeStyle = PAL.red; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.strokeRect(bin.x, bin.y, bin.w, bin.h); ctx.setLineDash([]);
    Z.render.pxText(ctx, 'SCRAP', bin.x + bin.w / 2, bin.y + bin.h / 2 + 4, 8, PAL.red, 'center');

    // tray chips
    for (const c of tray) chip(ctx, c, false);

    // dragged part on top
    if (drag) { chip(ctx, { item: drag.item, x: drag.x - 58, y: drag.y - 20, w: 116, h: 40, avail: 0 }, true); }

    // transmutation flourish on bolt-in (FMA alchemy circle)
    if (bolt) {
      bolt.t -= 0.016; const life = Math.max(0, bolt.t / 0.7), r = 26 * (1 + (1 - life) * 0.9);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = life; ctx.strokeStyle = '#7fd4ff'; ctx.lineWidth = 2;
      ctx.translate(bolt.x, bolt.y); ctx.rotate((0.7 - bolt.t) * 6);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, U.TAU); ctx.stroke();
      for (let s = 0; s < 2; s++) { ctx.beginPath(); for (let i = 0; i < 3; i++) { const a = s * Math.PI + i / 3 * U.TAU - Math.PI / 2, px = Math.cos(a) * r * 0.8, py = Math.sin(a) * r * 0.8; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.stroke(); }
      ctx.restore();
      Z.render.pxText(ctx, 'BLESSED', bolt.x, bolt.y - r - 10, 10, '#8fe6cf', 'center');
      if (bolt.t <= 0) bolt = null;
    }
  }

  function chip(ctx, c, dragging) {
    const it = c.item, col = D.rarityColor(it.rarity);
    ctx.save();
    ctx.fillStyle = dragging ? 'rgba(40,32,22,.96)' : 'rgba(26,22,16,.92)';
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(c.x, c.y, c.w, c.h);
    ctx.fillStyle = col; ctx.fillRect(c.x, c.y, 5, c.h);
    const code = it.slots ? 'FRM' : (D.CAT_ICON[it.category] || 'UTL');
    Z.render.pxText(ctx, code, c.x + 12, c.y + 15, 8, col, 'left');
    ctx.font = '15px "VT323", monospace'; ctx.fillStyle = PAL.ink; ctx.textAlign = 'left';
    ctx.fillText(it.name.length > 13 ? it.name.slice(0, 12) + '.' : it.name, c.x + 12, c.y + 32);
    if (!dragging && c.avail > 1) { Z.render.pxText(ctx, 'x' + c.avail, c.x + c.w - 8, c.y + 15, 7, PAL.dim, 'right'); }
    ctx.restore();
  }

  function buildFilters() {
    const host = $('#benchTools'); if (!host) return; U.clear(host);
    [['all', 'ALL'], ['chassis', 'FRM'], ['generator', 'RUNE'], ['motor', 'WHL'], ['wheels', 'FEET'], ['weapon', 'WPN'], ['armor', 'ARM'], ['utility', 'CHRM']].forEach(([k, l]) => {
      const t = U.el('div', 'tool' + (filter === k ? ' on' : ''));
      t.textContent = l; t.style.fontFamily = 'Mochiy Pop One, sans-serif'; t.style.fontSize = '9px'; t.style.color = filter === k ? PAL.amber : PAL.dim;
      t.addEventListener('click', () => { filter = k; Z.audio.sfx.hover(); buildFilters(); relayout(); });
      host.appendChild(t);
    });
  }

  function enter() {
    ensure(); resize(); relayout(); buildFilters(); readout();
    const nm = $('#benchName'); if (nm) { nm.value = Z.state.botName; nm.onchange = () => { Z.state.botName = (nm.value || 'RIG').toUpperCase().slice(0, 14); Z.state.persist(); }; }
  }
  function init() { Z.ui.onEnter('workbench', enter); Z.util.bus.on('inventory', () => { if (Z.ui.current === 'workbench') { relayout(); readout(); } }); }
  return { init, draw, relayout };
})();
