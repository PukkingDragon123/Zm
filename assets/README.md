# Art drop-in (layers)

The game renders fine with procedural placeholders. To skin it, drop **PNG**
files at the exact paths below — they load automatically as layers, no code
changes. Transparent PNGs recommended. Side-view, pixel-art to match.

## World (the strip) — parallax, back → front
- `world/sky.png` — full-screen sky (approx 1280×720, tiles horizontally is fine)
- `world/far.png` — distant ruined skyline (scrolls slow)
- `world/mid.png` — mid buildings
- `world/near.png` — near street props
- `world/ground.png` — street floor strip (bottom ~18% of screen)

## Buildings (facades on the street, ~300×320 each)
- `buildings/house.png` — HOME / bench
- `buildings/toyshop.png` — Tanaka's toy & scrap
- `buildings/ramen.png` — Ol' Boy ramen
- `buildings/arena.png` — The Pit
- `buildings/scrap.png` — Scrap Alley
- `buildings/board.png` — Job board

## Characters (side-view, ~44×72; single frame — walk bob is procedural)
- `char/kid.png` — the main kid (facing right; it is mirrored when walking left)
- `char/npc_a.png`, `char/npc_b.png`, `char/npc_c.png` — street NPCs

## Battle (The Pit)
- `battle/bg.png` — arena backdrop (full-screen)
- `battle/crowd.png` — crowd band (wide strip, sits behind the fighters)
- `battle/floor.png` — arena floor
- `battle/operator_left.png` — your kid operator holding a controller (~60×80)
- `battle/operator_right.png` — rival operator holding a controller

Bots themselves are drawn procedurally from the parts you equip, so they always
match your build — no art needed there.
