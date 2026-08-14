import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { AuthProvider } from '../features/auth/AuthContext';
import { getNearbyFeatures, getWalkingRoute, searchApartments } from '../services/familyMap';
import { NaverMapPreview } from './NaverMapPreview';

function renderMap() {
  return render(
    <AuthProvider>
      <NaverMapPreview />
    </AuthProvider>,
  );
}

vi.mock('../services/familyMap', () => ({
  getNearbyFeatures: vi.fn(),
  getWalkingRoute: vi.fn(),
  searchApartments: vi.fn(),
  WalkingRouteNotFoundError: class WalkingRouteNotFoundError extends Error {},
}));

const apartment = {
  id: 'apt-1',
  name: 'Test Apartment',
  address: 'Seoul',
  latitude: 37.52,
  longitude: 126.86,
};

describe('NaverMapPreview walking route', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.mocked(searchApartments).mockResolvedValue([apartment]);
    vi.mocked(getNearbyFeatures).mockResolvedValue({
      apartment,
      radius_m: 1000,
      categories: ['kids', 'school', 'crosswalk', 'signal', 'cctv', 'risk'],
      summary: [],
      features: [{
        id: 'school-1',
        category: 'school',
        source: 'schools',
        name: 'Test Elementary School',
        latitude: 37.521,
        longitude: 126.861,
        walking_distance_m: 830,
        walking_time_min: 12,
        metadata: {},
      }],
    });
    vi.mocked(getWalkingRoute).mockResolvedValue({
      complexId: 'apt-1',
      featureId: 'stored-elementary-school-1',
      accessGroup: 'elementary_school',
      routeCoordinates: [[126.86, 37.52], [126.861, 37.521]],
      walkDistanceMeters: 830,
      walkTimeMinutes: 12,
      routeMethod: 'oa-21208-dijkstra',
      calculatedAt: '2026-08-13T00:00:00Z',
      safetyMatchThresholdMeters: 20,
      crosswalkCount: 4,
      pedestrianSignalCount: 1,
      cctvLocationCount: 8,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('requests the selected school route and displays its distance and time', async () => {
    renderMap();

    fireEvent.click((await screen.findAllByRole('button', { name: /Test Apartment/ }))[0]);
    await waitFor(() => expect(getNearbyFeatures).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: '조건 지도' }));
    fireEvent.click(screen.getByRole('button', { name: '✨' }));
    fireEvent.click(await screen.findByRole('button', { name: /Test Elementary School/ }));

    await waitFor(() => {
      expect(getWalkingRoute).toHaveBeenCalledWith('apt-1', 'school-1');
    });
    expect(await screen.findByText(/도보 12분 · 830m/)).toBeInTheDocument();
  });
});
