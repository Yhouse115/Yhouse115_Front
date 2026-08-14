export function TransitionWash({ progress }: { progress: number }) {
  return <div className="wz-intro-v3-transition-wash" style={{ opacity: Math.min(1, progress * 1.35), scale: `${progress * 18}` }} />;
}
