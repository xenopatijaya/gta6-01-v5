// Cars: a boxy low-poly car factory, the traffic that drives the road grid, and
// the arcade driving model for the player's stolen ride. Traffic cars follow a
// road line, turn at intersections, and slow down for the car ahead; the player
// car accelerates, brakes, reverses and steers with a speed-scaled turn rate.
import * as THREE from 'three';
import { CAR_ACCEL, CAR_BRAKE, CAR_MODELS, CAR_REVERSE_SPEED, CAR_STEER, CAR_TOP_SPEED, PALETTE, WORLD } from './config.js';
import { angleDiff, clamp, dist2d } from './random.js';
import { resolveCircleVsColliders } from './city.js';

export function makeCarMesh(model, paint) {
  const group = new THREE.Group();
  const paintMat = new THREE.MeshStandardMaterial({ color: paint, roughness: 0.35, metalness: 0.5 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.15, metalness: 0.7 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, 4.4), paintMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 2.2), glassMat);
  cabin.position.set(0, 1.12, -0.25);
  cabin.castShadow = true;
  group.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 1.9), paintMat);
  roof.position.set(0, 1.46, -0.25);
  group.add(roof);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const [wx, wz] of [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, darkMat);
    wheel.position.set(wx, 0.36, wz);
    wheel.castShadow = true;
    group.add(wheel);
  }
  // Headlights and tail lights so cars read at dusk.
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 0.9 });
  for (const hx of [-0.7, 0.7]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), headMat);
    head.position.set(hx, 0.62, 2.22);
    group.add(head);
  }
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xc81e1e, emissiveIntensity: 0.8 });
  for (const tx of [-0.7, 0.7]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), tailMat);
    tail.position.set(tx, 0.62, -2.22);
    group.add(tail);
  }
  if (model.taxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.5),
      new THREE.MeshStandardMaterial({ color: PALETTE.taxi, emissive: 0xc8a832, emissiveIntensity: 0.5 }));
    sign.position.set(0, 1.62, -0.25);
    group.add(sign);
  }
  group.userData.modelName = model.name;
  return group;
}

export function createVehicles(scene, random, city) {
  const cars = []; // every car in the world, traffic + parked + player-driven
  const traffic = [];
  const parked = [];

  function spawnCar(x, z, heading, kind, modelIdx) {
    const model = CAR_MODELS[modelIdx ?? random.int(0, CAR_MODELS.length - 1)];
    const paint = model.taxi ? PALETTE.taxi : random.pick(PALETTE.carPaints);
    const mesh = makeCarMesh(model, paint);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    scene.add(mesh);
    const car = {
      mesh, model, kind, // 'traffic' | 'parked' | 'player' | 'police'
      x, z, heading,
      speed: 0,
      steer: 0,
      occupied: kind === 'traffic',
      driverFled: false,
      siren: null,
      lightBar: null,
    };
    cars.push(car);
    return car;
  }

  // --- traffic: grid followers ---------------------------------------------------
  const roads = city.roadLines;
  for (let i = 0; i < 14; i++) {
    const vertical = random.chance(0.5);
    const line = random.pick(roads);
    const along = random.range(-WORLD / 2 + 20, WORLD / 2 - 20);
    const dir = random.chance(0.5) ? 1 : -1;
    const car = spawnCar(vertical ? line + 2.6 * dir : along, vertical ? along : line + 2.6 * dir,
      vertical ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2), 'traffic');
    car.vertical = vertical;
    car.line = line;
    car.dir = dir;
    car.cruise = random.range(9, 15);
    car.speed = car.cruise;
    traffic.push(car);
  }

  // --- parked cars along the kerb -------------------------------------------------
  const spots = [...city.parkedSpots];
  for (let i = 0; i < 10 && spots.length > 0; i++) {
    const spot = spots.splice(random.int(0, spots.length - 1), 1)[0];
    const car = spawnCar(spot.x, spot.z, spot.heading, 'parked');
    parked.push(car);
  }

  function nearestRoadCoord(value) {
    let best = roads[0];
    let bestD = Math.abs(value - roads[0]);
    for (const r of roads) {
      const d = Math.abs(value - r);
      if (d < bestD) { best = r; bestD = d; }
    }
    return best;
  }

  function stepTraffic(dt, playerCar, colliders) {
    for (const car of traffic) {
      // Slow down if another car is close ahead.
      let blocked = false;
      for (const other of cars) {
        if (other === car || other.kind === 'parked') continue;
        const ahead = car.vertical
          ? (other.z - car.z) * car.dir
          : (other.x - car.x) * car.dir;
        const lateral = car.vertical ? Math.abs(other.x - car.x) : Math.abs(other.z - car.z);
        if (ahead > 0 && ahead < 9 && lateral < 3) { blocked = true; break; }
      }
      const target = blocked ? 0 : car.cruise;
      car.speed += clamp(target - car.speed, -18 * dt, 8 * dt);
      const step = car.speed * dt;
      if (car.vertical) car.z += step * car.dir;
      else car.x += step * car.dir;
      // At an intersection, sometimes turn onto the crossing road.
      const cross = nearestRoadCoord(car.vertical ? car.z : car.x);
      const atJunction = Math.abs((car.vertical ? car.z : car.x) - cross) < step + 0.4;
      if (atJunction && random.chance(0.012)) {
        const oldVertical = car.vertical;
        car.vertical = !oldVertical;
        car.line = cross;
        car.dir = random.chance(0.5) ? 1 : -1;
        if (car.vertical) {
          car.x = cross + 2.6 * car.dir;
          car.heading = car.dir > 0 ? 0 : Math.PI;
        } else {
          car.z = cross + 2.6 * car.dir;
          car.heading = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
      }
      // Wrap around the far edge so traffic never runs out.
      const edge = WORLD / 2 - 8;
      if (car.vertical && (car.z > edge || car.z < -edge)) car.z = -Math.sign(car.z) * edge;
      if (!car.vertical && (car.x > edge || car.x < -edge)) car.x = -Math.sign(car.x) * edge;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
    }
  }

  // --- player driving --------------------------------------------------------------
  function drivePlayer(car, input, dt, colliders) {
    const axis = input.axis();
    const top = CAR_TOP_SPEED * car.model.top;
    if (axis.y > 0) car.speed += CAR_ACCEL * car.model.accel * dt;
    else if (axis.y < 0) {
      if (car.speed > 0.5) car.speed -= CAR_BRAKE * dt;
      else car.speed -= CAR_ACCEL * 0.55 * dt;
    } else {
      car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 9 * dt);
    }
    car.speed = clamp(car.speed, -CAR_REVERSE_SPEED, top);
    const steerTarget = -axis.x * CAR_STEER;
    car.steer += clamp(steerTarget - car.steer, -4 * dt, 4 * dt);
    const speedFactor = clamp(Math.abs(car.speed) / 12, 0, 1);
    car.heading += car.steer * speedFactor * dt * Math.sign(car.speed || 1);
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    const resolved = resolveCircleVsColliders(nx, nz, 2.1, colliders);
    if (resolved.hit && Math.abs(car.speed) > 6) {
      car.speed *= -0.25; // bounce off the wall, arcade style
    } else if (resolved.hit) {
      car.speed *= 0.4;
    }
    car.x = resolved.x;
    car.z = resolved.z;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    // Body roll and pitch sell the speed.
    car.mesh.rotation.z = -car.steer * 0.05 * speedFactor;
    car.mesh.rotation.x = clamp(-car.speed * 0.0012, -0.03, 0.03);
    return Math.abs(car.speed) / top;
  }

  // Find the closest stealable car to a point (parked, or traffic whose driver
  // can be yanked out — traffic cars are never empty until stolen).
  function nearestStealable(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of cars) {
      if (car.kind === 'player' || car.kind === 'police') continue;
      if (car.kind === 'parked' || car.kind === 'traffic') {
        const d = dist2d(x, z, car.x, car.z);
        if (d < bestD) { best = car; bestD = d; }
      }
    }
    return best;
  }

  return {
    cars, traffic, parked,
    spawnCar,
    stepTraffic,
    drivePlayer,
    nearestStealable,
    // The player's car becomes a plain parked car again when they step out.
    releaseCar(car) { car.kind = 'parked'; car.speed = 0; },
  };
}
