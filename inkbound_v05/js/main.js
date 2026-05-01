import { loadAll, getStore } from './data/dataStore.js';
import { loadFromSheets, getSavedUrl, saveUrl } from './data/sheetsLoader.js';
import { openShop, openSoulShop } from './ui/shop.js';
import { save, load, hasSave, clear } from './core/saveSystem.js';
import { makeNew, recompute, useItem, toggleEquip, classChange, availableClassChanges, derived } from './core/playerSystem.js';
import { spawnEncounter, playerAttack, enemyAttack, checkEnd } from './core/combatSystem.js';
import { renderPlayer, renderEnemy, renderActions, renderInventory, addLog, clearLog, shakeEnemy, dyingEnemy, floatDamage, flashHpBar } from './ui/render.js';

let player = null;
let enemy  = null;

const QUESTS = [
  { id:'q1', name:'Slime Slayer',   desc:'Kill 5 Slimes.',          kills:{ slime:5 },          honor:5  },
  { id:'q2', name:'Goblin Hunter',  desc:'Kill 3 Goblins.',         kills:{ goblin:3 },          honor:8  },
  { id:'q3', name:'Void Walker',    desc:'Kill 3 Shadow Wolves.',   kills:{ shadow_wolf:3 },     honor:15 },
  { id:'q4', name:'Void Warden',    desc:'Defeat the Void Sentinel.', kills:{ void_sentinel:1 }, honor:20 },
  { id:'q5', name:'Soul Slayer',    desc:'Defeat the Soul Eater.',  kills:{ soul_eater:1 },      honor:50 },
];

// ── Boot ───────────────────────────────────────────────────────
async function init() {
  addLog('Loading data…', 'system');
  const base = new URL('.', import.meta.url).href.replace(/\/$/, '');
  await loadAll(base);

  const sheetUrl = getSavedUrl();
  if (sheetUrl) {
    try {
      const data = await loadFromSheets(sheetUrl);
      const store = getStore();
      if (data.monsters) store.monsters = data.monsters;
      if (data.items)    store.items    = data.items;
      addLog('Sheets data loaded ✅', 'system');
    } catch(e) { addLog('Sheets failed — using defaults.', 'system'); }
  }

  if (hasSave()) {
    const p = load();
    if (p) {
      player = p;
      recompute(player);
      tick();
      addLog(`Welcome back, ${p.name}.`, 'system');
      return;
    }
  }
  addLog('Data loaded. Choose your class.', 'system');
  showCharCreate();
}

// ── Character creation ─────────────────────────────────────────
function showCharCreate() {
  const modal   = document.getElementById('modal');
  const body    = document.getElementById('modal-body');
  const classes = getStore().classes;

  body.innerHTML = `
    <h2>Begin Anew</h2>
    <label>Name: <input id="char-name-input" value="Adventurer" maxlength="14"></label>
    <div style="margin-top:14px;">
      ${Object.entries(classes)
        .filter(([, c]) => c.tier === 1)
        .map(([id, c]) => `
          <div class="class-card" data-cls="${id}">
            <b>${id}</b> — <i>${c.desc}</i>
          </div>`).join('')}
    </div>`;

  modal.style.display = 'flex';
  body.querySelectorAll('.class-card').forEach(card => {
    card.onclick = () => {
      const name = document.getElementById('char-name-input').value.trim() || 'Adventurer';
      player = makeNew(name, card.dataset.cls);
      player.inv.push({ id:'rusty_sword', qty:1 });
      modal.style.display = 'none';
      clearLog();
      addLog(`The book opens. ${player.name} the ${player.cls} steps into the page.`, 'system');
      tick();
    };
  });
}

// ── Main tick ──────────────────────────────────────────────────
function tick() {
  renderPlayer(player);
  renderEnemy(enemy);
  renderInventory(player, handleUseItem, handleEquip);
  renderActions(player, enemy, { explore, rest, attack, flee });
}

// ── Combat ─────────────────────────────────────────────────────
function explore() {
  enemy = spawnEncounter(player.map, player.level);
  if (!enemy) { addLog('Nothing stirs.', 'system'); return; }
  const cls = enemy.special ? 'special' : 'system';
  addLog(`A ${enemy.name} (Lv.${enemy.lvl}) appears!`, cls);
  if (enemy.special) addLog('✦ The Soul Eater has found you. ✦', 'special');
  tick();
}

function rest() {
  const d  = derived(player);
  const dh = Math.floor(d.hpMax * 0.2);
  const dm = Math.floor(d.mpMax * 0.2);
  player.hp = Math.min(d.hpMax, player.hp + dh);
  player.mp = Math.min(d.mpMax, player.mp + dm);
  addLog(`You rest. (+${dh} HP, +${dm} MP)`, 'heal');
  tick();
}

function attack(skillId) {
  if (!enemy) return;

  const { logs: pLogs, fx: pFx } = playerAttack(player, enemy, skillId);
  pLogs.forEach(m => addLog(m, 'combat'));
  if (pFx?.type === 'crit')  { shakeEnemy(); floatDamage(pFx.dmg, 'crit'); }
  else if (pFx?.type === 'hit')  { shakeEnemy(); floatDamage(pFx.dmg); }
  else if (pFx?.type === 'miss') { floatDamage('MISS', 'miss'); }

  const { result, rewardLogs } = checkEnd(player, enemy);
  if (result === 'win') {
    rewardLogs.forEach(m => addLog(m, 'loot'));
    dyingEnemy();
    setTimeout(() => { enemy = null; save(player); tick(); }, 600);
    return;
  }
  if (result === 'lose') {
    rewardLogs.forEach(m => addLog(m, 'system'));
    const d = derived(player);
    player.hp = Math.max(1, Math.floor(d.hpMax / 2));
    enemy = null; tick(); return;
  }

  setTimeout(() => {
    if (!enemy) { tick(); return; }
    const { logs: eLogs, fx: eFx } = enemyAttack(player, enemy);
    eLogs.forEach(m => addLog(m, 'combat'));
    if (eFx?.type === 'hit')   { flashHpBar('hp'); floatDamage(eFx.dmg, 'player'); }
    else if (eFx?.type === 'dodge') { floatDamage('DODGE', 'miss'); }

    const { result: r2, rewardLogs: r2Logs } = checkEnd(player, enemy);
    if (r2 === 'lose') {
      r2Logs.forEach(m => addLog(m, 'system'));
      const d = derived(player);
      player.hp = Math.max(1, Math.floor(d.hpMax / 2));
      enemy = null; tick(); return;
    }
    tick();
  }, 350);
}

function flee() {
  if (enemy?.special) { addLog('The Soul Eater bars your retreat.', 'special'); return; }
  addLog('You slip away.', 'system');
  enemy = null;
  tick();
}

function handleUseItem(id) {
  const msg = useItem(player, id);
  if (msg) { addLog(msg, 'heal'); tick(); }
}

function handleEquip(id) {
  const msg = toggleEquip(player, id);
  if (msg) { addLog(msg, 'system'); tick(); }
}

// ── Travel ─────────────────────────────────────────────────────
function openTravel() {
  if (enemy) { addLog("Can't travel mid-combat.", 'system'); return; }
  const maps = getStore().maps;
  const modal = document.getElementById('modal');
  const body  = document.getElementById('modal-body');

  body.innerHTML = `
    <h2>Travel</h2>
    <p style="font-family:var(--hand);font-size:18px;color:var(--ink-soft);margin-bottom:12px;">Where shall the page turn?</p>
    ${Object.entries(maps).map(([id, m]) => `
      <div class="class-card ${player.map === id ? 'current-map' : ''}" data-map="${id}">
        <b>${m.name}</b> <span style="font-size:12px;color:var(--ink-soft)">(Lv ${m.minLvl}+)</span>
        ${m.special ? ' <span style="color:var(--purple)">✦ void</span>' : ''}
        <br><i style="font-size:13px">${m.desc}</i>
      </div>`).join('')}
    <div style="margin-top:12px;text-align:right;">
      <button class="btn inv-btn" id="closeTravel">Close</button>
    </div>`;

  modal.style.display = 'flex';
  body.querySelectorAll('[data-map]').forEach(card => {
    card.onclick = () => {
      const id = card.dataset.map;
      if (id === player.map) { modal.style.display = 'none'; return; }
      player.map = id;
      addLog(`You journey to ${maps[id].name}.`, 'system');
      modal.style.display = 'none';
      tick();
    };
  });
  document.getElementById('closeTravel').onclick = () => { modal.style.display = 'none'; };
}

// ── Inn ────────────────────────────────────────────────────────
function openInn() {
  if (enemy) { addLog("Can't rest mid-combat.", 'system'); return; }
  const cost = 10 + 5 * player.level;
  const modal = document.getElementById('modal');
  const body  = document.getElementById('modal-body');

  body.innerHTML = `
    <h2>🏨 Inn</h2>
    <p style="font-family:var(--hand);font-size:19px;margin:10px 0;">
      A warm bed and a hearty meal.<br>
      <b>Cost: ${cost} coins</b> &nbsp;(you have: ${player.money})
    </p>
    <div style="display:flex;gap:8px;margin-top:14px;">
      <button class="btn btn-rest" id="btnInnRest" style="flex:1" ${player.money < cost ? 'disabled' : ''}>Rest (Full restore)</button>
      <button class="btn inv-btn" id="btnInnClose">Cancel</button>
    </div>`;

  modal.style.display = 'flex';
  document.getElementById('btnInnRest').onclick = () => {
    player.money -= cost;
    recompute(player, true);
    addLog(`You sleep at the inn. (-${cost}c) HP & MP fully restored.`, 'heal');
    modal.style.display = 'none';
    save(player);
    tick();
  };
  document.getElementById('btnInnClose').onclick = () => { modal.style.display = 'none'; };
}

// ── Class Change ───────────────────────────────────────────────
function openClassChange() {
  if (enemy) { addLog("Can't change class mid-combat.", 'system'); return; }
  const modal   = document.getElementById('modal');
  const body    = document.getElementById('modal-body');
  const classes = getStore().classes;
  const options = availableClassChanges(player);

  if (!options.length) {
    body.innerHTML = `
      <h2>Class Change</h2>
      <p style="font-family:var(--hand);font-size:18px;color:var(--ink-soft);margin:10px 0;">
        No new paths yet.<br>
        Tier 2 unlocks at Lv 5 · Tier 3 at Lv 12.
      </p>
      <div style="text-align:right;margin-top:12px;">
        <button class="btn inv-btn" id="closeCC">Close</button>
      </div>`;
    modal.style.display = 'flex';
    document.getElementById('closeCC').onclick = () => { modal.style.display = 'none'; };
    return;
  }

  body.innerHTML = `
    <h2>Class Change</h2>
    <p style="font-family:var(--hand);font-size:16px;color:var(--ink-soft);margin-bottom:10px;">
      Current: <b>${player.cls}</b> · Lv ${player.level}
    </p>
    ${options.map(id => {
      const info = classes[id];
      return `<div class="class-card" data-cc="${id}">
        <b>${id}</b> <span style="font-size:11px;color:var(--ink-soft)">(Tier ${info.tier})</span>
        <br><i>${info.desc}</i>
      </div>`;
    }).join('')}
    <div style="text-align:right;margin-top:12px;">
      <button class="btn inv-btn" id="closeCC">Cancel</button>
    </div>`;

  modal.style.display = 'flex';
  body.querySelectorAll('[data-cc]').forEach(card => {
    card.onclick = () => {
      const msg = classChange(player, card.dataset.cc);
      addLog(msg, 'loot');
      modal.style.display = 'none';
      save(player);
      tick();
    };
  });
  document.getElementById('closeCC').onclick = () => { modal.style.display = 'none'; };
}

// ── Quest Board ────────────────────────────────────────────────
function openQuestBoard() {
  const modal = document.getElementById('modal');
  const body  = document.getElementById('modal-body');
  if (!player.quests) player.quests = { completed: [] };
  if (!player.kills)  player.kills  = {};

  const rows = QUESTS.map(q => {
    const done      = player.quests.completed.includes(q.id);
    const killEntries = Object.entries(q.kills);
    const progress  = killEntries.map(([id, need]) => {
      const have = Math.min(player.kills[id] || 0, need);
      return `${have}/${need}`;
    }).join(', ');
    const canClaim  = !done && killEntries.every(([id, need]) => (player.kills[id] || 0) >= need);

    return `<div class="inv-row">
      <span>
        <b>${q.name}</b> ${done ? '<span style="color:var(--green)">✓</span>' : ''}
        <br><small>${q.desc}</small>
        <br><small style="color:var(--ink-soft)">Progress: ${progress} · Reward: ${q.honor} Honor</small>
      </span>
      ${canClaim
        ? `<button class="btn btn-rest inv-btn" data-claim="${q.id}">Claim</button>`
        : `<span style="font-size:12px;color:var(--ink-soft)">${done ? 'Done' : 'Ongoing'}</span>`
      }
    </div>`;
  }).join('');

  body.innerHTML = `
    <h2>📜 Quest Board</h2>
    <div style="margin-bottom:8px;font-family:var(--hand);color:var(--gold)">Honor: ${player.honor}</div>
    ${rows}
    <div style="margin-top:12px;text-align:right;">
      <button class="btn inv-btn" id="closeQuests">Close</button>
    </div>`;

  modal.style.display = 'flex';
  body.querySelectorAll('[data-claim]').forEach(b => {
    b.onclick = () => {
      const q = QUESTS.find(x => x.id === b.dataset.claim);
      if (!q) return;
      player.quests.completed.push(q.id);
      player.honor = (player.honor || 0) + q.honor;
      addLog(`Quest complete: ${q.name}! (+${q.honor} Honor)`, 'loot');
      save(player);
      openQuestBoard();
      tick();
    };
  });
  document.getElementById('closeQuests').onclick = () => { modal.style.display = 'none'; };
}

// ── Global bindings ────────────────────────────────────────────
window.openShop     = () => openShop(player, msg => { addLog(msg,'loot'); save(player); tick(); }, tick);
window.openSoulShop = () => openSoulShop(player, msg => { addLog(msg,'special'); save(player); tick(); }, tick);
window.openTravel   = () => openTravel();
window.openInn      = () => openInn();
window.openClassChange = () => openClassChange();
window.openQuestBoard  = () => openQuestBoard();

window.connectSheets = () => {
  const url = prompt('Paste your Google Sheets Publish-to-web URL:');
  if (!url) return;
  saveUrl(url);
  addLog('URL saved — reloading data...', 'system');
  loadFromSheets(url).then(data => {
    const store = getStore();
    if (data.monsters) store.monsters = data.monsters;
    if (data.items)    store.items    = data.items;
    addLog('Sheets loaded ✅', 'loot');
    tick();
  }).catch(e => addLog('Error: ' + e.message, 'system'));
};

window.gameSave  = () => { save(player); addLog('Tale bookmarked.', 'system'); };
window.gameLoad  = () => {
  const p = load();
  if (p) { player = p; recompute(player); enemy = null; tick(); addLog('Tale resumed.', 'system'); }
};
window.gameReset = () => { if (confirm('Tear this page out and begin again?')) { clear(); location.reload(); } };

init();
