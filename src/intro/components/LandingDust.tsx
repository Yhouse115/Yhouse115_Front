import type { CSSProperties } from 'react';
import { keyframes, segment } from '../utils/motion';

const dustPuffs = [
  { x: -1.05, y: -.1, size: .72, delay: 0 },
  { x: -.78, y: -.42, size: 1.05, delay: 1 },
  { x: -.48, y: -.68, size: .82, delay: 3 },
  { x: -.22, y: -.35, size: .62, delay: 5 },
  { x: .2, y: -.42, size: .7, delay: 4 },
  { x: .5, y: -.72, size: .9, delay: 2 },
  { x: .82, y: -.38, size: 1.08, delay: 1 },
  { x: 1.08, y: -.08, size: .68, delay: 4 },
] as const;

export function LandingDust({ frame }: { frame: number }) {
  const ring = segment(frame, 71, 91);
  const ringOpacity = keyframes(frame, [69, 72, 78, 91], [0, .55, .32, 0]);

  return <div className="wz-intro-v3-dust" aria-hidden="true">
    <i className="wz-intro-v3-dust__ring" style={{ opacity: ringOpacity, transform: `translate(-50%, -50%) scale(${.35 + ring * 1.65})` }} />
    {dustPuffs.map((puff, index) => {
      const progress = segment(frame, 70 + puff.delay, 87 + puff.delay);
      const opacity = keyframes(frame, [69 + puff.delay, 73 + puff.delay, 82 + puff.delay, 98 + puff.delay], [0, .72, .42, 0]);
      return <span key={index} style={{
        '--dust-size': puff.size,
        left: `${50 + puff.x * progress * 43}%`,
        top: `${50 + puff.y * progress * 48}%`,
        opacity,
        transform: `translate(-50%, -50%) scale(${puff.size * (.55 + progress * 1.15)})`,
      } as CSSProperties} />;
    })}
  </div>;
}
