/* ================================================================
   save.js — localStorage persistence with versioning
   ================================================================ */
Z.save = (function () {
  const KEY = 'zumo_save_v1';
  const SET = 'zumo_settings_v1';

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || data.v !== 1) return null;
      return data;
    } catch (e) { return null; }
  }

  function save(state) {
    try {
      const snapshot = {
        v: 1,
        credits: state.credits,
        scrap: state.scrap,
        rp: state.rp,
        rankTier: state.rankTier,
        inventory: state.inventory,
        build: state.build,
        botName: state.botName,
        beaten: state.beaten,
        quests: state.quests,
        claimedQuests: state.claimedQuests,
        stats: state.stats,
        tutorialSeen: state.tutorialSeen,
        scavengeCost: state.scavengeCost,
        buff: state.buff,
      };
      localStorage.setItem(KEY, JSON.stringify(snapshot));
      return true;
    } catch (e) { return false; }
  }

  function wipe() { try { localStorage.removeItem(KEY); } catch (e) {} }

  function loadSettings() {
    try { return JSON.parse(localStorage.getItem(SET)) || null; } catch (e) { return null; }
  }
  function saveSettings(s) { try { localStorage.setItem(SET, JSON.stringify(s)); } catch (e) {} }

  return { load, save, wipe, loadSettings, saveSettings };
})();
