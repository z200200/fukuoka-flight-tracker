import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { MapContainer } from './MapContainer';
import { FlightListsContainer } from './FlightListsContainer';
import { WelcomeModal } from './WelcomeModal';
import { useFlightContext } from '../context/FlightContext';
import { useLanguage } from '../context/LanguageContext';
import { useWindowSize } from '../hooks/useWindowSize';
import { AIRPORTS, type AirportId } from '../config/airports';

export function DashboardLayout() {
  const { width } = useWindowSize();
  const { loading, error, lastUpdate, refreshData, currentAirportId, setCurrentAirport, flights, nextUpdateSeconds, nextRescanSeconds, manualRescan } = useFlightContext();
  const { lang, setLang, t } = useLanguage();
  const [showHelp, setShowHelp] = useState(true);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);

  // 只在初次加载（没有数据）时显示全屏遮罩，后续刷新显示轻量指示器
  const isInitialLoading = loading && flights.length === 0 && !lastUpdate;
  const [activeTab, setActiveTab] = useState<'map' | 'flights'>('map');

  const isMobile = width < 768;

  const airportTabs = Object.values(AIRPORTS);

  // 机场名称国际化映射
  const airportNames: Record<string, string> = {
    fukuoka: t.fukuoka,
    tokyo: t.tokyo,
    incheon: t.incheon,
  };

  // F 键切换地图全屏
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // 忽略输入框中的按键
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === 'f' || e.key === 'F') {
      setIsMapFullscreen(prev => !prev);
    }
    // ESC 退出全屏
    if (e.key === 'Escape' && isMapFullscreen) {
      setIsMapFullscreen(false);
    }
  }, [isMapFullscreen]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (isMobile) {
    return (
      <MobileContainer>
        <WelcomeModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
        <Header>
          <AirportTabNav>
            {airportTabs.map((airport) => (
              <AirportTab
                key={airport.id}
                active={currentAirportId === airport.id}
                onClick={() => setCurrentAirport(airport.id as AirportId)}
              >
                <AirportTabName>{airportNames[airport.id] || airport.name}</AirportTabName>
              </AirportTab>
            ))}
          </AirportTabNav>
          <MobileHeaderRight>
            <MobileMenuButton onClick={() => setShowMobileMenu(!showMobileMenu)}>
              ☰
            </MobileMenuButton>
          </MobileHeaderRight>
        </Header>

        {/* 移动端下拉菜单 */}
        {showMobileMenu && (
          <MobileMenu>
            <MobileMenuSection>
              <MobileMenuLabel>语言 / Language</MobileMenuLabel>
              <MobileLangButtons>
                <MobileLangButton active={lang === 'zh'} onClick={() => { setLang('zh'); setShowMobileMenu(false); }}>中文</MobileLangButton>
                <MobileLangButton active={lang === 'ja'} onClick={() => { setLang('ja'); setShowMobileMenu(false); }}>日本語</MobileLangButton>
                <MobileLangButton active={lang === 'en'} onClick={() => { setLang('en'); setShowMobileMenu(false); }}>EN</MobileLangButton>
              </MobileLangButtons>
            </MobileMenuSection>
            <MobileMenuSection>
              <HelpButton onClick={() => { setShowHelp(true); setShowMobileMenu(false); }}>
                ❓ {t.about.replace('// ', '')}
              </HelpButton>
            </MobileMenuSection>
            {lastUpdate && (
              <MobileMenuSection>
                <UpdateTime>{t.update}: {lastUpdate.toLocaleTimeString()}</UpdateTime>
              </MobileMenuSection>
            )}
          </MobileMenu>
        )}

        <TabNav>
          <Tab active={activeTab === 'map'} onClick={() => setActiveTab('map')}>
            {t.mapTab}
          </Tab>
          <Tab active={activeTab === 'flights'} onClick={() => setActiveTab('flights')}>
            {t.flightsTab}
          </Tab>
        </TabNav>

        {isInitialLoading && <LoadingOverlay>{t.loading}</LoadingOverlay>}
        {error && <ErrorBanner>{error.message}</ErrorBanner>}

        <TabContent>
          {activeTab === 'map' && <MapContainer />}
          {activeTab === 'flights' && <FlightListsContainer />}
        </TabContent>

        <RefreshButton onClick={refreshData}>↻</RefreshButton>
      </MobileContainer>
    );
  }

  // 地图全屏模式
  if (isMapFullscreen) {
    return (
      <FullscreenMapContainer>
        <MapContainer />
        <FullscreenHint>Press F or ESC to exit fullscreen</FullscreenHint>
      </FullscreenMapContainer>
    );
  }

  return (
    <DesktopContainer>
      <WelcomeModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
      <Header>
        <HeaderLeft>
          <AirportTabNav>
            {airportTabs.map((airport) => (
              <AirportTab
                key={airport.id}
                active={currentAirportId === airport.id}
                onClick={() => setCurrentAirport(airport.id as AirportId)}
              >
                <AirportTabName>{airportNames[airport.id] || airport.name}</AirportTabName>
                <AirportTabCode>&lt;{airport.iata}&gt;</AirportTabCode>
              </AirportTab>
            ))}
          </AirportTabNav>
        </HeaderLeft>
        <HeaderRight>
          <HeaderInfo>
            <CountdownGroup>
              <CountdownItem>
                <CountdownLabel>{t.trackUpdate} ({nextUpdateSeconds}s)</CountdownLabel>
                <CountdownBarWrapper>
                  <CountdownBar style={{ width: `${(nextUpdateSeconds / 3) * 100}%` }} />
                </CountdownBarWrapper>
              </CountdownItem>
              <CountdownItemClickable onClick={manualRescan} title="Click to manually refresh flight list">
                <CountdownLabel>
                  {nextRescanSeconds < 0
                    ? (lang === 'zh' ? '点击刷新列表' : lang === 'ja' ? 'リスト更新' : 'Refresh List')
                    : `${t.rescan} (${Math.floor(nextRescanSeconds / 60)}:${(nextRescanSeconds % 60).toString().padStart(2, '0')})`
                  }
                </CountdownLabel>
                <CountdownBarWrapper>
                  <CountdownBar style={{ width: nextRescanSeconds < 0 ? '100%' : `${(nextRescanSeconds / 120) * 100}%` }} />
                </CountdownBarWrapper>
              </CountdownItemClickable>
            </CountdownGroup>
          </HeaderInfo>
          <LanguageSwitch>
            <LangButton active={lang === 'zh'} isLarge onClick={() => setLang('zh')}>中文</LangButton>
            <LangButton active={lang === 'ja'} onClick={() => setLang('ja')}>日本語</LangButton>
            <LangButton active={lang === 'en'} onClick={() => setLang('en')}>EN</LangButton>
          </LanguageSwitch>
          <FullscreenButton onClick={() => setIsMapFullscreen(true)} title="Press F for fullscreen">⛶</FullscreenButton>
          <DesktopHelpButton onClick={() => setShowHelp(true)}>?</DesktopHelpButton>
        </HeaderRight>
      </Header>

      {error && <ErrorBanner>{error.message}</ErrorBanner>}

      <MainContent>
        <MapSection>
          {isInitialLoading && <LoadingOverlay>{t.loading}</LoadingOverlay>}
          {loading && !isInitialLoading && <LoadingIndicator>{t.refreshing}</LoadingIndicator>}
          <MapContainer />
        </MapSection>

        <Divider />

        <ListSection>
          <FlightListsContainer />
        </ListSection>
      </MainContent>
    </DesktopContainer>
  );
}

const DesktopContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
`;

const MobileContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
`;

const Header = styled.header`
  background: linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%);
  color: #374151;
  padding: 12px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  border-bottom: 1px solid #E5E7EB;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  gap: 24px;
`;

const HeaderLeft = styled.div`
  display: flex;
  flex: 1;
  min-width: 0;
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const LanguageSwitch = styled.div`
  display: flex;
  gap: 4px;

  @media (max-width: 768px) {
    display: none;
  }
`;

const LangButton = styled.button<{ active: boolean; isLarge?: boolean }>`
  background: ${props => props.active ? '#6366F1' : '#F3F4F6'};
  border: 1px solid ${props => props.active ? '#6366F1' : '#E5E7EB'};
  color: ${props => props.active ? 'white' : '#6B7280'};
  padding: ${props => props.isLarge ? '6px 14px' : '4px 10px'};
  border-radius: 6px;
  font-size: ${props => props.isLarge ? '14px' : '11px'};
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: ${props => props.isLarge ? "'Microsoft YaHei', 'PingFang SC', sans-serif" : "'Consolas', 'Monaco', monospace"};

  &:hover {
    background: ${props => props.active ? '#4F46E5' : '#E5E7EB'};
    border-color: ${props => props.active ? '#4F46E5' : '#D1D5DB'};
  }
`;

const HeaderInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
  }
`;

const UpdateTime = styled.div`
  font-size: 12px;
  color: #6B7280;
  font-family: 'Consolas', 'Monaco', monospace;
`;

const CountdownGroup = styled.div`
  display: flex;
  gap: 16px;
  align-items: flex-end;
`;

const CountdownItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 8px;
`;

const CountdownItemClickable = styled(CountdownItem)`
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.2s;

  &:hover {
    background: rgba(99, 102, 241, 0.1);
  }

  &:active {
    background: rgba(99, 102, 241, 0.15);
  }
`;

const CountdownLabel = styled.div`
  font-size: 10px;
  color: #6B7280;
  font-family: 'Consolas', 'Monaco', monospace;
`;

const CountdownBarWrapper = styled.div`
  width: 80px;
  height: 6px;
  background: #E5E7EB;
  border-radius: 3px;
  overflow: hidden;
`;

const CountdownBar = styled.div`
  height: 100%;
  background: linear-gradient(90deg, #A5B4FC 0%, #6366F1 100%);
  transition: width 1s linear;
  border-radius: 3px;
`;

const RefreshButton = styled.button`
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  color: #6366F1;
  padding: 8px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  font-family: 'Consolas', 'Monaco', monospace;
  text-transform: uppercase;
  letter-spacing: 1px;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

  &:hover:not(:disabled) {
    background: #F3F4F6;
    border-color: #6366F1;
    color: #4F46E5;
  }

  &:active:not(:disabled) {
    transform: scale(0.95);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 0.8; }
  }

  @media (max-width: 768px) {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    padding: 0;
    font-size: 20px;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
    z-index: 1000;
    background: #FFFFFF;
  }
`;

const ErrorBanner = styled.div`
  background: #ff5252;
  color: white;
  padding: 12px 24px;
  text-align: center;
  font-size: 14px;
`;

const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 500;
  color: #667eea;
  z-index: 1000;
`;

const LoadingIndicator = styled.div`
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  z-index: 1000;
`;

const MainContent = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`;

const MapSection = styled.div`
  position: relative;
  flex: 1;
  height: 100%;
  min-width: 0;
`;

const Divider = styled.div`
  width: 1px;
  background: #E5E7EB;
  flex-shrink: 0;
`;

const ListSection = styled.div`
  flex: 0 0 320px;
  height: 100%;
  overflow: hidden;
`;

const AirportTabNav = styled.div`
  display: flex;
  gap: 8px;
  flex: 1;
  max-width: 600px;

  @media (max-width: 768px) {
    background: #FFFFFF;
    padding: 8px 12px;
    border-bottom: 1px solid #E5E7EB;
    max-width: none;
  }
`;

const AirportTab = styled.button<{ active: boolean }>`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex: 1;
  padding: 10px 20px;
  background: ${(props) => (props.active ? '#6366F1' : '#FFFFFF')};
  border: 1px solid ${(props) => (props.active ? '#6366F1' : '#E5E7EB')};
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: ${(props) => (props.active ? '0 2px 8px rgba(99, 102, 241, 0.25)' : '0 1px 3px rgba(0, 0, 0, 0.05)')};

  &:hover {
    background: ${(props) => (props.active ? '#4F46E5' : '#F9FAFB')};
    border-color: ${(props) => (props.active ? '#4F46E5' : '#D1D5DB')};
  }

  &:active {
    transform: scale(0.98);
  }

  @media (max-width: 768px) {
    padding: 8px 14px;
  }
`;

const AirportTabName = styled.span`
  font-size: 16px;
  font-weight: 600;
  color: inherit;
  letter-spacing: 1px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

  ${AirportTab}[active] & {
    color: white;
  }

  @media (max-width: 768px) {
    font-size: 14px;
  }
`;

const AirportTabCode = styled.span`
  font-size: 12px;
  color: inherit;
  font-weight: 500;
  font-family: 'Consolas', 'Monaco', monospace;
  opacity: 0.8;

  @media (max-width: 768px) {
    font-size: 10px;
  }
`;

const TabNav = styled.div`
  display: flex;
  background: white;
  border-bottom: 2px solid #e0e0e0;
  flex-shrink: 0;
`;

const Tab = styled.button<{ active: boolean }>`
  flex: 1;
  padding: 14px;
  background: ${(props) => (props.active ? '#FFFFFF' : '#F9FAFB')};
  border: none;
  border-bottom: 3px solid ${(props) => (props.active ? '#6366F1' : 'transparent')};
  font-size: 16px;
  font-weight: ${(props) => (props.active ? '600' : '400')};
  color: ${(props) => (props.active ? '#6366F1' : '#6B7280')};
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: ${(props) => (props.active ? '#FFFFFF' : '#F3F4F6')};
  }
`;

const TabContent = styled.div`
  flex: 1;
  overflow: hidden;
  position: relative;
`;

// Mobile menu styled components
const MobileHeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const MobileMenuButton = styled.button`
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  color: #6366F1;
  width: 44px;
  height: 44px;
  border-radius: 8px;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

  &:hover {
    background: #F9FAFB;
    border-color: #6366F1;
  }
`;

const MobileMenu = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #FFFFFF;
  border-bottom: 1px solid #E5E7EB;
  padding: 16px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  animation: slideDown 0.2s ease;

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const MobileMenuSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const MobileMenuLabel = styled.span`
  font-size: 11px;
  color: #6B7280;
  font-family: 'Consolas', 'Monaco', monospace;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

const MobileLangButtons = styled.div`
  display: flex;
  gap: 8px;
`;

const MobileLangButton = styled.button<{ active: boolean }>`
  flex: 1;
  background: ${props => props.active ? '#6366F1' : '#F9FAFB'};
  border: 1px solid ${props => props.active ? '#6366F1' : '#E5E7EB'};
  color: ${props => props.active ? '#FFFFFF' : '#374151'};
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 44px;

  &:hover {
    border-color: #6366F1;
    background: ${props => props.active ? '#4F46E5' : '#F3F4F6'};
  }
`;

const HelpButton = styled.button`
  background: #F9FAFB;
  border: 1px solid #E5E7EB;
  color: #374151;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 44px;
  text-align: left;

  &:hover {
    border-color: #6366F1;
    color: #6366F1;
    background: #F3F4F6;
  }
`;

const DesktopHelpButton = styled.button`
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  color: #6366F1;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'Consolas', 'Monaco', monospace;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

  &:hover {
    background: #F9FAFB;
    border-color: #6366F1;
  }
`;

// 全屏模式样式
const FullscreenMapContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  background: #000;
`;

const FullscreenHint = styled.div`
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.95);
  color: #374151;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 12px;
  font-family: 'Consolas', 'Monaco', monospace;
  pointer-events: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  animation: fadeOut 3s forwards;
  animation-delay: 2s;

  @keyframes fadeOut {
    to {
      opacity: 0;
    }
  }
`;

const FullscreenButton = styled.button`
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  color: #6366F1;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

  &:hover {
    background: #F9FAFB;
    border-color: #6366F1;
  }
`;
