/* ================================================================
   combat.js — THE DOHYO. Side-view spirit-puppet duels at the
   burning shrine. Yokai puppeteers channel spirit strings into
   humanoid wood-and-rune puppets. Move, JUMP, HIT, SKILL, BLOCK.
   Missions run in WAVES with a crew partner supporting you.
   ================================================================ */
Z.combat = (function () {
  const U = Z.util, D = Z.data, PAL = Z.data.PAL;
  const MATCH_TIME = 60;
  const GOLD = '#ffd98a', SPIRIT = '#8fe6cf';
  let P = null, E = null, enemyDef = null, rewardRp = 20;
  let phase = 'idle', t = 0, matchT = 0, introT = 0, endT = 0, result = null;
  let stage = { groundY: 0, left: 0, right: 0 };
  let opLeftPress = 0, opRightPress = 0, crowdHype = 0;
  let spirits = null;                    // floating spectator wisps
  let mission = null, waveIdx = 0, partner = null;
  let comboN = 0, comboT = 0;
  let finisherFired = false, soul = null;

  const PROF = {
    spinner: { reach: 34, dmgMul: 0.55, cd: 0.18, kb: 70, active: 0.16, ecost: 2, hitstop: 0.02, shake: 1.4, launch: 0 },
    blade:   { reach: 56, dmgMul: 1.0,  cd: 0.5,  kb: 150, active: 0.16, ecost: 3, hitstop: 0.05, shake: 2.4, launch: 0 },
    hammer:  { reach: 58, dmgMul: 1.5,  cd: 0.95, kb: 320, active: 0.2,  ecost: 6, hitstop: 0.1,  shake: 7,   launch: 140 },
    flipper: { reach: 48, dmgMul: 0.8,  cd: 1.0,  kb: 300, active: 0.2,  ecost: 6, hitstop: 0.07, shake: 4,   launch: 430 },
    flamer:  { reach: 82, dmgMul: 0.42, cd: 0.28, kb: 24,  active: 0.22, ecost: 4, hitstop: 0,    shake: 1,   launch: 0 },
    none:    { reach: 42, dmgMul: 0.6,  cd: 0.55, kb: 130, active: 0.16, ecost: 1, hitstop: 0.03, shake: 1.6, launch: 0 },
  };
  const primaryWeapon = (spec) => (spec.weapons && spec.weapons[0]) ? spec.weapons[0].type : 'none';

  function makeFighter(spec, isPlayer) {
    const wtype = primaryWeapon(spec), w = spec.weapons && spec.weapons[0];
    return {
      spec, isPlayer, wtype, prof: PROF[wtype] || PROF.none,
      wdmg: (w && w.damage) || 0,
      x: 0, y: 0, vx: 0, vy: 0, facing: isPlayer ? 1 : -1,
      hp: spec.maxHp, maxHp: spec.maxHp,
      energy: spec.energyMax, energyMax: spec.energyMax, regen: spec.energyRegen,
      moveSpeed: U.clamp(120 + spec.speedStat * 2.3, 120, 460),
      power: spec.power, armor: spec.armor, halfW: spec.radius * 1.15,
      atkCd: 0, atkActive: 0, atkHit: false, atkKind: 'hit', atkAnim: 0,
      skillCd: 0, skillCost: 34,
      block: false, blockT0: -9, stun: 0, hitFlash: 0, moveInput: 0, dashT: 0,
      jumps: 0, turn: 0, diving: false,
      anim: { t: 0, spin: 0, wheel: 0, hammer: 0, flip: 0, moving: false, attackT: 0 },
      aggr: spec.aggression != null ? spec.aggression : 0.6, arche: spec.archetype || 'allrounder', think: 0,
      damaged: false,
    };
  }

  // opts: { rp, mission: {def, partner} }
  function start(playerSpec, enemy, opts) {
    opts = opts || {};
    enemyDef = enemy; rewardRp = opts.rp || 20;
    mission = opts.mission || null; waveIdx = 0;
    partner = mission && mission.partner ? D.crewById(mission.partner) : null;
    Z.fx.reset();
    P = makeFighter(playerSpec, true); E = makeFighter(Z.Bot.fromEnemy(enemy), false);
    const buff = Z.state.takeBuff && Z.state.takeBuff();
    if (buff) { P.maxHp = Math.round(P.maxHp * (buff.hpMul || 1)); P.hp = P.maxHp; P.power = Math.round(P.power * (buff.powMul || 1)); Z.ui.toast('Snack power: ' + buff.name, 'gold'); }
    // partner passive on entry
    if (partner) {
      const r = Z.state.friendRank(partner.id);
      if (partner.id === 'kappa') { P.maxHp = Math.round(P.maxHp * (1 + 0.04 * r)); P.hp = P.maxHp; }
      if (partner.id === 'oni') P.armor = Math.min(70, P.armor + 3 * r);
      if (partner.id === 'tengu') P.power = Math.round(P.power * (1 + 0.05 * r));
    }
    phase = 'intro'; t = 0; matchT = 0; introT = 0; endT = 0; result = null;
    spirits = null; crowdHype = 0; comboN = 0; comboT = 0; finisherFired = false; soul = null;
    document.getElementById('bhpNameL').textContent = trunc(playerSpec.name, 12);
    document.getElementById('bhpNameR').textContent = trunc(enemy.name, 14);
    Z.audio.startWhir(); Z.ui.show('battle');
    announce(mission ? 'WAVE 1' : 'READY');
    if (partner && partner.banter) Z.ui.toast(partner.name + ': "' + U.choice(partner.banter) + '"');
  }
  const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '.' : s);
  function announce(txt, opts) { Z.fx.bigText(txt, Object.assign({ color: '#fff7ea', size: 46, ring: true, ringColor: GOLD, y: 0.36 }, opts || {})); }

  function layout() {
    const W = Z.render.W, H = Z.render.H;
    stage.groundY = H * 0.8; stage.left = W * 0.15; stage.right = W * 0.85;
    if (P.x === 0) { P.x = W * 0.37; E.x = W * 0.63; }
  }

  // ---------- update ----------
  function update(realDt) {
    if (phase === 'idle') return;
    t += realDt; layout();
    const dt = Z.fx.combatDt(realDt);
    [P, E].forEach((f) => {
      f.anim.t = t; f.anim.spin += (f.wtype === 'spinner' ? 18 : 5) * realDt;
      f.anim.attackT = f.atkAnim; if (f.atkAnim > 0) f.atkAnim -= realDt * 3.4;
      if (f.turn > 0) f.turn -= realDt * 5;
    });
    opLeftPress = Math.max(0, opLeftPress - realDt * 3); opRightPress = Math.max(0, opRightPress - realDt * 3);
    crowdHype = Math.max(0, crowdHype - realDt);

    if (phase === 'intro') {
      introT += realDt;
      if (introT > 1.4) {
        phase = 'fight'; announce('SCRAP!', { size: 60, color: GOLD });
        Z.fx.screenFlash(0.35, GOLD); Z.fx.speedLines(0.3, GOLD); Z.fx.zoom(0.1, 0.4);
        Z.fx.transmute((P.x + E.x) / 2, stage.groundY - 30, 90, GOLD, 0.8);
        Z.audio.sfx.countdown(0);
      }
    } else if (phase === 'fight') {
      matchT += dt;
      if (comboT > 0) { comboT -= dt; if (comboT <= 0) comboN = 0; }
      P.facing = E.x >= P.x ? 1 : -1; E.facing = P.x >= E.x ? 1 : -1;
      const wasBlock = P.block;
      P.block = !!(Z.controls.held.block) && P.stun <= 0;
      if (P.block && !wasBlock) P.blockT0 = t;
      const mi = P.block ? 0 : Z.controls.dir;
      if (mi && Math.sign(mi) !== Math.sign(P.moveInput || mi)) P.turn = 1;
      P.moveInput = mi;
      if (Z.controls.consumeJump()) tryJump(P);
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
      if (endT > 1.6) finish();
    } else if (phase === 'wave') {
      endT += realDt; integrate(P, dt); cooldowns(P, dt);
      if (endT > 1.2) nextWave();
    }
    let whir = 0; [P, E].forEach((f) => { if (f && f.wtype === 'spinner') whir = Math.max(whir, 0.5); });
    Z.audio.setWhir(whir * 0.8);
    hud();
  }

  function tryJump(f) {
    if (f.stun > 0 || f.block) return;
    if (f.y <= 0) {
      f.vy = 620; f.jumps = 1;
      Z.fx.dust(f.x, stage.groundY, 5, '#cbb489'); Z.audio.sfx.flip();
      if (f.isPlayer) opLeftPress = 1;
    }
  }

  function integrate(f, dt) {
    if (!f) return;
    if (f.stun > 0) f.stun -= dt;
    const canMove = f.stun <= 0 && !f.block;
    if (canMove) f.vx += (f.moveInput * f.moveSpeed - f.vx) * Math.min(1, dt * 12);
    f.vx *= 1 / (1 + 6 * dt);
    f.x += f.vx * dt;
    f.anim.moving = canMove && Math.abs(f.moveInput) > 0.1 && f.y <= 0;
    f.anim.wheel += Math.abs(f.vx) * dt / 26 * (f.moveInput >= 0 ? 1 : 1);
    if (f.dashT > 0) f.dashT -= dt;
    if (f.anim.moving && Math.random() < 0.2) Z.fx.dust(f.x - f.facing * f.halfW * 0.5, stage.groundY, 1, '#cbb489');
    // vertical
    f.y += f.vy * dt; f.vy -= 1900 * dt;
    if (f.y <= 0) {
      if (f.diving) {
        f.diving = false;
        const opp = f.isPlayer ? E : P;
        Z.fx.shockwave(f.x, stage.groundY - 8, GOLD, 150); Z.fx.dust(f.x, stage.groundY, 12, '#cbb489');
        Z.fx.addShake(6 * (Z.state.settings.shake ? 1 : 0.001)); Z.fx.doHitstop(0.07); Z.audio.sfx.hammer();
        if (opp && opp.y <= 20 && Math.abs(opp.x - f.x) < f.prof.reach + f.halfW + opp.halfW + 26) {
          let dmg = (f.wdmg * 0.9 + 6 + f.power * 0.16) * (1 - (opp.armor || 0) / 100) * (opp.block ? 0.35 : 1);
          opp.hp -= dmg; if (opp.isPlayer) opp.damaged = true;
          opp.vy += 360; opp.vx += f.facing * 220; opp.stun = Math.max(opp.stun, 0.3); opp.hitFlash = 0.12;
          maybeFinish(f, opp, 0);
          Z.fx.damage(opp.x, stage.groundY - opp.y - 90, dmg, GOLD, true);
          if (f.isPlayer) Z.fx.bigText('SLAM!', { color: GOLD, size: 26, ring: false, y: 0.22, dur: 0.7 });
          crowdHype = Math.min(1.4, crowdHype + 0.6);
        }
      } else if (f.vy < -80) { Z.fx.dust(f.x, stage.groundY, 6, '#cbb489'); Z.fx.addShake(1.6); f.landSquash = 0.3; Z.audio.sfx.hit(0.5); }
      f.y = 0; if (f.vy < 0) f.vy = 0;
    }
    if (f.landSquash > 0) f.landSquash -= dt * 2;
    if (f.x < stage.left) { f.x = stage.left; if (f.vx < -160) { f.stun = Math.max(f.stun, 0.3); Z.fx.dust(f.x, stage.groundY, 4, '#cbb489'); Z.fx.addShake(2); } f.vx = 0; }
    if (f.x > stage.right) { f.x = stage.right; if (f.vx > 160) { f.stun = Math.max(f.stun, 0.3); Z.fx.dust(f.x, stage.groundY, 4, '#cbb489'); Z.fx.addShake(2); } f.vx = 0; }
    f.energy = Math.min(f.energyMax, f.energy + f.regen * dt);
    if (f.hitFlash > 0) f.hitFlash -= dt;
    if (f.hp < f.maxHp * 0.4 && Math.random() < dt * 4) Z.fx.smoke(f.x, stage.groundY - f.spec.radius * 1.4, '#5a4a35', 1);
  }

  function resolveOverlap() {
    if (!E) return;
    if (Math.abs(P.y - E.y) > 40) return;    // jumping over is allowed
    const min = P.halfW + E.halfW - 4; const dx = E.x - P.x; const d = Math.abs(dx) || 1;
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
    if (!opp || f.atkCd > 0 || f.stun > 0 || f.block) return;
    if (f.y > 26 && !f.diving) {           // aerial: dive slam
      f.diving = true; f.vy = -980; f.vx += f.facing * 170;
      Z.fx.speedLines(0.18, GOLD); Z.audio.sfx.boost();
      if (f.isPlayer) opLeftPress = 1; else opRightPress = 1;
      return;
    }
    f.atkKind = 'hit'; f.atkCd = f.prof.cd; f.atkActive = f.prof.active; f.atkHit = false; f.atkAnim = 1;
    f.energy = Math.max(0, f.energy - f.prof.ecost);
    if (f.wtype === 'hammer') f.anim.hammer = 1; if (f.wtype === 'flipper') f.anim.flip = 1;
    if (f.isPlayer) opLeftPress = 1; else opRightPress = 1;
    if (f.wtype === 'hammer') Z.audio.sfx.hammer(); else if (f.wtype === 'flipper') Z.audio.sfx.flip(); else if (f.wtype === 'flamer') Z.audio.sfx.flame(); else Z.audio.sfx.boost();
  }
  function trySkill(f, opp) {
    if (!opp || f.skillCd > 0 || f.stun > 0 || f.block || f.energy < f.skillCost) { if (f.isPlayer && f.energy < f.skillCost) Z.audio.sfx.error(); return; }
    f.energy -= f.skillCost; f.skillCd = 3.5; f.atkKind = 'skill'; f.atkCd = f.prof.cd; f.atkActive = f.prof.active + 0.08; f.atkHit = false; f.atkAnim = 1;
    f.vx += f.facing * 280; f.dashT = 0.22;
    if (f.wtype === 'hammer') f.anim.hammer = 1; if (f.wtype === 'flipper') f.anim.flip = 1;
    if (f.isPlayer) opLeftPress = 1; else opRightPress = 1;
    const tx = f.x + f.facing * 34, ty = stage.groundY - f.spec.radius;
    Z.fx.transmute(tx, ty, 74, f.isPlayer ? SPIRIT : '#ff9d7a', 0.8);
    Z.fx.speedLines(0.28, SPIRIT); Z.fx.zoom(0.09, 0.36); Z.fx.screenFlash(0.28, SPIRIT);
    if (f.isPlayer) Z.fx.bigText('SPIRIT BURST', { color: SPIRIT, size: 26, ring: false, y: 0.24, dur: 0.9 });
    Z.fx.sparks(tx, ty, f.facing > 0 ? 0 : Math.PI, 12, SPIRIT, 0.8, 320);
    Z.audio.sfx.rank();
  }

  function inRange(f, opp) {
    const reach = f.prof.reach + f.halfW + opp.halfW;
    const dx = (opp.x - f.x) * f.facing;
    return dx > 0 && dx < reach && Math.abs(opp.y - f.y) < f.spec.radius * 1.5;
  }
  function swingHit(f, opp, dt) {
    if (!opp || f.atkActive <= 0) return;
    const hittable = f.wtype === 'flamer' ? true : !f.atkHit;
    if (!hittable || !inRange(f, opp)) return;
    const skill = f.atkKind === 'skill';
    const blocked = opp.block;
    // PERFECT PARRY: block raised within the last 0.2s deflects everything
    if (blocked && f.wtype !== 'flamer' && (t - opp.blockT0) < 0.2) {
      f.atkHit = true;
      f.stun = Math.max(f.stun, 0.6); f.vx -= f.facing * 300; f.hitFlash = 0.1;
      opp.energy = Math.min(opp.energyMax, opp.energy + 16);
      const px = opp.x + opp.facing * opp.halfW, py = stage.groundY - opp.y - opp.spec.radius * 1.6;
      Z.fx.ring(px, py, SPIRIT, 6, 90, 0.34); Z.fx.sparks(px, py, -Math.PI / 2, 14, SPIRIT, 1.4, 340);
      Z.fx.doHitstop(0.1); Z.fx.addShake(3 * (Z.state.settings.shake ? 1 : 0.001));
      Z.fx.bigText('PARRY!', { color: SPIRIT, size: 30, ring: false, y: 0.24, dur: 0.8 });
      Z.audio.sfx.rank();
      crowdHype = Math.min(1.4, crowdHype + 0.7);
      return;
    }
    let dmg = (f.wdmg * f.prof.dmgMul + 4 + f.power * 0.14);
    if (f.wtype === 'flamer') dmg *= dt * 8; else f.atkHit = true;
    if (skill) dmg *= 2.3;
    // COUNTER: catching them mid-swing hits harder
    let countered = false;
    if (!blocked && opp.atkActive > 0 && f.wtype !== 'flamer') { dmg *= 1.35; countered = true; }
    dmg *= (1 - (opp.armor || 0) / 100) * (blocked ? 0.28 : 1);
    maybeFinish(f, opp, dmg);
    opp.hp -= dmg; if (opp.isPlayer) opp.damaged = true;
    if (!blocked && f.wtype !== 'flamer') f.energy = Math.min(f.energyMax, f.energy + 3);   // aggression pays
    const kb = (f.prof.kb + (skill ? 220 : 0)) * (blocked ? 0.3 : 1);
    opp.vx += f.facing * kb;
    const launch = (f.prof.launch + (skill ? 160 : 0)) * (blocked ? 0.2 : 1);
    if (launch) opp.vy += launch;
    if (f.prof.hitstop || skill) opp.stun = Math.max(opp.stun, skill ? 0.35 : (f.wtype === 'hammer' || f.wtype === 'flipper' ? 0.25 : 0.06));
    opp.hitFlash = 0.12;
    const hx = (f.x + opp.x) / 2, hy = stage.groundY - opp.y - f.spec.radius - 6;
    if (f.wtype === 'flamer') Z.fx.flame(hx, hy, f.facing > 0 ? 0 : Math.PI, PAL.warn);
    else {
      Z.fx.sparks(hx, hy, f.facing > 0 ? 0.4 : Math.PI - 0.4, blocked ? 4 : (skill ? 16 : 8), blocked ? SPIRIT : '#ffe6b0', 1.2, 260 + f.prof.kb);
      Z.fx.debris(hx, hy, skill ? 6 : 3, '#a9805a');
      Z.fx.damage(hx, hy - 10, dmg, blocked ? SPIRIT : (skill ? SPIRIT : '#ffd98a'), skill || f.wtype === 'hammer');
    }
    if (skill && !blocked) { Z.fx.lightning(f.x + f.facing * f.halfW, hy, opp.x, hy, SPIRIT); Z.fx.impact(hx, hy, SPIRIT); Z.fx.shockwave(hx, hy, SPIRIT, 160); Z.fx.transmute(opp.x, hy, 52, SPIRIT, 0.55); }
    else if (f.wtype === 'hammer' && !blocked) { Z.fx.impact(hx, hy, GOLD); Z.fx.shockwave(hx, hy, GOLD, 110); }
    if (countered) Z.fx.damage(hx, hy - 34, 0, GOLD, false), Z.fx.popText(hx, hy - 34, 'COUNTER', GOLD);
    if (!blocked && f.wtype !== 'flamer') {
      if (f.isPlayer) { comboN++; comboT = 1.3; if ([3, 5, 8, 12, 18].includes(comboN)) Z.fx.bigText(comboN + ' HIT COMBO', { color: GOLD, size: 22, ring: false, y: 0.17, dur: 0.8 }); }
      else { comboN = 0; comboT = 0; }
    }
    const shk = (f.prof.shake + (skill ? 5 : 0)) * (Z.state.settings.shake ? 1 : 0.001);
    Z.fx.addShake(shk); if (f.prof.hitstop || skill) Z.fx.doHitstop(skill ? 0.1 : f.prof.hitstop);
    crowdHype = Math.min(1.4, crowdHype + (skill ? 0.9 : f.prof.shake * 0.12));
    Z.audio.sfx.hit(U.clamp(dmg / 26, 0.4, 2));
  }

  // FINISH! — cinematic beat when a hit is about to break the puppet
  function maybeFinish(f, opp, dmg) {
    if (finisherFired || !opp || opp.hp - dmg > 0) return;
    finisherFired = true;
    Z.fx.slowmo(0.16, 0.9); Z.fx.zoom(0.2, 0.9); Z.fx.doHitstop(0.14);
    Z.fx.screenFlash(0.5, '#fff7ea'); Z.fx.speedLines(0.6, GOLD);
    Z.fx.bigText('FINISH!', { color: '#fff7ea', size: 58, ring: true, ringColor: GOLD, y: 0.36, dur: 1.2 });
    const gx = opp.x, gy = stage.groundY - opp.y - opp.spec.radius * 1.6;
    Z.fx.confetti(gx, gy - 30, 30); Z.fx.debris(gx, gy, 16, '#8b8fa3'); Z.fx.shockwave(gx, gy, GOLD, 220);
    soul = { x: gx, born: t };
    crowdHype = 1.4;
  }

  // ---------- AI ----------
  function ai(f, opp, dt) {
    if (!f || phase !== 'fight') return;
    f.think -= dt; const dx = opp.x - f.x, dist = Math.abs(dx), dir = dx < 0 ? -1 : 1;
    const reach = f.prof.reach + f.halfW + opp.halfW;
    f.block = false;
    if (f.stun > 0) { f.moveInput = 0; return; }
    if (opp.atkActive > 0 && dist < reach + 24 && Math.random() < (f.arche === 'tank' ? 0.14 : 0.05)) { if (!f.block) f.blockT0 = t; f.block = true; f.moveInput = 0; return; }
    // cheeky cross-up hop over the player
    if (f.y <= 0 && dist < reach * 0.9 && Math.random() < 0.008 + f.aggr * 0.006) { f.vy = 700; f.vx += dir * 260; Z.fx.dust(f.x, stage.groundY, 3, '#cbb489'); }
    // hop sometimes to dodge or close in (goofy)
    if (f.y <= 0 && f.think <= 0 && Math.random() < 0.05 + f.aggr * 0.04) { f.vy = 560; Z.fx.dust(f.x, stage.groundY, 3, '#cbb489'); }
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

  // ---------- waves / end ----------
  function checkEnd() {
    if (result || phase !== 'fight') return;
    if (E.hp <= 0) {
      // mission with more waves?
      if (mission && waveIdx < mission.def.waves.length - 1) {
        phase = 'wave'; endT = 0;
        Z.fx.slowmo(0.35, 0.5); Z.fx.screenFlash(0.35, GOLD);
        Z.fx.transmute(E.x, stage.groundY - E.spec.radius, 70, '#ff9d7a', 0.7);
        Z.fx.debris(E.x, stage.groundY - 30, 14, '#8b8fa3');
        announce('WAVE ' + (waveIdx + 1) + ' CLEAR', { size: 40 });
        E = null;
        return;
      }
      endMatch('win', { ko: true }); return;
    }
    if (P.hp <= 0) { endMatch('lose', { ko: true }); return; }
    if (matchT >= MATCH_TIME) endMatch(P.hp / P.maxHp >= E.hp / E.maxHp ? 'win' : 'lose', { timeout: true });
  }
  function nextWave() {
    waveIdx++;
    const en = D.enemyById(mission.def.waves[waveIdx]);
    E = makeFighter(Z.Bot.fromEnemy(en), false);
    E.x = Z.render.W * 0.72; enemyDef = en;
    document.getElementById('bhpNameR').textContent = trunc(en.name, 14);
    // kappa river blessing: repair between waves
    if (partner && partner.id === 'kappa') {
      const r = Z.state.friendRank(partner.id);
      const heal = Math.round(P.maxHp * 0.08 * r);
      P.hp = Math.min(P.maxHp, P.hp + heal);
      Z.fx.damage(P.x, stage.groundY - 80, heal, SPIRIT, true);
      Z.fx.transmute(P.x, stage.groundY - P.spec.radius, 60, SPIRIT, 0.7);
      Z.ui.toast(partner.name + ' patches your puppet (+' + heal + ')', 'gold');
    } else if (partner) { P.hp = Math.min(P.maxHp, P.hp + Math.round(P.maxHp * 0.04)); }
    matchT = Math.max(0, matchT - 20);     // bonus time per wave
    finisherFired = false; soul = null;
    phase = 'fight';
    announce('WAVE ' + (waveIdx + 1), { size: 52 });
    if (partner && partner.banter) Z.ui.toast(partner.name + ': "' + U.choice(partner.banter) + '"');
    Z.fx.screenFlash(0.3, '#ff9d7a'); Z.fx.speedLines(0.25, GOLD);
  }
  function endMatch(outcome, info) {
    if (result) return;
    result = Object.assign({ win: outcome === 'win', ko: false, timeout: false }, info);
    phase = 'end'; endT = 0;
    Z.fx.slowmo(0.3, 0.7); Z.fx.doHitstop(0.12); Z.fx.screenFlash(0.42, result.win ? GOLD : PAL.red);
    Z.fx.speedLines(0.45, result.win ? GOLD : PAL.red); Z.fx.zoom(0.15, 0.7);
    if (result.win && E) { Z.fx.transmute(E.x, stage.groundY - E.spec.radius, 90, '#ff9d7a', 1); Z.fx.debris(E.x, stage.groundY - 40, 18, '#8b8fa3'); }
    announce(info.ko ? (result.win ? 'BANISHED!' : 'BROKEN...') : (result.win ? 'WINNER' : 'TIME UP'), { size: 62 });
    Z.audio.setWhir(0); Z.audio.sfx[result.win ? 'win' : 'lose']();
  }
  function finish() {
    phase = 'idle'; Z.audio.stopWhir();
    const win = result.win, en = enemyDef;
    const info = { ko: result.ko, timeout: result.timeout, ringOut: false, noDamage: win && !P.damaged };
    let credits = 0, rankUps = [], friendUp = 0, restoredName = null;
    if (win) {
      Z.state.recordWin(info);
      const types = new Set((P.spec.weapons || []).map((w) => w.type).filter((x) => x && x !== 'none'));
      types.forEach((ty) => { Z.state.stats.winsByWeapon[ty] = (Z.state.stats.winsByWeapon[ty] || 0) + 1; });
      if (mission) {
        credits = mission.def.rewardCredits;
        Z.state.addCredits(credits, true);
        rankUps = Z.game.awardRp(mission.def.rewardRp); result.rpGained = mission.def.rewardRp;
        Z.state.missionsDone[mission.def.id] = true;
        const dist = D.districtById(mission.def.district);
        if (dist && !Z.state.restored[dist.id]) { Z.state.restored[dist.id] = true; restoredName = dist.name; }
        if (partner) { friendUp = Z.state.addFriendXp(partner.id, 15); }
        mission.def.waves.forEach((wid) => { Z.state.beaten[wid] = true; });
      } else {
        credits = en.purse + Math.round(en.purse * (info.ko ? 0.2 : 0));
        Z.state.addCredits(credits, true);
        const first = !Z.state.beaten[en.id]; Z.state.beaten[en.id] = true;
        const rp = rewardRp + (first ? Math.round(rewardRp * 0.5) : 0); result.rpGained = rp;
        rankUps = Z.game.awardRp(rp);
        if (en.isChampion && first) Z.game.onChampionDefeated();
      }
    } else { Z.state.recordLoss(); Z.state.addScrap(6); }
    Z.state.persist(); Z.quests.check();
    showResult(win, en, credits, rankUps, info, friendUp, restoredName);
  }
  function showResult(win, en, credits, rankUps, info, friendUp, restoredName) {
    const isM = !!mission;
    document.getElementById('resultBand').textContent = win ? (isM ? 'PLACE RESTORED' : (en.isChampion ? 'GRAND CHAMPION' : 'WINNER')) : 'DEFEAT';
    document.getElementById('resultBand').className = 'result-band ' + (win ? 'win' : 'lose');
    const rows = [];
    if (win && isM) {
      rows.push(['REQUEST', mission.def.title]);
      if (restoredName) rows.push(['RESTORED', restoredName]);
      rows.push(['PAY', '+' + U.fmt(credits)]);
      rows.push(['RANK', '+' + (result.rpGained || 0) + ' pts']);
      if (partner) rows.push([partner.name, friendUp ? 'Friendship rank up! (' + '#'.repeat ? 'Rank ' + friendUp : '' : '"' + (partner.winLine || 'Nice one.') + '"']);
      rows.push(['CLIENT', '"' + mission.def.doneLine + '"']);
    } else if (win) {
      rows.push(['RESULT', info.ko ? 'Puppet banished' : 'Time — judges']);
      rows.push(['PURSE', '+' + U.fmt(credits)]);
      rows.push(['RANK', '+' + (result.rpGained || rewardRp) + ' pts']);
      if (info.noDamage) rows.push(['FLAWLESS', 'Not a scratch!']);
      rows.push(['THEM', '"' + en.defeatLine + '"']);
    } else {
      rows.push(['RESULT', 'Your puppet broke']);
      rows.push(['SALVAGE', '+6 scrap']);
      rows.push(['THEM', '"' + en.taunt + '"']);
    }
    let html = rows.map((r) => `<div class="rrow"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
    if (rankUps && rankUps.length) html += `<div class="rrow"><span>PROMOTED</span><b>${rankUps.map((r) => r.name).join(' > ')}</b></div>`;
    document.getElementById('resultBody').innerHTML = html;
    Z.ui.show('result');
    // post-battle scenes
    if (win && isM) {
      const scene = [
        { who: mission.def.client, text: mission.def.doneLine },
        partner ? { who: partner.name, img: partner.id, text: partner.winLine || U.choice(partner.banter) } : null,
      ];
      if (restoredName) scene.push({ who: 'SPIRIT TOWN', text: restoredName + ' breathes again. Lanterns are going up on main street.' });
      Z.cutscene.play(scene);
    } else if (win && en.isChampion) {
      Z.cutscene.play([
        { who: en.name, evil: true, side: 'right', text: en.defeatLine },
        { who: 'Ao', img: 'ao', text: 'Grand champion. The broom approves. The whole town approves.' },
        { who: 'Ao', img: 'ao', text: 'Come by the shop. Tonight the Spirit Feast Bowl is free. Do not tell anyone.' },
      ]);
    }
  }

  // ---------- render ----------
  function render() {
    const ctx = Z.render.ctx, W = Z.render.W, H = Z.render.H;
    layout(); if (!spirits) buildSpirits(W, H);
    // shrine arena backdrop
    if (!Z.assets.cover(ctx, 'battle.arena', 0, 0, W, H, 0.5)) {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#3a2030'); g.addColorStop(1, '#1c1210'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    ctx.fillStyle = 'rgba(28,14,8,.22)'; ctx.fillRect(0, 0, W, H);
    // spectator spirit wisps
    drawSpirits(ctx, W, H);
    // ground shade so cutouts sit
    const gg = ctx.createLinearGradient(0, stage.groundY - 14, 0, H);
    gg.addColorStop(0, 'rgba(20,10,6,0)'); gg.addColorStop(1, 'rgba(20,10,6,.5)');
    ctx.fillStyle = gg; ctx.fillRect(0, stage.groundY - 14, W, H - stage.groundY + 14);

    ctx.save();
    const sx = Z.state.settings.shake ? Z.fx.shakeX : 0, sy = Z.state.settings.shake ? Z.fx.shakeY : 0;
    ctx.translate(sx, sy);
    const zz = Z.fx.getZoom(); if (zz !== 1) { ctx.translate(W / 2, H / 2); ctx.scale(zz, zz); ctx.translate(-W / 2, -H / 2); }

    // puppeteers + spirit strings
    drawPuppeteer(ctx, stage.left - 74, stage.groundY, 1, P, opLeftPress, true);
    if (E) drawPuppeteer(ctx, stage.right + 74, stage.groundY, -1, E, opRightPress, false);
    // partner cheering behind the player
    if (partner) {
      const bob = Math.abs(Math.sin(t * 3.2)) * (6 + crowdHype * 8);
      Z.render.drawSprite('char.' + partner.id, stage.left - 130, stage.groundY, { w: 72, bob, squash: Math.sin(t * 6.4) * 0.04, facing: 1 });
    }

    // dash afterimages
    [E, P].forEach((f) => { if (f && f.dashT > 0) { const g2 = f.dashT / 0.22; ctx.save(); ctx.globalAlpha = 0.2 * g2; for (let i = 1; i <= 2; i++) { ctx.save(); ctx.translate(-f.facing * i * 20, 0); Z.render.drawBotSide(f.x, stage.groundY - f.y, f.facing, f.spec, f.anim, { scale: 1.5 }); ctx.restore(); } ctx.restore(); } });
    // puppets
    if (E) Z.render.drawBotSide(E.x, stage.groundY - E.y, E.facing, E.spec, E.anim, { scale: 1.5, hpFrac: E.hp / E.maxHp, flash: E.hitFlash > 0 ? E.hitFlash / 0.12 * 0.8 : 0 });
    Z.render.drawBotSide(P.x, stage.groundY - P.y, P.facing, P.spec, P.anim, { scale: 1.5, hpFrac: P.hp / P.maxHp, flash: P.hitFlash > 0 ? P.hitFlash / 0.12 * 0.8 : 0 });
    // block wards (ofuda shield arc)
    [P, E].forEach((f) => { if (f && f.block) { ctx.strokeStyle = U.rgba(SPIRIT, 0.85); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(f.x + f.facing * f.halfW, stage.groundY - f.y - f.spec.radius * 1.6, f.spec.radius * 1.5, -1.1, 1.1); ctx.stroke(); ctx.fillStyle = U.rgba(SPIRIT, 0.2); ctx.fill(); } });

    // released soul rises from a broken puppet
    if (soul) {
      const age = t - soul.born, sy = stage.groundY - 90 - age * 60, sx = soul.x + Math.sin(age * 3) * 14;
      if (age < 3.2) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.max(0, 1 - age / 3.2);
        const g3 = ctx.createRadialGradient(sx, sy, 1, sx, sy, 26); g3.addColorStop(0, 'rgba(255,247,234,.95)'); g3.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g3; ctx.fillRect(sx - 26, sy - 26, 52, 52);
        ctx.fillStyle = '#fff7ea'; ctx.beginPath(); ctx.arc(sx, sy, 7, 0, U.TAU);
        ctx.quadraticCurveTo(sx - 10, sy + 16, sx - 3, sy + 22); ctx.fill();
        ctx.restore();
      }
    }
    Z.fx.render(ctx);
    ctx.restore();
    Z.render.drawPetals(t);
  }

  function buildSpirits(W, H) {
    spirits = [];
    for (let i = 0; i < 16; i++) spirits.push({ x: U.rand(0.04, 0.96), y: U.rand(0.3, 0.55), s: U.rand(10, 22), ph: U.rand(0, 6.28), col: U.choice(['#ffd98a', '#8fe6cf', '#f2b8c6', '#cfd8ff']) });
  }
  function drawSpirits(ctx, W, H) {
    for (const sp of spirits) {
      const bx = sp.x * W, by = sp.y * H + Math.sin(t * (1.4 + crowdHype) + sp.ph) * (8 + crowdHype * 10);
      ctx.save(); ctx.globalAlpha = 0.5;
      // little hitodama wisp with tail
      const g = ctx.createRadialGradient(bx, by, 1, bx, by, sp.s);
      g.addColorStop(0, sp.col); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(bx, by, sp.s, 0, U.TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.75;
      ctx.fillStyle = '#fff8ea'; ctx.beginPath(); ctx.arc(bx, by, sp.s * 0.28, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#2f2418'; ctx.fillRect(bx - sp.s * 0.12, by - 1.6, 1.6, 3.2); ctx.fillRect(bx + sp.s * 0.06, by - 1.6, 1.6, 3.2);
      ctx.restore();
    }
  }

  // yokai puppeteer with glowing spirit strings to the puppet
  function drawPuppeteer(ctx, x, groundY, face, fighter, press, isPlayer) {
    const bob = Math.abs(Math.sin(t * 2.6)) * 5 + press * 4;
    const key = isPlayer ? 'char.tanuki' : null;
    if (key) {
      Z.render.drawSprite(key, x, groundY, { w: 104, bob, squash: Math.sin(t * 5.2) * 0.035 + press * 0.05, facing: face, sway: Math.sin(t * 2) * 0.04 });
    } else {
      // KANE-CO handler: grey suit drone hovering with a briefcase
      ctx.save(); ctx.translate(x, groundY - 46 - bob); ctx.scale(face, 1);
      Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, -16, -26, 32, 44, 8), '#7d8294');
      Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, -11, -44, 22, 20, 6), '#9aa0b5', { noShadow: true, cut: 3 });
      ctx.fillStyle = '#ff5a4a'; ctx.beginPath(); ctx.arc(2, -35, 3.4, 0, U.TAU); ctx.fill();  // red lens
      ctx.fillStyle = '#3a3f52'; ctx.fillRect(-4, -12, 8, 16);                                 // tie
      Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, 12, -6, 14, 12, 3), '#4a4f66', { noShadow: true, cut: 2.5 }); // briefcase
      // hover jet
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const jg = ctx.createRadialGradient(0, 22, 1, 0, 22, 16); jg.addColorStop(0, 'rgba(255,120,80,.6)'); jg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = jg; ctx.fillRect(-16, 8, 32, 30); ctx.restore();
      ctx.restore();
    }
    // spirit strings to the puppet (3 wavy glowing threads)
    if (fighter) {
      const hx = x + face * 26, hy = groundY - 64 - bob;
      const tx = fighter.x, tyTop = groundY - fighter.y - fighter.spec.radius * 3.1;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const off = (i - 1) * 12, sway = Math.sin(t * 3 + i * 2) * 10;
        const col = isPlayer ? U.rgba('#8fe6cf', 0.5 - i * 0.1) : U.rgba('#ff9d7a', 0.5 - i * 0.1);
        ctx.strokeStyle = col; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(hx, hy);
        ctx.quadraticCurveTo((hx + tx) / 2 + sway, Math.min(hy, tyTop) - 40 - i * 10, tx + off, tyTop + Math.abs(off) * 0.4);
        ctx.stroke();
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(tx + off, tyTop + Math.abs(off) * 0.4, 2.2, 0, U.TAU); ctx.fill();
      }
      // glowing hand node
      const g = ctx.createRadialGradient(hx, hy, 1, hx, hy, 14);
      g.addColorStop(0, isPlayer ? 'rgba(143,230,207,.8)' : 'rgba(255,157,122,.8)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(hx - 14, hy - 14, 28, 28);
      ctx.restore();
    }
    if (isPlayer) Z.render.pxText(ctx, 'YOU', x, groundY - 136 - bob, 10, '#ffe9bf', 'center');
  }

  function hud() {
    if (!P) return;
    setBar('bhpL', P.hp / P.maxHp); setBar('bhpR', E ? E.hp / E.maxHp : 0);
    setBar('benL', P.energy / P.energyMax); setBar('benR', E ? E.energy / E.energyMax : 0);
    const left = Math.max(0, Math.ceil(MATCH_TIME - matchT)); const el = document.getElementById('bTimer');
    if (el) { el.textContent = mission ? ('W' + (waveIdx + 1) + ' · ' + left) : left; el.classList.toggle('low', left <= 10 && phase === 'fight'); }
  }
  function setBar(id, f) {
    const e = document.getElementById(id); if (!e) return;
    e.style.width = U.clamp(f, 0, 1) * 100 + '%';
    if (id === 'bhpL' || id === 'bhpR') e.parentElement.classList.toggle('lowhp', f > 0 && f < 0.28);
  }

  return { start, update, render, get active() { return phase !== 'idle'; } };
})();
