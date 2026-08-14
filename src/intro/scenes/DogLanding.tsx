import type { CSSProperties } from 'react';
import { INTRO_COORDINATES } from '../constants/coordinates';
import { INTRO_SIZES } from '../constants/sizes';
import { DogSprite } from '../components/DogSprite';
import { getIntroMotion, keyframes } from '../utils/motion';

export function DogLanding({ frame }: { frame: number }) {
  const { landingY } = getIntroMotion(frame);
  const squashX = keyframes(frame, [72, 76, 82, 90, 102, 116], [1, 1.055, .982, 1.016, .996, 1]);
  const squashY = keyframes(frame, [72, 76, 82, 90, 102, 116], [1, .92, 1.035, .985, 1.006, 1]);
  const settleRotate = keyframes(frame, [72, 78, 86, 96, 112], [0, -.7, .38, -.14, 0]);
  return <DogSprite frame={frame} style={{
    '--dog-x': `${INTRO_COORDINATES.dog.x}%`,
    '--dog-y': `${89 + landingY}%`,
    '--dog-width': `${INTRO_SIZES.dogLandVw}vw`,
    scale: `${squashX} ${squashY}`,
    rotate: `${settleRotate}deg`,
  } as CSSProperties} />;
}
