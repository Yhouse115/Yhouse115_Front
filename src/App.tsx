import { HealthCheck } from './components/HealthCheck';
import { env } from './config/env';

export default function App() {
  return (
    <main className="app-shell">
      <section className="intro">
        <p className="eyebrow">{env.appName}</p>
        <h1>아이 관점의 아파트 생활 인프라</h1>
        <p>
          WhyHouse Front는 백엔드 MSA API와 연동해 아파트 주변 인프라와 보행 안전
          인사이트를 제공하는 화면을 담당합니다.
        </p>
      </section>
      <HealthCheck />
    </main>
  );
}
