export const DIFFICULTIES = {
  normal: { label: '标准', spawnRate: 1, enemyHp: 1, enemySpeed: 1, xp: 1 },
  frenzy: { label: '狂潮', spawnRate: 1.32, enemyHp: 1.16, enemySpeed: 1.08, xp: 1.18 }
};

export const ENEMY_DEFS = {
  walker: { name: '游荡者', hp: 32, speed: 58, radius: 18, damage: 12, xp: 5, score: 10, tint: 0x8ca76b, shape: 'walker' },
  runner: { name: '猎奔者', hp: 18, speed: 108, radius: 13, damage: 9, xp: 7, score: 16, tint: 0xc3b26a, shape: 'runner' },
  brute: { name: '裂骨者', hp: 170, speed: 36, radius: 28, damage: 21, xp: 19, score: 36, tint: 0x6d7781, shape: 'brute' },
  spitter: { name: '酸液囊', hp: 70, speed: 42, radius: 20, damage: 15, xp: 18, score: 32, tint: 0x8c63b4, shape: 'spitter' },
  bloater: { name: '爆裂囊', hp: 92, speed: 50, radius: 22, damage: 30, xp: 22, score: 44, tint: 0xc4855e, shape: 'bloater' },
  screecher: { name: '尖啸者', hp: 58, speed: 72, radius: 17, damage: 12, xp: 25, score: 48, tint: 0xe0bd69, shape: 'screecher' }
};

export const BOSS_DEFS = {
  butcher: { name: '疫变屠夫', hp: 2700, speed: 48, radius: 48, damage: 34, xp: 300, score: 700, tint: 0xd75943, shape: 'butcher' },
  tyrant: { name: '母巢暴君', hp: 6800, speed: 40, radius: 64, damage: 46, xp: 900, score: 1800, tint: 0xbd4b9a, shape: 'tyrant' }
};

export const UPGRADE_DEFS = [
  { id: 'rifle', icon: 'crosshair', color: '#ffb84a', name: '制式步枪', tag: '武器', desc: '基础伤害 +28%，子弹更稳定。', max: 8 },
  { id: 'overclock', icon: 'zap', color: '#63d7e6', name: '超载弹匣', tag: '武器', desc: '射速 +18%，换热更快。', max: 8 },
  { id: 'piercing', icon: 'move-up-right', color: '#ff7c5c', name: '穿甲弹芯', tag: '武器', desc: '子弹额外穿透 1 个目标。', max: 5 },
  { id: 'shotgun', icon: 'bomb', color: '#f09b5c', name: '裂地霰弹', tag: '武器', desc: '解锁近距离扇形霰弹，击退更强。', max: 5 },
  { id: 'drone', icon: 'bot', color: '#8fe0d0', name: '蜂鸟僚机', tag: '武器', desc: '召唤一台自动锁敌的支援无人机。', max: 4 },
  { id: 'arc', icon: 'activity', color: '#a7a0ff', name: '电弧线圈', tag: '武器', desc: '每 3 秒劈落连锁闪电。', max: 5 },
  { id: 'blades', icon: 'orbit', color: '#e5f4ff', name: '旋刃护卫', tag: '武器', desc: '生成旋转刀刃，触碰即斩。', max: 5 },
  { id: 'napalm', icon: 'flame', color: '#ff6f4b', name: '燃烧胶囊', tag: '武器', desc: '击杀后留下持续灼烧区域。', max: 5 },
  { id: 'vitality', icon: 'heart-pulse', color: '#ff6b77', name: '战地体魄', tag: '生存', desc: '最大生命 +24，并立刻回复 24。', max: 6 },
  { id: 'agility', icon: 'wind', color: '#75dbb2', name: '肾上腺素', tag: '生存', desc: '移动速度 +15%，冲刺冷却 -8%。', max: 6 },
  { id: 'magnet', icon: 'magnet', color: '#d5a9ff', name: '回收磁场', tag: '生存', desc: '拾取半径 +35%，经验晶体价值 +10%。', max: 5 },
  { id: 'armor', icon: 'shield-plus', color: '#77a6e8', name: '复合装甲', tag: '生存', desc: '受到的伤害降低 10%。', max: 5 },
  { id: 'medic', icon: 'cross', color: '#fb879c', name: '应急医疗', tag: '生存', desc: '每 12 次击杀恢复 6% 生命。', max: 4 }
];

export function threatAt(seconds, difficulty = 'normal') {
  const diff = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
  const minute = seconds / 60;
  return {
    spawnRate: Math.max(0.16, 0.82 / (1 + minute * 0.17) / diff.spawnRate),
    hpScale: diff.enemyHp * (1 + Math.max(0, minute - 1) * 0.16),
    speedScale: diff.enemySpeed * (1 + Math.max(0, minute - 2) * 0.07),
    packSize: Math.min(10, 1 + Math.floor(seconds / 42)),
  };
}

export function pickEnemyType(seconds, random = Math.random) {
  const roll = random();
  if (seconds < 25) return roll < 0.84 ? 'walker' : 'runner';
  if (seconds < 85) return roll < 0.55 ? 'walker' : roll < 0.76 ? 'runner' : roll < 0.91 ? 'spitter' : 'brute';
  if (seconds < 170) return roll < 0.32 ? 'walker' : roll < 0.52 ? 'runner' : roll < 0.72 ? 'spitter' : roll < 0.87 ? 'brute' : 'bloater';
  return roll < 0.22 ? 'runner' : roll < 0.42 ? 'spitter' : roll < 0.6 ? 'brute' : roll < 0.81 ? 'bloater' : 'screecher';
}

export function xpForLevel(level) {
  return Math.floor(26 + level * 18 + Math.pow(level, 1.4) * 4);
}

export function makeUpgradeChoices(owned, random = Math.random, count = 3) {
  const available = UPGRADE_DEFS.filter((item) => (owned[item.id] || 0) < item.max);
  const pool = [...available];
  const choices = [];
  while (pool.length && choices.length < count) {
    const index = Math.floor(random() * pool.length);
    choices.push(pool.splice(index, 1)[0]);
  }
  return choices;
}

export function applyUpgrade(stats, id) {
  const next = { ...stats, upgrades: { ...stats.upgrades, [id]: (stats.upgrades[id] || 0) + 1 } };
  const rank = next.upgrades[id];
  switch (id) {
    case 'rifle': next.damage *= 1.28; break;
    case 'overclock': next.fireRate *= 0.82; break;
    case 'piercing': next.pierce += 1; break;
    case 'shotgun': next.shotgunLevel = rank; break;
    case 'drone': next.droneCount = rank; break;
    case 'arc': next.arcLevel = rank; break;
    case 'blades': next.bladeCount = rank; break;
    case 'napalm': next.napalmLevel = rank; break;
    case 'vitality': next.maxHealth += 24; next.health = Math.min(next.maxHealth, next.health + 24); break;
    case 'agility': next.speed *= 1.15; next.dashCooldown *= 0.92; break;
    case 'magnet': next.magnet += 0.35; next.xpValue *= 1.1; break;
    case 'armor': next.armor = Math.min(0.48, next.armor + 0.1); break;
    case 'medic': next.medicLevel = rank; break;
    default: break;
  }
  return next;
}
