/* ================================================================
   overworld.js — the CROSSROAD. A single clean street junction (no
   endless scroll): the round tanuki stands big at the crossing and
   you walk LEFT / RIGHT (or to the middle path) to enter one of the
   three places in town — HOME, AO'S RAMEN, the WORKSHOP CAVE.
   ================================================================ */
Z.overworld = (function () {
  const U = Z.util, D = Z.data;
  const ACCEL = 12;                       // smooth walk accel
  // three destinations laid across the crossing: left, middle-path, right
  const SPOTS = [
    { id: 'house', sign: 'HOME',            screen: 'house', fx: 0.16, dir: 'left' },
    { id: 'cave',  sign: 'EQUIPMENT CAVE',  screen: 'cave',  fx: 0.50, dir: 'up' },
    { id: 'ramen', sign: "AO'S RAMEN",      screen: 'ramen', fx: 0.84, dir: 'right' },
  ];
  let kid = { fx: 0.5, vx: 0, facing: 1, walk: 0, turn: 0 };
  let started = false, near = null;

  function enter() {
    if (!started) { started = true; kid.fx = 0.5; }
    near = null;
  }

  function frame(dt, t) {
    const W = Z.render.W, H = Z.render.H, ctx = Z.render.ctx;
    const groundY = H * 0.9;
    const inScene = Z.cutscene && Z.cutscene.active;
    const prompt = document.getElementById('interactPrompt');

    // ---- update (frozen while a dialogue scene is up) ----
    if (!inScene) {
      const dir = Z.controls ? Z.controls.dir : 0;
      if (dir && dir !== kid.facing) { kid.facing = dir; kid.turn = 1; }
      if (kid.turn > 0) kid.turn = Math.max(0, kid.turn - dt * 5);
      const targetV = dir * 0.42;                        // fraction of screen / sec
      kid.vx += (targetV - kid.vx) * Math.min(1, dt * ACCEL);
      kid.fx = U.clamp(kid.fx + kid.vx * dt, 0.08, 0.92);
      if (Math.abs(kid.vx) < 0.002) kid.vx = 0;
      kid.walk = Math.abs(kid.vx) > 0.01 ? kid.walk + dt : 0;

      // nearest doorway
      near = null; let best = 0.16;
      for (const sp of SPOTS) { const d = Math.abs(kid.fx - sp.fx); if (d < best) { best = d; near = sp; } }

      if (prompt) {
        if (near) { prompt.textContent = 'ENTER — ' + near.sign; prompt.classList.add('show'); }
        else prompt.classList.remove('show');
      }
      if (Z.controls && Z.controls.consumeInteract() && near) { Z.audio.sfx.click(); Z.ui.show(near.screen); return; }
    } else if (prompt) prompt.classList.remove('show');

    // ---- draw: clean crossroad street ----
    if (!Z.assets.cover(ctx, 'world.konbini', 0, 0, W, H, 0.5) && !Z.assets.cover(ctx, 'world.street', 0, 0, W, H, 0.5)) {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#8fc7e8'); g.addColorStop(1, '#d7c7a6');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // gentle ground contact shade so the big cutout reads
    const gg = ctx.createLinearGradient(0, groundY - 60, 0, H);
    gg.addColorStop(0, 'rgba(30,22,12,0)'); gg.addColorStop(1, 'rgba(30,22,12,.32)');
    ctx.fillStyle = gg; ctx.fillRect(0, groundY - 60, W, H - groundY + 60);

    // ---- three big crossroad signposts ----
    for (const sp of SPOTS) {
      const sx = sp.fx * W, hot = near === sp;
      drawSignpost(ctx, sp, sx, groundY, t, hot);
    }

    // ---- the tanuki, BIG (about 3x the old size) ----
    const kx = kid.fx * W;
    const moving = Math.abs(kid.vx) > 0.01;
    const w = U.clamp(H * 0.46, 200, 360);
    const hop = moving ? Math.abs(Math.sin(kid.walk * 10)) * (H * 0.02) : Math.sin(t * 2.2) * (H * 0.006);
    const squash = moving ? Math.cos(kid.walk * 20) * 0.03 : Math.sin(t * 2.2) * 0.02;
    if (!Z.render.drawSprite('char.tanuki', kx, groundY, {
      w, bob: hop, squash, facing: kid.facing, turn: kid.turn,
      sway: moving ? Math.sin(kid.walk * 10) * 0.04 : 0,
      anim: moving ? 'walk' : 'idle', animT: moving ? kid.walk : t,
    })) { ctx.fillStyle = '#7a5a3a'; ctx.fillRect(kx - 40, groundY - 120, 80, 120); }
    if (moving && Math.random() < 0.25) Z.fx.dust(kx - kid.facing * w * 0.16, groundY, 1, '#cbb489');

    Z.render.drawPetals(t);
  }

  // a chunky wooden crossroad sign with an arrow board + door glow
  function drawSignpost(ctx, sp, sx, groundY, t, hot) {
    const s = Math.max(1, Z.render.H / 640);
    // warm doorway glow on the ground below the sign
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const gw = (70 + hot * 40) * s;
    const gr = ctx.createRadialGradient(sx, groundY - 6, 4, sx, groundY - 6, gw);
    gr.addColorStop(0, 'rgba(255,190,110,' + (0.16 + hot * 0.24).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(sx, groundY - 4, gw, gw * 0.42, 0, 0, U.TAU); ctx.fill(); ctx.restore();

    const postH = 150 * s, topY = groundY - postH - hot * 8 * s;
    // post
    ctx.fillStyle = '#6b4c2e'; ctx.fillRect(sx - 5 * s, topY, 10 * s, postH);
    ctx.fillStyle = 'rgba(255,247,234,.12)'; ctx.fillRect(sx - 5 * s, topY, 3 * s, postH);
    // arrow board pointing the travel direction
    const bw = Math.max(120 * s, (sp.sign.length * 11 + 44) * s), bh = 40 * s, by = topY - 4 * s;
    const point = sp.dir === 'left' ? -1 : sp.dir === 'right' ? 1 : 0;
    ctx.save(); ctx.translate(sx, by);
    Z.render.paperFill(ctx, () => {
      ctx.beginPath();
      if (point === 0) { Z.render.roundRect(ctx, -bw / 2, 0, bw, bh, 7 * s); }
      else if (point < 0) { ctx.moveTo(-bw / 2, bh / 2); ctx.lineTo(-bw / 2 + 16 * s, 0); ctx.lineTo(bw / 2, 0); ctx.lineTo(bw / 2, bh); ctx.lineTo(-bw / 2 + 16 * s, bh); ctx.closePath(); }
      else { ctx.moveTo(bw / 2, bh / 2); ctx.lineTo(bw / 2 - 16 * s, 0); ctx.lineTo(-bw / 2, 0); ctx.lineTo(-bw / 2, bh); ctx.lineTo(bw / 2 - 16 * s, bh); ctx.closePath(); }
    }, hot ? '#c9803f' : '#a9805a', { cut: 4 });
    Z.render.pxText(ctx, sp.sign, point * 6 * s, bh * 0.68, 14 * s, hot ? '#fff1d6' : '#f5ecd7', 'center');
    ctx.restore();
    // bobbing enter arrow when near
    if (hot) {
      const ay = groundY - 46 * s + Math.sin(t * 5) * 5 * s;
      Z.render.paperFill(ctx, () => { ctx.beginPath(); ctx.moveTo(sx - 11 * s, ay); ctx.lineTo(sx + 11 * s, ay); ctx.lineTo(sx + 11 * s, ay + 9 * s); ctx.lineTo(sx, ay + 20 * s); ctx.lineTo(sx - 11 * s, ay + 9 * s); ctx.closePath(); }, '#d94f30', { noShadow: true, cut: 3 });
    }
  }

  function init() { Z.ui.onEnter('world', enter); }
  return { init, frame, get kidX() { return kid.fx * (Z.render.W || 1000); } };
})();
