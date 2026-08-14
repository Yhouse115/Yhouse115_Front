import fs from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';

const inputDir = './public/assets/rendering-intro/png';
const outputDir = './public/assets/rendering-intro/webp';

function frameNumber(file) {
  const parenthesized = file.match(/\((\d+)\)/);
  if (parenthesized) return Number(parenthesized[1]);

  const normalized = file.match(/frame-(\d+)\.png$/i);
  if (normalized) return Number(normalized[1]);

  return 0;
}

fs.mkdirSync(outputDir, { recursive: true });

const files = fs
  .readdirSync(inputDir)
  .filter((file) => file.toLowerCase().endsWith('.png'))
  .sort((a, b) => frameNumber(a) - frameNumber(b));

for (let index = 0; index < files.length; index += 1) {
  const input = path.join(inputDir, files[index]);
  const output = path.join(outputDir, `frame-${String(index + 1).padStart(3, '0')}.webp`);

  await sharp(input)
    .webp({
      quality: 90,
      effort: 5,
    })
    .toFile(output);

  console.log(`${files[index]} -> ${output}`);
}

console.log(`완료: ${files.length}개 변환`);
