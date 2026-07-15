/* ================================================================
   game.js — bootstrap + main loop for STREET SCRAPPERS.
   ================================================================ */
Z.game = (function () {
  const U = Z.util, $ = U.$, D = Z.data;
  let last = 0, clock = 0;

  function awardRp(n) {
    const reached = Z.state.addRp(n);
    reached.forEach((rk) => { Z.state.addCredits(rk.reward); Z.audio.sfx.rank(); Z.fx.screenFlash(0.25, D.PAL.amber); Z.ui.toast('RANK UP — ' + rk.name + ' (+$' + U.fmt(rk.reward) + ')', 'gold'); });
    Z.ui.updateWallet();
    return reached;
  }
  function onChampionDefeated() { Z.ui.toast('YOU ARE KING OF THE BLOCK', 'gold'); }

  const BOOT = ['booting block-7 grid ......... ok', 'spooling scrap index ......... ok', 'lighting the strip ........... ok', 'the pit is open. good luck, kid.'];
  function boot() {
    const bar = $('.boot-bar i'), log = $('#bootLog'); let i = 0, p = 0;
    $('#titleSub') && ($('#titleSub').textContent = D.style.worldLore);
    const iv = setInterval(() => {
      p = Math.min(100, p + U.rand(14, 28)); if (bar) bar.style.width = p + '%';
      if (i < BOOT.length && p > (i + 1) * 20) { log.textContent += (log.textContent ? '\n' : '') + '> ' + BOOT[i]; i++; }
      if (p >= 100 && i >= BOOT.length) { clearInterval(iv); setTimeout(() => Z.ui.show('title'), 450); }
    }, 240);
  }

  function loop(now) {
    requestAnimationFrame(loop);
    if (!last) last = now; let dt = (now - last) / 1000; last = now; if (dt > 0.05) dt = 0.05;
    clock += dt;
    Z.render.setFrameDt(dt); Z.fx.update(dt);
    const cur = Z.ui.current;
    if (cur === 'battle' && Z.combat.active) Z.combat.update(dt);
    if (cur === 'world') Z.overworld.frame(dt, clock);
    else if (cur === 'battle' && Z.combat.active) Z.combat.render();
    else { Z.render.clear(); Z.render.ambient(clock); }
    if (cur === 'workbench') Z.workbench.draw(clock);
    Z.fx.renderScreen(Z.render.ctx, Z.render.W, Z.render.H);
  }

  function init() {
    Z.state.init();
    Z.render.init(document.getElementById('stage'));
    Z.assets.load();
    Z.audio.init();
    Z.controls.init();
    Z.ui.init();
    Z.workbench.init(); Z.scavenge.init(); Z.shop.init(); Z.ramen.init(); Z.quests.init(); Z.ladder.init(); Z.overworld.init();

    Z.ui.registerAction('play', () => { Z.audio.resume(); Z.ui.show('world'); });
    Z.ui.registerAction('reset', () => { if (confirm('Wipe your save and start over from the gutter?')) { Z.state.reset(); Z.ui.toast('Save wiped.', 'warn'); } });
    document.addEventListener('pointerdown', () => Z.audio.resume(), { once: true });

    boot();
    requestAnimationFrame(loop);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  return { awardRp, onChampionDefeated, get clock() { return clock; } };
})();
