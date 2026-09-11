/**
 * Builds a Shopify-ready theme zip (folders at zip root, no preview/node_modules).
 * Run: node scripts/build-theme-zip.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const zipPath = join(root, 'teknotize-theme-upload.zip');
const themeFolders = ['assets', 'config', 'layout', 'locales', 'sections', 'snippets', 'templates'];

const required = [
  'layout/theme.liquid',
  'config/settings_schema.json',
  'config/settings_data.json',
  'templates/index.json',
  'templates/404.json',
  'sections/header-group.json',
  'sections/footer-group.json',
  'locales/en.default.json',
  'assets/theme.css.liquid',
  'assets/theme.js',
];

console.log('Teknotize theme upload packager\n');

let failed = false;
for (const file of required) {
  const ok = existsSync(join(root, file));
  console.log(`${ok ? '✓' : '✗'} ${file}`);
  if (!ok) failed = true;
}

for (const file of ['templates/index.json', 'config/settings_schema.json']) {
  try {
    JSON.parse(readFileSync(join(root, file), 'utf8'));
    console.log(`✓ ${file} (valid JSON)`);
  } catch (e) {
    console.log(`✗ ${file} INVALID: ${e.message}`);
    failed = true;
  }
}

if (failed) {
  console.error('\nFix missing/invalid files before uploading.');
  process.exit(1);
}

function collectFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...collectFiles(full));
    else files.push(full);
  }
  return files;
}

const ps = `
$root = '${root.replace(/'/g, "''")}'
$zipPath = '${zipPath.replace(/'/g, "''")}'
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open($zipPath, 'Create')
$folders = @(${themeFolders.map((f) => `'${f}'`).join(',')})
foreach ($folder in $folders) {
  $src = Join-Path $root $folder
  if (Test-Path $src) {
    Get-ChildItem $src -Recurse -File | ForEach-Object {
      $rel = $_.FullName.Substring($root.Length + 1).Replace('\\','/')
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel) | Out-Null
    }
  }
}
$zip.Dispose()
Write-Output "ZIP_OK"
`;

execSync(ps, { stdio: ['pipe', 'pipe', 'inherit'], shell: 'powershell.exe' });

let total = 0;
for (const folder of themeFolders) {
  total += collectFiles(join(root, folder)).length;
}

console.log(`\nCreated: ${zipPath}`);
console.log(`Files packaged: ${total}`);
console.log('\nUpload this zip in Shopify Admin:');
console.log('  Online Store → Themes → Add theme → Upload zip file');
console.log('\nDo NOT zip the parent folder manually. Use this file only.');
