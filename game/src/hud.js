// The HUD: cash, wanted stars, health bar, mission objective, speedometer and
// the live minimap — a top-down 2D canvas that redraws the city, the roads, the
// player arrow, the mission marker, traffic, police and gangsters every frame.
// It also owns the toast messages, the screens and the crosshair.
import { MISSIONS, PLACES, WORLD } from './config.js';
import { money } from './random.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  const wantedEl = el('wanted');
  const cashEl = el('cash');
  const healthEl = el('healthfill');
  const objTitle = el('objTitle');
  const objText = el('objText');
  const speedo = el('speedo');
  const speedVal = el('speedVal');
  const carName = el('carName');
  const hintEl = el('hint');
  const toastEl = el('toast');
  const crosshair = el('crosshair');
  const minimap = el('minimap');
  const mctx = minimap.getContext('2d');
  const statusEl = el('status');
  let toastTimer = null;
  let lastWanted = -1;

  function setWanted(stars) {
    if (stars === lastWanted) return;
    lastWanted = stars;
    let html = '';
    for (let i = 0; i < 5; i++) html += `<span class="${i < stars ? '' : 'off'}">★</span>`;
    wantedEl.innerHTML = html;
  }

  function setCash(amount) {
    cashEl.innerHTML = `${money(amount)}<small>SOLMARA BANK</small>`;
  }

  function setHealth(hp) {
    healthEl.style.width = `${Math.max(0, Math.min(100, hp))}%`;
  }

  function setObjective(title, text) {
    objTitle.textContent = title;
    objText.textContent = text;
  }

  function setSpeed(kmh, name, inCar) {
    speedo.classList.toggle('hidden', !inCar);
    if (inCar) {
      speedVal.textContent = String(Math.round(kmh));
      carName.textContent = name || '';
    }
  }

  function setHint(text) {
    hintEl.innerHTML = text;
  }

  function toast(text, ms) {
    toastEl.textContent = text;
    toastEl.style.opacity = '1';
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { toastEl.style.opacity = '0'; }, ms || 2600);
  }

  function setCrosshair(show) {
    crosshair.style.display = show ? 'block' : 'none';
  }

  function announce(text) {
    statusEl.textContent = text;
  }

  function showScreen(id) {
    for (const name of ['titleScreen', 'pauseScreen', 'endScreen']) {
      el(name).classList.toggle('hidden', name !== id);
    }
    if (!id) {
      el('titleScreen').classList.add('hidden');
      el('pauseScreen').classList.add('hidden');
      el('endScreen').classList.add('hidden');
    }
  }

  // --- minimap -------------------------------------------------------------------
  function drawMinimap(world) {
    const S = minimap.width;
    const scale = S / (WORLD + 60);
    const toMap = (x, z) => [S / 2 + x * scale, S / 2 + z * scale];
    mctx.clearRect(0, 0, S, S);
    // Sea tint on the south and east rim.
    mctx.fillStyle = '#164e6b';
    mctx.fillRect(0, 0, S, S);
    // Ground.
    mctx.fillStyle = '#2a3327';
    const [gx, gy] = toMap(-WORLD / 2, -WORLD / 2);
    mctx.fillRect(gx, gy, WORLD * scale, WORLD * scale);
    // Roads.
    mctx.strokeStyle = '#3a3f47';
    mctx.lineWidth = 5;
    for (const x of world.roadLines) {
      const [a, b] = toMap(x, -WORLD / 2);
      const [, c] = toMap(x, WORLD / 2);
      mctx.beginPath(); mctx.moveTo(a, b); mctx.lineTo(a, c); mctx.stroke();
    }
    for (const z of world.roadLines) {
      const [a, b] = toMap(-WORLD / 2, z);
      const [c] = toMap(WORLD / 2, z);
      mctx.beginPath(); mctx.moveTo(a, b); mctx.lineTo(c, b); mctx.stroke();
    }
    // Named places.
    mctx.fillStyle = '#cfe8ff';
    mctx.font = '9px sans-serif';
    for (const p of PLACES) {
      const [px, py] = toMap(p.x, p.z);
      mctx.fillRect(px - 1.5, py - 1.5, 3, 3);
    }
    // Mission marker: pulsing yellow diamond.
    if (world.missionTarget) {
      const [mx, my] = toMap(world.missionTarget.x, world.missionTarget.z);
      const pulse = 6 + Math.sin(world.time * 4) * 2;
      mctx.fillStyle = '#ffd23f';
      mctx.beginPath();
      mctx.moveTo(mx, my - pulse);
      mctx.lineTo(mx + pulse, my);
      mctx.lineTo(mx, my + pulse);
      mctx.lineTo(mx - pulse, my);
      mctx.closePath();
      mctx.fill();
    }
    // Traffic (grey), police (blue/red), gangsters (red), pedestrians (pale).
    const dot = (x, z, color, r) => {
      const [dx, dy] = toMap(x, z);
      mctx.fillStyle = color;
      mctx.beginPath(); mctx.arc(dx, dy, r, 0, Math.PI * 2); mctx.fill();
    };
    for (const ped of world.peds || []) if (ped.state !== 'down') dot(ped.x, ped.z, '#b8c8d8', 1.4);
    for (const car of world.traffic || []) dot(car.x, car.z, '#8a8f98', 2);
    for (const g of world.gangsters || []) if (g.state !== 'down') dot(g.x, g.z, '#ff4a4a', 2.6);
    for (const cop of world.copCars || []) dot(cop.x, cop.z, '#4a7dff', 3);
    for (const cop of world.footCops || []) if (cop.state !== 'down') dot(cop.x, cop.z, '#7db4ff', 2.2);
    // The player: a white arrow that rotates with the heading. Canvas +y is
    // world +z, so the arrow (drawn pointing up, i.e. -z) needs PI - heading.
    const [px, py] = toMap(world.player.x, world.player.z);
    mctx.save();
    mctx.translate(px, py);
    mctx.rotate(Math.PI - world.player.heading);
    mctx.fillStyle = '#ffffff';
    mctx.strokeStyle = '#111111';
    mctx.lineWidth = 1;
    mctx.beginPath();
    mctx.moveTo(0, -7); mctx.lineTo(5, 5); mctx.lineTo(0, 2.5); mctx.lineTo(-5, 5);
    mctx.closePath();
    mctx.fill();
    mctx.stroke();
    mctx.restore();
    // View cone: a faint wedge showing where the camera looks.
    mctx.save();
    mctx.translate(px, py);
    mctx.rotate(Math.PI - world.cameraYaw);
    mctx.fillStyle = 'rgba(255,255,255,0.10)';
    mctx.beginPath();
    mctx.moveTo(0, 0);
    mctx.arc(0, 0, 34, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5);
    mctx.closePath();
    mctx.fill();
    mctx.restore();
  }

  return {
    setWanted, setCash, setHealth, setObjective, setSpeed, setHint, toast,
    setCrosshair, announce, showScreen, drawMinimap,
    missionCount: MISSIONS.length,
  };
}
