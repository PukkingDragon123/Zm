/* ================================================================
   overworld.js — the CROSSROAD. One clean cherry-tree street. The
   round tanuki stands small in the middle; WALK TO AN EDGE and you
   slip through to another place. No signboards:
     walk off the LEFT  edge  -> HOME
     walk off the RIGHT edge  -> AO'S RAMEN (and past it, the CAVE)
   Faint edge chevrons hint where each side goes. Background is the
   star.
   ================================================================ */
Z.overworld = (function () {
  const U = Z.util;
  const ACCEL = 12;
  const LEFT = { screen: 'house', name: 'HOME' };
  const RIGHT = { screen: 'ramen', name: "AO'S RAMEN" };
  let kid = { fx: 0.5, vx: 0, facing: 1, walk: 0, turn: 0 };
  let started = false, warp = 0;

  // ---- living-town ambient layer (all canvas / existing sprites, no new art) ----
  let npcs = [], flies = [], birds = [], birdT = 3;
  const NPC_KEYS = ['char.kappa', 'char.tengu', 'char.oni', 'char.ao'];
  const qW = (w) => Math.round(w / 8) * 8;               // stable sprite-cache buckets
  const night = () => !!(Z.state && Z.state.isNight);

  function enter() { started = true; kid.fx = 0.5; kid.vx = 0; warp = 0.35; initAmbient(); }   // spawn safely mid-street

  function initAmbient() {
    npcs = []; flies = []; birds = []; birdT = U.rand(2, 6);
    npcs.push(spawnNpc(true)); npcs.push(spawnNpc(true));
  }
  function spawnNpc(anyX) {
    const key = U.choice(NPC_KEYS), dir = U.chance(0.5) ? 1 : -1, lane = U.rand(0, 1);
    return {
      key, facing: dir, dir, lane,
      fx: anyX ? U.rand(0.12, 0.88) : (dir > 0 ? -0.06 : 1.06),
      vx: dir * U.rand(0.045, 0.085),                    // fx units/sec (slow stroll)
      walk: U.rand(0, 3), bob: U.rand(0, U.TAU), canWalk: key === 'char.kappa',
    };
  }
  function updateAmbient(dt) {
    const W = Z.render.W, H = Z.render.H;
    for (let i = npcs.length - 1; i >= 0; i--) {
      const n = npcs[i]; n.fx += n.vx * dt; n.walk += dt;
      if ((n.dir > 0 && n.fx > 1.1) || (n.dir < 0 && n.fx < -0.1)) npcs.splice(i, 1);
    }
    while (npcs.length < 2) npcs.push(spawnNpc(false));
    if (night()) {
      while (flies.length < 14) flies.push(newFly(W, H));
      for (const f of flies) {
        f.ph += dt; f.x += (Math.sin(f.ph * 0.7) * 8 + f.drift) * dt; f.y += Math.cos(f.ph * 0.9) * 6 * dt;
        if (f.x < -20) f.x = W + 20; if (f.x > W + 20) f.x = -20;
      }
    } else if (flies.length) flies.length = 0;
    if (!night()) { birdT -= dt; if (birdT <= 0 && !birds.length) { spawnFlock(W, H); birdT = U.rand(12, 26); } }
    for (let i = birds.length - 1; i >= 0; i--) { const b = birds[i]; b.x += b.vx * dt; b.wing += dt * 10; if (b.x > W + 60 || b.x < -60) birds.splice(i, 1); }
  }
  function newFly(W, H) { return { x: U.rand(0, W), y: U.rand(H * 0.45, H * 0.86), ph: U.rand(0, U.TAU), drift: U.rand(-10, 10), r: U.rand(1.3, 2.4) }; }
  function spawnFlock(W, H) {
    const dir = U.chance(0.5) ? 1 : -1, n = U.randInt(3, 6), y0 = H * U.rand(0.12, 0.26), x0 = dir > 0 ? -40 : W + 40, sp = dir * U.rand(60, 110);
    for (let i = 0; i < n; i++) birds.push({ x: x0 - dir * i * 22, y: y0 + (i % 2 ? 1 : -1) * i * 3 + U.rand(-6, 6), vx: sp, wing: U.rand(0, U.TAU) });
  }

  function frame(dt, t) {
    const W = Z.render.W, H = Z.render.H, ctx = Z.render.ctx;
    const groundY = H * 0.9;
    const inScene = Z.cutscene && Z.cutscene.active;
    const prompt = document.getElementById('interactPrompt');
    if (prompt) prompt.classList.remove('show');          // no ugly chip; canvas hints only
    if (warp > 0) warp -= dt;

    // ---- update ----
    if (!inScene) {
      const dir = Z.controls ? Z.controls.dir : 0;
      if (dir && dir !== kid.facing) { kid.facing = dir; kid.turn = 1; }
      if (kid.turn > 0) kid.turn = Math.max(0, kid.turn - dt * 5);
      kid.vx += (dir * 0.42 - kid.vx) * Math.min(1, dt * ACCEL);
      kid.fx = U.clamp(kid.fx + kid.vx * dt, 0.02, 0.98);
      if (Math.abs(kid.vx) < 0.002) kid.vx = 0;
      kid.walk = Math.abs(kid.vx) > 0.01 ? kid.walk + dt : 0;

      // edge warp (debounced by the brief spawn grace)
      if (warp <= 0) {
        if (kid.fx <= 0.04 && dir < 0) return go(LEFT);
        if (kid.fx >= 0.96 && dir > 0) return go(RIGHT);
      }
    }
    updateAmbient(dt);                                    // town keeps living even during cutscenes

    // ---- draw: clean cherry-tree street (tiny parallax as you walk) ----
    const par = (kid.fx - 0.5) * 0.05;
    if (!Z.assets.cover(ctx, 'world.sakura', 0, 0, W, H, 0.5 + par) &&
        !Z.assets.cover(ctx, 'world.konbini', 0, 0, W, H, 0.5 + par) &&
        !Z.assets.cover(ctx, 'world.street', 0, 0, W, H, 0.5 + par)) {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#8fc7e8'); g.addColorStop(1, '#d7c7a6');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    drawBirds(ctx);                                      // distant flocks in the sky band (day only)
    // soft ground-contact only (keep the photo bright)
    const gg = ctx.createLinearGradient(0, groundY - H * 0.12, 0, H);
    gg.addColorStop(0, 'rgba(30,22,12,0)'); gg.addColorStop(1, 'rgba(30,22,12,.22)');
    ctx.fillStyle = gg; ctx.fillRect(0, groundY - H * 0.12, W, H - groundY + H * 0.12);

    // faint edge chevrons + a whisper of a name (no signboards)
    edgeHint(ctx, W, H, t, -1, LEFT.name, kid.fx <= 0.22);
    edgeHint(ctx, W, H, t, 1, RIGHT.name, kid.fx >= 0.78);

    // a loafing cat + a couple of strolling townsfolk, behind the player
    drawCat(ctx, W, H, groundY, t);
    drawNpcs(ctx, W, H, groundY, t);

    // ---- the tanuki, small + cute ----
    const kx = kid.fx * W;
    const moving = Math.abs(kid.vx) > 0.01;
    const w = U.clamp(H * 0.16, 90, 150);
    const hop = moving ? Math.abs(Math.sin(kid.walk * 10)) * (H * 0.014) : Math.sin(t * 2.2) * (H * 0.004);
    const squash = moving ? Math.cos(kid.walk * 20) * 0.03 : Math.sin(t * 2.2) * 0.02;
    Z.render.drawSprite('char.tanuki', kx, groundY, {
      w, bob: hop, squash, facing: kid.facing, turn: kid.turn,
      sway: moving ? Math.sin(kid.walk * 10) * 0.04 : 0,
      anim: moving ? 'walk' : 'idle', animT: moving ? kid.walk : t,
    });
    if (moving && Math.random() < 0.22) Z.fx.dust(kx - kid.facing * w * 0.16, groundY, 1, '#cbb489');

    // gentle day/night wash over the whole street + tanuki
    timeTint(ctx, W, H);

    // warm lantern glow at the HOME/RAMEN edges + night fireflies (over the wash)
    drawLanterns(ctx, W, H, t);
    drawFireflies(ctx, t);

    if (Z.clock && Z.clock.draw) Z.clock.draw(ctx, 40, 46);
    Z.render.drawPetals(t);
  }

  function drawBirds(ctx) {
    if (!birds.length) return; const H = Z.render.H;
    ctx.save(); ctx.strokeStyle = 'rgba(40,34,26,.5)'; ctx.lineWidth = Math.max(1, H / 620); ctx.lineCap = 'round';
    for (const b of birds) {
      const f = Math.sin(b.wing) * 3 + 4;
      ctx.beginPath(); ctx.moveTo(b.x - 6, b.y);
      ctx.quadraticCurveTo(b.x - 2, b.y - f, b.x, b.y);
      ctx.quadraticCurveTo(b.x + 2, b.y - f, b.x + 6, b.y); ctx.stroke();
    }
    ctx.restore();
  }
  function drawNpcs(ctx, W, H, groundY, t) {
    const list = npcs.slice().sort((a, b) => b.lane - a.lane);   // far lanes first
    for (const n of list) {
      const gy = groundY - n.lane * H * 0.05;                    // farther = higher up
      const w = qW(U.clamp(H * 0.13, 74, 120) * (1 - n.lane * 0.32));
      const kx = n.fx * W;
      const hop = n.canWalk ? Math.abs(Math.sin(n.walk * 9)) * (H * 0.010)
        : Math.abs(Math.sin(n.walk * 4 + n.bob)) * (H * 0.008);
      ctx.save(); ctx.globalAlpha = 1 - n.lane * 0.28;           // atmospheric recede
      Z.render.drawSprite(n.key, kx, gy, {
        w, bob: hop, squash: Math.cos(n.walk * 18) * 0.02, facing: n.facing,
        sway: Math.sin(n.walk * 8) * 0.03,
        anim: n.canWalk ? 'walk' : undefined, animT: n.walk,
      });
      ctx.restore();
    }
  }
  function drawCat(ctx, W, H, groundY, t) {
    const s = Math.max(1, H / 620), x = W * 0.14, y = groundY - 2, body = '#3a3230';
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(20,14,8,.28)'; ctx.beginPath(); ctx.ellipse(0, 2, 16 * s, 4 * s, 0, 0, U.TAU); ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(0, -7 * s, 15 * s, 8 * s, 0, 0, U.TAU); ctx.fill();     // loaf
    ctx.beginPath(); ctx.arc(-12 * s, -14 * s, 6.5 * s, 0, U.TAU); ctx.fill();           // head
    ctx.beginPath(); ctx.moveTo(-16 * s, -19 * s); ctx.lineTo(-14 * s, -24 * s); ctx.lineTo(-11 * s, -20 * s); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-11 * s, -20 * s); ctx.lineTo(-8 * s, -24 * s); ctx.lineTo(-7 * s, -19 * s); ctx.fill();
    ctx.strokeStyle = body; ctx.lineWidth = 4 * s; ctx.lineCap = 'round';                // tail flick
    ctx.beginPath(); ctx.moveTo(14 * s, -6 * s); ctx.quadraticCurveTo(24 * s, -10 * s, 22 * s + Math.sin(t * 1.6) * 6 * s, -18 * s); ctx.stroke();
    ctx.fillStyle = night() ? '#ffe08a' : '#c9d24a';
    ctx.beginPath(); ctx.arc(-14 * s, -14 * s, 1.2 * s, 0, U.TAU); ctx.arc(-10.5 * s, -14 * s, 1.2 * s, 0, U.TAU); ctx.fill();
    ctx.restore();
  }
  function drawLanterns(ctx, W, H, t) {
    const warm = night() ? 0.55 : 0.14; if (warm < 0.02) return;
    const spots = [{ x: W * 0.90, y: H * 0.34, r: H * 0.10, col: '#ffb85c' }, { x: W * 0.10, y: H * 0.36, r: H * 0.08, col: '#ffcf7a' }];
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const sp of spots) {
      const flick = 0.85 + 0.15 * Math.sin(t * 3 + sp.x);
      const g = ctx.createRadialGradient(sp.x, sp.y, 2, sp.x, sp.y, sp.r);
      g.addColorStop(0, U.rgba(sp.col, warm * flick)); g.addColorStop(1, U.rgba(sp.col, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sp.x, sp.y, sp.r, 0, U.TAU); ctx.fill();
    }
    ctx.restore();
  }
  function drawFireflies(ctx, t) {
    if (!flies.length) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const f of flies) {
      const pulse = 0.4 + 0.6 * Math.abs(Math.sin(f.ph * 2)), R = f.r * 4;
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, R);
      g.addColorStop(0, U.rgba('#eaff9a', 0.9 * pulse)); g.addColorStop(1, 'rgba(180,220,120,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, R, 0, U.TAU); ctx.fill();
    }
    ctx.restore();
  }

  function go(dest) {
    const prompt = document.getElementById('interactPrompt'); if (prompt) prompt.classList.remove('show');
    kid.vx = 0; if (Z.audio) Z.audio.sfx.click();
    Z.ui.show(dest.screen);
  }

  // faint glowing chevron hugging one screen edge; brighter + a whisper
  // of a name when the tanuki is heading that way. No wooden post.
  function edgeHint(ctx, W, H, t, side, name, active) {
    const s = Math.max(1, H / 720);
    const x = side < 0 ? 30 * s : W - 30 * s, y = H * 0.52;
    const a = active ? 0.85 : 0.26, pulse = active ? Math.sin(t * 5) * 5 * s : 0;
    ctx.save();
    ctx.globalAlpha = a; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < 2; i++) {
      const ox = (side < 0 ? -1 : 1) * (i * 11 * s + pulse);
      ctx.beginPath();
      ctx.moveTo(x + ox + side * 9 * s, y - 12 * s);
      ctx.lineTo(x + ox - side * 9 * s, y);
      ctx.lineTo(x + ox + side * 9 * s, y + 12 * s);
      ctx.strokeStyle = 'rgba(35,22,10,.4)'; ctx.lineWidth = 6 * s; ctx.stroke();
      ctx.strokeStyle = '#fff7ea'; ctx.lineWidth = 3.4 * s; ctx.stroke();
    }
    if (active) Z.render.pxText(ctx, name, x, y + 34 * s, 10 * s, '#fff1d6', 'center');
    ctx.restore();
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

  function init() { Z.ui.onEnter('world', enter); }
  return { init, frame, get kidX() { return kid.fx * (Z.render.W || 1000); } };
})();
