/* ================================================================
   cave.js — the RED ONI's MODEL-KIT SHOP, dug into the workshop cave.
   Buy whole mech FRAMES and loose COMPONENT kits (weapon / backpack /
   reactor / servo / leg runners). Boxed kits sit on the shelves; walk
   the floor, stop at a box to read its card, ENTER to buy. The oni
   keeper minds the counter on the left — talk to him to spot the
   rarest crate or unload your spares. Since town is now three doors,
   the two FIELD JOBS launch from here too: walk to the SPAR standee
   for an arena bout, or the RAID standee to hit a KANE-CO camp.
   Economy rules (prices, rank unlocks, scrap rate, buy/sell) mirror
   the curio shop.
   ================================================================ */
Z.cave = (function () {
  const U = Z.util, D = Z.data;
  const UNLOCK = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 6 };
  const scrapPrice = (p) => Math.ceil(p / 5);
  const catOf = (it) => (it.slots ? 'chassis' : it.category);
  const SPEED = 235, KEEPER = 'Oni Keeper';
  const GREET = 'Workshop cave. Kits on the shelves, field jobs on the standees. Panel lines are extra.';

  const kid = { x: -70, vx: 0, facing: 1, walk: 0, turn: 0 };
  let stock = [], greeted = false, bubble = null, nearBox = null, nearKeeper = false;
  let jobs = [], nearJob = null, pending = null;

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

  // ---- field jobs: build the player spec, pick a foe by rank ----
  function playerSpec() { const c = Z.Bot.compute(Z.state.build); c.spec.name = Z.state.botName; return c.spec; }
  function pickSparEnemy() {
    const tier = Z.state.rankTier || 1;
    const pool = D.enemies.filter((e) => !e.isChampion);
    let list = pool.filter((e) => e.tier === tier);
    if (!list.length) list = pool.filter((e) => e.tier <= tier).sort((a, b) => b.tier - a.tier);
    if (!list.length) list = pool.slice().sort((a, b) => a.tier - b.tier);
    return U.choice(list.length ? list : D.enemies);
  }
  function startSpar() {
    const en = pickSparEnemy();
    if (!en) { Z.audio.sfx.error(); Z.ui.toast('No sparring partner free', 'warn'); return; }
    Z.audio.sfx.click();
    Z.combat.start(playerSpec(), en, { rp: 15 + en.tier * 12 });
  }
  function startRaid() { Z.audio.sfx.click(); Z.ui.show('infil'); }

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

  function buildJobs() {
    jobs = [
      { key: 'spar', title: 'SPAR', sub: 'ARENA BOUT', color: '#c33a2c', prompt: 'ENTER - SPAR', run: startSpar, glow: 0 },
      { key: 'raid', title: 'RAID', sub: 'KANE-CO CAMP', color: '#3f7d55', prompt: 'ENTER - RAID', run: startRaid, glow: 0 },
    ];
  }

  function enter() {
    kid.x = -70; kid.vx = 0; kid.facing = 1; kid.walk = 0; kid.turn = 0;
    greeted = false; bubble = null; nearBox = null; nearKeeper = false; nearJob = null; pending = null;
    buildJobs();
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
      { label: 'Line me up a spar.', act: () => { pending = 'spar'; }, then: [line('The arena standee, by the door. Step on the plate and I will find you a rival off the ladder. Bring your best frame.')] },
      { label: 'I want to raid a KANE-CO camp.', act: () => { pending = 'raid'; }, then: [line('Bold. The camp map is on the far standee — pick a fence to slip, grab their crates, and get out before the sirens.')] },
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
    pending = null;
    Z.cutscene.play([line('Kits, jobs, or spares, tanuki? Speak up.', choices)], () => {
      const p = pending; pending = null;
      if (p === 'spar') startSpar();
      else if (p === 'raid') startRaid();
    });
  }

  // ---- the scene, called from the game loop every tick ----
  function frame(dt, t) {
    const ctx = Z.render.ctx, W = Z.render.W, H = Z.render.H;
    const groundY = H * 0.86;
    const oniW = U.clamp(H * 0.46, 220, 330), oniH = oniW * 1.18;
    const tW = U.clamp(H * 0.38, 190, 320), tH = tW * 1.12;
    const keeperX = W * 0.12;
    const minX = W * 0.30, maxX = W * 0.93;
    const sMin = W * 0.42, sMax = W * 0.80;
    const shelfY = (sh) => groundY - (sh === 0 ? H * 0.40 : H * 0.205);
    const inScene = Z.cutscene && Z.cutscene.active;
    if (!stock.length) buildStock();
    if (!jobs.length) buildJobs();
    jobs[0].x = minX + (maxX - minX) * 0.26;              // SPAR: left-of-centre, clear of the resting tanuki
    jobs[1].x = maxX - 24;                                 // RAID: far right by the exit steps
    jobs[0].gy = jobs[1].gy = groundY;

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

    // proximity: keeper strip wins; otherwise pick whichever is closer,
    // a field-job standee or a shelf box — so every box stays reachable.
    nearKeeper = kid.x >= minX && kid.x <= minX + 42;
    const prevJob = nearJob, prevNear = nearBox;
    nearJob = null; nearBox = null;
    if (!nearKeeper && kid.x >= minX) {
      let jd = 62, bd = 74, bestJob = null, bestBox = null;
      jobs.forEach((j) => { const d = Math.abs(kid.x - j.x); if (d < jd) { jd = d; bestJob = j; } });
      stock.forEach((s) => { const d = Math.abs(kid.x - s.wx); if (d < bd) { bd = d; bestBox = s; } });
      if (bestJob && (!bestBox || jd <= bd)) nearJob = bestJob;
      else nearBox = bestBox;
    }
    stock.forEach((s) => {
      s.wx = U.lerp(sMin, sMax, s.fx);
      s.wy = shelfY(s.shelf);                              // plank top the box rests on
      if (s.hopT > 0) { s.hopT -= dt; if (s.hopT <= 0) Z.fx.dust(s.wx, s.wy - 44, 6, '#d8c08a'); }
      else if (s.gone > 0) { s.gone -= dt; if (s.gone <= 0) { s.born = 0.35; Z.fx.dust(s.wx, s.wy - 22, 3, '#cbb489'); } }
      if (s.born > 0) s.born -= dt;
      if (s.shake > 0) s.shake = Math.max(0, s.shake - dt * 2);
      s.lift = U.lerp(s.lift, s === nearBox ? 1 : 0, Math.min(1, dt * 10));
    });
    jobs.forEach((j) => { j.glow = U.lerp(j.glow || 0, j === nearJob ? 1 : 0, Math.min(1, dt * 9)); });
    if (nearBox && nearBox !== prevNear && Z.audio.ctx) Z.audio.sfx.hover();
    if (nearJob && nearJob !== prevJob && Z.audio.ctx) Z.audio.sfx.hover();

    const act = !inScene && Z.controls && Z.controls.consumeInteract();
    if (act && kid.x >= minX) {
      if (nearKeeper) keeperChat();
      else if (nearJob) nearJob.run();
      else if (nearBox) tryBuy(nearBox);
    }

    // ---- draw ----
    Z.render.clear();
    if (!Z.assets.cover(ctx, 'cave.shop', 0, 0, W, H, 0.5)) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#3a2b1c'); g.addColorStop(0.6, '#281c11'); g.addColorStop(1, '#170f08');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // clean, light warm vignette only — let the painted cave read
    const vg = ctx.createRadialGradient(W * 0.5, H * 0.46, Math.min(W, H) * 0.28, W * 0.5, H * 0.5, Math.max(W, H) * 0.66);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(24,14,6,.34)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    // a single soft warm lamp over the counter so the keeper reads
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const lg = ctx.createRadialGradient(keeperX + W * 0.03, H * 0.26, 10, keeperX + W * 0.03, H * 0.26, W * 0.3);
    lg.addColorStop(0, 'rgba(255,196,112,.1)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
    ctx.restore();
    // soft ground-contact gradient so the cutouts sit in the scene
    const gg = ctx.createLinearGradient(0, groundY - 40, 0, H);
    gg.addColorStop(0, 'rgba(28,17,7,0)'); gg.addColorStop(1, 'rgba(24,14,6,.42)');
    ctx.fillStyle = gg; ctx.fillRect(0, groundY - 40, W, H - groundY + 40);

    // shelf planks (the boxes sit on these)
    for (let sh = 0; sh < 2; sh++) {
      const sy = shelfY(sh);
      Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, sMin - 64, sy, (sMax - sMin) + 128, 16, 7), '#7c5c3a', { cut: 3.6 });
      ctx.strokeStyle = 'rgba(30,18,8,.3)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(sMin - 54, sy + 11); ctx.lineTo(sMax + 54, sy + 11); ctx.stroke();
    }
    // kit boxes + hanging price tags
    stock.forEach((s, i) => { drawTag(ctx, s, i, t); drawBox(ctx, s, t); });

    // the two field-job standees on the floor (behind the walkers)
    jobs.forEach((j) => drawStandee(ctx, j, H, t));

    // the red oni keeper behind the left counter, idle bob
    contactShadow(ctx, keeperX, groundY, oniW * 0.44);
    if (!Z.render.drawSprite('char.oni', keeperX, groundY - 4, { w: oniW, bob: Math.abs(Math.sin(t * 2.0)) * 6, squash: Math.sin(t * 2.0) * 0.02, sway: Math.sin(t * 1.6) * 0.03, facing: 1, shadow: false })) {
      ctx.fillStyle = '#7a3a2a'; ctx.fillRect(keeperX - oniW * 0.3, groundY - oniH, oniW * 0.6, oniH);
    }
    // the counter slab in front of the oni
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, W * 0.005, groundY - 92, W * 0.255, 108, 10), '#8a5a38', { cut: 4.5 });
    ctx.strokeStyle = 'rgba(30,18,8,.32)'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(W * 0.02, groundY - 58); ctx.lineTo(W * 0.245, groundY - 58); ctx.stroke();
    // a small "COMPONENTS" placard on the counter
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, keeperX + oniW * 0.16, groundY - 118, 92, 22, 4), '#c9803f', { cut: 2.6, noShadow: true });
    Z.render.pxText(ctx, 'COMPONENTS', keeperX + oniW * 0.16 + 46, groundY - 103, 10, '#fff1d6', 'center');

    // the tanuki on the shop floor
    const moving = Math.abs(kid.vx) > 1;
    const hasSheet = Z.assets.ready('sheet.tanuki');
    const bobMul = tW / 120;
    const hop = (moving ? Math.abs(Math.sin(kid.walk * 9)) * (hasSheet ? 5 : 12) : Math.sin(t * 2.2) * 2.5) * bobMul;
    const squash = moving ? Math.cos(kid.walk * 18) * (hasSheet ? 0.03 : 0.06) : Math.sin(t * 2.2) * 0.025;
    contactShadow(ctx, kid.x, groundY, tW * 0.42);
    if (!Z.render.drawSprite('char.tanuki', kid.x, groundY, { w: tW, bob: hop, squash, facing: kid.facing, turn: kid.turn, sway: moving ? Math.sin(kid.walk * 9) * 0.05 : 0, anim: moving ? 'walk' : 'idle', animT: moving ? kid.walk : t, shadow: false })) {
      ctx.fillStyle = '#7a5a3a'; ctx.fillRect(kid.x - tW * 0.24, groundY - tH, tW * 0.48, tH);
    }
    if (moving && Math.random() < 0.2) Z.fx.dust(kid.x - kid.facing * 20, groundY, 1, '#c9a76b');

    Z.fx.render(ctx);
    if (bubble && !inScene) speechBubble(ctx, keeperX + oniW * 0.5, groundY - oniH - 6, bubble.text);
    if (nearKeeper && !inScene && !bubble) Z.render.pxText(ctx, 'ENTER - TALK', keeperX + oniW * 0.4, groundY - oniH - 6 + Math.sin(t * 3) * 3, 13, '#f5ecd7', 'center');
    if (nearJob && !inScene) {
      const py = groundY - jobBoardH(H) - jobPostH(H) - 22 + Math.sin(t * 3) * 3;
      Z.render.pxText(ctx, nearJob.prompt, nearJob.x, py, 13, '#fff1d6', 'center');
    }
    if (nearBox && !inScene) drawCard(ctx, nearBox, t, W);
    Z.render.drawPetals(t);
  }

  // soft feet-contact shadow so a big cutout sits on the floor
  function contactShadow(ctx, x, groundY, rw) {
    ctx.save();
    const g = ctx.createRadialGradient(x, groundY, 0, x, groundY, rw);
    g.addColorStop(0, 'rgba(18,10,4,.5)'); g.addColorStop(0.7, 'rgba(18,10,4,.22)'); g.addColorStop(1, 'rgba(18,10,4,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, groundY + 2, rw, rw * 0.24, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ---- field-job standee: a bold recruit board on a wooden post ----
  const jobBoardW = (H) => U.clamp(H * 0.2, 116, 168);
  const jobBoardH = (H) => U.clamp(H * 0.15, 92, 128);
  const jobPostH = (H) => U.clamp(H * 0.16, 96, 150);
  function drawStandee(ctx, j, H, t) {
    const x = j.x, gy = j.gy, w = jobBoardW(H), h = jobBoardH(H), postH = jobPostH(H);
    const glow = j.glow || 0, lift = glow * 6, top = gy - postH - h - lift;
    contactShadow(ctx, x, gy, w * 0.42);
    // wooden post + foot
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, x - 8, gy - postH - lift, 16, postH, 4), '#6f4f30', { cut: 3 });
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, x - 26, gy - 12, 52, 14, 5), '#5a3f26', { cut: 2.6, noShadow: true });
    // glow halo when the tanuki is standing at the plate
    if (glow > 0.02) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const hg = ctx.createRadialGradient(x, top + h / 2, 4, x, top + h / 2, w * 0.9);
      hg.addColorStop(0, U.rgba(j.color, 0.28 * glow)); hg.addColorStop(1, U.rgba(j.color, 0));
      ctx.fillStyle = hg; ctx.fillRect(x - w, top - h, w * 2, h * 2.4); ctx.restore();
    }
    // the board
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, x - w / 2, top, w, h, 12), '#efe0bb', { cut: 3 });
    // coloured header band
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, x - w / 2, top, w, h * 0.42, 12), j.color, { cut: 2.6, noShadow: true });
    Z.render.pxText(ctx, j.title, x, top + h * 0.42 - 8, Math.round(h * 0.24), '#fff4e2', 'center');
    // ring / target motif under the header
    ctx.save();
    ctx.strokeStyle = U.mixHex(j.color, '#2f2418', 0.2); ctx.lineWidth = 3; ctx.lineJoin = 'round';
    const cy = top + h * 0.66, r = h * 0.15;
    if (j.key === 'spar') {                                // twin arena crescents
      ctx.beginPath(); ctx.arc(x - r * 0.5, cy, r, Math.PI * 0.35, Math.PI * 1.4); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + r * 0.5, cy, r, Math.PI * 1.35, Math.PI * 0.4); ctx.stroke();
    } else {                                               // a camp fence + flag
      ctx.beginPath();
      for (let i = -2; i <= 2; i++) { const px = x + i * (r * 0.55); ctx.moveTo(px, cy + r); ctx.lineTo(px, cy - r * 0.4); }
      ctx.moveTo(x - r * 1.2, cy - r * 0.4); ctx.lineTo(x + r * 1.2, cy - r * 0.4); ctx.stroke();
      ctx.fillStyle = j.color; ctx.beginPath(); ctx.moveTo(x + r * 0.9, cy - r); ctx.lineTo(x + r * 1.6, cy - r * 0.7); ctx.lineTo(x + r * 0.9, cy - r * 0.4); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    Z.render.pxText(ctx, j.sub, x, top + h - 9, Math.round(h * 0.13), '#7a5a34', 'center');
  }

  // a boxed model kit resting on the shelf plank
  function drawBox(ctx, s, t) {
    if (s.gone > 0 && s.hopT <= 0) return;                 // sold; restocking
    const bw = 76, bh = 84;
    let scale = 1 + s.lift * 0.09, dy = -8 * s.lift, alpha = 1;
    if (s.hopT > 0) { const p = 1 - s.hopT / 0.26; dy -= 78 * U.ease.outCubic(p); scale *= 1 - p * 0.4; alpha = 1 - p * 0.7; }
    else if (s.born > 0) scale *= Math.max(0.02, U.ease.outBack(1 - s.born / 0.35));
    const jx = s.shake > 0 ? Math.sin(t * 34) * 3 * s.shake : 0;
    const cx = s.wx + jx, byBot = s.wy;
    const rc = D.rarityColor(s.it.rarity);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, byBot + dy); ctx.scale(scale, scale);
    // box body
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, -bw / 2, -bh, bw, bh, 6), s.locked ? '#c7b184' : '#e7d6ac', { cut: 3.4 });
    // coloured lid band (rarity)
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, -bw / 2, -bh, bw, 18, 6), U.mixHex(rc, '#2f2418', 0.18), { cut: 2.6, noShadow: true });
    // panel line under the lid
    ctx.strokeStyle = 'rgba(47,36,24,.35)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-bw / 2 + 5, -bh + 24); ctx.lineTo(bw / 2 - 5, -bh + 24); ctx.stroke();
    // the part illustration on the box front
    const sz = 48;
    ctx.drawImage(s.cv, -sz / 2, -bh + 22, sz, sz);
    // category label along the bottom
    Z.render.pxText(ctx, s.locked ? 'SEALED' : (D.CAT_LABEL[catOf(s.it)] || 'KIT'), 0, -8, 10, s.locked ? '#8a2f22' : '#5a4a30', 'center');
    ctx.restore();
  }

  // hanging paper price tag off the shelf lip
  function drawTag(ctx, s, i, t) {
    const label = s.locked ? 'RANK ' + (UNLOCK[s.it.rarity] || 1) : '¥' + U.fmt(s.it.price);
    const rot = Math.sin(t * 1.5 + i * 1.7) * 0.06 + (s.shake > 0 ? Math.sin(t * 34) * 0.35 * s.shake : 0);
    ctx.save();
    ctx.translate(s.wx + 36, s.wy + 14); ctx.rotate(rot);
    ctx.strokeStyle = 'rgba(47,36,24,.8)'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, 10); ctx.stroke();
    const tw = Math.max(44, label.length * 9 + 16);
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, -tw / 2, 10, tw, 22, 5), s.locked ? '#e8d3a0' : '#f5ecd7', { cut: 0.001, noShadow: true, ink: 1.8 });
    ctx.fillStyle = s.locked ? '#c23b2f' : '#2f2418';
    ctx.font = "700 13px 'Zen Maru Gothic', sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 21);
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
    const top = s.wy - 96 - ch;
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
    const lines = wrap(text, 28), w = 268, h = 20 + lines.length * 20;
    const bx = U.clamp(x, w / 2 + 10, Z.render.W - w / 2 - 10);
    const by = Math.max(h + 12, y);
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, bx - w / 2, by - h, w, h, 14), '#f5ecd7', { cut: 0.001 });
    ctx.fillStyle = '#2f2418'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = "700 15px 'Zen Maru Gothic', sans-serif";
    lines.forEach((ln, i) => ctx.fillText(ln, bx, by - h + 26 + i * 20));
  }
  function wrap(t, n) { const w = t.split(' '), out = []; let l = ''; for (const word of w) { if ((l + word).length > n) { out.push(l.trim()); l = ''; } l += word + ' '; } if (l.trim()) out.push(l.trim()); return out; }

  function init() { Z.ui.onEnter('cave', enter); }
  return { init, frame, buy, sell, startSpar, startRaid };
})();
