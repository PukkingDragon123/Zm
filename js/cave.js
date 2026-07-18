/* ================================================================
   cave.js — the RED ONI's MODEL-KIT SHOP, dug into the workshop cave.
   Buy whole mech FRAMES and loose COMPONENT kits (weapon / backpack /
   reactor / servo / leg runners). Boxed kits sit on the shelves; walk
   the floor, stop at a box to read its card, ENTER to buy. The oni
   keeper minds the counter on the left — talk to him to spot the
   rarest crate or unload your spares. Economy rules (prices, rank
   unlocks, scrap rate, buy/sell into Z.state) mirror the curio shop.
   ================================================================ */
Z.cave = (function () {
  const U = Z.util, D = Z.data;
  const UNLOCK = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 6 };
  const scrapPrice = (p) => Math.ceil(p / 5);
  const catOf = (it) => (it.slots ? 'chassis' : it.category);
  const SPEED = 235, KEEPER = 'Oni Keeper';
  const GREET = 'Workshop cave. I stock the kits, you bring the credits. Panel lines are extra.';

  const kid = { x: -70, vx: 0, facing: 1, walk: 0, turn: 0 };
  let stock = [], greeted = false, bubble = null, nearBox = null, nearKeeper = false;

  // ---- economy: identical rules to the curio shop ----
  function buy(id, withScrap) {
    const it = D.itemById(id); if (!it || Z.state.rankTier < (UNLOCK[it.rarity] || 1)) { Z.audio.sfx.error(); return false; }
    if (withScrap) { const sp = scrapPrice(it.price); if (Z.state.scrap < sp) { Z.audio.sfx.error(); Z.ui.toast('Not enough scrap', 'warn'); return false; } Z.state.addScrap(-sp); }
    else if (!Z.state.spend(it.price)) { Z.audio.sfx.error(); Z.ui.toast('Not enough credits', 'warn'); return false; }
    Z.state.addItem(id, 1); Z.state.persist(); Z.audio.sfx.buy(); Z.ui.toast('Bought ' + it.name, 'gold'); Z.ui.updateWallet(); return true;
  }
  function sell(id) {
    const it = D.itemById(id); if (!it || Z.state.availableCount(id) < 1) { Z.audio.sfx.error(); Z.ui.toast("That one's bolted to your mech", 'warn'); return false; }
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

  // ---- box art: the part icon on the kit-box front ----
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

  // ---- shelf stock: one kit per category from the unlocked pool, an
  //      extra component, plus one rank-locked crate preview. ----
  function buildStock() {
    const all = D.parts.concat(D.chassis), rank = Z.state.rankTier;
    const open = (it) => rank >= (UNLOCK[it.rarity] || 1);
    const picks = [];
    ['chassis', 'generator', 'motor', 'wheels', 'weapon', 'armor', 'utility'].forEach((cat) => {
      const pool = all.filter((it) => catOf(it) === cat && open(it));
      if (pool.length) picks.push(U.choice(pool));
    });
    // an extra loose component (weapon / backpack) to push the parts angle
    const extraPool = all.filter((it) => (catOf(it) === 'weapon' || catOf(it) === 'utility') && open(it) && picks.indexOf(it) < 0);
    if (extraPool.length) picks.push(U.choice(extraPool));
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
    greeted = false; bubble = null; nearBox = null; nearKeeper = false;
    buildStock();
    Z.ui.updateWallet();
  }

  // ---- interactions ----
  function tryBuy(s) {
    const it = s.it;
    if (s.locked) { Z.audio.sfx.error(); s.shake = 1; Z.ui.toast('Crate cracks at RANK ' + (UNLOCK[it.rarity] || 1), 'warn'); return; }
    if (s.gone > 0 || s.hopT > 0) return;
    const sp = scrapPrice(it.price);
    const withScrap = Z.state.credits < it.price && Z.state.scrap >= sp;
    if (buy(it.id, withScrap)) {
      s.hopT = 0.26; s.gone = 0.9;                       // kit hops off the shelf, then the oni restocks
      Z.fx.dust(s.wx, s.wy - 46, 4, '#cbb489');
    } else {
      s.shake = 1; bubble = { text: 'Credits on the counter first.', t: 2.4 };
    }
  }

  function keeperChat() {
    Z.audio.sfx.click();
    const best = stock.filter((s) => !s.locked).map((s) => s.it)
      .sort((a, b) => D.rarityRank(b.rarity) - D.rarityRank(a.rarity) || b.price - a.price)[0];
    const line = (text, choices) => ({ who: KEEPER, img: 'oni', text, choices });
    const choices = [
      { label: 'Point me at the best kit.', then: [line(best ? 'That crate, third shelf up: the ' + best.name + '. ' + ((D.RARITY[best.rarity] || {}).label || 'solid') + ' grade, sealed sprue, no missing runners. Costs what it costs.' : 'Shelves are picked clean. Come back when I have runners to cut.')] },
      { label: 'Your prices are brutal.', then: [line('You want a component kit or a lecture on economics? I forge the plate, I set the number. Haggle again and it goes UP.')] },
      { label: 'Which components matter?', then: [line('Weapon kits win rounds, backpack mods win energy, a fat reactor core feeds them both. Buy the core last and you will keep stalling out.')] },
    ];
    const spares = Object.keys(Z.state.inventory).map((id) => D.itemById(id)).filter(Boolean)
      .filter((it) => Z.state.availableCount(it.id) > 0).sort((a, b) => b.salvage - a.salvage).slice(0, 4);
    if (spares.length) choices.push({
      label: 'I have spare parts to sell.',
      then: [line('Lay the loose sprue on the counter. Salvage rate, take it or bolt it back on.',
        spares.map((it) => ({
          label: it.name + '  +' + U.fmt(it.salvage),
          act: () => { sell(it.id); },
          then: [line('Into the parts bin it goes. The cave keeps everything eventually.')],
        })).concat([{ label: 'On second thought, no.', then: [line('Hmph. Then stop leaning on my counter.')] }]))],
    });
    Z.cutscene.play([line('Kits or components, tanuki? Speak up.', choices)]);
  }

  // ---- the scene, called from the game loop every tick ----
  function frame(dt, t) {
    const ctx = Z.render.ctx, W = Z.render.W, H = Z.render.H;
    const groundY = H * 0.86;
    const keeperX = W * 0.135, minX = W * 0.28, maxX = W * 0.9;
    const sMin = W * 0.36, sMax = W * 0.86;
    const inScene = Z.cutscene && Z.cutscene.active;
    if (!stock.length) buildStock();

    // ---- update ----
    if (kid.x < minX) {                                   // walk in past the counter
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

    const prevNear = nearBox; nearBox = null; let bd = 70;
    stock.forEach((s) => {
      s.wx = U.lerp(sMin, sMax, s.fx);
      s.wy = groundY - (s.shelf === 0 ? 196 : 100);       // plank top the box rests on
      if (s.hopT > 0) { s.hopT -= dt; if (s.hopT <= 0) Z.fx.dust(s.wx, s.wy - 44, 6, '#d8c08a'); }
      else if (s.gone > 0) { s.gone -= dt; if (s.gone <= 0) { s.born = 0.35; Z.fx.dust(s.wx, s.wy - 22, 3, '#cbb489'); } }
      if (s.born > 0) s.born -= dt;
      if (s.shake > 0) s.shake = Math.max(0, s.shake - dt * 2);
      const d = Math.abs(kid.x - s.wx);
      if (kid.x >= minX && d < bd) { bd = d; nearBox = s; }
    });
    nearKeeper = kid.x >= minX && kid.x <= minX + 70;      // the entry strip by the counter is the oni's
    if (nearKeeper) nearBox = null;                         // keeper wins over the nearest box here
    stock.forEach((s) => { s.lift = U.lerp(s.lift, s === nearBox ? 1 : 0, Math.min(1, dt * 10)); });
    if (nearBox && nearBox !== prevNear && Z.audio.ctx) Z.audio.sfx.hover();

    const act = !inScene && Z.controls && Z.controls.consumeInteract();
    if (act && kid.x >= minX) {
      if (nearBox) tryBuy(nearBox);
      else if (nearKeeper) keeperChat();
    }

    // ---- draw ----
    Z.render.clear();
    if (!Z.assets.cover(ctx, 'cave.shop', 0, 0, W, H, 0.5)) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#3a2b1c'); g.addColorStop(0.6, '#281c11'); g.addColorStop(1, '#170f08');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    ctx.fillStyle = 'rgba(24,14,6,.24)'; ctx.fillRect(0, 0, W, H);
    // warm cave lamp glow over the counter and the shelves
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    [[keeperX + W * 0.02, H * 0.24, 0.16], [W * 0.62, H * 0.22, 0.13]].forEach(([gx, gy, ga]) => {
      const lg = ctx.createRadialGradient(gx, gy, 10, gx, gy, W * 0.32);
      lg.addColorStop(0, 'rgba(255,196,112,' + ga + ')'); lg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
    });
    ctx.restore();
    // ground shade band so the cutouts read
    const gg = ctx.createLinearGradient(0, groundY - 26, 0, H);
    gg.addColorStop(0, 'rgba(30,18,8,0)'); gg.addColorStop(1, 'rgba(30,18,8,.5)');
    ctx.fillStyle = gg; ctx.fillRect(0, groundY - 26, W, H - groundY + 26);

    // shelf planks (the boxes sit on these)
    for (let sh = 0; sh < 2; sh++) {
      const sy = groundY - (sh === 0 ? 196 : 100);
      Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, sMin - 52, sy, (sMax - sMin) + 104, 13, 6), '#7c5c3a', { cut: 3.4 });
      ctx.strokeStyle = 'rgba(30,18,8,.3)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(sMin - 44, sy + 9); ctx.lineTo(sMax + 44, sy + 9); ctx.stroke();
    }
    // kit boxes + hanging price tags
    stock.forEach((s, i) => { drawTag(ctx, s, i, t); drawBox(ctx, s, t); });

    // the red oni keeper behind the left counter, idle bob
    if (!Z.render.drawSprite('char.oni', keeperX, groundY - 6, { w: 150, bob: Math.abs(Math.sin(t * 2.0)) * 3.5, squash: Math.sin(t * 2.0) * 0.02, sway: Math.sin(t * 1.6) * 0.03, facing: 1 })) {
      ctx.fillStyle = '#7a3a2a'; ctx.fillRect(keeperX - 26, groundY - 150, 52, 146);
    }
    // the counter slab in front of the oni
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, W * 0.015, groundY - 58, W * 0.245, 72, 8), '#8a5a38', { cut: 4 });
    ctx.strokeStyle = 'rgba(30,18,8,.32)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(W * 0.03, groundY - 36); ctx.lineTo(W * 0.25, groundY - 36); ctx.stroke();
    // a small "COMPONENTS" placard on the counter
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, keeperX + 40, groundY - 76, 60, 16, 3), '#c9803f', { cut: 2.4, noShadow: true });
    Z.render.pxText(ctx, 'COMPONENTS', keeperX + 70, groundY - 65, 8, '#fff1d6', 'center');

    // the tanuki on the shop floor
    const moving = Math.abs(kid.vx) > 1;
    const hasSheet = Z.assets.ready('sheet.tanuki');
    const hop = moving ? Math.abs(Math.sin(kid.walk * 9)) * (hasSheet ? 5 : 12) : Math.sin(t * 2.2) * 2.5;
    const squash = moving ? Math.cos(kid.walk * 18) * (hasSheet ? 0.03 : 0.06) : Math.sin(t * 2.2) * 0.025;
    if (!Z.render.drawSprite('char.tanuki', kid.x, groundY, { w: 110, bob: hop, squash, facing: kid.facing, turn: kid.turn, sway: moving ? Math.sin(kid.walk * 9) * 0.05 : 0, anim: moving ? 'walk' : 'idle', animT: moving ? kid.walk : t })) {
      ctx.fillStyle = '#7a5a3a'; ctx.fillRect(kid.x - 18, groundY - 60, 36, 60);
    }
    if (moving && Math.random() < 0.2) Z.fx.dust(kid.x - kid.facing * 16, groundY, 1, '#c9a76b');

    Z.fx.render(ctx);
    if (bubble && !inScene) speechBubble(ctx, keeperX + 34, groundY - 150, bubble.text);
    if (nearKeeper && !inScene && !bubble) Z.render.pxText(ctx, 'ENTER - TALK', keeperX + 30, groundY - 150 + Math.sin(t * 3) * 3, 11, '#f5ecd7', 'center');
    if (nearBox && !inScene) drawCard(ctx, nearBox, t, W);
    Z.render.drawPetals(t);
  }

  // a boxed model kit resting on the shelf plank
  function drawBox(ctx, s, t) {
    if (s.gone > 0 && s.hopT <= 0) return;                 // sold; restocking
    const bw = 54, bh = 58;
    let scale = 1 + s.lift * 0.09, dy = -6 * s.lift, alpha = 1;
    if (s.hopT > 0) { const p = 1 - s.hopT / 0.26; dy -= 60 * U.ease.outCubic(p); scale *= 1 - p * 0.4; alpha = 1 - p * 0.7; }
    else if (s.born > 0) scale *= Math.max(0.02, U.ease.outBack(1 - s.born / 0.35));
    const jx = s.shake > 0 ? Math.sin(t * 34) * 3 * s.shake : 0;
    const cx = s.wx + jx, byBot = s.wy;
    const rc = D.rarityColor(s.it.rarity);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, byBot + dy); ctx.scale(scale, scale);
    // box body
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, -bw / 2, -bh, bw, bh, 5), s.locked ? '#c7b184' : '#e7d6ac', { cut: 3 });
    // coloured lid band (rarity)
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, -bw / 2, -bh, bw, 13, 5), U.mixHex(rc, '#2f2418', 0.18), { cut: 2.4, noShadow: true });
    // panel line under the lid
    ctx.strokeStyle = 'rgba(47,36,24,.35)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-bw / 2 + 4, -bh + 17); ctx.lineTo(bw / 2 - 4, -bh + 17); ctx.stroke();
    // the part illustration on the box front
    const sz = 34;
    ctx.drawImage(s.cv, -sz / 2, -bh + 15, sz, sz);
    // category label along the bottom
    Z.render.pxText(ctx, s.locked ? 'SEALED' : (D.CAT_LABEL[catOf(s.it)] || 'KIT'), 0, -6, 8, s.locked ? '#8a2f22' : '#5a4a30', 'center');
    ctx.restore();
  }

  // hanging paper price tag off the shelf lip
  function drawTag(ctx, s, i, t) {
    const label = s.locked ? 'RANK ' + (UNLOCK[s.it.rarity] || 1) : '¥' + U.fmt(s.it.price);
    const rot = Math.sin(t * 1.5 + i * 1.7) * 0.06 + (s.shake > 0 ? Math.sin(t * 34) * 0.35 * s.shake : 0);
    ctx.save();
    ctx.translate(s.wx + 26, s.wy + 12); ctx.rotate(rot);
    ctx.strokeStyle = 'rgba(47,36,24,.8)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, 8); ctx.stroke();
    const tw = Math.max(38, label.length * 8 + 14);
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, -tw / 2, 8, tw, 19, 4), s.locked ? '#e8d3a0' : '#f5ecd7', { cut: 0.001, noShadow: true, ink: 1.8 });
    ctx.fillStyle = s.locked ? '#c23b2f' : '#2f2418';
    ctx.font = "700 11px 'Zen Maru Gothic', sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 18);
    ctx.restore();
  }

  // paper info card popping above the kit you stand at
  function drawCard(ctx, s, t, W) {
    const it = s.it, rc = D.rarityColor(it.rarity);
    const rows = [];
    if (s.locked) {
      rows.push({ t: ((D.RARITY[it.rarity] || {}).label || '') + ' CRATE', c: '#8a7a5c' });
      rows.push({ t: 'The oni cracks this at RANK ' + (UNLOCK[it.rarity] || 1) + '.', c: '#c23b2f' });
    } else {
      rows.push({ t: ((D.RARITY[it.rarity] || {}).label || '') + ' · ' + (D.CAT_LABEL[catOf(it)] || catOf(it).toUpperCase()), c: '#8a7a5c' });
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
    const top = s.wy - 78 - ch;
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, cx - cw / 2, top, cw, ch, 10), '#f5ecd7', { cut: 0.001 });
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

  function init() { Z.ui.onEnter('cave', enter); }
  return { init, frame, buy, sell };
})();
