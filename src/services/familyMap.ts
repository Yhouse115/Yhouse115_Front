import { env } from '../config/env';

export type FacilityCategory = 'kids' | 'school' | 'crosswalk' | 'signal' | 'cctv' | 'risk';

export type ApartmentSummary = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  approval_date?: string | null;
  household_count?: number | null;
  building_count?: number | null;
};

export type MapFeature = {
  id: string;
  category: FacilityCategory;
  source: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string | null;
  distance_m?: number | null;
  geometry?: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
};

export type FeatureSummary = {
  category: FacilityCategory;
  count: number;
};

export type ApartmentSearchResponse = {
  items: ApartmentSummary[];
};

export type NearbyFeaturesResponse = {
  apartment: ApartmentSummary;
  radius_m: number;
  categories: FacilityCategory[];
  summary: FeatureSummary[];
  features: MapFeature[];
};

export type BoundsFeaturesResponse = {
  bounds: {
    sw_lat: number;
    sw_lng: number;
    ne_lat: number;
    ne_lng: number;
  };
  categories: FacilityCategory[];
  summary: FeatureSummary[];
  features: MapFeature[];
};

const responseCache = new Map<string, { expiresAt: number; value: unknown }>();
const pendingRequests = new Map<string, Promise<unknown>>();
const CACHE_TTL_MS = 20_000;

function apiUrl(path: string, params?: URLSearchParams) {
  const baseUrl = env.apiBaseUrl.replace(/\/$/, '');
  const query = params?.toString();
  return `${baseUrl}${path}${query ? `?${query}` : ''}`;
}

async function getJson<T>(path: string, params?: URLSearchParams): Promise<T> {
  const url = apiUrl(path, params);
  const cached = responseCache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  const pending = pendingRequests.get(url);
  if (pending) {
    return pending as Promise<T>;
  }

  const request = fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      return response.json() as Promise<T>;
    })
    .then((value) => {
      responseCache.set(url, { expiresAt: Date.now() + CACHE_TTL_MS, value });
      return value;
    })
    .finally(() => {
      pendingRequests.delete(url);
    });

  pendingRequests.set(url, request);
  return request;
}

function compactCoordinate(value: number) {
  return value.toFixed(4);
}

export async function searchApartments(query: string, limit = 10) {
  const params = new URLSearchParams({
    limit: String(limit),
  });
  if (query.trim()) {
    params.set('q', query.trim());
  }
  const response = await getJson<ApartmentSearchResponse>('/api/v1/family-map/apartments', params);
  return response.items;
}

export async function getNearbyFeatures(
  complexId: string,
  categories: FacilityCategory[],
  radiusM = 50,
) {
  const params = new URLSearchParams({
    radius_m: String(radiusM),
    categories: categories.join(','),
    limit_per_source: '1000',
  });
  return getJson<NearbyFeaturesResponse>(`/api/v1/family-map/apartments/${complexId}/nearby`, params);
}

export async function getFeaturesInBounds(
  bounds: { swLat: number; swLng: number; neLat: number; neLng: number },
  categories: FacilityCategory[],
  zoom: number,
) {
  const params = new URLSearchParams({
    sw_lat: compactCoordinate(bounds.swLat),
    sw_lng: compactCoordinate(bounds.swLng),
    ne_lat: compactCoordinate(bounds.neLat),
    ne_lng: compactCoordinate(bounds.neLng),
    categories: categories.join(','),
    zoom: String(Math.round(zoom)),
    limit_per_source: '5000',
  });
  return getJson<BoundsFeaturesResponse>('/api/v1/family-map/features', params);
}
