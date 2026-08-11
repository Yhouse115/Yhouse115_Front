import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import App from './App';

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
    render(<App />);

    expect(screen.getByRole('heading', { name: /집을 고르는 두 가지 관점/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /왜집의 입장노트/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /이집 어때요/ })).toBeInTheDocument();
  });

  it('routes to the family map page', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /이집 어때요/ }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /기본 지도를 먼저 확인해요/ })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: '위성' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '지형' })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Backend connected')).toBeInTheDocument();
    });
  });
});
