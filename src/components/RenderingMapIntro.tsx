import { createTimeline } from 'animejs';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import neighborhoodBase from '../assets/intro-neighborhood-base.png';
import neighborhoodScene from '../assets/intro-neighborhood-scene.png';
import spriteConfused from '../assets/intro-sprite-confused.png';
import spriteFall from '../assets/intro-sprite-fall.png';
import spriteLand from '../assets/intro-sprite-land.png';
import spriteMap from '../assets/intro-sprite-map.png';
import spritePoint from '../assets/intro-sprite-point.png';

type IntroStage = 'PLAYING' | 'MAP_TRANSITION' | 'MAP_READY';

type RenderingMapIntroProps = {
  children: ReactNode;
};

type PoseName = 'fall' | 'land' | 'confused' | 'map' | 'point';
type PoseConfig = {
  start: number;
  end: number;
  anchorX: number;
  anchorY: number;
};

const INTRO_DURATION_MS = 6600;
const TRANSITION_START_MS = 5900;
const DOG_ANIMATION_STOP_MS = 4900;
const MAP_TRANSITION_DURATION_MS = 700;
const SOURCE_FRAME_COUNT = 34;
const POSE_CROSSFADE_MS = 54;

const sprites: Record<PoseName, string> = {
  fall: spriteFall,
  land: spriteLand,
  confused: spriteConfused,
  map: spriteMap,
  point: spritePoint,
};

const poseTimeline: Record<PoseName, PoseConfig> = {
  fall: { start: 0, end: 1100, anchorX: 50, anchorY: 86 },
  land: { start: 1100, end: 2000, anchorX: 50, anchorY: 87 },
  confused: { start: 2000, end: 2800, anchorX: 50, anchorY: 88 },
  map: { start: 2800, end: 4900, anchorX: 52, anchorY: 89 },
  point: { start: 4900, end: TRANSITION_START_MS, anchorX: 50, anchorY: 88 },
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const easeInCubic = (value: number) => value * value * value;
const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3);
const easeInOutCubic = (value: number) => (
  value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2
);
const mix = (from: number, to: number, progress: number) => from + (to - from) * progress;
const segment = (time: number, from: number, to: number, easing: (value: number) => number = easeInOutCubic) => (
  easing(clamp01((time - from) / (to - from)))
);

function getPoseOpacity(time: number, pose: PoseName) {
  const { start, end } = poseTimeline[pose];
  if (time < start - POSE_CROSSFADE_MS || time > end + POSE_CROSSFADE_MS) return 0;
  const fadeIn = segment(time, start - POSE_CROSSFADE_MS, start, easeInOutCubic);
  const fadeOut = 1 - segment(time, end, end + POSE_CROSSFADE_MS, easeInOutCubic);
  return Math.min(fadeIn, fadeOut);
}

function getDogStyle(time: number) {
  const poseTime = Math.min(time, DOG_ANIMATION_STOP_MS);
  const fall = segment(poseTime, 0, 1100, easeInCubic);
  const landing = segment(poseTime, 1100, 2000, easeOutCubic);
  const recover = segment(poseTime, 2000, 2800, easeInOutCubic);
  const openMap = segment(poseTime, 2800, 4000, easeInOutCubic);
  const focus = segment(poseTime, 4000, DOG_ANIMATION_STOP_MS, easeInOutCubic);
  const impact = Math.sin(landing * Math.PI * 2.8) * (1 - landing);
  const idle = poseTime < DOG_ANIMATION_STOP_MS ? Math.sin(poseTime / 180) * 2 : 0;

  const y = poseTime < 1100
    ? mix(-52, 20, fall)
    : mix(20, 12, landing) + impact * -18 + recover * -7 + openMap * 4;
  const x = poseTime < 1100
    ? Math.sin(fall * Math.PI * 2) * 10
    : mix(0, -8, recover) + mix(0, -16, openMap);
  const scale = poseTime < 1100
    ? mix(0.78, 1.02, fall)
    : 1 + Math.sin(landing * Math.PI * 2.5) * 0.035 * (1 - landing);
  const rotate = poseTime < 1100
    ? mix(-7, 3, fall) + Math.sin(fall * Math.PI * 3) * 3
    : impact * -6 + recover * -2 + focus * 1.5;

  return {
    transform: `translate3d(${x}vw, calc(${y}vh + ${idle}px), 0) scale(${scale}) rotate(${rotate}deg)`,
  };
}

export function RenderingMapIntro({ children }: RenderingMapIntroProps) {
  const introLayerRef = useRef<HTMLElement | null>(null);
  const mapLayerRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const transitionStartedRef = useRef(false);
  const [elapsed, setElapsed] = useState(() => (import.meta.env.MODE === 'test' ? INTRO_DURATION_MS : 0));
  const [stage, setStage] = useState<IntroStage>(() => (
    import.meta.env.MODE === 'test' ? 'MAP_READY' : 'PLAYING'
  ));

  const complete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current);
    setElapsed(INTRO_DURATION_MS);
    setStage('MAP_READY');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
    }));
  }, []);

  const beginTransition = useCallback(() => {
    if (transitionStartedRef.current || completedRef.current) return;
    transitionStartedRef.current = true;
    setStage('MAP_TRANSITION');

    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
    }));

    const introLayer = introLayerRef.current;
    const mapLayer = mapLayerRef.current;
    if (!introLayer || !mapLayer) {
      window.setTimeout(complete, MAP_TRANSITION_DURATION_MS);
      return;
    }

    const timeline = createTimeline({
      defaults: { ease: 'out(4)' },
      onComplete: complete,
    });
    timeline
      .add(introLayer, {
        opacity: [1, 0],
        scale: [1.02, 1.04],
        filter: ['blur(0px)', 'blur(2px)'],
        duration: MAP_TRANSITION_DURATION_MS,
      }, 0)
      .add(mapLayer, {
        opacity: [0, 1],
        scale: [0.97, 1],
        translateY: [18, 0],
        filter: ['blur(4px)', 'blur(0px)'],
        clipPath: [
          'inset(7% 6% 10% 6% round 24px)',
          'inset(0% 0% 0% 0% round 0px)',
        ],
        duration: MAP_TRANSITION_DURATION_MS,
      }, 0);
  }, [complete]);

  useEffect(() => {
    if (stage === 'MAP_READY') return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [stage]);

  useEffect(() => {
    if (stage !== 'PLAYING') return undefined;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      window.setTimeout(beginTransition, 240);
      return undefined;
    }

    const tick = (now: number) => {
      if (startTimeRef.current === null) startTimeRef.current = now;
      const nextElapsed = Math.min(INTRO_DURATION_MS, now - startTimeRef.current);
      setElapsed(nextElapsed);

      if (nextElapsed >= TRANSITION_START_MS) {
        beginTransition();
        return;
      }

      animationFrameRef.current = window.requestAnimationFrame(tick);
    };

    animationFrameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current);
    };
  }, [beginTransition, stage]);

  const visualState = useMemo(() => {
    const time = elapsed;
    const fall = segment(time, 0, 1100, easeInCubic);
    const land = segment(time, 1100, 2000, easeOutCubic);
    const mapOpen = segment(time, 2800, 4000, easeInOutCubic);
    const mapSettle = segment(time, 4000, DOG_ANIMATION_STOP_MS, easeInOutCubic);
    const zoom = segment(time, DOG_ANIMATION_STOP_MS, TRANSITION_START_MS, easeInOutCubic);
    const cameraScale = mix(1, 2.6, zoom);
    const cameraX = mix(0, -20, zoom);
    const cameraY = mix(0, -24, zoom);
    const groundPulse = Math.sin(land * Math.PI * 3) * (1 - land);
    const sourceFrame = Math.min(SOURCE_FRAME_COUNT, Math.max(1, Math.round(mix(1, SOURCE_FRAME_COUNT, clamp01(time / TRANSITION_START_MS)))));

    return {
      time,
      dogStyle: getDogStyle(time),
      cameraStyle: {
        transform: `translate3d(${cameraX}vw, ${cameraY}vh, 0) scale(${cameraScale})`,
      },
      backgroundStyle: {
        transform: `translate3d(0, ${mix(2, -3, fall)}vh, 0) scale(${mix(1.05, 1.13, zoom)})`,
      },
      shadowStyle: {
        opacity: mix(0.1, 0.42, land) * (1 - zoom * 0.35),
        transform: `translateX(-50%) scale(${mix(0.45, 1.1, land) + groundPulse * 0.08})`,
        filter: `blur(${mix(14, 7, land)}px)`,
      },
      paperStyle: {
        opacity: mapOpen,
        transform: `translate3d(${mix(18, 0, mapOpen)}vw, ${mix(16, 6, mapOpen) + Math.sin(mapSettle * Math.PI * 2) * 0.6}vh, 0) rotate(${mix(-12, -2, mapOpen)}deg) scale(${mix(0.54, 1.04, mapOpen)})`,
      },
      mapDetailStyle: {
        opacity: clamp01((zoom - 0.18) / 0.68),
      },
      hintFrameStyle: {
        opacity: time < 4900 ? 0.08 : 0,
        backgroundImage: `url('/assets/rendering-intro/webp/frame-${String(sourceFrame).padStart(3, '0')}.webp')`,
      },
    };
  }, [elapsed]);

  return (
    <main className={`rendering-map-intro rendering-map-intro--${stage.toLowerCase()}`}>
      <div className="real-map-reveal-layer" aria-hidden={stage !== 'MAP_READY'} ref={mapLayerRef}>
        {children}
      </div>

      {stage !== 'MAP_READY' && (
        <section className="rendering-intro-layer" aria-label="이집 어때요 지도 인트로" ref={introLayerRef}>
          <div className="rendering-camera" style={visualState.cameraStyle}>
            <div className="rendering-bg-layer" style={visualState.backgroundStyle}>
              <img className="rendering-bg-base" src={neighborhoodBase} alt="" />
              <img className="rendering-bg-scene" src={neighborhoodScene} alt="" />
              <div className="rendering-frame-hint" style={visualState.hintFrameStyle} />
            </div>

            <div className="rendering-dog-shadow" style={visualState.shadowStyle} />

            <div className="rendering-paper-object" style={visualState.paperStyle}>
              <div className="rendering-paper-grid" style={visualState.mapDetailStyle} />
            </div>

            <div className="rendering-dog-rig" style={visualState.dogStyle}>
              {(Object.keys(sprites) as PoseName[]).map((pose) => (
                <img
                  alt=""
                  className={`rendering-dog-pose rendering-dog-pose--${pose}`}
                  key={pose}
                  src={sprites[pose]}
                  style={{
                    '--dog-anchor-x': `${poseTimeline[pose].anchorX}%`,
                    '--dog-anchor-y': `${poseTimeline[pose].anchorY}%`,
                    opacity: getPoseOpacity(visualState.time, pose),
                  } as CSSProperties}
                />
              ))}
            </div>
          </div>

          <button className="intro-skip rendering-intro-skip" onClick={complete} type="button">
            건너뛰기
          </button>
        </section>
      )}
    </main>
  );
}
