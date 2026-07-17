/* ================================================================
   ladder.js — THE PIT. Pick a rival; fight starts immediately.
   ================================================================ */
Z.ladder = (function () {
  const U = Z.util, $ = U.$, D = Z.data;
  let selected = null;
  const rpFor = (en) => 15 + en.tier * 12;
  function playerSpec() { const c = Z.Bot.compute(Z.state.build); c.spec.name = Z.state.botName; return c.spec; }

  function render() {
    const host = $('#ladderList'); if (!host) return; U.clear(host);
    const maxT = Z.state.maxChallengeTier();
    D.enemies.slice().sort((a, b) => a.tier - b.tier).forEach((en) => {
      const locked = en.tier > maxT, beaten = !!Z.state.beaten[en.id];
      const row = U.el('div', 'opp' + (locked ? ' locked' : '') + (beaten ? ' beaten' : '') + (en.isChampion ? ' champ' : ''));
      const port = U.el('canvas'); port.width = 76; port.height = 64; port.className = 'opp-portrait'; row.appendChild(port);
      const mid = U.el('div', 'opp-mid');
      mid.innerHTML = `<div class="opp-tier">TIER ${en.tier}${en.isChampion ? ' · CHAMP' : ''}${beaten ? ' · BEAT' : ''}</div><div class="opp-name" style="${en.isChampion ? '' : 'color:' + en.color}">${en.name}</div><div class="opp-bio">${locked ? 'Climb the ranks to challenge.' : en.bio}</div>`;
      row.appendChild(mid);
      const right = U.el('div', 'opp-right'); right.innerHTML = `<div class="opp-purse">¥${U.fmt(en.purse)}</div><div class="opp-arch">${en.archetype}</div>`; row.appendChild(right);
      row.addEventListener('click', () => { if (locked) { Z.audio.sfx.error(); Z.ui.toast('Locked — earn more rank first', 'warn'); } else fight(en); });
      host.appendChild(row);
      Z.render.drawBotPreview(port, Z.Bot.fromEnemy(en), 0, { facing: -1 });
    });
    Z.ui.updateWallet();
  }
  function fight(en) {
    selected = en; Z.audio.sfx.click();
    const go = () => Z.combat.start(playerSpec(), en, { rp: rpFor(en) });
    if (en.isChampion && !Z.state.beaten[en.id]) {
      Z.cutscene.play([
        { who: 'Ao', img: 'ao', text: 'The flagship unit. Every puppet that faced it came home as firewood.' },
        { who: en.name, evil: true, side: 'right', text: en.taunt },
        { who: 'Ao', img: 'ao', text: 'Breathe. Parry what you can, jump what you cannot. The whole town is watching, tanuki.' },
      ], go);
    } else if (!Z.state.beaten[en.id]) {
      Z.cutscene.play([{ who: en.name, evil: true, side: 'right', text: en.taunt }], go);
    } else go();
  }
  function init() { Z.ui.onEnter('ladder', render); Z.ui.registerAction('rematch', () => { if (selected) fight(selected); else Z.ui.show('ladder'); }); }
  return { init, render };
})();
