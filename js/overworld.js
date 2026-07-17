/* ================================================================
   overworld.js — Spirit Town main street. Paper-cutout characters
   bouncing over the painted street backdrop. Walk with A/D, enter
   with W. Restored districts light up with lanterns.
   ================================================================ */
Z.overworld = (function () {
  const U = Z.util, D = Z.data, PAL = Z.data.PAL;
  const LEN = D.STREET_LEN;
  const SPEED = 250;
  let kid = { x: 560, vx: 0, facing: 1, walk: 0, turn: 0, land: 0, airY: 0 };
  let camX = 0, near = null, started = false;
  const NPC_SPRITES = ['char.tengu', 'char.kappa', 'char.oni'];

  function enter() { if (!started) { started = true; kid.x = 560; } }

  function frame(dt, t) {
    const W = Z.render.W, H = Z.render.H, ctx = Z.render.ctx;
    const groundY = H * 0.84;

    // ---- update ----
    const dir = Z.controls ? Z.controls.dir : 0;
    if (dir && dir !== kid.facing) { kid.facing = dir; kid.turn = 1; }        // paper flip on turn
    if (kid.turn > 0) kid.turn = Math.max(0, kid.turn - dt * 5);
    kid.vx = dir * SPEED;
    kid.x = U.clamp(kid.x + kid.vx * dt, 30, LEN - 30);
    kid.walk = Math.abs(kid.vx) > 1 ? kid.walk + dt : 0;
    camX = U.clamp(kid.x - W * 0.5, 0, Math.max(0, LEN - W));

    near = null; let best = 120;
    for (const b of D.BUILDINGS) { const d = Math.abs(kid.x - (b.x + b.w / 2)); if (d < best) { best = d; near = b; } }
    const prompt = document.getElementById('interactPrompt');
    if (prompt) { if (near) { prompt.textContent = 'ENTER — ' + near.sign; prompt.classList.add('show'); } else prompt.classList.remove('show'); }
    if (near && Z.controls && Z.controls.consumeInteract()) { Z.audio.sfx.click(); Z.ui.show(near.screen); return; }

    // ---- draw ----
    // painted street backdrop w/ gentle parallax
    if (!Z.assets.cover(ctx, 'world.street', 0, 0, W, H, 0.5 - (camX / Math.max(1, LEN - W) - 0.5) * 0.14)) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#f0b26a'); g.addColorStop(0.55, '#d98d55'); g.addColorStop(1, '#7d5638');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // warm dusk wash + ground shade band so cutouts read
    ctx.fillStyle = 'rgba(46,26,12,.18)'; ctx.fillRect(0, 0, W, H);
    const gg = ctx.createLinearGradient(0, groundY - 26, 0, H);
    gg.addColorStop(0, 'rgba(40,22,10,0)'); gg.addColorStop(1, 'rgba(40,22,10,.5)');
    ctx.fillStyle = gg; ctx.fillRect(0, groundY - 26, W, H - groundY + 26);

    // torii gate near the dohyo (paper cutout)
    drawTorii(ctx, 4060 - camX * 1, groundY, 1.15, t);

    // paper shop-stand props for each doorway
    for (const b of D.BUILDINGS) {
      const sx = b.x - camX;
      if (sx + b.w < -80 || sx > W + 80) continue;
      drawStand(ctx, b, sx, groundY, t, near === b);
    }

    // restored district decorations — lantern strings glow where you've driven KANE-CO out
    const restoredIds = Object.keys(Z.state.restored || {});
    restoredIds.forEach((id, i) => {
      const seg = (i + 0.5) * (LEN / Math.max(4, restoredIds.length + 1));
      drawLanternString(ctx, seg - camX, H * 0.22 + (i % 2) * 26, t + i);
    });

    // NPC yokai (bouncing paper sprites + speech)
    D.NPCS.forEach((n, i) => {
      const sx = n.x - camX; if (sx < -70 || sx > W + 70) return;
      const bob = Math.abs(Math.sin(t * 2.2 + i * 1.7)) * 6;
      Z.render.drawSprite(NPC_SPRITES[i % 3], sx, groundY, { w: 82, bob, squash: Math.sin(t * 4.4 + i) * 0.03, sway: Math.sin(t * 1.8 + i) * 0.04, facing: kid.x < n.x ? -1 : 1 });
      if (Math.abs(kid.x - n.x) < 130 && n.line) bubble(ctx, sx, groundY - 122, n.line);
    });

    // the tanuki — hop-walk with squash & stretch + paper turn-flip
    const kx = kid.x - camX;
    const moving = Math.abs(kid.vx) > 1;
    const hop = moving ? Math.abs(Math.sin(kid.walk * 9)) * 12 : Math.sin(t * 2.2) * 2.5;
    const squash = moving ? Math.cos(kid.walk * 18) * 0.06 : Math.sin(t * 2.2) * 0.025;
    if (!Z.render.drawSprite('char.tanuki', kx, groundY, { w: 112, bob: hop, squash, facing: kid.facing, turn: kid.turn, sway: moving ? Math.sin(kid.walk * 9) * 0.05 : 0 })) {
      ctx.fillStyle = '#7a5a3a'; ctx.fillRect(kx - 18, groundY - 60, 36, 60);
    }
    if (moving && Math.random() < 0.2) Z.fx.dust(kx - kid.facing * 16, groundY, 1, '#c9a76b');

    Z.render.drawPetals(t);
  }

  function drawTorii(ctx, x, groundY, s, t) {
    const P = (p, f, o) => Z.render.paperFill(ctx, p, f, o);
    const h = 190 * s, w = 150 * s;
    if (x + w < -100 || x > Z.render.W + 200) return;
    P(() => { ctx.beginPath(); ctx.rect(x - w / 2, groundY - h, 14 * s, h); }, '#c8452b');
    P(() => { ctx.beginPath(); ctx.rect(x + w / 2 - 14 * s, groundY - h, 14 * s, h); }, '#c8452b');
    P(() => { ctx.beginPath(); ctx.rect(x - w / 2 - 10 * s, groundY - h + 34 * s, w + 20 * s, 12 * s); }, '#c8452b');
    P(() => { ctx.beginPath(); ctx.moveTo(x - w / 2 - 22 * s, groundY - h + 6 * s); ctx.quadraticCurveTo(x, groundY - h - 14 * s, x + w / 2 + 22 * s, groundY - h + 6 * s); ctx.lineTo(x + w / 2 + 16 * s, groundY - h + 18 * s); ctx.quadraticCurveTo(x, groundY - h - 2 * s, x - w / 2 - 16 * s, groundY - h + 18 * s); ctx.closePath(); }, '#a83a22');
    // shimenawa tassels swinging
    for (let i = 0; i < 3; i++) {
      const tx = x - w * 0.3 + i * w * 0.3, sway = Math.sin(t * 1.6 + i) * 4;
      ctx.strokeStyle = '#f5ecd7'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(tx, groundY - h + 46); ctx.lineTo(tx + sway, groundY - h + 74); ctx.stroke();
    }
  }

  function drawStand(ctx, b, sx, groundY, t, hot) {
    const P = (p, f, o) => Z.render.paperFill(ctx, p, f, o);
    const w = Math.min(b.w, 290), h = 168, x = sx + (b.w - w) / 2, y = groundY - h;
    const wob = Math.sin(t * 1.4 + b.x) * 0.008;
    ctx.save(); ctx.translate(x + w / 2, groundY); ctx.rotate(wob); ctx.translate(-(x + w / 2), -groundY);
    // stall body + noren curtain roof
    P(() => Z.render.roundRect(ctx, x, y + 34, w, h - 34, 10), '#e8d9b5');
    P(() => { ctx.beginPath(); ctx.moveTo(x - 12, y + 40); ctx.lineTo(x + w / 2, y - 4); ctx.lineTo(x + w + 12, y + 40); ctx.closePath(); }, hot ? '#d94f30' : '#b8563c');
    // noren strips
    for (let i = 0; i < 4; i++) { const nx = x + 10 + i * (w - 20) / 3.2, swy = Math.sin(t * 2 + i) * 2.4; ctx.fillStyle = '#f5ecd7'; ctx.fillRect(nx, y + 40, 12, 22 + swy); ctx.strokeStyle = '#2f2418'; ctx.lineWidth = 1.6; ctx.strokeRect(nx, y + 40, 12, 22 + swy); }
    // doorway
    P(() => Z.render.roundRect(ctx, x + w / 2 - 26, groundY - 72, 52, 72, 7), '#4a3826', { noShadow: true, cut: 3 });
    // paper lantern bobbing by the door
    const lb = Math.sin(t * 2.2 + b.x) * 3;
    P(() => { ctx.beginPath(); ctx.ellipse(x + w - 18, groundY - 72 + lb, 11, 14, 0, 0, U.TAU); }, hot ? '#ffb35c' : '#e8a33d', { noShadow: true, cut: 3 });
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const lg = ctx.createRadialGradient(x + w - 18, groundY - 72 + lb, 2, x + w - 18, groundY - 72 + lb, 40);
    lg.addColorStop(0, 'rgba(255,190,110,.5)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lg; ctx.fillRect(x + w - 58, groundY - 112, 80, 80); ctx.restore();
    Z.render.pxText(ctx, b.sign, x + w / 2, y + 26, hot ? 15 : 12, hot ? '#ffe9bf' : '#f5ecd7', 'center');
    ctx.restore();
  }

  function drawLanternString(ctx, x, y, t) {
    if (x < -300 || x > Z.render.W + 300) return;
    ctx.strokeStyle = 'rgba(35,22,10,.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 190, y); ctx.quadraticCurveTo(x, y + 42, x + 190, y); ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const lt = -0.8 + i * 0.4, lx = x + lt * 190, ly = y + (1 - lt * lt) * 34 + Math.sin(t * 2 + i) * 3;
      const col = ['#ff8f5e', '#ffd98a', '#8fd0b8', '#ffd98a', '#ff8f5e'][i];
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(lx, ly, 1, lx, ly, 26); g.addColorStop(0, 'rgba(255,200,120,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(lx - 26, ly - 26, 52, 52); ctx.restore();
      ctx.fillStyle = col; ctx.strokeStyle = '#2f2418'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(lx, ly + 8, 8, 11, 0, 0, U.TAU); ctx.fill(); ctx.stroke();
    }
  }

  function bubble(ctx, x, y, text) {
    ctx.save();
    const lines = wrap(text, 30); const w = 210, h = 16 + lines.length * 17;
    const bx = U.clamp(x, w / 2 + 8, Z.render.W - w / 2 - 8);
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, bx - w / 2, y - h, w, h, 12), '#f5ecd7', { cut: 0.001 });
    ctx.fillStyle = '#f5ecd7'; ctx.beginPath(); ctx.moveTo(x - 6, y - 2); ctx.lineTo(x + 8, y - 2); ctx.lineTo(x + 2, y + 9); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#2f2418'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#2f2418'; ctx.textAlign = 'center'; ctx.font = "700 14px 'Zen Maru Gothic', sans-serif";
    lines.forEach((ln, i) => ctx.fillText(ln, bx, y - h + 20 + i * 17));
    ctx.restore();
  }
  function wrap(t, n) { const w = t.split(' '), out = []; let l = ''; for (const word of w) { if ((l + word).length > n) { out.push(l.trim()); l = ''; } l += word + ' '; } if (l.trim()) out.push(l.trim()); return out; }

  function init() { Z.ui.onEnter('world', enter); }
  return { init, frame, get kidX() { return kid.x; } };
})();
