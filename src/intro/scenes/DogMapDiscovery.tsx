import type { CSSProperties } from 'react';
import { DogSprite } from '../components/DogSprite';
import { INTRO_COORDINATES } from '../constants/coordinates';
import { INTRO_SIZES } from '../constants/sizes';
import { keyframes, mix, segment } from '../utils/motion';

export function DogMapDiscovery({ frame }: { frame: number }) {
  const gaze = segment(frame, 126, 142);
  const shoulderLead = segment(frame, 138, 160);
  const contact = segment(frame, 156, 174);
  const lift = segment(frame, 170, 198);
  const open = segment(frame, 194, 222);
  const place = segment(frame, 220, 248);
  const exit = segment(frame, 270, 286);
  const bodyArc = keyframes(frame, [123, 142, 160, 178, 198, 222, 248], [0, -.4, -1.4, -2.1, -1.1, -.35, 0]);
  return <DogSprite frame={frame} style={{
    '--dog-x': `${INTRO_COORDINATES.dog.x + shoulderLead * .45}%`,
    '--dog-y': `${89 + bodyArc + place * .4}%`,
    '--dog-width': `${mix(INTRO_SIZES.dogLandVw, INTRO_SIZES.dogDiscoveryVw, shoulderLead)}vw`,
    opacity: 1 - exit,
    scale: `${1 + open * .007} ${1 + contact * .006 - place * .004}`,
    rotate: `${(-gaze * .2) + (-shoulderLead * .35) + (lift * .28) + (place * .22)}deg`,
  } as CSSProperties} />;
}
