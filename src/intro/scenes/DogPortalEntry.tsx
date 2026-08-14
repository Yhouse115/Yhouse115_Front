import type { CSSProperties } from 'react';
import { DogSprite } from '../components/DogSprite';
import { INTRO_COORDINATES } from '../constants/coordinates';
import { INTRO_SIZES } from '../constants/sizes';
import { mix, segment } from '../utils/motion';

export function DogPortalEntry({ frame }: { frame: number }) {
  const entry = segment(frame, 246, 303);
  const scale = frame < 263 ? mix(1, .95, segment(frame, 246, 263)) : frame < 282 ? mix(.95, .82, segment(frame, 263, 282)) : mix(.82, .68, segment(frame, 282, 303));
  const opacity = 1 - segment(frame, 291, 303);
  return <div className="intro-dog-mask">
    <DogSprite frame={frame} style={{ '--dog-x': `${INTRO_COORDINATES.dog.x}%`, '--dog-y': `${mix(89.2, 102, entry)}%`, '--dog-width': `${INTRO_SIZES.dogDiscoveryVw}vw`, opacity, scale: `${scale}` } as CSSProperties} />
  </div>;
}
