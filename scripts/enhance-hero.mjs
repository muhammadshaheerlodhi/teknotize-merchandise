import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const ORANGE = { r: 252, g: 0, b: 10 };
const ORANGE_HI = { r: 255, g: 110, b: 58 };
const HAIR_DARK = { r: 48, g: 28, b: 18 };
const HAIR_MID = { r: 102, g: 58, b: 34 };
const HAIR_LIGHT = { r: 185, g: 142, b: 108 };
const HAIR_WHITE = { r: 255, g: 252, b: 246 };
const OUTLINE = { r: 22, g: 5, b: 4 };
const SKIN_HI = { r: 255, g: 220, b: 205 };

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mix(c1, c2, t) {
  return {
    r: Math.round(lerp(c1.r, c2.r, t)),
    g: Math.round(lerp(c1.g, c2.g, t)),
    b: Math.round(lerp(c1.b, c2.b, t)),
  };
}

function lum(r, g, b) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function isBackground(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max <= 46 || (max - min <= 10 && max <= 58);
}

function isRedArt(r, g, b) {
  return r > 50 && r > g + 10 && r > b + 6;
}

function inHair(x, y, w, h) {
  const nx = x / w;
  const ny = y / h;
  return ny >= 0.015 && ny <= 0.19 && nx >= 0.18 && nx <= 0.72;
}

function inNum3(x, y, w, h) {
  const nx = x / w;
  const ny = y / h;
  return nx >= 0.56 && nx <= 0.97 && ny >= 0.04 && ny <= 0.46;
}

function inName(x, y, w, h) {
  return y / h >= 0.715;
}

function inFace(x, y, w, h) {
  const nx = x / w;
  const ny = y / h;
  return ny >= 0.12 && ny <= 0.52 && nx >= 0.2 && nx <= 0.68;
}

function colorHair(r, g, b) {
  const l = lum(r, g, b);
  if (l >= 0.62) return HAIR_WHITE;
  if (l >= 0.48) return mix(HAIR_LIGHT, HAIR_WHITE, (l - 0.48) / 0.14);
  if (l >= 0.28) return mix(HAIR_MID, HAIR_LIGHT, (l - 0.28) / 0.2);
  return mix(HAIR_DARK, HAIR_MID, l / 0.28);
}

function colorOrange(r, g, b, boost = 1) {
  const l = lum(r, g, b);
  if (l < 0.16) return OUTLINE;
  const t = Math.min(1, l * boost);
  return mix(OUTLINE, t > 0.76 ? ORANGE_HI : ORANGE, t);
}

function colorName(r, g, b) {
  const l = lum(r, g, b);
  if (l < 0.14) return OUTLINE;
  if (l < 0.36) return mix(OUTLINE, ORANGE, (l - 0.14) / 0.22);
  return mix(ORANGE, ORANGE_HI, Math.min(1, (l - 0.36) / 0.5));
}

function colorFace(r, g, b) {
  const l = lum(r, g, b);
  if (l < 0.18) return OUTLINE;
  if (l >= 0.62) return SKIN_HI;
  return mix(OUTLINE, SKIN_HI, (l - 0.18) / 0.44);
}

async function enhanceHero(src, dest) {
  const { data, info } = await sharp(src)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const out = Buffer.from(data);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (isBackground(r, g, b)) {
        out[i + 3] = 0;
        continue;
      }

      let color;
      if (!isRedArt(r, g, b)) {
        color = { r, g, b };
      } else if (inHair(x, y, width, height)) {
        color = colorHair(r, g, b);
      } else if (inNum3(x, y, width, height)) {
        const l = lum(r, g, b);
        color = l < 0.18 ? OUTLINE : mix(ORANGE, ORANGE_HI, Math.min(1, (l - 0.18) / 0.42));
      } else if (inName(x, y, width, height)) {
        color = colorName(r, g, b);
      } else if (inFace(x, y, width, height)) {
        color = colorFace(r, g, b);
      } else {
        color = colorOrange(r, g, b, 1.05);
      }

      out[i] = color.r;
      out[i + 1] = color.g;
      out[i + 2] = color.b;
      out[i + 3] = 255;
    }
  }

  // Resize for web hero while keeping quality
  await sharp(out, { raw: { width, height, channels: 4 } })
    .resize(520, null, { fit: 'inside' })
    .png({ compressionLevel: 9 })
    .toFile(dest);

  const meta = await sharp(dest).metadata();
  console.log(`Enhanced ${dest} (${meta.width}x${meta.height})`);
}

const src = join(root, 'preview/assets/hero-athlete.jpg');
await enhanceHero(src, join(root, 'preview/assets/hero-athlete.png'));
await enhanceHero(src, join(root, 'assets/hero-athlete.png'));
