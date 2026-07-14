/* ================================================================
   bot.js — build model + stat computation + fighter spec
   A "build" is a chassis id plus part ids fitted into its slots.
   compute() turns a build into display stats + a physics fighter spec.
   ================================================================ */
Z.Bot = (function () {
  const U = Z.util;

  function emptyBuild(chassisId) {
    const ch = Z.data.chassisById(chassisId) || Z.data.chassis[0];
    return {
      chassis: ch.id,
      generator: null,
      motor: null,
      wheels: null,
      weapon: new Array(ch.slots.weapon).fill(null),
      armor: new Array(ch.slots.armor).fill(null),
      utility: new Array(ch.slots.utility).fill(null),
    };
  }

  // Return the list of equipped part objects (skips nulls/missing).
  function equippedParts(build) {
    const out = [];
    const push = (id) => { const p = Z.data.partById(id); if (p) out.push(p); };
    push(build.generator); push(build.motor); push(build.wheels);
    (build.weapon || []).forEach(push);
    (build.armor || []).forEach(push);
    (build.utility || []).forEach(push);
    return out;
  }

  // Shared: turn aggregate stats -> physics fighter spec used by combat & UI
  function deriveSpec(agg, extra) {
    const armor = U.clamp(agg.armor, 0, 60);
    const overdraw = agg.energyDraw > agg.energyProvide + 0.001;
    const pen = overdraw ? 0.72 : 1;
    const mass = U.clamp(agg.weight, 12, 260);
    const thrust = Math.max(4, agg.power) * pen;
    // acceleration: strong bots with light frames turn fast
    const accel = U.clamp(240 * thrust / Math.pow(mass, 0.72), 40, 1400);
    const maxSpeed = U.clamp((92 + agg.speed * 2.7) * pen * U.clamp(1.16 - mass / 520, 0.72, 1.12), 70, 460);
    const grip = U.clamp(agg.traction / 130, 0.06, 0.94);
    const energyMax = Math.max(24, agg.energyProvide);
    const energyRegen = Math.max(3, agg.energyProvide * (overdraw ? 0.22 : 0.5) - agg.energyDraw * 0.18);
    const radius = U.clamp(24 + agg.weight * 0.16, 28, 60);
    const rating = Math.round(
      agg.hp * 0.16 + agg.power * 1.6 + agg.speed * 1.1 + agg.traction * 0.9 +
      armor * 2.2 + agg.weight * 0.35 +
      (extra.weapons || []).reduce((s, w) => s + (w.damage || 0) * 3, 0)
    );
    return {
      name: extra.name || 'UNIT',
      accent: extra.accent || '#1ff7ff',
      hp: agg.hp, maxHp: agg.hp,
      power: agg.power, speedStat: agg.speed, tractionStat: agg.traction, weightStat: agg.weight,
      armor, mass, thrust, accel, maxSpeed, grip,
      energyMax, energyRegen, energyDraw: agg.energyDraw, energyProvide: agg.energyProvide, overdraw,
      weapons: extra.weapons || [],
      radius, rating,
      chassisId: extra.chassisId || null,
      build: extra.build || null,
    };
  }

  // Compute display stats + spec from a player build.
  function compute(build) {
    const ch = Z.data.chassisById(build.chassis) || Z.data.chassis[0];
    const agg = { hp: ch.baseHp, weight: ch.weight, power: 6, speed: 6, traction: ch.traction, armor: 0, energyProvide: 0, energyDraw: 0 };
    const weapons = [];
    for (const p of equippedParts(build)) {
      const s = p.stats || {};
      agg.hp += s.hp || 0; agg.weight += s.weight || 0; agg.power += s.power || 0;
      agg.speed += s.speed || 0; agg.traction += s.traction || 0; agg.armor += s.armor || 0;
      agg.energyProvide += s.energyProvide || 0; agg.energyDraw += s.energyDraw || 0;
      if (p.weapon && p.weapon.type && p.weapon.type !== 'none') {
        weapons.push({ type: p.weapon.type, damage: p.weapon.damage || 6, cooldown: p.weapon.cooldown || 0.6, knockback: p.weapon.knockback || 40, name: p.name });
      }
    }
    const spec = deriveSpec(agg, { name: Z.state ? Z.state.botName : ch.name, accent: '#1ff7ff', weapons, chassisId: ch.id, build });
    const ready = !!(build.motor && build.wheels);
    return {
      chassis: ch, agg, spec, weapons,
      ready,
      hasGen: !!build.generator,
      slotsFilled: equippedParts(build).length,
    };
  }

  // Build a fighter spec directly from an enemy definition (stat-defined).
  function fromEnemy(en) {
    const st = en.stats || {};
    const agg = {
      hp: st.hp || 200, weight: st.weight || 70, power: st.power || 40, speed: st.speed || 40,
      traction: st.traction || 40, armor: st.armor || 10,
      energyProvide: 100, energyDraw: 20,
    };
    const weapons = [];
    if (en.weaponType && en.weaponType !== 'none') {
      weapons.push({
        type: en.weaponType,
        damage: st.weaponDamage || 8,
        cooldown: { spinner: 0.12, blade: 0.5, hammer: 1.1, flipper: 1.4, flamer: 0.3 }[en.weaponType] || 0.6,
        knockback: { spinner: 30, blade: 24, hammer: 90, flipper: 70, flamer: 12 }[en.weaponType] || 40,
        name: en.weaponType,
      });
    }
    const spec = deriveSpec(agg, { name: en.name, accent: en.color || '#ff2bd6', weapons });
    spec.aggression = en.aggression != null ? en.aggression : 0.6;
    spec.archetype = en.archetype || 'allrounder';
    return spec;
  }

  // Pretty stat list for UI (label, value, 0..1 fraction for bars)
  function statList(spec) {
    return [
      { k: 'HP', v: Math.round(spec.maxHp), f: U.clamp(spec.maxHp / 620, 0, 1) },
      { k: 'PWR', v: Math.round(spec.power), f: U.clamp(spec.power / 140, 0, 1) },
      { k: 'SPD', v: Math.round(spec.speedStat), f: U.clamp(spec.speedStat / 110, 0, 1) },
      { k: 'GRIP', v: Math.round(spec.tractionStat), f: U.clamp(spec.tractionStat / 110, 0, 1) },
      { k: 'ARMOR', v: spec.armor + '%', f: U.clamp(spec.armor / 60, 0, 1) },
      { k: 'MASS', v: Math.round(spec.mass) + 'kg', f: U.clamp(spec.mass / 220, 0, 1) },
    ];
  }

  return { emptyBuild, equippedParts, compute, fromEnemy, deriveSpec, statList };
})();
