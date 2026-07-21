/* ================================================================
   game.js — bootstrap + main loop for STREET SCRAPPERS.
   ================================================================ */
Z.game = (function () {
  const U = Z.util, $ = U.$, D = Z.data;
  let last = 0, clock = 0;

  function awardRp(n) {
    const reached = Z.state.addRp(n);
    reached.forEach((rk) => { Z.state.addCredits(rk.reward); Z.audio.sfx.rank(); Z.fx.screenFlash(0.25, D.PAL.amber); Z.ui.toast('RANK UP — ' + rk.name + ' (+' + U.fmt(rk.reward) + ')', 'gold'); });
    Z.ui.updateWallet();
    return reached;
  }
  function onChampionDefeated() { Z.ui.toast('GRAND CHAMPION OF THE DOHYO', 'gold'); }

  const BOOT = (D.BOOT_LINES && D.BOOT_LINES.length) ? D.BOOT_LINES : ['waking the shrine spirits ... ok', 'stringing the puppets ....... ok', 'lighting the lanterns ....... ok', 'spirit town is open. welcome home.'];
  function boot() {
    const bar = $('.boot-bar i'), log = $('#bootLog'); let i = 0, p = 0;
    $('#titleSub') && ($('#titleSub').textContent = D.LORE || D.style.worldLore);
    const revealLine = () => { if (log && i < BOOT.length) { log.textContent += (log.textContent ? '\n' : '') + '> ' + BOOT[i]; i++; } };
    const finish = () => { while (i < BOOT.length) revealLine(); setTimeout(() => Z.ui.show('title'), 450); };
    const iv = setInterval(() => {
      p = Math.min(100, p + U.rand(14, 28)); if (bar) bar.style.width = p + '%';
      // reveal lines spaced across the bar; last line lands just before 100%
      if (i < BOOT.length && p >= (i + 1) * (100 / (BOOT.length + 1))) revealLine();
      if (p >= 100) { clearInterval(iv); finish(); }
    }, 240);
  }

  function loop(now) {
    requestAnimationFrame(loop);
    if (!last) last = now; let dt = (now - last) / 1000; last = now; if (dt > 0.05) dt = 0.05;
    clock += dt;
    Z.render.setFrameDt(dt); Z.fx.update(dt);
    if (Z.clock) Z.clock.update(dt);                     // advance the day/night clock
    const cur = Z.ui.current;
    if (cur === 'battle' && Z.combat.active && !(Z.cutscene && Z.cutscene.active)) Z.combat.update(dt);
    if (cur === 'world') Z.overworld.frame(dt, clock);
    else if (cur === 'ramen') Z.ramen.frame(dt, clock);
    else if (cur === 'shop') Z.shop.frame(dt, clock);
    else if (cur === 'house' && Z.house) Z.house.frame(dt, clock);
    else if (cur === 'cave' && Z.cave) Z.cave.frame(dt, clock);
    else if (cur === 'menu' && Z.menu) Z.menu.frame(dt, clock);
    else if (cur === 'raidmap' && Z.phone && Z.phone.mapFrame) Z.phone.mapFrame(dt, clock);
    else if (cur === 'infil') Z.infil.frame(dt, clock);
    else if (cur === 'battle' && Z.combat.active) Z.combat.render();
    else { Z.render.clear(); Z.render.ambient(clock); }
    if (cur === 'workbench') Z.workbench.frame(dt, clock);
    Z.fx.renderScreen(Z.render.ctx, Z.render.W, Z.render.H);
  }

  function init() {
    Z.state.init();
    Z.render.init(document.getElementById('stage'));
    Z.assets.load();
    Z.audio.init();
    Z.controls.init();
    Z.ui.init();
    Z.workbench.init(); Z.scavenge.init(); Z.shop.init(); Z.ramen.init(); Z.crew.init(); Z.quests.init(); Z.ladder.init(); Z.infil.init(); Z.overworld.init();
    if (Z.house) Z.house.init(); if (Z.cave) Z.cave.init(); if (Z.menu) Z.menu.init();
    if (Z.clock) Z.clock.init(); if (Z.phone) Z.phone.init(); if (Z.story) Z.story.init();

    Z.ui.registerAction('play', () => {
      Z.audio.resume(); Z.ui.show('world');
      if (Z.story) Z.story.check('start');       // intro beat b0 (owned by story.js)
    });
    Z.ui.registerAction('worldFromInfil', () => { Z.infil.leave(); Z.ui.show('world'); });
    Z.ui.registerAction('reset', () => { if (confirm('Start a brand new journey? Your current save will be swept away.')) { Z.state.reset(); Z.ui.toast('Save wiped.', 'warn'); } });
    document.addEventListener('pointerdown', () => Z.audio.resume(), { once: true });

    boot();
    requestAnimationFrame(loop);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  return { awardRp, onChampionDefeated, get clock() { return clock; } };
})();
