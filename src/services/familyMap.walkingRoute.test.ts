import { getWalkingRoute, WalkingRouteNotFoundError } from './familyMap';

describe('getWalkingRoute', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps stored twenty-meter safety counts with the walking route', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        complexId: 'complex-1',
        featureId: 'school-1',
        accessGroup: 'elementary_school',
        routeCoordinates: [[126.86, 37.52], [126.861, 37.521]],
        walkDistanceMeters: 830,
        walkTimeMinutes: 12,
        routeMethod: 'oa-21208-dijkstra',
        calculatedAt: '2026-08-13T00:00:00Z',
        safetyMatchThresholdMeters: 20,
        crosswalkCount: 8,
        pedestrianSignalCount: 2,
        cctvLocationCount: 11,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getWalkingRoute('complex-1', 'school-1')).resolves.toEqual({
      complexId: 'complex-1',
      featureId: 'school-1',
      accessGroup: 'elementary_school',
      routeCoordinates: [[126.86, 37.52], [126.861, 37.521]],
      walkDistanceMeters: 830,
      walkTimeMinutes: 12,
      routeMethod: 'oa-21208-dijkstra',
      calculatedAt: '2026-08-13T00:00:00Z',
      safetyMatchThresholdMeters: 20,
      crosswalkCount: 8,
      pedestrianSignalCount: 2,
      cctvLocationCount: 11,
      crossingEvents: null,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/complexes/complex-1/features/school-1/walking-route',
    );
  });

  it('reports a route that has not been precomputed as not found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    await expect(getWalkingRoute('complex-2', 'school-2')).rejects.toBeInstanceOf(WalkingRouteNotFoundError);
  });

  it('maps an elementary-school map marker ID to its normalized route feature ID', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        complexId: 'complex-1',
        featureId: 'education_elementary_yangcheon:7081453',
        accessGroup: 'elementary_school',
        routeCoordinates: [[126.86, 37.52], [126.861, 37.521]],
        walkDistanceMeters: 830,
        walkTimeMinutes: 12,
        routeMethod: 'oa-21208-dijkstra',
        calculatedAt: '2026-08-13T00:00:00Z',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getWalkingRoute('complex-1', 'elementary_schools:7081453')).resolves.toMatchObject({
      featureId: 'elementary_schools:7081453',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/complexes/complex-1/features/education_elementary_yangcheon%3A7081453/walking-route',
    );
  });
});
