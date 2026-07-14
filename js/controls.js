/* ================================================================
   controls.js — one input layer for overworld + battle.
   Keyboard + on-screen pad (touch). Systems read held flags and
   consume edge events (interact / attack / skill).
   ================================================================ */
Z.controls = (function () {
  const U = Z.util;
  const held = { left: false, right: false, up: false, down: false, block: false, attack: false, skill: false };
  let interactQ = false, attackQ = false, skillQ = false;
  let mode = 'none';
  let padEl, leftCluster, rightCluster;

  function onKey(e, down) {
    const c = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(c)) e.preventDefault();
    switch (c) {
      case 'KeyA': case 'ArrowLeft': held.left = down; break;
      case 'KeyD': case 'ArrowRight': held.right = down; break;
      case 'KeyW': case 'ArrowUp': held.up = down; if (down && !e.repeat) interactQ = true; break;
      case 'Space': if (down && !e.repeat) interactQ = true; break;
      case 'KeyJ': held.attack = down; if (down && !e.repeat) attackQ = true; break;
      case 'KeyK': held.skill = down; if (down && !e.repeat) skillQ = true; break;
      case 'KeyL': case 'ShiftLeft': case 'ShiftRight': held.block = down; break;
    }
  }

  function padButton(label, cls, opts) {
    opts = opts || {};
    const b = U.el('button', 'pad-btn' + (cls ? ' ' + cls : ''), label);
    const set = (v) => {
      b.classList.toggle('held', v);
      if (opts.hold) held[opts.hold] = v;
      if (v && opts.edge) { if (opts.edge === 'interact') interactQ = true; else if (opts.edge === 'attack') { attackQ = true; held.attack = true; } else if (opts.edge === 'skill') { skillQ = true; held.skill = true; } }
      if (!v && opts.edge === 'attack') held.attack = false;
      if (!v && opts.edge === 'skill') held.skill = false;
    };
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); set(true); if (Z.audio) Z.audio.resume(); });
    b.addEventListener('pointerup', (e) => { e.preventDefault(); set(false); });
    b.addEventListener('pointercancel', () => set(false));
    b.addEventListener('pointerleave', () => set(false));
    return b;
  }

  function build() {
    padEl = document.getElementById('pad');
    leftCluster = U.el('div', 'pad-left'); rightCluster = U.el('div', 'pad-right');
    leftCluster.appendChild(padButton('<', '', { hold: 'left' }));
    leftCluster.appendChild(padButton('>', '', { hold: 'right' }));
    padEl.appendChild(leftCluster); padEl.appendChild(rightCluster);
  }

  function setRight(buttons) { U.clear(rightCluster); buttons.forEach((b) => rightCluster.appendChild(b)); }

  function setMode(m) {
    mode = m;
    if (!padEl) return;
    if (m === 'none') { padEl.classList.remove('show'); return; }
    padEl.classList.add('show');
    if (m === 'world') setRight([padButton('ENTER', 'big', { edge: 'interact' })]);
    else if (m === 'battle') setRight([
      padButton('BLK', 'blk', { hold: 'block' }),
      padButton('SKL', 'skill', { edge: 'skill' }),
      padButton('HIT', 'atk big', { edge: 'attack' }),
    ]);
  }

  function init() {
    build();
    window.addEventListener('keydown', (e) => onKey(e, true));
    window.addEventListener('keyup', (e) => onKey(e, false));
    if (('ontouchstart' in window) || navigator.maxTouchPoints > 0 || matchMedia('(pointer:coarse)').matches) document.body.classList.add('pad-on');
  }

  return {
    init, setMode,
    get held() { return held; },
    get dir() { return (held.right ? 1 : 0) - (held.left ? 1 : 0); },
    consumeInteract() { const v = interactQ; interactQ = false; return v; },
    consumeAttack() { const v = attackQ; attackQ = false; return v; },
    consumeSkill() { const v = skillQ; skillQ = false; return v; },
    reset() { for (const k in held) held[k] = false; interactQ = attackQ = skillQ = false; },
  };
})();
