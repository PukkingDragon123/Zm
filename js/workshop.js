/* ================================================================
   workshop.js — the build screen: slots, inventory, live stats,
   energy budget, chassis swapping, animated procedural preview.
   ================================================================ */
Z.workshop = (function () {
  const U = Z.util, $ = U.$;
  const D = Z.data;
  let stageCanvas = null;
  let active = { cat: null, index: 0 };   // currently selected slot
  let filter = 'all';

  const NAME_PARTS_A = ['RUST', 'NEON', 'IRON', 'VOLT', 'GRIM', 'ZERO', 'HEX', 'NOVA', 'ACE', 'SCRAP', 'CHROME', 'DUSK', 'RIOT', 'ONI'];
  const NAME_PARTS_B = ['-01', '-X', 'JACK', 'FANG', 'BREAKER', 'WISP', 'MAW', 'SPIKE', 'HOWL', 'KING', '-99', 'REX', 'BOLT'];
  function randomName() {
    const n = U.choice(NAME_PARTS_A) + (Math.random() < 0.5 ? U.choice(NAME_PARTS_B) : U.choice(['-', ' '])[0] + U.randInt(1, 99));
    $('#wsBotName').value = n.slice(0, 16);
    commitName();
  }
  function commitName() {
    const v = ($('#wsBotName').value || '').trim().toUpperCase().slice(0, 16) || 'UNIT-01';
    Z.state.botName = v; Z.state.persist();
  }

  function spec() { return Z.Bot.compute(Z.state.build).spec; }

  // ---- slot definitions for the current chassis ----
  function slotDefs() {
    const ch = D.chassisById(Z.state.build.chassis) || D.chassis[0];
    const defs = [
      { cat: 'chassis', index: 0, kind: 'CHASSIS', icon: D.CAT_ICON.chassis },
      { cat: 'generator', index: 0, kind: 'GENERATOR', icon: D.CAT_ICON.generator },
      { cat: 'motor', index: 0, kind: 'MOTOR', icon: D.CAT_ICON.motor },
      { cat: 'wheels', index: 0, kind: 'WHEELS', icon: D.CAT_ICON.wheels },
    ];
    for (let i = 0; i < ch.slots.weapon; i++) defs.push({ cat: 'weapon', index: i, kind: 'WEAPON', icon: D.CAT_ICON.weapon });
    for (let i = 0; i < ch.slots.armor; i++) defs.push({ cat: 'armor', index: i, kind: 'ARMOR', icon: D.CAT_ICON.armor });
    for (let i = 0; i < ch.slots.utility; i++) defs.push({ cat: 'utility', index: i, kind: 'UTILITY', icon: D.CAT_ICON.utility });
    return defs;
  }

  function slotValue(cat, index) {
    const b = Z.state.build;
    if (cat === 'chassis') return b.chassis;
    if (cat === 'generator' || cat === 'motor' || cat === 'wheels') return b[cat];
    return (b[cat] || [])[index];
  }

  function setChassis(id) {
    if (Z.state.availableCount(id) < 1 && Z.state.build.chassis !== id) return;
    const oldB = Z.state.build;
    const ch = D.chassisById(id);
    const nb = { chassis: id, generator: oldB.generator, motor: oldB.motor, wheels: oldB.wheels, weapon: [], armor: [], utility: [] };
    ['weapon', 'armor', 'utility'].forEach((k) => {
      nb[k] = new Array(ch.slots[k]).fill(null);
      const old = oldB[k] || [];
      for (let i = 0; i < ch.slots[k] && i < old.length; i++) nb[k][i] = old[i];
    });
    Z.state.build = nb;
    Z.state.persist();
    Z.audio.sfx.buy();
    render();
  }

  function equip(partId) {
    const item = D.itemById(partId);
    if (!item) return;
    if (item.slots) { setChassis(partId); return; }   // chassis
    const cat = item.category;
    // pick target slot: active slot if compatible, else first empty compatible, else first compatible
    let target = null;
    if (active.cat === cat) target = { cat, index: active.index };
    if (!target) {
      const defs = slotDefs().filter((d) => d.cat === cat);
      target = defs.find((d) => !slotValue(d.cat, d.index)) || defs[0];
    }
    if (!target) return;
    // must own a free copy (unless we're swapping the same slot's part back)
    if (Z.state.availableCount(partId) < 1) { Z.audio.sfx.error(); Z.ui.toast('No spare ' + item.name, 'warn'); return; }
    if (cat === 'generator' || cat === 'motor' || cat === 'wheels') Z.state.build[cat] = partId;
    else Z.state.build[cat][target.index] = partId;
    active = { cat, index: target.index };
    Z.state.persist();
    Z.audio.sfx.click();
    render();
  }
  function unequip(cat, index) {
    if (cat === 'chassis') return;
    if (cat === 'generator' || cat === 'motor' || cat === 'wheels') Z.state.build[cat] = null;
    else Z.state.build[cat][index] = null;
    Z.state.persist(); Z.audio.sfx.back(); render();
  }

  // ---- rendering ----
  function render() {
    Z.ui.hideTip();
    ensureStage();
    renderSlots();
    renderMeters();
    renderInventory();
    $('#wsBotName').value = Z.state.botName;
  }

  function ensureStage() {
    const host = $('#wsStage'); if (!host) return;
    if (!stageCanvas) { stageCanvas = U.el('canvas'); stageCanvas.style.width = '100%'; stageCanvas.style.height = '100%'; stageCanvas.style.display = 'block'; host.appendChild(stageCanvas); }
  }

  function renderSlots() {
    const host = $('#wsSlots'); if (!host) return; U.clear(host);
    slotDefs().forEach((d) => {
      const id = slotValue(d.cat, d.index);
      const item = id ? D.itemById(id) : null;
      const row = U.el('div', 'slot' + (item ? ' filled' : '') + (active.cat === d.cat && active.index === d.index ? ' active' : ''));
      if (item) row.classList.add('b-' + item.rarity);
      row.innerHTML = `<div class="slot-ic">${d.icon}</div>
        <div class="slot-body">
          <div class="slot-kind">${d.kind}${d.cat === 'weapon' || d.cat === 'armor' || d.cat === 'utility' ? ' ' + (d.index + 1) : ''}</div>
          <div class="slot-name ${item ? '' : 'empty'}">${item ? item.name : '— empty —'}</div>
        </div>
        ${item && d.cat !== 'chassis' ? '<button class="btn tiny" data-unequip="1">✕</button>' : ''}`;
      row.addEventListener('click', (e) => {
        if (e.target.getAttribute('data-unequip')) { unequip(d.cat, d.index); return; }
        active = { cat: d.cat, index: d.index };
        filter = d.cat === 'chassis' ? 'chassis' : d.cat;
        Z.audio.sfx.click();
        render();
      });
      addTip(row, item);
      host.appendChild(row);
    });
  }

  function meterRow(k, v, frac, color, over) {
    return `<div class="meter${over ? ' over' : ''}"><span class="mk">${k}</span>
      <span class="mbar"><i style="width:${Math.round(U.clamp(frac, 0, 1) * 100)}%;background:${color}"></i></span>
      <span class="mv">${v}</span></div>`;
  }
  function renderMeters() {
    const host = $('#wsMeters'); if (!host) return;
    const c = Z.Bot.compute(Z.state.build);
    const sp = c.spec, agg = c.agg;
    const A = D.PAL.neonA, B = D.PAL.neonB, C = D.PAL.neonC;
    let html = '';
    Z.Bot.statList(sp).forEach((s) => { html += meterRow(s.k, s.v, s.f, s.k === 'ARMOR' ? C : s.k === 'MASS' ? D.PAL.metal : A, false); });
    // energy budget
    const provide = agg.energyProvide, draw = agg.energyDraw;
    const frac = provide > 0 ? draw / provide : (draw > 0 ? 1 : 0);
    const over = sp.overdraw;
    html += `<div class="meter${over ? ' over' : ''}"><span class="mk">ENERGY</span>
      <span class="mbar"><i style="width:${Math.round(U.clamp(frac, 0, 1) * 100)}%;background:${over ? D.PAL.warn : B}"></i></span>
      <span class="mv">${draw}/${provide}</span></div>`;
    html += `<div style="display:flex;justify-content:space-between;font-family:var(--mono);font-size:11px;margin-top:2px">
      <span style="color:${over ? 'var(--warn)' : 'var(--dim)'}">${over ? '⚠ OVERDRAW — stats throttled −28%' : (c.ready ? 'BATTLE-READY' : '⚠ needs motor + wheels')}</span>
      <span style="color:var(--gold)">PWR RATING ${sp.rating}</span></div>`;
    host.innerHTML = html;
  }

  function renderInventory() {
    const host = $('#wsInv'); if (!host) return;
    // filter buttons
    const fbar = $('#wsFilter'); U.clear(fbar);
    const cats = [['all', 'ALL'], ['chassis', 'FRAME'], ['generator', 'GEN'], ['motor', 'MOTOR'], ['wheels', 'WHEEL'], ['weapon', 'WPN'], ['armor', 'ARM'], ['utility', 'UTIL']];
    cats.forEach(([k, lbl]) => {
      const b = U.el('button', 'fbtn' + (filter === k ? ' on' : ''), lbl);
      b.addEventListener('click', () => { filter = k; Z.audio.sfx.hover(); renderInventory(); });
      fbar.appendChild(b);
    });
    U.clear(host);
    // gather owned items (parts + chassis)
    const owned = [];
    Object.keys(Z.state.inventory).forEach((id) => {
      const it = D.itemById(id); if (!it) return;
      const cat = it.slots ? 'chassis' : it.category;
      if (filter !== 'all' && cat !== filter) return;
      owned.push({ it, cat });
    });
    owned.sort((a, b) => (D.rarityRank(b.it.rarity) - D.rarityRank(a.it.rarity)) || a.it.name.localeCompare(b.it.name));
    if (!owned.length) { host.innerHTML = `<div style="color:var(--dim);font-family:var(--mono);font-size:12px;padding:20px;text-align:center">No parts here. Scavenge the Midden or hit the Chop-Shop.</div>`; return; }
    owned.forEach(({ it, cat }) => {
      const total = Z.state.invCount(it.id);
      const avail = Z.state.availableCount(it.id);
      const equippedHere = it.slots ? (Z.state.build.chassis === it.id) : Z.state.equippedCount(it.id) > 0;
      const card = U.el('div', 'pcard b-' + it.rarity);
      const iconCv = U.el('canvas'); iconCv.width = 44; iconCv.height = 44; iconCv.className = 'p-ic';
      card.appendChild(iconCv);
      const mid = U.el('div', 'p-mid');
      mid.innerHTML = `<div class="p-name">${it.name}</div><div class="p-stats">${statLine(it)}</div>`;
      card.appendChild(mid);
      const right = U.el('div', 'p-right');
      right.innerHTML = `<div class="p-rar rar-${it.rarity}">x${total}${avail < total ? ' · ' + avail + ' free' : ''}</div>
        <div class="p-price" style="color:var(--neonA);font-size:12px">${equippedHere ? 'EQUIPPED' : (avail > 0 ? 'EQUIP' : '—')}</div>`;
      card.appendChild(right);
      card.addEventListener('click', () => equip(it.id));
      addTip(card, it);
      host.appendChild(card);
      Z.render.drawPartIcon(iconCv, it);
    });
  }

  function statLine(it) {
    if (it.slots) return `HP ${it.baseHp} · WT ${it.weight} · ⚔${it.slots.weapon} 🛡${it.slots.armor} 🧩${it.slots.utility}`;
    const s = it.stats || {}; const bits = [];
    if (s.hp) bits.push('HP+' + s.hp); if (s.power) bits.push('PWR+' + s.power); if (s.speed) bits.push('SPD+' + s.speed);
    if (s.traction) bits.push('GRIP+' + s.traction); if (s.armor) bits.push('ARM+' + s.armor);
    if (s.energyProvide) bits.push('⚡+' + s.energyProvide); if (s.energyDraw) bits.push('⚡-' + s.energyDraw);
    if (it.weapon) bits.push(D.WPN_ICON[it.weapon.type] + it.weapon.damage);
    if (s.weight) bits.push('WT+' + s.weight);
    return bits.join(' · ');
  }

  function addTip(el, item) {
    if (!item) return;
    el.addEventListener('pointermove', (e) => Z.ui.showTip(Z.ui.itemTip(item), e.clientX, e.clientY));
    el.addEventListener('pointerleave', () => Z.ui.hideTip());
  }

  // main-loop preview draw
  function drawPreview(t) { if (stageCanvas && Z.ui.current === 'workshop') Z.render.drawBotPreview(stageCanvas, spec(), t); }

  function init() {
    Z.ui.onEnter('workshop', () => { active = { cat: null, index: 0 }; filter = 'all'; render(); });
    Z.ui.registerAction('randomName', randomName);
    Z.util.bus.on('inventory', () => { if (Z.ui.current === 'workshop') render(); });
    const nameInput = document.getElementById('wsBotName');
    if (nameInput) { nameInput.addEventListener('change', commitName); nameInput.addEventListener('blur', commitName); }
  }

  return { init, render, spec, drawPreview };
})();
