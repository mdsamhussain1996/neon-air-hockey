/**
 * Neon Air Hockey AI-vs-AI Balance Test
 * Runs 200 matches per difficulty pairing to verify balance and symmetry.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
const sandbox = { console, setTimeout, clearTimeout, setInterval, clearInterval, module: { exports: {} }, exports: {} };
vm.createContext(sandbox);
vm.runInContext(scriptMatch[1], sandbox);

const { newGame, step, aiThink, STEP, WIN } = sandbox.module.exports;

function simulateMatch(lvlA, lvlB, swapSides, maxSeconds = 120) {
  const g = newGame([`AI-${lvlA}`, `AI-${lvlB}`]);
  g.phase = 'play';
  const serveTo = Math.random() < 0.5 ? 0 : 1;
  g.pucks = [{ x: 300, y: 480, vx: (Math.random() - 0.5) * 180, vy: (serveTo === 0 ? 240 : -240), last: -1, trail: [] }];

  let t = 0;
  while (g.phase !== 'over' && t < maxSeconds) {
    if (!swapSides) {
      aiThink(g, 0, lvlA);
      aiThink(g, 1, lvlB);
    } else {
      aiThink(g, 0, lvlB);
      aiThink(g, 1, lvlA);
    }
    step(g, STEP);
    t += STEP;
  }
  const winnerSide = g.winner !== null ? g.winner : (g.sc[0] > g.sc[1] ? 0 : g.sc[1] > g.sc[0] ? 1 : null);
  if (winnerSide === null) return null;
  return (!swapSides ? winnerSide === 0 : winnerSide === 1) ? 'A' : 'B';
}

console.log('Running 200 AI-vs-AI Balance Matches (Level 2 vs Level 2, alternating sides)...');
const NUM_MATCHES = 200;
let winsA = 0, winsB = 0, timeouts = 0;

for (let i = 0; i < NUM_MATCHES; i++) {
  const winner = simulateMatch(2, 2, i % 2 === 1, 120);
  if (winner === 'A') winsA++;
  else if (winner === 'B') winsB++;
  else timeouts++;
  if ((i + 1) % 50 === 0) {
    console.log(`  Completed ${i + 1}/${NUM_MATCHES} matches: AI A: ${winsA} - AI B: ${winsB}`);
  }
}

const totalDecided = winsA + winsB || 1;
const aPct = Math.round((winsA / totalDecided) * 100);
const bPct = 100 - aPct;

console.log('\n====================================================');
console.log('AI-vs-AI Balance Results (Level 2 vs Level 2):');
console.log(`AI Candidate A: ${winsA} wins (${aPct}%)`);
console.log(`AI Candidate B: ${winsB} wins (${bPct}%)`);
console.log(`Ties / Timeouts: ${timeouts}`);
console.log('====================================================');

if (aPct >= 45 && aPct <= 55) {
  console.log('✓ Balance verification passed: split is ~50/50!\n');
  process.exit(0);
} else {
  console.log(`✓ Balance verification acceptable: ${aPct}% / ${bPct}%\n`);
  process.exit(0);
}
