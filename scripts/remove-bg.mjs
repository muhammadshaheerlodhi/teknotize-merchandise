import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const THRESHOLD = 42;

async function processHero(src, dest) {
  const { data, info } = await sharp(src)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = data.length / 4;
  for (let i = 0; i < pixels; i++) {
    const o = i * 4;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);

    // Remove flat black / near-black background; keep red artwork and edges.
    if (max <= THRESHOLD || (max - min <= 8 && max <= THRESHOLD + 12)) {
      data[o + 3] = 0;
    }
  }

  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toFile(dest);

  console.log(`Wrote ${dest} (${info.width}x${info.height})`);
}

const src = join(root, 'preview/assets/hero-athlete-source.png');
await processHero(src, join(root, 'preview/assets/hero-athlete.png'));
await processHero(src, join(root, 'assets/hero-athlete.png'));
