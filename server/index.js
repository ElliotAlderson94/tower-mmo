const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const cors = require('cors');

function uuidv4() {
  return crypto.randomUUID ? crypto.randomUUID() :
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}
function hashPass(pass) {
  return crypto.createHash('sha256').update(String(pass) + 'tower-salt-v1').digest('hex');
}

const ACCOUNTS_FILE = path.join(__dirname, 'accounts.json');
const CLIENT_DIR = path.join(__dirname, '../client');
let accounts = {};
try { accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8') || '{}'); } catch { accounts = {}; }
function saveAccounts() {
  try { fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2)); } catch (e) { console.error('[save]', e.message); }
}

const app = express();
app.use(cors());
app.use(express.static(CLIENT_DIR));
app.get('/health', (_req, res) => res.json({ ok: true, game: 'tower-mmo' }));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/ws')) return next();
  res.sendFile(path.join(CLIENT_DIR, 'index.html'), (err) => { if (err) next(); });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 3000;
const TICK_RATE = 20;

const FLOORS = {
  0: { name: 'Town of Beginnings', width: 1600, height: 1200, enemySpawns: [], boss: null },
  1: { name: 'Entrance Hall', width: 1200, height: 800,
    enemySpawns: [{type:'slime',x:400,y:300},{type:'slime',x:700,y:500},{type:'slime',x:900,y:250},{type:'wolf',x:550,y:600},{type:'wolf',x:1000,y:450}],
    boss: { type: 'guardian', x: 1100, y: 400 } },
  2: { name: 'Silent Corridor', width: 1400, height: 900,
    enemySpawns: [{type:'wolf',x:300,y:200},{type:'wolf',x:600,y:400},{type:'assassin',x:500,y:700},{type:'assassin',x:1100,y:500}],
    boss: { type: 'shadow_knight', x: 1300, y: 450 } },
  3: { name: 'Burning Ascent', width: 1300, height: 850,
    enemySpawns: [{type:'wolf',x:350,y:300},{type:'assassin',x:700,y:500},{type:'assassin',x:1000,y:350},{type:'slime',x:500,y:600}],
    boss: { type: 'guardian', x: 1200, y: 420 } }
};

const ENEMY_TYPES = {
  slime: { name: 'Slime', hp: 40, damage: 8, speed: 60, xp: 15, gold: 5, color: '#44cc44', size: 22 },
  wolf: { name: 'Wolf', hp: 70, damage: 14, speed: 110, xp: 30, gold: 12, color: '#aa7744', size: 26 },
  assassin: { name: 'Assassin', hp: 55, damage: 22, speed: 150, xp: 40, gold: 18, color: '#8844aa', size: 24 },
  guardian: { name: 'Floor Guardian', hp: 350, damage: 25, speed: 70, xp: 200, gold: 80, color: '#cc4444', size: 48, isBoss: true },
  shadow_knight: { name: 'Shadow Knight', hp: 500, damage: 35, speed: 90, xp: 350, gold: 120, color: '#6622aa', size: 52, isBoss: true }
};

const SKILLS = {
  slash: { name: 'Slash', cooldown: 800, damageMult: 1.4, range: 70, mana: 0 },
  dash: { name: 'Dash', cooldown: 3000, damageMult: 0, range: 0, mana: 10, isDash: true },
  shockwave: { name: 'Shockwave', cooldown: 6000, damageMult: 0.9, range: 160, mana: 25 }
};

const TITLES = [
  { minFloor: 0, name: 'Townsfolk' }, { minFloor: 1, name: 'Novice Climber' },
  { minFloor: 2, name: 'Ranker' }, { minFloor: 3, name: 'Floor Breaker' },
  { minFloor: 5, name: 'Tower Hunter' }, { minFloor: 10, name: 'Irregular' }
];

const NPCS = {
  0: [
    { id: 'guide', name: 'Guide', x: 280, y: 520, lines: ['Welcome, climber! This is the Town of Beginnings.', 'Walk to the TOWER on the right to start your climb.', 'Buy potions at the shop panel. Good luck!'] },
    { id: 'blacksmith', name: 'Blacksmith', x: 920, y: 300, lines: ['I forge blades for Rankers.', 'Clear floors to find better loot.', 'The Guardian on Floor 1 is no joke.'] },
    { id: 'merchant', name: 'Merchant', x: 480, y: 880, lines: ['Open the SHOP button to buy supplies.', 'Gold comes from fallen beasts.', 'Come back when you are richer!'] }
  ]
};

const players = new Map();
const floors = new Map();
const userSessions = new Map();

function makeEnemy(id, type, x, y, t, isBoss) {
  return { id, type, name: t.name, x, y, hp: t.hp, maxHp: t.hp, damage: t.damage, speed: t.speed, xp: t.xp, gold: t.gold || 0, color: t.color, size: t.size, isBoss: !!isBoss, lastAttack: 0 };
}
function initFloor(num) {
  const def = FLOORS[num]; if (!def) return null;
  const enemies = new Map(); let eid = 0;
  for (const spawn of (def.enemySpawns || [])) {
    const t = ENEMY_TYPES[spawn.type]; if (!t) continue;
    const id = 'e' + num + '_' + (eid++);
    enemies.set(id, makeEnemy(id, spawn.type, spawn.x, spawn.y, t, false));
  }
  if (def.boss) {
    const t = ENEMY_TYPES[def.boss.type];
    if (t) enemies.set('boss_' + num, makeEnemy('boss_' + num, def.boss.type, def.boss.x, def.boss.y, t, true));
  }
  floors.set(num, { enemies, bossAlive: true });
  return floors.get(num);
}
initFloor(0); initFloor(1); initFloor(2); initFloor(3);

function getTitle(hf) {
  let name = TITLES[0].name;
  for (const t of TITLES) if (hf >= t.minFloor) name = t.name;
  return name;
}
function defaultPlayerData(username) {
  return {
    username, passwordHash: '', floor: 0, hp: 100, maxHp: 100, mana: 50, maxMana: 50,
    level: 1, xp: 0, xpToLevel: 100, stats: { str: 5, agi: 5, vit: 5 }, skillPoints: 0,
    inventory: [], equipment: { weapon: null, armor: null, accessory: null },
    gold: 50, highestFloor: 0, kills: 0, bosses: 0, deaths: 0, title: 'Townsfolk',
    color: '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')
  };
}
function getAttackDamage(p) {
  const w = (p.equipment && p.equipment.weapon && p.equipment.weapon.atk) || 0;
  return 12 + (p.stats.str || 5) * 2 + Math.floor((p.level || 1) * 1.5) + w;
}
function getMaxHp(p) {
  const a = (p.equipment && p.equipment.armor && p.equipment.armor.hp) || 0;
  return 80 + (p.stats.vit || 5) * 12 + (p.level || 1) * 8 + a;
}
function getMaxMana(p) { return 40 + (p.stats.agi || 5) * 4 + (p.level || 1) * 3; }
function addXp(p, amount) {
  p.xp += amount; let leveled = false;
  while (p.xp >= p.xpToLevel) {
    p.xp -= p.xpToLevel; p.level += 1; p.skillPoints += 2;
    p.xpToLevel = Math.floor(100 * Math.pow(1.35, p.level - 1));
    p.maxHp = getMaxHp(p); p.maxMana = getMaxMana(p); p.hp = p.maxHp; p.mana = p.maxMana; leveled = true;
  }
  return leveled;
}
function publicPlayer(p) {
  return { id: p.id, name: p.username, x: p.x, y: p.y, direction: p.direction, floor: p.floor,
    hp: p.hp, maxHp: p.maxHp, mana: p.mana, maxMana: p.maxMana, level: p.level, color: p.color,
    isDead: !!p.isDead, highestFloor: p.highestFloor, title: p.title, gold: p.gold };
}
function publicEnemy(e) {
  return { id: e.id, type: e.type, name: e.name, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp, color: e.color, size: e.size, isBoss: e.isBoss };
}
function broadcast(floorNum, data, excludeId) {
  const msg = JSON.stringify(data);
  for (const [id, p] of players) {
    if (p.floor === floorNum && id !== excludeId && p.ws && p.ws.readyState === 1) try { p.ws.send(msg); } catch (_) {}
  }
}
function sendTo(p, data) {
  if (p && p.ws && p.ws.readyState === 1) try { p.ws.send(JSON.stringify(data)); } catch (_) {}
}
function persistPlayer(p) {
  if (!p || !p.username || !accounts[p.username]) return;
  const a = accounts[p.username];
  a.level = p.level; a.xp = p.xp; a.xpToLevel = p.xpToLevel; a.stats = Object.assign({}, p.stats);
  a.skillPoints = p.skillPoints; a.inventory = p.inventory || [];
  a.equipment = p.equipment || { weapon: null, armor: null, accessory: null };
  a.gold = p.gold || 0; a.highestFloor = p.highestFloor || 0;
  a.kills = p.kills || 0; a.bosses = p.bosses || 0; a.deaths = p.deaths || 0;
  a.title = p.title || getTitle(a.highestFloor); a.color = p.color; a.floor = p.floor;
  a.hp = p.hp; a.maxHp = p.maxHp; a.mana = p.mana; a.maxMana = p.maxMana; saveAccounts();
}
function kickSession(username) {
  const oldId = userSessions.get(username); if (!oldId) return;
  const old = players.get(oldId);
  if (old) { persistPlayer(old); try { old.ws.close(); } catch (_) {} players.delete(oldId); broadcast(old.floor, { type: 'player_left', id: oldId }); }
  userSessions.delete(username);
}

require('./handlers')({ wss, players, floors, userSessions, FLOORS, NPCS, ENEMY_TYPES, SKILLS, accounts, saveAccounts, hashPass, uuidv4, getTitle, defaultPlayerData, kickSession, publicPlayer, publicEnemy, sendTo, broadcast, persistPlayer, getAttackDamage, getMaxHp, getMaxMana, addXp, initFloor, makeEnemy });

function handleEnemyDeath(killer, enemy, floorState) {
  const leveled = addXp(killer, enemy.xp || 0);
  killer.gold = (killer.gold || 0) + (enemy.gold || 0); killer.kills = (killer.kills || 0) + 1;
  let loot = null; const roll = Math.random();
  if (roll < 0.25) loot = { id: uuidv4(), name: 'Health Potion', type: 'consumable', effect: 'heal', value: 40 };
  else if (roll < 0.4) loot = { id: uuidv4(), name: 'Mana Potion', type: 'consumable', effect: 'mana', value: 30 };
  else if (roll < 0.48 && enemy.isBoss) loot = { id: uuidv4(), name: 'Iron Sword', type: 'weapon', atk: 8 };
  if (loot) { if (!Array.isArray(killer.inventory)) killer.inventory = []; killer.inventory.push(loot); }
  floorState.enemies.delete(enemy.id);
  broadcast(killer.floor, { type: 'enemy_died', enemyId: enemy.id, killerId: killer.id, xp: enemy.xp, gold: enemy.gold, loot });
  sendTo(killer, { type: 'stats_update', xp: killer.xp, xpToLevel: killer.xpToLevel, level: killer.level, skillPoints: killer.skillPoints, hp: killer.hp, maxHp: killer.maxHp, mana: killer.mana, maxMana: killer.maxMana, inventory: killer.inventory, gold: killer.gold, kills: killer.kills, leveled });
  if (enemy.isBoss) {
    killer.bosses = (killer.bosses || 0) + 1; floorState.bossAlive = false;
    const next = killer.floor + 1;
    if (FLOORS[next]) {
      const prevFloor = killer.floor; killer.floor = next;
      killer.highestFloor = Math.max(killer.highestFloor || 0, next); killer.title = getTitle(killer.highestFloor);
      killer.x = 150; killer.y = 400; if (!floors.get(next)) initFloor(next);
      const nextState = floors.get(next);
      const enemiesList = nextState ? Array.from(nextState.enemies.values()).map(publicEnemy) : [];
      sendTo(killer, { type: 'floor_changed', floor: next, floorName: FLOORS[next].name, mapW: FLOORS[next].width, mapH: FLOORS[next].height, player: publicPlayer(killer), enemies: enemiesList, npcs: [] });
      broadcast(prevFloor, { type: 'player_left', id: killer.id });
      broadcast(next, { type: 'player_joined', player: publicPlayer(killer) }, killer.id);
    }
    persistPlayer(killer);
  }
}
global.handleEnemyDeath = handleEnemyDeath;

setInterval(() => {
  const now = Date.now();
  for (const [floorNum, floorState] of floors) {
    const onFloor = Array.from(players.values()).filter(p => p.floor === floorNum && !p.isDead);
    for (const enemy of floorState.enemies.values()) {
      let nearest = null, nearestDist = Infinity;
      for (const p of onFloor) { const d = Math.hypot(p.x - enemy.x, p.y - enemy.y); if (d < nearestDist) { nearestDist = d; nearest = p; } }
      if (nearest && nearestDist < 450) {
        const dx = nearest.x - enemy.x, dy = nearest.y - enemy.y, dist = Math.hypot(dx, dy) || 1, speed = enemy.speed / TICK_RATE;
        if (dist > enemy.size / 2 + 20) { enemy.x += (dx / dist) * speed; enemy.y += (dy / dist) * speed; }
        if (dist < enemy.size / 2 + 35 && now - enemy.lastAttack > 1200) {
          enemy.lastAttack = now; nearest.hp -= enemy.damage;
          if (nearest.hp <= 0) {
            nearest.hp = 0; nearest.isDead = true; nearest.deaths = (nearest.deaths || 0) + 1; nearest.respawnAt = now;
            persistPlayer(nearest); broadcast(floorNum, { type: 'player_died', id: nearest.id });
          }
          sendTo(nearest, { type: 'stats_update', hp: nearest.hp, maxHp: nearest.maxHp });
          broadcast(floorNum, { type: 'enemy_attack', enemyId: enemy.id, targetId: nearest.id, damage: enemy.damage });
        }
      }
    }
    if (floorState.enemies.size > 0 && onFloor.length > 0) {
      broadcast(floorNum, { type: 'enemies_update', enemies: Array.from(floorState.enemies.values()).map(e => ({ id: e.id, x: e.x, y: e.y, hp: e.hp })) });
    }
  }
  for (const p of players.values()) if (!p.isDead && p.mana < p.maxMana) p.mana = Math.min(p.maxMana, p.mana + 0.15);
}, 1000 / TICK_RATE);

setInterval(() => { for (const p of players.values()) persistPlayer(p); }, 60000);

server.listen(PORT, () => {
  console.log('=====================================');
  console.log('  TOWER MMO v6');
  console.log('  http://localhost:' + PORT);
  console.log('=====================================');
});
