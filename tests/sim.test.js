import test from 'node:test';
import assert from 'node:assert/strict';
import { applyUpgrade, makeUpgradeChoices, pickEnemyType, threatAt, xpForLevel } from '../src/game/data.js';

test('threat ramps without dropping the spawn pressure below the safety floor', () => {
  const early = threatAt(12, 'normal');
  const late = threatAt(300, 'normal');
  assert.ok(late.spawnRate < early.spawnRate);
  assert.ok(late.hpScale > early.hpScale);
  assert.ok(late.speedScale > early.speedScale);
  assert.ok(late.spawnRate >= 0.16);
});

test('upgrade choices are unique and respect max ranks', () => {
  const choices = makeUpgradeChoices({ rifle: 8, vitality: 6 }, () => 0.2);
  assert.equal(new Set(choices.map((choice) => choice.id)).size, choices.length);
  assert.ok(!choices.some((choice) => choice.id === 'rifle' || choice.id === 'vitality'));
});

test('weapon and survivor upgrades change the combat stats', () => {
  const base = { damage: 25, fireRate: 0.34, pierce: 0, maxHealth: 100, health: 80, speed: 235, dashCooldown: 4, magnet: 86, xpValue: 1, armor: 0, upgrades: {} };
  const rifle = applyUpgrade(base, 'rifle');
  const armor = applyUpgrade(base, 'armor');
  assert.ok(rifle.damage > base.damage);
  assert.ok(armor.armor > base.armor);
  assert.equal(rifle.upgrades.rifle, 1);
});

test('level curve stays strictly increasing', () => {
  const curve = Array.from({ length: 10 }, (_, i) => xpForLevel(i + 1));
  assert.ok(curve.every((value, index) => index === 0 || value > curve[index - 1]));
});

test('late game adds specialist enemies', () => {
  const lateTypes = new Set(Array.from({ length: 60 }, (_, index) => pickEnemyType(240, () => (index + 0.3) / 60)));
  assert.ok(lateTypes.has('bloater') || lateTypes.has('screecher'));
});
