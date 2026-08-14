export const INTRO_FPS = 60;
export const INTRO_DURATION_FRAMES = 450;
export const INTRO_DURATION_MS = INTRO_DURATION_FRAMES / INTRO_FPS * 1000;

export const INTRO_FRAMES = {
  fall: [0, 72],
  landing: [72, 123],
  discovery: [123, 192],
  activation: [246, 303],
  entry: [246, 303],
  poi: [303, 369],
  logo: [369, 414],
  transition: [414, 450],
  poiSchool: 307,
  poiTraffic: 313,
  poiHospital: 320,
} as const;

export const INTRO_QA_FRAMES = [0, 72, 123, 192, 246, 303, 369, 414, 449] as const;
