import { useEffect, useMemo, useRef, useState } from 'react';

import { env } from '../config/env';
import waezipLogo from '../assets/waezip-logo.png';

type MapStatus = 'loading' | 'ready' | 'missing-key' | 'error';
type FacilityKey = 'all' | 'kids' | 'school' | 'crosswalk' | 'signal' | 'cctv' | 'risk';

type Apartment = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  built: string;
  radius: string;
};

type Facility = {
  key: Exclude<FacilityKey, 'all'>;
  label: string;
  detail: string;
  lat: number;
  lng: number;
};

type MapOptions = {
  center?: unknown;
  zoom?: number;
  zoomControl?: boolean;
  scaleControl?: boolean;
  mapDataControl?: boolean;
};

type MapInstance = {
  setCenter?: (center: unknown) => void;
  setZoom?: (zoom: number) => void;
};

type MarkerInstance = {
  setMap: (map: MapInstance | null) => void;
  setIcon?: (icon: { content: string; anchor?: unknown }) => void;
  setPosition?: (position: unknown) => void;
};

type NaverMapsEvent = {
  addListener: (target: MarkerInstance, eventName: string, listener: () => void) => void;
  trigger?: (target: MapInstance, eventName: string) => void;
};

const apartmentOptions: Apartment[] = [
  {
    name: '광화문 스페이스본',
    address: '서울 종로구 사직로8길 4',
    lat: 37.5714,
    lng: 126.9768,
    built: '2008년 준공',
    radius: '반경 1km',
  },
  {
    name: '서울숲 트리마제',
    address: '서울 성동구 왕십리로 16',
    lat: 37.5446,
    lng: 127.0559,
    built: '2017년 준공',
    radius: '반경 1km',
  },
  {
    name: '분당 파크뷰',
    address: '경기 성남시 분당구 정자일로 248',
    lat: 37.3595,
    lng: 127.1052,
    built: '2004년 준공',
    radius: '반경 1km',
  },
];

const compareApartments = ['서울숲 트리마제', '연남 코오롱하늘채', '분당 파크뷰'] as const;

const compareValues: Record<string, string[]> = {
  '서울숲 트리마제': ['11곳', '12곳', '31대', '4곳'],
  '연남 코오롱하늘채': ['9곳', '10곳', '24대', '5곳'],
  '분당 파크뷰': ['13곳', '17곳', '29대', '2곳'],
};

const baseValues = ['8곳', '14곳', '26대', '3곳'];
const compareLabels = ['초등학교 · 어린이시설', '안전 횡단보도', 'CCTV', '주의 구간'];

const facilityFilters: Array<{ key: FacilityKey; label: string; icon: string }> = [
  { key: 'all', label: '전체', icon: '🗺️' },
  { key: 'kids', label: '어린이시설', icon: '🧸' },
  { key: 'school', label: '학교', icon: '🏫' },
  { key: 'crosswalk', label: '횡단보도', icon: '🚸' },
  { key: 'signal', label: '보행신호', icon: '🚦' },
  { key: 'cctv', label: 'CCTV', icon: '📹' },
  { key: 'risk', label: '주의구간', icon: '⚠️' },
];

const facilities: Facility[] = [
  { key: 'school', label: '정수초등학교', detail: '도보권 초등학교', lat: 37.5722, lng: 126.9753 },
  { key: 'kids', label: '장난감도서관', detail: '어린이 활동 시설', lat: 37.5704, lng: 126.9736 },
  { key: 'crosswalk', label: '안심 횡단보도', detail: '어린이 보호구역 인접', lat: 37.5702, lng: 126.9791 },
  { key: 'signal', label: '보행신호 교차로', detail: '보행 신호 운영 구간', lat: 37.5689, lng: 126.9782 },
  { key: 'cctv', label: '생활안전 CCTV', detail: '주요 보행로 감시 지점', lat: 37.5688, lng: 126.9746 },
  { key: 'risk', label: '주의 통학로', detail: '차량 진입이 잦은 구간', lat: 37.5731, lng: 126.9787 },
];

const facilityColors: Record<Exclude<FacilityKey, 'all'> | 'home', string> = {
  home: '#A5D3A8',
  kids: '#F9CC19',
  school: '#F9CC19',
  crosswalk: '#A5D3A8',
  signal: '#A2D6F1',
  cctv: '#9B6DE7',
  risk: '#FF5B66',
};

declare global {
  interface Window {
    naver?: {
      maps: {
        LatLng: new (lat: number, lng: number) => unknown;
        Point: new (x: number, y: number) => unknown;
        Map: new (element: HTMLElement, options: MapOptions) => MapInstance;
        Marker: new (options: {
          position: unknown;
          map?: MapInstance | null;
          title?: string;
          icon?: {
            content: string;
            anchor?: unknown;
          };
        }) => MarkerInstance;
        Event: NaverMapsEvent;
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
      submodules: 'geocoder',
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

function getMarkerIcon(label: string, color: string, variant: 'home' | 'facility') {
  const size = variant === 'home' ? 44 : 38;
  const radius = size / 2;

  return {
    content: `
      <span class="map-pin map-pin--${variant}" style="--pin-color: ${color}">
        <b>${label}</b>
      </span>
    `,
    anchor: window.naver ? new window.naver.maps.Point(radius, radius) : undefined,
  };
}

function getVisibleFacilities(activeFilter: FacilityKey) {
  if (activeFilter === 'all') {
    return facilities;
  }

  return facilities.filter((facility) => facility.key === activeFilter);
}

export function NaverMapPreview({
  onBackHome,
  onOpenInvestment,
}: {
  onBackHome?: () => void;
  onOpenInvestment?: () => void;
}) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const apartmentMarkerRef = useRef<MarkerInstance | null>(null);
  const facilityMarkerRefs = useRef<Array<{ marker: MarkerInstance; facility: Facility }>>([]);
  const [status, setStatus] = useState<MapStatus>(() =>
    env.naverMapsClientId ? 'loading' : 'missing-key',
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedApartment, setSelectedApartment] = useState<Apartment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [topSearchOpen, setTopSearchOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FacilityKey>('all');
  const [animatedFilter, setAnimatedFilter] = useState<FacilityKey | null>(null);
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [compareTarget, setCompareTarget] = useState<string>(compareApartments[0]);

  const visibleFacilities = useMemo(() => getVisibleFacilities(activeFilter), [activeFilter]);
  const compareTargetValues = compareValues[compareTarget] ?? compareValues[compareApartments[0]];

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

        const center = new window.naver.maps.LatLng(37.5714, 126.9768);
        const map = new window.naver.maps.Map(mapElementRef.current, {
          center,
          zoom: 15,
          zoomControl: false,
          scaleControl: true,
          mapDataControl: true,
        });

        facilityMarkerRefs.current = facilities.map((facility) => {
          const marker = new window.naver!.maps.Marker({
            position: new window.naver!.maps.LatLng(facility.lat, facility.lng),
            map: null,
            title: facility.label,
            icon: getMarkerIcon(
              facilityFilters.find((filter) => filter.key === facility.key)?.icon ?? '•',
              facilityColors[facility.key],
              'facility',
            ),
          });
          window.naver!.maps.Event.addListener(marker, 'click', () => setSelectedFacility(facility));
          return { marker, facility };
        });

        mapRef.current = map;
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

    facilityMarkerRefs.current.forEach(({ marker, facility }) => {
      const shouldShow = Boolean(selectedApartment) && visibleFacilities.includes(facility);
      marker.setMap(shouldShow ? map : null);
    });
  }, [selectedApartment, visibleFacilities]);

  function selectApartment(apartment: Apartment) {
    setSelectedApartment(apartment);
    setSidebarOpen(false);
    setSelectedFacility(null);

    const map = mapRef.current;
    if (window.naver?.maps && map) {
      const center = new window.naver.maps.LatLng(apartment.lat, apartment.lng);
      map.setCenter?.(center);
      map.setZoom?.(16);
      window.naver.maps.Event.trigger?.(map, 'resize');

      if (!apartmentMarkerRef.current) {
        apartmentMarkerRef.current = new window.naver.maps.Marker({
          position: center,
          map,
          title: apartment.name,
          icon: getMarkerIcon('집', facilityColors.home, 'home'),
        });
      } else {
        apartmentMarkerRef.current.setPosition?.(center);
        apartmentMarkerRef.current.setMap(map);
      }
    }
  }

  function selectFromSearch(term: string) {
    const normalized = term.trim();
    if (!normalized) {
      return;
    }

    const matchedApartment = apartmentOptions.find((apartment) => apartment.name.includes(normalized));
    selectApartment(
      matchedApartment ?? {
        name: normalized,
        address: '검색한 아파트 주소',
        lat: 37.5714,
        lng: 126.9768,
        built: '연혁 확인 필요',
        radius: '반경 1km',
      },
    );
    setSearchTerm('');
    setTopSearchOpen(false);
  }

  function openSidebar() {
    setSidebarOpen(true);
    setSelectedFacility(null);
  }

  function changeFilter(nextFilter: FacilityKey) {
    setActiveFilter(nextFilter);
    setAnimatedFilter(nextFilter);
    setSelectedFacility(null);
    window.setTimeout(() => setAnimatedFilter(null), 420);
  }

  return (
    <section className="family-map-page" aria-label="이집 어때요 생활 지도">
      <header className="family-map-bar">
        <button aria-label="왜집 홈" className="family-map-logo" onClick={onBackHome} type="button">
          <img alt="왜집?" src={waezipLogo} />
        </button>
        <button aria-label="처음 화면으로 돌아가기" className="family-map-back" onClick={onBackHome} type="button">‹</button>
        <div className={topSearchOpen ? 'top-search top-search--expanded' : 'top-search'}>
          <button
            aria-label="아파트 검색 열기"
            className="search-toggle"
            onClick={() => setTopSearchOpen((current) => !current)}
            type="button"
          >
            ⌕
          </button>
          <form
            className="search-slide"
            onSubmit={(event) => {
              event.preventDefault();
              selectFromSearch(searchTerm);
            }}
          >
            <input
              aria-label="기준 아파트 검색"
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="아파트를 입력해주세요!"
              value={searchTerm}
            />
            <button type="submit">검색</button>
          </form>
        </div>
      </header>

      <div className={sidebarOpen ? 'map-layout map-layout--sidebar-open' : 'map-layout'}>
        <aside className="apartment-sidebar" aria-label="아파트 선택과 비교">
          <button aria-label="아파트 선택 닫기" className="sidebar-close" onClick={() => setSidebarOpen(false)} type="button">
            ‹
          </button>
          <div className="sidebar-head">
            <span aria-hidden="true">🏢</span>
            <div>
              <b>아파트를 먼저 선택하세요</b>
              <small>선택한 아파트가 지도의 기준점이 됩니다.</small>
            </div>
          </div>

          <form
            className="sidebar-search"
            onSubmit={(event) => {
              event.preventDefault();
              selectFromSearch(searchTerm);
            }}
          >
            <input
              aria-label="사이드바 아파트 검색"
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="아파트 이름을 입력하세요"
              value={searchTerm}
            />
            <button type="submit">검색</button>
          </form>

          <div className="apartment-list">
            {apartmentOptions.map((apartment) => (
              <button
                className="apartment-option"
                key={apartment.name}
                onClick={() => selectApartment(apartment)}
                type="button"
              >
                <span aria-hidden="true">🏙️</span>
                <div>
                  <b>{apartment.name}</b>
                  <small>{apartment.address}</small>
                </div>
              </button>
            ))}
          </div>

          <section className="sidebar-compare" aria-label="아파트 비교">
            <h3>아파트 비교</h3>
            <b>{selectedApartment?.name ?? '기준 아파트 미선택'}</b>
            <select
              aria-label="비교 아파트 선택"
              onChange={(event) => setCompareTarget(event.target.value)}
              value={compareTarget}
            >
              {compareApartments.map((apartment) => (
                <option key={apartment}>{apartment}</option>
              ))}
            </select>
            <div className="facts">
              {compareLabels.map((label, index) => (
                <div className="fact" key={label}>
                  <small>{label}</small>
                  <b>{baseValues[index]}</b>
                  <span>{compareTargetValues[index]}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="sidebar-memo">
            <h3>비교 분석 메모</h3>
            <textarea placeholder="비교하며 발견한 점을 기록하세요." />
            <button type="button">메모 저장</button>
          </section>

          <button className="go-note" onClick={onOpenInvestment} type="button">
            <span aria-hidden="true">📝</span>
            <div>
              <b>왜집의 임장노트</b>
              <small>투자 관점으로 이동하기</small>
            </div>
            <i>→</i>
          </button>
        </aside>

        <div className="map-stage">
          {!sidebarOpen && (
            <button className="sidebar-open-button" onClick={openSidebar} type="button">
              🏢 <span>아파트 선택</span>
            </button>
          )}

          {selectedApartment && !sidebarOpen && (
            <div className="map-facility-panel">
              <div className="facility-heading">
                <div>
                  <b>무엇을 지도에서 볼까요?</b>
                  <p className="apartment-mini-summary">
                    <span>연혁 · {selectedApartment.built}</span>
                    <span>안전거리 · {selectedApartment.radius}</span>
                  </p>
                </div>
                <button onClick={openSidebar} type="button">🏢 아파트 다시 선택</button>
              </div>
              <div className="facility-filters" aria-label="시설 필터">
                {facilityFilters.map((filter) => (
                  <button
                    className={[
                      activeFilter === filter.key ? 'facility-filter facility-filter--active' : 'facility-filter',
                      animatedFilter === filter.key ? 'facility-filter--pop' : '',
                    ].join(' ')}
                    key={filter.key}
                    onClick={() => changeFilter(filter.key)}
                    type="button"
                  >
                    <span aria-hidden="true">{filter.icon}</span>
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="family-naver-map" ref={mapElementRef}>
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
            {status === 'ready' && !selectedApartment && (
              <div className="map-message map-message--soft">
                <strong>아파트를 먼저 선택하세요</strong>
                <span>왼쪽 사이드바에서 기준 아파트를 선택해 주세요.</span>
              </div>
            )}
          </div>

          {selectedApartment && (
            <div className="map-apartment-caption">
              <small>현재 기준점</small>
              <b>{selectedApartment.name}</b>
              <span>{selectedApartment.address}</span>
              <em>이 아파트 주변을 살펴보고 있어요</em>
            </div>
          )}

          {selectedFacility && (
            <aside className="map-place-card" aria-label="선택한 시설 정보">
              <small>{facilityFilters.find((filter) => filter.key === selectedFacility.key)?.label}</small>
              <b>{selectedFacility.label}</b>
              <span>{selectedFacility.detail}</span>
            </aside>
          )}
        </div>
      </div>
    </section>
  );
}
