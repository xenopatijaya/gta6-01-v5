// SOLMARA itself: a 6 x 6 block coastal city built from boxes, cylinders and
// a little fog. Four blocks are hand-made set pieces (the plaza, the docks, the
// cannery warehouse, Lena's garage); the rest are procedural stucco towers with
// lit windows at dusk. The builder also hands the game its colliders (building
// footprints), its road lines (for traffic) and its spawn points.
import * as THREE from 'three';
import { BLOCK, GRID, PALETTE, PITCH, ROAD, WORLD } from './config.js';
import { dist2d } from './random.js';

// Block centres along one axis: -200, -120, -40, 40, 120, 200.
export function blockCentres() {
  const out = [];
  for (let i = 0; i < GRID; i++) out.push(-WORLD / 2 + PITCH / 2 + i * PITCH);
  return out;
}

// Road centre lines: the gaps between blocks, plus a perimeter ring road.
export function roadLines() {
  const centres = blockCentres();
  const lines = [];
  for (let i = 0; i < GRID - 1; i++) lines.push((centres[i] + centres[i + 1]) / 2);
  lines.unshift(-WORLD / 2 + ROAD / 2);
  lines.push(WORLD / 2 - ROAD / 2);
  return lines;
}

function box(w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05 }),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function windowMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x2a2a33, roughness: 0.3, metalness: 0.4,
    emissive: 0xffc46a, emissiveIntensity: 0.55,
  });
}

export function createCity(random) {
  const group = new THREE.Group();
  const colliders = []; // { minX, maxX, minZ, maxZ }
  const parkedSpots = [];
  const pedSpawns = [];
  const centres = blockCentres();
  const roads = roadLines();

  // --- ground, sea and beach -------------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD + 260, WORLD + 260),
    new THREE.MeshStandardMaterial({ color: PALETTE.ground, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // The sea laps the south and east edges; a sand strip separates it from town.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 260),
    new THREE.MeshStandardMaterial({ color: PALETTE.sea, roughness: 0.25, metalness: 0.35 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(120, -0.4, 330);
  group.add(sea);
  const seaEast = sea.clone();
  seaEast.rotation.z = Math.PI / 2;
  seaEast.rotation.x = -Math.PI / 2;
  seaEast.position.set(330, -0.4, 0);
  group.add(seaEast);
  const sand = box(WORLD + 40, 1, 18, PALETTE.sand, 0, -0.2, WORLD / 2 + 9);
  group.add(sand);
  const sandEast = box(18, 1, WORLD + 40, PALETTE.sand, WORLD / 2 + 9, -0.2, 0);
  group.add(sandEast);

  // --- roads ------------------------------------------------------------------
  const roadMat = new THREE.MeshStandardMaterial({ color: PALETTE.road, roughness: 0.95 });
  const lineMat = new THREE.MeshStandardMaterial({ color: PALETTE.roadLine, roughness: 0.8 });
  for (const x of roads) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD, WORLD + ROAD), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(x, 0.02, 0);
    road.receiveShadow = true;
    group.add(road);
    for (let z = -WORLD / 2 + 12; z < WORLD / 2; z += 24) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 8), lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x, 0.04, z);
      group.add(dash);
    }
  }
  for (const z of roads) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(WORLD + ROAD, ROAD), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.02, z);
    road.receiveShadow = true;
    group.add(road);
    for (let x = -WORLD / 2 + 12; x < WORLD / 2; x += 24) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(8, 0.7), lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x, 0.04, z);
      group.add(dash);
    }
  }

  // --- blocks -----------------------------------------------------------------
  const winMat = windowMaterial();
  function addBuilding(cx, cz, w, d, h, colorIdx) {
    const color = PALETTE.buildings[colorIdx % PALETTE.buildings.length];
    const tower = box(w, h, d, color, cx, h / 2, cz);
    group.add(tower);
    const roof = box(w + 1, 1.2, d + 1, PALETTE.roofs[colorIdx % PALETTE.roofs.length], cx, h + 0.6, cz);
    group.add(roof);
    // A lit window strip near the top so the skyline reads at dusk.
    const strip = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 1.4, 0.2), winMat);
    strip.position.set(cx, h * 0.72, cz + d / 2 + 0.12);
    group.add(strip);
    const strip2 = strip.clone();
    strip2.position.set(cx, h * 0.72, cz - d / 2 - 0.12);
    group.add(strip2);
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
  }

  function addPalm(x, z) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.55, 7, 6),
      new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 1 }),
    );
    trunk.position.set(x, 3.5, z);
    trunk.castShadow = true;
    group.add(trunk);
    const top = new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x2e7d4a, roughness: 0.9 }),
    );
    top.scale.y = 0.45;
    top.position.set(x, 7.4, z);
    top.castShadow = true;
    group.add(top);
    colliders.push({ minX: x - 0.6, maxX: x + 0.6, minZ: z - 0.6, maxZ: z + 0.6 });
  }

  function addLamp(x, z) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.6, metalness: 0.5 }),
    );
    pole.position.set(x, 3, z);
    group.add(pole);
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc46a, emissiveIntensity: 1.4 }),
    );
    lamp.position.set(x, 6.2, z);
    group.add(lamp);
    // Only a handful of lamps get a real point light: dozens of dynamic lights
    // would tank the frame rate on software renderers and weak GPUs. The rest
    // still glow through their emissive bulb.
    if (litLamps < 8 && random.chance(0.35)) {
      litLamps += 1;
      const light = new THREE.PointLight(0xffc46a, 12, 26, 1.8);
      light.position.set(x, 6, z);
      group.add(light);
    }
  }
  let litLamps = 0;

  function addContainer(x, z, color) {
    const c = box(10, 3, 3.4, color, x, 1.5, z);
    c.rotation.y = random.chance(0.5) ? 0 : Math.PI / 2;
    group.add(c);
    colliders.push({ minX: x - 5, maxX: x + 5, minZ: z - 1.8, maxZ: z + 1.8 });
  }

  for (const bx of centres) {
    for (const bz of centres) {
      const isPlaza = bx === 0 && bz === 0;
      const isDocks = bx === 200 && bz === 200;
      const isCannery = bx === 200 && bz === -200;
      const isGarage = bx === -120 && bz === 120;

      // Sidewalk slab under every block.
      const walk = new THREE.Mesh(
        new THREE.PlaneGeometry(BLOCK, BLOCK),
        new THREE.MeshStandardMaterial({ color: PALETTE.sidewalk, roughness: 1 }),
      );
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(bx, 0.03, bz);
      walk.receiveShadow = true;
      group.add(walk);

      if (isPlaza) {
        // Solmara Plaza: fountain, benches and palms, no buildings.
        const basin = new THREE.Mesh(
          new THREE.CylinderGeometry(7, 8, 1.4, 20),
          new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.7 }),
        );
        basin.position.set(0, 0.7, 0);
        basin.castShadow = true;
        group.add(basin);
        const water = new THREE.Mesh(
          new THREE.CylinderGeometry(6.2, 6.2, 0.4, 20),
          new THREE.MeshStandardMaterial({ color: 0x3a9ac8, roughness: 0.15, metalness: 0.3 }),
        );
        water.position.set(0, 1.4, 0);
        group.add(water);
        colliders.push({ minX: -8, maxX: 8, minZ: -8, maxZ: 8 });
        for (const [px, pz] of [[-22, -18], [22, -18], [-22, 18], [22, 18]]) addPalm(px, pz);
        for (let i = 0; i < 6; i++) pedSpawns.push({ x: random.range(-26, 26), z: random.range(-26, 26) });
        continue;
      }
      if (isDocks) {
        // Pier 9: stacked shipping containers and a crane leg.
        for (let i = 0; i < 7; i++) {
          addContainer(178 + random.range(-4, 4) + (i % 3) * 12, 178 + Math.floor(i / 3) * 12, random.pick([0xb83a2e, 0x2e6fb8, 0x3a8a4a, 0xd8a83a]));
        }
        const crane = box(3, 26, 3, 0xd8a83a, 216, 13, 216);
        group.add(crane);
        colliders.push({ minX: 214.5, maxX: 217.5, minZ: 214.5, maxZ: 217.5 });
        for (let i = 0; i < 3; i++) pedSpawns.push({ x: random.range(176, 210), z: random.range(176, 210) });
        continue;
      }
      if (isCannery) {
        // The old cannery: one long warehouse, crates, and a fenced yard.
        const shed = box(44, 12, 22, 0x8a6a5a, 196, 6, -196);
        group.add(shed);
        colliders.push({ minX: 174, maxX: 218, minZ: -207, maxZ: -185 });
        for (let i = 0; i < 5; i++) {
          const crate = box(3.4, 2.4, 3.4, 0x7a5a3a, 176 + (i % 3) * 8, 1.2, -176 + Math.floor(i / 3) * 9);
          group.add(crate);
          colliders.push({ minX: 176 + (i % 3) * 8 - 1.7, maxX: 176 + (i % 3) * 8 + 1.7, minZ: -176 + Math.floor(i / 3) * 9 - 1.7, maxZ: -176 + Math.floor(i / 3) * 9 + 1.7 });
        }
        continue;
      }
      if (isGarage) {
        // Lena's garage: low workshop with a big door, plus a forecourt.
        const shop = box(30, 9, 18, 0xb83a5a, -112, 4.5, 112);
        group.add(shop);
        const door = box(12, 6, 0.6, 0x2a2a33, -104, 3, 103);
        group.add(door);
        colliders.push({ minX: -127, maxX: -97, minZ: 103, maxZ: 121 });
        const sign = box(16, 2.4, 0.8, 0xffd23f, -112, 10.2, 103);
        group.add(sign);
        addPalm(-138, 138);
        addPalm(-94, 138);
        for (let i = 0; i < 2; i++) pedSpawns.push({ x: random.range(-140, -100), z: random.range(124, 144) });
        continue;
      }

      // Ordinary block: one to three towers with a little breathing room.
      const towers = random.int(1, 3);
      for (let t = 0; t < towers; t++) {
        const w = random.range(16, 26);
        const d = random.range(16, 26);
        const h = random.range(9, 38);
        const ox = random.range(-14, 14);
        const oz = random.range(-14, 14);
        // Keep towers out of each other's way on the same block.
        if (t > 0 && colliders.some((c) => dist2d(bx + ox, bz + oz, (c.minX + c.maxX) / 2, (c.minZ + c.maxZ) / 2) < 24)) continue;
        addBuilding(bx + ox, bz + oz, w, d, h, random.int(0, 7));
      }
      if (random.chance(0.6)) addPalm(bx + random.range(-26, 26), bz + random.range(-26, 26));
      for (let i = 0; i < 2; i++) {
        pedSpawns.push({ x: bx + random.range(-28, 28), z: bz + random.range(-28, 28) });
      }
    }
  }

  // Street lamps at road corners, and parked-car spots along the roads.
  for (const x of roads) {
    for (const z of roads) {
      if (random.chance(0.5)) addLamp(x + 9, z + 9);
    }
  }
  for (let i = 0; i < 40; i++) {
    const road = random.pick(roads);
    const along = random.range(-WORLD / 2 + 20, WORLD / 2 - 20);
    const side = random.chance(0.5) ? 1 : -1;
    if (random.chance(0.5)) {
      parkedSpots.push({ x: road + side * 5.4, z: along, heading: random.chance(0.5) ? 0 : Math.PI });
    } else {
      parkedSpots.push({ x: along, z: road + side * 5.4, heading: random.chance(0.5) ? Math.PI / 2 : -Math.PI / 2 });
    }
  }

  // --- sky, sun and fog ---------------------------------------------------------
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 16),
    new THREE.MeshBasicMaterial({ color: PALETTE.sky, side: THREE.BackSide, fog: false }),
  );
  group.add(sky);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.4);
  sun.position.set(-180, 260, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 700;
  group.add(sun);
  group.add(new THREE.AmbientLight(0x8aa0b8, 0.85));
  const dusk = new THREE.HemisphereLight(0xffd9a0, 0x2a3a4a, 0.5);
  group.add(dusk);

  return { group, colliders, roadLines: roads, parkedSpots, pedSpawns };
}

// Circle (player / car) versus building AABB: push the circle out and report
// whether a collision happened, so driving can bounce and walking can slide.
export function resolveCircleVsColliders(x, z, radius, colliders) {
  let hit = false;
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - nx;
    const dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (radius - d) / d;
        x += dx * push;
        z += dz * push;
      } else {
        // Dead centre inside the box: shove out along the smallest penetration.
        const pl = x - (c.minX - radius);
        const pr = (c.maxX + radius) - x;
        const pt = z - (c.minZ - radius);
        const pb = (c.maxZ + radius) - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = c.minX - radius;
        else if (m === pr) x = c.maxX + radius;
        else if (m === pt) z = c.minZ - radius;
        else z = c.maxZ + radius;
      }
    }
  }
  // Keep everything inside the map (the sea is not drivable).
  const edge = WORLD / 2 - 2;
  x = Math.max(-edge, Math.min(edge, x));
  z = Math.max(-edge, Math.min(edge, z));
  return { x, z, hit };
}
