import { useState } from 'react';
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
  const { loading, error, lastUpdate, refreshData, currentAirportId, setCurrentAirport, flights, nextUpdateSeconds, nextRescanSeconds } = useFlightContext();
  const { lang, setLang, t } = useLanguage();
  const [showHelp, setShowHelp] = useState(true);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // 只在初次加载（没有数据）时显示全屏遮罩，后续刷新显示轻量指示器
  const isInitialLoading = loading && flights.length === 0 && !lastUpdate;
  const [activeTab, setActiveTab] = useState<'map' | 'flights'>('map');

  const isMobile = width < 768;

  const airportTabs = Object.values(AIRPORTS);

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
                <AirportTabName>{airport.name}</AirportTabName>
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
                <AirportTabName>{airport.name}</AirportTabName>
                <AirportTabCode>&lt;{airport.iata}&gt;</AirportTabCode>
              </AirportTab>
            ))}
          </AirportTabNav>
        </HeaderLeft>
        <HeaderRight>
          <HeaderInfo>
            <CountdownGroup>
              <CountdownItem>
                <CountdownLabel>轨迹更新</CountdownLabel>
                <CountdownBarWrapper>
                  <CountdownBar style={{ width: `${(nextUpdateSeconds / 10) * 100}%` }} />
                </CountdownBarWrapper>
              </CountdownItem>
              <CountdownItem>
                <CountdownLabel>重新扫描</CountdownLabel>
                <CountdownBarWrapper>
                  <CountdownBar style={{ width: `${(nextRescanSeconds / 120) * 100}%` }} />
                </CountdownBarWrapper>
              </CountdownItem>
            </CountdownGroup>
          </HeaderInfo>
          <LanguageSwitch>
            <LangButton active={lang === 'zh'} isLarge onClick={() => setLang('zh')}>中文</LangButton>
            <LangButton active={lang === 'ja'} onClick={() => setLang('ja')}>日本語</LangButton>
            <LangButton active={lang === 'en'} onClick={() => setLang('en')}>EN</LangButton>
          </LanguageSwitch>
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
  background: linear-gradient(180deg, #0a0a0f 0%, #1a1a2e 100%);
  color: white;
  padding: 12px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(0, 255, 255, 0.2);
  box-shadow: 0 2px 20px rgba(0, 255, 255, 0.1);
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
  background: ${props => props.active ? 'rgba(0, 212, 255, 0.3)' : 'transparent'};
  border: 1px solid ${props => props.active ? '#00d4ff' : 'rgba(0, 212, 255, 0.3)'};
  color: ${props => props.active ? '#00d4ff' : 'rgba(255, 255, 255, 0.5)'};
  padding: ${props => props.isLarge ? '6px 14px' : '4px 10px'};
  border-radius: 4px;
  font-size: ${props => props.isLarge ? '14px' : '11px'};
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: ${props => props.isLarge ? "'Microsoft YaHei', 'PingFang SC', sans-serif" : "'Consolas', 'Monaco', monospace"};

  &:hover {
    border-color: #00d4ff;
    color: #00d4ff;
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
  color: rgba(0, 255, 255, 0.7);
  font-family: 'Consolas', 'Monaco', monospace;
`;

const CountdownGroup = styled.div`
  display: flex;
  gap: 16px;
`;

const CountdownItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const CountdownLabel = styled.div`
  font-size: 10px;
  color: rgba(0, 255, 255, 0.6);
  font-family: 'Consolas', 'Monaco', monospace;
`;

const CountdownBarWrapper = styled.div`
  width: 80px;
  height: 6px;
  background: rgba(0, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
`;

const CountdownBar = styled.div`
  height: 100%;
  background: linear-gradient(90deg, rgba(0, 255, 255, 0.4) 0%, rgba(0, 255, 255, 0.8) 100%);
  transition: width 1s linear;
  border-radius: 3px;
`;

const RefreshButton = styled.button`
  background: transparent;
  border: 1px solid rgba(0, 255, 255, 0.5);
  color: #00ffff;
  padding: 8px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  font-family: 'Consolas', 'Monaco', monospace;
  text-transform: uppercase;
  letter-spacing: 1px;
  transition: all 0.3s ease;

  &:hover:not(:disabled) {
    background: rgba(0, 255, 255, 0.1);
    border-color: #00ffff;
    box-shadow: 0 0 20px rgba(0, 255, 255, 0.4);
    text-shadow: 0 0 10px rgba(0, 255, 255, 0.8);
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
    box-shadow: 0 0 25px rgba(0, 255, 255, 0.5);
    z-index: 1000;
    background: rgba(0, 20, 40, 0.9);
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
  width: 2px;
  background: #333;
  flex-shrink: 0;
`;

const ListSection = styled.div`
  flex: 0 0 320px;
  height: 100%;
  overflow: hidden;
`;

const AirportTabNav = styled.div`
  display: flex;
  gap: 12px;
  flex: 1;
  max-width: 600px;

  @media (max-width: 768px) {
    background: rgba(10, 10, 15, 0.9);
    padding: 8px 12px;
    border-bottom: 1px solid rgba(0, 255, 255, 0.2);
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
  padding: 12px 24px;
  background: ${(props) => (props.active
    ? 'linear-gradient(135deg, #00d4ff 0%, #0088bb 100%)'
    : 'rgba(0, 212, 255, 0.05)')};
  border: 2px solid ${(props) => (props.active
    ? '#00d4ff'
    : 'rgba(0, 212, 255, 0.3)')};
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: ${(props) => (props.active
    ? '0 0 30px rgba(0, 212, 255, 0.6), 0 0 60px rgba(0, 212, 255, 0.3), inset 0 0 30px rgba(0, 212, 255, 0.15)'
    : 'none')};
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s ease;
  }

  &:hover {
    background: ${(props) => (props.active
      ? 'linear-gradient(135deg, #00d4ff 0%, #0088bb 100%)'
      : 'rgba(0, 212, 255, 0.15)')};
    border-color: #00d4ff;
    box-shadow: 0 0 25px rgba(0, 212, 255, 0.4);
    transform: translateY(-2px);

    &::before {
      left: 100%;
    }
  }

  &:active {
    transform: translateY(0);
  }

  @media (max-width: 768px) {
    padding: 10px 16px;
  }
`;

const AirportTabName = styled.span`
  font-size: 20px;
  font-weight: 700;
  color: white;
  letter-spacing: 3px;
  font-family: 'Consolas', 'Monaco', monospace;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.3);

  @media (max-width: 768px) {
    font-size: 16px;
  }
`;

const AirportTabCode = styled.span`
  font-size: 13px;
  color: rgba(0, 255, 255, 0.9);
  font-weight: 600;
  font-family: 'Consolas', 'Monaco', monospace;
  text-shadow: 0 0 8px rgba(0, 255, 255, 0.5);

  @media (max-width: 768px) {
    font-size: 11px;
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
  background: ${(props) => (props.active ? 'white' : '#f5f5f5')};
  border: none;
  border-bottom: 3px solid ${(props) => (props.active ? '#667eea' : 'transparent')};
  font-size: 16px;
  font-weight: ${(props) => (props.active ? '600' : '400')};
  color: ${(props) => (props.active ? '#667eea' : '#7f8c8d')};
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: ${(props) => (props.active ? 'white' : '#eeeeee')};
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
  background: transparent;
  border: 1px solid rgba(0, 212, 255, 0.5);
  color: #00d4ff;
  width: 44px;
  height: 44px;
  border-radius: 6px;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(0, 212, 255, 0.15);
    box-shadow: 0 0 15px rgba(0, 212, 255, 0.4);
  }
`;

const MobileMenu = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: rgba(10, 15, 25, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(0, 212, 255, 0.3);
  padding: 16px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 16px;
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
  color: rgba(0, 212, 255, 0.6);
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
  background: ${props => props.active ? 'rgba(0, 212, 255, 0.3)' : 'rgba(0, 212, 255, 0.05)'};
  border: 1px solid ${props => props.active ? '#00d4ff' : 'rgba(0, 212, 255, 0.3)'};
  color: ${props => props.active ? '#00d4ff' : 'rgba(255, 255, 255, 0.7)'};
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 44px;

  &:hover {
    border-color: #00d4ff;
    background: rgba(0, 212, 255, 0.15);
  }
`;

const HelpButton = styled.button`
  background: rgba(0, 212, 255, 0.1);
  border: 1px solid rgba(0, 212, 255, 0.3);
  color: rgba(255, 255, 255, 0.8);
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 44px;
  text-align: left;

  &:hover {
    border-color: #00d4ff;
    color: #00d4ff;
    background: rgba(0, 212, 255, 0.15);
  }
`;

const DesktopHelpButton = styled.button`
  background: transparent;
  border: 1px solid rgba(0, 212, 255, 0.4);
  color: #00d4ff;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'Consolas', 'Monaco', monospace;

  &:hover {
    background: rgba(0, 212, 255, 0.15);
    box-shadow: 0 0 15px rgba(0, 212, 255, 0.4);
  }
`;
