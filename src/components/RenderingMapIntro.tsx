import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { IntroComposition } from '../intro/IntroComposition';
import { INTRO_DURATION_FRAMES, INTRO_FPS, INTRO_FRAMES } from '../intro/constants/timings';
import { segment } from '../intro/utils/motion';

export function RenderingMapIntro({ children }: { children: ReactNode }) {
  const requestedFrameParam = import.meta.env.DEV && typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('introFrame')
    : null;
  const requestedFrame = requestedFrameParam === null ? Number.NaN : Number(requestedFrameParam);
  const debugFrame = Number.isFinite(requestedFrame)
    ? Math.max(0, Math.min(INTRO_DURATION_FRAMES - 1, Math.round(requestedFrame)))
    : null;
  const raf = useRef<number | null>(null);
  const started = useRef<number | null>(null);
  const completed = useRef(false);
  const [frame, setFrame] = useState(import.meta.env.MODE === 'test' ? INTRO_DURATION_FRAMES : debugFrame ?? 0);
  const finish = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    setFrame(INTRO_DURATION_FRAMES);
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }, []);

  useEffect(() => {
    if (import.meta.env.MODE === 'test' || debugFrame !== null) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return void setTimeout(finish, 350);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const tick = (now: number) => {
      if (started.current === null) started.current = now;
      const next = Math.min(INTRO_DURATION_FRAMES, Math.floor((now - started.current) / 1000 * INTRO_FPS));
      setFrame(next);
      if (next >= INTRO_DURATION_FRAMES) return finish();
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      document.body.style.overflow = previousOverflow;
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [debugFrame, finish]);

  const transition = segment(frame, INTRO_FRAMES.transition[0], INTRO_FRAMES.transition[1]);
  const ready = frame >= INTRO_DURATION_FRAMES;
  return <main className={`rendering-map-intro ${ready ? 'rendering-map-intro--ready' : ''}`}>
    <div className="real-map-reveal-layer" aria-hidden={!ready} style={{ '--app-opacity': transition, '--app-scale': 1.025 - transition * .025, '--app-y': `${12 - transition * 12}px` } as CSSProperties}>{children}</div>
    {!ready && <><IntroComposition frame={frame} /><button className="intro-skip rendering-intro-skip" onClick={finish} type="button">건너뛰기</button></>}
  </main>;
}
