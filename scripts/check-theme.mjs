// Renders every template through the local engine and reports problems.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderTemplate, resolve, errors, pageHandles, parseThemeJson } from './dev-server.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const paths = [
  '/',
  '/collections',
  '/collections/all',
  '/products/sample',
  '/cart',
  '/search',
  '/blogs',
  '/this-route-does-not-exist',
  '/account',
  '/account/login',
  '/account/register',
  '/account/addresses',
  '/account/reset_password',
  '/account/activate_account',
  '/account/orders',
  ...pageHandles.filter(Boolean).map((h) => `/pages/${h}`),
];

const warnings = [];
let failures = 0;

for (const urlPath of paths) {
  const route = resolve(urlPath) || { name: '404' };
  const before = errors.length;
  const { html } = await renderTemplate(route.name, route.suffix, {
    path: urlPath,
    objects: route.objects,
  });

  const body = (html.match(/<main[^>]*>([\s\S]*?)<\/main>/) || [, ''])[1];
  const sections = (body.match(/id="shopify-section-/g) || []).length;
  const text = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const added = errors.length - before;

  // Liquid templates render markup directly; only JSON templates wrap in sections.
  const isJsonTemplate = fs.existsSync(
    path.join(ROOT, `templates/${route.name}${route.suffix ? '.' + route.suffix : ''}.json`)
  );

  // An empty href renders as a link that silently goes nowhere, which is what
  // happens when a section reads a variable that was assigned inside a snippet.
  const dead = [...html.matchAll(/<a[^>]*href=""[^>]*>([\s\S]{0,80}?)<\/a>/g)].map((m) =>
    m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  );
  for (const label of new Set(dead)) {
    warnings.push(`${urlPath} has a dead link (empty href): "${label || 'unlabelled'}"`);
  }

  if (added) failures += added;
  if (isJsonTemplate && !sections) warnings.push(`${urlPath} rendered 0 sections inside <main>`);
  if (text.length < 40) warnings.push(`${urlPath} has almost no body text (${text.length} chars)`);

  const status = added ? 'FAIL' : sections || !isJsonTemplate ? 'ok  ' : 'WARN';
  console.log(`${status} ${urlPath.padEnd(28)} sections=${String(sections).padEnd(3)} body=${text.length} chars`);
}

// Homepage must contain every section declared in templates/index.json.
const index = parseThemeJson(fs.readFileSync(path.join(ROOT, 'templates/index.json'), 'utf8'));
const { html: home } = await renderTemplate('index', null, { path: '/' });
for (const key of index.order) {
  if (!home.includes(`id="shopify-section-${key}"`)) {
    warnings.push(`homepage is missing section "${key}" (${index.sections[key]?.type})`);
  }
}

console.log('\n--- results ---');
console.log(`homepage sections expected: ${index.order.length}`);
console.log(`homepage sections rendered: ${(home.match(/id="shopify-section-/g) || []).length - 2}`);

if (errors.length) {
  console.log(`\nERRORS (${errors.length}):`);
  [...new Set(errors)].forEach((e) => console.log('  - ' + e));
}
if (warnings.length) {
  console.log(`\nWARNINGS (${warnings.length}):`);
  [...new Set(warnings)].forEach((w) => console.log('  - ' + w));
}
if (!errors.length && !warnings.length) console.log('\nNo problems found.');

process.exit(errors.length ? 1 : 0);
