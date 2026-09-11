import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
function isBg(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max <= 52 || (max - min <= 12 && max <= 64);
}

async function processLogo(src, dest) {
  const { data, info } = await sharp(src)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const bg = new Uint8Array(width * height);
  const queue = [];

  const push = (x, y) => {
    const idx = y * width + x;
    if (bg[idx]) return;
    const i = idx * 4;
    if (!isBg(data[i], data[i + 1], data[i + 2])) return;
    bg[idx] = 1;
    queue.push(idx);
  };

  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }

  while (queue.length) {
    const idx = queue.pop();
    const x = idx % width;
    const y = (idx - x) / width;
    if (x > 0) push(x - 1, y);
    if (x < width - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < height - 1) push(x, y + 1);
  }

  for (let idx = 0; idx < width * height; idx++) {
    const i = idx * 4;
    if (bg[idx]) data[i + 3] = 0;
  }

  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .resize(240, null, { fit: 'inside' })
    .png({ compressionLevel: 9 })
    .toFile(dest);

  console.log(`Wrote ${dest}`);
}

const src = join(root, 'preview/assets/logo-source.jpg');
await processLogo(src, join(root, 'preview/assets/logo.png'));
await processLogo(src, join(root, 'assets/logo.png'));
