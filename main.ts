// Entry point for the San Verano: Neon Coast make.fun submission (competition gta6-01).
// The playable game lives in the game/ folder next to this file as plain static files:
// an HTML page plus ES modules that a desktop browser loads fully offline, with every
// sprite drawn on canvas and every sound synthesized at runtime, so there is nothing
// to install and nothing fetched over the network when the game runs.
//
// Running this program is the hand-in step. It mirrors the game/ tree and the
// screenshots/ folder into the output directory, then asks the vendored make.fun
// library to summarize that output as dossier.json, which is the record the judges
// read. The caps passed below are the competition gate's own limits: they shape how
// much source text the dossier may carry and they make this program refuse an entry
// that the scorer would refuse (too many screenshots, an oversized screenshot, too
// many game files, too many game bytes, or an overlong path under game/).
//
// Local check outside the grading container:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play locally with: node serve.ts  (then open the printed address)

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoDir, 'game'), join(outputDir, 'game'), { recursive: true });

const shotsTarget = join(outputDir, 'screenshots');
mkdirSync(shotsTarget, { recursive: true });
const shotsSource = join(repoDir, 'screenshots');
if (existsSync(shotsSource)) {
  cpSync(shotsSource, shotsTarget, { recursive: true });
}

const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
