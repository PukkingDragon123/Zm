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
  const flashEl = () => document.getElementById('flash');

  function reset() { particles = []; dmgNums = []; shake = 0; shakeMax = 0; hitstop = 0; slowT = 0; slowDur = 0; slowScale = 1; }

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
    // damage numbers
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const d of dmgNums) {
      const a = U.clamp(d.life / d.max, 0, 1);
      const size = d.big ? 26 : 18;
      ctx.globalAlpha = a;
      ctx.font = `900 ${size}px Orbitron, sans-serif`;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)';
      ctx.fillStyle = d.color;
      const txt = d.text != null ? d.text : ('-' + d.val);
      ctx.strokeText(txt, d.x, d.y); ctx.fillText(txt, d.x, d.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  return {
    reset, sparks, debris, smoke, ring, flame, burst, damage, popText,
    addShake, doHitstop, slowmo, screenFlash,
    combatDt, timescale, update, render,
    get shakeX() { return shakeX; }, get shakeY() { return shakeY; },
    get particleCount() { return particles.length; },
  };
})();
