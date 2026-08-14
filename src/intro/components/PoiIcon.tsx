import type { CSSProperties } from 'react';
import { INTRO_COORDINATES } from '../constants/coordinates';
import { INTRO_FRAMES } from '../constants/timings';
import { easeOutBack } from '../utils/easing';
import { mix, segment } from '../utils/motion';
import hospital from '../../assets/intro/hospital_icon_rgba.png';
import school from '../../assets/intro/school_icon_rgba.png';
import traffic from '../../assets/intro/traffic_light_icon_rgba.png';

const meta = {
  school: { src: school, frame: INTRO_FRAMES.poiSchool, float: 27, amplitude: 4 },
  traffic: { src: traffic, frame: INTRO_FRAMES.poiTraffic, float: 31, amplitude: 5 },
  hospital: { src: hospital, frame: INTRO_FRAMES.poiHospital, float: 35, amplitude: 3 },
};

export type PoiKind = keyof typeof meta;

export function PoiIcon({ frame, kind, retreat }: { frame: number; kind: PoiKind; retreat: number }) {
  const item = meta[kind];
  const coords = INTRO_COORDINATES.poi[kind];
  const pop = segment(frame, item.frame, item.frame + 18, easeOutBack);
  const settle = segment(frame, item.frame + 18, item.frame + 30);
  const clearCenter = segment(frame, 350, 374);
  const x = mix(mix(coords.startX, coords.settleX, pop), coords.finalX, clearCenter);
  const y = mix(mix(coords.startY, coords.settleY, pop), coords.finalY, clearCenter);
  const popScale = frame < item.frame + 18 ? mix(.35, 1.17, pop) : mix(1.17, 1, settle);
  const floatY = frame > item.frame + 28 ? Math.sin(frame / item.float) * item.amplitude : 0;
  const rotation = kind === 'traffic' ? Math.sin(frame / 29) : kind === 'school' ? Math.sin(frame / 33) * .5 : 0;
  const style = {
    '--poi-x': `${x}%`, '--poi-y': `${y}%`, '--poi-float': `${floatY - retreat * 15}px`, '--poi-rotate': `${rotation}deg`,
    opacity: pop * (1 - retreat * .7), scale: `${popScale * mix(1, .88, retreat)}`,
  } as CSSProperties;
  return <div className={`wz-intro-v3-poi wz-intro-v3-poi--${kind}`} style={style}><span /><img alt={kind === 'school' ? '학교' : kind === 'traffic' ? '신호등' : '병원'} src={item.src} /></div>;
}
