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
        if (
          typeof url === 'string'
          && (url.includes('/api/v1/family-map') || url.includes('/api/v1/apartments') || url.includes('/api/apartments'))
        ) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              items: [
                { id: '1', name: 'Mokdong test apartment 7', latitude: 37.525, longitude: 126.872 },
                { id: '2', name: 'Mokdong test apartment 1', latitude: 37.530, longitude: 126.875 },
                { id: '3', name: 'Mokdong test apartment 2', latitude: 37.528, longitude: 126.874 },
                { id: '4', name: 'Mokdong test apartment 13', latitude: 37.518, longitude: 126.868 },
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

  it('opens directly on the family map page', async () => {
    const { container } = renderApp();

    await waitFor(() => {
      expect(container.querySelector('.family-map-page')).toBeInTheDocument();
    });

    expect(container.querySelector('.landing-choice')).not.toBeInTheDocument();
  });

  it('keeps the choice page available at /choices and routes to the family map', async () => {
    window.history.pushState({}, '', '/choices');
    const { container } = renderApp();

    expect(container.querySelector('.landing-choice')).toBeInTheDocument();

    const familyCard = container.querySelector('.choice-card--family') as HTMLButtonElement;
    fireEvent.click(familyCard);

    await waitFor(() => {
      expect(container.querySelector('.family-map-page')).toBeInTheDocument();
    });

    expect(container.querySelector('.landing-choice')).not.toBeInTheDocument();
  });

  it('filters and selects apartments on the family map page', async () => {
    renderApp();

    const searchInput = await screen.findByRole('textbox', { name: '사이드바 아파트 검색' });
    const searchForm = searchInput.closest('form') as HTMLElement;
    fireEvent.change(searchInput, { target: { value: '7' } });

    expect(await within(searchForm).findByRole('option', { name: /Mokdong test apartment 7/ })).toBeInTheDocument();
    expect(within(searchForm).queryByRole('option', { name: /Mokdong test apartment 13/ })).not.toBeInTheDocument();

    fireEvent.click(within(searchForm).getByRole('option', { name: /Mokdong test apartment 7/ }));

    expect(screen.getByRole('button', { name: /CCTV/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /CCTV/ }));
    expect(screen.getByRole('button', { name: /CCTV/ })).toHaveClass('facility-filter--active');
  });
});
