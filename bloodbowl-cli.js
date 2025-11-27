#!/usr/bin/env node

/**
 * Blood Bowl roster generator
 * Usage:
 *   node bloodbowl-cli.js --team humans --tv 1000 --maxResults 20 --minPlayers 11
 *
 * TV is in thousands (1000 == 1,000,000 gp). Adjust rosters below as needed.
 */

const args = parseArgs(process.argv.slice(2));

if (args.help || !args.team || !args.tv) {
  printHelp();
  process.exit(0);
}

const rosters = getRosters();
const team = rosters[args.team.toLowerCase()];

if (!team) {
  console.error(`Unknown team '${args.team}'. Known teams: ${Object.keys(rosters).join(', ')}`);
  process.exit(1);
}

const settings = {
  tv: Number(args.tv),
  minPlayers: Number(args.minPlayers ?? 11),
  maxPlayers: Number(args.maxPlayers ?? 16),
  maxResults: Number(args.maxResults ?? 30),
  sort: args.sort ?? 'cost', // cost | players
  rerolls: args.rerolls !== undefined ? Number(args.rerolls) : undefined,
  required: args.require ? parseRequirements(args.require) : [], // e.g. "--require Blitzer:2,Catcher:1"
  requiredExtras: args.requireExtra ? parseRequirements(args.requireExtra) : [], // e.g. "--requireExtra Bribe:1"
  requireMode: (args.requireMode || 'all').toLowerCase(), // all | any
  requireExtraMode: (args.requireExtraMode || 'all').toLowerCase(), // all | any
};

if (Number.isNaN(settings.tv) || settings.tv <= 0) {
  console.error('Please provide a positive numeric --tv (in thousands).');
  process.exit(1);
}
if (settings.rerolls !== undefined && (Number.isNaN(settings.rerolls) || settings.rerolls < 0)) {
  console.error('Please provide a non-negative integer for --rerolls.');
  process.exit(1);
}
if (args.require && (!Array.isArray(settings.required) || settings.required.length === 0)) {
  console.error('Invalid --require value. Use "Name:count" or comma-list, e.g. "Blitzer:2,Catcher:1".');
  process.exit(1);
}
if (args.requireExtra && (!Array.isArray(settings.requiredExtras) || settings.requiredExtras.length === 0)) {
  console.error('Invalid --requireExtra value. Use \"Name:count\" or comma-list, e.g. \"Bribe:1,Apothecary:1\".');
  process.exit(1);
}
if (!['all', 'any'].includes(settings.requireMode)) {
  console.error('Invalid --requireMode. Use "all" or "any".');
  process.exit(1);
}
if (!['all', 'any'].includes(settings.requireExtraMode)) {
  console.error('Invalid --requireExtraMode. Use "all" or "any".');
  process.exit(1);
}

const combos = generateCombos(team.positions, settings);

if (!combos.length) {
  console.log('No combinations found under the given constraints.');
  process.exit(0);
}

printResults(team.name, settings, combos);

function generateCombos(positions, settings) {
  let results = [];
  const path = [];
  let bestCost = 0;

  function dfs(index, remainingCost, totalPlayers) {
    if (totalPlayers >= settings.minPlayers) {
      const spent = settings.tv - remainingCost;
      const summary = path.reduce(
        (acc, p) => {
          if (!p.count) return acc;
          const type = p.type ?? 'player';
          const name = (p.name || '').toLowerCase();
          if (type === 'extra' && name === 'reroll') acc.rerolls += p.count;
          if (type === 'player') {
            const isLineman = p.role === 'lineman' || name.includes('lineman');
            if (isLineman) acc.lineman += p.count;
            else acc.positionals += p.count;
          }
          if (settings.required && settings.required.length) {
            const req = settings.required.find(r => r.name === name);
            if (req) {
              acc.required[name] = (acc.required[name] ?? 0) + p.count;
            }
          }
          if (settings.requiredExtras && settings.requiredExtras.length) {
            const req = settings.requiredExtras.find(r => r.name === name);
            if (req) {
              acc.requiredExtras[name] = (acc.requiredExtras[name] ?? 0) + p.count;
            }
          }
          return acc;
        },
        { rerolls: 0, positionals: 0, lineman: 0, required: {}, requiredExtras: {} }
      );

      const missingRequired = settings.required && settings.required.some(
        r => (summary.required[r.name] ?? 0) < r.count
      );
      const missingRequiredExtras = settings.requiredExtras && settings.requiredExtras.some(
        r => (summary.requiredExtras[r.name] ?? 0) < r.count
      );

      const failsRequiredAny = settings.requireMode === 'any' &&
        settings.required.length > 0 &&
        settings.required.every(r => (summary.required[r.name] ?? 0) < r.count);
      const failsRequiredAll = settings.requireMode === 'all' && missingRequired;

      const failsExtrasAny = settings.requireExtraMode === 'any' &&
        settings.requiredExtras.length > 0 &&
        settings.requiredExtras.every(r => (summary.requiredExtras[r.name] ?? 0) < r.count);
      const failsExtrasAll = settings.requireExtraMode === 'all' && missingRequiredExtras;

      if (
        (settings.rerolls !== undefined && summary.rerolls !== settings.rerolls) ||
        failsRequiredAny ||
        failsRequiredAll ||
        failsExtrasAny ||
        failsExtrasAll
      ) {
        // Keep exploring; maybe later branches add the required picks.
      } else if (spent > bestCost) {
        bestCost = spent;
        results = [{
          players: [...path],
          cost: spent,
          totalPlayers,
          rerolls: summary.rerolls,
          positionals: summary.positionals,
          linemen: summary.lineman,
        }];
      } else if (spent === bestCost) {
        results.push({
          players: [...path],
          cost: spent,
          totalPlayers,
          rerolls: summary.rerolls,
          positionals: summary.positionals,
          linemen: summary.lineman,
        });
      }
      // Continue exploring to see if we can spend closer to the cap.
    }

    if (index >= positions.length || remainingCost <= 0) return;

    const pos = positions[index];
    const isPlayer = (pos.type ?? 'player') === 'player';
    const maxByCost = Math.floor(remainingCost / pos.cost);
    const playerRoom = isPlayer ? settings.maxPlayers - totalPlayers : Number.MAX_SAFE_INTEGER;
    const maxCount = Math.min(pos.max, maxByCost, playerRoom);

    for (let count = 0; count <= maxCount; count++) {
      path.push({ name: pos.name, count, cost: pos.cost, type: pos.type, role: pos.role });
      const nextPlayers = isPlayer ? totalPlayers + count : totalPlayers;
      dfs(index + 1, remainingCost - count * pos.cost, nextPlayers);
      path.pop();
    }
  }

  dfs(0, settings.tv, 0);

  const sorted = results
    .filter(r => r.totalPlayers <= settings.maxPlayers)
    .sort((a, b) => {
      if (settings.sort === 'players') {
        return (
          b.totalPlayers - a.totalPlayers ||
          b.positionals - a.positionals ||
          a.linemen - b.linemen ||
          b.cost - a.cost ||
          b.rerolls - a.rerolls ||
          0
        );
      }
      return (
        b.cost - a.cost ||
        b.totalPlayers - a.totalPlayers ||
        b.positionals - a.positionals ||
        a.linemen - b.linemen ||
        b.rerolls - a.rerolls ||
        0
      );
    });

  return sorted.slice(0, settings.maxResults);
}

function printResults(teamName, settings, combos) {
  console.log(`Team: ${teamName}`);
  console.log(`Target TV: ${settings.tv}k, min players: ${settings.minPlayers}, max players: ${settings.maxPlayers}`);
  console.log(`Showing up to ${settings.maxResults} best-fit combos (sorted by ${settings.sort}).\n`);

  combos.forEach((combo, idx) => {
    const lines = combo.players
      .filter(p => p.count > 0)
      .map(p => `${p.count} x ${p.name} @ ${p.cost}k`);

    console.log(`#${idx + 1} | Cost: ${combo.cost}k | Players: ${combo.totalPlayers}`);
    console.log('  ' + (lines.join('\n  ') || '(no players)'));
    console.log('');
  });
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      if (value && !value.startsWith('--')) {
        out[key] = value;
        i++;
      } else {
        out[key] = true;
      }
    }
  }
  return out;
}

function parseRequirements(str) {
  const pieces = str.split(',');
  const parsed = pieces
    .map(piece => {
      const parts = piece.split(':');
      if (!parts[0]) return null;
      const name = parts[0].trim().toLowerCase();
      const count = parts[1] ? Number(parts[1]) : 1;
      if (!name || Number.isNaN(count) || count <= 0) return null;
      return { name, count };
    })
    .filter(Boolean);
  return parsed.length ? parsed : null;
}

function getRosters() {
  return {
    humans: {
      name: 'Humans',
      positions: [
        { name: 'Ogre', cost: 140, max: 1, type: 'player' },
        { name: 'Blitzer', cost: 85, max: 2, type: 'player' },
        { name: 'Catcher', cost: 75, max: 2, type: 'player' },
        { name: 'Thrower', cost: 75, max: 2, type: 'player' },
        { name: 'Halfling', cost: 30, max:4, type: 'player'},
        { name: 'Lineman', cost: 50, max: 16, type: 'player', role: 'lineman' },
        { name: 'Reroll', cost: 50, max: 8, type: 'extra' },
        { name: 'Apothecary', cost: 50, max: 1, type: 'extra' },
        { name: 'Assistant Coach', cost: 10, max: 6, type: 'extra' },
        { name: 'Cheerleader', cost: 10, max: 12, type: 'extra' },
        { name: 'Dedicated Fans', cost: 10, max: 6, type: 'extra' },
        { name: 'Bribe', cost: 100, max: 3, type: 'extra' },
      ],
    },
    orcs: {
      name: 'Orcs',
      positions: [
        { name: 'Troll', cost: 115, max: 1, type: 'player' },
        { name: 'Black Orc', cost: 90, max: 2, type: 'player' },
        { name: 'Blitzer', cost: 90, max: 2, type: 'player' },
        { name: 'Thrower', cost: 65, max: 2, type: 'player' },
        { name: 'Lineman', cost: 50, max: 16, type: 'player', role: 'lineman' },
        { name: 'Goblin', cost: 40, max: 4, type: 'player' },
        { name: 'Reroll', cost: 60, max: 8, type: 'extra' },
        { name: 'Apothecary', cost: 50, max: 1, type: 'extra' },
        { name: 'Assistant Coach', cost: 10, max: 6, type: 'extra' },
        { name: 'Cheerleader', cost: 10, max: 12, type: 'extra' },
        { name: 'Dedicated Fans', cost: 10, max: 6, type: 'extra' },
        { name: 'Bribe', cost: 100, max: 3, type: 'extra' },
      ],
    },
    dwarfs: {
      name: 'Dwarfs',
      positions: [
        { name: 'Deathroller', cost: 170, max: 1, type: 'player' },
        { name: 'Troll Slayer', cost: 95, max: 2, type: 'player' },
        { name: 'Runner', cost: 80, max: 2, type: 'player' },
        { name: 'Blitzer', cost: 100, max: 2, type: 'player' },
        { name: 'Blocker', cost: 70, max: 16, type: 'player', role: 'lineman' },
        { name: 'Reroll', cost: 60, max: 8, type: 'extra' },
        { name: 'Apothecary', cost: 50, max: 1, type: 'extra' },
        { name: 'Assistant Coach', cost: 10, max: 6, type: 'extra' },
        { name: 'Cheerleader', cost: 10, max: 12, type: 'extra' },
        { name: 'Dedicated Fans', cost: 10, max: 6, type: 'extra' },
        { name: 'Bribe', cost: 50, max: 3, type: 'extra' },
      ],
    },
  };
}

function printHelp() {
  console.log(`
Blood Bowl roster CLI

Options:
  --team <name>        Team key (humans, orcs). Edit getRosters() to add more.
  --tv <number>        Team value in thousands (e.g. 1000 = 1,000,000).
  --minPlayers <n>     Minimum player count (default 11).
  --maxPlayers <n>     Maximum player count (default 16).
  --maxResults <n>     Limit number of combos returned (default 30).
  --sort <cost|players>Sort combos by cost or player count (default cost).
  --rerolls <n>        Require exactly this many rerolls (optional).
  --require <Name:cnt> Require specific positionals; supports comma lists, e.g. "Blitzer:2,Catcher:1" (optional).
  --requireMode <all|any> Require all listed positionals (default) or any of them.
  --requireExtra <Name:cnt> Require specific extras; supports comma lists, e.g. "Bribe:1,Apothecary:1" (optional).
  --requireExtraMode <all|any> Require all listed extras (default) or any of them.
  --help               Show this message.

Example:
  node bloodbowl-cli.js --team humans --tv 1000 --maxResults 10
`);
}
