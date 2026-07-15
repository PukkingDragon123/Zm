/* ================================================================
   overworld.js — the strip. Side-scrolling street you walk with a
   kid character; stop at a building and enter it.
   ================================================================ */
Z.overworld = (function () {
  const U = Z.util, D = Z.data, PAL = Z.data.PAL;
  const LEN = D.STREET_LEN;
  const SPEED = 240;
  let kid = { x: 560, vx: 0, facing: 1, walk: 0 };
  let camX = 0, near = null;
  let farCity = null, midCity = null;
  let started = false;

  function build() {
    const mk = (n, minH, maxH, col) => { const a = []; let x = -60; while (x < LEN + 120) { const w = U.rand(50, 130); a.push({ x, w, h: U.rand(minH, maxH), col, lit: Math.random() < 0.3 }); x += w + U.rand(6, 30); } return a; };
    farCity = mk(120, 60, 220, '#171009');
    midCity = mk(140, 90, 300, '#1d140c');
  }

  function enter() {
    if (!started) { started = true; kid.x = 560; }
    Z.controls && (Z.controls.held.left = Z.controls.held.right = false);
  }

  function frame(dt, t) {
    if (!farCity) build();
    const W = Z.render.W, H = Z.render.H, ctx = Z.render.ctx;
    const groundY = H * 0.82;

    // ---- update ----
    const dir = Z.controls ? Z.controls.dir : 0;
    kid.vx = dir * SPEED;
    if (dir) kid.facing = dir;
    kid.x = U.clamp(kid.x + kid.vx * dt, 30, LEN - 30);
    kid.walk = Math.abs(kid.vx) > 1 ? kid.walk + dt : 0;
    camX = U.clamp(kid.x - W * 0.5, 0, Math.max(0, LEN - W));

    // nearest building
    near = null; let best = 110;
    for (const b of D.BUILDINGS) { const d = Math.abs(kid.x - (b.x + b.w / 2)); if (d < best) { best = d; near = b; } }
    const prompt = document.getElementById('interactPrompt');
    if (prompt) { if (near) { prompt.textContent = 'ENTER — ' + near.sign; prompt.classList.add('show'); } else prompt.classList.remove('show'); }
    if (near && Z.controls && Z.controls.consumeInteract()) { Z.audio.sfx.click(); Z.ui.show(near.screen); return; }

    // ---- draw ----
    // sky
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2a1e14'); g.addColorStop(0.45, '#1d1610'); g.addColorStop(1, PAL.bg);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const sun = ctx.createRadialGradient(W * 0.5, H * 0.42, 10, W * 0.5, H * 0.42, W * 0.6);
    sun.addColorStop(0, U.rgba(PAL.amber, 0.13)); sun.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H); ctx.restore();

    drawCity(ctx, farCity, camX * 0.35, groundY, 0.6, W);
    drawCity(ctx, midCity, camX * 0.6, groundY, 0.85, W);

    // street ground
    if (!Z.assets.draw(ctx, 'world.ground', 0, groundY, W, H - groundY, false)) {
      ctx.fillStyle = '#2a241b'; ctx.fillRect(0, groundY, W, H - groundY);
      ctx.fillStyle = '#221d16'; ctx.fillRect(0, groundY, W, 6);
      ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 2;
      for (let x = -(camX % 120); x < W; x += 120) { ctx.beginPath(); ctx.moveTo(x, groundY + 18); ctx.lineTo(x + 40, H); ctx.stroke(); }
    }
    // wet puddles reflecting the dusk
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 8; i++) { const wx = ((i * 733) % LEN) - camX; if (wx < -80 || wx > W + 80) continue; const g = ctx.createRadialGradient(wx, groundY + 28, 2, wx, groundY + 28, 64); g.addColorStop(0, U.rgba(PAL.amber, 0.07)); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(wx, groundY + 28, 62, 8, 0, 0, U.TAU); ctx.fill(); }
    ctx.restore();

    // buildings
    for (const b of D.BUILDINGS) {
      const sx = b.x - camX, bh = H * 0.44, by = groundY - bh;
      if (sx + b.w < -40 || sx > W + 40) continue;
      if (!Z.assets.draw(ctx, b.asset, sx, by, b.w, bh, false)) drawFacade(ctx, b, sx, by, bh);
      Z.render.pxText(ctx, b.sign, sx + b.w / 2, by - 12, 11, near === b ? PAL.amber : PAL.dim, 'center');
    }

    // street lamps + warm light pools
    for (let lx = 180; lx < LEN; lx += 360) {
      const sx = lx - camX; if (sx < -40 || sx > W + 40) continue;
      const fl = 0.72 + 0.28 * Math.sin(t * 6 + lx);
      ctx.fillStyle = '#17110a'; ctx.fillRect(sx - 3, groundY - 150, 6, 150); ctx.fillRect(sx - 3, groundY - 150, 34, 6);
      const bx = sx + 30, by = groundY - 150;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createRadialGradient(bx, by, 2, bx, by, 90); gr.addColorStop(0, U.rgba(PAL.amber, 0.5 * fl)); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(bx - 90, by - 90, 180, 180);
      const gp = ctx.createRadialGradient(bx, groundY + 12, 4, bx, groundY + 12, 120); gp.addColorStop(0, U.rgba(PAL.amber, 0.13 * fl)); gp.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gp; ctx.beginPath(); ctx.ellipse(bx, groundY + 12, 120, 20, 0, 0, U.TAU); ctx.fill();
      ctx.restore();
      ctx.fillStyle = U.rgba('#ffd98a', fl); ctx.fillRect(bx - 3, by - 3, 6, 6);
    }

    // npcs
    for (const n of D.NPCS) {
      const sx = n.x - camX; if (sx < -40 || sx > W + 40) continue;
      drawPerson(ctx, sx, groundY, 0.9, personColor(n.id), t * 0.5 + n.x, 1);
      if (Math.abs(kid.x - n.x) < 120) { bubble(ctx, sx, groundY - 96, n.line); }
    }

    // kid
    const kx = kid.x - camX;
    if (!Z.assets.draw(ctx, 'char.kid', kx - 22, groundY - 72, 44, 72, false)) drawKid(ctx, kx, groundY, kid.facing, kid.walk);

    // foreground: sagging power lines for depth
    ctx.strokeStyle = 'rgba(8,6,4,.8)'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { const y0 = 34 + i * 24, sag = 28 + i * 12, ph = Math.sin(t * 0.3 + i) * 6; ctx.beginPath(); ctx.moveTo(0, y0); ctx.quadraticCurveTo(W / 2, y0 + sag + ph, W, y0 - 8); ctx.stroke(); }

    Z.render.drawDust(t);
  }

  function drawCity(ctx, arr, off, groundY, dark, W) {
    for (const b of arr) {
      const sx = b.x - off; if (sx + b.w < -60 || sx > W + 60) continue;
      ctx.fillStyle = b.col; ctx.fillRect(sx, groundY - b.h, b.w, b.h);
      if (b.lit) { ctx.fillStyle = U.rgba(PAL.amber, 0.4 * dark); for (let i = 0; i < 3; i++) ctx.fillRect(sx + 8 + i * 16, groundY - b.h + 12, 5, 7); }
    }
  }

  function drawFacade(ctx, b, sx, by, bh) {
    ctx.fillStyle = '#2b2318'; ctx.fillRect(sx, by, b.w, bh);
    ctx.fillStyle = '#221c14'; ctx.fillRect(sx, by, b.w, 10);
    // awning
    ctx.fillStyle = PAL.rust; ctx.fillRect(sx - 4, by + bh * 0.4, b.w + 8, 12);
    ctx.fillStyle = '#3a2e1e'; for (let i = 0; i < (b.w / 14 | 0); i++) if (i % 2) ctx.fillRect(sx - 4 + i * 14, by + bh * 0.4, 14, 12);
    // door + window
    ctx.fillStyle = '#120d08'; ctx.fillRect(sx + b.w * 0.4, by + bh * 0.55, b.w * 0.2, bh * 0.45);
    ctx.fillStyle = U.rgba(PAL.amber, 0.5); ctx.fillRect(sx + b.w * 0.12, by + bh * 0.55, b.w * 0.18, bh * 0.2);
    ctx.strokeStyle = '#0c0906'; ctx.lineWidth = 2; ctx.strokeRect(sx, by, b.w, bh);
  }

  function personColor(id) { return { n1: '#7a5a3a', n2: '#5f6f8f', n3: '#6f5f4a', n4: '#8a5f5f' }[id] || '#6a5a4a'; }

  function drawPerson(ctx, x, groundY, scale, col, phase, facing) {
    const bob = Math.sin(phase) * 2; const s = scale;
    ctx.save(); ctx.translate(x, bob);
    ctx.fillStyle = '#000'; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.ellipse(0, groundY, 20 * s, 5, 0, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = col; ctx.fillRect(-9 * s, groundY - 44 * s, 18 * s, 30 * s);      // torso
    ctx.fillStyle = '#e9d8bf'; ctx.fillRect(-7 * s, groundY - 58 * s, 14 * s, 14 * s); // head
    ctx.fillStyle = col; ctx.fillRect(-8 * s, groundY - 14 * s, 6 * s, 14 * s); ctx.fillRect(2 * s, groundY - 14 * s, 6 * s, 14 * s); // legs
    ctx.restore();
  }

  function drawKid(ctx, x, groundY, facing, walk) {
    const s = 1; const step = Math.sin(walk * 12);
    ctx.save(); ctx.translate(x, 0); ctx.scale(facing, 1);
    ctx.fillStyle = '#000'; ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.ellipse(0, groundY, 22, 6, 0, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1;
    // legs
    ctx.fillStyle = '#2f2a20';
    ctx.fillRect(-8, groundY - 18 + Math.max(0, step) * 2, 7, 18); ctx.fillRect(2, groundY - 18 + Math.max(0, -step) * 2, 7, 18);
    // body (hoodie)
    ctx.fillStyle = PAL.rust; ctx.fillRect(-11, groundY - 44, 22, 28);
    ctx.fillStyle = U.shade(PAL.rust, -0.2); ctx.fillRect(-11, groundY - 44, 22, 4);
    // arm
    ctx.fillStyle = PAL.rust; ctx.fillRect(6, groundY - 40 + step * 2, 6, 16);
    // head + hood
    ctx.fillStyle = '#e9d8bf'; ctx.fillRect(-8, groundY - 60, 16, 16);
    ctx.fillStyle = '#3a2e1e'; ctx.fillRect(-9, groundY - 62, 18, 6); ctx.fillRect(-9, groundY - 62, 4, 16);
    ctx.fillStyle = '#1a1109'; ctx.fillRect(2, groundY - 54, 4, 3); // eye
    ctx.restore();
  }

  function bubble(ctx, x, y, text) {
    ctx.save(); ctx.font = '11px "VT323", monospace';
    const lines = wrap(text, 26); const w = 170, h = 14 + lines.length * 15;
    ctx.fillStyle = 'rgba(12,9,5,.92)'; ctx.fillRect(x - w / 2, y - h, w, h);
    ctx.strokeStyle = PAL.amber; ctx.lineWidth = 2; ctx.strokeRect(x - w / 2, y - h, w, h);
    ctx.fillStyle = PAL.ink; ctx.textAlign = 'center'; ctx.font = '15px "VT323", monospace';
    lines.forEach((ln, i) => ctx.fillText(ln, x, y - h + 16 + i * 15));
    ctx.restore();
  }
  function wrap(t, n) { const w = t.split(' '), out = []; let l = ''; for (const word of w) { if ((l + word).length > n) { out.push(l.trim()); l = ''; } l += word + ' '; } if (l.trim()) out.push(l.trim()); return out; }

  function init() { Z.ui.onEnter('world', enter); }
  return { init, frame, get kidX() { return kid.x; } };
})();
