import { readFileSync, writeFileSync, copyFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'assets', 'theme.css.liquid');
const dest = join(root, 'preview', 'assets', 'theme.css');

let css = readFileSync(src, 'utf8');
css = css.replace(/\{\{\s*settings\.[^}]+\}\}/g, (match) => {
  const m = match.match(/default:\s*'([^']+)'/);
  return m ? m[1] : '';
});

writeFileSync(dest, css);
copyFileSync(join(root, 'assets', 'theme.js'), join(root, 'preview', 'assets', 'theme.js'));
console.log('Synced preview assets');
