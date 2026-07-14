/* ================================================================
   quests.js — Contracts. Progress is derived from state.stats,
   so it can never desync. Player claims rewards manually.
   ================================================================ */
Z.quests = (function () {
  const U = Z.util, $ = U.$;
  const D = Z.data;
  let lastClaimable = new Set();

  function progress(q) {
    const st = Z.state.stats;
    switch (q.type) {
      case 'win_matches': return st.wins;
      case 'ring_out': return st.ringOuts;
      case 'no_damage': return st.noDamageWins;
      case 'k1_finish': return st.koFinishes;
      case 'scavenge_rare': return st.rareFinds;
      case 'win_streak': return st.bestStreak;
      case 'earn_credits': return st.earnedTotal;
      case 'win_with_weapon': return st.winsByWeapon[q.param] || 0;
      case 'beat_rival': return Z.state.beaten[q.param] ? 1 : 0;
      default: return 0;
    }
  }
  const isDone = (q) => progress(q) >= q.target;
  const isClaimed = (q) => !!Z.state.claimedQuests[q.id];
  const isClaimable = (q) => isDone(q) && !isClaimed(q);
  function claimableCount() { return D.quests.filter(isClaimable).length; }

  function claim(q) {
    if (!isClaimable(q)) return;
    Z.state.claimedQuests[q.id] = true;
    if (q.rewardCredits) Z.state.addCredits(q.rewardCredits);
    if (q.rewardScrap) Z.state.addScrap(q.rewardScrap);
    if (q.rewardPartId) { Z.state.addItem(q.rewardPartId, 1); const it = D.itemById(q.rewardPartId); if (it) Z.ui.toast('Received ' + it.name, 'gold'); }
    if (q.rewardRp) Z.game.awardRp(q.rewardRp);
    Z.state.persist();
    Z.audio.sfx.rank();
    Z.ui.toast('Contract complete: ' + q.title, 'gold');
    render();
  }

  // called after fights / scavenging to surface newly-available contracts
  function check() {
    const now = new Set(D.quests.filter(isClaimable).map((q) => q.id));
    now.forEach((id) => { if (!lastClaimable.has(id)) { const q = D.quests.find((x) => x.id === id); Z.ui.toast('◎ Contract ready: ' + q.title); } });
    lastClaimable = now;
    Z.ui.updateWallet();
  }

  function render() {
    const host = $('#questList'); if (!host) return; U.clear(host);
    // sort: claimable first, then in-progress, then claimed
    const sorted = D.quests.slice().sort((a, b) => rankOf(a) - rankOf(b));
    sorted.forEach((q) => {
      const p = Math.min(progress(q), q.target);
      const done = isDone(q), claimed = isClaimed(q), claimable = isClaimable(q);
      const card = U.el('div', 'quest' + (claimed ? ' done' : '') + (claimable ? ' claimable' : ''));
      const rew = [];
      if (q.rewardCredits) rew.push(q.rewardCredits + '₡');
      if (q.rewardScrap) rew.push(q.rewardScrap + '⛭');
      if (q.rewardRp) rew.push(q.rewardRp + ' RP');
      if (q.rewardPartId) { const it = D.itemById(q.rewardPartId); if (it) rew.push('<span style="color:' + D.rarityColor(it.rarity) + '">' + it.name + '</span>'); }
      card.innerHTML = `
        ${claimed ? '<div class="q-badge">CLAIMED</div>' : (claimable ? '<div class="q-badge">READY</div>' : '')}
        <h3>${q.title}</h3>
        <p>${q.desc}</p>
        <div class="q-prog"><i style="width:${Math.round((p / q.target) * 100)}%"></i></div>
        <div class="q-foot">
          <span class="q-rew">${rew.join(' · ')}</span>
          <span style="font-family:var(--mono);font-size:12px;color:var(--dim)">${p}/${q.target}</span>
        </div>`;
      if (claimable) {
        const b = U.el('button', 'btn tiny mag', 'CLAIM');
        b.style.marginTop = '10px';
        b.addEventListener('click', () => claim(q));
        card.appendChild(b);
      }
      host.appendChild(card);
    });
  }
  function rankOf(q) { if (isClaimable(q)) return 0; if (isClaimed(q)) return 2; return 1; }

  function init() {
    Z.ui.onEnter('quests', render);
    lastClaimable = new Set(D.quests.filter(isClaimable).map((q) => q.id));
  }

  return { init, render, check, claimableCount, progress };
})();
