const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const path = require('path');

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, '../client')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;
const TICK_RATE = 20;

const FLOORS = {
  1: {
    name: 'Entrance Hall',
    width: 1200,
    height: 800,
    enemySpawns: [
      { type: 'slime', x: 400, y: 300 },
      { type: 'slime', x: 700, y: 500 },
      { type: 'slime', x: 900, y: 250 },
      { type: 'wolf', x: 550, y: 600 },
      { type: 'wolf', x: 1000, y: 450 }
    ],
    boss: { type: 'guardian', x: 1100, y: 400 },
    clearCondition: 'kill_boss'
  },
  2: {
    name: 'Silent Corridor',
    width: 1400,
    height: 900,
    enemySpawns: [
      { type: 'wolf', x: 300, y: 200 },
      { type: 'wolf', x: 600, y: 400 },
      { type: 'wolf', x: 900, y: 300 },
      { type: 'assassin', x: 500, y: 700 },
      { type: 'assassin', x: 1100, y: 500 }
    ],
    boss: { type: 'shadow_knight', x: 1300, y: 450 },
    clearCondition: 'kill_boss'
  }
};

const ENEMY_TYPES = {
  slime: { name: 'Slime', hp: 40, damage: 8, speed: 60, xp: 15, color: '#44cc44', size: 22 },
  wolf: { name: 'Wolf', hp: 70, damage: 14, speed: 110, xp: 30, color: '#aa7744', size: 26 },
  assassin: { name: 'Assassin', hp: 55, damage: 22, speed: 150, xp: 40, color: '#8844aa', size: 24 },
  guardian: { name: 'Floor Guardian', hp: 350, damage: 25, speed: 70, xp: 200, color: '#cc4444', size: 48, isBoss: true },
  shadow_knight: { name: 'Shadow Knight', hp: 500, damage: 35, speed: 90, xp: 350, color: '#6622aa', size: 52, isBoss: true }
};

const SKILLS = {
  slash: { name: 'Slash', cooldown: 800, damageMult: 1.4, range: 70, mana: 0 },
  dash: { name: 'Dash', cooldown: 3000, damageMult: 0, range: 0, mana: 10, isDash: true },
  shockwave: { name: 'Shockwave', cooldown: 6000, damageMult: 0.9, range: 160, mana: 25 }
};

const players = new Map();
const floors = new Map();

function initFloor(num) {
  const def = FLOORS[num];
  if (!def) return null;
  const enemies = new Map();
  let eid = 0;
  for (const spawn of def.enemySpawns) {
    const type = ENEMY_TYPES[spawn.type];
    const id = `e${num}_${eid++}`;
    enemies.set(id, {
      id, type: spawn.type, name: type.name, x: spawn.x, y: spawn.y,
      hp: type.hp, maxHp: type.hp, damage: type.damage, speed: type.speed,
      xp: type.xp, color: type.color, size: type.size, isBoss: false,
      targetId: null, lastAttack: 0
    });
  }
  if (def.boss) {
    const type = ENEMY_TYPES[def.boss.type];
    const id = `boss_${num}`;
    enemies.set(id, {
      id, type: def.boss.type, name: type.name, x: def.boss.x, y: def.boss.y,
      hp: type.hp, maxHp: type.hp, damage: type.damage, speed: type.speed,
      xp: type.xp, color: type.color, size: type.size, isBoss: true,
      targetId: null, lastAttack: 0
    });
  }
  floors.set(num, { enemies, bossAlive: true });
  return floors.get(num);
}

initFloor(1);
initFloor(2);

function createPlayer(id, name) {
  return {
    id, name: name || `Climber_${id.slice(0, 4)}`, x: 150, y: 400, direction: 'right',
    floor: 1, hp: 100, maxHp: 100, mana: 50, maxMana: 50, level: 1, xp: 0, xpToLevel: 100,
    stats: { str: 5, agi: 5, vit: 5 }, skillPoints: 0,
    skills: { slash: { lastUsed: 0 }, dash: { lastUsed: 0 }, shockwave: { lastUsed: 0 } },
    inventory: [], highestFloor: 1,
    color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
    lastUpdate: Date.now(), lastAttack: 0, isDead: false, respawnAt: 0
  };
}

function getAttackDamage(player) { return 12 + player.stats.str * 2 + Math.floor(player.level * 1.5); }
function getMaxHp(player) { return 80 + player.stats.vit * 12 + player.level * 8; }
function getMaxMana(player) { return 40 + player.stats.agi * 4 + player.level * 3; }

function addXp(player, amount) {
  player.xp += amount;
  let leveled = false;
  while (player.xp >= player.xpToLevel) {
    player.xp -= player.xpToLevel;
    player.level++;
    player.skillPoints += 2;
    player.xpToLevel = Math.floor(100 * Math.pow(1.35, player.level - 1));
    player.maxHp = getMaxHp(player);
    player.maxMana = getMaxMana(player);
    player.hp = player.maxHp;
    player.mana = player.maxMana;
    leveled = true;
  }
  return leveled;
}

function broadcast(floorNum, data, excludeId = null) {
  const msg = JSON.stringify(data);
  for (const [id, p] of players) {
    if (p.floor === floorNum && id !== excludeId && p.ws && p.ws.readyState === 1) p.ws.send(msg);
  }
}
function broadcastAll(data) {
  const msg = JSON.stringify(data);
  for (const p of players.values()) if (p.ws && p.ws.readyState === 1) p.ws.send(msg);
}
function sendTo(player, data) {
  if (player.ws && player.ws.readyState === 1) player.ws.send(JSON.stringify(data));
}

function getPublicPlayer(p) {
  return {
    id: p.id, name: p.name, x: p.x, y: p.y, direction: p.direction, floor: p.floor,
    hp: p.hp, maxHp: p.maxHp, mana: p.mana, maxMana: p.maxMana, level: p.level,
    color: p.color, isDead: p.isDead, highestFloor: p.highestFloor
  };
}
function getPublicEnemy(e) {
  return {
    id: e.id, type: e.type, name: e.name, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp,
    color: e.color, size: e.size, isBoss: e.isBoss
  };
}

wss.on('connection', (ws) => {
  const id = uuidv4();
  console.log(`[+] Connected: ${id}`);

  ws.on('message', (raw) => {
    let data;
    try { data = JSON.parse(raw); } catch { return; }
    const player = players.get(id);

    switch (data.type) {
      case 'join': {
        const p = createPlayer(id, data.name);
        p.ws = ws;
        p.maxHp = getMaxHp(p);
        p.maxMana = getMaxMana(p);
        p.hp = p.maxHp;
        p.mana = p.maxMana;
        players.set(id, p);

        const floorState = floors.get(1);
        const enemies = floorState ? Array.from(floorState.enemies.values()).map(getPublicEnemy) : [];

        sendTo(p, {
          type: 'welcome', id,
          player: { ...getPublicPlayer(p), stats: p.stats, skillPoints: p.skillPoints, xp: p.xp, xpToLevel: p.xpToLevel, inventory: p.inventory, skills: Object.keys(SKILLS) },
          others: Array.from(players.values()).filter(o => o.id !== id && o.floor === 1).map(getPublicPlayer),
          enemies, floorName: FLOORS[1].name
        });
        broadcast(1, { type: 'player_joined', player: getPublicPlayer(p) }, id);
        console.log(`${p.name} joined Floor 1. Players: ${players.size}`);
        break;
      }
      case 'move': {
        if (!player || player.isDead) return;
        const floorDef = FLOORS[player.floor];
        if (!floorDef) return;
        player.x = Math.max(30, Math.min(floorDef.width - 30, data.x));
        player.y = Math.max(30, Math.min(floorDef.height - 30, data.y));
        player.direction = data.direction || player.direction;
        player.lastUpdate = Date.now();
        broadcast(player.floor, { type: 'player_moved', id, x: player.x, y: player.y, direction: player.direction }, id);
        break;
      }
      case 'attack': {
        if (!player || player.isDead) return;
        const now = Date.now();
        if (now - player.lastAttack < 450) return;
        player.lastAttack = now;
        const dmg = getAttackDamage(player);
        const range = 65;
        const floorState = floors.get(player.floor);
        if (!floorState) return;
        const hitEnemies = [];
        for (const enemy of floorState.enemies.values()) {
          const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
          if (dist <= range + enemy.size / 2) {
            enemy.hp -= dmg;
            hitEnemies.push({ id: enemy.id, hp: enemy.hp, dmg });
            if (enemy.hp <= 0) handleEnemyDeath(player, enemy, floorState);
          }
        }
        broadcast(player.floor, { type: 'player_attack', id, x: player.x, y: player.y, direction: player.direction, hits: hitEnemies });
        break;
      }
      case 'skill': {
        if (!player || player.isDead) return;
        const skillId = data.skill;
        const skillDef = SKILLS[skillId];
        if (!skillDef || !player.skills[skillId]) return;
        const now = Date.now();
        if (now - player.skills[skillId].lastUsed < skillDef.cooldown) return;
        if (player.mana < skillDef.mana) return;
        player.skills[skillId].lastUsed = now;
        player.mana -= skillDef.mana;
        if (skillDef.isDash) {
          const dist = 180;
          const dx = player.direction === 'left' ? -dist : dist;
          const floorDef = FLOORS[player.floor];
          player.x = Math.max(30, Math.min(floorDef.width - 30, player.x + dx));
          broadcast(player.floor, { type: 'player_moved', id, x: player.x, y: player.y, direction: player.direction });
        } else {
          const dmg = Math.floor(getAttackDamage(player) * skillDef.damageMult);
          const floorState = floors.get(player.floor);
          const hits = [];
          if (floorState) {
            for (const enemy of floorState.enemies.values()) {
              const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
              if (dist <= skillDef.range + enemy.size / 2) {
                enemy.hp -= dmg;
                hits.push({ id: enemy.id, hp: enemy.hp, dmg });
                if (enemy.hp <= 0) handleEnemyDeath(player, enemy, floorState);
              }
            }
          }
          broadcast(player.floor, { type: 'skill_used', id, skill: skillId, x: player.x, y: player.y, hits });
        }
        sendTo(player, { type: 'stats_update', hp: player.hp, mana: player.mana, maxHp: player.maxHp, maxMana: player.maxMana });
        break;
      }
      case 'allocate_stat': {
        if (!player || player.skillPoints <= 0) return;
        const stat = data.stat;
        if (!['str', 'agi', 'vit'].includes(stat)) return;
        player.stats[stat]++;
        player.skillPoints--;
        player.maxHp = getMaxHp(player);
        player.maxMana = getMaxMana(player);
        if (stat === 'vit') player.hp = Math.min(player.hp + 12, player.maxHp);
        sendTo(player, { type: 'stats_update', stats: player.stats, skillPoints: player.skillPoints, hp: player.hp, maxHp: player.maxHp, mana: player.mana, maxMana: player.maxMana });
        break;
      }
      case 'chat': {
        if (!player || !data.message) return;
        broadcast(player.floor, { type: 'chat', id, name: player.name, message: String(data.message).slice(0, 120) });
        break;
      }
      case 'respawn': {
        if (!player || !player.isDead) return;
        if (Date.now() < player.respawnAt) return;
        player.isDead = false;
        player.hp = player.maxHp;
        player.mana = player.maxMana;
        player.x = 150;
        player.y = 400;
        broadcast(player.floor, { type: 'player_respawned', player: getPublicPlayer(player) });
        break;
      }
    }
  });

  ws.on('close', () => {
    const p = players.get(id);
    if (p) {
      console.log(`[-] ${p.name} left`);
      players.delete(id);
      broadcast(p.floor, { type: 'player_left', id });
    }
  });
});

function handleEnemyDeath(killer, enemy, floorState) {
  const leveled = addXp(killer, enemy.xp);
  const lootRoll = Math.random();
  let loot = null;
  if (lootRoll < 0.35) loot = { id: uuidv4(), name: 'Health Potion', type: 'consumable', effect: 'heal', value: 40 };
  else if (lootRoll < 0.5) loot = { id: uuidv4(), name: 'Mana Potion', type: 'consumable', effect: 'mana', value: 30 };
  if (loot) killer.inventory.push(loot);
  floorState.enemies.delete(enemy.id);
  broadcast(killer.floor, { type: 'enemy_died', enemyId: enemy.id, killerId: killer.id, xp: enemy.xp, loot });
  sendTo(killer, { type: 'stats_update', xp: killer.xp, xpToLevel: killer.xpToLevel, level: killer.level, skillPoints: killer.skillPoints, hp: killer.hp, maxHp: killer.maxHp, mana: killer.mana, maxMana: killer.maxMana, inventory: killer.inventory, leveled });
  if (enemy.isBoss) {
    floorState.bossAlive = false;
    const nextFloor = killer.floor + 1;
    if (FLOORS[nextFloor]) {
      killer.floor = nextFloor;
      killer.highestFloor = Math.max(killer.highestFloor, nextFloor);
      killer.x = 150;
      killer.y = 400;
      const nextState = floors.get(nextFloor);
      const enemies = nextState ? Array.from(nextState.enemies.values()).map(getPublicEnemy) : [];
      sendTo(killer, { type: 'floor_changed', floor: nextFloor, floorName: FLOORS[nextFloor].name, player: getPublicPlayer(killer), enemies });
      broadcast(killer.floor, { type: 'player_joined', player: getPublicPlayer(killer) }, killer.id);
      broadcast(killer.floor - 1, { type: 'player_left', id: killer.id });
    }
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [floorNum, floorState] of floors) {
    const playersOnFloor = Array.from(players.values()).filter(p => p.floor === floorNum && !p.isDead);
    for (const enemy of floorState.enemies.values()) {
      let nearest = null, nearestDist = Infinity;
      for (const p of playersOnFloor) {
        const d = Math.hypot(p.x - enemy.x, p.y - enemy.y);
        if (d < nearestDist) { nearestDist = d; nearest = p; }
      }
      if (nearest && nearestDist < 450) {
        const dx = nearest.x - enemy.x, dy = nearest.y - enemy.y;
        const dist = Math.hypot(dx, dy) || 1;
        const speed = enemy.speed / TICK_RATE;
        if (dist > enemy.size / 2 + 20) {
          enemy.x += (dx / dist) * speed;
          enemy.y += (dy / dist) * speed;
        }
        if (dist < enemy.size / 2 + 35 && now - enemy.lastAttack > 1200) {
          enemy.lastAttack = now;
          nearest.hp -= enemy.damage;
          if (nearest.hp <= 0) {
            nearest.hp = 0;
            nearest.isDead = true;
            nearest.respawnAt = now + 3000;
            broadcast(floorNum, { type: 'player_died', id: nearest.id });
          }
          sendTo(nearest, { type: 'stats_update', hp: nearest.hp, maxHp: nearest.maxHp });
          broadcast(floorNum, { type: 'enemy_attack', enemyId: enemy.id, targetId: nearest.id, damage: enemy.damage });
        }
      }
    }
    if (floorState.enemies.size > 0 && playersOnFloor.length > 0) {
      const enemyPositions = Array.from(floorState.enemies.values()).map(e => ({ id: e.id, x: e.x, y: e.y, hp: e.hp }));
      broadcast(floorNum, { type: 'enemies_update', enemies: enemyPositions });
    }
  }
  for (const p of players.values()) {
    if (!p.isDead && p.mana < p.maxMana) p.mana = Math.min(p.maxMana, p.mana + 0.15);
  }
}, 1000 / TICK_RATE);

server.listen(PORT, () => {
  console.log('=====================================');
  console.log('  Tower MMO Server running');
  console.log(`  http://localhost:${PORT}`);
  console.log('=====================================');
});
