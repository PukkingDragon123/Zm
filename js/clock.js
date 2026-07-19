/* clock.js — day/night time-of-day + a little yokai clock. (stub) */
Z.clock = (function () {
  const SECS_PER_HOUR = 9;                 // ~3.6 real min per in-game day
  let acc = 0;
  function update(dt) {
    acc += dt;
    if (acc >= SECS_PER_HOUR) { acc -= SECS_PER_HOUR; if (Z.state && Z.state.advanceClock) Z.state.advanceClock(1); }
  }
  function isNight() { return Z.state ? Z.state.isNight : false; }
  function draw() {}
  function tint(ctx, W, H) {}
  function init() {}
  return { init, update, isNight, draw, tint };
})();
