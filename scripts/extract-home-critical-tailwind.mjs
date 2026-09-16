import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const input = path.join(root, 'frontend', 'index.html');
const output = path.join(root, 'scratch', 'tailwind-home-critical.html');
const html = await fs.readFile(input, 'utf8');
const start = html.indexOf('<body');
const end = html.indexOf('<!-- Primary page heading');

if (start < 0 || end < 0 || end <= start) {
  throw new Error('Unable to locate the homepage critical-content boundary.');
}

await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, html.slice(start, end), 'utf8');
console.log(`Extracted homepage critical markup to ${path.relative(root, output)}.`);
