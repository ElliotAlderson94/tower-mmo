// TOWER MMO Client v4 UI + net + entities
const CONFIG = { PLAYER_SPEED: 200 };
let socket = null, myId = null, myPlayer = null, gameScene = null;
let cursors = null, wasd = null, canMove = false, connecting = false;
let otherPlayers = {}, enemies = {}, npcs = {};
let floorWidth = 1600, floorHeight = 1200, currentFloor = 0;
let lastMoveSend = 0;
const skillCd = { slash: 0, dash: 0, shockwave: 0 };
const SKILL_CD_MS = { slash: 800, dash: 3000, shockwave: 6000 };
const $ = (id) => document.getElementById(id);
function toast(msg) {
  const el = $('toast'); if (!el) return;
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('show'), 2500);
}
function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function addChat(name, msg) {
  const box = $('chat-messages'); if (!box) return;
  const div = document.createElement('div');
  div.innerHTML = '<span class="name">' + escapeHtml(name) + ':</span> ' + escapeHtml(msg);
  box.appendChild(div);
  while (box.children.length > 50) box.removeChild(box.firstChild);
  box.scrollTop = box.scrollHeight;
}
function on(id, ev, fn) {
  const el = $(id);
  if (!el) { console.warn('[UI] missing #' + id); return; }
  el.addEventListener(ev, fn);
}
function openModal(id) { const m = $(id); if (m) m.classList.remove('hidden'); }
function closeModal(id) { const m = $(id); if (m) m.classList.add('hidden'); }
function openPanel(name) {
  document.querySelectorAll('.panel').forEach((p) => p.classList.add('hidden'));
  const el = $('panel-' + name); if (!el) return;
  el.classList.remove('hidden');
  if (name === 'inventory') renderInventory();
  if (name === 'stats') renderStats();
  if (name === 'profile') renderProfile();
  if (name === 'shop') renderShop();
  if (name === 'leaderboard') send({ type: 'leaderboard' });
}
function closePanel(name) { const el = $('panel-' + name); if (el) el.classList.add('hidden'); }
function doLogin() {
  const u = (($('login-user') || {}).value || '').trim();
  const p = ($('login-pass') || {}).value || '';
  if (!u || !p) { if ($('login-error')) $('login-error').textContent = 'Fill all fields'; return; }
  if ($('login-error')) $('login-error').textContent = '';
  const btn = $('login-btn'); if (btn) btn.disabled = true;
  connectThen(() => { send({ type: 'login', username: u, password: p }); setTimeout(() => { if (btn) btn.disabled = false; }, 2000); });
}
function doRegister() {
  const u = (($('reg-user') || {}).value || '').trim();
  const p = ($('reg-pass') || {}).value || '';
  const p2 = ($('reg-pass2') || {}).value || '';
  const err = $('reg-error');
  if (!u || !p) { if (err) err.textContent = 'Fill all fields'; return; }
  if (p !== p2) { if (err) err.textContent = 'Passwords do not match'; return; }
  if (u.length < 3) { if (err) err.textContent = 'Username min 3'; return; }
  if (p.length < 4) { if (err) err.textContent = 'Password min 4'; return; }
  if (err) err.textContent = '';
  const btn = $('register-btn'); if (btn) btn.disabled = true;
  connectThen(() => { send({ type: 'register', username: u, password: p }); setTimeout(() => { if (btn) btn.disabled = false; }, 2000); });
}
function bindUI() {
  on('to-register', 'click', () => { $('login-form').classList.add('hidden'); $('register-form').classList.remove('hidden'); });
  on('to-login', 'click', () => { $('register-form').classList.add('hidden'); $('login-form').classList.remove('hidden'); });
  on('login-btn', 'click', doLogin);
  on('register-btn', 'click', doRegister);
  on('login-pass', 'keydown', (e) => { if (e.key === 'Enter') doLogin(); });
  on('reg-pass2', 'keydown', (e) => { if (e.key === 'Enter') doRegister(); });
  on('open-tos', 'click', (e) => { e.preventDefault(); e.stopPropagation(); openModal('modal-tos'); });
  on('open-privacy', 'click', (e) => { e.preventDefault(); e.stopPropagation(); openModal('modal-privacy'); });
  on('close-tos', 'click', (e) => { e.stopPropagation(); closeModal('modal-tos'); });
  on('close-privacy', 'click', (e) => { e.stopPropagation(); closeModal('modal-privacy'); });
  ['modal-tos', 'modal-privacy'].forEach((id) => {
    const m = $(id); if (m) m.addEventListener('click', (e) => { if (e.target === m) closeModal(id); });
  });
  ['inventory','stats','profile','quests','shop','leaderboard'].forEach((name) => {
    on('close-' + name, 'click', (e) => { e.preventDefault(); e.stopPropagation(); closePanel(name); });
  });
  document.querySelectorAll('.side-btn').forEach((b) => {
    b.addEventListener('click', (e) => { e.stopPropagation(); openPanel(b.dataset.panel); });
  });
  document.querySelectorAll('.stat-plus').forEach((b) => {
    b.addEventListener('click', () => send({ type: 'allocate_stat', stat: b.dataset.stat }));
  });
  on('respawn-btn', 'click', (e) => {
    e.preventDefault(); e.stopPropagation();
    send({ type: 'respawn' });
    canMove = true;
    if ($('death-screen')) $('death-screen').classList.add('hidden');
    if (myPlayer) { myPlayer.isDead = false; if (myPlayer.maxHp) myPlayer.hp = myPlayer.maxHp; updateBars(); }
    if (gameScene && gameScene.localPlayer) gameScene.localPlayer.container.setAlpha(1);
  });
  on('chat-input', 'keydown', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      send({ type: 'chat', message: e.target.value.trim() }); e.target.value = '';
    }
  });
  on('chat-toggle', 'click', (e) => {
    e.stopPropagation();
    const box = $('chat-box'); const btn = $('chat-toggle');
    if (!box || !btn) return;
    const closed = box.classList.toggle('collapsed');
    btn.textContent = closed ? 'CHAT ▸' : 'CHAT ▾';
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.panel').forEach((p) => p.classList.add('hidden'));
      closeModal('modal-tos'); closeModal('modal-privacy');
    }
  });
  setInterval(updateSkillCdUi, 100);
  console.log('[UI] bound v4');
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindUI);
else bindUI();
function updateSkillCdUi() {
  document.querySelectorAll('.skill-slot[data-skill]').forEach((slot) => {
    const sk = slot.dataset.skill;
    const left = (skillCd[sk] || 0) - Date.now();
    let cdEl = slot.querySelector('.cd');
    if (left > 0) {
      slot.classList.add('cooling');
      if (!cdEl) { cdEl = document.createElement('div'); cdEl.className = 'cd'; slot.appendChild(cdEl); }
      cdEl.textContent = (left / 1000).toFixed(1);
    } else {
      slot.classList.remove('cooling');
      if (cdEl) cdEl.remove();
    }
  });
}
function getWsUrl() {
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
  }
  return 'ws://127.0.0.1:3000';
}
function connectThen(cb) {
  if (socket && socket.readyState === WebSocket.OPEN) { cb(); return; }
  connecting = true;
  try {
    if (socket) try { socket.close(); } catch (_) {}
    socket = new WebSocket(getWsUrl());
  } catch (err) {
    connecting = false;
    if ($('login-error')) $('login-error').textContent = 'Connection failed';
    return;
  }
  const t = setTimeout(() => {
    if (socket && socket.readyState !== WebSocket.OPEN) {
      connecting = false;
      const msg = 'Server not responding. Run: cd server && npm start';
      if ($('login-error')) $('login-error').textContent = msg;
      if ($('reg-error')) $('reg-error').textContent = msg;
    }
  }, 5000);
  socket.onopen = () => { clearTimeout(t); connecting = false; cb(); };
  socket.onmessage = (e) => { try { handleMessage(JSON.parse(e.data)); } catch (_) {} };
  socket.onclose = () => {
    clearTimeout(t); connecting = false; canMove = false;
    if ($('auth-screen') && !$('auth-screen').classList.contains('hidden')) return;
    toast('Disconnected');
  };
  socket.onerror = () => {
    clearTimeout(t); connecting = false;
    const msg = 'Cannot reach server. Open http://localhost:3000';
    if ($('login-error')) $('login-error').textContent = msg;
    if ($('reg-error')) $('reg-error').textContent = msg;
  };
}
function send(data) {
  if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(data));
}
function renderInventory() {
  const grid = $('inv-grid'); if (!grid || !myPlayer) return;
  const items = myPlayer.inventory || [];
  let html = '';
  for (let i = 0; i < 24; i++) {
    const item = items[i];
    if (item) {
      html += '<div class="inv-slot filled" data-id="' + escapeHtml(item.id || '') +
        '" data-type="' + escapeHtml(item.type || '') + '">' + escapeHtml(item.name) + '</div>';
    } else html += '<div class="inv-slot"></div>';
  }
  grid.innerHTML = html;
  grid.querySelectorAll('.inv-slot.filled').forEach((slot) => {
    slot.onclick = () => {
      const id = slot.dataset.id, type = slot.dataset.type;
      if (type === 'consumable') send({ type: 'use_item', itemId: id });
      else if (type === 'weapon' || type === 'armor' || type === 'accessory') send({ type: 'equip_item', itemId: id });
    };
  });
  const eq = myPlayer.equipment || {};
  ['weapon','armor','accessory'].forEach((s) => {
    const el = document.querySelector('.equip-slot[data-slot="' + s + '"]');
    if (!el) return;
    if (eq[s]) { el.textContent = eq[s].name; el.classList.add('filled'); }
    else { el.textContent = s.slice(0, 3).toUpperCase(); el.classList.remove('filled'); }
  });
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
  set('profile-title', myPlayer.title || 'Townsfolk');
  set('profile-level', myPlayer.level || 1);
  set('profile-floor', myPlayer.highestFloor || 0);
  set('profile-gold', myPlayer.gold || 0);
  set('profile-kills', myPlayer.kills || 0);
  set('profile-bosses', myPlayer.bosses || 0);
  set('profile-deaths', myPlayer.deaths || 0);
}
function renderShop() {
  const box = $('shop-list'); if (!box) return;
  const items = [
    { id: 'potion_hp', name: 'Health Potion', price: 50 },
    { id: 'potion_mp', name: 'Mana Potion', price: 40 },
    { id: 'sword', name: 'Iron Sword +8', price: 120 },
    { id: 'armor', name: 'Leather Armor +30HP', price: 100 },
    { id: 'ring', name: 'Agility Ring', price: 80 }
  ];
  box.innerHTML = items.map((it) =>
    '<div class="shop-row"><span>' + it.name + '</span><button type="button" data-buy="' + it.id + '">' + it.price + 'G</button></div>'
  ).join('');
  box.querySelectorAll('[data-buy]').forEach((b) => { b.onclick = () => send({ type: 'buy', item: b.dataset.buy }); });
}
function renderLeaderboard(rows) {
  const box = $('lb-list'); if (!box) return;
  if (!rows.length) { box.innerHTML = '<p class="hint-text">No climbers yet</p>'; return; }
  box.innerHTML = rows.map((r, i) =>
    '<div class="lb-row"><span class="rank">#' + (i + 1) + '</span><span>' +
    escapeHtml(r.name) + '</span><span>F' + r.floor + ' · Lv' + r.level + '</span></div>'
  ).join('');
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
      if ($('reg-user') && $('login-user') && $('reg-user').value) $('login-user').value = $('reg-user').value;
      break;
    case 'welcome':
      myId = data.id; myPlayer = data.player;
      currentFloor = myPlayer.floor || 0;
      floorWidth = data.mapW || 1600; floorHeight = data.mapH || 1200;
      if ($('auth-screen')) $('auth-screen').classList.add('hidden');
      if ($('hud')) $('hud').classList.remove('hidden');
      if ($('floor-badge')) $('floor-badge').textContent = (data.floorName || 'TOWN').toUpperCase();
      updateBars();
      if (gameScene) {
        try {
          gameScene.rebuildWorld(currentFloor);
          clearEntities();
          createLocalPlayer(gameScene, myPlayer);
          (data.others || []).forEach((p) => createRemotePlayer(gameScene, p));
          (data.enemies || []).forEach((e) => createEnemy(gameScene, e));
          (data.npcs || []).forEach((n) => createNpc(gameScene, n));
        } catch (err) { console.error(err); }
      }
      canMove = true;
      toast('Welcome to ' + (data.floorName || 'Town'));
      break;
    case 'player_joined':
      if (data.player && data.player.id !== myId && gameScene) createRemotePlayer(gameScene, data.player);
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
        if (enemies[e.id]) {
          enemies[e.id].targetX = e.x; enemies[e.id].targetY = e.y; enemies[e.id].hp = e.hp;
          updateEnemyHp(e.id);
        }
      });
      break;
    case 'enemy_died':
      if (enemies[data.enemyId]) { enemies[data.enemyId].container.destroy(); delete enemies[data.enemyId]; }
      if (data.killerId === myId) {
        if (data.xp) addChat('System', '+' + data.xp + ' XP');
        if (data.gold) addChat('System', '+' + data.gold + 'G');
        if (data.loot) toast('Loot: ' + data.loot.name);
      }
      break;
    case 'player_died':
      if (data.id === myId) {
        canMove = false;
        if (myPlayer) myPlayer.isDead = true;
        if ($('death-screen')) $('death-screen').classList.remove('hidden');
        if (gameScene && gameScene.localPlayer) gameScene.localPlayer.container.setAlpha(0.4);
      }
      break;
    case 'player_respawned':
      if (data.player && data.player.id === myId) {
        Object.assign(myPlayer, data.player);
        myPlayer.isDead = false; canMove = true;
        if ($('death-screen')) $('death-screen').classList.add('hidden');
        if (gameScene && gameScene.localPlayer) {
          gameScene.localPlayer.container.setAlpha(1);
          gameScene.localPlayer.container.x = data.player.x;
          gameScene.localPlayer.container.y = data.player.y;
        }
        updateBars(); toast('Respawned');
      }
      break;
    case 'stats_update':
      if (!myPlayer) return;
      Object.assign(myPlayer, data); updateBars();
      if (data.leveled) toast('LEVEL UP! Lv.' + myPlayer.level);
      if ($('panel-stats') && !$('panel-stats').classList.contains('hidden')) renderStats();
      if ($('panel-inventory') && !$('panel-inventory').classList.contains('hidden')) renderInventory();
      break;
    case 'floor_changed':
      if (data.player) Object.assign(myPlayer, data.player);
      currentFloor = data.floor;
      floorWidth = data.mapW || 1400; floorHeight = data.mapH || 900;
      if ($('floor-badge')) $('floor-badge').textContent = (data.floorName || ('Floor ' + data.floor)).toUpperCase();
      clearEntities();
      if (gameScene) {
        gameScene.rebuildWorld(currentFloor);
        createLocalPlayer(gameScene, myPlayer || data.player);
        (data.enemies || []).forEach((e) => createEnemy(gameScene, e));
        (data.npcs || []).forEach((n) => createNpc(gameScene, n));
      }
      toast(data.floorName || ('Floor ' + data.floor)); updateBars();
      break;
    case 'chat': addChat(data.name, data.message); break;
    case 'toast': toast(data.message || ''); break;
    case 'npc_say':
      addChat(data.name || 'NPC', data.message || '');
      toast((data.name || 'NPC') + ': ' + (data.message || ''));
      break;
    case 'leaderboard': renderLeaderboard(data.rows || []); break;
    default: break;
  }
}
function clearEntities() {
  Object.keys(otherPlayers).forEach((id) => { try { otherPlayers[id].container.destroy(); } catch (_) {} });
  Object.keys(enemies).forEach((id) => { try { enemies[id].container.destroy(); } catch (_) {} });
  Object.keys(npcs).forEach((id) => { try { npcs[id].container.destroy(); } catch (_) {} });
  otherPlayers = {}; enemies = {}; npcs = {};
  if (gameScene && gameScene.localPlayer) {
    try { gameScene.localPlayer.container.destroy(); } catch (_) {}
    gameScene.localPlayer = null;
  }
}
function ensureHeroTexture(scene) {
  if (scene.textures.exists('hero')) return;
  const w = 32, h = 40;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const P = (x, y, c, bw, bh) => { ctx.fillStyle = c; ctx.fillRect(x, y, bw || 1, bh || 1); };
  P(6, 12, '#3d2a5c', 20, 20); P(4, 14, '#2a1a44', 4, 16); P(24, 14, '#2a1a44', 4, 16);
  P(8, 30, '#3d2a5c', 6, 6); P(18, 30, '#3d2a5c', 6, 6);
  P(10, 16, '#5c4a32', 12, 14); P(11, 18, '#6b5638', 10, 10);
  P(10, 26, '#2a1a10', 12, 3); P(14, 26, '#c9a227', 4, 3);
  P(8, 4, '#2a1a44', 16, 12); P(7, 6, '#3d2a5c', 18, 8);
  P(11, 10, '#e8c090', 10, 8); P(12, 11, '#f0d0a0', 8, 6);
  P(13, 13, '#1a1008', 2, 2); P(18, 13, '#1a1008', 2, 2);
  P(13, 13, '#c9a227', 1, 1); P(18, 13, '#c9a227', 1, 1);
  P(10, 9, '#3a2818', 3, 3); P(19, 9, '#3a2818', 3, 3);
  P(15, 17, '#a03030', 2, 2);
  P(7, 18, '#5c4a32', 3, 8); P(22, 18, '#5c4a32', 3, 8);
  P(7, 25, '#2a1a10', 3, 3); P(22, 25, '#2a1a10', 3, 3);
  P(11, 30, '#2a1a10', 4, 8); P(17, 30, '#2a1a10', 4, 8);
  P(10, 36, '#1a1008', 5, 3); P(17, 36, '#1a1008', 5, 3);
  P(3, 14, '#a8b8c8', 2, 18); P(2, 12, '#c9a227', 4, 3); P(3, 32, '#8a9aa8', 2, 2);
  P(26, 10, '#6b5638', 2, 16); P(25, 10, '#8a7020', 1, 2); P(25, 24, '#8a7020', 1, 2);
  P(24, 14, '#5c3a1a', 4, 10); P(25, 12, '#c9a227', 2, 2);
  scene.textures.addCanvas('hero', canvas);
}
function createLocalPlayer(scene, data) {
  if (!scene || !data) return;
  ensureHeroTexture(scene);
  const c = scene.add.container(data.x, data.y);
  const spr = scene.add.image(0, 0, 'hero').setScale(2).setOrigin(0.5, 0.85);
  const tag = scene.add.text(0, -36, data.name || data.username || 'You', {
    fontSize: '10px', color: '#ffe8a0', backgroundColor: '#000000cc', padding: { x: 3, y: 1 }
  }).setOrigin(0.5);
  c.add([spr, tag]); c.setDepth(10);
  scene.localPlayer = { container: c, data, spr };
  scene.cameras.main.startFollow(c, true, 0.1, 0.1);
  scene.cameras.main.setBounds(0, 0, floorWidth, floorHeight);
}
function createRemotePlayer(scene, data) {
  if (!scene || otherPlayers[data.id]) return;
  ensureHeroTexture(scene);
  const c = scene.add.container(data.x, data.y);
  const spr = scene.add.image(0, 0, 'hero').setScale(2).setOrigin(0.5, 0.85).setTint(0xccbbee);
  const tag = scene.add.text(0, -36, data.name || 'Player', {
    fontSize: '10px', color: '#c0d0ff', backgroundColor: '#000000cc', padding: { x: 3, y: 1 }
  }).setOrigin(0.5);
  c.add([spr, tag]); c.setDepth(5);
  otherPlayers[data.id] = { container: c, targetX: data.x, targetY: data.y };
}
function createEnemy(scene, data) {
  if (!scene || enemies[data.id]) return;
  const c = scene.add.container(data.x, data.y);
  const col = Phaser.Display.Color.HexStringToColor(data.color || '#cc4444').color;
  c.add(scene.add.rectangle(0, 0, data.size || 24, data.size || 24, col));
  c.add(scene.add.rectangle(-4, -4, 3, 3, 0xffffff));
  c.add(scene.add.rectangle(4, -4, 3, 3, 0xffffff));
  c.add(scene.add.text(0, -(data.size || 24) / 2 - 12, data.name || 'Enemy', {
    fontSize: '9px', color: data.isBoss ? '#ff8888' : '#ffccaa', backgroundColor: '#00000099', padding: { x: 2, y: 1 }
  }).setOrigin(0.5));
  const barBg = scene.add.rectangle(0, -(data.size || 24) / 2 - 2, (data.size || 24) + 8, 4, 0x333333);
  const barFill = scene.add.rectangle(0, -(data.size || 24) / 2 - 2, (data.size || 24) + 8, 4, 0xcc3333);
  c.add([barBg, barFill]); c.setDepth(4);
  enemies[data.id] = { container: c, barFill, targetX: data.x, targetY: data.y, hp: data.hp, maxHp: data.maxHp, size: data.size || 24 };
}
function createNpc(scene, data) {
  if (!scene || npcs[data.id]) return;
  const c = scene.add.container(data.x, data.y);
  c.add(scene.add.ellipse(0, 6, 18, 24, 0x4a6a3a));
  c.add(scene.add.circle(0, -6, 7, 0xe8c090));
  c.add(scene.add.rectangle(-3, -7, 2, 2, 0x1a1008));
  c.add(scene.add.rectangle(3, -7, 2, 2, 0x1a1008));
  c.add(scene.add.text(0, -22, data.name || 'NPC', {
    fontSize: '9px', color: '#a0ffc0', backgroundColor: '#000000aa', padding: { x: 2, y: 1 }
  }).setOrigin(0.5));
  c.setDepth(6);
  c.setInteractive(new Phaser.Geom.Rectangle(-20, -30, 40, 50), Phaser.Geom.Rectangle.Contains);
  c.on('pointerdown', () => send({ type: 'talk_npc', npcId: data.id }));
  npcs[data.id] = { container: c, data };
}
function updateEnemyHp(id) {
  const e = enemies[id]; if (!e || !e.maxHp) return;
  const r = Math.max(0, e.hp / e.maxHp);
  e.barFill.width = (e.size + 8) * r;
  e.barFill.x = -((e.size + 8) * (1 - r)) / 2;
}
function showDamage(id, dmg) {
  if (!gameScene || dmg == null) return;
  let x, y;
  if (enemies[id]) { x = enemies[id].container.x; y = enemies[id].container.y - 28; }
  else if (otherPlayers[id]) { x = otherPlayers[id].container.x; y = otherPlayers[id].container.y - 40; }
  else if (id === myId && gameScene.localPlayer) { x = gameScene.localPlayer.container.x; y = gameScene.localPlayer.container.y - 40; }
  else return;
  const t = gameScene.add.text(x, y, '-' + dmg, { fontSize: '14px', color: '#ff4444', fontStyle: 'bold' }).setOrigin(0.5).setDepth(20);
  gameScene.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: 500, onComplete: () => t.destroy() });
}
function showAttackEffect(x, y, dir) {
  if (!gameScene) return;
  const o = dir === 'left' ? -36 : 36;
  const r = gameScene.add.rectangle(x + o, y, 40, 14, 0xffffff, 0.5).setDepth(15);
  gameScene.tweens.add({ targets: r, alpha: 0, duration: 160, onComplete: () => r.destroy() });
}
function showShockwave(x, y) {
  if (!gameScene) return;
  const c = gameScene.add.circle(x, y, 12, 0x6688ff, 0.35).setDepth(15);
  gameScene.tweens.add({ targets: c, radius: 140, alpha: 0, duration: 300, onComplete: () => c.destroy() });
}
