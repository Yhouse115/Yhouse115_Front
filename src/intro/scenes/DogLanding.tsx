import type { CSSProperties } from 'react';
import { INTRO_COORDINATES } from '../constants/coordinates';
import { INTRO_SIZES } from '../constants/sizes';
import { DogSprite } from '../components/DogSprite';
import { getIntroMotion } from '../utils/motion';

export function DogLanding({ frame }: { frame: number }) {
  const { landingY } = getIntroMotion(frame);
  return <DogSprite frame={frame} style={{ '--dog-x': `${INTRO_COORDINATES.dog.x}%`, '--dog-y': `${89 + landingY}%`, '--dog-width': `${INTRO_SIZES.dogLandVw}vw` } as CSSProperties} />;
}
