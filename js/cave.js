/* cave.js — the oni model-kit shop in the workshop cave: buy mechs + components. (stub) */
Z.cave = (function () {
  function frame(dt, t) {
    const ctx = Z.render.ctx, W = Z.render.W, H = Z.render.H;
    Z.render.clear();
    if (!Z.assets.cover(ctx, 'cave.shop', 0, 0, W, H, 0.5)) { ctx.fillStyle = '#241a12'; ctx.fillRect(0, 0, W, H); }
    Z.render.drawPetals(t);
  }
  function init() {}
  return { init, frame };
})();
