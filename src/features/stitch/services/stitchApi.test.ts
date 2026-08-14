import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchBuildingDetail, normalizeBuildingDisplayName } from './stitchApi';

const VALID_PNU = '1147010200109050000';
const MOKDONG_1_PNU = '1147010200109010000';

describe('fetchBuildingDetail', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects an invalid PNU before requesting the backend', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchBuildingDetail('invalid')).rejects.toThrow('숫자 19자리');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps a valid wrapped backend response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 200,
      message: 'SUCCESS',
      data: {
        buildingInfo: { pnu: VALID_PNU, buildingName: '테스트 단지' },
        unitTypes: [{ exclusiveArea: 84, pyungType: 34, householdCount: 10 }],
        recentTrades: [],
        priceTrends: [],
      },
    }), { status: 200 })));

    const result = await fetchBuildingDetail(VALID_PNU);
    expect(result.buildingInfo.buildingName).toBe('테스트 단지');
    expect(result.unitTypes[0].exclusiveArea).toBe(84);
  });

  it('rejects malformed numeric fields instead of producing NaN', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: {
        buildingInfo: { pnu: VALID_PNU },
        unitTypes: [{ exclusiveArea: '84', pyungType: 34, householdCount: 10 }],
      },
    }), { status: 200 })));

    await expect(fetchBuildingDetail(VALID_PNU)).rejects.toThrow('exclusiveArea');
  });

  it('returns isolated mock building info in sample mode', async () => {
    const result = await fetchBuildingDetail(VALID_PNU, true);
    expect(result.buildingInfo.pnu).toBe(VALID_PNU);
    expect(result.unitTypes.length).toBeGreaterThan(0);
  });
});

describe('normalizeBuildingDisplayName', () => {
  it('PNU와 실거래 이름으로 목동 신시가지 단지만 보정한다', () => {
    expect(normalizeBuildingDisplayName('목동신시가지아파트', MOKDONG_1_PNU)).toBe('신시가지아파트1단지');
    expect(normalizeBuildingDisplayName('목동신시가지1', MOKDONG_1_PNU)).toBe('신시가지아파트1단지');
    expect(normalizeBuildingDisplayName('삼성빌라3', MOKDONG_1_PNU)).toBe('삼성빌라3');
  });
});
