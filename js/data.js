/* ================================================================
   data.js — all game content (chassis, parts, rivals, ranks, quests, style)
   Cross-references (quest rival params, reward part ids, weapon params)
   are normalized to real ids below.
   ================================================================ */
Z.data = (function () {

  // Unified palette used by the canvas renderer (kept in sync with CSS vars).
  const PAL = {
    bg: '#20180f', bg2: '#2c2214',
    neonA: '#d9a441', neonB: '#d94f30', neonC: '#7f9e6a',
    purple: '#8f63b8', warn: '#c23b2f', gold: '#d9a441',
    metal: '#8a8577', ink: '#f5ecd7', dim: '#c9b795',
    amber: '#d9a441', rust: '#a6552f', teal: '#4fae9c', red: '#c23b2f', steel: '#8a8577',
    paper: '#f5ecd7', verm: '#d94f30', spirit: '#4fae9c', indigo: '#41607a', sumi: '#2f2418',
  };

  const RARITY = {
    common:    { i: 0, color: '#9fb2c6', label: 'COMMON' },
    uncommon:  { i: 1, color: '#5be08a', label: 'UNCOMMON' },
    rare:      { i: 2, color: '#3fb4ff', label: 'RARE' },
    epic:      { i: 3, color: '#c07bff', label: 'EPIC' },
    legendary: { i: 4, color: '#ffcf4d', label: 'LEGENDARY' },
  };

  const CAT_ICON = { chassis: 'FRM', generator: 'GEN', motor: 'MOT', wheels: 'WHL', weapon: 'WPN', armor: 'ARM', utility: 'UTL' };
  const WPN_ICON = { spinner: 'SPN', hammer: 'HMR', flipper: 'FLP', blade: 'BLD', flamer: 'FLM', none: '-' };
  const WPN_LABEL = { spinner: 'SPINNER', hammer: 'HAMMER', flipper: 'FLIPPER', blade: 'BLADE', flamer: 'FLAMER', none: 'UNARMED' };

  // ---------------- CHASSIS ----------------
  const chassis = [
    { id: 'cha_alleycat', name: 'Alleycat', rarity: 'common', baseHp: 95, weight: 12, traction: 14, price: 130, salvage: 28, dropWeight: 100, slots: { weapon: 1, armor: 1, utility: 2 }, desc: 'Stripped courier drone reborn as a gutter scrapper — feather-light, twitchy, always one shove from the ropes.' },
    { id: 'cha_rustpan', name: 'Rustpan Skimmer', rarity: 'common', baseHp: 115, weight: 16, traction: 20, price: 120, salvage: 25, dropWeight: 95, slots: { weapon: 1, armor: 1, utility: 1 }, desc: 'A dead floor-scrubber welded into a fighter. Ugly, cheap, and stubborn enough to survive its first ring.' },
    { id: 'cha_scrapjaw', name: 'Scrapjaw Brawler', rarity: 'uncommon', baseHp: 175, weight: 40, traction: 30, price: 470, salvage: 94, dropWeight: 55, slots: { weapon: 2, armor: 2, utility: 1 }, desc: 'Twin-mount pit frame off the underring circuit — it bites first and counts Credits later.' },
    { id: 'cha_viper', name: 'Neon Viper', rarity: 'rare', baseHp: 165, weight: 34, traction: 26, price: 1100, salvage: 220, dropWeight: 24, slots: { weapon: 2, armor: 1, utility: 2 }, desc: 'Razor-thin aggro chassis bred for spinner rushdown — glass jaw, murderous bite, gone before you blink.' },
    { id: 'cha_bulwark', name: 'Bulwark Mk-II', rarity: 'rare', baseHp: 270, weight: 70, traction: 48, price: 1200, salvage: 240, dropWeight: 26, slots: { weapon: 1, armor: 3, utility: 2 }, desc: 'Riot-barricade steel on locked tracks. Built to eat hits and squat dead-center all night long.' },
    { id: 'cha_ronin', name: 'Ghost Ronin', rarity: 'epic', baseHp: 250, weight: 48, traction: 34, price: 2400, salvage: 480, dropWeight: 11, slots: { weapon: 2, armor: 2, utility: 3 }, desc: 'Boutique speed-frame smuggled out of a corp lab — hit-and-run artistry with a bay for every dirty trick.' },
    { id: 'cha_juggernaut', name: 'Juggernaut-9', rarity: 'epic', baseHp: 390, weight: 90, traction: 62, price: 2800, salvage: 560, dropWeight: 9, slots: { weapon: 2, armor: 4, utility: 2 }, desc: "Nine tonnes of grudge. You don't ring this thing out — you wait for its battery to die." },
    { id: 'cha_oni', name: 'Oni Overlord', rarity: 'legendary', baseHp: 460, weight: 95, traction: 66, price: 5200, salvage: 1040, dropWeight: 4, slots: { weapon: 3, armor: 3, utility: 3 }, desc: 'The apex war-frame of the underring: three weapon mounts, temple-demon plating, and a rap sheet of ring-outs.' },
  ];

  // ---------------- PARTS ----------------
  const parts = [
    // generators
    { id: 'gen_sputter', name: 'Sputter Cell', category: 'generator', rarity: 'common', stats: { energyProvide: 28, weight: 5 }, weapon: null, price: 80, salvage: 16, dropWeight: 105, desc: 'Leaky junkyard fuel cell that coughs out just enough juice to roll and swing once.' },
    { id: 'gen_dynamo', name: 'Scrap Dynamo', category: 'generator', rarity: 'common', stats: { energyProvide: 40, weight: 7 }, weapon: null, price: 120, salvage: 24, dropWeight: 95, desc: 'Hand-cranked generator bolted from mower guts — dependable, wheezy, dirt cheap.' },
    { id: 'gen_arc', name: 'Arc Cell', category: 'generator', rarity: 'uncommon', stats: { energyProvide: 62, weight: 9 }, weapon: null, price: 310, salvage: 62, dropWeight: 55, desc: 'Salvaged tram capacitor that hums blue and powers a real weapon without stalling the wheels.' },
    { id: 'gen_plasma', name: 'Plasma Core', category: 'generator', rarity: 'rare', stats: { energyProvide: 88, weight: 11 }, weapon: null, price: 880, salvage: 176, dropWeight: 25, desc: 'Sealed plasma flask off a black-market med rig — clean, steady, worth more than your first bot.' },
    { id: 'gen_tokamak', name: 'Tokamak Brick', category: 'generator', rarity: 'epic', stats: { energyProvide: 120, weight: 14 }, weapon: null, price: 2100, salvage: 420, dropWeight: 10, desc: 'A miniature fusion brick that glows through the chassis — feeds two hungry weapons at once.' },
    { id: 'gen_antimatter', name: 'Antimatter Cell', category: 'generator', rarity: 'legendary', stats: { energyProvide: 160, weight: 16 }, weapon: null, price: 4900, salvage: 980, dropWeight: 3, desc: 'Contraband containment vial from a decommissioned dreadnought. Limitless power, one bad day.' },
    // motors
    { id: 'mot_junker', name: 'Junker Coil', category: 'motor', rarity: 'common', stats: { power: 14, speed: 16, energyDraw: 8, weight: 5 }, weapon: null, price: 90, salvage: 18, dropWeight: 100, desc: 'Rewound washing-machine motor. Grinds, sparks, and pushes about as hard as a polite shrug.' },
    { id: 'mot_torquemule', name: 'Torque Mule', category: 'motor', rarity: 'uncommon', stats: { power: 30, speed: 22, energyDraw: 15, weight: 9 }, weapon: null, price: 330, salvage: 66, dropWeight: 55, desc: 'Gear-reduced grunt motor that trades top speed for shove — perfect for the center-ring shoving match.' },
    { id: 'mot_sprint', name: 'Sprint Servo', category: 'motor', rarity: 'uncommon', stats: { power: 20, speed: 34, energyDraw: 14, weight: 6 }, weapon: null, price: 320, salvage: 64, dropWeight: 52, desc: 'High-rev drone servo geared for pace — light on its wheels, thin on push.' },
    { id: 'mot_ironhide', name: 'Ironhide Drive', category: 'motor', rarity: 'rare', stats: { power: 46, speed: 34, energyDraw: 24, weight: 12 }, weapon: null, price: 950, salvage: 190, dropWeight: 24, desc: 'Armored dual-shaft drive off a mining loader — the shove that starts winning ring-outs.' },
    { id: 'mot_maglev', name: 'Maglev Thruster', category: 'motor', rarity: 'epic', stats: { power: 60, speed: 58, energyDraw: 34, weight: 13 }, weapon: null, price: 2200, salvage: 440, dropWeight: 9, desc: 'Frictionless mag-drive that skates across the ring and hits like a freight sled.' },
    { id: 'mot_fusion', name: 'Fusion Powertrain', category: 'motor', rarity: 'legendary', stats: { power: 92, speed: 66, energyDraw: 50, weight: 17 }, weapon: null, price: 5100, salvage: 1020, dropWeight: 3, desc: 'Warhead-grade drivetrain that turns any chassis into a battering ram — if your cell can feed it.' },
    // wheels
    { id: 'whl_casters', name: 'Cart Casters', category: 'wheels', rarity: 'common', stats: { traction: 12, speed: 6, weight: 4 }, weapon: null, price: 70, salvage: 14, dropWeight: 100, desc: 'Shopping-cart wheels, one slightly bent. They grip the grate about as well as you’d expect.' },
    { id: 'whl_slicks', name: 'Bald Slicks', category: 'wheels', rarity: 'common', stats: { traction: 8, speed: 14, weight: 3 }, weapon: null, price: 90, salvage: 18, dropWeight: 96, desc: 'Worn racing slicks — fast in a straight line, a slip-and-slide the moment you get shoved.' },
    { id: 'whl_treadbites', name: 'Tread Bites', category: 'wheels', rarity: 'uncommon', stats: { traction: 24, speed: 10, weight: 6 }, weapon: null, price: 280, salvage: 56, dropWeight: 55, desc: 'Chunky rubber treads that dig into the plating and refuse to give ground easily.' },
    { id: 'whl_maglock', name: 'Mag-Lock Treads', category: 'wheels', rarity: 'rare', stats: { traction: 40, speed: 12, weight: 9 }, weapon: null, price: 860, salvage: 172, dropWeight: 25, desc: 'Electromagnetic grip tracks that clamp the ring floor — shove this and your own arm tires first.' },
    { id: 'whl_gription', name: 'Gription Omniwheels', category: 'wheels', rarity: 'epic', stats: { traction: 54, speed: 24, weight: 10 }, weapon: null, price: 1950, salvage: 390, dropWeight: 10, desc: 'Corp-lab omniwheels that strafe and stick at once — grip and pace with no apology.' },
    { id: 'whl_titan', name: 'Titan Grousers', category: 'wheels', rarity: 'legendary', stats: { traction: 74, speed: 20, weight: 13 }, weapon: null, price: 4600, salvage: 920, dropWeight: 4, desc: 'Siege-crawler grouser tracks. Once these lock in, the only way you leave the ring is in pieces.' },
    // weapons
    { id: 'wpn_shiv', name: 'Rusty Shiv', category: 'weapon', rarity: 'common', stats: { power: 2, energyDraw: 4, weight: 3 }, weapon: { type: 'blade', damage: 8, cooldown: 0.5, knockback: 4 }, price: 90, salvage: 18, dropWeight: 100, desc: 'A ground-down rebar edge. Barely draws power, barely leaves a mark, but it never stops poking.' },
    { id: 'wpn_kicker', name: 'Gutter Kicker', category: 'weapon', rarity: 'common', stats: { energyDraw: 6, weight: 4 }, weapon: { type: 'flipper', damage: 4, cooldown: 2.2, knockback: 22 }, price: 130, salvage: 26, dropWeight: 92, desc: 'A spring-loaded pop-flap that barely dents but loves nudging lightweights toward the edge.' },
    { id: 'wpn_buzzsaw', name: 'Buzzsaw', category: 'weapon', rarity: 'uncommon', stats: { energyDraw: 16, weight: 8 }, weapon: { type: 'spinner', damage: 16, cooldown: 0.4, knockback: 10 }, price: 380, salvage: 76, dropWeight: 55, desc: 'Reclaimed lumber blade screaming at 9,000 rpm — sheds sparks, energy, and enemy paint.' },
    { id: 'wpn_ballpeen', name: 'Ballpeen', category: 'weapon', rarity: 'uncommon', stats: { energyDraw: 12, weight: 9 }, weapon: { type: 'hammer', damage: 22, cooldown: 1.8, knockback: 20 }, price: 420, salvage: 84, dropWeight: 50, desc: 'A pneumatic mallet that winds up slow and lands like a dropped engine block.' },
    { id: 'wpn_cyclone', name: 'Cyclone Disc', category: 'weapon', rarity: 'rare', stats: { energyDraw: 26, weight: 12 }, weapon: { type: 'spinner', damage: 28, cooldown: 0.35, knockback: 16 }, price: 980, salvage: 196, dropWeight: 26, desc: 'Balanced kinetic disc that carves armor and kicks the whole ring into a spin — thirsty, though.' },
    { id: 'wpn_launchpad', name: 'Launchpad', category: 'weapon', rarity: 'rare', stats: { energyDraw: 20, weight: 13 }, weapon: { type: 'flipper', damage: 10, cooldown: 2.4, knockback: 44 }, price: 1050, salvage: 210, dropWeight: 24, desc: 'Hydraulic launch wedge that scoops rivals skyward — the fastest ticket to a ring-out win.' },
    { id: 'wpn_backdraft', name: 'Backdraft', category: 'weapon', rarity: 'rare', stats: { energyDraw: 30, weight: 10 }, weapon: { type: 'flamer', damage: 20, cooldown: 0.8, knockback: 6 }, price: 900, salvage: 180, dropWeight: 22, desc: 'Jury-rigged flame jet that cooks HP over time — melts armor, drinks power like a drunk.' },
    { id: 'wpn_piledriver', name: 'Piledriver', category: 'weapon', rarity: 'epic', stats: { energyDraw: 26, weight: 16 }, weapon: { type: 'hammer', damage: 44, cooldown: 2, knockback: 34 }, price: 2300, salvage: 460, dropWeight: 11, desc: 'Bridge-demolition ram that caves in plating and sends the loser tumbling toward the neon rim.' },
    { id: 'wpn_meatgrinder', name: 'Meatgrinder', category: 'weapon', rarity: 'epic', stats: { energyDraw: 40, weight: 18 }, weapon: { type: 'spinner', damage: 42, cooldown: 0.3, knockback: 22 }, price: 2500, salvage: 500, dropWeight: 9, desc: 'A full-body drum spinner that turns contact into confetti — feed it a big cell or it stalls mid-fight.' },
    { id: 'wpn_ragnarok', name: 'Ragnarok Disc', category: 'weapon', rarity: 'legendary', stats: { power: 4, energyDraw: 58, weight: 22 }, weapon: { type: 'spinner', damage: 58, cooldown: 0.3, knockback: 30 }, price: 5200, salvage: 1040, dropWeight: 3, desc: 'A titanium apocalypse wheel that ends fights in one bite — and eats nearly your entire energy budget.' },
    { id: 'wpn_skyhook', name: 'Skyhook', category: 'weapon', rarity: 'legendary', stats: { energyDraw: 40, weight: 18 }, weapon: { type: 'flipper', damage: 14, cooldown: 2.2, knockback: 70 }, price: 4800, salvage: 960, dropWeight: 3, desc: 'Grav-assisted launch arm that hurls even heavyweights clean over the ropes — the king of ring-outs.' },
    { id: 'wpn_hellmouth', name: 'Hellmouth', category: 'weapon', rarity: 'legendary', stats: { energyDraw: 60, weight: 16 }, weapon: { type: 'flamer', damage: 40, cooldown: 0.6, knockback: 10 }, price: 5000, salvage: 1000, dropWeight: 4, desc: 'A roaring plasma-flame maw that boils bots alive over seconds — if your cell can keep the pilot light lit.' },
    // armor
    { id: 'arm_tinskirt', name: 'Tin Skirt', category: 'armor', rarity: 'common', stats: { armor: 4, hp: 20, weight: 5 }, weapon: null, price: 80, salvage: 16, dropWeight: 100, desc: 'Bent sheet-metal apron riveted on to blunt the first few hits. Better than nothing. Barely.' },
    { id: 'arm_boltons', name: 'Scrap Bolt-Ons', category: 'armor', rarity: 'common', stats: { armor: 3, hp: 32, weight: 7 }, weapon: null, price: 100, salvage: 20, dropWeight: 96, desc: 'Layered junk plating that soaks punishment through sheer mass rather than any real hardness.' },
    { id: 'arm_riot', name: 'Riot Plate', category: 'armor', rarity: 'uncommon', stats: { armor: 9, hp: 42, weight: 9 }, weapon: null, price: 300, salvage: 60, dropWeight: 55, desc: 'Ex-crowd-control shielding, dented by worse nights than yours — solid, honest protection.' },
    { id: 'arm_ablative', name: 'Ablative Weave', category: 'armor', rarity: 'rare', stats: { armor: 15, hp: 58, weight: 11 }, weapon: null, price: 880, salvage: 176, dropWeight: 25, desc: 'Composite weave that sheds blade and spinner bites layer by layer without piling on tonnage.' },
    { id: 'arm_reactive', name: 'Reactive Bulwark', category: 'armor', rarity: 'epic', stats: { armor: 21, hp: 82, weight: 14 }, weapon: null, price: 2100, salvage: 420, dropWeight: 10, desc: 'Explosive-reactive tiles that spit hammer blows back into the void — heavy, but hard to hate.' },
    { id: 'arm_adamant', name: 'Adamant Carapace', category: 'armor', rarity: 'legendary', stats: { armor: 28, hp: 112, weight: 18 }, weapon: null, price: 4700, salvage: 940, dropWeight: 4, desc: 'Warframe-grade shell forged from reclaimed hull plate — nearly untouchable, and it weighs like it.' },
    // utility
    { id: 'utl_ballast', name: 'Ballast Sack', category: 'utility', rarity: 'common', stats: { traction: 8, weight: 9 }, weapon: null, price: 80, salvage: 16, dropWeight: 100, desc: 'A slung bag of scrap lead. Zero power draw, more grip, and a body harder to shove around.' },
    { id: 'utl_ducttape', name: 'Duct-Tape Rig', category: 'utility', rarity: 'common', stats: { hp: 18, weight: 2 }, weapon: null, price: 70, salvage: 14, dropWeight: 98, desc: 'Everything is held together with silver tape and hope — somehow it adds a little life.' },
    { id: 'utl_sprintpack', name: 'Sprint Servo Pack', category: 'utility', rarity: 'uncommon', stats: { speed: 12, energyDraw: 8, weight: 3 }, weapon: null, price: 300, salvage: 60, dropWeight: 55, desc: 'Bolt-on boost servos for a burst of extra pace — draws a trickle of your energy budget.' },
    { id: 'utl_gripspikes', name: 'Grip Spikes', category: 'utility', rarity: 'uncommon', stats: { traction: 14, energyDraw: 3, weight: 4 }, weapon: null, price: 280, salvage: 56, dropWeight: 52, desc: 'Retractable floor spikes that bite the grate on contact — dig in and dare them to push.' },
    { id: 'utl_capacitor', name: 'Capacitor Bank', category: 'utility', rarity: 'rare', stats: { energyProvide: 34, weight: 6 }, weapon: null, price: 850, salvage: 170, dropWeight: 25, desc: 'An auxiliary charge bank that stretches your power budget — the only way to run two hungry weapons.' },
    { id: 'utl_torquegov', name: 'Torque Governor', category: 'utility', rarity: 'rare', stats: { power: 18, energyDraw: 12, weight: 5 }, weapon: null, price: 900, salvage: 180, dropWeight: 24, desc: 'Overrides the drive limiter for extra shove — burns energy to turn your wheels into a wall.' },
    { id: 'utl_gyro', name: 'Gyro Stabilizer', category: 'utility', rarity: 'epic', stats: { traction: 28, speed: 6, energyDraw: 14, weight: 6 }, weapon: null, price: 2000, salvage: 400, dropWeight: 10, desc: 'Spinning flywheel core that plants you against knockback and keeps you square to the enemy.' },
    { id: 'utl_overclock', name: 'Overclock Core', category: 'utility', rarity: 'legendary', stats: { power: 30, speed: 20, energyDraw: 42, weight: 4 }, weapon: null, price: 4600, salvage: 920, dropWeight: 3, desc: 'Redlines the whole rig for monstrous power and pace — a glass-cannon gamble that guzzles your cell.' },
    { id: 'utl_nanoforge', name: 'Nanoforge Plating', category: 'utility', rarity: 'legendary', stats: { hp: 80, armor: 10, energyDraw: 10, weight: 6 }, weapon: null, price: 4500, salvage: 900, dropWeight: 4, desc: 'Self-repairing nanolattice that patches damage mid-brawl — featherweight resilience for a king’s ransom.' },
  ];

  // ---------------- RIVALS ----------------
  const enemies = [
    { id: 't1_tin_mongrel', name: 'Tin Mongrel', tier: 1, isChampion: false, archetype: 'rusher', weaponType: 'blade', color: '#A8FF3E', aggression: 0.72, purse: 55, stats: { hp: 105, weight: 24, power: 12, speed: 34, traction: 16, armor: 4, weaponDamage: 6 }, taunt: 'Fresh meat off the scrap-heap. Try not to bleed on my ring.', defeatLine: 'Sparks... just... static. You got lucky, rookie.', bio: 'A stray-dog bot welded from can lids and a stolen scooter motor. All bark, thin plate, no plan.' },
    { id: 't1_slagheap', name: 'Slagheap', tier: 1, isChampion: false, archetype: 'tank', weaponType: 'hammer', color: '#FF7A1A', aggression: 0.34, purse: 45, stats: { hp: 145, weight: 48, power: 16, speed: 14, traction: 30, armor: 10, weaponDamage: 10 }, taunt: "I don't chase. I just sit here and outlast whatever crawls in.", defeatLine: 'Impossible... I am the wall... the wall does not... move...', bio: 'A cooled pour of foundry waste on forklift wheels. No weapon, no hurry — it plants and dares you to shift it.' },
    { id: 't2_switchblade_suki', name: 'Switchblade Suki', tier: 2, isChampion: false, archetype: 'duelist', weaponType: 'blade', color: '#FF2D95', aggression: 0.6, purse: 90, stats: { hp: 170, weight: 52, power: 22, speed: 40, traction: 28, armor: 12, weaponDamage: 20 }, taunt: "One cut. That's all this takes, sweetheart. Hold still.", defeatLine: 'You read every angle... nobody reads Suki... nobody...', bio: 'A back-alley fencer who bought her first real edge with a month of winnings. She circles, feints, and lunges.' },
    { id: 't2_glitch_gremlin', name: 'Glitch Gremlin', tier: 2, isChampion: false, archetype: 'trickster', weaponType: 'flipper', color: '#39FF14', aggression: 0.55, purse: 105, stats: { hp: 150, weight: 38, power: 18, speed: 46, traction: 34, armor: 8, weaponDamage: 14 }, taunt: "Blink and you're airborne. Blink again and you're out. Blink-blink.", defeatLine: "No no no, that's not the script — rewind it — rewi—", bio: 'A twitchy wedge on cracked firmware. It baits you to the edge, pops you off your wheels, and giggles in modem tones.' },
    { id: 't3_rebar_baron', name: 'Rebar Baron', tier: 3, isChampion: false, archetype: 'juggernaut', weaponType: 'hammer', color: '#E8B923', aggression: 0.5, purse: 155, stats: { hp: 230, weight: 92, power: 40, speed: 26, traction: 44, armor: 20, weaponDamage: 26 }, taunt: "I built this district's ring with my own plate. Now I own everyone in it.", defeatLine: 'You shoved the Baron off his own line... the crown was heavier than I thought.', bio: 'A construction rig that got tired of pouring foundations and started collapsing opponents instead.' },
    { id: 't3_ricochet', name: 'Ricochet', tier: 3, isChampion: false, archetype: 'sniper', weaponType: 'spinner', color: '#00E5FF', aggression: 0.3, purse: 175, stats: { hp: 195, weight: 58, power: 26, speed: 48, traction: 30, armor: 14, weaponDamage: 30 }, taunt: 'I never touch the edge and I never miss the touch. Come to me.', defeatLine: 'You closed the gap... I always kept the gap... how did you close it...', bio: 'A patient hit-and-run drum on quick wheels. It hangs at max range and lets its disc do the talking.' },
    { id: 't4_pyre', name: 'Pyre', tier: 4, isChampion: false, archetype: 'berserker', weaponType: 'flamer', color: '#FF3B2F', aggression: 0.9, purse: 270, stats: { hp: 250, weight: 78, power: 44, speed: 52, traction: 34, armor: 16, weaponDamage: 38 }, taunt: 'Everything burns eventually. You just get to go first.', defeatLine: 'Out of fuel... out of ring... the fire always did eat me faster...', bio: 'A scorched frame with a fuel cell where its self-preservation used to be. It chases so hard it forgets the edge.' },
    { id: 't4_chrome_vega', name: 'Chrome Vega', tier: 4, isChampion: false, archetype: 'allrounder', weaponType: 'blade', color: '#B14EFF', aggression: 0.5, purse: 305, stats: { hp: 290, weight: 96, power: 38, speed: 46, traction: 46, armor: 24, weaponDamage: 28 }, taunt: "No gimmicks. No holes in my game. Show me yours and I'll pick it apart.", defeatLine: 'A balanced build beaten by a sharper one. Respect. Now get out.', bio: 'A show-floor prototype that fell off a truck into the underground. No glaring weakness, no wasted motion.' },
    { id: 't5_redline', name: 'Redline', tier: 5, isChampion: false, archetype: 'rusher', weaponType: 'spinner', color: '#FF1744', aggression: 0.85, purse: 430, stats: { hp: 300, weight: 98, power: 48, speed: 72, traction: 44, armor: 22, weaponDamage: 34 }, taunt: "By the time you hear me, the ring-out's already scored. Zero to gone.", defeatLine: "Redlined the motor... redlined the odds... should've eased off the throttle...", bio: 'A street-racer chassis that swapped its spoiler for a spin-up drum. It treats the ring like a drag strip.' },
    { id: 't5_ironclad_mk2', name: 'Ironclad Mk-II', tier: 5, isChampion: false, archetype: 'tank', weaponType: 'hammer', color: '#4DB6FF', aggression: 0.25, purse: 500, stats: { hp: 390, weight: 145, power: 52, speed: 30, traction: 62, armor: 38, weaponDamage: 24 }, taunt: 'Push all you like. The Mk-I learned humility. The Mk-II learned to bolt down.', defeatLine: 'Anchor points... failing... they said this hull was unmovable...', bio: 'Salvaged from an armored transport and up-armored twice. It grips the deck like it is welded on.' },
    { id: 't6_nightblade_kaze', name: 'Nightblade Kaze', tier: 6, isChampion: false, archetype: 'duelist', weaponType: 'blade', color: '#7C4DFF', aggression: 0.6, purse: 720, stats: { hp: 400, weight: 120, power: 62, speed: 66, traction: 56, armor: 34, weaponDamage: 52 }, taunt: "Every scar on my plate has a name. I'm here to collect yours.", defeatLine: 'A cleaner cut than mine... the blade finally met its master... go on, take it.', bio: 'A ronin of the circuit who fights only one-on-one. Its monomolecular edge is the most feared below the champion.' },
    { id: 't6_tsunami', name: 'Tsunami', tier: 6, isChampion: false, archetype: 'juggernaut', weaponType: 'flipper', color: '#00FFC6', aggression: 0.55, purse: 850, stats: { hp: 440, weight: 162, power: 82, speed: 48, traction: 68, armor: 42, weaponDamage: 44 }, taunt: 'I am a wave with a hydraulic ram. There is no high ground in a circle.', defeatLine: 'The wave breaks... and rolls out of bounds for once... well fought.', bio: 'A dockyard loader with a launch flipper strong enough to toss half a ton over the rail.' },
    { id: 't7_wraith', name: 'Wraith', tier: 7, isChampion: false, archetype: 'trickster', weaponType: 'flipper', color: '#9D4EDD', aggression: 0.5, purse: 1250, stats: { hp: 430, weight: 132, power: 70, speed: 88, traction: 74, armor: 36, weaponDamage: 48 }, taunt: "You'll fight my afterimage the whole match. The real me's already behind you.", defeatLine: "You hit the real one... nobody's touched the real one in years... impressive.", bio: 'A ghost on the leaderboard. Absurd speed and grip let it phase around your charge and flip you into the dark.' },
    { id: 't7_doomspin', name: 'Doomspin', tier: 7, isChampion: false, archetype: 'berserker', weaponType: 'spinner', color: '#FF6D00', aggression: 0.95, purse: 1500, stats: { hp: 500, weight: 168, power: 92, speed: 62, traction: 60, armor: 46, weaponDamage: 66 }, taunt: "Spin's at full song. Step in and I'll turn you into confetti and a payout.", defeatLine: 'Too much RPM, not enough sense... the drum ate itself chasing you... nice.', bio: 'A shrieking horizontal drum around a reactor that runs too hot. Bait its greed and it drives past the edge.' },
    { id: 't8_apex_zero', name: 'Apex-Zero', tier: 8, isChampion: true, archetype: 'allrounder', weaponType: 'spinner', color: '#FFB300', aggression: 0.7, purse: 4200, stats: { hp: 600, weight: 190, power: 120, speed: 82, traction: 78, armor: 56, weaponDamage: 70 }, taunt: "They call me the Ultimate Zumo. You? You're the maintenance interval between titles.", defeatLine: 'Undefeated... until the exact machine I feared finally rolled in. The ring is yours, Zumo.', bio: 'The reigning, undefeated Ultimate Zumo — reactor-fed drum, mag-lock traction, no exploitable weakness except the perfect counter.' },
  ];

  // ---------------- RANKS ----------------
  const ranks = [
    { tier: 1, name: 'Scrapling', rpNeeded: 0, reward: 100, unlock: 'Junkyard scavenge + common chassis; the Rust Alley stall opens', flavor: 'You crawled out of the gutter with a busted servo and a dream. Scrounge, bolt something together, and try not to get shoved out in ten seconds.' },
    { tier: 2, name: 'Rust Runner', rpNeeded: 200, reward: 300, unlock: 'Uncommon parts stocked; the Gutter Circuit opens', flavor: 'Two wins and the bookies stopped laughing. Your bot still leaks fluid, but it wins ugly.' },
    { tier: 3, name: 'Circuit Breaker', rpNeeded: 550, reward: 600, unlock: "Rare parts + the mid-tier Ironframe chassis line", flavor: "You've blown enough fuses to earn a handle in the pits. Push harder — the ring's getting hungrier." },
    { tier: 4, name: 'Chrome Contender', rpNeeded: 1150, reward: 1200, unlock: 'Epic parts; the Chrome Dome + a Blackmarket broker', flavor: 'Polished plating, a real sponsor decal, a broker who slides you contraband alloys after midnight.' },
    { tier: 5, name: 'Neon Enforcer', rpNeeded: 2100, reward: 2400, unlock: 'Heavy Bulwark chassis + overclock utility modules', flavor: "Rivals reroute their bracket to avoid your ring. You don't fight for scraps anymore — you collect debts." },
    { tier: 6, name: 'Voltage Baron', rpNeeded: 3600, reward: 4500, unlock: 'Legendary parts begin dropping; the Voltage Pit opens', flavor: 'You own a corner of the circuit and the power grid trembles when you overclock. Legends whisper your serial number.' },
    { tier: 7, name: 'Apex Overlord', rpNeeded: 5900, reward: 8000, unlock: 'Prototype Apex chassis + custom weapon bench', flavor: 'One rung from the top and the whole scrapyard holds its breath. Only the throne remains — and it is occupied.' },
    { tier: 8, name: 'Ultimate Zumo', rpNeeded: 9200, reward: 15000, unlock: 'The Zumo Throne — you are #1', flavor: 'You shoved the reigning champ out of the ring and out of history. You are the Ultimate Zumo — until someone crawls out of the gutter to take it.' },
  ];

  // ---------------- QUESTS (cross-refs normalized to real ids) ----------------
  const quests = [
    { id: 'q_first_blood', title: 'First Blood in the Pit', type: 'win_matches', target: 1, rewardCredits: 60, rewardScrap: 8, rewardRp: 5, desc: 'Weld something ugly, roll it into the ring, and take your first win. Nobody remembers the loser of match one.' },
    { id: 'q_over_the_edge', title: 'Over the Edge', type: 'ring_out', target: 1, rewardCredits: 70, rewardScrap: 10, rewardRp: 5, desc: 'HP is optional. The white line isn’t. Shove one rival clean out of the neon circle.' },
    { id: 'q_diamond_rough', title: 'Diamond in the Rough', type: 'scavenge_rare', target: 1, rewardCredits: 90, rewardScrap: 12, rewardRp: 8, desc: 'Dig until your scanner screams rare-tier. One good find can change the whole build.' },
    { id: 'q_getting_a_name', title: 'Getting a Name', type: 'win_matches', target: 3, rewardCredits: 140, rewardScrap: 15, rewardRp: 12, desc: 'Three wins and the touts start whispering your handle. Stack them before the circuit forgets you.' },
    { id: 'q_put_down_the_pup', title: 'Put Down the Pup', type: 'beat_rival', param: 't1_tin_mongrel', target: 1, rewardCredits: 100, rewardScrap: 12, rewardRp: 10, desc: 'Tin Mongrel yaps loud for a bottom-rung bolt-bucket. Bounce it off the rail and take the bragging rights.' },
    { id: 'q_grease_money', title: 'Grease Money', type: 'earn_credits', target: 500, rewardCredits: 120, rewardScrap: 15, rewardRp: 8, desc: 'Bank 500 ₡ in purse and salvage. The Black Market doesn’t run a tab for Scraplings.' },
    { id: 'q_bulldozer', title: 'Bulldozer', type: 'ring_out', target: 5, rewardCredits: 220, rewardScrap: 25, rewardRp: 20, desc: 'Five ring-outs. This is about raw shove. Stack the weight, dig the traction, drive them into the dark.' },
    { id: 'q_ejector_seat', title: 'Ejector Seat', type: 'win_with_weapon', param: 'flipper', target: 3, rewardCredits: 260, rewardScrap: 20, rewardRp: 22, rewardPartId: 'wpn_launchpad', desc: 'Win three bouts with a flipper. Get the wedge under their skirt and let physics carry them past the line.' },
    { id: 'q_not_a_scratch', title: 'Not a Scratch', type: 'no_damage', target: 1, rewardCredits: 240, rewardScrap: 22, rewardRp: 25, desc: 'Win a match without taking a single point of damage. Pure footwork and clean angles.' },
    { id: 'q_hot_streak', title: 'Hot Streak', type: 'win_streak', target: 3, rewardCredits: 300, rewardScrap: 30, rewardRp: 30, desc: 'Three wins back to back. Break the chain and you start over from zero.' },
    { id: 'q_rebar_reckoning', title: "Rebar's Reckoning", type: 'beat_rival', param: 't3_rebar_baron', target: 1, rewardCredits: 200, rewardScrap: 20, rewardRp: 18, desc: 'Rebar Baron grinds slow and bites hard. Out-shove the old dog or knock its lights out — the pit doesn’t care which.' },
    { id: 'q_rare_earth', title: 'Rare Earth', type: 'scavenge_rare', target: 3, rewardCredits: 280, rewardScrap: 26, rewardRp: 20, desc: 'Three rare-tier hauls out of the trash. The good salvage sits deep and the hazards sit deeper.' },
    { id: 'q_lights_out', title: 'Lights Out', type: 'k1_finish', target: 1, rewardCredits: 230, rewardScrap: 22, rewardRp: 22, desc: 'Bleed their HP to zero and drop them where they stand. One clean knockout finish.' },
    { id: 'q_full_spin_cycle', title: 'Full Spin Cycle', type: 'win_with_weapon', param: 'spinner', target: 4, rewardCredits: 320, rewardScrap: 28, rewardRp: 26, rewardPartId: 'wpn_cyclone', desc: 'Four wins running a spinner. Spool the disc and turn rival armor into confetti. A hotter disc waits.' },
    { id: 'q_circuit_regular', title: 'Circuit Regular', type: 'win_matches', target: 10, rewardCredits: 420, rewardScrap: 40, rewardRp: 40, desc: 'Ten wins on the books. You’re a fixture now. The bookies finally spell your name right.' },
    { id: 'q_fat_stacks', title: 'Fat Stacks', type: 'earn_credits', target: 2500, rewardCredits: 350, rewardScrap: 35, rewardRp: 25, desc: 'Rack up 2,500 ₡ in earnings. Enough to start eyeing epic-tier iron.' },
    { id: 'q_saw_and_order', title: 'Saw & Order', type: 'win_with_weapon', param: 'spinner', target: 5, rewardCredits: 380, rewardScrap: 32, rewardRp: 30, rewardPartId: 'wpn_meatgrinder', desc: 'Five wins with a spinner fitted. Grind through the armor rating and let the sparks paint the rain.' },
    { id: 'q_king_of_the_shove', title: 'King of the Shove', type: 'ring_out', target: 15, rewardCredits: 600, rewardScrap: 55, rewardRp: 55, rewardPartId: 'utl_gyro', desc: 'Fifteen ring-outs total. The white line is your signature. Claim the gyro so nothing shoves YOU.' },
    { id: 'q_untouchable_run', title: 'Untouchable Run', type: 'win_streak', target: 7, rewardCredits: 900, rewardScrap: 70, rewardRp: 70, rewardPartId: 'gen_tokamak', desc: 'Seven straight wins. Lose once and the counter resets. Survive it and the fusion brick is yours.' },
    { id: 'q_flawless', title: 'Flawless', type: 'no_damage', target: 5, rewardCredits: 700, rewardScrap: 60, rewardRp: 65, rewardPartId: 'arm_reactive', desc: 'Five untouched victories. Not a dent across all five. Take the reactive plate as a trophy you’ll never need.' },
    { id: 'q_break_the_crusher', title: 'Break the Crusher', type: 'beat_rival', param: 't5_ironclad_mk2', target: 1, rewardCredits: 800, rewardScrap: 65, rewardRp: 70, desc: 'Ironclad Mk-II has only ever left the ring on a forklift. Be the one that changes that.' },
    { id: 'q_hammer_time', title: 'Hammer Time', type: 'win_with_weapon', param: 'hammer', target: 6, rewardCredits: 650, rewardScrap: 55, rewardRp: 50, rewardPartId: 'wpn_piledriver', desc: 'Six wins swinging a hammer. Cave the chassis in one overhead arc. The epic maul is your reward.' },
    { id: 'q_executioner', title: 'Executioner', type: 'k1_finish', target: 10, rewardCredits: 850, rewardScrap: 70, rewardRp: 65, desc: 'Ten knockout finishes. You leave the wreck smoking in the center of the circle, every single time.' },
    { id: 'q_master_scavenger', title: 'Master Scavenger', type: 'scavenge_rare', target: 15, rewardCredits: 900, rewardScrap: 90, rewardRp: 55, rewardPartId: 'mot_maglev', desc: 'Fifteen rare-or-better pulls from the yard. The maglev drive is buried out there — go earn it.' },
    { id: 'q_underground_kingpin', title: 'Underground Kingpin', type: 'earn_credits', target: 15000, rewardCredits: 1200, rewardScrap: 100, rewardRp: 90, desc: 'Bank 15,000 ₡ lifetime. The Black Market opens the back room and the legendary iron stops being a rumor.' },
    { id: 'q_legend_of_the_ring', title: 'Legend of the Ring', type: 'win_streak', target: 12, rewardCredits: 1500, rewardScrap: 120, rewardRp: 120, rewardPartId: 'cha_oni', desc: 'Twelve wins without a loss. Hold the chain to the end and drive home the Oni Overlord chassis.' },
    { id: 'q_dethrone_the_apex', title: 'Dethrone the Apex', type: 'beat_rival', param: 't8_apex_zero', target: 1, rewardCredits: 3000, rewardScrap: 200, rewardRp: 250, rewardPartId: 'wpn_skyhook', desc: 'APEX has worn the #1 crown so long the belt rusted to its frame. Beat the champ and become the Ultimate Zumo.' },
  ];

  // ---------------- STYLE / COPY ----------------
  const style = {
    styleFormula: 'Gritty post-apocalyptic street: dusty amber dusk over concrete and rusted corrugated steel, hand-painted shop signs, tarps and junk piles, warm sodium lamps and dim broken neon; 2D pixel-art side view, muted earthy palette, heavy grain and haze, lived-in and grimy — not flashy.',
    palette: { bg: '#070A0F', neonA: '#17E9E0', neonB: '#FF2E88', neonC: '#9B5CFF', warn: '#FF7A18', metal: '#8593A3' },
    worldLore: 'After the grid went dark, the kids of Block 7 rebuilt the only thing worth fighting over: junk battle-bots. Walk the strip, weld a scrapper at your bench, and brawl your way up from gutter nobody to king of the Pit.',
    uiCopy: {
      gameTitle: 'MY ULTIMATE ZUMO-BOT',
      subtitle: 'Scavenge. Weld. Ring Them Out.',
      scavengeName: 'The Rust Midden',
      arenaName: 'Neon Dohyo — Circuit Zero',
      shopName: 'Chop-Shop Bazaar',
      workshopName: 'The Fab-Bay',
      fightButton: 'ENTER THE RING',
      blurbs: {
        boot: "Charging the grid... don't touch the wet rails.",
        scavenge: 'Half a city died so your bot could have better wheels.',
        build: "A bot is only as good as the junk you didn't throw away.",
        fight: 'In the Dohyo there are two ways out: the edge, or in pieces.',
        shop: 'Every part here fell off someone who lost. Buy accordingly.',
        defeat: 'Salvage what’s left. The Midden always takes the rest.',
        victory: "Rival cored. Credits secured. Ladder's still above you.",
      },
    },
    tips: [
      'RING-OUT beats HP — you never have to kill a rival, just walk them off the neon edge into the dark.',
      'Heavy bots resist being shoved out, but they crawl; pair high Weight with enough Power to push back.',
      'Light + fast lands the first hit and loses the shoving match. Bait the charge and let their momentum carry THEM out.',
      'Traction is your anchor: high grip means a rival can’t slide you across the ring.',
      'Mind the ENERGY BUDGET — if motor + weapon + utility draw more than the generator provides, every stat sags.',
      'Armor caps at 60% damage reduction. Stacking plates past the cap just piles on dead Weight.',
      'BOOST (Space / FIRE) is your ring-out tool AND your risk — whiff it near the edge and you’re the one going over.',
      'BRACE (Shift) spikes your traction for a moment — tank an incoming shove, then counter.',
      'Own the center. Every shove from the middle sends the OTHER bot toward the edge — not you.',
      'A bigger generator is freedom: it lets you run a heavy weapon AND a fast motor at once.',
      'After 25 seconds the ring starts to SHRINK. Campers get squeezed out — keep moving and keep pushing.',
      'Salvage only returns ~20% of a part’s price. Sell real upgrades at the Chop-Shop instead of melting them.',
      'Angle your charges — hitting a rival off-center spins them, breaks their footing, sets up a clean edge push.',
      'Weapons deplete HP; mass + Power win by ring-out. Pick a win condition and build the whole bot around it.',
      'Watch the deeper junkpiles — richer salvage sits under the hazards. Cash out before a mine ends the run.',
      'Legendaries fall from the Midden ~30x rarer than common scrap. Grind low ranks to fund ONE great part.',
    ],
    audioBrief: 'Dark synthwave soaked in rain and rust; 88 BPM in the garage, 124 BPM adrenal combat.',
  };

  // ---------------- overworld (spirit town main street) ----------------
  const STREET_LEN = 4600;
  // The street art IS the buildings — each entry is just a doorway you can enter.
  const BUILDINGS = [
    { id: 'camp',    x: 220,  w: 220, label: 'CAMPS',    screen: 'infil',     sign: 'KANE-CO CAMPS' },
    { id: 'house',   x: 700,  w: 300, label: 'DEN',      screen: 'workbench', sign: 'YOUR DEN' },
    { id: 'toyshop', x: 1340, w: 320, label: 'CURIO',    screen: 'shop',      sign: 'KITSUNE CURIOS' },
    { id: 'ramen',   x: 1980, w: 300, label: 'RAMEN',    screen: 'ramen',     sign: "AO'S RAMEN" },
    { id: 'board',   x: 2620, w: 200, label: 'REQUESTS', screen: 'quests',    sign: 'REQUEST BOARD' },
    { id: 'scrap',   x: 3300, w: 320, label: 'GROVE',    screen: 'scavenge',  sign: 'JUNK GROVE' },
    { id: 'arena',   x: 4080, w: 360, label: 'DOHYO',    screen: 'ladder',    sign: 'THE DOHYO' },
  ];
  // Townsfolk yokai: they wander a small patch of street, and you can stop
  // and actually talk with them — each answer gets a different reply.
  const NPCS = [
    { id: 'n1', x: 420, name: 'Botan', img: 'char.oni', talk: { text: 'New paws on the street. You came out of the gate walking, so you are either brave or lost.', choices: [
      { label: 'Brave, mostly.', lines: [{ text: 'Good answer. The dohyo eats the other kind. Botan. I lift things nobody else can, and I have seen every champion since the lanterns were new.' }] },
      { label: 'Definitely lost.', lines: [{ text: 'Then you found the right town to be lost in. Warm bowls at the ramen shop, warm fights at the dohyo. Pick one and you will feel at home.' }] },
      { label: 'What is this place?', lines: [{ text: 'Spirit Town. Last street the megacorp has not flattened into a warehouse. We mean to keep it that way, tanuki.' }] },
    ] } },
    { id: 'n2', x: 980, name: 'Kiku', img: 'char.kappa', talk: { text: 'Careful past the gate. KANE-CO put up another camp in the grove and their guards do not blink. Ever.', choices: [
      { label: 'I could sneak in.', lines: [{ text: 'Sneak in, says the round one. Well. If you do, cycle those henge forms of yours. A rock is invisible to a machine that only files reports on trespassers.' }] },
      { label: 'What do they want?', lines: [{ text: 'Parts. Land. Quiet. Everything a town is made of, weighed and shipped south. That is why every part you steal back matters.' }] },
    ] } },
    { id: 'n3', x: 1520, name: 'Sudachi', img: 'char.tengu', talk: { text: 'I saw your puppet sputter on the walk over. Rune stones set the spirit budget, you know. Overdraw and the poor thing wheezes.', choices: [
      { label: 'Any building advice?', lines: [{ text: 'Weight wins shoves, speed wins first blood. Pick the fight you want and build the whole puppet toward it. Half-measures lose both ways.' }] },
      { label: 'It was NOT sputtering.', lines: [{ text: 'Hm. My mistake. The wind up here plays tricks. Still — a bigger rune stone never hurt anyone who was not carrying it.' }] },
    ] } },
    { id: 'n4', x: 1780, name: 'Mame', img: 'char.kappa', talk: { text: 'Ao gave me a free bowl once. Once. I have been sweeping his doorstep for three years hoping for a second.', choices: [
      { label: 'The ramen is that good?', lines: [{ text: 'Good? It buffs your whole soul. Eat before a bout and you will feel the broth in your puppet strings, I swear it.' }] },
      { label: 'Maybe just buy one.', lines: [{ text: 'Buy one. BUY one. Three years of sweeping and this tanuki says buy one. ...You are right, of course.' }] },
    ] } },
    { id: 'n5', x: 2280, name: 'Torimaru', img: 'char.tengu', talk: { text: 'The request board is how the town breathes now. Every job cleared is a district out of KANE-CO hands.', choices: [
      { label: 'I will take a job.', lines: [{ text: 'Take a partner too. Tengu hits hard, kappa patches you mid-bout, oni carries iron. Friendship is not decoration here — it is armor.' }] },
      { label: 'Does it pay?', lines: [{ text: 'It pays in coin and in lanterns. Watch the street after you restore a district. The lights that come back on are yours.' }] },
    ] } },
    { id: 'n6', x: 2900, name: 'Hozuki', img: 'char.oni', talk: { text: 'I dug the junk grove before it was junk. Best parts sit deep, under the hazards. That is not a metaphor.', choices: [
      { label: 'How deep do I dig?', lines: [{ text: 'Until your paws itch. Push your luck one dig past comfortable, then cash out. The grove keeps whatever greed leaves behind.' }] },
      { label: 'Why is it all junk?', lines: [{ text: 'KANE-CO dumps what it cannot sell. We build champions out of it. There is a lesson in that if you like lessons.' }] },
    ] } },
    { id: 'n7', x: 3500, name: 'Shion', img: 'char.kappa', talk: { text: 'You walk like someone who has not been thrown out of a dohyo yet. It is coming. It is wonderful.', choices: [
      { label: 'I do not plan to lose.', lines: [{ text: 'Nobody plans to. But losing teaches your puppet where its joints are. Win after that and it means something.' }] },
      { label: 'Any dohyo tricks?', lines: [{ text: 'Hold your ward until their swing whiffs, then answer. A perfect ward turns their momentum into your opening. The crowd loves it.' }] },
    ] } },
    { id: 'n8', x: 3840, name: 'Renge', img: 'char.tengu', talk: { text: 'The champion Apex-Zero has held the ring so long its shadow wore a groove in the boards.', choices: [
      { label: 'I will dethrone it.', lines: [{ text: 'Ha. Save that sentence. I want to remind you of it at the victory feast — or carve it on something, depending.' }] },
      { label: 'What is it like?', lines: [{ text: 'Cold. Perfect. No wasted motion, no mercy, no joy. Which is exactly why the town needs someone with your kind of grin to beat it.' }] },
    ] } },
    { id: 'n9', x: 4260, name: 'Goma', img: 'char.oni', talk: { text: 'Match nights, this whole end of the street smells like sparks and soy broth. Best smell in the world.', choices: [
      { label: 'When is the next match?', lines: [{ text: 'Whenever you push that door. The dohyo does not keep a calendar, it keeps a ladder. Climb it.' }] },
      { label: 'You fight too?', lines: [{ text: 'Retired. These days I hold the rope, ring the bell, and catch whichever puppet flies out first. Steady work.' }] },
    ] } },
  ];
  // snack buffs for the NEXT fight (merged from generated copy below)
  const RAMEN = [
    { id: 'cup', name: 'Cup Noodles', price: 20, hpMul: 1.08, powMul: 1.0, desc: 'Hot and fast.' },
  ];

  // ---------------- merge generated yokai theme content ----------------
  const C = window.Z && Z.content ? Z.content : null;
  let CREW = [], MISSIONS = [], DISTRICTS = [], AO_LINES = [], BOOT_LINES = [], LORE = '';
  if (C) {
    const pm = {}; C.retheme.parts.forEach((p) => (pm[p.id] = p));
    parts.forEach((p) => { const n = pm[p.id]; if (n) { p.name = n.name; p.desc = n.desc; } });
    const cm = {}; C.retheme.chassis.forEach((c) => (cm[c.id] = c));
    chassis.forEach((c) => { const n = cm[c.id]; if (n) { c.name = n.name; c.desc = n.desc; } });
    const em = {}; C.enemies.enemies.forEach((e) => (em[e.id] = e));
    enemies.forEach((e) => { const n = em[e.id]; if (n) { e.name = n.name; e.taunt = n.taunt; e.defeatLine = n.defeatLine; e.bio = n.bio; } });
    C.copy.ranks.forEach((r) => { const rk = ranks.find((x) => x.tier === r.tier); if (rk) { rk.name = r.name; rk.flavor = r.flavor; } });
    RAMEN.length = 0; C.copy.snacks.forEach((s) => RAMEN.push(s));
    NPCS.forEach((n, i) => { n.line = C.copy.npcLines[i % C.copy.npcLines.length]; });
    CREW = C.crew.crew; MISSIONS = C.missions.missions; DISTRICTS = C.missions.districts;
    AO_LINES = C.copy.aoLines; BOOT_LINES = C.copy.bootLines; LORE = C.copy.lore;
  }

  // ---------------- lookups ----------------
  const _partMap = {}; parts.forEach((p) => (_partMap[p.id] = p));
  const _chaMap = {}; chassis.forEach((c) => (_chaMap[c.id] = c));
  const _enMap = {}; enemies.forEach((e) => (_enMap[e.id] = e));

  function partById(id) { return _partMap[id] || null; }
  function chassisById(id) { return _chaMap[id] || null; }
  function enemyById(id) { return _enMap[id] || null; }
  function itemById(id) { return _partMap[id] || _chaMap[id] || null; } // parts + chassis
  function rarityColor(r) { return (RARITY[r] || RARITY.common).color; }
  function rarityRank(r) { return (RARITY[r] || RARITY.common).i; }

  // Starting loadout for a fresh save.
  const START = {
    credits: 220,
    scrap: 12,
    inventory: {
      cha_rustpan: 1, cha_alleycat: 1,
      gen_dynamo: 1, mot_junker: 1, whl_casters: 1,
      wpn_shiv: 1, wpn_kicker: 1, arm_tinskirt: 1, utl_ducttape: 1,
    },
    build: {
      chassis: 'cha_rustpan', generator: 'gen_dynamo', motor: 'mot_junker', wheels: 'whl_casters',
      weapon: ['wpn_shiv'], armor: ['arm_tinskirt'], utility: ['utl_ducttape'],
    },
    botName: 'RUST-01',
  };

  return {
    PAL, RARITY, CAT_ICON, WPN_ICON, WPN_LABEL,
    chassis, parts, enemies, ranks, quests, style, START,
    BUILDINGS, NPCS, RAMEN, STREET_LEN,
    CREW, MISSIONS, DISTRICTS, AO_LINES, BOOT_LINES, LORE,
    crewById(id) { return CREW.find((c) => c.id === id) || null; },
    missionById(id) { return MISSIONS.find((m) => m.id === id) || null; },
    districtById(id) { return DISTRICTS.find((d) => d.id === id) || null; },
    partById, chassisById, enemyById, itemById, rarityColor, rarityRank,
  };
})();
