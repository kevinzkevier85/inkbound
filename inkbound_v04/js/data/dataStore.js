// Loads all JSON data files and exposes them as a single store.
// All game logic reads from here — never from hardcoded values.

const store = {
  config: null,
  classes: null,
  skills: null,
  items: null,
  monsters: null,
  maps: null,
};

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

export async function loadAll(basePath = '.') {
  const [config, classes, skills, items, monsters, maps] = await Promise.all([
    loadJSON(`${basePath}/data/config.json`),
    loadJSON(`${basePath}/data/classes.json`),
    loadJSON(`${basePath}/data/skills.json`),
    loadJSON(`${basePath}/data/items.json`),
    loadJSON(`${basePath}/data/monsters.json`),
    loadJSON(`${basePath}/data/maps.json`),
  ]);
  store.config   = config;
  store.classes  = classes;
  store.skills   = skills;
  store.items    = items;
  store.monsters = monsters;
  store.maps     = maps;
  return store;
}

export function getStore() { return store; }
