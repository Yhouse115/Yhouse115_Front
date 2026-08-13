import { fireEvent, render, screen, waitFor } from '@testing-library/react';

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
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => healthResponse,
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

    expect(screen.getByRole('button', { name: /목동신시가지 7단지 아파트/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /목동신시가지 13단지 아파트/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /왜집의 임장노트/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /목동신시가지 7단지 아파트/ }));

    expect(screen.getByText('무엇을 지도에서 볼까요?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /아파트 다시 선택/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /CCTV/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /CCTV/ }));
    expect(screen.getByRole('button', { name: /CCTV/ })).toHaveClass('facility-filter--active');
    expect(screen.getByText('이 아파트 주변을 살펴보고 있어요')).toBeInTheDocument();
  });
});
