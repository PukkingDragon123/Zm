/* ================================================================
   infil.js — KANE-CO CAMPS. Sneak-in parkour platformer levels
   (Mario/Celeste-lite): coyote time, jump buffering, guards with
   vision cones, and the tanuki's HENGE transformations —
   ROCK (heavy, smash, hide), PAPER (glide, ride updrafts),
   SCISSORS (dash-cut fences). Rewards: parts + scrap.
   ================================================================ */
Z.infil = (function () {
  const U = Z.util, D = Z.data;
  const TILE = 46;
  const FORMS = ['tanuki', 'rock', 'paper', 'scissors'];
  const FORM_LABEL = { tanuki: 'TANUKI', rock: 'ROCK', paper: 'PAPER', scissors: 'SCISSORS' };
  const GOLD = '#ffd98a', SPIRIT = '#8fe6cf';

  // ---- levels: # crate | = platform | ^ spikes | C cracked (rock smash)
  //      F fence (scissors cut) | U updraft (paper rises) | G guard | * part | s scrap
  //      P start | E exit
  const LEVELS = [
    {
      id: 'camp1', name: 'Supply Yard', hint: 'Smash crates as ROCK. Cut fences as SCISSORS.', minRank: 1,
      reward: { parts: 2, rarity: 'uncommon', scrap: 20 },
      map: [
        '..............................................',
        '..............................................',
        '..............*...............................',
        '............#####.............................',
        '.....................=....*..................E',
        '........=..........#####..........s........###',
        '..................................##..F.......',
        '..P......C..............................F.....',
        '.####...###....==...........#####..###.F...###',
        '.####...###.............^^..#####..###.####...',
        '.####...###..#####......#########..###########',
      ],
    },
    {
      id: 'camp2', name: 'Watch Post', hint: 'Guards ignore a still ROCK. Ride vents as PAPER.', minRank: 2,
      reward: { parts: 2, rarity: 'rare', scrap: 35 },
      map: [
        '..............................#...............',
        '..........................*..#...............E',
        '........................####..#............####',
        '..............................#......=........',
        '....=.........................#...............',
        '..........=........s..........#..U............',
        '..P...............###.........#..U.....G......',
        '.###....G......................#..U...######...',
        '.###..######....==....^^......##..U............',
        '.###..######........######....##..U...########.',
        '.############.......######....################.',
      ],
    },
    {
      id: 'camp3', name: 'Depot Roof', hint: 'Chain glides. Time the patrols. Take their best parts.', minRank: 3,
      reward: { parts: 3, rarity: 'epic', scrap: 60 },
      map: [
        '...................*..........................',
        '..................###..........U....*.........',
        '..........................F....U...####......E',
        '....=......=......=.......F....U...........####',
        '...........................F..................',
        '..P.....................####..........G.......',
        '.###........G..................^^...#####.....',
        '.###......#####....==..==......##.............',
        '.###..^^..#####................##....s....^^^..',
        '.#############...C#C...########################',
        '.#############...###...########################',
      ],
    },
  ];

  let mode = 'select';           // select | play | done
  let lvl = null, grid = null, W0 = 0, H0 = 0;
  let p = null, guards = [], pickups = [], broken = null, cut = null;
  let camX = 0, camY = 0, t = 0, deaths = 0, got = [], alarmT = 0, doneT = 0;
  let coyote = 0, jbuf = 0, formPoof = 0;

  // ---------- level select ----------
  function renderSelect() {
    const host = document.getElementById('infilList'); if (!host) return; U.clear(host);
    host.style.display = '';
    LEVELS.forEach((L) => {
      const done = !!Z.state.campsDone[L.id], locked = Z.state.rankTier < L.minRank;
      const card = U.el('div', 'quest' + (done ? ' done' : '') + (locked ? ' locked' : ''));
      card.innerHTML = `${done ? '<div class="q-badge">CLEARED</div>' : ''}<h3>${L.name}</h3>
        <p>${L.hint}</p>
        <div class="q-foot"><span class="q-rew">${L.reward.parts} parts (${L.reward.rarity}+) · ${L.reward.scrap} scrap</span>
        <span style="color:var(--ink2)">${locked ? 'Needs rank ' + L.minRank : ''}</span></div>`;
      if (!locked) {
        const b = U.el('button', 'pbtn ' + (done ? 'tiny' : 'stamp'), done ? 'SNEAK AGAIN (1 part)' : 'SNEAK IN');
        b.addEventListener('click', () => startLevel(L));
        card.appendChild(b);
      }
      host.appendChild(card);
    });
  }

  function startLevel(L) {
    lvl = L; const wmax = Math.max.apply(null, L.map.map((r) => r.length));
    grid = L.map.map((r) => r.padEnd(wmax, '.').split(''));
    H0 = grid.length; W0 = grid[0].length;
    guards = []; pickups = []; broken = {}; cut = {};
    let sx = 2, sy = 2;
    for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) {
      const c = grid[y][x];
      if (c === 'P') { sx = x; sy = y; grid[y][x] = '.'; }
      else if (c === 'G') { guards.push({ x: x * TILE + TILE / 2, y: (y + 1) * TILE, dir: 1, x0: x * TILE - TILE * 2.4, x1: x * TILE + TILE * 3.4, ph: Math.random() * 6 }); grid[y][x] = '.'; }
      else if (c === '*' || c === 's') { pickups.push({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, kind: c === '*' ? 'part' : 'scrap', got: false }); grid[y][x] = '.'; }
    }
    p = { x: sx * TILE + TILE / 2, y: (sy + 1) * TILE, vx: 0, vy: 0, form: 'tanuki', facing: 1, onG: false, walk: 0, dashT: 0, spawn: { x: sx * TILE + TILE / 2, y: (sy + 1) * TILE } };
    deaths = 0; got = []; alarmT = 0; doneT = 0; t = 0; mode = 'play';
    document.getElementById('infilList').style.display = 'none';
    document.getElementById('infilHud').style.display = '';
    Z.controls.setMode('infil');
    Z.ui.toast('SKILL key changes form — tanuki, rock, paper, scissors', 'gold');
  }

  // ---------- tiles ----------
  const at = (tx, ty) => (tx < 0 || tx >= W0 || ty < 0 || ty >= H0) ? (ty >= H0 ? '.' : '#') : grid[ty][tx];
  function solidAt(px, py, form) {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    const c = at(tx, ty);
    if (c === '#') return true;
    if (c === 'C') return !broken[tx + ',' + ty];
    if (c === 'F') return !cut[tx + ',' + ty];
    return false;
  }
  function platAt(px, py) { const c = at(Math.floor(px / TILE), Math.floor(py / TILE)); return c === '='; }

  // ---------- update ----------
  const PHYS = {
    tanuki:   { run: 230, jump: 660, grav: 1900, fall: 900, size: 30 },
    rock:     { run: 110, jump: 0,   grav: 2600, fall: 1400, size: 30 },
    paper:    { run: 170, jump: 430, grav: 620,  fall: 110,  size: 26 },
    scissors: { run: 250, jump: 580, grav: 1900, fall: 900, size: 26 },
  };

  function update(dt) {
    if (mode !== 'play') { if (mode === 'done') { doneT += dt; } return; }
    t += dt;
    const ph = PHYS[p.form];
    const dir = Z.controls.dir;
    if (dir) p.facing = dir;
    // form cycle
    if (Z.controls.consumeSkill()) {
      const i = FORMS.indexOf(p.form); p.form = FORMS[(i + 1) % FORMS.length];
      formPoof = 0.4; Z.fx.dust(p.x, p.y, 8, '#cbb489'); Z.fx.ring(p.x, p.y - 20, SPIRIT, 4, 50, 0.3);
      Z.audio.sfx.flip(); Z.ui.toast(FORM_LABEL[p.form], 'gold');
    }
    if (formPoof > 0) formPoof -= dt;
    // scissors dash (attack key too)
    if (p.form === 'scissors' && Z.controls.consumeAttack()) {
      if (p.dashT <= 0) { p.dashT = 0.22; Z.fx.speedLines(0.16, SPIRIT); Z.audio.sfx.boost(); }
    }
    if (p.dashT > 0) { p.dashT -= dt; p.vx = p.facing * 560; p.vy = 0; cutFences(); }
    else p.vx += (dir * ph.run - p.vx) * Math.min(1, dt * 14);

    // jumping: buffer + coyote (paper can always flap weakly)
    if (Z.controls.consumeJump()) jbuf = 0.12;
    if (jbuf > 0) jbuf -= dt;
    if (p.onG) coyote = 0.1; else if (coyote > 0) coyote -= dt;
    if (jbuf > 0 && (coyote > 0 || p.form === 'paper') && ph.jump) {
      if (coyote > 0 || p.form !== 'paper' || p.vy < 60) {
        p.vy = -ph.jump; jbuf = 0; coyote = 0;
        Z.fx.dust(p.x, p.y, 4, '#cbb489'); Z.audio.sfx.flip();
      }
    }
    // gravity (+ updraft for paper)
    let grav = ph.grav;
    if (p.form === 'paper' && inUpdraft()) { p.vy = Math.max(p.vy - 2200 * dt, -260); Z.fx.dust(p.x + U.rand(-10, 10), p.y, 1, '#e8d9b5'); }
    else p.vy = Math.min(p.vy + grav * dt, ph.fall * (p.form === 'paper' && !Z.controls.held.up ? 1 : p.form === 'paper' ? 0.55 : 1));

    // integrate + collide (simple AABB vs tiles)
    const sz = ph.size, half = sz / 2;
    const fellFrom = p.vy;
    p.x += p.vx * dt;
    if (p.vx > 0 && (solidAt(p.x + half, p.y - 6) || solidAt(p.x + half, p.y - sz + 4))) { p.x = Math.floor((p.x + half) / TILE) * TILE - half - 0.1; p.vx = 0; }
    if (p.vx < 0 && (solidAt(p.x - half, p.y - 6) || solidAt(p.x - half, p.y - sz + 4))) { p.x = (Math.floor((p.x - half) / TILE) + 1) * TILE + half + 0.1; p.vx = 0; }
    p.y += p.vy * dt;
    p.onG = false;
    if (p.vy > 0) {
      const gy = p.y, feetSolid = solidAt(p.x - half * 0.7, gy, p.form) || solidAt(p.x + half * 0.7, gy, p.form);
      const feetPlat = (platAt(p.x - half * 0.7, gy) || platAt(p.x + half * 0.7, gy)) && (gy % TILE) < 18;
      if (feetSolid || feetPlat) {
        p.y = Math.floor(gy / TILE) * TILE; p.vy = 0; p.onG = true;
        if (fellFrom > 700) { Z.fx.dust(p.x, p.y, 6, '#cbb489'); Z.fx.addShake(p.form === 'rock' ? 5 : 2); if (p.form === 'rock') { smashBelow(); Z.audio.sfx.hammer(); } }
      }
    } else if (p.vy < 0) {
      if (solidAt(p.x, p.y - sz)) { p.y = (Math.floor((p.y - sz) / TILE) + 1) * TILE + sz; p.vy = 0; }
    }
    if (p.onG && p.form === 'rock') smashBelow();
    p.walk = Math.abs(p.vx) > 20 && p.onG ? p.walk + dt : 0;

    // hazards: spikes + falling out
    const tc = at(Math.floor(p.x / TILE), Math.floor((p.y - 8) / TILE));
    if (tc === '^' && p.form !== 'rock') return die('Spikes! Ouch.');
    if (p.y > H0 * TILE + 200) return die('Long way down.');

    // pickups
    for (const pk of pickups) {
      if (pk.got) continue;
      if (Math.abs(pk.x - p.x) < 30 && Math.abs(pk.y - (p.y - 16)) < 34) {
        pk.got = true; got.push(pk.kind);
        Z.fx.confetti(pk.x, pk.y, 8); Z.audio.sfx.found(pk.kind === 'part' ? 'rare' : 'common');
      }
    }
    // guards: patrol + vision
    if (alarmT > 0) alarmT -= dt;
    for (const g of guards) {
      g.x += g.dir * 46 * dt;
      if (g.x < g.x0) { g.x = g.x0; g.dir = 1; } if (g.x > g.x1) { g.x = g.x1; g.dir = -1; }
      // vision cone: facing dir, 5 tiles, roughly same height band
      const dx = p.x - g.x, dy = (p.y - 10) - (g.y - 26);
      const inCone = Math.sign(dx) === g.dir && Math.abs(dx) < TILE * 4.6 && Math.abs(dy) < TILE * 1.4;
      const hiddenRock = p.form === 'rock' && Math.abs(p.vx) < 12 && p.onG;
      if (inCone && !hiddenRock) {
        deaths++;
        Z.fx.screenFlash(0.4, '#c23b2f'); Z.fx.bigText('SPOTTED!', { color: '#ffb0a0', size: 34, ring: false, y: 0.3, dur: 0.9 });
        Z.audio.sfx.error();
        p.x = p.spawn.x; p.y = p.spawn.y; p.vx = p.vy = 0; alarmT = 1;
        return;
      }
    }
    // exit
    const ec = at(Math.floor(p.x / TILE), Math.floor((p.y - 10) / TILE));
    if (ec === 'E') return finish();
    camX = U.lerp(camX, U.clamp(p.x - Z.render.W / 2, 0, W0 * TILE - Z.render.W), Math.min(1, dt * 6));
    camY = U.lerp(camY, U.clamp(p.y - Z.render.H * 0.62, -TILE * 2, Math.max(0, H0 * TILE - Z.render.H + TILE)), Math.min(1, dt * 6));
  }
  function inUpdraft() { return at(Math.floor(p.x / TILE), Math.floor((p.y - 10) / TILE)) === 'U' || at(Math.floor(p.x / TILE), Math.floor((p.y - 40) / TILE)) === 'U'; }
  function smashBelow() {
    const tx = Math.floor(p.x / TILE), ty = Math.floor((p.y + 6) / TILE);
    if (at(tx, ty) === 'C' && !broken[tx + ',' + ty]) {
      broken[tx + ',' + ty] = true;
      Z.fx.debris(tx * TILE + TILE / 2, ty * TILE + TILE / 2, 12, '#b0844f'); Z.fx.addShake(4); Z.audio.sfx.hammer();
    }
  }
  function cutFences() {
    const tx = Math.floor((p.x + p.facing * 26) / TILE);
    for (let dy = -1; dy <= 0; dy++) {
      const ty = Math.floor((p.y - 10) / TILE) + dy;
      if (at(tx, ty) === 'F' && !cut[tx + ',' + ty]) {
        cut[tx + ',' + ty] = true;
        Z.fx.sparks(tx * TILE + TILE / 2, ty * TILE + TILE / 2, 0, 10, SPIRIT, Math.PI, 260); Z.audio.sfx.hit(1);
      }
    }
  }
  function die(msg) {
    deaths++; Z.fx.screenFlash(0.4, '#c23b2f'); Z.audio.sfx.error();
    Z.ui.toast(msg, 'warn');
    p.x = p.spawn.x; p.y = p.spawn.y; p.vx = p.vy = 0;
  }
  function finish() {
    mode = 'done'; doneT = 0;
    const repeat = !!Z.state.campsDone[lvl.id];
    Z.state.campsDone[lvl.id] = true;
    // rewards: parts weighted at the camp's rarity floor
    const parts = [];
    const n = repeat ? 1 : lvl.reward.parts + got.filter((k) => k === 'part').length;
    const floor = D.rarityRank(lvl.reward.rarity);
    for (let i = 0; i < n; i++) {
      const pool = D.parts.filter((x) => D.rarityRank(x.rarity) >= Math.max(0, floor - (i ? 1 : 0)));
      const part = U.weighted(pool, (x) => x.dropWeight + 4);
      Z.state.addItem(part.id, 1); parts.push(part);
    }
    const scrap = (repeat ? 10 : lvl.reward.scrap) + got.filter((k) => k === 'scrap').length * 8;
    Z.state.addScrap(scrap);
    Z.state.stats.rareFinds += parts.filter((x) => D.rarityRank(x.rarity) >= 2).length;
    Z.state.persist(); Z.quests.check();
    Z.fx.confetti(Z.render.W / 2, Z.render.H * 0.4, 40); Z.audio.sfx.win();
    Z.cutscene.play([
      { who: 'HAUL', text: 'Slipped out with ' + parts.map((x) => x.name).join(', ') + ' and ' + scrap + ' scrap.' + (deaths ? ' Got caught ' + deaths + ' time' + (deaths > 1 ? 's' : '') + '. The tanuki forgives.' : ' A ghost. KANE-CO never knew.') },
    ], () => { mode = 'select'; document.getElementById('infilHud').style.display = 'none'; Z.controls.setMode('none'); renderSelect(); Z.ui.updateWallet(); });
  }

  // ---------- render ----------
  function frame(dt, tt) {
    const ctx = Z.render.ctx, W = Z.render.W, H = Z.render.H;
    Z.render.clear();
    // night camp sky
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1d2233'); g.addColorStop(0.6, '#2a2438'); g.addColorStop(1, '#241a12');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // paper moon + clouds
    Z.render.paperFill(ctx, () => { ctx.beginPath(); ctx.arc(W * 0.78, H * 0.16, 44, 0, U.TAU); }, '#f6e9c4', { cut: 4 });
    Z.render.drawTheater(tt, camX);
    if (mode === 'select') { Z.render.drawForeground(tt, 0); Z.render.drawPetals(tt); return; }

    update(dt);

    ctx.save(); ctx.translate(-camX | 0, -camY | 0);
    // sweeping searchlights
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 2; i++) {
      const bx = W0 * TILE * (0.3 + i * 0.45), sway = Math.sin(tt * 0.5 + i * 2) * 0.5;
      const grd = ctx.createLinearGradient(bx, 0, bx, H0 * TILE);
      grd.addColorStop(0, 'rgba(255,240,190,.12)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.moveTo(bx - 20, -40); ctx.lineTo(bx + 20, -40);
      ctx.lineTo(bx + 20 + sway * 300 + 130, H0 * TILE); ctx.lineTo(bx - 20 + sway * 300 - 130, H0 * TILE); ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    // tiles
    for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) {
      const c = grid[y][x], px = x * TILE, py = y * TILE;
      if (px - camX < -TILE || px - camX > W + TILE || py - camY < -TILE || py - camY > H + TILE) continue;
      if (c === '#') drawCrate(ctx, px, py, false);
      else if (c === 'C') { if (!broken[x + ',' + y]) drawCrate(ctx, px, py, true); }
      else if (c === '=') { Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, px + 2, py + 4, TILE - 4, 12, 5), '#a97c4f', { noShadow: true, cut: 3 }); }
      else if (c === '^') { for (let k = 0; k < 3; k++) { Z.render.paperFill(ctx, () => { ctx.beginPath(); ctx.moveTo(px + k * (TILE / 3), py + TILE); ctx.lineTo(px + k * (TILE / 3) + TILE / 6, py + TILE - 20); ctx.lineTo(px + (k + 1) * (TILE / 3), py + TILE); ctx.closePath(); }, '#8a8fa3', { noShadow: true, cut: 2.4 }); } }
      else if (c === 'F') { if (!cut[x + ',' + y]) drawFence(ctx, px, py); }
      else if (c === 'U') { drawVent(ctx, px, py, tt); }
      else if (c === 'E') { drawExit(ctx, px, py, tt); }
    }
    // pickups
    for (const pk of pickups) {
      if (pk.got) continue;
      const bob = Math.sin(tt * 3 + pk.x) * 5;
      if (pk.kind === 'part') Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, pk.x - 13, pk.y - 13 + bob, 26, 26, 6), GOLD, { noShadow: true, cut: 3 });
      else Z.render.paperFill(ctx, () => { ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 10, 0, U.TAU); }, '#b3a890', { noShadow: true, cut: 3 });
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gg = ctx.createRadialGradient(pk.x, pk.y + bob, 2, pk.x, pk.y + bob, 30);
      gg.addColorStop(0, U.rgba(GOLD, 0.3)); gg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gg; ctx.fillRect(pk.x - 30, pk.y + bob - 30, 60, 60); ctx.restore();
    }
    // guards (KANE-CO drones with vision cones)
    for (const gd of guards) drawGuard(ctx, gd, tt);
    // player
    drawPlayer(ctx, tt);
    ctx.restore();

    // HUD chip: form + deaths
    Z.render.pxText(ctx, FORM_LABEL[p ? p.form : 'tanuki'], 18, H - 22, 13, SPIRIT, 'left');
    if (deaths) Z.render.pxText(ctx, 'caught x' + deaths, 18, H - 46, 9, '#ffb0a0', 'left');
    Z.render.drawPetals(tt);
  }

  function drawCrate(ctx, px, py, cracked) {
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, px + 1, py + 1, TILE - 2, TILE - 2, 6), cracked ? '#9b8362' : '#8a6f4d', { noShadow: true, cut: 3 });
    ctx.strokeStyle = 'rgba(47,36,24,.4)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px + 6, py + TILE / 2); ctx.lineTo(px + TILE - 6, py + TILE / 2); ctx.stroke();
    if (cracked) { ctx.strokeStyle = '#2f2418'; ctx.beginPath(); ctx.moveTo(px + 10, py + 8); ctx.lineTo(px + TILE / 2, py + TILE / 2); ctx.lineTo(px + 12, py + TILE - 8); ctx.stroke(); }
  }
  function drawFence(ctx, px, py) {
    ctx.strokeStyle = '#7d8294'; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(px + 8 + i * 14, py); ctx.lineTo(px + 8 + i * 14, py + TILE); ctx.stroke(); }
    ctx.strokeStyle = '#4a4f66'; ctx.beginPath(); ctx.moveTo(px, py + 8); ctx.lineTo(px + TILE, py + 8); ctx.moveTo(px, py + TILE - 8); ctx.lineTo(px + TILE, py + TILE - 8); ctx.stroke();
  }
  function drawVent(ctx, px, py, tt) {
    ctx.save(); ctx.globalAlpha = 0.5;
    for (let i = 0; i < 3; i++) {
      const yy = py + TILE - ((tt * 60 + i * 26) % (TILE * 1.4));
      ctx.strokeStyle = '#cfe6de'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px + TILE / 2 + Math.sin(tt * 3 + i) * 8, yy, 8, 0.4, Math.PI - 0.4); ctx.stroke();
    }
    ctx.restore();
  }
  function drawExit(ctx, px, py, tt) {
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, px - 6, py - TILE, TILE + 12, TILE * 2, 8), '#c8452b', { cut: 4 });
    ctx.fillStyle = '#2f2418'; ctx.fillRect(px + 4, py - TILE + 14, TILE - 8, TILE * 2 - 20);
    const bob = Math.sin(tt * 4) * 4;
    Z.render.pxText(ctx, 'OUT', px + TILE / 2, py - TILE - 8 + bob, 10, GOLD, 'center');
  }
  function drawGuard(ctx, g, tt) {
    // vision cone
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const cg = ctx.createLinearGradient(g.x, 0, g.x + g.dir * TILE * 4.6, 0);
    cg.addColorStop(0, 'rgba(255,90,74,.28)'); cg.addColorStop(1, 'rgba(255,90,74,0)');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.moveTo(g.x, g.y - 30);
    ctx.lineTo(g.x + g.dir * TILE * 4.6, g.y - 30 - TILE * 1.2); ctx.lineTo(g.x + g.dir * TILE * 4.6, g.y - 30 + TILE * 1.2);
    ctx.closePath(); ctx.fill(); ctx.restore();
    // drone body (hovering suit)
    const bob = Math.sin(tt * 2.4 + g.ph) * 4;
    ctx.save(); ctx.translate(g.x, g.y - 34 - bob); ctx.scale(g.dir, 1);
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, -13, -20, 26, 34, 7), '#7d8294', { noShadow: true, cut: 3 });
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, -9, -35, 18, 16, 5), '#9aa0b5', { noShadow: true, cut: 2.6 });
    ctx.fillStyle = '#ff5a4a'; ctx.beginPath(); ctx.arc(3, -27, 3, 0, U.TAU); ctx.fill();
    ctx.fillStyle = '#3a3f52'; ctx.fillRect(-3, -8, 6, 12);
    ctx.restore();
  }
  function drawPlayer(ctx, tt) {
    const px = p.x, py = p.y;
    if (formPoof > 0) { ctx.save(); ctx.globalAlpha = formPoof * 2; ctx.fillStyle = '#f5ecd7'; ctx.beginPath(); ctx.arc(px, py - 20, 30 * (1 - formPoof), 0, U.TAU); ctx.fill(); ctx.restore(); }
    if (p.form === 'tanuki') {
      const moving = Math.abs(p.vx) > 20 && p.onG;
      Z.render.drawSprite('char.tanuki', px, py, { w: 66, facing: p.facing, bob: 0, squash: p.onG ? Math.cos(p.walk * 18) * 0.04 : -0.06, anim: !p.onG ? 'jump' : moving ? 'walk' : 'idle', animT: moving ? p.walk : tt });
    } else if (p.form === 'rock') {
      Z.render.paperFill(ctx, () => { ctx.beginPath(); ctx.moveTo(px - 17, py); ctx.lineTo(px - 13, py - 24); ctx.lineTo(px + 2, py - 30); ctx.lineTo(px + 16, py - 20); ctx.lineTo(px + 17, py); ctx.closePath(); }, '#8f8577', { cut: 4 });
      drawFace(ctx, px, py - 16);
    } else if (p.form === 'paper') {
      const flut = Math.sin(tt * 8) * 0.16;
      ctx.save(); ctx.translate(px, py - 16); ctx.rotate(flut);
      Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, -13, -17, 26, 34, 3), '#faf3e3', { cut: 3 });
      ctx.strokeStyle = 'rgba(47,36,24,.25)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(8, -8); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.stroke();
      drawFace(ctx, 0, 6);
      ctx.restore();
    } else { // scissors
      ctx.save(); ctx.translate(px, py - 16); ctx.scale(p.facing, 1); ctx.rotate(p.dashT > 0 ? -0.4 : Math.sin(tt * 5) * 0.08);
      Z.render.paperFill(ctx, () => { ctx.beginPath(); ctx.moveTo(-4, 2); ctx.lineTo(20, -8); ctx.lineTo(-2, -4); ctx.closePath(); }, '#b8c0c8', { noShadow: true, cut: 2.6 });
      Z.render.paperFill(ctx, () => { ctx.beginPath(); ctx.moveTo(-4, -8); ctx.lineTo(20, 2); ctx.lineTo(-2, -2); ctx.closePath(); }, '#cfd6dd', { noShadow: true, cut: 2.6 });
      Z.render.paperFill(ctx, () => { ctx.beginPath(); ctx.arc(-8, -10, 7, 0, U.TAU); }, '#c0392b', { noShadow: true, cut: 2.6 });
      Z.render.paperFill(ctx, () => { ctx.beginPath(); ctx.arc(-8, 4, 7, 0, U.TAU); }, '#c0392b', { noShadow: true, cut: 2.6 });
      drawFace(ctx, -8, 0);
      ctx.restore();
    }
  }
  function drawFace(ctx, x, y) {
    ctx.fillStyle = '#2f2418';
    ctx.beginPath(); ctx.arc(x - 4, y - 2, 2, 0, U.TAU); ctx.arc(x + 4, y - 2, 2, 0, U.TAU); ctx.fill();
    ctx.strokeStyle = '#2f2418'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y + 2, 3, 0.3, Math.PI - 0.3); ctx.stroke();
  }

  function enter() { mode = 'select'; document.getElementById('infilHud').style.display = 'none'; renderSelect(); }
  function leave() { mode = 'select'; }
  function init() { Z.ui.onEnter('infil', enter); }
  return { init, frame, get playing() { return mode === 'play'; }, leave };
})();
