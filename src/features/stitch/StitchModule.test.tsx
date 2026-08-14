import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StitchDongPanel } from './components/StitchDongPanel';
import { StitchBuildingPanel } from './components/StitchBuildingPanel';
import { StitchSandboxPage } from '../../pages/StitchSandboxPage';

describe('Stitch FE Module Tests', () => {
  it('StitchDongPanel renders Mok2Dong data with adminDongCode', async () => {
    render(<StitchDongPanel adminDongCode="1147010200" dongName="목2동" useMockFallback={true} />);

    expect(screen.getByText('서울특별시 양천구')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('목2동')).toBeInTheDocument();
    });
  });

  it('StitchBuildingPanel renders Shinsigaja 5th data with PNU', async () => {
    render(<StitchBuildingPanel pnu="1147010200109050000" buildingName="목동신시가지 5단지" useMockFallback={true} />);

    await waitFor(() => {
      expect(screen.getByText('목동신시가지 5단지')).toBeInTheDocument();
      expect(screen.queryByText('Stitch 단지 데이터 로딩 중...')).not.toBeInTheDocument();
    });
  });

  it('StitchSandboxPage triggers modules via test buttons', async () => {
    render(<StitchSandboxPage />);

    // 단위 테스트에서는 외부 백엔드 대신 샘플 데이터 모드를 사용한다.
    fireEvent.click(screen.getByRole('checkbox'));

    const dongBtn = screen.getByText('[신정1동 (DB실데이터)] 조회하기 →');
    fireEvent.click(dongBtn);

    await waitFor(() => {
      expect(screen.getByText('신정1동')).toBeInTheDocument();
    });

    const closeBtn = screen.getByLabelText('닫기');
    fireEvent.click(closeBtn);

    const bldBtn = screen.getByText('[신시가지아파트1단지 (DB실데이터)] →');
    fireEvent.click(bldBtn);

    await waitFor(() => {
      expect(screen.getByText('신시가지아파트1단지')).toBeInTheDocument();
    });
  });
});
