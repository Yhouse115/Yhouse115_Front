import path from 'node:path';
import sharp from 'sharp';

const assets = [
  'school_icon_rgba.png',
  'traffic_light_icon_rgba.png',
  'hospital_icon_rgba.png',
  'whyzip_logo_clean.png',
  'map_open_rgba.png',
  'dog_dive_01.png',
  'dog_dive_02.png',
  'dog_dive_03.png',
  'dog_dive_04.png',
];

let failed = false;
for (const file of assets) {
  const location = path.resolve('src/assets/intro', file);
  const image = sharp(location);
  const [metadata, stats] = await Promise.all([image.metadata(), image.stats()]);
  const alpha = stats.channels[3];
  const transparentRatio = alpha ? 1 - alpha.mean / 255 : 0;
  const boundsBuffer = await image.clone().trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const bounds = await sharp(boundsBuffer).metadata();
  const warnings: string[] = [];
  if (metadata.format !== 'png') warnings.push('not PNG');
  if (!metadata.hasAlpha || metadata.isOpaque) warnings.push('missing usable alpha');
  if (!alpha || transparentRatio < 0.08) warnings.push('likely opaque background');
  if ((bounds.width ?? 0) >= (metadata.width ?? 0) * .98 || (bounds.height ?? 0) >= (metadata.height ?? 0) * .98) warnings.push('insufficient transparent padding');
  const result = { file, width: metadata.width, height: metadata.height, hasAlpha: metadata.hasAlpha, isOpaque: metadata.isOpaque, transparentRatio: Number(transparentRatio.toFixed(3)), bounds: `${bounds.width}x${bounds.height}`, warnings };
  console.log(JSON.stringify(result));
  if (warnings.length) failed = true;
}
if (failed) process.exitCode = 1;
