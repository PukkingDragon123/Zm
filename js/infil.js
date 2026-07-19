/* ================================================================
   infil.js — KANE-CO CAMPS. Industrial-obby platformer built from
   the uploaded steel/concrete tile sprites. Placed-object levels
   (real AABB hitboxes that match the art), coyote-time + jump-buffer,
   a lerp camera, patrol drones with lantern vision cones, and the
   tanuki's HENGE forms:
     TANUKI  — nimble run / jump
     ROCK    — heavy, smashes crates on landing, still-hides from drones
     PAPER   — the hang-glider: low gravity, rides fan updrafts
     SCISSORS— fast dash that cuts lattice fences
   Rewards: mech parts + scrap.  API preserved: {init, frame, playing, leave}
   ================================================================ */
Z.infil = (function () {
  const U = Z.util, D = Z.data;
  const FORMS = ['tanuki', 'rock', 'paper', 'scissors'];
  const FORM_LABEL = { tanuki: 'TANUKI', rock: 'ROCK', paper: 'PAPER', scissors: 'SCISSORS' };
  const GOLD = '#ffd98a', SPIRIT = '#8fe6cf';

  // native tile dimensions (from the sliced sheet) — used for aspect-correct fit
  const TDIM = {
    t00: [280, 176], t01: [146, 176], t02: [117, 177], t03: [113, 176], t04: [119, 177],
    t05: [103, 180], t06: [299, 101], t07: [147, 98], t08: [252, 81], t09: [189, 86],
    t10: [345, 122], t11: [157, 103], t12: [220, 137], t13: [431, 93], t14: [79, 260],
    t15: [53, 282], t16: [200, 55], t17: [193, 50], t18: [147, 103], t19: [96, 95],
    t20: [60, 74], t21: [88, 87], t22: [77, 117], t23: [109, 263], t24: [245, 208],
    t25: [142, 198], t26: [139, 109], t27: [137, 126], t28: [189, 69], t29: [94, 101],
    t30: [77, 164], t31: [123, 169], t32: [275, 165], t33: [148, 124], t34: [88, 124],
    t35: [174, 60], t36: [150, 81], t37: [172, 110], t38: [249, 122], t39: [265, 123],
    t40: [171, 158], t41: [134, 169], t42: [194, 121], t43: [128, 120], t44: [142, 113],
  };
  const aspect = (tile) => { const d = TDIM[tile]; return d ? d[1] / d[0] : 0.5; };
  const tileImg = (tile) => Z.assets.img('tile.' + tile);
  function drawTile(ctx, tile, x, y, w, h) {
    const im = tileImg(tile);
    if (im) ctx.drawImage(im, x, y, w, h);
    else { ctx.fillStyle = '#2b333b'; ctx.fillRect(x, y, w, h); }
  }

  // ================================================================
  //  LEVELS  — placed objects in world pixels. h is optional on any
  //  object except structural solids; when omitted it is derived from
  //  the tile's native aspect so the art is never distorted.
  //  kinds:  solids (collide all sides)  oneways (land from above)
  //          hazards{kind:spike|steam}   fans (updraft column above)
  //          crates (rock-smash)         fences (scissors-cut)
  //          ladders  decor{par}  pickups{kind}  guards  checkpoints
  // ================================================================
  const LEVELS = [
    {
      id: 'camp1', name: 'Supply Yard', minRank: 1,
      hint: 'Hop the pipes. Smash a crate as ROCK, snip a fence as SCISSORS.',
      reward: { parts: 2, rarity: 'uncommon', scrap: 20 },
      w: 3020, h: 840, spawn: { x: 120, y: 600 }, exit: { tile: 't24', x: 2770, y: 455, w: 190, h: 150 },
      solids: [
        { tile: 't00', x: -60, y: 600, w: 560, h: 260 },
        { tile: 't38', x: 500, y: 600, w: 260, h: 260 },
        { tile: 't39', x: 900, y: 600, w: 440, h: 260 },
        { tile: 't00', x: 1340, y: 600, w: 520, h: 260 },
        { tile: 't38', x: 1860, y: 600, w: 520, h: 260 },
        { tile: 't39', x: 2380, y: 600, w: 700, h: 260 },
        { tile: 't43', x: 1660, y: 470, w: 120, h: 130 },
      ],
      oneways: [
        { tile: 't16', x: 770, y: 556, w: 140 },
        { tile: 't11', x: 1470, y: 500, w: 150 },
        { tile: 't09', x: 1500, y: 372, w: 160 },
        { tile: 't10', x: 1760, y: 356, w: 220 },
        { tile: 't16', x: 2070, y: 520, w: 150 },
      ],
      hazards: [
        { tile: 't35', x: 2040, y: 566, w: 190, kind: 'spike' },
      ],
      fans: [],
      crates: [
        { tile: 't33', x: 1000, y: 516, w: 100, h: 84 },
        { tile: 't33', x: 1140, y: 516, w: 100, h: 84 },
      ],
      fences: [
        { tile: 't12', x: 1300, y: 516, w: 74, h: 84 },
      ],
      ladders: [],
      decor: [
        { tile: 't04', x: 120, y: 300, w: 150, par: 0.35 },
        { tile: 't02', x: 300, y: 320, w: 140, par: 0.35 },
        { tile: 't23', x: 640, y: 250, w: 120, par: 0.4 },
        { tile: 't28', x: 900, y: 280, w: 220, par: 0.45 },
        { tile: 't29', x: 1180, y: 300, w: 110, par: 0.45 },
        { tile: 't30', x: 760, y: 430, w: 90, par: 0.7 },
        { tile: 't05', x: 1500, y: 300, w: 130, par: 0.35 },
        { tile: 't03', x: 1700, y: 320, w: 130, par: 0.35 },
        { tile: 't18', x: 2000, y: 300, w: 150, par: 0.45 },
        { tile: 't21', x: 2260, y: 360, w: 90, par: 0.6 },
        { tile: 't34', x: 480, y: 528, w: 70, par: 1 },
        { tile: 't40', x: 1360, y: 500, w: 150, par: 1 },
        { tile: 't44', x: 2320, y: 545, w: 120, par: 1 },
        { tile: 't41', x: 2600, y: 470, w: 120, par: 1 },
      ],
      pickups: [
        { x: 1050, y: 470, kind: 'scrap' },
        { x: 1870, y: 320, kind: 'part' },
        { x: 2560, y: 560, kind: 'scrap' },
      ],
      guards: [
        { x0: 2440, x1: 2820, y: 600, dir: -1 },
      ],
      checkpoints: [{ x: 900, y: 600 }, { x: 1860, y: 600 }, { x: 2400, y: 600 }],
    },

    {
      id: 'camp2', name: 'Watch Post', minRank: 2,
      hint: 'Drones ignore a still ROCK. Glide the gaps and ride the vent as PAPER.',
      reward: { parts: 2, rarity: 'rare', scrap: 35 },
      w: 3320, h: 900, spawn: { x: 110, y: 640 }, exit: { tile: 't25', x: 3120, y: 470, w: 150, h: 200 },
      solids: [
        { tile: 't00', x: -60, y: 640, w: 520, h: 260 },
        { tile: 't39', x: 460, y: 640, w: 300, h: 260 },
        { tile: 't38', x: 1180, y: 640, w: 360, h: 260 },
        { tile: 't00', x: 1540, y: 640, w: 300, h: 260 },
        { tile: 't39', x: 2300, y: 640, w: 340, h: 260 },
        { tile: 't00', x: 2640, y: 640, w: 700, h: 260 },
        { tile: 't01', x: 900, y: 470, w: 130, h: 170 },
        { tile: 't43', x: 2020, y: 520, w: 120, h: 120 },
      ],
      oneways: [
        { tile: 't06', x: 780, y: 500, w: 240 },
        { tile: 't10', x: 1560, y: 470, w: 220 },
        { tile: 't13', x: 1880, y: 470, w: 200, move: { axis: 'x', min: 1880, max: 2020, speed: 1.3 } },
        { tile: 't07', x: 2660, y: 470, w: 150 },
        { tile: 't11', x: 2860, y: 388, w: 150 },
      ],
      hazards: [
        { tile: 't36', x: 470, y: 606, w: 150, kind: 'steam' },
        { tile: 't35', x: 1300, y: 606, w: 174, kind: 'spike' },
        { tile: 't37', x: 2320, y: 592, w: 172, kind: 'steam' },
      ],
      fans: [
        { tile: 't26', x: 1030, y: 560, w: 150 },
        { tile: 't27', x: 2140, y: 552, w: 150 },
      ],
      crates: [
        { tile: 't33', x: 1180, y: 556, w: 96, h: 84 },
      ],
      fences: [],
      ladders: [
        { tile: 't14', x: 2560, y: 470, w: 66, h: 170 },
      ],
      decor: [
        { tile: 't02', x: 120, y: 320, w: 150, par: 0.32 },
        { tile: 't24', x: 360, y: 300, w: 220, par: 0.4 },
        { tile: 't28', x: 700, y: 300, w: 220, par: 0.45 },
        { tile: 't23', x: 1050, y: 230, w: 120, par: 0.38 },
        { tile: 't19', x: 1360, y: 300, w: 120, par: 0.45 },
        { tile: 't20', x: 1520, y: 330, w: 70, par: 0.5 },
        { tile: 't05', x: 1800, y: 320, w: 130, par: 0.32 },
        { tile: 't29', x: 2100, y: 300, w: 110, par: 0.45 },
        { tile: 't30', x: 1160, y: 500, w: 90, par: 0.7 },
        { tile: 't31', x: 2500, y: 300, w: 150, par: 0.4 },
        { tile: 't34', x: 1560, y: 568, w: 70, par: 1 },
        { tile: 't40', x: 760, y: 580, w: 150, par: 1 },
        { tile: 't41', x: 2760, y: 470, w: 120, par: 1 },
        { tile: 't44', x: 3000, y: 585, w: 120, par: 1 },
      ],
      pickups: [
        { x: 900, y: 420, kind: 'part' },
        { x: 1660, y: 430, kind: 'scrap' },
        { x: 2200, y: 360, kind: 'part' },
        { x: 2930, y: 350, kind: 'scrap' },
      ],
      guards: [
        { x0: 800, x1: 1120, y: 640, dir: 1 },
        { x0: 1560, x1: 1820, y: 640, dir: -1 },
        { x0: 2680, x1: 3060, y: 640, dir: 1 },
      ],
      checkpoints: [{ x: 780, y: 640 }, { x: 1560, y: 640 }, { x: 2300, y: 640 }, { x: 2680, y: 640 }],
    },

    {
      id: 'camp3', name: 'Depot Roof', minRank: 3,
      hint: 'Ladders, chain-lifts and hard patrols. Cut the gate, ride the drafts, grab their best cores.',
      reward: { parts: 3, rarity: 'epic', scrap: 60 },
      w: 3620, h: 940, spawn: { x: 110, y: 660 }, exit: { tile: 't24', x: 3400, y: 505, w: 190, h: 150 },
      solids: [
        { tile: 't00', x: -60, y: 660, w: 460, h: 280 },
        { tile: 't39', x: 400, y: 660, w: 260, h: 280 },
        { tile: 't38', x: 980, y: 660, w: 260, h: 280 },
        { tile: 't00', x: 1600, y: 660, w: 300, h: 280 },
        { tile: 't39', x: 2260, y: 660, w: 260, h: 280 },
        { tile: 't00', x: 2880, y: 660, w: 740, h: 280 },
        { tile: 't06', x: 660, y: 470, w: 260, h: 60 },
        { tile: 't43', x: 1240, y: 540, w: 120, h: 120 },
        { tile: 't01', x: 2520, y: 500, w: 140, h: 160 },
      ],
      oneways: [
        { tile: 't11', x: 1000, y: 500, w: 150 },
        { tile: 't10', x: 1360, y: 440, w: 220 },
        { tile: 't32', x: 1900, y: 520, w: 200, move: { axis: 'y', min: 380, max: 560, speed: 1.0 } },
        { tile: 't07', x: 2260, y: 470, w: 150 },
        { tile: 't13', x: 2660, y: 470, w: 200, move: { axis: 'x', min: 2620, max: 2820, speed: 1.5 } },
        { tile: 't09', x: 3060, y: 470, w: 160 },
        { tile: 't08', x: 3240, y: 388, w: 200 },
      ],
      hazards: [
        { tile: 't35', x: 470, y: 626, w: 174, kind: 'spike' },
        { tile: 't37', x: 1000, y: 612, w: 172, kind: 'steam' },
        { tile: 't35', x: 1620, y: 626, w: 174, kind: 'spike' },
        { tile: 't36', x: 2280, y: 626, w: 150, kind: 'steam' },
        { tile: 't35', x: 2940, y: 626, w: 174, kind: 'spike' },
      ],
      fans: [
        { tile: 't27', x: 2080, y: 572, w: 150 },
        { tile: 't26', x: 3230, y: 570, w: 150 },
      ],
      crates: [
        { tile: 't33', x: 1620, y: 576, w: 96, h: 84 },
        { tile: 't33', x: 1716, y: 576, w: 96, h: 84 },
      ],
      fences: [
        { tile: 't12', x: 820, y: 500, w: 76, h: 160 },
        { tile: 't12', x: 3000, y: 586, w: 76, h: 74 },
      ],
      ladders: [
        { tile: 't14', x: 620, y: 470, w: 66, h: 190 },
        { tile: 't14', x: 2480, y: 340, w: 66, h: 320 },
      ],
      decor: [
        { tile: 't24', x: 150, y: 300, w: 240, par: 0.35 },
        { tile: 't23', x: 480, y: 220, w: 120, par: 0.34 },
        { tile: 't28', x: 900, y: 300, w: 220, par: 0.45 },
        { tile: 't05', x: 1200, y: 320, w: 130, par: 0.32 },
        { tile: 't18', x: 1500, y: 300, w: 150, par: 0.45 },
        { tile: 't19', x: 1700, y: 320, w: 120, par: 0.45 },
        { tile: 't29', x: 2000, y: 300, w: 110, par: 0.45 },
        { tile: 't31', x: 2300, y: 300, w: 150, par: 0.4 },
        { tile: 't42', x: 2700, y: 330, w: 170, par: 0.42 },
        { tile: 't30', x: 1360, y: 380, w: 90, par: 0.7 },
        { tile: 't21', x: 3050, y: 340, w: 90, par: 0.6 },
        { tile: 't34', x: 1400, y: 608, w: 70, par: 1 },
        { tile: 't40', x: 2560, y: 640, w: 150, par: 1 },
        { tile: 't41', x: 3300, y: 505, w: 120, par: 1 },
        { tile: 't44', x: 340, y: 605, w: 120, par: 1 },
      ],
      pickups: [
        { x: 790, y: 430, kind: 'part' },
        { x: 1460, y: 400, kind: 'scrap' },
        { x: 2000, y: 340, kind: 'part' },
        { x: 2480, y: 300, kind: 'scrap' },
        { x: 3150, y: 420, kind: 'part' },
      ],
      guards: [
        { x0: 1000, x1: 1220, y: 660, dir: 1 },
        { x0: 1620, x1: 1880, y: 660, dir: -1 },
        { x0: 2280, x1: 2500, y: 660, dir: 1 },
        { x0: 2960, x1: 3320, y: 660, dir: -1 },
      ],
      checkpoints: [{ x: 660, y: 660 }, { x: 1240, y: 660 }, { x: 1900, y: 660 }, { x: 2520, y: 660 }, { x: 2960, y: 660 }],
    },
  ];

  // ---------- runtime ----------
  let mode = 'select';           // select | play | done
  let L = null;
  let solids = [], oneways = [], hazards = [], fans = [], crates = [], fences = [], ladders = [], decor = [], pickups = [], guards = [], checkpoints = [];
  let p = null, camX = 0, camY = 0, t = 0, deaths = 0, got = [], alarmT = 0, doneT = 0;
  let coyote = 0, jbuf = 0, formPoof = 0, cp = null, reachedCp = null;
  let motes = null, fog = null;
  let raidMode = false, raidIndex = 0;    // set by startRaid(); routes the exit into a boss fight

  // boss picked from D.enemies, scaled to the raid index (harder deeper in)
  const BOSS_BANDS = [[1, 2], [3, 4], [5, 7]];
  function pickBoss(idx) {
    const band = BOSS_BANDS[U.clamp(idx, 0, BOSS_BANDS.length - 1)];
    let pool = (D.enemies || []).filter((e) => e.tier >= band[0] && e.tier <= band[1] && !e.isChampion);
    if (!pool.length) pool = (D.enemies || []).filter((e) => !e.isChampion);
    if (!pool.length) pool = D.enemies || [];
    return U.choice(pool) || null;
  }

  // small, cute runner — jump/gravity kept as tuned so every level stays
  // clearable; only the hitboxes (pw/ph) are trimmed so the tanuki reads
  // small against the big industrial set, with lots of visible background.
  const PHYS = {
    tanuki:   { run: 240, jump: 700, grav: 1900, fall: 1000, pw: 13, ph: 38 },
    rock:     { run: 130, jump: 0,   grav: 2800, fall: 1500, pw: 17, ph: 32 },
    paper:    { run: 195, jump: 340, grav: 560,  fall: 155,  pw: 18, ph: 32 },
    scissors: { run: 275, jump: 640, grav: 1900, fall: 1000, pw: 12, ph: 34 },
  };

  // ---------- level select (DOM) ----------
  function renderSelect() {
    const host = document.getElementById('infilList'); if (!host) return; U.clear(host);
    host.style.display = '';
    LEVELS.forEach((lv) => {
      const done = !!Z.state.campsDone[lv.id], locked = Z.state.rankTier < lv.minRank;
      const card = U.el('div', 'quest' + (done ? ' done' : '') + (locked ? ' locked' : ''));
      card.innerHTML = `${done ? '<div class="q-badge">CLEARED</div>' : ''}<h3>${lv.name}</h3>
        <p>${lv.hint}</p>
        <div class="q-foot"><span class="q-rew">${lv.reward.parts} parts (${lv.reward.rarity}+) &middot; ${lv.reward.scrap} scrap</span>
        <span style="color:var(--ink2)">${locked ? 'Needs rank ' + lv.minRank : ''}</span></div>`;
      if (!locked) {
        const b = U.el('button', 'pbtn ' + (done ? 'tiny' : 'stamp'), done ? 'SNEAK AGAIN (1 part)' : 'SNEAK IN');
        b.addEventListener('click', () => startLevel(lv));
        card.appendChild(b);
      }
      host.appendChild(card);
    });
  }

  // fill missing heights from tile aspect; clone arrays so movers/breaks don't mutate the level def
  function norm(list, keepH) {
    return (list || []).map((o) => {
      const h = (keepH || o.h != null) ? o.h : Math.round(o.w * aspect(o.tile));
      return Object.assign({}, o, { h: h, ox: o.x, oy: o.y, _dx: 0, _dy: 0 });
    });
  }

  // Start raid level [index] straight into play — no DOM select. Called by
  // the phone's raid map. Reaching the exit hands off to a boss fight.
  function startRaid(index) {
    const idx = U.clamp(index | 0, 0, LEVELS.length - 1);
    if (Z.ui.current !== 'infil') Z.ui.show('infil');   // show() runs enter() (select); startLevel overrides it
    startLevel(LEVELS[idx], true);
  }

  function startLevel(lv, raid) {
    raidMode = !!raid; raidIndex = raid ? LEVELS.indexOf(lv) : 0;
    L = lv;
    solids = norm(lv.solids, true);
    oneways = norm(lv.oneways);
    hazards = norm(lv.hazards);
    fans = norm(lv.fans);
    crates = norm(lv.crates, true).map((c) => (c.alive = true, c));
    fences = norm(lv.fences, true).map((f) => (f.alive = true, f));
    ladders = norm(lv.ladders, true);
    decor = norm(lv.decor);
    pickups = (lv.pickups || []).map((k) => ({ x: k.x, y: k.y, kind: k.kind, got: false }));
    guards = (lv.guards || []).map((g) => ({ x: (g.x0 + g.x1) / 2, x0: g.x0, x1: g.x1, y: g.y, dir: g.dir || 1, ph: Math.random() * 6 }));
    checkpoints = (lv.checkpoints || []).map((c, i) => ({ x: c.x, y: c.y, idx: i }));
    cp = { x: lv.spawn.x, y: lv.spawn.y }; reachedCp = -1;
    p = { x: lv.spawn.x, y: lv.spawn.y, vx: 0, vy: 0, form: 'tanuki', facing: 1, onG: false, walk: 0, dashT: 0, mover: null, climbing: false, squash: 0 };
    deaths = 0; got = []; alarmT = 0; doneT = 0; t = 0; coyote = jbuf = formPoof = 0;
    camX = U.clamp(p.x - Z.render.W / 2, 0, Math.max(0, lv.w - Z.render.W));
    camY = U.clamp(p.y - Z.render.H * 0.62, -40, Math.max(0, lv.h - Z.render.H));
    mode = 'play';
    document.getElementById('infilList').style.display = 'none';
    document.getElementById('infilHud').style.display = '';
    Z.controls.setMode('infil');
    Z.ui.toast('SKILL cycles form: tanuki - rock - paper - scissors', 'gold');
  }

  // ---------- collision helpers ----------
  const overlap = (l, t2, w, h, b) => l < b.x + b.w && l + w > b.x && t2 < b.y + b.h && t2 + h > b.y;
  function blockers() {
    const arr = solids.slice();
    for (const c of crates) if (c.alive) arr.push(c);
    for (const f of fences) if (f.alive) arr.push(f);
    return arr;
  }

  // ---------- update ----------
  function update(dt) {
    if (mode !== 'play') { if (mode === 'done') doneT += dt; return; }
    t += dt;
    const ph = PHYS[p.form];
    const dir = Z.controls.dir;
    if (dir) p.facing = dir;

    // form cycle
    if (Z.controls.consumeSkill()) {
      const i = FORMS.indexOf(p.form); p.form = FORMS[(i + 1) % FORMS.length];
      formPoof = 0.4; p.dashT = 0; p.climbing = false;
      Z.fx.dust(p.x, p.y - 18, 8, '#cbb489'); Z.fx.ring(p.x, p.y - 20, SPIRIT, 4, 50, 0.3);
      Z.audio.sfx.flip(); Z.ui.toast(FORM_LABEL[p.form], 'gold');
    }
    if (formPoof > 0) formPoof -= dt;

    // move platforms (and carry the player if riding)
    for (const o of oneways) {
      if (!o.move) continue;
      o.mt = (o.mt || 0) + dt;
      const m = o.move, s = Math.sin(o.mt * m.speed) * 0.5 + 0.5, nx = U.lerp(m.min, m.max, s);
      if (m.axis === 'x') { o._dx = nx - o.x; o.x = nx; } else { o._dy = nx - o.y; o.y = nx; }
    }
    if (p.mover && p.onG) { p.x += p.mover._dx || 0; p.y += p.mover._dy || 0; }

    // ---- ladders ----
    const onLadder = ladders.some((ld) => p.x > ld.x - 6 && p.x < ld.x + ld.w + 6 && p.y > ld.y - 4 && p.y - ph.ph < ld.y + ld.h);
    p.climbing = onLadder && Z.controls.held.up && p.form !== 'rock';

    // ---- horizontal intent ----
    if (p.form === 'scissors' && Z.controls.consumeAttack() && p.dashT <= 0) startDash();
    if (p.dashT > 0) { p.dashT -= dt; p.vx = p.facing * 620; p.vy = 0; cutFences(); }
    else p.vx += (dir * ph.run - p.vx) * Math.min(1, dt * 14);

    // ---- jump: buffer + coyote ----
    if (Z.controls.consumeJump()) {
      if (p.form === 'scissors' && dir !== 0 && p.dashT <= 0) startDash();  // scissors + move = dash (mobile)
      else jbuf = 0.12;
    }
    if (jbuf > 0) jbuf -= dt;
    if (p.onG || p.climbing) coyote = 0.1; else if (coyote > 0) coyote -= dt;
    const canFlap = p.form === 'paper';
    if (jbuf > 0 && ph.jump && (coyote > 0 || p.climbing || (canFlap && p.vy > -60))) {
      p.vy = -ph.jump; jbuf = 0; coyote = 0; p.climbing = false;
      Z.fx.dust(p.x, p.y, 4, '#cbb489'); Z.audio.sfx.flip();
    }

    // ---- gravity / glide / updraft / climb ----
    if (p.climbing) {
      p.vy = (Z.controls.held.up ? -150 : 0);
    } else if (p.form === 'paper' && inUpdraft()) {
      p.vy = Math.max(p.vy - 2400 * dt, -300);
      if (Math.random() < 0.5) Z.fx.dust(p.x + U.rand(-12, 12), p.y - 10, 1, '#d7e3d0');
    } else {
      const cap = p.form === 'paper' ? (Z.controls.held.up ? ph.fall * 0.5 : ph.fall) : ph.fall;
      p.vy = Math.min(p.vy + ph.grav * dt, cap);
    }

    // ---- integrate + resolve (real AABB) ----
    const pw = ph.pw, phh = ph.ph;
    const bl = blockers();
    const prevBottom = p.y;
    p.mover = null;

    // X
    p.x += p.vx * dt;
    for (const b of bl) {
      if (overlap(p.x - pw, p.y - phh, pw * 2, phh, b)) {
        if (p.vx > 0) p.x = b.x - pw - 0.01;
        else if (p.vx < 0) p.x = b.x + b.w + pw + 0.01;
        else p.x = (p.x < b.x + b.w / 2) ? b.x - pw - 0.01 : b.x + b.w + pw + 0.01;
        p.vx = 0;
      }
    }

    // Y
    p.y += p.vy * dt;
    p.onG = false;
    if (!p.climbing) {
      for (const b of bl) {
        if (!overlap(p.x - pw, p.y - phh, pw * 2, phh, b)) continue;
        if (p.vy > 0) { land(b, prevBottom); }
        else if (p.vy < 0) { p.y = b.y + b.h + phh + 0.01; p.vy = 0; }
      }
      // one-way platforms: land whenever the feet cross the top edge this
      // frame (feet were at/above the top last frame, at/below it now). No
      // upper bound, so a fast fall can never tunnel straight through.
      if (p.vy >= 0) {
        for (const o of oneways) {
          if (p.x + pw * 0.7 < o.x || p.x - pw * 0.7 > o.x + o.w) continue;
          if (prevBottom <= o.y + 6 && p.y >= o.y) { land(o, prevBottom); p.mover = o.move ? o : null; }
        }
      }
    }

    p.walk = (Math.abs(p.vx) > 24 && p.onG) ? p.walk + dt : 0;
    if (p.squash > 0) p.squash -= dt * 4;

    // ---- hazards ----
    for (const hz of hazards) {
      const inset = hz.kind === 'spike' ? 10 : 6;
      if (overlap(p.x - pw * 0.6, p.y - phh * 0.7, pw * 1.2, phh * 0.7, { x: hz.x + inset, y: hz.y + inset, w: hz.w - inset * 2, h: hz.h - inset })) {
        if (hz.kind === 'spike' && p.form === 'rock') continue;               // rock shrugs off spikes
        if (hz.kind === 'steam' && !steamOn(hz)) continue;                    // steam pulses
        return respawn(hz.kind === 'steam' ? 'Scalded by the vent.' : 'Impaled on the spikes.');
      }
    }
    if (p.y > L.h + 240) return respawn('A long way down.');

    // ---- checkpoints ----
    for (const c of checkpoints) {
      if (c.idx > reachedCp && p.x >= c.x) {
        reachedCp = c.idx; cp = { x: c.x, y: c.y };
        Z.fx.ring(c.x, c.y - 30, SPIRIT, 6, 60, 0.4); Z.audio.sfx.rank();
      }
    }

    // ---- pickups ----
    for (const pk of pickups) {
      if (pk.got) continue;
      if (Math.abs(pk.x - p.x) < 30 && Math.abs(pk.y - (p.y - phh * 0.5)) < 40) {
        pk.got = true; got.push(pk.kind);
        Z.fx.confetti(pk.x, pk.y, 8); Z.audio.sfx.found(pk.kind === 'part' ? 'rare' : 'common');
      }
    }

    // ---- guards ----
    if (alarmT > 0) alarmT -= dt;
    for (const g of guards) {
      g.x += g.dir * 52 * dt;
      if (g.x < g.x0) { g.x = g.x0; g.dir = 1; } if (g.x > g.x1) { g.x = g.x1; g.dir = -1; }
      if (alarmT > 0) continue;
      const dx = p.x - g.x, dy = (p.y - phh * 0.5) - (g.y - 34);
      const inCone = Math.sign(dx) === g.dir && Math.abs(dx) < 300 && dx * g.dir > 20 && Math.abs(dy) < 78;
      const hiddenRock = p.form === 'rock' && Math.abs(p.vx) < 14 && p.onG;
      if (inCone && !hiddenRock) {
        Z.fx.screenFlash(0.4, '#c23b2f');
        Z.fx.bigText('SPOTTED!', { color: '#ffb0a0', size: 34, ring: false, y: 0.3, dur: 0.9 });
        Z.audio.sfx.error();
        return respawn(null, true);
      }
    }

    // ---- exit ----
    const e = L.exit;
    if (overlap(p.x - pw, p.y - phh, pw * 2, phh, e)) return finish();

    // ---- camera ----
    camX = U.lerp(camX, U.clamp(p.x - Z.render.W / 2, 0, Math.max(0, L.w - Z.render.W)), Math.min(1, dt * 6));
    camY = U.lerp(camY, U.clamp(p.y - Z.render.H * 0.60, -40, Math.max(0, L.h - Z.render.H)), Math.min(1, dt * 6));
  }

  function land(b, prevBottom) {
    p.y = b.y; p.vy = 0; p.onG = true;
    if (!p._wasG) { p.squash = Math.min(0.5, 0.14 + Math.abs(p._lastVy || 0) / 2600); Z.fx.dust(p.x, p.y, p.form === 'rock' ? 7 : 4, '#8a8172'); }
    if ((p._lastVy || 0) > 700) { Z.fx.addShake(p.form === 'rock' ? 5 : 2); }
    if (p.form === 'rock') smashCrates();
  }

  function startDash() { p.dashT = 0.2; Z.fx.speedLines(0.16, SPIRIT); Z.audio.sfx.boost(); }
  function inUpdraft() {
    for (const f of fans) if (p.x > f.x && p.x < f.x + f.w && p.y < f.y + f.h && p.y > f.y - 240) return true;
    return false;
  }
  const steamOn = (hz) => (Math.sin(t * 2.2 + hz.x * 0.03) > -0.1);   // ~70% duty cycle
  function smashCrates() {
    const pw = PHYS[p.form].pw;
    for (const c of crates) {
      if (!c.alive) continue;
      if (p.x + pw > c.x && p.x - pw < c.x + c.w && Math.abs(p.y - c.y) < 8) {
        c.alive = false;
        Z.fx.debris(c.x + c.w / 2, c.y + c.h / 2, 14, '#b0844f'); Z.fx.addShake(4); Z.audio.sfx.hammer();
      }
    }
  }
  function cutFences() {
    const pw = PHYS[p.form].pw;
    for (const f of fences) {
      if (!f.alive) continue;
      if (p.x + pw + 14 > f.x && p.x - pw - 14 < f.x + f.w && p.y > f.y - 4 && p.y - 44 < f.y + f.h) {
        f.alive = false;
        Z.fx.sparks(f.x + f.w / 2, f.y + f.h / 2, 0, 12, SPIRIT, Math.PI, 260); Z.audio.sfx.hit(1);
      }
    }
  }
  function respawn(msg, caught) {
    deaths++;
    Z.fx.screenFlash(0.4, '#c23b2f'); Z.audio.sfx.error();
    if (msg) Z.ui.toast(msg, 'warn');
    p.x = cp.x; p.y = cp.y; p.vx = p.vy = 0; p.dashT = 0; p.climbing = false; p.mover = null;
    if (caught) alarmT = 1.1;
  }

  function finish() {
    mode = 'done'; doneT = 0;
    const repeat = !!Z.state.campsDone[L.id];
    Z.state.campsDone[L.id] = true;
    // grant the parkour haul (parts + scrap) up front so it's banked whether
    // the boss fight is won or lost
    const parts = [];
    const n = repeat ? 1 : L.reward.parts + got.filter((k) => k === 'part').length;
    const floor = D.rarityRank(L.reward.rarity);
    for (let i = 0; i < n; i++) {
      const pool = D.parts.filter((x) => D.rarityRank(x.rarity) >= Math.max(0, floor - (i ? 1 : 0)));
      const part = U.weighted(pool, (x) => x.dropWeight + 4);
      Z.state.addItem(part.id, 1); parts.push(part);
    }
    const scrap = (repeat ? 10 : L.reward.scrap) + got.filter((k) => k === 'scrap').length * 8;
    Z.state.addScrap(scrap);
    Z.state.stats.rareFinds += parts.filter((x) => D.rarityRank(x.rarity) >= 2).length;
    Z.state.persist(); Z.quests.check();
    Z.fx.confetti(Z.render.W / 2, Z.render.H * 0.4, 40); Z.audio.sfx.win();

    // RAID: the exit opens onto the camp's boss mech — cut straight to combat.
    if (raidMode) { startBoss(parts, scrap); return; }

    // legacy DOM-select mode keeps the quiet haul cutscene + camp list
    Z.cutscene.play([
      { who: 'HAUL', text: 'Slipped out with ' + parts.map((x) => x.name).join(', ') + ' and ' + scrap + ' scrap.' + (deaths ? ' Reset ' + deaths + ' time' + (deaths > 1 ? 's' : '') + '. The tanuki forgives.' : ' A ghost in the depot. KANE-CO never knew.') },
    ], () => { mode = 'select'; document.getElementById('infilHud').style.display = 'none'; Z.controls.setMode('none'); renderSelect(); Z.ui.updateWallet(); });
  }

  // Hand the finished raid off to a boss duel: player's built mech vs a
  // camp boss scaled to the raid index. combat.start() switches to 'battle'.
  function startBoss(parts, scrap) {
    mode = 'battle';
    const hud = document.getElementById('infilHud'); if (hud) hud.style.display = 'none';
    const haul = parts.length ? parts.map((x) => x.name).join(', ') : (scrap + ' scrap');
    Z.ui.toast('Grabbed ' + haul + ' — now the camp boss stands in your way.', 'gold');
    const boss = pickBoss(raidIndex);
    if (!boss) { Z.controls.setMode('none'); Z.ui.show('world'); return; }   // safety
    const c = Z.Bot.compute(Z.state.build);
    const playerSpec = c.spec;
    playerSpec.name = Z.state.botName || playerSpec.name || 'YOUR MECH';
    const rp = 22 + raidIndex * 16;
    Z.combat.start(playerSpec, boss, { rp: rp });
  }

  // ================================================================
  //  RENDER
  // ================================================================
  // Hollow-Knight / Silksong flavored industrial sky: deep layered gradient,
  // distant ink-silhouette machinery drifting on parallax, sodium haloes and
  // a soft fog band. Kept moody but not muddy — platforms rim-light on top.
  function drawBackdrop(ctx, W, H, tt, scroll) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0f1822'); g.addColorStop(0.42, '#182231'); g.addColorStop(0.72, '#141d2a'); g.addColorStop(1, '#090d13');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // far silhouette skyline (two parallax layers of chimneys / gantries)
    function skyline(par, baseY, col, seed) {
      ctx.fillStyle = col;
      const step = 150, off = -(scroll * par) % (step * 3);
      ctx.beginPath(); ctx.moveTo(-40, H);
      for (let x = -step * 3 + off; x < W + step * 3; x += step) {
        const hsh = ((Math.sin((x * 0.7 + seed) * 12.9898) * 43758.5) % 1 + 1) % 1;
        const bw = step * (0.42 + hsh * 0.4), bh = baseY * (0.32 + hsh * 0.6);
        ctx.lineTo(x, H - baseY);
        ctx.lineTo(x, H - baseY - bh);
        ctx.lineTo(x + bw, H - baseY - bh);
        ctx.lineTo(x + bw, H - baseY);
        // a slim chimney on some blocks
        if (hsh > 0.6) { const cx = x + bw * 0.7; ctx.lineTo(cx, H - baseY); ctx.lineTo(cx, H - baseY - bh * 1.4); ctx.lineTo(cx + 12, H - baseY - bh * 1.4); ctx.lineTo(cx + 12, H - baseY); }
      }
      ctx.lineTo(W + 40, H - baseY); ctx.lineTo(W + 40, H); ctx.closePath(); ctx.fill();
    }
    skyline(0.05, H * 0.30, 'rgba(24,34,48,.6)', 3.1);
    skyline(0.1, H * 0.20, 'rgba(15,22,32,.75)', 91.7);

    // sodium-lamp glows drifting behind the machinery
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const bx = ((W * (0.16 + i * 0.26) - scroll * 0.09) % (W + 360) + (W + 360)) % (W + 360) - 180;
      const by = H * (0.14 + (i % 2) * 0.09);
      const rg = ctx.createRadialGradient(bx, by, 6, bx, by, 260);
      rg.addColorStop(0, 'rgba(255,193,116,' + (0.13 + 0.03 * Math.sin(tt * 0.7 + i)) + ')');
      rg.addColorStop(1, 'rgba(255,193,116,0)');
      ctx.fillStyle = rg; ctx.fillRect(bx - 260, by - 260, 520, 520);
    }
    ctx.restore();

    // low haze / fog band so the depths sink into mist
    const mg = ctx.createLinearGradient(0, H * 0.46, 0, H);
    mg.addColorStop(0, 'rgba(120,150,172,0)'); mg.addColorStop(0.55, 'rgba(96,124,148,.07)'); mg.addColorStop(1, 'rgba(60,80,100,.14)');
    ctx.fillStyle = mg; ctx.fillRect(0, H * 0.46, W, H * 0.54);
  }

  // drifting spore/fog puffs in the foreground (screen space, additive-soft)
  function drawFog(ctx, W, H, dt, tt) {
    if (!fog) { fog = []; for (let i = 0; i < 7; i++) fog.push({ x: Math.random() * W, y: H * (0.4 + Math.random() * 0.55), r: 90 + Math.random() * 160, vx: 4 + Math.random() * 8, a: 0.03 + Math.random() * 0.04, ph: Math.random() * 6 }); }
    ctx.save();
    for (const f of fog) {
      f.x += f.vx * dt * 6; f.ph += dt;
      const sx = ((f.x - camX * 0.16) % (W + f.r * 2) + (W + f.r * 2)) % (W + f.r * 2) - f.r;
      const sy = f.y + Math.sin(f.ph) * 10;
      const gg = ctx.createRadialGradient(sx, sy, 2, sx, sy, f.r);
      gg.addColorStop(0, 'rgba(158,182,200,' + f.a.toFixed(3) + ')'); gg.addColorStop(1, 'rgba(158,182,200,0)');
      ctx.fillStyle = gg; ctx.fillRect(sx - f.r, sy - f.r, f.r * 2, f.r * 2);
    }
    ctx.restore();
  }

  // parallax decor (screen space; each object drifts by its par factor)
  function drawDecor(ctx, W, H) {
    for (const d of decor) {
      const sx = d.x - camX * d.par, sy = d.y - camY * d.par;
      if (sx > W + 40 || sx + d.w < -40) continue;
      ctx.save(); ctx.globalAlpha = d.par < 0.5 ? 0.5 : d.par < 0.8 ? 0.72 : 0.95;
      drawTile(ctx, d.tile, sx, sy, d.w, d.h);
      ctx.restore();
    }
  }

  function drawMotes(ctx, W, H, dt) {
    if (!motes) { motes = []; for (let i = 0; i < 46; i++) motes.push({ x: Math.random() * W, y: Math.random() * H, vy: 4 + Math.random() * 14, ph: Math.random() * 6, r: 0.7 + Math.random() * 1.9, dp: 0.35 + Math.random() * 0.5 }); }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const m of motes) {
      m.ph += dt; m.y += m.vy * dt * 0.4;
      if (m.y > H + 10) { m.y = -8; m.x = Math.random() * W; }
      const sx = ((m.x - camX * m.dp) % (W + 60) + (W + 60)) % (W + 60) - 30;
      const a = 0.09 + 0.08 * Math.sin(m.ph * 1.6);
      ctx.fillStyle = 'rgba(220,210,182,' + a.toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(sx + Math.sin(m.ph) * 8, m.y, m.r, 0, U.TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawSolid(ctx, o) {
    const na = o.w * aspect(o.tile);
    if (na >= o.h - 2) { drawTile(ctx, o.tile, o.x, o.y, o.w, o.h); }
    else {
      const g = ctx.createLinearGradient(0, o.y, 0, o.y + o.h);
      g.addColorStop(0, '#4a4238'); g.addColorStop(1, '#241f1a');
      ctx.fillStyle = g; ctx.fillRect(o.x, o.y, o.w, o.h);
      drawTile(ctx, o.tile, o.x, o.y, o.w, na);   // textured cap on top
    }
    // pale rim light along the walkable top edge (silhouette read) — the
    // hitbox top is exactly o.y, so this line marks the real collision surface
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const rl = ctx.createLinearGradient(0, o.y - 3, 0, o.y + 5);
    rl.addColorStop(0, 'rgba(190,214,224,0)'); rl.addColorStop(0.5, 'rgba(190,214,224,.5)'); rl.addColorStop(1, 'rgba(190,214,224,0)');
    ctx.fillStyle = rl; ctx.fillRect(o.x, o.y - 3, o.w, 8);
    ctx.restore();
  }

  function drawExit(ctx, e, tt) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const cx = e.x + e.w / 2;
    const glow = ctx.createRadialGradient(cx, e.y + e.h * 0.4, 6, cx, e.y + e.h * 0.4, e.w);
    glow.addColorStop(0, 'rgba(150,230,207,' + (0.2 + 0.07 * Math.sin(tt * 2)) + ')'); glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(cx - e.w, e.y - e.h * 0.5, e.w * 2, e.h * 1.8); ctx.restore();
    drawTile(ctx, e.tile, e.x, e.y, e.w, e.h);
    // spirit-green seam of light down the shutter
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(150,230,207,.28)';
    ctx.fillRect(cx - 5, e.y + 8, 10, e.h - 16); ctx.restore();
    const bob = Math.sin(tt * 4) * 3;
    Z.render.pxText(ctx, 'OUT', cx, e.y - 14 + bob, 10, SPIRIT, 'center');
  }

  function drawFan(ctx, f, tt) {
    // updraft column
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const col = ctx.createLinearGradient(0, f.y - 230, 0, f.y);
    col.addColorStop(0, 'rgba(150,210,230,0)'); col.addColorStop(1, 'rgba(150,210,230,.14)');
    ctx.fillStyle = col; ctx.fillRect(f.x + 6, f.y - 230, f.w - 12, 230);
    ctx.strokeStyle = 'rgba(190,224,240,.4)'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const yy = f.y - ((tt * 150 + i * 60) % 230);
      const xx = f.x + f.w * (0.2 + 0.2 * i) + Math.sin(tt * 3 + i) * 8;
      ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, yy - 18); ctx.stroke();
    }
    ctx.restore();
    drawTile(ctx, f.tile, f.x, f.y, f.w, f.h);
  }

  function drawHazard(ctx, hz, tt) {
    drawTile(ctx, hz.tile, hz.x, hz.y, hz.w, hz.h);
    if (hz.kind === 'steam' && steamOn(hz)) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const yy = hz.y - ((tt * 90 + i * 34) % 90);
        const a = 0.28 * (1 - ((tt * 90 + i * 34) % 90) / 90);
        ctx.fillStyle = 'rgba(220,232,238,' + a.toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(hz.x + hz.w / 2 + Math.sin(tt * 3 + i) * 10, yy, 10, 0, U.TAU); ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawGuard(ctx, g, tt) {
    const warm = alarmT > 0 ? '255,110,90' : '255,214,150';
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath(); ctx.moveTo(g.x, g.y - 36);
    ctx.lineTo(g.x + g.dir * 300, g.y - 36 - 70); ctx.lineTo(g.x + g.dir * 300, g.y - 36 + 70); ctx.closePath();
    const cg = ctx.createLinearGradient(g.x, 0, g.x + g.dir * 300, 0);
    cg.addColorStop(0, 'rgba(' + warm + ',.22)'); cg.addColorStop(1, 'rgba(' + warm + ',0)');
    ctx.fillStyle = cg; ctx.fill();
    const lg = ctx.createRadialGradient(g.x, g.y - 36, 2, g.x, g.y - 36, 42);
    lg.addColorStop(0, 'rgba(' + warm + ',.26)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lg; ctx.fillRect(g.x - 42, g.y - 78, 84, 84);
    ctx.restore();
    const bob = Math.sin(tt * 2.4 + g.ph) * 4;
    ctx.save(); ctx.translate(g.x, g.y - 40 - bob); ctx.scale(g.dir, 1);
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, -13, -20, 26, 32, 7), '#5c6472', { noShadow: true, cut: 3 });
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, -9, -34, 18, 15, 5), '#79828f', { noShadow: true, cut: 2.6 });
    ctx.fillStyle = alarmT > 0 ? '#ff5a4a' : '#ffd27a'; ctx.beginPath(); ctx.arc(3, -26, 3, 0, U.TAU); ctx.fill();
    // hover thrusters
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(150,210,240,.5)';
    ctx.beginPath(); ctx.ellipse(-6, 14, 4, 7 + Math.sin(tt * 20) * 2, 0, 0, U.TAU); ctx.ellipse(6, 14, 4, 7 + Math.cos(tt * 20) * 2, 0, 0, U.TAU); ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  function drawPickups(ctx, tt) {
    for (const pk of pickups) {
      if (pk.got) continue;
      const bob = Math.sin(tt * 3 + pk.x) * 5;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gg = ctx.createRadialGradient(pk.x, pk.y + bob, 2, pk.x, pk.y + bob, 34);
      gg.addColorStop(0, U.rgba(pk.kind === 'part' ? GOLD : SPIRIT, 0.34)); gg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gg; ctx.fillRect(pk.x - 34, pk.y + bob - 34, 68, 68); ctx.restore();
      if (pk.kind === 'part') {
        Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, pk.x - 12, pk.y - 12 + bob, 24, 24, 6), GOLD, { noShadow: true, cut: 2.6 });
        ctx.fillStyle = '#5b4a2a'; ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 4, 0, U.TAU); ctx.fill();   // core bolt
      } else {
        Z.render.paperFill(ctx, () => { ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 9, 0, U.TAU); }, '#b3a890', { noShadow: true, cut: 2.6 });
      }
    }
  }

  function drawPlayer(ctx, tt) {
    const px = p.x, py = p.y, ph = PHYS[p.form];
    const gliding = p.form === 'paper' && !p.onG;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const rr = gliding ? 38 : 24;
    const rl = ctx.createRadialGradient(px, py - 16, 2, px, py - 16, rr);
    rl.addColorStop(0, 'rgba(170,225,205,' + (gliding ? 0.22 : 0.1) + ')'); rl.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rl; ctx.fillRect(px - rr, py - 16 - rr, rr * 2, rr * 2);
    ctx.restore();
    if (formPoof > 0) { ctx.save(); ctx.globalAlpha = formPoof * 2; ctx.fillStyle = '#f5ecd7'; ctx.beginPath(); ctx.arc(px, py - 18, 24 * (1 - formPoof), 0, U.TAU); ctx.fill(); ctx.restore(); }

    if (p.form === 'tanuki') {
      const moving = Math.abs(p.vx) > 24 && p.onG;
      Z.render.drawSprite('char.tanuki', px, py, { w: 46, facing: p.facing, bob: 0, squash: p.onG ? (p.squash > 0 ? -p.squash : Math.cos(p.walk * 18) * 0.04) : -0.06, anim: !p.onG ? 'jump' : moving ? 'walk' : 'idle', animT: moving ? p.walk : tt });
    } else if (p.form === 'rock') {
      const sq = 1 + (p.squash > 0 ? p.squash : 0);
      ctx.save(); ctx.translate(px, py); ctx.scale((1 / sq) * 0.82, sq * 0.82);
      Z.render.paperFill(ctx, () => { ctx.beginPath(); ctx.moveTo(-19, 0); ctx.lineTo(-15, -26); ctx.lineTo(0, -34); ctx.lineTo(17, -24); ctx.lineTo(20, 0); ctx.closePath(); }, '#8f8577', { cut: 4 });
      ctx.strokeStyle = 'rgba(30,26,20,.4)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(2, -20); ctx.moveTo(6, -6); ctx.lineTo(12, -18); ctx.stroke();
      ctx.restore();
      drawFace(ctx, px, py - 13, p.facing);
    } else if (p.form === 'paper') {
      const tilt = U.clamp(p.vy * 0.0006, -0.32, 0.34) * p.facing + (p.onG ? 0 : Math.sin(tt * 6) * 0.05);
      Z.render.drawGlide(px, py - ph.ph * 0.5, { w: 92, facing: p.facing, animT: tt, tilt: tilt });
    } else { // scissors
      ctx.save(); ctx.translate(px, py - 15); ctx.scale(p.facing * 0.82, 0.82); ctx.rotate(p.dashT > 0 ? -0.4 : Math.sin(tt * 6) * 0.08);
      Z.render.paperFill(ctx, () => { ctx.beginPath(); ctx.moveTo(-4, 2); ctx.lineTo(22, -9); ctx.lineTo(-2, -4); ctx.closePath(); }, '#b8c0c8', { noShadow: true, cut: 2.6 });
      Z.render.paperFill(ctx, () => { ctx.beginPath(); ctx.moveTo(-4, -9); ctx.lineTo(22, 2); ctx.lineTo(-2, -2); ctx.closePath(); }, '#cfd6dd', { noShadow: true, cut: 2.6 });
      Z.render.paperFill(ctx, () => { ctx.beginPath(); ctx.arc(-9, -11, 7, 0, U.TAU); }, '#c0392b', { noShadow: true, cut: 2.6 });
      Z.render.paperFill(ctx, () => { ctx.beginPath(); ctx.arc(-9, 5, 7, 0, U.TAU); }, '#c0392b', { noShadow: true, cut: 2.6 });
      drawFace(ctx, -9, -3, 1);
      ctx.restore();
    }
  }
  function drawFace(ctx, x, y, facing) {
    ctx.save(); ctx.translate(x, y); ctx.scale(facing < 0 ? -1 : 1, 1);
    ctx.fillStyle = '#2f2418';
    ctx.beginPath(); ctx.arc(-4, -2, 2, 0, U.TAU); ctx.arc(4, -2, 2, 0, U.TAU); ctx.fill();
    ctx.strokeStyle = '#2f2418'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, 2, 3, 0.3, Math.PI - 0.3); ctx.stroke();
    ctx.restore();
  }

  // pale rim light on a platform's walkable top edge (marks the real hitbox)
  function topRim(ctx, x, y, w) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const rl = ctx.createLinearGradient(0, y - 3, 0, y + 5);
    rl.addColorStop(0, 'rgba(190,214,224,0)'); rl.addColorStop(0.5, 'rgba(190,214,224,.5)'); rl.addColorStop(1, 'rgba(190,214,224,0)');
    ctx.fillStyle = rl; ctx.fillRect(x, y - 3, w, 8); ctx.restore();
  }

  function frame(dt, tt) {
    if (mode === 'battle') return;                         // handed off to the boss fight
    const ctx = Z.render.ctx, W = Z.render.W, H = Z.render.H;
    Z.render.clear();
    drawBackdrop(ctx, W, H, tt, mode === 'play' ? camX : tt * 20);
    if (mode === 'select') { drawFog(ctx, W, H, dt, tt); drawMotes(ctx, W, H, dt); return; }

    p._wasG = p.onG; p._lastVy = p.vy;
    update(dt);
    if (mode === 'battle') { Z.fx.renderScreen(ctx, W, H); return; }   // update() cut to the boss fight

    drawFog(ctx, W, H, dt, tt);                            // mid-depth mist behind the level
    drawDecor(ctx, W, H);

    ctx.save(); ctx.translate((-camX + Z.fx.shakeX) | 0, (-camY + Z.fx.shakeY) | 0);
    // ground shadow pass
    for (const o of solids) { ctx.save(); ctx.globalAlpha = 0.4; ctx.fillStyle = '#05090c'; ctx.fillRect(o.x + 5, o.y + 8, o.w, o.h); ctx.restore(); }
    for (const o of solids) drawSolid(ctx, o);
    for (const ld of ladders) drawTile(ctx, ld.tile, ld.x, ld.y, ld.w, ld.h);
    for (const o of oneways) { drawTile(ctx, o.tile, o.x, o.y, o.w, o.h); topRim(ctx, o.x, o.y, o.w); }
    for (const f of fans) drawFan(ctx, f, tt);
    for (const hz of hazards) drawHazard(ctx, hz, tt);
    for (const c of crates) if (c.alive) drawTile(ctx, c.tile, c.x, c.y, c.w, c.h);
    for (const f of fences) if (f.alive) drawTile(ctx, f.tile, f.x, f.y, f.w, f.h);
    drawExit(ctx, L.exit, tt);
    drawPickups(ctx, tt);
    for (const g of guards) drawGuard(ctx, g, tt);
    drawPlayer(ctx, tt);
    Z.fx.render(ctx);
    ctx.restore();

    drawMotes(ctx, W, H, dt);
    // soft foreground vignette to seat the moody depth
    const vg = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.34, W / 2, H * 0.5, H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(3,6,10,.5)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    Z.fx.renderScreen(ctx, W, H);
    // quiet HUD
    Z.render.pxText(ctx, FORM_LABEL[p.form], 18, H - 22, 12, SPIRIT, 'left');
    Z.render.pxText(ctx, 'SKILL: form   J: dash (scissors)', 18, H - 42, 8, 'rgba(180,200,196,.7)', 'left');
    if (deaths) Z.render.pxText(ctx, 'resets x' + deaths, W - 18, H - 22, 9, '#ffb0a0', 'right');
  }

  function enter() { mode = 'select'; document.getElementById('infilHud').style.display = 'none'; renderSelect(); }
  function leave() { mode = 'select'; }
  function init() { Z.ui.onEnter('infil', enter); }
  // _dbg: harmless test seam (used by the headless verifier to reach the exit)
  const _dbg = { warpExit() { if (!L || !p) return false; p.x = L.exit.x + L.exit.w / 2; p.y = L.exit.y + L.exit.h * 0.5; p.vx = 0; p.vy = 0; alarmT = 3; return true; }, get p() { return p; }, get mode() { return mode; } };
  return { init, frame, startRaid, get playing() { return mode === 'play'; }, leave, _dbg };
})();
