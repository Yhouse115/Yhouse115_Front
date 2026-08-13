import React, { useEffect, useState } from 'react';
import { StitchBuildingPanelProps, BuildingSummaryData } from '../types';
import { fetchBuildingSummary } from '../services/stitchApi';

export const StitchBuildingPanel: React.FC<StitchBuildingPanelProps> = ({
  pnu,
  buildingName = '목동신시가지 5단지',
  onClose,
  useMockFallback = true,
}) => {
  const [data, setData] = useState<BuildingSummaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'trends' | 'trades' | 'units'>('trends');
  const [tradeFilter, setTradeFilter] = useState<'전체' | '매매' | '전세' | '월세'>('전체');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setErrorMessage(null);

    fetchBuildingSummary(pnu, useMockFallback)
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
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
  }, [pnu, useMockFallback]);

  const formatPrice = (priceInManwon: number) => {
    const uk = Math.floor(priceInManwon / 10000);
    const man = priceInManwon % 10000;
    if (uk > 0 && man > 0) return `${uk}억 ${man.toLocaleString()}만원`;
    if (uk > 0) return `${uk}억원`;
    return `${man.toLocaleString()}만원`;
  };

  const filteredTrades = data?.recentTransactions.filter(
    (t) => tradeFilter === '전체' || t.tradeType === tradeFilter
  ) || [];

  return (
    <aside className="w-full max-w-[420px] h-full bg-surface-container-lowest flex flex-col border-l border-line font-hanken text-on-surface overflow-y-auto antialiased">
      {/* Stitch Header */}
      <div className="px-5 pt-6 pb-4 bg-white border-b border-line sticky top-0 z-10">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-[10px] font-medium text-outline mb-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">location_on</span>
              <span>{data?.address || '서울특별시 양천구 목동'}</span>
            </div>
            <h2 className="font-bold text-2xl text-on-surface tracking-tight">
              {data?.buildingName || buildingName}
            </h2>
            {data && (
              <div className="mt-2 text-sm text-body-text flex flex-wrap gap-x-2 gap-y-1">
                <span>아파트</span>
                <span className="text-outline-variant">|</span>
                <span>{data.totalUnits}세대</span>
                <span className="text-outline-variant">|</span>
                <span>{data.buildYear}년 준공 ({new Date().getFullYear() - data.buildYear}년차)</span>
              </div>
            )}
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

        {/* Stitch Navigation Tabs */}
        <nav className="mt-4 border-b border-line flex gap-5 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveTab('trends')}
            className={`pb-3 text-sm font-bold whitespace-nowrap transition-colors ${
              activeTab === 'trends' ? 'text-on-surface border-b-[3px] border-on-surface' : 'text-body-text hover:text-on-surface'
            }`}
          >
            시세/동향
          </button>
          <button
            onClick={() => setActiveTab('trades')}
            className={`pb-3 text-sm font-bold whitespace-nowrap transition-colors ${
              activeTab === 'trades' ? 'text-on-surface border-b-[3px] border-on-surface' : 'text-body-text hover:text-on-surface'
            }`}
          >
            실거래 내역
          </button>
          <button
            onClick={() => setActiveTab('units')}
            className={`pb-3 text-sm font-bold whitespace-nowrap transition-colors ${
              activeTab === 'units' ? 'text-on-surface border-b-[3px] border-on-surface' : 'text-body-text hover:text-on-surface'
            }`}
          >
            평형 정보
          </button>
        </nav>
      </div>

      {loading ? (
        <div className="p-10 text-center text-body-text">
          <div className="w-9 h-9 border-3 border-line border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <span className="text-sm font-semibold">Stitch 단지 데이터 로딩 중...</span>
        </div>
      ) : errorMessage ? (
        <div className="p-5">
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center text-red-900">
            <div className="text-2xl mb-2">⚠️</div>
            <div className="font-bold text-base">API 연결 오류</div>
            <div className="text-xs mt-1 text-red-700">{errorMessage}</div>
            <div className="text-[11px] mt-3 text-gray-500">
              상단의 [Mock 데이터 Fallback] 체크박스를 켜시면 샘플 데이터로 즉시 모듈 동작을 테스트하실 수 있습니다.
            </div>
          </div>
        </div>
      ) : data ? (
        <div className="p-5 bg-surface-container-lowest flex-grow flex flex-col gap-5">
          {activeTab === 'trends' && (
            <>
              {/* Main Metric Hero Card */}
              <div className="bg-primary text-on-primary rounded-xl p-5 shadow-sm">
                <span className="text-xs text-sky font-semibold block mb-1">최근 실거래가 ({data.latestTradeDate})</span>
                <div className="text-3xl font-extrabold tracking-tight mb-1">
                  {formatPrice(data.latestTradePrice)}
                </div>
                <div className="text-xs font-bold text-secondary-container">
                  ▲ 직전 거래 대비 +{data.tradePriceChangeRate}%
                </div>

                <div className="mt-4 pt-3 border-t border-white/20 grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-white/70 block">전세가율</span>
                    <span className="text-base font-bold text-tertiary-fixed">{data.jeonseRate}%</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/70 block">예상 월세</span>
                    <span className="text-base font-bold text-white">보증 1억/월 {data.estimatedMonthlyRent}만</span>
                  </div>
                </div>
              </div>

              {/* Core Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-container-low rounded-xl p-4 border border-line/50">
                  <span className="text-xs text-body-text block mb-1">평균 전세가율</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-on-surface">{data.jeonseRate}%</span>
                    <span className="text-[10px] font-bold text-coral">▲ 0.5%</span>
                  </div>
                </div>
                <div className="bg-surface-container-low rounded-xl p-4 border border-line/50">
                  <span className="text-xs text-body-text block mb-1">전세 거래 비중</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-on-surface">42%</span>
                    <span className="text-[10px] font-bold text-outline">최근 3개월</span>
                  </div>
                </div>
              </div>

              {/* SVG Trend Graph (Stitch Mirror) */}
              <div className="bg-surface-container-low rounded-xl p-5 border border-line/50 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs text-body-text font-bold">거래금액 추이 (Stitch Graph)</h3>
                  <div className="flex gap-3">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span className="text-[10px] text-body-text">매매</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-sky" />
                      <span className="text-[10px] text-body-text">전세</span>
                    </div>
                  </div>
                </div>
                <div className="h-40 w-full relative mt-2">
                  <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 300 100">
                    <g stroke="#e6e6e8" strokeWidth="0.5">
                      <line x1="75" x2="75" y1="0" y2="100" />
                      <line x1="150" x2="150" y1="0" y2="100" />
                      <line x1="225" x2="225" y1="0" y2="100" />
                    </g>
                    <path d="M0,100 L0,80 L60,65 L120,70 L180,50 L240,30 L300,40 L300,100 Z" fill="#cee5ff" opacity="0.3" />
                    <path d="M0,80 L60,65 L120,70 L180,50 L240,30 L300,40" fill="none" stroke="#264159" strokeWidth="2" />
                    <path d="M0,90 L60,80 L120,82 L180,68 L240,55 L300,60" fill="none" stroke="#a2d6f1" strokeWidth="2" />
                    <g fill="#264159">
                      <circle cx="240" cy="30" fill="#ff5b66" r="4" />
                    </g>
                  </svg>
                  <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                    <span className="absolute text-[8px] text-outline" style={{ left: '0%', top: '85%' }}>'23.01</span>
                    <span className="absolute text-[8px] text-outline" style={{ left: '40%', top: '65%' }}>'24.01</span>
                    <span className="absolute text-[8px] text-outline" style={{ left: '80%', top: '35%' }}>'25.01</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'trades' && (
            <div className="bg-surface-container-low rounded-xl p-5 border border-line/50 shadow-sm">
              <div className="flex gap-2 mb-4">
                {(['전체', '매매', '전세', '월세'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setTradeFilter(filter)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                      tradeFilter === filter ? 'bg-primary text-on-primary' : 'bg-white border border-line text-body-text'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-3">
                {filteredTrades.map((t, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white/70 rounded-lg p-3 border border-line/30">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${t.tradeType === '매매' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                          {t.tradeType}
                        </span>
                        <span className="text-sm font-bold text-on-surface">{t.area}㎡ ({t.floor}층)</span>
                      </div>
                      <span className="text-[10px] text-outline mt-1 block">{t.date}</span>
                    </div>
                    <span className="text-sm font-bold text-on-surface">{t.price}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'units' && (
            <div className="bg-surface-container-low rounded-xl p-5 border border-line/50 shadow-sm">
              <h3 className="text-xs text-body-text font-bold mb-4">평형별 최근 거래 및 세대수</h3>
              <div className="flex flex-col gap-3">
                {data.unitTypes.map((u, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white/70 rounded-lg p-3 border border-line/30">
                    <div>
                      <span className="text-sm font-bold text-on-surface block">{u.name}</span>
                      <span className="text-[10px] text-outline">{u.units}세대</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-primary block">매매 {formatPrice(u.tradePrice)}</span>
                      <span className="text-xs text-body-text">전세 {formatPrice(u.rentPrice)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </aside>
  );
};
