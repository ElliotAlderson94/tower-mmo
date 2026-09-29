// TOWER MMO Client v6 core — UI, auth, chat, panels
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
  clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('show'), 2800);
}
function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function addChat(name, msg) {
  const box = $('chat-messages'); if (!box) return;
  const div = document.createElement('div');
  div.innerHTML = '<span class="name">' + escapeHtml(name) + ':</span> ' + escapeHtml(msg);
  box.appendChild(div);
  while (box.children.length > 80) box.removeChild(box.firstChild);
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
  const el = $('panel-' + name);
  if (!el) { console.warn('[UI] no panel', name); return; }
  el.classList.remove('hidden');
  if (name === 'inventory') renderInventory();
  if (name === 'stats') renderStats();
  if (name === 'profile') renderProfile();
  if (name === 'shop') renderShop();
  if (name === 'leaderboard') send({ type: 'leaderboard' });
  if (name === 'search') { const r = $('search-results'); if (r) r.innerHTML = ''; }
  if (name === 'trade') { const s = $('trade-status'); if (s) s.textContent = ''; }
}
function closePanel(name) { const el = $('panel-' + name); if (el) el.classList.add('hidden'); }
function sendChat() {
  const input = $('chat-input');
  if (!input) return;
  const msg = (input.value || '').trim();
  if (!msg) return;
  if (!socket || socket.readyState !== WebSocket.OPEN) { toast('Not connected'); return; }
  send({ type: 'chat', message: msg });
  input.value = '';
  input.focus();
}
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
  on('login-pass', 'keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doLogin(); } });
  on('reg-pass2', 'keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doRegister(); } });
  on('open-tos', 'click', (e) => { e.preventDefault(); openModal('modal-tos'); });
  on('open-privacy', 'click', (e) => { e.preventDefault(); openModal('modal-privacy'); });
  on('close-tos', 'click', () => closeModal('modal-tos'));
  on('close-privacy', 'click', () => closeModal('modal-privacy'));
  ['modal-tos', 'modal-privacy'].forEach((id) => {
    const m = $(id); if (m) m.addEventListener('click', (e) => { if (e.target === m) closeModal(id); });
  });
  ['inventory','stats','profile','quests','shop','leaderboard','search','trade','other'].forEach((name) => {
    on('close-' + name, 'click', (e) => { e.preventDefault(); e.stopPropagation(); closePanel(name); });
  });
  const side = $('side-btns');
  if (side) {
    side.addEventListener('click', (e) => {
      const btn = e.target.closest('.menu-btn, .nav-btn, .side-btn');
      if (!btn) return;
      e.preventDefault(); e.stopPropagation();
      const panel = btn.getAttribute('data-panel');
      if (panel) openPanel(panel);
    });
  }
  document.querySelectorAll('.stat-plus').forEach((b) => {
    b.addEventListener('click', (e) => { e.stopPropagation(); send({ type: 'allocate_stat', stat: b.dataset.stat }); });
  });
  on('respawn-btn', 'click', (e) => {
    e.preventDefault();
    send({ type: 'respawn' });
    canMove = true;
    if ($('death-screen')) $('death-screen').classList.add('hidden');
    if (myPlayer) { myPlayer.isDead = false; if (myPlayer.maxHp) myPlayer.hp = myPlayer.maxHp; updateBars(); }
    if (gameScene && gameScene.localPlayer) gameScene.localPlayer.container.setAlpha(1);
  });
  on('chat-input', 'keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); sendChat(); } });
  on('chat-input', 'keyup', (e) => e.stopPropagation());
  on('chat-input', 'keypress', (e) => e.stopPropagation());
  on('chat-send', 'click', (e) => { e.preventDefault(); e.stopPropagation(); sendChat(); });
  on('chat-toggle', 'click', (e) => { e.stopPropagation(); const box = $('chat-box'); if (box) box.classList.toggle('collapsed'); });
  on('search-btn', 'click', () => {
    const q = (($('search-input') || {}).value || '').trim();
    if (q.length < 1) { toast('Enter a name'); return; }
    send({ type: 'search_player', query: q });
  });
  on('search-input', 'keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); const q = e.target.value.trim(); if (q) send({ type: 'search_player', query: q }); }
  });
  on('trade-send', 'click', () => {
    const target = (($('trade-target') || {}).value || '').trim();
    const gold = parseInt(($('trade-gold') || {}).value, 10) || 0;
    if (!target || gold < 1) { toast('Enter player + gold amount'); return; }
    send({ type: 'trade_offer', target, gold });
    const st = $('trade-status'); if (st) st.textContent = 'Offer sent to ' + target + '...';
  });
  on('other-trade-btn', 'click', () => {
    const name = ($('other-name') || {}).textContent || '';
    if ($('trade-target')) $('trade-target').value = name;
    closePanel('other'); openPanel('trade');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.panel').forEach((p) => p.classList.add('hidden'));
      closeModal('modal-tos'); closeModal('modal-privacy');
    }
  });
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) e.stopPropagation();
  }, true);
  setInterval(updateSkillCdUi, 100);
  console.log('[UI] v6 bound — chat + menus ready');
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindUI);
else bindUI();
function updateSkillCdUi() {
  document.querySelectorAll('.skill-slot[data-skill], .skill[data-skill]').forEach((slot) => {
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
      const msg = 'Server offline — run: npm start';
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
    const msg = 'Cannot reach server';
    if ($('login-error')) $('login-error').textContent = msg;
    if ($('reg-error')) $('reg-error').textContent = msg;
  };
}
function send(data) {
  if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(data));
  else console.warn('[send] not connected', data && data.type);
}
function renderInventory() {
  const grid = $('inv-grid'); if (!grid || !myPlayer) return;
  const items = myPlayer.inventory || [];
  let html = '';
  for (let i = 0; i < 24; i++) {
    const item = items[i];
    if (item) html += '<div class="inv-slot filled" data-id="' + escapeHtml(item.id || '') + '" data-type="' + escapeHtml(item.type || '') + '">' + escapeHtml(item.name) + '</div>';
    else html += '<div class="inv-slot"></div>';
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
  if ($('inv-slots')) $('inv-slots').textContent = items.length + '/24';
  if ($('inv-gold')) $('inv-gold').textContent = myPlayer.gold || 0;
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
  box.innerHTML = items.map((it) => '<div class="shop-row"><span>' + it.name + '</span><button type="button" class="btn-blue sm" data-buy="' + it.id + '">' + it.price + ' ◆</button></div>').join('');
  box.querySelectorAll('[data-buy]').forEach((b) => { b.onclick = () => send({ type: 'buy', item: b.dataset.buy }); });
}
function renderLeaderboard(rows) {
  const box = $('lb-list'); if (!box) return;
  if (!rows.length) { box.innerHTML = '<p class="muted">No climbers yet</p>'; return; }
  box.innerHTML = rows.map((r, i) => '<div class="lb-row"><span class="rank">#' + (i + 1) + '</span><span>' + escapeHtml(r.name) + '</span><span>F' + r.floor + ' · Lv' + r.level + '</span></div>').join('');
}
function renderSearchResults(rows) {
  const box = $('search-results'); if (!box) return;
  if (!rows || !rows.length) { box.innerHTML = '<p class="muted">No players found</p>'; return; }
  box.innerHTML = rows.map((r) => '<div class="result-row"><span><b>' + escapeHtml(r.name) + '</b> · Lv' + r.level + ' · F' + r.floor + '</span><button type="button" class="btn-blue sm" data-view="' + escapeHtml(r.name) + '">VIEW</button></div>').join('');
  box.querySelectorAll('[data-view]').forEach((b) => { b.onclick = () => send({ type: 'view_profile', username: b.dataset.view }); });
}
function showOtherProfile(p) {
  if (!p) return;
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  set('other-name', p.name || p.username);
  set('other-title', p.title || 'Climber');
  set('other-level', p.level || 1);
  set('other-floor', p.highestFloor || 0);
  set('other-kills', p.kills || 0);
  set('other-bosses', p.bosses || 0);
  openPanel('other');
}
function updateBars() {
  if (!myPlayer) return;
  const setW = (id, pct) => { const el = $(id); if (el) el.style.width = Math.max(0, Math.min(100, pct)) + '%'; };
  const setT = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  const hpPct = myPlayer.maxHp ? (myPlayer.hp / myPlayer.maxHp) : 0;
  setW('hp-bar', hpPct * 100);
  setW('mana-bar', myPlayer.maxMana ? (myPlayer.mana / myPlayer.maxMana) * 100 : 0);
  setW('xp-bar', myPlayer.xpToLevel ? (myPlayer.xp / myPlayer.xpToLevel) * 100 : 0);
  setT('player-level', myPlayer.level || 1);
  setT('gold-amount', myPlayer.gold || 0);
  setT('player-name', myPlayer.name || myPlayer.username || '—');
  const orb = $('orb-hp');
  if (orb) {
    const circ = 2 * Math.PI * 26;
    orb.style.strokeDasharray = String(circ);
    orb.style.strokeDashoffset = String(circ * (1 - hpPct));
  }
}
