import { rand, pick } from '../utils/random.js';
import { getStore } from '../data/dataStore.js';
import { derived, gainExp } from './playerSystem.js';

export function spawnEncounter(mapId, playerLvl) {
  const { maps, monsters, config } = getStore();
  const map = maps[mapId];
  if (!map) return null;

  // Void Dimension — custom spawn table
  if (mapId === 'void_dimension') {
    const roll = Math.random();
    if (roll < 0.04) {
      const soulEater = Object.keys(monsters).find(id => monsters[id].special);
      if (soulEater) return makeEnemy(soulEater);
    }
    if (roll < 0.14) return makeEnemy('glitch_of_void');
    if (roll < 0.44) return makeEnemy('glitch_scarab');
    if (playerLvl >= map.minLvl + 2 && map.miniboss.length && Math.random() < config.miniboss_chance) {
      return makeEnemy(pick(map.miniboss));
    }
    return makeEnemy(pick(map.pool));
  }

  if (playerLvl >= map.minLvl + 2 && map.miniboss.length && Math.random() < config.miniboss_chance) {
    return makeEnemy(pick(map.miniboss));
  }
  return makeEnemy(pick(map.pool));
}

function makeEnemy(id) {
  const m = getStore().monsters[id];
  if (!m) return null;
  return { ...m, id, hpMax: m.hp };
}

export function playerAttack(player, enemy, skillId = null) {
  const { skills, config } = getStore();
  const d = derived(player);
  const logs = [];
  const skill = skillId ? skills[skillId] : null;

  if (skill && player.mp < skill.mp) {
    return { logs: ['Not enough MP.'], result: null, fx: null };
  }
  if (skill) player.mp -= skill.mp;

  const acc = config.base_hit_chance + d.spd * 0.5;
  if (Math.random() * 100 >= acc) {
    logs.push(`You swing — ${enemy.name} side-steps.`);
    return { logs, result: null, fx: { type: 'miss' } };
  }

  // Glitch Scarab — takes exactly 1 damage per hit (20 hits to kill)
  if (enemy.hitCounter) {
    enemy.hp = Math.max(0, enemy.hp - 1);
    logs.push(`▸ ${skill?.name ?? 'Attack'} — Glitch Scarab endures! (${Math.max(0,enemy.hp)} hits left)`);
    return { logs, result: null, fx: { type: 'hit', dmg: 1 } };
  }

  const power = skill ? skill.power : 1.0;
  const type  = skill ? skill.type  : 'phys';

  let dmg =
    type === 'phys' ? d.atk * power - enemy.def * 0.6 :
    type === 'mag'  ? d.mag * power - enemy.res * 0.6 :
                      d.atk * power;

  dmg = Math.max(1, Math.round(dmg + rand(-2, 2)));

  // Gambler — random multiplier
  if (skill?.gambler) {
    const mult = pick([0.5, 1, 1.5, 2, 3]);
    dmg = Math.round(dmg * mult);
    logs.push(`Gambler's throw — fate rolls ×${mult}!`);
  }

  // Crit
  const critChance = d.crit + (skill?.critBonus ?? 0);
  const crit = Math.random() * 100 < critChance;
  if (crit) dmg = Math.round(dmg * config.crit_multiplier);

  // Multihit
  const hits = skill?.multihit ?? 1;
  const total = dmg * hits;
  enemy.hp -= total;

  const label = skill?.name ?? 'Attack';
  logs.push(`▸ ${label}${hits > 1 ? ` ×${hits}` : ''} — ${enemy.name} takes ${total} dmg${crit ? ' (crit!)' : ''}.`);

  // Recoil
  if (skill?.recoil) {
    const recoil = Math.max(1, Math.round(total * skill.recoil));
    player.hp -= recoil;
    logs.push(`Recoil — you take ${recoil} dmg.`);
  }

  // Hex — weaken enemy next attack
  if (skill?.hex) {
    player.hexedFoe = 0.7;
    logs.push(`${enemy.name} is hexed — next attack weakened.`);
  }

  return { logs, result: null, fx: { type: crit ? 'crit' : 'hit', dmg: total } };
}

export function enemyAttack(player, enemy) {
  const d = derived(player);
  const logs = [];

  if (Math.random() * 100 < d.dodge) {
    logs.push(`${enemy.name} attacks — you dodge!`);
    return { logs, fx: { type: 'dodge' } };
  }

  let dmg = Math.max(1, Math.round(enemy.atk - d.def * 0.6 + rand(-2, 2)));

  // Apply hex debuff
  if (player.hexedFoe) {
    dmg = Math.round(dmg * player.hexedFoe);
    player.hexedFoe = 0;
  }

  player.hp -= dmg;
  logs.push(`${enemy.name} strikes — you take ${dmg} dmg.`);
  return { logs, fx: { type: 'hit', dmg } };
}

export function checkEnd(player, enemy) {
  const { items } = getStore();

  if (enemy.hp <= 0) {
    const expGained = rand(enemy.expR[0], enemy.expR[1]);
    const money     = rand(enemy.moneyR[0], enemy.moneyR[1]);
    const expLogs   = gainExp(player, expGained);
    player.money   += money;

    // Kill tracking for quests
    if (!player.kills) player.kills = {};
    player.kills[enemy.id] = (player.kills[enemy.id] || 0) + 1;

    const rewardLogs = [
      `${enemy.name} fades back into the page.`,
      ...expLogs,
      `Found ${money} coins.`,
    ];

    // Soul reward
    if (enemy.soulR) {
      const soul = rand(enemy.soulR[0], enemy.soulR[1]);
      player.soul = (player.soul || 0) + soul;
      rewardLogs.push(`Absorbed ${soul} Soul.`);
    }

    // Glitch of the Void — bonus soul chance (60% for 1-2 extra)
    if (enemy.soulBonus && Math.random() < 0.6) {
      const bonus = rand(enemy.soulBonus[0], enemy.soulBonus[1]);
      player.soul = (player.soul || 0) + bonus;
      rewardLogs.push(`Void resonance — +${bonus} bonus Soul!`);
    }

    // Special boss bonus
    if (enemy.special) {
      rewardLogs.push('✦ The Soul Eater has been vanquished. ✦');
    }

    // Drops from monster drop table
    for (const [id, chance] of (enemy.drops ?? [])) {
      if (items[id] && Math.random() < chance) {
        const slot = player.inv.find(s => s.id === id);
        if (slot) slot.qty++; else player.inv.push({ id, qty: 1 });
        rewardLogs.push(`Picked up: ${items[id].name}.`);
      }
    }

    // Key of the Void — 1% drop from non-void-dimension maps
    if (player.map !== 'void_dimension' && !enemy.special && Math.random() < 0.01) {
      if (items['key_of_void']) {
        const slot = player.inv.find(s => s.id === 'key_of_void');
        if (slot) slot.qty++; else player.inv.push({ id: 'key_of_void', qty: 1 });
        rewardLogs.push('★ Found: Key of the Void! (Rare drop)');
      }
    }

    // Void Dimension — 5% chance for Void Eye Cloak from any monster
    if (player.map === 'void_dimension' && Math.random() < 0.05) {
      if (items['void_eye_cloak']) {
        const slot = player.inv.find(s => s.id === 'void_eye_cloak');
        if (slot) slot.qty++; else player.inv.push({ id: 'void_eye_cloak', qty: 1 });
        rewardLogs.push('✦ Void Eye Cloak materializes from the rift!');
      }
    }

    return { result: 'win', rewardLogs };
  }

  if (player.hp <= 0) {
    return { result: 'lose', rewardLogs: ['You collapse onto the page…'] };
  }

  return { result: null, rewardLogs: [] };
}
