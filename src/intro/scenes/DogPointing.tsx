import type { CSSProperties } from 'react';
import { DogSprite } from '../components/DogSprite';
import { keyframes, mix, segment } from '../utils/motion';

export function DogPointing({ frame }: { frame: number }) {
  const shoulder = segment(frame, 266, 286);
  const elbow = segment(frame, 290, 308);
  const wrist = segment(frame, 304, 320);
  const finger = segment(frame, 316, 330);
  const settle = segment(frame, 334, 354);
  const exit = segment(frame, 378, 402);
  const arc = keyframes(frame, [266, 286, 308, 326, 340, 390], [1.1, .65, .18, -.24, .06, 0]);
  const chain = shoulder * .3 + elbow * .28 + wrist * .22 + finger * .2;

  return <DogSprite frame={frame} style={{
    '--dog-x': `${mix(45, 23.5, segment(frame, 258, 326))}%`,
    '--dog-y': `${89.4 + arc * .18}%`,
    '--dog-width': `${mix(27, 23.8, chain)}vw`,
    opacity: 1 - exit,
    rotate: `${arc - settle * .15}deg`,
    scale: `${1 + chain * .006 - settle * .004}`,
  } as CSSProperties} />;
}
