/* ================================================================
   ramen.js — OL' BOY RAMEN. Buy a bowl for a one-fight buff.
   ================================================================ */
Z.ramen = (function () {
  const U = Z.util, $ = U.$, D = Z.data;
  const LINES = () => (D.AO_LINES && D.AO_LINES.length ? D.AO_LINES.map((l) => '<b>Ao:</b> "' + l + '"') : ['<b>Ao:</b> "Eat first. Fight after."']);

  function buy(dish) {
    if (Z.state.buff && Z.state.buff.id === dish.id) { Z.ui.toast('Already got that in you', 'warn'); return; }
    if (!Z.state.spend(dish.price)) { Z.audio.sfx.error(); Z.ui.toast('Not enough cash', 'warn'); return; }
    Z.state.setBuff({ id: dish.id, name: dish.name, hpMul: dish.hpMul, powMul: dish.powMul });
    Z.audio.sfx.buy(); Z.ui.toast('Ate ' + dish.name + ' — buff ready for next fight', 'gold');
    render();
  }

  function render() {
    const npc = $('#ramenNpc'); if (npc) npc.innerHTML = U.choice(LINES()) + (Z.state.buff ? `<br><b>Belly full: ${Z.state.buff.name}</b> (until your next scrap)` : '');
    const host = $('#ramenList'); if (!host) return; U.clear(host);
    D.RAMEN.forEach((dish) => {
      const active = Z.state.buff && Z.state.buff.id === dish.id;
      const card = U.el('div', 'dish');
      const hp = Math.round((dish.hpMul - 1) * 100), pw = Math.round((dish.powMul - 1) * 100);
      card.innerHTML = `<h3>${dish.name}</h3><p>${dish.desc}</p>
        <div class="d-foot"><span class="q-rew">+${hp}% HP${pw ? ' · +' + pw + '% PWR' : ''}</span>
        <span class="d-price">¥${dish.price}</span></div>`;
      const b = U.el('button', 'pbtn tiny', active ? 'READY' : 'EAT'); b.style.marginTop = '10px'; b.disabled = active || Z.state.credits < dish.price;
      b.addEventListener('click', () => buy(dish));
      card.appendChild(b);
      host.appendChild(card);
    });
    Z.ui.updateWallet();
  }
  function init() { Z.ui.onEnter('ramen', render); }
  return { init, render };
})();
