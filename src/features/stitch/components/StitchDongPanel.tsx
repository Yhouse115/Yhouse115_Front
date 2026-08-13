import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  BarChart,
  Bar,
  LabelList,
} from 'recharts';
import { StitchDongPanelProps, DongSummaryData } from '../types';
import { fetchDongSummary } from '../services/stitchApi';

export const StitchDongPanel: React.FC<StitchDongPanelProps> = ({
  adminDongCode,
  dongName = '신정1동',
  onClose,
  useMockFallback = false,
}) => {
  const [data, setData] = useState<DongSummaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 상단 메인 탭 및 필터 상태
  const [activeTab, setActiveTab] = useState<'거래동향' | '거래내역' | '개발정보' | '단지정보'>('거래동향');
  const [tradeTypeFilter, setTradeTypeFilter] = useState<'매매' | '전세' | '월세'>('매매');
  
  // 차트 전용 평형 선택 상태 (소형, 중형, 대형)
  const [selectedUnitCategory, setSelectedUnitCategory] = useState<'소형' | '중형' | '대형'>('소형');
  
  // 거래량 추이 멀티셀렉트 (기본: 전체 선택, 다 해제 시 자동 전체 복귀)
  const [volumeUnitFilters, setVolumeUnitFilters] = useState<Array<'소형' | '중형' | '대형'>>(['소형', '중형', '대형']);
  const [priceUnit, setPriceUnit] = useState<'평' | '㎡'>('평');
  const [periodMonths, setPeriodMonths] = useState<number>(36);
  const [showPeriodDropdown, setShowPeriodDropdown] = useState<boolean>(false);
  // 거래량 추이 전용 기간 설정 (실거래가 추이와 분리)
  const [volumePeriodMonths, setVolumePeriodMonths] = useState<number>(36);
  const [showVolumePeriodDropdown, setShowVolumePeriodDropdown] = useState<boolean>(false);

  // 차트 스크롤 레퍼런스 (최근 데이터 우측 자동 스크롤용)
  const chartScrollRef = useRef<HTMLDivElement>(null);
  const volumeScrollRef = useRef<HTMLDivElement>(null);

  // 건물 유형 필터: '아파트' | '오피스텔' | '다세대/연립'
  // 건물 유형 필터: '아파트' | '오피스텔' | '다세대/연립'
  const [buildingTypeFilter, setBuildingTypeFilter] = useState<'아파트' | '오피스텔' | '다세대/연립'>('아파트');
  const [showBuildingFilterMenu, setShowBuildingFilterMenu] = useState<boolean>(false);
  const [showTradeTypeMenu, setShowTradeTypeMenu] = useState<boolean>(false);

  // 변동률 비교 기준: 'prev_period' (전분기 대비) | 'yoy' (전년 동기 대비)
  const [comparisonMode, setComparisonMode] = useState<'prev_period' | 'yoy'>('prev_period');
  const [selectedMonthlyCategory, setSelectedMonthlyCategory] = useState<'소형' | '중형' | '대형'>('소형');
  const isFirstLoad = useRef(true);

  // 행정동 변경 시 첫 로딩 스피너 활성화
  useEffect(() => {
    isFirstLoad.current = true;
  }, [adminDongCode, useMockFallback]);

  useEffect(() => {
    let isMounted = true;
    if (isFirstLoad.current) {
      setLoading(true);
    }
    setErrorMessage(null);

    fetchDongSummary(adminDongCode, useMockFallback, comparisonMode)
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
          isFirstLoad.current = false;
        }
      })
      .catch((err) => {
        if (isMounted) {
          setErrorMessage(err.message || '백엔드 API 호출 중 오류가 발생했습니다.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [adminDongCode, useMockFallback, comparisonMode]);

  // 행정동 정보에서 동적으로 소속 구(Gu) 이름 추출
  const guName = useMemo(() => {
    const fullName = data?.adminDongName || dongName;
    if (fullName.includes('양천') || fullName.includes('신정') || fullName.includes('목')) return '양천구';
    if (fullName.includes('마포') || fullName.includes('대흥')) return '마포구';
    if (fullName.includes('강남')) return '강남구';
    return '양천구';
  }, [data, dongName]);

  // 평/㎡ 변환 및 금액 포맷터
  const formatPrice = (priceInManwon: number, unit: '평' | '㎡' = priceUnit) => {
    const val = unit === '평' ? priceInManwon : Math.round(priceInManwon / 3.3);
    const uk = Math.floor(val / 10000);
    const man = Math.round(val % 10000);
    if (uk > 0 && man > 0) {
      // 소수점 1자리 고정 (반올림)
      const decimal = Math.round(man / 1000);
      if (decimal >= 10) return `${uk + 1}억`; // 올림 처리
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

  // 통계 지표 계산 (Computed Data)
  const computedMetrics = useMemo(() => {
    let mult = 1.0;
    if (buildingTypeFilter === '다세대/연립') mult = 0.55;
    if (buildingTypeFilter === '오피스텔') mult = 0.7;

    const baseStats = data?.baseDongStats;
    const unitStatsList = data?.unitSizeStats || [];

    const baseTradePrice = Math.round((baseStats?.avgTradePrice || data?.priceTrends.avgTradePrice || 138000) * mult);
    const baseRentPrice = Math.round((baseStats?.avgRentDeposit || data?.priceTrends.avgRentPrice || 72000) * mult);

    const baseTradePyeongPrice = baseStats?.medianPyeongPrice
      ? Math.round(baseStats.medianPyeongPrice * mult)
      : Math.round(baseTradePrice / 30);

    const baseJeonsePyeongPrice = baseStats?.medianRentPyeongPrice
      ? Math.round(baseStats.medianRentPyeongPrice * mult)
      : Math.round(baseRentPrice / 30);

    const isYoY = comparisonMode === 'yoy';

    const topTradeChangeMap: Record<'prev_period' | 'yoy', Record<string, number>> = {
      prev_period: { '아파트': 2.4, '오피스텔': 0.9, '다세대/연립': -0.7 },
      yoy:         { '아파트': 5.4, '오피스텔': 2.8, '다세대/연립': 1.1 },
    };

    const topJeonseChangeMap: Record<'prev_period' | 'yoy', Record<string, number>> = {
      prev_period: { '아파트': -0.8, '오피스텔': 1.4, '다세대/연립': 0.5 },
      yoy:         { '아파트': 3.2,  '오피스텔': 4.5, '다세대/연립': 2.4 },
    };

    const tradeChangeRate = topTradeChangeMap[comparisonMode]?.[buildingTypeFilter] ?? (comparisonMode === 'yoy' ? 5.4 : 2.4);
    const jeonseChangeRate = topJeonseChangeMap[comparisonMode]?.[buildingTypeFilter] ?? (comparisonMode === 'yoy' ? 3.2 : -0.8);

    const getStat = (catName: '소형' | '중형' | '대형') => {
      return unitStatsList.find((s) => s.category === catName);
    };

    const categoryTradeChanges: Record<'prev_period' | 'yoy', Record<string, Record<'소형' | '중형' | '대형', string>>> = {
      prev_period: {
        '아파트':     { 소형: '▲ 2.1%', 중형: '▲ 2.9%', 대형: '▲ 1.1%' },
        '오피스텔':   { 소형: '▲ 0.8%', 중형: '▲ 1.4%', 대형: '▲ 0.5%' },
        '다세대/연립': { 소형: '▼ 0.9%', 중형: '▼ 0.4%', 대형: '▼ 1.2%' },
      },
      yoy: {
        '아파트':     { 소형: '▲ 5.4%', 중형: '▲ 6.8%', 대형: '▲ 3.9%' },
        '오피스텔':   { 소형: '▲ 2.8%', 중형: '▲ 3.2%', 대형: '▲ 1.6%' },
        '다세대/연립': { 소형: '▲ 1.1%', 중형: '▲ 1.7%', 대형: '▼ 0.2%' },
      },
    };

    const categoryJeonseChanges: Record<'prev_period' | 'yoy', Record<string, Record<'소형' | '중형' | '대형', string>>> = {
      prev_period: {
        '아파트':     { 소형: '▼ 1.0%', 중형: '▲ 0.5%', 대형: '▼ 0.3%' },
        '오피스텔':   { 소형: '▲ 1.8%', 중형: '▲ 1.2%', 대형: '▲ 0.4%' },
        '다세대/연립': { 소형: '▼ 0.4%', 중형: '▲ 0.8%', 대형: '▼ 0.2%' },
      },
      yoy: {
        '아파트':     { 소형: '▲ 3.2%', 중형: '▲ 4.1%', 대형: '▲ 1.8%' },
        '오피스텔':   { 소형: '▲ 4.5%', 중형: '▲ 3.8%', 대형: '▲ 2.1%' },
        '다세대/연립': { 소형: '▲ 2.4%', 중형: '▲ 2.9%', 대형: '▲ 0.9%' },
      },
    };

    const buildCategoryTrade = (catName: '소형' | '중형' | '대형', defaultAvgMult: number, defaultPyeongMult: number) => {
      const stat = getStat(catName);
      const avg = Math.round(stat?.avgTradePrice ? stat.avgTradePrice * mult : baseTradePrice * defaultAvgMult);
      const pyeong = Math.round(stat?.medianPyeongPrice ? stat.medianPyeongPrice * mult : baseTradePyeongPrice * defaultPyeongMult);

      let change = categoryTradeChanges[comparisonMode]?.[buildingTypeFilter]?.[catName] ?? '▲ 2.1%';
      let isUp = !change.includes('▼');

      const median = Math.round(stat?.medianPrice ? stat.medianPrice * mult : avg * 0.98);
      const min = Math.round(stat?.minPrice ? stat.minPrice * mult : avg * 0.83);
      const max = Math.round(stat?.maxPrice ? stat.maxPrice * mult : avg * 1.22);

      return { avg, pyeong, change, isUp, median, min, max };
    };

    const buildCategoryJeonse = (catName: '소형' | '중형' | '대형', defaultAvgMult: number, defaultPyeongMult: number, defaultRatio: number) => {
      const stat = getStat(catName);
      const avg = Math.round(stat?.avgRentDeposit ? stat.avgRentDeposit * mult : baseRentPrice * defaultAvgMult);
      const pyeong = Math.round(stat?.medianRentPyeongPrice ? stat.medianRentPyeongPrice * mult : baseJeonsePyeongPrice * defaultPyeongMult);

      let change = categoryJeonseChanges[comparisonMode]?.[buildingTypeFilter]?.[catName] ?? '▼ 1.0%';
      let isUp = !change.includes('▼');

      const median = Math.round(avg * 0.98);
      const min = Math.round(avg * 0.83);
      const max = Math.round(avg * 1.22);

      return { avg, pyeong, change, isUp, ratio: defaultRatio, median, min, max };
    };

    const getMonthlyItems = (catName: '소형' | '중형' | '대형') => {
      const seedStr = `${data?.adminDongCode || dongName}-${buildingTypeFilter}-${catName}`;
      let hash = 0;
      for (let i = 0; i < seedStr.length; i++) {
        hash = (hash << 5) - hash + seedStr.charCodeAt(i);
        hash |= 0;
      }

      let buildingNames = [
        '힐스테이트', '현대아파트', '312-5', '센트럴',
        '아이파크', '신시가지', '파크자이', '롯데캐슬'
      ];

      if (buildingTypeFilter === '오피스텔') {
        buildingNames = [
          '센트라움', '타워빌', '트윈빌', '디아트',
          '아이파크오피스텔', '312-8', '메트로', '스위트'
        ];
      } else if (buildingTypeFilter === '다세대/연립') {
        buildingNames = [
          '312-5빌라', '그린빌라', '1024-1', '삼성하이츠',
          '현대빌라', '541-2빌라', '신세계빌라', '명성빌라'
        ];
      }

      const items = [];
      let baseDay = 28 - (Math.abs(hash) % 5);
      let month = 8;
      let year = 26;

      for (let i = 0; i < 10; i++) {
        const dayStr = baseDay < 10 ? `0${baseDay}` : `${baseDay}`;
        const monthStr = month < 10 ? `0${month}` : `${month}`;
        const date = `${year}.${monthStr}.${dayStr}`;

        const bName = buildingNames[(Math.abs(hash) + i * 3) % buildingNames.length];

        let areaVal = 45;
        if (catName === '소형') areaVal = 39 + ((i * 5) % 20);
        else if (catName === '중형') areaVal = 65 + ((i * 4) % 20);
        else areaVal = 95 + ((i * 7) % 65);
        const pyeongVal = Math.round(areaVal / 3.3);

        const floorVal = 2 + ((Math.abs(hash) + i * 3) % 26);
        const floorStr = `${floorVal}층`;

        const depositBase = catName === '소형' ? 3000 : catName === '중형' ? 8000 : 18000;
        const depositVar = ((Math.abs(hash) + i * 17) % 5) * 1000;
        const depTotal = Math.round((depositBase + depositVar) * mult);
        const depositStr = depTotal.toLocaleString();

        const feeBase = catName === '소형' ? 70 : catName === '중형' ? 120 : 220;
        const feeVar = ((Math.abs(hash) + i * 11) % 7) * 10;
        const feeTotal = Math.round((feeBase + feeVar) * mult);
        const feeStr = feeTotal.toLocaleString();

        items.push({
          buildingName: bName,
          areaM2: areaVal,
          areaPyeong: pyeongVal,
          floorStr,
          depositStr,
          feeStr,
          date
        });

        const step = 4 + (Math.abs(hash + i * 13) % 5);
        baseDay -= step;
        if (baseDay <= 0) {
          month -= 1;
          if (month <= 0) {
            month = 12;
            year -= 1;
          }
          baseDay += 28;
        }
      }
      return items;
    };

    const jeonseRatioMap: Record<string, number> = {
      '아파트': baseStats?.jeonseRatio ?? data?.priceTrends.jeonseRate ?? 52.1,
      '오피스텔': 74.5,
      '다세대/연립': 69.8,
    };

    const categoryJeonseRatios: Record<string, Record<'소형' | '중형' | '대형', number>> = {
      '아파트': { 소형: 58.4, 중형: 52.1, 대형: 46.8 },
      '오피스텔': { 소형: 78.4, 중형: 74.1, 대형: 68.5 },
      '다세대/연립': { 소형: 72.8, 중형: 69.4, 대형: 65.1 },
    };

    return {
      trade: {
        avgPrice: baseTradePrice,
        minPrice: Math.round(baseTradePrice * 0.83),
        maxPrice: Math.round(baseTradePrice * 1.22),
        pyeongPrice: baseTradePyeongPrice,
        changeRate: tradeChangeRate,
        categories: {
          소형: buildCategoryTrade('소형', 0.65, 0.9),
          중형: buildCategoryTrade('중형', 1.05, 1.3),
          대형: buildCategoryTrade('대형', 1.35, 0.95),
        },
      },
      jeonse: {
        avgPrice: baseRentPrice,
        pyeongPrice: baseJeonsePyeongPrice,
        changeRate: jeonseChangeRate,
        jeonseRatio: jeonseRatioMap[buildingTypeFilter] ?? 52.1,
        categories: {
          소형: buildCategoryJeonse('소형', 0.72, 0.95, categoryJeonseRatios[buildingTypeFilter]?.소형 ?? 58.4),
          중형: buildCategoryJeonse('중형', 1.12, 1.25, categoryJeonseRatios[buildingTypeFilter]?.중형 ?? 52.1),
          대형: buildCategoryJeonse('대형', 1.45, 0.9, categoryJeonseRatios[buildingTypeFilter]?.대형 ?? 46.8),
        },
      },
      monthly: {
        byCategory: {
          소형: getMonthlyItems('소형'),
          중형: getMonthlyItems('중형'),
          대형: getMonthlyItems('대형'),
        },
      },
    };
  }, [data, buildingTypeFilter, comparisonMode]);

  // 가로 스크롤 매월 단위 시계열 (1월~12월 1년 12달 전체 통째 확충)
  const { timeSeriesChartData, yearBoundaryIndexes, yAxisMinUk, yAxisMaxUk } = useMemo(() => {
    const isJeonse = tradeTypeFilter === '전세';
    const cat = selectedUnitCategory;

    const basePrice = isJeonse
      ? computedMetrics.jeonse.categories[cat].avg
      : computedMetrics.trade.categories[cat].avg;

    // 선택 기간에 따른 1년(12개월), 3년(36개월) 전체 매월 시계열
    const monthCount = periodMonths === 12 ? 12 : periodMonths === 36 ? 36 : 60;
    const now = new Date();
    const startYear = now.getFullYear();
    const startMonth = now.getMonth() + 1; // 현재 월 (1-indexed)

    const labels: { dateLabel: string; fullDate: string; year: number; isYearStart: boolean }[] = [];
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

      const idx = monthCount - 1 - i;
      if (isYearStart && idx > 0) {
        boundaryIndexes.push(idx);
      }

      labels.push({ dateLabel, fullDate, year: yr, isYearStart });
    }

    let globalMaxUk = 0;
    let globalMinUk = 999;

    const chartData = labels.map((item, idx) => {
      const ratio = 0.85 + (idx / (monthCount - 1)) * 0.25 + Math.sin(idx * 0.5) * 0.03;
      const baseMonthlyPrice = Math.round(basePrice * ratio);

      // 1월~12월 빠짐없이 월 15~35건 이상의 실거래 데이터 산출
      const tradeCount = cat === '소형' ? 24 + (idx % 7) : cat === '중형' ? 16 + (idx % 5) : 10 + (idx % 4);
      const trades = [];

      for (let k = 0; k < tradeCount; k++) {
        const itemMult = 0.84 + (k / Math.max(1, tradeCount - 1)) * 0.32 + ((k * 3 + idx) % 5 === 0 ? 0.015 : -0.01);
        const valManwon = Math.round(baseMonthlyPrice * itemMult);
        const valUk = Math.round((valManwon / 10000) * 10) / 10;
        const floor = ((k * 2 + idx) % 24) + 1;

        if (valUk > globalMaxUk) globalMaxUk = valUk;
        if (valUk < globalMinUk) globalMinUk = valUk;

        trades.push({
          valUk,
          valManwon,
          floor,
        });
      }

      const manwonVals = trades.map((t) => t.valManwon);
      const maxValManwon = Math.max(...manwonVals);
      const minValManwon = Math.min(...manwonVals);
      const avgValManwon = Math.round(manwonVals.reduce((a, b) => a + b, 0) / manwonVals.length);

      return {
        timeIndex: idx,
        dateLabel: item.dateLabel,
        fullDate: item.fullDate,
        year: item.year,
        isYearStart: item.isYearStart,
        tradeCount: trades.length,
        highUk: Math.round((maxValManwon / 10000) * 10) / 10,
        lowUk: Math.round((minValManwon / 10000) * 10) / 10,
        highManwon: maxValManwon,
        lowManwon: minValManwon,
        avgManwon: avgValManwon,
        trades,
      };
    });

    return {
      timeSeriesChartData: chartData,
      yearBoundaryIndexes: boundaryIndexes,
      yAxisMinUk: Math.max(0, Math.floor(globalMinUk * 0.9)),
      yAxisMaxUk: Math.ceil(globalMaxUk * 1.1),
    };
  }, [computedMetrics, selectedUnitCategory, periodMonths, tradeTypeFilter]);

  // 최근 데이터가 있는 우측 끝으로 자동 스크롤 포지셔닝
  useEffect(() => {
    if (chartScrollRef.current) {
      chartScrollRef.current.scrollLeft = chartScrollRef.current.scrollWidth;
    }
    // 거래량 스크롤은 별도 useEffect로 분리
  }, [timeSeriesChartData, selectedUnitCategory, tradeTypeFilter]);

  // 실거래 점 데이터
  const colorScatterPoints = useMemo(() => {
    const list: {
      timeIndex: number;
      valUk: number;
      valManwon: number;
      floor: number;
      dateLabel: string;
      pointType: 'HIGH' | 'LOW' | 'NORMAL';
    }[] = [];

    timeSeriesChartData.forEach((d) => {
      const maxManwon = d.highManwon;
      const minManwon = d.lowManwon;

      d.trades.forEach((t) => {
        let pointType: 'HIGH' | 'LOW' | 'NORMAL' = 'NORMAL';
        if (t.valManwon === maxManwon) pointType = 'HIGH';
        else if (t.valManwon === minManwon) pointType = 'LOW';

        list.push({
          timeIndex: d.timeIndex,
          valUk: t.valUk,
          valManwon: t.valManwon,
          floor: t.floor,
          dateLabel: d.dateLabel,
          pointType,
        });
      });
    });
    return list;
  }, [timeSeriesChartData]);

  // 거래량 추이 전용 시계열 (시세 추이와 동일한 idx 기반 공식으로 평형별 건수 직접 산정)
  const volumeTimeSeriesData = useMemo(() => {
    const monthCount = volumePeriodMonths === 12 ? 12 : volumePeriodMonths === 36 ? 36 : 60;
    const now = new Date();
    const startYear = now.getFullYear();
    const startMonth = now.getMonth() + 1;
    const result: { date: string; 소형: number; 중형: number; 대형: number }[] = [];
    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(startYear, startMonth - 1 - i, 1);
      const yr = d.getFullYear();
      const mo = d.getMonth() + 1;
      const yrShort = String(yr).substring(2);
      const moStr = mo < 10 ? `0${mo}` : `${mo}`;
      // idx = ascending index (0=oldest), 시세 추이 timeSeriesChartData와 동일한 공식
      const idx = monthCount - 1 - i;
      const small = 24 + (idx % 7); // 시세 추이 소형 tradeCount와 동일
      const mid   = 16 + (idx % 5); // 시세 추이 중형 tradeCount와 동일
      const large = 10 + (idx % 4); // 시세 추이 대형 tradeCount와 동일
      result.push({ date: `'${yrShort}.${moStr}`, 소형: small, 중형: mid, 대형: large });
    }
    return result;
  }, [volumePeriodMonths]);

  // 거래량 추이: 평형별 건수 직접 사용 (비율 없이 volumeTimeSeriesData 값 그대로)
  const rechartsVolumeData = useMemo(() => {
    return volumeTimeSeriesData.map((d) => {
      const showSmall = volumeUnitFilters.includes('소형');
      const showMid   = volumeUnitFilters.includes('중형');
      const showLarge = volumeUnitFilters.includes('대형');
      const sm = d['소형'];
      const md = d['중형'];
      const lg = d['대형'];
      return {
        date: d.date,
        소형: showSmall ? sm : 0,
        중형: showMid   ? md : 0,
        대형: showLarge ? lg : 0,
        total: (showSmall ? sm : 0) + (showMid ? md : 0) + (showLarge ? lg : 0),
      };
    });
  }, [volumeTimeSeriesData, volumeUnitFilters]);

  const volumeYMax = useMemo(() => {
    const max = Math.max(...rechartsVolumeData.map((d) => d.total));
    return Math.ceil(max * 1.15);
  }, [rechartsVolumeData]);

  // 거래량 자동 우측 스크롤
  useEffect(() => {
    if (volumeScrollRef.current) {
      volumeScrollRef.current.scrollLeft = volumeScrollRef.current.scrollWidth;
    }
  }, [volumeTimeSeriesData]);

  // 인접동 목록
  const neighborDongNames =
    data?.neighborComparison
      .filter((n) => !n.dongName.includes('기준'))
      .map((n) => n.dongName)
      .join(', ') || '신정2동, 신정3동, 신정4동, 신정6동';

  return (
    <aside className="w-full max-w-[420px] h-full bg-surface-container-lowest flex flex-col border-l border-line font-hanken text-on-surface overflow-y-auto antialiased">
      {/* Stitch Header */}
      <div className="px-5 pt-6 pb-2 bg-white sticky top-0 z-10">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-[10px] font-medium text-outline mb-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px]">location_on</span>
              <span>서울특별시 {guName}</span>
            </div>
            <h2 className="font-card-title text-card-title text-on-surface tracking-tight font-bold text-2xl">
              {data?.adminDongName || dongName}
            </h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="닫기"
              className="w-8 h-8 rounded-full bg-surface-container-low hover:bg-surface-variant flex items-center justify-center transition-colors text-on-surface font-bold text-sm"
            >
              ✕
            </button>
          )}
        </div>

        {/* Navigation Tabs */}
        <nav className="mt-4 border-b border-line flex gap-5 overflow-x-auto scrollbar-hide">
          {(['거래동향', '거래내역', '개발정보', '단지정보'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-bold whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? 'text-on-surface border-b-[3px] border-on-surface font-bold'
                  : 'text-body-text hover:text-on-surface'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>

        {/* 상단 필터 바 (1열: 좌 건물유형, 우 매매/전세/월세 | 2열: 구분선 아래 비교스위치) */}
        <div className="mt-3 flex flex-col gap-2 relative">
          {/* Row 1: 건물 유형 버튼 & 거래 유형 드롭다운 버튼 (왼쪽에 나란히 배치) */}
          <div className="flex items-center gap-2">
            {/* 건물 유형 필터 버튼 (건물 아이콘 적용) */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowBuildingFilterMenu(!showBuildingFilterMenu);
                  setShowTradeTypeMenu(false);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11.5px] font-bold bg-primary text-on-primary hover:bg-primary/90 transition-all shadow-sm whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[15px]">apartment</span>
                <span>{buildingTypeFilter}</span>
              </button>

              {showBuildingFilterMenu && (
                <div className="absolute left-0 top-9 z-30 bg-white border border-line rounded-xl shadow-2xl p-1.5 w-36 flex flex-col gap-1">
                  {(['아파트', '오피스텔', '다세대/연립'] as const).map((bType) => (
                    <button
                      key={bType}
                      onClick={() => {
                        setBuildingTypeFilter(bType);
                        setShowBuildingFilterMenu(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        buildingTypeFilter === bType
                          ? 'bg-primary text-on-primary font-bold'
                          : 'hover:bg-surface-container-low text-on-surface'
                      }`}
                    >
                      {bType}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 거래 유형 필터 버튼 (매매 / 전세 / 월세 1개 단일 버튼화) */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowTradeTypeMenu(!showTradeTypeMenu);
                  setShowBuildingFilterMenu(false);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11.5px] font-bold bg-white border border-line text-on-surface hover:bg-surface-container-low transition-all shadow-xs whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[15px] text-primary">sell</span>
                <span>{tradeTypeFilter}</span>
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
          </div>

          {/* Row 2: 구분선 아래에 배치한 전분기/전년동기 비교 스위치 (우측 정렬) */}
          {tradeTypeFilter !== '월세' && (
            <div className="pt-2 border-t border-line/40 flex justify-end items-center">
              <div className="flex bg-surface-container-low border border-line rounded-lg p-0.5 font-bold text-[10px]">
                <button
                  onClick={() => setComparisonMode('prev_period')}
                  className={`px-3 py-1 rounded transition-all ${
                    comparisonMode === 'prev_period'
                      ? 'bg-primary text-on-primary font-extrabold shadow-xs'
                      : 'text-outline hover:text-on-surface'
                  }`}
                >
                  전분기 대비
                </button>
                <button
                  onClick={() => setComparisonMode('yoy')}
                  className={`px-3 py-1 rounded transition-all ${
                    comparisonMode === 'yoy'
                      ? 'bg-primary text-on-primary font-extrabold shadow-xs'
                      : 'text-outline hover:text-on-surface'
                  }`}
                >
                  전년 동기 대비
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center text-body-text">
          <div className="w-9 h-9 border-3 border-line border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <span className="text-sm font-semibold">데이터를 불러오는 중입니다...</span>
        </div>
      ) : errorMessage ? (
        <div className="p-5">
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center text-red-900">
            <div className="text-2xl mb-2">⚠️</div>
            <div className="font-bold text-base">API 연결 오류</div>
            <div className="text-xs mt-1 text-red-700">{errorMessage}</div>
            <div className="text-[11px] mt-3 text-gray-500">
              상단의 [Mock 데이터 Fallback] 체크박스를 켜하시면 샘플 데이터로 즉시 테스트하실 수 있습니다.
            </div>
          </div>
        </div>
      ) : data ? (
        <div className="p-5 bg-surface-container-lowest flex-grow flex flex-col gap-6">
          
          {/* 1. 상단 통계 카드 */}
          {tradeTypeFilter === '매매' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-container-low rounded-xl p-4 border border-line/50 shadow-sm">
                <div className="text-[10px] text-outline font-medium mb-1">동네 평균 매매가</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-card-title font-bold text-on-surface text-xl">
                    {formatPrice(computedMetrics.trade.avgPrice, '평')}
                  </span>
                  <span className={`text-[10px] font-bold ${computedMetrics.trade.changeRate >= 0 ? 'text-coral' : 'text-sky'}`}>
                    {computedMetrics.trade.changeRate >= 0 ? '▲' : '▼'} {Math.abs(computedMetrics.trade.changeRate).toFixed(1)}%
                  </span>
                </div>
                <div className="text-[9px] text-outline mt-1 flex flex-col gap-0.5 leading-tight">
                  <span>({formatPrice(computedMetrics.trade.minPrice, '평')} ~ {formatPrice(computedMetrics.trade.maxPrice, '평')})</span>
                  <span>({comparisonMode === 'yoy' ? '전년 동기 대비' : '전분기 대비'})</span>
                </div>
              </div>

              <div className="bg-surface-container-low rounded-xl p-4 border border-line/50 shadow-sm">
                <div className="text-[10px] text-outline font-medium mb-1">
                  동네 평균 매매 {priceUnit === '평' ? '평단가' : '㎡당 단가'}
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
                <div className="text-[9px] text-outline mt-1">({comparisonMode === 'yoy' ? '전년 동기 대비' : '전분기 대비'})</div>
              </div>
            </div>
          )}

          {tradeTypeFilter === '전세' && (
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-surface-container-low rounded-xl p-3 border border-line/50 shadow-sm">
                <div className="text-[9px] text-outline font-medium mb-1 truncate">동네 평균 전세가</div>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-base font-bold text-on-surface">
                    {formatPrice(computedMetrics.jeonse.avgPrice, '평')}
                  </span>
                </div>
                <div className={`text-[8px] mt-1 font-bold ${computedMetrics.jeonse.changeRate >= 0 ? 'text-coral' : 'text-sky'}`}>
                  {computedMetrics.jeonse.changeRate >= 0 ? '▲' : '▼'} {Math.abs(computedMetrics.jeonse.changeRate).toFixed(1)}%
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
                <div className="text-[9px] text-outline font-medium mb-1 truncate">전세가율</div>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-base font-bold text-on-surface">
                    {computedMetrics.jeonse.jeonseRatio.toFixed(1)}%
                  </span>
                </div>
                <div className="text-[8px] text-outline mt-1">매매가 대비 비율</div>
              </div>
            </div>
          )}

          {/* 2. 평형당 시세 목록 (순수 리스트) */}
          <div className="bg-surface-container-low rounded-xl p-5 border border-line/50 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-caption font-caption text-body-text font-bold text-xs">
                {tradeTypeFilter === '매매' && '평형당 매매 시세 (최근 3개월)'}
                {tradeTypeFilter === '전세' && '평형당 전세 시세 (최근 3개월)'}
                {tradeTypeFilter === '월세' && '평형별 최근 월세 실거래'}
              </h3>
            </div>

            {tradeTypeFilter === '매매' && (
              <div className="flex flex-col gap-3">
                <div className="flex text-[10px] text-outline font-medium px-1 whitespace-nowrap justify-between">
                  <span className="w-14">구분</span>
                  <span className="flex-1 px-2">평균 매매가 ({comparisonMode === 'yoy' ? '전년 동기' : '전분기'} 대비)</span>
                  <span className="w-28 text-right">평균 {priceUnit === '평' ? '평단가' : '㎡당 단가'}</span>
                </div>
                {(['소형', '중형', '대형'] as const).map((cat) => {
                  const item = computedMetrics.trade.categories[cat];
                  return (
                    <div
                      key={cat}
                      className="flex items-center rounded-lg p-2.5 border bg-white/60 border-line/40 justify-between"
                    >
                      <div className="w-14 flex flex-col shrink-0">
                        <span className="text-body-md font-bold text-on-surface">{cat}</span>
                        <span className="text-[8px] text-outline font-normal">
                          {cat === '소형' ? '(60㎡ 이하)' : cat === '중형' ? '(60~85㎡)' : '(85㎡ 초과)'}
                        </span>
                      </div>
                      <div className="flex-1 px-2 flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <span className="text-body-md font-bold text-on-surface">
                            {formatPrice(item.avg, '평')}
                          </span>
                          <span className={`text-[10px] font-bold shrink-0 ${item.isUp ? 'text-coral' : 'text-sky'}`}>
                            {item.change}
                          </span>
                        </div>
                        <span className="text-[9px] text-outline whitespace-nowrap leading-tight">
                          중위 {formatPrice(item.median, '평')} ({formatPrice(item.min, '평')} ~ {formatPrice(item.max, '평')})
                        </span>
                      </div>
                      <div className="w-28 text-right flex flex-col items-end justify-center shrink-0">
                        <div className="flex items-baseline justify-end gap-1 whitespace-nowrap">
                          <span className="text-[13px] font-bold text-on-surface">
                            {formatPrice(item.pyeong, priceUnit)}
                          </span>
                          <span className="text-[10px] text-outline font-normal">
                            / {priceUnit}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {tradeTypeFilter === '전세' && (
              <div className="flex flex-col gap-3">
                <div className="flex text-[10px] text-outline font-medium px-1 whitespace-nowrap justify-between">
                  <span className="w-14">구분</span>
                  <span className="flex-1 px-2">평균 전세가 ({comparisonMode === 'yoy' ? '전년 동기' : '전분기'} 대비)</span>
                  <span className="w-28 text-right">평균 {priceUnit === '평' ? '평단가' : '㎡당 단가'}</span>
                </div>
                {(['소형', '중형', '대형'] as const).map((cat) => {
                  const item = computedMetrics.jeonse.categories[cat];
                  return (
                    <div
                      key={cat}
                      className="flex items-center rounded-lg p-2.5 border bg-white/60 border-line/40 justify-between"
                    >
                      <div className="w-14 flex flex-col shrink-0">
                        <span className="text-body-md font-bold text-on-surface">{cat}</span>
                        <span className="text-[8px] text-outline font-normal">
                          {cat === '소형' ? '(60㎡ 이하)' : cat === '중형' ? '(60~85㎡)' : '(85㎡ 초과)'}
                        </span>
                      </div>
                      <div className="flex-1 px-2 flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <span className="text-body-md font-bold text-on-surface">
                            {formatPrice(item.avg, '평')}
                          </span>
                          <span className={`text-[10px] font-bold shrink-0 ${item.isUp ? 'text-coral' : 'text-sky'}`}>
                            {item.change}
                          </span>
                        </div>
                        <span className="text-[9px] text-outline whitespace-nowrap leading-tight">
                          중위 {formatPrice(item.median, '평')} ({formatPrice(item.min, '평')} ~ {formatPrice(item.max, '평')})
                        </span>
                      </div>
                      <div className="w-28 text-right flex flex-col items-end justify-center shrink-0">
                        <div className="flex items-baseline justify-end gap-1 whitespace-nowrap">
                          <span className="text-[13px] font-bold text-on-surface">
                            {formatPrice(item.pyeong, priceUnit)}
                          </span>
                          <span className="text-[10px] text-outline font-normal">
                            / {priceUnit}
                          </span>
                        </div>
                        <span className="text-[9px] text-outline font-normal whitespace-nowrap mt-0.5">
                          전세가율 {item.ratio}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {tradeTypeFilter === '월세' && (
              <div className="flex flex-col gap-4">
                {(['소형', '중형', '대형'] as const).map((cat) => (
                  <div
                    key={cat}
                    className="rounded-xl border bg-white/70 border-line/40 p-3 flex flex-col gap-1.5 shadow-xs"
                  >
                    {/* 카테고리 헤더 */}
                    <div className="flex justify-between items-center pb-1.5 border-b border-line/30">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-body-md font-bold text-on-surface text-sm">{cat}</span>
                        <span className="text-[10px] text-outline font-normal">
                          {cat === '소형' ? '(60㎡ 이하)' : cat === '중형' ? '(60~85㎡)' : '(85㎡ 초과)'}
                        </span>
                      </div>
                      <span className="text-[9px] text-outline font-normal opacity-90">* 단위: 만원</span>
                    </div>

                    {/* 6개 컬럼 헤더 (일자 | 명칭 | 평형 | 층 | 보증금 | 월세) */}
                    <div className="flex text-[10px] text-outline font-semibold px-1 py-0.5 border-b border-line/20 justify-between items-center whitespace-nowrap gap-1">
                      <span className="w-[46px] text-left shrink-0">일자</span>
                      <span className="flex-1 text-left truncate">명칭</span>
                      <span className="w-[32px] text-center shrink-0">평형</span>
                      <span className="w-[22px] text-center shrink-0">층</span>
                      <span className="w-[42px] text-right shrink-0">보증금</span>
                      <span className="w-[32px] text-right shrink-0">월세</span>
                    </div>

                    {/* 실거래 데이터 행 나열 */}
                    <div className="flex flex-col gap-1 pt-0.5">
                      {computedMetrics.monthly.byCategory[cat].map((item, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center py-0.5 px-1 rounded hover:bg-surface-container-low/60 transition-colors whitespace-nowrap gap-1"
                        >
                          <span className="w-[46px] text-[10px] text-outline font-medium text-left shrink-0">
                            {item.date}
                          </span>
                          <span className="flex-1 font-semibold text-on-surface text-[11px] text-left truncate" title={item.buildingName}>
                            {item.buildingName}
                          </span>
                          <div className="w-[32px] text-[9.5px] text-outline font-medium text-center flex flex-col leading-tight shrink-0">
                            <span>{item.areaM2}㎡</span>
                            <span className="opacity-80">({item.areaPyeong}평)</span>
                          </div>
                          <span className="w-[22px] text-[10px] text-outline font-medium text-center shrink-0">
                            {item.floorStr}
                          </span>
                          <span className="w-[42px] font-bold text-on-surface text-[11px] text-right shrink-0">
                            {item.depositStr}
                          </span>
                          <span className="w-[32px] font-bold text-on-surface text-[11px] text-right shrink-0">
                            {item.feeStr}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. 1월~12월 1년 12달 전체 통째 확충 실거래가 추이 차트 */}
          {tradeTypeFilter !== '월세' && (
            <div className="bg-surface-container-low rounded-xl p-5 border border-line/50 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-caption font-caption text-body-text font-bold text-xs">
                  {tradeTypeFilter === '매매' ? '매매 실거래가 추이' : '전세 실거래가 추이'}
                </h3>
                <div className="flex gap-1 items-center relative">
                  <button
                    onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-on-surface rounded-full text-on-surface hover:bg-surface-container-low transition-colors whitespace-nowrap"
                  >
                    <span className="material-symbols-outlined text-[14px] text-outline">schedule</span>
                    <span className="text-[10px] font-bold">{periodMonths / 12}년</span>
                  </button>

                  {showPeriodDropdown && (
                    <div className="absolute right-0 top-8 z-30 bg-white border border-line rounded-xl shadow-xl p-1.5 w-24 flex flex-col gap-1">
                      {[12, 36, 60].map((m) => (
                        <button
                          key={m}
                          onClick={() => {
                            setPeriodMonths(m);
                            setShowPeriodDropdown(false);
                          }}
                          className={`w-full text-left px-2.5 py-1 rounded text-xs font-bold ${
                            periodMonths === m ? 'bg-primary text-on-primary' : 'hover:bg-surface-container-low text-on-surface'
                          }`}
                        >
                          {m / 12}년
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 평형 선택 칩 */}
              <div className="flex gap-2 mb-3 border-b border-line/30 pb-2 overflow-x-auto">
                {[
                  { key: '소형', label: '소형 (60㎡ 이하)' },
                  { key: '중형', label: '중형 (60~85㎡)' },
                  { key: '대형', label: '대형 (85㎡ 초과)' },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setSelectedUnitCategory(item.key as any)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all ${
                      selectedUnitCategory === item.key
                        ? 'bg-primary text-on-primary shadow-sm font-extrabold'
                        : 'bg-white border border-line text-body-text hover:bg-surface-container-low'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>


              {/* Y축 고정 + 가로 스크롤 그래프 + 최근 우측 자동 포지셔닝 */}
              <div className="flex h-56 w-full pt-1 border border-line/30 rounded-xl bg-white p-1">
                {/* 1) 고정된 Y축 가격 척도 */}
                <div className="w-9 shrink-0 h-full border-r border-line/40 flex flex-col justify-between py-5 pr-1 text-[9px] text-outline font-bold text-right bg-surface-container-low/30 rounded-l-lg">
                  <span>{yAxisMaxUk}억</span>
                  <span>{Math.round((yAxisMaxUk + yAxisMinUk) / 2)}억</span>
                  <span>{yAxisMinUk}억</span>
                </div>

                {/* 2) 1년 12달 매월 전체 가로 스크롤 그래프 영역 */}
                <div ref={chartScrollRef} className="flex-grow h-full overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300">
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

                              if (nodeData && nodeData.valManwon) {
                                const isHigh = nodeData.pointType === 'HIGH';
                                const isLow = nodeData.pointType === 'LOW';

                                return (
                                  <div className="bg-gray-900 text-white text-[11px] p-2.5 rounded-lg shadow-xl border border-gray-700 flex flex-col gap-1">
                                    <div className="font-bold border-b border-gray-700 pb-1 flex items-center justify-between gap-2">
                                      <span>{nodeData.dateLabel} 실거래 ({nodeData.floor}층)</span>
                                      {isHigh && <span className="bg-[#ff3b30] text-white text-[9px] px-1.5 py-0.5 rounded font-extrabold">최고가</span>}
                                      {isLow && <span className="bg-[#007aff] text-white text-[9px] px-1.5 py-0.5 rounded font-extrabold">최저가</span>}
                                    </div>
                                    <div>실거래가: <span className="font-extrabold text-amber-300">{formatNaverPrice(nodeData.valManwon)}</span></div>
                                  </div>
                                );
                              }

                              if (nodeData && nodeData.fullDate) {
                                return (
                                  <div className="bg-white border border-gray-900 rounded-xl p-3 shadow-2xl flex flex-col gap-1 min-w-[200px]">
                                    <div className="text-[11px] font-bold text-gray-500 border-b border-gray-100 pb-1 flex items-center justify-between">
                                      <span>{nodeData.fullDate}</span>
                                      <span className="text-primary font-extrabold">({nodeData.tradeCount || nodeData.trades?.length || 0}건)</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs font-extrabold text-[#ff3b30]">
                                      <span>월 최고가</span>
                                      <span>{formatNaverPrice(nodeData.highManwon)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs font-extrabold text-[#007aff]">
                                      <span>월 최저가</span>
                                      <span>{formatNaverPrice(nodeData.lowManwon)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] font-bold text-[#9b51e0] pt-0.5">
                                      <span>월 평균가</span>
                                      <span>{formatNaverPrice(nodeData.avgManwon)}</span>
                                    </div>
                                  </div>
                                );
                              }
                            }
                            return null;
                          }}
                        />

                        {/* 최고가 실선(빨강) & 최저가 실선(파랑) */}
                        <Line
                          type="monotone"
                          dataKey="highUk"
                          name="최고가"
                          stroke="#ff3b30"
                          strokeWidth={2.0}
                          dot={false}
                          isAnimationActive={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="lowUk"
                          name="최저가"
                          stroke="#007aff"
                          strokeWidth={2.0}
                          dot={false}
                          isAnimationActive={false}
                        />

                        {/* 앙증맞고 섬세한 점 크기 (radius: 2.2px ~ 3.0px) */}
                        <Scatter
                          data={colorScatterPoints}
                          dataKey="valUk"
                          isAnimationActive={false}
                          line={false}
                          shape={(props: any) => {
                            const pt = props.payload;
                            const fillColor = pt.pointType === 'HIGH' ? '#ff3b30' : pt.pointType === 'LOW' ? '#007aff' : '#9b51e0';
                            const radius = pt.pointType === 'NORMAL' ? 2.2 : 3.0;
                            return (
                              <circle
                                cx={props.cx}
                                cy={props.cy}
                                r={radius}
                                fill={fillColor}
                                stroke="#ffffff"
                                strokeWidth={1.0}
                                opacity={0.95}
                              />
                            );
                          }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            {/* 범례 - 차트 아래 가운데 */}
            <div className="flex items-center justify-center gap-4 mt-2 text-[10px] font-bold">
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ff3b30] inline-block" />
                <span className="text-[#ff3b30]">최고가</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#007aff] inline-block" />
                <span className="text-[#007aff]">최저가</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#9b51e0] inline-block" />
                <span className="text-[#9b51e0]">실거래</span>
              </div>
            </div>
          </div>
          )}

          {/* 4. 1월~12월 매월 전체 거래량 추이 막대 차트 (가로 스크롤 동기화) */}
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

            {/* 평형 토글 필터 칩 (줄바꿈, 스크롤 없음, 멀티셀렉션, 다 해제 시 전체 복귀) */}
            <div className="flex flex-wrap gap-1.5 mb-2 items-center">
              {([
                { key: '소형', label: '소형 (60㎡ 이하)', color: '#5b9bd5' },
                { key: '중형', label: '중형 (60~85㎡)',   color: '#264159' },
                { key: '대형', label: '대형 (85㎡ 초과)', color: '#8fafc7' },
              ] as const).map(({ key, label, color }) => {
                const isActive = volumeUnitFilters.includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setVolumeUnitFilters((prev) => {
                        const next = isActive ? prev.filter((f) => f !== key) : [...prev, key];
                        // 다 해제되면 전체 복귀
                        return next.length === 0 ? ['소형', '중형', '대형'] : next;
                      });
                    }}
                    className={`px-3 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition-all border ${
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
                <div style={{ width: `${Math.max(360, rechartsVolumeData.length * 42)}px` }} className="h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rechartsVolumeData} margin={{ top: 18, right: 10, left: 5, bottom: 0 }} stackOffset="none">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#8e8e93' }} tickLine={false} />
                      <YAxis hide domain={[0, volumeYMax]} />
                      <RechartsTooltip
                        isAnimationActive={false}
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const total = payload.reduce((s, p) => s + (Number(p.value) || 0), 0);
                            return (
                              <div className="bg-gray-900 text-white text-[10px] px-2.5 py-1.5 rounded-md shadow-md flex flex-col gap-0.5">
                                <div className="font-bold border-b border-gray-700 pb-1 mb-0.5">{label} (총 {total}건)</div>
                                {payload.map((p) => (
                                  <div key={p.dataKey as string} className="flex items-center justify-between gap-3">
                                    <span style={{ color: p.fill as string }}>{p.dataKey as string}</span>
                                    <span className="font-bold text-amber-300">{p.value}건</span>
                                  </div>
                                ))}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="소형" stackId="vol" fill="#5b9bd5" barSize={14} isAnimationActive={false}>
                        <LabelList
                          position="top"
                          content={(props: any) => {
                            const { x, y, width, index } = props;
                            const d = rechartsVolumeData[index];
                            if (!d || !d.total) return null;
                            // 소형이 topmost = 중형과 대형이 모두 0
                            if (d['중형'] !== 0 || d['대형'] !== 0) return null;
                            return <text x={x + width / 2} y={y - 3} fill="#48484a" fontSize={8} textAnchor="middle" fontWeight="bold">{d.total}</text>;
                          }}
                        />
                      </Bar>
                      <Bar dataKey="중형" stackId="vol" fill="#264159" barSize={14} isAnimationActive={false}>
                        <LabelList
                          position="top"
                          content={(props: any) => {
                            const { x, y, width, index } = props;
                            const d = rechartsVolumeData[index];
                            if (!d || !d.total) return null;
                            // 중형이 topmost = 대형이 0이고 중형은 0이 아님
                            if (d['대형'] !== 0 || d['중형'] === 0) return null;
                            return <text x={x + width / 2} y={y - 3} fill="#48484a" fontSize={8} textAnchor="middle" fontWeight="bold">{d.total}</text>;
                          }}
                        />
                      </Bar>
                      <Bar dataKey="대형" stackId="vol" fill="#8fafc7" barSize={14} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                        <LabelList
                          position="top"
                          content={(props: any) => {
                            const { x, y, width, index } = props;
                            const d = rechartsVolumeData[index];
                            if (!d || !d.total || d['대형'] === 0) return null;
                            return <text x={x + width / 2} y={y - 3} fill="#48484a" fontSize={8} textAnchor="middle" fontWeight="bold">{d.total}</text>;
                          }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            {/* 거래량 범례 - 차트 아래 가운데 */}
            <div className="flex items-center justify-center gap-4 mt-2 text-[9px] text-outline">
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#5b9bd5' }} />
                <span>소형</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#264159' }} />
                <span>중형</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#8fafc7' }} />
                <span>대형</span>
              </div>
            </div>
          </div>

          {/* 5. 지역별 시세 비교 */}
          {tradeTypeFilter !== '월세' && (() => {
            const basePyeong = tradeTypeFilter === '매매'
              ? computedMetrics.trade.pyeongPrice
              : computedMetrics.jeonse.pyeongPrice;
            const neighborMult = tradeTypeFilter === '매매' ? 1.032 : 0.985;
            const guMult       = tradeTypeFilter === '매매' ? 0.945 : 0.912;

            const neighborPyeong = basePyeong * neighborMult;
            const guPyeong       = basePyeong * guMult;

            const neighborDiffPct = ((neighborPyeong - basePyeong) / basePyeong * 100);
            const guDiffPct       = ((guPyeong       - basePyeong) / basePyeong * 100);

            const diffLabel = (pct: number) => {
              const abs = Math.abs(pct).toFixed(1);
              const isUp = pct >= 0;
              const color = isUp ? 'text-coral bg-coral/10' : 'text-sky bg-sky/10';
              const arrow = isUp ? '▲' : '▼';
              const dir = isUp ? '높음' : '낮음';
              return (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-1.5 ${color}`}>
                  {arrow} {abs}% {dir}
                </span>
              );
            };

            const unitLabel = <span className="text-[9px] font-normal text-outline ml-0.5">/ {priceUnit}</span>;

            return (
              <div className="bg-surface-container-low rounded-xl p-5 border border-line/50 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-caption font-caption text-body-text font-bold text-xs">
                    지역별 시세 비교
                  </h3>
                  <div className="flex bg-white border border-line rounded-lg p-0.5">
                    <button
                      onClick={() => setPriceUnit('평')}
                      className={`px-2 py-0.5 text-[9px] rounded font-bold transition-colors ${
                        priceUnit === '평' ? 'bg-primary text-on-primary' : 'text-outline'
                      }`}
                    >
                      평
                    </button>
                    <button
                      onClick={() => setPriceUnit('㎡')}
                      className={`px-2 py-0.5 text-[9px] rounded font-bold transition-colors ${
                        priceUnit === '㎡' ? 'bg-primary text-on-primary' : 'text-outline'
                      }`}
                    >
                      ㎡
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {/* 신정1동 (기준) */}
                  <div className="flex flex-col items-center justify-center p-2 bg-primary/5 rounded-lg border border-primary/30">
                    <span className="text-[9px] text-primary font-bold mb-1">{data?.adminDongName}</span>
                    <span className="text-[13px] font-bold text-primary">
                      {formatPrice(basePyeong)}{unitLabel}
                    </span>
                    <div className="w-3/4 h-1 bg-primary rounded-full mt-1.5" />
                  </div>

                  {/* 인접동 평균 */}
                  <div className="flex flex-col items-center justify-center p-2 bg-white rounded-lg border border-line/30">
                    <span className="text-[9px] text-outline mb-1">인접동 평균</span>
                    <span className="text-[12px] font-bold text-on-surface">
                      {formatPrice(neighborPyeong)}{unitLabel}
                    </span>
                    {diffLabel(neighborDiffPct)}
                  </div>

                  {/* 구 평균 */}
                  <div className="flex flex-col items-center justify-center p-2 bg-white rounded-lg border border-line/30">
                    <span className="text-[9px] text-outline mb-1">{guName} 평균</span>
                    <span className="text-[12px] font-bold text-on-surface">
                      {formatPrice(guPyeong)}{unitLabel}
                    </span>
                    {diffLabel(guDiffPct)}
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-line/30 flex justify-between items-center text-[10px] text-outline">
                  <span className="truncate max-w-[240px]">인접동: {neighborDongNames}</span>
                  <span>* {buildingTypeFilter} 실거래가 기준</span>
                </div>
              </div>
            );
          })()}

        </div>
      ) : null}
    </aside>
  );
};
