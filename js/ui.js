/* ================================================================
   ui.js — screen manager, action router, money HUD, toasts, tooltips.
   Minimal + diegetic; wires the on-screen pad per screen.
   ================================================================ */
Z.ui = (function () {
  const U = Z.util, $ = U.$;
  let current = 'boot';
  let returnScreen = 'world';
  const enterHooks = {}, ACTIONS = {};
  const SCREENS = ['boot', 'title', 'world', 'menu', 'house', 'cave', 'workbench', 'shop', 'ramen', 'quests', 'crew', 'scavenge', 'ladder', 'battle', 'result', 'settings', 'how', 'infil'];
  const screenEl = (n) => document.querySelector(`.screen[data-screen="${n}"]`);

  function show(name) {
    if (!screenEl(name)) return;
    hideTip();
    if (current !== name) { const p = screenEl(current); if (p) p.classList.remove('active'); }
    current = name;
    screenEl(name).classList.add('active');
    transition(name);
    // controller mode
    if (Z.controls) Z.controls.setMode((name === 'world' || name === 'shop' || name === 'house' || name === 'cave') ? 'world' : name === 'battle' ? 'battle' : 'none');
    if (Z.audio) Z.audio.setMode(name === 'battle' ? 'combat' : 'menu');
    (enterHooks[name] || []).forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
    updateWallet();
  }
  const TITLES = {
    world: ['SPIRIT TOWN', 'main street'], workbench: ['YOUR DEN', 'the puppet bench'],
    ramen: ["AO'S RAMEN", 'eat first, fight after'], scavenge: ['JUNK GROVE', 'push your luck'],
    shop: ['KITSUNE CURIOS', 'browse the shelves'],
    quests: ['REQUEST BOARD', 'help the town'], ladder: ['THE DOHYO', 'challenge matches'],
    crew: ['THE TEAHOUSE', 'your crew'],
    infil: ['KANE-CO CAMPS', 'sneak in, take back parts'],
    menu: ['NAVIGATOR', 'where to next'], house: ['HOME', 'your place'],
    cave: ['WORKSHOP CAVE', 'kits and components'],
  };
  let lastTitle = null;
  function transition(name) {
    if (name === 'boot') return;
    const w = document.getElementById('wipe');
    if (w) { w.classList.remove('run'); void w.offsetWidth; w.classList.add('run'); }
    const tc = document.getElementById('titlecard'), title = TITLES[name];
    if (tc && title && lastTitle !== name) {
      document.getElementById('tcText').textContent = title[0];
      document.getElementById('tcSub').textContent = title[1];
      tc.classList.remove('show'); void tc.offsetWidth; tc.classList.add('show');
    }
    lastTitle = name;
  }
  function onEnter(name, fn) { (enterHooks[name] = enterHooks[name] || []).push(fn); }
  function registerAction(act, fn) { ACTIONS[act] = fn; }

  function updateWallet() {
    const m = U.fmt(Z.state.credits);
    ['worldMoney', 'shopMoney', 'ramenMoney', 'qMoney', 'ladMoney', 'crewMoney', 'infilMoney'].forEach((id) => { const e = document.getElementById(id); if (e) e.textContent = m; });
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
    let s = `<div style="color:${rc};font-family:'Mochiy Pop One',sans-serif;font-size:12px">${item.name}</div>`;
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
      ['SPIRIT TOWN', 'Walk main street with A / D. Press W / ENTER at a doorway to go in. Talk to the townsfolk yokai.'],
      ['YOUR DEN', 'Drag wood, charms and rune stones onto your puppet. Rune stones set your spirit budget — overdraw and the whole puppet sputters.'],
      ['THE DOHYO', 'Puppet duels: HIT to swing, JUMP to hop over trouble, SKILL for a spirit burst, hold BLOCK to raise a ward. Break their puppet before yours breaks.'],
      ['REQUESTS', 'KANE-CO robots are squatting all over town. Take requests with a crew partner, clear the waves, and restore each district.'],
      ['YOUR CREW', 'Visit the teahouse to talk with Tengu, Kappa and Oni. Friendship ranks make their battle support stronger.'],
      ['EAT WELL', 'Ao\'s snacks buff your next fight. Junk Grove digs pay in free parts — mind the hazards.'],
      ['KANE-CO CAMPS', 'Sneak-in parkour: jump with W, change form with K. ROCK smashes and hides, PAPER glides and rides vents, SCISSORS dashes through fences (J).'],
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
