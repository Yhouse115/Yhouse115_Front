import { DongSummaryData, BuildingSummaryData, BuildingDetailData } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const MOKDONG_NEW_TOWN_DANJI_BY_MAIN_JIBUN: Record<string, number> = {
  '901': 1, '902': 2, '903': 3, '904': 4, '912': 5, '911': 6, '925': 7,
  '314': 8, '312': 9, '311': 10, '325': 11, '326': 12, '327': 13, '329': 14,
};

/** 목동 신시가지 계열에만 적용한다. 빌라·일반 공동주택 이름은 원문을 유지한다. */
export function normalizeBuildingDisplayName(name: string | null, pnu: string): string | null {
  if (!name) return name;
  const compact = name.replace(/\s/g, '');
  const namedDanji = compact.match(/^목동신시가지(?:아파트)?(\d+)(?:단지)?$/);
  if (namedDanji) return `신시가지아파트${namedDanji[1]}단지`;

  if (compact === '목동신시가지아파트') {
    const mainJibun = pnu.slice(11, 15).replace(/^0+/, '');
    const danji = MOKDONG_NEW_TOWN_DANJI_BY_MAIN_JIBUN[mainJibun];
    if (danji) return `신시가지아파트${danji}단지`;
  }
  return name;
}

function mokdongNewTownNameFromPnu(pnu: string): string | null {
  const mainJibun = pnu.slice(11, 15).replace(/^0+/, '');
  const danji = MOKDONG_NEW_TOWN_DANJI_BY_MAIN_JIBUN[mainJibun];
  return danji ? `신시가지아파트${danji}단지` : null;
}

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

// ─────────────────────────────────────────────────────────────────────────────
// Mock 데이터: 목동신시가지 5단지 (BuildingDetailData)
// ─────────────────────────────────────────────────────────────────────────────
export const MOCK_BUILDING_DETAIL_5DANJI: BuildingDetailData = {
  buildingInfo: {
    pnu: '1147010200109050000',
    buildingName: '목동신시가지 5단지',
    buildingType: 'APT',
    adminDongCode: '1147010200',
    adminDongName: '목2동',
    legalDongCode: '1147010200',
    legalDongName: '목동',
    jibunAddress: '서울특별시 양천구 목동 905',
    jibun: '905',
    totalHouseholds: 1848,
    totalParking: 2150,
    parkingPerHousehold: 1.16,
    useApprovalDate: '1986-12-30',
    buildYear: 1986,
    buildingAge: 39,
  },
  unitTypes: [
    { exclusiveArea: 65.0,  pyungType: 26, householdCount: 410, recentTradePrice: 162000, priceChangeRate: 3.1, pricePerPyeong: 6231, pricePerM2: 2492, maxTradePrice: 168000, minTradePrice: 155000, recentRentDeposit: 72000,  jeonseRatio: 44.4 },
    { exclusiveArea: 84.0,  pyungType: 34, householdCount: 720, recentTradePrice: 215000, priceChangeRate: 3.8, pricePerPyeong: 6324, pricePerM2: 2560, maxTradePrice: 225000, minTradePrice: 205000, recentRentDeposit: 95000,  jeonseRatio: 44.2 },
    { exclusiveArea: 115.0, pyungType: 45, householdCount: 480, recentTradePrice: 278000, priceChangeRate: 2.9, pricePerPyeong: 6178, pricePerM2: 2417, maxTradePrice: 290000, minTradePrice: 265000, recentRentDeposit: 125000, jeonseRatio: 44.9 },
    { exclusiveArea: 142.0, pyungType: 55, householdCount: 238, recentTradePrice: 335000, priceChangeRate: 2.2, pricePerPyeong: 6091, pricePerM2: 2359, maxTradePrice: 348000, minTradePrice: 320000, recentRentDeposit: 150000, jeonseRatio: 44.8 },
  ],
  recentTrades: [
    { id: 'TR_001', tradeType: 'TRADE',   dealDate: '2026-02-08', floor: 9,  exclArea: 84,  dealAmount: 215000, monthlyRent: null, pricePerM2: 2560 },
    { id: 'TR_002', tradeType: 'JEONSE',  dealDate: '2026-02-01', floor: 5,  exclArea: 84,  dealAmount: 95000,  monthlyRent: null, pricePerM2: null },
    { id: 'TR_003', tradeType: 'TRADE',   dealDate: '2026-01-25', floor: 12, exclArea: 115, dealAmount: 276000, monthlyRent: null, pricePerM2: 2400 },
    { id: 'TR_004', tradeType: 'TRADE',   dealDate: '2026-01-18', floor: 3,  exclArea: 65,  dealAmount: 161000, monthlyRent: null, pricePerM2: 2477 },
    { id: 'TR_005', tradeType: 'MONTHLY', dealDate: '2026-01-12', floor: 8,  exclArea: 84,  dealAmount: 10000,  monthlyRent: 280,  pricePerM2: null },
    { id: 'TR_006', tradeType: 'TRADE',   dealDate: '2025-12-28', floor: 7,  exclArea: 84,  dealAmount: 210000, monthlyRent: null, pricePerM2: 2500 },
    { id: 'TR_007', tradeType: 'JEONSE',  dealDate: '2025-12-20', floor: 4,  exclArea: 65,  dealAmount: 70000,  monthlyRent: null, pricePerM2: null },
    { id: 'TR_008', tradeType: 'TRADE',   dealDate: '2025-12-15', floor: 15, exclArea: 142, dealAmount: 340000, monthlyRent: null, pricePerM2: 2394 },
    { id: 'TR_009', tradeType: 'TRADE',   dealDate: '2025-11-30', floor: 6,  exclArea: 84,  dealAmount: 208000, monthlyRent: null, pricePerM2: 2476 },
    { id: 'TR_010', tradeType: 'JEONSE',  dealDate: '2025-11-22', floor: 10, exclArea: 115, dealAmount: 122000, monthlyRent: null, pricePerM2: null },
    { id: 'TR_011', tradeType: 'TRADE',   dealDate: '2025-11-10', floor: 2,  exclArea: 65,  dealAmount: 157000, monthlyRent: null, pricePerM2: 2415 },
    { id: 'TR_012', tradeType: 'MONTHLY', dealDate: '2025-10-25', floor: 5,  exclArea: 65,  dealAmount: 5000,   monthlyRent: 150,  pricePerM2: null },
  ],
  priceTrends: [
    { yearMonth: '2025-03', avgTradeAmount: 190000, tradeCount: 6,  avgRentDeposit: 85000, rentCount: 4 },
    { yearMonth: '2025-04', avgTradeAmount: 193000, tradeCount: 8,  avgRentDeposit: 86000, rentCount: 5 },
    { yearMonth: '2025-05', avgTradeAmount: 196000, tradeCount: 7,  avgRentDeposit: 87000, rentCount: 6 },
    { yearMonth: '2025-06', avgTradeAmount: 198000, tradeCount: 9,  avgRentDeposit: 88000, rentCount: 4 },
    { yearMonth: '2025-07', avgTradeAmount: 200000, tradeCount: 11, avgRentDeposit: 89000, rentCount: 7 },
    { yearMonth: '2025-08', avgTradeAmount: 203000, tradeCount: 10, avgRentDeposit: 90000, rentCount: 5 },
    { yearMonth: '2025-09', avgTradeAmount: 205000, tradeCount: 8,  avgRentDeposit: 91000, rentCount: 6 },
    { yearMonth: '2025-10', avgTradeAmount: 208000, tradeCount: 12, avgRentDeposit: 92000, rentCount: 8 },
    { yearMonth: '2025-11', avgTradeAmount: 210000, tradeCount: 9,  avgRentDeposit: 92500, rentCount: 5 },
    { yearMonth: '2025-12', avgTradeAmount: 212000, tradeCount: 7,  avgRentDeposit: 93000, rentCount: 4 },
    { yearMonth: '2026-01', avgTradeAmount: 213000, tradeCount: 10, avgRentDeposit: 94000, rentCount: 6 },
    { yearMonth: '2026-02', avgTradeAmount: 215000, tradeCount: 5,  avgRentDeposit: 95000, rentCount: 3 },
  ],
};

/**
 * 건물 PNU를 통한 건물 상세 종합 데이터 로딩 (BuildingDetailData)
 * BE: GET /api/v1/buildings/{pnu}/summary
 */
export async function fetchBuildingDetail(
  pnu: string,
  useMockFallback = false,
  signal?: AbortSignal
): Promise<BuildingDetailData> {
  if (!/^\d{19}$/.test(pnu)) {
    throw new Error('PNU는 숫자 19자리여야 합니다.');
  }

  if (!useMockFallback) {
    try {
      const url = `${API_BASE_URL}/api/v1/buildings/${encodeURIComponent(pnu)}/summary`;
      const res = await fetch(url, { signal });
      if (!res.ok) {
        let errDetail = `HTTP ${res.status}`;
        try {
          const errJson = await res.json();
          if (errJson.detail) errDetail = errJson.detail;
        } catch {}
        throw new Error(`백엔드 API 응답 오류: ${errDetail}`);
      }
      const json: unknown = await res.json();
      if (!json || typeof json !== 'object') {
        throw new Error('백엔드 API 응답 형식이 올바르지 않습니다.');
      }
      const wrapper = json as Record<string, unknown>;
      const payload = (wrapper.data ?? wrapper) as Record<string, unknown>;
      if (!payload?.buildingInfo) {
        throw new Error(`PNU(${pnu})에 해당하는 건축물 데이터를 찾을 수 없습니다.`);
      }
      const info = payload.buildingInfo as Record<string, unknown>;
      const arrayField = (name: string): Record<string, unknown>[] => {
        const value = payload[name];
        if (value == null) return [];
        if (!Array.isArray(value)) throw new Error(`백엔드 API의 ${name} 필드가 배열이 아닙니다.`);
        return value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object');
      };
      const requiredNumber = (value: unknown, field: string): number => {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          throw new Error(`백엔드 API의 ${field} 값이 올바르지 않습니다.`);
        }
        return value;
      };
      const requiredString = (value: unknown, field: string): string => {
        if (typeof value !== 'string' || value.length === 0) {
          throw new Error(`백엔드 API의 ${field} 값이 올바르지 않습니다.`);
        }
        return value;
      };
      const nullableNumber = (value: unknown, field: string): number | null => {
        if (value == null) return null;
        return requiredNumber(value, field);
      };
      const nullableString = (value: unknown, field: string): string | null => {
        if (value == null) return null;
        return requiredString(value, field);
      };
      const unitTypes = arrayField('unitTypes').map((ut) => ({
        exclusiveArea: requiredNumber(ut.exclusiveArea, 'unitTypes.exclusiveArea'),
        pyungType: requiredNumber(ut.pyungType, 'unitTypes.pyungType'),
        householdCount: requiredNumber(ut.householdCount, 'unitTypes.householdCount'),
        recentTradePrice: nullableNumber(ut.recentTradePrice, 'unitTypes.recentTradePrice'),
        priceChangeRate: nullableNumber(ut.priceChangeRate, 'unitTypes.priceChangeRate'),
        pricePerPyeong: nullableNumber(ut.pricePerPyeong, 'unitTypes.pricePerPyeong'),
        pricePerM2: nullableNumber(ut.pricePerM2, 'unitTypes.pricePerM2'),
        maxTradePrice: nullableNumber(ut.maxTradePrice, 'unitTypes.maxTradePrice'),
        minTradePrice: nullableNumber(ut.minTradePrice, 'unitTypes.minTradePrice'),
        recentRentDeposit: nullableNumber(ut.recentRentDeposit, 'unitTypes.recentRentDeposit'),
        jeonseRatio: nullableNumber(ut.jeonseRatio, 'unitTypes.jeonseRatio'),
      }));
      const recentTrades = arrayField('recentTrades').map((t) => ({
        id: requiredString(t.id, 'recentTrades.id'),
        tradeType: requiredString(t.tradeType, 'recentTrades.tradeType'),
        dealDate: requiredString(t.dealDate, 'recentTrades.dealDate'), floor: nullableNumber(t.floor, 'recentTrades.floor'),
        exclArea: requiredNumber(t.exclArea, 'recentTrades.exclArea'), dealAmount: nullableNumber(t.dealAmount, 'recentTrades.dealAmount'),
        monthlyRent: nullableNumber(t.monthlyRent, 'recentTrades.monthlyRent'), pricePerM2: nullableNumber(t.pricePerM2, 'recentTrades.pricePerM2'),
      }));
      const priceTrends = arrayField('priceTrends').map((pt) => ({
        yearMonth: requiredString(pt.yearMonth, 'priceTrends.yearMonth'), avgTradeAmount: nullableNumber(pt.avgTradeAmount, 'priceTrends.avgTradeAmount'),
        tradeCount: nullableNumber(pt.tradeCount, 'priceTrends.tradeCount') ?? 0,
        avgRentDeposit: nullableNumber(pt.avgRentDeposit, 'priceTrends.avgRentDeposit'),
        rentCount: nullableNumber(pt.rentCount, 'priceTrends.rentCount') ?? 0,
      }));
      return {
        buildingInfo: {
          pnu: requiredString(info.pnu, 'buildingInfo.pnu'),
          buildingName: normalizeBuildingDisplayName(
            nullableString(info.buildingName, 'buildingInfo.buildingName'),
            requiredString(info.pnu, 'buildingInfo.pnu')
          ),
          buildingType: nullableString(info.buildingType, 'buildingInfo.buildingType'),
          adminDongCode: nullableString(info.adminDongCode, 'buildingInfo.adminDongCode'),
          adminDongName: nullableString(info.adminDongName, 'buildingInfo.adminDongName'),
          legalDongCode: nullableString(info.legalDongCode, 'buildingInfo.legalDongCode'),
          legalDongName: nullableString(info.legalDongName, 'buildingInfo.legalDongName'),
          jibunAddress: nullableString(info.jibunAddress, 'buildingInfo.jibunAddress'),
          jibun: nullableString(info.jibun, 'buildingInfo.jibun'),
          totalHouseholds: nullableNumber(info.totalHouseholds, 'buildingInfo.totalHouseholds'),
          totalParking: nullableNumber(info.totalParking, 'buildingInfo.totalParking'),
          parkingPerHousehold: nullableNumber(info.parkingPerHousehold, 'buildingInfo.parkingPerHousehold'),
          useApprovalDate: nullableString(info.useApprovalDate, 'buildingInfo.useApprovalDate'),
          buildYear: nullableNumber(info.buildYear, 'buildingInfo.buildYear'),
          buildingAge: nullableNumber(info.buildingAge, 'buildingInfo.buildingAge'),
        },
        unitTypes, recentTrades, priceTrends,
      };
    } catch (err: unknown) {
      console.warn('Building detail API fetch error:', err);
      throw err;
    }
  }
  // Mock 데이터 반환
  return {
    ...MOCK_BUILDING_DETAIL_5DANJI,
    buildingInfo: {
      ...MOCK_BUILDING_DETAIL_5DANJI.buildingInfo,
      pnu,
      buildingName: mokdongNewTownNameFromPnu(pnu) || MOCK_BUILDING_DETAIL_5DANJI.buildingInfo.buildingName,
    },
  };
}
