// The people of Solmara: pedestrians who stroll the sidewalks and run from
// gunfire, the three Breakers gangsters who guard the cannery, and the player
// character — Dario Reyes, built from boxes with a walk cycle made of swinging
// limbs. Everyone is a simple state machine: idle, walk, flee, fight, down.
import * as THREE from 'three';
import { ENEMY_HEALTH, PALETTE, WORLD } from './config.js';
import { dist2d } from './random.js';
import { resolveCircleVsColliders } from './city.js';

function makePersonMesh(shirt, pants, skin, scale) {
  const group = new THREE.Group();
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.9 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.9 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.85, 0.4), shirtMat);
  torso.position.y = 1.15;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skinMat);
  head.position.y = 1.82;
  head.castShadow = true;
  group.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.46),
    new THREE.MeshStandardMaterial({ color: 0x1e1410, roughness: 1 }));
  hair.position.y = 2.06;
  group.add(hair);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.75, 0.3), pantsMat);
  legL.position.set(-0.19, 0.38, 0);
  legL.castShadow = true;
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.19;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.24), shirtMat);
  armL.position.set(-0.48, 1.18, 0);
  armL.castShadow = true;
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.48;
  group.add(armR);
  group.scale.setScalar(scale || 1);
  group.userData = { legL, legR, armL, armR };
  return group;
}

// Dario: white tee, dark jeans, a red jacket hint on the torso edge.
export function makePlayerMesh() {
  const mesh = makePersonMesh(0xe8e8e8, 0x2a3242, 0xc89878, 1.05);
  const jacket = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.5, 0.44),
    new THREE.MeshStandardMaterial({ color: 0xb83a2e, roughness: 0.85 }));
  jacket.position.y = 1.32;
  mesh.add(jacket);
  return mesh;
}

export function createPeople(scene, random, city) {
  const peds = [];
  const gangsters = [];
  const skins = [0xc89878, 0x8a5a3a, 0xe8b898, 0x6a3a22];

  function spawnPed(x, z) {
    const mesh = makePersonMesh(random.pick(PALETTE.pedShirts), random.pick([0x2a3242, 0x4a3a2a, 0x222226]), random.pick(skins), 1);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const ped = {
      mesh, x, z, heading: random.angle(), speed: 0,
      state: 'walk', // walk | flee | down
      targetX: x, targetZ: z,
      health: 30,
      panic: 0,
      walkPhase: random.range(0, 6),
    };
    peds.push(ped);
    return ped;
  }

  for (const s of city.pedSpawns.slice(0, 26)) spawnPed(s.x, s.z);

  function spawnGangster(x, z) {
    const mesh = makePersonMesh(0x1e1e22, 0x1e1e22, random.pick(skins), 1.08);
    // A gold chain reads as "Breaker" at a glance.
    const chain = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.05),
      new THREE.MeshStandardMaterial({ color: 0xd8b93a, metalness: 0.8, roughness: 0.3 }));
    chain.position.set(0, 1.52, 0.22);
    mesh.add(chain);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const g = {
      mesh, x, z, heading: random.angle(), speed: 0,
      state: 'guard', // guard | fight | down
      health: ENEMY_HEALTH,
      shootTimer: random.range(0.5, 1.5),
      walkPhase: 0,
    };
    gangsters.push(g);
    return g;
  }

  function animateWalk(person, dt, moving) {
    const phase = person.walkPhase + (moving ? dt * 9 : 0);
    person.walkPhase = phase;
    const swing = moving ? Math.sin(phase) * 0.55 : 0;
    const u = person.mesh.userData;
    u.legL.rotation.x = swing;
    u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.8;
    u.armR.rotation.x = swing * 0.8;
  }

  function stepPeds(dt, danger, colliders) {
    for (const ped of peds) {
      if (ped.state === 'down') continue;
      // Danger (a gunshot or a speeding car nearby) sends them running.
      if (danger) {
        const d = dist2d(ped.x, ped.z, danger.x, danger.z);
        if (d < danger.radius) { ped.state = 'flee'; ped.panic = 3; }
      }
      if (ped.state === 'flee') {
        ped.panic -= dt;
        const away = Math.atan2(ped.x - danger.x, ped.z - danger.z);
        ped.heading = away;
        ped.speed = 7;
        if (ped.panic <= 0) ped.state = 'walk';
      } else {
        ped.speed = 1.6;
        if (dist2d(ped.x, ped.z, ped.targetX, ped.targetZ) < 1.5) {
          ped.targetX = ped.x + random.range(-30, 30);
          ped.targetZ = ped.z + random.range(-30, 30);
        }
        ped.heading = Math.atan2(ped.targetX - ped.x, ped.targetZ - ped.z);
      }
      const nx = ped.x + Math.sin(ped.heading) * ped.speed * dt;
      const nz = ped.z + Math.cos(ped.heading) * ped.speed * dt;
      const resolved = resolveCircleVsColliders(nx, nz, 0.6, colliders);
      ped.x = resolved.x;
      ped.z = resolved.z;
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
      animateWalk(ped, dt, ped.speed > 0.2);
    }
  }

  // Gangsters guard the cannery until the player comes close, then they fight:
  // strafe, keep their distance, and shoot with a visible tracer handled by main.
  function stepGangsters(dt, player, onShoot) {
    for (const g of gangsters) {
      if (g.state === 'down') continue;
      const d = dist2d(g.x, g.z, player.x, player.z);
      if (g.state === 'guard' && d < 34) g.state = 'fight';
      if (g.state === 'fight') {
        g.heading = Math.atan2(player.x - g.x, player.z - g.z);
        // Keep a 10–18 unit firing distance, strafing sideways.
        const want = d > 18 ? 3.2 : d < 10 ? -3.2 : 0;
        const strafe = Math.sin(g.walkPhase * 0.7) * 1.5;
        const nx = g.x + Math.sin(g.heading) * want * dt + Math.cos(g.heading) * strafe * dt;
        const nz = g.z + Math.cos(g.heading) * want * dt - Math.sin(g.heading) * strafe * dt;
        const resolved = resolveCircleVsColliders(nx, nz, 0.7, []);
        g.x = resolved.x;
        g.z = resolved.z;
        g.shootTimer -= dt;
        if (g.shootTimer <= 0 && d < 40) {
          g.shootTimer = random.range(1.1, 2.0);
          onShoot(g, player);
        }
        g.mesh.position.set(g.x, 0, g.z);
        g.mesh.rotation.y = g.heading;
        animateWalk(g, dt, Math.abs(want) > 0.5);
      } else {
        g.mesh.position.set(g.x, 0, g.z);
        g.mesh.rotation.y = g.heading;
      }
    }
  }

  function knockDown(person) {
    person.state = 'down';
    person.mesh.rotation.x = -Math.PI / 2;
    person.mesh.position.y = 0.4;
  }

  return { peds, gangsters, spawnPed, spawnGangster, stepPeds, stepGangsters, knockDown, makePersonMesh };
}
