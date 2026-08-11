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
    fireEvent.click(screen.getByRole('button', { name: '지도 설정' }));

    expect(screen.getByRole('dialog', { name: '지도 스타일 설정' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '지도 표시 설정' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /네이버 기본.*Style ID/ })).toHaveClass(
      'style-preset-button--active',
    );
    expect(screen.getByRole('button', { name: /운영 커스텀.*Style ID/ })).toBeInTheDocument();
    const subwayToggle = screen.getByLabelText(/지하철역 표시/);
    expect(subwayToggle).toBeChecked();
    fireEvent.click(subwayToggle);
    expect(subwayToggle).not.toBeChecked();
    expect(screen.getByText(/샘플 지하철역 마커는 숨겨졌습니다/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '운영 표시 기본값으로 되돌리기' }));
    expect(subwayToggle).toBeChecked();
    expect(screen.getByLabelText('지하철역 색상')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '위성' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '지형' })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Backend connected')).toBeInTheDocument();
    });
  });
});
