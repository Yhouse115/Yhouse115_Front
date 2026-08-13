import { createTimeline, stagger } from 'animejs';
import { useCallback, useEffect, useRef, useState } from 'react';

import frame01 from '../assets/intro-frame-01.png';
import neighborhoodBase from '../assets/intro-neighborhood-base.png';
import pointSprite from '../assets/intro-sprite-point.png';
import waezipHomeMarker from '../assets/waezip-home-marker.png';
import { INTRO_TIMING, MOTION } from './intro.constants';

type WhyHouseIntroProps = { onComplete: () => void };

const MARKERS = [
  { id: 'apartment', icon: '🏢', label: '선택 아파트', color: '#5C9FD0' },
  { id: 'school', icon: '🏫', label: '학교', color: '#F9CC19' },
  { id: 'traffic', icon: '🚦', label: '신호등', color: '#A2D6F1' },
  { id: 'market', icon: '🛒', label: '마트', color: '#1ABC9C' },
  { id: 'home', icon: '🏡', label: '주거', color: '#A5D3A8' },
] as const;

export function WhyHouseIntro({ onComplete }: WhyHouseIntroProps) {
  const rootRef = useRef<HTMLElement>(null);
  const timelineRef = useRef<ReturnType<typeof createTimeline> | null>(null);
  const completedRef = useRef(false);
  const mapStartedRef = useRef(false);
  const [videoReady, setVideoReady] = useState(false);

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const select = (selector: string) => root.querySelectorAll(selector);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timeline = createTimeline({ autoplay: false, defaults: { ease: 'out(3)' }, onComplete: finish });

    timeline
      .add(select('.wh-video-layer'), {
        scale: [1, 1.4, 2.2, 3.8],
        translateX: ['0%', '-3%', '-8%', '-18%'],
        translateY: ['0%', '-6%', '-16%', '-31%'],
        opacity: [1, 1, 0],
        duration: MOTION.mapZoom,
        ease: 'inOut(3)',
      }, 0)
      .add(select('.wh-map-scene'), { opacity: [0, .2, 1], scale: [1.08, 1], duration: MOTION.mapZoom }, 0)
      .add(select('.wh-point-character'), { opacity: [0, 1], translateX: ['-18px', '0px'], duration: 420 }, 520)
      .add(select('.wh-map-marker'), {
        opacity: [0, 1],
        scale: [.4, 1.16, 1],
        translateY: ['12px', '0px'],
        duration: MOTION.poi,
        delay: stagger(MOTION.poiStagger),
      }, INTRO_TIMING.POI_REVEAL)
      .add(root, { translateY: ['0dvh', '-100dvh'], duration: MOTION.hostSlide, ease: 'inOut(3)' }, INTRO_TIMING.HOST_TRANSITION);

    timelineRef.current = timeline;
    if (reducedMotion) finish();

    return () => {
      timeline.pause();
      timeline.revert();
      timelineRef.current = null;
    };
  }, [finish]);

  const startMapTransition = useCallback(() => {
    if (mapStartedRef.current || completedRef.current) return;
    mapStartedRef.current = true;
    timelineRef.current?.play();
  }, []);

  const skip = () => {
    timelineRef.current?.pause();
    finish();
  };

  return (
    <section className="whyhouse-intro wh-intro" ref={rootRef} aria-label="WhyHouse intro">
      <button className="intro-skip" onClick={skip} type="button">{'\uac74\ub108\ub6f0\uae30'}</button>

      <div className={`wh-video-layer${videoReady ? ' is-ready' : ''}`}>
        <img className="wh-video-poster" src={frame01} alt="" />
        <video
          autoPlay
          className="wh-dog-video"
          muted
          onCanPlay={() => setVideoReady(true)}
          onEnded={startMapTransition}
          onError={startMapTransition}
          playsInline
          poster={frame01}
          preload="auto"
        >
          <source src="/whyzip/intro/intro-dog.webm" type="video/webm" />
          <source src="/whyzip/intro/intro-dog.mp4" type="video/mp4" />
        </video>
      </div>

      <div className="wh-map-scene" aria-label="Neighborhood map">
        <img className="wh-map-background" src={neighborhoodBase} alt="" />
        <img className="wh-point-character" src={pointSprite} alt="" />
        {MARKERS.map(({ id, icon, label, color }) => (
          <span
            className={`wh-map-marker wh-map-marker--${id}`}
            key={id}
            style={{ '--pin-color': color } as React.CSSProperties}
          >
            <i aria-hidden="true"><span>{icon}</span></i>
            <b>{label}</b>
          </span>
        ))}
      </div>
    </section>
  );
}
