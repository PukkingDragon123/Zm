/* ================================================================
   ramen.js — AO'S RAMEN as a playable scene: you walk in, hop onto
   a stool at the counter, Ao greets you, then you order.
   ================================================================ */
Z.ramen = (function () {
  const U = Z.util, $ = U.$, D = Z.data;
  let walkX = 0, seated = false, seatT = 0, entered = false, greetLine = '';
  const LINES = () => (D.AO_LINES && D.AO_LINES.length ? D.AO_LINES : ['Eat first. Fight after.']);

  function enter() {
    entered = true; seated = false; seatT = 0; walkX = -80;
    greetLine = U.choice(LINES());
    $('#ramenNpc').classList.remove('on');
    $('#ramenList').classList.remove('on');
    renderMenu();
  }

  // canvas scene, called from the game loop while on the ramen screen
  function frame(dt, t) {
    const ctx = Z.render.ctx, W = Z.render.W, H = Z.render.H;
    Z.render.clear();
    if (!Z.assets.cover(ctx, 'ramen.inside', 0, 0, W, H, 0.5)) {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#3a2a18'); g.addColorStop(1, '#241a10');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    ctx.fillStyle = 'rgba(30,18,8,.24)'; ctx.fillRect(0, 0, W, H);
    const groundY = H * 0.88, seatX = W * 0.42, stoolH = 46;
    // counter-side warm lamp glow
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const lg = ctx.createRadialGradient(W * 0.6, H * 0.3, 10, W * 0.6, H * 0.3, W * 0.4);
    lg.addColorStop(0, 'rgba(255,200,120,.14)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H); ctx.restore();

    // Ao sweeping behind the counter (right side)
    const aoBob = Math.abs(Math.sin(t * 2)) * 4;
    Z.render.drawSprite('char.ao', W * 0.72, groundY - 6, { w: 150, bob: aoBob, squash: Math.sin(t * 4) * 0.03, sway: Math.sin(t * 1.9) * 0.06, facing: -1 });
    // Ao speech once seated
    if (seated && seatT > 0.5) speechBubble(ctx, W * 0.72, groundY - 220, greetLine);

    // paper stool
    Z.render.paperFill(ctx, () => { Z.render.roundRect(ctx, seatX - 26, groundY - stoolH, 52, 12, 5); }, '#b0844f', { cut: 3.4 });
    Z.render.paperFill(ctx, () => { ctx.beginPath(); ctx.rect(seatX - 5, groundY - stoolH + 10, 10, stoolH - 12); }, '#8a6a45', { noShadow: true, cut: 3 });

    // the tanuki: walk in, hop up, sit
    if (!seated) {
      walkX += dt * 240;
      const target = seatX - 4;
      if (walkX >= target) { seated = true; walkX = target; Z.audio.sfx.flip(); Z.fx.dust(seatX, groundY - stoolH, 4, '#cbb489'); }
      const wt = t * 9;
      Z.render.drawSprite('char.tanuki', walkX, groundY, { w: 120, bob: Math.abs(Math.sin(wt)) * 6, squash: Math.cos(wt * 2) * 0.04, facing: 1, anim: 'walk', animT: t });
    } else {
      seatT += dt;
      const hop = Math.min(1, seatT * 4);
      const sy = groundY - stoolH * U.ease.outBack(hop);
      Z.render.drawSprite('char.tanuki', seatX, sy, { w: 116, bob: Math.sin(t * 2.2) * 2.4, squash: Math.sin(t * 2.2) * 0.02, facing: 1, anim: seatT > 0.6 ? 'happy' : 'jump', animT: t });
      if (seatT > 0.7 && !$('#ramenNpc').classList.contains('on')) {
        $('#ramenNpc').classList.add('on'); $('#ramenList').classList.add('on');
        Z.audio.sfx.coin();
      }
    }
    Z.render.drawPetals(t);
  }

  function speechBubble(ctx, x, y, text) {
    const lines = wrap(text, 26), w = 240, h = 18 + lines.length * 19;
    const bx = Math.min(x, Z.render.W - w / 2 - 10);
    Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, bx - w / 2, y - h, w, h, 13), '#f5ecd7', { cut: 0.001 });
    ctx.fillStyle = '#2f2418'; ctx.textAlign = 'center'; ctx.font = "700 16px 'Zen Maru Gothic', sans-serif";
    lines.forEach((ln, i) => ctx.fillText(ln, bx, y - h + 24 + i * 19));
  }
  function wrap(t, n) { const w = t.split(' '), out = []; let l = ''; for (const word of w) { if ((l + word).length > n) { out.push(l.trim()); l = ''; } l += word + ' '; } if (l.trim()) out.push(l.trim()); return out; }

  function buy(dish) {
    if (Z.state.buff && Z.state.buff.id === dish.id) { Z.ui.toast('Already got that in you', 'warn'); return; }
    if (!Z.state.spend(dish.price)) { Z.audio.sfx.error(); Z.ui.toast('Not enough cash', 'warn'); return; }
    Z.state.setBuff({ id: dish.id, name: dish.name, hpMul: dish.hpMul, powMul: dish.powMul });
    Z.audio.sfx.buy(); Z.ui.toast('Ate ' + dish.name + ' — ready for the next scrap', 'gold');
    greetLine = U.choice(LINES());
    renderMenu();
  }

  function renderMenu() {
    const npc = $('#ramenNpc'); if (npc) npc.innerHTML = '<b>Ao:</b> "What will it be?"' + (Z.state.buff ? ` <b>Belly full: ${Z.state.buff.name}</b>` : '');
    const host = $('#ramenList'); if (!host) return; U.clear(host);
    D.RAMEN.forEach((dish) => {
      const active = Z.state.buff && Z.state.buff.id === dish.id;
      const card = U.el('div', 'dish');
      const hp = Math.round((dish.hpMul - 1) * 100), pw = Math.round((dish.powMul - 1) * 100);
      card.innerHTML = `<div class="d-head"><canvas class="d-ic"></canvas><h3>${dish.name}</h3></div><p>${dish.desc}</p>
        <div class="d-foot"><span class="q-rew">+${hp}% HP${pw ? ' · +' + pw + '% PWR' : ''}</span>
        <span class="d-price">¥${dish.price}</span></div>`;
      Z.render.drawFoodIcon(card.querySelector('.d-ic'), dish);
      const b = U.el('button', 'pbtn tiny' + (active ? '' : ' stamp'), active ? 'EATEN' : 'ORDER');
      b.style.marginTop = '10px'; b.disabled = active || Z.state.credits < dish.price;
      b.addEventListener('click', () => buy(dish));
      card.appendChild(b);
      host.appendChild(card);
    });
    Z.ui.updateWallet();
  }

  function init() { Z.ui.onEnter('ramen', enter); }
  return { init, frame, render: renderMenu };
})();
