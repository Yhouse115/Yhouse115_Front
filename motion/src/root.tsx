import { Composition } from 'remotion';

import { WhyzipMotion } from './whyzip-motion';

export function MotionRoot() {
  return (
    <Composition
      id="WhyzipMotion"
      component={WhyzipMotion}
      durationInFrames={450}
      fps={60}
      width={1920}
      height={1080}
    />
  );
}
