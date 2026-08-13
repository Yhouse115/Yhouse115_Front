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

    expect(screen.getByText('시세/동향')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('목동신시가지 5단지')).toBeInTheDocument();
    });
  });

  it('StitchSandboxPage triggers modules via test buttons', async () => {
    render(<StitchSandboxPage />);

    const dongBtn = screen.getByText('[신정1동 (DB실데이터)] 조회하기 →');
    fireEvent.click(dongBtn);

    await waitFor(() => {
      expect(screen.getByText('신정1동')).toBeInTheDocument();
    });

    const closeBtn = screen.getByLabelText('닫기');
    fireEvent.click(closeBtn);

    const bldBtn = screen.getByText('[유원목동아파트 (DB실데이터)] →');
    fireEvent.click(bldBtn);

    await waitFor(() => {
      expect(screen.getByText('유원목동아파트')).toBeInTheDocument();
    });
  });
});
