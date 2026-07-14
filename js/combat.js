/* ================================================================
   combat.js — THE PIT. Side-view 2D brawl. Move in, HIT, SKILL,
   BLOCK. Crowd + kid operators holding controllers. Heavy VFX.
   ================================================================ */
Z.combat = (function () {
  const U = Z.util, D = Z.data, PAL = Z.data.PAL;
  const MATCH_TIME = 60;
  let P = null, E = null, enemyDef = null, rewardRp = 20;
  let phase = 'idle', t = 0, matchT = 0, introT = 0, endT = 0, result = null;
  let stage = { groundY: 0, left: 0, right: 0 };
  let opLeftPress = 0, opRightPress = 0, crowdHype = 0;
  let crowd = null;

  const PROF = {
    spinner: { reach: 30, dmgMul: 0.55, cd: 0.18, kb: 70, active: 0.16, ecost: 2, hitstop: 0.02, shake: 1.4, launch: 0 },
    blade:   { reach: 52, dmgMul: 1.0,  cd: 0.5,  kb: 150, active: 0.16, ecost: 3, hitstop: 0.05, shake: 2.4, launch: 0 },
    hammer:  { reach: 54, dmgMul: 1.5,  cd: 0.95, kb: 320, active: 0.2,  ecost: 6, hitstop: 0.1,  shake: 7,   launch: 120 },
    flipper: { reach: 44, dmgMul: 0.8,  cd: 1.0,  kb: 300, active: 0.2,  ecost: 6, hitstop: 0.07, shake: 4,   launch: 420 },
    flamer:  { reach: 78, dmgMul: 0.42, cd: 0.28, kb: 24,  active: 0.22, ecost: 4, hitstop: 0,    shake: 1,   launch: 0, dot: true },
    none:    { reach: 38, dmgMul: 0.6,  cd: 0.55, kb: 130, active: 0.16, ecost: 1, hitstop: 0.03, shake: 1.6, launch: 0 },
  };

  function primaryWeapon(spec) { return (spec.weapons && spec.weapons[0]) ? spec.weapons[0].type : 'none'; }

  function makeFighter(spec, isPlayer) {
    const wtype = primaryWeapon(spec);
    const w = spec.weapons && spec.weapons[0];
    return {
      spec, isPlayer, wtype, prof: PROF[wtype] || PROF.none,
      wdmg: (w && w.damage) || 0,
      x: 0, y: 0, vx: 0, vy: 0, facing: isPlayer ? 1 : -1,
      hp: spec.maxHp, maxHp: spec.maxHp,
      energy: spec.energyMax, energyMax: spec.energyMax, regen: spec.energyRegen,
      moveSpeed: U.clamp(120 + spec.speedStat * 2.3, 120, 460),
      power: spec.power, armor: spec.armor, halfW: spec.radius * 1.15,
      atkCd: 0, atkActive: 0, atkHit: false, atkKind: 'hit',
      skillCd: 0, skillCost: 34,
      block: false, stun: 0, hitFlash: 0, moveInput: 0,
      anim: { t: 0, spin: 0, wheel: 0, hammer: 0, flip: 0, moving: false },
      aggr: spec.aggression != null ? spec.aggression : 0.6, arche: spec.archetype || 'allrounder', think: 0,
      damaged: false, lastActT: -1,
    };
  }

  function start(playerSpec, enemy, opts) {
    enemyDef = enemy; rewardRp = (opts && opts.rp) || 20;
    Z.fx.reset();
    P = makeFighter(playerSpec, true); E = makeFighter(Z.Bot.fromEnemy(enemy), false);
    // ramen buff (consumed)
    const buff = Z.state.takeBuff && Z.state.takeBuff();
    if (buff) { P.maxHp = Math.round(P.maxHp * (buff.hpMul || 1)); P.hp = P.maxHp; P.power = Math.round(P.power * (buff.powMul || 1)); Z.ui.toast('Ramen kicked in: ' + buff.name, 'gold'); }
    phase = 'intro'; t = 0; matchT = 0; introT = 0; endT = 0; result = null;
    crowd = null; crowdHype = 0;
    document.getElementById('bhpNameL').textContent = trunc(playerSpec.name, 12);
    document.getElementById('bhpNameR').textContent = trunc(enemy.name, 12);
    if (Z.audio) { Z.audio.startWhir(); }
    Z.ui.show('battle');
    announce('READY');
  }
  const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '.' : s);
  function announce(txt) { const el = document.getElementById('announce'); if (!el) return; el.textContent = txt; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }

  function layout() {
    const W = Z.render.W, H = Z.render.H;
    stage.groundY = H * 0.82; stage.left = W * 0.14; stage.right = W * 0.86;
    if (P.x === 0) { P.x = W * 0.36; E.x = W * 0.64; }
  }

  // ---------- update ----------
  function update(realDt) {
    if (phase === 'idle') return;
    t += realDt; layout();
    const dt = Z.fx.combatDt(realDt);
    [P, E].forEach((f) => { f.anim.t = t; f.anim.spin += (f.wtype === 'spinner' ? 20 : 6) * realDt; });
    opLeftPress = Math.max(0, opLeftPress - realDt * 3); opRightPress = Math.max(0, opRightPress - realDt * 3);
    crowdHype = Math.max(0, crowdHype - realDt);

    if (phase === 'intro') {
      introT += realDt;
      if (introT > 1.4) { phase = 'fight'; announce('FIGHT!'); Z.fx.screenFlash(0.3, PAL.amber); Z.audio.sfx.countdown(0); }
    } else if (phase === 'fight') {
      matchT += dt;
      // face each other
      P.facing = E.x >= P.x ? 1 : -1; E.facing = P.x >= E.x ? 1 : -1;
      // player input
      P.block = !!(Z.controls.held.block) && P.stun <= 0;
      P.moveInput = P.block ? 0 : Z.controls.dir;
      if (Z.controls.consumeAttack()) tryAttack(P, E);
      if (Z.controls.held.attack && P.atkCd <= 0) tryAttack(P, E);
      if (Z.controls.consumeSkill()) trySkill(P, E);
      ai(E, P, dt);
      integrate(P, dt); integrate(E, dt);
      resolveOverlap();
      swingHit(P, E, dt); swingHit(E, P, dt);
      cooldowns(P, dt); cooldowns(E, dt);
      checkEnd();
    } else if (phase === 'end') {
      endT += realDt; integrate(P, dt); integrate(E, dt); cooldowns(P, dt); cooldowns(E, dt);
      if (endT > 1.7) finish();
    }
    // whir intensity
    let whir = 0; [P, E].forEach((f) => { if (f.wtype === 'spinner') whir = Math.max(whir, 0.5); });
    Z.audio.setWhir(whir * 0.8);
    hud();
  }

  function integrate(f, dt) {
    // horizontal
    if (f.stun > 0) f.stun -= dt;
    const canMove = f.stun <= 0 && !f.block;
    if (canMove) f.vx += (f.moveInput * f.moveSpeed - f.vx) * Math.min(1, dt * 12);
    f.vx *= 1 / (1 + 6 * dt);
    f.x += f.vx * dt;
    f.anim.moving = canMove && Math.abs(f.moveInput) > 0.1;
    f.anim.wheel += (f.vx * dt) / 12;
    // vertical (launch pop)
    f.y += f.vy * dt; f.vy -= 1800 * dt;
    if (f.y <= 0) { if (f.vy < -60) { Z.fx.smoke(f.x, stage.groundY, '#3a3024', 2); Z.audio.sfx.hit(0.5); } f.y = 0; if (f.vy < 0) f.vy = 0; }
    // walls
    if (f.x < stage.left) { f.x = stage.left; if (f.vx < -160) { f.stun = Math.max(f.stun, 0.3); Z.fx.smoke(f.x, stage.groundY, '#3a3024', 3); Z.fx.addShake(2); } f.vx = 0; }
    if (f.x > stage.right) { f.x = stage.right; if (f.vx > 160) { f.stun = Math.max(f.stun, 0.3); Z.fx.smoke(f.x, stage.groundY, '#3a3024', 3); Z.fx.addShake(2); } f.vx = 0; }
    // energy regen
    f.energy = Math.min(f.energyMax, f.energy + f.regen * dt);
    if (f.hitFlash > 0) f.hitFlash -= dt;
    if (f.hp < f.maxHp * 0.45 && Math.random() < 0.6 * dt * 10 * dt) Z.fx.smoke(f.x - f.facing * 8, stage.groundY - f.spec.radius, '#2a241b', 1);
  }

  function resolveOverlap() {
    const min = P.halfW + E.halfW - 6; const dx = E.x - P.x; const d = Math.abs(dx) || 1;
    if (d < min) { const push = (min - d) / 2 * (dx < 0 ? -1 : 1); P.x -= push; E.x += push; }
  }

  function cooldowns(f, dt) {
    if (f.atkCd > 0) f.atkCd -= dt;
    if (f.skillCd > 0) f.skillCd -= dt;
    if (f.atkActive > 0) f.atkActive -= dt;
    if (f.anim.hammer > 0) f.anim.hammer = Math.max(0, f.anim.hammer - dt * 4);
    if (f.anim.flip > 0) f.anim.flip = Math.max(0, f.anim.flip - dt * 3);
  }

  function tryAttack(f, opp) {
    if (f.atkCd > 0 || f.stun > 0 || f.block) return;
    f.atkKind = 'hit'; f.atkCd = f.prof.cd; f.atkActive = f.prof.active; f.atkHit = false;
    f.energy = Math.max(0, f.energy - f.prof.ecost);
    if (f.wtype === 'hammer') f.anim.hammer = 1; if (f.wtype === 'flipper') f.anim.flip = 1;
    f.lastActT = t; if (f.isPlayer) opLeftPress = 1; else opRightPress = 1;
    if (f.wtype === 'hammer') Z.audio.sfx.hammer(); else if (f.wtype === 'flipper') Z.audio.sfx.flip(); else if (f.wtype === 'flamer') Z.audio.sfx.flame(); else Z.audio.sfx.boost();
  }
  function trySkill(f, opp) {
    if (f.skillCd > 0 || f.stun > 0 || f.block || f.energy < f.skillCost) { if (f.isPlayer && f.energy < f.skillCost) Z.audio.sfx.error(); return; }
    f.energy -= f.skillCost; f.skillCd = 3.5; f.atkKind = 'skill'; f.atkCd = f.prof.cd; f.atkActive = f.prof.active + 0.08; f.atkHit = false;
    f.vx += f.facing * 260; // lunge
    if (f.wtype === 'hammer') f.anim.hammer = 1; if (f.wtype === 'flipper') f.anim.flip = 1;
    f.lastActT = t; if (f.isPlayer) opLeftPress = 1; else opRightPress = 1;
    Z.fx.screenFlash(0.22, f.spec.accent); Z.audio.sfx.rank();
    Z.fx.sparks(f.x + f.facing * f.halfW, stage.groundY - f.spec.radius, f.facing > 0 ? 0 : Math.PI, 10, f.spec.accent, 0.8, 300);
  }

  function inRange(f, opp) {
    const reach = f.prof.reach + f.halfW + opp.halfW;
    const dx = (opp.x - f.x) * f.facing;   // positive => opp is in front
    return dx > 0 && dx < reach && Math.abs(opp.y - f.y) < f.spec.radius * 1.6;
  }
  function swingHit(f, opp, dt) {
    if (f.atkActive <= 0) return;
    const hittable = f.wtype === 'flamer' ? true : !f.atkHit;   // flamer multi-ticks
    if (!hittable) return;
    if (!inRange(f, opp)) return;
    const skill = f.atkKind === 'skill';
    let dmg = (f.wdmg * f.prof.dmgMul + 4 + f.power * 0.14);
    if (f.wtype === 'flamer') dmg *= dt * 8; else f.atkHit = true;
    if (skill) dmg *= 2.3;
    // block / armor
    const blocked = opp.block;
    dmg *= (1 - (opp.armor || 0) / 100) * (blocked ? 0.28 : 1);
    opp.hp -= dmg; if (opp.isPlayer) opp.damaged = true;
    // knockback + launch
    const kb = (f.prof.kb + (skill ? 220 : 0)) * (blocked ? 0.3 : 1);
    opp.vx += f.facing * kb;
    const launch = (f.prof.launch + (skill ? 160 : 0)) * (blocked ? 0.2 : 1);
    if (launch) opp.vy += launch;
    if (f.prof.hitstop || skill) opp.stun = Math.max(opp.stun, skill ? 0.35 : (f.wtype === 'hammer' || f.wtype === 'flipper' ? 0.25 : 0.06));
    opp.hitFlash = 0.12;
    // VFX
    const hx = (f.x + opp.x) / 2, hy = stage.groundY - f.spec.radius - 4;
    if (f.wtype === 'flamer') { Z.fx.flame(hx, hy, f.facing > 0 ? 0 : Math.PI, PAL.warn); }
    else {
      Z.fx.sparks(hx, hy, f.facing > 0 ? 0.4 : Math.PI - 0.4, blocked ? 4 : (skill ? 16 : 8), blocked ? PAL.teal : '#ffe6c0', 1.2, 260 + f.prof.kb);
      Z.fx.debris(hx, hy, skill ? 6 : 3, PAL.rust);
      Z.fx.damage(hx, hy - 10, dmg, blocked ? PAL.teal : f.spec.accent, skill || f.wtype === 'hammer');
    }
    const shk = (f.prof.shake + (skill ? 5 : 0)) * (Z.state.settings.shake ? 1 : 0.001);
    Z.fx.addShake(shk); if (f.prof.hitstop || skill) Z.fx.doHitstop(skill ? 0.1 : f.prof.hitstop);
    crowdHype = Math.min(1.4, crowdHype + (skill ? 0.9 : f.prof.shake * 0.12));
    Z.audio.sfx.hit(U.clamp(dmg / 26, 0.4, 2));
  }

  // ---------- AI ----------
  function ai(f, opp, dt) {
    f.think -= dt; const dx = opp.x - f.x, dist = Math.abs(dx), dir = dx < 0 ? -1 : 1;
    const reach = f.prof.reach + f.halfW + opp.halfW;
    f.block = false;
    if (f.stun > 0) { f.moveInput = 0; return; }
    // guard when the player is swinging close
    if (opp.atkActive > 0 && dist < reach + 24 && Math.random() < (f.arche === 'tank' ? 0.14 : 0.05)) { f.block = true; f.moveInput = 0; return; }
    const want = reach * 0.85;
    let move = 0;
    if (dist > want + 8) move = dir;
    else if (dist < want - 34 && (f.arche === 'sniper' || f.arche === 'trickster')) move = -dir;
    f.moveInput = move;
    if (dist <= reach + 8 && f.atkCd <= 0 && f.think <= 0) {
      if (f.skillCd <= 0 && f.energy >= f.skillCost && Math.random() < f.aggr * 0.4) trySkill(f, opp);
      else tryAttack(f, opp);
      f.think = U.rand(0.15, 0.7) * (1.5 - f.aggr);
    }
  }

  // ---------- end ----------
  function checkEnd() {
    if (result) return;
    if (P.hp <= 0 && E.hp <= 0) endMatch(P.hp >= E.hp ? 'win' : 'lose', { ko: true });
    else if (E.hp <= 0) endMatch('win', { ko: true });
    else if (P.hp <= 0) endMatch('lose', { ko: true });
    else if (matchT >= MATCH_TIME) endMatch(P.hp / P.maxHp >= E.hp / E.maxHp ? 'win' : 'lose', { timeout: true });
  }
  function endMatch(outcome, info) {
    if (result) return;
    result = Object.assign({ win: outcome === 'win', ko: false, timeout: false }, info);
    phase = 'end'; endT = 0;
    Z.fx.slowmo(0.3, 0.7); Z.fx.doHitstop(0.1); Z.fx.screenFlash(0.4, result.win ? PAL.amber : PAL.red);
    announce(info.ko ? (result.win ? 'K.O.!' : 'WRECKED') : (result.win ? 'WINNER' : 'YOU LOSE'));
    Z.audio.setWhir(0); Z.audio.sfx[result.win ? 'win' : 'lose']();
  }
  function finish() {
    phase = 'idle'; Z.audio.stopWhir();
    const win = result.win, en = enemyDef;
    const info = { ko: result.ko, timeout: result.timeout, ringOut: false, noDamage: win && !P.damaged };
    let credits = 0, rankUps = [];
    if (win) {
      Z.state.recordWin(info);
      const types = new Set((P.spec.weapons || []).map((w) => w.type).filter((x) => x && x !== 'none'));
      types.forEach((ty) => { Z.state.stats.winsByWeapon[ty] = (Z.state.stats.winsByWeapon[ty] || 0) + 1; });
      credits = en.purse + Math.round(en.purse * (info.ko ? 0.2 : 0));
      Z.state.addCredits(credits, true);
      const first = !Z.state.beaten[en.id]; Z.state.beaten[en.id] = true;
      const rp = rewardRp + (first ? Math.round(rewardRp * 0.5) : 0); result.rpGained = rp;
      rankUps = Z.game.awardRp(rp);
      if (en.isChampion && first) Z.game.onChampionDefeated();
    } else { Z.state.recordLoss(); Z.state.addScrap(6); }
    Z.state.persist(); Z.quests.check();
    showResult(win, en, credits, rankUps, info);
  }
  function showResult(win, en, credits, rankUps, info) {
    document.getElementById('resultBand').textContent = win ? (en.isChampion ? 'KING OF THE BLOCK' : 'WINNER') : 'YOU LOSE';
    document.getElementById('resultBand').className = 'result-band ' + (win ? 'win' : 'lose');
    const rows = [];
    rows.push(['RESULT', info.ko ? 'Knockout' : 'Time — judges']);
    if (win) { rows.push(['PURSE', '+' + U.fmt(credits)]); rows.push(['RANK PTS', '+' + (result.rpGained || rewardRp)]); if (info.noDamage) rows.push(['CLEAN', 'No damage!']); rows.push(['THEM', '"' + en.defeatLine + '"']); }
    else { rows.push(['SALVAGE', '+6 scrap']); rows.push(['THEM', '"' + en.taunt + '"']); }
    let html = rows.map((r) => `<div class="rrow"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
    if (rankUps && rankUps.length) html += `<div class="rrow"><span>RANK UP</span><b style="color:var(--amber)">${rankUps.map((r) => r.name).join(' > ')}</b></div>`;
    document.getElementById('resultBody').innerHTML = html;
    Z.ui.show('result');
  }

  // ---------- render ----------
  function render() {
    const ctx = Z.render.ctx, W = Z.render.W, H = Z.render.H;
    layout(); if (!crowd) buildCrowd(W);
    // backdrop
    if (!Z.assets.draw(ctx, 'battle.bg', 0, 0, W, H, false)) {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1a130c'); g.addColorStop(1, '#0c0805'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // strung lamps
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 8; i++) { const lx = (i + 0.5) * W / 8, ly = H * 0.16 + Math.sin(i) * 8; const gr = ctx.createRadialGradient(lx, ly, 2, lx, ly, 80); gr.addColorStop(0, U.rgba(PAL.amber, 0.5)); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(lx - 80, ly - 80, 160, 160); }
      ctx.restore();
    }
    drawCrowd(ctx, W, H);
    // floor
    if (!Z.assets.draw(ctx, 'battle.floor', 0, stage.groundY, W, H - stage.groundY, false)) {
      ctx.fillStyle = '#2b2419'; ctx.fillRect(0, stage.groundY, W, H - stage.groundY);
      ctx.fillStyle = '#1c160e'; ctx.fillRect(0, stage.groundY, W, 5);
      ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 2;
      for (let x = 40; x < W; x += 90) { ctx.beginPath(); ctx.moveTo(x, stage.groundY + 10); ctx.lineTo(x - 24, H); ctx.stroke(); }
      // ring rope / barrier
      ctx.strokeStyle = U.rgba(PAL.amber, 0.5); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(stage.left - 20, stage.groundY); ctx.lineTo(stage.left - 20, stage.groundY - 40); ctx.moveTo(stage.right + 20, stage.groundY); ctx.lineTo(stage.right + 20, stage.groundY - 40); ctx.stroke();
    }

    // shake transform
    ctx.save();
    const sx = Z.state.settings.shake ? Z.fx.shakeX : 0, sy = Z.state.settings.shake ? Z.fx.shakeY : 0;
    ctx.translate(sx, sy);

    // operators at the edges, holding controllers
    drawOperator(ctx, stage.left - 60, stage.groundY, 1, PAL.rust, opLeftPress, 'YOU');
    drawOperator(ctx, stage.right + 60, stage.groundY, -1, enemyDef ? enemyDef.color : PAL.red, opRightPress, '');

    // bots
    Z.render.drawBotSide(E.x, stage.groundY - E.y, E.facing, E.spec, E.anim, { hpFrac: E.hp / E.maxHp, flash: E.hitFlash > 0 ? E.hitFlash / 0.12 * 0.8 : 0 });
    Z.render.drawBotSide(P.x, stage.groundY - P.y, P.facing, P.spec, P.anim, { hpFrac: P.hp / P.maxHp, flash: P.hitFlash > 0 ? P.hitFlash / 0.12 * 0.8 : 0 });
    // block guards
    [P, E].forEach((f) => { if (f.block) { ctx.strokeStyle = U.rgba(PAL.teal, 0.8); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x + f.facing * f.halfW, stage.groundY - f.spec.radius, f.spec.radius * 1.1, -1, 1); ctx.stroke(); } });

    Z.fx.render(ctx);
    ctx.restore();
  }

  function buildCrowd(W) { crowd = []; for (let x = 10; x < W - 10; x += 22) crowd.push({ x, h: U.rand(20, 34), c: U.choice(['#2a2118', '#241d15', '#30281c', '#1f1913']), ph: U.rand(0, 6.28), arm: Math.random() < 0.5 }); }
  function drawCrowd(ctx, W, H) {
    if (Z.assets.draw(ctx, 'battle.crowd', 0, H * 0.42, W, H * 0.34, false)) return;
    const base = H * 0.66;
    for (const p of crowd) {
      const bob = Math.sin(t * (2 + crowdHype * 4) + p.ph) * (2 + crowdHype * 6);
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x, base - p.h + bob, 16, p.h);                         // body
      ctx.fillStyle = '#0f0b07'; ctx.fillRect(p.x + 3, base - p.h - 10 + bob, 10, 10); // head
      if (p.arm && crowdHype > 0.5) { ctx.fillStyle = p.c; ctx.fillRect(p.x + 5, base - p.h - 22 + bob, 4, 12); } // raised arm
    }
    // haze over crowd
    const g = ctx.createLinearGradient(0, H * 0.42, 0, base); g.addColorStop(0, 'rgba(12,8,5,.6)'); g.addColorStop(1, 'rgba(12,8,5,0)'); ctx.fillStyle = g; ctx.fillRect(0, H * 0.42, W, base - H * 0.42);
  }

  function drawOperator(ctx, x, groundY, face, col, press, tag) {
    if ((face > 0 && Z.assets.draw(ctx, 'op.left', x - 30, groundY - 80, 60, 80, false)) ||
        (face < 0 && Z.assets.draw(ctx, 'op.right', x - 30, groundY - 80, 60, 80, false))) return;
    ctx.save(); ctx.translate(x, 0); ctx.scale(face, 1);
    ctx.fillStyle = '#000'; ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.ellipse(0, groundY, 20, 5, 0, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = col; ctx.fillRect(-11, groundY - 46, 22, 30);                 // body
    ctx.fillStyle = '#e9d8bf'; ctx.fillRect(-8, groundY - 62, 16, 16);            // head
    ctx.fillStyle = '#3a2e1e'; ctx.fillRect(-9, groundY - 64, 18, 6);             // cap
    // arms out front holding controller (jitter when pressing)
    const j = press > 0 ? Math.sin(t * 40) * 2 : 0;
    ctx.fillStyle = col; ctx.fillRect(4, groundY - 40, 12, 6);
    ctx.fillStyle = '#15100a'; ctx.fillRect(15, groundY - 44 + j, 14, 9);          // controller
    ctx.fillStyle = press > 0 ? PAL.amber : '#3a3024'; ctx.fillRect(17, groundY - 42 + j, 3, 3); ctx.fillRect(24, groundY - 42 + j, 3, 3);
    ctx.restore();
    if (tag) Z.render.pxText(ctx, tag, x, groundY - 88, 8, PAL.dim, 'center');
  }

  function hud() {
    if (!P || !E) return;
    setBar('bhpL', P.hp / P.maxHp); setBar('bhpR', E.hp / E.maxHp);
    setBar('benL', P.energy / P.energyMax); setBar('benR', E.energy / E.energyMax);
    const left = Math.max(0, Math.ceil(MATCH_TIME - matchT)); const el = document.getElementById('bTimer');
    if (el) { el.textContent = left; el.classList.toggle('low', left <= 10 && phase === 'fight'); }
  }
  function setBar(id, f) { const e = document.getElementById(id); if (e) e.style.width = U.clamp(f, 0, 1) * 100 + '%'; }

  return { start, update, render, get active() { return phase !== 'idle'; } };
})();
