import type { CSSProperties } from 'react';
import { INTRO_COORDINATES } from '../constants/coordinates';
import { INTRO_SIZES } from '../constants/sizes';
import { DogSprite } from '../components/DogSprite';
import { mix, segment } from '../utils/motion';
import { easeInCubic } from '../utils/easing';

export function DogFall({ frame }: { frame: number }) {
  const progress = segment(frame, 0, 72, easeInCubic);
  const y = mix(42, 89, progress);
  const air = 1 - progress;
  const sway = Math.sin(progress * Math.PI * 1.7) * air;
  const rotate = (-4.2 * air) + (Math.sin(progress * Math.PI * 2.25) * 2.1 * air);
  const stretch = Math.sin(progress * Math.PI) * .018;
  return <DogSprite frame={frame} style={{
    '--dog-x': `${INTRO_COORDINATES.dog.x + sway * INTRO_COORDINATES.dog.maxDriftVw}%`,
    '--dog-y': `${y}%`,
    '--dog-width': `${mix(INTRO_SIZES.dogStartVw, INTRO_SIZES.dogLandVw, progress)}vw`,
    rotate: `${rotate}deg`,
    scale: `${1 - stretch * .28} ${1 + stretch}`,
  } as CSSProperties} />;
}
