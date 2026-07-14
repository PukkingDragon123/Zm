/* ================================================================
   audio.js — procedural WebAudio: darksynth music + combat/UI SFX
   No external audio assets. Everything is synthesized.
   ================================================================ */
Z.audio = (function () {
  let ctx = null, master = null, musicGain = null, sfxGain = null;
  let started = false, musicOn = true;
  let musicVol = 0.55, sfxVol = 0.8;
  let sched = null, step = 0, nextTime = 0;
  let mode = 'menu'; // 'menu' | 'combat'
  let convolver = null;

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = musicVol; musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = sfxVol; sfxGain.connect(master);
    // simple reverb impulse
    try {
      convolver = ctx.createConvolver();
      const len = ctx.sampleRate * 1.4, buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
      }
      convolver.buffer = buf;
      const rvGain = ctx.createGain(); rvGain.gain.value = 0.22; convolver.connect(rvGain); rvGain.connect(master);
    } catch (e) { convolver = null; }
  }

  function resume() {
    init();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (!started) { started = true; startMusic(); }
  }

  // ---------- primitive voice ----------
  function tone(opt) {
    if (!ctx) return;
    const t = opt.t || ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = opt.type || 'sine';
    o.frequency.setValueAtTime(opt.f, t);
    if (opt.f2 != null) o.frequency.exponentialRampToValueAtTime(Math.max(1, opt.f2), t + (opt.dur || 0.2));
    const g = ctx.createGain();
    const peak = opt.g == null ? 0.3 : opt.g;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (opt.atk || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + (opt.dur || 0.2));
    let node = o;
    if (opt.filter) {
      const flt = ctx.createBiquadFilter();
      flt.type = opt.filter; flt.frequency.value = opt.cutoff || 1200;
      if (opt.q) flt.Q.value = opt.q;
      o.connect(flt); flt.connect(g);
    } else o.connect(g);
    g.connect(opt.dest || sfxGain);
    if (opt.reverb && convolver) g.connect(convolver);
    o.start(t); o.stop(t + (opt.dur || 0.2) + 0.05);
    return { o, g };
  }

  function noise(opt) {
    if (!ctx) return;
    const t = opt.t || ctx.currentTime, dur = opt.dur || 0.2;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const flt = ctx.createBiquadFilter();
    flt.type = opt.filter || 'bandpass'; flt.frequency.value = opt.cutoff || 1800; flt.Q.value = opt.q || 1;
    const g = ctx.createGain();
    const peak = opt.g == null ? 0.3 : opt.g;
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt); flt.connect(g); g.connect(opt.dest || sfxGain);
    if (opt.reverb && convolver) g.connect(convolver);
    src.start(t); src.stop(t + dur + 0.02);
    return { src, g };
  }

  // ---------- SFX ----------
  const S = {
    click() { tone({ type: 'square', f: 620, f2: 720, dur: 0.05, g: 0.12, filter: 'lowpass', cutoff: 2400 }); },
    hover() { tone({ type: 'sine', f: 880, dur: 0.04, g: 0.05 }); },
    back() { tone({ type: 'square', f: 400, f2: 260, dur: 0.09, g: 0.12 }); },
    error() { tone({ type: 'sawtooth', f: 180, f2: 120, dur: 0.18, g: 0.18, filter: 'lowpass', cutoff: 900 }); },
    buy() { tone({ type: 'triangle', f: 700, dur: 0.08, g: 0.18 }); tone({ type: 'triangle', f: 1050, t: (ctx ? ctx.currentTime : 0) + 0.07, dur: 0.12, g: 0.16 }); },
    coin() { tone({ type: 'square', f: 1200, dur: 0.05, g: 0.1 }); tone({ type: 'square', f: 1600, t: (ctx ? ctx.currentTime : 0) + 0.05, dur: 0.08, g: 0.09 }); },
    dig() { noise({ filter: 'lowpass', cutoff: 800, dur: 0.16, g: 0.28, q: 0.6 }); tone({ type: 'sine', f: 90, f2: 50, dur: 0.14, g: 0.2 }); },
    found(rarity) {
      const base = { common: 660, uncommon: 740, rare: 880, epic: 1046, legendary: 1320 }[rarity] || 660;
      const now = ctx ? ctx.currentTime : 0;
      [0, 0.08, 0.16].forEach((dt, i) => tone({ type: 'triangle', f: base * (1 + i * 0.25), t: now + dt, dur: 0.16, g: 0.16, reverb: true }));
    },
    hit(power) {
      const p = Z.util.clamp(power || 1, 0.3, 2);
      noise({ filter: 'bandpass', cutoff: 220 + 200 * p, q: 0.8, dur: 0.12, g: 0.3 * p });
      tone({ type: 'square', f: 140, f2: 60, dur: 0.1, g: 0.25 * p, filter: 'lowpass', cutoff: 1400 });
    },
    spark() { noise({ filter: 'highpass', cutoff: 3500, dur: 0.06, g: 0.12 }); },
    spinner() { /* handled as continuous loop via startWhir */ },
    hammer() { tone({ type: 'sawtooth', f: 300, f2: 70, dur: 0.16, g: 0.3, filter: 'lowpass', cutoff: 1600 }); noise({ filter: 'lowpass', cutoff: 1200, dur: 0.12, g: 0.25 }); },
    flip() { tone({ type: 'sine', f: 200, f2: 900, dur: 0.24, g: 0.28 }); },
    flame() { noise({ filter: 'lowpass', cutoff: 900, dur: 0.3, g: 0.14, q: 0.4 }); },
    ringout() {
      const now = ctx ? ctx.currentTime : 0;
      noise({ filter: 'lowpass', cutoff: 600, dur: 0.5, g: 0.35 });
      [300, 220, 150].forEach((f, i) => tone({ type: 'sawtooth', f, f2: f * 0.4, t: now + i * 0.05, dur: 0.4, g: 0.22 }));
    },
    countdown(n) { tone({ type: 'square', f: n === 0 ? 900 : 520, dur: 0.14, g: 0.24, reverb: true }); },
    win() {
      const now = ctx ? ctx.currentTime : 0; const seq = [523, 659, 784, 1046];
      seq.forEach((f, i) => tone({ type: 'triangle', f, t: now + i * 0.11, dur: 0.3, g: 0.2, reverb: true }));
    },
    lose() {
      const now = ctx ? ctx.currentTime : 0; const seq = [392, 349, 294, 220];
      seq.forEach((f, i) => tone({ type: 'sawtooth', f, t: now + i * 0.14, dur: 0.35, g: 0.2, filter: 'lowpass', cutoff: 1200, reverb: true }));
    },
    boost() { tone({ type: 'sawtooth', f: 500, f2: 900, dur: 0.14, g: 0.14, filter: 'highpass', cutoff: 400 }); },
    rank() {
      const now = ctx ? ctx.currentTime : 0; const seq = [523, 784, 1046, 1568];
      seq.forEach((f, i) => tone({ type: 'triangle', f, t: now + i * 0.09, dur: 0.4, g: 0.22, reverb: true }));
    },
  };

  // continuous spinner whir tied to combat
  let whir = null;
  function startWhir() {
    if (!ctx || whir) return;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 90;
    const flt = ctx.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = 800; flt.Q.value = 3;
    const g = ctx.createGain(); g.gain.value = 0;
    o.connect(flt); flt.connect(g); g.connect(sfxGain); o.start();
    whir = { o, g, flt };
  }
  function setWhir(intensity) {
    if (!whir) return;
    const i = Z.util.clamp(intensity, 0, 1);
    whir.g.gain.setTargetAtTime(i * 0.06, ctx.currentTime, 0.05);
    whir.o.frequency.setTargetAtTime(90 + i * 120, ctx.currentTime, 0.05);
    whir.flt.frequency.setTargetAtTime(600 + i * 1400, ctx.currentTime, 0.05);
  }
  function stopWhir() { if (whir) { try { whir.o.stop(ctx.currentTime + 0.1); } catch (e) {} whir = null; } }

  // ---------- MUSIC (step sequencer) ----------
  // A minor darksynth loop. Notes in Hz.
  const N = { A1: 55, C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98, A2: 110, C3: 130.8, D3: 146.8, E3: 164.8, F3: 174.6, G3: 196, A3: 220, C4: 261.6, D4: 293.7, E4: 329.6, F4: 349.2, G4: 392, A4: 440 };
  // 16-step patterns per section; two moods
  const PAT = {
    menu: {
      tempo: 72,
      bass: ['A1', 0, 0, 0, 'A1', 0, 'G2', 0, 'F2', 0, 0, 0, 'E2', 0, 0, 0],
      arp: ['A3', 'C4', 'E4', 'C4', 'A3', 'C4', 'E4', 'G4', 'F3', 'A3', 'C4', 'A3', 'E3', 'G3', 'G3', 'E4'],
      pad: [['A2', 'C3', 'E3'], null, null, null, ['A2', 'C3', 'E3'], null, null, null, ['F2', 'A2', 'C3'], null, null, null, ['E2', 'G2', 'D3'], null, null, null],
      drums: 'k...h...ks..h...',
    },
    combat: {
      tempo: 108,
      bass: ['A1', 'A1', 0, 'A1', 'A1', 0, 'A1', 'A1', 'C2', 'C2', 0, 'C2', 'G2', 0, 'F2', 0],
      arp: ['A4', 'E4', 'A4', 'C4', 'E4', 'A4', 'E4', 'C4', 'C4', 'G4', 'C4', 'E4', 'G4', 'E4', 'D4', 'E4'],
      pad: [['A2', 'E3'], null, null, null, ['A2', 'E3'], null, null, null, ['C3', 'G3'], null, null, null, ['F2', 'C3'], null, null, null],
      drums: 'k.h.k.hkk.h.k.h.',
    },
  };

  function playStep(p, s, when) {
    if (!ctx) return;
    // bass
    const bn = p.bass[s]; if (bn && N[bn]) tone({ type: 'sawtooth', f: N[bn], t: when, dur: 0.24, g: 0.22, filter: 'lowpass', cutoff: 420, dest: musicGain });
    // arp (quieter, delayed feel)
    const an = p.arp[s]; if (an && N[an]) tone({ type: 'triangle', f: N[an], t: when, dur: 0.18, g: 0.028, filter: 'lowpass', cutoff: 1500, dest: musicGain, reverb: true });
    // pad on downbeats
    const pd = p.pad[s]; if (pd) pd.forEach((nn) => { if (N[nn]) tone({ type: 'sine', f: N[nn], t: when, dur: 0.9, g: 0.05, atk: 0.15, dest: musicGain, reverb: true }); });
    // drums
    const dr = p.drums[s];
    if (dr === 'k') { tone({ type: 'sine', f: 120, f2: 45, t: when, dur: 0.16, g: 0.4, dest: musicGain }); }
    else if (dr === 's') { noise({ filter: 'highpass', cutoff: 1800, dur: 0.14, g: 0.18, t: when, dest: musicGain }); }
    else if (dr === 'h') { noise({ filter: 'highpass', cutoff: 6000, dur: 0.04, g: 0.08, t: when, dest: musicGain }); }
  }

  function startMusic() {
    if (!ctx || sched) return;
    nextTime = ctx.currentTime + 0.1; step = 0;
    sched = setInterval(() => {
      if (!musicOn) return;
      const p = PAT[mode] || PAT.menu;
      const spb = 60 / p.tempo / 4; // 16th
      while (nextTime < ctx.currentTime + 0.2) {
        playStep(p, step % 16, nextTime);
        step++;
        nextTime += spb;
      }
    }, 40);
  }

  return {
    resume, init,
    sfx: S, startWhir, setWhir, stopWhir,
    setMode(m) { mode = m; },
    setMusicVol(v) { musicVol = v; if (musicGain) musicGain.gain.setTargetAtTime(v, ctx.currentTime, 0.1); },
    setSfxVol(v) { sfxVol = v; if (sfxGain) sfxGain.gain.setTargetAtTime(v, ctx.currentTime, 0.05); },
    setMusicOn(on) { musicOn = on; if (musicGain) musicGain.gain.setTargetAtTime(on ? musicVol : 0, ctx.currentTime, 0.2); },
    get ctx() { return ctx; },
  };
})();
