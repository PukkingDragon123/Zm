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
  let terrainCv = null, shadowCv = null, spores = null;   // silksong dressing

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
    buildTerrain();
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

  // ================================================================
  //  RENDER — layered forest, ink-silhouette terrain, soft light
  // ================================================================
  const hash2 = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 100;
  const isWall = (x, y) => x >= 0 && x < W0 && y >= 0 && y < H0 && grid[y][x] === '#';

  // pre-render the static level silhouette (walls, ledges, thorns) once
  function buildTerrain() {
    const w = W0 * TILE, h = H0 * TILE;
    terrainCv = document.createElement('canvas'); terrainCv.width = w; terrainCv.height = h;
    const c = terrainCv.getContext('2d');
    // merged wall runs, near-black with a cool vertical grade
    for (let y = 0; y < H0; y++) {
      let x = 0;
      while (x < W0) {
        if (grid[y][x] === '#') {
          let x2 = x; while (x2 < W0 && grid[y][x2] === '#') x2++;
          const g = c.createLinearGradient(0, y * TILE, 0, y * TILE + TILE);
          g.addColorStop(0, '#141c21'); g.addColorStop(1, '#0b1115');
          c.fillStyle = g; c.fillRect(x * TILE, y * TILE, (x2 - x) * TILE, TILE + 1);
          x = x2;
        } else x++;
      }
    }
    // exposed-edge dressing: pale rim + grass on tops, vines under bottoms
    for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) {
      if (grid[y][x] !== '#') continue;
      const px = x * TILE, py = y * TILE, hs = hash2(x, y);
      if (!isWall(x, y - 1)) {
        c.strokeStyle = 'rgba(186,216,206,.38)'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(px + (isWall(x - 1, y) ? 0 : 2), py + 1); c.lineTo(px + TILE - (isWall(x + 1, y) ? 0 : 2), py + 1); c.stroke();
        if (hs < 42) {                                     // grass tufts on some tops
          c.strokeStyle = 'rgba(58,88,74,.9)'; c.lineWidth = 2; c.lineCap = 'round';
          const n = 3 + hs % 3;
          for (let k = 0; k < n; k++) {
            const gx = px + 6 + (k + 0.5) * (TILE - 12) / n, gh = 7 + ((hs + k * 31) % 8), lean = ((hs + k * 17) % 7 - 3);
            c.beginPath(); c.moveTo(gx, py + 2); c.quadraticCurveTo(gx + lean, py - gh * 0.6, gx + lean * 1.6, py - gh); c.stroke();
          }
        }
      }
      if (!isWall(x, y + 1) && y + 1 < H0 && hs > 68) {    // hanging vines
        c.strokeStyle = 'rgba(40,62,54,.85)'; c.lineWidth = 2; c.lineCap = 'round';
        const n = 1 + hs % 2;
        for (let k = 0; k < n; k++) {
          const vx = px + 8 + ((hs + k * 41) % (TILE - 16)), vl = 12 + ((hs * 7 + k * 13) % 22);
          c.beginPath(); c.moveTo(vx, py + TILE - 1); c.quadraticCurveTo(vx + 4, py + TILE + vl * 0.6, vx - 2, py + TILE + vl); c.stroke();
        }
      }
      if (!isWall(x - 1, y)) { c.strokeStyle = 'rgba(186,216,206,.12)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(px + 1, py + 2); c.lineTo(px + 1, py + TILE - 2); c.stroke(); }
    }
    // one-way ledges: thin dark planks with a pale top edge
    for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) {
      if (grid[y][x] !== '=') continue;
      const px = x * TILE, py = y * TILE;
      c.fillStyle = '#101820'; c.fillRect(px + 1, py + 4, TILE - 2, 11);
      c.strokeStyle = 'rgba(186,216,206,.4)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(px + 2, py + 5); c.lineTo(px + TILE - 2, py + 5); c.stroke();
      c.strokeStyle = 'rgba(58,88,74,.7)'; c.beginPath(); c.moveTo(px + 6, py + 15); c.quadraticCurveTo(px + 9, py + 22, px + 5, py + 26); c.stroke();
    }
    // spikes: ink thorns with a pale gleam
    for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) {
      if (grid[y][x] !== '^') continue;
      const px = x * TILE, py = y * TILE;
      for (let k = 0; k < 3; k++) {
        const bx = px + k * (TILE / 3), tipX = bx + TILE / 6;
        c.fillStyle = '#131b21';
        c.beginPath(); c.moveTo(bx, py + TILE); c.lineTo(tipX, py + TILE - 21); c.lineTo(bx + TILE / 3, py + TILE); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(186,216,206,.35)'; c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(tipX, py + TILE - 21); c.lineTo(bx + 3, py + TILE); c.stroke();
      }
    }
    // soft blurred copy for depth shadow
    shadowCv = document.createElement('canvas'); shadowCv.width = w; shadowCv.height = h;
    const s = shadowCv.getContext('2d');
    s.filter = 'blur(6px)'; s.drawImage(terrainCv, 0, 0); s.filter = 'none';
    s.globalCompositeOperation = 'source-in'; s.fillStyle = '#05090c'; s.fillRect(0, 0, w, h);
  }

  // far forest + wash + god rays + mist (screen space)
  function drawBackdrop(ctx, W, H, tt, scroll) {
    const im = Z.assets.img('infil.forest');
    if (im) {
      const s = Math.max(W / im.naturalWidth, H / im.naturalHeight) * 1.12;
      const dw = im.naturalWidth * s, dh = im.naturalHeight * s;
      const ox = U.clamp(-(dw - W) * 0.5 - scroll * 0.12, -(dw - W), 0);
      ctx.drawImage(im, ox, (H - dh) * 0.55, dw, dh);
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#18262a'); g.addColorStop(0.6, '#14201f'); g.addColorStop(1, '#0d1414');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    ctx.fillStyle = 'rgba(14,28,32,.52)'; ctx.fillRect(0, 0, W, H);
    // god rays
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const bx = W * (0.22 + i * 0.28) + Math.sin(tt * 0.12 + i * 2.1) * 40 - scroll * 0.05;
      const rg = ctx.createLinearGradient(0, 0, 0, H);
      rg.addColorStop(0, 'rgba(198,232,210,.10)'); rg.addColorStop(1, 'rgba(198,232,210,0)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.moveTo(bx - 14, -20); ctx.lineTo(bx + 26, -20);
      ctx.lineTo(bx + 150, H); ctx.lineTo(bx - 90, H); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // low mist bands
    for (let i = 0; i < 2; i++) {
      const my = H * (0.58 + i * 0.2), mh = 90, pulse = 0.05 + 0.03 * Math.sin(tt * 0.3 + i * 2);
      const mg = ctx.createLinearGradient(0, my, 0, my + mh);
      mg.addColorStop(0, 'rgba(196,220,210,0)'); mg.addColorStop(0.5, 'rgba(196,220,210,' + pulse + ')'); mg.addColorStop(1, 'rgba(196,220,210,0)');
      ctx.fillStyle = mg; ctx.fillRect(0, my, W, mh);
    }
  }

  // drifting spores (pooled, parallax 0.6)
  function drawSpores(ctx, W, H, dt, scroll) {
    if (!spores) { spores = []; for (let i = 0; i < 26; i++) spores.push({ x: Math.random() * (W + 80), y: Math.random() * H, vy: 8 + Math.random() * 16, ph: Math.random() * 6, r: 1.2 + Math.random() * 2 }); }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const sp of spores) {
      sp.ph += dt; sp.y -= sp.vy * dt;
      if (sp.y < -12) { sp.y = H + 10; sp.x = Math.random() * (W + 80); }
      const sx = ((sp.x - scroll * 0.6) % (W + 80) + (W + 80)) % (W + 80) - 40;
      const a = 0.16 + 0.14 * Math.sin(sp.ph * 1.7);
      ctx.fillStyle = 'rgba(190,228,206,' + a.toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(sx + Math.sin(sp.ph) * 9, sp.y, sp.r, 0, U.TAU); ctx.fill();
    }
    ctx.restore();
  }

  // near-black fern silhouettes hugging the bottom corners
  function drawFerns(ctx, W, H, tt) {
    ctx.save(); ctx.fillStyle = '#070b0d'; ctx.strokeStyle = '#070b0d'; ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      const bx = side < 0 ? 0 : W, sway = Math.sin(tt * 0.7 + side) * 2;
      for (let k = 0; k < 5; k++) {
        const a = (k + 1) / 6 * Math.PI * 0.44, len = 66 + k * 14;
        ctx.lineWidth = 10 - k;
        ctx.beginPath(); ctx.moveTo(bx, H + 6);
        ctx.quadraticCurveTo(bx - side * len * 0.5, H - len * 0.55 + sway, bx - side * len * Math.sin(a), H - len * Math.cos(a) * 0.9 + sway);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function frame(dt, tt) {
    const ctx = Z.render.ctx, W = Z.render.W, H = Z.render.H;
    Z.render.clear();
    drawBackdrop(ctx, W, H, tt, mode === 'play' ? camX : tt * 14);
    if (mode === 'select') { drawSpores(ctx, W, H, dt, 0); return; }

    update(dt);

    ctx.save(); ctx.translate(-camX | 0, -camY | 0);
    if (shadowCv) { ctx.save(); ctx.globalAlpha = 0.55; ctx.drawImage(shadowCv, 5, 9); ctx.restore(); }
    if (terrainCv) ctx.drawImage(terrainCv, 0, 0);
    // dynamic tiles only (breakables, fences, vents, exit)
    for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) {
      const c = grid[y][x], px = x * TILE, py = y * TILE;
      if (px - camX < -TILE || px - camX > W + TILE || py - camY < -TILE || py - camY > H + TILE) continue;
      if (c === 'C') { if (!broken[x + ',' + y]) drawCracked(ctx, px, py); }
      else if (c === 'F') { if (!cut[x + ',' + y]) drawFence(ctx, px, py); }
      else if (c === 'U') { drawVent(ctx, px, py, tt); }
      else if (c === 'E') { drawExit(ctx, px, py, tt); }
    }
    // pickups: warm focal glints in the gloom
    for (const pk of pickups) {
      if (pk.got) continue;
      const bob = Math.sin(tt * 3 + pk.x) * 5;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gg = ctx.createRadialGradient(pk.x, pk.y + bob, 2, pk.x, pk.y + bob, 34);
      gg.addColorStop(0, U.rgba(GOLD, 0.34)); gg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gg; ctx.fillRect(pk.x - 34, pk.y + bob - 34, 68, 68); ctx.restore();
      if (pk.kind === 'part') Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, pk.x - 12, pk.y - 12 + bob, 24, 24, 6), GOLD, { noShadow: true, cut: 2.6 });
      else Z.render.paperFill(ctx, () => { ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 9, 0, U.TAU); }, '#b3a890', { noShadow: true, cut: 2.6 });
    }
    for (const gd of guards) drawGuard(ctx, gd, tt);
    drawPlayer(ctx, tt);
    ctx.restore();

    drawSpores(ctx, W, H, dt, camX);
    drawFerns(ctx, W, H, tt);
    // quiet HUD, no boxes
    Z.render.pxText(ctx, FORM_LABEL[p ? p.form : 'tanuki'], 18, H - 22, 12, SPIRIT, 'left');
    if (deaths) Z.render.pxText(ctx, 'caught x' + deaths, 18, H - 46, 9, '#ffb0a0', 'left');
  }

  function drawCracked(ctx, px, py) {
    // smashable stone block: lighter than the terrain, visibly fractured
    const g = ctx.createLinearGradient(0, py, 0, py + TILE);
    g.addColorStop(0, '#26323a'); g.addColorStop(1, '#18222a');
    ctx.fillStyle = g; ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
    ctx.strokeStyle = 'rgba(186,216,206,.32)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px + 3, py + 2); ctx.lineTo(px + TILE - 3, py + 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(10,16,20,.9)'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(px + 10, py + 6); ctx.lineTo(px + TILE / 2, py + TILE / 2); ctx.lineTo(px + 12, py + TILE - 6);
    ctx.moveTo(px + TILE / 2, py + TILE / 2); ctx.lineTo(px + TILE - 8, py + TILE - 12); ctx.stroke();
  }
  function drawFence(ctx, px, py) {
    ctx.save();
    ctx.strokeStyle = 'rgba(150,172,182,.85)'; ctx.lineWidth = 2.4;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(px + 8 + i * 14, py); ctx.lineTo(px + 8 + i * 14, py + TILE); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(94,112,122,.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px, py + 8); ctx.lineTo(px + TILE, py + 8); ctx.moveTo(px, py + TILE - 8); ctx.lineTo(px + TILE, py + TILE - 8); ctx.stroke();
    ctx.fillStyle = 'rgba(210,230,235,.5)';
    ctx.fillRect(px + 7, py + 7, 3, 3); ctx.fillRect(px + 35, py + TILE - 9, 3, 3);
    ctx.restore();
  }
  function drawVent(ctx, px, py, tt) {
    ctx.save(); ctx.globalAlpha = 0.4;
    for (let i = 0; i < 3; i++) {
      const yy = py + TILE - ((tt * 60 + i * 26) % (TILE * 1.4));
      ctx.strokeStyle = '#bfe3d2'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px + TILE / 2 + Math.sin(tt * 3 + i) * 8, yy, 8, 0.4, Math.PI - 0.4); ctx.stroke();
    }
    ctx.restore();
  }
  function drawExit(ctx, px, py, tt) {
    // old shrine doorway: dark frame, warm light spilling out
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(px + TILE / 2, py, 4, px + TILE / 2, py, TILE * 1.6);
    glow.addColorStop(0, 'rgba(255,214,150,' + (0.22 + 0.08 * Math.sin(tt * 2)) + ')'); glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(px - TILE * 1.5, py - TILE * 1.6, TILE * 4, TILE * 3.2); ctx.restore();
    ctx.fillStyle = '#0c1216';
    ctx.fillRect(px - 6, py - TILE, 10, TILE * 2); ctx.fillRect(px + TILE - 4, py - TILE, 10, TILE * 2);
    ctx.fillRect(px - 12, py - TILE - 8, TILE + 24, 10);
    const dg = ctx.createLinearGradient(0, py - TILE, 0, py + TILE);
    dg.addColorStop(0, 'rgba(255,220,160,.55)'); dg.addColorStop(1, 'rgba(255,190,120,.2)');
    ctx.fillStyle = dg; ctx.fillRect(px + 4, py - TILE + 2, TILE - 8, TILE * 2 - 2);
    const bob = Math.sin(tt * 4) * 3;
    Z.render.pxText(ctx, 'OUT', px + TILE / 2, py - TILE - 16 + bob, 9, GOLD, 'center');
  }
  function drawGuard(ctx, g, tt) {
    // lantern-light vision cone (warm; red while alarmed)
    const warm = alarmT > 0 ? '255,110,90' : '255,220,150';
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const cg = ctx.createLinearGradient(g.x, 0, g.x + g.dir * TILE * 4.6, 0);
    cg.addColorStop(0, 'rgba(' + warm + ',.24)'); cg.addColorStop(1, 'rgba(' + warm + ',0)');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.moveTo(g.x, g.y - 30);
    ctx.lineTo(g.x + g.dir * TILE * 4.6, g.y - 30 - TILE * 1.2); ctx.lineTo(g.x + g.dir * TILE * 4.6, g.y - 30 + TILE * 1.2);
    ctx.closePath(); ctx.fill();
    const lg = ctx.createRadialGradient(g.x, g.y - 30, 2, g.x, g.y - 30, 40);
    lg.addColorStop(0, 'rgba(' + warm + ',.25)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lg; ctx.fillRect(g.x - 40, g.y - 70, 80, 80);
    ctx.restore();
    // drone body (hovering suit)
    const bob = Math.sin(tt * 2.4 + g.ph) * 4;
    ctx.save(); ctx.translate(g.x, g.y - 34 - bob); ctx.scale(g.dir, 1);
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, -13, -20, 26, 34, 7), '#5c6472', { noShadow: true, cut: 3 });
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, -9, -35, 18, 16, 5), '#77808f', { noShadow: true, cut: 2.6 });
    ctx.fillStyle = '#ff5a4a'; ctx.beginPath(); ctx.arc(3, -27, 3, 0, U.TAU); ctx.fill();
    ctx.fillStyle = '#2c3340'; ctx.fillRect(-3, -8, 6, 12);
    ctx.restore();
  }
  function drawPlayer(ctx, tt) {
    const px = p.x, py = p.y;
    // cool rim glow so the little spirit reads against the ink
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const gliding = p.form === 'paper' && !p.onG;
    const rr = gliding ? 46 : 30;
    const rl = ctx.createRadialGradient(px, py - 18, 2, px, py - 18, rr);
    rl.addColorStop(0, 'rgba(170,225,205,' + (gliding ? 0.22 : 0.1) + ')'); rl.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rl; ctx.fillRect(px - rr, py - 18 - rr, rr * 2, rr * 2);
    ctx.restore();
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
