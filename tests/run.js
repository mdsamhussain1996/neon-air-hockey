/**
 * Neon Air Hockey v2 Test Suite
 * Zero-dependency unit tests runnable with `node tests/run.js`
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Load index.html game logic
const htmlPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
  console.error('FAIL: Could not locate <script> block in index.html');
  process.exit(1);
}

const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  module: { exports: {} },
  exports: {}
};
vm.createContext(sandbox);
vm.runInContext(scriptMatch[1], sandbox);

const nah = sandbox.module.exports;
const {
  newGame, step, serve, moveMallet, clampMallet, applyPowerUp, aiThink,
  W, H, PR, MR, GW, GX0, GX1, WIN, STEP, MALLET_V, PUCK_MAX, E_WALL, E_MALLET,
  sanitizeRemote
} = nah;

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) {
    failed++;
    const err = new Error(message);
    failures.push({ message, stack: err.stack });
    console.error(`  ✕ ${message}`);
  } else {
    passed++;
    console.log(`  ✓ ${message}`);
  }
}

function assertClose(a, b, eps = 1e-4, msg) {
  assert(Math.abs(a - b) <= eps, `${msg} (expected ${b}, got ${a}, diff=${Math.abs(a - b)})`);
}

console.log('====================================================');
console.log('Neon Air Hockey v2 Test Suite');
console.log('====================================================\n');

// ----------------------------------------------------
// Section 1: Physics Collisions & Anti-Tunneling
// ----------------------------------------------------
console.log('Section 1: Physics Collisions & Sub-stepping');
{
  // 1. Side wall bounce & restitution
  const gWall = newGame(['P0', 'P1']);
  gWall.phase = 'play';
  // Place puck heading towards right wall at x = W - 30 with vx = 500
  gWall.pucks = [{ x: W - 30, y: H / 2, vx: 500, vy: 0, last: 0, trail: [] }];
  step(gWall, 0.05); // puck should hit W - PR and bounce left
  assert(gWall.pucks[0].vx < 0, `Puck bounced off right wall (vx=${gWall.pucks[0].vx})`);
  assert(gWall.pucks[0].x <= W - PR, `Puck stayed within right wall (x=${gWall.pucks[0].x})`);

  // Left wall bounce
  gWall.pucks = [{ x: 30, y: H / 2, vx: -500, vy: 0, last: 0, trail: [] }];
  step(gWall, 0.05);
  assert(gWall.pucks[0].vx > 0, `Puck bounced off left wall (vx=${gWall.pucks[0].vx})`);
  assert(gWall.pucks[0].x >= PR, `Puck stayed within left wall (x=${gWall.pucks[0].x})`);

  // 2. High-speed sub-stepping & Anti-tunneling test
  // Puck heading toward wall at maximum speed PUCK_MAX (2100 units/s)
  // Without sub-stepping, at dt = 1/60s, move = 35 units, which could cross walls.
  const gTunnel = newGame(['P0', 'P1']);
  gTunnel.phase = 'play';
  gTunnel.pucks = [{ x: W - 40, y: H / 2, vx: PUCK_MAX, vy: 0, last: 0, trail: [] }];
  step(gTunnel, 1 / 60);
  assert(gTunnel.pucks[0].x <= W - PR, `High-speed puck does NOT tunnel through right wall (x=${gTunnel.pucks[0].x}, max=${W - PR})`);
  assert(gTunnel.pucks[0].vx < 0, 'High-speed puck bounced successfully');

  // 3. Mallet vs Puck Collision
  const gMallet = newGame(['P0', 'P1']);
  gMallet.phase = 'play';
  // Place mallet 0 at (300, 700), moving upwards (vy = -1000)
  gMallet.pd[0].x = W / 2; gMallet.pd[0].y = 700;
  gMallet.pd[0].tx = W / 2; gMallet.pd[0].ty = 650;
  // Place puck at (300, 640), moving downwards (vy = 300)
  gMallet.pucks = [{ x: W / 2, y: 640, vx: 0, vy: 300, last: 1, trail: [] }];
  step(gMallet, 1 / 60);
  assert(gMallet.pucks[0].vy < 0, `Mallet impact reversed puck velocity upwards (vy=${gMallet.pucks[0].vy})`);
  assert(gMallet.pucks[0].last === 0, 'Puck last touch updated to Player 0');

  // 4. Goal Mouth Detection
  const gGoal = newGame(['P0', 'P1']);
  gGoal.phase = 'play';
  // Puck heading straight into Player 1's goal (top, y < 0)
  gGoal.pucks = [{ x: W / 2, y: 20, vx: 0, vy: -1200, last: 0, trail: [] }];
  step(gGoal, 0.05);
  // Puck should cross goal line and register goal for Player 0
  assert(gGoal.sc[0] === 1, `Goal counted for Player 0 (score=${gGoal.sc[0]}–${gGoal.sc[1]})`);
}

// ----------------------------------------------------
// Section 2: Symmetry Test (Hard Rule: Mirrored Game = Mirrored Result)
// ----------------------------------------------------
console.log('\nSection 2: Deterministic Symmetry');
{
  const gA = newGame(['P0', 'P1']);
  const gB = newGame(['P0', 'P1']);
  gA.phase = 'play';
  gB.phase = 'play';

  // Game A: Player 0 fires puck from bottom upwards
  gA.pd[0] = { x: 260, y: 750, vx: 0, vy: 0, tx: 280, ty: 700, sp: 1 };
  gA.pd[1] = { x: 340, y: 210, vx: 0, vy: 0, tx: 320, ty: 260, sp: 1 };
  gA.pucks = [{ x: 270, y: 600, vx: 180, vy: -520, last: 0, trail: [] }];

  // Game B: Symmetrically inverted along y-axis (and sides swapped)
  // Invert y: y' = H - y, vy' = -vy
  // Player 0 in Game A corresponds to Player 1 in Game B
  gB.pd[1] = { x: 260, y: H - 750, vx: 0, vy: 0, tx: 280, ty: H - 700, sp: 1 };
  gB.pd[0] = { x: 340, y: H - 210, vx: 0, vy: 0, tx: 320, ty: H - 260, sp: 1 };
  gB.pucks = [{ x: 270, y: H - 600, vx: 180, vy: 520, last: 1, trail: [] }];

  // Simulate 300 physics steps
  let symmetric = true;
  for (let s = 0; s < 300; s++) {
    step(gA, STEP);
    step(gB, STEP);

    if (gA.pucks.length && gB.pucks.length) {
      const pA = gA.pucks[0];
      const pB = gB.pucks[0];
      const yDiff = Math.abs((H - pA.y) - pB.y);
      const xDiff = Math.abs(pA.x - pB.x);
      const vyDiff = Math.abs(-pA.vy - pB.vy);
      if (yDiff > 1e-4 || xDiff > 1e-4 || vyDiff > 1e-4) {
        symmetric = false;
        console.error(`Symmetry broke at step ${s}: pA=(${pA.x}, ${pA.y}), pB=(${pB.x}, ${pB.y})`);
        break;
      }
    }
  }
  assert(symmetric, 'Mirrored physics simulation matches symmetrically across 300 steps');
}

// ----------------------------------------------------
// Section 3: Power-ups Mechanics
// ----------------------------------------------------
console.log('\nSection 3: Power-ups');
{
  // 1. Freeze power-up
  const gFreeze = newGame(['P0', 'P1']);
  gFreeze.phase = 'play';
  applyPowerUp(gFreeze, { type: 'freeze' }, 0);
  assert(gFreeze.fz[1] === 5, 'Player 1 is frozen for 5 seconds');
  assert(gFreeze.fz[0] === 0, 'Player 0 is not frozen');

  // Test speed reduction when frozen (target far enough that maxStep limits both)
  const mFrozen = { x: 300, y: 130, vx: 0, vy: 0, tx: 300, ty: 470, sp: 1 };
  moveMallet(mFrozen, 1, 5, 0.1); // frozen fz = 5
  const distFrozen = Math.hypot(mFrozen.x - 300, mFrozen.y - 130);

  const mNormal = { x: 300, y: 130, vx: 0, vy: 0, tx: 300, ty: 470, sp: 1 };
  moveMallet(mNormal, 1, 0, 0.1); // normal fz = 0
  const distNormal = Math.hypot(mNormal.x - 300, mNormal.y - 130);

  assertClose(distFrozen, distNormal * 0.5, 1e-3, 'Frozen mallet moves at exactly 50% speed');

  // 2. Shield power-up
  const gShield = newGame(['P0', 'P1']);
  gShield.phase = 'play';
  applyPowerUp(gShield, { type: 'shield' }, 1);
  assert(gShield.sh[1] === 10, 'Player 1 shield active for 10 seconds');

  // Shoot puck into shielded goal
  gShield.pucks = [{ x: W / 2, y: 25, vx: 0, vy: -800, last: 0, trail: [] }];
  step(gShield, 0.05);
  assert(gShield.pucks[0].vy > 0, `Shield bounced puck out of goal (vy=${gShield.pucks[0].vy})`);
  assert(gShield.sh[1] === 0, 'Shield consumed after blocking shot');
  assert(gShield.sc[0] === 0, 'No goal scored when blocked by shield');

  // 3. Multi-puck power-up
  const gMulti = newGame(['P0', 'P1']);
  gMulti.phase = 'play';
  gMulti.pucks = [{ x: 300, y: 480, vx: 100, vy: 100, last: 0, trail: [] }];
  applyPowerUp(gMulti, { type: 'multi', x: 300, y: 480 }, 0);
  assert(gMulti.pucks.length === 2, 'Multi-puck added a second puck');
  applyPowerUp(gMulti, { type: 'multi', x: 300, y: 480 }, 0);
  assert(gMulti.pucks.length === 3, 'Multi-puck added a third puck');
  applyPowerUp(gMulti, { type: 'multi', x: 300, y: 480 }, 0);
  assert(gMulti.pucks.length === 3, 'Multi-puck capped at 3 pucks');
}

// ----------------------------------------------------
// Section 4: Match Stats Tracking
// ----------------------------------------------------
console.log('\nSection 4: Match Stats');
{
  const gStats = newGame(['Alice', 'Bob']);
  gStats.phase = 'play';
  assert(Array.isArray(gStats.stats.shots), 'Stats contains shots array');
  assert(Array.isArray(gStats.stats.fastestShot), 'Stats contains fastestShot array');
  assert(Array.isArray(gStats.stats.saves), 'Stats contains saves array');

  // Simulate puck hit
  gStats.pd[0] = { x: 300, y: 700, vx: 0, vy: -1200, tx: 300, ty: 600, sp: 1 };
  gStats.pucks = [{ x: 300, y: 640, vx: 0, vy: 400, last: 1, trail: [] }];
  step(gStats, 0.05);
  assert(gStats.stats.shots[0] >= 1, 'Shots count incremented on mallet hit');
  assert(gStats.stats.fastestShot[0] > 0, `Fastest shot speed tracked in km/h (${gStats.stats.fastestShot[0]} km/h)`);
}

// ----------------------------------------------------
// Section 5: Network State Sanitization & Protocol v2
// ----------------------------------------------------
console.log('\nSection 5: Protocol v2 & Sanitization');
{
  const validState = {
    v: 2,
    ph: 'play',
    t: 1.5,
    sc: [3, 2],
    pk: [[300, 480, 100, -200]],
    pd: [[300, 830], [300, 130]],
    pu: [0, 250, 450, 8.5],
    fz: [0, 2.5],
    sh: [5.0, 0],
    nm: ['Alice', 'Bob'],
    w: null,
    ev: [[1, 'hit', 0, 85]],
    st: { shots: [5, 4] }
  };

  const sanitized = sanitizeRemote(validState);
  assert(sanitized !== null, 'Valid v2 state sanitizes cleanly');
  assert(sanitized.v === 2, 'Sanitized state preserves protocol v2');
  assert(sanitized.sc[0] === 3 && sanitized.sc[1] === 2, 'Score sanitized');
  assert(sanitized.pk.length === 1, 'Pucks sanitized');
  assert(sanitized.fz[1] === 2.5, 'Freeze status preserved');

  // Protocol version mismatch rejection
  assert(sanitizeRemote(null) === null, 'null state rejected');
  assert(sanitizeRemote('primitive') === null, 'primitive state rejected');
  assert(sanitizeRemote({ v: 1, sc: [1, 0] }) === null, 'v1 legacy state rejected');

  // Corrupt state recovery
  const corrupt = {
    v: 2,
    ph: 'unknown_phase',
    sc: [-5, 999],
    pk: [[NaN, 'bad', 0, 0], [200, 300, 50, -50]],
    pd: null,
    nm: ['<script>Evil</script>', 12345],
    ev: 'not an array'
  };
  const rescued = sanitizeRemote(corrupt);
  assert(rescued !== null, 'Corrupt state safely rescued with clamps');
  assert(rescued.ph === 'play', 'Unknown phase clamped to play');
  assert(rescued.sc[0] === 0, 'Negative score clamped to 0');
  assert(rescued.sc[1] === 99, 'Excessive score clamped to 99');
  assert(rescued.pk.length === 1, 'NaN puck filtered out');
  assert(rescued.nm[0] === 'Evil', 'HTML tags cleaned from player name');
}

// ----------------------------------------------------
// Section 6: AI Think Balance
// ----------------------------------------------------
console.log('\nSection 6: Computer Player AI');
{
  const gAi = newGame(['Cyan', 'Computer']);
  gAi.phase = 'play';
  gAi.pucks = [{ x: 200, y: 300, vx: -100, vy: -400, last: 0, trail: [] }];
  aiThink(gAi, 1, 2); // Computer thinking on side 1 with level 2
  assert(Number.isFinite(gAi.pd[1].tx) && Number.isFinite(gAi.pd[1].ty), 'AI computes valid numeric mallet targets');
  assert(gAi.pd[1].ty <= H / 2, 'AI mallet target stays on its own half');
}

// ----------------------------------------------------
// Summary
// ----------------------------------------------------
console.log('\n====================================================');
console.log(`Test Results: ${passed} passed, ${failed} failed`);
console.log('====================================================');

if (failed > 0) {
  console.error('\nFailures summary:');
  for (const f of failures) {
    console.error(`- ${f.message}`);
  }
  process.exit(1);
} else {
  console.log('\nAll tests passed successfully! 🎉');
  process.exit(0);
}
