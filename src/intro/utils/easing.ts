export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
export const easeInCubic = (value: number) => value ** 3;
export const easeOutCubic = (value: number) => 1 - (1 - value) ** 3;
export const easeInOutCubic = (value: number) => value < .5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2;
export const easeInOutSine = (value: number) => -(Math.cos(Math.PI * value) - 1) / 2;
export const easeOutBack = (value: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (value - 1) ** 3 + c1 * (value - 1) ** 2;
};
