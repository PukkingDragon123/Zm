/* ================================================================
   quests.js — THE REQUEST BOARD. Persona-style REQUESTS (crew
   missions in waves that restore districts) + BOUNTIES (contracts).
   ================================================================ */
Z.quests = (function () {
  const U = Z.util, $ = U.$, D = Z.data;
  let tab = 'requests';
  let lastClaim = new Set();
  const chosenPartner = {};   // missionId -> crewId

  // ---------- bounty progress (derived from stats) ----------
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
  function claimableCount() {
    return D.quests.filter(claimable).length + D.MISSIONS.filter((m) => !Z.state.missionsDone[m.id] && Z.state.rankTier >= m.minRank).length;
  }
  function claim(q) {
    if (!claimable(q)) return;
    Z.state.claimedQuests[q.id] = true;
    if (q.rewardCredits) Z.state.addCredits(q.rewardCredits);
    if (q.rewardScrap) Z.state.addScrap(q.rewardScrap);
    if (q.rewardPartId) { Z.state.addItem(q.rewardPartId, 1); const it = D.itemById(q.rewardPartId); if (it) Z.ui.toast('Got ' + it.name, 'gold'); }
    if (q.rewardRp) Z.game.awardRp(q.rewardRp);
    Z.state.persist(); Z.audio.sfx.rank(); Z.ui.toast('Bounty done: ' + q.title, 'gold'); render();
    renderObjective(); updateBadge();
  }
  function check() {
    const now = new Set(D.quests.filter(claimable).map((q) => q.id));
    now.forEach((id) => { if (!lastClaim.has(id)) Z.ui.toast('Bounty ready: ' + D.quests.find((x) => x.id === id).title); });
    lastClaim = now;
    renderObjective(); updateBadge();
  }

  // ---------- current objective (surfaced in town + phone) ----------
  function nextMission() {
    const undone = D.MISSIONS.filter((m) => !Z.state.missionsDone[m.id]).sort((a, b) => a.minRank - b.minRank);
    const ready = undone.filter((m) => Z.state.rankTier >= m.minRank);
    return ready[0] || undone[0] || null;
  }
  // returns { tag, title, sub, pct } describing what to do next, or null
  function objInfo() {
    const cb = D.quests.filter(claimable).sort((a, b) => rankOf(a) - rankOf(b))[0];
    if (cb) return { tag: 'READY TO COLLECT', title: cb.title, sub: 'Open the board on your phone to claim it', pct: 1 };
    const m = nextMission();
    if (m) {
      const locked = Z.state.rankTier < m.minRank;
      const dist = D.districtById(m.district);
      return {
        tag: 'OBJECTIVE', title: m.title,
        sub: locked ? ('Reach rank ' + m.minRank + ' to take this request') : ('Request board' + (dist ? ' — free ' + dist.name : '')),
        pct: 0,
      };
    }
    if (Z.state.won) return { tag: 'SPIRIT TOWN', title: 'The town is free. Rest easy, keeper.', sub: '', pct: 1 };
    return { tag: 'OBJECTIVE', title: 'Win the last district back', sub: 'Check the request board', pct: 1 };
  }
  function renderObjective() {
    const el = document.getElementById('objSlip'); if (!el) return;
    const o = objInfo(); if (!o) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.innerHTML = `<span class="obj-tag">${o.tag}</span><b>${o.title}</b>` + (o.sub ? `<span class="obj-sub">${o.sub}</span>` : '');
  }
  function updateBadge() {
    const b = document.getElementById('phoneBadge'); if (!b) return;
    const n = claimableCount();
    b.style.display = n > 0 ? '' : 'none'; b.textContent = n > 0 ? String(n) : '';
  }
  function openBoard() { Z.audio && Z.audio.sfx.click(); Z.ui.show('quests'); }

  // ---------- render ----------
  function render() {
    const tabs = $('#boardTabs'); if (!tabs) return; U.clear(tabs);
    [['requests', 'REQUESTS'], ['bounties', 'BOUNTIES']].forEach(([k, l]) => {
      const b = U.el('button', 'fbtn' + (tab === k ? ' on' : ''), l);
      b.addEventListener('click', () => { tab = k; Z.audio.sfx.click(); render(); });
      tabs.appendChild(b);
    });
    const mHost = $('#missionList'), qHost = $('#questList');
    mHost.style.display = tab === 'requests' ? '' : 'none';
    qHost.style.display = tab === 'bounties' ? '' : 'none';
    if (tab === 'requests') renderMissions(mHost); else renderBounties(qHost);
    Z.ui.updateWallet();
  }

  function renderMissions(host) {
    U.clear(host);
    const restoredN = Object.keys(Z.state.restored).length;
    const head = U.el('div', 'quest');
    head.innerHTML = `<h3>SPIRIT TOWN RESTORATION</h3><p>Drive KANE-CO out, place by place. The town remembers who fought for it.</p>
      <div class="q-prog"><i style="width:${Math.round(restoredN / Math.max(1, D.DISTRICTS.length) * 100)}%"></i></div>
      <div class="q-foot"><span class="q-rew">${restoredN}/${D.DISTRICTS.length} districts restored</span></div>`;
    host.appendChild(head);
    D.MISSIONS.forEach((m) => {
      const doneM = !!Z.state.missionsDone[m.id];
      const locked = Z.state.rankTier < m.minRank;
      const dist = D.districtById(m.district);
      const card = U.el('div', 'quest' + (doneM ? ' done' : '') + (locked ? ' locked' : ''));
      card.innerHTML = `${doneM ? '<div class="q-badge">RESTORED</div>' : ''}
        <h3>${m.title}</h3>
        <div class="q-client">from ${m.client} — ${dist ? dist.name : ''}</div>
        <p>${m.desc}</p>
        <div class="q-foot"><span class="q-rew">${m.waves.length} wave${m.waves.length > 1 ? 's' : ''} · +${U.fmt(m.rewardCredits)} · +${m.rewardRp} rank</span>
        <span style="color:var(--ink2)">${locked ? 'Needs rank ' + m.minRank : ''}</span></div>`;
      if (!locked && !doneM) {
        // partner picker
        const row = U.el('div', 'partner-row');
        D.CREW.forEach((c) => {
          const p = U.el('div', 'partner' + (chosenPartner[m.id] === c.id ? ' sel' : ''));
          p.innerHTML = `<img src="${Z.crew.SPRITE[c.id]}" alt=""><span>${c.name.split(' ')[0]}</span><span class="p-rank">R${Z.state.friendRank(c.id)}</span>`;
          p.addEventListener('click', () => { chosenPartner[m.id] = chosenPartner[m.id] === c.id ? null : c.id; Z.audio.sfx.hover(); render(); });
          row.appendChild(p);
        });
        card.appendChild(row);
        const go = U.el('button', 'pbtn stamp', chosenPartner[m.id] ? 'GO — WITH ' + (D.crewById(chosenPartner[m.id]).name.split(' ')[0]).toUpperCase() : 'GO SOLO');
        go.addEventListener('click', () => startMission(m));
        card.appendChild(go);
      } else if (doneM) {
        const re = U.el('button', 'pbtn tiny', 'SWEEP AGAIN (half pay)');
        re.addEventListener('click', () => startMission(m, true));
        card.appendChild(re);
      }
      host.appendChild(card);
    });
  }

  function startMission(m, repeat) {
    const c = Z.Bot.compute(Z.state.build);
    if (!c.ready) { Z.audio.sfx.error(); Z.ui.toast('Puppet needs a prayer wheel and footwear first', 'warn'); return; }
    const first = D.enemyById(m.waves[0]);
    const def = repeat ? Object.assign({}, m, { rewardCredits: Math.round(m.rewardCredits / 2), rewardRp: Math.round(m.rewardRp / 3) }) : m;
    c.spec.name = Z.state.botName;
    Z.audio.sfx.click();
    const partnerId = chosenPartner[m.id] || null;
    const partner = partnerId ? D.crewById(partnerId) : null;
    const dist = D.districtById(m.district);
    const go = () => Z.combat.start(c.spec, first, { mission: { def, partner: partnerId } });
    if (repeat) { go(); return; }   // no briefing on sweeps
    const scene = [
      { who: m.client, text: m.desc },
      partner ? { who: partner.name, img: partner.id, text: U.choice(partner.banter) } : null,
      { who: first.name, evil: true, side: 'right', text: first.taunt },
      { who: dist ? dist.name : 'THE JOB', text: (m.waves.length > 1 ? m.waves.length + ' waves of machines hold this place. ' : 'One machine holds this place. ') + 'Break them and bring it home.' },
    ];
    Z.cutscene.play(scene, go);
  }

  function renderBounties(host) {
    U.clear(host);
    D.quests.slice().sort((a, b) => rankOf(a) - rankOf(b)).forEach((q) => {
      const p = Math.min(progress(q), q.target), cl = claimable(q), cd = claimed(q);
      const card = U.el('div', 'quest' + (cd ? ' done' : '') + (cl ? ' claimable' : ''));
      const rew = []; if (q.rewardCredits) rew.push('+' + q.rewardCredits); if (q.rewardScrap) rew.push(q.rewardScrap + ' scrap'); if (q.rewardRp) rew.push(q.rewardRp + ' rank');
      if (q.rewardPartId) { const it = D.itemById(q.rewardPartId); if (it) rew.push(`<span style="color:${D.rarityColor(it.rarity)}">${it.name}</span>`); }
      card.innerHTML = `${cd ? '<div class="q-badge">DONE</div>' : cl ? '<div class="q-badge">READY</div>' : ''}<h3>${q.title}</h3><p>${q.desc}</p>
        <div class="q-prog"><i style="width:${Math.round(p / q.target * 100)}%"></i></div>
        <div class="q-foot"><span class="q-rew">${rew.join(' · ')}</span><span style="color:var(--ink2)">${p}/${q.target}</span></div>`;
      if (cl) { const b = U.el('button', 'pbtn stamp', 'CLAIM'); b.style.marginTop = '10px'; b.addEventListener('click', () => claim(q)); card.appendChild(b); }
      host.appendChild(card);
    });
  }
  function rankOf(q) { return claimable(q) ? 0 : claimed(q) ? 2 : 1; }

  function init() {
    Z.ui.onEnter('quests', render);
    Z.ui.onEnter('world', () => { renderObjective(); updateBadge(); });
    const slip = document.getElementById('objSlip');
    if (slip) slip.addEventListener('click', openBoard);
    lastClaim = new Set(D.quests.filter(claimable).map((q) => q.id));
  }
  return { init, render, check, claimableCount, progress, objInfo, renderObjective, updateBadge, openBoard };
})();
