import type { CSSProperties } from 'react';
import { DogSprite } from '../components/DogSprite';
import { INTRO_COORDINATES } from '../constants/coordinates';
import { INTRO_SIZES } from '../constants/sizes';

export function MapActivation({ frame }: { frame: number }) {
  return <DogSprite frame={frame} style={{ '--dog-x': `${INTRO_COORDINATES.dog.x}%`, '--dog-y': '89.2%', '--dog-width': `${INTRO_SIZES.dogDiscoveryVw}vw` } as CSSProperties} />;
}
