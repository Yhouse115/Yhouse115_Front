import mapOpen from '../../assets/intro/map_open_rgba.png';

export function MapLayer({ glow }: { glow: number }) {
  return <>
    <div className="wz-intro-v3-map__shadow" />
    <div className="wz-intro-v3-map__glow" style={{ opacity: glow, scale: `${.92 + glow * .08}` }} />
    <img alt="" className="wz-intro-v3-map__image" src={mapOpen} />
    <div className="wz-intro-v3-map__pin-pulse" style={{ opacity: glow, scale: `${.7 + glow * .3}` }}><i /><i /></div>
  </>;
}
