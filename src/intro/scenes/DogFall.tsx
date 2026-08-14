import type { CSSProperties } from 'react';
import { INTRO_COORDINATES } from '../constants/coordinates';
import { INTRO_SIZES } from '../constants/sizes';
import { DogSprite } from '../components/DogSprite';
import { mix, segment } from '../utils/motion';
import { easeInCubic } from '../utils/easing';

export function DogFall({ frame }: { frame: number }) {
  const progress = segment(frame, 0, 72, easeInCubic);
  const y = mix(42, 89, progress);
  const rotate = frame < 24 ? mix(-5, 2, segment(frame, 0, 24)) : frame < 48 ? mix(2, -1, segment(frame, 24, 48)) : mix(-1, 0, segment(frame, 48, 72));
  return <DogSprite frame={frame} style={{ '--dog-x': `${INTRO_COORDINATES.dog.x + Math.sin(frame / 9) * INTRO_COORDINATES.dog.maxDriftVw}%`, '--dog-y': `${y}%`, '--dog-width': `${mix(INTRO_SIZES.dogStartVw, INTRO_SIZES.dogLandVw, progress)}vw`, rotate: `${rotate}deg` } as CSSProperties} />;
}
