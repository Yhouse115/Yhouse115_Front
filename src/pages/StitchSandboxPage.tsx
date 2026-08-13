import React, { useState } from 'react';
import { StitchDongPanel } from '../features/stitch/components/StitchDongPanel';
import { StitchBuildingPanel } from '../features/stitch/components/StitchBuildingPanel';
import { StitchDrawer } from '../features/stitch/components/StitchDrawer';

export const StitchSandboxPage: React.FC = () => {
  const [activeModule, setActiveModule] = useState<'none' | 'dong' | 'building'>('none');
  const [targetKey, setTargetKey] = useState<string>('');
  const [targetName, setTargetName] = useState<string>('');
  const [displayMode, setDisplayMode] = useState<'drawer' | 'split'>('drawer');
  const [useMock, setUseMock] = useState<boolean>(false); // 기본적으로 백엔드 실데이터 조회 모드

  // 백엔드 DB 실데이터: 신정1동 (1147062000)
  const handleOpenSinjeong1Dong = () => {
    setTargetKey('1147062000');
    setTargetName('신정1동');
    setActiveModule('dong');
  };

  // 백엔드 DB 실데이터: 유원목동아파트 (1147010100100870039)
  const handleOpenYuwonMokdong = () => {
    setTargetKey('1147010100100870039');
    setTargetName('유원목동아파트');
    setActiveModule('building');
  };

  // 백엔드 DB 실데이터: 양천아파트 (1147010100102760000)
  const handleOpenYangcheonApt = () => {
    setTargetKey('1147010100102760000');
    setTargetName('양천아파트');
    setActiveModule('building');
  };

  const handleClose = () => {
    setActiveModule('none');
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#F5F4F6',
        fontFamily: '"Pretendard", "Noto Sans KR", sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* 샌드박스 상단 헤더 & 컨트롤바 */}
      <header
        style={{
          height: '64px',
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid #E6E6E8',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              padding: '6px 12px',
              backgroundColor: '#264159',
              color: '#FFF',
              borderRadius: '8px',
              fontWeight: 800,
              fontSize: '14px',
              letterSpacing: '-0.02em',
            }}
          >
            Stitch FE Sandbox
          </div>
          <span style={{ fontSize: '13px', color: '#656365', fontWeight: 500 }}>
            모듈 단독 동작 & 실데이터 DB 키 바인딩 샌드박스
          </span>
        </div>

        {/* 모드 제어 스위치 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <label style={{ fontSize: '12px', fontWeight: 700, color: useMock ? '#264159' : '#3E6844', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: useMock ? '#E3F2FD' : '#E8F5E9', padding: '6px 12px', borderRadius: '8px' }}>
            <input
              type="checkbox"
              checked={useMock}
              onChange={(e) => setUseMock(e.target.checked)}
            />
            {useMock ? 'Mock 샘플 데이터 모드' : '🟢 백엔드 DB 실시간 조회 모드'}
          </label>

          <div
            style={{
              display: 'flex',
              backgroundColor: '#EEEDEF',
              padding: '3px',
              borderRadius: '8px',
            }}
          >
            <button
              onClick={() => setDisplayMode('drawer')}
              style={{
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: displayMode === 'drawer' ? 700 : 500,
                backgroundColor: displayMode === 'drawer' ? '#FFFFFF' : 'transparent',
                color: displayMode === 'drawer' ? '#264159' : '#656365',
                cursor: 'pointer',
              }}
            >
              Slide-Over Drawer
            </button>
            <button
              onClick={() => setDisplayMode('split')}
              style={{
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: displayMode === 'split' ? 700 : 500,
                backgroundColor: displayMode === 'split' ? '#FFFFFF' : 'transparent',
                color: displayMode === 'split' ? '#264159' : '#656365',
                cursor: 'pointer',
              }}
            >
              Split View (2단 분할)
            </button>
          </div>
        </div>
      </header>

      {/* 샌드박스 메인 워크스페이스 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <main
          style={{
            flex: 1,
            padding: '36px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '24px',
              padding: '32px',
              border: '1px solid #E6E6E8',
              boxShadow: '0 12px 32px rgba(24,21,29,0.05)',
            }}
          >
            <div>
              <span
                style={{
                  color: '#483FC8',
                  fontWeight: 800,
                  fontSize: '13px',
                  textTransform: 'uppercase',
                }}
              >
                Backend DB Real-time Binding Test
              </span>
              <h1 style={{ margin: '8px 0 4px', fontSize: '28px', color: '#0F1F3D' }}>
                백엔드 DB 실데이터 모듈 바인딩 샌드박스
              </h1>
              <p style={{ margin: 0, color: '#656365', fontSize: '14px' }}>
                아래 버튼을 클릭하면 백엔드 DB(`http://localhost:8000`)에 실제 등록되어 있는 행정동과 단지 PNU를 키로 전달하여 Stitch FE 모듈에 실시간으로 데이터가 파싱되는지 검증할 수 있습니다.
              </p>
            </div>

            {/* 시나리오 컨트롤 버튼 영역 */}
            <div
              style={{
                marginTop: '28px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '20px',
              }}
            >
              {/* 백엔드 실데이터 행정동: 신정1동 */}
              <div
                style={{
                  border: '2px solid #264159',
                  borderRadius: '16px',
                  padding: '24px',
                  backgroundColor: '#F4F8FC',
                }}
              >
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#264159' }}>
                  🏛️ [백엔드 DB 실데이터] 행정동 모듈
                </div>
                <p style={{ fontSize: '13px', color: '#656365', margin: '8px 0 16px' }}>
                  전달 키: <strong>신정1동 (`1147062000`)</strong>
                  <br />
                  백엔드 DB에서 신정1동 실거래 시세, 전세가율, 인접동 시세를 실시간 파싱합니다.
                </p>
                <button
                  onClick={handleOpenSinjeong1Dong}
                  style={{
                    backgroundColor: '#264159',
                    color: '#FFF',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '12px 20px',
                    fontWeight: 700,
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  [신정1동 (DB실데이터)] 조회하기 →
                </button>
              </div>

              {/* 백엔드 실데이터 건물: 유원목동아파트 & 양천아파트 */}
              <div
                style={{
                  border: '2px solid #3E6844',
                  borderRadius: '16px',
                  padding: '24px',
                  backgroundColor: '#F0F9F1',
                }}
              >
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#3E6844' }}>
                  🏢 [백엔드 DB 실데이터] 건물/단지 모듈
                </div>
                <p style={{ fontSize: '13px', color: '#656365', margin: '8px 0 16px' }}>
                  백엔드 DB 상에 저장된 실제 아파트 PNU를 전달하여 시세 및 실거래를 실시간 파싱합니다.
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={handleOpenYuwonMokdong}
                    style={{
                      backgroundColor: '#3E6844',
                      color: '#FFF',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '10px 16px',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    [유원목동아파트 (DB실데이터)] →
                  </button>
                  <button
                    onClick={handleOpenYangcheonApt}
                    style={{
                      backgroundColor: '#573712',
                      color: '#FFF',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '10px 16px',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    [양천아파트 (DB실데이터)] →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Stitch 모듈 바인딩 */}
        {displayMode === 'split' && activeModule !== 'none' ? (
          <StitchDrawer isOpen={true} onClose={handleClose} mode="split">
            {activeModule === 'dong' && (
              <StitchDongPanel
                adminDongCode={targetKey}
                dongName={targetName}
                onClose={handleClose}
                useMockFallback={useMock}
              />
            )}
            {activeModule === 'building' && (
              <StitchBuildingPanel
                pnu={targetKey}
                buildingName={targetName}
                onClose={handleClose}
                useMockFallback={useMock}
              />
            )}
          </StitchDrawer>
        ) : (
          <StitchDrawer
            isOpen={activeModule !== 'none'}
            onClose={handleClose}
            mode="drawer"
          >
            {activeModule === 'dong' && (
              <StitchDongPanel
                adminDongCode={targetKey}
                dongName={targetName}
                onClose={handleClose}
                useMockFallback={useMock}
              />
            )}
            {activeModule === 'building' && (
              <StitchBuildingPanel
                pnu={targetKey}
                buildingName={targetName}
                onClose={handleClose}
                useMockFallback={useMock}
              />
            )}
          </StitchDrawer>
        )}
      </div>
    </div>
  );
};
