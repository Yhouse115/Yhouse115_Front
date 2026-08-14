import { env } from '../config/env';

type ApiEnvelope<T> = {
  data?: T;
};

type TradeItem = {
  dealDate?: string | null;
  exclArea?: number | null;
  dealAmount?: number | null;
};

type RentItem = {
  dealDate?: string | null;
  exclArea?: number | null;
  deposit?: number | null;
};

type ListData<T> = {
  items: T[];
};

type TransactionSeriesItem = {
  yearMonth: string;
  totalCount: number;
  counts?: Record<string, Record<string, number>>;
};

type TransactionCountData = {
  series: TransactionSeriesItem[];
};

export type InvestmentMarketSummary = {
  averageTradeAmount: number | null;
  averageJeonseDeposit: number | null;
  tradeChangeRate: number;
  jeonseChangeRate: number;
  baseTradeAmount: number | null;
  baseJeonseDeposit: number | null;
  recentTradeCount: number;
  recentJeonseCount: number;
  areaRows: Array<{
    label: string;
    range: string;
    averageTradeAmount: number | null;
    averageJeonseDeposit: number | null;
    tradeChangeRate: number;
    baseTradeAmount: number | null;
    baseJeonseDeposit: number | null;
  }>;
  trend: Array<{
    label: string;
    tradeCount: number;
    jeonseCount: number;
  }>;
};

const YANGCHEON_ADMIN_DONG_CODE = '1147051000';

function apiUrl(path: string, params: URLSearchParams) {
  return `${env.apiBaseUrl.replace(/\/$/, '')}${path}?${params.toString()}`;
}

async function getJson<T>(path: string, params: URLSearchParams): Promise<T> {
  const response = await fetch(apiUrl(path, params));
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function dateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function period(months: number) {
  const end = new Date();
  const start = new Date(end);
  start.setMonth(start.getMonth() - months);
  return {
    start: dateInput(start),
    end: dateInput(end),
  };
}

function average(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function changeRate(current: number | null, base: number | null) {
  if (current == null || base == null || base === 0) return 0;
  return Number((((current - base) / base) * 100).toFixed(1));
}

function areaLabel(area?: number | null) {
  if (!area) return '기타';
  if (area < 60) return '소형';
  if (area < 85) return '중형';
  return '대형';
}

function trendRentCount(item: TransactionSeriesItem) {
  return item.counts?.JEONSE?.APT ?? 0;
}

export function formatAmountManwon(value: number | null) {
  if (value == null) return '-';
  if (value >= 10_000) {
    const eok = value / 10_000;
    return `${Number.isInteger(eok) ? eok.toFixed(0) : eok.toFixed(1)}억`;
  }
  return `${value.toLocaleString('ko-KR')}만`;
}

export async function getInvestmentMarketSummary(apartmentName: string): Promise<InvestmentMarketSummary> {
  const current = period(3);
  const previousEnd = new Date(current.start);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setMonth(previousStart.getMonth() - 3);

  const common = {
    building_type: 'APT',
    size: '100',
    page: '1',
    sort: 'deal_date,desc',
  };

  const currentTradeParams = new URLSearchParams({ ...common, period_start: current.start, period_end: current.end, apt_name: apartmentName });
  const currentJeonseParams = new URLSearchParams({ ...common, period_start: current.start, period_end: current.end, rent_type: 'JEONSE', apt_name: apartmentName });
  const previousTradeParams = new URLSearchParams({ ...common, period_start: dateInput(previousStart), period_end: dateInput(previousEnd), apt_name: apartmentName });
  const previousJeonseParams = new URLSearchParams({ ...common, period_start: dateInput(previousStart), period_end: dateInput(previousEnd), rent_type: 'JEONSE', apt_name: apartmentName });
  const trendParams = new URLSearchParams({
    admin_dong_code: YANGCHEON_ADMIN_DONG_CODE,
    period_start: dateInput(previousStart),
    period_end: current.end,
    building_type: 'APT',
  });
  trendParams.append('transaction_type', 'TRADE');
  trendParams.append('transaction_type', 'JEONSE');

  const [
    currentTradesResponse,
    currentJeonseResponse,
    previousTradesResponse,
    previousJeonseResponse,
    trendResponse,
  ] = await Promise.all([
    getJson<ApiEnvelope<ListData<TradeItem>>>('/api/v1/transactions/trades', currentTradeParams),
    getJson<ApiEnvelope<ListData<RentItem>>>('/api/v1/transactions/rents', currentJeonseParams),
    getJson<ApiEnvelope<ListData<TradeItem>>>('/api/v1/transactions/trades', previousTradeParams),
    getJson<ApiEnvelope<ListData<RentItem>>>('/api/v1/transactions/rents', previousJeonseParams),
    getJson<ApiEnvelope<TransactionCountData>>('/api/v1/summary/transaction-count', trendParams),
  ]);

  const currentTrades = currentTradesResponse.data?.items ?? [];
  const currentJeonse = currentJeonseResponse.data?.items ?? [];
  const previousTrades = previousTradesResponse.data?.items ?? [];
  const previousJeonse = previousJeonseResponse.data?.items ?? [];
  const averageTradeAmount = average(currentTrades.map((item) => item.dealAmount));
  const averageJeonseDeposit = average(currentJeonse.map((item) => item.deposit));
  const baseTradeAmount = average(previousTrades.map((item) => item.dealAmount));
  const baseJeonseDeposit = average(previousJeonse.map((item) => item.deposit));
  const areas = [
    { label: '소형', range: '60㎡ 미만' },
    { label: '중형', range: '60~85㎡' },
    { label: '대형', range: '85㎡ 초과' },
  ];

  return {
    averageTradeAmount,
    averageJeonseDeposit,
    tradeChangeRate: changeRate(averageTradeAmount, baseTradeAmount),
    jeonseChangeRate: changeRate(averageJeonseDeposit, baseJeonseDeposit),
    baseTradeAmount,
    baseJeonseDeposit,
    recentTradeCount: currentTrades.length,
    recentJeonseCount: currentJeonse.length,
    areaRows: areas.map(({ label, range }) => {
      const areaTradeAmount = average(currentTrades.filter((item) => areaLabel(item.exclArea) === label).map((item) => item.dealAmount));
      const areaJeonseDeposit = average(currentJeonse.filter((item) => areaLabel(item.exclArea) === label).map((item) => item.deposit));
      const areaBaseTradeAmount = average(previousTrades.filter((item) => areaLabel(item.exclArea) === label).map((item) => item.dealAmount));
      const areaBaseJeonseDeposit = average(previousJeonse.filter((item) => areaLabel(item.exclArea) === label).map((item) => item.deposit));
      return {
        label,
        range,
        averageTradeAmount: areaTradeAmount,
        averageJeonseDeposit: areaJeonseDeposit,
        tradeChangeRate: changeRate(areaTradeAmount, areaBaseTradeAmount),
        baseTradeAmount: areaBaseTradeAmount,
        baseJeonseDeposit: areaBaseJeonseDeposit,
      };
    }),
    trend: (trendResponse.data?.series ?? []).slice(-5).map((item) => ({
      label: item.yearMonth.slice(5).replace('-', '월 '),
      tradeCount: item.totalCount,
      jeonseCount: trendRentCount(item),
    })),
  };
}
