export type DogPose = 'fall' | 'land' | 'confused' | 'map';

export const DOG_POSES: Record<DogPose, { start: number; end: number; anchorX: number; anchorY: number }> = {
  fall: { start: 0, end: 77, anchorX: 50, anchorY: 92 },
  land: { start: 74, end: 132, anchorX: 50, anchorY: 95 },
  confused: { start: 128, end: 164, anchorX: 50, anchorY: 95 },
  map: { start: 160, end: 282, anchorX: 52, anchorY: 95 },
};

export function dogPoseOpacity(frame: number, pose: DogPose) {
  const config = DOG_POSES[pose];
  const crossfade = 7;
  // The map pose owns the single visible map during pickup. Do not reveal it
  // before the standalone floor map has been removed at frame 160.
  if (pose === 'map' && frame < config.start) return 0;
  if (frame < config.start - crossfade || frame > config.end + crossfade) return 0;
  const fadeIn = Math.min(1, Math.max(0, (frame - (config.start - crossfade)) / crossfade));
  const fadeOut = 1 - Math.min(1, Math.max(0, (frame - config.end) / crossfade));
  return Math.min(fadeIn, fadeOut);
}
