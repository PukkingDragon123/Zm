/* ================================================================
   house.js — your walkable HOME. The round tanuki stands BIG in the
   room (about 3x the old size) and walks A/D across the tatami. Three
   diegetic spots read as clean paper cutouts against the photo of the
   den: the CRAFTING TABLE (opens the workbench), the FUTON (rest), and
   the DISPLAY SHELF where your finished build stands. The uploaded
   backdrop is drawn clean — only a soft ground-contact shade so the
   cutouts sit in the scene. Walk A/D, act with ENTER.
   ================================================================ */
Z.house = (function () {
  const U = Z.util, D = Z.data;
  const SPEED = 300;            // px/s top walk speed
  const ACCEL = 12;            // smooth accel toward target velocity
  const GREET = 'Home. Smells of cut sprue, warm solder, and last night tea.';

  const kid = { x: -90, vx: 0, facing: 1, walk: 0, turn: 0 };
  let greeted = false, bubble = null, nearSpot = null, spec = null;

  const spots = [
    { id: 'bed',   fx: 0.18, label: 'FUTON',          kind: 'bed',   lift: 0 },
    { id: 'shelf', fx: 0.50, label: 'DISPLAY SHELF',  kind: 'shelf', lift: 0 },
    { id: 'bench', fx: 0.82, label: 'CRAFTING TABLE', kind: 'bench', lift: 0 },
  ];

  function refreshSpec() {
    try { spec = Z.Bot.compute(Z.state.build).spec; } catch (e) { spec = null; }
  }

  function enter() {
    kid.x = -90; kid.vx = 0; kid.facing = 1; kid.walk = 0; kid.turn = 0;
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
    const groundY = H * 0.88;
    const fs = U.clamp(H / 560, 1, 1.9);                  // furniture / prop scale
    const minX = W * 0.07, maxX = W * 0.93;
    const inScene = Z.cutscene && Z.cutscene.active;

    spots.forEach((s) => (s.x = W * s.fx));

    // ---- update ----
    if (kid.x < minX) {                                   // walk in through the door
      kid.vx = SPEED; kid.x += SPEED * dt; kid.walk += dt; kid.facing = 1;
      if (kid.x >= minX && !greeted) { greeted = true; bubble = { text: GREET, t: 4.8 }; }
    } else if (!inScene) {
      const dir = Z.controls ? Z.controls.dir : 0;
      if (dir && dir !== kid.facing) { kid.facing = dir; kid.turn = 1; }
      if (kid.turn > 0) kid.turn = Math.max(0, kid.turn - dt * 5);
      const targetV = dir * SPEED;
      kid.vx += (targetV - kid.vx) * Math.min(1, dt * ACCEL);
      if (Math.abs(kid.vx) < 3) kid.vx = 0;
      kid.x = U.clamp(kid.x + kid.vx * dt, minX, maxX);
      kid.walk = Math.abs(kid.vx) > 6 ? kid.walk + dt : 0;
    } else { kid.vx = 0; kid.walk = 0; }
    if (bubble) { bubble.t -= dt; if (bubble.t <= 0) bubble = null; }

    const prevNear = nearSpot; nearSpot = null; let bd = 120 * fs;
    spots.forEach((s) => { const d = Math.abs(kid.x - s.x); if (kid.x >= minX && d < bd) { bd = d; nearSpot = s; } });
    spots.forEach((s) => { s.lift = U.lerp(s.lift, s === nearSpot ? 1 : 0, Math.min(1, dt * 10)); });
    if (nearSpot && nearSpot !== prevNear && Z.audio.ctx) Z.audio.sfx.hover();

    const act = !inScene && Z.controls && Z.controls.consumeInteract();
    if (act && kid.x >= minX && nearSpot) actOn(nearSpot);

    // ---- draw: clean photo backdrop ----
    Z.render.clear();
    if (!Z.assets.cover(ctx, 'world.house', 0, 0, W, H, 0.5)) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#4a3421'); g.addColorStop(0.6, '#3a2818'); g.addColorStop(1, '#241810');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // soft ground-contact shade only (keeps the backdrop bright, grounds the cutouts)
    const gg = ctx.createLinearGradient(0, groundY - H * 0.14, 0, H);
    gg.addColorStop(0, 'rgba(38,22,10,0)'); gg.addColorStop(1, 'rgba(38,22,10,.42)');
    ctx.fillStyle = gg; ctx.fillRect(0, groundY - H * 0.14, W, H - groundY + H * 0.14);

    // the three diegetic spots (ground glow + the object) drawn behind the tanuki
    spots.forEach((s) => {
      drawMarker(ctx, s, groundY, fs);
      ctx.save(); ctx.translate(s.x, groundY); ctx.scale(fs, fs);
      if (s.kind === 'bed') drawBed(ctx, t);
      else if (s.kind === 'shelf') drawShelf(ctx, t);
      else if (s.kind === 'bench') drawBench(ctx, t);
      ctx.restore();
    });

    // the tanuki — BIG (about 3x the old size)
    const moving = Math.abs(kid.vx) > 6;
    const w = U.clamp(H * 0.4, 200, 340);
    const hop = moving ? Math.abs(Math.sin(kid.walk * 10)) * (H * 0.02) : Math.sin(t * 2.2) * (H * 0.006);
    const squash = moving ? Math.cos(kid.walk * 20) * 0.03 : Math.sin(t * 2.2) * 0.022;
    if (!Z.render.drawSprite('char.tanuki', kid.x, groundY, {
      w, bob: hop, squash, facing: kid.facing, turn: kid.turn,
      sway: moving ? Math.sin(kid.walk * 10) * 0.04 : 0,
      anim: moving ? 'walk' : 'idle', animT: moving ? kid.walk : t,
    })) { ctx.fillStyle = '#7a5a3a'; ctx.fillRect(kid.x - w * 0.2, groundY - w * 0.6, w * 0.4, w * 0.6); }
    if (moving && Math.random() < 0.22) Z.fx.dust(kid.x - kid.facing * w * 0.16, groundY, 1, '#c9a76b');

    Z.fx.render(ctx);
    if (bubble && !inScene) speechBubble(ctx, kid.x, groundY - Math.min(H * 0.62, w * 0.98), bubble.text);
    spots.forEach((s) => { if (s.lift > 0.05 && !inScene) drawLabel(ctx, s, groundY, fs, t); });
    Z.render.drawPetals(t);
  }

  // ---- diegetic furniture (drawn pre-scaled + pre-translated to the spot) ----
  function drawMarker(ctx, s, groundY, fs) {
    const hot = s.lift;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const gw = (58 + hot * 40) * fs;
    const gr = ctx.createRadialGradient(s.x, groundY - 6, 3, s.x, groundY - 6, gw);
    gr.addColorStop(0, 'rgba(255,196,116,' + (0.14 + hot * 0.24).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(s.x, groundY - 5, gw, gw * 0.4, 0, 0, U.TAU); ctx.fill();
    ctx.restore();
  }

  function drawBed(ctx, t) {
    const P = (p, f, o) => Z.render.paperFill(ctx, p, f, o);
    P(() => Z.render.roundRect(ctx, -60, -16, 120, 18, 6), '#b98d57', { cut: 3 });        // tatami base
    P(() => Z.render.roundRect(ctx, -56, -30, 112, 20, 8), '#c0664c', { cut: 3 });        // quilt
    ctx.strokeStyle = 'rgba(47,36,24,.25)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-30, -28); ctx.lineTo(-30, -12); ctx.moveTo(8, -28); ctx.lineTo(8, -12); ctx.stroke();
    P(() => Z.render.roundRect(ctx, -52, -42, 34, 16, 6), '#f3e7cc', { cut: 2.4 });        // pillow
  }

  function drawShelf(ctx, t) {
    const P = (p, f, o) => Z.render.paperFill(ctx, p, f, o);
    const shelfY = -66;
    // side posts + two planks
    P(() => Z.render.roundRect(ctx, -74, -132, 8, 132, 2), '#7a5836', { cut: 2.4, noShadow: true });
    P(() => Z.render.roundRect(ctx, 66, -132, 8, 132, 2), '#7a5836', { cut: 2.4, noShadow: true });
    P(() => Z.render.roundRect(ctx, -78, -128, 156, 10, 3), '#8a6a45', { cut: 3 });
    P(() => Z.render.roundRect(ctx, -78, shelfY, 156, 11, 3), '#8a6a45', { cut: 3 });
    // your current build, finished and standing on the lower shelf
    if (spec) Z.render.drawBotSide(0, shelfY, 1, spec, { t, moving: false, wheel: 0 }, { scale: 0.5 });
    // two small kit boxes on the upper shelf
    for (let i = 0; i < 2; i++) {
      const bx = -40 + i * 62, by = -128;
      P(() => Z.render.roundRect(ctx, bx - 15, by - 26, 30, 26, 3), i ? '#d9c39a' : '#e7d6ac', { cut: 2.4 });
      P(() => Z.render.roundRect(ctx, bx - 15, by - 26, 30, 7, 3), i ? '#c07b4a' : '#7f9e6a', { cut: 1.8, noShadow: true });
    }
  }

  function drawBench(ctx, t) {
    const P = (p, f, o) => Z.render.paperFill(ctx, p, f, o);
    // table top + legs
    ctx.fillStyle = '#6f4c2c'; ctx.fillRect(-56, -34, 8, 34); ctx.fillRect(48, -34, 8, 34);
    P(() => Z.render.roundRect(ctx, -64, -48, 128, 14, 3), '#9a6b40', { cut: 3 });
    ctx.strokeStyle = 'rgba(47,36,24,.28)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-58, -40); ctx.lineTo(58, -40); ctx.stroke();
    // a half-built frame torso clamped on the bench
    P(() => Z.render.roundRect(ctx, -12, -78, 26, 30, 4), '#c9cdd6', { cut: 2.6 });
    P(() => Z.render.roundRect(ctx, -9, -74, 20, 8, 2), '#8f9aa8', { cut: 1.6, noShadow: true });
    ctx.fillStyle = '#7f9e6a'; ctx.beginPath(); ctx.arc(1, -60, 3, 0, U.TAU); ctx.fill();  // reactor glow dot
    // nippers (open V) resting on the top
    ctx.strokeStyle = '#5a5f66'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(28, -50); ctx.lineTo(40, -62); ctx.moveTo(34, -50); ctx.lineTo(46, -60); ctx.stroke();
    ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(28, -50); ctx.lineTo(34, -50); ctx.stroke();
  }

  // floating paper label above a spot when the tanuki is near
  function drawLabel(ctx, s, groundY, fs, t) {
    const topOff = (s.kind === 'shelf' ? 150 : s.kind === 'bench' ? 96 : 58) * fs + 16;
    const yTop = groundY - topOff;
    ctx.save();
    ctx.globalAlpha = s.lift;
    const sz = 14 * Math.min(1.5, fs);
    const w = Math.max(120, s.label.length * (sz * 0.86) + 48) * 1, x = U.clamp(s.x, w / 2 + 8, Z.render.W - w / 2 - 8);
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, x - w / 2, yTop - 30, w, 30, 8), '#f5ecd7', { cut: 0.001 });
    Z.render.pxText(ctx, s.label, x, yTop - 10, sz, '#2f2418', 'center');
    ctx.globalAlpha = s.lift * (0.72 + 0.28 * Math.sin(t * 5));
    Z.render.pxText(ctx, 'ENTER', x, yTop + 6 + Math.sin(t * 4) * 3, sz - 2, '#d94f30', 'center');
    ctx.restore();
  }

  function speechBubble(ctx, x, y, text) {
    const lines = wrap(text, 26), w = 260, h = 22 + lines.length * 21;
    const bx = U.clamp(x, w / 2 + 10, Z.render.W - w / 2 - 10);
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, bx - w / 2, y - h, w, h, 14), '#f5ecd7', { cut: 0.001 });
    ctx.fillStyle = '#2f2418'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = "700 16px 'Zen Maru Gothic', sans-serif";
    lines.forEach((ln, i) => ctx.fillText(ln, bx, y - h + 26 + i * 21));
  }
  function wrap(t, n) { const w = t.split(' '), out = []; let l = ''; for (const word of w) { if ((l + word).length > n) { out.push(l.trim()); l = ''; } l += word + ' '; } if (l.trim()) out.push(l.trim()); return out; }

  function init() { Z.ui.onEnter('house', enter); }
  return { init, frame };
})();
