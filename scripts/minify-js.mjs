import fs from 'node:fs/promises';
import path from 'node:path';
import { minify } from 'terser';

const root = process.cwd();
const jsDir = path.join(root, 'frontend', 'js');
const outputDir = jsDir;
const htmlDir = path.join(root, 'frontend');

await fs.mkdir(outputDir, { recursive: true });

const jsFiles = (await fs.readdir(jsDir))
  .filter((name) => name.endsWith('.js') && !name.endsWith('.min.js'));

for (const name of jsFiles) {
  const source = await fs.readFile(path.join(jsDir, name), 'utf8');
  const rewrittenImports = source.replace(/(["']\.\/[^"']+)\.js(["'])/g, '$1.min.js$2');
  const result = await minify(rewrittenImports, {
    compress: true,
    mangle: true,
    module: /(^|\n)\s*(import|export)\s/m.test(rewrittenImports),
  });

  if (!result.code) throw new Error(`Unable to minify ${name}`);
  await fs.writeFile(path.join(outputDir, name.replace(/\.js$/, '.min.js')), result.code, 'utf8');
}

for (const name of await fs.readdir(htmlDir)) {
  if (!name.endsWith('.html')) continue;
  const filePath = path.join(htmlDir, name);
  const html = await fs.readFile(filePath, 'utf8');
  // Normalise files produced by an earlier build, then only update references
  // that do not already point to a minified file. This keeps repeat builds safe.
  const normalizedHtml = html.replace(/\.min(?:\.min)+\.js/g, '.min.js');
  const minifiedHtml = normalizedHtml.replace(/((?:\.\/|\/)js\/[^"'?#]+?)(?<!\.min)\.js(?=\?[^"']*)?(?=["'])/g, '$1.min.js');
  if (html !== minifiedHtml) await fs.writeFile(filePath, minifiedHtml, 'utf8');
}

console.log(`Minified ${jsFiles.length} JavaScript files.`);
