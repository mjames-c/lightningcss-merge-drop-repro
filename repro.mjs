// Runs minify.mjs in many fresh Node processes and tallies the distinct outputs.
//
// The bug only shows up across processes: the output is stable within a single
// process, so calling transform() in a loop never reproduces it.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const runs = Number(process.argv[2] ?? 1000);
const script = fileURLToPath(new URL('./minify.mjs', import.meta.url));
const { version } = JSON.parse(
  readFileSync(new URL('./node_modules/lightningcss/package.json', import.meta.url), 'utf8'),
);

const counts = new Map();
for (let i = 0; i < runs; i++) {
  const { stdout, stderr, status } = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  if (status !== 0) {
    throw new Error(`minify.mjs failed:\n${stderr}`);
  }
  counts.set(stdout, (counts.get(stdout) ?? 0) + 1);
}

console.log(`lightningcss ${version}, ${runs} processes\n`);
for (const [output, count] of [...counts].sort((a, b) => b[1] - a[1])) {
  const note = output.includes('.c{') ? '' : '   <-- .c was dropped';
  console.log(`${String(count).padStart(6)}  ${output}${note}`);
}

if (counts.size > 1) {
  console.log('\nNon-deterministic output: reproduced.');
  process.exitCode = 1;
} else {
  console.log('\nOutput was identical in every run (not reproduced this time; try more runs).');
}
