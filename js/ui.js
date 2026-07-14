/* ================================================================
   ui.js — screen manager, action router, HUD/wallet, toasts, tooltips
   ================================================================ */
Z.ui = (function () {
  const U = Z.util;
  const $ = U.$, $$ = U.$$;
  let current = 'boot';
  const enterHooks = {};   // screen -> [fn]
  const ACTIONS = {};      // act name -> fn
  const SCREENS = ['boot', 'title', 'hub', 'workshop', 'scavenge', 'shop', 'quests', 'ladder', 'prefight', 'combat', 'result', 'settings', 'how'];

  function screenEl(name) { return document.querySelector(`.screen[data-screen="${name}"]`); }

  function show(name, opts) {
    opts = opts || {};
    if (!screenEl(name)) return;
    hideTip();
    const prev = screenEl(current);
    if (prev && current !== name) prev.classList.remove('active');
    current = name;
    const el = screenEl(name);
    el.classList.add('active');
    // scene tint per screen
    if (name === 'combat') Z.render.setScene('combat', Z.data.PAL.neonB);
    else Z.render.setScene('ambient', Z.data.PAL.neonA);
    (enterHooks[name] || []).forEach((fn) => { try { fn(opts); } catch (e) { console.error(e); } });
    updateWallet();
    if (Z.audio && name !== 'boot') Z.audio.setMode(name === 'combat' || name === 'prefight' ? 'combat' : 'menu');
  }

  function onEnter(name, fn) { (enterHooks[name] = enterHooks[name] || []).push(fn); }
  function registerAction(act, fn) { ACTIONS[act] = fn; }

  // ---- HUD / wallet ----
  function updateWallet() {
    const st = Z.state;
    const cr = U.fmt(st.credits), sc = U.fmt(st.scrap), rank = st.currentRank().name;
    setText('hubCredits', cr); setText('hubScrap', sc); setText('hubRank', rank);
    setText('wsCredits', cr); setText('scvCredits', cr); setText('shopCredits', cr);
    setText('qCredits', cr); setText('ladRank', rank);
    // quest pip (claimable count)
    const pip = $('#questPip');
    if (pip && Z.quests) { const n = Z.quests.claimableCount(); pip.textContent = n > 0 ? n : ''; }
  }
  function setText(id, v) { const e = document.getElementById(id); if (e) e.textContent = v; }

  // ---- toasts ----
  function toast(msg, type) {
    const wrap = $('#toasts'); if (!wrap) return;
    const t = U.el('div', 'toast' + (type ? ' ' + type : ''), msg);
    wrap.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  // ---- tooltip ----
  const tipEl = () => $('#tip');
  function showTip(html, x, y) {
    const t = tipEl(); if (!t) return;
    t.innerHTML = html; t.style.display = 'block';
    const w = t.offsetWidth, h = t.offsetHeight;
    let px = x + 14, py = y + 14;
    if (px + w > window.innerWidth - 8) px = x - w - 14;
    if (py + h > window.innerHeight - 8) py = y - h - 14;
    t.style.left = Math.max(8, px) + 'px'; t.style.top = Math.max(8, py) + 'px';
  }
  function hideTip() { const t = tipEl(); if (t) t.style.display = 'none'; }

  // Build a rich tooltip for a part/chassis.
  function itemTip(item) {
    const rc = Z.data.rarityColor(item.rarity);
    let s = `<div style="color:${rc};font-family:Orbitron;font-size:12px">${item.name}</div>`;
    s += `<div style="color:${rc};font-size:9px;letter-spacing:1px">${(Z.data.RARITY[item.rarity] || {}).label || ''} · ${(item.category || 'chassis').toUpperCase()}</div>`;
    s += `<div style="margin:5px 0;color:#9fb2c6">${item.desc || ''}</div>`;
    const st = item.stats || {};
    const rows = [];
    const push = (k, v, neg) => { if (v) rows.push(`<span class="${neg ? 'tip-neg' : 'tip-stat'}">${k} ${U.sign(v)}</span>`); };
    if (item.slots) {
      rows.push(`<span class="tip-stat">HP ${item.baseHp}</span>`);
      rows.push(`<span>WT ${item.weight}</span>`);
      rows.push(`<span class="tip-stat">GRIP ${item.traction}</span>`);
      rows.push(`<span>SLOTS ⚔${item.slots.weapon} 🛡${item.slots.armor} 🧩${item.slots.utility}</span>`);
    } else {
      push('HP', st.hp); push('PWR', st.power); push('SPD', st.speed); push('GRIP', st.traction);
      push('ARM', st.armor); if (st.weight) rows.push(`<span>WT +${st.weight}</span>`);
      if (st.energyProvide) rows.push(`<span class="tip-stat">⚡+${st.energyProvide}</span>`);
      if (st.energyDraw) rows.push(`<span class="tip-neg">⚡-${st.energyDraw}</span>`);
      if (item.weapon) rows.push(`<span class="tip-stat">${Z.data.WPN_LABEL[item.weapon.type]} DMG ${item.weapon.damage} · KB ${item.weapon.knockback}</span>`);
    }
    s += `<div style="display:flex;flex-wrap:wrap;gap:2px 10px;font-size:10px">${rows.join('')}</div>`;
    return s;
  }

  // ---- static content ----
  function fillHow() {
    const items = [
      ['♻', 'SCAVENGE', 'Dig junkpiles in the Rust Midden for parts and scrap. Bank your haul or push your luck for rarer finds — but watch for hazards.'],
      ['🔧', 'BUILD', 'Bolt a chassis + generator, motor, wheels, weapon, armor and utility together. Balance weight, power and the ENERGY BUDGET.'],
      ['⚔', 'FIGHT', 'Top-down sumo: shove your rival out of the neon ring, or grind their HP to zero. Own the center — the ring SHRINKS after 25s.'],
      ['⌨', 'CONTROLS', 'Move with WASD / Arrows / stick. BOOST with Space / FIRE (your ring-out tool). Hold Shift to BRACE against a shove. Gamepad supported.'],
      ['◎', 'RANK UP', 'Win purse + rank points, clear Contracts, and climb 8 tiers of rival to dethrone the champion, Apex-Zero, and become the Ultimate Zumo.'],
    ];
    const g = $('#howGrid'); if (!g) return; U.clear(g);
    items.forEach(([ic, t, d]) => {
      const row = U.el('div', 'how-item');
      row.innerHTML = `<div class="h-ic">${ic}</div><div><div class="h-t">${t}</div><div class="h-d">${d}</div></div>`;
      g.appendChild(row);
    });
  }

  // ---- init: wire delegated clicks + settings ----
  function init() {
    fillHow();
    // delegated action router
    document.getElementById('ui').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.getAttribute('data-act');
      if (Z.audio) Z.audio.resume();
      handleAction(act, btn, e);
    });
    // hover sfx on buttons/tiles
    document.getElementById('ui').addEventListener('pointerover', (e) => {
      const b = e.target.closest('.btn,.tile,.opp,.pcard,.slot,.fbtn');
      if (b && Z.audio && Z.audio.ctx) Z.audio.sfx.hover();
    });
    wireSettings();
  }

  function handleAction(act, btn, e) {
    if (ACTIONS[act]) { Z.audio && Z.audio.sfx.click(); return ACTIONS[act](btn, e); }
    if (SCREENS.includes(act)) { Z.audio && Z.audio.sfx.click(); return show(act); }
    // convenience aliases
    if (act === 'hubFromSettings') { Z.state.persistSettings(); return show('hub'); }
    console.warn('unhandled action', act);
  }

  function wireSettings() {
    const st = Z.state.settings;
    const music = $('#setMusic'), sfx = $('#setSfx'), shake = $('#setShake'), crt = $('#setCrt'), rain = $('#setRain');
    if (!music) return;
    music.value = st.music; sfx.value = st.sfx; shake.checked = st.shake; crt.checked = st.crt; rain.checked = st.rain;
    const apply = () => {
      st.music = +music.value; st.sfx = +sfx.value; st.shake = shake.checked; st.crt = crt.checked; st.rain = rain.checked;
      Z.audio.setMusicVol(st.music / 100); Z.audio.setSfxVol(st.sfx / 100);
      document.body.classList.toggle('no-crt', !st.crt);
      Z.render.setRain(st.rain);
      Z.state.persistSettings();
    };
    [music, sfx].forEach((el) => el.addEventListener('input', apply));
    [shake, crt, rain].forEach((el) => el.addEventListener('change', apply));
    // apply initial
    Z.audio.setMusicVol(st.music / 100); Z.audio.setSfxVol(st.sfx / 100);
    document.body.classList.toggle('no-crt', !st.crt);
    Z.render.setRain(st.rain);
  }

  return {
    init, show, onEnter, registerAction, updateWallet, toast,
    showTip, hideTip, itemTip,
    get current() { return current; },
  };
})();
