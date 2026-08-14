import type { CSSProperties } from 'react';
import introBackground from '../assets/intro-landing-ground-empty.png';
import { MapLayer } from './components/MapLayer';
import { INTRO_FRAMES } from './constants/timings';
import { INTRO_Z } from './constants/zIndex';
import { AppTransition } from './scenes/AppTransition';
import { DogFall } from './scenes/DogFall';
import { DogLanding } from './scenes/DogLanding';
import { DogMapDiscovery } from './scenes/DogMapDiscovery';
import { PoiReveal } from './scenes/PoiReveal';
import { WhyZipReveal } from './scenes/WhyZipReveal';
import { getIntroMotion, mix, segment } from './utils/motion';

export function IntroComposition({ frame, className = '' }: { frame: number; className?: string }) {
  const motion = getIntroMotion(frame);
  const mapReveal = segment(frame, 132, 158);
  const mapZoom = segment(frame, 252, 303);
  const mapScale = mix(.34, 1.55, mapZoom);
  const mapY = mix(86, 62.5, mapZoom);
  const mapFade = 1 - segment(frame, 414, 448) * .35;
  const introOpacity = 1 - segment(frame, 421, 450);
  return <section className={`wz-intro-v3 ${className}`} style={{ opacity: introOpacity, '--z-map': INTRO_Z.map, '--z-dog': INTRO_Z.dog, '--z-poi': INTRO_Z.poi, '--z-logo': INTRO_Z.logo, '--z-wash': INTRO_Z.wash } as CSSProperties} aria-label="왜집 지도 인트로">
    <img alt="" className="wz-intro-v3-environment" src={introBackground} style={{ scale: `${1 + mapZoom * .025}` }} />
    {(frame < 160 || frame >= 252) && <div className="wz-intro-v3-map" style={{ '--map-y': `${mapY}%`, '--map-scale': mapScale, '--map-rotate': `${mix(-2.2, 0, mapZoom)}deg`, opacity: mapReveal * mapFade } as CSSProperties}><MapLayer glow={motion.activation} /></div>}
    {frame < INTRO_FRAMES.fall[1] && <DogFall frame={frame} />}
    {frame >= INTRO_FRAMES.landing[0] && frame < INTRO_FRAMES.landing[1] && <DogLanding frame={frame} />}
    {frame >= INTRO_FRAMES.discovery[0] && frame < 252 && <DogMapDiscovery frame={frame} />}
    {frame >= INTRO_FRAMES.poi[0] && <PoiReveal frame={frame} retreat={motion.transition} />}
    {frame >= INTRO_FRAMES.logo[0] && <WhyZipReveal frame={frame} transition={motion.transition} />}
    {frame >= INTRO_FRAMES.transition[0] && <AppTransition progress={motion.transition} />}
  </section>;
}
