import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { HealthCheck } from './components/HealthCheck';
import { NaverMapPreview } from './components/NaverMapPreview';
import { WhyHouseIntro } from './components/WhyHouseIntro';
import { LoginButton } from './features/auth/LoginButton';
import investmentImage from './assets/landing-investment-card.png';
import familyImage from './assets/landing-family-card.png';
import waezipLogo from './assets/waezip-logo.png';

const routes = {
  home: '/',
  investment: '/investment',
  familyMap: '/family-map',
} as const;

function navigateTo(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new Event('popstate'));
}

function LandingPage() {
  return (
    <>
      <header className="landing-bar">
        <button aria-label="왜집 홈" className="landing-logo" type="button">
          <img alt="왜집?" src={waezipLogo} />
        </button>
        <span className="eyebrow">우리 집을 이해하는 새로운 방식</span>
        <div className="landing-bar-end">
          <p>집을 보는 두 가지 시선</p>
          <LoginButton />
        </div>
      </header>
      <main className="landing-shell">
        <section className="landing-choice" aria-label="WhyHouse entry routes">
          <div className="landing-intro">
            <h1 className="hero-title">
              <span className="line">어떤 시선으로</span>
              <span className="line">집을 볼까요?</span>
            </h1>
          </div>

          <div className="choice-grid">
            <button className="choice-card choice-card--investment" onClick={() => navigateTo(routes.investment)} type="button">
              <span className="choice-art">
                <img alt="지도와 집을 살펴보는 강아지 일러스트" className="choice-image" src={investmentImage} />
                <span className="choice-chip">현장을 살펴봐요!</span>
              </span>
              <span className="choice-title-row">
                <span className="choice-icon" aria-hidden="true">▤</span>
                <span>
                  <span className="choice-meta">부동산 투자 기록</span>
                  <strong>왜집의 입장노트</strong>
                </span>
              </span>
              <span className="choice-description">
                실거래와 시세 흐름을 보고, 관심 있는 집에 대한 생각을 기록해요.
              </span>
              <span className="choice-link">투자 관점으로 보기 →</span>
            </button>

            <button className="choice-card choice-card--family" onClick={() => navigateTo(routes.familyMap)} type="button">
              <span className="choice-art">
                <img alt="집 주변 생활권을 안내하는 강아지 일러스트" className="choice-image" src={familyImage} />
                <span className="choice-chip">같이 살펴봐요!</span>
              </span>
              <span className="choice-title-row">
                <span className="choice-icon" aria-hidden="true">⌖</span>
                <span>
                  <span className="choice-meta">아이친화 생활 지도</span>
                  <strong>이집 어때요?</strong>
                </span>
              </span>
              <span className="choice-description">
                학교, 횡단보도, CCTV와 주의구간을 지도에서 한눈에 살펴봐요.
              </span>
              <span className="choice-link">지도로 살펴보기 →</span>
            </button>
          </div>
        </section>
      </main>
    </>
  );
}

function PageFrame({ children, title }: { children: ReactNode; title: string }) {
  return (
    <main className="page-shell">
      <nav className="top-nav" aria-label="Primary navigation">
        <button onClick={() => navigateTo(routes.home)} type="button">
          WhyHouse
        </button>
        <div className="top-nav-end">
          <div>
            <button onClick={() => navigateTo(routes.investment)} type="button">
              입장노트
            </button>
            <button onClick={() => navigateTo(routes.familyMap)} type="button">
              생활지도
            </button>
          </div>
          <LoginButton />
        </div>
      </nav>
      <p className="page-label">{title}</p>
      {children}
      <HealthCheck />
    </main>
  );
}

function InvestmentPage() {
  return (
    <PageFrame title="부동산 투자 기록">
      <section className="placeholder-panel">
        <p className="eyebrow">Route 01</p>
        <h1>왜집의 입장노트</h1>
        <p>
          이후 실거래, 전월세, 관심 단지 기록을 붙일 페이지입니다. 현재는 라우팅과
          백엔드 연결 상태만 확인합니다.
        </p>
      </section>
    </PageFrame>
  );
}

function FamilyMapPage() {
  return (
    <NaverMapPreview
      onBackHome={() => navigateTo(routes.home)}
      onOpenInvestment={() => navigateTo(routes.investment)}
    />
  );
}

export default function App() {
  const [path, setPath] = useState(window.location.pathname);
  const [showIntro, setShowIntro] = useState(() => {
    if (import.meta.env.MODE === 'test' || window.location.pathname !== routes.home) return false;

    try {
      if (new URLSearchParams(window.location.search).get('intro') === '1') return true;
      if (window.sessionStorage.getItem('whyhouse:intro-played') === 'true') return false;
      window.sessionStorage.setItem('whyhouse:intro-played', 'true');
      return true;
    } catch {
      return true;
    }
  });

  const completeIntro = useCallback(() => {
    setShowIntro(false);
  }, []);

  useEffect(() => {
    const handleRouteChange = () => setPath(window.location.pathname);

    window.addEventListener('popstate', handleRouteChange);
    return () => window.removeEventListener('popstate', handleRouteChange);
  }, []);

  if (path === routes.investment) {
    return <InvestmentPage />;
  }

  if (path === routes.familyMap) {
    return <FamilyMapPage />;
  }

  if (path === routes.home && showIntro) {
    return (
      <div className="intro-stack">
        <div className="intro-premounted-page" aria-hidden="true">
          <LandingPage />
        </div>
        <WhyHouseIntro onComplete={completeIntro} />
      </div>
    );
  }

  return (
    <LandingPage />
  );
}
