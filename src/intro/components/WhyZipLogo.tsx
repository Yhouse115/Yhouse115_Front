import logo from '../../assets/intro/whyzip_logo_clean.png';
import { easeOutBack } from '../utils/easing';
import { mix, segment } from '../utils/motion';

export function WhyZipLogo({ frame, transition }: { frame: number; transition: number }) {
  const enter = segment(frame, 369, 395, easeOutBack);
  const settle = segment(frame, 395, 414);
  const scale = (frame < 395 ? mix(.55, 1.10, enter) : mix(1.10, 1, settle)) * mix(1, 1.7, transition);
  return <div className="wz-intro-v3-logo" style={{ opacity: enter * (1 - transition), scale: `${scale}` }}>
    <div className="wz-intro-v3-logo__glow" style={{ opacity: enter * mix(.55, .25, settle), scale: `${mix(.6, 1.3, enter)}` }} />
    <div className="wz-intro-v3-logo__ring" />
    <img alt="왜집" src={logo} />
  </div>;
}
