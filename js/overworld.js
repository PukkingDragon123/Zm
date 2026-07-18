/* ================================================================
   overworld.js — Spirit Town main street. The buildings live in the
   painted backdrop; we only mark the doors with hanging signs.
   Yokai townsfolk wander their patch of street and stop to chat —
   real back-and-forth dialogue with answers. Walk A/D, act with W.
   ================================================================ */
Z.overworld = (function () {
  const U = Z.util, D = Z.data;
  const LEN = D.STREET_LEN;
  const SPEED = 250, NPC_SPEED = 55;
  let kid = { x: 560, vx: 0, facing: 1, walk: 0, turn: 0 };
  let camX = 0, near = null, nearNpc = null, started = false;
  let npcs = null;
  const lift = {};   // building id -> eased 0..1 highlight

  function enter() { if (!started) { started = true; kid.x = 560; } buildNpcs(); }

  function buildNpcs() {
    if (npcs) return;
    npcs = D.NPCS.map((n, i) => ({
      def: n, home: n.x, x: n.x, facing: i % 2 ? -1 : 1,
      state: 'idle', wait: U.rand(1.5, 4), target: n.x, walk: 0, seed: i * 1.7,
    }));
  }

  function shortKey(img) { return (img || '').replace('char.', ''); }

  function talkTo(n) {
    const talk = n.def.talk; if (!talk) return;
    Z.audio.sfx.click();
    const sk = shortKey(n.def.img);
    Z.cutscene.play([{
      who: n.def.name, img: sk, text: talk.text,
      choices: (talk.choices || []).map((c) => ({
        label: c.label,
        then: (c.lines || []).map((l) => ({ who: n.def.name, img: sk, text: l.text })),
      })),
    }]);
  }

  function frame(dt, t) {
    const W = Z.render.W, H = Z.render.H, ctx = Z.render.ctx;
    const groundY = H * 0.84;
    const inScene = Z.cutscene && Z.cutscene.active;
    if (!npcs) buildNpcs();
    const prompt = document.getElementById('interactPrompt');

    // ---- update (frozen while a dialogue scene is showing) ----
    if (!inScene) {
      const dir = Z.controls ? Z.controls.dir : 0;
      if (dir && dir !== kid.facing) { kid.facing = dir; kid.turn = 1; }   // paper flip on turn
      if (kid.turn > 0) kid.turn = Math.max(0, kid.turn - dt * 5);
      kid.vx = dir * SPEED;
      kid.x = U.clamp(kid.x + kid.vx * dt, 30, LEN - 30);
      kid.walk = Math.abs(kid.vx) > 1 ? kid.walk + dt : 0;
      camX = U.clamp(kid.x - W * 0.5, 0, Math.max(0, LEN - W));

      // townsfolk wander: idle -> pick a spot near home -> walk -> idle
      for (const n of npcs) {
        if (Math.abs(kid.x - n.x) < 90) {              // stop and face the player
          n.state = 'idle'; n.wait = Math.max(n.wait, 0.6); n.walk = 0;
          n.facing = kid.x < n.x ? -1 : 1;
        } else if (n.state === 'walk') {
          const d = n.target - n.x, step = NPC_SPEED * dt;
          n.facing = d < 0 ? -1 : 1;
          if (Math.abs(d) <= step) { n.x = n.target; n.state = 'idle'; n.wait = U.rand(1.5, 4); n.walk = 0; }
          else { n.x += Math.sign(d) * step; n.walk += dt; }
        } else {
          n.wait -= dt;
          if (n.wait <= 0) {
            n.target = U.clamp(n.home + U.rand(-140, 140), 40, LEN - 40);
            if (Math.abs(n.target - n.x) > 12) { n.state = 'walk'; n.walk = 0; }
            else n.wait = U.rand(1.5, 4);
          }
        }
      }

      // interact targets — a nearby yokai wins over a door
      nearNpc = null; let bn = 90;
      for (const n of npcs) { const d = Math.abs(kid.x - n.x); if (d < bn) { bn = d; nearNpc = n; } }
      near = null; let best = 120;
      for (const b of D.BUILDINGS) { const d = Math.abs(kid.x - (b.x + b.w / 2)); if (d < best) { best = d; near = b; } }
      if (nearNpc) near = null;

      if (prompt) {
        if (nearNpc) { prompt.textContent = 'TALK — ' + nearNpc.def.name; prompt.classList.add('show'); }
        else if (near) { prompt.textContent = 'ENTER — ' + near.sign; prompt.classList.add('show'); }
        else prompt.classList.remove('show');
      }
      if (Z.controls && Z.controls.consumeInteract()) {
        if (nearNpc) talkTo(nearNpc);
        else if (near) { Z.audio.sfx.click(); Z.ui.show(near.screen); return; }
      }
    } else {
      kid.vx = 0; kid.walk = 0;
      if (prompt) prompt.classList.remove('show');
    }

    // ---- draw ----
    // painted street backdrop w/ gentle parallax
    const off = 0.5 - (camX / Math.max(1, LEN - W) - 0.5) * 0.14;
    if (!Z.assets.cover(ctx, 'world.sakura', 0, 0, W, H, off) && !Z.assets.cover(ctx, 'world.street', 0, 0, W, H, off)) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#f0b26a'); g.addColorStop(0.55, '#d98d55'); g.addColorStop(1, '#7d5638');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // soft ground shade band so cutouts read
    const gg = ctx.createLinearGradient(0, groundY - 26, 0, H);
    gg.addColorStop(0, 'rgba(40,22,10,0)'); gg.addColorStop(1, 'rgba(40,22,10,.5)');
    ctx.fillStyle = gg; ctx.fillRect(0, groundY - 26, W, H - groundY + 26);

    // restored district lantern strings — the restoration reward, kept subtle
    const restoredIds = Object.keys(Z.state.restored || {});
    restoredIds.forEach((id, i) => {
      const seg = (i + 0.5) * (LEN / Math.max(4, restoredIds.length + 1));
      drawLanternString(ctx, seg - camX, H * 0.2 + (i % 2) * 24, t + i);
    });

    // doorway markers — one hanging sign + a warm door glow per building
    for (const b of D.BUILDINGS) {
      const sx = b.x + b.w / 2 - camX;
      const hot = near === b;
      lift[b.id] = U.lerp(lift[b.id] || 0, hot ? 1 : 0, Math.min(1, dt * 9));
      if (sx < -140 || sx > W + 140) continue;
      drawDoorMarker(ctx, b, sx, groundY, t, lift[b.id]);
    }

    // townsfolk yokai (walk spritesheets where available, gentle bob otherwise)
    npcs.forEach((n, i) => {
      const sx = n.x - camX; if (sx < -70 || sx > W + 70) return;
      const walking = n.state === 'walk' && !inScene;
      const soft = n.def.img === 'char.kappa' || n.def.img === 'char.tanuki';   // real sheet frames
      const bob = walking ? Math.abs(Math.sin(n.walk * 9 + n.seed)) * (soft ? 2 : 5) : Math.sin(t * 2.2 + n.seed) * 2;
      Z.render.drawSprite(n.def.img, sx, groundY, {
        w: 84, bob, facing: n.facing,
        squash: walking ? Math.cos(n.walk * 18 + n.seed) * 0.03 : Math.sin(t * 2.2 + n.seed) * 0.02,
        sway: walking ? Math.sin(n.walk * 9 + n.seed) * 0.04 : Math.sin(t * 1.8 + n.seed) * 0.02,
        anim: walking ? 'walk' : 'idle', animT: walking ? n.walk : t + n.seed,
      });
      if (Math.abs(kid.x - n.x) < 90) Z.render.pxText(ctx, n.def.name, sx, groundY - 108, 10, '#f5ecd7', 'center');
    });

    // the tanuki — walk-sheet frames + squash & stretch + paper turn-flip
    const kx = kid.x - camX;
    const moving = Math.abs(kid.vx) > 1;
    const hasSheet = Z.assets.ready('sheet.tanuki');
    const hop = moving ? Math.abs(Math.sin(kid.walk * 9)) * (hasSheet ? 5 : 12) : Math.sin(t * 2.2) * 2.5;
    const squash = moving ? Math.cos(kid.walk * 18) * (hasSheet ? 0.03 : 0.06) : Math.sin(t * 2.2) * 0.025;
    if (!Z.render.drawSprite('char.tanuki', kx, groundY, { w: 112, bob: hop, squash, facing: kid.facing, turn: kid.turn, sway: moving ? Math.sin(kid.walk * 9) * 0.05 : 0, anim: moving ? 'walk' : 'idle', animT: moving ? kid.walk : t })) {
      ctx.fillStyle = '#7a5a3a'; ctx.fillRect(kx - 18, groundY - 60, 36, 60);
    }
    if (moving && Math.random() < 0.2) Z.fx.dust(kx - kid.facing * 16, groundY, 1, '#c9a76b');

    Z.render.drawPetals(t);
  }

  // one clean marker per doorway: hanging wooden sign plank + door glow
  function drawDoorMarker(ctx, b, sx, groundY, t, hot) {
    const P = (p, f, o) => Z.render.paperFill(ctx, p, f, o);
    // soft warm glow at ground level where the door is
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const gw = 60 + hot * 30;
    const gr = ctx.createRadialGradient(sx, groundY - 8, 4, sx, groundY - 8, gw);
    gr.addColorStop(0, 'rgba(255,188,110,' + (0.2 + hot * 0.2).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(sx, groundY - 6, gw, gw * 0.5, 0, 0, U.TAU); ctx.fill(); ctx.restore();

    // hanging sign: pivot above, two strings, gentle sway; lifts when near
    const sway = Math.sin(t * 1.4 + b.x * 0.013) * 0.05;
    const sw = Math.max(96, b.sign.length * 10.5 + 30), sh = 34;
    ctx.save();
    ctx.translate(sx, groundY - 226 - hot * 8);
    ctx.rotate(sway);
    const sy = 44;                                     // plank top below the pivot
    ctx.strokeStyle = 'rgba(47,36,24,.7)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-sw * 0.3, sy + 2); ctx.lineTo(0, -6); ctx.lineTo(sw * 0.3, sy + 2); ctx.stroke();
    ctx.fillStyle = '#2f2418'; ctx.beginPath(); ctx.arc(0, -6, 3, 0, U.TAU); ctx.fill();
    P(() => Z.render.roundRect(ctx, -sw / 2, sy, sw, sh, 8), hot > 0.5 ? '#c9803f' : '#a9805a', { cut: 4 });
    ctx.strokeStyle = 'rgba(47,36,24,.25)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-sw / 2 + 8, sy + sh - 7); ctx.lineTo(sw / 2 - 8, sy + sh - 7); ctx.stroke();
    Z.render.pxText(ctx, b.sign, 0, sy + 23, 12, hot > 0.5 ? '#fff1d6' : '#f5ecd7', 'center');
    // small down-arrow bobbing under the sign when the player is near
    if (hot > 0.05) {
      ctx.globalAlpha = hot;
      const ay = sy + sh + 14 + Math.sin(t * 5) * 5;
      P(() => { ctx.beginPath(); ctx.moveTo(-9, ay); ctx.lineTo(9, ay); ctx.lineTo(9, ay + 8); ctx.lineTo(0, ay + 18); ctx.lineTo(-9, ay + 8); ctx.closePath(); }, '#d94f30', { noShadow: true, cut: 3 });
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawLanternString(ctx, x, y, t) {
    if (x < -300 || x > Z.render.W + 300) return;
    ctx.strokeStyle = 'rgba(35,22,10,.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 190, y); ctx.quadraticCurveTo(x, y + 42, x + 190, y); ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const lt = -0.8 + i * 0.4, lx = x + lt * 190, ly = y + (1 - lt * lt) * 34 + Math.sin(t * 2 + i) * 3;
      const col = ['#ff8f5e', '#ffd98a', '#8fd0b8', '#ffd98a', '#ff8f5e'][i];
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(lx, ly, 1, lx, ly, 15); g.addColorStop(0, 'rgba(255,200,120,.32)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(lx - 15, ly - 15, 30, 30); ctx.restore();
      ctx.fillStyle = col; ctx.strokeStyle = '#2f2418'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(lx, ly + 8, 7, 10, 0, 0, U.TAU); ctx.fill(); ctx.stroke();
    }
  }

  function init() { Z.ui.onEnter('world', enter); }
  return { init, frame, get kidX() { return kid.x; } };
})();
