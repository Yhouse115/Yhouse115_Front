import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { AuthProvider } from '../features/auth/AuthContext';
import { getNearbyFeatures, searchApartments } from '../services/familyMap';
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
  searchApartments: vi.fn(),
}));

vi.mock('../config/env', () => ({
  env: {
    naverMapsClientId: 'test-client-id',
  },
}));

const mapSetZoom = vi.fn();
const markerClickListeners: Array<(event?: { stop?: () => void }) => void> = [];

function installNaverMapsMock() {
  class MapMock {
    setCenter = vi.fn();
    setZoom = mapSetZoom;
    getZoom = () => 14;
  }

  class MarkerMock {
    setMap = vi.fn();
    setIcon = vi.fn();
    setPosition = vi.fn();
    setZIndex = vi.fn();
  }

  window.naver = {
    maps: {
      LatLng: class {},
      Point: class {},
      Position: { BOTTOM_RIGHT: 'bottom-right' },
      Map: MapMock,
      Marker: MarkerMock,
      Event: {
        addListener: vi.fn((target, eventName, listener) => {
          if (target instanceof MarkerMock && eventName === 'click') {
            markerClickListeners.push(listener);
          }
        }),
        trigger: vi.fn(),
      },
    },
  } as unknown as NonNullable<typeof window.naver>;
}

const apartment = {
  id: 'apt-1',
  name: 'Test Apartment',
  address: 'Seoul',
  latitude: 37.52,
  longitude: 126.86,
};

describe('NaverMapPreview', () => {
  beforeEach(() => {
    mapSetZoom.mockClear();
    markerClickListeners.length = 0;
    installNaverMapsMock();
    vi.mocked(searchApartments).mockResolvedValue([apartment]);
    vi.mocked(getNearbyFeatures).mockResolvedValue({
      apartment,
      radius_m: 1000,
      categories: ['school', 'kids', 'park', 'hospital', 'crosswalk', 'signal', 'cctv'],
      summary: [],
      features: [],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete window.naver;
  });

  it('loads only the selected apartment nearby facilities within 1km', async () => {
    renderMap();

    await waitFor(() => {
      expect(searchApartments).toHaveBeenCalledWith('', 1000);
    });

    const sidebarSearchInput = screen.getByPlaceholderText('아파트 이름을 입력하세요');
    const sidebarSearchForm = sidebarSearchInput.closest('form') as HTMLElement;
    fireEvent.change(sidebarSearchInput, { target: { value: 'Test' } });
    fireEvent.click(await within(sidebarSearchForm).findByRole('option', { name: /Test Apartment/ }));

    await waitFor(() => {
      expect(getNearbyFeatures).toHaveBeenCalledWith(
        'apt-1',
        ['school', 'kids', 'park', 'hospital', 'crosswalk', 'signal', 'cctv'],
        1000,
      );
    });
  });

  it('zooms in when an apartment is selected and restores the zoom when its marker is clicked again', async () => {
    renderMap();

    const sidebarSearchInput = screen.getByPlaceholderText('아파트 이름을 입력하세요');
    const sidebarSearchForm = sidebarSearchInput.closest('form') as HTMLElement;
    fireEvent.change(sidebarSearchInput, { target: { value: 'Test' } });
    fireEvent.click(await within(sidebarSearchForm).findByRole('option', { name: /Test Apartment/ }));
    expect(screen.getByText('현재 기준점')).toBeInTheDocument();
    expect(mapSetZoom).toHaveBeenLastCalledWith(15);

    act(() => {
      markerClickListeners[markerClickListeners.length - 1]?.({ stop: vi.fn() });
    });

    await waitFor(() => {
      expect(screen.queryByText('현재 기준점')).not.toBeInTheDocument();
      expect(mapSetZoom).toHaveBeenLastCalledWith(14);
    });
  });
});
