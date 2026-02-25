import { useState } from 'react';
import styled from 'styled-components';
import { MapContainer } from './MapContainer';
import { FlightListsContainer } from './FlightListsContainer';
import { useFlightContext } from '../context/FlightContext';
import { useWindowSize } from '../hooks/useWindowSize';
import { AIRPORTS, type AirportId } from '../config/airports';

export function DashboardLayout() {
  const { width } = useWindowSize();
  const { loading, error, rateLimitInfo, lastUpdate, refreshData, currentAirportId, setCurrentAirport } = useFlightContext();
  const [activeTab, setActiveTab] = useState<'map' | 'flights'>('map');

  const isMobile = width < 768;

  const airportTabs = Object.values(AIRPORTS);

  if (isMobile) {
    return (
      <MobileContainer>
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
          <HeaderInfo>
            {lastUpdate && (
              <UpdateTime>{lastUpdate.toLocaleTimeString()}</UpdateTime>
            )}
          </HeaderInfo>
        </Header>

        <TabNav>
          <Tab active={activeTab === 'map'} onClick={() => setActiveTab('map')}>
            地图
          </Tab>
          <Tab active={activeTab === 'flights'} onClick={() => setActiveTab('flights')}>
            航班
          </Tab>
        </TabNav>

        {loading && <LoadingOverlay>加载航班数据...</LoadingOverlay>}
        {error && <ErrorBanner>{error.message}</ErrorBanner>}

        <TabContent>
          {activeTab === 'map' && <MapContainer />}
          {activeTab === 'flights' && <FlightListsContainer />}
        </TabContent>

        <RefreshButton onClick={refreshData}>↻ Refresh</RefreshButton>
      </MobileContainer>
    );
  }

  return (
    <DesktopContainer>
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
                <AirportTabCode>{airport.iata}</AirportTabCode>
              </AirportTab>
            ))}
          </AirportTabNav>
        </HeaderLeft>
        <HeaderInfo>
          {lastUpdate && (
            <UpdateTime>更新: {lastUpdate.toLocaleTimeString()}</UpdateTime>
          )}
          {rateLimitInfo.remaining !== null && (
            <RateLimit>API额度: {rateLimitInfo.remaining}</RateLimit>
          )}
          <RefreshButton onClick={refreshData} disabled={loading}>
            ↻ 刷新
          </RefreshButton>
        </HeaderInfo>
      </Header>

      {error && <ErrorBanner>{error.message}</ErrorBanner>}

      <MainContent>
        <MapSection>
          {loading && <LoadingOverlay>加载航班数据...</LoadingOverlay>}
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
  background: #000000;
  color: white;
  padding: 20px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const HeaderLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
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
  font-size: 13px;
  opacity: 0.9;
`;

const RateLimit = styled.div`
  font-size: 13px;
  opacity: 0.9;
`;

const RefreshButton = styled.button`
  background: linear-gradient(135deg, #FA233B 0%, #FC5C7D 100%);
  border: none;
  color: white;
  padding: 12px 24px;
  border-radius: 25px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(250, 35, 59, 0.3);

  &:hover:not(:disabled) {
    transform: scale(1.05);
    box-shadow: 0 6px 20px rgba(250, 35, 59, 0.5);
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
    font-size: 24px;
    box-shadow: 0 6px 25px rgba(250, 35, 59, 0.5);
    z-index: 1000;
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

const MainContent = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`;

const MapSection = styled.div`
  position: relative;
  flex: 0 0 65%;
  height: 100%;
`;

const Divider = styled.div`
  width: 4px;
  background: #e0e0e0;
  cursor: col-resize;
  flex-shrink: 0;

  &:hover {
    background: #bdbdbd;
  }
`;

const ListSection = styled.div`
  flex: 0 0 35%;
  height: 100%;
  overflow: hidden;
`;

const AirportTabNav = styled.div`
  display: flex;
  gap: 16px;

  @media (max-width: 768px) {
    background: #1C1C1E;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
`;

const AirportTab = styled.button<{ active: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 48px;
  background: ${(props) => (props.active
    ? 'linear-gradient(135deg, #FA233B 0%, #FC5C7D 100%)'
    : 'rgba(255, 255, 255, 0.08)')};
  border: none;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: ${(props) => (props.active
    ? '0 8px 30px rgba(250, 35, 59, 0.4)'
    : 'none')};

  &:hover {
    background: ${(props) => (props.active
      ? 'linear-gradient(135deg, #FA233B 0%, #FC5C7D 100%)'
      : 'rgba(255, 255, 255, 0.15)')};
    transform: scale(1.03);
  }

  @media (max-width: 768px) {
    flex: 1;
    padding: 14px 24px;
    border-radius: 12px;
  }
`;

const AirportTabName = styled.span`
  font-size: 28px;
  font-weight: 700;
  color: white;
  letter-spacing: 2px;

  @media (max-width: 768px) {
    font-size: 22px;
  }
`;

const AirportTabCode = styled.span`
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 4px;
  font-weight: 500;

  @media (max-width: 768px) {
    font-size: 12px;
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
