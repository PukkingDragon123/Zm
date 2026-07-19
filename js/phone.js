/* phone.js — the tanuki's phone: quests (day) + raid map (night). (stub) */
Z.phone = (function () {
  let open = false;
  function toggle() { open = !open; const el = document.getElementById('phone'); if (el) el.classList.toggle('on', open); }
  function mapFrame(dt, t) {
    const ctx = Z.render.ctx, W = Z.render.W, H = Z.render.H;
    Z.render.clear();
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#10131c'); g.addColorStop(1, '#1c2233');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function init() {}
  return { init, toggle, mapFrame };
})();
