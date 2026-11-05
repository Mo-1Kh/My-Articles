// scripts/optimize-images.mjs
// Pre-build image pipeline: responsive AVIF + WebP variants, EXIF rotation, ICC profile preservation,
// photo vs graphic classification, alpha/animation-safe LQIP generation, and cache pruning.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const SRC = path.resolve(process.cwd(), 'content');
const OUT = path.resolve(process.cwd(), 'public', 'images', 'optimized');
const CACHE = path.resolve(process.cwd(), '.cache', 'images');
const MANIFEST = path.resolve(process.cwd(), 'src', 'generated', 'images-manifest.json');
const WIDTHS = [480, 768, 1080, 1200, 1440, 2160];
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

/**
 * Minifies SVG safely without collapsing spaces inside <text>, <tspan>, or <pre> elements.
 */
function minifySvg(svgString) {
  const preserved = [];
  const withPlaceholders = svgString
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(text|tspan|pre)\b[\s\S]*?<\/\1>/gi, (match) => {
      preserved.push(match);
      return `__SVG_PRESERVE_${preserved.length - 1}__`;
    });

  return withPlaceholders
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/__SVG_PRESERVE_(\d+)__/g, (_m, idx) => preserved[Number(idx)]);
}

function parseSvgDimensions(svgString) {
  const svgTagMatch = svgString.match(/<svg\b[^>]*>/i);
  const svgTag = svgTagMatch ? svgTagMatch[0] : svgString;
  const vb = svgTag.match(
    /viewBox=["']\s*[\d.+-]+[\s,]+[\d.+-]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*["']/i
  );
  const wMatch = svgTag.match(/\swidth=["']\s*(\d+(?:\.\d+)?)/i);
  const hMatch = svgTag.match(/\sheight=["']\s*(\d+(?:\.\d+)?)/i);
  const width = Math.round(+(vb?.[1] ?? wMatch?.[1] ?? 800));
  const height = Math.round(+(vb?.[2] ?? hMatch?.[1] ?? 600));
  return { width: width || 800, height: height || 600 };
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
      .png({ compressionLevel: 9 })
      .toFile(appleIconPath);
  }

  // PWA / Webmanifest icons (192x192 & 512x512)
  const icon192Path = path.join(publicDir, 'icon-192.png');
  if (!existsSync(icon192Path)) {
    await sharp(svgBuf)
      .resize(192, 192)
      .png({ compressionLevel: 9 })
      .toFile(icon192Path);
  }

  const icon512Path = path.join(publicDir, 'icon-512.png');
  if (!existsSync(icon512Path)) {
    await sharp(svgBuf)
      .resize(512, 512)
      .png({ compressionLevel: 9 })
      .toFile(icon512Path);
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
  const seenBaseKeys = new Map();
  const activeCacheFiles = new Set();
  const activeOutFiles = new Set();
  let uniqueCount = 0;
  const files = await walk(SRC);

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!RASTER.has(ext) && ext !== '.svg') continue;

    uniqueCount++;
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
      activeOutFiles.add(name);
      const outPath = path.join(OUT, name);
      if (!existsSync(outPath)) {
        await fs.writeFile(outPath, data, 'utf8');
      }
      const { width, height } = parseSvgDimensions(data);

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
      manifest[relKey] = entry;
      if (!seenBaseKeys.has(baseKey)) {
        seenBaseKeys.set(baseKey, relKey);
        manifest[baseKey] = entry;
      } else if (seenBaseKeys.get(baseKey) !== relKey) {
        console.warn(
          `[Image Warning] Duplicate image basename "${filename}" in "${relKey}" and "${seenBaseKeys.get(baseKey)}". Use relative path to disambiguate.`
        );
      }
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
        activeCacheFiles.add(name);
        activeOutFiles.add(name);
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
        const outPath = path.join(OUT, name);
        if (!existsSync(outPath)) {
          await fs.copyFile(cached, outPath);
        }
        variants[fmt].push({ w, src: `/images/optimized/${name}` });
      }
    }

    const largestWebp = variants.webp[variants.webp.length - 1];
    const largestAvif = variants.avif[variants.avif.length - 1];

    // Tiny blurred LQIP placeholder from first frame only; skip for transparent images
    // so the placeholder doesn't bleed through transparent regions
    let placeholder;
    if (!meta.hasAlpha) {
      const lqipName = `${base}.${hash}-lqip.webp`;
      activeCacheFiles.add(lqipName);
      const lqipCached = path.join(CACHE, lqipName);
      let lqipBuf;
      if (existsSync(lqipCached)) {
        lqipBuf = await fs.readFile(lqipCached);
      } else {
        lqipBuf = await sharp(buf, { pages: 1 }).rotate().resize(16).webp({ quality: 40 }).toBuffer();
        await fs.writeFile(lqipCached, lqipBuf);
      }
      placeholder = `data:image/webp;base64,${lqipBuf.toString('base64')}`;
    }

    const entry = {
      type: animated ? 'animated' : 'raster',
      filename,
      sourcePath: path.relative(process.cwd(), file),
      src: largestWebp?.src ?? '',
      optimizedUrl: largestWebp?.src ?? '',
      fullAvifUrl: largestAvif?.src ?? largestWebp?.src ?? '',
      width: intrinsicW,
      height: intrinsicH,
      format: 'webp',
      sizeBytes,
      isOversized: isOversized || intrinsicW > 2000 || intrinsicH > 2000,
      variants,
      ...(placeholder ? { placeholder } : {}),
    };

    manifest[relKey] = entry;
    if (!seenBaseKeys.has(baseKey)) {
      seenBaseKeys.set(baseKey, relKey);
      manifest[baseKey] = entry;
    } else if (seenBaseKeys.get(baseKey) !== relKey) {
      console.warn(
        `[Image Warning] Duplicate image basename "${filename}" in "${relKey}" and "${seenBaseKeys.get(baseKey)}". Use relative path to disambiguate.`
      );
    }
  }

  // Prune stale files from OUT without deleting the directory inode (keeps Vite dev watcher intact)
  if (existsSync(OUT)) {
    for (const outFile of await fs.readdir(OUT)) {
      if (!activeOutFiles.has(outFile)) {
        await fs.rm(path.join(OUT, outFile), { force: true });
      }
    }
  }

  // Prune stale files from .cache/images so CI cache doesn't grow indefinitely
  if (existsSync(CACHE)) {
    for (const cachedFile of await fs.readdir(CACHE)) {
      if (!activeCacheFiles.has(cachedFile)) {
        await fs.rm(path.join(CACHE, cachedFile), { force: true });
      }
    }
  }

  await fs.mkdir(path.dirname(MANIFEST), { recursive: true });
  await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`[images] ${uniqueCount} unique image(s) optimized with AVIF + WebP variants.`);
}

main().catch((err) => {
  console.error('[images] Failed to optimize images:', err);
  process.exit(1);
});
