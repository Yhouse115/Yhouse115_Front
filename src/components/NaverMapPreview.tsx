import { useEffect, useMemo, useRef, useState } from 'react';

import { env } from '../config/env';
import { useAuth } from '../features/auth/useAuth';
import { LoginButton } from '../features/auth/LoginButton';
import waezipHomeMarker from '../assets/waezip-home-marker.png';
import waezipLogo from '../assets/waezip-logo.png';
import {
  compareApartments,
  getNearbyFeatures,
  getWalkingRoute,
  resolveApartmentPnu,
  searchApartments,
  type ApartmentCompareResponse,
  type ApartmentSummary,
  type FacilityCategory,
  type FeatureSummary,
  type MapFeature,
  type WalkingRoute,
  ApiRequestError,
  WalkingRouteNotFoundError,
} from '../services/familyMap';
import { logger } from '../services/logger';
import { getUserMemo, saveUserMemo } from '../services/userMemo';
import {
  formatAmountManwon,
  getInvestmentMarketSummary,
  type InvestmentMarketSummary,
} from '../services/investmentMarket';
import { StitchBuildingPanel } from '../features/stitch/components/StitchBuildingPanel';

type MapStatus = 'loading' | 'ready' | 'missing-key' | 'error';
type MarketStatus = 'idle' | 'loading' | 'ready' | 'error';
type FacilityKey = 'all' | 'kids' | 'school' | 'crosswalk' | 'signal' | 'cctv' | 'risk';
type ActiveFacilityKey = Exclude<FacilityKey, 'all'>;
type MapView = 'life' | 'condition';
type ConditionCategory = 'school' | 'park' | 'childcare' | 'hospital';
type ConditionDestination = {
  id: string;
  name: string;
  category: ConditionCategory;
  latitude: number;
  longitude: number;
  address?: string | null;
  minutes: number;
  distance: number;
  crosswalks: number;
  signals: number;
  cctv: number;
};
type ConditionDestinationCluster = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  count: number;
  destinations: ConditionDestination[];
};
type RouteSafetyMarker = {
  id: string;
  category: 'crosswalk' | 'signal' | 'cctv';
  name: string;
  latitude: number;
  longitude: number;
  count?: number;
};
type WalkingRouteStatus = 'idle' | 'loading' | 'ready' | 'not-found' | 'error';

function supportsStoredWalkingRoute(category: ConditionCategory) {
  return category === 'school' || category === 'childcare' || category === 'park';
}

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
};

type MarkerInstance = {
  setMap: (map: MapInstance | null) => void;
  setIcon?: (icon: { content: string; anchor?: unknown }) => void;
  setPosition?: (position: unknown) => void;
  setZIndex?: (zIndex: number) => void;
};

type PolylineInstance = {
  setMap: (map: MapInstance | null) => void;
};

type NaverMapsEvent = {
  addListener: (
    target: MarkerInstance | MapInstance,
    eventName: string,
    listener: (event?: { stop?: () => void }) => void,
  ) => void;
  trigger?: (target: MapInstance, eventName: string) => void;
};

type DisplayMarker = {
  id: string;
  category: ActiveFacilityKey;
  name: string;
  latitude: number;
  longitude: number;
  count: number;
  features: MapFeature[];
};
type ActiveMapFeature = MapFeature & { category: ActiveFacilityKey };
type ApartmentDisplayMarker = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  count: number;
  apartments: ApartmentSummary[];
};
type ComparisonFeatureSet = {
  apartmentId: string;
  features: MapFeature[];
};

const facilityCategoryKeys: ActiveFacilityKey[] = ['kids', 'school', 'crosswalk', 'signal', 'cctv', 'risk'];
const conditionFacilityCategoryKeys: FacilityCategory[] = ['school', 'kids', 'park', 'hospital', 'crosswalk', 'signal', 'cctv'];
const defaultActiveFilters: ActiveFacilityKey[] = ['kids', 'school'];
const nearbyRadiusM = 1000;
const compareMetricOrder: ActiveFacilityKey[] = ['kids', 'school', 'crosswalk', 'signal', 'cctv', 'risk'];
const compareSectionLabels: Record<string, string> = {
  education: '교육·돌봄',
  walking: '보행 안전',
  safety: '생활 안전',
  overall: '종합',
};
const conditionParkRadiusM = 3000;
// Used for pre-selection estimates. A selected stored route provides its own
// tighter, precomputed safety-match threshold.
const routeSafetyProximityMeters = 100;
function getSavedConditionState() {
  try {
    const saved = window.sessionStorage.getItem('whyhouse:condition-map');
    if (!saved) return null;
    return JSON.parse(saved) as { destinationId?: string; conditionStep?: 'select' | 'route'; visibleCategories?: ConditionCategory[] };
  } catch {
    return null;
  }
}

function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function distanceToRoute(feature: MapFeature, route: Array<{ latitude: number; longitude: number }>) {
  return Math.min(...route.slice(0, -1).map((point, index) => {
    const next = route[index + 1];
    return Math.min(...Array.from({ length: 11 }, (_, sample) => {
      const ratio = sample / 10;
      return distanceMeters(feature.latitude, feature.longitude, point.latitude + (next.latitude - point.latitude) * ratio, point.longitude + (next.longitude - point.longitude) * ratio);
    }));
  }));
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
}

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

const conditionCategoryMeta: Record<ConditionCategory, { label: string; icon: string }> = {
  school: { label: '학교', icon: '🏫' },
  park: { label: '공원', icon: '🌳' },
  childcare: { label: '유치원·어린이집', icon: '🧸' },
  hospital: { label: '병원', icon: '🏥' },
};

const clusterMergeDistancePx = 49;
const conditionClusterMergeDistancePx = 118;
const sameCrosswalkMergeDistanceMeters = 35;
const routeCctvMarkerSizePx = 38;
const routeCctvClusterOverlapRatio = 0.4;
const routeCctvClusterDistancePx = routeCctvMarkerSizePx * (1 - routeCctvClusterOverlapRatio);

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
        Polyline: new (options: {
          map?: MapInstance | null;
          path: unknown[];
          strokeColor?: string;
          strokeWeight?: number;
          strokeOpacity?: number;
        }) => PolylineInstance;
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

function getMarkerIcon(labelOrIcon: string, color: string, variant: 'home' | 'facility', imageUrl?: string) {
  if (variant === 'home' && imageUrl) {
    return {
      content: `
        <span class="map-character-pin" style="--pin-color: ${color}">
          <img alt="집" src="${imageUrl}" />
        </span>
      `,
      anchor: window.naver ? new window.naver.maps.Point(37, 74) : undefined,
    };
  }

  return {
    content: `
      <span class="map-pin map-pin--${variant}" style="--pin-color: ${color}">
        <span>${labelOrIcon}</span>
      </span>
    `,
    anchor: window.naver ? new window.naver.maps.Point(21, 44) : undefined,
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

function getRouteSafetyMarkerIcon(feature: RouteSafetyMarker) {
  const icon = feature.category === 'crosswalk' ? '🚸' : feature.category === 'signal' ? '🚦' : '📹';
  const className = feature.category === 'cctv' ? 'map-pin map-pin--facility route-cctv-pin' : 'map-pin map-pin--facility';
  const count = feature.count ?? 1;

  return {
    content: `
      <span class="${className}" style="--pin-color: ${facilityColors[feature.category]};">
        <span>${icon}</span>
        ${feature.category === 'cctv' && count > 1 ? `<em>${count}</em>` : ''}
      </span>
    `,
    anchor: window.naver ? new window.naver.maps.Point(21, 44) : undefined,
  };
}

function getConditionClusterIcon(cluster: ConditionDestinationCluster) {
  const primaryDestination = cluster.destinations[0];
  const primaryMeta = conditionCategoryMeta[primaryDestination.category];
  const categorySummary = Array.from(new Set(cluster.destinations.map((destination) => conditionCategoryMeta[destination.category].label))).join(' · ');

  return {
    content: `
      <button class="condition-cluster-label" type="button" aria-label="${cluster.count}개 목적지 보기">
        <span>${primaryMeta.icon}</span>
        <b>${cluster.count}개 후보</b>
        <small>${escapeHtml(categorySummary)} · 가까운 후보 ${primaryDestination.minutes}분</small>
      </button>
    `,
    anchor: window.naver ? new window.naver.maps.Point(82, 28) : undefined,
  };
}

function filterApartmentSuggestions(apartments: ApartmentSummary[] | undefined, term: string, limit: number) {
  if (!apartments) {
    return [];
  }
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

function getApartmentMarkerIcon(marker: ApartmentDisplayMarker) {
  if (marker.count > 1) {
    return getClusterMarkerIcon(marker.count);
  }

  const apartment = marker.apartments[0];
  return {
    content: `
      <button class="apartment-map-pin" type="button" aria-label="${escapeHtml(apartment.name)} 선택">
        <span aria-hidden="true">🏢</span>
      </button>
    `,
    anchor: window.naver ? new window.naver.maps.Point(21, 44) : undefined,
  };
}

function getComparisonApartmentMarkerIcon(apartment: ApartmentSummary, index: number) {
  return {
    content: `
      <button class="comparison-apartment-pin" type="button" aria-label="${escapeHtml(apartment.name)} 비교 아파트">
        <span aria-hidden="true">🏢</span>
        <b>${index + 1}</b>
      </button>
    `,
    anchor: window.naver ? new window.naver.maps.Point(26, 52) : undefined,
  };
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

function isActiveFacilityCategory(category: FacilityCategory): category is ActiveFacilityKey {
  return facilityCategoryKeys.includes(category as ActiveFacilityKey);
}

function isActiveMapFeature(feature: MapFeature): feature is ActiveMapFeature {
  return isActiveFacilityCategory(feature.category);
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

function mergeApartmentMarkersByOverlap(markers: ApartmentDisplayMarker[], zoom: number) {
  const merged: ApartmentDisplayMarker[] = [];

  for (const marker of markers) {
    const markerPixel = projectMarkerToPixel(marker.latitude, marker.longitude, zoom);
    const targetIndex = merged.findIndex((candidate) => {
      const candidatePixel = projectMarkerToPixel(candidate.latitude, candidate.longitude, zoom);
      const distance = Math.hypot(markerPixel.x - candidatePixel.x, markerPixel.y - candidatePixel.y);
      return distance <= clusterMergeDistancePx;
    });

    if (targetIndex === -1) {
      merged.push(marker);
      continue;
    }

    const target = merged[targetIndex];
    const apartments = [...target.apartments, ...marker.apartments];
    const count = target.count + marker.count;
    merged[targetIndex] = {
      id: `${target.id}:${marker.id}`,
      name: `${count}개 단지`,
      latitude: (target.latitude * target.count + marker.latitude * marker.count) / count,
      longitude: (target.longitude * target.count + marker.longitude * marker.count) / count,
      count,
      apartments,
    };
  }

  return merged;
}

function getApartmentDisplayMarkers(apartments: ApartmentSummary[], zoom: number): ApartmentDisplayMarker[] {
  const gridMeters = getClusterGridMeters(zoom);
  if (gridMeters === 0) {
    return apartments.map((apartment) => ({
      id: apartment.id,
      name: apartment.name,
      latitude: apartment.latitude,
      longitude: apartment.longitude,
      count: 1,
      apartments: [apartment],
    }));
  }

  const buckets = new Map<string, ApartmentSummary[]>();
  for (const apartment of apartments) {
    const latGrid = gridMeters / 111320;
    const lngGrid = gridMeters / (111320 * Math.cos((apartment.latitude * Math.PI) / 180));
    const latKey = Math.round(apartment.latitude / latGrid);
    const lngKey = Math.round(apartment.longitude / lngGrid);
    const key = `${latKey}:${lngKey}`;
    buckets.set(key, [...(buckets.get(key) ?? []), apartment]);
  }

  const markers = Array.from(buckets.entries()).map(([key, bucket]) => {
    const latitude = bucket.reduce((sum, apartment) => sum + apartment.latitude, 0) / bucket.length;
    const longitude = bucket.reduce((sum, apartment) => sum + apartment.longitude, 0) / bucket.length;
    return {
      id: key,
      name: bucket.length > 1 ? `${bucket.length}개 단지` : bucket[0].name,
      latitude,
      longitude,
      count: bucket.length,
      apartments: bucket,
    };
  });

  return mergeApartmentMarkersByOverlap(markers, zoom);
}

function getDisplayMarkers(features: MapFeature[], zoom: number): DisplayMarker[] {
  const visibleFeatures = features.filter(isActiveMapFeature);

  if (visibleFeatures.some((feature) => feature.source === 'cluster')) {
    const markers = visibleFeatures.filter((feature) => zoom < 17 || feature.source !== 'cluster').map((feature) => {
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
    return visibleFeatures.map((feature) => ({
      id: feature.id,
      category: feature.category,
      name: feature.name,
      latitude: feature.latitude,
      longitude: feature.longitude,
      count: 1,
      features: [feature],
    }));
  }

  const buckets = new Map<string, ActiveMapFeature[]>();
  for (const feature of visibleFeatures) {
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

function getConditionDestinationClusters(destinations: ConditionDestination[], zoom: number): ConditionDestinationCluster[] {
  if (zoom >= 18) {
    return destinations.map((destination) => ({
      id: destination.id,
      name: destination.name,
      latitude: destination.latitude,
      longitude: destination.longitude,
      count: 1,
      destinations: [destination],
    }));
  }

  const clusters: ConditionDestinationCluster[] = [];
  for (const destination of destinations) {
    const destinationPixel = projectMarkerToPixel(destination.latitude, destination.longitude, zoom);
    const targetIndex = clusters.findIndex((cluster) => {
      const clusterPixel = projectMarkerToPixel(cluster.latitude, cluster.longitude, zoom);
      const distance = Math.hypot(destinationPixel.x - clusterPixel.x, destinationPixel.y - clusterPixel.y);
      return distance <= conditionClusterMergeDistancePx;
    });

    if (targetIndex === -1) {
      clusters.push({
        id: destination.id,
        name: destination.name,
        latitude: destination.latitude,
        longitude: destination.longitude,
        count: 1,
        destinations: [destination],
      });
      continue;
    }

    const target = clusters[targetIndex];
    const destinationsInCluster = [...target.destinations, destination];
    clusters[targetIndex] = {
      id: destinationsInCluster.map((item) => item.id).join(':'),
      name: `${destinationsInCluster.length}개 목적지`,
      latitude: destinationsInCluster.reduce((sum, item) => sum + item.latitude, 0) / destinationsInCluster.length,
      longitude: destinationsInCluster.reduce((sum, item) => sum + item.longitude, 0) / destinationsInCluster.length,
      count: destinationsInCluster.length,
      destinations: destinationsInCluster,
    };
  }

  return clusters.map((cluster) => ({
    ...cluster,
    destinations: [...cluster.destinations].sort((a, b) => a.distance - b.distance),
  }));
}

function mergeDuplicateCrosswalkMarkers(markers: RouteSafetyMarker[]): RouteSafetyMarker[] {
  const merged: RouteSafetyMarker[] = [];

  for (const marker of markers) {
    if (marker.category !== 'crosswalk') {
      merged.push(marker);
      continue;
    }

    const duplicateIndex = merged.findIndex((candidate) =>
      candidate.category === 'crosswalk'
      && distanceMeters(candidate.latitude, candidate.longitude, marker.latitude, marker.longitude) <= sameCrosswalkMergeDistanceMeters,
    );

    if (duplicateIndex === -1) {
      merged.push(marker);
      continue;
    }

    const duplicate = merged[duplicateIndex];
    merged[duplicateIndex] = {
      ...duplicate,
      id: `${duplicate.id}:${marker.id}`,
      latitude: (duplicate.latitude + marker.latitude) / 2,
      longitude: (duplicate.longitude + marker.longitude) / 2,
    };
  }

  return merged;
}

function mergeOverlappingRouteCctvMarkers(markers: RouteSafetyMarker[], zoom: number): RouteSafetyMarker[] {
  const merged: RouteSafetyMarker[] = [];

  for (const marker of markers) {
    if (marker.category !== 'cctv') {
      merged.push(marker);
      continue;
    }

    const markerPoint = projectMarkerToPixel(marker.latitude, marker.longitude, zoom);
    const clusterIndex = merged.findIndex((candidate) => {
      if (candidate.category !== 'cctv') {
        return false;
      }

      const candidatePoint = projectMarkerToPixel(candidate.latitude, candidate.longitude, zoom);
      const distance = Math.hypot(markerPoint.x - candidatePoint.x, markerPoint.y - candidatePoint.y);
      return distance <= routeCctvClusterDistancePx;
    });

    if (clusterIndex === -1) {
      merged.push({ ...marker, count: marker.count ?? 1 });
      continue;
    }

    const cluster = merged[clusterIndex];
    const clusterCount = cluster.count ?? 1;
    const markerCount = marker.count ?? 1;
    const nextCount = clusterCount + markerCount;

    merged[clusterIndex] = {
      ...cluster,
      id: `${cluster.id}:${marker.id}`,
      name: `${nextCount}개 CCTV`,
      latitude: ((cluster.latitude * clusterCount) + (marker.latitude * markerCount)) / nextCount,
      longitude: ((cluster.longitude * clusterCount) + (marker.longitude * markerCount)) / nextCount,
      count: nextCount,
    };
  }

  return merged;
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
  const apartmentSelectionZoomRef = useRef<number | null>(null);
  const apartmentOptionMarkerRefs = useRef<MarkerInstance[]>([]);
  const comparisonApartmentMarkerRefs = useRef<MarkerInstance[]>([]);
  const facilityMarkerRefs = useRef<Array<{ marker: MarkerInstance; item: DisplayMarker }>>([]);
  const conditionMarkerRefs = useRef<MarkerInstance[]>([]);
  const walkingRoutePolylineRef = useRef<PolylineInstance | null>(null);
  const walkingRouteRequestIdRef = useRef(0);
  const savedDestinationIdRef = useRef(getSavedConditionState()?.destinationId);
  const defaultApartmentOptionsRef = useRef<ApartmentSummary[]>([]);
  const [status, setStatus] = useState<MapStatus>(() =>
    env.naverMapsClientId ? 'loading' : 'missing-key',
  );
  const [dataStatus, setDataStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [apartmentOptions, setApartmentOptions] = useState<ApartmentSummary[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [compareDockOpen, setCompareDockOpen] = useState(false);
  const [selectedApartment, setSelectedApartment] = useState<ApartmentSummary | null>(null);
  const [buildingDetail, setBuildingDetail] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'error';
    pnu?: string;
    buildingName?: string | null;
    message?: string;
  }>({ status: 'idle' });
  const [searchTerm, setSearchTerm] = useState('');
  const [topSearchOpen, setTopSearchOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<ActiveFacilityKey[]>(defaultActiveFilters);
  const [animatedFilter, setAnimatedFilter] = useState<FacilityKey | null>(null);
  const [selectedFacility, setSelectedFacility] = useState<MapFeature | null>(null);
  const [previewApartment, setPreviewApartment] = useState<ApartmentSummary | null>(null);
  const [compareSummary, setCompareSummary] = useState<FeatureSummary[]>([]);
  const [comparisonApartments, setComparisonApartments] = useState<ApartmentSummary[]>([]);
  const [comparisonSelectMode, setComparisonSelectMode] = useState(false);
  const [compareResultOpen, setCompareResultOpen] = useState(false);
  const [compareResult, setCompareResult] = useState<ApartmentCompareResponse | null>(null);
  const [compareResultStatus, setCompareResultStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [comparisonFeatureSets, setComparisonFeatureSets] = useState<ComparisonFeatureSet[]>([]);
  const [mapEvidenceMetric, setMapEvidenceMetric] = useState<ActiveFacilityKey | null>(null);
  const [currentZoom, setCurrentZoom] = useState(14);
  const [mapView, setMapView] = useState<MapView>('life');
  const [conditionStep, setConditionStep] = useState<'select' | 'route'>('select');
  const [selectedDestination, setSelectedDestination] = useState<ConditionDestination | null>(null);
  const [selectedConditionCluster, setSelectedConditionCluster] = useState<ConditionDestinationCluster | null>(null);
  const [selectedSchoolRoute, setSelectedSchoolRoute] = useState<WalkingRoute | null>(null);
  const [walkingRouteStatus, setWalkingRouteStatus] = useState<WalkingRouteStatus>('idle');
  const [conditionFeatures, setConditionFeatures] = useState<MapFeature[]>([]);
  const [visibleConditionCategories, setVisibleConditionCategories] = useState<ConditionCategory[]>(() => getSavedConditionState()?.visibleCategories ?? ['school', 'childcare', 'park', 'hospital']);
  const [destinationMenuOpen, setDestinationMenuOpen] = useState(false);
  const [memoContent, setMemoContent] = useState('');
  const [memoStatus, setMemoStatus] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('idle');

  const { session } = useAuth();
  const userId = session?.user?.id;

  useEffect(() => {
    setBuildingDetail({ status: 'idle' });
  }, [selectedApartment?.id]);

  const openBuildingDetail = async () => {
    if (!selectedApartment || buildingDetail.status === 'loading') return;
    setBuildingDetail({ status: 'loading' });
    try {
      const resolved = await resolveApartmentPnu(selectedApartment);
      setBuildingDetail({
        status: 'ready',
        pnu: resolved.pnu,
        buildingName: resolved.buildingName,
      });
    } catch (error) {
      setBuildingDetail({
        status: 'error',
        message: error instanceof ApiRequestError && error.status === 404
          ? '이 주소와 연결된 실거래 건축물을 찾지 못했습니다.'
          : '건축물 연결 정보를 불러오지 못했습니다.',
      });
    }
  };

  useEffect(() => {
    if (!userId) {
      return;
    }

    let cancelled = false;
    setMemoStatus('loading');
    getUserMemo(userId)
      .then((content) => {
        if (!cancelled) {
          setMemoContent(content);
          setMemoStatus('idle');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMemoStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  function handleSaveMemo() {
    if (!userId) {
      return;
    }
    setMemoStatus('saving');
    saveUserMemo(userId, memoContent)
      .then(() => setMemoStatus('saved'))
      .catch(() => setMemoStatus('error'));
  }

  const [conditionNoteReady, setConditionNoteReady] = useState(false);
  const [noteGateMessage, setNoteGateMessage] = useState('');
  const [marketStatus, setMarketStatus] = useState<MarketStatus>('idle');
  const [marketSummary, setMarketSummary] = useState<InvestmentMarketSummary | null>(null);

  const activeCategories = useMemo(() => getActiveCategories(activeFilters), [activeFilters]);
  const evidenceFeatures = useMemo(() => {
    if (!mapEvidenceMetric) {
      return conditionFeatures;
    }
    return [
      ...conditionFeatures,
      ...comparisonFeatureSets.flatMap((set) => set.features),
    ];
  }, [comparisonFeatureSets, conditionFeatures, mapEvidenceMetric]);
  const features = useMemo(
    () => evidenceFeatures.filter((feature) => activeCategories.includes(feature.category)),
    [activeCategories, evidenceFeatures],
  );
  const summary = useMemo(
    () => compareSummary.filter((item) => activeCategories.includes(item.category)),
    [activeCategories, compareSummary],
  );
  const topApartmentSuggestions = useMemo(
    () => filterApartmentSuggestions(
      comparisonSelectMode
        ? apartmentOptions.filter((apartment) =>
          apartment.id !== selectedApartment?.id
          && !comparisonApartments.some((target) => target.id === apartment.id),
        )
        : apartmentOptions,
      searchTerm,
      12,
    ),
    [apartmentOptions, comparisonApartments, comparisonSelectMode, searchTerm, selectedApartment],
  );
  const sidebarApartmentSuggestions = useMemo(
    () => filterApartmentSuggestions(
      comparisonSelectMode
        ? apartmentOptions.filter((apartment) =>
          apartment.id !== selectedApartment?.id
          && !comparisonApartments.some((target) => target.id === apartment.id),
        )
        : apartmentOptions,
      searchTerm,
      12,
    ),
    [apartmentOptions, comparisonApartments, comparisonSelectMode, searchTerm, selectedApartment],
  );
  const apartmentMarkerOptions = useMemo(
    () => comparisonSelectMode
      ? apartmentOptions.filter((apartment) =>
        apartment.id !== selectedApartment?.id
        && !comparisonApartments.some((target) => target.id === apartment.id),
      )
      : apartmentOptions,
    [apartmentOptions, comparisonApartments, comparisonSelectMode, selectedApartment],
  );
  const safeApartmentOptions = apartmentOptions ?? [];
  const sidebarApartmentOptions = safeApartmentOptions.slice(0, 3);
  const compareApartmentOptions = safeApartmentOptions.filter((apartment) => apartment.id !== selectedApartment?.id).slice(0, 5);
  const summaryItems = useMemo(() => getFeatureSummaryItems(compareSummary), [compareSummary]);
  const displayMarkers = useMemo(() => getDisplayMarkers(features, currentZoom), [features, currentZoom]);
  const apartmentDisplayMarkers = useMemo(
    () => getApartmentDisplayMarkers(apartmentMarkerOptions, currentZoom),
    [apartmentMarkerOptions, currentZoom],
  );
  const conditionCandidates = useMemo(() => {
    if (!selectedApartment) return [];
    const candidates = conditionFeatures.filter((feature) =>
      feature.category === 'school'
      || feature.category === 'park'
      || feature.category === 'hospital'
      || (feature.category === 'kids' && feature.source === 'education_care'),
    );
    const destinations = candidates.map((feature) => {
      const category: ConditionCategory =
        feature.category === 'school' ? 'school'
          : feature.category === 'park' ? 'park'
            : feature.category === 'hospital' ? 'hospital'
              : 'childcare';
      const directDistance = distanceMeters(selectedApartment.latitude, selectedApartment.longitude, feature.latitude, feature.longitude);
      const route = [
        { latitude: selectedApartment.latitude, longitude: selectedApartment.longitude },
        { latitude: selectedApartment.latitude, longitude: feature.longitude },
        { latitude: feature.latitude, longitude: feature.longitude },
      ];
      const routeDistance = distanceMeters(route[0].latitude, route[0].longitude, route[1].latitude, route[1].longitude) + distanceMeters(route[1].latitude, route[1].longitude, route[2].latitude, route[2].longitude);
      const routeSignals = conditionFeatures.filter((item) => item.category === 'signal' && distanceToRoute(item, route) <= routeSafetyProximityMeters);
      const routeCrosswalks = conditionFeatures.filter((item) => item.category === 'crosswalk' && distanceToRoute(item, route) <= routeSafetyProximityMeters && !routeSignals.some((signal) => distanceMeters(item.latitude, item.longitude, signal.latitude, signal.longitude) <= 25));
      const routeCctv = conditionFeatures.filter((item) => item.category === 'cctv' && distanceToRoute(item, route) <= routeSafetyProximityMeters);
      const estimatedDistance = Math.round(Math.max(directDistance, routeDistance));
      const storedWalkingDistance = feature.walking_distance_m;
      const storedWalkingTime = feature.walking_time_min;
      return {
        id: feature.id,
        name: feature.name,
        category,
        latitude: feature.latitude,
        longitude: feature.longitude,
        address: feature.address,
        distance: typeof storedWalkingDistance === 'number' && Number.isFinite(storedWalkingDistance) ? Math.round(storedWalkingDistance) : estimatedDistance,
        minutes: typeof storedWalkingTime === 'number' && Number.isFinite(storedWalkingTime)
          ? Math.max(1, Math.ceil(storedWalkingTime))
          : Math.max(1, Math.ceil(estimatedDistance / 75)),
        signals: routeSignals.length,
        crosswalks: routeCrosswalks.length,
        cctv: routeCctv.length,
      };
    });

    // Medical facilities can be densely clustered. Keep the nearest choices
    // per condition type so parks and schools are not pushed out by hospitals.
    return (Object.keys(conditionCategoryMeta) as ConditionCategory[])
      .flatMap((category) => destinations
        .filter((destination) => destination.category === category)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 6))
      .sort((a, b) => a.distance - b.distance);
  }, [conditionFeatures, selectedApartment]);
  const visibleConditionCandidates = useMemo(
    () => selectedDestination
      ? conditionCandidates.filter((item) => item.id === selectedDestination.id)
      : conditionCandidates.filter((item) => visibleConditionCategories.includes(item.category)),
    [conditionCandidates, selectedDestination, visibleConditionCategories],
  );
  const conditionDestinationClusters = useMemo(
    () => getConditionDestinationClusters(visibleConditionCandidates, currentZoom),
    [currentZoom, visibleConditionCandidates],
  );
  const selectedWalkingRoute = useMemo(
    () => selectedDestination && supportsStoredWalkingRoute(selectedDestination.category) ? selectedSchoolRoute : null,
    [selectedDestination, selectedSchoolRoute],
  );
  const selectedRouteSafetyFeatures = useMemo<RouteSafetyMarker[]>(() => {
    if (!selectedWalkingRoute || selectedWalkingRoute.routeCoordinates.length < 2) {
      return [];
    }

    const route = selectedWalkingRoute.routeCoordinates.map(([longitude, latitude]) => ({ latitude, longitude }));
    const safetyThresholdMeters = selectedWalkingRoute.safetyMatchThresholdMeters ?? routeSafetyProximityMeters;
    const routeCctvMarkers = conditionFeatures
      .filter((feature): feature is MapFeature & { category: 'cctv' } => (
        feature.category === 'cctv'
        && distanceToRoute(feature, route) <= safetyThresholdMeters
      ))
      .map((feature) => ({
        id: feature.id,
        category: 'cctv' as const,
        name: feature.name,
        latitude: feature.latitude,
        longitude: feature.longitude,
      }));

    if (Array.isArray(selectedWalkingRoute.crossingEvents)) {
      return mergeOverlappingRouteCctvMarkers(mergeDuplicateCrosswalkMarkers([
        ...selectedWalkingRoute.crossingEvents.flatMap((event) => [
          {
            id: `crosswalk:${event.crosswalkEventId}`,
            category: 'crosswalk' as const,
            name: '실제 통과 횡단보도',
            latitude: event.latitude,
            longitude: event.longitude,
          },
          ...event.pedestrianSignals.map((signal) => ({
            id: `signal:${signal.id}`,
            category: 'signal' as const,
            name: '실제 통과 횡단보도 보행신호',
            latitude: signal.latitude,
            longitude: signal.longitude,
          })),
        ]),
        ...routeCctvMarkers,
      ]), currentZoom);
    }

    return mergeOverlappingRouteCctvMarkers(mergeDuplicateCrosswalkMarkers(conditionFeatures
      .filter((feature): feature is MapFeature & { category: 'crosswalk' | 'signal' | 'cctv' } => (
        (feature.category === 'crosswalk' || feature.category === 'signal' || feature.category === 'cctv')
        && distanceToRoute(feature, route) <= safetyThresholdMeters
      ))
      .map((feature) => ({
        id: feature.id,
        category: feature.category,
        name: feature.name,
        latitude: feature.latitude,
        longitude: feature.longitude,
      }))), currentZoom);
  }, [conditionFeatures, currentZoom, selectedWalkingRoute]);
  const selectedDestinationCrosswalks = selectedWalkingRoute
    ? selectedWalkingRoute.crosswalkCount ?? selectedRouteSafetyFeatures.filter((feature) => feature.category === 'crosswalk').length
    : selectedDestination?.crosswalks;
  const selectedDestinationSignals = selectedWalkingRoute
    ? selectedWalkingRoute.pedestrianSignalCount ?? selectedRouteSafetyFeatures.filter((feature) => feature.category === 'signal').length
    : selectedDestination?.signals;
  const selectedDestinationCctv = selectedWalkingRoute
    ? selectedWalkingRoute.cctvLocationCount ?? selectedDestination?.cctv
    : selectedDestination?.cctv;
  const selectedRouteSafetyMessage = selectedWalkingRoute
    && walkingRouteStatus === 'ready'
    && selectedRouteSafetyFeatures.length === 0
    ? '이 경로에는 표시할 횡단보도·보행신호·CCTV 데이터가 없습니다.'
    : null;
  const selectedDestinationDistance = selectedWalkingRoute
    ? Math.round(selectedWalkingRoute.walkDistanceMeters)
    : selectedDestination?.distance;
  const selectedDestinationMinutes = selectedWalkingRoute
    ? Math.max(1, Math.ceil(selectedWalkingRoute.walkTimeMinutes))
    : selectedDestination?.minutes;
  const walkingRouteMessage = walkingRouteStatus === 'loading'
    ? '보행 경로를 불러오는 중입니다.'
    : walkingRouteStatus === 'not-found'
      ? '이 시설의 저장된 보행 경로가 없습니다.'
      : walkingRouteStatus === 'error'
        ? '보행 경로를 불러오지 못했습니다. 다시 선택해 주세요.'
        : null;

  useEffect(() => {
    window.sessionStorage.setItem('whyhouse:condition-map', JSON.stringify({
      destinationId: selectedDestination?.id,
      conditionStep,
      visibleCategories: visibleConditionCategories,
      lastUpdatedAt: Date.now(),
    }));
  }, [conditionStep, selectedDestination, visibleConditionCategories]);

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
          zoom: 14,
          zoomControl: false,
          scaleControl: true,
          scaleControlOptions: {
            position: window.naver.maps.Position.BOTTOM_RIGHT,
          },
          mapDataControl: true,
        });

        mapRef.current = map;
        setCurrentZoom(map.getZoom?.() ?? 14);
        window.naver.maps.Event.addListener(map, 'idle', () => {
          const zoom = map.getZoom?.() ?? 17;
          setCurrentZoom(zoom);
        });
        window.naver.maps.Event.addListener(map, 'click', () => {
          setSelectedFacility(null);
          setPreviewApartment(null);
          setSelectedConditionCluster(null);
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
    let cancelled = false;
    setDataStatus('loading');
    searchApartments('', 1000)
      .then((items) => {
        if (cancelled) {
          return;
        }
        setApartmentOptions(items);
        defaultApartmentOptionsRef.current = items;
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
    apartmentOptionMarkerRefs.current.forEach((marker) => marker.setMap(null));
    apartmentOptionMarkerRefs.current = [];

    if (!map || !window.naver?.maps || (selectedApartment && !comparisonSelectMode)) {
      return;
    }

    apartmentOptionMarkerRefs.current = apartmentDisplayMarkers.map((item) => {
      const marker = new window.naver!.maps.Marker({
        position: new window.naver!.maps.LatLng(item.latitude, item.longitude),
        map,
        title: item.name,
        icon: getApartmentMarkerIcon(item),
        zIndex: item.count > 1 ? 85 : 80,
      });
      window.naver!.maps.Event.addListener(marker, 'click', () => {
        if (item.count === 1) {
          previewApartmentOnMap(item.apartments[0], comparisonSelectMode ? 'compare' : 'base');
          return;
        }

        map.setCenter?.(new window.naver!.maps.LatLng(item.latitude, item.longitude));
        map.setZoom?.(Math.min((map.getZoom?.() ?? currentZoom) + 1, 19));
      });
      return marker;
    });

    return () => {
      apartmentOptionMarkerRefs.current.forEach((marker) => marker.setMap(null));
      apartmentOptionMarkerRefs.current = [];
    };
  }, [apartmentDisplayMarkers, comparisonSelectMode, currentZoom, selectedApartment, status]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.naver?.maps) {
      return;
    }

    const triggerResize = () => window.naver?.maps.Event.trigger?.(map, 'resize');
    const timers = [0, 120, 300, 520].map((delay) => window.setTimeout(triggerResize, delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [compareDockOpen, sidebarOpen, selectedApartment?.id]);

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
      setConditionFeatures([]);
      setComparisonFeatureSets([]);
      setMapEvidenceMetric(null);
      setDataStatus('idle');
      return;
    }

    let cancelled = false;
    setDataStatus('loading');
    Promise.all([
      getNearbyFeatures(selectedApartment.id, conditionFacilityCategoryKeys, nearbyRadiusM),
      getNearbyFeatures(selectedApartment.id, ['park'], conditionParkRadiusM),
    ])
      .then(([nearbyResult, parkResult]) => {
        if (!cancelled) {
          const nonParkFeatures = nearbyResult.features.filter((feature) => feature.category !== 'park');
          setCompareSummary(nearbyResult.summary);
          setConditionFeatures([...nonParkFeatures, ...parkResult.features.filter((feature) => feature.category === 'park')]);
          setDataStatus('idle');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCompareSummary([]);
          setConditionFeatures([]);
          setDataStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedApartment?.id]);

  useEffect(() => {
    const map = mapRef.current;
    comparisonApartmentMarkerRefs.current.forEach((marker) => marker.setMap(null));
    comparisonApartmentMarkerRefs.current = [];

    if (!map || !window.naver?.maps || mapView !== 'life' || comparisonApartments.length === 0) {
      return;
    }

    comparisonApartmentMarkerRefs.current = comparisonApartments.map((apartment, index) => {
      const marker = new window.naver!.maps.Marker({
        position: new window.naver!.maps.LatLng(apartment.latitude, apartment.longitude),
        map,
        title: apartment.name,
        icon: getComparisonApartmentMarkerIcon(apartment, index),
        zIndex: 9000 + index,
      });
      window.naver!.maps.Event.addListener(marker, 'click', (event?: { stop?: () => void }) => {
        event?.stop?.();
        previewApartmentOnMap(apartment, 'compare');
      });
      return marker;
    });

    return () => {
      comparisonApartmentMarkerRefs.current.forEach((marker) => marker.setMap(null));
      comparisonApartmentMarkerRefs.current = [];
    };
  }, [comparisonApartments, mapView, status]);

  useEffect(() => {
    if (!mapEvidenceMetric || comparisonApartments.length === 0) {
      setComparisonFeatureSets([]);
      return;
    }

    let cancelled = false;
    setDataStatus('loading');
    Promise.all(
      comparisonApartments.map((apartment) =>
        getNearbyFeatures(apartment.id, [mapEvidenceMetric], nearbyRadiusM)
          .then((result) => ({
            apartmentId: apartment.id,
            features: result.features,
          })),
      ),
    )
      .then((sets) => {
        if (!cancelled) {
          setComparisonFeatureSets(sets);
          setDataStatus('idle');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setComparisonFeatureSets([]);
          setDataStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [comparisonApartments, mapEvidenceMetric]);

  useEffect(() => {
    if (!conditionCandidates.length || selectedDestination) return;
    const restored = conditionCandidates.find((item) => item.id === savedDestinationIdRef.current);
    if (restored && getSavedConditionState()?.conditionStep === 'route') {
      setSelectedDestination(restored);
      setConditionStep('route');
    }
    savedDestinationIdRef.current = undefined;
  }, [conditionCandidates, selectedDestination]);

  useEffect(() => {
    const requestId = walkingRouteRequestIdRef.current + 1;
    walkingRouteRequestIdRef.current = requestId;

    if (!selectedApartment || !selectedDestination || !supportsStoredWalkingRoute(selectedDestination.category)) {
      setSelectedSchoolRoute(null);
      setWalkingRouteStatus('idle');
      return;
    }

    let cancelled = false;
    setSelectedSchoolRoute(null);
    setWalkingRouteStatus('loading');
    getWalkingRoute(selectedApartment.id, selectedDestination.id)
      .then((route) => {
        if (!cancelled && walkingRouteRequestIdRef.current === requestId) {
          setSelectedSchoolRoute(route);
          setWalkingRouteStatus('ready');
        }
      })
      .catch((error: unknown) => {
        if (cancelled || walkingRouteRequestIdRef.current !== requestId) {
          return;
        }

        setSelectedSchoolRoute(null);
        if (error instanceof WalkingRouteNotFoundError) {
          setWalkingRouteStatus('not-found');
          return;
        }

        logger.warn('walking_route_request_failed', {
          complexId: selectedApartment.id,
          featureId: selectedDestination.id,
        });
        setWalkingRouteStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [selectedApartment?.id, selectedDestination?.category, selectedDestination?.id]);

  useEffect(() => {
    if (!conditionNoteReady || !selectedApartment) {
      setMarketStatus('idle');
      setMarketSummary(null);
      return;
    }

    let cancelled = false;
    setMarketStatus('loading');
    getInvestmentMarketSummary(selectedApartment.name)
      .then((summary) => {
        if (cancelled) return;
        setMarketSummary(summary);
        setMarketStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setMarketSummary(null);
        setMarketStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [conditionNoteReady, selectedApartment]);

  useEffect(() => {
    const map = mapRef.current;
    walkingRoutePolylineRef.current?.setMap(null);
    walkingRoutePolylineRef.current = null;

    if (!map || !window.naver?.maps || !selectedWalkingRoute) {
      return;
    }

    const path = selectedWalkingRoute.routeCoordinates.map(([longitude, latitude]) =>
      new window.naver!.maps.LatLng(latitude, longitude),
    );
    walkingRoutePolylineRef.current = new window.naver.maps.Polyline({
      map,
      path,
      strokeColor: '#2f6fe4',
      strokeWeight: 5,
      strokeOpacity: 0.85,
    });

    return () => {
      walkingRoutePolylineRef.current?.setMap(null);
      walkingRoutePolylineRef.current = null;
    };
  }, [selectedWalkingRoute, status]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.naver?.maps) {
      return;
    }

    facilityMarkerRefs.current.forEach(({ marker }) => marker.setMap(null));
    if (mapView === 'condition' || !selectedApartment) {
      facilityMarkerRefs.current = [];
      return;
    }
    facilityMarkerRefs.current = displayMarkers.map((item) => {
      const filter = facilityFilters.find((f) => f.key === item.category);
      const icon = filter?.icon ?? '📍';
      const marker = new window.naver!.maps.Marker({
        position: new window.naver!.maps.LatLng(item.latitude, item.longitude),
        map,
        title: item.name,
        icon:
          item.count > 1
            ? getClusterMarkerIcon(item.count)
            : getMarkerIcon(icon, facilityColors[item.category] ?? '#355b4e', 'facility'),
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
  }, [displayMarkers, mapView, selectedApartment]);

  useEffect(() => {
    const map = mapRef.current;
    conditionMarkerRefs.current.forEach((marker) => marker.setMap(null));
    conditionMarkerRefs.current = [];
    if (mapView !== 'condition' || !map || !window.naver?.maps || !selectedApartment) return;

    conditionMarkerRefs.current = conditionDestinationClusters.map((cluster) => {
      if (cluster.count > 1) {
        const marker = new window.naver!.maps.Marker({
          position: new window.naver!.maps.LatLng(cluster.latitude, cluster.longitude),
          map,
          title: cluster.name,
          zIndex: 92,
          icon: getConditionClusterIcon(cluster),
        });
        window.naver!.maps.Event.addListener(marker, 'click', (event?: { stop?: () => void }) => {
          event?.stop?.();
          setSelectedConditionCluster(cluster);
          setSelectedFacility(null);
          setPreviewApartment(null);
        });
        return marker;
      }

      const destination = cluster.destinations[0];
        const isSelected = destination.id === selectedDestination?.id;
        const destinationRoute = isSelected ? selectedWalkingRoute : null;
        const destinationDistance = destinationRoute
          ? Math.round(destinationRoute.walkDistanceMeters)
          : destination.distance;
        const destinationMinutes = destinationRoute
          ? Math.max(1, Math.ceil(destinationRoute.walkTimeMinutes))
          : destination.minutes;
        const marker = new window.naver!.maps.Marker({
          position: new window.naver!.maps.LatLng(destination.latitude, destination.longitude),
          map,
          title: destination.name,
          zIndex: isSelected ? 100 : 90,
          icon: {
            content: `<button class="condition-map-label${isSelected ? ' condition-map-label--selected' : ''}" type="button"><span>${conditionCategoryMeta[destination.category].icon}</span><b>${escapeHtml(destination.name)}</b><small>도보 ${destinationMinutes}분 · ${destinationDistance}m</small></button>`,
            anchor: new window.naver!.maps.Point(82, 28),
          },
        });
        window.naver!.maps.Event.addListener(marker, 'click', () => {
          if (isSelected) {
            resetDestination();
            return;
          }
          setSelectedConditionCluster(null);
          selectDestination(destination);
        });
        return marker;
      });
    return () => {
      conditionMarkerRefs.current.forEach((marker) => marker.setMap(null));
      conditionMarkerRefs.current = [];
    };
  }, [conditionDestinationClusters, conditionStep, mapView, selectedApartment, selectedDestination, selectedWalkingRoute]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.naver?.maps || mapView !== 'condition' || !selectedWalkingRoute) {
      return;
    }

    const markers = selectedRouteSafetyFeatures.map((feature) => new window.naver!.maps.Marker({
      position: new window.naver!.maps.LatLng(feature.latitude, feature.longitude),
      map,
      title: `${feature.category === 'crosswalk' ? '횡단보도' : feature.category === 'signal' ? '보행신호' : 'CCTV'}: ${feature.name}`,
      icon: getRouteSafetyMarkerIcon(feature),
      zIndex: 105,
    }));

    return () => {
      markers.forEach((marker) => marker.setMap(null));
    };
  }, [mapView, selectedRouteSafetyFeatures, selectedWalkingRoute]);

  function selectApartment(apartment: ApartmentSummary) {
    if (selectedApartment?.id === apartment.id) {
      deselectApartment();
      return;
    }

    walkingRouteRequestIdRef.current += 1;
    const isChangingSelection = selectedApartment !== null;
    setSelectedApartment(apartment);
    setSidebarOpen(false);
    setSelectedFacility(null);
    setPreviewApartment(null);
    setComparisonSelectMode(false);
    setSelectedDestination(null);
    setSelectedSchoolRoute(null);
    setWalkingRouteStatus('idle');
    setConditionStep('select');
    setComparisonApartments((current) => current.filter((target) => target.id !== apartment.id));
    setCompareResult(null);
    setCompareResultOpen(false);
    setComparisonFeatureSets([]);
    setMapEvidenceMetric(null);
    setConditionNoteReady(false);
    setNoteGateMessage('');

    const map = mapRef.current;
    if (window.naver?.maps && map) {
      const center = new window.naver.maps.LatLng(apartment.latitude, apartment.longitude);
      map.setCenter?.(center);
      if (!isChangingSelection) {
        const previousZoom = map.getZoom?.() ?? 14;
        apartmentSelectionZoomRef.current = previousZoom;
        map.setZoom?.(previousZoom + 1);
      }
      window.naver.maps.Event.trigger?.(map, 'resize');

      if (!apartmentMarkerRef.current) {
        const selectedMarker = new window.naver.maps.Marker({
          position: center,
          map,
          title: apartment.name,
          icon: getMarkerIcon('집', facilityColors.home, 'home', waezipHomeMarker),
          zIndex: 10000,
        });
        window.naver.maps.Event.addListener(selectedMarker, 'click', (event) => {
          event?.stop?.();
          deselectApartment();
        });
        apartmentMarkerRef.current = selectedMarker;
      } else {
        apartmentMarkerRef.current.setPosition?.(center);
        apartmentMarkerRef.current.setMap(map);
        apartmentMarkerRef.current.setZIndex?.(10000);
      }
    }
  }

  function deselectApartment() {
    walkingRouteRequestIdRef.current += 1;
    setSelectedApartment(null);
    setSelectedFacility(null);
    setPreviewApartment(null);
    setComparisonSelectMode(false);
    setSelectedDestination(null);
    setSelectedSchoolRoute(null);
    setWalkingRouteStatus('idle');
    setConditionStep('select');
    setCompareSummary([]);
    setConditionFeatures([]);
    setComparisonApartments([]);
    setCompareResult(null);
    setCompareResultOpen(false);
    setComparisonFeatureSets([]);
    setMapEvidenceMetric(null);
    apartmentMarkerRef.current?.setMap(null);

    const map = mapRef.current;
    if (map && apartmentSelectionZoomRef.current !== null) {
      map.setZoom?.(apartmentSelectionZoomRef.current);
      apartmentSelectionZoomRef.current = null;
      window.naver?.maps.Event.trigger?.(map, 'resize');
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
    if (selectedApartment) {
      deselectApartment();
    }
    setSidebarOpen(true);
    setSelectedFacility(null);
    setPreviewApartment(null);
    setComparisonSelectMode(false);
    setMapEvidenceMetric(null);
  }

  function resetToApartmentSelectionMap() {
    setSidebarOpen(false);
    setSearchTerm('');
    setTopSearchOpen(false);
    setApartmentOptions(defaultApartmentOptionsRef.current);
    deselectApartment();
  }

  function previewApartmentOnMap(apartment: ApartmentSummary, mode: 'base' | 'compare' = comparisonSelectMode ? 'compare' : 'base') {
    setPreviewApartment(apartment);
    setSelectedFacility(null);
    if (mode === 'compare') {
      setComparisonSelectMode(true);
    }
  }

  function addComparisonApartment(apartment: ApartmentSummary) {
    if (selectedApartment?.id === apartment.id) {
      return;
    }

    setComparisonApartments((current) => {
      if (current.some((target) => target.id === apartment.id) || current.length >= 2) {
        return current;
      }
      return [...current, apartment];
    });
    setComparisonSelectMode(false);
    setPreviewApartment(null);
    setCompareResult(null);
    setCompareResultOpen(false);
    setComparisonFeatureSets([]);
    setMapEvidenceMetric(null);
    setSidebarOpen(false);
    setCompareDockOpen(true);
  }

  function removeComparisonApartment(apartmentId: string) {
    setComparisonApartments((current) => current.filter((target) => target.id !== apartmentId));
    setCompareResult(null);
    setCompareResultOpen(false);
    setComparisonFeatureSets((current) => current.filter((set) => set.apartmentId !== apartmentId));
    setMapEvidenceMetric(null);
  }

  function startComparisonSelection() {
    if (!selectedApartment || comparisonApartments.length >= 2) {
      return;
    }
    setComparisonSelectMode(true);
    setSidebarOpen(false);
    setSelectedFacility(null);
    setPreviewApartment(null);
    setSearchTerm('');
    setApartmentOptions(defaultApartmentOptionsRef.current);
    setMapEvidenceMetric(null);
    setCompareDockOpen(false);
  }

  async function openCompareResult() {
    if (!selectedApartment || comparisonApartments.length === 0) {
      return;
    }
    setCompareResultOpen(true);
    setCompareResultStatus('loading');
    try {
      const result = await compareApartments(
        selectedApartment.id,
        comparisonApartments.map((apartment) => apartment.id),
        nearbyRadiusM,
      );
      setCompareResult(result);
      setCompareResultStatus('idle');
    } catch {
      setCompareResult(null);
      setCompareResultStatus('error');
    }
  }

  function focusMetricOnMap(metricCode: FacilityCategory) {
    if (!facilityCategoryKeys.includes(metricCode as ActiveFacilityKey)) {
      return;
    }
    setMapView('life');
    setSidebarOpen(false);
    setCompareResultOpen(false);
    setActiveFilters([metricCode as ActiveFacilityKey]);
    setMapEvidenceMetric(metricCode as ActiveFacilityKey);
    setComparisonSelectMode(false);
    setPreviewApartment(null);
    setSelectedFacility(null);
    setAnimatedFilter(metricCode as FacilityKey);
    window.setTimeout(() => setAnimatedFilter(null), 420);
  }

  function changeFilter(nextFilter: FacilityKey) {
    if (nextFilter === 'all') {
      setActiveFilters((current) =>
        current.length === facilityCategoryKeys.length
          ? [...defaultActiveFilters]
          : [...facilityCategoryKeys],
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
    setMapEvidenceMetric(null);
    window.setTimeout(() => setAnimatedFilter(null), 420);
  }

  function resetFilters() {
    setActiveFilters([]);
    setAnimatedFilter(null);
    setSelectedFacility(null);
    setMapEvidenceMetric(null);
  }

  function selectSuggestion(apartment: ApartmentSummary) {
    if (comparisonSelectMode && selectedApartment) {
      previewApartmentOnMap(apartment, 'compare');
    } else {
      selectApartment(apartment);
    }
    setSearchTerm('');
    setTopSearchOpen(false);
  }

  function selectDestination(destination: ConditionDestination) {
    setSelectedDestination(destination);
    setSelectedConditionCluster(null);
    setSelectedSchoolRoute(null);
    setWalkingRouteStatus(supportsStoredWalkingRoute(destination.category) ? 'loading' : 'idle');
    setConditionStep('route');
    setDestinationMenuOpen(false);
    setSelectedFacility(null);
  }

  function resetDestination() {
    walkingRouteRequestIdRef.current += 1;
    setSelectedDestination(null);
    setSelectedConditionCluster(null);
    setSelectedSchoolRoute(null);
    setWalkingRouteStatus('idle');
    setConditionStep('select');
  }

  function toggleConditionCategory(category: ConditionCategory) {
    setSelectedConditionCluster(null);
    setVisibleConditionCategories((current) => current.includes(category)
      ? current.filter((item) => item !== category)
      : [...current, category]);
  }

  function openInvestmentNote() {
    if (!selectedApartment) {
      setNoteGateMessage('먼저 아파트를 선택해 주세요.');
      return;
    }

    setNoteGateMessage('');
    onOpenInvestment?.();
  }

  return (
    <section className="family-map-page" aria-label="이집 어때요 생활 지도">
      <header className="family-map-bar">
        <button aria-label="왜집 홈" className="family-map-logo" onClick={onBackHome} type="button">
          <img alt="왜집?" src={waezipLogo} />
        </button>
        <nav className="map-view-tabs" aria-label="지도 종류">
          <button className={mapView === 'life' ? 'is-active' : ''} onClick={() => setMapView('life')} type="button">생활환경 지도</button>
          <button className={mapView === 'condition' ? 'is-active' : ''} onClick={() => { setMapView('condition'); setSidebarOpen(false); setVisibleConditionCategories((current) => Array.from(new Set([...current, 'school', 'childcare', 'park', 'hospital']))); }} type="button">조건 지도</button>
        </nav>
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
        <LoginButton />
      </header>

      <div className={sidebarOpen ? 'map-layout map-layout--sidebar-open' : 'map-layout'}>
        <aside className="apartment-sidebar" aria-label="아파트 선택과 비교">
          <button aria-label="아파트 선택 닫기" className="sidebar-close" onClick={() => setSidebarOpen(false)} type="button">
            ‹
          </button>
          <div className="sidebar-head">
            <span aria-hidden="true">🏢</span>
            <div>
              <b>{comparisonSelectMode ? '비교할 아파트를 선택하세요' : '아파트를 먼저 선택하세요'}</b>
              <small>
                {comparisonSelectMode
                  ? '기준 아파트와 비교할 단지를 검색하거나 지도에서 선택하세요.'
                  : '선택한 아파트가 지도의 기준점이 됩니다.'}
              </small>
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
                placeholder={comparisonSelectMode ? '비교할 아파트 이름을 입력하세요' : '아파트 이름을 입력하세요'}
                value={searchTerm}
              />
            <button type="submit">검색</button>
            {searchTerm.trim().length > 0 && sidebarApartmentSuggestions.length > 0 && (
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

          {compareResultOpen && selectedApartment && (
            <aside className="compare-result-panel" aria-label="아파트 비교 결과" role="complementary">
              <div className="compare-result-head">
                <div>
                  <small>선택 아파트 {nearbyRadiusM / 1000}km 이내 기준</small>
                  <h2>아파트 비교 결과</h2>
                </div>
                <button aria-label="비교 결과 닫기" onClick={() => setCompareResultOpen(false)} type="button">×</button>
              </div>

              {compareResultStatus === 'loading' && (
                <div className="compare-result-message">비교 결과를 계산하는 중입니다.</div>
              )}

              {compareResultStatus === 'error' && (
                <div className="compare-result-message compare-result-message--error">
                  비교 결과를 불러오지 못했습니다. 백엔드 연결 상태를 확인해주세요.
                </div>
              )}

              {compareResult && compareResultStatus === 'idle' && (
                <>
                  <section className="compare-result-summary">
                    <dl>
                      <div>
                        <dt>기준 아파트</dt>
                        <dd>{compareResult.base.name}</dd>
                      </div>
                      <div>
                        <dt>비교 아파트</dt>
                        <dd>{compareResult.targets.map((target) => target.apartment.name).join(', ')}</dd>
                      </div>
                    </dl>
                    {compareResult.summary.map((item) => (
                      <p key={item}>{item}</p>
                    ))}
                  </section>

                  <section className="compare-result-section">
                    <h3>핵심 지표 비교</h3>
                    <div className="compare-metric-table">
                      <div className="compare-metric-row compare-metric-row--head">
                        <span>비교 기준</span>
                        <span>{compareResult.base.name}</span>
                        {compareResult.targets.map((target) => (
                          <span key={target.apartment.id}>{target.apartment.name}</span>
                        ))}
                      </div>
                      {compareResult.metrics
                        .filter((metric) => compareMetricOrder.includes(metric.code as ActiveFacilityKey))
                        .map((metric) => (
                          <div className="compare-metric-row" key={metric.code}>
                            <span>{metric.label}</span>
                            <b>{metric.base_count}{metric.unit}</b>
                            {metric.targets.map((target) => (
                              <div className={`metric-target metric-target--${target.tone}`} key={target.apartment_id}>
                                <b>{target.count}{metric.unit}</b>
                                <small>{target.label}</small>
                              </div>
                            ))}
                          </div>
                        ))}
                    </div>
                  </section>

                  <section className="compare-result-section">
                    <h3>항목별 상세 비교</h3>
                    <div className="compare-insight-list">
                      {compareResult.targets.flatMap((target) =>
                        target.insights.map((insight) => (
                          <article className={`compare-insight compare-insight--${insight.tone}`} key={`${target.apartment.id}-${insight.category}-${insight.title}`}>
                            <small>{target.apartment.name} · {compareSectionLabels[insight.category] ?? insight.category}</small>
                            <b>{insight.title}</b>
                            <p>{insight.description}</p>
                          </article>
                        )),
                      )}
                    </div>
                  </section>

                  <section className="compare-result-section">
                    <h3>지도 근거 보기</h3>
                    <div className="compare-map-actions">
                      {compareMetricOrder.map((metricCode) => (
                        <button key={metricCode} onClick={() => focusMetricOnMap(metricCode)} type="button">
                          {facilityFilters.find((filter) => filter.key === metricCode)?.icon} {getFeatureLabel(metricCode)} 보기
                        </button>
                      ))}
                    </div>
                  </section>
                </>
              )}
            </aside>
          )}

          <section className="sidebar-memo">
            <h3>비교 분석 메모</h3>
            {userId ? (
              <>
                <textarea
                  aria-label="비교 분석 메모"
                  disabled={memoStatus === 'loading'}
                  onChange={(event) => {
                    setMemoContent(event.target.value);
                    setMemoStatus('idle');
                  }}
                  placeholder="비교하며 발견한 점을 기록하세요."
                  value={memoContent}
                />
                <button disabled={memoStatus === 'loading' || memoStatus === 'saving'} onClick={handleSaveMemo} type="button">
                  {memoStatus === 'saving' ? '저장 중...' : '메모 저장'}
                </button>
                {memoStatus === 'saved' && <small className="memo-status">저장됐어요.</small>}
                {memoStatus === 'error' && <small className="memo-status memo-status--error">메모를 불러오지 못했어요. 다시 시도해주세요.</small>}
              </>
            ) : (
              <>
                <textarea aria-label="비교 분석 메모" disabled placeholder="로그인하면 메모를 남길 수 있어요." />
                <button disabled type="button">메모 저장</button>
              </>
            )}
          </section>

          {mapView === 'life' && (
            <>
              <button className="go-note" onClick={openInvestmentNote} type="button">
                <span aria-hidden="true">📝</span>
                <div>
                  <b>왜집의 임장노트</b>
                  <small>{selectedApartment ? `${selectedApartment.name} 상세 보기` : '아파트 선택 후 이용할 수 있어요'}</small>
                </div>
                <i>→</i>
              </button>
              <p className="note-gate-message" aria-live="polite">{noteGateMessage}</p>
            </>
          )}
        </aside>

        <div className="map-stage">
          {!sidebarOpen && (
            <button className="sidebar-open-button" onClick={openSidebar} type="button">
              🏢 <span>아파트 선택</span>
            </button>
          )}

          {!sidebarOpen && mapView === 'life' && (
            <aside
              className={compareDockOpen ? 'compare-dock compare-dock--open' : 'compare-dock'}
              aria-label="비교 결과 빠른 패널"
            >
              <button
                aria-expanded={compareDockOpen}
                className="compare-dock-toggle"
                onClick={() => setCompareDockOpen((open) => !open)}
                type="button"
              >
                <span aria-hidden="true">⇄</span>
                <b>비교 결과</b>
                <small>{comparisonApartments.length} / 2</small>
                <i aria-hidden="true">{compareDockOpen ? '‹' : '›'}</i>
              </button>

              {compareDockOpen && (
                <div className="compare-dock-body">
                  <div className="compare-dock-heading">
                    <div>
                      <small>아파트 비교</small>
                      <h2>아파트 비교 도구</h2>
                    </div>
                    <button aria-label="비교 패널 접기" onClick={() => setCompareDockOpen(false)} type="button">×</button>
                  </div>

                  <section className="compare-dock-section" aria-label="비교 담기">
                    <div className="compare-dock-section-title">
                      <span>1</span>
                      <div><h3>비교 담기</h3><small>기준 단지와 비교할 아파트를 선택합니다.</small></div>
                    </div>

                    <div className="compare-basket compare-dock-basket">
                      <div className="compare-basket-item compare-basket-item--base">
                        <small>기준</small>
                        <b>{selectedApartment?.name ?? '기준 아파트 미선택'}</b>
                      </div>
                      {comparisonApartments.map((apartment, index) => (
                        <div className="compare-basket-item" key={apartment.id}>
                          <small>{index + 1}</small>
                          <b>{apartment.name}</b>
                          <button aria-label={`${apartment.name} 비교함에서 빼기`} onClick={() => removeComparisonApartment(apartment.id)} type="button">×</button>
                        </div>
                      ))}
                    </div>

                    <small className="compare-radius-note">선택 아파트 1km 이내 기준</small>
                    <button
                      className="compare-add-button"
                      disabled={!selectedApartment || comparisonApartments.length >= 2}
                      onClick={startComparisonSelection}
                      type="button"
                    >
                      {comparisonApartments.length >= 2 ? '최대 2개까지 비교 가능' : '+ 비교 단지 추가'}
                    </button>
                    {comparisonSelectMode && comparisonApartments.length < 2 && (
                      <div className="compare-selection-note" role="status">
                        검색 결과나 지도 위 단지 마커를 눌러 비교 후보를 확인하세요.
                      </div>
                    )}
                  </section>

                  <section className="compare-dock-section" aria-label="타 아파트와 비교 분석">
                    <div className="compare-dock-section-title">
                      <span>2</span>
                      <div><h3>타 아파트와 비교 분석</h3><small>생활환경 지표와 차이를 분석합니다.</small></div>
                    </div>

                    <div className="facts compare-dock-facts">
                      {summaryItems.map((item) => (
                        <div className="fact" key={item.key}>
                          <small>{item.label}</small>
                          <b>{item.value}</b>
                          <span>{comparisonApartments.length > 0 ? '비교 준비 중' : '1km 이내'}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      className="compare-result-button"
                      disabled={comparisonApartments.length === 0}
                      onClick={openCompareResult}
                      type="button"
                    >
                      비교 분석 시작
                    </button>

                    {compareResultStatus === 'loading' && <div className="compare-result-message">비교 결과를 계산하는 중입니다.</div>}
                    {compareResultStatus === 'error' && <div className="compare-result-message compare-result-message--error">비교 결과를 불러오지 못했습니다.</div>}
                    {compareResult && compareResultStatus === 'idle' && compareResultOpen && (
                      <section className="compare-dock-result" aria-label="비교 결과 요약">
                        <div className="compare-dock-result-title">
                          <h3>비교 분석 결과</h3>
                          <button aria-label="비교 결과 접기" onClick={() => setCompareResultOpen(false)} type="button">접기</button>
                        </div>
                        {compareResult.summary.map((item) => <p key={item}>{item}</p>)}
                        <div className="compare-dock-metrics">
                          {compareResult.metrics
                            .filter((metric) => compareMetricOrder.includes(metric.code as ActiveFacilityKey))
                            .map((metric) => (
                              <button key={metric.code} onClick={() => focusMetricOnMap(metric.code as ActiveFacilityKey)} type="button">
                                <span>{metric.label}</span>
                                <b>{metric.base_count}{metric.unit}</b>
                                <small>{metric.targets.map((target) => `${target.count}${metric.unit}`).join(' · ')}</small>
                              </button>
                            ))}
                        </div>
                        <div className="compare-dock-insights">
                          {compareResult.targets.flatMap((target) =>
                            target.insights.map((insight) => (
                              <article className={`compare-insight compare-insight--${insight.tone}`} key={`${target.apartment.id}-${insight.category}-${insight.title}`}>
                                <small>{target.apartment.name} · {compareSectionLabels[insight.category] ?? insight.category}</small>
                                <b>{insight.title}</b>
                                <p>{insight.description}</p>
                              </article>
                            )),
                          )}
                        </div>
                        <div className="compare-map-actions compare-dock-map-actions">
                          {compareMetricOrder.map((metricCode) => (
                            <button key={metricCode} onClick={() => focusMetricOnMap(metricCode)} type="button">
                              {facilityFilters.find((filter) => filter.key === metricCode)?.icon} {getFeatureLabel(metricCode)} 지도 보기
                            </button>
                          ))}
                        </div>
                      </section>
                    )}
                  </section>

                  <section className="sidebar-memo compare-dock-memo">
                    <h3>비교 분석 메모</h3>
                    {userId ? (
                      <>
                        <textarea
                          aria-label="빠른 비교 분석 메모"
                          disabled={memoStatus === 'loading'}
                          onChange={(event) => {
                            setMemoContent(event.target.value);
                            setMemoStatus('idle');
                          }}
                          placeholder="비교하며 발견한 점을 기록하세요."
                          value={memoContent}
                        />
                        <button disabled={memoStatus === 'loading' || memoStatus === 'saving'} onClick={handleSaveMemo} type="button">
                          {memoStatus === 'saving' ? '저장 중...' : '메모 저장'}
                        </button>
                        {memoStatus === 'saved' && <small className="memo-status">저장됐어요.</small>}
                        {memoStatus === 'error' && <small className="memo-status memo-status--error">메모를 불러오지 못했어요. 다시 시도해주세요.</small>}
                      </>
                    ) : (
                      <>
                        <textarea aria-label="빠른 비교 분석 메모" disabled placeholder="로그인하면 메모를 남길 수 있어요." />
                        <button disabled type="button">메모 저장</button>
                      </>
                    )}
                  </section>
                </div>
              )}
            </aside>
          )}

          {selectedApartment && !sidebarOpen && mapView === 'life' && (
            <div className="map-facility-panel">
              <div className="facility-heading">
                <div>
                  <b>무엇을 지도에서 볼까요?</b>
                  <p className="apartment-mini-summary">
                    {mapEvidenceMetric ? (
                      <span>비교 근거: {getFeatureLabel(mapEvidenceMetric)} · 기준/비교 아파트 1km 이내</span>
                    ) : (
                      <>
                        <span>어린이시설 {getSummaryCount(summary, 'kids')}곳</span>
                        <span>학교 {getSummaryCount(summary, 'school')}곳</span>
                        <span>보행신호 {getSummaryCount(summary, 'signal')}개</span>
                      </>
                    )}
                  </p>
                </div>
                <button onClick={resetToApartmentSelectionMap} type="button">🏢 아파트 다시 선택</button>
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

          {selectedApartment && !sidebarOpen && mapView === 'condition' && (
            <>
              <section className="condition-summary" aria-label="조건 지도 요약">
                <div><small>선택 단지</small><b>{selectedApartment.name}</b><span>→</span><strong>{conditionStep === 'route' ? '보행 조건' : '목적지 선택'}</strong></div>
                <p>{selectedDestination ? `${selectedDestination.name}까지 도보 ${selectedDestinationMinutes}분 · ${selectedDestinationDistance}m` : '학교·공원·유치원·어린이집·병원 중 목적지를 선택하세요.'}</p>
                {selectedDestination && <button onClick={resetDestination} type="button">목적지 초기화</button>}
              </section>

              <aside className={`condition-apartment-card ${buildingDetail.status === 'ready' ? 'condition-apartment-card--detail' : ''}`}>
                {buildingDetail.status === 'ready' && buildingDetail.pnu ? (
                  <StitchBuildingPanel
                    buildingName={buildingDetail.buildingName || selectedApartment.name}
                    onClose={() => setBuildingDetail({ status: 'idle' })}
                    pnu={buildingDetail.pnu}
                  />
                ) : (
                  <>
                    <small>선택 단지</small><h2>{selectedApartment.name}</h2><p>{selectedApartment.address}</p>
                    <dl>
                      {selectedDestination ? <><div><dt>통학 목적지</dt><dd>{selectedDestination.name}</dd></div><div><dt>도보 시간</dt><dd>{selectedDestinationMinutes}분</dd></div><div><dt>횡단보도</dt><dd>{selectedDestinationCrosswalks}개</dd></div><div><dt>보행신호</dt><dd>{selectedDestinationSignals}개</dd></div><div><dt>CCTV</dt><dd>{selectedDestinationCctv}개</dd></div></> : <><div><dt>현재 상태</dt><dd>목적지 선택 전</dd></div><div><dt>분석 기준</dt><dd>실제 시설 좌표·큰길 경로</dd></div></>}
                    </dl>
                    {buildingDetail.status === 'error' && <p className="condition-apartment-card__error" role="alert">{buildingDetail.message}</p>}
                    <button disabled={buildingDetail.status === 'loading'} onClick={openBuildingDetail} type="button">
                      {buildingDetail.status === 'loading' ? '건축물 연결 중…' : buildingDetail.status === 'error' ? '다시 시도' : '단지 상세 보기'}
                    </button>
                    <button onClick={() => setConditionNoteReady((current) => !current)} type="button">
                      {conditionNoteReady ? '거래동향 닫기' : '거래동향 요약'}
                    </button>
                  </>
                )}
              </aside>

              {conditionNoteReady && buildingDetail.status !== 'ready' && (
                <aside className="condition-market-panel" aria-label="선택 단지 거래동향">
                  <div className="market-strip-title">
                    <small>거래동향</small>
                    <b>{selectedApartment.name}</b>
                    <span>최근 3개월</span>
                  </div>
                  {marketStatus === 'loading' && <p className="market-strip-state">거래 데이터를 불러오는 중입니다.</p>}
                  {marketStatus === 'error' && <p className="market-strip-state">거래 데이터를 확인하지 못했습니다.</p>}
                  {marketStatus === 'ready' && marketSummary && (
                    <>
                      <div className="market-strip-metrics">
                        <div><small>평균 매매가</small><b>{formatAmountManwon(marketSummary.averageTradeAmount)} <em className={marketSummary.tradeChangeRate >= 0 ? 'is-up' : 'is-down'}>{marketSummary.tradeChangeRate >= 0 ? '▲' : '▼'} {Math.abs(marketSummary.tradeChangeRate)}%</em></b><span>최근 그룹별 기준</span></div>
                        <div><small>평균 전세가</small><b>{formatAmountManwon(marketSummary.averageJeonseDeposit)} <em className={marketSummary.jeonseChangeRate >= 0 ? 'is-up' : 'is-down'}>{marketSummary.jeonseChangeRate >= 0 ? '▲' : '▼'} {Math.abs(marketSummary.jeonseChangeRate)}%</em></b><span>평균 전세율 기준</span></div>
                      </div>
                      <div className="market-area-heading">
                        <small>평형별 시세</small>
                        <span>매매 평균(증감) / 평균 전세가</span>
                      </div>
                      <div className="market-strip-areas">
                        {marketSummary.areaRows.map((row) => (
                          <div key={row.label}>
                            <small>{row.label}<span>{row.range}</span></small>
                            <b>{formatAmountManwon(row.averageTradeAmount)} <em className={row.tradeChangeRate >= 0 ? 'is-up' : 'is-down'}>{row.tradeChangeRate >= 0 ? '▲' : '▼'} {Math.abs(row.tradeChangeRate)}%</em></b>
                            <span>{formatAmountManwon(row.averageJeonseDeposit)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="market-chart-heading">
                        <small>매매/전세 시세 비교</small>
                        <span><i /> 매매 <i /> 전세</span>
                      </div>
                      <div className="market-strip-chart" aria-label="최근 거래량 그래프">
                        {marketSummary.trend.map((item) => {
                          const max = Math.max(...marketSummary.trend.flatMap((trendItem) => [trendItem.tradeCount, trendItem.jeonseCount]), 1);
                          const tradeHeight = 18 + Math.round((item.tradeCount / max) * 58);
                          const jeonseHeight = 18 + Math.round((item.jeonseCount / max) * 58);
                          return (
                            <i key={item.label}>
                              <b style={{ height: `${tradeHeight}px` }} />
                              <b style={{ height: `${jeonseHeight}px` }} />
                              <span>{item.label}</span>
                            </i>
                          );
                        })}
                      </div>
                    </>
                  )}
                </aside>
              )}

              <aside className="condition-control-card">
                <div className="condition-control-title"><div><small>{conditionStep === 'route' ? '선택한 경로' : '목적지 탐색'}</small><h2>{conditionStep === 'route' ? '조건 분석' : '어디로 갈까요?'}</h2></div><button onClick={() => setDestinationMenuOpen((open) => !open)} type="button">✨</button></div>
                {conditionStep === 'route' && selectedDestination ? <div className="condition-metrics"><div><span>🚶</span><small>도보 시간</small><b>{selectedDestinationMinutes}분</b></div><div><span>🚸</span><small>횡단보도</small><b>{selectedDestinationCrosswalks}개</b></div><div><span>🚦</span><small>보행신호</small><b>{selectedDestinationSignals}개</b></div><div><span>📹</span><small>CCTV</small><b>{selectedDestinationCctv}개</b></div>{supportsStoredWalkingRoute(selectedDestination.category) && walkingRouteMessage && <p className="condition-route-status" role="status">{walkingRouteMessage}</p>}{selectedRouteSafetyMessage && <p className="condition-route-status" role="status">{selectedRouteSafetyMessage}</p>}<button onClick={resetDestination} type="button">다른 목적지 선택</button></div> : <div className="condition-categories">{(Object.entries(conditionCategoryMeta) as Array<[ConditionCategory, { label: string; icon: string }]>).map(([key, meta]) => <button className={visibleConditionCategories.includes(key) ? 'is-active' : ''} key={key} onClick={() => toggleConditionCategory(key)} type="button"><span>{meta.icon}</span>{meta.label}<small>{visibleConditionCategories.includes(key) ? '표시 중' : '선택'}</small></button>)}</div>}
                {destinationMenuOpen && <div className="destination-menu">{conditionCandidates.map((item) => <button key={item.id} onClick={() => selectDestination(item)} type="button"><span>{conditionCategoryMeta[item.category].icon} {item.name}</span><small>도보 {item.minutes}분 · {item.distance}m</small></button>)}</div>}
              </aside>
              {selectedConditionCluster && conditionStep === 'select' && (
                <aside className="condition-cluster-sheet" aria-label="묶인 목적지 목록">
                  <div className="condition-cluster-sheet-head">
                    <div>
                      <small>겹쳐진 목적지</small>
                      <h2>{selectedConditionCluster.count}개 후보가 가까이 있어요</h2>
                    </div>
                    <button aria-label="목적지 목록 닫기" onClick={() => setSelectedConditionCluster(null)} type="button">×</button>
                  </div>
                  <div className="condition-cluster-list">
                    {selectedConditionCluster.destinations.map((destination) => (
                      <button key={destination.id} onClick={() => selectDestination(destination)} type="button">
                        <span aria-hidden="true">{conditionCategoryMeta[destination.category].icon}</span>
                        <div>
                          <small>{conditionCategoryMeta[destination.category].label}</small>
                          <b>{destination.name}</b>
                          <em>{destination.address ?? '주소 정보 확인 중'}</em>
                        </div>
                        <strong>도보 {destination.minutes}분 · {destination.distance}m</strong>
                      </button>
                    ))}
                  </div>
                </aside>
              )}
              {conditionStep === 'select' && conditionCandidates.length === 0 && <div className="condition-empty">주변 학교·공원·어린이집·병원 정보를 불러오는 중입니다.</div>}
            </>
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

          {status === 'ready' && !selectedApartment && apartmentOptions.length > 0 && (
            <div className="apartment-map-guide" role="status">
              <span aria-hidden="true">🏢</span>
              <div><b>지도에서 아파트를 선택하세요</b><small>단지 이름을 누르면 주변 생활환경을 바로 보여드려요.</small></div>
            </div>
          )}

          {selectedApartment && mapView === 'life' && (
            <div className="map-apartment-caption">
              <small>현재 기준점</small>
              <b>{selectedApartment.name}</b>
              <span>{selectedApartment.address}</span>
              <em>이 아파트 주변을 살펴보고 있어요</em>
            </div>
          )}

          {previewApartment && !selectedApartment && (
            <aside className="map-apartment-preview-card" aria-label="아파트 미리보기">
              <small>기준 아파트 후보</small>
              <b>{previewApartment.name}</b>
              <span>{previewApartment.address}</span>
              <div className="apartment-preview-actions">
                <button onClick={onOpenInvestment} type="button">단지 자세히 보기</button>
                <button onClick={() => selectApartment(previewApartment)} type="button">기준 아파트로 선택</button>
              </div>
            </aside>
          )}

          {previewApartment && selectedApartment && previewApartment.id !== selectedApartment.id && (
            <aside className="map-apartment-preview-card" aria-label="아파트 미리보기">
              <small>비교 아파트 후보</small>
              <b>{previewApartment.name}</b>
              <span>{previewApartment.address}</span>
              <em>{Math.round(distanceMeters(selectedApartment.latitude, selectedApartment.longitude, previewApartment.latitude, previewApartment.longitude))}m 거리</em>
              <div className="apartment-preview-facts">
                <span>어린이시설 {getSummaryCount(compareSummary, 'kids')}곳</span>
                <span>학교 {getSummaryCount(compareSummary, 'school')}곳</span>
                <span>보행신호 {getSummaryCount(compareSummary, 'signal')}개</span>
              </div>
              <div className="apartment-preview-actions">
                <button onClick={onOpenInvestment} type="button">단지 자세히 보기</button>
                {comparisonApartments.some((apartment) => apartment.id === previewApartment.id) ? (
                  <button onClick={() => removeComparisonApartment(previewApartment.id)} type="button">비교함에서 빼기</button>
                ) : (
                  <button disabled={comparisonApartments.length >= 2} onClick={() => addComparisonApartment(previewApartment)} type="button">
                    {comparisonApartments.length >= 2 ? '최대 2개까지 비교 가능' : '비교함에 담기'}
                  </button>
                )}
              </div>
            </aside>
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
