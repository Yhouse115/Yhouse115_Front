import type { CSSProperties } from 'react';
import introBackground from '../assets/intro-landing-ground-empty.png';
import { MapLayer } from './components/MapLayer';
import { LandingDust } from './components/LandingDust';
import { INTRO_FRAMES } from './constants/timings';
import { INTRO_Z } from './constants/zIndex';
import { AppTransition } from './scenes/AppTransition';
import { DogFall } from './scenes/DogFall';
import { DogLanding } from './scenes/DogLanding';
import { DogMapDiscovery } from './scenes/DogMapDiscovery';
import { DogPointing } from './scenes/DogPointing';
import { PoiReveal } from './scenes/PoiReveal';
import { WhyZipReveal } from './scenes/WhyZipReveal';
import { getIntroMotion, keyframes, mix, segment } from './utils/motion';

export function IntroComposition({ frame, className = '' }: { frame: number; className?: string }) {
  const motion = getIntroMotion(frame);
  const mapFlight = segment(frame, 118, 163);
  const mapFlightX = keyframes(frame, [118, 132, 148, 163], [50, 49, 51, 50]);
  const mapFlightY = keyframes(frame, [118, 132, 148, 163], [-16, 14, 48, 76]);
  const mapFlightRoll = keyframes(frame, [118, 132, 148, 163], [24, -13, 7, -1.5]);
  const mapArrivalFade = 1 - segment(frame, 150, 158);
  const mapZoom = segment(frame, 252, 303);
  const mapScale = mix(.34, 1.55, mapZoom);
  const mapY = mix(86, 62.5, mapZoom);
  const mapFade = 1 - segment(frame, 414, 448) * .35;
  const introOpacity = 1 - segment(frame, 421, 450);
  return <section className={`wz-intro-v3 ${className}`} style={{ opacity: introOpacity, '--z-map': INTRO_Z.map, '--z-dog': INTRO_Z.dog, '--z-poi': INTRO_Z.poi, '--z-logo': INTRO_Z.logo, '--z-wash': INTRO_Z.wash } as CSSProperties} aria-label="왜집 지도 인트로">
    <img alt="" className="wz-intro-v3-environment" src={introBackground} style={{ scale: `${1 + mapZoom * .025}` }} />
    {((frame >= 118 && frame < 166) || frame >= 262) && <div className="wz-intro-v3-map" style={{
      '--map-x': `${frame < 166 ? mapFlightX : 50}%`,
      '--map-y': `${frame < 166 ? mapFlightY : mapY}%`,
      '--map-scale': frame < 166 ? mix(.12, .3, mapFlight) : mapScale,
      '--map-rotate': `${frame < 166 ? mapFlightRoll : mix(-2.2, 0, mapZoom)}deg`,
      opacity: frame < 166 ? segment(frame, 118, 126) * mapArrivalFade : mapFade,
      zIndex: frame < 166 ? INTRO_Z.dog + 1 : INTRO_Z.map,
    } as CSSProperties}><MapLayer glow={motion.activation} /></div>}
    {frame < INTRO_FRAMES.fall[1] && <DogFall frame={frame} />}
    {frame >= 68 && frame < 104 && <LandingDust frame={frame} />}
    {frame >= INTRO_FRAMES.landing[0] && frame < INTRO_FRAMES.landing[1] && <DogLanding frame={frame} />}
    {frame >= INTRO_FRAMES.discovery[0] && frame < 266 && <DogMapDiscovery frame={frame} />}
    {frame >= 266 && frame < 402 && <DogPointing frame={frame} />}
    {frame >= INTRO_FRAMES.poi[0] && <PoiReveal frame={frame} retreat={motion.transition} />}
    {frame >= INTRO_FRAMES.logo[0] && <WhyZipReveal frame={frame} transition={motion.transition} />}
    {frame >= INTRO_FRAMES.transition[0] && <AppTransition progress={motion.transition} />}
  </section>;
}
