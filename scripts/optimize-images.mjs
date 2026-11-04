// scripts/optimize-images.mjs
// Pre-build image pipeline: responsive AVIF + WebP variants, EXIF rotation, ICC profile preservation,
// photo vs graphic classification, LQIP generation, and OG cover resizing.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const SRC = path.resolve(process.cwd(), 'content');
const OUT = path.resolve(process.cwd(), 'public', 'images', 'optimized');
const CACHE = path.resolve(process.cwd(), '.cache', 'images');
const MANIFEST = path.resolve(process.cwd(), 'src', 'generated', 'images-manifest.json');
const WIDTHS = [480, 768, 1080, 1440, 2160];
const RASTER = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.tif', '.tiff', '.heic']);

async function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else out.push(p);
  }
  return out;
}

async function isGraphic(img, meta) {
  if (meta.format === 'jpeg') return false;
  try {
    const { entropy } = await img.clone().stats();
    return Boolean(meta.hasAlpha) || entropy < 6;
  } catch {
    return Boolean(meta.hasAlpha);
  }
}

function minifySvg(svgString) {
  return svgString
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function generateStaticIcons() {
  const publicDir = path.resolve(process.cwd(), 'public');
  const faviconSvgPath = path.join(publicDir, 'favicon.svg');
  if (!existsSync(faviconSvgPath)) return;

  const svgBuf = await fs.readFile(faviconSvgPath);

  // apple-touch-icon.png (180x180)
  const appleIconPath = path.join(publicDir, 'apple-touch-icon.png');
  if (!existsSync(appleIconPath)) {
    await sharp(svgBuf)
      .resize(180, 180)
      .png({ palette: true, quality: 95, compressionLevel: 9 })
      .toFile(appleIconPath);
  }

  // favicon-48x48.png and favicon.ico (48x48 PNG in ICO container for Google Search mobile results)
  const png48 = await sharp(svgBuf)
    .resize(48, 48)
    .png({ compressionLevel: 9 })
    .toBuffer();

  const icoPath = path.join(publicDir, 'favicon.ico');
  if (!existsSync(icoPath)) {
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0); // Reserved
    header.writeUInt16LE(1, 2); // ICO type
    header.writeUInt16LE(1, 4); // 1 image

    const dir = Buffer.alloc(16);
    dir.writeUInt8(48, 0); // width
    dir.writeUInt8(48, 1); // height
    dir.writeUInt8(0, 2);  // palette
    dir.writeUInt8(0, 3);  // reserved
    dir.writeUInt16LE(1, 4); // color planes
    dir.writeUInt16LE(32, 6); // bpp
    dir.writeUInt32LE(png48.length, 8); // size
    dir.writeUInt32LE(22, 12); // offset (6 + 16)

    await fs.writeFile(icoPath, Buffer.concat([header, dir, png48]));
  }
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  await fs.mkdir(CACHE, { recursive: true });
  await generateStaticIcons();

  const manifest = {};
  const files = await walk(SRC);

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!RASTER.has(ext) && ext !== '.svg') continue;

    const buf = await fs.readFile(file);
    const sizeBytes = buf.length;
    const filename = path.basename(file);
    const relKey = path.relative(SRC, file).replace(/\\/g, '/').toLowerCase();
    const baseKey = filename.toLowerCase();
    const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8);
    const base = path.parse(file).name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const isOversized = sizeBytes > 1024 * 1024;
    if (isOversized) {
      const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
      console.warn(`[Image Warning] Oversized image (${sizeMB}MB): "${filename}".`);
    }

    if (ext === '.svg') {
      const data = minifySvg(buf.toString('utf8'));
      const name = `${base}.${hash}.svg`;
      await fs.writeFile(path.join(OUT, name), data, 'utf8');
      const vb = data.match(/viewBox=["'][\d.\s-]+?\s([\d.]+)\s([\d.]+)["']/i);
      const wMatch = data.match(/\bwidth=["'](\d+(?:\.\d+)?)/i);
      const hMatch = data.match(/\bheight=["'](\d+(?:\.\d+)?)/i);
      const width = Math.round(+(vb?.[1] ?? wMatch?.[1] ?? 800));
      const height = Math.round(+(vb?.[2] ?? hMatch?.[1] ?? 600));

      const entry = {
        type: 'svg',
        filename,
        sourcePath: path.relative(process.cwd(), file),
        src: `/images/optimized/${name}`,
        optimizedUrl: `/images/optimized/${name}`,
        width,
        height,
        format: 'svg',
        sizeBytes,
        isOversized,
        variants: { avif: [], webp: [] },
      };
      manifest[baseKey] = entry;
      manifest[relKey] = entry;
      continue;
    }

    const meta = await sharp(buf).metadata();
    const animated = (meta.pages ?? 1) > 1;
    const pipeline = sharp(buf, { animated }).rotate().keepIccProfile();
    const graphic = await isGraphic(pipeline, meta);
    const intrinsicW = meta.autoOrient?.width ?? meta.width ?? 800;
    const intrinsicH = meta.autoOrient?.height ?? meta.height ?? 600;

    if (intrinsicW > 2000 || intrinsicH > 2000) {
      console.warn(`[Image Warning] High-resolution image (${intrinsicW}x${intrinsicH}): "${filename}".`);
    }

    const widths = [...new Set([...WIDTHS.filter((w) => w < intrinsicW), Math.min(intrinsicW, 2160)])].sort(
      (a, b) => a - b
    );

    const variants = { avif: [], webp: [] };
    for (const w of widths) {
      for (const fmt of ['avif', 'webp']) {
        const name = `${base}.${hash}-${w}.${fmt}`;
        const cached = path.join(CACHE, name);
        if (!existsSync(cached)) {
          let img = pipeline.clone().resize({ width: w, withoutEnlargement: true, kernel: 'lanczos3' });
          if (animated) {
            img = fmt === 'avif' ? img.avif({ quality: 60, effort: 4 }) : img.webp({ quality: 75, effort: 4 });
          } else if (fmt === 'avif') {
            img = img.avif(
              graphic
                ? { quality: 70, effort: 6, chromaSubsampling: '4:4:4' }
                : { quality: 62, effort: 6, chromaSubsampling: '4:2:0' }
            );
          } else {
            img = img.webp(
              graphic
                ? { nearLossless: true, quality: 60, effort: 6 }
                : { quality: 82, effort: 6, smartSubsample: true }
            );
          }
          await img.toFile(cached);
        }
        await fs.copyFile(cached, path.join(OUT, name));
        variants[fmt].push({ w, src: `/images/optimized/${name}` });
      }
    }

    // Legacy canonical filename copy (e.g. espresso-crema.webp) + largest variant URL
    const largestWebp = variants.webp[variants.webp.length - 1];
    const largestAvif = variants.avif[variants.avif.length - 1];
    const canonicalWebpName = `${path.parse(file).name}.webp`;
    if (largestWebp) {
      await fs.copyFile(
        path.join(OUT, path.basename(largestWebp.src)),
        path.join(OUT, canonicalWebpName)
      );
    }

    // 1200x630 PNG OG cover variant for social crawlers (WhatsApp, LinkedIn, Slack, X)
    const ogName = `${base}.${hash}-og.png`;
    const cachedOg = path.join(CACHE, ogName);
    if (!existsSync(cachedOg)) {
      await sharp(buf)
        .rotate()
        .resize(1200, 630, { fit: 'cover', position: 'attention' })
        .png({ palette: true, quality: 90, compressionLevel: 9 })
        .toFile(cachedOg);
    }
    await fs.copyFile(cachedOg, path.join(OUT, ogName));

    // Tiny blurred LQIP placeholder (≈200–400 bytes)
    const lqipCached = path.join(CACHE, `${base}.${hash}-lqip.webp`);
    let lqipBuf;
    if (existsSync(lqipCached)) {
      lqipBuf = await fs.readFile(lqipCached);
    } else {
      lqipBuf = await pipeline.clone().resize(16).webp({ quality: 40 }).toBuffer();
      await fs.writeFile(lqipCached, lqipBuf);
    }

    const entry = {
      type: animated ? 'animated' : 'raster',
      filename,
      sourcePath: path.relative(process.cwd(), file),
      src: largestWebp?.src ?? `/images/optimized/${canonicalWebpName}`,
      optimizedUrl: `/images/optimized/${canonicalWebpName}`,
      fullAvifUrl: largestAvif?.src ?? largestWebp?.src ?? `/images/optimized/${canonicalWebpName}`,
      ogUrl: `/images/optimized/${ogName}`,
      width: intrinsicW,
      height: intrinsicH,
      format: 'webp',
      sizeBytes,
      isOversized: isOversized || intrinsicW > 2000 || intrinsicH > 2000,
      variants,
      placeholder: `data:image/webp;base64,${lqipBuf.toString('base64')}`,
    };

    manifest[baseKey] = entry;
    manifest[relKey] = entry;
  }

  await fs.mkdir(path.dirname(MANIFEST), { recursive: true });
  await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`[images] ${Object.keys(manifest).length / 2} unique image(s) optimized with AVIF + WebP variants.`);
}

main().catch((err) => {
  console.error('[images] Failed to optimize images:', err);
  process.exit(1);
});
