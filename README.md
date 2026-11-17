# SOLMARA — An Open-World Crime Story

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/xenopatijaya/gta6-01-v5/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/xenopatijaya/gta6-01-v5/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An entry for the make.fun **gta6-01 "Make GTA 6"** bounty: the most complete
open-world crime game an agent can build — a whole fictional city, on foot and
by car, with traffic, pedestrians, car stealing, a wanted system, police
chases, three chained story missions, combat, a HUD with a live minimap, a
start screen and a save. It plays **offline in a desktop browser from static
files**, with keyboard and mouse, and makes **zero network requests** at
runtime. Everything in it is original: the city, the characters, the vehicles,
the names, the story, the art, the sound and the music. No Rockstar names,
logos, characters, maps or assets anywhere.

## The story

You are **Dario Reyes**, a getaway driver fresh out of the Solmara docks with
empty pockets and a fast reputation. Fixer **Lena Cruz** has three jobs for
you — and the Solmara Police Department has a very short memory for manners:

1. **The Pickup** — fetch a package from Pier 9 at the docks. ($500)
2. **The Getaway** — drive the hot package to Lena's garage while the cops close in. ($1,200)
3. **The Takedown** — settle the score with the three Breakers holed up in the old cannery warehouse, then come home. ($3,000)

Finish all three and you are a Solmara legend. Get wasted and the hospital
takes its 10%.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no dependencies at runtime. three.js r160 is vendored as a
single minified module under `game/vendor/`.

| Key | Action |
| --- | --- |
| WASD / arrows | Walk / drive |
| SHIFT | Run |
| E | Steal a car / grab / interact |
| F | Leave the car |
| Click | Shoot |
| Mouse drag | Look around |
| P | Pause |
| M | Mute |
| R / N (while paused) | Restart from save / new game |

Progress (cash, job, health, position, wanted level) saves to `localStorage`
automatically and resumes when you press **START ENGINE**.

## What is in the city

- **Solmara, 6 × 6 blocks** — a coastal city with a plaza and fountain, the
  Pier 9 docks, the old cannery warehouse, Lena's garage, a beachfront and a
  sea at the south and east edges, all lit by a low dusk sun.
- **Traffic** — 14 cars driving the road grid, turning at intersections and
  stopping behind the car ahead, plus 10 parked cars waiting to be borrowed.
- **Pedestrians** — 26 people strolling the sidewalks who run for cover when
  shots are fired or a car comes at them.
- **Wanted system, 0–5 stars** — stealing a car, hitting a pedestrian or
  shooting a cop raises the heat; staying calm lets it fade. Police
  interceptors ram and box you in, foot cops close in and shoot.
- **Combat** — hitscan shooting with tracers, muzzle sound, gangsters who
  strafe and return fire, and a health bar that slowly recovers when calm.
- **HUD + live minimap** — cash, wanted stars, health, the current objective,
  a speedometer, and a circular minimap showing roads, the mission marker,
  traffic, police, gangsters and your view cone.
- **Sound, all synthesized** — engine hum, two-tone siren, gunshots, crashes,
  pickup chimes and a looping bassline, built with the WebAudio API. No audio
  files.

## Repository layout

```text
game/
  index.html            the game page (HUD, minimap, screens)
  src/
    config.js           tuning, the city grid, the three missions
    random.js           seeded RNG and small math helpers
    input.js            keyboard + mouse-drag input
    audio.js            synthesized WebAudio sound and music
    city.js             the 6x6 city, colliders, spawn points
    vehicles.js         car factory, traffic AI, driving model
    people.js           pedestrians, gangsters, the player character
    police.js           wanted system, police cars and foot cops
    missions.js         the three-job story state machine
    hud.js              HUD, minimap, toasts and screens
    main.js             boot, the game loop, combat, save/load
  vendor/
    three.module.min.js three.js r160, minified single-file build
screenshots/            four 1280x720 screenshots of the game
main.ts                 hand-in program: copies game/ + screenshots/ to
                        /output and writes /output/dossier.json
serve.ts                static server for local play
shots.json              screenshot metadata
```

## Screenshots

The four screenshots are staged deterministically with `?shot=` and `?seed=1`:

1. `1-start.jpg` — the title screen over the city at dusk.
2. `2-play.jpg` — Dario driving a stolen Vesper GT through downtown.
3. `3-chase.jpg` — three stars, two interceptors closing in.
4. `4-mission.jpg` — on foot outside the cannery, Breakers in the yard.

## Hand in

```sh
MAKEFUN_OUTPUT_DIR=/tmp/solmara-out node main.ts
```

This copies `game/` and `screenshots/` to the output directory and writes
`dossier.json` with the vendored make.fun library, enforcing the scorer's
caps (4 screenshots of at most 256 KiB, at most 993 game files totalling
48 MiB, dossier text at most 163,840 bytes). Inside the grader,
`MAKEFUN_OUTPUT_DIR` is unset and `/output` is used.

## License

MIT — see [LICENSE](LICENSE). three.js is © Three.js Authors, MIT licensed.
