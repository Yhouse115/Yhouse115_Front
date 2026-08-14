import type { CSSProperties } from 'react';
import spriteConfused from '../../assets/intro-sprite-confused.png';
import spriteFall from '../../assets/intro-sprite-fall.png';
import spriteLand from '../../assets/intro-sprite-land.png';
import spritePoint from '../../assets/intro-sprite-point.png';
import spriteMap from '../../assets/intro/intro-sprite-map-contact.png';
import { keyframes, segment } from '../utils/motion';
import { DOG_POSES, dogPoseOpacity, type DogPose } from '../utils/sprite';

const sprites: Record<DogPose, string> = { fall: spriteFall, land: spriteLand, confused: spriteConfused, map: spriteMap, point: spritePoint };
const aspectRatios: Record<DogPose, number> = { fall: 354 / 452, land: 354 / 400, confused: 354 / 416, map: 354 / 404, point: 358 / 454 };

export function DogSprite({ frame, style }: { frame: number; style?: CSSProperties }) {
  const mapLift = segment(frame, 162, 194);
  const mapOpen = segment(frame, 190, 222);
  const mapPlace = segment(frame, 220, 250);
  const pointReach = segment(frame, 286, 326);
  const pointSettle = segment(frame, 326, 350);
  const pointOvershoot = keyframes(frame, [276, 292, 312, 326, 342, 390], [0, -1.2, 1.6, -.55, .15, 0]);
  const breath = Math.sin(frame / 11) * .0025;
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
        transform: pose === 'map'
          ? `translateY(${(-mapLift * .85) + (mapPlace * .9)}%) rotate(${(-mapLift * .45) + (mapOpen * .35) - (mapPlace * .18)}deg) scale(${1 + mapOpen * .009 - mapPlace * .005 + breath})`
          : pose === 'point'
            ? `translateY(${(1 - pointReach) * .7}%) rotate(${pointOvershoot * .45}deg) scale(${1 + pointReach * .006 - pointSettle * .004 + breath})`
            : `scale(${1 + breath})`,
      } as CSSProperties}
    />)}
  </div>;
}
