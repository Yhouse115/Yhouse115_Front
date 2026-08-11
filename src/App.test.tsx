import { render, screen, waitFor } from '@testing-library/react';

import App from './App';

const healthResponse = {
  status: 'ok',
  service: 'WhyHouse Backend',
  environment: 'test',
  version: '0.1.0',
};

describe('App', () => {
  beforeEach(() => {
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

    expect(screen.getByRole('heading', { name: /아이 관점의 아파트 생활 인프라/ })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Backend connected')).toBeInTheDocument();
    });
  });
});
