import type { CSSProperties } from 'react';
import { DogSprite } from '../components/DogSprite';
import { INTRO_COORDINATES } from '../constants/coordinates';
import { INTRO_SIZES } from '../constants/sizes';
import { mix, segment } from '../utils/motion';

export function DogMapDiscovery({ frame }: { frame: number }) {
  const lean = segment(frame, 139, 182);
  const contact = segment(frame, 160, 184);
  const exit = segment(frame, 222, 252);
  return <DogSprite frame={frame} style={{
    '--dog-x': `${INTRO_COORDINATES.dog.x}%`,
    '--dog-y': `${mix(89, 89.2, lean)}%`,
    '--dog-width': `${mix(INTRO_SIZES.dogLandVw, INTRO_SIZES.dogDiscoveryVw, lean)}vw`,
    opacity: 1 - exit,
    scale: `1 ${mix(1, 1.018, contact)}`,
    rotate: `${mix(0, -.55, lean)}deg`,
  } as CSSProperties} />;
}
