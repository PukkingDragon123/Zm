/* ================================================================
   crew.js — THE TEAHOUSE. Hang out with your crew, talk through
   friendship arcs (Persona-style), raise support ranks.
   ================================================================ */
Z.crew = (function () {
  const U = Z.util, $ = U.$, D = Z.data;
  const SPRITE = { tengu: 'assets/char/tengu.png', kappa: 'assets/char/kappa.png', oni: 'assets/char/oni.png' };

  function hearts(id) {
    const r = Z.state.friendRank(id);
    let s = '';
    for (let i = 1; i <= 5; i++) s += i <= r ? '♥' : '♡';
    return s;
  }

  function render() {
    const host = $('#crewList'); if (!host) return; U.clear(host);
    D.CREW.forEach((c) => {
      const f = Z.state.friendOf(c.id), r = Z.state.friendRank(c.id);
      const card = U.el('div', 'crew-card');
      card.innerHTML = `<img src="${SPRITE[c.id]}" alt="" draggable="false" />
        <h3>${c.name}</h3><div class="c-title">${c.title}</div>
        <div class="hearts">${hearts(c.id)}</div>
        <div class="c-sup"><b>${c.supportName}</b> — ${c.supportDesc} (rank ${r})</div>`;
      const talked = f.talked >= c.talks.length;
      const b = U.el('button', 'pbtn ' + (talked ? '' : 'stamp'), talked ? 'CHAT' : 'TALK');
      b.addEventListener('click', () => talk(c));
      card.appendChild(b);
      host.appendChild(card);
    });
    const m = document.getElementById('crewMoney'); if (m) m.textContent = U.fmt(Z.state.credits);
  }

  function talk(c) {
    const f = Z.state.friendOf(c.id);
    const layer = $('#crewTalk'); if (!layer) return;
    const idx = Math.min(f.talked, c.talks.length - 1);
    const fresh = f.talked < c.talks.length;
    const tk = fresh ? c.talks[idx] : { text: U.choice(c.banter), a: 'Ha, nice.', b: 'Stay sharp out there.', ra: c.winLine, rb: U.choice(c.banter) };
    Z.audio.sfx.click();
    layer.classList.add('show');
    layer.innerHTML = `<div class="talk-box">
      <div class="talk-name">${c.name}</div>
      <img src="${SPRITE[c.id]}" alt="" />
      <div class="talk-text">${tk.text}</div>
      <div class="talk-choices">
        <button class="pbtn" data-c="a">${tk.a}</button>
        <button class="pbtn" data-c="b">${tk.b}</button>
      </div></div>`;
    layer.querySelectorAll('[data-c]').forEach((btn) => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const which = btn.getAttribute('data-c');
      const reply = which === 'a' ? tk.ra : tk.rb;
      const box = layer.querySelector('.talk-box');
      box.querySelector('.talk-text').textContent = reply;
      const ch = box.querySelector('.talk-choices'); U.clear(ch);
      const done = U.el('button', 'pbtn stamp', 'SEE YA');
      done.addEventListener('click', (ev) => { ev.stopPropagation(); close(); });
      ch.appendChild(done);
      // friendship gain
      if (fresh) {
        f.talked++;
        const up = Z.state.addFriendXp(c.id, 10);
        const heart = U.el('div', 'talk-heart', up ? 'FRIENDSHIP RANK UP! ' + hearts(c.id) : '+ friendship');
        box.appendChild(heart);
        if (up) { Z.audio.sfx.rank(); Z.fx.screenFlash(0.22, '#4fae9c'); } else Z.audio.sfx.coin();
      } else {
        const up = Z.state.addFriendXp(c.id, 2);
        if (up) Z.audio.sfx.rank();
      }
    }));
    layer.addEventListener('click', function bg(e) { if (e.target === layer) { close(); layer.removeEventListener('click', bg); } });
    function close() { layer.classList.remove('show'); U.clear(layer); render(); }
  }

  function init() { Z.ui.onEnter('crew', render); }
  return { init, render, hearts, SPRITE };
})();
