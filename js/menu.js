/* ================================================================
   menu.js — Persona-style NAVIGATOR. An animated indigo/vermillion
   canvas sweep sits behind a DOM shell: a slanted sidebar with tabs
   (MAP / MISSIONS / MECH) and a body panel for the active tab.
   MAP    - stylized area map; each node launches its screen.
   MISSIONS - the town's request list (from D.MISSIONS).
   MECH   - your current mech preview + key stats + a build button.
   ================================================================ */
Z.menu = (function () {
  const U = Z.util, D = Z.data;
  const TABS = [
    { id: 'MAP', label: 'MAP', sub: 'where to next' },
    { id: 'MISSIONS', label: 'MISSIONS', sub: "the town's asks" },
    { id: 'MECH', label: 'MECH', sub: 'your unit' },
  ];
  const KIND = {
    battle: { c: '#d94f30', tag: 'DUEL' },
    obby:   { c: '#4fae9c', tag: 'INFIL' },
    scav:   { c: '#c08a2e', tag: 'SCAV' },
    quest:  { c: '#8f9ed0', tag: 'JOBS' },
  };
  let active = 'MAP';
  let motes = null;
  let mechCv = null;   // live canvas for the MECH tab preview

  // ---- tiny DOM helpers ----
  function css(el, o) { for (const k in o) el.style[k] = o[k]; return el; }
  function mk(tag, styleObj, html) { const e = document.createElement(tag); if (styleObj) css(e, styleObj); if (html != null) e.innerHTML = html; return e; }
  function click(el, fn) { el.style.cursor = 'pointer'; el.addEventListener('click', (e) => { if (Z.audio) { Z.audio.resume(); Z.audio.sfx.click(); } fn(e); }); return el; }

  // ---- shell: inline-style the pre-existing menu DOM into a persona layout ----
  function styleShell() {
    const root = document.querySelector('.menu-root');
    const side = document.querySelector('.menu-side');
    const body = document.getElementById('menuBody');
    const titl = document.querySelector('.menu-title');
    const wallet = document.querySelector('.menu-wallet');
    const back = document.querySelector('.menu-back');
    if (!root || !side || !body) return;

    css(root, { flex: '1', display: 'flex', gap: '0', overflow: 'hidden', minHeight: '0' });
    css(side, {
      flex: '0 0 clamp(180px,25vw,260px)', display: 'flex', flexDirection: 'column',
      padding: '18px 16px', gap: '12px', position: 'relative',
      background: 'linear-gradient(160deg, rgba(24,14,36,.94), rgba(48,14,26,.94))',
      borderRight: '3px solid #d94f30', boxShadow: '6px 0 22px rgba(0,0,0,.45)',
      clipPath: 'polygon(0 0, 100% 0, calc(100% - 22px) 100%, 0 100%)',
    });
    css(body, {
      flex: '1', minWidth: '0', position: 'relative', overflowY: 'auto',
      padding: '20px clamp(16px,3vw,34px)', color: '#f5ecd7',
    });
    if (titl) css(titl, { display: 'flex', flexDirection: 'column', lineHeight: '1.05', marginBottom: '4px', flex: '0 0 auto' });
    const tb = titl && titl.querySelector('b'), ti = titl && titl.querySelector('i');
    if (tb) css(tb, { fontFamily: "var(--disp)", fontSize: '26px', color: '#fff7ea', letterSpacing: '2px' });
    if (ti) css(ti, { fontStyle: 'normal', fontSize: '11px', color: '#d94f30', letterSpacing: '4px', textTransform: 'uppercase' });
    if (wallet) css(wallet, {
      marginTop: 'auto', fontFamily: "var(--disp)", fontSize: '18px', color: '#ffd98a',
      background: 'rgba(0,0,0,.32)', border: '2px solid rgba(255,217,138,.5)', borderRadius: '10px',
      padding: '8px 12px', textAlign: 'center',
    });
    if (wallet && wallet.firstChild && wallet.querySelector('#menuMoney')) {
      // prefix a wallet glyph without clobbering the #menuMoney span
      if (!wallet.dataset.prefixed) { wallet.insertBefore(document.createTextNode('¥ '), wallet.firstChild); wallet.dataset.prefixed = '1'; }
    }
    if (back) css(back, { flex: '0 0 auto' });
  }

  // ---- tabs ----
  function renderTabs() {
    const host = document.getElementById('menuTabs'); if (!host) return;
    U.clear(host);
    css(host, { display: 'flex', flexDirection: 'column', gap: '9px', flex: '0 0 auto' });
    TABS.forEach((tb) => {
      const on = tb.id === active;
      const el = mk('div', {
        position: 'relative', padding: '11px 14px', borderRadius: '10px',
        background: on ? '#d94f30' : 'rgba(255,247,234,.06)',
        border: '2px solid ' + (on ? '#ffd98a' : 'rgba(255,247,234,.16)'),
        transform: on ? 'translateX(6px)' : 'none', transition: 'transform .12s',
        boxShadow: on ? '0 4px 0 rgba(120,20,10,.5)' : 'none',
      });
      el.appendChild(mk('div', {
        fontFamily: "var(--disp)", fontSize: '15px', letterSpacing: '1px',
        color: on ? '#fff7ea' : '#f0e6cf',
      }, tb.label));
      el.appendChild(mk('div', { fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: on ? 'rgba(255,247,234,.8)' : '#b9a179' }, tb.sub));
      click(el, () => { if (active !== tb.id) { active = tb.id; renderTabs(); renderBody(); } });
      host.appendChild(el);
    });
  }

  // ---- body dispatcher ----
  function renderBody() {
    const body = document.getElementById('menuBody'); if (!body) return;
    mechCv = null;
    U.clear(body);
    if (active === 'MAP') buildMap(body);
    else if (active === 'MISSIONS') buildMissions(body);
    else buildMech(body);
  }

  function header(text, sub) {
    const wrap = mk('div', { marginBottom: '16px' });
    wrap.appendChild(mk('div', { fontFamily: "var(--disp)", fontSize: 'clamp(20px,4vw,30px)', color: '#fff7ea', letterSpacing: '1px', textShadow: '0 3px 0 rgba(0,0,0,.4)' }, text));
    if (sub) wrap.appendChild(mk('div', { fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase', color: '#d94f30', marginTop: '2px' }, sub));
    return wrap;
  }

  // ---- MAP: responsive grid of area cards (never overlaps; flows on mobile) ----
  function buildMap(body) {
    body.appendChild(header('AREA MAP', 'pick a destination'));
    const grid = mk('div', {
      display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '14px',
      padding: '16px', borderRadius: '16px',
      border: '2px dashed rgba(255,247,234,.18)',
      background: 'radial-gradient(120% 120% at 30% 10%, rgba(80,40,120,.22), rgba(0,0,0,.18))',
    });
    (D.AREAS || []).forEach((a) => {
      const kind = KIND[a.kind] || { c: '#f5ecd7', tag: (a.kind || '').toUpperCase() };
      const node = mk('div', {
        background: 'rgba(18,12,28,.82)', border: '2px solid ' + kind.c, borderRadius: '13px',
        padding: '12px 14px', boxShadow: '0 6px 16px rgba(0,0,0,.4)', transition: 'transform .12s, box-shadow .12s',
      });
      const top = mk('div', { display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '5px' });
      top.appendChild(mk('span', {
        fontFamily: "var(--disp)", fontSize: '9px', letterSpacing: '1px', color: '#12100c',
        background: kind.c, borderRadius: '6px', padding: '2px 7px',
      }, kind.tag));
      top.appendChild(mk('span', { flex: '1' }, ''));
      top.appendChild(mk('span', { fontSize: '15px', color: kind.c }, '▶'));
      node.appendChild(top);
      node.appendChild(mk('div', { fontFamily: "var(--disp)", fontSize: '14px', color: '#fff7ea', lineHeight: '1.15' }, a.name));
      node.appendChild(mk('div', { fontSize: '11px', color: '#c9b795', marginTop: '3px' }, a.sub || ''));
      node.addEventListener('pointerenter', () => { node.style.transform = 'translateY(-3px)'; node.style.boxShadow = '0 10px 22px rgba(0,0,0,.5), 0 0 0 3px ' + U.rgba(kind.c, 0.3); if (Z.audio && Z.audio.ctx) Z.audio.sfx.hover(); });
      node.addEventListener('pointerleave', () => { node.style.transform = 'none'; node.style.boxShadow = '0 6px 16px rgba(0,0,0,.4)'; });
      click(node, () => { if (a.screen) Z.ui.show(a.screen); });
      grid.appendChild(node);
    });
    body.appendChild(grid);
  }

  // ---- MISSIONS: the town's request list (lightweight) ----
  function buildMissions(body) {
    body.appendChild(header('MISSIONS', 'jobs from the town'));
    const list = mk('div', { display: 'flex', flexDirection: 'column', gap: '10px' });
    const missions = (D.MISSIONS && D.MISSIONS.length) ? D.MISSIONS : null;
    const done = Z.state.missionsDone || {};
    const rank = Z.state.rankTier || 1;

    if (missions) {
      missions.forEach((m) => {
        const isDone = !!done[m.id];
        const locked = !isDone && (m.minRank || 1) > rank;
        const status = isDone ? { t: 'CLEARED', c: '#4fae9c' } : locked ? { t: 'RANK ' + (m.minRank || 1), c: '#8a8577' } : { t: 'OPEN', c: '#d94f30' };
        const dist = D.districtById ? (D.districtById(m.district) || {}) : {};
        const row = mk('div', {
          display: 'flex', gap: '12px', alignItems: 'center', padding: '12px 14px', borderRadius: '12px',
          background: 'rgba(18,12,28,.72)', border: '2px solid rgba(255,247,234,.14)',
          borderLeft: '5px solid ' + status.c, opacity: locked ? '.6' : '1',
        });
        const mid = mk('div', { flex: '1', minWidth: '0' });
        mid.appendChild(mk('div', { fontFamily: "var(--disp)", fontSize: '14px', color: '#fff7ea' }, m.title || 'Request'));
        mid.appendChild(mk('div', { fontSize: '11px', color: '#8f9ed0', marginTop: '2px' }, (m.client || '') + (dist.name ? '  ·  ' + dist.name : '')));
        row.appendChild(mid);
        const right = mk('div', { flexShrink: '0', textAlign: 'right' });
        right.appendChild(mk('div', { fontFamily: "var(--disp)", fontSize: '11px', letterSpacing: '1px', color: status.c }, status.t));
        right.appendChild(mk('div', { fontSize: '11px', color: '#ffd98a', marginTop: '3px' }, '¥' + U.fmt(m.rewardCredits || 0) + '  ·  ' + (m.rewardRp || 0) + ' RP'));
        row.appendChild(right);
        list.appendChild(row);
      });
      const cta = click(mk('div', {
        marginTop: '6px', textAlign: 'center', padding: '11px', borderRadius: '12px',
        fontFamily: "var(--disp)", fontSize: '13px', color: '#fff7ea',
        background: 'rgba(217,79,48,.85)', border: '2px solid #ffd98a',
      }, 'OPEN THE REQUEST BOARD'), () => Z.ui.show('quests'));
      list.appendChild(cta);
    } else {
      // fallback: use the map areas as objectives
      (D.AREAS || []).forEach((a) => {
        const row = click(mk('div', {
          padding: '12px 14px', borderRadius: '12px', background: 'rgba(18,12,28,.72)',
          border: '2px solid rgba(255,247,234,.14)',
        }, '<div style="font-family:var(--disp);font-size:14px;color:#fff7ea">' + a.name + '</div><div style="font-size:11px;color:#c9b795;margin-top:2px">' + (a.sub || '') + '</div>'), () => a.screen && Z.ui.show(a.screen));
        list.appendChild(row);
      });
    }
    body.appendChild(list);
  }

  // ---- MECH: current unit preview + stats + build shortcut ----
  function buildMech(body) {
    const comp = Z.Bot.compute(Z.state.build);
    const spec = comp.spec;
    spec.name = Z.state.botName;
    body.appendChild(header(Z.state.botName || 'UNIT', comp.chassis.name + '  ·  RATING ' + spec.rating));

    const cols = mk('div', { display: 'flex', flexWrap: 'wrap', gap: '18px', alignItems: 'stretch' });

    // preview
    const panel = mk('div', {
      flex: '1 1 220px', minWidth: '200px', borderRadius: '16px', padding: '10px',
      background: 'radial-gradient(120% 100% at 50% 20%, rgba(80,40,120,.3), rgba(0,0,0,.28))',
      border: '2px solid rgba(255,247,234,.16)', display: 'flex', flexDirection: 'column',
    });
    mechCv = mk('canvas', { width: '100%', height: '230px', display: 'block' });
    panel.appendChild(mechCv);
    const readout = spec.overdraw
      ? '<span style="color:#d94f30">PWR ' + comp.agg.energyDraw + '/' + comp.agg.energyProvide + ' OVERDRAWN</span>'
      : 'PWR ' + comp.agg.energyDraw + '/' + comp.agg.energyProvide;
    panel.appendChild(mk('div', { textAlign: 'center', fontSize: '12px', color: '#c9b795', marginTop: '4px' }, readout + (comp.ready ? '' : '  ·  <span style="color:#d94f30">NEEDS SERVO+LEGS</span>')));
    cols.appendChild(panel);

    // stats
    const statsCol = mk('div', { flex: '1 1 240px', minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '9px' });
    Z.Bot.statList(spec).forEach((s) => {
      const row = mk('div', { display: 'flex', alignItems: 'center', gap: '10px' });
      row.appendChild(mk('div', { flex: '0 0 54px', fontFamily: "var(--disp)", fontSize: '11px', color: '#d94f30', letterSpacing: '1px' }, s.k));
      const track = mk('div', { flex: '1', height: '12px', borderRadius: '6px', background: 'rgba(0,0,0,.35)', border: '1px solid rgba(255,247,234,.14)', overflow: 'hidden' });
      track.appendChild(mk('div', { height: '100%', width: (U.clamp(s.f, 0, 1) * 100).toFixed(0) + '%', background: 'linear-gradient(90deg,#d94f30,#ffd98a)', borderRadius: '6px' }));
      row.appendChild(track);
      row.appendChild(mk('div', { flex: '0 0 62px', textAlign: 'right', fontFamily: "var(--disp)", fontSize: '12px', color: '#fff7ea' }, '' + s.v));
      statsCol.appendChild(row);
    });
    const build = click(mk('div', {
      marginTop: 'auto', textAlign: 'center', padding: '12px', borderRadius: '12px',
      fontFamily: "var(--disp)", fontSize: '14px', color: '#fff7ea',
      background: 'rgba(217,79,48,.85)', border: '2px solid #ffd98a',
    }, 'GO TO THE BENCH'), () => Z.ui.show('house'));
    statsCol.appendChild(build);
    cols.appendChild(statsCol);

    body.appendChild(cols);
  }

  function updateMoney() { const m = document.getElementById('menuMoney'); if (m) m.textContent = U.fmt(Z.state.credits); }

  // ---- enter hook ----
  function enter() {
    styleShell();
    renderTabs();
    renderBody();
    updateMoney();
  }

  // ---- animated background (canvas, behind the DOM) ----
  function ensureMotes() {
    if (motes) return;
    motes = [];
    for (let i = 0; i < 46; i++) motes.push({ x: Math.random(), y: Math.random(), r: U.rand(0.8, 2.6), sp: U.rand(0.01, 0.05), ph: U.rand(0, 6.28) });
  }

  function frame(dt, t) {
    const ctx = Z.render.ctx, W = Z.render.W, H = Z.render.H;
    ensureMotes();
    Z.render.clear();

    // deep indigo -> vermillion base
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#160e28'); g.addColorStop(0.55, '#241031'); g.addColorStop(1, '#3a1220');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // diagonal vermillion sweep bands drifting across the screen
    ctx.save();
    ctx.translate(W * 0.5, H * 0.5);
    ctx.rotate(-0.42);
    const span = Math.hypot(W, H);
    const bandW = span * 0.14;
    for (let i = 0; i < 5; i++) {
      const phase = (t * 26 + i * bandW * 1.9) % (span * 1.6) - span * 0.8;
      ctx.globalAlpha = 0.05 + 0.05 * (i % 2);
      ctx.fillStyle = i % 2 ? '#d94f30' : '#8f63b8';
      ctx.fillRect(phase, -span, bandW, span * 2);
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    // drifting motes
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const m of motes) {
      m.y -= m.sp * dt; if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); }
      const px = (m.x * W + Math.sin(t * 0.5 + m.ph) * 14);
      const py = m.y * H;
      const a = 0.18 + 0.16 * (0.5 + 0.5 * Math.sin(t * 1.4 + m.ph));
      ctx.fillStyle = 'rgba(255,214,150,' + a.toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(px, py, m.r, 0, U.TAU); ctx.fill();
    }
    ctx.restore();

    // large soft vignette so the DOM panels pop
    const vg = ctx.createRadialGradient(W * 0.5, H * 0.5, H * 0.3, W * 0.5, H * 0.5, H * 0.85);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

    // keep the live mech preview spinning while its tab is open
    if (active === 'MECH' && mechCv && mechCv.isConnected) {
      const comp = Z.Bot.compute(Z.state.build);
      comp.spec.name = Z.state.botName;
      Z.render.drawBotPreview(mechCv, comp.spec, t, { facing: 1 });
    }
  }

  function init() { Z.ui.onEnter('menu', enter); }
  return { init, frame };
})();
