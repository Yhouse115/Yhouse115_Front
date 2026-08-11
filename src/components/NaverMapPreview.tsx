import { useEffect, useRef, useState, type CSSProperties } from 'react';

import { env } from '../config/env';

type MapStatus = 'loading' | 'ready' | 'missing-key' | 'error';
type StylePresetKey = 'standard' | 'operator' | 'transit' | 'soft';

type MapStylePreset = {
  key: StylePresetKey;
  label: string;
  description: string;
  customStyleId: string;
  accentColor: string;
  surfaceColor: string;
};

type MapSettings = {
  styleKey: StylePresetKey;
  showHomeMarker: boolean;
  showSubwayStations: boolean;
  homeMarkerColor: string;
  subwayMarkerColor: string;
};

type MapOptions = {
  center?: unknown;
  zoom?: number;
  gl?: boolean;
  customStyleId?: string;
  zoomControl?: boolean;
  scaleControl?: boolean;
  mapDataControl?: boolean;
};

type MapInstance = {
  setOptions: (options: MapOptions) => void;
};

type MarkerInstance = {
  setMap: (map: MapInstance | null) => void;
  setIcon: (icon: { content: string; anchor?: unknown }) => void;
};

const operatorMapDefaults: MapSettings = {
  styleKey: 'standard',
  showHomeMarker: true,
  showSubwayStations: true,
  homeMarkerColor: '#2563eb',
  subwayMarkerColor: '#19a463',
};

const mapStylePresets: MapStylePreset[] = [
  {
    key: 'standard',
    label: '네이버 기본',
    description: '별도 커스텀 스타일 없이 기본 지도를 사용합니다.',
    customStyleId: '',
    accentColor: '#2563eb',
    surfaceColor: '#f7fafc',
  },
  {
    key: 'operator',
    label: '운영 커스텀',
    description: '서비스 운영자가 별도로 발행한 커스텀 지도 스타일입니다.',
    customStyleId: env.naverMapsDefaultStyleId,
    accentColor: '#1f8a5b',
    surfaceColor: '#eef8f1',
  },
  {
    key: 'transit',
    label: '교통 강조',
    description: '대중교통과 주요 이동축을 보기 위한 스타일입니다.',
    customStyleId: env.naverMapsTransitStyleId,
    accentColor: '#2563eb',
    surfaceColor: '#edf4ff',
  },
  {
    key: 'soft',
    label: '생활권 보기',
    description: '학교와 생활 시설을 차분하게 보기 위한 스타일입니다.',
    customStyleId: env.naverMapsSoftStyleId,
    accentColor: '#c27a32',
    surfaceColor: '#fff7ed',
  },
];

const subwayStations = [
  { name: '목동역', line: '5', lat: 37.5261, lng: 126.8644 },
  { name: '오목교역', line: '5', lat: 37.5244, lng: 126.8752 },
  { name: '신정네거리역', line: '2', lat: 37.5203, lng: 126.8529 },
];

declare global {
  interface Window {
    naver?: {
      maps: {
        LatLng: new (lat: number, lng: number) => unknown;
        Point: new (x: number, y: number) => unknown;
        Map: new (
          element: HTMLElement,
          options: MapOptions,
        ) => MapInstance;
        Marker: new (options: {
          position: unknown;
          map: MapInstance;
          title?: string;
          icon?: {
            content: string;
            anchor?: unknown;
          };
        }) => MarkerInstance;
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

function getStylePreset(styleKey: StylePresetKey) {
  return mapStylePresets.find((preset) => preset.key === styleKey) ?? mapStylePresets[0];
}

function getEffectiveCustomStyleId(styleKey: StylePresetKey, showSubwayStations: boolean) {
  if (!showSubwayStations && env.naverMapsNoTransitStyleId) {
    return env.naverMapsNoTransitStyleId;
  }

  return getStylePreset(styleKey).customStyleId;
}

function getMapOptions(settings: MapSettings, center?: unknown): MapOptions {
  const customStyleId = getEffectiveCustomStyleId(settings.styleKey, settings.showSubwayStations);
  const options: MapOptions = {
    center,
    zoom: 15,
    zoomControl: true,
    scaleControl: true,
    mapDataControl: true,
  };

  if (customStyleId) {
    options.gl = true;
    options.customStyleId = customStyleId;
  }

  return options;
}

function getMarkerIcon(label: string, color: string, variant: 'home' | 'subway') {
  const isHome = variant === 'home';
  const size = isHome ? 34 : 30;
  const radius = size / 2;

  return {
    content: `
      <span class="map-custom-marker map-custom-marker--${variant}" style="--marker-color: ${color}">
        ${label}
      </span>
    `,
    anchor: window.naver ? new window.naver.maps.Point(radius, radius) : undefined,
  };
}

export function NaverMapPreview() {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const homeMarkerRef = useRef<MarkerInstance | null>(null);
  const subwayMarkerRefs = useRef<MarkerInstance[]>([]);
  const settingsRef = useRef<MapSettings>(operatorMapDefaults);
  const currentCustomStyleIdRef = useRef(
    getEffectiveCustomStyleId(operatorMapDefaults.styleKey, operatorMapDefaults.showSubwayStations),
  );
  const [status, setStatus] = useState<MapStatus>(() =>
    env.naverMapsClientId ? 'loading' : 'missing-key',
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<MapSettings>(operatorMapDefaults);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

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

        const initialSettings = settingsRef.current;
        const center = new window.naver.maps.LatLng(37.5207, 126.8563);
        const map = new window.naver.maps.Map(mapElementRef.current, {
          center,
          ...getMapOptions(initialSettings, center),
        });

        homeMarkerRef.current = new window.naver.maps.Marker({
          position: center,
          map,
          title: '신정권역',
          icon: getMarkerIcon('집', initialSettings.homeMarkerColor, 'home'),
        });

        subwayMarkerRefs.current = subwayStations.map((station) => (
          new window.naver!.maps.Marker({
            position: new window.naver!.maps.LatLng(station.lat, station.lng),
            map,
            title: station.name,
            icon: getMarkerIcon(station.line, initialSettings.subwayMarkerColor, 'subway'),
          })
        ));

        mapRef.current = map;
        currentCustomStyleIdRef.current = getEffectiveCustomStyleId(
          initialSettings.styleKey,
          initialSettings.showSubwayStations,
        );
        homeMarkerRef.current.setMap(initialSettings.showHomeMarker ? map : null);
        subwayMarkerRefs.current.forEach((marker) => {
          marker.setMap(initialSettings.showSubwayStations ? map : null);
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    homeMarkerRef.current?.setIcon(getMarkerIcon('집', settings.homeMarkerColor, 'home'));
    homeMarkerRef.current?.setMap(settings.showHomeMarker ? map : null);
    subwayMarkerRefs.current.forEach((marker, index) => {
      marker.setIcon(getMarkerIcon(subwayStations[index]?.line ?? '역', settings.subwayMarkerColor, 'subway'));
      marker.setMap(settings.showSubwayStations ? map : null);
    });
  }, [
    settings.homeMarkerColor,
    settings.showHomeMarker,
    settings.showSubwayStations,
    settings.subwayMarkerColor,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const nextCustomStyleId = getEffectiveCustomStyleId(settings.styleKey, settings.showSubwayStations);
    if (!nextCustomStyleId || nextCustomStyleId === currentCustomStyleIdRef.current) {
      return;
    }

    map.setOptions({
      gl: true,
      customStyleId: nextCustomStyleId,
    });
    currentCustomStyleIdRef.current = nextCustomStyleId;
  }, [settings.showSubwayStations, settings.styleKey]);

  function applyPreset(styleKey: StylePresetKey) {
    const preset = getStylePreset(styleKey);
    setSettings((current) => ({
      ...current,
      styleKey,
      homeMarkerColor: preset.accentColor,
      subwayMarkerColor: styleKey === 'transit' ? '#0ea5e9' : current.subwayMarkerColor,
    }));
  }

  const canHideBaseTransit = Boolean(env.naverMapsNoTransitStyleId);

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
          <div className="map-floating-actions">
            <button
              aria-expanded={settingsOpen}
              aria-label="지도 설정"
              className="map-settings-trigger"
              onClick={() => setSettingsOpen((current) => !current)}
              type="button"
            >
              ⚙
            </button>
          </div>

          {settingsOpen && (
            <div className="map-style-popover" role="dialog" aria-label="지도 스타일 설정">
              <div className="map-style-header">
                <div>
                  <p className="eyebrow">Map Style</p>
                  <h2>지도 표시 설정</h2>
                </div>
                <button
                  aria-label="지도 설정 닫기"
                  className="map-style-close"
                  onClick={() => setSettingsOpen(false)}
                  type="button"
                >
                  ×
                </button>
              </div>

              <section className="style-editor-section">
                <h3>지도 템플릿</h3>
                <div className="style-preset-grid">
                  {mapStylePresets.map((preset) => (
                    <button
                      className={
                        settings.styleKey === preset.key
                          ? 'style-preset-button style-preset-button--active'
                          : 'style-preset-button'
                      }
                      key={preset.key}
                      onClick={() => applyPreset(preset.key)}
                      style={
                        {
                          '--preset-color': preset.accentColor,
                          '--preset-surface': preset.surfaceColor,
                        } as CSSProperties
                      }
                      type="button"
                    >
                      <span className="style-preset-swatch" />
                      <strong>{preset.label}</strong>
                      <small>{preset.customStyleId ? 'Style ID 연결됨' : 'Style ID 미설정'}</small>
                    </button>
                  ))}
                </div>
                <p className="style-helper">
                  기본값은 네이버 기본 지도입니다. 커스텀 지도 색상은 Naver Style Editor에서 발행한
                  Metadata ID가 있는 프리셋을 선택할 때만 적용됩니다.
                </p>
                {!settings.showSubwayStations && !canHideBaseTransit && (
                  <p className="style-warning">
                    샘플 지하철역 마커는 숨겨졌습니다. 네이버 기본 지도에 포함된 지하철역 POI까지
                    숨기려면 `VITE_NAVER_MAPS_NO_TRANSIT_STYLE_ID`가 필요합니다.
                  </p>
                )}
              </section>

              <section className="style-editor-section">
                <h3>지도 위 표시</h3>
                <label className="style-toggle">
                  <input
                    checked={settings.showSubwayStations}
                    onChange={(event) =>
                      setSettings((current) => ({ ...current, showSubwayStations: event.target.checked }))
                    }
                    type="checkbox"
                  />
                  <span>
                    <strong>지하철역 표시</strong>
                    <small>
                      주변 지하철역 오버레이를 표시합니다. 숨김용 Style ID가 있으면 기본 지도 POI도 함께 줄입니다.
                    </small>
                  </span>
                </label>
                <label className="style-toggle">
                  <input
                    checked={settings.showHomeMarker}
                    onChange={(event) =>
                      setSettings((current) => ({ ...current, showHomeMarker: event.target.checked }))
                    }
                    type="checkbox"
                  />
                  <span>
                    <strong>기준 위치 표시</strong>
                    <small>신정권역 기준 마커를 표시합니다.</small>
                  </span>
                </label>
              </section>

              <section className="style-editor-section">
                <h3>표시 색상</h3>
                <label className="color-setting">
                  <span>기준 위치</span>
                  <input
                    aria-label="기준 위치 색상"
                    onChange={(event) =>
                      setSettings((current) => ({ ...current, homeMarkerColor: event.target.value }))
                    }
                    type="color"
                    value={settings.homeMarkerColor}
                  />
                </label>
                <label className="color-setting">
                  <span>지하철역</span>
                  <input
                    aria-label="지하철역 색상"
                    onChange={(event) =>
                      setSettings((current) => ({ ...current, subwayMarkerColor: event.target.value }))
                    }
                    type="color"
                    value={settings.subwayMarkerColor}
                  />
                </label>
              </section>

              <button
                className="settings-reset-button"
                onClick={() => setSettings(operatorMapDefaults)}
                type="button"
              >
                운영 표시 기본값으로 되돌리기
              </button>
            </div>
          )}

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
