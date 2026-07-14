/* ================================================================
   assets.js — layered image loader.
   Drop PNGs into /assets with the paths below and they appear as
   layers automatically. Until then, labeled placeholders render.
   ================================================================ */
Z.assets = (function () {
  // key -> file path. Add art here (transparent PNGs recommended).
  const MANIFEST = {
    // world parallax layers (back -> front)
    'world.sky':    'assets/world/sky.png',
    'world.far':    'assets/world/far.png',
    'world.mid':    'assets/world/mid.png',
    'world.near':   'assets/world/near.png',
    'world.ground': 'assets/world/ground.png',
    // building facades along the street
    'bld.house':    'assets/buildings/house.png',
    'bld.toyshop':  'assets/buildings/toyshop.png',
    'bld.ramen':    'assets/buildings/ramen.png',
    'bld.arena':    'assets/buildings/arena.png',
    'bld.scrap':    'assets/buildings/scrap.png',
    'bld.board':    'assets/buildings/board.png',
    // characters (single frame is fine; walk bob is procedural)
    'char.kid':     'assets/char/kid.png',
    'npc.a':        'assets/char/npc_a.png',
    'npc.b':        'assets/char/npc_b.png',
    'npc.c':        'assets/char/npc_c.png',
    // battle
    'battle.bg':    'assets/battle/bg.png',
    'battle.crowd': 'assets/battle/crowd.png',
    'battle.floor': 'assets/battle/floor.png',
    'op.left':      'assets/battle/operator_left.png',
    'op.right':     'assets/battle/operator_right.png',
  };

  const imgs = {}, status = {};
  function load() {
    Object.keys(MANIFEST).forEach((k) => {
      const im = new Image();
      status[k] = 'loading';
      im.onload = () => { if (im.naturalWidth) status[k] = 'ok'; else status[k] = 'miss'; };
      im.onerror = () => { status[k] = 'miss'; };
      im.src = MANIFEST[k];
      imgs[k] = im;
    });
  }
  const ready = (k) => status[k] === 'ok';
  const img = (k) => (status[k] === 'ok' ? imgs[k] : null);

  // Draw image if present, else a gritty labeled placeholder box.
  function draw(ctx, k, x, y, w, h, ph) {
    if (ready(k)) { ctx.drawImage(imgs[k], x, y, w, h); return true; }
    if (ph === false) return false;
    ph = ph || {};
    ctx.save();
    ctx.fillStyle = ph.fill || 'rgba(34,29,22,.55)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = ph.stroke || 'rgba(74,63,48,.9)';
    ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.strokeRect(x + 1, y + 1, w - 2, h - 2); ctx.setLineDash([]);
    if (ph.label !== false && w > 46 && h > 22) {
      ctx.fillStyle = 'rgba(155,143,121,.85)';
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText((ph.label || k).toUpperCase().slice(0, Math.max(4, (w / 9) | 0)), x + w / 2, y + h / 2);
    }
    ctx.restore();
    return false;
  }

  return { MANIFEST, load, ready, img, draw };
})();
