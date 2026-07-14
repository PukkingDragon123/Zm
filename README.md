# ZUMO — STREET SCRAPPERS

**A gritty post-apocalyptic street game about building junk battle-bots and brawling up the block.**

After the grid went dark, the kids of Block 7 rebuilt the only thing worth
fighting over: scrap battle-bots. Walk the strip, weld a scrapper at your bench,
and brawl your way from gutter nobody to king of the Pit.

Self-contained web game — **vanilla JS + HTML5 Canvas, no build step, no dependencies.**
Open `index.html` on any static host (works on GitHub Pages).

## Play

- **The strip** — a side-scrolling street. Walk with **A / D** (or the on-screen
  `<` `>` pad). Stop at a shop and press **W / ENTER** to go in. Chat to NPCs.
- **Home / the bench** — a hands-on workbench: **drag junk parts onto your bot**
  (heavy parts swing — physics), drop them on a mount to bolt them in, or in the
  scrap bin to sell. Balance weight, power and the energy budget live.
- **Tanaka's** — buy parts with cash or scrap; sell spares.
- **Ol' Boy Ramen** — buy a bowl for a one-fight buff.
- **Scrap Alley** — push-your-luck dig for free parts; bank before a mine hits.
- **The Job Board** — contracts for cash, scrap and rank.
- **The Pit** — pick a rival and brawl.

## The Pit (battle)

Side-view 2D brawls. You and the rival each stand at the edge holding a
controller while your bots fight in front of a crowd.

| Action | Keyboard | On-screen pad |
|---|---|---|
| Move | A / D (or arrows) | `<` `>` |
| Attack | J | HIT |
| Skill (heavy special) | K | SKL |
| Block | L / Shift (hold) | BLK |

Drop the rival's HP to zero for a knockout. Climb eight tiers of rival to
dethrone **Apex-Zero** and become king of the block.

## Look & feel

Gritty post-apocalyptic street: dusty amber dusk, rusted steel and concrete,
hand-painted signs, dim broken neon. Pixel fonts, heavy grain and haze, no
flashy holo-UI. Everything (world, bots, effects, part icons) is drawn
procedurally on canvas; audio is synthesized live.

**Add your own art:** the world/characters/battle render as layered placeholders
you can replace with PNGs — see [`assets/README.md`](assets/README.md). Drop files
in and they appear automatically; no code changes.

## Files

```
index.html            screens + canvas + script order
css/style.css         pixel / gritty stylesheet
js/util.js            math / dom / color / event bus
js/assets.js          layered image loader (+ placeholders)
js/audio.js           synthesized music + SFX
js/data.js            content: parts, rivals, ranks, jobs, buildings, npcs, ramen
js/save.js  state.js  persistence + game state
js/bot.js             build model + stat computation
js/fx.js              particles, shake, hit-stop, slow-mo, damage numbers
js/render.js          street ambient + side-view bot renderer + pixel text
js/controls.js        keyboard + on-screen pad (move/hit/skill/block)
js/ui.js              screen manager, money HUD, toasts, tooltips
js/overworld.js       the side-scrolling strip
js/workbench.js       physics-drag build bench
js/shop.js ramen.js scavenge.js quests.js ladder.js   the interiors
js/combat.js          The Pit — side-view brawl, crowd, operators, VFX
js/game.js            bootstrap + main loop
```
