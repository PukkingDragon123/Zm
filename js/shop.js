/* ================================================================
   shop.js — TANAKA'S TOY & SCRAP. Buy parts ($ or scrap), sell spares.
   Stock unlocks with rank.
   ================================================================ */
Z.shop = (function () {
  const U = Z.util, $ = U.$, D = Z.data;
  let mode = 'buy', filter = 'all';
  const UNLOCK = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 6 };
  const scrapPrice = (p) => Math.ceil(p / 5);
  const catOf = (it) => (it.slots ? 'chassis' : it.category);
  const LINES = ['Tanaka: "Junk\'s junk \'til you bolt it right."', 'Tanaka: "Cash or scrap, kid. I don\'t do favors."', 'Tanaka: "That one fell off a bot that lost. Buy accordingly."'];

  function buy(id, withScrap) {
    const it = D.itemById(id); if (!it || Z.state.rankTier < (UNLOCK[it.rarity] || 1)) { Z.audio.sfx.error(); return; }
    if (withScrap) { const sp = scrapPrice(it.price); if (Z.state.scrap < sp) { Z.audio.sfx.error(); Z.ui.toast('Not enough scrap', 'warn'); return; } Z.state.addScrap(-sp); }
    else if (!Z.state.spend(it.price)) { Z.audio.sfx.error(); Z.ui.toast('Not enough cash', 'warn'); return; }
    Z.state.addItem(id, 1); Z.state.persist(); Z.audio.sfx.buy(); Z.ui.toast('Bought ' + it.name, 'gold'); render();
  }
  function sell(id) {
    const it = D.itemById(id); if (!it || Z.state.availableCount(id) < 1) { Z.audio.sfx.error(); Z.ui.toast("That's on your bot", 'warn'); return; }
    Z.state.removeItem(id, 1); Z.state.addCredits(it.salvage, true); Z.state.persist(); Z.audio.sfx.coin(); Z.ui.toast('Sold ' + it.name + ' +$' + it.salvage); render();
  }

  function statLine(it) {
    if (it.slots) return `HP ${it.baseHp} WT ${it.weight} W${it.slots.weapon}A${it.slots.armor}U${it.slots.utility}`;
    const s = it.stats || {}, b = [];
    if (s.hp) b.push('HP+' + s.hp); if (s.power) b.push('PWR+' + s.power); if (s.speed) b.push('SPD+' + s.speed);
    if (s.traction) b.push('GRIP+' + s.traction); if (s.armor) b.push('ARM+' + s.armor);
    if (s.energyProvide) b.push('CELL+' + s.energyProvide); if (s.energyDraw) b.push('DRAW' + s.energyDraw);
    if (it.weapon) b.push(D.WPN_ICON[it.weapon.type] + it.weapon.damage);
    return b.join(' ');
  }
  function card(it, bodyHtml, locked) {
    const c = U.el('div', 'pcard' + (D.rarityRank(it.rarity) >= 2 ? ' b-' + it.rarity : ''));
    if (locked) c.style.opacity = '.45';
    const ic = U.el('canvas'); ic.width = 46; ic.height = 46; ic.className = 'p-ic'; c.appendChild(ic);
    const mid = U.el('div', 'p-mid'); mid.innerHTML = `<div class="p-name">${it.name}</div><div class="p-stats">${statLine(it)}</div>`; c.appendChild(mid);
    const right = U.el('div', 'p-right'); right.innerHTML = bodyHtml; c.appendChild(right);
    c.addEventListener('pointermove', (e) => Z.ui.showTip(Z.ui.itemTip(it), e.clientX, e.clientY));
    c.addEventListener('pointerleave', () => Z.ui.hideTip());
    Z.render.drawPartIcon(ic, it);
    return { c, right };
  }

  function render() {
    const npc = $('#shopNpc'); if (npc) npc.textContent = U.choice(LINES);
    filterBar();
    const host = $('#shopList'); if (!host) return; U.clear(host);
    if (mode === 'buy') {
      const items = D.parts.concat(D.chassis).filter((it) => filter === 'all' || catOf(it) === filter).sort((a, b) => D.rarityRank(a.rarity) - D.rarityRank(b.rarity) || a.price - b.price);
      items.forEach((it) => {
        const locked = Z.state.rankTier < (UNLOCK[it.rarity] || 1), sp = scrapPrice(it.price), owned = Z.state.invCount(it.id);
        const body = locked ? `<div class="p-rar rar-${it.rarity}">${(D.RARITY[it.rarity] || {}).label}</div><div class="p-price" style="color:var(--red)">RANK ${UNLOCK[it.rarity]}</div>`
          : `<div class="p-price">$${U.fmt(it.price)}</div><div class="p-rar" style="color:var(--steel)">or ${sp} scrap${owned ? ' · own ' + owned : ''}</div>`;
        const { c, right } = card(it, body, locked);
        if (!locked) {
          const bc = U.el('button', 'pbtn tiny', 'BUY'); bc.disabled = Z.state.credits < it.price;
          const bs = U.el('button', 'pbtn tiny', sp + ' SCR'); bs.disabled = Z.state.scrap < sp;
          bc.addEventListener('click', (e) => { e.stopPropagation(); buy(it.id, false); });
          bs.addEventListener('click', (e) => { e.stopPropagation(); buy(it.id, true); });
          right.appendChild(bc); right.appendChild(bs);
        }
        host.appendChild(c);
      });
    } else {
      const owned = Object.keys(Z.state.inventory).map((id) => D.itemById(id)).filter(Boolean).filter((it) => filter === 'all' || catOf(it) === filter).sort((a, b) => D.rarityRank(b.rarity) - D.rarityRank(a.rarity));
      if (!owned.length) { host.innerHTML = '<div style="color:var(--dim);padding:20px">Nothing to sell here.</div>'; }
      owned.forEach((it) => {
        const total = Z.state.invCount(it.id), avail = Z.state.availableCount(it.id);
        const { c, right } = card(it, `<div class="p-rar rar-${it.rarity}">x${total}${avail < total ? ' · ' + avail + ' free' : ''}</div><div class="p-price">+$${U.fmt(it.salvage)}</div>`, false);
        const b = U.el('button', 'pbtn tiny', 'SELL'); b.disabled = avail < 1;
        b.addEventListener('click', (e) => { e.stopPropagation(); sell(it.id); });
        right.appendChild(b); host.appendChild(c);
      });
    }
    Z.ui.updateWallet();
  }

  function filterBar() {
    const bar = $('#shopFilter'); if (!bar) return; U.clear(bar);
    ['buy', 'sell'].forEach((m) => { const b = U.el('button', 'fbtn' + (mode === m ? ' on' : ''), m.toUpperCase()); b.addEventListener('click', () => { mode = m; render(); }); bar.appendChild(b); });
    const sep = U.el('span'); sep.style.width = '10px'; bar.appendChild(sep);
    [['all', 'ALL'], ['chassis', 'FRM'], ['generator', 'GEN'], ['motor', 'MOT'], ['wheels', 'WHL'], ['weapon', 'WPN'], ['armor', 'ARM'], ['utility', 'UTL']].forEach(([k, l]) => { const b = U.el('button', 'fbtn' + (filter === k ? ' on' : ''), l); b.addEventListener('click', () => { filter = k; render(); }); bar.appendChild(b); });
  }

  function init() { Z.ui.onEnter('shop', render); Z.util.bus.on('inventory', () => { if (Z.ui.current === 'shop') render(); }); }
  return { init, render };
})();
