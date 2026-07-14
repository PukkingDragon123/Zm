/* ================================================================
   ui.js — screen manager, action router, money HUD, toasts, tooltips.
   Minimal + diegetic; wires the on-screen pad per screen.
   ================================================================ */
Z.ui = (function () {
  const U = Z.util, $ = U.$;
  let current = 'boot';
  let returnScreen = 'world';
  const enterHooks = {}, ACTIONS = {};
  const SCREENS = ['boot', 'title', 'world', 'workbench', 'shop', 'ramen', 'quests', 'scavenge', 'ladder', 'battle', 'result', 'settings', 'how'];
  const screenEl = (n) => document.querySelector(`.screen[data-screen="${n}"]`);

  function show(name) {
    if (!screenEl(name)) return;
    hideTip();
    if (current !== name) { const p = screenEl(current); if (p) p.classList.remove('active'); }
    current = name;
    screenEl(name).classList.add('active');
    // controller mode
    if (Z.controls) Z.controls.setMode(name === 'world' ? 'world' : name === 'battle' ? 'battle' : 'none');
    if (Z.audio) Z.audio.setMode(name === 'battle' ? 'combat' : 'menu');
    (enterHooks[name] || []).forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
    updateWallet();
  }
  function onEnter(name, fn) { (enterHooks[name] = enterHooks[name] || []).push(fn); }
  function registerAction(act, fn) { ACTIONS[act] = fn; }

  function updateWallet() {
    const m = U.fmt(Z.state.credits);
    ['worldMoney', 'shopMoney', 'ramenMoney', 'qMoney', 'ladMoney'].forEach((id) => { const e = document.getElementById(id); if (e) e.textContent = m; });
  }

  function toast(msg, type) { const w = $('#toasts'); if (!w) return; const t = U.el('div', 'toast' + (type ? ' ' + type : ''), msg); w.appendChild(t); setTimeout(() => t.remove(), 2600); }

  const tipEl = () => $('#tip');
  function showTip(html, x, y) {
    const t = tipEl(); if (!t) return; t.innerHTML = html; t.style.display = 'block';
    const w = t.offsetWidth, h = t.offsetHeight; let px = x + 14, py = y + 14;
    if (px + w > innerWidth - 8) px = x - w - 14; if (py + h > innerHeight - 8) py = y - h - 14;
    t.style.left = Math.max(8, px) + 'px'; t.style.top = Math.max(8, py) + 'px';
  }
  function hideTip() { const t = tipEl(); if (t) t.style.display = 'none'; }

  function itemTip(item) {
    const rc = Z.data.rarityColor(item.rarity);
    let s = `<div style="color:${rc};font-family:'Press Start 2P';font-size:9px">${item.name}</div>`;
    s += `<div style="color:${rc};margin:3px 0">${(Z.data.RARITY[item.rarity] || {}).label || ''} · ${(item.category || 'frame').toUpperCase()}</div>`;
    s += `<div style="color:var(--dim);margin-bottom:5px">${item.desc || ''}</div>`;
    const st = item.stats || {}; const rows = [];
    const push = (k, v, neg) => { if (v) rows.push(`<span class="${neg ? 'tip-neg' : 'tip-stat'}">${k} ${U.sign(v)}</span>`); };
    if (item.slots) { rows.push(`<span class="tip-stat">HP ${item.baseHp}</span>`, `<span>WT ${item.weight}</span>`, `<span class="tip-stat">GRIP ${item.traction}</span>`, `<span>SLOTS W${item.slots.weapon} A${item.slots.armor} U${item.slots.utility}</span>`); }
    else {
      push('HP', st.hp); push('PWR', st.power); push('SPD', st.speed); push('GRIP', st.traction); push('ARM', st.armor);
      if (st.weight) rows.push(`<span>WT +${st.weight}</span>`);
      if (st.energyProvide) rows.push(`<span class="tip-stat">PWR CELL +${st.energyProvide}</span>`);
      if (st.energyDraw) rows.push(`<span class="tip-neg">DRAW -${st.energyDraw}</span>`);
      if (item.weapon) rows.push(`<span class="tip-stat">${Z.data.WPN_LABEL[item.weapon.type]} DMG ${item.weapon.damage}</span>`);
    }
    return s + `<div style="display:flex;flex-wrap:wrap;gap:2px 10px">${rows.join('')}</div>`;
  }

  function fillHow() {
    const items = [
      ['THE STRIP', 'Walk the street with A / D (or the < > pad). Stop at a shop and press W / ENTER to go in.'],
      ['YOUR BENCH', 'At HOME, drag junk parts onto your bot with the wrench. Balance weight, power and the energy budget.'],
      ['THE PIT', 'Side-view brawls. Move in, HIT to attack, SKILL for a heavy special, hold BLK to guard. Drop their HP to zero.'],
      ['SCRAP & CASH', 'Dig Scrap Alley for free parts, sell spares at Tanaka\'s, and slurp ramen for a pre-fight edge.'],
      ['CLIMB', 'Win purse and rank, clear jobs, and work up to dethrone Apex-Zero — king of the block.'],
    ];
    const g = $('#howGrid'); if (!g) return; U.clear(g);
    items.forEach(([t, d]) => { const it = U.el('div', 'how-item'); it.innerHTML = `<h3>${t}</h3><p>${d}</p>`; g.appendChild(it); });
  }

  function init() {
    fillHow();
    document.getElementById('ui').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (Z.audio) Z.audio.resume();
      const act = b.getAttribute('data-act');
      if (ACTIONS[act]) { Z.audio && Z.audio.sfx.click(); return ACTIONS[act](b, e); }
      if (SCREENS.includes(act)) { Z.audio && Z.audio.sfx.click(); return show(act); }
      if (act === 'closeMenu') { Z.audio && Z.audio.sfx.back(); return show(returnScreen || 'world'); }
    });
    document.getElementById('ui').addEventListener('pointerover', (e) => { if (e.target.closest('.pbtn,.pcard,.opp,.dish,.quest,.pile,.fbtn,.tool') && Z.audio && Z.audio.ctx) Z.audio.sfx.hover(); });
    registerAction('settings', () => { returnScreen = current === 'settings' ? returnScreen : current; show('settings'); });
    wireSettings();
  }

  function wireSettings() {
    const st = Z.state.settings;
    const m = $('#setMusic'), s = $('#setSfx'), sh = $('#setShake'), cr = $('#setCrt'), rn = $('#setRain');
    if (!m) return;
    m.value = st.music; s.value = st.sfx; sh.checked = st.shake; cr.checked = st.crt; rn.checked = st.rain;
    const apply = () => {
      st.music = +m.value; st.sfx = +s.value; st.shake = sh.checked; st.crt = cr.checked; st.rain = rn.checked;
      Z.audio.setMusicVol(st.music / 100); Z.audio.setSfxVol(st.sfx / 100);
      document.body.classList.toggle('no-crt', !st.crt); Z.render.setRain(st.rain); Z.state.persistSettings();
    };
    [m, s].forEach((el) => el.addEventListener('input', apply));
    [sh, cr, rn].forEach((el) => el.addEventListener('change', apply));
    Z.audio.setMusicVol(st.music / 100); Z.audio.setSfxVol(st.sfx / 100);
    document.body.classList.toggle('no-crt', !st.crt); Z.render.setRain(st.rain);
  }

  return { init, show, onEnter, registerAction, updateWallet, toast, showTip, hideTip, itemTip, get current() { return current; } };
})();
