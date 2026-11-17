// The story: three chained jobs from fixer Lena Cruz. Each job is a short list
// of steps — reach a place, grab something, take out a count of enemies — and
// pays out on completion. The mission module owns the beacon in the world, the
// objective text, and the save-friendly progress (mission index + step index).
import * as THREE from 'three';
import { MISSIONS } from './config.js';
import { dist2d } from './random.js';

export function createMissions(scene, onEvent) {
  let missionIndex = 0; // 0, 1, 2 — or 3 when the story is done
  let stepIndex = 0;
  let eliminated = 0;

  // The beacon: a tall yellow pillar of light plus a bouncing diamond marker.
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 90, 12, 1, true), beaconMat);
  beacon.position.y = 45;
  scene.add(beacon);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.6),
    new THREE.MeshBasicMaterial({ color: 0xffd23f }),
  );
  scene.add(diamond);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(4, 5.4, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.75, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  scene.add(ring);

  function current() {
    return missionIndex < MISSIONS.length ? MISSIONS[missionIndex] : null;
  }
  function currentStep() {
    const m = current();
    return m ? m.steps[stepIndex] : null;
  }
  function target() {
    const s = currentStep();
    return s ? { x: s.x, z: s.z } : null;
  }

  function placeBeacon(dt, time) {
    const t = target();
    if (!t) {
      beacon.visible = false;
      diamond.visible = false;
      ring.visible = false;
      return;
    }
    beacon.visible = true;
    diamond.visible = true;
    ring.visible = true;
    beacon.position.x = t.x;
    beacon.position.z = t.z;
    diamond.position.set(t.x, 9 + Math.sin(time * 2.2) * 1.4, t.z);
    diamond.rotation.y = time * 1.4;
    ring.position.x = t.x;
    ring.position.z = t.z;
    const pulse = 1 + Math.sin(time * 3) * 0.08;
    ring.scale.setScalar(pulse);
  }

  function describe() {
    const m = current();
    if (!m) return { title: 'SOLMARA LEGEND', text: 'All three jobs done. The city is yours, Dario.' };
    const s = currentStep();
    let label = s.label;
    if (s.kind === 'eliminate') label += ` — ${eliminated}/${s.count} down`;
    return { title: m.title, text: `${label} · Payout ${m.payout ? '$' + m.payout.toLocaleString('en-US') : ''}` };
  }

  function advanceStep() {
    const m = current();
    stepIndex += 1;
    if (stepIndex >= m.steps.length) {
      const payout = m.payout;
      missionIndex += 1;
      stepIndex = 0;
      eliminated = 0;
      onEvent({ type: 'missionComplete', mission: m, payout });
      const next = current();
      if (next && next.heatOnStart) onEvent({ type: 'heat', amount: next.heatOnStart });
      if (missionIndex >= MISSIONS.length) onEvent({ type: 'storyComplete' });
    } else {
      onEvent({ type: 'stepComplete', mission: m, step: currentStep() });
    }
  }

  // Called every frame: complete reach/grab steps when the player is close.
  // Grab steps need the E key; eliminate steps are completed by main.js kills.
  function update(dt, player, interactPressed) {
    const m = current();
    if (!m) return;
    const s = currentStep();
    if (!s) return;
    const d = dist2d(player.x, player.z, s.x, s.z);
    if (s.kind === 'reach' && d < s.radius) {
      advanceStep();
    } else if (s.kind === 'grab' && d < s.radius && interactPressed) {
      advanceStep();
    }
  }

  function noteEliminated() {
    const s = currentStep();
    if (!s || s.kind !== 'eliminate') return;
    eliminated += 1;
    onEvent({ type: 'eliminated', left: s.count - eliminated });
    if (eliminated >= s.count) advanceStep();
  }

  function startMission(index) {
    missionIndex = index;
    stepIndex = 0;
    eliminated = 0;
    const m = current();
    if (m && m.heatOnStart) onEvent({ type: 'heat', amount: m.heatOnStart });
    if (m) onEvent({ type: 'missionStart', mission: m });
  }

  return {
    get missionIndex() { return missionIndex; },
    get stepIndex() { return stepIndex; },
    get eliminated() { return eliminated; },
    current,
    currentStep,
    target,
    placeBeacon,
    describe,
    update,
    noteEliminated,
    startMission,
    // Restore progress from a save without replaying the start event.
    restore(index, step) {
      missionIndex = index;
      stepIndex = step;
      eliminated = 0;
    },
  };
}
