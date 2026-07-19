/* ================================================================
   overworld.js — the CROSSROAD. One clean street. The round tanuki
   stands big in the middle; WALK TO AN EDGE and you slip through to
   another place. No signboards:
     walk off the LEFT  edge  -> HOME
     walk off the RIGHT edge  -> AO'S RAMEN
     press ENTER in the middle -> EQUIPMENT CAVE
   Faint edge chevrons hint where each side goes.
   ================================================================ */
Z.overworld = (function () {
  const U = Z.util;
  const ACCEL = 12;
  const LEFT = { screen: 'house', name: 'HOME' };
  const RIGHT = { screen: 'ramen', name: "AO'S RAMEN" };
  const MID = { screen: 'cave', name: 'EQUIPMENT CAVE' };
  let kid = { fx: 0.5, vx: 0, facing: 1, walk: 0, turn: 0 };
  let started = false, warp = 0;

  function enter() { started = true; kid.fx = 0.5; kid.vx = 0; warp = 0.35; }   // spawn safely mid-street

  function frame(dt, t) {
    const W = Z.render.W, H = Z.render.H, ctx = Z.render.ctx;
    const groundY = H * 0.9;
    const inScene = Z.cutscene && Z.cutscene.active;
    const prompt = document.getElementById('interactPrompt');
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
      const mid = kid.fx > 0.34 && kid.fx < 0.66;
      if (prompt) {
        if (kid.fx <= 0.2) { prompt.textContent = 'walk left  ·  ' + LEFT.name; prompt.classList.add('show'); }
        else if (kid.fx >= 0.8) { prompt.textContent = RIGHT.name + '  ·  walk right'; prompt.classList.add('show'); }
        else if (mid) { prompt.textContent = 'ENTER — ' + MID.name; prompt.classList.add('show'); }
        else prompt.classList.remove('show');
      }
      if (mid && Z.controls && Z.controls.consumeInteract()) return go(MID);
    } else if (prompt) prompt.classList.remove('show');

    // ---- draw: clean crossroad street ----
    if (!Z.assets.cover(ctx, 'world.konbini', 0, 0, W, H, 0.5) && !Z.assets.cover(ctx, 'world.street', 0, 0, W, H, 0.5)) {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#8fc7e8'); g.addColorStop(1, '#d7c7a6');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    const gg = ctx.createLinearGradient(0, groundY - 70, 0, H);
    gg.addColorStop(0, 'rgba(30,22,12,0)'); gg.addColorStop(1, 'rgba(30,22,12,.3)');
    ctx.fillStyle = gg; ctx.fillRect(0, groundY - 70, W, H - groundY + 70);

    // faint edge chevrons + names (no signboards)
    edgeHint(ctx, W, H, t, -1, LEFT.name, kid.fx <= 0.22);
    edgeHint(ctx, W, H, t, 1, RIGHT.name, kid.fx >= 0.78);

    // ---- the tanuki, BIG ----
    const kx = kid.fx * W;
    const moving = Math.abs(kid.vx) > 0.01;
    const w = U.clamp(H * 0.44, 190, 340);
    const hop = moving ? Math.abs(Math.sin(kid.walk * 10)) * (H * 0.02) : Math.sin(t * 2.2) * (H * 0.006);
    const squash = moving ? Math.cos(kid.walk * 20) * 0.03 : Math.sin(t * 2.2) * 0.02;
    Z.render.drawSprite('char.tanuki', kx, groundY, {
      w, bob: hop, squash, facing: kid.facing, turn: kid.turn,
      sway: moving ? Math.sin(kid.walk * 10) * 0.04 : 0,
      anim: moving ? 'walk' : 'idle', animT: moving ? kid.walk : t,
    });
    if (moving && Math.random() < 0.25) Z.fx.dust(kx - kid.facing * w * 0.16, groundY, 1, '#cbb489');

    // a soft "step into the cave" glow in the middle of the crossing
    if (kid.fx > 0.34 && kid.fx < 0.66) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const mg = ctx.createRadialGradient(W * 0.5, groundY, 6, W * 0.5, groundY, W * 0.12);
      mg.addColorStop(0, 'rgba(255,190,110,' + (0.14 + 0.05 * Math.sin(t * 4)).toFixed(3) + ')'); mg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = mg; ctx.beginPath(); ctx.ellipse(W * 0.5, groundY, W * 0.12, H * 0.05, 0, 0, U.TAU); ctx.fill(); ctx.restore();
    }

    Z.render.drawPetals(t);
  }

  function go(dest) {
    const prompt = document.getElementById('interactPrompt'); if (prompt) prompt.classList.remove('show');
    kid.vx = 0; if (Z.audio) Z.audio.sfx.click();
    Z.ui.show(dest.screen);
  }

  // a glowing chevron + name hugging one screen edge; brighter when the
  // tanuki is heading that way. No wooden post.
  function edgeHint(ctx, W, H, t, side, name, active) {
    const s = Math.max(1, H / 640);
    const x = side < 0 ? 44 * s : W - 44 * s, y = H * 0.5;
    const a = active ? 0.9 : 0.4, pulse = active ? Math.sin(t * 5) * 6 * s : 0;
    ctx.save();
    ctx.globalAlpha = a; ctx.strokeStyle = '#fff7ea'; ctx.lineWidth = 6 * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < 2; i++) {
      const ox = (side < 0 ? -1 : 1) * (i * 14 * s + pulse);
      ctx.beginPath();
      ctx.moveTo(x + ox + side * 12 * s, y - 16 * s);
      ctx.lineTo(x + ox - side * 12 * s, y);
      ctx.lineTo(x + ox + side * 12 * s, y + 16 * s);
      ctx.strokeStyle = 'rgba(35,22,10,.5)'; ctx.lineWidth = 9 * s; ctx.stroke();
      ctx.strokeStyle = '#fff7ea'; ctx.lineWidth = 5 * s; ctx.stroke();
    }
    Z.render.pxText(ctx, name, x, y + 44 * s, 13 * s, active ? '#fff1d6' : '#f5ecd7', 'center');
    ctx.restore();
  }

  function init() { Z.ui.onEnter('world', enter); }
  return { init, frame, get kidX() { return kid.fx * (Z.render.W || 1000); } };
})();
