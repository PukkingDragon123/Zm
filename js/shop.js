/* ================================================================
   shop.js — the Chop-Shop Bazaar: buy parts (credits OR scrap),
   sell spares for salvage. Stock unlocks with rank.
   ================================================================ */
Z.shop = (function () {
  const U = Z.util, $ = U.$;
  const D = Z.data;
  let mode = 'buy';     // 'buy' | 'sell'
  let filter = 'all';

  const UNLOCK = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 6 };
  const scrapPrice = (p) => Math.ceil(p / 5);

  function catOf(it) { return it.slots ? 'chassis' : it.category; }

  function buy(id, withScrap) {
    const it = D.itemById(id); if (!it) return;
    if (Z.state.rankTier < (UNLOCK[it.rarity] || 1)) { Z.audio.sfx.error(); return; }
    if (withScrap) {
      const sp = scrapPrice(it.price);
      if (Z.state.scrap < sp) { Z.audio.sfx.error(); Z.ui.toast('Not enough Scrap', 'warn'); return; }
      Z.state.addScrap(-sp);
    } else {
      if (!Z.state.spend(it.price)) { Z.audio.sfx.error(); Z.ui.toast('Not enough ₡', 'warn'); return; }
    }
    Z.state.addItem(id, 1);
    Z.state.persist();
    Z.audio.sfx.buy();
    Z.ui.toast('Bought ' + it.name, 'gold');
    render();
  }

  function sell(id) {
    const it = D.itemById(id); if (!it) return;
    if (Z.state.availableCount(id) < 1) { Z.audio.sfx.error(); Z.ui.toast('That one is bolted on', 'warn'); return; }
    Z.state.removeItem(id, 1);
    Z.state.addCredits(it.salvage, true);
    Z.state.persist();
    Z.audio.sfx.coin();
    Z.ui.toast('Sold ' + it.name + ' · +' + it.salvage + '₡');
    render();
  }

  function render() {
    Z.ui.hideTip();
    renderFilter();
    const host = $('#shopList'); if (!host) return; U.clear(host);
    if (mode === 'buy') renderBuy(host); else renderSell(host);
    Z.ui.updateWallet();
  }

  function renderFilter() {
    const bar = $('#shopFilter'); if (!bar) return; U.clear(bar);
    const modeWrap = U.el('div', 'ws-filter');
    ['buy', 'sell'].forEach((m) => {
      const b = U.el('button', 'fbtn' + (mode === m ? ' on' : ''), m.toUpperCase());
      b.addEventListener('click', () => { mode = m; Z.audio.sfx.click(); render(); });
      modeWrap.appendChild(b);
    });
    bar.appendChild(modeWrap);
    const catWrap = U.el('div', 'ws-filter');
    catWrap.style.marginLeft = '12px';
    [['all', 'ALL'], ['chassis', 'FRAME'], ['generator', 'GEN'], ['motor', 'MOTOR'], ['wheels', 'WHEEL'], ['weapon', 'WPN'], ['armor', 'ARM'], ['utility', 'UTIL']].forEach(([k, lbl]) => {
      const b = U.el('button', 'fbtn' + (filter === k ? ' on' : ''), lbl);
      b.addEventListener('click', () => { filter = k; Z.audio.sfx.hover(); render(); });
      catWrap.appendChild(b);
    });
    bar.style.display = 'flex'; bar.style.alignItems = 'center'; bar.style.flexWrap = 'wrap';
    bar.appendChild(catWrap);
  }

  function card(it, bodyHtml, locked) {
    const c = U.el('div', 'pcard b-' + it.rarity + (locked ? ' locked' : ''));
    if (locked) { c.style.opacity = '.45'; c.style.filter = 'grayscale(.6)'; }
    const iconCv = U.el('canvas'); iconCv.width = 44; iconCv.height = 44; iconCv.className = 'p-ic';
    c.appendChild(iconCv);
    const mid = U.el('div', 'p-mid');
    mid.innerHTML = `<div class="p-name">${it.name}</div><div class="p-stats">${Z.workshop ? '' : ''}${statLine(it)}</div>`;
    c.appendChild(mid);
    const right = U.el('div', 'p-right'); right.innerHTML = bodyHtml; c.appendChild(right);
    c.addEventListener('pointermove', (e) => Z.ui.showTip(Z.ui.itemTip(it), e.clientX, e.clientY));
    c.addEventListener('pointerleave', () => Z.ui.hideTip());
    Z.render.drawPartIcon(iconCv, it);
    return { c, right };
  }

  function statLine(it) {
    if (it.slots) return `HP ${it.baseHp} · WT ${it.weight} · ⚔${it.slots.weapon} 🛡${it.slots.armor} 🧩${it.slots.utility}`;
    const s = it.stats || {}; const bits = [];
    if (s.hp) bits.push('HP+' + s.hp); if (s.power) bits.push('PWR+' + s.power); if (s.speed) bits.push('SPD+' + s.speed);
    if (s.traction) bits.push('GRIP+' + s.traction); if (s.armor) bits.push('ARM+' + s.armor);
    if (s.energyProvide) bits.push('⚡+' + s.energyProvide); if (s.energyDraw) bits.push('⚡-' + s.energyDraw);
    if (it.weapon) bits.push(D.WPN_ICON[it.weapon.type] + it.weapon.damage);
    return bits.join(' · ');
  }

  function renderBuy(host) {
    const items = D.parts.concat(D.chassis).filter((it) => filter === 'all' || catOf(it) === filter);
    items.sort((a, b) => (D.rarityRank(a.rarity) - D.rarityRank(b.rarity)) || a.price - b.price);
    items.forEach((it) => {
      const locked = Z.state.rankTier < (UNLOCK[it.rarity] || 1);
      const sp = scrapPrice(it.price);
      const owned = Z.state.invCount(it.id);
      let body;
      if (locked) {
        body = `<div class="p-rar rar-${it.rarity}">${(D.RARITY[it.rarity] || {}).label}</div>
          <div class="p-price" style="color:var(--warn);font-size:12px">🔒 RANK ${UNLOCK[it.rarity]}</div>`;
      } else {
        body = `<div class="p-price">${U.fmt(it.price)}₡</div>
          <div class="p-rar" style="color:var(--metal)">or ${sp}⛭ ${owned ? '· own ' + owned : ''}</div>`;
      }
      const { c, right } = card(it, body, locked);
      if (!locked) {
        const canC = Z.state.credits >= it.price, canS = Z.state.scrap >= sp;
        const bC = U.el('button', 'btn tiny', 'BUY ₡'); bC.disabled = !canC;
        const bS = U.el('button', 'btn tiny', sp + '⛭'); bS.disabled = !canS; bS.style.marginTop = '4px';
        bC.addEventListener('click', (e) => { e.stopPropagation(); buy(it.id, false); });
        bS.addEventListener('click', (e) => { e.stopPropagation(); buy(it.id, true); });
        right.appendChild(bC); right.appendChild(bS);
      }
      host.appendChild(c);
    });
  }

  function renderSell(host) {
    const owned = Object.keys(Z.state.inventory).map((id) => D.itemById(id)).filter(Boolean)
      .filter((it) => filter === 'all' || catOf(it) === filter);
    owned.sort((a, b) => (D.rarityRank(b.rarity) - D.rarityRank(a.rarity)));
    if (!owned.length) { host.innerHTML = `<div style="color:var(--dim);font-family:var(--mono);padding:20px">Nothing to sell in this category.</div>`; return; }
    owned.forEach((it) => {
      const total = Z.state.invCount(it.id), avail = Z.state.availableCount(it.id);
      const body = `<div class="p-rar rar-${it.rarity}">x${total}${avail < total ? ' · ' + avail + ' free' : ''}</div>
        <div class="p-price">+${U.fmt(it.salvage)}₡</div>`;
      const { c, right } = card(it, body, false);
      const b = U.el('button', 'btn tiny', 'SELL'); b.disabled = avail < 1; b.style.marginTop = '4px';
      b.addEventListener('click', (e) => { e.stopPropagation(); sell(it.id); });
      right.appendChild(b);
      host.appendChild(c);
    });
  }

  function init() {
    Z.ui.onEnter('shop', () => { render(); });
    Z.util.bus.on('inventory', () => { if (Z.ui.current === 'shop') render(); });
  }

  return { init, render };
})();
