import type { CSSProperties } from 'react';
import spriteConfused from '../../assets/intro-sprite-confused.png';
import spriteFall from '../../assets/intro-sprite-fall.png';
import spriteLand from '../../assets/intro-sprite-land.png';
import spriteMap from '../../assets/intro/intro-sprite-map-contact.png';
import { DOG_POSES, dogPoseOpacity, type DogPose } from '../utils/sprite';

const sprites: Record<DogPose, string> = { fall: spriteFall, land: spriteLand, confused: spriteConfused, map: spriteMap };
const aspectRatios: Record<DogPose, number> = { fall: 354 / 452, land: 354 / 400, confused: 354 / 416, map: 354 / 404 };

export function DogSprite({ frame, style }: { frame: number; style?: CSSProperties }) {
  return <div className="wz-intro-v3-dog" style={style}>
    {(Object.keys(sprites) as DogPose[]).map((pose) => <img
      alt=""
      className={`wz-intro-v3-dog__pose wz-intro-v3-dog__pose--${pose}`}
      key={pose}
      src={sprites[pose]}
      style={{
        width: '100%',
        height: 'auto',
        aspectRatio: aspectRatios[pose],
        opacity: dogPoseOpacity(frame, pose),
      } as CSSProperties}
    />)}
  </div>;
}
