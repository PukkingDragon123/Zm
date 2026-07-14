/* ================================================================
   ladder.js — the ranked ladder + the pre-fight VS ritual
   ================================================================ */
Z.ladder = (function () {
  const U = Z.util, $ = U.$;
  const D = Z.data;
  let selected = null;
  let vsCanvases = { left: null, right: null };

  function playerSpec() { const c = Z.Bot.compute(Z.state.build); c.spec.name = Z.state.botName; return c.spec; }

  function renderList() {
    const host = $('#ladderList'); if (!host) return; U.clear(host);
    const maxT = Z.state.maxChallengeTier();
    const sorted = D.enemies.slice().sort((a, b) => a.tier - b.tier || (a.isChampion ? 1 : 0));
    sorted.forEach((en) => {
      const locked = en.tier > maxT;
      const beaten = !!Z.state.beaten[en.id];
      const row = U.el('div', 'opp' + (locked ? ' locked' : '') + (beaten ? ' beaten' : '') + (en.isChampion ? ' champ' : ''));
      const port = U.el('canvas'); port.width = 72; port.height = 72; port.className = 'opp-portrait';
      row.appendChild(port);
      const mid = U.el('div', 'opp-mid');
      mid.innerHTML = `<div class="opp-tier">TIER ${en.tier}${en.isChampion ? ' · CHAMPION' : ''}${beaten ? ' · DEFEATED' : ''}</div>
        <div class="opp-name" style="${en.isChampion ? '' : 'color:' + en.color}">${en.name}</div>
        <div class="opp-bio">${locked ? '🔒 Reach a higher rank to challenge.' : en.bio}</div>`;
      row.appendChild(mid);
      const right = U.el('div', 'opp-right');
      right.innerHTML = `<div class="opp-purse">${U.fmt(en.purse)}₡</div><div class="opp-arch">${en.archetype}</div>`;
      row.appendChild(right);
      if (!locked) row.addEventListener('click', () => selectOpponent(en));
      else row.addEventListener('click', () => { Z.audio.sfx.error(); Z.ui.toast('Locked — climb the ranks first', 'warn'); });
      host.appendChild(row);
      // draw enemy portrait
      Z.render.drawBotPreview(port, Z.Bot.fromEnemy(en), 0, { bob: false, angle: -Math.PI / 2 });
    });
  }

  function selectOpponent(en) {
    selected = en;
    Z.audio.sfx.click();
    buildPrefight();
    Z.ui.show('prefight');
  }

  function statTags(spec) {
    return `PWR ${Math.round(spec.power)} · SPD ${Math.round(spec.speedStat)} · GRIP ${Math.round(spec.tractionStat)} · ARM ${spec.armor}%`;
  }

  function buildPrefight() {
    const en = selected; if (!en) return;
    const pspec = playerSpec(), espec = Z.Bot.fromEnemy(en);
    const L = $('#vsLeft'), R = $('#vsRight');
    U.clear(L); U.clear(R);
    // player
    const lc = U.el('canvas'); lc.className = 'vs-portrait'; vsCanvases.left = { cv: lc, spec: pspec };
    L.appendChild(lc);
    L.appendChild(nameBlock(Z.state.botName, D.PAL.neonA, 'YOUR RIG · RATING ' + pspec.rating, statTags(pspec)));
    // enemy
    const rc = U.el('canvas'); rc.className = 'vs-portrait'; vsCanvases.right = { cv: rc, spec: espec };
    R.appendChild(rc);
    R.appendChild(nameBlock(en.name, en.isChampion ? D.PAL.gold : en.color, 'TIER ' + en.tier + ' · ' + en.archetype.toUpperCase(), '“' + en.taunt + '”'));
    // arena mini
    const arena = $('#vsArena');
    if (arena) arena.innerHTML = `<div style="font-family:var(--mono);font-size:12px;color:var(--dim);text-align:center">${D.style.uiCopy.arenaName}<br>PURSE <b style="color:var(--gold)">${U.fmt(en.purse)}₡</b> · +${rpFor(en)} RP</div>`;
  }
  function nameBlock(name, color, tag, sub) {
    const d = U.el('div');
    d.innerHTML = `<div class="vs-name" style="color:${color};text-shadow:0 0 20px ${U.rgba(color, .5)}">${name}</div>
      <div class="vs-mini">${tag}</div><div class="vs-tag">${sub}</div>`;
    return d;
  }

  function rpFor(en) { return 15 + en.tier * 12; }

  // animate the two VS portraits (called from main loop)
  function drawPrefight(t) {
    if (Z.ui.current !== 'prefight') return;
    if (vsCanvases.left) Z.render.drawBotPreview(vsCanvases.left.cv, vsCanvases.left.spec, t, { angle: Math.PI / 2 + Math.sin(t * 2) * 0.15 });
    if (vsCanvases.right) Z.render.drawBotPreview(vsCanvases.right.cv, vsCanvases.right.spec, t, { angle: -Math.PI / 2 + Math.sin(t * 2 + 1) * 0.15 });
  }

  function startFight() {
    if (!selected) return;
    Z.combat.start(playerSpec(), selected, { rp: rpFor(selected) });
  }

  function init() {
    Z.ui.onEnter('ladder', renderList);
    Z.ui.registerAction('startFight', startFight);
    Z.ui.registerAction('rematch', () => { if (selected) { buildPrefight(); startFight(); } else Z.ui.show('ladder'); });
  }

  return { init, renderList, drawPrefight, get selected() { return selected; } };
})();
