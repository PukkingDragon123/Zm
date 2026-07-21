/* ================================================================
   house.js — your HOME, the tanuki toy-shop. The uploaded exterior
   photo is drawn CLEAN (only a soft ground-contact shade + a day/night
   wash). A small round tanuki walks A/D across the front. Three cool,
   minimal interact spots float as glowing orbs with a little pulsing
   icon — no ugly label chips:
     FUTON  -> sleep (jump to night)
     SHELF  -> peek at your finished build (flavor)
     TABLE  -> open the crafting workbench
   Walk A/D, act with ENTER.
   ================================================================ */
Z.house = (function () {
  const U = Z.util, D = Z.data;
  const SPEED = 220;            // px/s top walk speed (small scene)
  const ACCEL = 12;
  const GREET_OUT = 'Home. The little tanuki toy shop. Step up to the door and ENTER.';
  const GREET_IN = 'Inside the toy shop, warm and quiet. Glue, sprue, soft lamplight.';

  const kid = { x: -90, vx: 0, facing: 1, walk: 0, turn: 0 };
  let greeted = false, bubble = null, nearSpot = null, inside = false;
  let fade = 0, fadeDir = 0, fadeApplied = false;

  // interior interact spots
  const spots = [
    { id: 'bed',   fx: 0.20, kind: 'bed',   color: '#8fb6ff', prompt: 'SLEEP', ph: 0.0, glyph: glyphMoon, glow: 0 },
    { id: 'shelf', fx: 0.50, kind: 'shelf', color: '#8fd6a0', prompt: 'LOOK',  ph: 2.1, glyph: glyphStar, glow: 0 },
    { id: 'bench', fx: 0.80, kind: 'bench', color: '#ffb457', prompt: 'BUILD', ph: 4.2, glyph: glyphBox,  glow: 0 },
  ];
  // exterior: a single glowing door — ENTER to step inside
  const doorSpot = { id: 'door', fx: 0.5, kind: 'door', color: '#ffd08a', prompt: 'ENTER', ph: 0, glyph: glyphDoor, glow: 0 };
  // interior: a door back out to the street
  const outSpot = { id: 'out', fx: 0.08, kind: 'out', color: '#cbe0ff', prompt: 'GO OUT', ph: 1, glyph: glyphDoor, glow: 0 };

  function activeSpots() { return inside ? spots.concat(outSpot) : [doorSpot]; }

  function enter() {
    kid.x = -90; kid.vx = 0; kid.facing = 1; kid.walk = 0; kid.turn = 0;
    greeted = false; bubble = null; nearSpot = null; inside = false;   // always arrive outside
    fade = 0; fadeDir = 0; fadeApplied = false;
    spots.forEach((s) => (s.glow = 0)); doorSpot.glow = 0; outSpot.glow = 0;
    Z.ui.updateWallet();
  }
  function goInside() { Z.audio.sfx.click(); inside = true; kid.x = -90; kid.vx = 0; kid.facing = 1; greeted = false; bubble = null; }
  function goOutside() { Z.audio.sfx.back(); inside = false; kid.x = -90; kid.vx = 0; kid.facing = 1; greeted = false; bubble = null; }

  // ---- spot actions ----
  function openBench() { Z.audio.sfx.click(); Z.ui.show('workbench'); }

  function rest() {
    if (fadeDir !== 0) return;
    Z.audio.sfx.click();
    fadeDir = 1; fade = 0.001; fadeApplied = false;     // fade to black, flip to night at the peak
  }

  function inspectShelf() {
    Z.audio.sfx.click();
    const name = (Z.state.botName || 'your mech');
    const ch = ((D.itemById && D.itemById(Z.state.build && Z.state.build.body)) || {}).name || 'a bare frame';
    Z.cutscene.play([
      { who: 'ZUMO', img: 'tanuki', side: 'right', text: name + ' stands on the shelf, panel lines still fresh. Built on the ' + ch + '. Nippers and spare runners wait beside it.' },
    ]);
  }

  function actOn(s) {
    if (s.kind === 'door') goInside();
    else if (s.kind === 'out') goOutside();
    else if (s.kind === 'bench') openBench();
    else if (s.kind === 'bed') rest();
    else if (s.kind === 'shelf') inspectShelf();
  }

  // ---- the scene ----
  function frame(dt, t) {
    const ctx = Z.render.ctx, W = Z.render.W, H = Z.render.H;
    const groundY = H * 0.9;
    const minX = W * 0.08, maxX = W * 0.92;
    const inScene = Z.cutscene && Z.cutscene.active;

    // fade / rest state
    if (fadeDir === 1) {
      fade += dt * 1.8;
      if (fade >= 1) {
        fade = 1;
        if (!fadeApplied) { fadeApplied = true; Z.state.setClock(21); Z.audio.sfx.boost(); Z.ui.toast('Night falls.', 'gold'); }
        fadeDir = -1;
      }
    } else if (fadeDir === -1) {
      fade -= dt * 1.2; if (fade <= 0) { fade = 0; fadeDir = 0; }
    }
    const busy = inScene || fadeDir !== 0;
    const sp = activeSpots();

    sp.forEach((s) => (s.x = W * s.fx));

    // ---- update ----
    if (kid.x < minX) {                                   // walk in from the left
      kid.vx = SPEED; kid.x += SPEED * dt; kid.walk += dt; kid.facing = 1;
      if (kid.x >= minX && !greeted) { greeted = true; bubble = { text: inside ? GREET_IN : GREET_OUT, t: 4.4 }; }
    } else if (!busy) {
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

    const prevNear = nearSpot; nearSpot = null; let bd = W * 0.09;
    sp.forEach((s) => { const d = Math.abs(kid.x - s.x); if (kid.x >= minX && !busy && d < bd) { bd = d; nearSpot = s; } });
    sp.forEach((s) => { s.glow = U.lerp(s.glow, s === nearSpot ? 1 : 0, Math.min(1, dt * 10)); });
    if (nearSpot && nearSpot !== prevNear && Z.audio.ctx) Z.audio.sfx.hover();

    const act = !busy && Z.controls && Z.controls.consumeInteract();
    if (act && kid.x >= minX && nearSpot) actOn(nearSpot);

    // ---- draw: toy-shop exterior (outside) or the walkable interior (inside)
    Z.render.clear();
    const bgKey = inside ? 'world.house' : 'world.town';
    if (!Z.assets.cover(ctx, bgKey, 0, 0, W, H, 0.5)) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      if (inside) { g.addColorStop(0, '#3a2e22'); g.addColorStop(0.6, '#5a4632'); g.addColorStop(1, '#2c2016'); }
      else { g.addColorStop(0, '#e7c9a0'); g.addColorStop(0.6, '#caa477'); g.addColorStop(1, '#8a6a45'); }
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // soft ground-contact shade only (keeps the backdrop bright)
    const gg = ctx.createLinearGradient(0, groundY - H * 0.12, 0, H);
    gg.addColorStop(0, 'rgba(38,22,10,0)'); gg.addColorStop(1, 'rgba(38,22,10,.30)');
    ctx.fillStyle = gg; ctx.fillRect(0, groundY - H * 0.12, W, H - groundY + H * 0.12);

    // the tanuki — small + cute
    const moving = Math.abs(kid.vx) > 6;
    const w = U.clamp(H * 0.16, 90, 150);
    const hop = moving ? Math.abs(Math.sin(kid.walk * 10)) * (H * 0.014) : Math.sin(t * 2.2) * (H * 0.004);
    const squash = moving ? Math.cos(kid.walk * 20) * 0.03 : Math.sin(t * 2.2) * 0.022;
    if (!Z.render.drawSprite('char.tanuki', kid.x, groundY, {
      w, bob: hop, squash, facing: kid.facing, turn: kid.turn,
      sway: moving ? Math.sin(kid.walk * 10) * 0.04 : 0,
      anim: moving ? 'walk' : 'idle', animT: moving ? kid.walk : t,
    })) { ctx.fillStyle = '#7a5a3a'; ctx.fillRect(kid.x - w * 0.2, groundY - w * 0.9, w * 0.4, w * 0.9); }
    if (moving && Math.random() < 0.2) Z.fx.dust(kid.x - kid.facing * w * 0.16, groundY, 1, '#c9a76b');

    // gentle day/night wash over the scene + tanuki
    timeTint(ctx, W, H);

    // cool minimal interact spots (glowing orbs + pulsing icon), on top
    const floatH = H * 0.15;
    sp.forEach((s) => { if (kid.x >= minX) spotMarker(ctx, s.x, groundY, floatH, s.glow, t, s); });

    Z.fx.render(ctx);
    if (bubble && !inScene && fade <= 0) speechBubble(ctx, kid.x, groundY - w * 1.02, bubble.text);
    if (Z.clock && Z.clock.draw) Z.clock.draw(ctx, 40, 46);
    if (!inside) Z.render.drawPetals(t);

    // rest fade — night settles over the shop
    if (fade > 0) { ctx.save(); ctx.fillStyle = 'rgba(10,8,18,' + Math.min(1, fade).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  }

  // ---- a clean glowing interact spot: ground glow + floating icon ----
  function spotMarker(ctx, x, gy, floatH, glow, t, s) {
    const pulse = 0.55 + 0.45 * Math.sin(t * 3.4 + s.ph);
    const iy = gy - floatH - Math.sin(t * 2.4 + s.ph) * 3 - glow * 6;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const r = 24 + glow * 30;
    const g = ctx.createRadialGradient(x, gy, 2, x, gy, r);
    g.addColorStop(0, U.rgba(s.color, 0.07 + glow * 0.26)); g.addColorStop(1, U.rgba(s.color, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, gy, r, r * 0.38, 0, 0, U.TAU); ctx.fill();
    const hr = 12 + glow * 9;
    const hg = ctx.createRadialGradient(x, iy, 1, x, iy, hr);
    hg.addColorStop(0, U.rgba(s.color, (0.18 + glow * 0.3) * pulse)); hg.addColorStop(1, U.rgba(s.color, 0));
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(x, iy, hr, 0, U.TAU); ctx.fill();
    ctx.restore();
    // no icon — just the soft glow + a word when you're close
    if (glow > 0.35) Z.render.pxText(ctx, s.prompt, x, iy - 6, 9, U.rgba('#fff1d6', glow), 'center');
  }

  // ---- tiny icon glyphs (drawn with the current strokeStyle) ----
  function glyphBox(ctx, x, y) {
    ctx.beginPath(); ctx.rect(x - 6, y - 6, 12, 12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 6, y - 1.5); ctx.lineTo(x + 6, y - 1.5); ctx.stroke();
  }
  function glyphMoon(ctx, x, y) {
    ctx.beginPath(); ctx.arc(x + 1, y, 6, Math.PI * 0.36, Math.PI * 1.5); ctx.stroke();
  }
  function glyphDoor(ctx, x, y) {
    // a little arched doorway with a knob
    ctx.beginPath();
    ctx.moveTo(x - 5, y + 7); ctx.lineTo(x - 5, y - 3);
    ctx.arc(x, y - 3, 5, Math.PI, 0); ctx.lineTo(x + 5, y + 7); ctx.closePath();
    ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 2.5, y + 2, 1, 0, U.TAU); ctx.stroke();
  }
  function glyphStar(ctx, x, y) {
    ctx.beginPath();
    ctx.moveTo(x, y - 7); ctx.lineTo(x, y + 7);
    ctx.moveTo(x - 7, y); ctx.lineTo(x + 7, y);
    ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 4, y + 4);
    ctx.moveTo(x - 4, y + 4); ctx.lineTo(x + 4, y - 4);
    ctx.stroke();
  }

  function speechBubble(ctx, x, y, text) {
    const lines = wrap(text, 26), w = 210, h = 18 + lines.length * 19;
    const bx = U.clamp(x, w / 2 + 10, Z.render.W - w / 2 - 10);
    const by = Math.max(h + 10, y);
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, bx - w / 2, by - h, w, h, 12), '#f5ecd7', { cut: 0.001 });
    ctx.fillStyle = '#2f2418'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = "700 14px 'Zen Maru Gothic', sans-serif";
    lines.forEach((ln, i) => ctx.fillText(ln, bx, by - h + 24 + i * 19));
  }
  function wrap(t, n) { const w = t.split(' '), out = []; let l = ''; for (const word of w) { if ((l + word).length > n) { out.push(l.trim()); l = ''; } l += word + ' '; } if (l.trim()) out.push(l.trim()); return out; }

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

  function init() { Z.ui.onEnter('house', enter); }
  return { init, frame };
})();
