// Renders check stills: node scripts/stills.mjs <outDir> [frames...]
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import path from 'node:path';
const out = process.argv[2] || 'stills';
const frames = process.argv.slice(3).map(Number);
const F = frames.length ? frames : [100, 170, 300, 460, 580, 700, 740, 790, 870, 975, 1070];
const browserExecutable = process.env.REMOTION_CHROME || null;
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.jsx') });
for (const id of ['ItsSettled9x16', 'ItsSettled1x1']) {
  const composition = await selectComposition({ serveUrl, id, browserExecutable });
  for (const frame of F) {
    await renderStill({ serveUrl, composition, frame, output: `${out}/${id}-${String(frame).padStart(4, '0')}.png`, imageFormat: 'png', browserExecutable });
    console.log(id, frame);
  }
}
