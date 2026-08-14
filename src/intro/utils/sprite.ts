export type DogPose = 'fall' | 'land' | 'confused' | 'map' | 'point';

export const DOG_POSES: Record<DogPose, { start: number; end: number; anchorX: number; anchorY: number }> = {
  fall: { start: 0, end: 73, anchorX: 50, anchorY: 92 },
  land: { start: 76, end: 124, anchorX: 50, anchorY: 95 },
  confused: { start: 127, end: 160, anchorX: 50, anchorY: 95 },
  map: { start: 163, end: 260, anchorX: 52, anchorY: 95 },
  point: { start: 263, end: 402, anchorX: 50, anchorY: 96 },
};

export function dogPoseOpacity(frame: number, pose: DogPose) {
  const config = DOG_POSES[pose];
  const crossfade = 2;
  if (frame < config.start - crossfade || frame > config.end + crossfade) return 0;
  const fadeIn = Math.min(1, Math.max(0, (frame - (config.start - crossfade)) / crossfade));
  const fadeOut = 1 - Math.min(1, Math.max(0, (frame - config.end) / crossfade));
  return Math.min(fadeIn, fadeOut);
}
