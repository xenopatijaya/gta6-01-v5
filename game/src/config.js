// SOLMARA configuration: every tunable number for the city, the cars, the police
// and the three-job story lives here so the rest of the game can stay mechanical.
// The city is a 6 x 6 grid of blocks. Roads run between the blocks; the whole map
// spans WORLD units on a side and the sea wraps the south and east edges.
export const WORLD = 480; // playable square, centred on (0, 0)
export const BLOCK = 64; // side of one city block, including its sidewalk ring
export const ROAD = 16; // width of a road between two blocks
export const GRID = 6; // blocks per side
export const PITCH = BLOCK + ROAD; // distance between neighbouring block centres
export const SAVE_KEY = 'solmara-save-v1';
export const SEED_DEFAULT = 20261118;

// Where the player starts: the plaza outside Lena's garage, south-west quarter.
export const SPAWN = { x: -96, z: 96 };

// Walking and driving feel.
export const WALK_SPEED = 7;
export const RUN_SPEED = 12;
export const CAR_TOP_SPEED = 46; // units per second, about 165 km/h on the HUD
export const CAR_ACCEL = 26;
export const CAR_BRAKE = 46;
export const CAR_STEER = 1.9; // radians per second at full lock, scaled by speed
export const CAR_REVERSE_SPEED = 14;

// Combat and health.
export const PLAYER_HEALTH = 100;
export const PUNCH_DAMAGE = 12;
export const SHOT_DAMAGE = 34;
export const SHOT_RANGE = 90;
export const SHOT_SPREAD = 0.02;
export const ENEMY_HEALTH = 70;
export const COP_HEALTH = 60;
export const COP_SHOT_DAMAGE = 7;
export const COP_SHOT_RANGE = 42;

// The wanted system: 0 to 5 stars. Crimes add heat, calm time bleeds it away.
export const WANTED_MAX = 5;
export const WANTED_DECAY_SECONDS = 26; // one star fades after this long without crime
export const HEAT_STEAL_CAR = 1;
export const HEAT_HIT_PED = 1;
export const HEAT_KILL = 1;
export const HEAT_SHOOT_COP = 2;
export const HEAT_MISSION_HEAT = 2; // picking up the getaway package

// Traffic and crowds.
export const TRAFFIC_CARS = 14;
export const PARKED_CARS = 10;
export const PEDESTRIANS = 26;
export const COP_CAR_PER_STAR = 1;
export const COP_FOOT_PER_STAR = 1;

// The three chained jobs. Each job has a cash payout, a list of objectives, and the
// place the player must reach (or the people they must stop). Markers are world coords.
export const MISSIONS = [
  {
    id: 1,
    title: 'JOB 1 — THE PICKUP',
    brief: 'Lena needs a package from the docks. Get to the yellow marker at Pier 9 and grab it. Any car will do — borrow one.',
    payout: 500,
    steps: [
      { kind: 'reach', label: 'Reach Pier 9 at the docks', x: 176, z: 176, radius: 10 },
      { kind: 'grab', label: 'Grab the package (press E)', x: 176, z: 176, radius: 10 },
    ],
  },
  {
    id: 2,
    title: 'JOB 2 — THE GETAWAY',
    brief: 'The package is hot and the cops know it. Drive it to Lena\'s garage — and do not stop for anyone in a uniform.',
    payout: 1200,
    heatOnStart: 2,
    steps: [
      { kind: 'reach', label: 'Drive the package to Lena\'s garage', x: -96, z: 96, radius: 12 },
    ],
  },
  {
    id: 3,
    title: 'JOB 3 — THE TAKEDOWN',
    brief: 'The Breakers set Lena up. Three of them are holed up in the old cannery warehouse. End the argument — then come home.',
    payout: 3000,
    steps: [
      { kind: 'reach', label: 'Reach the old cannery warehouse', x: 176, z: -176, radius: 14 },
      { kind: 'eliminate', label: 'Take out the three Breakers (click to shoot)', x: 176, z: -176, radius: 26, count: 3 },
      { kind: 'reach', label: 'Return to Lena\'s garage', x: -96, z: 96, radius: 12 },
    ],
  },
];

// Named places, shown on the minimap legend and in mission text.
export const PLACES = [
  { name: "Lena's Garage", x: -96, z: 96 },
  { name: 'Pier 9 Docks', x: 176, z: 176 },
  { name: 'Cannery Warehouse', x: 176, z: -176 },
  { name: 'Solmara Plaza', x: 0, z: 0 },
  { name: 'North Market', x: -40, z: -176 },
  { name: 'Beachfront', x: 200, z: 40 },
];

// Palette for the city: warm dusk sun, teal sea, pastel stucco buildings.
export const PALETTE = {
  sky: 0x87b5d6,
  fog: 0x9fc3d8,
  sun: 0xffd9a0,
  ground: 0x3d4a3a,
  sidewalk: 0x8d8578,
  road: 0x2e3138,
  roadLine: 0xd8c95a,
  sea: 0x1e6f8e,
  sand: 0xd9c28a,
  buildings: [0xe8a87c, 0xd9c08a, 0x9db8a6, 0xc98a8a, 0xa8b8d8, 0xe8d8a8, 0xb8a8c8, 0x8ac8b8],
  roofs: [0x7a4a3a, 0x4a5a6a, 0x6a6a5a, 0x8a3a3a],
  carPaints: [0xc23b2e, 0x2e6fc2, 0xd8b93a, 0x3aa655, 0xe8e8e8, 0x222226, 0x7a4ac2, 0xd87a2e],
  pedShirts: [0xd84a4a, 0x4a8ad8, 0x4ad87a, 0xd8d84a, 0xd84ad8, 0xffffff, 0x333333, 0xff9a3d],
  police: 0x1e3a8a,
  policeLight: 0xff2a2a,
  taxi: 0xe8c832,
};

// Every car model the game can spawn: a name shown on the speedometer and a
// handling flavour (top speed multiplier and acceleration multiplier).
export const CAR_MODELS = [
  { name: 'Comet', top: 1.0, accel: 1.0 },
  { name: 'Dune Runner', top: 0.85, accel: 1.1 },
  { name: 'Vesper GT', top: 1.18, accel: 0.95 },
  { name: 'Harbor Taxi', top: 0.8, accel: 1.0, taxi: true },
  { name: 'Bodega Van', top: 0.72, accel: 0.9 },
];
