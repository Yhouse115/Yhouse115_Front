import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';

const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };
const pose = (frame: number) => frame < 75 ? 'intro-sprite-fall.png' : frame < 128 ? 'intro-sprite-land.png' : frame < 158 ? 'intro-sprite-confused.png' : 'intro-sprite-map-clean.png';
const poi = [
  { file: 'school_icon_rgba.png', at: 307, x: 31, y: 39 },
  { file: 'traffic_light_icon_rgba.png', at: 313, x: 69, y: 39 },
  { file: 'hospital_icon_rgba.png', at: 320, x: 50, y: 30 },
];

export function WhyzipMotion() {
  const frame = useCurrentFrame();
  const fall = interpolate(frame, [0, 72], [0, 1], clamp);
  const glow = interpolate(frame, [192, 246], [0, 1], clamp);
  const entry = interpolate(frame, [246, 303], [0, 1], clamp);
  const logo = interpolate(frame, [369, 395], [0, 1], clamp);
  const transition = interpolate(frame, [414, 450], [0, 1], clamp);
  const dogTop = frame < 72 ? interpolate(fall ** 3, [0, 1], [18, 84.4], clamp) : interpolate(frame, [72, 82, 90, 123, 246, 303], [84.4, 89.6, 87.2, 88, 89.2, 102], clamp);
  const dogWidth = frame < 72 ? interpolate(fall, [0, 1], [26, 32], clamp) : interpolate(entry, [0, 1], [30, 20.4], clamp);
  const dogOpacity = interpolate(frame, [291, 303], [1, 0], clamp);
  const retreat = transition;

  return <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#e3f6ff', fontFamily: 'sans-serif' }}>
    <Img src={staticFile('whyzip/intro/assets/intro-background.png')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(.88) brightness(1.035)' }} />
    <div style={{ position: 'absolute', left: '50%', top: '82%', width: '30vw', aspectRatio: 2, translate: '-50% -50%', opacity: interpolate(frame, [117, 146], [0, 1], clamp) }}>
      <div style={{ position: 'absolute', inset: '-8%', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(255,238,132,.9), rgba(103,236,240,.45) 45%, transparent 73%)', filter: 'blur(10px)', opacity: glow }} />
      <Img src={staticFile('whyzip/intro/assets/map_open_rgba.png')} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </div>
    <div style={{ position: 'absolute', left: '50%', top: '80.5%', width: '34vw', aspectRatio: 3.35, translate: '-50% -50%', border: '5px solid rgba(206,253,255,.96)', borderRadius: '50%', boxShadow: '0 0 16px #fff,0 0 34px #63e8f6,inset 0 0 28px #83e4f7', opacity: glow * (1 - interpolate(frame, [300, 322], [0, 1], clamp)) }} />
    {frame <= 303 && <div style={{ position: 'absolute', inset: 0, clipPath: 'inset(0 0 19.5% 0)' }}><Img src={staticFile(`whyzip/intro/assets/${pose(frame)}`)} style={{ position: 'absolute', left: '50%', top: `${dogTop}%`, width: `${dogWidth}vw`, height: 'auto', translate: '-50% -100%', opacity: dogOpacity, scale: interpolate(entry, [0, 1], [1, .68], clamp), transformOrigin: '50% 100%', filter: 'drop-shadow(0 13px 15px rgba(50,67,60,.16))' }} /></div>}
    {poi.map((item) => {
      const pop = interpolate(frame, [item.at, item.at + 12, item.at + 18, item.at + 28], [.35, 1.17, .94, 1], clamp);
      const opacity = interpolate(frame, [item.at, item.at + 8], [0, 1], clamp) * (1 - retreat * .7);
      const clear = interpolate(frame, [350, 374], [0, 1], clamp);
      const finalX = item.file.startsWith('school') ? 29 : item.file.startsWith('traffic') ? 71 : 50;
      const finalY = item.file.startsWith('hospital') ? 23 : 31;
      return <Img key={item.file} src={staticFile(`whyzip/intro/assets/${item.file}`)} style={{ position: 'absolute', left: `${interpolate(clear, [0, 1], [item.x, finalX])}%`, top: `${interpolate(clear, [0, 1], [item.y, finalY])}%`, width: '13vw', translate: `-50% calc(-50% + ${Math.sin(frame / (item.at % 29 + 24)) * 4 - retreat * 15}px)`, opacity, scale: pop * interpolate(retreat, [0, 1], [1, .88], clamp), filter: 'drop-shadow(0 11px 9px rgba(56,87,87,.16))' }} />;
    })}
    {frame >= 369 && <div style={{ position: 'absolute', left: '50%', top: '52%', width: '38vw', aspectRatio: 2, translate: '-50% -50%', opacity: logo * (1 - transition), scale: interpolate(logo, [0, 1], [.55, 1]) * interpolate(transition, [0, 1], [1, 1.7]) }}><div style={{ position: 'absolute', inset: '-65%', borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,239,134,.9),rgba(255,246,196,.45) 37%,transparent 68%)' }} /><Img src={staticFile('whyzip/intro/assets/whyzip_logo_clean.png')} style={{ position: 'relative', width: '100%', height: '100%', objectFit: 'contain' }} /></div>}
    <div style={{ position: 'absolute', left: '50%', top: '52%', width: '10vmax', aspectRatio: 1, borderRadius: '50%', background: '#fffdf8', translate: '-50% -50%', scale: transition * 18, opacity: transition }} />
  </AbsoluteFill>;
}
