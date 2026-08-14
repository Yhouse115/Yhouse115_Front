import { env } from '../config/env';

export type FacilityCategory = 'kids' | 'school' | 'crosswalk' | 'signal' | 'cctv' | 'risk' | 'park' | 'hospital';

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
  walking_distance_m?: number | null;
  walking_time_min?: number | null;
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

type BuildingPnuResolutionResponse = {
  data: {
    pnu: string;
    buildingName?: string | null;
  };
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

export type CompareMetricTarget = {
  apartment_id: string;
  count: number;
  diff: number;
  comparison: 'target_more' | 'base_more' | 'similar';
  label: string;
  tone: 'positive' | 'caution' | 'context' | 'neutral';
};

export type CompareMetric = {
  code: FacilityCategory;
  label: string;
  unit: string;
  base_count: number;
  targets: CompareMetricTarget[];
};

export type CompareInsight = {
  category: string;
  title: string;
  description: string;
  tone: 'positive' | 'caution' | 'context' | 'neutral';
  metric_codes: FacilityCategory[];
};

export type CompareApartmentTarget = {
  apartment: ApartmentSummary;
  metrics: Partial<Record<FacilityCategory, number>>;
  summary: string;
  insights: CompareInsight[];
};

export type ApartmentCompareResponse = {
  base: ApartmentSummary;
  radius_m: number;
  categories: FacilityCategory[];
  base_metrics: Partial<Record<FacilityCategory, number>>;
  targets: CompareApartmentTarget[];
  metrics: CompareMetric[];
  summary: string[];
};

export type WalkingRoute = {
  complexId: string;
  featureId: string;
  accessGroup: string;
  routeCoordinates: Array<[longitude: number, latitude: number]>;
  walkDistanceMeters: number;
  walkTimeMinutes: number;
  routeMethod: string;
  calculatedAt: string;
  safetyMatchThresholdMeters?: number | null;
  crosswalkCount?: number | null;
  pedestrianSignalCount?: number | null;
  cctvLocationCount?: number | null;
  crossingEvents?: WalkingRouteCrossingEvent[] | null;
};

export type WalkingRouteCrossingEvent = {
  crosswalkEventId: string;
  longitude: number;
  latitude: number;
  pedestrianSignals: Array<{ id: string; longitude: number; latitude: number }>;
};

export class ApiRequestError extends Error {
  constructor(readonly status: number) {
    super(`API request failed: ${status}`);
    this.name = 'ApiRequestError';
  }
}

export class WalkingRouteNotFoundError extends Error {
  constructor() {
    super('Walking route was not found.');
    this.name = 'WalkingRouteNotFoundError';
  }
}

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
        throw new ApiRequestError(response.status);
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

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const url = apiUrl(path);
  const cacheKey = `${url}:${JSON.stringify(body)}`;
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  const pending = pendingRequests.get(cacheKey);
  if (pending) {
    return pending as Promise<T>;
  }

  const request = fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      return response.json() as Promise<T>;
    })
    .then((value) => {
      responseCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value });
      return value;
    })
    .finally(() => {
      pendingRequests.delete(cacheKey);
    });

  pendingRequests.set(cacheKey, request);
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
  const response = await getJson<ApartmentSearchResponse | ApartmentSummary[]>('/api/v1/family-map/apartments', params);
  if (Array.isArray(response)) {
    return response;
  }
  return response?.items ?? [];
}

export async function resolveApartmentPnu(apartment: ApartmentSummary) {
  const params = new URLSearchParams({ address: apartment.address });
  if (apartment.household_count != null) {
    params.set('household_count', String(apartment.household_count));
  }
  const response = await getJson<BuildingPnuResolutionResponse>('/api/v1/buildings/resolve-pnu', params);
  return response.data;
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

export async function compareApartments(
  baseApartmentId: string,
  targetApartmentIds: string[],
  radiusM = 1000,
) {
  return postJson<ApartmentCompareResponse>('/api/v1/family-map/apartments/compare', {
    base_apartment_id: baseApartmentId,
    target_apartment_ids: targetApartmentIds,
    radius_m: radiusM,
  });
}

function isRouteCoordinate(value: unknown): value is [number, number] {
  return Array.isArray(value)
    && value.length === 2
    && typeof value[0] === 'number'
    && Number.isFinite(value[0])
    && typeof value[1] === 'number'
    && Number.isFinite(value[1]);
}

function isCrossingEvent(value: unknown): value is WalkingRouteCrossingEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<WalkingRouteCrossingEvent>;
  return typeof event.crosswalkEventId === 'string'
    && event.crosswalkEventId.length > 0
    && typeof event.longitude === 'number'
    && Number.isFinite(event.longitude)
    && typeof event.latitude === 'number'
    && Number.isFinite(event.latitude)
    && Array.isArray(event.pedestrianSignals)
    && event.pedestrianSignals.every((signal) => (
      !!signal
      && typeof signal.id === 'string'
      && signal.id.length > 0
      && typeof signal.longitude === 'number'
      && Number.isFinite(signal.longitude)
      && typeof signal.latitude === 'number'
      && Number.isFinite(signal.latitude)
    ));
}

function mapWalkingRoute(response: WalkingRoute): WalkingRoute {
  if (
    !Array.isArray(response.routeCoordinates)
    || response.routeCoordinates.length < 2
    || !response.routeCoordinates.every(isRouteCoordinate)
    || !Number.isFinite(response.walkDistanceMeters)
    || !Number.isFinite(response.walkTimeMinutes)
    || (response.safetyMatchThresholdMeters != null && !Number.isFinite(response.safetyMatchThresholdMeters))
    || (response.crosswalkCount != null && !Number.isFinite(response.crosswalkCount))
    || (response.pedestrianSignalCount != null && !Number.isFinite(response.pedestrianSignalCount))
    || (response.cctvLocationCount != null && !Number.isFinite(response.cctvLocationCount))
    || (response.crossingEvents != null && (!Array.isArray(response.crossingEvents) || !response.crossingEvents.every(isCrossingEvent)))
  ) {
    throw new Error('Walking route response is invalid.');
  }

  return {
    ...response,
    routeCoordinates: response.routeCoordinates.map(([longitude, latitude]) => [longitude, latitude]),
    safetyMatchThresholdMeters: response.safetyMatchThresholdMeters ?? null,
    crosswalkCount: response.crosswalkCount ?? null,
    pedestrianSignalCount: response.pedestrianSignalCount ?? null,
    cctvLocationCount: response.cctvLocationCount ?? null,
    crossingEvents: response.crossingEvents ?? null,
  };
}

function toWalkingRouteFeatureId(featureId: string) {
  const schoolPrefix = 'elementary_schools:';
  if (!featureId.startsWith(schoolPrefix)) {
    return featureId;
  }
  return `education_elementary_yangcheon:${featureId.slice(schoolPrefix.length)}`;
}

export async function getWalkingRoute(complexId: string, featureId: string): Promise<WalkingRoute> {
  try {
    const routeFeatureId = toWalkingRouteFeatureId(featureId);
    const response = await getJson<WalkingRoute>(
      `/api/v1/complexes/${encodeURIComponent(complexId)}/features/${encodeURIComponent(routeFeatureId)}/walking-route`,
    );
    return {
      ...mapWalkingRoute(response),
      // The API uses the normalized database ID; the map state uses the marker ID.
      featureId,
    };
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) {
      throw new WalkingRouteNotFoundError();
    }
    throw error;
  }
}
