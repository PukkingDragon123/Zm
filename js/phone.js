/* ================================================================
   phone.js — the tanuki's phone. Cozy home screen with two apps:
   QUESTS (daily-life to-do, always) and RAID MAP (a Maps-style night
   city with three tappable target pins, night only).
   Provides Z.phone = { init, toggle, mapFrame, startRaid }.
   ================================================================ */
Z.phone = (function () {
  const U = Z.util;

  // ---- tonight's targets (map fractions + difficulty) ----
  const RAIDS = [
    { name: 'Sakura Ward Depot', sub: 'supply crates, light patrol', diff: 1, mx: 0.28, my: 0.60 },
    { name: 'Dockside Yard',     sub: 'cranes, steam vents, drones', diff: 2, mx: 0.57, my: 0.44 },
    { name: 'KANE-CO Rooftop',   sub: 'the tower — heavy security',  diff: 3, mx: 0.80, my: 0.30 },
  ];
  const DIFF_COL = { 1: '#7f9e6a', 2: '#d9a441', 3: '#d94f30' };

  // ---- cozy daily-life to-do ----
  const TASKS = [
    { id: 'build',  t: 'Build a mech at the bench', s: 'tinker in your den' },
    { id: 'ramen',  t: "Slurp a bowl at Ao's",      s: 'warm up before the night' },
    { id: 'parts',  t: 'Restock parts at the cave',  s: 'the oni keeps new kits' },
    { id: 'tidy',   t: 'Sweep the toy-shop floor',   s: 'keep the little shop cozy' },
    { id: 'sleep',  t: 'Sleep to pass the day',      s: 'rest at home to reach night' },
  ];
  let taskDone = loadTasks();
  function loadTasks() { try { return JSON.parse(localStorage.getItem('zumo.phone.tasks') || '{}') || {}; } catch (e) { return {}; } }
  function saveTasks() { try { localStorage.setItem('zumo.phone.tasks', JSON.stringify(taskDone)); } catch (e) {} }

  let open = false, view = 'home';
  let pinPos = [], hover = -1, cardEls = [];

  // ================================================================
  //  one-time CSS (injected so the module stays self-contained)
  // ================================================================
  function injectCSS() {
    if (document.getElementById('phoneCSS')) return;
    const css = `
    .ph-wrap{display:flex;flex-direction:column;height:100%;font-family:var(--body);}
    .ph-status{display:flex;align-items:center;justify-content:space-between;padding:28px 18px 6px;
      font-family:var(--disp);font-size:12px;color:#fff;}
    .ph-status .ph-pill{font-size:9px;padding:2px 8px;border-radius:8px;background:rgba(255,255,255,.16);letter-spacing:1px;}
    .ph-status .ph-yen{color:#ffe9bf;}
    .ph-status .ph-yen::before{content:'\\00a5 ';}
    .ph-hero{padding:4px 20px 12px;color:#fff;}
    .ph-hero h4{font-family:var(--disp);font-size:16px;margin:0;text-shadow:0 2px 6px rgba(0,0,0,.3);}
    .ph-hero p{font-size:11px;opacity:.82;margin:3px 0 0;}
    .ph-body{flex:1;overflow:auto;padding:6px 16px 18px;}
    .ph-apps{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
    .ph-app{background:rgba(245,236,215,.97);border:2px solid var(--line);border-radius:18px;
      padding:14px 8px 12px;text-align:center;cursor:pointer;box-shadow:var(--shadow);transition:transform .12s;}
    .ph-app:hover{transform:translateY(-2px);}
    .ph-app.off{opacity:.55;cursor:not-allowed;filter:grayscale(.55);}
    .ph-app .ph-ic{width:54px;height:54px;margin:0 auto 8px;display:grid;place-items:center;}
    .ph-app .ph-name{font-family:var(--disp);font-size:12px;color:var(--ink);}
    .ph-app .ph-note{font-size:9.5px;color:var(--ink2);margin-top:3px;min-height:12px;line-height:1.25;}
    .ph-sec{font-family:var(--disp);font-size:11px;color:#fff;opacity:.85;margin:4px 4px 10px;}
    .ph-back{font-family:var(--disp);font-size:11px;color:#fff;background:rgba(255,255,255,.14);
      border:none;border-radius:9px;cursor:pointer;padding:6px 12px;margin-bottom:10px;}
    .ph-back::before{content:'\\2039  ';}
    .ph-list{display:flex;flex-direction:column;gap:8px;}
    .ph-task{display:flex;align-items:center;gap:11px;background:rgba(245,236,215,.97);border:2px solid var(--line);
      border-radius:13px;padding:10px 12px;cursor:pointer;box-shadow:var(--shadow);transition:transform .1s;}
    .ph-task:hover{transform:translateX(2px);}
    .ph-task.done{opacity:.62;}
    .ph-check{width:20px;height:20px;border:2px solid var(--line);border-radius:6px;flex-shrink:0;
      display:grid;place-items:center;background:#fff;}
    .ph-task.done .ph-check{background:var(--matcha);border-color:#5f7a4c;}
    .ph-check svg{opacity:0;} .ph-task.done .ph-check svg{opacity:1;}
    .ph-t{flex:1;min-width:0;} .ph-t b{font-family:var(--disp);font-size:12px;color:var(--ink);display:block;}
    .ph-t span{font-size:11px;color:var(--ink2);}

    /* raid map DOM: reliable list + transparent pin hit layer */
    #raidHit{position:absolute;inset:0;cursor:default;}
    #raidUI{position:absolute;left:0;right:0;bottom:0;z-index:3;display:flex;gap:10px;justify-content:center;
      flex-wrap:wrap;padding:12px 16px 16px;}
    .raid-card{width:min(230px,44vw);background:rgba(245,236,215,.95);border:2px solid var(--line);border-radius:14px;
      padding:10px 12px;box-shadow:var(--shadow);cursor:pointer;transition:transform .12s,box-shadow .12s,border-color .12s;}
    .raid-card:hover,.raid-card.hot{transform:translateY(-3px);box-shadow:0 6px 0 rgba(35,22,10,.28);border-color:var(--verm);}
    .raid-card .rc-top{display:flex;justify-content:space-between;align-items:center;gap:8px;}
    .raid-card .rc-name{font-family:var(--disp);font-size:12px;color:var(--ink);}
    .raid-card .rc-diff{display:flex;gap:3px;flex-shrink:0;}
    .rc-pip{width:7px;height:7px;border-radius:50%;border:1.5px solid var(--line);}
    .rc-pip.on{background:var(--verm);border-color:var(--verm2);}
    .raid-card .rc-sub{font-size:11px;color:var(--ink2);margin-top:4px;line-height:1.35;}
    .raid-card .rc-go{margin-top:7px;font-family:var(--disp);font-size:10px;color:var(--verm);letter-spacing:1px;}
    @media (max-width:520px){ .raid-card{width:88vw;} }
    `;
    const st = document.createElement('style'); st.id = 'phoneCSS'; st.textContent = css;
    document.head.appendChild(st);
  }

  // ---- small inline icons (no emoji) ----
  const IC_QUEST = '<svg viewBox="0 0 48 48" width="52" height="52">' +
    '<rect x="10" y="6" width="28" height="36" rx="5" fill="#f7efd6" stroke="#2f2418" stroke-width="2.4"/>' +
    '<circle cx="17" cy="16" r="2.4" fill="#7f9e6a"/><line x1="22" y1="16" x2="33" y2="16" stroke="#6b5941" stroke-width="2.2" stroke-linecap="round"/>' +
    '<circle cx="17" cy="24" r="2.4" fill="#7f9e6a"/><line x1="22" y1="24" x2="33" y2="24" stroke="#6b5941" stroke-width="2.2" stroke-linecap="round"/>' +
    '<circle cx="17" cy="32" r="2.4" fill="none" stroke="#b0a084" stroke-width="1.8"/><line x1="22" y1="32" x2="30" y2="32" stroke="#b0a084" stroke-width="2.2" stroke-linecap="round"/></svg>';
  const IC_RAID = '<svg viewBox="0 0 48 48" width="52" height="52">' +
    '<rect x="5" y="5" width="38" height="38" rx="9" fill="#1b2634"/>' +
    '<line x1="5" y1="19" x2="43" y2="19" stroke="#33465c" stroke-width="2"/><line x1="5" y1="31" x2="43" y2="31" stroke="#33465c" stroke-width="2"/>' +
    '<line x1="18" y1="5" x2="18" y2="43" stroke="#33465c" stroke-width="2"/><line x1="30" y1="5" x2="30" y2="43" stroke="#33465c" stroke-width="2"/>' +
    '<path d="M27 34 C19 24 20 15 27 15 C34 15 35 24 27 34 Z" fill="#d94f30" stroke="#2f2418" stroke-width="2"/>' +
    '<circle cx="27" cy="21" r="3.4" fill="#f7efd6"/></svg>';
  const CHECK = '<svg viewBox="0 0 16 16" width="13" height="13"><path d="M3 8 L7 12 L13 4" fill="none" stroke="#f5ecd7" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // ================================================================
  //  PHONE OVERLAY
  // ================================================================
  function toggle() {
    const el = document.getElementById('phone'); if (!el) return;
    open = !open;
    if (open) { view = 'home'; render(); }
    el.classList.toggle('on', open);
  }
  function close() { open = false; const el = document.getElementById('phone'); if (el) el.classList.remove('on'); }

  function render() {
    const sc = document.getElementById('phoneScreen'); if (!sc) return;
    const night = Z.state ? Z.state.isNight : false;
    sc.style.background = night
      ? 'linear-gradient(180deg,#20305a,#161d34 60%,#101528)'
      : 'linear-gradient(180deg,#8fc4ea,#cfe4dd 55%,#f3e6c6)';
    U.clear(sc);
    const wrap = U.el('div', 'ph-wrap');

    // status bar
    const status = U.el('div', 'ph-status');
    const time = (Z.clock && Z.clock.hhmm) ? Z.clock.hhmm() : '';
    status.innerHTML = `<span>${time}</span>` +
      `<span class="ph-pill">${(Z.clock ? Z.clock.phaseName(Z.state.clock) : (night ? 'NIGHT' : 'DAY'))}</span>` +
      `<span class="ph-yen">${U.fmt(Z.state ? Z.state.credits : 0)}</span>`;
    wrap.appendChild(status);

    const body = U.el('div', 'ph-body');
    if (view === 'quests') renderQuests(body, night);
    else renderHome(body, night);
    wrap.appendChild(body);
    sc.appendChild(wrap);
  }

  function renderHome(body, night) {
    const hero = U.el('div', 'ph-hero');
    hero.innerHTML = `<h4>${night ? 'Good evening, keeper' : 'Morning, keeper'}</h4>` +
      `<p>Day ${Z.state ? Z.state.dayCount : 1} · ${night ? 'the town sleeps — time to raid' : 'chores about town'}</p>`;
    body.appendChild(hero);

    const apps = U.el('div', 'ph-apps');

    const quest = U.el('div', 'ph-app');
    quest.innerHTML = `<div class="ph-ic">${IC_QUEST}</div><div class="ph-name">QUESTS</div><div class="ph-note">daily-life to-do</div>`;
    quest.addEventListener('click', () => { Z.audio && Z.audio.sfx.click(); view = 'quests'; render(); });
    apps.appendChild(quest);

    const raidKnown = !Z.story || Z.story.seen('b1_night');   // Ao introduces the camps first
    const raid = U.el('div', 'ph-app' + ((night && raidKnown) ? '' : ' off'));
    const raidNote = !raidKnown ? 'Ao has not shown you the camps yet' : (night ? 'three targets tonight' : 'come back at night');
    raid.innerHTML = `<div class="ph-ic">${IC_RAID}</div><div class="ph-name">RAID MAP</div>` +
      `<div class="ph-note">${raidNote}</div>`;
    raid.addEventListener('click', () => {
      if (!raidKnown) { Z.audio && Z.audio.sfx.error(); Z.ui.toast('You do not know where their camps are yet.', 'warn'); return; }
      if (!(Z.state && Z.state.isNight)) { Z.audio && Z.audio.sfx.error(); Z.ui.toast('The raid map only wakes at night.', 'warn'); return; }
      Z.audio && Z.audio.sfx.click(); close(); Z.ui.show('raidmap');
    });
    apps.appendChild(raid);
    body.appendChild(apps);
  }

  function renderQuests(body, night) {
    const back = U.el('button', 'ph-back', 'apps');
    back.addEventListener('click', () => { Z.audio && Z.audio.sfx.back(); view = 'home'; render(); });
    body.appendChild(back);
    body.appendChild(U.el('div', 'ph-sec', "TODAY'S CHORES"));

    const list = U.el('div', 'ph-list');
    TASKS.forEach((tk) => {
      const done = !!taskDone[tk.id];
      const row = U.el('div', 'ph-task' + (done ? ' done' : ''));
      row.innerHTML = `<div class="ph-check">${CHECK}</div><div class="ph-t"><b>${tk.t}</b><span>${tk.s}</span></div>`;
      row.addEventListener('click', () => {
        taskDone[tk.id] = !taskDone[tk.id]; saveTasks();
        Z.audio && Z.audio.sfx[taskDone[tk.id] ? 'found' : 'click'] && Z.audio.sfx[taskDone[tk.id] ? 'found' : 'click']();
        render();
      });
      list.appendChild(row);
    });
    body.appendChild(list);
  }

  // ================================================================
  //  RAID MAP  — Google-Maps-style night city on the main canvas
  // ================================================================
  function hash(i, j) { const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return n - Math.floor(n); }
  function inWater(x, y, W, H) { return (y / H) - (x / W) * 0.42 > 0.62; }

  function drawMap(ctx, W, H, t) {
    // asphalt base
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0d131d'); g.addColorStop(1, '#141d2b');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // bay (bottom-left water)
    ctx.save();
    ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(W, H);
    for (let x = W; x >= 0; x -= 20) { const yy = H * (0.62 + (x / W) * 0.42); if (yy < H) ctx.lineTo(x, yy); }
    ctx.closePath(); ctx.fillStyle = '#0f2338'; ctx.fill();
    ctx.strokeStyle = 'rgba(90,150,190,.10)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) { const yy = H * 0.86 + i * 9 + Math.sin(t * 1.4 + i) * 2; ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W * 0.34, yy - 20); ctx.stroke(); }
    ctx.restore();

    // city blocks
    const cell = Math.max(84, Math.min(W, H) / 7);
    const cols = Math.ceil(W / cell) + 1, rows = Math.ceil(H / cell) + 1;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const cxp = i * cell + cell / 2, cyp = j * cell + cell / 2;
      if (inWater(cxp, cyp, W, H)) continue;
      const hx = hash(i, j);
      const pad = 7 + hx * 5;
      const bw = cell - pad * 2, bh = cell - pad * 2;
      const park = hx < 0.13;
      Z.render.roundRect(ctx, i * cell + pad, j * cell + pad, bw, bh, 5);
      ctx.fillStyle = park ? '#1b3a2e' : (hx < 0.5 ? '#1c2431' : '#212b3a');
      ctx.fill();
      // faint top light on each parcel
      ctx.save(); Z.render.roundRect(ctx, i * cell + pad, j * cell + pad, bw, bh, 5); ctx.clip();
      ctx.fillStyle = 'rgba(150,170,200,.05)'; ctx.fillRect(i * cell + pad, j * cell + pad, bw, bh * 0.42); ctx.restore();
    }

    // avenue centre lines (dashed)
    ctx.save(); ctx.strokeStyle = 'rgba(150,168,190,.10)'; ctx.lineWidth = 1.4; ctx.setLineDash([10, 12]);
    for (let i = 0; i <= cols; i += 2) { const xx = i * cell; ctx.beginPath(); ctx.moveTo(xx, 0); ctx.lineTo(xx, H); ctx.stroke(); }
    for (let j = 0; j <= rows; j += 2) { const yy = j * cell; ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke(); }
    ctx.restore();

    // warm highway sweeping across
    ctx.save(); ctx.strokeStyle = 'rgba(230,182,110,.16)'; ctx.lineWidth = cell * 0.17; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-30, H * 0.22); ctx.quadraticCurveTo(W * 0.4, H * 0.42, W * 0.78, H * 0.94); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,214,150,.10)'; ctx.lineWidth = 1.5; ctx.setLineDash([8, 14]);
    ctx.beginPath(); ctx.moveTo(-30, H * 0.22); ctx.quadraticCurveTo(W * 0.4, H * 0.42, W * 0.78, H * 0.94); ctx.stroke();
    ctx.restore();

    // vignette
    const vg = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.22, W / 2, H * 0.48, H * 0.92);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(4,7,12,.6)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    // header legibility
    const tg = ctx.createLinearGradient(0, 0, 0, 90);
    tg.addColorStop(0, 'rgba(6,9,14,.55)'); tg.addColorStop(1, 'rgba(6,9,14,0)');
    ctx.fillStyle = tg; ctx.fillRect(0, 0, W, 90);
  }

  function drawPin(ctx, x, y, col, sel) {
    const s = sel ? 1.16 : 1;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.ellipse(0, 15, 7, 3, 0, 0, U.TAU); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 15); ctx.bezierCurveTo(-12, -3, -10, -20, 0, -20); ctx.bezierCurveTo(10, -20, 12, -3, 0, 15); ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#2f2418'; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.fillStyle = '#f7efd6'; ctx.beginPath(); ctx.arc(0, -9, 4.4, 0, U.TAU); ctx.fill();
    ctx.restore();
  }

  function mapFrame(dt, t) {
    const ctx = Z.render.ctx, W = Z.render.W, H = Z.render.H;
    Z.render.clear();
    drawMap(ctx, W, H, t);

    pinPos = RAIDS.map((r) => ({ x: r.mx * W, y: r.my * H, r: r }));
    pinPos.forEach((p, i) => {
      const col = DIFF_COL[p.r.diff], sel = i === hover;
      const pulse = 0.5 + 0.5 * Math.sin(t * 3 + i);
      const bob = Math.sin(t * 2 + i) * 2;
      // radar rings
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 2; k++) {
        const rp = ((t * 0.5 + i * 0.4 + k * 0.5) % 1);
        ctx.strokeStyle = U.rgba(col, 0.3 * (1 - rp)); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, 12 + rp * 44, 0, U.TAU); ctx.stroke();
      }
      // ground glow
      const gg = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 42 + pulse * 10);
      gg.addColorStop(0, U.rgba(col, 0.34 + pulse * 0.14)); gg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gg; ctx.fillRect(p.x - 60, p.y - 60, 120, 120);
      ctx.restore();
      drawPin(ctx, p.x, p.y - 12 + bob, col, sel);
      // name chip only when hovered (keep the map clean)
      if (sel) {
        const label = p.r.name; ctx.font = '12px "Mochiy Pop One", sans-serif';
        const w = ctx.measureText(label).width + 20, cxp = p.x, cyp = p.y - 40 + bob;
        Z.render.paperFill(ctx, () => Z.render.roundRect(ctx, cxp - w / 2, cyp - 14, w, 24, 8), '#f5ecd7', { noShadow: true, cut: 3 });
        Z.render.pxText(ctx, label, cxp, cyp + 3, 8.5, '#2f2418', 'center');
      }
    });

    // keep the DOM cards in sync with map hover
    cardEls.forEach((el, i) => el && el.classList.toggle('hot', i === hover));

    Z.fx.renderScreen(ctx, W, H);
  }

  // ---- raidmap DOM: bottom card list + transparent pin hit layer ----
  function pinAt(cx, cy) {
    for (let i = 0; i < pinPos.length; i++) { const p = pinPos[i]; const dx = cx - p.x, dy = cy - (p.y - 12); if (dx * dx + dy * dy < 30 * 30) return i; }
    return -1;
  }
  function buildHit() {
    const interior = document.querySelector('.screen[data-screen="raidmap"] .interior'); if (!interior) return;
    let hit = document.getElementById('raidHit');
    if (!hit) {
      hit = document.createElement('div'); hit.id = 'raidHit';
      interior.insertBefore(hit, interior.firstChild);
      hit.addEventListener('pointermove', (e) => { const i = pinAt(e.clientX, e.clientY); hover = i; hit.style.cursor = i >= 0 ? 'pointer' : 'default'; });
      hit.addEventListener('pointerleave', () => { hover = -1; });
      hit.addEventListener('pointerdown', (e) => { const i = pinAt(e.clientX, e.clientY); if (i >= 0) startRaid(i); });
    }
  }
  function buildList() {
    const host = document.getElementById('raidUI'); if (!host) return; U.clear(host); cardEls = [];
    const rm = document.getElementById('raidMoney'); if (rm) rm.textContent = U.fmt(Z.state ? Z.state.credits : 0);
    RAIDS.forEach((r, i) => {
      const card = U.el('div', 'raid-card');
      const pips = [1, 2, 3].map((n) => `<span class="rc-pip ${n <= r.diff ? 'on' : ''}"></span>`).join('');
      card.innerHTML = `<div class="rc-top"><span class="rc-name">${r.name}</span><span class="rc-diff">${pips}</span></div>` +
        `<div class="rc-sub">${r.sub}</div><div class="rc-go">TAP TO INFILTRATE</div>`;
      card.addEventListener('mouseenter', () => { hover = i; });
      card.addEventListener('mouseleave', () => { hover = -1; });
      card.addEventListener('click', () => startRaid(i));
      host.appendChild(card); cardEls.push(card);
    });
  }
  function enterRaid() { hover = -1; buildHit(); buildList(); }

  function startRaid(i) {
    close();
    const idx = U.clamp(i | 0, 0, RAIDS.length - 1);
    Z.audio && Z.audio.sfx.boost && Z.audio.sfx.boost();
    if (Z.infil && typeof Z.infil.startRaid === 'function') { Z.infil.startRaid(idx); return; }
    // graceful fallback until the raid entry point exists
    Z.ui.show('infil');
    Z.ui.toast('Choose a camp to sneak into.', 'gold');
  }

  function init() {
    injectCSS();
    if (Z.ui && Z.ui.onEnter) Z.ui.onEnter('raidmap', enterRaid);
    const el = document.getElementById('phone');
    if (el) el.addEventListener('pointerdown', (e) => { if (e.target.id === 'phone') close(); });
    const home = document.getElementById('phoneHome');
    if (home) { home.style.cursor = 'pointer'; home.addEventListener('click', close); }
  }

  return { init, toggle, mapFrame, startRaid };
})();
