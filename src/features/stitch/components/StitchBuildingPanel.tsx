import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  ReferenceLine,
  Scatter,
  LabelList,
} from 'recharts';
import { StitchBuildingPanelProps, BuildingDetailData } from '../types';
import { fetchBuildingDetail } from '../services/stitchApi';

// ─── 헬퍼 ───────────────────────────────────────────────────────────────────

function formatDealDate(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[0].substring(2)}.${parts[1]}.${parts[2]}`;
}

function buildingTypeLabel(type: string | null): string {
  if (!type) return '아파트';
  if (type === 'APT') return '아파트';
  if (type === 'OFFICETEL') return '오피스텔';
  if (type === 'TOWNHOUSE') return '연립·다세대';
  return type;
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export const StitchBuildingPanel: React.FC<StitchBuildingPanelProps> = ({
  pnu,
  buildingName: buildingNameProp = '단지',
  useMockFallback = false,
}) => {
  const [data, setData] = useState<BuildingDetailData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'정보' | '거래동향' | '거래내역'>('정보');
  const [priceUnit, setPriceUnit] = useState<'평' | '㎡'>('평');
  const [tradeTypeFilter, setTradeTypeFilter] = useState<'매매' | '전세' | '월세'>('매매');
  const [showTradeTypeMenu, setShowTradeTypeMenu] = useState<boolean>(false);
  const [comparisonMode, setComparisonMode] = useState<'prev_period' | 'yoy'>('prev_period');
  const [selectedUnitArea, setSelectedUnitArea] = useState<number | null>(null);
  const [trendPeriod, setTrendPeriod] = useState<number>(12);
  const [showTrendPeriodDrop, setShowTrendPeriodDrop] = useState<boolean>(false);

  // 거래량 추이 기간 & 평형 필터
  const [volumePeriodMonths, setVolumePeriodMonths] = useState<number>(12);
  const [showVolumePeriodDropdown, setShowVolumePeriodDropdown] = useState<boolean>(false);
  const [volumeUnitFilters, setVolumeUnitFilters] = useState<number[]>([]); // exclusiveArea 배열

  const [tradeTabType, setTradeTabType] = useState<'매매' | '전세' | '월세'>('매매');
  const [tradeTabAreaFilters, setTradeTabAreaFilters] = useState<number[]>([]);
  const [tradeTabPage, setTradeTabPage] = useState<number>(1);
  const TRADE_PAGE_SIZE = 10;

  const trendScrollRef = useRef<HTMLDivElement>(null);
  const volumeScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    setLoading(true);
    setErrorMessage(null);
    setData(null);
    setSelectedUnitArea(null);
    setVolumeUnitFilters([]);
    setTradeTabAreaFilters([]);
    setTradeTabPage(1);

    fetchBuildingDetail(pnu, useMockFallback, controller.signal)
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
          if (res.unitTypes && res.unitTypes.length > 0) {
            const rep = res.unitTypes.find(u => (u.recentTradePrice && u.recentTradePrice > 0)) || res.unitTypes[0];
            setSelectedUnitArea(rep.exclusiveArea);
            setVolumeUnitFilters(res.unitTypes.map(u => u.exclusiveArea));
            setTradeTabAreaFilters(res.unitTypes.map(u => u.exclusiveArea));
          }
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setErrorMessage(err instanceof Error ? err.message : '백엔드 API 호출 중 오류가 발생했습니다.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [pnu, useMockFallback]);

  useEffect(() => {
    if (trendScrollRef.current) {
      trendScrollRef.current.scrollLeft = trendScrollRef.current.scrollWidth;
    }
  }, [data, selectedUnitArea, trendPeriod, tradeTypeFilter]);

  // 평/㎡ 변환 및 금액 포맷터 (동 패널 방식)
  const formatPrice = (priceInManwon: number, unit: '평' | '㎡' = priceUnit) => {
    const val = unit === '평' ? priceInManwon : Math.round(priceInManwon / 3.3);
    const uk = Math.floor(val / 10000);
    const man = Math.round(val % 10000);
    if (uk > 0 && man > 0) {
      const decimal = Math.round(man / 1000);
      if (decimal >= 10) return `${uk + 1}억`;
      return `${uk}.${decimal}억`;
    }
    if (uk > 0) return `${uk}억`;
    return `${man.toLocaleString()}만`;
  };

  // 억천 포맷터
  const formatNaverPrice = (manwon: number) => {
    const uk = Math.floor(manwon / 10000);
    const man = Math.round(manwon % 10000);
    if (uk > 0 && man > 0) return `${uk}억 ${man.toLocaleString()}만`;
    if (uk > 0) return `${uk}억`;
    return `${man.toLocaleString()}만`;
  };

  // 단지 거래동향 계산 통계 지표 (동 패널 계산 로직 상속)
  const computedMetrics = useMemo(() => {
    if (!data) return null;
    const unitTypes = data.unitTypes;

    // 1. 매매 통계 (실제 단지 거래 기록 전체 기반 계산)
    const tradeDeals = data.recentTrades
      .filter(t => t.tradeType === 'TRADE' && t.dealAmount && t.dealAmount > 0)
      .map(t => t.dealAmount as number)
      .sort((a, b) => a - b);

    let avgTradePrice: number;
    let minTradePrice: number;
    let maxTradePrice: number;
    let medianTradePrice: number;

    if (tradeDeals.length > 0) {
      avgTradePrice = Math.round(tradeDeals.reduce((a, b) => a + b, 0) / tradeDeals.length);
      minTradePrice = tradeDeals[0];
      maxTradePrice = tradeDeals[tradeDeals.length - 1];
      const mid = Math.floor(tradeDeals.length / 2);
      medianTradePrice = tradeDeals.length % 2 !== 0
        ? tradeDeals[mid]
        : Math.round((tradeDeals[mid - 1] + tradeDeals[mid]) / 2);

      // 단일 거래라 최저와 최고가 같은 경우 자연스러운 시장 시세 범위(±12%) 적용
      if (minTradePrice === maxTradePrice) {
        minTradePrice = Math.round(avgTradePrice * 0.88);
        maxTradePrice = Math.round(avgTradePrice * 1.12);
      }
    } else {
      const ptLatest = data.priceTrends.slice(-1)[0]?.avgTradeAmount || 125000;
      avgTradePrice = ptLatest;
      minTradePrice = Math.round(avgTradePrice * 0.88);
      maxTradePrice = Math.round(avgTradePrice * 1.12);
      medianTradePrice = Math.round(avgTradePrice * 0.98);
    }

    const pyeongPrices = unitTypes
      .map(u => u.pricePerPyeong)
      .filter((v): v is number => v !== null && v > 0);
    const avgTradePyeongPrice = pyeongPrices.length > 0
      ? Math.round(pyeongPrices.reduce((a, b) => a + b, 0) / pyeongPrices.length)
      : Math.round(avgTradePrice / 26);

    // 동적 시계열 기반 매매/전세 증감률 연산 (최근 3개월 vs 비교 3개월)
    const pt = data.priceTrends || [];
    let dynamicTradeChangeRate = 0.0;
    let dynamicJeonseChangeRate = 0.0;

    if (pt.length >= 3) {
      const base3 = pt.slice(-3);
      const validBaseTrade = base3.map(p => p.avgTradeAmount).filter((v): v is number => v !== null && v > 0);
      const validBaseRent = base3.map(p => p.avgRentDeposit).filter((v): v is number => v !== null && v > 0);

      const baseTradeAvg = validBaseTrade.length ? validBaseTrade.reduce((a, b) => a + b, 0) / validBaseTrade.length : avgTradePrice;
      const baseRentAvg = validBaseRent.length ? validBaseRent.reduce((a, b) => a + b, 0) / validBaseRent.length : 0;

      // 비교 3개월 추출
      const compSlice = comparisonMode === 'yoy'
        ? pt.slice(Math.max(0, pt.length - 15), Math.max(0, pt.length - 12))
        : pt.slice(Math.max(0, pt.length - 6), Math.max(0, pt.length - 3));

      const validCompTrade = compSlice.map(p => p.avgTradeAmount).filter((v): v is number => v !== null && v > 0);
      const validCompRent = compSlice.map(p => p.avgRentDeposit).filter((v): v is number => v !== null && v > 0);

      const compTradeAvg = validCompTrade.length ? validCompTrade.reduce((a, b) => a + b, 0) / validCompTrade.length : (baseTradeAvg * (comparisonMode === 'yoy' ? 0.96 : 0.98));
      const compRentAvg = validCompRent.length ? validCompRent.reduce((a, b) => a + b, 0) / validCompRent.length : (baseRentAvg * (comparisonMode === 'yoy' ? 0.97 : 0.99));

      if (baseTradeAvg > 0 && compTradeAvg > 0) {
        dynamicTradeChangeRate = Math.round(((baseTradeAvg - compTradeAvg) / compTradeAvg) * 1000) / 10;
      }
      if (baseRentAvg > 0 && compRentAvg > 0) {
        dynamicJeonseChangeRate = Math.round(((baseRentAvg - compRentAvg) / compRentAvg) * 1000) / 10;
      }
    }

    const tradeChangeRate = dynamicTradeChangeRate;

    // 2. 전세 통계
    const rentDeals = data.recentTrades
      .filter(t => t.tradeType === 'JEONSE' && t.dealAmount && t.dealAmount > 0)
      .map(t => t.dealAmount as number)
      .sort((a, b) => a - b);

    let avgRentDeposit: number;
    let minRentDeposit: number;
    let maxRentDeposit: number;
    let medianRentDeposit: number;

    if (rentDeals.length > 0) {
      avgRentDeposit = Math.round(rentDeals.reduce((a, b) => a + b, 0) / rentDeals.length);
      minRentDeposit = rentDeals[0];
      maxRentDeposit = rentDeals[rentDeals.length - 1];
      const mid = Math.floor(rentDeals.length / 2);
      medianRentDeposit = rentDeals.length % 2 !== 0
        ? rentDeals[mid]
        : Math.round((rentDeals[mid - 1] + rentDeals[mid]) / 2);

      if (minRentDeposit === maxRentDeposit) {
        minRentDeposit = Math.round(avgRentDeposit * 0.88);
        maxRentDeposit = Math.round(avgRentDeposit * 1.12);
      }
    } else {
      const ptLatestRent = data.priceTrends.slice(-1)[0]?.avgRentDeposit || 65000;
      avgRentDeposit = ptLatestRent;
      minRentDeposit = Math.round(avgRentDeposit * 0.88);
      maxRentDeposit = Math.round(avgRentDeposit * 1.12);
      medianRentDeposit = Math.round(avgRentDeposit * 0.98);
    }

    const avgRentPyeongPrice = Math.round(avgRentDeposit / 26);

    const jeonseRatios = unitTypes
      .map(u => u.jeonseRatio)
      .filter((v): v is number => v !== null && v > 0);
    const avgJeonseRatio = jeonseRatios.length > 0
      ? Math.round(jeonseRatios.reduce((a, b) => a + b, 0) / jeonseRatios.length)
      : Math.round((avgRentDeposit / avgTradePrice) * 100);
    const jeonseChangeRate = dynamicJeonseChangeRate;

    // 3. 월세 통계
    const monthlyTrades = data.recentTrades.filter(t => t.tradeType === 'MONTHLY');
    const avgMonthlyRent = monthlyTrades.length > 0
      ? Math.round(monthlyTrades.reduce((a, t) => a + (t.monthlyRent || 0), 0) / monthlyTrades.length)
      : 0;
    const avgMonthlyDeposit = monthlyTrades.length > 0
      ? Math.round(monthlyTrades.reduce((a, t) => a + (t.dealAmount || 0), 0) / monthlyTrades.length)
      : 0;

    return {
      trade: {
        avgPrice: avgTradePrice,
        minPrice: minTradePrice,
        maxPrice: maxTradePrice,
        medianPrice: medianTradePrice,
        pyeongPrice: avgTradePyeongPrice,
        changeRate: tradeChangeRate,
      },
      jeonse: {
        avgPrice: avgRentDeposit,
        minPrice: minRentDeposit,
        maxPrice: maxRentDeposit,
        medianPrice: medianRentDeposit,
        pyeongPrice: avgRentPyeongPrice,
        jeonseRatio: avgJeonseRatio,
        changeRate: jeonseChangeRate,
      },
      monthly: {
        avgRent: avgMonthlyRent,
        avgDeposit: avgMonthlyDeposit,
        count: monthlyTrades.length,
      },
    };
  }, [data, comparisonMode]);

  // 비교 기간 텍스트 동적 계산 (DB/목데이터 실제 월 기준 정확한 연산)
  const comparisonPeriodInfo = useMemo(() => {
    const pt = data?.priceTrends || [];
    let startYM = '2025-12';
    let endYM = '2026-02';

    if (pt.length >= 3) {
      const last3 = pt.slice(-3);
      startYM = last3[0].yearMonth;
      endYM = last3[last3.length - 1].yearMonth;
    }

    const [sY, sM] = startYM.split('-').map(Number);
    const [eY, eM] = endYM.split('-').map(Number);

    const baseStart = `${String(sY).substring(2)}.${String(sM).padStart(2, '0')}`;
    const baseEnd = `${String(eY).substring(2)}.${String(eM).padStart(2, '0')}`;

    if (comparisonMode === 'yoy') {
      // 전년 동기 (정확히 1년 전 동일 3개월)
      const yStart = `${String(sY - 1).substring(2)}.${String(sM).padStart(2, '0')}`;
      const yEnd = `${String(eY - 1).substring(2)}.${String(eM).padStart(2, '0')}`;
      return {
        base: `최근 3개월 ('${baseStart} ~ '${baseEnd})`,
        compare: `전년 동기 ('${yStart} ~ '${yEnd})`,
      };
    } else {
      // 직전 3개월 (base 시작월 바로 직전 3개월)
      let pEndY = sY;
      let pEndM = sM - 1;
      if (pEndM === 0) { pEndM = 12; pEndY -= 1; }

      let pStartY = pEndY;
      let pStartM = pEndM - 2;
      if (pStartM <= 0) { pStartM += 12; pStartY -= 1; }

      const pStart = `${String(pStartY).substring(2)}.${String(pStartM).padStart(2, '0')}`;
      const pEnd = `${String(pEndY).substring(2)}.${String(pEndM).padStart(2, '0')}`;
      return {
        base: `최근 3개월 ('${baseStart} ~ '${baseEnd})`,
        compare: `직전 3개월 ('${pStart} ~ '${pEnd})`,
      };
    }
  }, [data, comparisonMode]);

  // 동일 평형이 여러 개 있을 경우 A, B, C, D 타입 부여 (예: 26A평, 26B평)
  const unitTypesWithTypes = useMemo(() => {
    if (!data?.unitTypes) return [];
    const pyungCounts: Record<number, number> = {};
    data.unitTypes.forEach(u => {
      const p = u.pyungType || Math.max(1, Math.round(u.exclusiveArea / 3.30578));
      pyungCounts[p] = (pyungCounts[p] || 0) + 1;
    });

    const pyungCurrentIndex: Record<number, number> = {};
    return data.unitTypes.map(u => {
      const p = u.pyungType || Math.max(1, Math.round(u.exclusiveArea / 3.30578));
      const isDuplicate = (pyungCounts[p] || 0) > 1;
      const idx = pyungCurrentIndex[p] || 0;
      pyungCurrentIndex[p] = idx + 1;

      const typeLetter = isDuplicate ? String.fromCharCode(65 + idx) : ''; // 'A', 'B', 'C'...
      const pyungDisplay = `${p}${typeLetter}`; // '26A', '26B' 또는 '7'
      return {
        ...u,
        pyungNum: p,
        typeLetter,
        pyungDisplay,
      };
    });
  }, [data]);

  const unitAreas = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.unitTypes.map(u => u.exclusiveArea))).sort((a, b) => a - b);
  }, [data]);

  // 브라우저의 오늘 날짜가 아니라 API가 실제로 보유한 최신 월을 차트의 끝으로 사용한다.
  const latestDataMonth = useMemo(() => {
    if (!data) return null;
    const months = [
      ...data.priceTrends.map(item => item.yearMonth),
      ...data.recentTrades.map(item => item.dealDate.slice(0, 7)),
    ].filter(month => /^\d{4}-\d{2}$/.test(month));
    if (months.length === 0) return null;
    months.sort();
    return months[months.length - 1];
  }, [data]);

  // 1월~12월 선택 평형(건축물 단위) 실거래가 추이 차트 데이터
  const { timeSeriesChartData, yearBoundaryIndexes, yAxisMinUk, yAxisMaxUk, hasRealTrades, activeUnitName, estimatedPrice } = useMemo(() => {
    if (!data || unitTypesWithTypes.length === 0) {
      return { timeSeriesChartData: [], yearBoundaryIndexes: [], yAxisMinUk: 0, yAxisMaxUk: 20, hasRealTrades: false, activeUnitName: '', estimatedPrice: 0 };
    }

    const isJeonse = tradeTypeFilter === '전세';
    const isMonthly = tradeTypeFilter === '월세';

    // 선택된 유닛이 없으면 실거래가 있거나 세대수가 가장 큰 대표 평형 선택
    const activeUnit = unitTypesWithTypes.find(u => u.exclusiveArea === selectedUnitArea)
      || unitTypesWithTypes.find(u => (u.recentTradePrice && u.recentTradePrice > 0))
      || unitTypesWithTypes[0];

    const pyung = activeUnit.pyungNum;
    const exclArea = activeUnit.exclusiveArea;
    const unitName = priceUnit === '평' ? `${activeUnit.pyungDisplay}평` : `${activeUnit.exclusiveArea}㎡`;

    const basePrice = isJeonse
      ? (activeUnit.recentRentDeposit || Math.round((computedMetrics?.jeonse.pyeongPrice || 2500) * pyung))
      : isMonthly
      ? 50
      : (activeUnit.recentTradePrice || Math.round((computedMetrics?.trade.pyeongPrice || 4800) * pyung));

    // 선택 기간 (1년: 12, 3년: 36, 5년: 60)
    const monthCount = trendPeriod;
    const [startYear, startMonth] = (latestDataMonth ?? '').split('-').map(Number);
    if (!startYear || !startMonth) {
      return { timeSeriesChartData: [], yearBoundaryIndexes: [], yAxisMinUk: 0, yAxisMaxUk: 20, hasRealTrades: false, activeUnitName: unitName, estimatedPrice: basePrice };
    }

    const labels: { dateLabel: string; fullDate: string; year: number; isYearStart: boolean; ymStr: string }[] = [];
    const boundaryIndexes: number[] = [];

    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(startYear, startMonth - 1 - i, 1);
      const yr = d.getFullYear();
      const mo = d.getMonth() + 1;
      const yrShort = String(yr).substring(2);
      const moStr = mo < 10 ? `0${mo}` : `${mo}`;

      const dateLabel = `'${yrShort}.${moStr}`;
      const fullDate = `${yr}년 ${moStr}월`;
      const isYearStart = mo === 1;
      const ymStr = `${yr}-${moStr}`;

      const idx = monthCount - 1 - i;
      if (isYearStart && idx > 0) {
        boundaryIndexes.push(idx);
      }

      labels.push({ dateLabel, fullDate, year: yr, isYearStart, ymStr });
    }

    let globalMaxUk = 0;
    let globalMinUk = 999;
    let totalRealTradesCount = 0;

    const chartData = labels.map((item, idx) => {
      // 실제 해당 월 & 해당 평형의 거래 검색 (84.96과 84.98 등 동일 평형 간 중복 매칭 완전 분리)
      const matchingRealTrades = data.recentTrades.filter(t => {
        const isTypeMatch = isJeonse ? t.tradeType === 'JEONSE' : isMonthly ? t.tradeType === 'MONTHLY' : t.tradeType === 'TRADE';
        let isAreaMatch = false;
        if (Math.abs(t.exclArea - exclArea) < 0.005) {
          isAreaMatch = true;
        } else {
          const closestArea = unitAreas.reduce((prev, curr) =>
            Math.abs(curr - t.exclArea) < Math.abs(prev - t.exclArea) ? curr : prev
          , unitAreas[0]);
          isAreaMatch = closestArea === exclArea && Math.abs(t.exclArea - exclArea) <= 1.0;
        }
        const isMonthMatch = t.dealDate ? t.dealDate.startsWith(item.ymStr) : false;
        return isTypeMatch && isAreaMatch && isMonthMatch;
      });

      const trades: { valUk: number; valManwon: number; floor: number; dealDate: string; isReal: boolean }[] = [];

      if (matchingRealTrades.length > 0) {
        totalRealTradesCount += matchingRealTrades.length;
        matchingRealTrades.forEach(rt => {
          const valManwon = rt.dealAmount || 0;
          const valUk = Math.round((valManwon / 10000) * 10) / 10;
          if (valUk > globalMaxUk) globalMaxUk = valUk;
          if (valUk < globalMinUk) globalMinUk = valUk;
          trades.push({
            valUk,
            valManwon,
            floor: rt.floor || 5,
            dealDate: rt.dealDate ? formatDealDate(rt.dealDate) : item.dateLabel,
            isReal: true,
          });
        });

        const manwonVals = trades.map(t => t.valManwon);
        const avgValManwon = Math.round(manwonVals.reduce((a, b) => a + b, 0) / manwonVals.length);

        return {
          timeIndex: idx,
          dateLabel: item.dateLabel,
          fullDate: item.fullDate,
          year: item.year,
          isYearStart: item.isYearStart,
          tradeCount: trades.length,
          avgUk: Math.round((avgValManwon / 10000) * 10) / 10,
          avgManwon: avgValManwon,
          trades,
        };
      }

      return {
        timeIndex: idx,
        dateLabel: item.dateLabel,
        fullDate: item.fullDate,
        year: item.year,
        isYearStart: item.isYearStart,
        tradeCount: 0,
        avgUk: null,
        highUk: null,
        lowUk: null,
        highManwon: null,
        lowManwon: null,
        avgManwon: null,
        trades: [],
      };
    });

    if (globalMinUk === 999 || totalRealTradesCount === 0) {
      const estimatedUk = Math.round((basePrice / 10000) * 10) / 10;
      globalMinUk = Math.max(0, Math.floor(estimatedUk * 0.85));
      globalMaxUk = Math.ceil(estimatedUk * 1.15);
    } else {
      globalMinUk = Math.max(0, Math.floor(globalMinUk * 0.95));
      globalMaxUk = Math.ceil(globalMaxUk * 1.05);
    }

    if (globalMinUk === globalMaxUk) {
      globalMinUk = Math.max(0, globalMinUk - 1);
      globalMaxUk = globalMaxUk + 1;
    }

    return {
      timeSeriesChartData: chartData,
      yearBoundaryIndexes: boundaryIndexes,
      yAxisMinUk: globalMinUk,
      yAxisMaxUk: globalMaxUk,
      hasRealTrades: totalRealTradesCount > 0,
      activeUnitName: unitName,
      estimatedPrice: basePrice,
    };
  }, [data, unitTypesWithTypes, selectedUnitArea, trendPeriod, tradeTypeFilter, computedMetrics, priceUnit, unitAreas, latestDataMonth]);

  // 실거래 개별 체결 점 데이터 (체결일자별 실거래 점)
  const dealScatterPoints = useMemo(() => {
    const list: {
      timeIndex: number;
      valUk: number;
      valManwon: number;
      floor: number;
      dealDate: string;
      dateLabel: string;
    }[] = [];

    timeSeriesChartData.forEach(d => {
      d.trades.forEach(t => {
        list.push({
          timeIndex: d.timeIndex,
          valUk: t.valUk,
          valManwon: t.valManwon,
          floor: t.floor,
          dealDate: t.dealDate || d.dateLabel,
          dateLabel: d.dateLabel,
        });
      });
    });
    return list;
  }, [timeSeriesChartData]);

  // 우측 끝으로 자동 스크롤
  useEffect(() => {
    if (trendScrollRef.current) {
      trendScrollRef.current.scrollLeft = trendScrollRef.current.scrollWidth;
    }
  }, [timeSeriesChartData, selectedUnitArea, tradeTypeFilter]);

  // 평형별 색상 팔레트
  const UNIT_COLORS = [
    '#264159', '#5b9bd5', '#3E6844', '#8fafc7', '#52b788',
    '#d97706', '#9333ea', '#e11d48', '#0891b2', '#ca8a04',
    '#4f46e5', '#059669', '#dc2626', '#7c3aed', '#db2777'
  ];

  // 거래량 추이 전용 시계열 (건축물 단위 평형별 실거래 건수 집계)
  const { volumeTimeSeriesData, volumeYMax } = useMemo(() => {
    if (!data) return { volumeTimeSeriesData: [], volumeYMax: 10 };

    const monthCount = volumePeriodMonths;
    const [startYear, startMonth] = (latestDataMonth ?? '').split('-').map(Number);
    if (!startYear || !startMonth) return { volumeTimeSeriesData: [], volumeYMax: 10 };

    const isJeonse = tradeTypeFilter === '전세';
    const isMonthly = tradeTypeFilter === '월세';

    const list: any[] = [];
    let maxTotal = 0;

    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(startYear, startMonth - 1 - i, 1);
      const yr = d.getFullYear();
      const mo = d.getMonth() + 1;
      const yrShort = String(yr).substring(2);
      const moStr = mo < 10 ? `0${mo}` : `${mo}`;
      const dateLabel = `'${yrShort}.${moStr}`;
      const ymStr = `${yr}-${moStr}`;

      const row: Record<string, any> = {
        date: dateLabel,
        fullDate: `${yr}년 ${moStr}월`,
        total: 0,
      };

      // 해당 월의 거래 필터링
      const monthTrades = data.recentTrades.filter(t => {
        const isTypeMatch = isJeonse ? t.tradeType === 'JEONSE' : isMonthly ? t.tradeType === 'MONTHLY' : t.tradeType === 'TRADE';
        const isMonthMatch = t.dealDate ? t.dealDate.startsWith(ymStr) : false;
        return isTypeMatch && isMonthMatch;
      });

      let monthTotal = 0;

      unitTypesWithTypes.forEach(ut => {
        const key = priceUnit === '평' ? `${ut.pyungDisplay}평` : `${ut.exclusiveArea}㎡`;
        const isFilterActive = volumeUnitFilters.length === 0 || volumeUnitFilters.includes(ut.exclusiveArea);

        // 해당 평형에 귀속되는 거래 건수
        const count = monthTrades.filter(t => {
          if (Math.abs(t.exclArea - ut.exclusiveArea) < 0.005) return true;
          const closest = unitAreas.reduce((prev, curr) =>
            Math.abs(curr - t.exclArea) < Math.abs(prev - t.exclArea) ? curr : prev
          , unitAreas[0]);
          return closest === ut.exclusiveArea && Math.abs(t.exclArea - ut.exclusiveArea) <= 1.0;
        }).length;

        if (isFilterActive) {
          row[key] = count;
          monthTotal += count;
        } else {
          row[key] = 0;
        }
      });

      row.total = monthTotal;
      if (monthTotal > maxTotal) maxTotal = monthTotal;
      list.push(row);
    }

    return {
      volumeTimeSeriesData: list,
      volumeYMax: Math.max(5, Math.ceil(maxTotal * 1.25)),
    };
  }, [data, volumePeriodMonths, tradeTypeFilter, unitTypesWithTypes, volumeUnitFilters, unitAreas, priceUnit, latestDataMonth]);

  // 거래량 자동 우측 스크롤
  useEffect(() => {
    if (volumeScrollRef.current) {
      volumeScrollRef.current.scrollLeft = volumeScrollRef.current.scrollWidth;
    }
  }, [volumeTimeSeriesData]);

  const filteredTrades = useMemo(() => {
    if (!data) return [];
    if (tradeTabAreaFilters.length > 0 && unitAreas.length === 0) return [];
    return data.recentTrades.filter(t => {
      const typeMatch = tradeTabType === '매매' ? t.tradeType === 'TRADE'
        : tradeTabType === '전세' ? t.tradeType === 'JEONSE'
        : t.tradeType === 'MONTHLY';

      let areaMatch = true;
      if (tradeTabAreaFilters.length > 0) {
        let closestArea = t.exclArea;
        if (!unitAreas.some(a => Math.abs(a - t.exclArea) < 0.005)) {
          closestArea = unitAreas.reduce((prev, curr) =>
            Math.abs(curr - t.exclArea) < Math.abs(prev - t.exclArea) ? curr : prev
          , unitAreas[0]);
        } else {
          closestArea = unitAreas.find(a => Math.abs(a - t.exclArea) < 0.005) ?? t.exclArea;
        }
        areaMatch = tradeTabAreaFilters.includes(closestArea);
      }
      return typeMatch && areaMatch;
    });
  }, [data, tradeTabType, tradeTabAreaFilters, unitAreas]);

  // 행정동 패널의 월세 정보 구조를 건축물의 실제 PNU 거래에 맞게 평형별로 구성한다.
  const monthlyTradesByUnit = useMemo(() => {
    if (!data || unitTypesWithTypes.length === 0) return [];
    const monthlyTrades = data.recentTrades.filter(t => t.tradeType === 'MONTHLY');

    return unitTypesWithTypes.map(unit => ({
      unit,
      trades: monthlyTrades.filter(t => {
        if (Math.abs(t.exclArea - unit.exclusiveArea) < 0.005) return true;
        const closest = unitAreas.reduce((prev, curr) =>
          Math.abs(curr - t.exclArea) < Math.abs(prev - t.exclArea) ? curr : prev
        , unitAreas[0]);
        return closest === unit.exclusiveArea && Math.abs(t.exclArea - unit.exclusiveArea) <= 1.0;
      }),
    })).filter(group => group.trades.length > 0);
  }, [data, unitTypesWithTypes, unitAreas]);

  const pagedTrades = filteredTrades.slice(0, tradeTabPage * TRADE_PAGE_SIZE);
  const amounts = filteredTrades.map(t => t.dealAmount ?? 0).filter(v => v > 0);
  const maxDealAmount = amounts.length ? Math.max(...amounts) : -1;
  const minDealAmount = amounts.length > 1 ? Math.min(...amounts) : -1;

  const info = data?.buildingInfo;
  const buildYear = info?.buildYear;
  const buildingAge = info?.buildingAge;
  const TABS = ['정보', '거래동향', '거래내역'] as const;

  // 평형대별 그룹화 (동일 평형대를 하나로 묶고 세부항목 하위 리스트 지원)
  const groupedUnitTypes = useMemo(() => {
    if (!data?.unitTypes || data.unitTypes.length === 0) return [];

    const map = new Map<number, {
      pyungType: number;
      items: { exclusiveArea: number; householdCount: number }[];
      totalHouseholdCount: number;
    }>();

    data.unitTypes.forEach((ut) => {
      const key = ut.pyungType || Math.round(ut.exclusiveArea / 3.30578) || 1;
      const existing = map.get(key);
      const count = ut.householdCount || 0;
      if (existing) {
        existing.items.push({ exclusiveArea: ut.exclusiveArea, householdCount: count });
        existing.totalHouseholdCount += count;
      } else {
        map.set(key, {
          pyungType: key,
          items: [{ exclusiveArea: ut.exclusiveArea, householdCount: count }],
          totalHouseholdCount: count,
        });
      }
    });

    return Array.from(map.values())
      .map((g) => {
        g.items.sort((a, b) => a.exclusiveArea - b.exclusiveArea);
        const avgArea = Math.round(
          g.items.reduce((sum, item) => sum + item.exclusiveArea, 0) / g.items.length
        );
        return {
          pyungType: g.pyungType,
          roundedArea: avgArea,
          totalHouseholdCount: g.totalHouseholdCount,
          items: g.items,
        };
      })
      .sort((a, b) => a.pyungType - b.pyungType);
  }, [data]);

  // 행정동 단위까지의 지역명 (예: "서울특별시 양천구 목2동")
  const regionLabel = (() => {
    const addr = info?.jibunAddress ?? '';
    const dong = info?.adminDongName ?? '';
    const parts = addr.split(' ');
    const cityGu = parts.length >= 2 ? parts.slice(0, 2).join(' ') : addr;
    return dong ? `${cityGu} ${dong}` : (cityGu || dong || '서울특별시');
  })();

  return (
    <aside className="w-full max-w-[420px] h-full bg-surface-container-lowest flex flex-col border-l border-line font-hanken text-on-surface overflow-y-auto antialiased">

      {/* ── 헤더 */}
      <div className="px-5 pt-6 pb-2 bg-white sticky top-0 z-10">
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            {/* 행정동 단위 지역 */}
            <div className="text-[10px] font-medium text-outline mb-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px]">location_on</span>
              <span className="truncate">{regionLabel}</span>
            </div>

            {/* 건물명 */}
            <h2 className="font-card-title text-card-title text-on-surface tracking-tight font-bold text-2xl leading-tight">
              {info?.buildingName || buildingNameProp}
            </h2>

            {/* 건축물유형 | 세대수 | 준공일자 */}
            {info && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] text-body-text">
                <span className="font-semibold">{buildingTypeLabel(info.buildingType)}</span>
                <span className="text-outline-variant">|</span>
                <span>{info.totalHouseholds ? `${info.totalHouseholds.toLocaleString()}세대` : '세대수 미상'}</span>
                <span className="text-outline-variant">|</span>
                <span>
                  {buildYear ? `${buildYear}년 준공` : '준공일 미상'}
                  {buildYear && buildingAge && (
                    <span className="text-outline text-[11px] ml-1">({buildingAge}년차)</span>
                  )}
                </span>
              </div>
            )}

            {/* 도로명 / 지번주소 */}
            {info && (
              <div className="mt-2 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-[10px] text-outline">
                  <span className="inline-block w-[34px] shrink-0 text-center text-[9px] font-bold bg-outline/10 text-body-text rounded px-1 py-0.5">도로명</span>
                  <span className="truncate text-outline/40">—</span>
                </div>
                {info.jibunAddress && (
                  <div className="flex items-center gap-1.5 text-[10px] text-outline">
                    <span className="inline-block w-[34px] shrink-0 text-center text-[9px] font-bold bg-outline/10 text-body-text rounded px-1 py-0.5">지번</span>
                    <span className="truncate text-on-surface/80">{info.jibunAddress}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 우측 상단 컨트롤: 평/㎡ 토글 */}
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <div className="flex bg-surface-container-low border border-line rounded-lg p-0.5 shadow-sm">
              <button
                onClick={() => setPriceUnit('평')}
                className={`px-2.5 py-0.5 text-[10px] rounded font-bold transition-colors ${
                  priceUnit === '평' ? 'bg-primary text-on-primary' : 'text-outline hover:text-on-surface'
                }`}
              >
                평
              </button>
              <button
                onClick={() => setPriceUnit('㎡')}
                className={`px-2.5 py-0.5 text-[10px] rounded font-bold transition-colors ${
                  priceUnit === '㎡' ? 'bg-primary text-on-primary' : 'text-outline hover:text-on-surface'
                }`}
              >
                ㎡
              </button>
            </div>
          </div>
        </div>

        {/* ── 탭 */}
        <nav className="mt-4 border-b border-line flex gap-5 overflow-x-auto scrollbar-hide">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-bold whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? 'text-on-surface border-b-[3px] border-on-surface'
                  : 'text-body-text hover:text-on-surface'
              }`}>
              {tab}
            </button>
          ))}
        </nav>

        {/* ── 상단 필터 바: 거래동향 탭 (동 패널과 동일한 드롭다운 및 비교 스위치 구조) */}
        {activeTab === '거래동향' && (
          <div className="mt-3 flex flex-col gap-2 relative">
            <div className="flex items-center justify-between">
              {/* 거래 유형 단일 드롭다운 버튼 */}
              <div className="relative">
                <button
                  onClick={() => setShowTradeTypeMenu(!showTradeTypeMenu)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11.5px] font-bold bg-white border border-line text-on-surface hover:bg-surface-container-low transition-all shadow-xs whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-[15px] text-primary">sell</span>
                  <span>{tradeTypeFilter}</span>
                  <span className="material-symbols-outlined text-[15px]">expand_more</span>
                </button>

                {showTradeTypeMenu && (
                  <div className="absolute left-0 top-9 z-30 bg-white border border-line rounded-xl shadow-2xl p-1.5 w-28 flex flex-col gap-1">
                    {(['매매', '전세', '월세'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => {
                          setTradeTypeFilter(type);
                          setShowTradeTypeMenu(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          tradeTypeFilter === type
                            ? 'bg-primary text-on-primary font-bold'
                            : 'hover:bg-surface-container-low text-on-surface'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 직전 3개월 / 전년 동기 비교 스위치 및 비교 기간 상세 안내 (토글 밑에만 깔끔하게 노출) */}
              {tradeTypeFilter !== '월세' && (
                <div className="flex flex-col items-end gap-1">
                  <div className="flex bg-surface-container-low border border-line rounded-lg p-0.5 font-bold text-[10px]">
                    <button
                      onClick={() => setComparisonMode('prev_period')}
                      className={`px-2.5 py-0.5 rounded transition-all ${
                        comparisonMode === 'prev_period'
                          ? 'bg-primary text-on-primary font-bold shadow-xs'
                          : 'text-outline hover:text-on-surface'
                      }`}
                    >
                      직전 3개월
                    </button>
                    <button
                      onClick={() => setComparisonMode('yoy')}
                      className={`px-2.5 py-0.5 rounded transition-all ${
                        comparisonMode === 'yoy'
                          ? 'bg-primary text-on-primary font-bold shadow-xs'
                          : 'text-outline hover:text-on-surface'
                      }`}
                    >
                      전년 동기
                    </button>
                  </div>

                  {/* 비교 기준 기간 안내: 2줄 세로 배치 */}
                  <div className="flex flex-col items-end text-[9.5px] text-outline mt-0.5 leading-tight">
                    <div className="flex items-center gap-1 whitespace-nowrap">
                      <span className="font-bold text-on-surface/90">기준 :</span>
                      <span>{comparisonPeriodInfo.base}</span>
                    </div>
                    <div className="flex items-center gap-1 whitespace-nowrap">
                      <span className="font-bold text-primary">비교 :</span>
                      <span className="font-semibold text-primary">{comparisonPeriodInfo.compare}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 콘텐츠 */}
      {loading ? (
        <div className="p-10 text-center text-body-text flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-[3px] border-line border-t-primary rounded-full animate-spin" />
          <span className="text-sm font-semibold">Stitch 단지 데이터 로딩 중...</span>
        </div>
      ) : errorMessage ? (
        <div className="p-5">
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center text-red-900">
            <div className="text-2xl mb-2">⚠️</div>
            <div className="font-bold text-base">API 연결 오류</div>
            <div className="text-xs mt-1 text-red-700">{errorMessage}</div>
            <div className="text-[11px] mt-3 text-gray-500">
              상단의 [Mock 데이터 Fallback] 체크박스를 켜시면 샘플 데이터로 즉시 테스트하실 수 있습니다.
            </div>
          </div>
        </div>
      ) : data ? (
        <div className="bg-surface-container-lowest flex-grow flex flex-col">

          {/* ════ 정보 탭 ════ */}
          {activeTab === '정보' && (
            <div className="p-5 flex flex-col gap-6">

              {/* 블럭 ①: 건축물 기본정보 */}
              <div className="bg-surface-container-low rounded-xl p-5 border border-line/50 shadow-sm">
                <h3 className="text-caption font-caption text-body-text font-bold mb-3 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-primary">domain</span>
                  <span>건축물 기본정보</span>
                </h3>
                <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-[12px] pt-1">
                  <div className="flex flex-col">
                    <span className="text-outline text-[11px]">총 세대수</span>
                    <span className="font-bold text-on-surface mt-0.5">
                      {info?.totalHouseholds ? `${info.totalHouseholds.toLocaleString()}세대` : '—'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-outline text-[11px]">사용승인일 (준공)</span>
                    <span className="font-bold text-on-surface mt-0.5">
                      {buildYear ? `${buildYear}년` : (info?.useApprovalDate ? info.useApprovalDate : '—')}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-outline text-[11px]">총 주차대수</span>
                    <span className="font-bold text-on-surface mt-0.5">
                      {info?.totalParking ? `${info.totalParking.toLocaleString()}대` : '—'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-outline text-[11px]">건축물 용도</span>
                    <span className="font-bold text-on-surface mt-0.5">
                      {info?.buildingType ? buildingTypeLabel(info.buildingType) : '공동주택'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-outline text-[11px]">용적률 / 건폐율</span>
                    <span className="font-bold text-on-surface mt-0.5">— / —</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-outline text-[11px]">동수 / 최고층</span>
                    <span className="font-bold text-on-surface mt-0.5">— / —</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-outline text-[11px]">난방방식</span>
                    <span className="font-bold text-on-surface mt-0.5">—</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-outline text-[11px]">건설사</span>
                    <span className="font-bold text-on-surface mt-0.5">—</span>
                  </div>
                </div>
              </div>

              {/* 블럭 ②: 평형 구성 */}
              <div className="bg-surface-container-low rounded-xl p-5 border border-line/50 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-caption font-caption text-body-text font-bold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-primary">pie_chart</span>
                    <span>평형 구성</span>
                  </h3>
                  <span className="text-[10px] text-outline font-medium">
                    총 {groupedUnitTypes.length}개 평형
                  </span>
                </div>

                {groupedUnitTypes.length === 0 ? (
                  <div className="py-6 text-center text-outline text-xs">
                    평형 정보가 등록되어 있지 않습니다.
                  </div>
                ) : (
                  (() => {
                    const colorPalette = ['#002855', '#336699', '#4d88ff', '#80b3ff', '#b3d1ff', '#e0ecff'];
                    const totalUnitsSum = groupedUnitTypes.reduce((acc, u) => acc + (u.totalHouseholdCount || 0), 0);
                    const baseTotal = totalUnitsSum > 0 ? totalUnitsSum : (info?.totalHouseholds || 100);

                    return (
                      <div className="flex flex-col gap-3">
                        {/* 평형 비중 시각화 누적 바 */}
                        <div className="flex flex-col gap-1.5">
                          <div className="h-4 w-full rounded-full overflow-hidden flex bg-surface-container shadow-inner">
                            {groupedUnitTypes.map((ut, idx) => {
                              const pct = ((ut.totalHouseholdCount || 0) / baseTotal) * 100;
                              if (pct <= 0) return null;
                              const color = colorPalette[idx % colorPalette.length];
                              return (
                                <div
                                  key={ut.pyungType}
                                  style={{ width: `${pct}%`, backgroundColor: color }}
                                  className="h-full transition-all hover:opacity-90 relative group"
                                  title={`${ut.pyungType}평 (${ut.roundedArea}㎡): ${ut.totalHouseholdCount}세대 (${pct.toFixed(1)}%)`}
                                />
                              );
                            })}
                          </div>

                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-outline px-0.5 mt-0.5">
                            {groupedUnitTypes.map((ut, idx) => {
                              const pct = (((ut.totalHouseholdCount || 0) / baseTotal) * 100).toFixed(1);
                              const color = colorPalette[idx % colorPalette.length];
                              return (
                                <div key={ut.pyungType} className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                  <span className="font-medium text-on-surface">{ut.pyungType}평</span>
                                  <span className="text-outline">({pct}%)</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* 평형 테이블: 평형 | 세부구성 (전용면적 기준) | 세대수 | 비율 */}
                        <div className="flex flex-col border-t border-line/40 mt-1">
                          {/* 테이블 헤더 */}
                          <div className="grid grid-cols-[72px_1fr_60px_48px] items-center px-3 py-2 text-[10px] font-bold text-outline border-b border-line/40">
                            <span>평형</span>
                            <span className="text-center">세부구성 (전용면적 기준)</span>
                            <span className="text-right">세대수</span>
                            <span className="text-right">비율</span>
                          </div>

                          {/* 평형 그룹 및 세부 하위 항목 행 목록 */}
                          {groupedUnitTypes.map((ut, idx) => {
                            const groupPct = (
                              ((ut.totalHouseholdCount || 0) / baseTotal) *
                              100
                            ).toFixed(1);
                            const color = colorPalette[idx % colorPalette.length];

                            return (
                              <div key={ut.pyungType} className="flex flex-col border-b border-line/30">
                                {/* 상위 대표 행 */}
                                <div className="grid grid-cols-[72px_1fr_60px_48px] items-center px-3 py-2 hover:bg-white/60 transition-colors text-[12px]">
                                  {/* 컬럼 1: 평형 (숫자는 선명하게, 단위(평/㎡)는 더 작게) */}
                                  <div className="flex items-start gap-1.5">
                                    <span
                                      className="w-2 h-2 rounded-full shrink-0 mt-1"
                                      style={{ backgroundColor: color }}
                                    />
                                    <div className="flex flex-col">
                                      <div className="flex items-baseline leading-tight">
                                        <span className="font-bold text-on-surface text-[11.5px]">
                                          {priceUnit === '평' ? ut.pyungType : ut.roundedArea}
                                        </span>
                                        <span className="text-[9.5px] font-medium text-outline ml-0.5">
                                          {priceUnit === '평' ? '평' : '㎡'}
                                        </span>
                                      </div>
                                      <span className="text-[9.5px] text-outline leading-tight mt-0.5 whitespace-nowrap">
                                        {priceUnit === '평' ? `(약 ${ut.roundedArea}㎡)` : `(약 ${ut.pyungType}평)`}
                                      </span>
                                    </div>
                                  </div>

                                  {/* 컬럼 2: 세부구성 (전용면적 기준 - 단위 작게) */}
                                  <div className="text-center text-body-text font-medium text-[11px] px-1 truncate">
                                    {ut.items.length === 1 ? (
                                      <span>
                                        {ut.items[0].exclusiveArea}
                                        <span className="text-[9px] text-outline ml-0.5">㎡</span>
                                      </span>
                                    ) : (
                                      <span className="text-on-surface/90 font-medium">
                                        {ut.items[0].exclusiveArea} ~ {ut.items[ut.items.length - 1].exclusiveArea}
                                        <span className="text-[9px] text-outline ml-0.5">㎡</span>
                                      </span>
                                    )}
                                  </div>

                                  {/* 컬럼 3: 세대수 */}
                                  <div className="text-right font-bold text-on-surface text-[11.5px]">
                                    {ut.totalHouseholdCount ? `${ut.totalHouseholdCount.toLocaleString()}세대` : '—'}
                                  </div>

                                  {/* 컬럼 4: 비율 */}
                                  <div className="text-right text-[10.5px] font-semibold text-outline">
                                    {groupPct}%
                                  </div>
                                </div>

                                {/* 하위 리스트 (동일 평형 내 세부 면적이 2개 이상일 때 동일 그리드 정렬) */}
                                {ut.items.length > 1 && (
                                  <div className="flex flex-col bg-surface-container-low/50 border-t border-line/20">
                                    {ut.items.map((sub) => {
                                      return (
                                        <div
                                          key={sub.exclusiveArea}
                                          className="grid grid-cols-[72px_1fr_60px_48px] items-center px-3 py-1.5 text-[10.5px] text-body-text border-b border-line/10 last:border-b-0"
                                        >
                                          <div className="text-outline text-[10px] pl-3.5 font-medium">
                                            ↳
                                          </div>
                                          <div className="text-center font-medium text-on-surface/80 px-1 truncate">
                                            {sub.exclusiveArea}
                                            <span className="text-[9px] text-outline ml-0.5">㎡</span>
                                          </div>
                                          <div className="text-right font-semibold text-on-surface">
                                            {sub.householdCount ? `${sub.householdCount}세대` : '—'}
                                          </div>
                                          {/* 세부 항목 비율 생략 */}
                                          <div className="text-right"></div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            </div>
          )}

          {/* ════ 거래동향 탭 ════ */}
          {activeTab === '거래동향' && (
            <div className="p-5 flex flex-col gap-5">

              {/* 블럭 ①: 상단 통계 카드 */}
              {computedMetrics && (
                <>
                  {/* 매매 선택 시: 2개 카드 */}
                  {tradeTypeFilter === '매매' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-surface-container-low rounded-xl p-4 border border-line/50 shadow-sm">
                        <div className="text-[10px] text-outline font-medium mb-1">단지 평균 매매가</div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-card-title font-bold text-on-surface text-xl">
                            {formatPrice(computedMetrics.trade.avgPrice, '평')}
                          </span>
                          <span className={`text-[10px] font-bold ${computedMetrics.trade.changeRate >= 0 ? 'text-coral' : 'text-sky'}`}>
                            {computedMetrics.trade.changeRate >= 0 ? '▲' : '▼'} {Math.abs(computedMetrics.trade.changeRate).toFixed(1)}%
                          </span>
                        </div>
                        <div className="text-[9px] text-outline mt-1 leading-tight">
                          ({formatPrice(computedMetrics.trade.minPrice, '평')} ~ {formatPrice(computedMetrics.trade.maxPrice, '평')}, 중위 {formatPrice(computedMetrics.trade.medianPrice, '평')})
                        </div>
                      </div>

                      <div className="bg-surface-container-low rounded-xl p-4 border border-line/50 shadow-sm">
                        <div className="text-[10px] text-outline font-medium mb-1">
                          단지 평균 매매 {priceUnit === '평' ? '평단가' : '㎡당 단가'}
                        </div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-card-title font-bold text-on-surface text-xl">
                            {formatPrice(computedMetrics.trade.pyeongPrice, priceUnit)}
                          </span>
                          <span className="text-[10px] font-normal text-outline">/ {priceUnit}</span>
                          <span className={`text-[10px] font-bold ${computedMetrics.trade.changeRate >= 0 ? 'text-coral' : 'text-sky'}`}>
                            {computedMetrics.trade.changeRate >= 0 ? '▲' : '▼'} {Math.abs(computedMetrics.trade.changeRate).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 전세 선택 시: 3개 카드 */}
                  {tradeTypeFilter === '전세' && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-surface-container-low rounded-xl p-3 border border-line/50 shadow-sm">
                        <div className="text-[9px] text-outline font-medium mb-1 truncate">단지 평균 전세가</div>
                        <div className="flex items-baseline gap-0.5">
                          <span className="text-base font-bold text-on-surface">
                            {formatPrice(computedMetrics.jeonse.avgPrice, '평')}
                          </span>
                        </div>
                        <div className={`text-[8px] mt-0.5 font-bold ${computedMetrics.jeonse.changeRate >= 0 ? 'text-coral' : 'text-sky'}`}>
                          {computedMetrics.jeonse.changeRate >= 0 ? '▲' : '▼'} {Math.abs(computedMetrics.jeonse.changeRate).toFixed(1)}%
                        </div>
                        <div className="text-[8px] text-outline mt-0.5 truncate">
                          ({formatPrice(computedMetrics.jeonse.minPrice, '평')} ~ {formatPrice(computedMetrics.jeonse.maxPrice, '평')}, 중위 {formatPrice(computedMetrics.jeonse.medianPrice, '평')})
                        </div>
                      </div>

                      <div className="bg-surface-container-low rounded-xl p-3 border border-line/50 shadow-sm">
                        <div className="text-[9px] text-outline font-medium mb-1 truncate">
                          전세 {priceUnit === '평' ? '평단가' : '㎡당 단가'}
                        </div>
                        <div className="flex items-baseline gap-0.5">
                          <span className="text-base font-bold text-on-surface">
                            {formatPrice(computedMetrics.jeonse.pyeongPrice, priceUnit)}
                          </span>
                          <span className="text-[8px] text-outline">/ {priceUnit}</span>
                        </div>
                        <div className={`text-[8px] mt-1 font-bold ${computedMetrics.jeonse.changeRate >= 0 ? 'text-coral' : 'text-sky'}`}>
                          {computedMetrics.jeonse.changeRate >= 0 ? '▲' : '▼'} {Math.abs(computedMetrics.jeonse.changeRate).toFixed(1)}%
                        </div>
                      </div>

                      <div className="bg-surface-container-low rounded-xl p-3 border border-line/50 shadow-sm">
                        <div className="text-[9px] text-outline font-medium mb-1 truncate">평균 전세가율</div>
                        <div className="flex items-baseline gap-0.5">
                          <span className="text-base font-bold text-on-surface">
                            {computedMetrics.jeonse.jeonseRatio}%
                          </span>
                        </div>
                        <div className="text-[8px] text-outline mt-1">매매가 대비 비율</div>
                      </div>
                    </div>
                  )}

                  {/* 월세 선택 시: 실제 거래건수만 표시 */}
                  {tradeTypeFilter === '월세' && (
                    <div>
                      <div className="bg-surface-container-low rounded-xl p-4 border border-line/50 shadow-sm">
                        <div className="text-[10px] text-outline font-medium mb-1">최근 월세 거래건수</div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-card-title font-bold text-on-surface text-xl">
                            {computedMetrics.monthly.count}건
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* 월세: 행정동 패널과 같은 계약 정보 구조를 건축물 실제 거래로 표시 */}
              {tradeTypeFilter === '월세' && (
                <div className="flex flex-col gap-4">
                  {monthlyTradesByUnit.length === 0 ? (
                    <div className="rounded-xl border border-line/50 bg-surface-container-low p-8 text-center text-sm text-outline">
                      이 건축물의 월세 실거래 내역이 없습니다.
                    </div>
                  ) : monthlyTradesByUnit.map(({ unit, trades }) => (
                    <div key={unit.exclusiveArea} className="rounded-xl border bg-white/70 border-line/40 p-3 flex flex-col gap-1.5 shadow-xs">
                      <div className="flex justify-between items-center pb-1.5 border-b border-line/30">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-body-md font-bold text-on-surface text-sm">{unit.pyungDisplay}평</span>
                          <span className="text-[10px] text-outline font-normal">({unit.exclusiveArea}㎡)</span>
                        </div>
                        <span className="text-[9px] text-outline font-normal">* 단위: 만원</span>
                      </div>
                      <div className="flex text-[10px] text-outline font-semibold px-1 py-0.5 border-b border-line/20 items-center whitespace-nowrap gap-1">
                        <span className="w-[62px] text-left shrink-0">일자</span>
                        <span className="flex-1 text-left">평형</span>
                        <span className="w-[28px] text-center shrink-0">층</span>
                        <span className="w-[70px] text-right shrink-0">보증금</span>
                        <span className="w-[48px] text-right shrink-0">월세</span>
                      </div>
                      <div className="flex flex-col gap-1 pt-0.5">
                        {trades.map(t => (
                          <div key={t.id} className="flex items-center py-1 px-1 rounded hover:bg-surface-container-low/60 transition-colors whitespace-nowrap gap-1">
                            <span className="w-[62px] text-[10px] text-outline font-medium text-left shrink-0">{formatDealDate(t.dealDate)}</span>
                            <span className="flex-1 text-[10px] font-semibold text-on-surface text-left">{t.exclArea}㎡ ({Math.round(t.exclArea / 3.30578)}평)</span>
                            <span className="w-[28px] text-[10px] text-outline font-medium text-center shrink-0">{t.floor != null ? `${t.floor}층` : '—'}</span>
                            <span className="w-[70px] font-bold text-on-surface text-[11px] text-right shrink-0">{(t.dealAmount || 0).toLocaleString()}</span>
                            <span className="w-[48px] font-bold text-on-surface text-[11px] text-right shrink-0">{(t.monthlyRent || 0).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 블럭 ②: 평형별 매매/전세 시세 목록 */}
              <div className={`${tradeTypeFilter === '월세' ? 'hidden' : ''} bg-surface-container-low rounded-xl p-5 border border-line/50 shadow-sm`}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-caption font-caption text-body-text font-bold text-xs">
                    평형별 {tradeTypeFilter} 시세
                  </h3>
                </div>

                <div className="flex flex-col gap-2.5">
                  <div className="flex text-[10px] text-outline font-medium px-1 whitespace-nowrap justify-between">
                    <span className="w-16">구분</span>
                    <span className="flex-1 px-2">
                      평균 {tradeTypeFilter}가
                    </span>
                    <span className="w-24 text-right">
                      평균 {priceUnit === '평' ? '평단가' : '㎡당 단가'}
                    </span>
                  </div>

                  {unitTypesWithTypes.map((ut) => {
                    const pyung = ut.pyungNum;
                    const baseTradePyeong = computedMetrics?.trade.pyeongPrice || 4800;
                    const baseRentPyeong = computedMetrics?.jeonse.pyeongPrice || 2500;

                    // 매매/전세/월세 가격을 각 평형별 비례 및 실제 데이터 기준으로 계산
                    let price: number;
                    let pyeongPrice: number;
                    let hasRealTrade = false;

                    if (tradeTypeFilter === '매매') {
                      if (ut.recentTradePrice && ut.recentTradePrice > 0) {
                        price = ut.recentTradePrice;
                        pyeongPrice = ut.pricePerPyeong || Math.round(price / pyung);
                        hasRealTrade = true;
                      } else {
                        // 해당 평형 거래가 없을 경우 단지 평단가 기준 비례 산출 (7평: ~3.4억, 8평: ~3.8억 등)
                        pyeongPrice = baseTradePyeong;
                        price = Math.round(baseTradePyeong * pyung);
                      }
                    } else if (tradeTypeFilter === '전세') {
                      if (ut.recentRentDeposit && ut.recentRentDeposit > 0) {
                        price = ut.recentRentDeposit;
                        pyeongPrice = Math.round(price / pyung);
                        hasRealTrade = true;
                      } else {
                        pyeongPrice = baseRentPyeong;
                        price = Math.round(baseRentPyeong * pyung);
                      }
                    } else {
                      // 월세: 평형별 비례
                      price = Math.round(30 + pyung * 2.0); // 월세 만원
                      pyeongPrice = 0;
                    }

                    const change = ut.priceChangeRate ?? (tradeTypeFilter === '전세' ? (computedMetrics?.jeonse.changeRate ?? 0) : (computedMetrics?.trade.changeRate ?? 0));
                    const isUp = change >= 0;

                    const median = Math.round(price * 0.98);
                    const min = ut.minTradePrice && hasRealTrade ? ut.minTradePrice : Math.round(price * 0.88);
                    const max = ut.maxTradePrice && hasRealTrade ? ut.maxTradePrice : Math.round(price * 1.12);
                    const depositForMonthly = Math.round(pyung * 400); // 7평: ~2,800만, 26평: ~1억

                    return (
                      <div
                        key={ut.exclusiveArea}
                        className="flex items-center rounded-lg p-2.5 border bg-white/70 border-line/40 justify-between hover:bg-white transition-colors"
                      >
                        {/* 구분 (동일 평형 시 26A평, 26B평으로 구분 표기) */}
                        <div className="w-16 flex flex-col shrink-0">
                          <div className="flex items-baseline leading-tight">
                            <span className="text-body-md font-bold text-on-surface">
                              {priceUnit === '평' ? ut.pyungDisplay : ut.exclusiveArea}
                            </span>
                            <span className="text-[10px] font-medium text-outline ml-0.5">
                              {priceUnit === '평' ? '평' : '㎡'}
                            </span>
                          </div>
                          <span className="text-[9px] text-outline font-normal">
                            {priceUnit === '평' ? `(${ut.exclusiveArea}㎡)` : `(${ut.pyungDisplay}평)`}
                          </span>
                        </div>

                        {/* 평균 거래가 & 변동률 & 중위/범위 */}
                        <div className="flex-1 px-2 flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <span className="text-body-md font-bold text-on-surface">
                              {tradeTypeFilter === '월세'
                                ? `${formatPrice(depositForMonthly, '평')} / ${price}만`
                                : formatPrice(price, '평')}
                            </span>
                            {tradeTypeFilter !== '월세' && (
                              <span className={`text-[10px] font-bold shrink-0 ${isUp ? 'text-coral' : 'text-sky'}`}>
                                {isUp ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
                              </span>
                            )}
                          </div>
                          {tradeTypeFilter !== '월세' && (
                            <span className="text-[9px] text-outline whitespace-nowrap leading-tight">
                              중위 {formatPrice(median, '평')} ({formatPrice(min, '평')} ~ {formatPrice(max, '평')})
                            </span>
                          )}
                        </div>

                        {/* 평단가 / ㎡당 단가 */}
                        <div className="w-24 text-right flex flex-col items-end justify-center shrink-0">
                          {tradeTypeFilter !== '월세' ? (
                            <div className="flex items-baseline justify-end gap-1 whitespace-nowrap">
                              <span className="text-[13px] font-bold text-on-surface">
                                {formatPrice(pyeongPrice, priceUnit)}
                              </span>
                              <span className="text-[10px] text-outline font-normal">
                                / {priceUnit}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-outline">보증금별 상이</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 블럭 ③: 실거래가 추이 차트 (행정동 패널 고성능 이식) */}
              <div className={`${tradeTypeFilter === '월세' ? 'hidden' : ''} bg-surface-container-low rounded-xl p-5 border border-line/50 shadow-sm`}>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-caption font-caption text-body-text font-bold text-xs">
                    {tradeTypeFilter === '매매' ? '매매 실거래가 추이' : tradeTypeFilter === '전세' ? '전세 실거래가 추이' : '월세 실거래가 추이'}
                  </h3>
                  <div className="flex gap-1 items-center relative">
                    <button
                      onClick={() => setShowTrendPeriodDrop(!showTrendPeriodDrop)}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-on-surface rounded-full text-on-surface hover:bg-surface-container-low transition-colors whitespace-nowrap"
                    >
                      <span className="material-symbols-outlined text-[14px] text-outline">schedule</span>
                      <span className="text-[10px] font-bold">{trendPeriod === 12 ? '1년' : trendPeriod === 36 ? '3년' : '5년'}</span>
                      <span className="material-symbols-outlined text-[14px]">expand_more</span>
                    </button>

                    {showTrendPeriodDrop && (
                      <div className="absolute right-0 top-8 z-30 bg-white border border-line rounded-xl shadow-xl p-1.5 w-24 flex flex-col gap-1">
                        {[{ label: '1년', val: 12 }, { label: '3년', val: 36 }, { label: '5년', val: 60 }].map(opt => (
                          <button
                            key={opt.val}
                            onClick={() => {
                              setTrendPeriod(opt.val);
                              setShowTrendPeriodDrop(false);
                            }}
                            className={`w-full text-left px-2.5 py-1 rounded text-xs font-bold ${
                              trendPeriod === opt.val ? 'bg-primary text-on-primary' : 'hover:bg-surface-container-low text-on-surface'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 평형 선택 칩 */}
                <div className="flex gap-1.5 mb-3 border-b border-line/30 pb-2 overflow-x-auto scrollbar-hide">
                  {unitTypesWithTypes.map(ut => {
                    const isSelected = selectedUnitArea === ut.exclusiveArea || (!selectedUnitArea && ut === unitTypesWithTypes[0]);
                    return (
                      <button
                        key={ut.exclusiveArea}
                        onClick={() => setSelectedUnitArea(ut.exclusiveArea)}
                        className={`px-3 py-1.5 rounded-full text-[10.5px] font-bold whitespace-nowrap transition-all ${
                          isSelected
                            ? 'bg-primary text-on-primary shadow-sm font-extrabold'
                            : 'bg-white border border-line text-body-text hover:bg-surface-container-low'
                        }`}
                      >
                        {priceUnit === '평' ? `${ut.pyungDisplay}평` : `${ut.exclusiveArea}㎡`}
                      </button>
                    );
                  })}
                </div>

                {/* Y축 고정 + 가로 스크롤 그래프 (실거래가 있을 때) 또는 깔끔한 안내 카드 */}
                {!hasRealTrades ? (
                  <div className="flex flex-col items-center justify-center h-52 w-full border border-line/30 rounded-xl bg-white p-6 text-center shadow-inner">
                    <div className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center mb-2">
                      <span className="material-symbols-outlined text-outline text-[22px]">query_stats</span>
                    </div>
                    <span className="text-[13px] font-bold text-on-surface">
                      {activeUnitName} 최근 실거래 신고 내역 없음
                    </span>
                    <span className="text-[11px] text-outline mt-1 leading-relaxed">
                      최근 {trendPeriod === 12 ? '1년' : trendPeriod === 36 ? '3년' : '5년'}간 국토교통부에 신고된 실거래 계약이 없습니다.
                    </span>
                    <div className="mt-3 px-3.5 py-1.5 bg-surface-container-low rounded-lg border border-line/50 flex items-center gap-2">
                      <span className="text-[10px] text-outline">단지 평단가 기준 추정 시세:</span>
                      <span className="text-[11.5px] font-extrabold text-primary">{formatPrice(estimatedPrice, '평')}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-56 w-full pt-1 border border-line/30 rounded-xl bg-white p-1">
                    {/* 1) 고정된 Y축 가격 척도 */}
                    <div className="w-9 shrink-0 h-full border-r border-line/40 flex flex-col justify-between py-5 pr-1 text-[9px] text-outline font-bold text-right bg-surface-container-low/30 rounded-l-lg">
                      <span>{yAxisMaxUk}억</span>
                      <span>{Math.round((yAxisMaxUk + yAxisMinUk) / 2)}억</span>
                      <span>{yAxisMinUk}억</span>
                    </div>

                    {/* 2) 가로 스크롤 그래프 영역 */}
                    <div ref={trendScrollRef} className="flex-grow h-full overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300">
                      <div style={{ width: `${Math.max(340, timeSeriesChartData.length * 42)}px` }} className="h-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={timeSeriesChartData} margin={{ top: 15, right: 15, left: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />

                            {yearBoundaryIndexes.map((bIdx) => (
                              <ReferenceLine
                                key={`ref-${bIdx}`}
                                x={bIdx}
                                stroke="#c7c7cc"
                                strokeDasharray="4 4"
                                strokeWidth={1.5}
                                label={{
                                  value: `${timeSeriesChartData[bIdx]?.year}년`,
                                  position: 'top',
                                  fill: '#48484a',
                                  fontSize: 10,
                                  fontWeight: 'bold',
                                }}
                              />
                            ))}

                            <XAxis
                              dataKey="timeIndex"
                              type="number"
                              domain={[0, timeSeriesChartData.length - 1]}
                              tickCount={timeSeriesChartData.length}
                              tickFormatter={(idx) => timeSeriesChartData[idx]?.dateLabel || ''}
                              tick={{ fontSize: 9, fill: '#8e8e93' }}
                              tickLine={false}
                            />

                            <YAxis hide domain={[yAxisMinUk, yAxisMaxUk]} />

                            <RechartsTooltip
                              isAnimationActive={false}
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const nodeData = payload[0].payload;

                                  if (nodeData && nodeData.valManwon && nodeData.floor) {
                                    return (
                                      <div className="bg-gray-900 text-white text-[11px] p-2.5 rounded-lg shadow-xl border border-gray-700 flex flex-col gap-1">
                                        <div className="font-bold border-b border-gray-700 pb-1 flex items-center justify-between gap-2">
                                          <span>{nodeData.dealDate || nodeData.dateLabel} 체결 ({nodeData.floor}층)</span>
                                        </div>
                                        <div>실거래가: <span className="font-extrabold text-amber-300">{formatNaverPrice(nodeData.valManwon)}</span></div>
                                      </div>
                                    );
                                  }

                                  if (nodeData && nodeData.fullDate) {
                                    return (
                                      <div className="bg-white border border-gray-900 rounded-xl p-3 shadow-2xl flex flex-col gap-1 min-w-[170px]">
                                        <div className="text-[11px] font-bold text-gray-500 border-b border-gray-100 pb-1 flex items-center justify-between">
                                          <span>{nodeData.fullDate}</span>
                                          <span className="text-primary font-extrabold">({nodeData.tradeCount || 0}건)</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs font-extrabold text-primary pt-0.5">
                                          <span>월 평균 거래가</span>
                                          <span>{formatNaverPrice(nodeData.avgManwon)}</span>
                                        </div>
                                      </div>
                                    );
                                  }
                                }
                                return null;
                              }}
                            />

                            {/* 월별 평균 실거래가 추세선 (월 단위 평균 점 연결) */}
                            <Line
                              type="monotone"
                              dataKey="avgUk"
                              name="월평균 거래가"
                              stroke="#264159"
                              strokeWidth={2.2}
                              dot={{ r: 3.5, fill: '#264159', stroke: '#ffffff', strokeWidth: 1.5 }}
                              activeDot={{ r: 5, fill: '#264159', stroke: '#ffffff', strokeWidth: 2 }}
                              connectNulls={true}
                              isAnimationActive={false}
                            />

                            {/* 거래가 있는 일자별 실거래 점 */}
                            <Scatter
                              data={dealScatterPoints}
                              dataKey="valUk"
                              isAnimationActive={false}
                              line={false}
                              shape={(props: any) => (
                                <circle
                                  cx={props.cx}
                                  cy={props.cy}
                                  r={3.5}
                                  fill="#2563eb"
                                  stroke="#ffffff"
                                  strokeWidth={1.5}
                                  opacity={0.95}
                                />
                              )}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. 거래량 추이 막대 차트 (가로 스크롤 동기화 & 건축물 평형별 누적) */}
              <div className="bg-surface-container-low rounded-xl p-5 border border-line/50 shadow-sm">
                {/* 헤더: 제목 + 기간 설정 버튼 (오른쪽 상단) */}
                <div className="flex justify-between items-center mb-3 relative">
                  <h3 className="text-caption font-caption text-body-text font-bold text-xs">
                    {tradeTypeFilter} 거래량 추이
                  </h3>
                  <div className="relative">
                    <button
                      onClick={() => setShowVolumePeriodDropdown(!showVolumePeriodDropdown)}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-on-surface rounded-full text-on-surface hover:bg-surface-container-low transition-colors whitespace-nowrap"
                    >
                      <span className="material-symbols-outlined text-[14px] text-outline">schedule</span>
                      <span className="text-[10px] font-bold">{volumePeriodMonths / 12}년</span>
                    </button>
                    {showVolumePeriodDropdown && (
                      <div className="absolute right-0 top-8 z-30 bg-white border border-line rounded-xl shadow-xl p-1.5 w-24 flex flex-col gap-1">
                        {[12, 36, 60].map((m) => (
                          <button
                            key={m}
                            onClick={() => {
                              setVolumePeriodMonths(m);
                              setShowVolumePeriodDropdown(false);
                            }}
                            className={`w-full text-left px-2.5 py-1 rounded text-xs font-bold ${
                              volumePeriodMonths === m ? 'bg-primary text-on-primary' : 'hover:bg-surface-container-low text-on-surface'
                            }`}
                          >
                            {m / 12}년
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 평형 토글 필터 칩 (건축물 단위 평형들) */}
                <div className="flex flex-wrap gap-1.5 mb-3 items-center">
                  {unitTypesWithTypes.map((ut, idx) => {
                    const color = UNIT_COLORS[idx % UNIT_COLORS.length];
                    const isActive = volumeUnitFilters.includes(ut.exclusiveArea);
                    const label = priceUnit === '평' ? `${ut.pyungDisplay}평` : `${ut.exclusiveArea}㎡`;
                    return (
                      <button
                        key={ut.exclusiveArea}
                        onClick={() => {
                          setVolumeUnitFilters((prev) => {
                            const next = isActive
                              ? prev.filter((a) => a !== ut.exclusiveArea)
                              : [...prev, ut.exclusiveArea];
                            return next.length === 0 ? unitTypesWithTypes.map(u => u.exclusiveArea) : next;
                          });
                        }}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition-all border ${
                          isActive
                            ? 'border-transparent text-white shadow-sm'
                            : 'bg-white border-line text-body-text hover:bg-surface-container-low'
                        }`}
                        style={isActive ? { backgroundColor: color } : {}}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* 가로 스크롤 누적 막대 차트 (Y축 제거, 바 위 총 건수 표시) */}
                <div className="h-44 w-full border border-line/30 rounded-xl bg-white p-1 overflow-hidden">
                  <div ref={volumeScrollRef} className="h-full overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300">
                    <div style={{ width: `${Math.max(360, volumeTimeSeriesData.length * 42)}px` }} className="h-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={volumeTimeSeriesData} margin={{ top: 18, right: 10, left: 5, bottom: 0 }} stackOffset="none">
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                          <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#8e8e93' }} tickLine={false} />
                          <YAxis hide domain={[0, volumeYMax]} />
                          <RechartsTooltip
                            isAnimationActive={false}
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                const total = payload.reduce((s, p) => s + (Number(p.value) || 0), 0);
                                const nonZeroPayload = payload.filter(p => Number(p.value) > 0);
                                return (
                                  <div className="bg-gray-900 text-white text-[10px] px-2.5 py-1.5 rounded-md shadow-md flex flex-col gap-0.5 z-50">
                                    <div className="font-bold border-b border-gray-700 pb-1 mb-0.5">{label} (총 {total}건)</div>
                                    {nonZeroPayload.length === 0 ? (
                                      <div className="text-gray-400">거래 없음</div>
                                    ) : (
                                      nonZeroPayload.map((p) => (
                                        <div key={p.dataKey as string} className="flex items-center justify-between gap-3">
                                          <span style={{ color: p.fill as string }}>{p.dataKey as string}</span>
                                          <span className="font-bold text-amber-300">{p.value}건</span>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          {unitTypesWithTypes.map((ut, idx) => {
                            const key = priceUnit === '평' ? `${ut.pyungDisplay}평` : `${ut.exclusiveArea}㎡`;
                            const color = UNIT_COLORS[idx % UNIT_COLORS.length];
                            const isLastUnit = idx === unitTypesWithTypes.length - 1;

                            return (
                              <Bar
                                key={ut.exclusiveArea}
                                dataKey={key}
                                stackId="vol"
                                fill={color}
                                barSize={14}
                                isAnimationActive={false}
                              >
                                {isLastUnit && (
                                  <LabelList
                                    position="top"
                                    content={(props: any) => {
                                      const { x, y, width, index } = props;
                                      const d = volumeTimeSeriesData[index];
                                      if (!d || !d.total || d.total === 0) return null;
                                      return (
                                        <text x={x + width / 2} y={y - 3} fill="#48484a" fontSize={8} textAnchor="middle" fontWeight="bold">
                                          {d.total}
                                        </text>
                                      );
                                    }}
                                  />
                                )}
                              </Bar>
                            );
                          })}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ════ 거래내역 탭 ════ */}
          {activeTab === '거래내역' && (
            <div className="p-5 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold text-on-surface">거래 내역</span>
                  <span className="text-[12px] text-outline font-medium">총 {filteredTrades.length}건</span>
                </div>
              </div>

              {/* 필터 영역 (1행: 매매/전세/월세, 2행: 평형별 멀티 토글 필터) */}
              <div className="flex flex-col gap-2.5">
                {/* 1행: 거래유형 선택 (전체 제거, 매매/전세/월세 단일 선택) */}
                <div className="flex items-center gap-1.5">
                  {(['매매', '전세', '월세'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => { setTradeTabType(type); setTradeTabPage(1); }}
                      className={`px-3.5 py-1.5 rounded-full text-[11.5px] font-bold transition-all ${
                        tradeTabType === type
                          ? 'bg-primary text-on-primary shadow-sm'
                          : 'bg-surface-container-low text-body-text border border-line hover:border-primary/50'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                {/* 2행: 평형별 토글 필터 칩 (기본 전체선택, 전체 해제 시 풀선택 자동 복귀) */}
                <div className="flex flex-wrap gap-1.5 items-center">
                  {unitTypesWithTypes.map(ut => {
                    const isActive = tradeTabAreaFilters.includes(ut.exclusiveArea);
                    const label = priceUnit === '평' ? `${ut.pyungDisplay}평` : `${ut.exclusiveArea}㎡`;
                    return (
                      <button
                        key={ut.exclusiveArea}
                        onClick={() => {
                          setTradeTabAreaFilters(prev => {
                            const next = isActive
                              ? prev.filter(a => a !== ut.exclusiveArea)
                              : [...prev, ut.exclusiveArea];
                            return next.length === 0 ? unitTypesWithTypes.map(u => u.exclusiveArea) : next;
                          });
                          setTradeTabPage(1);
                        }}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all border ${
                          isActive
                            ? 'bg-primary text-on-primary border-transparent shadow-sm'
                            : 'bg-surface-container-low text-body-text border-line hover:border-primary/50'
                        }`}
                      >
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 테이블 */}
              <div className="flex flex-col border-t border-line">
                <div className="flex items-center px-2 py-2.5 bg-surface-container-low/50 text-[11px] font-bold text-outline border-b border-line">
                  <span className="w-[40px] shrink-0">유형</span>
                  <span className="w-[100px] shrink-0">계약일</span>
                  <span className="w-[80px] shrink-0">층·면적</span>
                  <span className="flex-grow text-right">금액</span>
                </div>

                {pagedTrades.length === 0 ? (
                  <div className="py-10 text-center text-body-text text-sm">해당하는 거래 내역이 없습니다.</div>
                ) : (
                  pagedTrades.map((t) => {
                    const isMaxPrice = maxDealAmount > 0 && t.dealAmount === maxDealAmount;
                    const isMinPrice = minDealAmount > 0 && t.dealAmount === minDealAmount && filteredTrades.length > 1;
                    const typeLabel = t.tradeType === 'TRADE' ? '매매' : t.tradeType === 'JEONSE' ? '전세' : '월세';
                    let priceStr = '—';
                    if (t.dealAmount !== null) {
                      if (t.tradeType === 'MONTHLY' && t.monthlyRent) {
                        priceStr = `보증 ${formatNaverPrice(t.dealAmount)} / 월 ${t.monthlyRent}만`;
                      } else {
                        priceStr = formatNaverPrice(t.dealAmount);
                      }
                    }
                    return (
                      <div key={t.id}
                        className="flex items-center px-2 py-3 border-b border-line/50 hover:bg-surface-container-low/30 transition-colors">
                        <span className="w-[40px] shrink-0 text-[12px] text-body-text">{typeLabel}</span>
                        <div className="w-[100px] shrink-0 whitespace-nowrap">
                          <span className="text-[12px] font-bold text-on-surface">{formatDealDate(t.dealDate)}</span>
                        </div>
                        <span className="w-[80px] shrink-0 text-[11.5px] text-body-text whitespace-nowrap">
                          {t.floor ? `${t.floor}층` : '—'}·
                          {(() => {
                            const matchedUnit = unitTypesWithTypes.find(u => Math.abs(u.exclusiveArea - t.exclArea) < 0.005)
                              || unitTypesWithTypes.find(u => Math.abs(u.exclusiveArea - t.exclArea) <= 1.0);
                            return priceUnit === '평' ? (
                              <>
                                <span className="font-bold text-on-surface">{matchedUnit ? matchedUnit.pyungDisplay : Math.round(t.exclArea / 3.30578)}</span>
                                <span className="text-[9.5px] text-outline ml-0.5">평</span>
                              </>
                            ) : (
                              <>
                                <span className="font-bold text-on-surface">{t.exclArea}</span>
                                <span className="text-[9.5px] text-outline ml-0.5">㎡</span>
                              </>
                            );
                          })()}
                        </span>
                        <div className="flex-grow flex items-center justify-end gap-1 whitespace-nowrap">
                          {isMaxPrice && <span className="px-1 py-0.5 bg-coral/10 text-coral text-[9px] font-bold rounded">최고</span>}
                          {isMinPrice && <span className="px-1 py-0.5 bg-sky/10 text-sky text-[9px] font-bold rounded">최저</span>}
                          <span className="text-[13px] font-bold text-on-surface">{priceStr}</span>
                        </div>
                      </div>
                    );
                  })
                )}

                {pagedTrades.length < filteredTrades.length && (
                  <button onClick={() => setTradeTabPage(p => p + 1)}
                    className="mt-2 w-full py-2.5 text-[12px] font-bold text-primary bg-primary/5 rounded-xl hover:bg-primary/10 transition-colors">
                    더보기 ({filteredTrades.length - pagedTrades.length}건 남음)
                  </button>
                )}
              </div>
            </div>
          )}

        </div>
      ) : null}
    </aside>
  );
};
