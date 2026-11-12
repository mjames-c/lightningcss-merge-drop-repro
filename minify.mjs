// Minifies input.css once and prints the result.
import { readFileSync } from 'node:fs';
import { transform } from 'lightningcss';

const { code } = transform({
  filename: 'input.css',
  code: readFileSync(new URL('./input.css', import.meta.url)),
  minify: true,
});
process.stdout.write(Buffer.from(code).toString());
