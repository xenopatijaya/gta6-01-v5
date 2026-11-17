// SOLMARA — a GTA-style open-world crime game for make.fun bounty gta6-01.
//
// This is the hand-in program for the entry (Node 22, standard library only).
// It takes the playable game from this repository's game/ folder and the four
// screenshots from screenshots/, copies both into the output directory the
// grader provides, and writes output/dossier.json — the summary the house
// judge reads — using the make.fun library vendored beside this file.
//
// The game itself is a static three.js open world: Dario Reyes runs three jobs
// for fixer Lena Cruz across a 6x6-block coastal city, stealing cars, dodging
// the Solmara police, and shooting it out at the old cannery. It plays offline
// in a desktop browser from game/index.html; nothing is fetched at runtime.
//
// Run it locally first with `node serve.ts`, then open http://localhost:8080.
// To produce the hand-in outside the grader's container, point the output
// somewhere writable and run:
//   MAKEFUN_OUTPUT_DIR=/tmp/solmara-out node main.ts
// Inside the grader, MAKEFUN_OUTPUT_DIR is unset and /output is used.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The repository root is the folder this file lives in.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

// --- sanity checks of my own, before anything is copied -------------------------
// The hand-in is worthless without its entry point, its engine and its pictures.
const entryPoint = join(gameDir, 'index.html');
if (!existsSync(entryPoint)) {
  throw new Error(`SOLMARA hand-in refused: ${entryPoint} is missing`);
}
const engine = join(gameDir, 'vendor', 'three.module.min.js');
if (!existsSync(engine)) {
  throw new Error(`SOLMARA hand-in refused: vendored three.js is missing at ${engine}`);
}
const shotNames = existsSync(shotsDir)
  ? readdirSync(shotsDir).filter((name) => /\.(png|jpe?g)$/i.test(name)).sort()
  : [];
if (shotNames.length < 3 || shotNames.length > 4) {
  throw new Error(`SOLMARA hand-in refused: expected 3 or 4 screenshots, found ${shotNames.length}`);
}
for (const name of shotNames) {
  const size = statSync(join(shotsDir, name)).size;
  if (size > 262144) {
    throw new Error(`SOLMARA hand-in refused: screenshot ${name} is ${size} bytes (cap 256 KiB)`);
  }
}

// --- copy the game and the screenshots into the output directory ------------------
mkdirSync(outputDir, { recursive: true });
cpSync(gameDir, join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });

// --- write the dossier -------------------------------------------------------------
// These are the scorer's caps for gta6-01 (reference/gate.json): at most 4
// screenshots of 256 KiB each, at most 993 files totalling 48 MiB under game/,
// no game path longer than 1000 bytes, and at most 163,840 bytes of dossier text.
// buildDossier measures the copied output and refuses an entry that breaks them,
// so a bad hand-in fails loudly here instead of silently at the judge.
const dossierText = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossierText);

console.log(`SOLMARA handed in: ${shotNames.length} screenshots, dossier ${dossierText.length} bytes -> ${outputDir}`);
