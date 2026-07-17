/* ================================================================
   assets.js — image loader for the uploaded art + drop-in slots.
   ================================================================ */
Z.assets = (function () {
  const MANIFEST = {
    // optional animation sheets (4 cols x 2 rows) — drop them in and they're used automatically
    'sheet.tanuki': 'assets/char/tanuki_sheet.png',
    'sheet.kappa':  'assets/char/kappa_sheet.png',
    'char.tanuki':  'assets/char/tanuki.png',
    'char.tengu':   'assets/char/tengu.png',
    'char.kappa':   'assets/char/kappa.png',
    'char.oni':     'assets/char/oni.png',
    'char.ao':      'assets/char/aoyokai.png',
    'world.street': 'assets/world/street.jpg',
    'world.izakaya':'assets/world/izakaya.jpg',
    'battle.arena': 'assets/battle/arena.jpg',
    'ramen.inside': 'assets/ramen/interior.jpg',
  };
  const imgs = {}, status = {};
  function load() {
    Object.keys(MANIFEST).forEach((k) => {
      const im = new Image();
      status[k] = 'loading';
      im.onload = () => { status[k] = im.naturalWidth ? 'ok' : 'miss'; };
      im.onerror = () => { status[k] = 'miss'; };
      im.src = MANIFEST[k];
      imgs[k] = im;
    });
  }
  const ready = (k) => status[k] === 'ok';
  const img = (k) => (status[k] === 'ok' ? imgs[k] : null);

  // draw image scaled to fit-cover a rect; silent if missing
  function cover(ctx, k, x, y, w, h, offX) {
    const im = img(k); if (!im) return false;
    const s = Math.max(w / im.naturalWidth, h / im.naturalHeight);
    const dw = im.naturalWidth * s, dh = im.naturalHeight * s;
    let ox = x + (w - dw) * (offX == null ? 0.5 : offX);
    ctx.drawImage(im, ox, y + (h - dh), dw, dh);
    return true;
  }
  function draw(ctx, k, x, y, w, h) { const im = img(k); if (!im) return false; ctx.drawImage(im, x, y, w, h); return true; }

  return { MANIFEST, load, ready, img, draw, cover };
})();
