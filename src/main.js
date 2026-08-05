import Phaser from 'phaser';
import { createIcons, icons } from 'lucide';
import { GameScene } from './game/GameScene.js';
import { UPGRADE_DEFS } from './game/data.js';
import { isMuted, setMuted } from './game/audio.js';
import './styles.css';

const $ = (id) => document.getElementById(id);
const titleScreen = $('title-screen');
const hud = $('hud');
const upgradeScreen = $('upgrade-screen');
const pauseScreen = $('pause-screen');
const resultScreen = $('result-screen');
const difficultyButtons = [...document.querySelectorAll('.difficulty__item')];
let difficulty = 'normal';

function visible(el, value) { el?.classList.toggle('is-hidden', !value); }
function renderIcons() { createIcons({ icons }); }
function formatTime(seconds) { const safe = Math.max(0, Math.floor(seconds || 0)); return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`; }

const config = {
  type: Phaser.AUTO,
  parent: 'game-canvas',
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#07110f',
  antialias: true,
  render: { powerPreference: 'high-performance' },
  scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false, fps: 60 } },
  scene: [GameScene]
};
const game = new Phaser.Game(config);

function showTitle() { visible(titleScreen, true); visible(hud, false); visible(upgradeScreen, false); visible(pauseScreen, false); visible(resultScreen, false); updateBestRun(); }
function showBattle() { visible(titleScreen, false); visible(hud, true); visible(upgradeScreen, false); visible(pauseScreen, false); visible(resultScreen, false); }
window.showTitle = showTitle;
window.showBattle = showBattle;

function updateBestRun() {
  const best = JSON.parse(localStorage.getItem('dead-tide-best') || 'null');
  $('best-run').textContent = best ? `最佳纪录 ${formatTime(best.elapsed)} · ${best.kills} 击杀` : '最佳纪录 00:00 · 0 击杀';
}

function showUpgradeChoices(choices) {
  visible(upgradeScreen, true);
  const host = $('upgrade-options');
  host.replaceChildren();
  choices.forEach((choice, index) => {
    const button = document.createElement('button');
    button.className = 'upgrade-card';
    button.dataset.upgradeId = choice.id;
    button.style.setProperty('--accent', choice.color);
    const owned = window.gameApi?.getState?.().stats?.upgrades?.[choice.id] || 0;
    button.innerHTML = `<span class="upgrade-card__index">0${index + 1}</span><span class="upgrade-card__icon"><i data-lucide="${choice.icon}"></i></span><span class="upgrade-card__tag">${choice.tag} · LV.${owned + 1}</span><strong>${choice.name}</strong><p>${choice.desc}</p><span class="upgrade-card__arrow"><i data-lucide="arrow-up-right"></i></span>`;
    button.addEventListener('click', () => window.gameApi?.chooseUpgrade(choice.id));
    host.appendChild(button);
  });
  renderIcons();
}
function hideUpgradeChoices() { visible(upgradeScreen, false); }
window.showUpgradeChoices = showUpgradeChoices;
window.hideUpgradeChoices = hideUpgradeChoices;

function showPause() { visible(pauseScreen, true); }
function hidePause() { visible(pauseScreen, false); }
window.showPause = showPause;
window.hidePause = hidePause;

function showWave(text) {
  const banner = $('wave-banner'); banner.textContent = text; banner.classList.remove('is-visible'); void banner.offsetWidth; banner.classList.add('is-visible');
}
window.showWave = showWave;

function updateHud({ stats, timeLeft, kills, combo, boss, dash }) {
  $('level-label').textContent = stats.level;
  $('health-label').textContent = `${Math.ceil(stats.health)} / ${stats.maxHealth}`;
  $('health-fill').style.width = `${Math.max(0, stats.health / stats.maxHealth) * 100}%`;
  $('xp-fill').style.width = `${Math.max(0, stats.xp / stats.nextXp) * 100}%`;
  $('timer-label').textContent = formatTime(timeLeft);
  $('phase-label').textContent = timeLeft <= 0 ? '终局撤离' : timeLeft <= 190 ? '红区警报' : '封锁线';
  $('kill-label').textContent = kills;
  $('combo').classList.toggle('is-hot', combo >= 8);
  $('combo').querySelector('strong').textContent = combo;
  $('combo').querySelector('b').textContent = `x${(1 + Math.min(4, combo / 12)).toFixed(1)}`;
  $('dash-fill').style.width = `${Math.max(0, 1 - dash) * 100}%`;
  const bossWrap = $('boss-wrap');
  visible(bossWrap, !!boss);
  if (boss) { $('boss-name').textContent = boss.name; $('boss-health-label').textContent = `${Math.ceil(Math.max(0, boss.hp / boss.maxHp) * 100)}%`; $('boss-fill').style.width = `${Math.max(0, boss.hp / boss.maxHp) * 100}%`; }
}
window.updateHud = updateHud;

function updateWeaponRack(stats) {
  const rack = $('weapon-rack');
  const entries = [
    ['rifle', 'crosshair', '步枪'], ['shotgun', 'bomb', '霰弹'], ['drone', 'bot', '僚机'], ['arc', 'activity', '电弧'], ['blades', 'orbit', '旋刃'], ['napalm', 'flame', '燃烧']
  ];
  rack.replaceChildren();
  entries.forEach(([id, icon, label]) => {
    const level = stats.upgrades[id] || 0;
    if (!level) return;
    const item = document.createElement('span'); item.className = 'weapon-chip'; item.title = label; item.innerHTML = `<i data-lucide="${icon}"></i><b>${level}</b>`; rack.appendChild(item);
  });
  renderIcons();
}
window.updateWeaponRack = updateWeaponRack;

function showResult(result) {
  visible(hud, false); visible(pauseScreen, false); visible(upgradeScreen, false); visible(resultScreen, true);
  $('result-kicker').textContent = result.victory ? '撤离成功' : '行动结束';
  $('result-title').textContent = result.victory ? '你撕开了尸潮' : '你被尸潮吞没';
  $('result-time').textContent = formatTime(result.elapsed); $('result-kills').textContent = result.kills; $('result-level').textContent = result.level; $('result-combo').textContent = result.combo;
  updateBestRun();
}
window.showResult = showResult;

difficultyButtons.forEach((button) => button.addEventListener('click', () => { difficulty = button.dataset.difficulty; difficultyButtons.forEach((item) => item.classList.toggle('is-active', item === button)); }));
$('start-button').addEventListener('click', () => { showBattle(); window.gameApi?.start(difficulty); });
$('restart-button').addEventListener('click', () => { showBattle(); window.gameApi?.restart(); });
$('restart-button-pause').addEventListener('click', () => { hidePause(); showBattle(); window.gameApi?.restart(); });
$('home-button').addEventListener('click', () => { window.gameApi?.home(); });
$('resume-button').addEventListener('click', () => { window.gameApi?.resume(); });
$('pause-button').addEventListener('click', () => { window.gameApi?.pause(); });
$('mute-button').addEventListener('click', () => { const next = !isMuted(); setMuted(next); $('mute-button').innerHTML = `<i data-lucide="${next ? 'volume-x' : 'volume-2'}"></i>`; $('mute-button').setAttribute('aria-label', next ? '取消静音' : '静音'); renderIcons(); });

const joystick = $('joystick'); const knob = $('joystick-knob'); const dashButton = $('dash-button'); let joystickPointer = null;
function updateJoystick(event) { const rect = joystick.getBoundingClientRect(); const dx = event.clientX - (rect.left + rect.width / 2); const dy = event.clientY - (rect.top + rect.height / 2); const max = rect.width * 0.34; const length = Math.hypot(dx, dy); const scale = Math.min(1, max / Math.max(1, length)); const x = dx * scale; const y = dy * scale; knob.style.transform = `translate(${x}px, ${y}px)`; if (window.gameApi && window.__gameDebug?.scene) window.__gameDebug.scene.mobileVector = { x: x / max, y: y / max }; }
joystick.addEventListener('pointerdown', (event) => { joystickPointer = event.pointerId; joystick.setPointerCapture(event.pointerId); updateJoystick(event); });
joystick.addEventListener('pointermove', (event) => { if (event.pointerId === joystickPointer) updateJoystick(event); });
function releaseJoystick() { joystickPointer = null; knob.style.transform = 'translate(0, 0)'; if (window.__gameDebug?.scene) window.__gameDebug.scene.mobileVector = { x: 0, y: 0 }; }
joystick.addEventListener('pointerup', releaseJoystick); joystick.addEventListener('pointercancel', releaseJoystick); joystick.addEventListener('lostpointercapture', releaseJoystick);
dashButton.addEventListener('pointerdown', () => window.gameApi?.dash());

document.addEventListener('visibilitychange', () => { if (document.hidden && window.__gameDebug?.scene?.mode === 'playing') window.gameApi?.pause(); });
window.addEventListener('resize', () => { if (window.__gameDebug?.scene) window.__gameDebug.scene.cameras.main.setZoom(Math.min(1.04, window.innerWidth < 700 ? 0.94 : 1.04)); });

renderIcons(); updateBestRun();
if (new URLSearchParams(location.search).has('autostart')) { setTimeout(() => { showBattle(); window.gameApi?.start('normal'); }, 100); }
