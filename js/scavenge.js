/* ================================================================
   scavenge.js — SCRAP ALLEY. Push-your-luck dig: bank your haul
   before a live wire or a mine wipes it.
   ================================================================ */
Z.scavenge = (function () {
  const U = Z.util, $ = U.$, D = Z.data;
  const SIZE = 12;
  let yard = null, bankBtn = null;

  function newYard(charge) {
    if (charge && !Z.state.spend(Z.state.scavengeCost)) { Z.audio.sfx.error(); Z.ui.toast('Not enough cash', 'warn'); return; }
    yard = { piles: Array.from({ length: SIZE }, () => ({ dug: false, reveal: null })), left: SIZE, greed: 0, haul: { scrap: 0, credits: 0, parts: [] } };
    Z.audio.sfx.dig(); render();
  }
  function rollPart(g) {
    const pool = D.parts.concat(D.chassis), mult = { common: 1, uncommon: 1, rare: 1 + g * 0.16, epic: 1 + g * 0.3, legendary: 1 + g * 0.55 };
    return U.weighted(pool, (it) => it.dropWeight * (mult[it.rarity] || 1) * (it.slots ? 0.25 : 1));
  }
  function dig(i) {
    if (!yard || yard.piles[i].dug || yard.left <= 0) return;
    const p = yard.piles[i]; p.dug = true; yard.left--; Z.audio.sfx.dig();
    const g = yard.greed, hz = U.clamp(0.05 + g * 0.045, 0, 0.55);
    if (U.chance(hz)) {
      if (U.chance(0.3 + g * 0.05)) { p.reveal = { type: 'hazard', name: 'MINE', sub: 'haul lost' }; yard.haul = { scrap: 0, credits: 0, parts: [] }; yard.greed = 0; Z.fx.screenFlash(0.35, D.PAL.red); Z.audio.sfx.error(); Z.ui.toast('MINE! Unbanked haul gone.', 'warn'); }
      else { p.reveal = { type: 'hazard', name: 'LIVE WIRE', sub: '-1 dig' }; yard.left = Math.max(0, yard.left - 1); Z.audio.sfx.error(); }
      render(); return;
    }
    yard.greed++;
    if (U.chance(0.62)) { const part = rollPart(g); yard.haul.parts.push(part.id); p.reveal = { type: 'part', rarity: part.rarity, name: part.name, sub: (D.RARITY[part.rarity] || {}).label }; Z.audio.sfx.found(part.rarity); if (D.rarityRank(part.rarity) >= 2) Z.fx.screenFlash(0.22, D.rarityColor(part.rarity)); }
    else if (U.chance(0.6)) { const a = U.randInt(3, 8) + g * 2 + Z.state.rankTier; yard.haul.scrap += a; p.reveal = { type: 'scrap', name: '+' + a + ' SCRAP', sub: 'salvage' }; Z.audio.sfx.coin(); }
    else { const a = U.randInt(10, 30) + g * 4 + Z.state.rankTier * 3; yard.haul.credits += a; p.reveal = { type: 'credits', name: '+$' + a, sub: 'cash' }; Z.audio.sfx.coin(); }
    render();
  }
  function bank() {
    if (!yard) return; const h = yard.haul;
    if (!h.scrap && !h.credits && !h.parts.length) { Z.audio.sfx.error(); return; }
    if (h.scrap) Z.state.addScrap(h.scrap); if (h.credits) Z.state.addCredits(h.credits, true);
    let rares = 0; h.parts.forEach((id) => { Z.state.addItem(id, 1); const it = D.itemById(id); if (it && D.rarityRank(it.rarity) >= 2) rares++; });
    Z.state.stats.rareFinds += rares; yard.haul = { scrap: 0, credits: 0, parts: [] }; yard.greed = 0;
    Z.state.persist(); Z.audio.sfx.buy(); Z.ui.toast('Banked' + (rares ? ' · ' + rares + ' rare!' : ''), rares ? 'gold' : ''); Z.quests.check(); render();
  }

  function render() {
    if (!yard) return;
    const grid = $('#scvGrid'); if (!grid) return; U.clear(grid);
    yard.piles.forEach((p, i) => {
      const cell = U.el('div', 'pile' + (p.dug ? ' dug' : ''));
      if (p.reveal) {
        if (p.reveal.type === 'hazard') cell.classList.add('hazard');
        const col = p.reveal.type === 'part' ? D.rarityColor(p.reveal.rarity) : p.reveal.type === 'credits' ? 'var(--gold)' : p.reveal.type === 'hazard' ? 'var(--red)' : 'var(--teal)';
        cell.innerHTML = `<div class="reveal"><div class="r-name" style="color:${col}">${p.reveal.name}</div><div class="r-sub">${p.reveal.sub || ''}</div></div>`;
      } else { cell.innerHTML = `<div class="pl-mark">?</div>`; cell.addEventListener('click', () => dig(i)); }
      grid.appendChild(cell);
    });
    $('#scvDigs') && ($('#scvDigs').textContent = yard.left);
    $('#scvCost') && ($('#scvCost').textContent = Z.state.scavengeCost);
    const h = yard.haul, he = $('#scvHaul');
    if (he) { const pb = h.parts.map((id) => { const it = D.itemById(id); return `<span style="color:${D.rarityColor(it.rarity)}">${it.name}</span>`; }).join(', '); he.innerHTML = `HAUL: <b>${h.scrap}</b> scrap · <b>$${h.credits}</b> ${h.parts.length ? '· ' + pb : ''}`; }
    const hint = $('#scvHint'); if (hint) hint.textContent = yard.left <= 0 ? 'Picked clean. Bank it and buy a new alley.' : yard.greed >= 3 ? 'Getting risky — bank before a mine wipes you.' : 'Dig the piles. Go deeper for rarer junk, mind the wires.';
    ensureBank();
    Z.ui.updateWallet();
  }
  function ensureBank() {
    const a = document.querySelector('[data-screen=scavenge] .scv-actions'); if (!a) return;
    if (!bankBtn) { bankBtn = U.el('button', 'pbtn amber', 'BANK HAUL'); bankBtn.addEventListener('click', bank); a.insertBefore(bankBtn, a.firstChild); }
    const h = yard.haul; bankBtn.disabled = !h.scrap && !h.credits && !h.parts.length;
  }
  function init() { Z.ui.onEnter('scavenge', () => { if (!yard) newYard(false); else render(); }); Z.ui.registerAction('scvNew', () => { const h = yard && yard.haul; if (h && (h.scrap || h.credits || h.parts.length)) bank(); else newYard(true); }); }
  return { init, newYard, render };
})();
