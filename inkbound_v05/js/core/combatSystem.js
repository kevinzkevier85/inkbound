import { rand, pick } from '../utils/random.js';
import { getStore } from '../data/dataStore.js';
import { derived, gainExp } from './playerSystem.js';

export function spawnEncounter(mapId, playerLvl) {
  const { maps, monsters, config } = getStore();
  const map = maps[mapId];
  if (!map) return null;

  // Special boss spawns only in special maps
  if (map.special && Math.random() < config.special_spawn_chance) {
    const specialId = Object.keys(monsters).find(id => monsters[id].special);
    if (specialId) return makeEnemy(specialId);
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

    // Special boss bonus
    if (enemy.special) {
      rewardLogs.push('✦ The Soul Eater has been vanquished. ✦');
    }

    // Drops
    for (const [id, chance] of (enemy.drops ?? [])) {
      if (items[id] && Math.random() < chance) {
        const slot = player.inv.find(s => s.id === id);
        if (slot) slot.qty++; else player.inv.push({ id, qty: 1 });
        rewardLogs.push(`Picked up: ${items[id].name}.`);
      }
    }

    return { result: 'win', rewardLogs };
  }

  if (player.hp <= 0) {
    return { result: 'lose', rewardLogs: ['You collapse onto the page…'] };
  }

  return { result: null, rewardLogs: [] };
}
