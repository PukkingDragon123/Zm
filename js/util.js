/* ================================================================
   util.js — foundational helpers, math, DOM, colors, tiny event bus
   Global namespace: Z
   ================================================================ */
window.Z = window.Z || {};

Z.util = (function () {
  const TAU = Math.PI * 2;

  // ---- math ----
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const inv = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
  const map = (v, a, b, c, d) => lerp(c, d, inv(a, b, v));
  const smooth = (t) => t * t * (3 - 2 * t);
  const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const chance = (p) => Math.random() < p;
  const choice = (arr) => arr[(Math.random() * arr.length) | 0];
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const weighted = (items, weightFn) => {
    let total = 0;
    for (const it of items) total += Math.max(0, weightFn(it));
    if (total <= 0) return choice(items);
    let r = Math.random() * total;
    for (const it of items) {
      r -= Math.max(0, weightFn(it));
      if (r <= 0) return it;
    }
    return items[items.length - 1];
  };
  // angle helpers
  const angLerp = (a, b, t) => {
    let d = ((b - a + Math.PI) % TAU) - Math.PI;
    if (d < -Math.PI) d += TAU;
    return a + d * t;
  };
  const angDiff = (a, b) => {
    let d = ((b - a + Math.PI) % TAU) - Math.PI;
    return d < -Math.PI ? d + TAU : d;
  };

  // ---- easing ----
  const ease = {
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inCubic: (t) => t * t * t,
    outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    outElastic: (t) => { if (t === 0 || t === 1) return t; const c4 = (2 * Math.PI) / 3; return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1; },
    inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  };

  // ---- colors ----
  function hexToRgb(hex) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const rgba = (hex, a) => { const c = hexToRgb(hex); return `rgba(${c.r},${c.g},${c.b},${a})`; };
  function mixHex(h1, h2, t) {
    const a = hexToRgb(h1), b = hexToRgb(h2);
    const r = Math.round(lerp(a.r, b.r, t)), g = Math.round(lerp(a.g, b.g, t)), bl = Math.round(lerp(a.b, b.b, t));
    return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
  }
  const shade = (hex, amt) => mixHex(hex, amt < 0 ? '#000000' : '#ffffff', Math.abs(amt));

  // ---- format ----
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const sign = (n) => (n > 0 ? '+' + n : '' + n);

  // ---- dom ----
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

  // ---- tiny event bus ----
  const bus = (() => {
    const map = {};
    return {
      on(ev, fn) { (map[ev] = map[ev] || []).push(fn); return () => this.off(ev, fn); },
      off(ev, fn) { if (map[ev]) map[ev] = map[ev].filter((f) => f !== fn); },
      emit(ev, data) { (map[ev] || []).forEach((f) => { try { f(data); } catch (e) { console.error(e); } }); },
    };
  })();

  return {
    TAU, clamp, lerp, inv, map, smooth, rand, randInt, chance, choice, shuffle, weighted,
    angLerp, angDiff, ease, hexToRgb, rgba, mixHex, shade, fmt, sign,
    $, $$, el, clear, bus,
  };
})();
