/* ================================================================
   shop.js — KITSUNE CURIOS as a walkable scene: step through the
   door, browse goods sitting on real shelves, and buy them from
   the tengu minding the counter. Economy (prices, rank unlocks,
   scrap rate, buy/sell into Z.state) matches the old list shop.
   ================================================================ */
Z.shop = (function () {
  const U = Z.util, D = Z.data;
  const UNLOCK = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 6 };
  const scrapPrice = (p) => Math.ceil(p / 5);
  const catOf = (it) => (it.slots ? 'chassis' : it.category);
  const SPEED = 235, KEEPER = 'Tengu';
  const GREET = 'The fox is out. I mind the counter. Everything is priced, nothing is free.';

  const kid = { x: -70, vx: 0, facing: 1, walk: 0, turn: 0 };
  let stock = [], greeted = false, bubble = null, nearWare = null, nearKeeper = false;

  // ---- economy: identical rules to the old counter-menu shop ----
  function buy(id, withScrap) {
    const it = D.itemById(id); if (!it || Z.state.rankTier < (UNLOCK[it.rarity] || 1)) { Z.audio.sfx.error(); return false; }
    if (withScrap) { const sp = scrapPrice(it.price); if (Z.state.scrap < sp) { Z.audio.sfx.error(); Z.ui.toast('Not enough scrap', 'warn'); return false; } Z.state.addScrap(-sp); }
    else if (!Z.state.spend(it.price)) { Z.audio.sfx.error(); Z.ui.toast('Not enough cash', 'warn'); return false; }
    Z.state.addItem(id, 1); Z.state.persist(); Z.audio.sfx.buy(); Z.ui.toast('Bought ' + it.name, 'gold'); Z.ui.updateWallet(); return true;
  }
  function sell(id) {
    const it = D.itemById(id); if (!it || Z.state.availableCount(id) < 1) { Z.audio.sfx.error(); Z.ui.toast("That's on your puppet", 'warn'); return false; }
    Z.state.removeItem(id, 1); Z.state.addCredits(it.salvage, true); Z.state.persist(); Z.audio.sfx.coin(); Z.ui.toast('Sold ' + it.name + ' +' + it.salvage); Z.ui.updateWallet(); return true;
  }

  function statLine(it) {
    if (it.slots) return `HP ${it.baseHp} WT ${it.weight} W${it.slots.weapon}A${it.slots.armor}U${it.slots.utility}`;
    const s = it.stats || {}, b = [];
    if (s.hp) b.push('HP+' + s.hp); if (s.power) b.push('PWR+' + s.power); if (s.speed) b.push('SPD+' + s.speed);
    if (s.traction) b.push('GRIP+' + s.traction); if (s.armor) b.push('ARM+' + s.armor);
    if (s.energyProvide) b.push('CELL+' + s.energyProvide); if (s.energyDraw) b.push('DRAW' + s.energyDraw);
    if (it.weapon) b.push(D.WPN_ICON[it.weapon.type] + it.weapon.damage);
    return b.join(' ');
  }

  // ---- shelf stock: one ware per category from the unlocked pool,
  //      an extra weapon, plus one locked preview (rank-gated). ----
  function makeIcon(it, locked) {
    const cv = document.createElement('canvas');
    Z.render.drawPartIcon(cv, it);
    if (locked) {
      const c = cv.getContext('2d');
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'source-in'; c.fillStyle = 'rgba(50,38,24,.92)';
      c.fillRect(0, 0, cv.width, cv.height); c.restore();
    }
    return cv;
  }
  function buildStock() {
    const all = D.parts.concat(D.chassis), rank = Z.state.rankTier;
    const open = (it) => rank >= (UNLOCK[it.rarity] || 1);
    const picks = [];
    ['chassis', 'generator', 'motor', 'wheels', 'weapon', 'armor', 'utility'].forEach((cat) => {
      const pool = all.filter((it) => catOf(it) === cat && open(it));
      if (pool.length) picks.push(U.choice(pool));
    });
    const extra = all.filter((it) => catOf(it) === 'weapon' && open(it) && picks.indexOf(it) < 0);
    if (extra.length) picks.push(U.choice(extra));
    picks.sort((a, b) => a.price - b.price);
    stock = picks.map((it) => ({ it, locked: false }));
    const soon = all.filter((it) => !open(it)).sort((a, b) => D.rarityRank(a.rarity) - D.rarityRank(b.rarity) || a.price - b.price).slice(0, 5);
    if (soon.length) stock.push({ it: U.choice(soon), locked: true });
    const n = stock.length;
    stock.forEach((s, i) => {
      s.fx = n < 2 ? 0.5 : i / (n - 1); s.shelf = i % 2;
      s.lift = 0; s.hopT = 0; s.gone = 0; s.born = 0; s.shake = 0; s.wx = 0; s.wy = 0;
      s.cv = makeIcon(s.it, s.locked);
    });
  }

  function enter() {
    kid.x = -70; kid.vx = 0; kid.facing = 1; kid.walk = 0; kid.turn = 0;
    greeted = false; bubble = null; nearWare = null; nearKeeper = false;
    buildStock();
    Z.ui.updateWallet();
  }

  // ---- interactions ----
  function tryBuy(s) {
    const it = s.it;
    if (s.locked) { Z.audio.sfx.error(); s.shake = 1; Z.ui.toast('Comes with RANK ' + (UNLOCK[it.rarity] || 1), 'warn'); return; }
    if (s.gone > 0 || s.hopT > 0) return;
    const sp = scrapPrice(it.price);
    const withScrap = Z.state.credits < it.price && Z.state.scrap >= sp;
    if (buy(it.id, withScrap)) {
      s.hopT = 0.26; s.gone = 0.9;                       // hop off the shelf, then restock
      Z.fx.dust(s.wx, s.wy - 46, 4, '#cbb489');
    } else {
      s.shake = 1; bubble = { text: 'Coin first, friend.', t: 2.4 };
    }
  }

  function keeperChat() {
    Z.audio.sfx.click();
    const best = stock.filter((s) => !s.locked).map((s) => s.it)
      .sort((a, b) => D.rarityRank(b.rarity) - D.rarityRank(a.rarity) || b.price - a.price)[0];
    const line = (text, choices) => ({ who: KEEPER, img: 'tengu', text, choices });
    const choices = [
      { label: 'Anything good today?', then: [line(best ? 'The ' + best.name + ', there on the shelf. ' + ((D.RARITY[best.rarity] || {}).label || 'good') + ' grade. The fox priced it before she left, so do not ask me to blink.' : 'Shelves are thin today. Come back after the fox restocks.')] },
      { label: 'Prices seem steep.', then: [line('The fox counts every coin from wherever she is. I am more scared of her than of you.')] },
    ];
    const spares = Object.keys(Z.state.inventory).map((id) => D.itemById(id)).filter(Boolean)
      .filter((it) => Z.state.availableCount(it.id) > 0).sort((a, b) => b.salvage - a.salvage).slice(0, 4);
    if (spares.length) choices.push({
      label: 'I have spares to sell.',
      then: [line('Lay it on the counter. Salvage rate, no haggling. The fox does not do sentiment.',
        spares.map((it) => ({
          label: it.name + '  +' + U.fmt(it.salvage),
          act: () => { sell(it.id); },
          then: [line('Done. As far as your puppet knows, it never happened.')],
        })).concat([{ label: 'Never mind.', then: [line('Mm.')] }]))],
    });
    Z.cutscene.play([line('Hm. Looking, or buying?', choices)]);
  }

  // ---- the scene, called from the game loop every tick ----
  function frame(dt, t) {
    const ctx = Z.render.ctx, W = Z.render.W, H = Z.render.H;
    const groundY = H * 0.86;
    const minX = 46, maxX = W * 0.72, keeperX = W * 0.845;
    const sMin = Math.max(96, W * 0.08), sMax = W * 0.64;
    const inScene = Z.cutscene && Z.cutscene.active;
    if (!stock.length) buildStock();

    // ---- update ----
    if (kid.x < minX) {                                   // walk in through the door
      kid.vx = SPEED; kid.x += SPEED * dt; kid.walk += dt;
      if (kid.x >= minX && !greeted) { greeted = true; bubble = { text: GREET, t: 5.2 }; }
    } else if (!inScene) {
      const dir = Z.controls ? Z.controls.dir : 0;
      if (dir && dir !== kid.facing) { kid.facing = dir; kid.turn = 1; }
      if (kid.turn > 0) kid.turn = Math.max(0, kid.turn - dt * 5);
      kid.vx = dir * SPEED;
      kid.x = U.clamp(kid.x + kid.vx * dt, minX, maxX);
      kid.walk = dir ? kid.walk + dt : 0;
    } else { kid.vx = 0; kid.walk = 0; }
    if (bubble) { bubble.t -= dt; if (bubble.t <= 0) bubble = null; }

    const prevNear = nearWare; nearWare = null; let bd = 70;
    stock.forEach((s) => {
      s.wx = U.lerp(sMin, sMax, s.fx);
      s.wy = groundY - (s.shelf === 0 ? 198 : 100);       // plank top
      if (s.hopT > 0) { s.hopT -= dt; if (s.hopT <= 0) Z.fx.dust(s.wx, s.wy - 44, 6, '#d8c08a'); }
      else if (s.gone > 0) { s.gone -= dt; if (s.gone <= 0) { s.born = 0.35; Z.fx.dust(s.wx, s.wy - 22, 3, '#cbb489'); } }
      if (s.born > 0) s.born -= dt;
      if (s.shake > 0) s.shake = Math.max(0, s.shake - dt * 2);
      const d = Math.abs(kid.x - s.wx);
      if (kid.x >= minX && d < bd) { bd = d; nearWare = s; }
    });
    stock.forEach((s) => { s.lift = U.lerp(s.lift, s === nearWare ? 1 : 0, Math.min(1, dt * 10)); });
    nearKeeper = !nearWare && kid.x >= maxX - 120;
    if (nearWare && nearWare !== prevNear && Z.audio.ctx) Z.audio.sfx.hover();

    const act = !inScene && Z.controls && Z.controls.consumeInteract();
    if (act && kid.x >= minX) {
      if (nearWare) tryBuy(nearWare);
      else if (nearKeeper) keeperChat();
    }

    // ---- draw ----
    Z.render.clear();
    if (!Z.assets.cover(ctx, 'shop.inside', 0, 0, W, H, 0.5)) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#46301b'); g.addColorStop(0.6, '#332211'); g.addColorStop(1, '#20150c');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    ctx.fillStyle = 'rgba(30,18,8,.22)'; ctx.fillRect(0, 0, W, H);
    // warm lamp glow over the shelves and the counter
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    [[W * 0.3, 0.12], [W * 0.84, 0.15]].forEach(([gx, ga]) => {
      const lg = ctx.createRadialGradient(gx, H * 0.26, 10, gx, H * 0.26, W * 0.3);
      lg.addColorStop(0, 'rgba(255,200,120,' + ga + ')'); lg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
    });
    ctx.restore();
    // ground shade so the cutouts read
    const gg = ctx.createLinearGradient(0, groundY - 26, 0, H);
    gg.addColorStop(0, 'rgba(40,22,10,0)'); gg.addColorStop(1, 'rgba(40,22,10,.5)');
    ctx.fillStyle = gg; ctx.fillRect(0, groundY - 26, W, H - groundY + 26);

    // shelf planks
    for (let sh = 0; sh < 2; sh++) {
      const sy = groundY - (sh === 0 ? 198 : 100);
      Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, sMin - 44, sy, (sMax - sMin) + 88, 13, 6), '#8a6a45', { cut: 3.4 });
      ctx.strokeStyle = 'rgba(35,22,10,.25)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(sMin - 36, sy + 9); ctx.lineTo(sMax + 36, sy + 9); ctx.stroke();
    }
    // wares: stand + hanging price tag + the goods
    stock.forEach((s, i) => {
      Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, s.wx - 15, s.wy - 9, 30, 9, 3), '#b0844f', { cut: 2.6, noShadow: true });
      drawTag(ctx, s, i, t);
      if (!(s.gone > 0 && s.hopT <= 0)) {
        let scale = 1 + s.lift * 0.1, dy = -8 * s.lift, alpha = 1;
        if (s.hopT > 0) { const p = 1 - s.hopT / 0.26; dy -= 60 * U.ease.outCubic(p); scale *= 1 - p * 0.4; alpha = 1 - p * 0.7; }
        else if (s.born > 0) scale *= Math.max(0.02, U.ease.outBack(1 - s.born / 0.35));
        const sz = 46 * scale;
        ctx.save(); ctx.globalAlpha = alpha;
        ctx.drawImage(s.cv, s.wx - sz / 2, s.wy - 9 - sz + dy, sz, sz);
        ctx.restore();
      }
    });

    // the tengu keeper behind the counter, right side
    if (!Z.render.drawSprite('char.tengu', keeperX, groundY - 4, { w: 120, bob: Math.abs(Math.sin(t * 2.1)) * 3.5, squash: Math.sin(t * 2.1) * 0.02, sway: Math.sin(t * 1.7) * 0.03, facing: -1 })) {
      ctx.fillStyle = '#6a4a3a'; ctx.fillRect(keeperX - 20, groundY - 130, 40, 126);
    }
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, W * 0.735, groundY - 60, W * 0.29, 72, 8), '#a9805a', { cut: 4 });
    ctx.strokeStyle = 'rgba(35,22,10,.3)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(W * 0.75, groundY - 38); ctx.lineTo(W - 12, groundY - 38); ctx.stroke();
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, keeperX - 70, groundY - 74, 34, 16, 3), '#8a6a45', { cut: 2.6, noShadow: true });

    // the tanuki
    const moving = Math.abs(kid.vx) > 1;
    const hasSheet = Z.assets.ready('sheet.tanuki');
    const hop = moving ? Math.abs(Math.sin(kid.walk * 9)) * (hasSheet ? 5 : 12) : Math.sin(t * 2.2) * 2.5;
    const squash = moving ? Math.cos(kid.walk * 18) * (hasSheet ? 0.03 : 0.06) : Math.sin(t * 2.2) * 0.025;
    if (!Z.render.drawSprite('char.tanuki', kid.x, groundY, { w: 110, bob: hop, squash, facing: kid.facing, turn: kid.turn, sway: moving ? Math.sin(kid.walk * 9) * 0.05 : 0, anim: moving ? 'walk' : 'idle', animT: moving ? kid.walk : t })) {
      ctx.fillStyle = '#7a5a3a'; ctx.fillRect(kid.x - 18, groundY - 60, 36, 60);
    }
    if (moving && Math.random() < 0.2) Z.fx.dust(kid.x - kid.facing * 16, groundY, 1, '#c9a76b');

    Z.fx.render(ctx);
    if (bubble && !inScene) speechBubble(ctx, keeperX - 40, groundY - 200, bubble.text);
    if (nearKeeper && !inScene && !bubble) Z.render.pxText(ctx, 'ENTER - TALK', keeperX - 10, groundY - 172 + Math.sin(t * 3) * 3, 11, '#f5ecd7', 'center');
    if (nearWare && !inScene) drawCard(ctx, nearWare, t, W);
    Z.render.drawPetals(t);
  }

  // hanging paper price tag under the shelf lip
  function drawTag(ctx, s, i, t) {
    const label = s.locked ? 'RANK ' + (UNLOCK[s.it.rarity] || 1) : '¥' + U.fmt(s.it.price);
    const rot = Math.sin(t * 1.5 + i * 1.7) * 0.06 + (s.shake > 0 ? Math.sin(t * 34) * 0.35 * s.shake : 0);
    ctx.save();
    ctx.translate(s.wx + 20, s.wy + 13); ctx.rotate(rot);
    ctx.strokeStyle = 'rgba(47,36,24,.8)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, 8); ctx.stroke();
    const tw = Math.max(38, label.length * 8 + 14);
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, -tw / 2, 8, tw, 19, 4), s.locked ? '#e8d3a0' : '#f5ecd7', { cut: 0.001, noShadow: true, ink: 1.8 });
    ctx.fillStyle = s.locked ? '#c23b2f' : '#2f2418';
    ctx.font = "700 11px 'Zen Maru Gothic', sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 18);
    ctx.restore();
  }

  // paper info card popping above the ware you stand at
  function drawCard(ctx, s, t, W) {
    const it = s.it, rc = D.rarityColor(it.rarity);
    const rows = [];
    if (s.locked) {
      rows.push({ t: ((D.RARITY[it.rarity] || {}).label || '') + ' STOCK', c: '#8a7a5c' });
      rows.push({ t: 'The fox unlocks this at RANK ' + (UNLOCK[it.rarity] || 1) + '.', c: '#c23b2f' });
    } else {
      rows.push({ t: ((D.RARITY[it.rarity] || {}).label || '') + ' · ' + catOf(it).toUpperCase(), c: '#8a7a5c' });
      const sl = statLine(it); if (sl) rows.push({ t: sl, c: '#2f2418' });
      const owned = Z.state.invCount(it.id), sp = scrapPrice(it.price);
      rows.push({ t: '¥' + U.fmt(it.price) + '  or ' + sp + ' scrap' + (owned ? '  · own ' + owned : ''), c: '#b8432a' });
    }
    ctx.save();
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = "700 15px 'Zen Maru Gothic', sans-serif";
    let wMax = ctx.measureText(it.name).width;
    ctx.font = "600 12px 'Zen Maru Gothic', sans-serif";
    rows.forEach((r) => { wMax = Math.max(wMax, ctx.measureText(r.t).width); });
    const cw = U.clamp(wMax + 28, 172, 330);
    const ch = 36 + rows.length * 17 + (s.locked ? 0 : 24);
    const cx = U.clamp(s.wx, cw / 2 + 8, W - cw / 2 - 8);
    const top = s.wy - 70 - ch;
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, cx - cw / 2, top, cw, ch, 10), '#f5ecd7', { cut: 0.001 });
    // little pointer notch down toward the ware
    const nx = U.clamp(s.wx, cx - cw / 2 + 18, cx + cw / 2 - 18);
    ctx.strokeStyle = '#2f2418'; ctx.lineWidth = 2.4; ctx.lineJoin = 'round'; ctx.fillStyle = '#f5ecd7';
    ctx.beginPath(); ctx.moveTo(nx - 8, top + ch - 2.5); ctx.lineTo(nx, top + ch + 9); ctx.lineTo(nx + 8, top + ch - 2.5); ctx.closePath();
    ctx.stroke(); ctx.fill();
    let ty = top + 24;
    ctx.font = "700 15px 'Zen Maru Gothic', sans-serif";
    ctx.fillStyle = U.mixHex(rc, '#2f2418', 0.25); ctx.fillText(it.name, cx - cw / 2 + 14, ty);
    ctx.font = "600 12px 'Zen Maru Gothic', sans-serif";
    rows.forEach((r) => { ty += 17; ctx.fillStyle = r.c; ctx.fillText(r.t, cx - cw / 2 + 14, ty); });
    if (!s.locked) {
      ctx.font = "700 13px 'Zen Maru Gothic', sans-serif"; ctx.textAlign = 'center';
      ctx.globalAlpha = 0.72 + 0.28 * Math.sin(t * 5);
      ctx.fillStyle = '#d94f30'; ctx.fillText('ENTER - BUY', cx, top + ch - 11);
    }
    ctx.restore();
  }

  function speechBubble(ctx, x, y, text) {
    const lines = wrap(text, 28), w = 250, h = 18 + lines.length * 19;
    const bx = U.clamp(x, w / 2 + 10, Z.render.W - w / 2 - 10);
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, bx - w / 2, y - h, w, h, 13), '#f5ecd7', { cut: 0.001 });
    ctx.fillStyle = '#2f2418'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = "700 15px 'Zen Maru Gothic', sans-serif";
    lines.forEach((ln, i) => ctx.fillText(ln, bx, y - h + 24 + i * 19));
  }
  function wrap(t, n) { const w = t.split(' '), out = []; let l = ''; for (const word of w) { if ((l + word).length > n) { out.push(l.trim()); l = ''; } l += word + ' '; } if (l.trim()) out.push(l.trim()); return out; }

  function init() { Z.ui.onEnter('shop', enter); }
  return { init, frame, buy, sell };
})();
