/* ================================================================
   cutscene.js — letterboxed dialogue scenes with typewriter text.
   play([{who, img, side, text}], onDone). Click / W / SPACE advances.
   ================================================================ */
Z.cutscene = (function () {
  const U = Z.util;
  let layer = null, active = false, queue = [], onDone = null, idx = 0;
  let typing = null, fullText = '';

  const PORTRAIT = {
    tanuki: 'assets/char/tanuki.png', tengu: 'assets/char/tengu.png', kappa: 'assets/char/kappa.png',
    oni: 'assets/char/oni.png', ao: 'assets/char/aoyokai.png',
  };

  function ensure() {
    if (layer) return;
    layer = U.el('div'); layer.id = 'cut';
    layer.innerHTML = `<div class="cut-bar top"></div><div class="cut-bar bot"></div>
      <div class="cut-box paper"><div class="cut-name"></div><img class="cut-img" alt="" draggable="false" />
      <div class="cut-text"></div><div class="cut-next">continue</div></div>`;
    document.body.appendChild(layer);
    layer.addEventListener('pointerdown', (e) => { e.preventDefault(); advance(); });
    window.addEventListener('keydown', (e) => { if (active && (e.code === 'KeyW' || e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); advance(); } });
  }

  function play(scene, done) {
    ensure();
    queue = scene.filter(Boolean); onDone = done || null; idx = 0;
    if (!queue.length) { if (onDone) onDone(); return; }
    active = true;
    layer.classList.add('show');
    if (Z.controls) Z.controls.reset();
    showLine();
  }

  function showLine() {
    const ln = queue[idx];
    const nameEl = layer.querySelector('.cut-name'), imgEl = layer.querySelector('.cut-img');
    const textEl = layer.querySelector('.cut-text'), box = layer.querySelector('.cut-box');
    nameEl.textContent = ln.who || '';
    nameEl.style.background = ln.evil ? '#41607a' : 'var(--verm)';
    const src = ln.img && (PORTRAIT[ln.img] || ln.img);
    if (src) { imgEl.src = src; imgEl.style.display = ''; imgEl.classList.toggle('evil', !!ln.evil); }
    else imgEl.style.display = 'none';
    box.classList.toggle('right', ln.side === 'right');
    box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
    // typewriter
    fullText = ln.text || '';
    textEl.textContent = '';
    let i = 0;
    clearInterval(typing);
    typing = setInterval(() => {
      i += 2;
      textEl.textContent = fullText.slice(0, i);
      if (Z.audio && Z.audio.ctx && i % 6 === 0) Z.audio.sfx.hover();
      if (i >= fullText.length) { clearInterval(typing); typing = null; }
    }, 18);
  }

  function advance() {
    if (!active) return;
    if (typing) { clearInterval(typing); typing = null; layer.querySelector('.cut-text').textContent = fullText; return; }
    idx++;
    if (idx >= queue.length) { close(); return; }
    Z.audio && Z.audio.sfx.click();
    showLine();
  }

  function close() {
    active = false;
    layer.classList.remove('show');
    const cb = onDone; onDone = null;
    if (cb) cb();
  }

  return { play, get active() { return active; } };
})();
