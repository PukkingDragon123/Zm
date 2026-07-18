/* ================================================================
   house.js — your walkable HOME inside the workshop den. The tanuki
   walks in from the door (A/D) and can stop at three diegetic spots:
   the CRAFTING TABLE (opens the workbench), the FUTON (rest), and the
   DISPLAY SHELF where your current build stands finished. Soft lamp
   glow, tatami warmth, spirit-town cozy. Walk A/D, act with ENTER.
   ================================================================ */
Z.house = (function () {
  const U = Z.util, D = Z.data;
  const SPEED = 230;
  const GREET = 'Home. Smells of cut sprue, warm solder, and last night tea.';

  const kid = { x: -70, vx: 0, facing: 1, walk: 0, turn: 0 };
  let greeted = false, bubble = null, nearSpot = null, spec = null;

  const spots = [
    { id: 'bed',   fx: 0.20, label: 'FUTON',         kind: 'bed',   lift: 0 },
    { id: 'shelf', fx: 0.49, label: 'DISPLAY SHELF', kind: 'shelf', lift: 0 },
    { id: 'bench', fx: 0.80, label: 'CRAFTING TABLE', kind: 'bench', lift: 0 },
  ];

  function refreshSpec() {
    try { spec = Z.Bot.compute(Z.state.build).spec; } catch (e) { spec = null; }
  }

  function enter() {
    kid.x = -70; kid.vx = 0; kid.facing = 1; kid.walk = 0; kid.turn = 0;
    greeted = false; bubble = null; nearSpot = null;
    spots.forEach((s) => (s.lift = 0));
    refreshSpec();
    Z.ui.updateWallet();
  }

  // ---- spot actions ----
  function openBench() { Z.audio.sfx.click(); Z.ui.show('workbench'); }

  function rest() {
    Z.audio.sfx.click();
    Z.cutscene.play([
      { who: 'ZUMO', img: 'tanuki', side: 'right', text: 'You flop onto the futon. Servos tick as they cool and the reactor core settles to a low idle hum.' },
    ], () => {
      Z.audio.sfx.boost(); Z.fx.screenFlash(0.16, '#ffd98a');
      Z.ui.toast('Rested. The den feels warm and quiet.', 'gold');
    });
  }

  function inspectShelf() {
    Z.audio.sfx.click();
    const name = (Z.state.botName || 'your mech');
    const ch = (D.chassisById(Z.state.build && Z.state.build.chassis) || {}).name || 'a bare frame';
    Z.cutscene.play([
      { who: 'ZUMO', img: 'tanuki', side: 'right', text: name + ' stands on the shelf, panel lines still fresh. Built on the ' + ch + '. Nippers and spare runners wait beside it.' },
    ]);
  }

  function actOn(s) {
    if (s.kind === 'bench') openBench();
    else if (s.kind === 'bed') rest();
    else if (s.kind === 'shelf') inspectShelf();
  }

  // ---- the scene ----
  function frame(dt, t) {
    const ctx = Z.render.ctx, W = Z.render.W, H = Z.render.H;
    const groundY = H * 0.86;
    const minX = 46, maxX = W * 0.92;
    const inScene = Z.cutscene && Z.cutscene.active;

    spots.forEach((s) => (s.x = W * s.fx));

    // ---- update ----
    if (kid.x < minX) {                                   // walk in through the door
      kid.vx = SPEED; kid.x += SPEED * dt; kid.walk += dt;
      if (kid.x >= minX && !greeted) { greeted = true; bubble = { text: GREET, t: 4.8 }; }
    } else if (!inScene) {
      const dir = Z.controls ? Z.controls.dir : 0;
      if (dir && dir !== kid.facing) { kid.facing = dir; kid.turn = 1; }
      if (kid.turn > 0) kid.turn = Math.max(0, kid.turn - dt * 5);
      kid.vx = dir * SPEED;
      kid.x = U.clamp(kid.x + kid.vx * dt, minX, maxX);
      kid.walk = dir ? kid.walk + dt : 0;
    } else { kid.vx = 0; kid.walk = 0; }
    if (bubble) { bubble.t -= dt; if (bubble.t <= 0) bubble = null; }

    const prevNear = nearSpot; nearSpot = null; let bd = 80;
    spots.forEach((s) => { const d = Math.abs(kid.x - s.x); if (kid.x >= minX && d < bd) { bd = d; nearSpot = s; } });
    spots.forEach((s) => { s.lift = U.lerp(s.lift, s === nearSpot ? 1 : 0, Math.min(1, dt * 10)); });
    if (nearSpot && nearSpot !== prevNear && Z.audio.ctx) Z.audio.sfx.hover();

    const act = !inScene && Z.controls && Z.controls.consumeInteract();
    if (act && kid.x >= minX && nearSpot) actOn(nearSpot);

    // ---- draw ----
    Z.render.clear();
    if (!Z.assets.cover(ctx, 'world.house', 0, 0, W, H, 0.5)) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#4a3421'); g.addColorStop(0.6, '#3a2818'); g.addColorStop(1, '#241810');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    ctx.fillStyle = 'rgba(30,18,8,.18)'; ctx.fillRect(0, 0, W, H);
    // warm lamp glow — a hanging paper lamp over the room
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    [[W * 0.5, H * 0.18, 0.16], [W * 0.8, H * 0.3, 0.11]].forEach(([gx, gy, ga]) => {
      const lg = ctx.createRadialGradient(gx, gy, 8, gx, gy, W * 0.34);
      lg.addColorStop(0, 'rgba(255,204,120,' + ga + ')'); lg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
    });
    ctx.restore();
    drawLamp(ctx, W * 0.5, H * 0.02, H * 0.16, t);
    // ground shade band so cutouts read
    const gg = ctx.createLinearGradient(0, groundY - 26, 0, H);
    gg.addColorStop(0, 'rgba(40,22,10,0)'); gg.addColorStop(1, 'rgba(40,22,10,.5)');
    ctx.fillStyle = gg; ctx.fillRect(0, groundY - 26, W, H - groundY + 26);

    // the three diegetic spots (glow marker + the object) drawn behind the tanuki
    spots.forEach((s) => {
      drawMarker(ctx, s, groundY, t);
      if (s.kind === 'bed') drawBed(ctx, s, groundY, t);
      else if (s.kind === 'shelf') drawShelf(ctx, s, groundY, t);
      else if (s.kind === 'bench') drawBench(ctx, s, groundY, t);
    });

    // the tanuki
    const moving = Math.abs(kid.vx) > 1;
    const hasSheet = Z.assets.ready('sheet.tanuki');
    const hop = moving ? Math.abs(Math.sin(kid.walk * 9)) * (hasSheet ? 5 : 12) : Math.sin(t * 2.2) * 2.5;
    const squash = moving ? Math.cos(kid.walk * 18) * (hasSheet ? 0.03 : 0.06) : Math.sin(t * 2.2) * 0.025;
    if (!Z.render.drawSprite('char.tanuki', kid.x, groundY, { w: 112, bob: hop, squash, facing: kid.facing, turn: kid.turn, sway: moving ? Math.sin(kid.walk * 9) * 0.05 : 0, anim: moving ? 'walk' : 'idle', animT: moving ? kid.walk : t })) {
      ctx.fillStyle = '#7a5a3a'; ctx.fillRect(kid.x - 18, groundY - 60, 36, 60);
    }
    if (moving && Math.random() < 0.2) Z.fx.dust(kid.x - kid.facing * 16, groundY, 1, '#c9a76b');

    Z.fx.render(ctx);
    if (bubble && !inScene) speechBubble(ctx, kid.x, groundY - 150, bubble.text);
    spots.forEach((s) => { if (s.lift > 0.05 && !inScene) drawLabel(ctx, s, t); });
    Z.render.drawPetals(t);
  }

  // ---- diegetic furniture ----
  function drawMarker(ctx, s, groundY, t) {
    const hot = s.lift;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const gw = 46 + hot * 30;
    const gr = ctx.createRadialGradient(s.x, groundY - 6, 3, s.x, groundY - 6, gw);
    gr.addColorStop(0, 'rgba(255,190,110,' + (0.12 + hot * 0.22).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(s.x, groundY - 4, gw, gw * 0.42, 0, 0, U.TAU); ctx.fill();
    ctx.restore();
  }

  function drawBed(ctx, s, groundY, t) {
    const x = s.x, P = (p, f, o) => Z.render.paperFill(ctx, p, f, o);
    P(() => Z.render.roundRect(ctx, x - 60, groundY - 16, 120, 18, 6), '#b98d57', { cut: 3 });        // tatami base
    P(() => Z.render.roundRect(ctx, x - 56, groundY - 30, 112, 20, 8), '#c0664c', { cut: 3 });        // quilt
    ctx.strokeStyle = 'rgba(47,36,24,.25)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x - 30, groundY - 28); ctx.lineTo(x - 30, groundY - 12); ctx.moveTo(x + 8, groundY - 28); ctx.lineTo(x + 8, groundY - 12); ctx.stroke();
    P(() => Z.render.roundRect(ctx, x - 52, groundY - 42, 34, 16, 6), '#f3e7cc', { cut: 2.4 });        // pillow
  }

  function drawShelf(ctx, s, groundY, t) {
    const x = s.x, P = (p, f, o) => Z.render.paperFill(ctx, p, f, o);
    const shelfY = groundY - 66;
    // side posts + two planks
    P(() => Z.render.roundRect(ctx, x - 74, groundY - 132, 8, 132, 2), '#7a5836', { cut: 2.4, noShadow: true });
    P(() => Z.render.roundRect(ctx, x + 66, groundY - 132, 8, 132, 2), '#7a5836', { cut: 2.4, noShadow: true });
    P(() => Z.render.roundRect(ctx, x - 78, groundY - 128, 156, 10, 3), '#8a6a45', { cut: 3 });
    P(() => Z.render.roundRect(ctx, x - 78, shelfY, 156, 11, 3), '#8a6a45', { cut: 3 });
    // your current build, finished and standing on the lower shelf
    if (spec) Z.render.drawBotSide(x, shelfY, 1, spec, { t, moving: false, wheel: 0 }, { scale: 0.5 });
    // two small kit boxes on the upper shelf
    for (let i = 0; i < 2; i++) {
      const bx = x - 40 + i * 62, by = groundY - 128;
      P(() => Z.render.roundRect(ctx, bx - 15, by - 26, 30, 26, 3), i ? '#d9c39a' : '#e7d6ac', { cut: 2.4 });
      P(() => Z.render.roundRect(ctx, bx - 15, by - 26, 30, 7, 3), i ? '#c07b4a' : '#7f9e6a', { cut: 1.8, noShadow: true });
    }
  }

  function drawBench(ctx, s, groundY, t) {
    const x = s.x, P = (p, f, o) => Z.render.paperFill(ctx, p, f, o);
    // table top + legs
    ctx.fillStyle = '#6f4c2c'; ctx.fillRect(x - 56, groundY - 34, 8, 34); ctx.fillRect(x + 48, groundY - 34, 8, 34);
    P(() => Z.render.roundRect(ctx, x - 64, groundY - 48, 128, 14, 3), '#9a6b40', { cut: 3 });
    ctx.strokeStyle = 'rgba(47,36,24,.28)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x - 58, groundY - 40); ctx.lineTo(x + 58, groundY - 40); ctx.stroke();
    // a half-built frame torso clamped on the bench
    P(() => Z.render.roundRect(ctx, x - 12, groundY - 78, 26, 30, 4), '#c9cdd6', { cut: 2.6 });
    P(() => Z.render.roundRect(ctx, x - 9, groundY - 74, 20, 8, 2), '#8f9aa8', { cut: 1.6, noShadow: true });
    ctx.fillStyle = '#7f9e6a'; ctx.beginPath(); ctx.arc(x + 1, groundY - 60, 3, 0, U.TAU); ctx.fill();  // reactor glow dot
    // sprue runner leaning on the table (a stick with a few kit bits)
    ctx.strokeStyle = '#8a6a45'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 46, groundY - 48); ctx.lineTo(x - 40, groundY - 84); ctx.stroke();
    ctx.fillStyle = '#b0844f';
    for (let i = 0; i < 3; i++) { const ry = groundY - 56 - i * 10; ctx.beginPath(); ctx.arc(x - 43 + (i % 2 ? 5 : -5), ry, 3, 0, U.TAU); ctx.fill(); }
    // nippers (open V) resting on the top
    ctx.strokeStyle = '#5a5f66'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + 28, groundY - 50); ctx.lineTo(x + 40, groundY - 62); ctx.moveTo(x + 34, groundY - 50); ctx.lineTo(x + 46, groundY - 60); ctx.stroke();
    ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(x + 28, groundY - 50); ctx.lineTo(x + 34, groundY - 50); ctx.stroke();
  }

  // a hanging round paper lamp in the ceiling
  function drawLamp(ctx, x, y, r, t) {
    const sway = Math.sin(t * 1.2) * 0.03;
    ctx.save(); ctx.translate(x, y); ctx.rotate(sway);
    ctx.strokeStyle = 'rgba(47,36,24,.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, r * 0.5); ctx.stroke();
    Z.render.paperFill(ctx, () => { ctx.beginPath(); ctx.ellipse(0, r * 0.5 + r * 0.5, r * 0.5, r * 0.42, 0, 0, U.TAU); }, '#f0c268', { cut: 4 });
    ctx.strokeStyle = 'rgba(47,36,24,.3)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-r * 0.42, r * 0.5 + r * 0.5); ctx.lineTo(r * 0.42, r * 0.5 + r * 0.5); ctx.stroke();
    ctx.restore();
  }

  // floating paper label above a spot when the tanuki is near
  function drawLabel(ctx, s, t) {
    const groundY = Z.render.H * 0.86;
    const yTop = groundY - (s.kind === 'shelf' ? 150 : s.kind === 'bench' ? 96 : 58);
    ctx.save();
    ctx.globalAlpha = s.lift;
    const w = Math.max(96, s.label.length * 9 + 44), x = U.clamp(s.x, w / 2 + 8, Z.render.W - w / 2 - 8);
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, x - w / 2, yTop - 26, w, 24, 7), '#f5ecd7', { cut: 0.001 });
    Z.render.pxText(ctx, s.label, x, yTop - 15, 11, '#2f2418', 'center');
    ctx.globalAlpha = s.lift * (0.72 + 0.28 * Math.sin(t * 5));
    Z.render.pxText(ctx, 'ENTER', x, yTop + Math.sin(t * 4) * 3, 10, '#d94f30', 'center');
    ctx.restore();
  }

  function speechBubble(ctx, x, y, text) {
    const lines = wrap(text, 26), w = 236, h = 18 + lines.length * 19;
    const bx = U.clamp(x, w / 2 + 10, Z.render.W - w / 2 - 10);
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, bx - w / 2, y - h, w, h, 13), '#f5ecd7', { cut: 0.001 });
    ctx.fillStyle = '#2f2418'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = "700 15px 'Zen Maru Gothic', sans-serif";
    lines.forEach((ln, i) => ctx.fillText(ln, bx, y - h + 24 + i * 19));
  }
  function wrap(t, n) { const w = t.split(' '), out = []; let l = ''; for (const word of w) { if ((l + word).length > n) { out.push(l.trim()); l = ''; } l += word + ' '; } if (l.trim()) out.push(l.trim()); return out; }

  function init() { Z.ui.onEnter('house', enter); }
  return { init, frame };
})();
