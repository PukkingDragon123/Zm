# ZUMO — Spirit Town Scrappers

**A paper-cutout yokai adventure.** The human megacorp KANE-CO sent its soulless
robots to strip the spirit world for profit. The yokai fight back the only way
spirits can: they manifest battle-puppets out of wood, rope and glowing rune
stones — and duel in the dohyo.

You are the round new tanuki in town. Build a spirit puppet at your den, take
requests with your crew, drive KANE-CO out district by district, and become
grand champion.

Self-contained web game — **vanilla JS + HTML5 Canvas, no build step.** Open
`index.html` on any static host.

## Play

- **Main street** — walk with **A / D**, enter doorways with **W / ENTER**. Talk
  to townsfolk yokai; petals fall; restored districts light up with lanterns.
- **Your den** — physics-drag workbench: hang wood, charms and rune stones on
  your puppet. Rune stones set the spirit budget — overdraw and it sputters.
- **The dohyo** — side-view puppet duels beneath the burning shrine:
  **HIT** (J) · **JUMP** (W) · **SKILL** spirit burst (K) · **BLOCK** ward (L/Shift).
  Full touch pad on mobile. Yokai puppeteers stand ringside holding glowing
  spirit strings; KANE-CO sends a hovering middle-manager drone.
- **Request board** — Persona-style jobs from villagers: bring a crew partner,
  clear enemy **waves**, restore the district, get paid.
- **The teahouse** — friendship dialogues with your crew (Tengu, Kappa, Oni).
  Higher friendship = stronger battle support (sharper attacks, mid-mission
  repairs, iron armor).
- **Ao's ramen** — the blue broom yokai serves snacks that buff your next fight.
- **Junk grove** — push-your-luck digging for free parts.

## Credits & art

Character art and painted backdrops in `assets/` were supplied by the project
owner. Everything else — the paper-cutout puppet renderer, VFX (spirit circles,
speed lines, shockwaves, petals), pentatonic koto/taiko soundtrack and SFX — is
procedural, in-code.

## Files

```
index.html            screens + script order
css/style.css         washi-paper / hanko-stamp UI
js/content.js         generated narrative content (names, dialogue, missions)
js/data.js            parts, puppets, enemies, ranks, crew, missions, snacks
js/render.js          paper-cutout renderer: sprites, humanoid puppets, petals
js/overworld.js       main street (side-scroll)
js/combat.js          the dohyo: waves, jump/hit/skill/block, puppeteers
js/crew.js            teahouse friendship dialogues
js/quests.js          request board (missions) + bounties
js/workbench.js       physics-drag puppet bench
js/shop.js ramen.js scavenge.js ladder.js   interiors
js/fx.js audio.js controls.js ui.js state.js save.js bot.js game.js
```
