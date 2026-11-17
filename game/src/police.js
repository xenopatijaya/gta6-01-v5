// The wanted system and the Solmara Police Department. Heat rises with crime
// and fades with calm; the star count decides how many police cars and foot cops
// hunt the player. Police cars ram and box the player in; foot cops close in and
// shoot (badly, on purpose — they are street cops, not snipers). Getting busted
// costs cash; getting wasted costs the run back to the garage.
import * as THREE from 'three';
import { COP_CAR_PER_STAR, COP_FOOT_PER_STAR, COP_HEALTH, COP_SHOT_DAMAGE, COP_SHOT_RANGE, HEAT_KILL, HEAT_SHOOT_COP, PALETTE, WANTED_DECAY_SECONDS, WANTED_MAX, WORLD } from './config.js';
import { clamp, dist2d } from './random.js';
import { resolveCircleVsColliders } from './city.js';
import { makeCarMesh } from './vehicles.js';

export function createPolice(scene, random, city) {
  let wanted = 0;
  let calmTimer = 0;
  const copCars = [];
  const footCops = [];

  function makeCopCar(x, z, heading) {
    const mesh = makeCarMesh({ name: 'Interceptor', top: 1.05, accel: 1.05 }, PALETTE.police);
    // Light bar: two flashing boxes on the roof.
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 2 }));
    red.position.set(-0.32, 1.58, -0.25);
    mesh.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x2040ff, emissive: 0x2040ff, emissiveIntensity: 2 }));
    blue.position.set(0.32, 1.58, -0.25);
    mesh.add(blue);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    scene.add(mesh);
    const car = {
      mesh, kind: 'police', x, z, heading, speed: 0, steer: 0,
      model: { name: 'Interceptor', top: 1.05, accel: 1.05 },
      occupied: true, siren: true, lightBar: { red, blue }, flash: 0,
    };
    copCars.push(car);
    return car;
  }

  function makeFootCop(x, z) {
    const group = new THREE.Group();
    const navy = new THREE.MeshStandardMaterial({ color: PALETTE.police, roughness: 0.85 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.85, 0.4), navy);
    torso.position.y = 1.15;
    torso.castShadow = true;
    group.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42),
      new THREE.MeshStandardMaterial({ color: 0xc89878, roughness: 0.8 }));
    head.position.y = 1.82;
    group.add(head);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.48), navy);
    cap.position.y = 2.06;
    group.add(cap);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.75, 0.3), navy);
    legL.position.set(-0.19, 0.38, 0);
    group.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.19;
    group.add(legR);
    group.position.set(x, 0, z);
    scene.add(group);
    const cop = {
      mesh: group, x, z, heading: 0, speed: 0,
      health: COP_HEALTH, state: 'chase', shootTimer: random.range(0.8, 1.6),
      walkPhase: 0,
    };
    footCops.push(cop);
    return cop;
  }

  function desiredCounts() {
    return {
      cars: Math.min(wanted * COP_CAR_PER_STAR, 5),
      foot: Math.min(wanted * COP_FOOT_PER_STAR, 5),
    };
  }

  function spawnNearPlayer(player, kind) {
    const angle = random.angle();
    const dist = random.range(55, 80);
    const x = clamp(player.x + Math.sin(angle) * dist, -WORLD / 2 + 10, WORLD / 2 - 10);
    const z = clamp(player.z + Math.cos(angle) * dist, -WORLD / 2 + 10, WORLD / 2 - 10);
    if (kind === 'car') return makeCopCar(x, z, Math.atan2(player.x - x, player.z - z));
    return makeFootCop(x, z);
  }

  function syncSpawns(player) {
    const want = desiredCounts();
    while (copCars.length < want.cars) spawnNearPlayer(player, 'car');
    while (footCops.length < want.foot) spawnNearPlayer(player, 'foot');
    // Extra police melt away when the heat drops.
    while (copCars.length > want.cars) {
      const car = copCars.pop();
      scene.remove(car.mesh);
    }
    while (footCops.length > want.foot) {
      const cop = footCops.pop();
      scene.remove(cop.mesh);
    }
  }

  function addHeat(amount) {
    wanted = clamp(wanted + amount, 0, WANTED_MAX);
    calmTimer = 0;
  }

  function step(dt, player, playerInCar, onCopShoot, onBusted) {
    // Calm bleeds one star at a time.
    if (wanted > 0) {
      calmTimer += dt;
      if (calmTimer >= WANTED_DECAY_SECONDS) {
        wanted -= 1;
        calmTimer = 0;
      }
    }
    syncSpawns(player);

    // Police cars: steer towards the player and ram. They are faster than
    // traffic but a touch slower than a good stolen car at full tilt.
    for (const car of copCars) {
      const d = dist2d(car.x, car.z, player.x, player.z);
      const targetHeading = Math.atan2(player.x - car.x, player.z - car.z);
      const turn = clamp(((targetHeading - car.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -1.6 * dt, 1.6 * dt);
      car.heading += turn;
      const targetSpeed = d > 6 ? 30 : 8;
      car.speed += clamp(targetSpeed - car.speed, -30 * dt, 14 * dt);
      const nx = car.x + Math.sin(car.heading) * car.speed * dt;
      const nz = car.z + Math.cos(car.heading) * car.speed * dt;
      const resolved = resolveCircleVsColliders(nx, nz, 2.1, city.colliders);
      car.x = resolved.x;
      car.z = resolved.z;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      // Flash the light bar.
      car.flash += dt;
      const on = Math.sin(car.flash * 14) > 0;
      car.lightBar.red.material.emissiveIntensity = on ? 3 : 0.2;
      car.lightBar.blue.material.emissiveIntensity = on ? 0.2 : 3;
      // Ramming the player on foot hurts; ramming their car shoves it.
      if (d < 3.2 && !playerInCar) {
        onBusted('ram', COP_SHOT_DAMAGE);
      }
    }

    // Foot cops: run at the player, stop at firing range, shoot with a delay.
    for (const cop of footCops) {
      if (cop.state === 'down') continue;
      const d = dist2d(cop.x, cop.z, player.x, player.z);
      cop.heading = Math.atan2(player.x - cop.x, player.z - cop.z);
      if (d > COP_SHOT_RANGE * 0.7) {
        cop.speed = 8.5;
        const nx = cop.x + Math.sin(cop.heading) * cop.speed * dt;
        const nz = cop.z + Math.cos(cop.heading) * cop.speed * dt;
        const resolved = resolveCircleVsColliders(nx, nz, 0.6, city.colliders);
        cop.x = resolved.x;
        cop.z = resolved.z;
        cop.walkPhase += dt * 9;
      } else {
        cop.speed = 0;
        cop.shootTimer -= dt;
        if (cop.shootTimer <= 0) {
          cop.shootTimer = random.range(1.4, 2.4);
          onCopShoot(cop, player);
        }
      }
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = cop.heading;
      const swing = cop.speed > 0.2 ? Math.sin(cop.walkPhase) * 0.5 : 0;
      // Legs are children 3 and 4 of the group.
      if (cop.mesh.children[3]) cop.mesh.children[3].rotation.x = swing;
      if (cop.mesh.children[4]) cop.mesh.children[4].rotation.x = -swing;
    }
  }

  function clearAll() {
    for (const car of copCars) scene.remove(car.mesh);
    for (const cop of footCops) scene.remove(cop.mesh);
    copCars.length = 0;
    footCops.length = 0;
  }

  return {
    get wanted() { return wanted; },
    copCars,
    footCops,
    addHeat,
    step,
    clearAll,
    setWanted(level) { wanted = clamp(level, 0, WANTED_MAX); calmTimer = 0; },
    // Shooting a cop is a bigger crime than shooting a gangster.
    crimeForKill(wasCop) { addHeat(wasCop ? HEAT_SHOOT_COP : HEAT_KILL); },
  };
}
