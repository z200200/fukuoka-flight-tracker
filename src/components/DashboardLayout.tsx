import React, { useState } from 'react';
import styled from 'styled-components';
import { MapContainer } from './MapContainer';
import { FlightListsContainer } from './FlightListsContainer';
import { useFlightContext } from '../context/FlightContext';
import { useWindowSize } from '../hooks/useWindowSize';

export function DashboardLayout() {
  const { width } = useWindowSize();
  const { loading, error, rateLimitInfo, lastUpdate, refreshData } = useFlightContext();
  const [activeTab, setActiveTab] = useState<'map' | 'flights'>('map');

  const isMobile = width < 768;

  if (isMobile) {
    return (
      <MobileContainer>
        <Header>
          <Title>Fukuoka Flight Tracker</Title>
          <HeaderInfo>
            {lastUpdate && (
              <UpdateTime>Updated: {lastUpdate.toLocaleTimeString()}</UpdateTime>
            )}
            {rateLimitInfo.remaining !== null && (
              <RateLimit>API Credits: {rateLimitInfo.remaining}</RateLimit>
            )}
          </HeaderInfo>
        </Header>

        <TabNav>
          <Tab active={activeTab === 'map'} onClick={() => setActiveTab('map')}>
            Map
          </Tab>
          <Tab active={activeTab === 'flights'} onClick={() => setActiveTab('flights')}>
            Flights
          </Tab>
        </TabNav>

        {loading && <LoadingOverlay>Loading flight data...</LoadingOverlay>}
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
        <Title>Fukuoka Flight Tracker</Title>
        <HeaderInfo>
          {lastUpdate && (
            <UpdateTime>Last Update: {lastUpdate.toLocaleTimeString()}</UpdateTime>
          )}
          {rateLimitInfo.remaining !== null && (
            <RateLimit>API Credits: {rateLimitInfo.remaining}</RateLimit>
          )}
          <RefreshButton onClick={refreshData} disabled={loading}>
            ↻ Refresh
          </RefreshButton>
        </HeaderInfo>
      </Header>

      {error && <ErrorBanner>{error.message}</ErrorBanner>}

      <MainContent>
        <MapSection>
          {loading && <LoadingOverlay>Loading flight data...</LoadingOverlay>}
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
`;

const Title = styled.h1`
  margin: 0;
  font-size: 24px;
  font-weight: 600;

  @media (max-width: 768px) {
    font-size: 18px;
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
  font-size: 13px;
  opacity: 0.9;
`;

const RateLimit = styled.div`
  font-size: 13px;
  opacity: 0.9;
`;

const RefreshButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.3);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    padding: 0;
    font-size: 24px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
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
