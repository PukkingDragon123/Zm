/* ================================================================
   quests.js — THE JOB BOARD. Progress derived from stats; claim manually.
   ================================================================ */
Z.quests = (function () {
  const U = Z.util, $ = U.$, D = Z.data;
  let lastClaim = new Set();

  function progress(q) {
    const st = Z.state.stats;
    switch (q.type) {
      case 'win_matches': return st.wins; case 'ring_out': return st.ringOuts; case 'no_damage': return st.noDamageWins;
      case 'k1_finish': return st.koFinishes; case 'scavenge_rare': return st.rareFinds; case 'win_streak': return st.bestStreak;
      case 'earn_credits': return st.earnedTotal; case 'win_with_weapon': return st.winsByWeapon[q.param] || 0;
      case 'beat_rival': return Z.state.beaten[q.param] ? 1 : 0; default: return 0;
    }
  }
  const done = (q) => progress(q) >= q.target;
  const claimed = (q) => !!Z.state.claimedQuests[q.id];
  const claimable = (q) => done(q) && !claimed(q);
  function claimableCount() { return D.quests.filter(claimable).length; }

  function claim(q) {
    if (!claimable(q)) return;
    Z.state.claimedQuests[q.id] = true;
    if (q.rewardCredits) Z.state.addCredits(q.rewardCredits);
    if (q.rewardScrap) Z.state.addScrap(q.rewardScrap);
    if (q.rewardPartId) { Z.state.addItem(q.rewardPartId, 1); const it = D.itemById(q.rewardPartId); if (it) Z.ui.toast('Got ' + it.name, 'gold'); }
    if (q.rewardRp) Z.game.awardRp(q.rewardRp);
    Z.state.persist(); Z.audio.sfx.rank(); Z.ui.toast('Job done: ' + q.title, 'gold'); render();
  }
  function check() { const now = new Set(D.quests.filter(claimable).map((q) => q.id)); now.forEach((id) => { if (!lastClaim.has(id)) Z.ui.toast('Job ready: ' + D.quests.find((x) => x.id === id).title); }); lastClaim = now; }

  function render() {
    const host = $('#questList'); if (!host) return; U.clear(host);
    D.quests.slice().sort((a, b) => rankOf(a) - rankOf(b)).forEach((q) => {
      const p = Math.min(progress(q), q.target), cl = claimable(q), cd = claimed(q);
      const card = U.el('div', 'quest' + (cd ? ' done' : '') + (cl ? ' claimable' : ''));
      const rew = []; if (q.rewardCredits) rew.push('$' + q.rewardCredits); if (q.rewardScrap) rew.push(q.rewardScrap + ' scr'); if (q.rewardRp) rew.push(q.rewardRp + ' RP');
      if (q.rewardPartId) { const it = D.itemById(q.rewardPartId); if (it) rew.push(`<span style="color:${D.rarityColor(it.rarity)}">${it.name}</span>`); }
      card.innerHTML = `${cd ? '<div class="q-badge">DONE</div>' : cl ? '<div class="q-badge">READY</div>' : ''}<h3>${q.title}</h3><p>${q.desc}</p>
        <div class="q-prog"><i style="width:${Math.round(p / q.target * 100)}%"></i></div>
        <div class="q-foot"><span class="q-rew">${rew.join(' · ')}</span><span style="color:var(--dim)">${p}/${q.target}</span></div>`;
      if (cl) { const b = U.el('button', 'pbtn tiny amber', 'CLAIM'); b.style.marginTop = '10px'; b.addEventListener('click', () => claim(q)); card.appendChild(b); }
      host.appendChild(card);
    });
    Z.ui.updateWallet();
  }
  function rankOf(q) { return claimable(q) ? 0 : claimed(q) ? 2 : 1; }
  function init() { Z.ui.onEnter('quests', render); lastClaim = new Set(D.quests.filter(claimable).map((q) => q.id)); }
  return { init, render, check, claimableCount, progress };
})();
