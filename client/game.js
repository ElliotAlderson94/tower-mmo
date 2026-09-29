// TOWER MMO Client — polished + safe DOM
const CONFIG = {
  WIDTH: 1200,
  HEIGHT: 800,
  PLAYER_SPEED: 230
};

let socket = null;
let myId = null;
let myPlayer = null;
let gameScene = null;
let cursors = null;
let wasd = null;
let canMove = false;
let connecting = false;
let otherPlayers = {};
let enemies = {};
let floorWidth = 1200;
let floorHeight = 800;

const $ = (id) => document.getElementById(id);

function toast(msg) {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2200);
}

function addChat(name, msg) {
  const box = $('chat-messages');
  if (!box) return;
  const div = document.createElement('div');
  div.innerHTML = '<span class="name">' + escapeHtml(name) + ':</span> ' + escapeHtml(msg);
  box.appendChild(div);
  while (box.children.length > 50) box.removeChild(box.firstChild);
  box.scrollTop = box.scrollHeight;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function on(id, event, handler) {
  const el = $(id);
  if (!el) { console.warn('[UI] missing element #' + id); return; }
  el.addEventListener(event, handler);
}

function doLogin() {
  const userEl = $('login-user'), passEl = $('login-pass'), errEl = $('login-error'), btn = $('login-btn');
  if (!userEl || !passEl) return;
  const u = userEl.value.trim(), p = passEl.value;
  if (!u || !p) { if (errEl) errEl.textContent = 'Fill all fields'; return; }
  if (errEl) errEl.textContent = '';
  if (btn) btn.disabled = true;
  connectThen(() => {
    send({ type: 'login', username: u, password: p });
    setTimeout(() => { if (btn) btn.disabled = false; }, 1500);
  });
}

function doRegister() {
  const userEl = $('reg-user'), passEl = $('reg-pass'), pass2El = $('reg-pass2'), errEl = $('reg-error'), btn = $('register-btn');
  if (!userEl || !passEl || !pass2El) return;
  const u = userEl.value.trim(), p = passEl.value, p2 = pass2El.value;
  if (!u || !p) { if (errEl) errEl.textContent = 'Fill all fields'; return; }
  if (p !== p2) { if (errEl) errEl.textContent = 'Passwords do not match'; return; }
  if (u.length < 3) { if (errEl) errEl.textContent = 'Username too short (min 3)'; return; }
  if (p.length < 4) { if (errEl) errEl.textContent = 'Password too short (min 4)'; return; }
  if (errEl) errEl.textContent = '';
  if (btn) btn.disabled = true;
  connectThen(() => {
    send({ type: 'register', username: u, password: p });
    setTimeout(() => { if (btn) btn.disabled = false; }, 1500);
  });
}

function bindUI() {
  on('to-register', 'click', () => {
    const login = $('login-form'), reg = $('register-form');
    if (login) login.classList.add('hidden');
    if (reg) reg.classList.remove('hidden');
    const err = $('reg-error'); if (err) err.textContent = '';
  });
  on('to-login', 'click', () => {
    const login = $('login-form'), reg = $('register-form');
    if (reg) reg.classList.add('hidden');
    if (login) login.classList.remove('hidden');
    const err = $('login-error'); if (err) err.textContent = '';
  });
  on('login-btn', 'click', doLogin);
  on('register-btn', 'click', doRegister);
  on('login-pass', 'keydown', (e) => { if (e.key === 'Enter') doLogin(); });
  on('login-user', 'keydown', (e) => { if (e.key === 'Enter') { const p = $('login-pass'); if (p) p.focus(); } });
  on('reg-pass2', 'keydown', (e) => { if (e.key === 'Enter') doRegister(); });
  on('reg-pass', 'keydown', (e) => { if (e.key === 'Enter') doRegister(); });
  document.querySelectorAll('.side-btn').forEach((btn) => {
    btn.addEventListener('click', () => openPanel(btn.dataset.panel));
  });
  document.querySelectorAll('.panel-close').forEach((btn) => {
    btn.addEventListener('click', () => closePanel(btn.dataset.close));
  });
  document.querySelectorAll('.stat-plus').forEach((btn) => {
    btn.addEventListener('click', () => send({ type: 'allocate_stat', stat: btn.dataset.stat }));
  });
  on('respawn-btn', 'click', () => {
    send({ type: 'respawn' });
    const ds = $('death-screen'); if (ds) ds.classList.add('hidden');
  });
  on('chat-input', 'keydown', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      send({ type: 'chat', message: e.target.value.trim() });
      e.target.value = '';
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.querySelectorAll('.panel').forEach((p) => p.classList.add('hidden'));
  });
  console.log('[UI] bound');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindUI);
else bindUI();

function getWsUrl() {
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
  }
  return 'ws://127.0.0.1:3000';
}

function connectThen(cb) {
  if (socket && socket.readyState === WebSocket.OPEN) { cb(); return; }
  if (connecting && socket && socket.readyState === WebSocket.CONNECTING) {}
  else if (connecting) connecting = false;
  connecting = true;
  try {
    if (socket) try { socket.onopen = null; socket.onmessage = null; socket.onerror = null; socket.onclose = null; socket.close(); } catch (_) {}
    const url = getWsUrl();
    console.log('[WS] connecting to', url);
    socket = new WebSocket(url);
  } catch (err) {
    connecting = false;
    const msg = 'Connection failed: ' + (err && err.message ? err.message : 'unknown');
    if ($('login-error')) $('login-error').textContent = msg;
    if ($('reg-error')) $('reg-error').textContent = msg;
    return;
  }
  const timeout = setTimeout(() => {
    if (socket && socket.readyState !== WebSocket.OPEN) {
      connecting = false;
      try { socket.close(); } catch (_) {}
      const msg = 'Server not responding. Run: cd server && npm start';
      if ($('login-error')) $('login-error').textContent = msg;
      if ($('reg-error')) $('reg-error').textContent = msg;
    }
  }, 5000);
  socket.onopen = () => { clearTimeout(timeout); connecting = false; console.log('[WS] connected'); cb(); };
  socket.onmessage = (e) => { try { handleMessage(JSON.parse(e.data)); } catch (err) { console.error('[WS] bad message', err); } };
  socket.onclose = () => {
    clearTimeout(timeout); connecting = false; canMove = false; console.log('[WS] closed');
    if ($('auth-screen') && !$('auth-screen').classList.contains('hidden')) return;
    toast('Disconnected from server');
  };
  socket.onerror = () => {
    clearTimeout(timeout); connecting = false; console.error('[WS] error');
    const msg = 'Cannot reach server. Open http://localhost:3000 (not file://)';
    if ($('login-error')) $('login-error').textContent = msg;
    if ($('reg-error')) $('reg-error').textContent = msg;
  };
}

function openPanel(name) {
  document.querySelectorAll('.panel').forEach((p) => p.classList.add('hidden'));
  const el = $('panel-' + name); if (!el) return;
  el.classList.remove('hidden');
  if (name === 'inventory') renderInventory();
  if (name === 'stats') renderStats();
  if (name === 'profile') renderProfile();
}
function closePanel(name) { const el = $('panel-' + name); if (el) el.classList.add('hidden'); }
function renderInventory() {
  const grid = $('inv-grid'); if (!grid || !myPlayer) return;
  const items = myPlayer.inventory || []; let html = '';
  for (let i = 0; i < 20; i++) {
    const item = items[i];
    html += '<div class="inv-slot' + (item ? ' filled' : '') + '">' + (item ? escapeHtml(item.name) : '') + '</div>';
  }
  grid.innerHTML = html;
}
function renderStats() {
  if (!myPlayer) return;
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  set('stat-points', myPlayer.skillPoints || 0);
  set('stat-str', (myPlayer.stats && myPlayer.stats.str) || 5);
  set('stat-agi', (myPlayer.stats && myPlayer.stats.agi) || 5);
  set('stat-vit', (myPlayer.stats && myPlayer.stats.vit) || 5);
  const str = (myPlayer.stats && myPlayer.stats.str) || 5;
  set('stat-atk', 12 + str * 2 + Math.floor((myPlayer.level || 1) * 1.5));
  set('stat-maxhp', myPlayer.maxHp); set('stat-maxmp', myPlayer.maxMana);
}
function renderProfile() {
  if (!myPlayer) return;
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  set('profile-name', myPlayer.name || myPlayer.username || '—');
  set('profile-title', myPlayer.title || 'Novice Climber');
  set('profile-level', myPlayer.level || 1); set('profile-floor', myPlayer.highestFloor || 1);
  set('profile-gold', myPlayer.gold || 0); set('profile-kills', myPlayer.kills || 0);
  set('profile-bosses', myPlayer.bosses || 0); set('profile-deaths', myPlayer.deaths || 0);
}
function updateBars() {
  if (!myPlayer) return;
  const setW = (id, pct) => { const el = $(id); if (el) el.style.width = Math.max(0, Math.min(100, pct)) + '%'; };
  const setT = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  setW('hp-bar', myPlayer.maxHp ? (myPlayer.hp / myPlayer.maxHp) * 100 : 0);
  setW('mana-bar', myPlayer.maxMana ? (myPlayer.mana / myPlayer.maxMana) * 100 : 0);
  setW('xp-bar', myPlayer.xpToLevel ? (myPlayer.xp / myPlayer.xpToLevel) * 100 : 0);
  setT('player-level', 'Lv.' + (myPlayer.level || 1));
  setT('gold-amount', myPlayer.gold || 0);
  setT('player-name', myPlayer.name || myPlayer.username || '—');
}

function send(data) {
  if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(data));
}

function handleMessage(data) {
  switch (data.type) {
    case 'auth_error':
      if ($('login-error')) $('login-error').textContent = data.message || 'Error';
      if ($('reg-error')) $('reg-error').textContent = data.message || 'Error';
      break;
    case 'auth_ok':
      toast(data.message || 'OK');
      if ($('register-form')) $('register-form').classList.add('hidden');
      if ($('login-form')) $('login-form').classList.remove('hidden');
      if ($('login-error')) $('login-error').textContent = '';
      if ($('reg-error')) $('reg-error').textContent = '';
      if ($('reg-user') && $('login-user') && $('reg-user').value) $('login-user').value = $('reg-user').value;
      break;
    case 'welcome':
      myId = data.id; myPlayer = data.player;
      if ($('auth-screen')) $('auth-screen').classList.add('hidden');
      if ($('hud')) $('hud').classList.remove('hidden');
      if ($('floor-badge')) $('floor-badge').textContent = 'FLOOR ' + myPlayer.floor + ' — ' + String(data.floorName || '').toUpperCase();
      updateBars();
      if (gameScene) {
        clearEntities(); createLocalPlayer(gameScene, myPlayer);
        (data.others || []).forEach((p) => createRemotePlayer(gameScene, p));
        (data.enemies || []).forEach((e) => createEnemy(gameScene, e));
      }
      canMove = true; toast('Welcome, ' + (myPlayer.name || myPlayer.username));
      break;
    case 'player_joined':
      if (data.player && data.player.id !== myId && gameScene) {
        createRemotePlayer(gameScene, data.player);
        addChat('System', (data.player.name || 'Player') + ' entered');
      }
      break;
    case 'player_left':
      if (otherPlayers[data.id]) { otherPlayers[data.id].container.destroy(); delete otherPlayers[data.id]; }
      break;
    case 'player_moved':
      if (otherPlayers[data.id]) { otherPlayers[data.id].targetX = data.x; otherPlayers[data.id].targetY = data.y; }
      break;
    case 'player_attack':
      if (gameScene) showAttackEffect(data.x, data.y, data.direction);
      (data.hits || []).forEach((h) => showDamage(h.id, h.dmg));
      break;
    case 'skill_used':
      if (data.skill === 'shockwave') showShockwave(data.x, data.y);
      else showAttackEffect(data.x, data.y, 'right');
      (data.hits || []).forEach((h) => showDamage(h.id, h.dmg));
      break;
    case 'enemies_update':
      (data.enemies || []).forEach((e) => {
        if (enemies[e.id]) { enemies[e.id].targetX = e.x; enemies[e.id].targetY = e.y; enemies[e.id].hp = e.hp; updateEnemyHp(e.id); }
      });
      break;
    case 'enemy_died':
      if (enemies[data.enemyId]) { enemies[data.enemyId].container.destroy(); delete enemies[data.enemyId]; }
      if (data.killerId === myId) {
        if (data.xp) addChat('System', '+' + data.xp + ' XP');
        if (data.gold) addChat('System', '+' + data.gold + ' Gold');
        if (data.loot) { addChat('System', 'Loot: ' + data.loot.name); toast('Found ' + data.loot.name); }
      }
      break;
    case 'player_died':
      if (data.id === myId) {
        canMove = false;
        if ($('death-screen')) $('death-screen').classList.remove('hidden');
        if (gameScene && gameScene.localPlayer) gameScene.localPlayer.container.setAlpha(0.4);
      } else if (otherPlayers[data.id]) otherPlayers[data.id].container.setAlpha(0.4);
      break;
    case 'player_respawned':
      if (data.player && data.player.id === myId) {
        Object.assign(myPlayer, data.player); canMove = true;
        if ($('death-screen')) $('death-screen').classList.add('hidden');
        if (gameScene && gameScene.localPlayer) {
          gameScene.localPlayer.container.setAlpha(1);
          gameScene.localPlayer.container.x = data.player.x;
          gameScene.localPlayer.container.y = data.player.y;
        }
        updateBars();
      } else if (data.player && otherPlayers[data.player.id]) {
        otherPlayers[data.player.id].container.setAlpha(1);
        otherPlayers[data.player.id].targetX = data.player.x;
        otherPlayers[data.player.id].targetY = data.player.y;
      }
      break;
    case 'stats_update':
      if (!myPlayer) return;
      Object.assign(myPlayer, data); updateBars();
      if (data.leveled) {
        if ($('levelup-flash')) { $('levelup-flash').classList.add('show'); setTimeout(() => $('levelup-flash').classList.remove('show'), 800); }
        toast('LEVEL UP! Lv.' + myPlayer.level); addChat('System', 'LEVEL UP!');
      }
      if ($('panel-stats') && !$('panel-stats').classList.contains('hidden')) renderStats();
      if ($('panel-inventory') && !$('panel-inventory').classList.contains('hidden')) renderInventory();
      if ($('panel-profile') && !$('panel-profile').classList.contains('hidden')) renderProfile();
      break;
    case 'floor_changed':
      if (data.player) Object.assign(myPlayer, data.player);
      if ($('floor-badge')) $('floor-badge').textContent = 'FLOOR ' + data.floor + ' — ' + String(data.floorName || '').toUpperCase();
      floorWidth = data.floor >= 2 ? 1400 : 1200; floorHeight = data.floor >= 2 ? 900 : 800;
      clearEntities();
      if (gameScene) {
        gameScene.cameras.main.setBounds(0, 0, floorWidth, floorHeight);
        createLocalPlayer(gameScene, myPlayer);
        (data.enemies || []).forEach((e) => createEnemy(gameScene, e));
      }
      toast('Floor ' + data.floor + ': ' + data.floorName); addChat('System', 'Entered Floor ' + data.floor); updateBars();
      break;
    case 'chat': addChat(data.name, data.message); break;
    case 'saved': toast('Progress saved'); break;
    default: break;
  }
}

function clearEntities() {
  Object.keys(otherPlayers).forEach((id) => { try { otherPlayers[id].container.destroy(); } catch (_) {} });
  Object.keys(enemies).forEach((id) => { try { enemies[id].container.destroy(); } catch (_) {} });
  otherPlayers = {}; enemies = {};
  if (gameScene && gameScene.localPlayer) { try { gameScene.localPlayer.container.destroy(); } catch (_) {} gameScene.localPlayer = null; }
}

function createLocalPlayer(scene, data) {
  const c = scene.add.container(data.x, data.y);
  const color = Phaser.Display.Color.HexStringToColor(data.color || '#6688cc').color;
  const body = scene.add.rectangle(0, 0, 28, 40, color);
  const tag = scene.add.text(0, -36, data.name || data.username || 'You', { fontSize: '11px', color: '#ffffff', backgroundColor: '#000000aa', padding: { x: 3, y: 1 } }).setOrigin(0.5);
  c.add([body, tag]); c.setDepth(10);
  scene.localPlayer = { container: c, data };
  scene.cameras.main.startFollow(c, true, 0.12, 0.12);
  scene.cameras.main.setBounds(0, 0, floorWidth, floorHeight);
}
function createRemotePlayer(scene, data) {
  if (otherPlayers[data.id]) return;
  const c = scene.add.container(data.x, data.y);
  const color = Phaser.Display.Color.HexStringToColor(data.color || '#8866aa').color;
  const body = scene.add.rectangle(0, 0, 28, 40, color);
  const tag = scene.add.text(0, -36, data.name || 'Player', { fontSize: '11px', color: '#ccccff', backgroundColor: '#000000aa', padding: { x: 3, y: 1 } }).setOrigin(0.5);
  c.add([body, tag]); c.setDepth(5);
  if (data.isDead) c.setAlpha(0.4);
  otherPlayers[data.id] = { container: c, targetX: data.x, targetY: data.y };
}
function createEnemy(scene, data) {
  if (enemies[data.id]) return;
  const c = scene.add.container(data.x, data.y);
  const color = Phaser.Display.Color.HexStringToColor(data.color || '#cc4444').color;
  const body = scene.add.rectangle(0, 0, data.size, data.size, color);
  const tag = scene.add.text(0, -data.size / 2 - 12, data.name || 'Enemy', { fontSize: '10px', color: data.isBoss ? '#ff8888' : '#ffccaa', backgroundColor: '#00000099', padding: { x: 2, y: 1 } }).setOrigin(0.5);
  const barBg = scene.add.rectangle(0, -data.size / 2 - 3, data.size + 8, 5, 0x333333);
  const barFill = scene.add.rectangle(0, -data.size / 2 - 3, data.size + 8, 5, 0xcc3333);
  c.add([body, tag, barBg, barFill]); c.setDepth(4);
  enemies[data.id] = { container: c, barFill, targetX: data.x, targetY: data.y, hp: data.hp, maxHp: data.maxHp, size: data.size };
}
function updateEnemyHp(id) {
  const e = enemies[id]; if (!e || !e.maxHp) return;
  const r = Math.max(0, e.hp / e.maxHp);
  e.barFill.width = (e.size + 8) * r; e.barFill.x = -((e.size + 8) * (1 - r)) / 2;
}
function showDamage(id, dmg) {
  if (!gameScene || dmg == null) return;
  let x, y;
  if (enemies[id]) { x = enemies[id].container.x; y = enemies[id].container.y - 28; }
  else if (otherPlayers[id]) { x = otherPlayers[id].container.x; y = otherPlayers[id].container.y - 40; }
  else if (id === myId && gameScene.localPlayer) { x = gameScene.localPlayer.container.x; y = gameScene.localPlayer.container.y - 40; }
  else return;
  const t = gameScene.add.text(x, y, '-' + dmg, { fontSize: '14px', color: '#ff4444', fontStyle: 'bold' }).setOrigin(0.5).setDepth(20);
  gameScene.tweens.add({ targets: t, y: y - 35, alpha: 0, duration: 600, onComplete: () => t.destroy() });
}
function showAttackEffect(x, y, dir) {
  if (!gameScene) return;
  const o = dir === 'left' ? -40 : 40;
  const r = gameScene.add.rectangle(x + o, y, 48, 18, 0xffffff, 0.55).setDepth(15);
  gameScene.tweens.add({ targets: r, alpha: 0, scaleX: 1.3, duration: 180, onComplete: () => r.destroy() });
}
function showShockwave(x, y) {
  if (!gameScene) return;
  const c = gameScene.add.circle(x, y, 16, 0x6688ff, 0.35).setDepth(15);
  gameScene.tweens.add({ targets: c, radius: 150, alpha: 0, duration: 350, onComplete: () => c.destroy() });
}

class MainScene extends Phaser.Scene {
  constructor() { super('MainScene'); }
  create() {
    gameScene = this;
    this.add.rectangle(700, 450, 2000, 1600, 0x1a1810);
    const g = this.add.graphics();
    g.lineStyle(1, 0x2a2820, 0.4);
    for (let x = 0; x <= 1600; x += 40) g.lineBetween(x, 0, x, 1200);
    for (let y = 0; y <= 1200; y += 40) g.lineBetween(0, y, 1600, y);
    cursors = this.input.keyboard.createCursorKeys();
    wasd = this.input.keyboard.addKeys({ up: Phaser.Input.Keyboard.KeyCodes.W, down: Phaser.Input.Keyboard.KeyCodes.S, left: Phaser.Input.Keyboard.KeyCodes.A, right: Phaser.Input.Keyboard.KeyCodes.D });
    const isTyping = () => { const t = document.activeElement; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'); };
    this.input.keyboard.on('keydown-SPACE', () => { if (canMove && !isTyping()) send({ type: 'attack' }); });
    this.input.keyboard.on('keydown-Q', () => { if (canMove && !isTyping()) send({ type: 'skill', skill: 'slash' }); });
    this.input.keyboard.on('keydown-E', () => { if (canMove && !isTyping()) send({ type: 'skill', skill: 'dash' }); });
    this.input.keyboard.on('keydown-R', () => { if (canMove && !isTyping()) send({ type: 'skill', skill: 'shockwave' }); });
  }
  update(_, delta) {
    for (const id in otherPlayers) {
      const p = otherPlayers[id];
      p.container.x += (p.targetX - p.container.x) * 0.22;
      p.container.y += (p.targetY - p.container.y) * 0.22;
    }
    for (const id in enemies) {
      const e = enemies[id];
      e.container.x += (e.targetX - e.container.x) * 0.18;
      e.container.y += (e.targetY - e.container.y) * 0.18;
    }
    if (!canMove || !this.localPlayer) return;
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
    const speed = CONFIG.PLAYER_SPEED * (delta / 1000);
    let dx = 0, dy = 0, moved = false, dir = this.localPlayer.data.direction || 'right';
    if (cursors.left.isDown || wasd.left.isDown) { dx = -speed; dir = 'left'; moved = true; }
    else if (cursors.right.isDown || wasd.right.isDown) { dx = speed; dir = 'right'; moved = true; }
    if (cursors.up.isDown || wasd.up.isDown) { dy = -speed; moved = true; }
    else if (cursors.down.isDown || wasd.down.isDown) { dy = speed; moved = true; }
    if (moved) {
      const c = this.localPlayer.container;
      c.x = Phaser.Math.Clamp(c.x + dx, 30, floorWidth - 30);
      c.y = Phaser.Math.Clamp(c.y + dy, 30, floorHeight - 30);
      this.localPlayer.data.direction = dir;
      send({ type: 'move', x: c.x, y: c.y, direction: dir });
    }
  }
}

function getGameSize() { return { w: Math.max(640, window.innerWidth), h: Math.max(480, window.innerHeight) }; }
const _sz = getGameSize();
const game = new Phaser.Game({
  type: Phaser.AUTO, width: _sz.w, height: _sz.h, parent: 'game-container',
  backgroundColor: '#1a1810', scene: MainScene, banner: false,
  input: { keyboard: true, mouse: true },
  scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH }
});
window.addEventListener('resize', () => { if (game && game.scale) game.scale.resize(window.innerWidth, window.innerHeight); });
window.addEventListener('keydown', (e) => {
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA') e.stopPropagation();
}, true);
