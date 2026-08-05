import Phaser from 'phaser';
import { BOSS_DEFS, DIFFICULTIES, ENEMY_DEFS, applyUpgrade, makeUpgradeChoices, pickEnemyType, threatAt, xpForLevel } from './data.js';
import { blip, setMusicIntensity, startMusic, stopMusic } from './audio.js';

const WORLD = 6200;
const TAU = Math.PI * 2;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.mode = 'title';
    this.mobileVector = { x: 0, y: 0 };
    this.pointer = { x: 0, y: 0, down: false };
    this.pendingDash = false;
    this.elapsed = 0;
    this.lastFrame = 0;
  }

  create() {
    this.cameras.main.setBackgroundColor('#07110f');
    this.physics.world.setBounds(0, 0, WORLD, WORLD);
    this.makeTextures();
    this.makeWorld();
    this.rainLayer = this.add.graphics().setScrollFactor(0).setDepth(90);
    this.atmosphere = Array.from({ length: 82 }, (_, index) => ({
      x: (index * 97) % 1600,
      y: (index * 53) % 1000,
      length: 7 + (index % 6) * 2,
      speed: 0.55 + (index % 5) * 0.14,
      alpha: 0.08 + (index % 4) * 0.025
    }));
    this.atmosphereTime = 0;
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE');
    this.input.on('pointermove', (pointer) => { this.pointer.x = pointer.x; this.pointer.y = pointer.y; });
    this.input.on('pointerdown', () => { this.pointer.down = true; });
    this.input.on('pointerup', () => { this.pointer.down = false; });
    this.cameras.main.centerOn(WORLD / 2, WORLD / 2);
    window.gameApi = {
      start: (difficulty) => this.startRun(difficulty),
      pause: () => this.pauseRun(),
      resume: () => this.resumeRun(),
      dash: () => { this.pendingDash = true; },
      chooseUpgrade: (id) => this.chooseUpgrade(id),
      restart: () => this.startRun(this.difficulty),
      home: () => this.goHome(),
      getState: () => this.getDebugState()
    };
    window.__gameDebug = { getState: () => this.getDebugState(), scene: this };
  }

  makeTextures() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x0b191a); g.fillRect(0, 0, 256, 256);
    g.lineStyle(1, 0x17302f, 0.62);
    for (let i = 0; i <= 256; i += 32) { g.lineBetween(i, 0, i, 256); g.lineBetween(0, i, 256, i); }
    for (let i = 0; i < 68; i += 1) {
      const x = (i * 83) % 250 + 3; const y = (i * 47) % 250 + 3;
      g.fillStyle(i % 3 ? 0x183433 : 0x25443e, 0.65); g.fillRect(x, y, i % 2 ? 2 : 4, 1);
    }
    g.generateTexture('ground', 256, 256); g.clear();
    g.fillStyle(0x061011, 0.82); g.fillRect(0, 0, 96, 96);
    g.lineStyle(2, 0x254544, 0.55); g.strokeRect(7, 7, 82, 82);
    g.fillStyle(0x4e6d59, 0.45); g.fillRect(13, 16, 38, 22); g.fillStyle(0x9b6a3c, 0.4); g.fillRect(60, 50, 23, 28);
    g.fillStyle(0xe8b65e, 0.35); g.fillRect(20, 54, 27, 9); g.generateTexture('debris', 96, 96); g.clear();

    g.fillStyle(0x101d20, 1); g.fillRect(0, 0, 128, 160); g.fillStyle(0x1d3031, 1); g.fillRect(10, 10, 108, 140);
    g.fillStyle(0x080f12, 1); for (let row = 0; row < 6; row += 1) for (let col = 0; col < 4; col += 1) g.fillRect(18 + col * 24, 20 + row * 20, 11, 8);
    g.fillStyle(0x6ba897, 0.34); g.fillRect(18, 20, 11, 8); g.fillStyle(0xbd7556, 0.28); g.fillRect(66, 80, 11, 8); g.fillStyle(0x0a1416, 1); g.fillRect(39, 106, 50, 44); g.lineStyle(3, 0x263f3d, 0.85); g.strokeRect(39, 106, 50, 44); g.generateTexture('building', 128, 160); g.clear();
    g.fillStyle(0x19271f, 1); g.fillEllipse(48, 22, 66, 42); g.fillRect(41, 20, 14, 58); g.fillStyle(0x283e2b, 1); g.fillEllipse(48, 16, 76, 46); g.fillStyle(0x0b1613, 0.45); g.fillEllipse(48, 76, 60, 14); g.generateTexture('tree', 96, 96); g.clear();
    g.fillStyle(0x0a1415, 1); g.fillRect(8, 6, 8, 78); g.fillStyle(0xd1a760, 0.9); g.fillCircle(12, 6, 7); g.fillStyle(0x5c4032, 1); g.fillRect(5, 83, 14, 7); g.generateTexture('streetlight', 28, 96); g.clear();
    g.fillStyle(0x131a1b, 1); g.fillRoundedRect(8, 18, 118, 57, 13); g.fillStyle(0x492e2d, 1); g.fillRect(22, 23, 22, 42); g.fillRect(83, 23, 22, 42); g.fillStyle(0x1c2f2d, 1); g.fillRect(48, 27, 29, 34); g.fillStyle(0x090e10, 0.8); g.fillEllipse(68, 79, 112, 18); g.lineStyle(3, 0xa1463f, 0.8); g.lineBetween(10, 16, 123, 16); g.generateTexture('wreck', 136, 94); g.clear();
    g.fillStyle(0x1b2826, 1); g.fillRect(0, 12, 72, 18); g.fillStyle(0xb37445, 1); g.fillRect(5, 17, 62, 5); g.fillStyle(0x8ad8bc, 0.55); g.fillRect(12, 4, 8, 14); g.fillRect(50, 4, 8, 14); g.generateTexture('barrier', 72, 42); g.clear();

    g.fillStyle(0x242c31, 1); g.fillRoundedRect(4, 3, 14, 29, 5); g.fillStyle(0x6c4b3f, 1); g.fillRect(4, 8, 14, 7); g.generateTexture('player-leg', 22, 38); g.clear();
    g.fillStyle(0xc54643, 1); g.fillRoundedRect(5, 4, 38, 38, 9); g.fillStyle(0x1d2e33, 1); g.fillRect(9, 6, 8, 28); g.fillStyle(0x7ce3d2, 0.7); g.fillRect(30, 15, 6, 10); g.generateTexture('player-torso', 48, 48); g.clear();
    g.fillStyle(0xd7aa81, 1); g.fillCircle(16, 17, 14); g.fillStyle(0x20272d, 1); g.fillRoundedRect(12, 3, 22, 8, 4); g.fillStyle(0x5fe0cf, 1); g.fillCircle(22, 18, 2); g.generateTexture('player-head', 40, 40); g.clear();
    g.fillStyle(0xd7aa81, 1); g.fillRoundedRect(2, 4, 28, 11, 5); g.fillStyle(0x6b3633, 1); g.fillRect(2, 4, 7, 11); g.generateTexture('player-arm', 32, 20); g.clear();
    g.fillStyle(0x202931, 1); g.fillRoundedRect(1, 3, 45, 9, 4); g.fillStyle(0xdba450, 1); g.fillRect(37, 4, 9, 6); g.generateTexture('player-gun', 50, 16); g.clear();
    g.fillStyle(0x223c3b, 1); g.fillRoundedRect(2, 3, 23, 30, 6); g.fillStyle(0x64d5c3, 0.7); g.fillRect(8, 9, 11, 5); g.generateTexture('player-pack', 28, 38); g.clear();
    g.fillStyle(0x2f3435, 1); g.fillRoundedRect(2, 1, 10, 30, 4); g.generateTexture('limb', 14, 34); g.clear();
    g.fillStyle(0xfff0ae, 1); g.fillCircle(14, 14, 11); g.fillStyle(0xff7a48, 0.6); g.fillCircle(14, 14, 19); g.generateTexture('muzzle', 40, 40); g.clear();

    g.fillStyle(0x000000, 0.42); g.fillEllipse(48, 76, 60, 18);
    g.fillStyle(0xd34742); g.fillRoundedRect(30, 36, 36, 35, 9);
    g.fillStyle(0x292f37); g.fillRect(41, 22, 18, 24); g.fillStyle(0xd7aa81); g.fillCircle(50, 20, 12);
    g.fillStyle(0x11181b); g.fillRect(53, 18, 13, 4); g.fillStyle(0x5fe0cf); g.fillCircle(54, 20, 2);
    g.lineStyle(5, 0x202931, 1); g.lineBetween(62, 46, 90, 30); g.lineStyle(3, 0xdba450, 1); g.lineBetween(80, 35, 92, 30);
    g.fillStyle(0x6ce8d8, 0.45); g.fillCircle(25, 52, 4); g.generateTexture('player', 96, 96); g.clear();

    g.fillStyle(0x000000, 0.38); g.fillEllipse(48, 78, 60, 15);
    for (const [key, color, shape] of [['walker', 0x8ca76b, 'round'], ['runner', 0xc3b26a, 'runner'], ['brute', 0x6d7781, 'brute'], ['spitter', 0x8c63b4, 'spitter'], ['bloater', 0xc4855e, 'bloater'], ['screecher', 0xe0bd69, 'screecher']]) {
      g.fillStyle(color, 1);
      if (shape === 'brute') g.fillRoundedRect(21, 24, 54, 48, 17);
      else if (shape === 'runner') g.fillTriangle(48, 17, 76, 70, 20, 70);
      else g.fillCircle(48, 46, shape === 'spitter' ? 27 : shape === 'bloater' ? 29 : 23);
      g.fillStyle(0x252b2b, 1); g.fillCircle(39, 39, 4); g.fillCircle(57, 39, 4);
      g.fillStyle(0xe5a38c, 0.8); g.fillRect(36, 52, 25, shape === 'screecher' ? 9 : 5);
      if (shape === 'spitter') { g.fillStyle(0x6e4a98, 1); g.fillCircle(48, 51, 12); }
      if (shape === 'bloater') { g.lineStyle(3, 0xefa874, 0.7); g.strokeCircle(48, 46, 31); }
      if (shape === 'screecher') { g.lineStyle(3, 0xe6d69e, 0.8); g.lineBetween(26, 21, 37, 31); g.lineBetween(70, 21, 59, 31); }
      g.generateTexture(`enemy-${key}`, 96, 96); g.clear();
      g.fillStyle(0x000000, 0.38); g.fillEllipse(48, 78, 60, 15);
    }
    for (const [key, color, size] of [['butcher', 0xd75943, 45], ['tyrant', 0xbd4b9a, 59]]) {
      g.fillStyle(color, 1); g.fillCircle(80, 74, size); g.fillStyle(0x301a27, 1); g.fillCircle(62, 64, 8); g.fillCircle(98, 64, 8);
      g.fillStyle(0xf2c39b, 0.9); g.fillRect(64, 89, 32, 8); g.lineStyle(6, color, 1); g.lineBetween(40, 87, 19, 113); g.lineBetween(120, 87, 142, 113);
      g.lineStyle(3, 0x6be2d2, 0.9); g.strokeCircle(80, 74, size + 8); g.generateTexture(`boss-${key}`, 160, 160); g.clear();
    }
    g.fillStyle(0xffd167, 1); g.fillRoundedRect(3, 8, 18, 8, 4); g.fillStyle(0xfff0af, 1); g.fillRect(9, 6, 7, 12); g.generateTexture('bullet', 24, 20); g.clear();
    g.fillStyle(0xa865e3, 1); g.fillCircle(11, 11, 7); g.fillStyle(0xe0c7ff, 0.9); g.fillCircle(8, 8, 2); g.generateTexture('acid', 22, 22); g.clear();
    g.fillStyle(0x2f9e91, 0.22); g.fillCircle(12, 12, 12); g.fillStyle(0x55e0cb, 1); g.fillTriangle(12, 1, 23, 12, 12, 23); g.fillStyle(0xbafff1, 0.92); g.fillTriangle(12, 5, 18, 12, 12, 19); g.lineStyle(1, 0xe8fff9, 0.7); g.strokeTriangle(12, 1, 23, 12, 12, 23); g.generateTexture('xp', 24, 24); g.clear();
    g.fillStyle(0x0c1718, 0.36); g.fillEllipse(20, 35, 32, 8); g.fillStyle(0x72d0ab, 1); g.fillRoundedRect(5, 5, 30, 27, 6); g.fillStyle(0xb5ffe0, 0.72); g.fillRect(8, 8, 24, 4); g.fillStyle(0x214b42, 1); g.fillRect(16, 12, 8, 16); g.fillRect(12, 16, 16, 8); g.lineStyle(2, 0x0c2523, 0.8); g.strokeRoundedRect(5, 5, 30, 27, 6); g.generateTexture('medkit', 40, 40); g.clear();
    g.fillStyle(0xf0724d, 0.18); g.fillCircle(52, 52, 49); g.lineStyle(2, 0xf8a15e, 0.5); g.strokeCircle(52, 52, 44); g.generateTexture('fire-zone', 104, 104); g.clear();
    g.fillStyle(0x102123, 0.58); g.fillCircle(18, 22, 16); g.fillStyle(0xbbeee5, 1); g.fillTriangle(18, 2, 34, 19, 18, 38); g.fillStyle(0x4c8bb4, 1); g.fillTriangle(18, 2, 18, 38, 2, 19); g.fillStyle(0xe9ffff, 0.9); g.fillTriangle(18, 8, 26, 19, 18, 30); g.lineStyle(2, 0x5f9db7, 1); g.strokeCircle(18, 20, 12); g.generateTexture('blade', 36, 40); g.clear();
    g.fillStyle(0x72d5e7, 1); g.fillCircle(24, 24, 18); g.fillStyle(0x183a43, 1); g.fillCircle(24, 24, 9); g.fillStyle(0xdffeff, 0.9); g.fillCircle(20, 19, 3); g.lineStyle(3, 0xe4ffff, 1); g.strokeCircle(24, 24, 13); g.lineStyle(2, 0x2d7281, 0.8); g.lineBetween(7, 24, 1, 24); g.lineBetween(41, 24, 47, 24); g.generateTexture('drone', 48, 48); g.destroy();
  }

  createPlayerRig() {
    const rig = this.add.container(this.player.x, this.player.y).setDepth(9);
    const light = this.add.circle(0, 0, 122, 0x6cd7c7, 0.045);
    const shadow = this.add.ellipse(0, 22, 70, 18, 0x000000, 0.5);
    const leftLeg = this.add.image(-8, 14, 'player-leg').setOrigin(0.5, 0.12).setScale(0.74);
    const rightLeg = this.add.image(8, 14, 'player-leg').setOrigin(0.5, 0.12).setScale(0.74);
    const pack = this.add.image(-18, -3, 'player-pack').setOrigin(0.5).setScale(0.7);
    const torso = this.add.image(0, -3, 'player-torso').setOrigin(0.5).setScale(0.86);
    const head = this.add.image(0, -27, 'player-head').setOrigin(0.5).setScale(0.82);
    const rearArm = this.add.image(4, -2, 'player-arm').setOrigin(0.1, 0.5).setScale(0.65).setTint(0xc18b70);
    const frontArm = this.add.image(12, -4, 'player-arm').setOrigin(0.1, 0.5).setScale(0.7);
    const gun = this.add.image(34, -7, 'player-gun').setOrigin(0.08, 0.5).setScale(0.86);
    rig.add([light, shadow, leftLeg, rightLeg, pack, torso, rearArm, frontArm, head, gun]);
    this.playerVisual = rig;
    this.playerRig = { light, shadow, leftLeg, rightLeg, pack, torso, head, rearArm, frontArm, gun };
    this.playerWalk = 0;
    this.player.setAlpha(0);
  }

  createEnemyVisual(enemy, type, def) {
    const rig = this.add.container(enemy.x, enemy.y).setDepth(enemy.isBoss ? 7 : 6);
    const shadow = this.add.ellipse(0, def.radius * 0.88, def.radius * 2.1, def.radius * 0.55, 0x000000, 0.42);
    const leftLeg = this.add.image(-def.radius * 0.33, def.radius * 0.52, 'limb').setOrigin(0.5, 0).setScale(def.radius / 23, def.radius / 34).setTint(0x394142);
    const rightLeg = this.add.image(def.radius * 0.33, def.radius * 0.52, 'limb').setOrigin(0.5, 0).setScale(def.radius / 23, def.radius / 34).setTint(0x394142);
    const bodyKey = enemy.isBoss ? `boss-${type}` : `enemy-${type}`;
    const body = this.add.image(0, 0, bodyKey).setOrigin(0.5).setScale(enemy.isBoss ? 0.86 : def.radius / 26);
    const armTint = enemy.isBoss ? def.tint : Phaser.Display.Color.IntegerToColor(def.tint).darken(25).color;
    const leftArm = this.add.image(-def.radius * 0.78, 2, 'limb').setOrigin(0.5, 0.1).setScale(def.radius / 34, def.radius / 42).setTint(armTint);
    const rightArm = this.add.image(def.radius * 0.78, 2, 'limb').setOrigin(0.5, 0.1).setScale(def.radius / 34, def.radius / 42).setTint(armTint);
    const glow = enemy.isBoss ? this.add.circle(0, 0, def.radius * 1.16, def.tint, 0.11) : null;
    rig.add([shadow, leftLeg, rightLeg, glow, body, leftArm, rightArm].filter(Boolean));
    enemy.visual = rig;
    enemy.visualParts = { shadow, leftLeg, rightLeg, body, leftArm, rightArm, glow };
    enemy.walkPhase = Math.random() * TAU;
    enemy.setAlpha(0);
  }

  updatePlayerVisual(dt, move) {
    if (!this.playerVisual?.active) return;
    const rig = this.playerRig;
    const aim = this.player.getData('aim');
    const moving = move.lengthSq() > 0.01;
    this.playerWalk += dt * (moving ? 10.5 : 2.2);
    const gait = Math.sin(this.playerWalk) * (moving ? 0.22 : 0.035);
    this.playerVisual.setPosition(this.player.x, this.player.y);
    if (Number.isFinite(aim)) this.playerVisual.setRotation(aim);
    rig.leftLeg.rotation = gait;
    rig.rightLeg.rotation = -gait;
    rig.leftLeg.y = 13 + Math.max(0, Math.sin(this.playerWalk)) * 2;
    rig.rightLeg.y = 13 + Math.max(0, Math.sin(this.playerWalk + Math.PI)) * 2;
    rig.torso.y = -3 + Math.sin(this.playerWalk * 2) * (moving ? 1.2 : 0.3);
    rig.head.y = -27 + Math.sin(this.playerWalk * 2) * (moving ? 1.1 : 0.25);
    rig.rearArm.rotation = -0.35 - gait * 0.6;
    rig.frontArm.rotation = 0.18 + gait * 0.45;
    rig.gun.x = 34 - (this.player.getData('recoil') || 0);
    const recoil = Math.max(0, (this.player.getData('recoil') || 0) - dt * 48);
    this.player.setData('recoil', recoil);
    rig.shadow.scaleX = moving ? 1.04 : 0.95;
    rig.shadow.scaleY = moving ? 0.9 : 1;
    rig.light.scale = 0.96 + Math.sin(this.elapsed * 2.4) * 0.055;
    rig.light.alpha = 0.034 + (moving ? 0.012 : 0);
    rig.head.angle = Math.sin(this.playerWalk * 0.7) * 2;
    rig.torso.angle = Math.sin(this.playerWalk * 2) * (moving ? 3 : 1);
    rig.gun.angle = Math.sin(this.playerWalk * 1.5) * (moving ? 2 : 0.5);
    this.playerVisual.setAlpha(this.player.getData('invuln') > 0 ? 0.58 + Math.sin(this.elapsed * 28) * 0.18 : 1);
  }

  updateEnemyVisual(enemy, dt, angle) {
    if (!enemy.visual?.active) return;
    const parts = enemy.visualParts;
    const moving = enemy.body.velocity.lengthSq() > 35;
    enemy.walkPhase += dt * (moving ? (enemy.enemyType === 'runner' ? 16 : 8) : 2);
    const gait = Math.sin(enemy.walkPhase) * (moving ? 0.42 : 0.07);
    enemy.visual.setPosition(enemy.x, enemy.y);
    enemy.visual.setRotation(0);
    enemy.visual.setScale(enemy.isBoss ? (enemy.enemyType === 'tyrant' ? 1.07 : 0.98) : 1);
    parts.leftLeg.rotation = gait;
    parts.rightLeg.rotation = -gait;
    parts.leftArm.rotation = -0.65 - gait * 0.7;
    parts.rightArm.rotation = 0.65 + gait * 0.7;
    parts.body.y = Math.sin(enemy.walkPhase * 2) * (moving ? 1.5 : 0.45);
    parts.body.angle = Math.sin(enemy.walkPhase) * (moving ? 3 : 0.7);
    if (parts.glow) { parts.glow.scale = 1 + Math.sin(this.elapsed * 3.5) * 0.08; parts.glow.alpha = enemy.enraged ? 0.2 : 0.11; }
    const facing = Math.cos(angle) >= 0 ? 1 : -1;
    parts.leftArm.scaleX = Math.abs(parts.leftArm.scaleX) * facing;
    parts.rightArm.scaleX = Math.abs(parts.rightArm.scaleX) * facing;
  }

  updateAtmosphere(dt) {
    if (!this.rainLayer) return;
    this.atmosphereTime += dt;
    const width = window.innerWidth || 1280;
    const height = window.innerHeight || 720;
    this.rainLayer.clear();
    this.atmosphere.forEach((drop, index) => {
      const x = (drop.x + this.atmosphereTime * 23 * drop.speed + index * 17) % (width + 80) - 40;
      const y = (drop.y + this.atmosphereTime * 58 * drop.speed) % (height + 80) - 40;
      this.rainLayer.lineStyle(index % 7 === 0 ? 2 : 1, index % 8 === 0 ? 0xd3f7e8 : 0x7eb5ae, drop.alpha);
      this.rainLayer.lineBetween(x, y, x - 3, y + drop.length);
    });
  }

  softenWorldBounds() {
    if (!this.player?.body) return;
    const margin = 250;
    const push = 3.4;
    if (this.player.x < margin) this.player.body.velocity.x += (margin - this.player.x) * push;
    if (this.player.x > WORLD - margin) this.player.body.velocity.x -= (this.player.x - (WORLD - margin)) * push;
    if (this.player.y < margin) this.player.body.velocity.y += (margin - this.player.y) * push;
    if (this.player.y > WORLD - margin) this.player.body.velocity.y -= (this.player.y - (WORLD - margin)) * push;
    if (this.player.x < 60) this.player.x = 60;
    if (this.player.x > WORLD - 60) this.player.x = WORLD - 60;
    if (this.player.y < 60) this.player.y = 60;
    if (this.player.y > WORLD - 60) this.player.y = WORLD - 60;
  }

  makeWorld() {
    this.add.tileSprite(WORLD / 2, WORLD / 2, WORLD, WORLD, 'ground').setDepth(-30);
    const road = this.add.graphics().setDepth(-25);
    road.fillStyle(0x0a1718, 0.96); road.fillRect(0, WORLD / 2 - 310, WORLD, 620); road.fillRect(WORLD / 2 - 310, 0, 620, WORLD);
    road.fillStyle(0x122120, 0.78); road.fillRect(0, WORLD / 2 - 1220, WORLD, 420); road.fillRect(WORLD / 2 - 1220, 0, 420, WORLD);
    road.lineStyle(2, 0x3c5750, 0.55);
    for (let p = 80; p < WORLD; p += 100) { road.lineBetween(p, WORLD / 2 - 7, p + 58, WORLD / 2 - 7); road.lineBetween(p, WORLD / 2 + 7, p + 58, WORLD / 2 + 7); road.lineBetween(WORLD / 2 - 7, p, WORLD / 2 - 7, p + 58); road.lineBetween(WORLD / 2 + 7, p, WORLD / 2 + 7, p + 58); }
    const city = this.add.container(0, 0).setDepth(-13);
    for (let x = 300; x < WORLD - 220; x += 430) {
      for (let y = 300; y < WORLD - 220; y += 390) {
        const inRoad = Math.abs(x - WORLD / 2) < 430 || Math.abs(y - WORLD / 2) < 430 || Math.abs(x - (WORLD / 2 - 1010)) < 230 || Math.abs(y - (WORLD / 2 - 1010)) < 230;
        if (inRoad) continue;
        const building = this.add.image(x, y, 'building').setAlpha(0.74 + ((x + y) % 3) * 0.06).setScale(0.72 + ((x / 430 + y / 390) % 3) * 0.12).setAngle(((x + y) % 5 - 2) * 1.5);
        city.add(building);
        if ((x + y) % 860 === 0) city.add(this.add.image(x + 86, y + 96, 'wreck').setAlpha(0.8).setScale(0.8));
      }
    }
    for (let i = 0; i < 46; i += 1) {
      const x = (i * 617) % (WORLD - 180) + 90; const y = (i * 383) % (WORLD - 180) + 90;
      const propKey = i % 9 === 0 ? 'tree' : i % 7 === 0 ? 'streetlight' : i % 5 === 0 ? 'wreck' : 'debris';
      const prop = this.add.image(x, y, propKey).setDepth(-10).setAlpha(propKey === 'tree' ? 0.64 : 0.5 + (i % 4) * 0.1).setScale(0.56 + (i % 3) * 0.18).setAngle((i * 37) % 360);
      if (Math.abs(x - WORLD / 2) < 380 || Math.abs(y - WORLD / 2) < 380) prop.setAlpha(0.25);
    }
    for (let i = 0; i < 18; i += 1) {
      const x = 180 + (i % 6) * ((WORLD - 360) / 5); const y = i < 6 ? 135 : i < 12 ? WORLD - 135 : 135 + ((i - 12) % 6) * ((WORLD - 360) / 5);
      this.add.image(x, y, 'barrier').setDepth(-8).setAlpha(0.6).setScale(1.2).setAngle(i < 12 ? 0 : 90);
    }
    const center = WORLD / 2;
    const skyline = [
      [center - 590, center - 520, -4], [center + 590, center - 520, 5], [center - 590, center + 520, 4], [center + 590, center + 520, -5],
      [center - 520, center - 650, 1], [center + 520, center + 650, -2], [center - 700, center + 120, 3], [center + 700, center - 120, -3]
    ];
    skyline.forEach(([x, y, angle]) => {
      this.add.image(x, y, 'building').setDepth(-12).setAlpha(0.8).setScale(0.84).setAngle(angle);
      this.add.image(x + (angle > 0 ? -76 : 76), y + 88, 'streetlight').setDepth(-11).setAlpha(0.7).setScale(0.85).setAngle(angle > 0 ? -2 : 2);
    });
    [[center - 440, center - 365, 10], [center + 460, center - 330, -18], [center - 430, center + 360, -8], [center + 410, center + 380, 13]].forEach(([x, y, angle]) => this.add.image(x, y, 'wreck').setDepth(-7).setAlpha(0.88).setScale(0.9).setAngle(angle));
    const edgeFog = this.add.graphics().setDepth(-2);
    edgeFog.fillStyle(0x071313, 0.18); edgeFog.fillRect(0, 0, WORLD, 300); edgeFog.fillRect(0, WORLD - 300, WORLD, 300); edgeFog.fillRect(0, 0, 300, WORLD); edgeFog.fillRect(WORLD - 300, 0, 300, WORLD);
    edgeFog.lineStyle(3, 0x42635b, 0.4); edgeFog.strokeRect(120, 120, WORLD - 240, WORLD - 240);
    const vignette = this.add.graphics().setDepth(80);
    vignette.fillStyle(0x020707, 0.14); vignette.fillRect(0, 0, WORLD, WORLD);
  }

  startRun(difficulty = 'normal') {
    this.difficulty = difficulty in DIFFICULTIES ? difficulty : 'normal';
    this.cleanupRun();
    this.mode = 'playing';
    this.elapsed = 0;
    this.timeLeft = 360;
    this.spawnClock = 0.2;
    this.nextBoss = 'butcher';
    this.bossEnemy = null;
    this.finalBossSpawned = false;
    this.bossesSpawned = [];
    this.kills = 0;
    this.score = 0;
    this.combo = 0;
    this.comboBest = 0;
    this.comboClock = 0;
    this.waveTextClock = 0;
    this.shotCooldown = 0;
    this.shotgunCooldown = 0;
    this.arcCooldown = 2.5;
    this.droneCooldown = 0;
    this.bladeTick = 0;
    this.fireZones = [];
    this.stats = { level: 1, xp: 0, nextXp: xpForLevel(1), damage: 25, fireRate: 0.34, pierce: 0, shotgunLevel: 0, droneCount: 0, arcLevel: 0, bladeCount: 0, napalmLevel: 0, maxHealth: 100, health: 100, speed: 235, dashCooldown: 4, dashTimer: 0, magnet: 86, xpValue: 1, armor: 0, medicLevel: 0, upgrades: {} };

    this.enemies = this.physics.add.group({ runChildUpdate: false });
    this.bullets = this.physics.add.group();
    this.enemyBullets = this.physics.add.group();
    this.xpDrops = this.physics.add.group();
    this.pickups = this.physics.add.group();
    this.player = this.physics.add.sprite(WORLD / 2, WORLD / 2, 'player').setDepth(8).setScale(0.82);
    this.player.body.setCircle(19, 29, 35); this.player.setCollideWorldBounds(false);
    this.createPlayerRig();
    this.physics.add.overlap(this.bullets, this.enemies, this.onBulletHit, undefined, this);
    this.physics.add.overlap(this.enemyBullets, this.player, this.onEnemyBulletHit, undefined, this);
    this.physics.add.overlap(this.player, this.enemies, this.onPlayerTouchEnemy, undefined, this);
    this.physics.add.overlap(this.player, this.xpDrops, this.onCollectXp, undefined, this);
    this.physics.add.overlap(this.player, this.pickups, this.onCollectPickup, undefined, this);
    this.cameras.main.startFollow(this.player, true, 0.09, 0.09);
    this.cameras.main.setZoom(Math.min(1.04, window.innerWidth < 700 ? 0.94 : 1.04));
    this.updateWeaponRack();
    this.showWave('隔离区失守 · 尸潮正在聚集');
    startMusic();
    blip('level');
  }

  cleanupRun() {
    this.enemies?.children.iterate((enemy) => enemy?.visual?.destroy());
    for (const groupName of ['enemies', 'bullets', 'enemyBullets', 'xpDrops', 'pickups']) {
      if (this[groupName]) this[groupName].clear(true, true);
    }
    this.fireZones?.forEach((zone) => zone.sprite?.destroy());
    this.fireZones = [];
    this.player?.destroy(); this.player = null;
    this.playerVisual?.destroy(); this.playerVisual = null; this.playerRig = null;
    this.droneSprites?.forEach((drone) => drone.destroy()); this.droneSprites = [];
    this.bladeSprites?.forEach((blade) => blade.destroy()); this.bladeSprites = [];
    this.bossEnemy = null;
    this.physics.world.resume();
    stopMusic();
  }

  update(time, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    this.lastFrame = time;
    if (this.mode !== 'playing' || !this.player?.active) return;
    this.elapsed += dt;
    this.timeLeft = Math.max(0, 360 - this.elapsed);
    this.comboClock -= dt;
    if (this.comboClock <= 0) this.combo = 0;
    this.stats.dashTimer = Math.max(0, this.stats.dashTimer - dt);
    this.spawnClock -= dt;
    this.shotCooldown -= dt; this.shotgunCooldown -= dt; this.arcCooldown -= dt; this.droneCooldown -= dt; this.bladeTick -= dt;
    this.updatePlayer(dt);
    this.updatePlayerVisual(dt, new Phaser.Math.Vector2(this.player.body.velocity.x, this.player.body.velocity.y));
    this.softenWorldBounds();
    this.updateEnemies(dt);
    this.updateWeapons(dt);
    this.updateDrops(dt);
    this.updateFireZones(dt);
    this.spawnDirector();
    if (this.elapsed >= 360 && !this.finalBossSpawned) this.spawnBoss('tyrant');
    this.updateHud();
    this.updateAtmosphere(dt);
    setMusicIntensity(clamp(0.16 + this.elapsed / 420 + (this.enemies.countActive(true) / 220) * 0.34 + (this.bossEnemy ? 0.3 : 0), 0.16, 1));
    if (this.stats.health <= 0) this.endRun(false);
  }

  updatePlayer(dt) {
    let x = 0; let y = 0;
    if (this.keys.A.isDown || this.keys.LEFT.isDown) x -= 1;
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) x += 1;
    if (this.keys.W.isDown || this.keys.UP.isDown) y -= 1;
    if (this.keys.S.isDown || this.keys.DOWN.isDown) y += 1;
    if (this.mobileVector.x || this.mobileVector.y) { x = this.mobileVector.x; y = this.mobileVector.y; }
    const move = new Phaser.Math.Vector2(x, y);
    if (move.lengthSq() > 1) move.normalize();
    const slow = Math.max(0, (this.player.getData('slow') || 0) - dt);
    this.player.setData('slow', slow);
    const speedMultiplier = slow > 0 ? 0.66 : 1;
    this.player.setVelocity(move.x * this.stats.speed * speedMultiplier, move.y * this.stats.speed * speedMultiplier);
    const target = this.closestEnemy(680);
    if (target) {
      const aim = Phaser.Math.Angle.Between(this.player.x, this.player.y, target.x, target.y);
      this.player.setData('aim', aim);
      if (this.shotCooldown <= 0) { this.fireRifle(target); this.shotCooldown = this.stats.fireRate; }
      if (this.stats.shotgunLevel > 0 && this.shotgunCooldown <= 0) { this.fireShotgun(target); this.shotgunCooldown = Math.max(0.72, 1.25 - this.stats.shotgunLevel * 0.08); }
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) this.pendingDash = true;
    if (this.pendingDash) { this.pendingDash = false; this.dash(move, target); }
    const invuln = Math.max(0, (this.player.getData('invuln') || 0) - dt); this.player.setData('invuln', invuln);
  }

  dash(move, target) {
    if (this.stats.dashTimer > 0) return;
    let dir = move.clone();
    if (dir.lengthSq() < 0.1 && target) dir = new Phaser.Math.Vector2(Math.cos(this.player.getData('aim') || 0), Math.sin(this.player.getData('aim') || 0));
    if (dir.lengthSq() < 0.1) dir.set(1, 0);
    dir.normalize();
    this.player.setVelocity(dir.x * 820, dir.y * 820);
    this.player.setData('invuln', 0.48);
    this.stats.dashTimer = this.stats.dashCooldown;
    this.cameras.main.shake(130, 0.006);
    this.burst(this.player.x, this.player.y, 0x67e4d5, 60);
    blip('dash');
  }

  fireRifle(target, from = this.player) {
    const bullet = this.bullets.create(from.x, from.y, 'bullet').setDepth(7).setScale(0.72);
    const angle = Phaser.Math.Angle.Between(from.x, from.y, target.x, target.y);
    bullet.damage = this.stats.damage; bullet.pierceLeft = this.stats.pierce; bullet.life = 1.2; bullet.kind = 'rifle';
    bullet.setRotation(angle); bullet.setVelocity(Math.cos(angle) * 770, Math.sin(angle) * 770);
    if (from === this.player) {
      this.player.setData('recoil', 6);
      const flash = this.add.image(from.x + Math.cos(angle) * 40, from.y + Math.sin(angle) * 40, 'muzzle').setDepth(12).setRotation(angle).setScale(0.48);
      this.tweens.add({ targets: flash, alpha: 0, scale: 0.18, duration: 70, onComplete: () => flash.destroy() });
    }
    this.burst(from.x + Math.cos(angle) * 23, from.y + Math.sin(angle) * 23, 0xffc46a, 14);
    blip('shot');
  }

  fireShotgun(target) {
    const count = 3 + this.stats.shotgunLevel;
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, target.x, target.y);
    for (let i = 0; i < count; i += 1) {
      const spread = (i - (count - 1) / 2) * 0.11;
      const bullet = this.bullets.create(this.player.x, this.player.y, 'bullet').setDepth(7).setScale(0.56);
      bullet.damage = this.stats.damage * 0.6; bullet.pierceLeft = 0; bullet.life = 0.55; bullet.kind = 'shotgun'; bullet.setRotation(angle + spread);
      bullet.setVelocity(Math.cos(angle + spread) * 650, Math.sin(angle + spread) * 650);
    }
    this.cameras.main.shake(90, 0.003); blip('hit');
  }

  updateEnemies(dt) {
    this.enemies.children.iterate((enemy) => {
      if (!enemy?.active) return;
      const def = enemy.isBoss ? BOSS_DEFS[enemy.enemyType] : ENEMY_DEFS[enemy.enemyType];
      if (!def) return;
      enemy.attackCooldown = Math.max(0, (enemy.attackCooldown || 0) - dt);
      enemy.touchCooldown = Math.max(0, (enemy.touchCooldown || 0) - dt);
      enemy.flash = Math.max(0, (enemy.flash || 0) - dt);
      if (enemy.flash > 0) enemy.setTint(0xffffff); else enemy.clearTint();
      const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
      if (enemy.isBoss) this.updateBoss(enemy, def, dt);
      else {
        const d = distance(enemy, this.player);
        if (enemy.enemyType === 'spitter' && d < 460 && d > 240) enemy.setVelocity(0, 0);
        else enemy.setVelocity(Math.cos(angle) * def.speed * enemy.speedScale, Math.sin(angle) * def.speed * enemy.speedScale);
        if (enemy.enemyType === 'spitter' && d < 480 && enemy.attackCooldown <= 0) { this.enemyShoot(enemy); enemy.attackCooldown = 2.7; }
        if (enemy.enemyType === 'screecher' && d < 340 && enemy.attackCooldown <= 0) { this.screech(enemy); enemy.attackCooldown = 4.6; }
      }
      this.updateEnemyVisual(enemy, dt, angle);
    });
  }

  updateBoss(enemy, def, dt) {
    const d = distance(enemy, this.player); const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
    if (enemy.enemyType === 'butcher' && d < 210) enemy.setVelocity(Math.cos(angle) * def.speed * 1.6, Math.sin(angle) * def.speed * 1.6);
    else enemy.setVelocity(Math.cos(angle) * def.speed, Math.sin(angle) * def.speed);
    if (enemy.attackCooldown <= 0) {
      if (enemy.enemyType === 'butcher') this.bossShockwave(enemy);
      else this.bossVolley(enemy);
      enemy.attackCooldown = enemy.enemyType === 'butcher' ? 3.3 : 2.4;
    }
    if (enemy.hp < enemy.maxHp * 0.5 && !enemy.enraged) { enemy.enraged = true; enemy.speedScale *= 1.35; this.showWave('首领暴走 · 火力全开'); this.cameras.main.shake(250, 0.012); blip('boss'); }
  }

  updateWeapons(dt) {
    this.bullets.children.iterate((bullet) => { if (bullet?.active) { bullet.life -= dt; if (bullet.life <= 0) bullet.destroy(); } });
    this.enemyBullets.children.iterate((bullet) => { if (bullet?.active) { bullet.life -= dt; if (bullet.life <= 0) bullet.destroy(); } });
    if (this.stats.droneCount > 0) {
      while (this.droneSprites.length < this.stats.droneCount) this.droneSprites.push(this.add.image(this.player.x, this.player.y, 'drone').setDepth(9));
      this.droneSprites.forEach((drone, index) => {
        const angle = this.elapsed * (0.75 + index * 0.11) + (TAU / this.stats.droneCount) * index;
        drone.x = this.player.x + Math.cos(angle) * (54 + this.stats.droneCount * 5); drone.y = this.player.y + Math.sin(angle) * (54 + this.stats.droneCount * 5); drone.rotation += dt * 4;
      });
      if (this.droneCooldown <= 0) {
        const target = this.closestEnemy(720, this.droneSprites[0]);
        if (target) this.droneSprites.forEach((drone) => this.fireRifle(target, drone));
        this.droneCooldown = 1.1;
      }
    }
    if (this.stats.bladeCount > 0) {
      while (this.bladeSprites.length < this.stats.bladeCount) this.bladeSprites.push(this.add.image(this.player.x, this.player.y, 'blade').setDepth(10));
      this.bladeSprites.forEach((blade, index) => { const angle = this.elapsed * 2.5 + index * TAU / this.stats.bladeCount; blade.x = this.player.x + Math.cos(angle) * (52 + this.stats.bladeCount * 5); blade.y = this.player.y + Math.sin(angle) * (52 + this.stats.bladeCount * 5); blade.rotation = angle + Math.PI / 2; });
      if (this.bladeTick <= 0) {
        this.enemies.children.iterate((enemy) => { if (enemy?.active && this.bladeSprites.some((blade) => distance(blade, enemy) < enemy.radius + 17)) this.damageEnemy(enemy, 42 + this.stats.bladeCount * 12, false); });
        this.bladeTick = 0.22;
      }
    }
    if (this.stats.arcLevel > 0 && this.arcCooldown <= 0) {
      const target = this.closestEnemy(840); if (target) this.arcStrike(target);
      this.arcCooldown = Math.max(1.6, 4.1 - this.stats.arcLevel * 0.42);
    }
  }

  updateDrops(dt) {
    this.xpDrops.children.iterate((drop) => { if (!drop?.active) return; const d = distance(drop, this.player); if (d < this.stats.magnet) this.physics.moveToObject(drop, this.player, 500); if (d < 24) this.onCollectXp(this.player, drop); drop.rotation += dt * 2.4; });
    this.pickups.children.iterate((drop) => { if (!drop?.active) return; if (distance(drop, this.player) < 30) this.onCollectPickup(this.player, drop); });
  }

  updateFireZones(dt) {
    this.fireZones = this.fireZones.filter((zone) => {
      zone.time -= dt; zone.sprite.setAlpha(0.34 + Math.sin(this.elapsed * 8 + zone.x) * 0.08); zone.sprite.rotation += dt * 0.3;
      if (zone.tick <= 0) { this.enemies.children.iterate((enemy) => { if (enemy?.active && Phaser.Math.Distance.Between(zone.x, zone.y, enemy.x, enemy.y) < zone.radius + enemy.radius) this.damageEnemy(enemy, 12 + this.stats.napalmLevel * 8, false); }); zone.tick = 0.42; } else zone.tick -= dt;
      if (zone.time <= 0) { zone.sprite.destroy(); return false; } return true;
    });
  }

  spawnDirector() {
    const profile = threatAt(this.elapsed, this.difficulty);
    if (this.spawnClock <= 0 && this.enemies.countActive(true) < 175 && !this.finalBossSpawned) {
      const pack = 1 + Math.floor(Math.random() * profile.packSize);
      for (let i = 0; i < pack; i += 1) this.spawnEnemy(pickEnemyType(this.elapsed));
      this.spawnClock = profile.spawnRate;
    }
    if (this.elapsed >= 170 && this.nextBoss === 'butcher') this.spawnBoss('butcher');
    if (this.elapsed > 250 && this.bossesSpawned.includes('butcher') && !this.bossEnemy && this.waveTextClock <= 0) this.showWave('尸潮加剧 · 远处传来低吼');
    this.waveTextClock -= 1 / 60;
  }

  spawnEnemy(type) {
    const def = ENEMY_DEFS[type]; const angle = Math.random() * TAU; const radius = 720 + Math.random() * 380;
    const x = clamp(this.player.x + Math.cos(angle) * radius, 90, WORLD - 90); const y = clamp(this.player.y + Math.sin(angle) * radius, 90, WORLD - 90);
    const enemy = this.enemies.create(x, y, `enemy-${type}`).setDepth(5).setScale(def.radius / 26);
    this.createEnemyVisual(enemy, type, def);
    enemy.enemyType = type; enemy.radius = def.radius; enemy.maxHp = def.hp * threatAt(this.elapsed, this.difficulty).hpScale; enemy.hp = enemy.maxHp; enemy.speedScale = threatAt(this.elapsed, this.difficulty).speedScale; enemy.attackCooldown = 1 + Math.random() * 2; enemy.body.setCircle(def.radius * 0.78, 48 - def.radius * 0.78, 48 - def.radius * 0.78); enemy.setData('id', `${this.elapsed}-${Math.random()}`);
    return enemy;
  }

  spawnBoss(kind) {
    if (this.bossesSpawned.includes(kind)) return;
    const def = BOSS_DEFS[kind]; const angle = kind === 'tyrant' ? 0 : Math.PI; const x = clamp(this.player.x + Math.cos(angle) * 720, 110, WORLD - 110); const y = clamp(this.player.y + Math.sin(angle) * 720, 110, WORLD - 110);
    const boss = this.enemies.create(x, y, `boss-${kind}`).setDepth(6).setScale(kind === 'tyrant' ? 0.92 : 0.8);
    this.createEnemyVisual(boss, kind, def);
    boss.enemyType = kind; boss.isBoss = true; boss.radius = def.radius; boss.maxHp = def.hp * (this.difficulty === 'frenzy' ? 1.18 : 1); boss.hp = boss.maxHp; boss.speedScale = 1; boss.attackCooldown = 2; boss.enraged = false; boss.body.setCircle(def.radius * 0.8, 80 - def.radius * 0.8, 80 - def.radius * 0.8);
    this.bossEnemy = boss; this.bossesSpawned.push(kind); if (kind === 'butcher') this.nextBoss = null; else this.finalBossSpawned = true;
    this.showWave(kind === 'tyrant' ? '终局首领出现 · 母巢暴君' : '首领来袭 · 疫变屠夫'); blip('boss');
  }

  enemyShoot(enemy) {
    const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y); const bullet = this.enemyBullets.create(enemy.x, enemy.y, 'acid').setDepth(6).setScale(0.74); bullet.life = 2.2; bullet.setVelocity(Math.cos(angle) * 230, Math.sin(angle) * 230);
  }

  screech(enemy) { this.cameras.main.shake(130, 0.004); this.burst(enemy.x, enemy.y, 0xdcb86e, 90); this.player.setData('slow', 1.4); }
  bossShockwave(enemy) { this.burst(enemy.x, enemy.y, 0xff6f4e, 190); if (distance(enemy, this.player) < 235) this.damagePlayer(28); }
  bossVolley(enemy) { for (let i = 0; i < 10; i += 1) { const angle = TAU * i / 10 + this.elapsed * 0.4; const bullet = this.enemyBullets.create(enemy.x, enemy.y, 'acid').setDepth(6).setScale(0.85); bullet.life = 3; bullet.setVelocity(Math.cos(angle) * 250, Math.sin(angle) * 250); } this.cameras.main.shake(120, 0.006); }

  onBulletHit(bullet, enemy) { if (!bullet.active || !enemy.active) return; this.damageEnemy(enemy, bullet.damage, true); bullet.pierceLeft -= 1; if (bullet.pierceLeft < 0) bullet.destroy(); }
  onEnemyBulletHit(_player, bullet) { if (!bullet.active) return; bullet.destroy(); this.damagePlayer(14); }
  onPlayerTouchEnemy(player, enemy) { if (!enemy.active || enemy.touchCooldown > 0) return; enemy.touchCooldown = enemy.isBoss ? 1.1 : 0.72; this.damagePlayer((enemy.isBoss ? BOSS_DEFS[enemy.enemyType] : ENEMY_DEFS[enemy.enemyType]).damage); const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y); enemy.setVelocity(Math.cos(angle) * -180, Math.sin(angle) * -180); }

  damagePlayer(amount) { if (!this.player?.active || this.player.getData('invuln') > 0) return; const reduced = Math.max(1, amount * (1 - this.stats.armor)); this.stats.health = Math.max(0, this.stats.health - reduced); this.player.setData('invuln', 0.62); this.burst(this.player.x, this.player.y, 0xff5e5e, 55); document.getElementById('damage-flash')?.classList.add('is-active'); setTimeout(() => document.getElementById('damage-flash')?.classList.remove('is-active'), 90); this.cameras.main.shake(140, 0.008); blip('hit'); }

  damageEnemy(enemy, amount, canCrit = true) {
    if (!enemy?.active) return;
    const critical = canCrit && Math.random() < 0.09; const dealt = amount * (critical ? 1.75 : 1); enemy.hp -= dealt; enemy.flash = 0.075; this.burst(enemy.x, enemy.y, critical ? 0xffe28a : 0x7ee5d4, critical ? 22 : 12);
    if (critical) this.floatText(enemy.x, enemy.y - 24, Math.round(dealt).toString(), '#ffe29a');
    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  killEnemy(enemy) {
    if (!enemy.active) return; const def = enemy.isBoss ? BOSS_DEFS[enemy.enemyType] : ENEMY_DEFS[enemy.enemyType];
    enemy.disableBody(true, true); enemy.visual?.destroy(); enemy.visual = null; this.kills += 1; this.score += def.score * (1 + Math.min(4, this.combo / 12)); this.combo += 1; this.comboBest = Math.max(this.comboBest, this.combo); this.comboClock = 2.5; this.burst(enemy.x, enemy.y, enemy.isBoss ? 0xf26a57 : def.tint, enemy.isBoss ? 180 : 48); if (enemy.isBoss) { this.bossEnemy = null; this.showWave(enemy.enemyType === 'tyrant' ? '撤离通道开启 · 你赢了' : '首领已清除 · 尸潮还在增殖'); if (enemy.enemyType === 'tyrant') { this.endRun(true); return; } }
    this.spawnXp(enemy.x, enemy.y, Math.round(def.xp * this.stats.xpValue));
    if (!enemy.isBoss && (enemy.enemyType === 'bloater' || Math.random() < 0.08 + this.stats.napalmLevel * 0.025)) this.makeFireZone(enemy.x, enemy.y);
    if (!enemy.isBoss && Math.random() < 0.018) this.spawnPickup(enemy.x, enemy.y, 'medkit');
    if (this.stats.medicLevel > 0 && this.kills % 12 === 0) this.stats.health = Math.min(this.stats.maxHealth, this.stats.health + 6 * this.stats.medicLevel);
  }

  spawnXp(x, y, value) { const drop = this.xpDrops.create(x, y, 'xp').setDepth(3).setScale(0.5 + Math.min(0.5, value / 60)); drop.value = value; drop.setVelocity((Math.random() - 0.5) * 90, (Math.random() - 0.5) * 90); }
  spawnPickup(x, y, type) { const drop = this.pickups.create(x, y, type).setDepth(4); drop.pickupType = type; }
  onCollectXp(_player, drop) { if (!drop?.active) return; const value = drop.value || 5; drop.destroy(); this.stats.xp += value; while (this.stats.xp >= this.stats.nextXp) { this.stats.xp -= this.stats.nextXp; this.stats.level += 1; this.stats.nextXp = xpForLevel(this.stats.level); this.levelUp(); } }
  onCollectPickup(_player, drop) { if (!drop?.active) return; if (drop.pickupType === 'medkit') this.stats.health = Math.min(this.stats.maxHealth, this.stats.health + this.stats.maxHealth * 0.24); drop.destroy(); this.burst(this.player.x, this.player.y, 0x70e0bc, 70); blip('level'); }

  makeFireZone(x, y) { if (this.stats.napalmLevel <= 0) return; const sprite = this.add.image(x, y, 'fire-zone').setDepth(2).setScale(0.72 + this.stats.napalmLevel * 0.08); this.fireZones.push({ x, y, radius: 54 + this.stats.napalmLevel * 9, sprite, time: 4.5 + this.stats.napalmLevel * 0.6, tick: 0 }); }
  arcStrike(target) { const points = []; const origin = { x: this.player.x, y: this.player.y }; points.push(origin); let current = target; const hit = new Set(); for (let i = 0; i < 2 + this.stats.arcLevel; i += 1) { if (!current || hit.has(current)) break; hit.add(current); points.push({ x: current.x, y: current.y }); this.damageEnemy(current, 48 + this.stats.arcLevel * 26, false); current = this.closestEnemy(230, current, hit); } const lightning = this.add.graphics().setDepth(12); lightning.lineStyle(3, 0xb8f5ff, 0.95); lightning.beginPath(); points.forEach((point, index) => { if (index === 0) lightning.moveTo(point.x, point.y); else lightning.lineTo(point.x, point.y); }); lightning.strokePath(); this.tweens.add({ targets: lightning, alpha: 0, duration: 180, onComplete: () => lightning.destroy() }); this.cameras.main.shake(120, 0.004); blip('dash'); }

  closestEnemy(range = Infinity, from = this.player, exclude = new Set()) { let best = null; let bestDistance = range; this.enemies?.children.iterate((enemy) => { if (!enemy?.active || exclude.has(enemy)) return; const d = distance(from, enemy); if (d < bestDistance) { best = enemy; bestDistance = d; } }); return best; }

  levelUp() { if (this.mode !== 'playing') return; this.mode = 'upgrade'; this.physics.world.pause(); this.currentChoices = makeUpgradeChoices(this.stats.upgrades); window.showUpgradeChoices?.(this.currentChoices); blip('level'); }
  chooseUpgrade(id) { if (this.mode !== 'upgrade' || !this.currentChoices?.some((item) => item.id === id)) return; this.stats = applyUpgrade(this.stats, id); this.currentChoices = null; this.mode = 'playing'; this.physics.world.resume(); window.hideUpgradeChoices?.(); this.updateWeaponRack(); this.burst(this.player.x, this.player.y, 0x83f3dd, 110); }

  pauseRun() { if (this.mode !== 'playing') return; this.mode = 'paused'; this.physics.world.pause(); window.showPause?.(); }
  resumeRun() { if (this.mode !== 'paused') return; this.mode = 'playing'; this.physics.world.resume(); window.hidePause?.(); }
  goHome() { this.cleanupRun(); this.mode = 'title'; this.cameras.main.stopFollow(); this.cameras.main.centerOn(WORLD / 2, WORLD / 2); window.showTitle?.(); }

  endRun(victory) { if (this.mode === 'result') return; this.mode = 'result'; this.physics.world.pause(); stopMusic(); const result = { victory, elapsed: this.elapsed, kills: this.kills, level: this.stats.level, combo: this.comboBest, score: this.score }; window.showResult?.(result); this.saveBest(result); if (victory) { this.burst(this.player.x, this.player.y, 0x8fffe5, 230); blip('level'); } }
  saveBest(result) { const key = 'dead-tide-best'; const old = JSON.parse(localStorage.getItem(key) || 'null'); if (!old || result.elapsed > old.elapsed || (result.elapsed === old.elapsed && result.kills > old.kills)) localStorage.setItem(key, JSON.stringify(result)); }
  showWave(text) { this.waveTextClock = 3; window.showWave?.(text); }
  updateHud() { window.updateHud?.({ stats: this.stats, timeLeft: this.timeLeft, kills: this.kills, combo: this.combo, comboBest: this.comboBest, boss: this.bossEnemy ? { name: BOSS_DEFS[this.bossEnemy.enemyType].name, hp: this.bossEnemy.hp, maxHp: this.bossEnemy.maxHp } : null, dash: this.stats.dashTimer / this.stats.dashCooldown }); }
  updateWeaponRack() { window.updateWeaponRack?.(this.stats); }
  burst(x, y, color, size) { const ring = this.add.circle(x, y, 4, color, 0.75).setDepth(14); this.tweens.add({ targets: ring, radius: size, alpha: 0, duration: 190, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() }); }
  floatText(x, y, text, color) { const label = this.add.text(x, y, text, { fontFamily: 'Arial Black, sans-serif', fontSize: '18px', color, stroke: '#061011', strokeThickness: 5 }).setOrigin(0.5).setDepth(15); this.tweens.add({ targets: label, y: y - 32, alpha: 0, duration: 520, onComplete: () => label.destroy() }); }
  getDebugState() { return { mode: this.mode, elapsed: this.elapsed, timeLeft: this.timeLeft, kills: this.kills, enemies: this.enemies?.countActive(true) || 0, boss: this.bossEnemy?.enemyType || null, stats: this.stats ? { level: this.stats.level, xp: this.stats.xp, health: this.stats.health, maxHealth: this.stats.maxHealth, upgrades: { ...this.stats.upgrades } } : null }; }
}
