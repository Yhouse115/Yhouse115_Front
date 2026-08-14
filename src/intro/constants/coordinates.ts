export const INTRO_COORDINATES = {
  center: { x: 50, y: 50 },
  dog: { x: 50, groundY: 89.2, maxDriftVw: 0.94 },
  map: { x: 50, y: 82 },
  portal: { x: 50, y: 80.5 },
  logo: { x: 50, y: 52 },
  poi: {
    school: { startX: 40, startY: 65, settleX: 36, settleY: 47, finalX: 30, finalY: 30 },
    traffic: { startX: 51, startY: 67, settleX: 64, settleY: 47, finalX: 70, finalY: 30 },
    hospital: { startX: 59, startY: 63, settleX: 50, settleY: 34, finalX: 50, finalY: 21 },
  },
} as const;
