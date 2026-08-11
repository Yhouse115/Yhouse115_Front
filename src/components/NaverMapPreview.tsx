import { useEffect, useRef, useState } from 'react';

import { env } from '../config/env';

type MapStatus = 'loading' | 'ready' | 'missing-key' | 'error';

declare global {
  interface Window {
    naver?: {
      maps: {
        LatLng: new (lat: number, lng: number) => unknown;
        Map: new (
          element: HTMLElement,
          options: {
            center: unknown;
            zoom: number;
          },
        ) => unknown;
        Marker: new (options: { position: unknown; map: unknown; title?: string }) => unknown;
      };
    };
    __whyhouseNaverMapLoading?: Promise<void>;
    __whyhouseNaverMapReady?: () => void;
  }
}

function loadNaverMaps(clientId: string): Promise<void> {
  if (window.naver?.maps) {
    return Promise.resolve();
  }

  if (window.__whyhouseNaverMapLoading) {
    return window.__whyhouseNaverMapLoading;
  }

  window.__whyhouseNaverMapLoading = new Promise((resolve, reject) => {
    window.__whyhouseNaverMapReady = () => {
      delete window.__whyhouseNaverMapReady;
      resolve();
    };

    const script = document.createElement('script');
    const params = new URLSearchParams({
      ncpKeyId: clientId,
      callback: '__whyhouseNaverMapReady',
    });
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?${params.toString()}`;
    script.async = true;
    script.onerror = () => {
      delete window.__whyhouseNaverMapReady;
      reject(new Error('Naver Maps SDK failed to load.'));
    };
    document.head.appendChild(script);
  });

  return window.__whyhouseNaverMapLoading;
}

export function NaverMapPreview() {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<MapStatus>(() =>
    env.naverMapsClientId ? 'loading' : 'missing-key',
  );

  useEffect(() => {
    if (!env.naverMapsClientId) {
      return;
    }

    let cancelled = false;

    loadNaverMaps(env.naverMapsClientId)
      .then(() => {
        if (cancelled || !mapElementRef.current || !window.naver?.maps) {
          return;
        }

        const center = new window.naver.maps.LatLng(37.5207, 126.8563);
        const map = new window.naver.maps.Map(mapElementRef.current, {
          center,
          zoom: 15,
        });

        new window.naver.maps.Marker({
          position: center,
          map,
          title: '신정권역',
        });

        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="map-preview" aria-label="Naver Maps preview">
      <div className="section-heading">
        <p className="eyebrow">Naver Maps Test</p>
        <h1>기본 지도를 먼저 확인해요</h1>
        <p>
          신정권역을 기준으로 네이버 지도 SDK 로드와 마커 표시가 정상 동작하는지
          확인하는 초기 페이지입니다.
        </p>
      </div>

      <div className="map-shell">
        <div className="map-canvas" ref={mapElementRef}>
          {status === 'missing-key' && (
            <div className="map-message">
              <strong>지도 키 설정이 필요합니다.</strong>
              <span>프론트 `.env`에 `VITE_NAVER_MAPS_CLIENT_ID`를 추가하세요.</span>
            </div>
          )}
          {status === 'loading' && <div className="map-message">네이버 지도를 불러오는 중입니다.</div>}
          {status === 'error' && (
            <div className="map-message">
              <strong>지도 로드에 실패했습니다.</strong>
              <span>네이버 콘솔의 Web 서비스 URL과 Client ID를 확인하세요.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
