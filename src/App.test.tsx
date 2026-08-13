import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import App from './App';
import { AuthProvider } from './features/auth/AuthContext';

function renderApp() {
  return render(
    <AuthProvider>
      <App />
    </AuthProvider>,
  );
}

const healthResponse = {
  status: 'ok',
  service: 'WhyHouse Backend',
  environment: 'test',
  version: '0.1.0',
};

describe('App', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (typeof url === 'string' && (url.includes('/api/v1/family-map') || url.includes('/api/v1/apartments') || url.includes('/api/apartments'))) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              items: [
                { id: '1', name: '목동신시가지 7단지 아파트', latitude: 37.525, longitude: 126.872 },
                { id: '2', name: '목동신시가지 1단지 아파트', latitude: 37.530, longitude: 126.875 },
                { id: '3', name: '목동신시가지 2단지 아파트', latitude: 37.528, longitude: 126.874 },
                { id: '4', name: '목동신시가지 13단지 아파트', latitude: 37.518, longitude: 126.868 },
              ],
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => healthResponse,
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the frontend entry screen and backend health status', async () => {
    renderApp();

    expect(screen.getByRole('heading', { name: /어떤 시선으로\s*집을 볼까요/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /왜집의 입장노트/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /이집 어때요/ })).toBeInTheDocument();
  });

  it('routes to the family map page', async () => {
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: /이집 어때요/ }));

    await waitFor(() => {
      expect(screen.getByRole('complementary', { name: '아파트 선택과 비교' })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /왜집의 임장노트/ })).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText('아파트 이름을 입력하세요');
    const searchForm = searchInput.closest('form') as HTMLElement;
    fireEvent.change(searchInput, { target: { value: '7단지' } });

    expect(await within(searchForm).findByRole('option', { name: /목동신시가지 7단지 아파트/ })).toBeInTheDocument();
    expect(within(searchForm).queryByRole('option', { name: /목동신시가지 13단지 아파트/ })).not.toBeInTheDocument();

    fireEvent.click(within(searchForm).getByRole('option', { name: /목동신시가지 7단지 아파트/ }));

    expect(screen.getByText('무엇을 지도에서 볼까요?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /아파트 다시 선택/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /CCTV/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /CCTV/ }));
    expect(screen.getByRole('button', { name: /CCTV/ })).toHaveClass('facility-filter--active');
    expect(screen.getByText('이 아파트 주변을 살펴보고 있어요')).toBeInTheDocument();
  });
});
