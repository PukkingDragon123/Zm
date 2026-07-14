/* ================================================================
   combat.js — the Neon Dohyo. Top-down momentum sumo:
   shove your rival past the rim, or grind their HP to zero.
   Boost + brace give driving a skill ceiling; the ring shrinks.
   ================================================================ */
Z.combat = (function () {
  const U = Z.util;
  const D = Z.data;

  const R0 = 300, RMIN = 188, SHRINK_START = 24, MATCH_TIME = 60;
  let arena = { R: R0, cx: 0, cy: 0, danger: 0 };
  let P = null, E = null;      // fighters
  let phase = 'idle';          // idle | intro | fight | end
  let t = 0, matchT = 0, introT = 0, endT = 0;
  let cam = { x: 0, y: 0, zoom: 1 };
  let result = null;
  let enemyDef = null, rewardRp = 0;
  let announceTimer = 0;
  let braceBtn = null;

  // ---------- input ----------
  const keys = {};
  const input = { mx: 0, my: 0, boostQ: false, brace: false, touchMove: { x: 0, y: 0, on: false } };
  let stickState = { id: null, cx: 0, cy: 0 };
  let touchWired = false;

  function onKey(e, down) {
    const c = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(c)) e.preventDefault();
    if (down && c === 'Space' && !keys[c]) input.boostQ = true;
    keys[c] = down;
  }
  function readKeyboardMove() {
    let x = 0, y = 0;
    if (keys['KeyA'] || keys['ArrowLeft']) x -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) x += 1;
    if (keys['KeyW'] || keys['ArrowUp']) y -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) y += 1;
    return { x, y };
  }
  function pollGamepad() {
    if (!navigator.getGamepads) return null;
    const gps = navigator.getGamepads();
    for (const g of gps) {
      if (!g) continue;
      const ax = g.axes[0] || 0, ay = g.axes[1] || 0;
      const mv = { x: Math.abs(ax) > 0.2 ? ax : 0, y: Math.abs(ay) > 0.2 ? ay : 0 };
      if (g.buttons[0] && g.buttons[0].pressed) { if (!keys._gpA) input.boostQ = true; keys._gpA = true; } else keys._gpA = false;
      mv.brace = !!((g.buttons[1] && g.buttons[1].pressed) || (g.buttons[6] && g.buttons[6].value > 0.4));
      return mv;
    }
    return null;
  }

  function setupTouch() {
    const stick = document.getElementById('stick'), nub = document.getElementById('stickNub');
    const fire = document.getElementById('fireBtn');
    if (!stick) return;
    if (!touchWired) {
      touchWired = true;
      const rect = () => stick.getBoundingClientRect();
      stick.addEventListener('pointerdown', (e) => {
        const r = rect(); stickState = { id: e.pointerId, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
        input.touchMove.on = true; stick.setPointerCapture(e.pointerId); moveStick(e, nub);
      });
      stick.addEventListener('pointermove', (e) => { if (stickState.id === e.pointerId) moveStick(e, nub); });
      const end = (e) => { if (stickState.id === e.pointerId) { stickState.id = null; input.touchMove = { x: 0, y: 0, on: false }; if (nub) nub.style.transform = 'translate(-50%,-50%)'; } };
      stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
      fire && fire.addEventListener('pointerdown', (e) => { e.preventDefault(); input.boostQ = true; Z.audio.resume(); });
    }
    // brace button — stacked ABOVE fire on the right, never over the left stick
    if (!braceBtn) {
      const touch = document.getElementById('touch');
      braceBtn = U.el('button', 'fire-btn', 'BRACE');
      braceBtn.style.cssText = 'width:84px;height:84px;border-color:var(--neonA);background:rgba(31,247,255,.12);box-shadow:0 0 18px rgba(31,247,255,.3);font-size:14px;position:absolute;right:30px;bottom:150px';
      braceBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); input._touchBrace = true; });
      braceBtn.addEventListener('pointerup', () => { input._touchBrace = false; });
      braceBtn.addEventListener('pointercancel', () => { input._touchBrace = false; });
      touch && touch.appendChild(braceBtn);
    }
  }
  function moveStick(e, nub) {
    const dx = e.clientX - stickState.cx, dy = e.clientY - stickState.cy;
    const max = 46; const d = Math.hypot(dx, dy) || 1;
    const cl = Math.min(d, max);
    const nx = (dx / d) * cl, ny = (dy / d) * cl;
    input.touchMove = { x: nx / max, y: ny / max, on: true };
    if (nub) nub.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
  }

  // ---------- fighter factory ----------
  function makeFighter(spec, isPlayer, x) {
    return {
      spec, isPlayer, x, y: 0, vx: 0, vy: 0,
      angle: isPlayer ? 0 : Math.PI,
      hp: spec.maxHp, maxHp: spec.maxHp,
      energy: spec.energyMax, energyMax: spec.energyMax,
      r: spec.radius,
      mass: spec.mass, grip: spec.grip, accel: spec.accel, maxSpeed: spec.maxSpeed,
      weapons: spec.weapons.map((w) => ({ ...w, cd: 0 })),
      anim: { t: 0, spin: 0, hammer: 0, flip: 0 },
      boostCd: 0, whiff: 0, braceActive: false,
      damaged: false, color: spec.accent,
      aiTimer: 0, aiWander: 0,
    };
  }

  // ---------- start / stop ----------
  function start(playerSpec, enemy, opts) {
    enemyDef = enemy; rewardRp = (opts && opts.rp) || 20;
    Z.fx.reset();
    arena = { R: R0, cx: 0, cy: 0, danger: 0 };
    P = makeFighter(playerSpec, true, -130);
    E = makeFighter(Z.Bot.fromEnemy(enemy), false, 130);
    P.angle = 0; E.angle = Math.PI;
    phase = 'intro'; t = 0; matchT = 0; introT = 0; endT = 0; result = null; announceTimer = 0;
    cam = { x: 0, y: 0, zoom: computeZoom() };
    // input
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    setupTouch();
    Z.audio.startWhir(); Z.audio.setMode('combat');
    document.getElementById('cbNameL').textContent = trunc(playerSpec.name, 14);
    document.getElementById('cbNameR').textContent = trunc(enemy.name, 14);
    document.getElementById('cbNameL').style.color = playerSpec.accent;
    document.getElementById('cbNameR').style.color = enemy.isChampion ? D.PAL.gold : enemy.color;
    Z.ui.show('combat');
    announce('READY');
  }
  const kd = (e) => onKey(e, true), ku = (e) => onKey(e, false);
  function stop() {
    window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku);
    Z.audio.stopWhir();
    for (const k in keys) delete keys[k];
    input.boostQ = false; input.brace = false; input._touchBrace = false;
    input.touchMove = { x: 0, y: 0, on: false }; stickState.id = null;
  }
  function trunc(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  function computeZoom() {
    const d = P && E ? Math.hypot(E.x - P.x, E.y - P.y) : 200;
    const need = Math.max(280, d + 220);
    const z = Math.min(Z.render.W, Z.render.H) / need;
    return U.clamp(z, 0.6, 1.5);
  }

  function announce(text) {
    const el = document.getElementById('cbAnnounce');
    if (!el) return; el.textContent = text; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }

  // ---------- update ----------
  function update(realDt) {
    if (phase === 'idle') return;
    t += realDt;
    const gp = pollGamepad();
    // gather input — recompute brace fresh every frame from ALL live sources
    let mv = readKeyboardMove();
    if (input.touchMove.on) mv = { x: input.touchMove.x, y: input.touchMove.y };
    else if (gp && (gp.x || gp.y)) mv = gp;
    input.brace = !!(keys['ShiftLeft'] || keys['ShiftRight']) || !!input._touchBrace || !!(gp && gp.brace);
    const dt = Z.fx.combatDt(realDt);

    if (phase === 'intro') {
      introT += realDt;
      if (introT > 0.9 && introT < 0.95) announce('SET');
      if (introT >= 1.7) { phase = 'fight'; announce('FIGHT!'); Z.fx.screenFlash(0.4, D.PAL.neonB); Z.audio.sfx.countdown(0); }
      idleBob(P, realDt); idleBob(E, realDt);
    } else if (phase === 'fight') {
      matchT += dt;
      // shrink ring
      if (matchT > SHRINK_START) {
        const k = U.clamp((matchT - SHRINK_START) / (MATCH_TIME - SHRINK_START), 0, 1);
        arena.R = U.lerp(R0, RMIN, U.ease.inOut(k));
      }
      // control
      driveFighter(P, mv, input.boostQ, input.brace, dt);
      input.boostQ = false;
      aiControl(E, P, dt);
      integrate(P, dt); integrate(E, dt);
      collide(P, E);
      weapons(P, E, dt); weapons(E, P, dt);
      constrainReturn(P, dt); constrainReturn(E, dt);
      checkRingOut(); checkKO(); checkTimeout();
      // camera
      cam.x = U.lerp(cam.x, (P.x + E.x) / 2, 1 - Math.pow(0.001, realDt));
      cam.y = U.lerp(cam.y, (P.y + E.y) / 2, 1 - Math.pow(0.001, realDt));
      cam.zoom = U.lerp(cam.zoom, computeZoom(), 1 - Math.pow(0.01, realDt));
      // rim danger heartbeat
      const near = Math.max(distFrac(P), distFrac(E));
      arena.danger = near;
      // whir intensity from spinner presence + contact
      let whir = 0;
      [P, E].forEach((f) => f.weapons.forEach((w) => { if (w.type === 'spinner' && f.energy > 1) whir = Math.max(whir, 0.5); }));
      Z.audio.setWhir(whir);
    } else if (phase === 'end') {
      endT += realDt;
      integrate(P, dt); integrate(E, dt);
      cam.zoom = U.lerp(cam.zoom, computeZoom() * 1.15, 1 - Math.pow(0.02, realDt));
      if (result && result.focus) { cam.x = U.lerp(cam.x, result.focus.x, 0.05); cam.y = U.lerp(cam.y, result.focus.y, 0.05); }
      if (endT > 1.7) finish();
    }
    // anims
    [P, E].forEach((f) => { if (!f) return; f.anim.t = t; f.anim.spin += (f.energy > 1 ? 22 : 4) * realDt; });
    updateHud();
  }

  function idleBob(f) { f.anim.t = t; f.anim.spin += 0.06; }

  function driveFighter(f, mv, boost, brace, dt) {
    const mag = Math.hypot(mv.x, mv.y);
    f.braceActive = brace && f.energy > 4;
    if (f.braceActive) {
      f.energy = Math.max(0, f.energy - 10 * dt);
    } else if (mag > 0.1) {
      const nx = mv.x / mag, ny = mv.y / mag;
      const a = f.accel * (f.whiff > 0 ? 0.4 : 1);
      f.vx += nx * a * dt; f.vy += ny * a * dt;
      f.angle = U.angLerp(f.angle, Math.atan2(ny, nx), 1 - Math.pow(0.0001, dt));
    }
    if (boost && f.boostCd <= 0 && f.energy >= 20 && !f.braceActive) doBoost(f);
    if (f.boostCd > 0) f.boostCd -= dt;
    if (f.whiff > 0) f.whiff -= dt;
    // energy regen
    f.energy = Math.min(f.energyMax, f.energy + f.spec.energyRegen * dt);
  }

  function doBoost(f) {
    const dv = 150 + f.accel * 0.14;
    f.vx += Math.cos(f.angle) * dv; f.vy += Math.sin(f.angle) * dv;
    f.energy -= 20; f.boostCd = 0.7; f.whiff = 0.16; f.boosting = 0.18;
    Z.fx.sparks(f.x - Math.cos(f.angle) * f.r, f.y - Math.sin(f.angle) * f.r, f.angle + Math.PI, 8, f.color, 0.5, 300);
    Z.audio.sfx.boost();
    // trigger burst weapons on the commit
    f._burstReq = true;
  }

  function integrate(f, dt) {
    if (!f) return;
    // friction (grip = more control / faster stop)
    const fric = 2.4 * (0.45 + f.grip);
    const damp = 1 / (1 + fric * dt);
    f.vx *= damp; f.vy *= damp;
    // clamp runaway
    const sp = Math.hypot(f.vx, f.vy), cap = f.maxSpeed * 1.9;
    if (sp > cap) { f.vx *= cap / sp; f.vy *= cap / sp; }
    f.x += f.vx * dt; f.y += f.vy * dt;
    if (f.boosting) f.boosting = Math.max(0, f.boosting - dt);
  }

  function collide(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    let dist = Math.hypot(dx, dy) || 0.001;
    const min = a.r + b.r;
    if (dist >= min) return;
    const nx = dx / dist, ny = dy / dist;
    const overlap = min - dist;
    const imA = 1 / a.mass, imB = 1 / b.mass, imSum = imA + imB;
    a.x -= nx * overlap * (imA / imSum); a.y -= ny * overlap * (imA / imSum);
    b.x += nx * overlap * (imB / imSum); b.y += ny * overlap * (imB / imSum);
    const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
    const vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      const e = 0.18;
      const j = -(1 + e) * vn / imSum;
      const jx = j * nx, jy = j * ny;
      a.vx -= jx * imA * (1 - a.grip * 0.55); a.vy -= jy * imA * (1 - a.grip * 0.55);
      b.vx += jx * imB * (1 - b.grip * 0.55); b.vy += jy * imB * (1 - b.grip * 0.55);
      const impact = -vn;
      // ram damage (modest) — boosting bot deals a bonus
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (impact > 70) {
        const base = impact * 0.028;
        dealDamage(a, base * (b.boosting ? 1.8 : 1) * (b.mass / a.mass) * 0.5, mid.x, mid.y, b.color, false, false);
        dealDamage(b, base * (a.boosting ? 1.8 : 1) * (a.mass / b.mass) * 0.5, mid.x, mid.y, a.color, false, false);
        const shk = U.clamp(impact / 70, 1, 8) * (Z.state.settings.shake ? 1 : 0.001);
        Z.fx.addShake(shk); Z.fx.doHitstop(U.clamp(impact / 1400, 0.01, 0.09));
        Z.fx.sparks(mid.x, mid.y, Math.atan2(-ny, -nx), U.clamp(impact / 22, 3, 12), '#eaffff', 1.4, impact * 1.4);
        Z.audio.sfx.hit(U.clamp(impact / 200, 0.4, 2));
      }
    }
  }

  function weapons(att, def, dt) {
    const dx = def.x - att.x, dy = def.y - att.y;
    const dist = Math.hypot(dx, dy);
    const contact = dist < att.r + def.r + 8;
    const facing = Math.cos(Math.atan2(dy, dx) - att.angle); // 1 = def in front
    const burst = att._burstReq; att._burstReq = false;
    att.weapons.forEach((w) => {
      if (w.cd > 0) w.cd -= dt;
      const hitPt = { x: att.x + Math.cos(att.angle) * att.r, y: att.y + Math.sin(att.angle) * att.r };
      if (w.type === 'spinner' || w.type === 'blade') {
        if (contact && att.energy > 1 && w.cd <= 0) {
          w.cd = w.cooldown;
          att.energy = Math.max(0, att.energy - (w.type === 'spinner' ? 3 : 1.5));
          dealDamage(def, w.damage, hitPt.x, hitPt.y, att.color, false, false);
          knock(def, att, w.knockback);
          Z.fx.sparks(hitPt.x, hitPt.y, Math.atan2(dy, dx) + Math.PI, 6, att.color, 1.2, 320);
          Z.fx.addShake(1.2 * (Z.state.settings.shake ? 1 : 0));
        }
      } else if (w.type === 'flamer') {
        if (contact && facing > 0.2 && att.energy > 1) {
          att.energy = Math.max(0, att.energy - 12 * dt);
          dealDamage(def, w.damage * dt, hitPt.x, hitPt.y, D.PAL.warn, false, true);
          Z.fx.flame(hitPt.x, hitPt.y, Math.atan2(dy, dx), D.PAL.warn);
        }
      } else if (w.type === 'hammer') {
        if (contact && w.cd <= 0 && (att.isPlayer ? burst || facing > 0.5 : facing > 0.4) && att.energy >= 6) {
          w.cd = w.cooldown; att.energy -= 6;
          att.anim.hammer = 1;
          dealDamage(def, w.damage, hitPt.x, hitPt.y, att.color, true, false);
          knock(def, att, w.knockback);
          Z.fx.addShake(4 * (Z.state.settings.shake ? 1 : 0)); Z.fx.doHitstop(0.06);
          Z.fx.burst(hitPt.x, hitPt.y, att.color, 10);
          Z.audio.sfx.hammer();
        }
      } else if (w.type === 'flipper') {
        if (contact && w.cd <= 0 && (att.isPlayer ? burst || facing > 0.4 : facing > 0.35) && att.energy >= 8) {
          w.cd = w.cooldown; att.energy -= 8;
          att.anim.flip = 1;
          dealDamage(def, w.damage, hitPt.x, hitPt.y, att.color, false, false);
          knock(def, att, w.knockback * 3.4);   // launch — the ring-out tool
          Z.fx.addShake(3 * (Z.state.settings.shake ? 1 : 0));
          Z.fx.burst(hitPt.x, hitPt.y, att.color, 8);
          Z.audio.sfx.flip();
        }
      }
    });
    // decay weapon anims
    if (att.anim.hammer > 0) att.anim.hammer = Math.max(0, att.anim.hammer - dt * 4);
    if (att.anim.flip > 0) att.anim.flip = Math.max(0, att.anim.flip - dt * 3);
  }

  function knock(def, att, amount) {
    const dx = def.x - att.x, dy = def.y - att.y, d = Math.hypot(dx, dy) || 1;
    const resist = def.braceActive ? 0.25 : (1 - def.grip * 0.5);
    const k = amount * resist;
    def.vx += (dx / d) * k; def.vy += (dy / d) * k;
  }

  function dealDamage(f, amt, x, y, color, big, silent) {
    const dmg = amt * (1 - (f.spec.armor || 0) / 100);
    if (dmg <= 0) return;
    f.hp -= dmg;
    if (f.isPlayer) f.damaged = true;
    if (!silent || Math.random() < 0.1) Z.fx.damage(x, y, dmg, color, big);
    if (f.hp < f.maxHp * 0.4 && Math.random() < 0.25) Z.fx.smoke(f.x, f.y, '#404a5a', 1);
  }

  function distFrac(f) { return Math.hypot(f.x - arena.cx, f.y - arena.cy) / arena.R; }

  function constrainReturn(f, dt) {
    // slight pull toward center is NOT applied (that would trivialize ring-out);
    // instead near the very rim traction drops (ice-edge) so pushes are lethal.
    const df = distFrac(f);
    if (df > 0.92) { f.vx *= 1 + 0.28 * dt; f.vy *= 1 + 0.28 * dt; } // edge is slick — momentum carries
  }

  function checkRingOut() {
    if (result) return;
    const outP = distFrac(P) > 1.04, outE = distFrac(E) > 1.04;
    if (outP && outE) endMatch(distFrac(P) < distFrac(E) ? 'win' : 'lose', { ringOut: true });
    else if (outE) endMatch('win', { ringOut: true, focus: { x: E.x, y: E.y } });
    else if (outP) endMatch('lose', { ringOut: true, focus: { x: P.x, y: P.y } });
  }
  function checkKO() {
    if (result) return;
    if (E.hp <= 0 && P.hp <= 0) endMatch(P.hp >= E.hp ? 'win' : 'lose', { ko: true });
    else if (E.hp <= 0) endMatch('win', { ko: true, focus: { x: E.x, y: E.y } });
    else if (P.hp <= 0) endMatch('lose', { ko: true, focus: { x: P.x, y: P.y } });
  }
  function checkTimeout() {
    if (result) return;
    if (matchT >= MATCH_TIME) {
      const pf = P.hp / P.maxHp, ef = E.hp / E.maxHp;
      endMatch(pf >= ef ? 'win' : 'lose', { timeout: true });
    }
  }

  function endMatch(outcome, info) {
    if (result) return;
    const win = outcome === 'win';
    result = Object.assign({ win, ringOut: false, ko: false, timeout: false, focus: null }, info);
    phase = 'end'; endT = 0;
    Z.fx.slowmo(0.28, 0.7); Z.fx.doHitstop(0.08);
    Z.fx.screenFlash(0.5, win ? D.PAL.neonC : D.PAL.warn);
    announce(info.ringOut ? (win ? 'RING-OUT!' : 'RING-OUT') : info.ko ? (win ? 'K.O.!' : 'WRECKED') : (win ? 'JUDGES WIN' : 'JUDGES LOSS'));
    if (info.ringOut) Z.audio.sfx.ringout();
    Z.audio.setWhir(0);
  }

  function finish() {
    phase = 'idle';
    stop();
    const win = result.win;
    const en = enemyDef;
    const info = {
      ringOut: result.ringOut, ko: result.ko, timeout: result.timeout,
      noDamage: win && !P.damaged,
    };
    let creditsEarned = 0, rankUps = [];
    if (win) {
      Z.state.recordWin(info);
      // per-equipped-weapon-type win credit (for contracts)
      const types = new Set(P.weapons.map((w) => w.type).filter((x) => x && x !== 'none'));
      types.forEach((ty) => { Z.state.stats.winsByWeapon[ty] = (Z.state.stats.winsByWeapon[ty] || 0) + 1; });
      creditsEarned = en.purse + Math.round(en.purse * (info.ringOut ? 0.25 : info.ko ? 0.15 : 0));
      Z.state.addCredits(creditsEarned, true);
      const first = !Z.state.beaten[en.id];
      Z.state.beaten[en.id] = true;
      const rpGained = rewardRp + (first ? Math.round(rewardRp * 0.5) : 0);
      result.rpGained = rpGained;
      rankUps = Z.game.awardRp(rpGained);
      if (en.isChampion && first) Z.game.onChampionDefeated();
    } else {
      Z.state.recordLoss();
      Z.state.addScrap(6); // consolation salvage
    }
    Z.state.persist();
    Z.quests.check();
    showResult(win, en, creditsEarned, rankUps, info);
  }

  function showResult(win, en, credits, rankUps, info) {
    document.getElementById('resultBand').textContent = win ? (en.isChampion ? 'ULTIMATE ZUMO' : 'VICTORY') : 'DEFEAT';
    document.getElementById('resultBand').className = 'result-band ' + (win ? 'win' : 'lose');
    const rows = [];
    rows.push(['OUTCOME', info.ringOut ? 'Ring-out' : info.ko ? 'Knockout' : "Judges' decision"]);
    if (win) {
      rows.push(['PURSE', '+' + U.fmt(credits) + ' ₡']);
      rows.push(['RANK POINTS', '+' + (result.rpGained || rewardRp) + ' RP']);
      if (info.noDamage) rows.push(['FLAWLESS', 'No damage taken!']);
    } else {
      rows.push(['SALVAGE', '+6 scrap']);
      rows.push(['LINE', '“' + en.taunt + '”']);
    }
    if (win) rows.push(['RIVAL', '“' + en.defeatLine + '”']);
    let html = rows.map((r) => `<div class="rrow"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
    if (rankUps && rankUps.length) html += `<div class="rrow" style="border:none;color:var(--neonC)"><span>PROMOTED</span><b style="color:var(--neonC)">${rankUps.map((r) => r.name).join(' → ')}</b></div>`;
    document.getElementById('resultBody').innerHTML = html;
    Z.audio.sfx[win ? 'win' : 'lose']();
    Z.ui.show('result');
  }

  // ---------- AI ----------
  function aiControl(f, foe, dt) {
    f.aiTimer -= dt;
    const sp = f.spec;
    const dx = foe.x - f.x, dy = foe.y - f.y;
    const dist = Math.hypot(dx, dy) || 1;
    const toFoe = { x: dx / dist, y: dy / dist };
    const myDF = distFrac(f), foeDF = distFrac(foe);
    // desired vector
    let wx = 0, wy = 0;
    const aggr = sp.aggression != null ? sp.aggression : 0.6;
    // self-preservation: steer to center scaled by how close to edge & (1-aggr)
    if (myDF > 0.62) {
      const cx = arena.cx - f.x, cy = arena.cy - f.y, cd = Math.hypot(cx, cy) || 1;
      const w = U.map(myDF, 0.62, 1.05, 0.2, 2.2) * (1.2 - aggr * 0.7);
      wx += (cx / cd) * w; wy += (cy / cd) * w;
    }
    // engagement based on archetype
    const arche = sp.archetype;
    let range = 0;
    if (arche === 'sniper' || arche === 'trickster') range = f.r + foe.r + 90;
    else if (arche === 'duelist') range = f.r + foe.r + 30;
    // approach if farther than range, back off if closer (kiters)
    if (dist > range + 10) { wx += toFoe.x; wy += toFoe.y; }
    else if (range > 0 && dist < range - 20) { wx -= toFoe.x * 0.9; wy -= toFoe.y * 0.9; }
    else { wx += toFoe.x * (arche === 'tank' ? 0.3 : 0.7); wy += toFoe.y * (arche === 'tank' ? 0.3 : 0.7); }
    // try to push foe toward THE nearest edge (flank) when foe is near rim
    if (foeDF > 0.6 && aggr > 0.4) {
      const ox = foe.x - arena.cx, oy = foe.y - arena.cy, od = Math.hypot(ox, oy) || 1;
      wx += (ox / od) * 0.6; wy += (oy / od) * 0.6; // get behind foe relative to center
    }
    // wander noise
    f.aiWander += dt * 3;
    wx += Math.cos(f.aiWander) * 0.15; wy += Math.sin(f.aiWander * 1.3) * 0.15;
    const wm = Math.hypot(wx, wy) || 1;
    const mv = { x: wx / wm, y: wy / wm };
    // brace when a heavy foe is bearing down and we're near edge
    const foeSpeed = Math.hypot(foe.vx, foe.vy);
    const brace = myDF > 0.72 && foeSpeed > f.maxSpeed * 0.7 && dist < f.r + foe.r + 30 && f.energy > 20 && arche === 'tank';
    // boost decision: aggressive, lined up, foe in front, off cooldown
    const facing = (mv.x * toFoe.x + mv.y * toFoe.y);
    let boost = false;
    if (f.boostCd <= 0 && f.energy > 30 && dist < f.r + foe.r + 120 && facing > 0.6) {
      const p = aggr * (foeDF > 0.55 ? 1.6 : 0.7);
      if (f.aiTimer <= 0 && Math.random() < p * 0.5) { boost = true; f.aiTimer = U.rand(0.4, 1.1); }
    }
    driveFighter(f, mv, boost, brace, dt);
  }

  // ---------- render ----------
  function render() {
    const ctx = Z.render.ctx;
    const W = Z.render.W, H = Z.render.H;
    Z.render.background(t);
    // dim the world behind the pit
    ctx.fillStyle = 'rgba(3,5,10,.55)'; ctx.fillRect(0, 0, W, H);

    ctx.save();
    const sx = (Z.state.settings.shake ? Z.fx.shakeX : 0), sy = (Z.state.settings.shake ? Z.fx.shakeY : 0);
    ctx.translate(W / 2 + sx, H / 2 + sy);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    drawArena(ctx);
    // bots
    if (E) Z.render.drawBot(E.x, E.y, E.angle, E.spec, E.anim, { hpFrac: E.hp / E.maxHp });
    if (P) Z.render.drawBot(P.x, P.y, P.angle, P.spec, P.anim, { hpFrac: P.hp / P.maxHp });
    // brace rings
    [P, E].forEach((f) => { if (f && f.braceActive) { ctx.strokeStyle = U.rgba(D.PAL.neonA, .8); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, f.r + 6, 0, U.TAU); ctx.stroke(); } });

    Z.fx.render(ctx);
    ctx.restore();
  }

  function drawArena(ctx) {
    const R = arena.R;
    // floor disc
    const g = ctx.createRadialGradient(0, 0, 10, 0, 0, R);
    g.addColorStop(0, '#0c1526'); g.addColorStop(0.7, '#0a1120'); g.addColorStop(1, '#070c17');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, U.TAU); ctx.fill();
    // grid inside
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R, 0, U.TAU); ctx.clip();
    ctx.strokeStyle = U.rgba(D.PAL.neonA, 0.06); ctx.lineWidth = 1;
    for (let i = -R; i < R; i += 34) { ctx.beginPath(); ctx.moveTo(i, -R); ctx.lineTo(i, R); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-R, i); ctx.lineTo(R, i); ctx.stroke(); }
    // center emblem
    ctx.strokeStyle = U.rgba(D.PAL.neonB, 0.18); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.28, 0, U.TAU); ctx.stroke();
    ctx.restore();
    // rim
    ctx.lineWidth = 5; ctx.strokeStyle = D.PAL.neonA; ctx.shadowColor = D.PAL.neonA; ctx.shadowBlur = 22;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, U.TAU); ctx.stroke();
    ctx.shadowBlur = 0;
    // danger arc near whichever bot is close to edge
    [P, E].forEach((f) => {
      if (!f) return; const df = distFrac(f);
      if (df > 0.8) {
        const ang = Math.atan2(f.y, f.x);
        const pulse = 0.4 + 0.6 * Math.abs(Math.sin(t * 8));
        ctx.strokeStyle = U.rgba(D.PAL.warn, U.map(df, 0.8, 1.05, 0.2, 0.9) * pulse);
        ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(0, 0, R - 1, ang - 0.5, ang + 0.5); ctx.stroke();
      }
    });
    // shrink telegraph
    if (matchT > SHRINK_START - 3 && matchT < SHRINK_START) {
      ctx.strokeStyle = U.rgba(D.PAL.neonB, 0.3 + 0.3 * Math.sin(t * 10)); ctx.lineWidth = 2;
      ctx.setLineDash([10, 10]); ctx.beginPath(); ctx.arc(0, 0, RMIN, 0, U.TAU); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  // ---------- HUD ----------
  let hudCache = {};
  function updateHud() {
    if (!P || !E) return;
    setBar('cbHpL', P.hp / P.maxHp); setBar('cbHpR', E.hp / E.maxHp);
    setBar('cbEnL', P.energy / P.energyMax); setBar('cbEnR', E.energy / E.energyMax);
    const timeLeft = Math.max(0, Math.ceil(MATCH_TIME - matchT));
    const tEl = document.getElementById('cbTimer');
    if (tEl) { tEl.textContent = timeLeft; tEl.classList.toggle('low', timeLeft <= 10 && phase === 'fight'); }
  }
  function setBar(id, frac) {
    const el = document.getElementById(id); if (!el) return;
    const c = el.querySelector('i'); if (c) c.style.width = U.clamp(frac, 0, 1) * 100 + '%';
  }

  return {
    start, update, render, get active() { return phase !== 'idle'; },
    // lightweight hooks used by automated playtests (inert unless called)
    _dbg() { return { P, E, arena, phase, matchT }; },
    _testInput(x, y, boost) { input.touchMove = { x: x || 0, y: y || 0, on: !!(x || y) }; if (boost) input.boostQ = true; },
  };
})();
