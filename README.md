# MY ULTIMATE ZUMO-BOT

**A polished 2D neon-noir cyberpunk game about building sumo battle-bots out of scrap.**

Scavenge parts from the trash, weld a fighting machine in a deep slot-based workshop,
and shove rival bots out of a glowing ring (or grind them to slag) across an 8-tier
underground circuit. Earn credits, climb the ranks, run contracts, and dethrone the
reigning champion — **Apex-Zero** — to become the Ultimate Zumo.

> Scavenge. Weld. Ring Them Out.

## Play

It's a self-contained web game — **no build step, no dependencies**.

- **Online:** open `index.html` on any static host (works out of the box on GitHub Pages).
- **Locally:** serve the folder and open it, e.g.

  ```bash
  python3 -m http.server 8000
  # then visit http://localhost:8000
  ```

  (A local static server is recommended over `file://` so the browser fonts load.)

Progress is saved automatically to your browser's `localStorage`.

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Move | `WASD` / Arrows | Left stick | On-screen stick |
| **Boost** (ring-out tool) | `Space` | `A` | `FIRE` button |
| **Brace** (resist a shove) | `Shift` | `B` / `LT` | `BRACE` button |

Weapons engage automatically on contact; a boost also commits a burst weapon strike.

## Gameplay

- **Scavenge** — The Rust Midden is a *push-your-luck* dig: uncover scrap, credits and
  parts. Deeper digs pay richer, but the hazards multiply — bank your haul before a
  core-mine wipes it.
- **Build** — Fit a chassis + generator, motor, wheels, weapons, armor plates and utility
  modules. Every stat has a cost: weight vs. speed, armor vs. mobility, and a hard
  **energy budget** (over-draw your generator and the whole rig throttles). The bot in the
  workshop is drawn procedurally — it *is* the machine you assembled.
- **Fight** — Top-down momentum sumo in a neon dohyō. Win by **ring-out** (shove the rival
  past the rim) or **knockout** (deplete HP). Own the center; after 25 seconds the ring
  **shrinks** and squeezes campers out. Full game-feel: hit-stop, scaled screen-shake,
  ring-out slow-mo, sparks, damage numbers, and a rim-danger tell.
- **Progress** — Beat rivals for purse + rank points, clear **Contracts** (quests), unlock
  better gear tier by tier, and work your way up the ranked ladder to #1.

## Tech

Vanilla JavaScript + HTML5 Canvas, one global `Z` namespace, classic scripts loaded in
order. All art (the atmospheric cyberpunk scene, every bot, part icons) is rendered
procedurally on canvas; music and SFX are synthesized live with the Web Audio API. No
images, no external libraries.

```
index.html          screens + canvas + script order
css/style.css        holographic cyberpunk UI
js/util.js           math / dom / color / event bus
js/audio.js          procedural darksynth music + SFX
js/data.js           all content: chassis, parts, rivals, ranks, contracts, style
js/save.js           localStorage persistence
js/state.js          game state, currencies, rank/RP
js/bot.js            build model + stat computation + fighter spec
js/fx.js             particles, shake, hit-stop, slow-mo, damage numbers
js/render.js         atmospheric scene + procedural bot renderer
js/ui.js             screen manager, action router, HUD, toasts, tooltips
js/workshop.js       the build screen
js/scavenge.js       the Rust Midden dig
js/shop.js           the Chop-Shop Bazaar
js/quests.js         Contracts
js/ladder.js         ranked ladder + pre-fight
js/combat.js         the Neon Dohyō (physics, AI, weapons, camera, juice)
js/game.js           bootstrap + main loop
```

Enjoy the climb, Zumo.
