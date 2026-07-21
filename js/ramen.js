/* ================================================================
   ramen.js — AO'S RAMEN as a playable scene: the tanuki walks in,
   hops onto a stool at the counter, and the shop turns into a cozy
   Persona-style dialogue. Ao the yokai takes your order through
   ANSWER CHOICES (no menu grid) — each bowl is a buff for the next
   mech duel. The old #ramenNpc/#ramenList DOM stays hidden.
   ================================================================ */
Z.ramen = (function () {
  const U = Z.util, $ = U.$, D = Z.data;
  const SPEED = 300, ACCEL = 12;
  const kid = { x: -80, vx: 0, facing: 1, walk: 0, turn: 0 };
  let seated = false, seatT = 0, entered = false;
  let phase = 'walkin';                 // 'walkin' | 'feast'
  let feastT = 0, menuLaunched = false, leaving = false, first = true;
  let steam = [], nearStool = false, warp = 0;

  const AO_LINES = () => (D.AO_LINES && D.AO_LINES.length ? D.AO_LINES : ['Eat first. Fight after.']);
  const greet = () => U.choice(AO_LINES());

  const ASK_FIRST = [
    'Sit, sit. Broth is already singing. What will it be, little one?',
    'Leaf still on your head, good. Hungry paws fight better. Pick a bowl.',
    'The stool remembers you. Now — what warms the frame tonight?',
  ];
  const ASK_MORE = [
    'Still room under that scarf? Order away.',
    "Pot's not empty yet. Anything else before the dohyo?",
    'One more? The steam is free, the noodles are not.',
  ];

  function enter() {
    entered = true; seated = false; seatT = 0;
    kid.x = -80; kid.vx = 0; kid.facing = 1; kid.walk = 0; kid.turn = 0;
    phase = 'walkin'; feastT = 0; menuLaunched = false; leaving = false; first = true;
    steam = []; nearStool = false; warp = 0.3;
    const npc = $('#ramenNpc'), list = $('#ramenList');
    if (npc) npc.classList.remove('on');
    if (list) list.classList.remove('on');
  }

  function leaveTo(screen) { kid.vx = 0; if (Z.audio) Z.audio.sfx.click(); Z.ui.show(screen); }

  // ---------------- scene / canvas ----------------
  function frame(dt, t) {
    const ctx = Z.render.ctx, W = Z.render.W, H = Z.render.H;
    Z.render.clear();

    if (phase === 'feast') { drawFeast(ctx, W, H, dt, t); Z.render.drawPetals(t); return; }

    // ---- walk-in: clean night ramen-stall exterior ----
    if (!Z.assets.cover(ctx, 'ramen.exterior', 0, 0, W, H, 0.5) &&
        !Z.assets.cover(ctx, 'ramen.inside', 0, 0, W, H, 0.5)) {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#3a2a18'); g.addColorStop(1, '#241a10');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    const groundY = H * 0.9;
    const tanW = U.clamp(H * 0.16, 90, 150);               // small tanuki (~3x smaller)
    const aoW = U.clamp(H * 0.2, 110, 180);                // small Ao behind the counter
    const stoolH = U.clamp(H * 0.06, 34, 64);
    const seatX = W * 0.4;
    const minX = W * 0.03, maxX = W * 0.97;

    // soft ground-contact shade only — keep the photo bright
    const gg = ctx.createLinearGradient(0, groundY - H * 0.14, 0, H);
    gg.addColorStop(0, 'rgba(30,18,8,0)'); gg.addColorStop(1, 'rgba(30,18,8,.4)');
    ctx.fillStyle = gg; ctx.fillRect(0, groundY - H * 0.14, W, H - groundY + H * 0.14);

    // Ao working behind the counter
    const aoBob = Math.abs(Math.sin(t * 2)) * 4;
    Z.render.drawSprite('char.ao', W * 0.74, groundY - 6, { w: aoW, bob: aoBob, squash: Math.sin(t * 4) * 0.03, sway: Math.sin(t * 1.9) * 0.06, facing: -1 });

    // paper stool
    Z.render.paperFill(ctx, () => { Z.render.roundRect(ctx, seatX - 30, groundY - stoolH, 60, 14, 6); }, '#b0844f', { cut: 3.4 });
    Z.render.paperFill(ctx, () => { ctx.beginPath(); ctx.rect(seatX - 6, groundY - stoolH + 12, 12, stoolH - 14); }, '#8a6a45', { noShadow: true, cut: 3 });

    if (warp > 0) warp -= dt;

    const doorX = W * 0.5;                                  // the shop front — ENTER to go inside
    let nearDoor = false;
    if (kid.x < minX) {
      // auto walk in from the left edge
      kid.vx = SPEED; kid.x += SPEED * dt; kid.walk += dt; kid.facing = 1;
    } else {
      // free roam: A/D. left edge -> crossroad, right edge (past Ao) -> cave,
      // ENTER at the shop front -> step inside for a bowl.
      const dir = Z.controls ? Z.controls.dir : 0;
      if (dir && dir !== kid.facing) { kid.facing = dir; kid.turn = 1; }
      if (kid.turn > 0) kid.turn = Math.max(0, kid.turn - dt * 5);
      kid.vx += (dir * SPEED - kid.vx) * Math.min(1, dt * ACCEL);
      if (Math.abs(kid.vx) < 3) kid.vx = 0;
      kid.x = U.clamp(kid.x + kid.vx * dt, minX, maxX);
      kid.walk = Math.abs(kid.vx) > 6 ? kid.walk + dt : 0;

      if (warp <= 0) {
        if (kid.x <= minX + 2 && dir < 0) { leaveTo('world'); return; }
        if (kid.x >= maxX - 2 && dir > 0) { leaveTo('cave'); return; }
      }
      nearDoor = Math.abs(kid.x - doorX) < W * 0.08;
      if (nearDoor && Z.controls && Z.controls.consumeInteract()) { enterShop(); return; }
    }

    const moving = Math.abs(kid.vx) > 6;
    const hop = moving ? Math.abs(Math.sin(kid.walk * 10)) * (H * 0.016) : Math.sin(t * 2.2) * (H * 0.004);
    Z.render.drawSprite('char.tanuki', kid.x, groundY, {
      w: tanW, bob: hop, squash: moving ? Math.cos(kid.walk * 20) * 0.03 : Math.sin(t * 2.2) * 0.02,
      facing: kid.facing, turn: kid.turn, sway: moving ? Math.sin(kid.walk * 10) * 0.04 : 0,
      anim: moving ? 'walk' : 'idle', animT: moving ? kid.walk : t,
    });
    if (moving && Math.random() < 0.2) Z.fx.dust(kid.x - kid.facing * tanW * 0.16, groundY, 1, '#cbb489');
    if (kid.x >= minX) {
      doorMarker(ctx, doorX, groundY, H, nearDoor, t);
      edgeHint(ctx, W, H, t, -1, 'CROSSROAD', kid.x <= W * 0.22);
      edgeHint(ctx, W, H, t, 1, 'CAVE', kid.x >= W * 0.78);
    }

    timeTint(ctx, W, H);
    if (Z.clock && Z.clock.draw) Z.clock.draw(ctx, 40, 46);
    Z.render.drawPetals(t);
  }

  function enterShop() { Z.audio.sfx.flip(); toFeast(); }

  // soft glow + ENTER over the shop front — no icon
  function doorMarker(ctx, x, gy, H, near, t) {
    const glow = near ? 1 : 0.3;
    const iy = gy - H * 0.34 - Math.sin(t * 2.4) * 3 - glow * 5;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const hr = 13 + glow * 10;
    const hg = ctx.createRadialGradient(x, iy, 1, x, iy, hr);
    hg.addColorStop(0, U.rgba('#ffd98a', 0.16 + glow * 0.3)); hg.addColorStop(1, U.rgba('#ffd98a', 0));
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(x, iy, hr, 0, U.TAU); ctx.fill();
    ctx.restore();
    if (near) Z.render.pxText(ctx, 'ENTER', x, iy - 6, 9, U.rgba('#fff1d6', 0.9), 'center');
  }

  // faint glowing chevron hugging one screen edge (same idiom as the crossroad)
  function edgeHint(ctx, W, H, t, side, name, active) {
    const s = Math.max(1, H / 720);
    const x = side < 0 ? 30 * s : W - 30 * s, y = H * 0.52;
    const a = active ? 0.85 : 0.24, pulse = active ? Math.sin(t * 5) * 5 * s : 0;
    ctx.save();
    ctx.globalAlpha = a; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < 2; i++) {
      const ox = (side < 0 ? -1 : 1) * (i * 11 * s + pulse);
      ctx.beginPath();
      ctx.moveTo(x + ox + side * 9 * s, y - 12 * s);
      ctx.lineTo(x + ox - side * 9 * s, y);
      ctx.lineTo(x + ox + side * 9 * s, y + 12 * s);
      ctx.strokeStyle = 'rgba(20,12,6,.4)'; ctx.lineWidth = 6 * s; ctx.stroke();
      ctx.strokeStyle = '#fff7ea'; ctx.lineWidth = 3.4 * s; ctx.stroke();
    }
    if (active) Z.render.pxText(ctx, name, x, y + 34 * s, 10 * s, '#fff1d6', 'center');
    ctx.restore();
  }

  function toFeast() {
    phase = 'feast'; feastT = 0;
    Z.audio.sfx.coin();
    Z.fx.screenFlash(0.22, '#ffdca0');
    openMenu(true);
  }

  // the 'ramen.eating' art as a big warm cut-in behind the dialogue box
  function drawFeast(ctx, W, H, dt, t) {
    // base exterior, then dissolve the group-eating cut-in over it
    if (!Z.assets.cover(ctx, 'ramen.exterior', 0, 0, W, H, 0.5) &&
        !Z.assets.cover(ctx, 'ramen.inside', 0, 0, W, H, 0.5)) { ctx.fillStyle = '#2a1e12'; ctx.fillRect(0, 0, W, H); }
    feastT = Math.min(1, feastT + dt * 2.4);
    ctx.save(); ctx.globalAlpha = feastT;
    if (!Z.assets.cover(ctx, 'ramen.eating', 0, 0, W, H, 0.5)) {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#3a2a18'); g.addColorStop(1, '#241a10');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();

    // soft bottom shade so the dialogue box reads — kept light, photo stays bright
    const gg = ctx.createLinearGradient(0, H * 0.6, 0, H);
    gg.addColorStop(0, 'rgba(24,14,6,0)'); gg.addColorStop(1, 'rgba(24,14,6,.34)');
    ctx.fillStyle = gg; ctx.fillRect(0, H * 0.6, W, H * 0.4);

    // curling steam wisps rising off the bowls
    if (steam.length < 22 && Math.random() < 0.5) {
      steam.push({ x: U.rand(0.28, 0.72) * W, y: H * U.rand(0.62, 0.74), vy: U.rand(-26, -14), life: U.rand(1.1, 2.0), max: 2.0, s: U.rand(7, 16), ph: U.rand(0, 6.28) });
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = steam.length - 1; i >= 0; i--) {
      const p = steam[i]; p.life -= dt; if (p.life <= 0) { steam.splice(i, 1); continue; }
      p.y += p.vy * dt; p.x += Math.sin(t * 1.6 + p.ph) * 10 * dt;
      const a = U.clamp(p.life / p.max, 0, 1) * 0.16;
      const g = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.s);
      g.addColorStop(0, U.rgba('#fff4e0', a)); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, U.TAU); ctx.fill();
    }
    ctx.restore();
    timeTint(ctx, W, H);
  }

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

  // ---------------- ordering (Persona answer-choices) ----------------
  function buffTag(dish) {
    const hp = Math.round((dish.hpMul - 1) * 100), pw = Math.round((dish.powMul - 1) * 100);
    return '+' + hp + '% HP' + (pw ? '  +' + pw + '% PWR' : '');
  }
  function snackLabel(dish, active, poor) {
    let tail = active ? '  — already eaten' : ('  · ¥' + dish.price + (poor ? '  (short)' : ''));
    return dish.name + '  (' + buffTag(dish) + ')' + tail;
  }

  const AO_SERVE = [
    'One {name}, coming up. Feel the broth reach your servos yet?',
    '{name}. Good pick. Eat slow — the strength settles into the frame that way.',
    'There. {name}. Step onto the dohyo warm and they will feel it in every hit.',
    'Order up: {name}. The steam alone would scare a KANE-CO drone off.',
  ];

  function doBuy(dish) {
    Z.state.spend(dish.price);
    Z.state.setBuff({ id: dish.id, name: dish.name, hpMul: dish.hpMul, powMul: dish.powMul });
    Z.audio.sfx.buy();
    Z.fx.screenFlash(0.14, '#ffd98a');
    Z.ui.toast('Ate ' + dish.name + ' — belly warm for the next duel', 'gold');
  }

  function buildMenu(isFirst) {
    const askText = U.choice(isFirst ? ASK_FIRST : ASK_MORE);
    const choices = [];
    (D.RAMEN || []).forEach((dish) => {
      const active = Z.state.buff && Z.state.buff.id === dish.id;
      const poor = Z.state.credits < dish.price;
      let then, act;
      if (active) {
        act = () => { Z.audio.sfx.hover(); };
        then = [{ who: 'Ao', img: 'ao', text: 'That glow is still in you. No sense doubling a good thing — save your coin.' }];
      } else if (poor) {
        act = () => { Z.audio.sfx.error(); Z.ui.toast('Not enough credits', 'warn'); };
        then = [{ who: 'Ao', img: 'ao', text: 'Purse is a little light for that one. Win a bout, then come back. The pot keeps.' }];
      } else {
        act = () => doBuy(dish);
        then = [{ who: 'Ao', img: 'ao', text: U.choice(AO_SERVE).replace('{name}', dish.name) }];
      }
      choices.push({ label: snackLabel(dish, active, poor), act, then });
    });

    // cozy crew banter branch
    choices.push({ label: 'Just here to sit a while.', then: chatterScene() });
    // exit
    choices.push({
      label: 'Maybe later. Heading out.',
      act: () => { leaving = true; },
      then: [{ who: 'Ao', img: 'ao', text: U.choice(['Door is always open. Fight clean, come back hungry.', 'Go on then. The dohyo waits, and so does the broth.', 'Off you go. Try not to come home as spare parts.']) }],
    });

    return [{ who: 'Ao', img: 'ao', text: askText, choices }];
  }

  // cozy Persona-style hangout banter with the crew at the counter
  function chatterScene() {
    const options = [
      [
        { who: 'Tengu', img: 'tengu', side: 'right', text: 'Kid finally sat down. I was about to eat your bowl for you.' },
        { who: 'Kappa', img: 'kappa', text: 'He would have, too. Watch him near your chashu. Watch him always.' },
        { who: 'Ao', img: 'ao', text: 'Peace at my counter. Everyone gets a bowl. Even the ones who steal them.' },
      ],
      [
        { who: 'Kappa', img: 'kappa', side: 'right', text: 'I re-seated a wobbly servo on your left leg while you walked in. Do not thank me. Slurp louder instead.' },
        { who: 'Ao', img: 'ao', text: 'That is how this town says friend. Fix a joint, share a bowl, say nothing sweet about it.' },
      ],
      [
        { who: 'Ao', img: 'ao', text: 'KANE-CO measured my noodle steam yesterday. For "asset value." I offered them a taste. They fled.' },
        { who: 'Tengu', img: 'tengu', side: 'right', text: 'They fear what they cannot put on a clipboard. Warmth, mostly.' },
      ],
      [
        { who: 'Ao', img: 'ao', text: greet() },
        { who: 'Ao', img: 'ao', text: 'Rest the frame here as long as you like. The dohyo will still be there, hungry as ever.' },
      ],
    ];
    return U.choice(options);
  }

  function openMenu(isFirst) {
    phase = 'feast';
    leaving = false;
    Z.cutscene.play(buildMenu(isFirst), onMenuDone);
  }

  function onMenuDone() {
    if (leaving) {
      leaving = false; menuLaunched = false;
      Z.ui.show('world');
      return;
    }
    first = false;
    openMenu(false);           // loop back to the counter for another round
  }

  // hidden DOM stays unused; keep a safe render export
  function render() {
    const npc = $('#ramenNpc'), list = $('#ramenList');
    if (npc) npc.classList.remove('on');
    if (list) list.classList.remove('on');
  }

  function init() { Z.ui.onEnter('ramen', enter); }
  return { init, frame, render };
})();
