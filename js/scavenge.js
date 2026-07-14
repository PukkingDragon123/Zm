/* ================================================================
   scavenge.js — the Rust Midden: a push-your-luck dig.
   Dig junkpiles for scrap / credits / parts. Greed raises the odds
   of rare finds AND hazards. Bank your haul before a mine wipes it.
   ================================================================ */
Z.scavenge = (function () {
  const U = Z.util, $ = U.$;
  const D = Z.data;
  const YARD_SIZE = 12;

  let yard = null;   // { piles, scansLeft, greed, haul }
  let cashBtn = null;

  function newYard(charge) {
    if (charge) {
      if (!Z.state.spend(Z.state.scavengeCost)) { Z.audio.sfx.error(); Z.ui.toast('Not enough ₡ for a new yard', 'warn'); return false; }
    }
    yard = {
      piles: Array.from({ length: YARD_SIZE }, () => ({ dug: false, reveal: null })),
      scansLeft: YARD_SIZE,
      greed: 0,
      haul: { scrap: 0, credits: 0, parts: [] },
    };
    Z.audio.sfx.dig();
    render();
    return true;
  }

  // choose a part weighted by dropWeight, with deeper digs favouring rarity
  function rollPart(greed) {
    const pool = D.parts.concat(D.chassis);
    const mult = { common: 1, uncommon: 1, rare: 1 + greed * 0.16, epic: 1 + greed * 0.3, legendary: 1 + greed * 0.55 };
    const chassisPenalty = (it) => (it.slots ? 0.25 : 1); // frames drop less often
    return U.weighted(pool, (it) => it.dropWeight * (mult[it.rarity] || 1) * chassisPenalty(it));
  }

  function dig(i) {
    if (!yard || yard.piles[i].dug || yard.scansLeft <= 0) return;
    const pile = yard.piles[i];
    pile.dug = true;
    yard.scansLeft--;
    Z.audio.sfx.dig();

    const greed = yard.greed;
    const hazardChance = U.clamp(0.05 + greed * 0.045, 0, 0.55);

    if (U.chance(hazardChance)) {
      const mine = U.chance(0.3 + greed * 0.05);
      if (mine) {
        pile.reveal = { type: 'hazard', kind: 'mine', name: 'CORE MINE', sub: 'Haul lost!' };
        const lost = yard.haul.scrap + yard.haul.credits + yard.haul.parts.length;
        yard.haul = { scrap: 0, credits: 0, parts: [] };
        yard.greed = 0;
        Z.fx.screenFlash(0.4, '#ff3b3b');
        Z.audio.sfx.error();
        Z.ui.toast(lost > 0 ? '💥 MINE! Unbanked haul lost.' : '💥 Empty mine — lucky.', 'warn');
        render(); return;
      } else {
        pile.reveal = { type: 'hazard', kind: 'wire', name: 'LIVE WIRE', sub: '−1 scan' };
        yard.scansLeft = Math.max(0, yard.scansLeft - 1);
        Z.audio.sfx.error();
        render(); return;
      }
    }

    // content
    yard.greed++;
    if (U.chance(0.42)) {
      const part = rollPart(greed);
      yard.haul.parts.push(part.id);
      pile.reveal = { type: 'part', id: part.id, rarity: part.rarity, name: part.name, sub: (D.RARITY[part.rarity] || {}).label };
      Z.audio.sfx.found(part.rarity);
      if (D.rarityRank(part.rarity) >= 2) { Z.fx.screenFlash(0.25, D.rarityColor(part.rarity)); }
    } else if (U.chance(0.6)) {
      const amt = U.randInt(3, 8) + greed * 2 + Z.state.rankTier;
      yard.haul.scrap += amt;
      pile.reveal = { type: 'scrap', amt, name: '+' + amt + ' SCRAP', sub: 'salvage' };
      Z.audio.sfx.coin();
    } else {
      const amt = U.randInt(10, 30) + greed * 4 + Z.state.rankTier * 3;
      yard.haul.credits += amt;
      pile.reveal = { type: 'credits', amt, name: '+' + amt + ' ₡', sub: 'creds' };
      Z.audio.sfx.coin();
    }
    render();
  }

  function cashOut() {
    if (!yard) return;
    const h = yard.haul;
    if (h.scrap === 0 && h.credits === 0 && h.parts.length === 0) { Z.audio.sfx.error(); Z.ui.toast('Nothing to bank yet', 'warn'); return; }
    if (h.scrap) Z.state.addScrap(h.scrap);
    if (h.credits) Z.state.addCredits(h.credits, true);
    let rares = 0;
    h.parts.forEach((id) => { Z.state.addItem(id, 1); const it = D.itemById(id); if (it && D.rarityRank(it.rarity) >= 2) rares++; });
    Z.state.stats.rareFinds += rares;
    yard.haul = { scrap: 0, credits: 0, parts: [] };
    yard.greed = 0;
    Z.state.persist();
    Z.audio.sfx.buy();
    Z.ui.toast('Haul banked' + (rares ? ` · ${rares} rare!` : ''), rares ? 'gold' : '');
    Z.quests.check();
    render();
  }

  // ---- render ----
  function render() {
    if (!yard) return;
    const grid = $('#scvGrid'); if (!grid) return; U.clear(grid);
    yard.piles.forEach((pile, i) => {
      const cell = U.el('div', 'pile' + (pile.dug ? ' dug' : ''));
      if (pile.reveal) {
        if (pile.reveal.type === 'hazard') cell.classList.add('hazard');
        if (pile.reveal.type === 'part' && D.rarityRank(pile.reveal.rarity) >= 3) cell.classList.add('jackpot');
        const col = pile.reveal.type === 'part' ? D.rarityColor(pile.reveal.rarity)
          : pile.reveal.type === 'credits' ? 'var(--gold)'
          : pile.reveal.type === 'hazard' ? 'var(--warn)' : 'var(--neonA)';
        cell.innerHTML = `<div class="reveal"><div class="r-name" style="color:${col}">${pile.reveal.name}</div><div class="r-sub">${pile.reveal.sub || ''}</div></div>`;
      } else {
        const emoji = U.choice(['🗑️', '⚙️', '🔩', '📦', '🛢️', '🔌']);
        cell.innerHTML = `<div class="pile-emoji">${emoji}</div>`;
        cell.addEventListener('click', () => { dig(i); });
      }
      grid.appendChild(cell);
    });
    // scans + haul
    $('#scvDigs') && ($('#scvDigs').textContent = yard.scansLeft);
    $('#scvCost') && ($('#scvCost').textContent = Z.state.scavengeCost);
    const h = yard.haul;
    const haulEl = $('#scvHaul');
    if (haulEl) {
      const partBits = h.parts.map((id) => { const it = D.itemById(id); return `<span style="color:${D.rarityColor(it.rarity)}">${it.name}</span>`; }).join(', ');
      haulEl.innerHTML = `UNBANKED: <b>${h.scrap}</b> scrap · <b>${h.credits}</b>₡ ${h.parts.length ? '· ' + partBits : ''}`;
    }
    const hint = $('#scvHint');
    if (hint) {
      if (yard.scansLeft <= 0) hint.innerHTML = 'Yard picked clean. <b>Bank your haul</b> and buy a new yard.';
      else hint.textContent = yard.greed >= 3 ? 'Getting risky — every dig now could hit a mine. Bank while you can.' : 'Dig the piles. Deeper digs pay richer, but the hazards multiply.';
    }
    ensureCashBtn();
    Z.ui.updateWallet();
  }

  function ensureCashBtn() {
    const actions = document.querySelector('[data-screen=scavenge] .scv-actions');
    if (!actions) return;
    if (!cashBtn) {
      cashBtn = U.el('button', 'btn mag', 'BANK HAUL');
      cashBtn.addEventListener('click', cashOut);
      actions.insertBefore(cashBtn, actions.firstChild);
    }
    const h = yard.haul;
    cashBtn.disabled = (h.scrap === 0 && h.credits === 0 && h.parts.length === 0);
  }

  function init() {
    Z.ui.onEnter('scavenge', () => { if (!yard) newYard(false); else render(); });
    Z.ui.registerAction('scvNew', () => { if (cashOutIfAny()) return; newYard(true); });
  }
  // if there's an unbanked haul when hitting NEW YARD, bank it first (be nice)
  function cashOutIfAny() {
    if (yard && (yard.haul.scrap || yard.haul.credits || yard.haul.parts.length)) { cashOut(); return true; }
    return false;
  }

  return { init, newYard, render };
})();
