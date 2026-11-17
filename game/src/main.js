// SOLMARA — boot and the one loop. The game moves between four screens (title,
// playing, paused, over); every frame it reads input, advances the world in
// fixed 1/60 s steps, and paints. The same file stages the four screenshots
// (?shot=start|play|chase|mission with &seed=N), paints twice and sets
// window.__shotReady, and exposes a small window.__solmara handle so automated
// tests can drive the game without a real keyboard.
import * as THREE from 'three';
import {
  CAR_TOP_SPEED, PLAYER_HEALTH, RUN_SPEED, SAVE_KEY, SEED_DEFAULT, SHOT_DAMAGE,
  SHOT_RANGE, SPAWN, WALK_SPEED, HEAT_HIT_PED, HEAT_STEAL_CAR,
} from './config.js';
import { createRandom, clamp, dist2d, money } from './random.js';
import { ACTION, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createCity, resolveCircleVsColliders } from './city.js';
import { createVehicles } from './vehicles.js';
import { createPeople, makePlayerMesh } from './people.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : SEED_DEFAULT;
const testMode = params.get('test') === '1';

const canvas = document.getElementById('scene');
const hud = createHud();
const input = createInput(canvas);
const audio = createAudio();
const random = createRandom(seed);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9fc3d8, 220, 700);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

const city = createCity(random);
scene.add(city.group);
const vehicles = createVehicles(scene, random, city);
const people = createPeople(scene, random, city);
const police = createPolice(scene, random, city);

// --- the player -----------------------------------------------------------------
const playerMesh = makePlayerMesh();
scene.add(playerMesh);
const player = {
  x: SPAWN.x, z: SPAWN.z, heading: Math.PI,
  health: PLAYER_HEALTH, cash: 0,
  inCar: null, // the car object when driving, else null
  walkPhase: 0,
  lastHurt: -99,
  dead: false,
};
let screen = 'title'; // title | playing | paused | over
let cameraYaw = Math.PI;
let cameraPitch = 0.32;
let cameraDist = 11;
let lastDragAt = -99;
let time = 0;
let saveTimer = 0;
let shotTimer = 0;

// --- shooting ---------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 });
let tracer = null;
let tracerLife = 0;

function shootables() {
  const list = [];
  for (const g of people.gangsters) if (g.state !== 'down') list.push({ mesh: g.mesh, ref: g, kind: 'gangster' });
  for (const c of police.footCops) if (c.state !== 'down') list.push({ mesh: c.mesh, ref: c, kind: 'cop' });
  for (const p of people.peds) if (p.state !== 'down') list.push({ mesh: p.mesh, ref: p, kind: 'ped' });
  return list;
}

function fireWeapon(fromPos, direction, shooter) {
  audio.shot();
  raycaster.set(fromPos, direction);
  raycaster.far = SHOT_RANGE;
  const targets = shootables().map((s) => s.mesh);
  const hits = raycaster.intersectObjects(targets, true);
  // Muzzle flash: a short tracer line from the shooter to the hit (or max range).
  const end = hits.length > 0 ? hits[0].point : fromPos.clone().add(direction.clone().multiplyScalar(SHOT_RANGE));
  if (tracer) scene.remove(tracer);
  const geo = new THREE.BufferGeometry().setFromPoints([fromPos, end]);
  tracer = new THREE.Line(geo, tracerMat);
  scene.add(tracer);
  tracerLife = 0.08;
  if (hits.length === 0) return;
  // Walk up from the hit mesh until we reach one of the shootable people.
  const entries = shootables();
  for (const hit of hits) {
    let node = hit.object;
    while (node) {
      const entry = entries.find((s) => s.mesh === node);
      if (entry) { hurtPerson(entry, shooter); return; }
      node = node.parent;
    }
  }
}

function hurtPerson(entry, shooter) {
  const target = entry.ref;
  target.health -= SHOT_DAMAGE;
  if (entry.kind === 'ped') {
    police.addHeat(HEAT_HIT_PED);
    people.stepPeds(0, { x: player.x, z: player.z, radius: 40 }, city.colliders);
    if (target.health <= 0) people.knockDown(target);
    return;
  }
  if (target.health <= 0) {
    if (entry.kind === 'gangster') {
      people.knockDown(target);
      missions.noteEliminated();
      hud.toast('Breaker down!', 1600);
    } else {
      target.state = 'down';
      target.mesh.rotation.x = -Math.PI / 2;
      target.mesh.position.y = 0.4;
      police.crimeForKill(true);
      hud.toast('You shot a cop — the whole city heard that.', 2200);
    }
  }
}

// --- missions -----------------------------------------------------------------------
const missions = createMissions(scene, (event) => {
  if (event.type === 'missionComplete') {
    player.cash += event.payout;
    audio.cash();
    hud.toast(`${event.mission.title} — PAID ${money(event.payout)}`, 3200);
    hud.announce(`${event.mission.title} complete. Paid ${money(event.payout)}.`);
    police.clearAll();
    police.setWanted(0);
    saveGame();
  } else if (event.type === 'storyComplete') {
    hud.toast('SOLMARA LEGEND — all three jobs done!', 4000);
  } else if (event.type === 'heat') {
    police.addHeat(event.amount);
  } else if (event.type === 'missionStart') {
    hud.toast(event.mission.brief, 4200);
  } else if (event.type === 'stepComplete') {
    audio.pickup();
  }
});

// --- save / load ----------------------------------------------------------------------
function saveGame() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: player.cash,
      mission: missions.missionIndex,
      step: missions.stepIndex,
      health: player.health,
      x: player.x, z: player.z,
      wanted: police.wanted,
    }));
  } catch { /* private windows: the save lasts this visit only */ }
}

function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.mission !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

function applySave(data) {
  player.cash = data.cash || 0;
  player.health = data.health || PLAYER_HEALTH;
  player.x = data.x ?? SPAWN.x;
  player.z = data.z ?? SPAWN.z;
  missions.restore(data.mission || 0, data.step || 0);
  police.setWanted(data.wanted || 0);
}

const existingSave = loadGame();
if (existingSave) {
  document.getElementById('saveNote').textContent =
    `Save found: ${money(existingSave.cash)} · Job ${Math.min(existingSave.mission + 1, 3)} of 3 — press START ENGINE to continue.`;
}

function newGame() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
  player.cash = 0;
  player.health = PLAYER_HEALTH;
  player.x = SPAWN.x;
  player.z = SPAWN.z;
  player.heading = Math.PI;
  player.inCar = null;
  missions.restore(0, 0);
  police.setWanted(0);
  police.clearAll();
}

function startPlaying() {
  audio.unlock();
  audio.startMusic();
  screen = 'playing';
  hud.showScreen(null);
  hud.announce('SOLMARA. Follow the yellow marker.');
}

document.getElementById('playBtn').addEventListener('click', () => {
  if (existingSave && player.cash === 0 && missions.missionIndex === 0) applySave(existingSave);
  startPlaying();
});
document.getElementById('resumeBtn').addEventListener('click', () => {
  screen = 'playing';
  hud.showScreen(null);
});
document.getElementById('retryBtn').addEventListener('click', () => {
  player.health = PLAYER_HEALTH;
  player.x = SPAWN.x;
  player.z = SPAWN.z;
  player.inCar = null;
  player.dead = false;
  police.clearAll();
  police.setWanted(0);
  screen = 'playing';
  hud.showScreen(null);
  hud.toast('Back on the street. Lena is waiting.', 2600);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
window.addEventListener('beforeunload', saveGame);

// --- per-frame world step -------------------------------------------------------------
function hurtPlayer(amount) {
  if (player.dead) return;
  player.health -= amount;
  player.lastHurt = time;
  if (player.health <= 0) {
    player.health = 0;
    player.dead = true;
    const fine = Math.floor(player.cash * 0.1);
    player.cash -= fine;
    screen = 'over';
    document.getElementById('endTitle').textContent = 'WASTED';
    document.getElementById('endText').textContent =
      `The Solmara PD scraped you off the asphalt. Hospital bill: ${money(fine)}. Lena still has work for you — if you still have the nerve.`;
    hud.showScreen('endScreen');
    audio.stopMusic();
    saveGame();
  }
}

function stepPlayer(dt) {
  const axis = input.axis();
  const running = input.down(ACTION.RUN);
  if (player.inCar) {
    const speedRatio = vehicles.drivePlayer(player.inCar, input, dt, city.colliders);
    audio.engine(speedRatio, true);
    player.x = player.inCar.x;
    player.z = player.inCar.z;
    player.heading = player.inCar.heading;
    playerMesh.position.set(player.x, 0, player.z);
    playerMesh.rotation.y = player.heading;
    playerMesh.visible = false;
    if (input.wasPressed(ACTION.EXIT)) {
      const car = player.inCar;
      player.inCar = null;
      vehicles.releaseCar(car);
      player.x = car.x - Math.sin(car.heading + Math.PI / 2) * 3;
      player.z = car.z - Math.cos(car.heading + Math.PI / 2) * 3;
      playerMesh.visible = true;
      audio.engine(0, false);
      hud.toast('On foot. Watch the traffic.', 1400);
    }
    return;
  }
  audio.engine(0, false);
  const speed = running ? RUN_SPEED : WALK_SPEED;
  const moving = axis.x !== 0 || axis.y !== 0;
  if (moving) {
    // Movement is relative to the camera, not the character: W walks away from
    // the camera, D strafes to the screen's right.
    const moveAngle = cameraYaw + Math.atan2(-axis.x, axis.y);
    player.heading = moveAngle;
    const nx = player.x + Math.sin(moveAngle) * speed * dt;
    const nz = player.z + Math.cos(moveAngle) * speed * dt;
    const resolved = resolveCircleVsColliders(nx, nz, 0.7, city.colliders);
    player.x = resolved.x;
    player.z = resolved.z;
    player.walkPhase += dt * (running ? 13 : 9);
    const swing = Math.sin(player.walkPhase) * 0.5;
    const u = playerMesh.userData;
    u.legL.rotation.x = swing;
    u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.8;
    u.armR.rotation.x = swing * 0.8;
  } else {
    const u = playerMesh.userData;
    u.legL.rotation.x *= 0.8;
    u.legR.rotation.x *= 0.8;
    u.armL.rotation.x *= 0.8;
    u.armR.rotation.x *= 0.8;
  }
  playerMesh.position.set(player.x, 0, player.z);
  playerMesh.rotation.y = player.heading;
  // Slow health regen after 8 calm seconds.
  if (time - player.lastHurt > 8 && player.health < PLAYER_HEALTH) {
    player.health = Math.min(PLAYER_HEALTH, player.health + 2 * dt);
  }

  // Steal a car with E. Parked cars are free; yanking a driver out is a crime.
  // Only consume the press when a car is actually in reach, so the same key
  // can also grab a mission package when no car is near.
  if (input.peekPressed(ACTION.INTERACT)) {
    const car = vehicles.nearestStealable(player.x, player.z, 4.5);
    if (car) {
      input.wasPressed(ACTION.INTERACT);
      if (car.kind === 'traffic') {
        police.addHeat(HEAT_STEAL_CAR);
        hud.toast('You yanked the driver out! ★ Wanted level up.', 2200);
        audio.crash();
      } else {
        hud.toast(`${car.model.name} — yours now.`, 1600);
      }
      car.kind = 'player';
      car.occupied = true;
      player.inCar = car;
      player.x = car.x;
      player.z = car.z;
      audio.blip();
    }
  }
}

function stepWorld(dt) {
  time += dt;
  stepPlayer(dt);
  // Read the interact press AFTER the player step: stealing a car consumes it
  // first, and only a press the player step did not use reaches the missions.
  const interactPressed = input.wasPressed(ACTION.INTERACT);
  vehicles.stepTraffic(dt, player.inCar, city.colliders);
  const danger = tracerLife > 0 ? { x: player.x, z: player.z, radius: 30 } : null;
  people.stepPeds(dt, danger, city.colliders);
  people.stepGangsters(dt, player, (gangster, target) => {
    // A gangster fires at the player: tracer + a chance to actually hit.
    audio.shot();
    const from = new THREE.Vector3(gangster.x, 1.4, gangster.z);
    const to = new THREE.Vector3(target.x, 1.2, target.z);
    const dir = to.clone().sub(from).normalize();
    if (tracer) scene.remove(tracer);
    tracer = new THREE.Line(new THREE.BufferGeometry().setFromPoints([from, to]), tracerMat);
    scene.add(tracer);
    tracerLife = 0.08;
    if (Math.random() < 0.3) hurtPlayer(6);
  });
  police.step(dt, player, !!player.inCar, (cop, target) => {
    audio.shot();
    const from = new THREE.Vector3(cop.x, 1.4, cop.z);
    const to = new THREE.Vector3(target.x, 1.2, target.z);
    const dir = to.clone().sub(from).normalize();
    if (tracer) scene.remove(tracer);
    tracer = new THREE.Line(new THREE.BufferGeometry().setFromPoints([from, to]), tracerMat);
    scene.add(tracer);
    tracerLife = 0.08;
    if (Math.random() < 0.35) hurtPlayer(5);
  }, (kind) => {
    if (kind === 'ram') hurtPlayer(4);
  });
  missions.update(dt, player, interactPressed);
  missions.placeBeacon(dt, time);
  // The Breakers only show themselves once Dario reaches the cannery yard.
  const step = missions.currentStep();
  if (step && step.kind === 'eliminate' && missions.eliminated === 0
    && people.gangsters.filter((g) => g.state !== 'down').length === 0) {
    people.spawnGangster(168, -168);
    people.spawnGangster(182, -160);
    people.spawnGangster(172, -186);
    hud.toast('Three Breakers in the yard. End it.', 2600);
  }
  if (tracer) {
    tracerLife -= dt;
    if (tracerLife <= 0) { scene.remove(tracer); tracer = null; }
  }
  // Car-to-car shoves: the player's car pushes traffic aside.
  if (player.inCar) {
    for (const other of vehicles.traffic) {
      const d = dist2d(player.inCar.x, player.inCar.z, other.x, other.z);
      if (d < 4 && d > 0.01) {
        const push = (4 - d) / d;
        other.x += (other.x - player.inCar.x) * push * 0.5;
        other.z += (other.z - player.inCar.z) * push * 0.5;
      }
    }
  }
  // Siren follows the wanted level.
  if (police.wanted > 0) audio.sirenOn();
  else audio.sirenOff();
  // Autosave every 15 seconds of play.
  saveTimer += dt;
  if (saveTimer > 15) { saveTimer = 0; saveGame(); }
}

function updateCamera(dt) {
  const look = input.lookDelta();
  if (look.dx !== 0 || look.dy !== 0) {
    cameraYaw -= look.dx * 0.005;
    cameraPitch = clamp(cameraPitch + look.dy * 0.003, 0.08, 1.1);
    lastDragAt = time;
  }
  // While driving, the camera drifts back behind the car unless the player
  // has dragged recently.
  if (player.inCar && time - lastDragAt > 2.5) {
    const want = player.heading;
    let diff = ((want - cameraYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    cameraYaw += diff * Math.min(1, dt * 1.6);
  }
  const targetX = player.x;
  const targetZ = player.z;
  const dist = player.inCar ? 14 : cameraDist;
  const height = 3 + Math.sin(cameraPitch) * dist * 0.55;
  const flat = Math.cos(cameraPitch) * dist;
  camera.position.set(
    targetX - Math.sin(cameraYaw) * flat,
    height,
    targetZ - Math.cos(cameraYaw) * flat,
  );
  camera.lookAt(targetX, 1.6, targetZ);
}

function updateHud() {
  const desc = missions.describe();
  hud.setObjective(desc.title, desc.text);
  hud.setCash(player.cash);
  hud.setHealth(player.health);
  hud.setWanted(police.wanted);
  const speedKmh = player.inCar ? Math.abs(player.inCar.speed) * 3.6 : 0;
  hud.setSpeed(speedKmh, player.inCar ? player.inCar.model.name : '', !!player.inCar);
  hud.setCrosshair(screen === 'playing' && !player.inCar);
  let hint = '';
  if (screen === 'playing') {
    if (player.inCar) hint = '<b>W/S</b> drive &nbsp; <b>A/D</b> steer &nbsp; <b>F</b> leave car &nbsp; <b>P</b> pause';
    else {
      const near = vehicles.nearestStealable(player.x, player.z, 4.5);
      hint = near
        ? `<b>E</b> steal the ${near.model.name} &nbsp; <b>CLICK</b> shoot &nbsp; <b>SHIFT</b> run &nbsp; <b>P</b> pause`
        : '<b>WASD</b> walk &nbsp; <b>SHIFT</b> run &nbsp; <b>CLICK</b> shoot &nbsp; <b>P</b> pause';
    }
  }
  hud.setHint(hint);
  hud.drawMinimap({
    roadLines: city.roadLines,
    missionTarget: missions.target(),
    player: { x: player.x, z: player.z, heading: player.heading },
    cameraYaw,
    peds: people.peds,
    traffic: vehicles.traffic,
    gangsters: people.gangsters,
    copCars: police.copCars,
    footCops: police.footCops,
    time,
  });
}

// --- shooting input -------------------------------------------------------------------
function tryShoot() {
  if (screen !== 'playing' || player.inCar) return;
  const from = new THREE.Vector3(player.x, 1.55, player.z);
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  dir.x += (Math.random() - 0.5) * 0.03;
  dir.y += (Math.random() - 0.5) * 0.03;
  dir.normalize();
  fireWeapon(from, dir, player);
}

// --- the loop ----------------------------------------------------------------------------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const elapsed = Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  if (screen === 'playing') {
    if (input.wasPressed(ACTION.PAUSE)) {
      screen = 'paused';
      hud.showScreen('pauseScreen');
      audio.sirenOff();
      audio.engine(0, false);
    } else if (input.wasPressed(ACTION.MUTE)) {
      hud.toast(audio.toggleMute() ? 'Muted' : 'Sound on', 1200);
    } else {
      if (input.consumeClick()) tryShoot();
      let acc = elapsed;
      while (acc > 0) {
        const dt = Math.min(acc, STEP);
        stepWorld(dt);
        acc -= dt;
      }
      updateCamera(elapsed);
      updateHud();
    }
  } else if (screen === 'title') {
    // Slow cinematic orbit over the city behind the title screen.
    time += elapsed;
    const a = time * 0.05;
    camera.position.set(Math.sin(a) * 180, 90, Math.cos(a) * 180);
    camera.lookAt(0, 0, 0);
    missions.placeBeacon(elapsed, time);
    updateHud(); // paint the HUD and minimap behind the title overlay too
    if (input.wasPressed(ACTION.MUTE)) hud.toast(audio.toggleMute() ? 'Muted' : 'Sound on', 1200);
  } else if (screen === 'paused') {
    if (input.wasPressed(ACTION.PAUSE)) {
      screen = 'playing';
      hud.showScreen(null);
    } else if (input.wasPressed(ACTION.RESTART)) {
      applySave(loadGame() || { cash: 0, mission: 0, step: 0, health: PLAYER_HEALTH, x: SPAWN.x, z: SPAWN.z, wanted: 0 });
      screen = 'playing';
      hud.showScreen(null);
    } else if (input.wasPressed(ACTION.NEWGAME)) {
      newGame();
      screen = 'playing';
      hud.showScreen(null);
    }
  }
  renderer.render(scene, camera);
  if (shotName) {
    shotTimer += 1;
    if (shotTimer >= 2) window.__shotReady = true;
  }
}

// --- screenshot staging -------------------------------------------------------------------
// ?shot=start  — title screen over the city at dusk.
// ?shot=play   — Dario driving a stolen Vesper GT through downtown.
// ?shot=chase  — three stars, two interceptors closing in.
// ?shot=mission — on foot outside the cannery, gangsters in the yard.
function stageShot(name) {
  screen = 'playing';
  hud.showScreen(null);
  audio.stopMusic();
  if (name === 'start') {
    screen = 'title';
    hud.showScreen('titleScreen');
    return;
  }
  if (name === 'play') {
    const car = vehicles.parked[0] || vehicles.cars[0];
    car.kind = 'player';
    player.inCar = car;
    player.x = car.x;
    player.z = car.z;
    player.heading = car.heading;
    car.speed = 26;
    car.x = 0;
    car.z = 40;
    car.heading = 0;
    player.x = car.x;
    player.z = car.z;
    cameraYaw = car.heading;
    updateCamera(0.1);
    updateHud();
    return;
  }
  if (name === 'chase') {
    const car = vehicles.parked[1] || vehicles.cars[1];
    car.kind = 'player';
    player.inCar = car;
    car.speed = 30;
    car.x = 0;
    car.z = 0;
    car.heading = Math.PI / 2;
    player.x = 0;
    player.z = 0;
    police.setWanted(3);
    police.step(0.1, player, true, () => {}, () => {});
    cameraYaw = car.heading;
    updateCamera(0.1);
    updateHud();
    return;
  }
  if (name === 'mission') {
    missions.restore(2, 1);
    player.x = 150;
    player.z = -150;
    player.heading = Math.atan2(176 - 150, -176 - (-150));
    playerMesh.position.set(player.x, 0, player.z);
    playerMesh.rotation.y = player.heading;
    people.spawnGangster(168, -168);
    people.spawnGangster(182, -160);
    people.spawnGangster(172, -186);
    cameraYaw = player.heading;
    cameraPitch = 0.4;
    updateCamera(0.1);
    updateHud();
  }
}

if (shotName) {
  stageShot(shotName);
} else if (testMode) {
  screen = 'playing';
  hud.showScreen(null);
}

// --- test handle (used by the headless play-test; harmless in normal play) --------------
window.__solmara = {
  get screen() { return screen; },
  get player() { return { x: player.x, z: player.z, health: player.health, cash: player.cash, inCar: !!player.inCar, heading: player.heading }; },
  get wanted() { return police.wanted; },
  get mission() { return { index: missions.missionIndex, step: missions.stepIndex, eliminated: missions.eliminated }; },
  get cops() { return police.copCars.length + police.footCops.length; },
  get gangstersAlive() { return people.gangsters.filter((g) => g.state !== 'down').length; },
  get gangsterPos() { return people.gangsters.filter((g) => g.state !== 'down').map((g) => ({ x: g.x, z: g.z })); },
  get traffic() { return vehicles.traffic.length; },
  get peds() { return people.peds.length; },
  get parkedCars() { return vehicles.parked.map((c) => ({ x: c.x, z: c.z, kind: c.kind, name: c.model.name })); },
  input,
  start: startPlaying,
  newGame,
  teleport(x, z) { player.x = x; player.z = z; if (player.inCar) { player.inCar.x = x; player.inCar.z = z; } },
  setWanted(n) { police.setWanted(n); },
  stealNearest() {
    const car = vehicles.nearestStealable(player.x, player.z, 6);
    if (!car) return false;
    car.kind = 'player';
    player.inCar = car;
    return true;
  },
  exitCar() {
    if (!player.inCar) return;
    const car = player.inCar;
    player.inCar = null;
    vehicles.releaseCar(car);
    player.x = car.x + 3;
    player.z = car.z + 3;
    playerMesh.visible = true;
  },
  startMission(i) { missions.startMission(i); },
  // Fire the player's weapon at a world point (test hook; uses the real raycast).
  shootAt(x, y, z) {
    if (screen !== 'playing' || player.inCar) return false;
    const from = new THREE.Vector3(player.x, 1.55, player.z);
    const dir = new THREE.Vector3(x - from.x, y - from.y, z - from.z).normalize();
    fireWeapon(from, dir, player);
    return true;
  },
  applySave,
  save: saveGame,
  load: loadGame,
  hurt: hurtPlayer,
};

requestAnimationFrame(frame);
