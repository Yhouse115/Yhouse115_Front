import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const reportRoot = 'C:/Users/concr/OneDrive/바탕 화면/투자 데시보드 시그널/동적움직임 최종 레포';
const iconSheet = path.join(reportRoot, '동적구현 세부 레포 (1).png');
const mapSheet = path.join(reportRoot, '동적구현 세부 레포 (2).png');
const dogSheet = path.join(reportRoot, '동적구현 세부 레포 (5).png');
const sourceDir = path.resolve('src/assets/intro');
const publicDir = path.resolve('public/whyzip/intro/assets');

await fs.mkdir(sourceDir, { recursive: true });
await fs.mkdir(publicDir, { recursive: true });

const crops = {
  school_icon_rgba: { source: iconSheet, left: 38, top: 35, width: 275, height: 225, size: 512, occupancy: 0.78 },
  traffic_light_icon_rgba: { source: iconSheet, left: 350, top: 38, width: 190, height: 224, size: 512, occupancy: 0.73 },
  hospital_icon_rgba: { source: iconSheet, left: 586, top: 44, width: 280, height: 218, size: 512, occupancy: 0.78 },
  whyzip_logo_clean: { source: iconSheet, left: 915, top: 35, width: 205, height: 225, widthOut: 1024, heightOut: 512, occupancy: 0.72 },
  dog_dive_01: { source: dogSheet, left: 275, top: 625, width: 235, height: 235, size: 512, occupancy: 0.86 },
  dog_dive_02: { source: dogSheet, left: 505, top: 625, width: 235, height: 235, size: 512, occupancy: 0.86 },
  dog_dive_03: { source: dogSheet, left: 730, top: 625, width: 235, height: 235, size: 512, occupancy: 0.86 },
  dog_dive_04: { source: dogSheet, left: 958, top: 645, width: 215, height: 215, size: 512, occupancy: 0.78 },
};

function removeConnectedBackground(raw, width, height, channels) {
  const alpha = new Uint8Array(width * height).fill(255);
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  const corners = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]];
  const bg = corners.reduce((sum, [x, y]) => {
    const i = (y * width + x) * channels;
    sum[0] += raw[i]; sum[1] += raw[i + 1]; sum[2] += raw[i + 2];
    return sum;
  }, [0, 0, 0]).map((value) => value / corners.length);

  const score = (pixel) => {
    const i = pixel * channels;
    const dr = raw[i] - bg[0];
    const dg = raw[i + 1] - bg[1];
    const db = raw[i + 2] - bg[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };
  const enqueue = (pixel) => {
    if (pixel < 0 || pixel >= width * height || visited[pixel] || score(pixel) > 18) return;
    visited[pixel] = 1;
    queue[tail++] = pixel;
  };
  for (let x = 0; x < width; x += 1) { enqueue(x); enqueue((height - 1) * width + x); }
  for (let y = 0; y < height; y += 1) { enqueue(y * width); enqueue(y * width + width - 1); }
  while (head < tail) {
    const pixel = queue[head++];
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    alpha[pixel] = 0;
    if (x > 0) enqueue(pixel - 1);
    if (x + 1 < width) enqueue(pixel + 1);
    if (y > 0) enqueue(pixel - width);
    if (y + 1 < height) enqueue(pixel + width);
  }
  for (let p = 0; p < alpha.length; p += 1) {
    if (!visited[p]) {
      const distance = score(p);
      alpha[p] = distance < 34 ? Math.round(((distance - 18) / 16) * 255) : 255;
    }
  }
  return alpha;
}

async function normalizeExtract(name, config) {
  const { data, info } = await sharp(config.source)
    .extract({ left: config.left, top: config.top, width: config.width, height: config.height })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alpha = removeConnectedBackground(data, info.width, info.height, info.channels);
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let p = 0; p < info.width * info.height; p += 1) {
    rgba[p * 4] = data[p * info.channels];
    rgba[p * 4 + 1] = data[p * info.channels + 1];
    rgba[p * 4 + 2] = data[p * info.channels + 2];
    rgba[p * 4 + 3] = alpha[p] < 10 ? 0 : alpha[p];
  }
  const trimmedBuffer = await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const meta = await sharp(trimmedBuffer).metadata();
  const canvasWidth = config.widthOut ?? config.size;
  const canvasHeight = config.heightOut ?? config.size;
  const maxWidth = Math.round(canvasWidth * config.occupancy);
  const maxHeight = Math.round(canvasHeight * config.occupancy);
  const scale = Math.min(maxWidth / (meta.width ?? 1), maxHeight / (meta.height ?? 1));
  const targetWidth = Math.max(1, Math.round((meta.width ?? 1) * scale));
  const targetHeight = Math.max(1, Math.round((meta.height ?? 1) * scale));
  const bottomPad = Math.round(canvasHeight * 0.08);
  const left = Math.floor((canvasWidth - targetWidth) / 2);
  const top = Math.max(0, canvasHeight - bottomPad - targetHeight);
  const output = await sharp(trimmedBuffer)
    .resize(targetWidth, targetHeight, { fit: 'fill' })
    .extend({ top, bottom: canvasHeight - top - targetHeight, left, right: canvasWidth - left - targetWidth, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  await Promise.all([
    fs.writeFile(path.join(sourceDir, `${name}.png`), output),
    fs.writeFile(path.join(publicDir, `${name}.png`), output),
  ]);
}

for (const [name, config] of Object.entries(crops)) await normalizeExtract(name, config);

const mapRawResult = await sharp(mapSheet)
  .extract({ left: 38, top: 486, width: 720, height: 342 })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const mapData = mapRawResult.data;
const mapInfo = mapRawResult.info;
const mapVisited = new Uint8Array(mapInfo.width * mapInfo.height);
let largestComponent = [];
for (let seed = 0; seed < mapVisited.length; seed += 1) {
  if (mapVisited[seed] || mapData[seed * 4 + 3] < 12) continue;
  const component = [];
  const queue = [seed];
  mapVisited[seed] = 1;
  while (queue.length) {
    const pixel = queue.pop();
    component.push(pixel);
    const x = pixel % mapInfo.width;
    const y = Math.floor(pixel / mapInfo.width);
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= mapInfo.width || ny < 0 || ny >= mapInfo.height) continue;
      const next = ny * mapInfo.width + nx;
      if (!mapVisited[next] && mapData[next * 4 + 3] >= 12) { mapVisited[next] = 1; queue.push(next); }
    }
  }
  if (component.length > largestComponent.length) largestComponent = component;
}
const keepMapPixel = new Uint8Array(mapInfo.width * mapInfo.height);
for (const pixel of largestComponent) keepMapPixel[pixel] = 1;
for (let pixel = 0; pixel < keepMapPixel.length; pixel += 1) if (!keepMapPixel[pixel]) mapData[pixel * 4 + 3] = 0;
const mapBuffer = await sharp(mapData, { raw: { width: mapInfo.width, height: mapInfo.height, channels: 4 } })
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .resize({ width: 880, height: 410, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .extend({ top: 51, bottom: 51, left: 72, right: 72, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toBuffer();
await Promise.all([
  fs.writeFile(path.join(sourceDir, 'map_open_rgba.png'), mapBuffer),
  fs.writeFile(path.join(publicDir, 'map_open_rgba.png'), mapBuffer),
]);

const dogMapSource = path.resolve('src/assets/intro-sprite-map.png');
const dogMapRawResult = await sharp(dogMapSource).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const dogMapData = dogMapRawResult.data;
const dogMapInfo = dogMapRawResult.info;
const dogMapContactData = Buffer.from(dogMapData);
for (let y = 0; y < dogMapInfo.height; y += 1) for (let x = 0; x < dogMapInfo.width; x += 1) {
  const offset = (y * dogMapInfo.width + x) * 4;
  // The source pose still contains a detached sliver from the previous atlas
  // cell and the paper map. Both must be removed because the map is animated
  // as a child of the pickup rig below the paw.
  if (x < dogMapInfo.width * .055) {
    dogMapData[offset + 3] = 0;
    dogMapContactData[offset + 3] = 0;
    continue;
  }
  if (x > dogMapInfo.width * .41 && y > dogMapInfo.height * .735) dogMapData[offset + 3] = 0;
  // Despill the old green key around the white fur without softening the fur.
  const alpha = dogMapData[offset + 3];
  const red = dogMapData[offset];
  const green = dogMapData[offset + 1];
  const blue = dogMapData[offset + 2];
  if (alpha < 245 && green > red * 1.12 && green > blue * 1.08) {
    dogMapData[offset + 3] = Math.round(alpha * .18);
    dogMapData[offset + 1] = Math.round((red + blue) / 2);
    dogMapContactData[offset + 3] = Math.round(alpha * .18);
    dogMapContactData[offset + 1] = Math.round((red + blue) / 2);
  }
}
const contactVisited = new Uint8Array(dogMapInfo.width * dogMapInfo.height);
let contactMain = [];
for (let seed = 0; seed < contactVisited.length; seed += 1) {
  if (contactVisited[seed] || dogMapContactData[seed * 4 + 3] < 12) continue;
  const component = [];
  const queue = [seed];
  contactVisited[seed] = 1;
  while (queue.length) {
    const pixel = queue.pop();
    component.push(pixel);
    const x = pixel % dogMapInfo.width;
    const y = Math.floor(pixel / dogMapInfo.width);
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= dogMapInfo.width || ny < 0 || ny >= dogMapInfo.height) continue;
      const next = ny * dogMapInfo.width + nx;
      if (!contactVisited[next] && dogMapContactData[next * 4 + 3] >= 12) {
        contactVisited[next] = 1;
        queue.push(next);
      }
    }
  }
  if (component.length > contactMain.length) contactMain = component;
}
const contactKeep = new Uint8Array(contactVisited.length);
for (const pixel of contactMain) contactKeep[pixel] = 1;
for (let pixel = 0; pixel < contactKeep.length; pixel += 1) {
  if (!contactKeep[pixel]) dogMapContactData[pixel * 4 + 3] = 0;
}
const cleanDogMap = await sharp(dogMapData, { raw: { width: dogMapInfo.width, height: dogMapInfo.height, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
const contactDogMap = await sharp(dogMapContactData, { raw: { width: dogMapInfo.width, height: dogMapInfo.height, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
await Promise.all([
  fs.writeFile(path.join(sourceDir, 'intro-sprite-map-clean.png'), cleanDogMap),
  fs.writeFile(path.join(publicDir, 'intro-sprite-map-clean.png'), cleanDogMap),
  fs.writeFile(path.join(sourceDir, 'intro-sprite-map-contact.png'), contactDogMap),
  fs.writeFile(path.join(publicDir, 'intro-sprite-map-contact.png'), contactDogMap),
]);

for (const file of ['intro-sprite-fall.png', 'intro-sprite-land.png', 'intro-sprite-confused.png']) {
  const source = path.resolve('src/assets', file);
  await fs.copyFile(source, path.join(publicDir, file));
}
await fs.copyFile(path.resolve('src/assets/intro-landing-ground-empty.png'), path.join(publicDir, 'intro-background.png'));

console.log(`Prepared ${Object.keys(crops).length + 1} normalized intro assets.`);
