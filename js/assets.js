/* ================================================================
   assets.js — image loader for the uploaded art + drop-in slots.
   ================================================================ */
Z.assets = (function () {
  const MANIFEST = {
    // optional animation sheets (4 cols x 2 rows) — drop them in and they're used automatically
    'sheet.tanuki': 'assets/char/tanuki_sheet.png',
    'sheet.kappa':  'assets/char/kappa_sheet.png',
    'sheet.glide':  'assets/char/tanuki_glide.png',   // 3 hang-glider poses
    'char.tanuki':  'assets/char/tanuki.png',
    'char.tengu':   'assets/char/tengu.png',
    'char.kappa':   'assets/char/kappa.png',
    'char.oni':     'assets/char/oni.png',
    'char.ao':      'assets/char/aoyokai.png',
    'world.street': 'assets/world/street.jpg',
    'world.sakura': 'assets/world/sakura.jpg',
    'world.konbini':'assets/world/konbini.jpg',
    'world.izakaya':'assets/world/izakaya.jpg',
    'world.townview':   'assets/world/townview.jpg',      // crossroad / town map view
    'world.house':      'assets/world/house_interior.jpg',// walkable home
    'world.workbench':  'assets/world/workbench.jpg',     // crafting bench close-up
    'battle.arena': 'assets/battle/arena.jpg',
    'ramen.inside': 'assets/ramen/interior.jpg',
    'ramen.exterior':   'assets/ramen/exterior.jpg',
    'ramen.eating':     'assets/ramen/eating.jpg',        // persona dialogue scene
    'shop.inside':  'assets/shop/interior.jpg',
    'cave.forge':       'assets/cave/forge.jpg',          // workshop outside town
    'cave.shop':        'assets/cave/shop.jpg',           // oni model-kit shop
    'infil.forest': 'assets/infil/forest.jpg',
  };
  // industrial obby tiles t00..t44 (sliced from the uploaded sheet)
  for (let i = 0; i < 45; i++) { const n = 't' + String(i).padStart(2, '0'); MANIFEST['tile.' + n] = 'assets/tiles/' + n + '.png'; }
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
