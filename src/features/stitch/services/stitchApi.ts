import { DongSummaryData, BuildingSummaryData } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * 목2동 (1147010200) Mock 데이터
 */
export const MOCK_MOK2_DONG_DATA: DongSummaryData = {
  adminDongCode: '1147010200',
  adminDongName: '양천구 목2동',
  inventory: {
    aptCount: 42,
    villaCount: 188,
    officetelCount: 15,
    totalCount: 245,
  },
  priceTrends: {
    periodMonths: 6,
    avgTradePrice: 138000,
    avgRentPrice: 72000,
    tradePriceChangeRate: 2.4,
    jeonseRate: 52.1,
  },
  neighborComparison: [
    { dongName: '목2동 (기준)', avgPrice: 138000, jeonseRate: 52.1 },
    { dongName: '목1동', avgPrice: 192000, jeonseRate: 48.5 },
    { dongName: '목3동', avgPrice: 115000, jeonseRate: 55.2 },
    { dongName: '목5동', avgPrice: 215000, jeonseRate: 46.8 },
  ],
};

/**
 * 목동 신시가지아파트 5단지 Mock 데이터
 */
export const MOCK_SHINSIGAJA_5_DATA: BuildingSummaryData = {
  pnu: '1147010200109050000',
  buildingName: '목동신시가지 5단지',
  address: '서울시 양천구 목동서로 65 (목동 905)',
  buildYear: 1986,
  totalUnits: 1848,
  totalBuildings: 36,
  latestTradePrice: 215000,
  latestTradeDate: '2026.02.08',
  tradePriceChangeRate: 3.8,
  jeonseRate: 44.2,
  estimatedRentDeposit: 95000,
  estimatedMonthlyRent: 280,
  unitTypes: [
    { name: '65㎡ (26평)', units: 410, tradePrice: 162000, rentPrice: 72000 },
    { name: '84㎡ (34평)', units: 720, tradePrice: 215000, rentPrice: 95000 },
    { name: '115㎡ (45평)', units: 480, tradePrice: 278000, rentPrice: 125000 },
    { name: '142㎡ (55평)', units: 238, tradePrice: 335000, rentPrice: 150000 },
  ],
  recentTransactions: [
    { date: '2026.02.08', tradeType: '매매', area: 84, floor: 9, price: '21억 5,000만' },
    { date: '2026.02.01', tradeType: '전세', area: 84, floor: 5, price: '9억 5,000만' },
    { date: '2026.01.25', tradeType: '매매', area: 115, floor: 12, price: '27억 6,000만' },
    { date: '2026.01.18', tradeType: '매매', area: 65, floor: 3, price: '16억 1,000만' },
    { date: '2026.01.12', tradeType: '월세', area: 84, floor: 8, price: '보증금 1억 / 월 280만' },
  ],
  developmentInfo: {
    projectName: '목동 5단지 재건축 정비사업',
    stageName: '정비구역 지정 완료 (신속통합기획)',
    stageStep: 2,
    updatedAt: '2025.11.14',
  },
};

/**
 * 행정동 코드를 통한 동 종합 요약 데이터 로딩
 */
export async function fetchDongSummary(
  adminDongCode: string,
  useMockFallback = true,
  comparisonMode: 'prev_period' | 'yoy' = 'prev_period'
): Promise<DongSummaryData> {
  if (!useMockFallback) {
    try {
      const url = `${API_BASE_URL}/api/v1/summary/trends?admin_dong_code=${encodeURIComponent(
        adminDongCode
      )}&comparison_mode=${comparisonMode}`;
      const res = await fetch(url);

      if (!res.ok) {
        let errDetail = `HTTP ${res.status}`;
        try {
          const errJson = await res.json();
          if (errJson.detail) errDetail = errJson.detail;
        } catch {}
        throw new Error(`백엔드 API 응답 오류: ${errDetail}`);
      }

      const json = await res.json();
      const payload = json.data || json;
      const baseStats = payload.baseDongStats || payload.baseDong;

      if (!baseStats) {
        throw new Error(`행정동 코드(${adminDongCode})에 해당하는 백엔드 데이터가 없습니다.`);
      }

      const neighbors = payload.adjacentDongs || [];

      return {
        adminDongCode: baseStats.adminDongCode || adminDongCode,
        adminDongName: baseStats.adminDongName || payload.adminDongName || `행정동 ${adminDongCode}`,
        comparisonMode: payload.comparisonMode || comparisonMode,
        baseDongStats: baseStats,
        unitSizeStats: baseStats.unitSizeStats || [],
        inventory: {
          aptCount: baseStats.aptCount || 42,
          villaCount: baseStats.villaCount || 188,
          officetelCount: baseStats.officetelCount || 15,
          totalCount: (baseStats.aptCount || 42) + (baseStats.villaCount || 188) + (baseStats.officetelCount || 15),
        },
        priceTrends: {
          periodMonths: payload.periodMonths || 3,
          avgTradePrice: Math.round(baseStats.avgTradePrice || 138000),
          avgRentPrice: Math.round(baseStats.avgRentDeposit || 72000),
          tradePriceChangeRate: baseStats.priceChangeRate || 2.4,
          jeonseRate: baseStats.jeonseRatio || 52.1,
        },
        neighborComparison: [
          {
            dongName: `${baseStats.adminDongName || '기준동'} (기준)`,
            avgPrice: Math.round(baseStats.avgTradePrice || 138000),
            jeonseRate: baseStats.jeonseRatio || 52.1,
          },
          ...neighbors.map((n: any) => ({
            dongName: n.adminDongName || n.dongName,
            avgPrice: Math.round(n.avgTradePrice || 120000),
            jeonseRate: n.jeonseRatio || 50.0,
          })),
        ],
      };
    } catch (err: any) {
      console.warn('Backend API fetch error:', err);
      throw err;
    }
  }

  // Mock 데이터 반환
  return {
    ...MOCK_MOK2_DONG_DATA,
    adminDongCode,
  };
}

/**
 * 건물 PNU를 통한 건물 종합 요약 데이터 로딩
 */
export async function fetchBuildingSummary(
  pnu: string,
  useMockFallback = true
): Promise<BuildingSummaryData> {
  if (!useMockFallback) {
    try {
      const url = `${API_BASE_URL}/api/v1/buildings/${encodeURIComponent(pnu)}/summary`;
      const res = await fetch(url);

      if (!res.ok) {
        let errDetail = `HTTP ${res.status}`;
        try {
          const errJson = await res.json();
          if (errJson.detail) errDetail = errJson.detail;
        } catch {}
        throw new Error(`백엔드 API 응답 오류: ${errDetail}`);
      }

      const json = await res.json();
      const payload = json.data || json;
      const info = payload.buildingInfo;

      if (!info) {
        throw new Error(`PNU(${pnu})에 해당하는 백엔드 건물 데이터를 찾을 수 없습니다.`);
      }

      const unitTypes = payload.unitTypes || [];
      const recentTrades = payload.recentTrades || [];

      const latestTrade = recentTrades.find((t: any) => t.tradeType === 'TRADE') || recentTrades[0];

      return {
        pnu: info.pnu || pnu,
        buildingName: info.buildingName || '알 수 없는 단지',
        address: info.jibunAddress || info.legalDongName || '주소 정보 없음',
        buildYear: info.buildYear || (info.useApprovalDate ? parseInt(info.useApprovalDate.substring(0, 4)) : 1995),
        totalUnits: info.totalHouseholds || 100,
        totalBuildings: info.totalBuildings || 1,
        latestTradePrice: latestTrade?.dealAmount || 150000,
        latestTradeDate: latestTrade?.dealDate || '최근',
        tradePriceChangeRate: unitTypes[0]?.priceChangeRate || 2.5,
        jeonseRate: unitTypes[0]?.jeonseRatio || 50.0,
        estimatedRentDeposit: unitTypes[0]?.recentRentDeposit || 80000,
        estimatedMonthlyRent: 250,
        unitTypes: unitTypes.map((u: any) => ({
          name: `${u.pyungType || Math.round(u.exclusiveArea / 3.3)}평형 (${Math.round(u.exclusiveArea)}㎡)`,
          units: u.householdCount || 50,
          tradePrice: u.recentTradePrice || 150000,
          rentPrice: u.recentRentDeposit || 80000,
        })),
        recentTransactions: recentTrades.map((t: any) => {
          const isTrade = t.tradeType === 'TRADE';
          const typeLabel = isTrade ? '매매' : (t.monthlyRent > 0 ? '월세' : '전세');
          const amt = t.dealAmount || 0;
          const uk = Math.floor(amt / 10000);
          const man = amt % 10000;
          const priceStr = uk > 0 
            ? `${uk}억 ${man > 0 ? man.toLocaleString() + '만' : ''}` 
            : `${man.toLocaleString()}만`;

          return {
            date: t.dealDate || '',
            tradeType: typeLabel as any,
            area: Math.round(t.exclArea || 84),
            floor: t.floor || 1,
            price: t.monthlyRent > 0 ? `보증 ${priceStr} / 월 ${t.monthlyRent}만` : priceStr,
          };
        }),
      };
    } catch (err: any) {
      console.warn('Backend API fetch error:', err);
      throw err;
    }
  }

  // Mock 데이터 반환
  return {
    ...MOCK_SHINSIGAJA_5_DATA,
    pnu,
  };
}
