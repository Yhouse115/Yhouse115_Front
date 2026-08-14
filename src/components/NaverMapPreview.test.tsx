import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { AuthProvider } from '../features/auth/AuthContext';
import { compareApartments, getNearbyFeatures, searchApartments } from '../services/familyMap';
import { getInvestmentMarketSummary } from '../services/investmentMarket';
import { NaverMapPreview } from './NaverMapPreview';

function renderMap() {
  return render(
    <AuthProvider>
      <NaverMapPreview />
    </AuthProvider>,
  );
}

vi.mock('../services/familyMap', () => ({
  compareApartments: vi.fn(),
  getNearbyFeatures: vi.fn(),
  searchApartments: vi.fn(),
}));

vi.mock('../services/investmentMarket', () => ({
  formatAmountManwon: (value: number | null) => (value == null ? '-' : `${value}만`),
  getInvestmentMarketSummary: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(getInvestmentMarketSummary).mockResolvedValue({
    averageTradeAmount: 84000,
    averageJeonseDeposit: 32500,
    recentTradeCount: 2,
    recentJeonseCount: 3,
    tradeChangeRate: 1.2,
    jeonseChangeRate: -0.8,
    baseTradeAmount: 83000,
    baseJeonseDeposit: 32700,
    areaRows: [],
    trend: [],
  });
});

vi.mock('../config/env', () => ({
  env: {
    naverMapsClientId: 'test-client-id',
  },
}));

const mapSetZoom = vi.fn();
const markerClickListeners: Array<(event?: { stop?: () => void }) => void> = [];
const markerOptions: Array<{ title?: string; icon?: { content: string } }> = [];

function installNaverMapsMock() {
  class MapMock {
    setCenter = vi.fn();
    setZoom = mapSetZoom;
    getZoom = () => 14;
  }

  class MarkerMock {
    constructor(options?: { title?: string; icon?: { content: string } }) {
      if (options) {
        markerOptions.push(options);
      }
    }

    setMap = vi.fn();
    setIcon = vi.fn();
    setPosition = vi.fn();
    setZIndex = vi.fn();
  }

  class PolylineMock {
    setMap = vi.fn();
  }

  window.naver = {
    maps: {
      LatLng: class {},
      Point: class {},
      Position: { BOTTOM_RIGHT: 'bottom-right' },
      Map: MapMock,
      Marker: MarkerMock,
      Polyline: PolylineMock,
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

const comparisonApartmentOne = {
  id: 'apt-2',
  name: 'Compare Apartment One',
  address: 'Seoul 2',
  latitude: 37.521,
  longitude: 126.861,
};

const comparisonApartmentTwo = {
  id: 'apt-3',
  name: 'Compare Apartment Two',
  address: 'Seoul 3',
  latitude: 37.522,
  longitude: 126.862,
};

describe('NaverMapPreview', () => {
  beforeEach(() => {
    mapSetZoom.mockClear();
    markerClickListeners.length = 0;
    markerOptions.length = 0;
    installNaverMapsMock();
    vi.mocked(searchApartments).mockResolvedValue([apartment]);
    vi.mocked(getNearbyFeatures).mockResolvedValue({
      apartment,
      radius_m: 1000,
      categories: ['school', 'kids', 'park', 'hospital', 'crosswalk', 'signal', 'cctv'],
      summary: [],
      features: [],
    });
    vi.mocked(compareApartments).mockResolvedValue({
      base: apartment,
      radius_m: 1000,
      categories: ['kids', 'school', 'crosswalk', 'signal', 'cctv', 'risk'],
      base_metrics: {
        kids: 10,
        school: 2,
        crosswalk: 8,
        signal: 4,
        cctv: 20,
        risk: 1,
      },
      targets: [
        {
          apartment: comparisonApartmentOne,
          metrics: {
            kids: 30,
            school: 5,
            crosswalk: 15,
            signal: 7,
            cctv: 50,
            risk: 0,
          },
          summary: 'Compare Apartment One은 교육·돌봄 선택지 많음 조건이 Test Apartment보다 더 두드러집니다.',
          insights: [
            {
              category: 'education',
              title: '교육·돌봄 선택지 많음',
              description: '기준 아파트보다 1km 이내 어린이시설 또는 학교 수가 더 많습니다.',
              tone: 'positive',
              metric_codes: ['kids', 'school'],
            },
          ],
        },
      ],
      metrics: [
        {
          code: 'kids',
          label: '어린이시설',
          unit: '곳',
          base_count: 10,
          targets: [
            {
              apartment_id: comparisonApartmentOne.id,
              count: 30,
              diff: 20,
              comparison: 'target_more',
              label: '돌봄·놀이 선택지 많음',
              tone: 'positive',
            },
          ],
        },
      ],
      summary: ['Compare Apartment One은 교육·돌봄 선택지 많음 조건이 Test Apartment보다 더 두드러집니다.'],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete window.naver;
  });

  it('loads only the selected apartment nearby facilities within 1km', async () => {
    render(<NaverMapPreview />);

    await waitFor(() => {
      expect(searchApartments).toHaveBeenCalledWith('', 1000);
    });

    fireEvent.click(await screen.findByRole('button', { name: /Test Apartment/ }));

    await waitFor(() => {
      expect(getNearbyFeatures).toHaveBeenCalledWith(
        'apt-1',
        ['school', 'kids', 'park', 'hospital', 'crosswalk', 'signal', 'cctv'],
        1000,
      );
    });
    expect(getNearbyFeatures).toHaveBeenCalledWith('apt-1', ['park'], 3000);
  });

  it('zooms in when an apartment is selected and restores the zoom when its marker is clicked again', async () => {
    render(<NaverMapPreview />);

    fireEvent.click(await screen.findByRole('button', { name: /Test Apartment/ }));
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

  it('enables comparison with one target and blocks adding more than two targets', async () => {
    vi.mocked(searchApartments).mockResolvedValue([
      apartment,
      comparisonApartmentOne,
      comparisonApartmentTwo,
    ]);

    renderMap();

    const sidebarSearchInput = screen.getByPlaceholderText('아파트 이름을 입력하세요');
    const sidebarSearchForm = sidebarSearchInput.closest('form') as HTMLElement;
    fireEvent.change(sidebarSearchInput, { target: { value: 'Test' } });
    fireEvent.click(await within(sidebarSearchForm).findByRole('option', { name: /Test Apartment/ }));

    fireEvent.click(screen.getByRole('button', { name: /비교 결과.*0 \/ 2/ }));
    const compareSection = await screen.findByLabelText('비교 결과 빠른 패널');
    let resultButton = within(compareSection).getByRole('button', { name: '비교 분석 시작' });
    expect(resultButton).toBeDisabled();

    fireEvent.click(within(compareSection).getByRole('button', { name: '+ 비교 단지 추가' }));
    expect(screen.getByText('비교할 아파트를 선택하세요')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('비교할 아파트 이름을 입력하세요')).toBeInTheDocument();

    fireEvent.change(sidebarSearchInput, { target: { value: 'Compare' } });
    fireEvent.click(await within(sidebarSearchForm).findByRole('option', { name: /Compare Apartment One/ }));
    fireEvent.click(screen.getByRole('button', { name: '비교함에 담기' }));
    let updatedCompareSection = await screen.findByLabelText('비교 결과 빠른 패널');
    expect(within(updatedCompareSection).getByRole('button', { name: /비교 결과.*1 \/ 2/ })).toBeInTheDocument();
    expect(within(updatedCompareSection).getByText(comparisonApartmentOne.name)).toBeInTheDocument();
    resultButton = within(updatedCompareSection).getByRole('button', { name: '비교 분석 시작' });
    expect(resultButton).toBeEnabled();

    fireEvent.click(within(updatedCompareSection).getByRole('button', { name: '+ 비교 단지 추가' }));
    fireEvent.change(sidebarSearchInput, { target: { value: 'Compare' } });
    fireEvent.click(await within(sidebarSearchForm).findByRole('option', { name: /Compare Apartment Two/ }));
    fireEvent.click(screen.getByRole('button', { name: '비교함에 담기' }));
    updatedCompareSection = await screen.findByLabelText('비교 결과 빠른 패널');
    expect(within(updatedCompareSection).getByRole('button', { name: /비교 결과.*2 \/ 2/ })).toBeInTheDocument();
    expect(within(updatedCompareSection).getByText(comparisonApartmentTwo.name)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '최대 2개까지 비교 가능' })).toBeDisabled();
  });

  it('opens a comparison result panel from the sidebar compare action', async () => {
    vi.mocked(searchApartments).mockResolvedValue([
      apartment,
      comparisonApartmentOne,
    ]);

    renderMap();

    const sidebarSearchInput = screen.getByPlaceholderText('아파트 이름을 입력하세요');
    const sidebarSearchForm = sidebarSearchInput.closest('form') as HTMLElement;
    fireEvent.change(sidebarSearchInput, { target: { value: 'Test' } });
    fireEvent.click(await within(sidebarSearchForm).findByRole('option', { name: /Test Apartment/ }));

    fireEvent.click(screen.getByRole('button', { name: /비교 결과.*0 \/ 2/ }));
    const compareSection = await screen.findByLabelText('비교 결과 빠른 패널');
    fireEvent.click(within(compareSection).getByRole('button', { name: '+ 비교 단지 추가' }));
    fireEvent.change(sidebarSearchInput, { target: { value: 'Compare' } });
    fireEvent.click(await within(sidebarSearchForm).findByRole('option', { name: /Compare Apartment One/ }));
    fireEvent.click(screen.getByRole('button', { name: '비교함에 담기' }));
    const updatedCompareSection = await screen.findByLabelText('비교 결과 빠른 패널');
    fireEvent.click(within(updatedCompareSection).getByRole('button', { name: '비교 분석 시작' }));

    const resultSummary = await screen.findByLabelText('비교 결과 요약');
    expect(compareApartments).toHaveBeenCalledWith('apt-1', ['apt-2'], 1000);
    expect(within(resultSummary).getByText(/Compare Apartment One.*Test Apartment/)).toBeInTheDocument();

    await waitFor(() => {
      expect(markerOptions.some((option) => option.title === comparisonApartmentOne.name)).toBe(true);
    });

    fireEvent.click(within(resultSummary).getByRole('button', { name: /어린이시설 지도 보기/ }));

    await waitFor(() => {
      expect(getNearbyFeatures).toHaveBeenCalledWith('apt-2', ['kids'], 1000);
    });
    expect(screen.getByText('비교 근거: 어린이시설 · 기준/비교 아파트 1km 이내')).toBeInTheDocument();
  });
});
