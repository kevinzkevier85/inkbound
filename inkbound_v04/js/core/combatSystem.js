import { rand, pick } from '../utils/random.js';
import { getStore } from '../data/dataStore.js';
import { derived, gainExp } from './playerSystem.js';

// Spawn an encounter for the given map
export function spawnEncounter(mapId, playerLvl) {
  const { maps, monsters, config } = getStore();
  const map = maps[mapId];
  if (!map) return null;

  // Miniboss chance if player is levelled enough
  if (playerLvl >= map.minLvl + 2 && map.miniboss.length && Math.random() < config.miniboss_chance) {
    const id = pick(map.miniboss);
    return makeEnemy(id);
  }
  return makeEnemy(pick(map.pool));
}

function makeEnemy(id) {
  const m = getStore().monsters[id];
  if (!m) return null;
  return { ...m, id, hpMax: m.hp };
}

// Returns { logs: string[], result: null|'win'|'lose' }
export function playerAttack(player, enemy, skillId = null) {
  const { skills, config } = getStore();
  const d = derived(player);
  const logs = [];

  const skill = skillId ? skills[skillId] : null;

  // MP check
  if (skill && player.mp < skill.mp) {
    return { logs: ['Not enough MP.'], result: null };
  }
  if (skill) player.mp -= skill.mp;

  // Hit check
  const acc = config.base_hit_chance + d.spd * 0.5;
  if (Math.random() * 100 >= acc) {
    logs.push(`You swing — ${enemy.name} side-steps.`);
    return { logs, result: null };
  }

  const power = skill ? skill.power : 1.0;
  const type  = skill ? skill.type : 'phys';

  let dmg =
    type === 'phys' ? d.atk * power - enemy.def * 0.6 :
    type === 'mag'  ? d.mag * power - enemy.res * 0.6 :
                      d.atk * power;                   // 'true' bypasses def

  dmg = Math.max(1, Math.round(dmg + rand(-2, 2)));

  // Crit
  const critChance = d.crit + (skill?.critBonus ?? 0);
  const crit = Math.random() * 100 < critChance;
  if (crit) dmg = Math.round(dmg * config.crit_multiplier);

  enemy.hp -= dmg;
  logs.push(`▸ ${skill?.name ?? 'Attack'} — ${enemy.name} takes ${dmg} dmg${crit ? ' (crit!)' : ''}.`);

  return { logs, result: null };
}

export function enemyAttack(player, enemy) {
  const d = derived(player);
  const { config } = getStore();
  const logs = [];

  // Dodge check
  if (Math.random() * 100 < d.dodge) {
    logs.push(`${enemy.name} attacks — you dodge!`);
    return { logs };
  }

  let dmg = Math.max(1, Math.round(enemy.atk - d.def * 0.6 + rand(-2, 2)));
  player.hp -= dmg;
  logs.push(`${enemy.name} strikes — you take ${dmg} dmg.`);
  return { logs };
}

// Check win/lose after an attack. Returns { result, rewardLogs }
export function checkEnd(player, enemy) {
  const { items } = getStore();

  if (enemy.hp <= 0) {
    const expGained = rand(enemy.expR[0], enemy.expR[1]);
    const money     = rand(enemy.moneyR[0], enemy.moneyR[1]);
    const expLogs   = gainExp(player, expGained);
    player.money   += money;

    const rewardLogs = [
      `${enemy.name} fades back into the page.`,
      ...expLogs,
      `Found ${money} coins.`,
    ];

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
    return { result: 'lose', rewardLogs: ['You collapse onto the page...'] };
  }

  return { result: null, rewardLogs: [] };
}
