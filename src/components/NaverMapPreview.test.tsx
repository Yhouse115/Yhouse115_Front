import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { getNearbyFeatures, searchApartments } from '../services/familyMap';
import { NaverMapPreview } from './NaverMapPreview';

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
    render(<NaverMapPreview />);

    fireEvent.click(await screen.findByRole('button', { name: /Test Apartment/ }));

    await waitFor(() => {
      expect(getNearbyFeatures).toHaveBeenCalledWith(
        'apt-1',
        ['school', 'kids', 'park', 'hospital', 'crosswalk', 'signal', 'cctv'],
        1000,
      );
    });
  });

  it('zooms in when an apartment is selected and restores the zoom when its marker is clicked again', async () => {
    render(<NaverMapPreview />);

    fireEvent.click(await screen.findByRole('button', { name: /Test Apartment/ }));
    expect(screen.getByText('현재 기준점')).toBeInTheDocument();
    expect(mapSetZoom).toHaveBeenLastCalledWith(15);

    act(() => {
      markerClickListeners.at(-1)?.({ stop: vi.fn() });
    });

    await waitFor(() => {
      expect(screen.queryByText('현재 기준점')).not.toBeInTheDocument();
      expect(mapSetZoom).toHaveBeenLastCalledWith(14);
    });
  });
});
