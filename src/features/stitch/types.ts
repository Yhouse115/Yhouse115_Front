/**
 * Stitch FE 모듈 인터페이스 및 DTO 타입 정의
 */

export interface StitchDongPanelProps {
  adminDongCode: string;
  dongName?: string;
  onClose?: () => void;
  useMockFallback?: boolean;
}

export interface StitchBuildingPanelProps {
  pnu: string;
  buildingName?: string;
  onClose?: () => void;
  useMockFallback?: boolean;
}

export interface UnitSizeStat {
  category: '소형' | '중형' | '대형';
  exclusiveAreaRange: string;
  avgTradePrice?: number | null;
  priceChangeRate?: number | null;
  medianPyeongPrice?: number | null;
  medianPrice?: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  tradeCount: number;
  avgRentDeposit?: number | null;
  rentChangeRate?: number | null;
  medianRentPyeongPrice?: number | null;
  rentCount: number;
}

export interface DongSummaryData {
  adminDongCode: string;
  adminDongName: string;
  comparisonMode?: 'prev_period' | 'yoy';
  inventory: {
    aptCount: number;
    villaCount: number;
    officetelCount: number;
    totalCount: number;
  };
  priceTrends: {
    periodMonths: number;
    avgTradePrice: number; // 만원 단위
    avgRentPrice: number; // 만원 단위
    tradePriceChangeRate: number; // %
    jeonseRate: number; // %
  };
  baseDongStats?: {
    avgTradePrice?: number | null;
    medianTradePrice?: number | null;
    priceChangeRate?: number | null;
    medianPyeongPrice?: number | null;
    avgRentDeposit?: number | null;
    medianRentDeposit?: number | null;
    rentChangeRate?: number | null;
    medianRentPyeongPrice?: number | null;
    jeonseRatio?: number | null;
  };
  unitSizeStats?: UnitSizeStat[];
  neighborComparison: {
    dongName: string;
    avgPrice: number;
    jeonseRate: number;
  }[];
}

export interface BuildingSummaryData {
  pnu: string;
  buildingName: string;
  address: string;
  buildYear: number;
  totalUnits: number;
  totalBuildings: number;
  latestTradePrice: number; // 만원 단위 (e.g. 185000 = 18억 5,000만원)
  latestTradeDate: string; // e.g. "2026.02.10"
  tradePriceChangeRate: number; // % (e.g. 3.2)
  jeonseRate: number; // % (e.g. 52.4)
  estimatedRentDeposit: number; // 만원 단위
  estimatedMonthlyRent: number; // 만원 단위
  unitTypes: {
    name: string; // e.g. "84㎡ (34평)"
    units: number;
    tradePrice: number;
    rentPrice: number;
  }[];
  recentTransactions: {
    date: string;
    tradeType: '매매' | '전세' | '월세';
    area: number;
    floor: number;
    price: string;
  }[];
  developmentInfo?: {
    projectName: string;
    stageName: string;
    stageStep: number; // 1~6
    updatedAt: string;
  };
}
