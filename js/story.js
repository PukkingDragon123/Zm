/* ================================================================
   story.js — the campaign spine. Nine ordered beats, each a cutscene
   with a gate (when) and a persistent seen flag in Z.state.s.storySeen.
   check(trigger) plays the FIRST unseen beat whose gate passes (one per
   call, never mid-cutscene). Gates ride the systems the player already
   touches — restoring districts + climbing rank IS the escalation.
   KANE-CO speakers use evil:true (no portrait); allies use their sprite.
   ================================================================ */
Z.story = (function () {
  const D = Z.data;

  const restoredN = () => Object.keys(Z.state.restored || {}).length;
  const campsN = () => Object.keys(Z.state.campsDone || {}).length;
  const anyFriend = (r) => (D.CREW || []).some((c) => Z.state.friendRank(c.id) >= r);

  const BEATS = [
    {
      id: 'b0_intro', when: () => true, scene: () => [
        { who: 'Ao', img: 'ao', side: 'right', text: 'New face. Round one, too. You picked a strange season to wander into Spirit Town, tanuki.' },
        { who: 'Ao', img: 'ao', side: 'right', text: 'KANE-CO machines squat in half our districts now. They measure everything and love nothing.' },
        { who: 'Ao', img: 'ao', side: 'right', text: 'Your den is up the street. Build a little mech from scrap and rune-stones, then check the request board. Earn the town back one district at a time.' },
      ],
    },
    {
      id: 'b1_night', when: () => restoredN() >= 1, scene: () => [
        { who: 'Ao', img: 'ao', side: 'right', text: 'One district breathing again. Feel that? The town remembering it is alive.' },
        { who: 'Ao', img: 'ao', side: 'right', text: 'KANE-CO ships our scrap south every night, to camps that sit in the dark. Take a moonlit walk, keeper. Steal it back.' },
        { who: 'Ao', img: 'ao', side: 'right', text: 'Sleep off the day. Then open the map on your phone once the lanterns go blue.' },
      ],
    },
    {
      id: 'b2_ledger', when: () => Z.state.dayCount >= 2 && campsN() >= 1, scene: () => [
        { who: 'KANE-CO NOTICE', evil: true, side: 'right', text: 'REZONING ADVISORY: this district is filed as unclaimed assets, pending flattening. Please vacate your heritage.' },
        { who: 'Botan', img: 'oni', text: 'They wrote our whole town into a ledger, tanuki. Every stall, every shrine, weighed and scheduled. Cross the jobs off before their calendar does.' },
      ],
    },
    {
      id: 'b3_wingmate', when: () => Z.state.rankTier >= 2 && restoredN() >= 2 && anyFriend(2), scene: () => [
        { who: 'Kaze the Tengu', img: 'tengu', text: 'You do not fight this alone anymore. Take a partner on a request — tengu wind, kappa mending, oni iron. Friendship here is not decoration.' },
        { who: 'Kaze the Tengu', img: 'tengu', text: 'It is armor. When the gale rises at your back on the dohyo, wingmate, that is me.' },
      ],
    },
    {
      id: 'b4_notice', when: () => Z.state.rankTier >= 4 && restoredN() >= 3, scene: () => [
        { who: 'Ambassador Vega', evil: true, side: 'right', text: 'Marvelous energy, tanuki. Off-brand, but marvelous. Head office has opened a file on you. Consider this your first performance review.' },
        { who: 'Ao', img: 'ao', text: 'They noticed you. Good — it means we cost them money. Eat before the next one. The bots come heavier now.' },
      ],
    },
    {
      id: 'b5_headhunter', when: () => Z.state.rankTier >= 5 && restoredN() >= 4, scene: () => [
        { who: 'The Headhunter', evil: true, side: 'right', text: 'Your file says champion. I retire champions. Nothing personal — only a career, and I am ending yours.' },
        { who: 'Sui the Kappa', img: 'kappa', text: 'It came for you, specifically. If we hold the last districts, we force their hand — they send the big one. We do it anyway.' },
      ],
    },
    {
      id: 'b6_harvest', when: () => Z.state.rankTier >= 6 && restoredN() >= 5, scene: () => [
        { who: 'Goro the Oni', img: 'oni', text: 'Little sibling. The harvest fleet is on the mountain road. They mean to take the last of us before dawn.' },
        { who: 'Ao', img: 'ao', text: 'I am closing the shop. First time in forty years. Not for grief — to stand with everyone else. Finish the board. Then climb.' },
      ],
    },
    {
      id: 'b7_last_torii', when: () => Z.state.rankTier >= 7 && restoredN() >= 5 && !Z.state.missionsDone['m10'], scene: () => [
        { who: 'Ao', img: 'ao', text: 'Their undefeated one planted a flag under the summit torii — the gate the kami walk home through. Head office calls it site acquisition complete.' },
        { who: 'Ao', img: 'ao', text: 'Take my broom, for luck. The last request is on the board. One duel decides whether this stays a spirit town. Go, champion.' },
      ],
    },
    {
      id: 'b8_ending', when: () => (Z.state.missionsDone['m10'] || Z.state.beaten['t8_apex_zero']) && !Z.state.won, scene: () => [
        { who: 'APEX-ZERO', evil: true, side: 'right', text: 'To the board: I hereby resign. The town stays. Effective immediately.' },
        { who: 'Spirit Town', text: 'Every lantern in every district is lit at once. The torii glows. Footsteps on the wind — the kami are coming home.' },
        { who: 'Ao', img: 'ao', side: 'right', text: 'You gave the town back its nights. Sit. The Spirit Feast Bowl is free — forever. Welcome home, keeper.' },
      ],
    },
  ];

  function seen(id) { return !!(Z.state.storySeen && Z.state.storySeen[id]); }
  function markSeen(id) {
    Z.state.storySeen[id] = true;
    if (id === 'b8_ending') Z.state.s.won = true;
    Z.state.persist();
  }

  // Play the first unseen beat whose gate passes. One beat per call, never
  // while a cutscene is already up. Returns true if a beat fired.
  function check(trigger) {
    if (Z.cutscene && Z.cutscene.active) return false;
    for (let i = 0; i < BEATS.length; i++) {
      const b = BEATS[i];
      if (seen(b.id)) continue;
      if (!b.when({ trigger })) continue;
      markSeen(b.id);
      Z.cutscene.play(b.scene());
      return true;
    }
    return false;
  }

  function init() { /* beats are pulled by check(); nothing to bind */ }
  return { init, check, seen, BEATS };
})();
