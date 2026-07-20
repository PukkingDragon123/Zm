/* ================================================================
   cave.js — the RED ONI's MODEL-KIT SHOP, out front of the forge cave.
   Buy whole mech FRAMES and loose COMPONENT kits (weapon / backpack /
   reactor / servo / leg runners). Boxed kits sit on the shelves; walk
   the floor, stop at a box to read its card, ENTER to buy. The small
   oni keeper minds the left — talk to him to spot the rarest crate or
   unload your spares. (Raids now launch from the phone map at night,
   so the old SPAR/RAID standees are gone.) Economy rules mirror the
   curio shop. The uploaded forge exterior is drawn clean.
   ================================================================ */
Z.cave = (function () {
  const U = Z.util, D = Z.data;
  const UNLOCK = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 6 };
  const scrapPrice = (p) => Math.ceil(p / 5);
  const catOf = (it) => D.mechSlotOf(it);                // 5-slot model: body/head/arm/weapon/special
  const SPEED = 210, KEEPER = 'Oni Keeper';
  const GREET = 'Kits on the shelves, tanuki. Panel lines are extra.';

  const kid = { x: -70, vx: 0, facing: 1, walk: 0, turn: 0 };
  let stock = [], greeted = false, bubble = null, nearBox = null, nearKeeper = false, keeperGlow = 0;

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
    ['body', 'head', 'arm', 'weapon', 'special'].forEach((cat) => {
      const pool = all.filter((it) => catOf(it) === cat && open(it));
      if (pool.length) picks.push(U.choice(pool));
    });
    const extraPool = all.filter((it) => (catOf(it) === 'weapon' || catOf(it) === 'special') && open(it) && picks.indexOf(it) < 0);
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
    greeted = false; bubble = null; nearBox = null; nearKeeper = false; keeperGlow = 0;
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
      Z.fx.dust(s.wx, s.wy - 30, 4, '#cbb489');
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
      { label: 'Point me at the best kit.', then: [line(best ? 'That crate, top shelf: the ' + best.name + '. ' + ((D.RARITY[best.rarity] || {}).label || 'solid') + ' grade, sealed sprue, no missing runners. Costs what it costs.' : 'Shelves are picked clean. Come back when I have runners to cut.')] },
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
    Z.cutscene.play([line('Kits or spares, tanuki? Speak up.', choices)]);
  }

  // ---- the scene, called from the game loop every tick ----
  function frame(dt, t) {
    const ctx = Z.render.ctx, W = Z.render.W, H = Z.render.H;
    const groundY = H * 0.9;
    const oniW = U.clamp(H * 0.2, 110, 175), oniH = oniW * 1.18;
    const tW = U.clamp(H * 0.16, 90, 150), tH = tW * 1.12;
    const keeperX = W * 0.13;
    const minX = W * 0.3, maxX = W * 0.92;
    const sMin = W * 0.44, sMax = W * 0.82;
    const shelfY = (sh) => groundY - (sh === 0 ? H * 0.52 : H * 0.32);
    const inScene = Z.cutscene && Z.cutscene.active;
    if (!stock.length) buildStock();

    // ---- update ----
    if (kid.x < minX) {                                   // walk in past the counter
      kid.vx = SPEED; kid.x += SPEED * dt; kid.walk += dt;
      if (kid.x >= minX && !greeted) { greeted = true; bubble = { text: GREET, t: 5.0 }; }
    } else if (!inScene) {
      const dir = Z.controls ? Z.controls.dir : 0;
      if (dir && dir !== kid.facing) { kid.facing = dir; kid.turn = 1; }
      if (kid.turn > 0) kid.turn = Math.max(0, kid.turn - dt * 5);
      kid.vx = dir * SPEED;
      kid.x = U.clamp(kid.x + kid.vx * dt, minX, maxX);
      kid.walk = dir ? kid.walk + dt : 0;
    } else { kid.vx = 0; kid.walk = 0; }
    if (bubble) { bubble.t -= dt; if (bubble.t <= 0) bubble = null; }

    // proximity: keeper strip wins; otherwise the nearest shelf box
    nearKeeper = kid.x >= minX && kid.x <= minX + 46;
    const prevNear = nearBox; nearBox = null;
    if (!nearKeeper && kid.x >= minX) {
      let bd = W * 0.07, bestBox = null;
      stock.forEach((s) => { const d = Math.abs(kid.x - s.wx); if (d < bd) { bd = d; bestBox = s; } });
      nearBox = bestBox;
    }
    stock.forEach((s) => {
      s.wx = U.lerp(sMin, sMax, s.fx);
      s.wy = shelfY(s.shelf);
      if (s.hopT > 0) { s.hopT -= dt; if (s.hopT <= 0) Z.fx.dust(s.wx, s.wy - 30, 6, '#d8c08a'); }
      else if (s.gone > 0) { s.gone -= dt; if (s.gone <= 0) { s.born = 0.35; Z.fx.dust(s.wx, s.wy - 16, 3, '#cbb489'); } }
      if (s.born > 0) s.born -= dt;
      if (s.shake > 0) s.shake = Math.max(0, s.shake - dt * 2);
      s.lift = U.lerp(s.lift, s === nearBox ? 1 : 0, Math.min(1, dt * 10));
    });
    keeperGlow = U.lerp(keeperGlow, nearKeeper ? 1 : 0, Math.min(1, dt * 9));
    if (nearBox && nearBox !== prevNear && Z.audio.ctx) Z.audio.sfx.hover();

    const act = !inScene && Z.controls && Z.controls.consumeInteract();
    if (act && kid.x >= minX) {
      if (nearKeeper) keeperChat();
      else if (nearBox) tryBuy(nearBox);
    }

    // ---- draw: clean forge-cave exterior ----
    Z.render.clear();
    if (!Z.assets.cover(ctx, 'cave.forge', 0, 0, W, H, 0.5) &&
        !Z.assets.cover(ctx, 'cave.shop', 0, 0, W, H, 0.5)) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#3a2b1c'); g.addColorStop(0.6, '#281c11'); g.addColorStop(1, '#170f08');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // soft ground-contact gradient so the cutouts sit in the scene
    const gg = ctx.createLinearGradient(0, groundY - H * 0.12, 0, H);
    gg.addColorStop(0, 'rgba(28,17,7,0)'); gg.addColorStop(1, 'rgba(24,14,6,.36)');
    ctx.fillStyle = gg; ctx.fillRect(0, groundY - H * 0.12, W, H - groundY + H * 0.12);

    // shelf planks (the boxes sit on these)
    for (let sh = 0; sh < 2; sh++) {
      const sy = shelfY(sh);
      Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, sMin - 40, sy, (sMax - sMin) + 80, 12, 6), '#7c5c3a', { cut: 3 });
      ctx.strokeStyle = 'rgba(30,18,8,.3)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(sMin - 32, sy + 8); ctx.lineTo(sMax + 32, sy + 8); ctx.stroke();
    }
    // kit boxes + hanging price tags
    stock.forEach((s, i) => { drawTag(ctx, s, i, t); drawBox(ctx, s, t); });

    // the small red oni keeper on the left, idle bob
    contactShadow(ctx, keeperX, groundY, oniW * 0.42);
    if (keeperGlow > 0.02) spotGlow(ctx, keeperX, groundY, keeperGlow, '#ff9a5a');
    if (!Z.render.drawSprite('char.oni', keeperX, groundY - 4, { w: oniW, bob: Math.abs(Math.sin(t * 2.0)) * 4, squash: Math.sin(t * 2.0) * 0.02, sway: Math.sin(t * 1.6) * 0.03, facing: 1, shadow: false })) {
      ctx.fillStyle = '#7a3a2a'; ctx.fillRect(keeperX - oniW * 0.3, groundY - oniH, oniW * 0.6, oniH);
    }

    // the tanuki on the shop floor — small
    const moving = Math.abs(kid.vx) > 1;
    const hasSheet = Z.assets.ready('sheet.tanuki');
    const bobMul = tW / 120;
    const hop = (moving ? Math.abs(Math.sin(kid.walk * 9)) * (hasSheet ? 5 : 12) : Math.sin(t * 2.2) * 2.5) * bobMul;
    const squash = moving ? Math.cos(kid.walk * 18) * (hasSheet ? 0.03 : 0.06) : Math.sin(t * 2.2) * 0.025;
    contactShadow(ctx, kid.x, groundY, tW * 0.42);
    if (!Z.render.drawSprite('char.tanuki', kid.x, groundY, { w: tW, bob: hop, squash, facing: kid.facing, turn: kid.turn, sway: moving ? Math.sin(kid.walk * 9) * 0.05 : 0, anim: moving ? 'walk' : 'idle', animT: moving ? kid.walk : t, shadow: false })) {
      ctx.fillStyle = '#7a5a3a'; ctx.fillRect(kid.x - tW * 0.24, groundY - tH, tW * 0.48, tH);
    }
    if (moving && Math.random() < 0.2) Z.fx.dust(kid.x - kid.facing * 16, groundY, 1, '#c9a76b');

    // gentle day/night wash over the whole scene
    timeTint(ctx, W, H);

    Z.fx.render(ctx);
    if (bubble && !inScene) speechBubble(ctx, keeperX + oniW * 0.5, groundY - oniH - 6, bubble.text);
    if (nearKeeper && !inScene && !bubble) Z.render.pxText(ctx, 'TALK', keeperX + oniW * 0.3, groundY - oniH - 6 + Math.sin(t * 3) * 3, 10, '#fff1d6', 'center');
    if (nearBox && !inScene) drawCard(ctx, nearBox, t, W);
    if (Z.clock && Z.clock.draw) Z.clock.draw(ctx, 40, 46);
    Z.render.drawPetals(t);
  }

  // soft feet-contact shadow so a cutout sits on the floor
  function contactShadow(ctx, x, groundY, rw) {
    ctx.save();
    const g = ctx.createRadialGradient(x, groundY, 0, x, groundY, rw);
    g.addColorStop(0, 'rgba(18,10,4,.5)'); g.addColorStop(0.7, 'rgba(18,10,4,.22)'); g.addColorStop(1, 'rgba(18,10,4,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, groundY + 2, rw, rw * 0.24, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // a soft glowing spot on the ground (keeper hint)
  function spotGlow(ctx, x, gy, glow, color) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const r = 26 + glow * 30;
    const g = ctx.createRadialGradient(x, gy, 2, x, gy, r);
    g.addColorStop(0, U.rgba(color, 0.08 + glow * 0.24)); g.addColorStop(1, U.rgba(color, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, gy, r, r * 0.38, 0, 0, U.TAU); ctx.fill();
    ctx.restore();
  }

  // a boxed model kit resting on the shelf plank
  function drawBox(ctx, s, t) {
    if (s.gone > 0 && s.hopT <= 0) return;                 // sold; restocking
    const bw = 44, bh = 50;
    let scale = 1 + s.lift * 0.09, dy = -6 * s.lift, alpha = 1;
    if (s.hopT > 0) { const p = 1 - s.hopT / 0.26; dy -= 54 * U.ease.outCubic(p); scale *= 1 - p * 0.4; alpha = 1 - p * 0.7; }
    else if (s.born > 0) scale *= Math.max(0.02, U.ease.outBack(1 - s.born / 0.35));
    const jx = s.shake > 0 ? Math.sin(t * 34) * 3 * s.shake : 0;
    const cx = s.wx + jx, byBot = s.wy;
    const rc = D.rarityColor(s.it.rarity);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, byBot + dy); ctx.scale(scale, scale);
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, -bw / 2, -bh, bw, bh, 5), s.locked ? '#c7b184' : '#e7d6ac', { cut: 3 });
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, -bw / 2, -bh, bw, 11, 5), U.mixHex(rc, '#2f2418', 0.18), { cut: 2.2, noShadow: true });
    ctx.strokeStyle = 'rgba(47,36,24,.35)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-bw / 2 + 4, -bh + 15); ctx.lineTo(bw / 2 - 4, -bh + 15); ctx.stroke();
    const sz = 28;
    ctx.drawImage(s.cv, -sz / 2, -bh + 14, sz, sz);
    Z.render.pxText(ctx, s.locked ? 'SEALED' : ((D.MECH_SLOTS.find((m) => m.key === catOf(s.it)) || {}).label || 'KIT'), 0, -5, 8, s.locked ? '#8a2f22' : '#5a4a30', 'center');
    ctx.restore();
  }

  // hanging paper price tag off the shelf lip
  function drawTag(ctx, s, i, t) {
    const label = s.locked ? 'RANK ' + (UNLOCK[s.it.rarity] || 1) : '¥' + U.fmt(s.it.price);
    const rot = Math.sin(t * 1.5 + i * 1.7) * 0.06 + (s.shake > 0 ? Math.sin(t * 34) * 0.35 * s.shake : 0);
    ctx.save();
    ctx.translate(s.wx + 24, s.wy + 10); ctx.rotate(rot);
    ctx.strokeStyle = 'rgba(47,36,24,.8)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, 8); ctx.stroke();
    const tw = Math.max(38, label.length * 7.4 + 12);
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, -tw / 2, 8, tw, 18, 4), s.locked ? '#e8d3a0' : '#f5ecd7', { cut: 0.001, noShadow: true, ink: 1.6 });
    ctx.fillStyle = s.locked ? '#c23b2f' : '#2f2418';
    ctx.font = "700 11px 'Zen Maru Gothic', sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 17);
    ctx.restore();
  }

  // compact paper info card popping above the kit you stand at
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
    ctx.font = "700 14px 'Zen Maru Gothic', sans-serif";
    let wMax = ctx.measureText(it.name).width;
    ctx.font = "600 11px 'Zen Maru Gothic', sans-serif";
    rows.forEach((r) => { wMax = Math.max(wMax, ctx.measureText(r.t).width); });
    const cw = U.clamp(wMax + 24, 156, 300);
    const ch = 32 + rows.length * 15 + (s.locked ? 0 : 20);
    const cx = U.clamp(s.wx, cw / 2 + 8, W - cw / 2 - 8);
    const top = s.wy - bh0() - ch;
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, cx - cw / 2, top, cw, ch, 9), '#f5ecd7', { cut: 0.001 });
    const nx = U.clamp(s.wx, cx - cw / 2 + 16, cx + cw / 2 - 16);
    ctx.strokeStyle = '#2f2418'; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.fillStyle = '#f5ecd7';
    ctx.beginPath(); ctx.moveTo(nx - 7, top + ch - 2.5); ctx.lineTo(nx, top + ch + 8); ctx.lineTo(nx + 7, top + ch - 2.5); ctx.closePath();
    ctx.stroke(); ctx.fill();
    let ty = top + 21;
    ctx.font = "700 14px 'Zen Maru Gothic', sans-serif";
    ctx.fillStyle = U.mixHex(rc, '#2f2418', 0.25); ctx.fillText(it.name, cx - cw / 2 + 12, ty);
    ctx.font = "600 11px 'Zen Maru Gothic', sans-serif";
    rows.forEach((r) => { ty += 15; ctx.fillStyle = r.c; ctx.fillText(r.t, cx - cw / 2 + 12, ty); });
    if (!s.locked) {
      ctx.font = "700 12px 'Zen Maru Gothic', sans-serif"; ctx.textAlign = 'center';
      ctx.globalAlpha = 0.72 + 0.28 * Math.sin(t * 5);
      ctx.fillStyle = '#d94f30'; ctx.fillText('ENTER - BUY', cx, top + ch - 9);
    }
    ctx.restore();
  }
  const bh0 = () => 66;                                   // box top clearance for the card

  function speechBubble(ctx, x, y, text) {
    const lines = wrap(text, 28), w = 234, h = 18 + lines.length * 18;
    const bx = U.clamp(x, w / 2 + 10, Z.render.W - w / 2 - 10);
    const by = Math.max(h + 12, y);
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, bx - w / 2, by - h, w, h, 12), '#f5ecd7', { cut: 0.001 });
    ctx.fillStyle = '#2f2418'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = "700 14px 'Zen Maru Gothic', sans-serif";
    lines.forEach((ln, i) => ctx.fillText(ln, bx, by - h + 24 + i * 18));
  }
  function wrap(t, n) { const w = t.split(' '), out = []; let l = ''; for (const word of w) { if ((l + word).length > n) { out.push(l.trim()); l = ''; } l += word + ' '; } if (l.trim()) out.push(l.trim()); return out; }

  // gentle time-of-day wash: warm noon -> orange dusk -> cool blue night
  function timeTint(ctx, W, H) {
    const stops = [
      [0, 38, 52, 104, 0.32], [5, 54, 58, 118, 0.26], [6, 240, 168, 110, 0.16],
      [8, 255, 228, 186, 0.05], [12, 255, 244, 214, 0.0], [16, 255, 222, 172, 0.06],
      [18, 255, 150, 84, 0.18], [19, 120, 96, 140, 0.22], [21, 48, 60, 120, 0.30],
      [24, 38, 52, 104, 0.32],
    ];
    let hr = (Z.state && typeof Z.state.clock === 'number') ? Z.state.clock : 12;
    hr = ((hr % 24) + 24) % 24;
    let a = stops[0], b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) { if (hr >= stops[i][0] && hr <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; } }
    const span = (b[0] - a[0]) || 1, f = U.clamp((hr - a[0]) / span, 0, 1);
    const al = U.lerp(a[4], b[4], f);
    if (al <= 0.002) return;
    const r = U.lerp(a[1], b[1], f) | 0, g = U.lerp(a[2], b[2], f) | 0, bl = U.lerp(a[3], b[3], f) | 0;
    ctx.save();
    ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + bl + ',' + al.toFixed(3) + ')';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function init() { Z.ui.onEnter('cave', enter); }
  return { init, frame, buy, sell };
})();
