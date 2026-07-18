/* menu.js — Persona-style navigator: map of areas + missions. (stub) */
Z.menu = (function () {
  function frame(dt, t) {
    const ctx = Z.render.ctx, W = Z.render.W, H = Z.render.H;
    Z.render.clear();
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#1a1030'); g.addColorStop(1, '#3a1030');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function init() {}
  return { init, frame };
})();
