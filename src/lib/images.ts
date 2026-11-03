// src/lib/images.ts
// Image discovery, optimization (WebP conversion), dimension resolution, and warnings.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { getPath } from '../../site.config';

export interface OptimizedImageInfo {
  filename: string;
  sourcePath: string;
  optimizedUrl: string;
  width: number;
  height: number;
  format: string;
  sizeBytes: number;
  isOversized: boolean;
}

// Map from lowercase filename to image info
const imageRegistry = new Map<string, OptimizedImageInfo>();
let hasScanned = false;

const SUPPORTED_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.svg'];

/**
 * Scans ./content for all images, optimizes them to WebP in public/images/optimized/,
 * records intrinsic dimensions, and logs warnings for oversized images.
 */
export async function scanAndOptimizeImages(): Promise<Map<string, OptimizedImageInfo>> {
  if (hasScanned && imageRegistry.size > 0) {
    return imageRegistry;
  }

  const contentDir = path.resolve(process.cwd(), 'content');
  const outputDir = path.resolve(process.cwd(), 'public', 'images', 'optimized');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  function findImages(dir: string, fileList: string[] = []): string[] {
    if (!fs.existsSync(dir)) return fileList;
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === '.obsidian') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        findImages(fullPath, fileList);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_EXTS.includes(ext)) {
          fileList.push(fullPath);
        }
      }
    }

    return fileList;
  }

  const imagePaths = findImages(contentDir);

  for (const srcPath of imagePaths) {
    const filename = path.basename(srcPath);
    const ext = path.extname(filename).toLowerCase();
    const stat = fs.statSync(srcPath);
    const sizeBytes = stat.size;
    const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);

    // Section 5 Checklist: Oversized images warned (threshold: 1MB or >2000px)
    let isOversized = false;
    if (sizeBytes > 1024 * 1024) {
      isOversized = true;
      console.warn(`[Image Warning] Oversized image (${sizeMB}MB): "${filename}".`);
    }

    try {
      let width = 800;
      let height = 600;
      let format = ext.replace('.', '');
      let outputFilename = filename;

      if (ext === '.svg') {
        // Copy SVGs directly
        const destPath = path.join(outputDir, filename);
        fs.copyFileSync(srcPath, destPath);
        width = 800;
        height = 600;
      } else {
        // Use sharp to get metadata
        const metadata = await sharp(srcPath).metadata();
        width = metadata.width || 800;
        height = metadata.height || 600;

        if (width > 2000 || height > 2000) {
          isOversized = true;
          console.warn(`[Image Warning] High-resolution image (${width}x${height}): "${filename}".`);
        }

        // Convert raster images (png, jpg, jpeg) to WebP
        if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
          outputFilename = `${path.parse(filename).name}.webp`;
          const destPath = path.join(outputDir, outputFilename);
          await sharp(srcPath)
            .webp({ quality: 82, effort: 4 })
            .toFile(destPath);
          format = 'webp';
        } else {
          // Copy gif/avif as-is
          const destPath = path.join(outputDir, filename);
          fs.copyFileSync(srcPath, destPath);
        }
      }

      const optimizedUrl = getPath(`/images/optimized/${outputFilename}`);

      const info: OptimizedImageInfo = {
        filename,
        sourcePath: srcPath,
        optimizedUrl,
        width,
        height,
        format,
        sizeBytes,
        isOversized,
      };

      // Register by exact filename and lowercase filename
      imageRegistry.set(filename.toLowerCase(), info);
      imageRegistry.set(filename, info);
    } catch (err: any) {
      console.error(`[Image Error] Failed to optimize "${filename}": ${err.message}`);
    }
  }

  hasScanned = true;
  return imageRegistry;
}

/**
 * Resolves an image reference (e.g. "my-image.png" or "attachments/my-image.png").
 * If missing, reports a warning/error and returns null.
 */
export function resolveImage(imageRef: string, articleId: string = ''): OptimizedImageInfo | null {
  try {
    imageRef = decodeURIComponent(imageRef);
  } catch {}
  const cleanName = path.basename(imageRef).trim().toLowerCase();
  const info = imageRegistry.get(cleanName);

  if (!info) {
    console.warn(`[Image Warning] Missing image "${imageRef}" referenced in article "${articleId}".`);
    return null;
  }

  return info;
}

/**
 * Returns all registered images.
 */
export function getAllImages(): OptimizedImageInfo[] {
  return Array.from(imageRegistry.values());
}
