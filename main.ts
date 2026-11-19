// SAN VERANO: Neon Coast — make.fun entry hand-in program.
//
// The game itself is the plain static site in this directory's game/ folder:
// game/index.html plus its ES modules under game/src/, with no build step, no
// library code of mine beyond the vendored make.fun helper, and no network
// requests when it runs. This program's only job is delivery: it copies game/
// and screenshots/ into the output directory and writes dossier.json there,
// the machine-readable summary the judges read, using buildDossier from the
// vendored library in ./vendor/makefun-game.ts.
//
// Run it the way the grader does (output defaults to /output):
//   node main.ts
// Outside that container, point MAKEFUN_OUTPUT_DIR somewhere local:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play the game locally with:  node serve.ts   (then open the printed URL)

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fresh output directory layout: game/, screenshots/, dossier.json.
mkdirSync(outputDir, { recursive: true });
cpSync(join(here, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The caps below mirror the scorer's gates: text is summarised up to
// text_max_bytes, screenshots are limited to 4 files of at most 256 KiB each,
// and the game payload must stay under 993 files / 48 MiB in total with no
// single path longer than 1000 bytes. Passing them here means the entry the
// scorer receives is one it will accept.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
