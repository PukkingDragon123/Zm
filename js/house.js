/* house.js — walkable home interior; walk to the crafting table to build. (stub) */
Z.house = (function () {
  const U = Z.util;
  function frame(dt, t) {
    const ctx = Z.render.ctx, W = Z.render.W, H = Z.render.H;
    Z.render.clear();
    if (!Z.assets.cover(ctx, 'world.house', 0, 0, W, H, 0.5)) { ctx.fillStyle = '#2a1c10'; ctx.fillRect(0, 0, W, H); }
    Z.render.drawPetals(t);
  }
  function init() {}
  return { init, frame };
})();
