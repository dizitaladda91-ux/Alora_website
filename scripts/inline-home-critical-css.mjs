import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const htmlPath = path.join(root, 'frontend', 'index.html');
const cssPath = path.join(root, 'frontend', 'styles', 'tailwind-home-critical.min.css');
const marker = '    <!-- HOME_CRITICAL_TAILWIND -->';
const styleTag = /\s*<style id="home-critical-tailwind">[\s\S]*?<\/style>/;
const [html, css] = await Promise.all([fs.readFile(htmlPath, 'utf8'), fs.readFile(cssPath, 'utf8')]);

const inlineStyle = `    <style id="home-critical-tailwind">${css}</style>`;
const hasMarker = html.includes(marker);
const hasExistingStyle = styleTag.test(html);
if (!hasMarker && !hasExistingStyle) throw new Error('Critical CSS marker or existing inline style not found.');
const updated = hasMarker
  ? html.replace(marker, inlineStyle)
  : html.replace(styleTag, `\n${inlineStyle}`);
await fs.writeFile(htmlPath, updated, 'utf8');
await fs.rm(cssPath, { force: true });
await fs.rm(path.join(root, 'scratch', 'tailwind-home-critical.html'), { force: true });
console.log(`Inlined ${Buffer.byteLength(css)} bytes of homepage critical Tailwind CSS.`);
