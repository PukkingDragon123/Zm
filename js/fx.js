/* ================================================================
   fx.js — particles, screenshake, hitstop, slow-mo, damage numbers
   Drives the "game feel". World-space fx drawn inside the camera
   transform; screen flash handled via the #flash DOM layer.
   ================================================================ */
Z.fx = (function () {
  const U = Z.util;
  let particles = [];
  let dmgNums = [];
  let shake = 0, shakeMax = 0;
  let shakeX = 0, shakeY = 0;
  let hitstop = 0;       // seconds of frozen combat
  let slowT = 0, slowDur = 0, slowScale = 1;
  let circles = [], arcs = [], texts = [];       // FMA alchemy VFX + effect text
  let speedT = 0, speedDur = 0, speedColor = '#cfeaff';
  let zoomT = 0, zoomDur = 0, zoomAmt = 0;
  const flashEl = () => document.getElementById('flash');

  function reset() { particles = []; dmgNums = []; circles = []; arcs = []; texts = []; shake = 0; shakeMax = 0; hitstop = 0; slowT = 0; slowDur = 0; slowScale = 1; speedT = 0; zoomT = 0; zoomAmt = 0; }

  // ---- emitters ----
  function sparks(x, y, angle, count, color, spread = 1.1, speed = 260) {
    for (let i = 0; i < count; i++) {
      const a = angle + U.rand(-spread, spread);
      const sp = speed * U.rand(0.35, 1.1);
      particles.push({ k: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: U.rand(0.18, 0.42), max: 0.42, size: U.rand(1.2, 2.8), color, drag: 2.4 });
    }
  }
  function debris(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      const a = U.rand(0, U.TAU), sp = U.rand(40, 220);
      particles.push({ k: 'debris', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: U.rand(0.4, 0.9), max: 0.9, size: U.rand(1.5, 4), rot: U.rand(0, U.TAU), vr: U.rand(-10, 10), color, drag: 1.4 });
    }
  }
  function smoke(x, y, color = '#3a4658', n = 1) {
    for (let i = 0; i < n; i++)
      particles.push({ k: 'smoke', x: x + U.rand(-6, 6), y: y + U.rand(-6, 6), vx: U.rand(-14, 14), vy: U.rand(-30, -12), life: U.rand(0.5, 1.1), max: 1.1, size: U.rand(6, 14), color, drag: 0.6 });
  }
  function ring(x, y, color, r0 = 6, r1 = 60, life = 0.35) {
    particles.push({ k: 'ring', x, y, r: r0, r1, life, max: life, color });
  }
  function flame(x, y, angle, color = '#ff7a18') {
    for (let i = 0; i < 3; i++) {
      const a = angle + U.rand(-0.4, 0.4), sp = U.rand(120, 320);
      particles.push({ k: 'flame', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: U.rand(0.2, 0.45), max: 0.45, size: U.rand(4, 9), color, drag: 2 });
    }
  }
  function burst(x, y, color, n = 14) { sparks(x, y, 0, n, color, Math.PI, 320); ring(x, y, color); }

  function damage(x, y, val, color, big) {
    dmgNums.push({ x: x + U.rand(-8, 8), y, vy: -60, life: big ? 1.1 : 0.8, max: big ? 1.1 : 0.8, val: Math.round(val), color, big: !!big });
  }
  function popText(x, y, text, color) { dmgNums.push({ x, y, vy: -42, life: 1.1, max: 1.1, text, color, big: true }); }

  // ---- FMA alchemy VFX + effect text ----
  function transmute(x, y, r, color, dur) { circles.push({ x, y, r: r || 60, rot: U.rand(0, U.TAU), life: dur || 0.75, max: dur || 0.75, color: color || '#7fd4ff' }); }
  function lightning(x1, y1, x2, y2, color) {
    const seg = 8, pts = [];
    for (let i = 0; i <= seg; i++) pts.push({ x: U.lerp(x1, x2, i / seg) + (i && i < seg ? U.rand(-14, 14) : 0), y: U.lerp(y1, y2, i / seg) + (i && i < seg ? U.rand(-14, 14) : 0) });
    arcs.push({ pts, life: 0.16, max: 0.16, color: color || '#bfe9ff' });
  }
  function speedLines(dur, color) { speedT = speedDur = dur || 0.24; speedColor = color || '#cfeaff'; }
  function zoom(amt, dur) { zoomAmt = amt || 0.06; zoomDur = zoomT = dur || 0.28; }
  function getZoom() { if (zoomT <= 0 || zoomDur <= 0) return 1; return 1 + zoomAmt * Math.sin((zoomT / zoomDur) * Math.PI); }
  function impact(x, y, color) { screenFlash(0.55, '#ffffff'); speedLines(0.22, color || '#ffffff'); zoom(0.08, 0.26); if (x != null) ring(x, y, color || '#ffffff', 8, 100, 0.3); }
  function bigText(text, opts) {
    opts = opts || {};
    texts.push({ text, color: opts.color || '#e8a33d', size: opts.size || 40, dur: opts.dur || 1.1, life: opts.dur || 1.1, ring: !!opts.ring, ringColor: opts.ringColor || '#7fd4ff', y: opts.y != null ? opts.y : 0.4, sub: opts.sub || null, rot: 0 });
  }

  function drawAlchemy(ctx, x, y, r, color, rot, alpha) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, U.TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.82, 0, U.TAU); ctx.stroke();
    for (let s = 0; s < 2; s++) { ctx.beginPath(); for (let i = 0; i < 3; i++) { const a = s * Math.PI + i / 3 * U.TAU - Math.PI / 2; const px = Math.cos(a) * r * 0.8, py = Math.sin(a) * r * 0.8; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.stroke(); }
    for (let i = 0; i < 12; i++) { const a = i / 12 * U.TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.stroke(); }
    ctx.restore();
  }

  // ---- camera fx ----
  function addShake(amt) { shakeMax = Math.max(shakeMax, amt); shake = Math.max(shake, amt); }
  function doHitstop(sec) { hitstop = Math.max(hitstop, sec); }
  function slowmo(scale, dur) { slowScale = scale; slowDur = dur; slowT = dur; }
  function screenFlash(alpha = 0.5, color = '#ffffff') {
    const f = flashEl(); if (!f) return;
    f.style.background = color; f.style.opacity = alpha;
    f.style.transition = 'none';
    requestAnimationFrame(() => { f.style.transition = 'opacity .25s ease'; f.style.opacity = 0; });
  }

  // Effective combat dt (respects hitstop + slow-mo). Pass REAL dt.
  function combatDt(realDt) {
    if (hitstop > 0) return 0;
    return realDt * slowScale;
  }
  function timescale() { return hitstop > 0 ? 0 : slowScale; }

  // ---- per-frame update with REAL dt ----
  function update(realDt) {
    if (hitstop > 0) hitstop = Math.max(0, hitstop - realDt);
    if (slowT > 0) {
      slowT -= realDt;
      if (slowT <= 0) slowScale = 1; // snap back to full speed when it expires
    }
    if (speedT > 0) speedT -= realDt;
    if (zoomT > 0) zoomT -= realDt;
    for (let i = circles.length - 1; i >= 0; i--) { const c = circles[i]; c.life -= realDt; c.rot += realDt * 2.6; if (c.life <= 0) circles.splice(i, 1); }
    for (let i = arcs.length - 1; i >= 0; i--) { arcs[i].life -= realDt; if (arcs[i].life <= 0) arcs.splice(i, 1); }
    for (let i = texts.length - 1; i >= 0; i--) { texts[i].life -= realDt; if (texts[i].life <= 0) texts.splice(i, 1); }
    // shake decay
    if (shake > 0) {
      shake = Math.max(0, shake - realDt * (shakeMax * 4 + 20));
      const a = shake;
      shakeX = U.rand(-a, a); shakeY = U.rand(-a, a);
      if (shake === 0) shakeMax = 0;
    } else { shakeX = shakeY = 0; }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= realDt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      if (p.k === 'ring') { p.r = U.lerp(p.r1, p.r, 1); p.r += (p.r1 - p.r) * Math.min(1, realDt * 8); continue; }
      const drag = p.drag != null ? p.drag : 1;
      p.vx -= p.vx * drag * realDt; p.vy -= p.vy * drag * realDt;
      if (p.k === 'debris') p.vy += 120 * realDt; // gravity-ish
      if (p.k === 'smoke') p.size += 12 * realDt;
      p.x += p.vx * realDt; p.y += p.vy * realDt;
      if (p.rot != null) p.rot += (p.vr || 0) * realDt;
    }
    for (let i = dmgNums.length - 1; i >= 0; i--) {
      const d = dmgNums[i];
      d.life -= realDt;
      if (d.life <= 0) { dmgNums.splice(i, 1); continue; }
      d.y += d.vy * realDt; d.vy += 40 * realDt;
    }
  }

  // ---- world-space render (call inside camera transform) ----
  function render(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
      const a = U.clamp(p.life / p.max, 0, 1);
      if (p.k === 'spark' || p.k === 'flame') {
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color; ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02);
        ctx.stroke();
      } else if (p.k === 'ring') {
        ctx.globalAlpha = a * 0.7; ctx.strokeStyle = p.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, U.TAU); ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const p of particles) {
      const a = U.clamp(p.life / p.max, 0, 1);
      if (p.k === 'debris') {
        ctx.globalAlpha = a; ctx.fillStyle = p.color;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size); ctx.restore();
      } else if (p.k === 'smoke') {
        ctx.globalAlpha = a * 0.32; ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, U.TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    // alchemy circles + lightning (world)
    for (const c of circles) { const life = c.life / c.max; const grow = 1 + (1 - life) * 0.4; drawAlchemy(ctx, c.x, c.y, c.r * grow, c.color, c.rot, U.clamp(life < 0.35 ? life / 0.35 : life, 0, 1)); }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const a of arcs) {
      const al = a.life / a.max;
      ctx.strokeStyle = U.rgba(a.color, al); ctx.lineWidth = 2;
      ctx.beginPath(); a.pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
      ctx.strokeStyle = U.rgba(a.color, al * 0.35); ctx.lineWidth = 6; ctx.stroke();
    }
    ctx.restore();
    // damage numbers (pixel)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const d of dmgNums) {
      const a = U.clamp(d.life / d.max, 0, 1);
      const pop = d.big ? (1 + (1 - a) * 0.0) : 1;
      const size = (d.big ? 20 : 13) * (a > 0.85 ? 1.25 : 1);
      ctx.globalAlpha = a;
      ctx.font = `${size}px "Press Start 2P", monospace`;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.85)';
      ctx.fillStyle = d.color;
      const txt = d.text != null ? d.text : ('-' + d.val);
      ctx.strokeText(txt, d.x, d.y); ctx.fillText(txt, d.x, d.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ---- screen-space overlay (speed lines + effect text). Call with no transform. ----
  function renderScreen(ctx, W, H) {
    if (speedT > 0) {
      const a = speedT / speedDur; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(speedColor, a * 0.5); ctx.lineWidth = 2;
      const cx = W / 2, cy = H / 2, R = Math.hypot(W, H);
      for (let i = 0; i < 30; i++) { const ang = i / 30 * U.TAU + (i % 5) * 0.4; const r0 = R * 0.32 * (0.6 + (i % 3) * 0.16); ctx.beginPath(); ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0); ctx.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R); ctx.stroke(); }
      ctx.restore();
    }
    for (const tx of texts) {
      const p = 1 - tx.life / tx.dur; let scale = 1, alpha = 1, dy = 0;
      if (p < 0.22) scale = U.ease.outBack(p / 0.22); if (p > 0.72) { alpha = 1 - (p - 0.72) / 0.28; dy = -(p - 0.72) / 0.28 * 22; }
      const cx = W / 2, cy = H * tx.y + dy;
      ctx.save(); ctx.translate(cx, cy); ctx.globalAlpha = U.clamp(alpha, 0, 1);
      if (tx.ring) drawAlchemy(ctx, 0, 0, tx.size * 2.4 * scale, tx.ringColor, p * 3, U.clamp(alpha, 0, 1) * 0.9);
      ctx.scale(scale, scale);
      ctx.font = `${tx.size}px "Press Start 2P", monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 6; ctx.strokeStyle = '#000'; ctx.strokeText(tx.text, 0, 0);
      ctx.fillStyle = tx.color; ctx.fillText(tx.text, 0, 0);
      const hw = tx.text.length * tx.size * 0.34;
      ctx.strokeStyle = U.rgba(tx.ringColor, 0.85); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-hw, tx.size * 0.72); ctx.lineTo(hw, tx.size * 0.72); ctx.stroke();
      if (tx.sub) { ctx.font = `${tx.size * 0.36}px "Press Start 2P", monospace`; ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.fillStyle = '#e6ddcd'; ctx.strokeText(tx.sub, 0, tx.size * 1.15); ctx.fillText(tx.sub, 0, tx.size * 1.15); }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  return {
    reset, sparks, debris, smoke, ring, flame, burst, damage, popText,
    addShake, doHitstop, slowmo, screenFlash,
    transmute, lightning, speedLines, zoom, getZoom, impact, bigText,
    combatDt, timescale, update, render, renderScreen,
    get shakeX() { return shakeX; }, get shakeY() { return shakeY; },
    get particleCount() { return particles.length; },
  };
})();
