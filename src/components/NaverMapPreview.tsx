import { useEffect, useMemo, useRef, useState } from 'react';

import { env } from '../config/env';
import waezipHomeMarker from '../assets/waezip-home-marker.png';
import waezipLogo from '../assets/waezip-logo.png';
import {
  getFeaturesInBounds,
  getNearbyFeatures,
  searchApartments,
  type ApartmentSummary,
  type FacilityCategory,
  type FeatureSummary,
  type MapFeature,
} from '../services/familyMap';

type MapStatus = 'loading' | 'ready' | 'missing-key' | 'error';
type FacilityKey = 'all' | 'kids' | 'school' | 'crosswalk' | 'signal' | 'cctv' | 'risk';
type ActiveFacilityKey = Exclude<FacilityKey, 'all'>;

type MapOptions = {
  center?: unknown;
  zoom?: number;
  zoomControl?: boolean;
  scaleControl?: boolean;
  scaleControlOptions?: {
    position?: unknown;
  };
  mapDataControl?: boolean;
};

type MapInstance = {
  setCenter?: (center: unknown) => void;
  setZoom?: (zoom: number) => void;
  getZoom?: () => number;
  getBounds?: () => {
    getSW: () => { lat: () => number; lng: () => number };
    getNE: () => { lat: () => number; lng: () => number };
  };
};

type MarkerInstance = {
  setMap: (map: MapInstance | null) => void;
  setIcon?: (icon: { content: string; anchor?: unknown }) => void;
  setPosition?: (position: unknown) => void;
  setZIndex?: (zIndex: number) => void;
};

type NaverMapsEvent = {
  addListener: (
    target: MarkerInstance | MapInstance,
    eventName: string,
    listener: (event?: { stop?: () => void }) => void,
  ) => void;
  trigger?: (target: MapInstance, eventName: string) => void;
};

type BoundsLike = {
  getSW: () => { lat: () => number; lng: () => number };
  getNE: () => { lat: () => number; lng: () => number };
};

type DisplayMarker = {
  id: string;
  category: FacilityCategory;
  name: string;
  latitude: number;
  longitude: number;
  count: number;
  features: MapFeature[];
};

const facilityCategoryKeys: FacilityCategory[] = ['kids', 'school', 'crosswalk', 'signal', 'cctv', 'risk'];
const defaultActiveFilters: ActiveFacilityKey[] = ['kids', 'school'];

const facilityFilters: Array<{ key: FacilityKey; label: string; icon: string }> = [
  { key: 'all', label: '전체', icon: '🗺️' },
  { key: 'kids', label: '어린이시설', icon: '🧸' },
  { key: 'school', label: '학교', icon: '🏫' },
  { key: 'crosswalk', label: '횡단보도', icon: '🚸' },
  { key: 'signal', label: '보행신호', icon: '🚦' },
  { key: 'cctv', label: 'CCTV', icon: '📹' },
  { key: 'risk', label: '주의구간', icon: '⚠️' },
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

const clusterMergeDistancePx = 49;

declare global {
  interface Window {
    naver?: {
      maps: {
        LatLng: new (lat: number, lng: number) => unknown;
        Point: new (x: number, y: number) => unknown;
        Position: {
          BOTTOM_RIGHT: unknown;
        };
        Map: new (element: HTMLElement, options: MapOptions) => MapInstance;
        Marker: new (options: {
          position: unknown;
          map?: MapInstance | null;
          title?: string;
          icon?: {
            content: string;
            anchor?: unknown;
          };
          zIndex?: number;
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

function getMarkerIcon(label: string, color: string, variant: 'home' | 'facility', imageUrl?: string) {
  const size = variant === 'home' ? 58 : 38;
  const radius = size / 2;

  if (variant === 'home' && imageUrl) {
    return {
      content: `
        <span class="map-character-pin" style="--pin-color: ${color}">
          <img alt="${label}" src="${imageUrl}" />
        </span>
      `,
      anchor: window.naver ? new window.naver.maps.Point(radius + 8, radius + 34) : undefined,
    };
  }

  return {
    content: `
      <span class="map-pin map-pin--${variant}" style="--pin-color: ${color}">
        <b>${label}</b>
      </span>
    `,
    anchor: window.naver ? new window.naver.maps.Point(radius, radius) : undefined,
  };
}

function getClusterMarkerIcon(count: number) {
  return {
    content: `
      <span class="map-cluster-pin">
        <b>${count}</b>
      </span>
    `,
    anchor: window.naver ? new window.naver.maps.Point(30, 30) : undefined,
  };
}

function filterApartmentSuggestions(apartments: ApartmentSummary[], term: string, limit: number) {
  const normalized = term.trim().toLowerCase();
  if (!normalized) {
    return apartments.slice(0, limit);
  }

  return apartments.filter((apartment) => apartment.name.toLowerCase().includes(normalized)).slice(0, limit);
}

function getActiveCategories(activeFilters: ActiveFacilityKey[]): FacilityCategory[] {
  return activeFilters;
}

function getBubbleApartmentName(name: string) {
  return Array.from(name.replace(/\s+/g, '')).slice(0, 8).join('');
}

function getFeatureLabel(category: FacilityCategory) {
  return facilityFilters.find((filter) => filter.key === category)?.label ?? category;
}

function formatFeatureDetail(feature: MapFeature) {
  const clusteredCount = feature.metadata?.count;
  if (typeof clusteredCount === 'number' && clusteredCount > 1) {
    return `${clusteredCount}개 지점이 모여 있습니다.`;
  }

  if (feature.distance_m != null) {
    return `${Math.round(feature.distance_m)}m 거리`;
  }

  return feature.address ?? getFeatureLabel(feature.category);
}

function getSummaryCount(summary: FeatureSummary[], category: FacilityCategory) {
  return summary.find((item) => item.category === category)?.count ?? 0;
}

function getFeatureSummaryItems(summary: FeatureSummary[]) {
  return [
    { key: 'kids' as const, label: '어린이시설', value: `${getSummaryCount(summary, 'kids')}곳` },
    { key: 'school' as const, label: '학교', value: `${getSummaryCount(summary, 'school')}곳` },
    { key: 'crosswalk' as const, label: '횡단보도', value: `${getSummaryCount(summary, 'crosswalk')}개` },
    { key: 'signal' as const, label: '보행신호', value: `${getSummaryCount(summary, 'signal')}개` },
    { key: 'cctv' as const, label: 'CCTV', value: `${getSummaryCount(summary, 'cctv')}대` },
    { key: 'risk' as const, label: '주의구간', value: `${getSummaryCount(summary, 'risk')}곳` },
  ];
}

function getClusterGridMeters(zoom: number) {
  if (zoom <= 11) return 2000;
  if (zoom <= 12) return 1000;
  if (zoom <= 13) return 500;
  if (zoom <= 14) return 250;
  if (zoom <= 15) return 150;
  if (zoom <= 16) return 100;
  return 0;
}

function projectMarkerToPixel(latitude: number, longitude: number, zoom: number) {
  const sinLatitude = Math.sin((latitude * Math.PI) / 180);
  const scale = 256 * 2 ** zoom;
  return {
    x: ((longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) * scale,
  };
}

function mergeClusterMarkersByOverlap(markers: DisplayMarker[], zoom: number) {
  const merged: DisplayMarker[] = [];

  for (const marker of markers) {
    if (marker.count <= 1) {
      merged.push(marker);
      continue;
    }

    const markerPixel = projectMarkerToPixel(marker.latitude, marker.longitude, zoom);
    const targetIndex = merged.findIndex((candidate) => {
      if (candidate.count <= 1) {
        return false;
      }

      const candidatePixel = projectMarkerToPixel(candidate.latitude, candidate.longitude, zoom);
      const distance = Math.hypot(markerPixel.x - candidatePixel.x, markerPixel.y - candidatePixel.y);
      return distance <= clusterMergeDistancePx;
    });

    if (targetIndex === -1) {
      merged.push(marker);
      continue;
    }

    const target = merged[targetIndex];
    const features = [...target.features, ...marker.features];
    const count = target.count + marker.count;
    merged[targetIndex] = {
      ...target,
      id: `${target.id}:${marker.id}`,
      name: `${count}개 지점`,
      latitude: (target.latitude * target.count + marker.latitude * marker.count) / count,
      longitude: (target.longitude * target.count + marker.longitude * marker.count) / count,
      count,
      features,
    };
  }

  return merged;
}

function getDisplayMarkers(features: MapFeature[], zoom: number): DisplayMarker[] {
  if (features.some((feature) => feature.source === 'cluster')) {
    const markers = features.filter((feature) => zoom < 17 || feature.source !== 'cluster').map((feature) => {
      const count = typeof feature.metadata?.count === 'number' ? feature.metadata.count : 1;
      return {
        id: feature.id,
        category: feature.category,
        name: count > 1 ? `${getFeatureLabel(feature.category)} ${count}개` : feature.name,
        latitude: feature.latitude,
        longitude: feature.longitude,
        count,
        features: [feature],
      };
    });
    return mergeClusterMarkersByOverlap(markers, zoom);
  }

  const gridMeters = getClusterGridMeters(zoom);
  if (gridMeters === 0) {
    return features.map((feature) => ({
      id: feature.id,
      category: feature.category,
      name: feature.name,
      latitude: feature.latitude,
      longitude: feature.longitude,
      count: 1,
      features: [feature],
    }));
  }

  const buckets = new Map<string, MapFeature[]>();
  for (const feature of features) {
    const latGrid = gridMeters / 111320;
    const lngGrid = gridMeters / (111320 * Math.cos((feature.latitude * Math.PI) / 180));
    const latKey = Math.round(feature.latitude / latGrid);
    const lngKey = Math.round(feature.longitude / lngGrid);
    const key = `${latKey}:${lngKey}`;
    buckets.set(key, [...(buckets.get(key) ?? []), feature]);
  }

  const markers = Array.from(buckets.entries()).map(([key, bucket]) => {
    const latitude = bucket.reduce((sum, feature) => sum + feature.latitude, 0) / bucket.length;
    const longitude = bucket.reduce((sum, feature) => sum + feature.longitude, 0) / bucket.length;
    const category = bucket[0].category;
    return {
      id: key,
      category,
      name: bucket.length > 1 ? `${bucket.length}개 지점` : bucket[0].name,
      latitude,
      longitude,
      count: bucket.length,
      features: bucket,
    };
  });
  return mergeClusterMarkersByOverlap(markers, zoom);
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
  const facilityMarkerRefs = useRef<Array<{ marker: MarkerInstance; item: DisplayMarker }>>([]);
  const featureRequestIdRef = useRef(0);
  const selectedApartmentRef = useRef<ApartmentSummary | null>(null);
  const activeCategoriesRef = useRef<FacilityCategory[]>([]);
  const boundsFetchTimerRef = useRef<number | null>(null);
  const lastBoundsRequestKeyRef = useRef('');
  const defaultApartmentOptionsRef = useRef<ApartmentSummary[]>([]);
  const [status, setStatus] = useState<MapStatus>(() =>
    env.naverMapsClientId ? 'loading' : 'missing-key',
  );
  const [dataStatus, setDataStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [apartmentOptions, setApartmentOptions] = useState<ApartmentSummary[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedApartment, setSelectedApartment] = useState<ApartmentSummary | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [topSearchOpen, setTopSearchOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<ActiveFacilityKey[]>(defaultActiveFilters);
  const [animatedFilter, setAnimatedFilter] = useState<FacilityKey | null>(null);
  const [selectedFacility, setSelectedFacility] = useState<MapFeature | null>(null);
  const [features, setFeatures] = useState<MapFeature[]>([]);
  const [summary, setSummary] = useState<FeatureSummary[]>([]);
  const [compareSummary, setCompareSummary] = useState<FeatureSummary[]>([]);
  const [compareTarget, setCompareTarget] = useState<string>('');
  const [currentZoom, setCurrentZoom] = useState(15);

  const activeCategories = useMemo(() => getActiveCategories(activeFilters), [activeFilters]);
  const topApartmentSuggestions = useMemo(
    () => filterApartmentSuggestions(apartmentOptions, searchTerm, 12),
    [apartmentOptions, searchTerm],
  );
  const sidebarApartmentSuggestions = useMemo(
    () => filterApartmentSuggestions(apartmentOptions, searchTerm, 12),
    [apartmentOptions, searchTerm],
  );
  const sidebarApartmentOptions = apartmentOptions.slice(0, 3);
  const compareApartmentOptions = apartmentOptions.filter((apartment) => apartment.id !== selectedApartment?.id).slice(0, 5);
  const summaryItems = useMemo(() => getFeatureSummaryItems(compareSummary), [compareSummary]);
  const displayMarkers = useMemo(() => getDisplayMarkers(features, currentZoom), [features, currentZoom]);

  useEffect(() => {
    selectedApartmentRef.current = selectedApartment;
  }, [selectedApartment]);

  useEffect(() => {
    activeCategoriesRef.current = activeCategories;
  }, [activeCategories]);

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

        const center = new window.naver.maps.LatLng(37.5245, 126.866);
        const map = new window.naver.maps.Map(mapElementRef.current, {
          center,
          zoom: 15,
          zoomControl: false,
          scaleControl: true,
          scaleControlOptions: {
            position: window.naver.maps.Position.BOTTOM_RIGHT,
          },
          mapDataControl: true,
        });

        mapRef.current = map;
        setCurrentZoom(map.getZoom?.() ?? 15);
        window.naver.maps.Event.addListener(map, 'idle', () => {
          const zoom = map.getZoom?.() ?? 17;
          setCurrentZoom(zoom);
          if (!selectedApartmentRef.current) {
            return;
          }

          if (boundsFetchTimerRef.current) {
            window.clearTimeout(boundsFetchTimerRef.current);
          }

          boundsFetchTimerRef.current = window.setTimeout(() => {
            void refreshFeaturesByBounds(activeCategoriesRef.current);
          }, 420);
        });
        window.naver.maps.Event.addListener(map, 'click', () => {
          setSelectedFacility(null);
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
      if (boundsFetchTimerRef.current) {
        window.clearTimeout(boundsFetchTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setDataStatus('loading');
    searchApartments('', 10)
      .then((items) => {
        if (cancelled) {
          return;
        }
        setApartmentOptions(items);
        defaultApartmentOptionsRef.current = items;
        setCompareTarget(items[1]?.id ?? items[0]?.id ?? '');
        setDataStatus('idle');
      })
      .catch(() => {
        if (!cancelled) {
          setDataStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const normalized = searchTerm.trim();
    if (!normalized) {
      setApartmentOptions(defaultApartmentOptionsRef.current);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      searchApartments(normalized, 20)
        .then((items) => {
          if (!cancelled) {
            setApartmentOptions(items);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setApartmentOptions([]);
          }
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchTerm]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.naver?.maps) {
      return;
    }

    const triggerResize = () => window.naver?.maps.Event.trigger?.(map, 'resize');
    const timers = [0, 120, 300, 520].map((delay) => window.setTimeout(triggerResize, delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [sidebarOpen, selectedApartment?.id]);

  useEffect(() => {
    const element = mapElementRef.current;
    const map = mapRef.current;
    if (!element || !map || !window.ResizeObserver) {
      return;
    }

    const observer = new ResizeObserver(() => {
      window.naver?.maps.Event.trigger?.(map, 'resize');
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [status]);

  useEffect(() => {
    if (!selectedApartment) {
      setCompareSummary([]);
      return;
    }

    let cancelled = false;
    getNearbyFeatures(selectedApartment.id, facilityCategoryKeys, 1000)
      .then((result) => {
        if (!cancelled) {
          setCompareSummary(result.summary);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCompareSummary([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedApartment?.id]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.naver?.maps) {
      return;
    }

    facilityMarkerRefs.current.forEach(({ marker }) => marker.setMap(null));
    facilityMarkerRefs.current = displayMarkers.map((item) => {
      const iconLabel = facilityFilters.find((filter) => filter.key === item.category)?.icon ?? '•';
      const marker = new window.naver!.maps.Marker({
        position: new window.naver!.maps.LatLng(item.latitude, item.longitude),
        map,
        title: item.name,
        icon:
          item.count > 1
            ? getClusterMarkerIcon(item.count)
            : getMarkerIcon(iconLabel, facilityColors[item.category], 'facility'),
        zIndex: item.count > 1 ? 80 : 40,
      });
      window.naver!.maps.Event.addListener(marker, 'click', (event?: { stop?: () => void }) => {
        event?.stop?.();
        if (item.count === 1) {
          setSelectedFacility(item.features[0]);
          return;
        }

        setSelectedFacility({
          ...item.features[0],
          id: item.id,
          name: item.name,
          latitude: item.latitude,
          longitude: item.longitude,
          distance_m: null,
          metadata: {
            ...item.features[0].metadata,
            count: item.count,
          },
        });
      });
      return { marker, item };
    });

    return () => {
      facilityMarkerRefs.current.forEach(({ marker }) => marker.setMap(null));
      facilityMarkerRefs.current = [];
    };
  }, [displayMarkers]);

  useEffect(() => {
    if (!selectedApartment) {
      return;
    }

    void refreshFeaturesByBounds(activeCategories);
  }, [selectedApartment?.id, activeCategories]);

  async function refreshFeaturesByBounds(categories: FacilityCategory[]) {
    if (categories.length === 0) {
      featureRequestIdRef.current += 1;
      setFeatures([]);
      setSummary([]);
      setSelectedFacility(null);
      setDataStatus('idle');
      return;
    }

    const bounds = mapRef.current?.getBounds?.() as BoundsLike | undefined;
    if (!bounds) {
      return;
    }

    const sw = bounds.getSW();
    const ne = bounds.getNE();
    const boundsKey = [
      sw.lat().toFixed(4),
      sw.lng().toFixed(4),
      ne.lat().toFixed(4),
      ne.lng().toFixed(4),
      categories.join(','),
    ].join(':');
    if (lastBoundsRequestKeyRef.current === boundsKey) {
      return;
    }
    lastBoundsRequestKeyRef.current = boundsKey;

    const requestId = featureRequestIdRef.current + 1;
    featureRequestIdRef.current = requestId;
    setDataStatus('loading');

    try {
      const result = await getFeaturesInBounds(
        {
          swLat: sw.lat(),
          swLng: sw.lng(),
          neLat: ne.lat(),
          neLng: ne.lng(),
        },
        categories,
        mapRef.current?.getZoom?.() ?? currentZoom,
      );
      if (featureRequestIdRef.current !== requestId) {
        return;
      }
      setFeatures(result.features);
      setSummary(result.summary);
      setDataStatus('idle');
    } catch {
      if (featureRequestIdRef.current === requestId) {
        setDataStatus('error');
      }
    }
  }

  function selectApartment(apartment: ApartmentSummary) {
    setSelectedApartment(apartment);
    setSidebarOpen(false);
    setSelectedFacility(null);

    const map = mapRef.current;
    if (window.naver?.maps && map) {
      const center = new window.naver.maps.LatLng(apartment.latitude, apartment.longitude);
      map.setCenter?.(center);
      map.setZoom?.(17);
      window.naver.maps.Event.trigger?.(map, 'resize');

      if (!apartmentMarkerRef.current) {
        apartmentMarkerRef.current = new window.naver.maps.Marker({
          position: center,
          map,
          title: apartment.name,
          icon: getMarkerIcon('집', facilityColors.home, 'home', waezipHomeMarker),
          zIndex: 10000,
        });
      } else {
        apartmentMarkerRef.current.setPosition?.(center);
        apartmentMarkerRef.current.setMap(map);
        apartmentMarkerRef.current.setZIndex?.(10000);
      }
    }
  }

  async function selectFromSearch(term: string) {
    const normalized = term.trim();
    if (!normalized) {
      return;
    }

    setDataStatus('loading');
    try {
      const items = await searchApartments(normalized, 20);
      setApartmentOptions(items);
      if (items[0]) {
        selectApartment(items[0]);
        setSearchTerm('');
        setTopSearchOpen(false);
      }
      setDataStatus('idle');
    } catch {
      setDataStatus('error');
    }
  }

  function openSidebar() {
    setSidebarOpen(true);
    setSelectedFacility(null);
  }

  function changeFilter(nextFilter: FacilityKey) {
    if (nextFilter === 'all') {
      setActiveFilters((current) =>
        current.length === facilityCategoryKeys.length ? [] : [...facilityCategoryKeys],
      );
    } else {
      setActiveFilters((current) =>
        current.includes(nextFilter)
          ? current.filter((filter) => filter !== nextFilter)
          : [...current, nextFilter],
      );
    }
    setAnimatedFilter(nextFilter);
    setSelectedFacility(null);
    window.setTimeout(() => setAnimatedFilter(null), 420);
  }

  function resetFilters() {
    setActiveFilters(defaultActiveFilters);
    setAnimatedFilter('all');
    setSelectedFacility(null);
    window.setTimeout(() => setAnimatedFilter(null), 420);
  }

  function selectSuggestion(apartment: ApartmentSummary) {
    selectApartment(apartment);
    setSearchTerm('');
    setTopSearchOpen(false);
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
            {topApartmentSuggestions.length > 0 && (
              <div className="apartment-suggestions" role="listbox">
                {topApartmentSuggestions.map((apartment) => (
                  <button key={apartment.id} onMouseDown={(event) => event.preventDefault()} onClick={() => selectSuggestion(apartment)} role="option" type="button">
                    <span aria-hidden="true">집</span>
                    <b>{apartment.name}</b>
                    <small>{apartment.address}</small>
                  </button>
                ))}
              </div>
            )}
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
            {sidebarApartmentSuggestions.length > 0 && (
              <div className="apartment-suggestions" role="listbox">
                {sidebarApartmentSuggestions.map((apartment) => (
                  <button key={apartment.id} onMouseDown={(event) => event.preventDefault()} onClick={() => selectSuggestion(apartment)} role="option" type="button">
                    <span aria-hidden="true">집</span>
                    <b>{apartment.name}</b>
                    <small>{apartment.address}</small>
                  </button>
                ))}
              </div>
            )}
          </form>

          <div className="apartment-list">
            {sidebarApartmentOptions.map((apartment) => (
              <button
                className="apartment-option"
                key={apartment.id}
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
            <small className="compare-radius-note">선택 아파트 1km 이내 기준</small>
            <select
              aria-label="비교 아파트 선택"
              onChange={(event) => setCompareTarget(event.target.value)}
              value={compareTarget}
            >
              <option value="">비교 아파트 선택</option>
              {compareApartmentOptions.map((apartment) => (
                <option key={apartment.id} value={apartment.id}>
                  {apartment.name}
                </option>
              ))}
            </select>
            <div className="facts">
              {summaryItems.map((item) => (
                <div className="fact" key={item.key}>
                  <small>{item.label}</small>
                  <b>{item.value}</b>
                  <span>{compareTarget ? '비교 준비 중' : '1km 이내'}</span>
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
                    <span>어린이시설 {getSummaryCount(summary, 'kids')}곳</span>
                    <span>학교 {getSummaryCount(summary, 'school')}곳</span>
                    <span>보행신호 {getSummaryCount(summary, 'signal')}개</span>
                  </p>
                </div>
                <button onClick={openSidebar} type="button">🏢 아파트 다시 선택</button>
              </div>
              <div className="facility-filters" aria-label="시설 필터">
                {facilityFilters.map((filter) => (
                  <button
                    className={[
                      (
                        filter.key === 'all'
                          ? activeFilters.length === facilityCategoryKeys.length
                          : activeFilters.includes(filter.key)
                      )
                        ? 'facility-filter facility-filter--active'
                        : 'facility-filter',
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
                <button className="facility-filter facility-filter--reset" onClick={resetFilters} type="button">
                  <span aria-hidden="true">↺</span>
                  초기화
                </button>
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
            {status === 'ready' && dataStatus === 'loading' && (
              <div className="map-message map-message--soft">주변 데이터를 불러오는 중입니다.</div>
            )}
            {status === 'ready' && dataStatus === 'error' && (
              <div className="map-message map-message--soft">
                <strong>주변 데이터 연결을 확인해주세요.</strong>
                <span>백엔드 서버와 Supabase 연결 상태를 확인하세요.</span>
              </div>
            )}
          </div>

          {status === 'ready' && !selectedApartment && (
            <div className="apartment-bubble-layer" aria-label="지도에서 아파트 선택">
              {sidebarApartmentOptions.map((apartment) => (
                <button
                  className="apartment-map-bubble"
                  key={apartment.id}
                  onClick={() => selectApartment(apartment)}
                  title={apartment.name}
                  type="button"
                >
                  {getBubbleApartmentName(apartment.name)}
                </button>
              ))}
            </div>
          )}

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
              <small>{getFeatureLabel(selectedFacility.category)}</small>
              <b>{selectedFacility.name}</b>
              <span>{formatFeatureDetail(selectedFacility)}</span>
            </aside>
          )}
        </div>
      </div>
    </section>
  );
}
