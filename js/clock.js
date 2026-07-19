/* ================================================================
   clock.js — day/night time-of-day color wash + a cute yokai clock
   widget. Z.state.clock is hours 0..24; this module advances it and
   paints the mood. Kept small and readable; the scenes are the star.
   ================================================================ */
Z.clock = (function () {
  const U = Z.util;
  const SECS_PER_HOUR = 9;                 // ~3.6 real min per in-game day
  let acc = 0;

  function update(dt) {
    acc += dt;
    while (acc >= SECS_PER_HOUR) {
      acc -= SECS_PER_HOUR;
      if (Z.state && Z.state.advanceClock) Z.state.advanceClock(1);
    }
  }
  function isNight() { return Z.state ? Z.state.isNight : false; }
  function hour() { return Z.state ? Z.state.clock : 12; }

  // ---- full-screen mood wash: warm noon -> orange dusk -> cool night ----
  // low alpha so exteriors stay bright and readable.
  const WASH = [
    { h: 0,    c: '#0e1830', a: 0.40 },
    { h: 5,    c: '#152340', a: 0.34 },
    { h: 6.5,  c: '#efb6ac', a: 0.16 },
    { h: 9,    c: '#fbe7bd', a: 0.08 },
    { h: 12,   c: '#fff4d2', a: 0.05 },
    { h: 15,   c: '#ffe9b6', a: 0.08 },
    { h: 17,   c: '#f6b06e', a: 0.17 },
    { h: 18.5, c: '#e0805a', a: 0.24 },
    { h: 19.5, c: '#6a5586', a: 0.30 },
    { h: 21,   c: '#243056', a: 0.38 },
    { h: 24,   c: '#0e1830', a: 0.40 },
  ];
  // tiny sky palette for the clock face (top / bottom)
  const SKY = [
    { h: 0,    t: '#22345c', b: '#0e1830' },
    { h: 5,    t: '#2a3a60', b: '#141f38' },
    { h: 6.5,  t: '#f2b4a8', b: '#f7d9b8' },
    { h: 9,    t: '#9fd0ee', b: '#e6f4fb' },
    { h: 12,   t: '#8ec6ef', b: '#e2f1fb' },
    { h: 15,   t: '#a9d2ec', b: '#eef4e8' },
    { h: 17,   t: '#f4b06a', b: '#f7d7a0' },
    { h: 18.5, t: '#e6864f', b: '#f0b06e' },
    { h: 19.5, t: '#5a4a7a', b: '#2a2f52' },
    { h: 21,   t: '#22345c', b: '#0e1830' },
    { h: 24,   t: '#22345c', b: '#0e1830' },
  ];
  function span(stops, h) {
    h = ((h % 24) + 24) % 24;
    let a = stops[0], b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (h >= stops[i].h && h <= stops[i + 1].h) { a = stops[i]; b = stops[i + 1]; break; }
    }
    const f = b.h === a.h ? 0 : U.smooth(U.clamp((h - a.h) / (b.h - a.h), 0, 1));
    return { a, b, f };
  }

  function phaseName(h) {
    h = ((h % 24) + 24) % 24;
    if (h >= 5 && h < 7) return 'DAWN';
    if (h >= 7 && h < 17) return 'DAY';
    if (h >= 17 && h < 19) return 'DUSK';
    return 'NIGHT';
  }
  function hhmm(h) {
    if (h == null) h = hour();
    const hh = Math.floor(((h % 24) + 24) % 24);
    const mm = Math.floor((h - Math.floor(h)) * 60);
    return (hh < 10 ? '0' + hh : hh) + ':' + (mm < 10 ? '0' + mm : mm);
  }
  function label(h) { if (h == null) h = hour(); return hhmm(h) + ' · ' + phaseName(h); }

  // ---- soft full-screen wash by time of day ----
  function tint(ctx, W, H) {
    if (!ctx) return;
    const s = span(WASH, hour());
    const col = U.mixHex(s.a.c, s.b.c, s.f);
    const alpha = U.lerp(s.a.a, s.b.a, s.f);
    if (alpha <= 0.004) return;
    ctx.save();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, U.rgba(col, alpha));
    g.addColorStop(1, U.rgba(col, alpha * 0.5));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // ---- the cute yokai clock widget (~84px). (x,y) = top-left ----
  function draw(ctx, x, y) {
    if (!ctx) return;
    const S = 84;
    const cx = x + S / 2, cy = y + S * 0.44, R = S * 0.34;
    const h = hour(), night = isNight();
    const sk = span(SKY, h);
    const skyT = U.mixHex(sk.a.t, sk.b.t, sk.f);
    const skyB = U.mixHex(sk.a.b, sk.b.b, sk.f);

    ctx.save();
    ctx.textBaseline = 'alphabetic';

    // drop shadow
    ctx.beginPath(); ctx.arc(cx, cy + 3, R + 5, 0, U.TAU);
    ctx.fillStyle = 'rgba(20,14,8,.25)'; ctx.fill();
    // wood rim + cream cut edge
    ctx.beginPath(); ctx.arc(cx, cy, R + 5, 0, U.TAU);
    ctx.fillStyle = '#9a7748'; ctx.fill();
    ctx.lineWidth = 2.4; ctx.strokeStyle = '#2f2418'; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R + 2.4, 0, U.TAU);
    ctx.lineWidth = 2; ctx.strokeStyle = '#f5ecd7'; ctx.stroke();

    // sky face
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, U.TAU); ctx.clip();
    const g = ctx.createLinearGradient(0, cy - R, 0, cy + R);
    g.addColorStop(0, skyT); g.addColorStop(1, skyB);
    ctx.fillStyle = g; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

    // stars at night
    if (night) {
      const stars = [[-0.52, -0.5], [0.18, -0.62], [0.55, -0.18], [-0.34, 0.12], [0.42, 0.34]];
      stars.forEach((p, i) => {
        const tw = 0.5 + 0.5 * Math.sin(Date.now() / 460 + i * 1.7);
        ctx.globalAlpha = 0.35 + 0.5 * tw; ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(cx + p[0] * R, cy + p[1] * R, 0.9, 0, U.TAU); ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    // sun / moon riding the day arc (left horizon -> top -> right horizon)
    const frac = night ? (((h - 18 + 24) % 24) / 12) : U.clamp((h - 6) / 12, 0, 1);
    const ang = Math.PI * (1 - frac);
    const rr = R * 0.64;
    const bx = cx + Math.cos(ang) * rr, by = cy - Math.sin(ang) * rr - R * 0.06;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (night) {
      const mg = ctx.createRadialGradient(bx, by, 1, bx, by, R * 0.5);
      mg.addColorStop(0, 'rgba(245,240,220,.5)'); mg.addColorStop(1, 'rgba(245,240,220,0)');
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(bx, by, R * 0.5, 0, U.TAU); ctx.fill();
    } else {
      const sg = ctx.createRadialGradient(bx, by, 1, bx, by, R * 0.6);
      sg.addColorStop(0, 'rgba(255,222,120,.8)'); sg.addColorStop(1, 'rgba(255,222,120,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(bx, by, R * 0.6, 0, U.TAU); ctx.fill();
    }
    ctx.restore();
    if (night) {
      ctx.fillStyle = '#f5efd2'; ctx.beginPath(); ctx.arc(bx, by, R * 0.22, 0, U.TAU); ctx.fill();
      ctx.fillStyle = skyT; ctx.beginPath(); ctx.arc(bx + R * 0.1, by - R * 0.05, R * 0.2, 0, U.TAU); ctx.fill();
    } else {
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(bx, by, R * 0.2, 0, U.TAU); ctx.fill();
    }
    // soft horizon
    ctx.strokeStyle = 'rgba(47,36,24,.2)'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(cx - R, cy + R * 0.4); ctx.lineTo(cx + R, cy + R * 0.4); ctx.stroke();
    ctx.restore();

    // tanuki-leaf hour hand (24h dial: noon up, midnight down)
    const hand = Math.PI / 2 - (h / 24) * U.TAU;
    const hx = cx + Math.cos(hand) * R * 0.58, hy = cy - Math.sin(hand) * R * 0.58;
    ctx.strokeStyle = '#3a2c1c'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(Math.atan2(-Math.sin(hand), Math.cos(hand)) + Math.PI / 2);
    ctx.fillStyle = '#7f9e6a';
    ctx.beginPath(); ctx.moveTo(0, -6.5); ctx.quadraticCurveTo(5, 0, 0, 7); ctx.quadraticCurveTo(-5, 0, 0, -6.5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#3a2c1c'; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = '#5f7a4c'; ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(0, 6); ctx.stroke();
    ctx.restore();
    // hub
    ctx.fillStyle = '#d94f30'; ctx.beginPath(); ctx.arc(cx, cy, 2.6, 0, U.TAU); ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = '#2f2418'; ctx.stroke();

    // time + phase label
    if (Z.render && Z.render.pxText) Z.render.pxText(ctx, label(h), cx, cy + R + 17, 8.5, '#fff7ea', 'center');
    ctx.restore();
  }

  function init() {}
  return { init, update, isNight, draw, tint, phaseName, label, hhmm };
})();
