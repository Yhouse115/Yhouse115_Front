import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { getNearbyFeatures, searchApartments } from '../services/familyMap';
import { NaverMapPreview } from './NaverMapPreview';

vi.mock('../services/familyMap', () => ({
  getNearbyFeatures: vi.fn(),
  searchApartments: vi.fn(),
}));

vi.mock('../config/env', () => ({
  env: {
    naverMapsClientId: '',
  },
}));

const apartment = {
  id: 'apt-1',
  name: 'Test Apartment',
  address: 'Seoul',
  latitude: 37.52,
  longitude: 126.86,
};

describe('NaverMapPreview', () => {
  beforeEach(() => {
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
});
