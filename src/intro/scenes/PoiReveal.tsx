import { PoiIcon } from '../components/PoiIcon';

export function PoiReveal({ frame, retreat }: { frame: number; retreat: number }) {
  return <div className="wz-intro-v3-poi-stage"><PoiIcon frame={frame} kind="school" retreat={retreat} /><PoiIcon frame={frame} kind="traffic" retreat={retreat} /><PoiIcon frame={frame} kind="hospital" retreat={retreat} /></div>;
}
