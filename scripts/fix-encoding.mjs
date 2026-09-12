// Repairs UTF-8 text that was round-tripped through a Windows-1252 read, which
// turns em dashes and emoji into multi-character garbage, and strips byte order
// marks. Examples are omitted here on purpose: this file is in scope for its own
// scan, so literal mojibake in a comment would be rewritten.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIRS = ['sections', 'snippets', 'layout', 'templates', 'locales', 'config', 'scripts'];
const EXTRA = ['assets/theme.css.liquid', 'assets/theme.js'];
const TEXT = /\.(liquid|json|mjs|js|md|css)$/;

// Windows-1252 maps these byte values to characters outside Latin-1.
const CP1252_HIGH = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
};

const toCp1252 = (text) => {
  const bytes = [];
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code <= 0xff) bytes.push(code);
    else if (CP1252_HIGH[code] !== undefined) bytes.push(CP1252_HIGH[code]);
    else return null; // Not representable, so this run was never mojibake.
  }
  return Buffer.from(bytes);
};

// A mojibake run starts with a UTF-8 lead byte seen as Latin-1 (Â-÷) and is
// followed by continuation bytes, which surface as high Latin-1 or CP1252 chars.
const RUN = /[\u00c2-\u00f7][\u0080-\u00ff\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc\u2013\u2014\u2018-\u201e\u2020-\u2022\u2026\u2030\u2039\u203a\u20ac\u2122]{1,3}/g;

const repair = (text) =>
  text.replace(RUN, (run) => {
    const bytes = toCp1252(run);
    if (!bytes) return run;
    const decoded = bytes.toString('utf8');
    // Reject anything that did not decode cleanly into fewer characters.
    if (decoded.includes('\ufffd') || [...decoded].length >= [...run].length) return run;
    return decoded;
  });

const files = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (TEXT.test(entry.name)) files.push(full);
  }
};
for (const dir of DIRS) walk(path.join(ROOT, dir));
for (const extra of EXTRA) files.push(path.join(ROOT, extra));

let changed = 0;
for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  let text = original;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  text = repair(text);

  if (text !== original) {
    fs.writeFileSync(file, text, 'utf8');
    console.log(`fixed ${path.relative(ROOT, file)}`);
    changed++;
  }
}
console.log(changed ? `\n${changed} file(s) repaired.` : 'Nothing to repair.');
