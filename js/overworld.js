/* ================================================================
   overworld.js — the CROSSROAD. One clean cherry-tree street. The
   round tanuki stands small in the middle; WALK TO AN EDGE and you
   slip through to another place. No signboards:
     walk off the LEFT  edge  -> HOME
     walk off the RIGHT edge  -> AO'S RAMEN
     press ENTER in the middle -> EQUIPMENT CAVE
   Faint edge chevrons hint where each side goes; a soft glowing
   torii marks the middle door. Background is the star.
   ================================================================ */
Z.overworld = (function () {
  const U = Z.util;
  const ACCEL = 12;
  const LEFT = { screen: 'house', name: 'HOME' };
  const RIGHT = { screen: 'ramen', name: "AO'S RAMEN" };
  const MID = { screen: 'cave', name: 'WORKSHOP' };
  let kid = { fx: 0.5, vx: 0, facing: 1, walk: 0, turn: 0 };
  let started = false, warp = 0, midGlow = 0;

  function enter() { started = true; kid.fx = 0.5; kid.vx = 0; warp = 0.35; midGlow = 0; }   // spawn safely mid-street

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
      // middle: ENTER opens the equipment cave
      const mid = kid.fx > 0.36 && kid.fx < 0.64;
      if (mid && Z.controls && Z.controls.consumeInteract()) return go(MID);
    }

    // ---- draw: clean cherry-tree street ----
    if (!Z.assets.cover(ctx, 'world.sakura', 0, 0, W, H, 0.5) &&
        !Z.assets.cover(ctx, 'world.konbini', 0, 0, W, H, 0.5) &&
        !Z.assets.cover(ctx, 'world.street', 0, 0, W, H, 0.5)) {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#8fc7e8'); g.addColorStop(1, '#d7c7a6');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // soft ground-contact only (keep the photo bright)
    const gg = ctx.createLinearGradient(0, groundY - H * 0.12, 0, H);
    gg.addColorStop(0, 'rgba(30,22,12,0)'); gg.addColorStop(1, 'rgba(30,22,12,.22)');
    ctx.fillStyle = gg; ctx.fillRect(0, groundY - H * 0.12, W, H - groundY + H * 0.12);

    // faint edge chevrons + a whisper of a name (no signboards)
    edgeHint(ctx, W, H, t, -1, LEFT.name, kid.fx <= 0.22);
    edgeHint(ctx, W, H, t, 1, RIGHT.name, kid.fx >= 0.78);

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

    // the workshop door: a soft glowing spot + a little floating torii
    // that pulses; a tiny prompt shows only when you stand in the middle
    const mid = kid.fx > 0.36 && kid.fx < 0.64;
    midGlow = U.lerp(midGlow, mid ? 1 : 0, Math.min(1, dt * 8));
    if (midGlow > 0.01) drawGate(ctx, W * 0.5, groundY, groundY - H * 0.17 - midGlow * 6, midGlow, t);

    if (Z.clock && Z.clock.draw) Z.clock.draw(ctx, 40, 46);
    Z.render.drawPetals(t);
  }

  function go(dest) {
    const prompt = document.getElementById('interactPrompt'); if (prompt) prompt.classList.remove('show');
    kid.vx = 0; if (Z.audio) Z.audio.sfx.click();
    Z.ui.show(dest.screen);
  }

  // a soft glowing spot on the crossing + a small floating torii icon
  function drawGate(ctx, x, gy, iy, glow, t) {
    const pulse = 0.55 + 0.45 * Math.sin(t * 4);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const r = 40 + glow * 34;
    const g = ctx.createRadialGradient(x, gy, 3, x, gy, r);
    g.addColorStop(0, U.rgba('#ffc478', 0.10 + glow * 0.22)); g.addColorStop(1, U.rgba('#ffc478', 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, gy, r, r * 0.34, 0, 0, U.TAU); ctx.fill();
    const hr = 15 + glow * 8;
    const hg = ctx.createRadialGradient(x, iy, 1, x, iy, hr);
    hg.addColorStop(0, U.rgba('#ffe0a6', (0.20 + glow * 0.3) * pulse)); hg.addColorStop(1, U.rgba('#ffe0a6', 0));
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(x, iy, hr, 0, U.TAU); ctx.fill();
    ctx.restore();
    // little torii strokes
    ctx.save();
    ctx.strokeStyle = U.rgba('#fff1d6', 0.5 + glow * 0.5); ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    const hw = 9, top = iy - 9, postB = iy + 8;
    ctx.beginPath();
    ctx.moveTo(x - hw, top); ctx.lineTo(x - hw, postB);
    ctx.moveTo(x + hw, top); ctx.lineTo(x + hw, postB);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - hw - 4, top); ctx.lineTo(x + hw + 4, top);
    ctx.moveTo(x - hw - 1, top + 5); ctx.lineTo(x + hw + 1, top + 5);
    ctx.stroke();
    ctx.restore();
    if (glow > 0.55) Z.render.pxText(ctx, 'ENTER', x, iy - 16, 9, U.rgba('#fff1d6', glow), 'center');
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
