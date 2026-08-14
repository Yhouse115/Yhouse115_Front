import { INTRO_FRAMES } from '../constants/timings';
import { clamp01, easeInCubic, easeInOutCubic, easeOutCubic } from './easing';

export const mix = (from: number, to: number, progress: number) => from + (to - from) * progress;
export const segment = (frame: number, from: number, to: number, easing = easeInOutCubic) => easing(clamp01((frame - from) / (to - from)));

export function keyframes(frame: number, frames: readonly number[], values: readonly number[]) {
  if (frame <= frames[0]) return values[0];
  for (let index = 1; index < frames.length; index += 1) {
    if (frame <= frames[index]) return mix(values[index - 1], values[index], segment(frame, frames[index - 1], frames[index], easeInOutCubic));
  }
  return values[values.length - 1] ?? 0;
}

export function getIntroMotion(frame: number) {
  const fall = segment(frame, ...INTRO_FRAMES.fall, easeInCubic);
  const discovery = segment(frame, ...INTRO_FRAMES.discovery, easeInOutCubic);
  const activation = segment(frame, ...INTRO_FRAMES.activation, easeInOutCubic);
  const entry = segment(frame, ...INTRO_FRAMES.entry, easeInOutCubic);
  const poi = segment(frame, ...INTRO_FRAMES.poi, easeInOutCubic);
  const logo = segment(frame, ...INTRO_FRAMES.logo, easeOutCubic);
  const transition = segment(frame, ...INTRO_FRAMES.transition, easeInOutCubic);
  const landingY = keyframes(frame, [72, 76, 82, 90, 100, 112, 123], [0, 3.4, -1.8, .9, -.35, .15, 0]);
  return { fall, discovery, activation, entry, poi, logo, transition, landingY };
}
