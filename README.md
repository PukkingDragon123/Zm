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

- **Main street** — walk with **A / D**, enter doorways with **W / ENTER**. The
  buildings live in the painted backdrop; hanging signs mark each door. Named
  townsfolk yokai wander the street — stop and talk, and pick your answers.
- **Your den** — diegetic build bench: open the gear box, pick a category
  plank, drag a part tile onto its rune socket, then tighten both screws
  (circle them with your finger, or tap fast). Tap a bolted part twice to
  unbolt it. Rune stones set the spirit budget — overdraw and it sputters.
- **The dohyo** — side-view puppet duels beneath the burning shrine:
  **HIT** (J) · **JUMP** (W) · **SKILL** spirit burst (K) · **BLOCK** ward (L/Shift).
  Full touch pad on mobile. Yokai puppeteers stand ringside holding glowing
  spirit strings; KANE-CO sends a hovering middle-manager drone.
- **Kitsune curios** — a real walk-in shop: goods sit on the shelves with
  hanging price tags. Stand at a ware to read its card, press ENTER to buy;
  talk to the tengu at the counter to sell your spares.
- **Request board** — Persona-style jobs from villagers: bring a crew partner,
  clear enemy **waves**, restore the district, get paid. The teahouse (crew
  friendship dialogues) is reached from the board.
- **Ao's ramen** — walk in, hop on a stool, and the blue broom yokai serves
  snacks that buff your next fight.
- **Junk grove** — push-your-luck digging: the main way to find parts.
- **KANE-CO camps** — sneak-in parkour platformer levels (coyote time, jump
  buffering, guards with lantern vision cones) deep in a misty forest —
  ink-silhouette platforms, drifting spores, god rays. Cycle the tanuki's
  HENGE forms: ROCK smashes crates and hides from guards, PAPER glides and
  rides vents, SCISSORS dash-cuts fences. Clear camps for parts and scrap.

## Animation sheets

The 4x2 sprite sheets at `assets/char/tanuki_sheet.png` (top row: 4 walk
frames · bottom row: jump, idle, happy, idle-blink) and
`assets/char/kappa_sheet.png` (top row: idle poses · bottom row: action poses)
drive real frame animation — walk cycles on the street and in the shop, poses
in scenes. If removed, the game falls back to the single cut-out images.

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
