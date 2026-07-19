/* ================================================================
   state.js — the mutable game state + persistence + progression
   ================================================================ */
Z.state = (function () {
  const D = Z.data;

  const s = {
    credits: 0, scrap: 0, rp: 0, rankTier: 1,
    clock: 9,             // hours 0..24 — day is for chores, night is for raids
    dayCount: 1,
    inventory: {},        // { itemId: count }  (parts AND chassis)
    build: null,
    botName: 'RUST-01',
    beaten: {},           // { enemyId: true }
    claimedQuests: {},    // { questId: true }
    tutorialSeen: false,
    scavengeCost: 40,
    buff: null,           // { hpMul, powMul, name } — consumed on next fight
    friend: {},           // crewId -> { xp, talked }
    campsDone: {},        // campId -> true
    missionsDone: {},     // missionId -> true
    restored: {},         // districtId -> true
    stats: {
      wins: 0, losses: 0, ringOuts: 0, koFinishes: 0, noDamageWins: 0,
      rareFinds: 0, currentStreak: 0, bestStreak: 0, earnedTotal: 0,
      winsByWeapon: {}, matches: 0,
    },
    settings: { music: 55, sfx: 80, shake: true, crt: true, rain: true },
  };

  function fresh() {
    const st = D.START;
    s.credits = st.credits; s.scrap = st.scrap; s.rp = 0; s.rankTier = 1;
    s.inventory = JSON.parse(JSON.stringify(st.inventory));
    s.build = JSON.parse(JSON.stringify(st.build));
    s.botName = st.botName;
    s.beaten = {}; s.claimedQuests = {}; s.tutorialSeen = false; s.scavengeCost = 40; s.buff = null;
    s.friend = {}; s.missionsDone = {}; s.restored = {}; s.campsDone = {};
    s.stats = { wins: 0, losses: 0, ringOuts: 0, koFinishes: 0, noDamageWins: 0, rareFinds: 0, currentStreak: 0, bestStreak: 0, earnedTotal: 0, winsByWeapon: {}, matches: 0 };
  }

  function init() {
    const saved = Z.save.load();
    if (saved) {
      s.credits = saved.credits ?? 220;
      s.scrap = saved.scrap ?? 0;
      s.rp = saved.rp ?? 0;
      s.rankTier = saved.rankTier ?? 1;
      s.clock = saved.clock ?? 9; s.dayCount = saved.dayCount ?? 1;
      s.inventory = saved.inventory || {};
      s.build = saved.build || JSON.parse(JSON.stringify(D.START.build));
      s.botName = saved.botName || 'RUST-01';
      s.beaten = saved.beaten || {};
      s.claimedQuests = saved.claimedQuests || {};
      s.tutorialSeen = !!saved.tutorialSeen;
      s.scavengeCost = saved.scavengeCost || 40;
      s.buff = saved.buff || null;
      s.friend = saved.friend || {};
      s.missionsDone = saved.missionsDone || {};
      s.restored = saved.restored || {};
      s.campsDone = saved.campsDone || {};
      if (saved.stats) Object.assign(s.stats, saved.stats);
      migrateBuild();
    } else {
      fresh();
    }
    recomputeRank();
    const set = Z.save.loadSettings();
    if (set) Object.assign(s.settings, set);
    return s;
  }

  // Ensure the build's slot arrays match its chassis (in case of data changes).
  function migrateBuild() {
    const ch = D.chassisById(s.build && s.build.chassis) || D.chassis[0];
    const b = s.build || {};
    b.chassis = ch.id;
    ['weapon', 'armor', 'utility'].forEach((k) => {
      const n = ch.slots[k];
      if (!Array.isArray(b[k])) b[k] = [];
      b[k].length = n;
      for (let i = 0; i < n; i++) if (b[k][i] === undefined) b[k][i] = null;
    });
    ['generator', 'motor', 'wheels'].forEach((k) => { if (b[k] === undefined) b[k] = null; });
    s.build = b;
  }

  function persist() { Z.save.save(s); }
  function persistSettings() { Z.save.saveSettings(s.settings); }

  // ---- currencies ----
  // track=true only for genuine earnings (fight purse, salvage, scavenge) —
  // quest and rank-up reward credits are NOT counted toward earn_credits contracts.
  function addCredits(n, track) { s.credits = Math.max(0, s.credits + n); if (n > 0 && track) { s.stats.earnedTotal += n; } Z.util.bus.emit('wallet'); }
  function spend(n) { if (s.credits < n) return false; s.credits -= n; Z.util.bus.emit('wallet'); return true; }
  function addScrap(n) { s.scrap = Math.max(0, s.scrap + n); Z.util.bus.emit('wallet'); }

  // ---- inventory ----
  function invCount(id) { return s.inventory[id] || 0; }
  function addItem(id, n = 1) { s.inventory[id] = (s.inventory[id] || 0) + n; Z.util.bus.emit('inventory'); }
  function removeItem(id, n = 1) {
    if (!s.inventory[id]) return false;
    s.inventory[id] -= n;
    if (s.inventory[id] <= 0) delete s.inventory[id];
    Z.util.bus.emit('inventory');
    return true;
  }
  // Count how many of an item are currently bolted onto the build (so we don't
  // let the player sell/equip more than they own).
  function equippedCount(id) {
    const b = s.build; if (!b) return 0;
    let c = 0;
    if (b.chassis === id) c++;
    if (b.generator === id) c++;
    if (b.motor === id) c++;
    if (b.wheels === id) c++;
    ['weapon', 'armor', 'utility'].forEach((k) => (b[k] || []).forEach((x) => { if (x === id) c++; }));
    return c;
  }
  function availableCount(id) { return invCount(id) - equippedCount(id); }

  // ---- rank / RP ----
  function currentRank() {
    let r = D.ranks[0];
    for (const rk of D.ranks) if (s.rp >= rk.rpNeeded) r = rk;
    return r;
  }
  function nextRank() {
    for (const rk of D.ranks) if (rk.rpNeeded > s.rp) return rk;
    return null;
  }
  function recomputeRank() {
    const r = currentRank();
    s.rankTier = r.tier;
    return r;
  }
  // Add RP; returns array of rank objects newly reached (for reward/toast).
  function addRp(n) {
    const before = s.rankTier;
    s.rp += n;
    const now = currentRank();
    const reached = [];
    if (now.tier > before) {
      for (const rk of D.ranks) if (rk.tier > before && rk.tier <= now.tier) reached.push(rk);
      s.rankTier = now.tier;
    }
    Z.util.bus.emit('wallet');
    return reached;
  }

  // Highest rival tier the player may challenge.
  function maxChallengeTier() { return Math.min(8, s.rankTier + 1); }

  // ---- match result bookkeeping (called by combat) ----
  function recordWin(info) {
    // info: { ringOut, ko, noDamage, weaponType, purse, rp }
    s.stats.wins++; s.stats.matches++;
    s.stats.currentStreak++;
    s.stats.bestStreak = Math.max(s.stats.bestStreak, s.stats.currentStreak);
    if (info.ringOut) s.stats.ringOuts++;
    if (info.ko) s.stats.koFinishes++;
    if (info.noDamage) s.stats.noDamageWins++;
    if (info.weaponType && info.weaponType !== 'none') {
      s.stats.winsByWeapon[info.weaponType] = (s.stats.winsByWeapon[info.weaponType] || 0) + 1;
    }
  }
  function recordLoss() { s.stats.losses++; s.stats.matches++; s.stats.currentStreak = 0; }

  function reset() { Z.save.wipe(); fresh(); recomputeRank(); persist(); Z.util.bus.emit('wallet'); Z.util.bus.emit('inventory'); }

  return {
    get s() { return s; },
    // convenient direct getters used across modules
    get credits() { return s.credits; }, get scrap() { return s.scrap; },
    get rp() { return s.rp; }, get rankTier() { return s.rankTier; },
    get inventory() { return s.inventory; }, get build() { return s.build; },
    set build(b) { s.build = b; }, get botName() { return s.botName; }, set botName(n) { s.botName = n; },
    get beaten() { return s.beaten; }, get quests() { return s.quests; },
    get claimedQuests() { return s.claimedQuests; }, get stats() { return s.stats; },
    get settings() { return s.settings; },
    get tutorialSeen() { return s.tutorialSeen; }, set tutorialSeen(v) { s.tutorialSeen = v; },
    get scavengeCost() { return s.scavengeCost; }, set scavengeCost(v) { s.scavengeCost = v; },
    get buff() { return s.buff; },
    // ---- day/night clock ----
    get clock() { return s.clock; }, set clock(h) { s.clock = ((h % 24) + 24) % 24; },
    get dayCount() { return s.dayCount; },
    get isNight() { return s.clock < 6 || s.clock >= 19; },
    advanceClock(h) { s.clock += h; while (s.clock >= 24) { s.clock -= 24; s.dayCount++; } persist(); },
    setClock(h) { s.clock = ((h % 24) + 24) % 24; persist(); },
    setBuff(b) { s.buff = b; persist(); },
    takeBuff() { const b = s.buff; s.buff = null; persist(); return b; },
    // ---- crew friendship (rank 1-5, 30 xp per rank) ----
    get friend() { return s.friend; },
    get missionsDone() { return s.missionsDone; },
    get restored() { return s.restored; },
    get campsDone() { return s.campsDone; },
    friendOf(id) { if (!s.friend[id]) s.friend[id] = { xp: 0, talked: 0 }; return s.friend[id]; },
    friendRank(id) { const f = s.friend[id]; return Math.min(5, 1 + Math.floor(((f && f.xp) || 0) / 30)); },
    addFriendXp(id, n) {
      const f = this.friendOf(id); const before = this.friendRank(id);
      f.xp += n; const after = this.friendRank(id); persist();
      return after > before ? after : 0;   // returns new rank on rank-up
    },
    init, fresh, persist, persistSettings, reset, migrateBuild,
    addCredits, spend, addScrap,
    invCount, addItem, removeItem, equippedCount, availableCount,
    currentRank, nextRank, recomputeRank, addRp, maxChallengeTier,
    recordWin, recordLoss,
  };
})();
