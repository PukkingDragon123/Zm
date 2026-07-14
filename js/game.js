/* ================================================================
   game.js — bootstrap, main loop, hub, rank-up handling, wiring
   ================================================================ */
Z.game = (function () {
  const U = Z.util, $ = U.$;
  const D = Z.data;
  let last = 0, clock = 0, raf = 0;
  let hubCanvas = null;

  // ---------- rank-up / rewards ----------
  function awardRp(n) {
    const reached = Z.state.addRp(n);
    reached.forEach((rk) => {
      Z.state.addCredits(rk.reward);
      Z.audio.sfx.rank();
      Z.fx.screenFlash(0.3, D.PAL.neonC);
      Z.ui.toast('▲ RANK UP — ' + rk.name + '  (+' + U.fmt(rk.reward) + '₡)', 'gold');
    });
    Z.ui.updateWallet();
    return reached;
  }
  function onChampionDefeated() {
    Z.ui.toast('👑 YOU ARE THE ULTIMATE ZUMO!', 'gold');
  }

  // ---------- boot sequence ----------
  const bootLines = [
    '> mounting /dev/scrapyard ............ OK',
    '> spooling neon grid ................ OK',
    '> calibrating dohyo sensors ......... OK',
    '> loading rival bracket ............. OK',
    '> ' + D.style.uiCopy.blurbs.boot,
  ];
  function boot() {
    const bar = $('.boot-bar i'), log = $('#bootLog');
    let i = 0, prog = 0;
    $('#titleKicker').textContent = D.style.uiCopy.subtitle.toUpperCase();
    $('#titleSub').textContent = D.style.worldLore;
    const tick = setInterval(() => {
      prog = Math.min(100, prog + U.rand(12, 26));
      if (bar) bar.style.width = prog + '%';
      if (i < bootLines.length && prog > (i + 1) * 18) { log.textContent += (log.textContent ? '\n' : '') + bootLines[i]; i++; }
      if (prog >= 100 && i >= bootLines.length) {
        clearInterval(tick);
        setTimeout(() => Z.ui.show('title'), 500);
      }
    }, 260);
  }

  // ---------- hub ----------
  function renderHub() {
    const stage = $('#hubBotStage'); if (!stage) return;
    if (!hubCanvas) { hubCanvas = U.el('canvas'); hubCanvas.style.cssText = 'width:100%;height:100%;display:block'; stage.appendChild(hubCanvas); }
    $('#hubBotName').textContent = Z.state.botName;
    const c = Z.Bot.compute(Z.state.build);
    const sp = c.spec;
    const stats = $('#hubBotStats');
    const list = Z.Bot.statList(sp);
    list.push({ k: 'RATING', v: sp.rating });
    let html = list.map((s) => `<div class="st"><i>${s.k}</i><b>${s.v}</b></div>`).join('');
    html += `<div class="st"><i>STATUS</i><b style="color:${c.ready ? (sp.overdraw ? 'var(--warn)' : 'var(--neonC)') : 'var(--warn)'}">${!c.ready ? 'INCOMPLETE' : sp.overdraw ? 'OVERDRAWN' : 'READY'}</b></div>`;
    stats.innerHTML = html;
  }
  function drawHubPreview(t) { if (hubCanvas && Z.ui.current === 'hub') Z.render.drawBotPreview(hubCanvas, Z.Bot.compute(Z.state.build).spec, t); }

  // ---------- main loop ----------
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (!last) last = now;
    let realDt = (now - last) / 1000; last = now;
    if (realDt > 0.05) realDt = 0.05;
    clock += realDt;

    Z.render.setFrameDt(realDt);
    Z.fx.update(realDt);

    const cur = Z.ui.current;
    if (cur === 'combat' && Z.combat.active) {
      Z.combat.update(realDt);
      Z.combat.render();
    } else {
      Z.render.clear();
      Z.render.background(clock);
      if (cur === 'hub') drawHubPreview(clock);
      else if (cur === 'workshop') Z.workshop.drawPreview(clock);
      else if (cur === 'prefight') Z.ladder.drawPrefight(clock);
    }
  }

  // ---------- init ----------
  function init() {
    Z.state.init();
    Z.render.init(document.getElementById('stage'));
    Z.audio.init();
    Z.ui.init();
    Z.workshop.init();
    Z.scavenge.init();
    Z.shop.init();
    Z.quests.init();
    Z.ladder.init();

    // hub enter hook
    Z.ui.onEnter('hub', renderHub);
    Z.util.bus.on('wallet', () => { if (Z.ui.current === 'hub') renderHub(); });
    Z.util.bus.on('inventory', () => { if (Z.ui.current === 'hub') renderHub(); });

    // title actions
    Z.ui.registerAction('play', () => { Z.audio.resume(); Z.ui.show('hub'); if (!Z.state.tutorialSeen) { Z.state.tutorialSeen = true; Z.state.persist(); } });
    Z.ui.registerAction('reset', () => {
      if (window.confirm('Wipe your save and start over from the gutter?')) {
        Z.state.reset(); Z.ui.toast('Save wiped. Fresh start.', 'warn');
        Z.workshop.render && Z.workshop.render();
      }
    });
    Z.ui.registerAction('settings', () => Z.ui.show('settings'));

    // touch detection
    if (('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.matchMedia('(pointer:coarse)').matches) {
      document.body.classList.add('touch-on');
    }
    // pointer move on stage cancels tooltip
    document.addEventListener('pointerdown', () => Z.audio.resume(), { once: true });

    $('#verTag') && ($('#verTag').textContent = 'v1.0 · ' + D.style.uiCopy.subtitle);

    boot();
    raf = requestAnimationFrame(loop);
  }

  // kick off
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { awardRp, onChampionDefeated, renderHub, get clock() { return clock; } };
})();
