import { useRef, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import type { FlightInfo, Flight } from '../types/flight';

interface FlightListProps {
  title: string;
  flights: FlightInfo[] | Flight[];
  selectedFlight: Flight | null;
  onSelect: (flight: Flight | FlightInfo) => void;
  type: 'arrival' | 'departure';
}

export function FlightList({ title, flights, selectedFlight, onSelect, type }: FlightListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const middleItemRef = useRef<HTMLDivElement>(null);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  };

  const isFlightInfo = (flight: FlightInfo | Flight | null | undefined): flight is FlightInfo => {
    return flight != null && typeof flight === 'object' && 'firstSeen' in flight;
  };

  // Sort flights by time (most recent first for arrivals, most recent first for departures)
  const sortedFlights = useMemo(() => {
    if (!flights || flights.length === 0) return [];
    return [...flights].filter(f => f != null).sort((a, b) => {
      const aTime = isFlightInfo(a)
        ? (type === 'arrival' ? a.lastSeen : a.firstSeen)
        : a.lastContact;
      const bTime = isFlightInfo(b)
        ? (type === 'arrival' ? b.lastSeen : b.firstSeen)
        : b.lastContact;
      return bTime - aTime; // Descending order (most recent first)
    });
  }, [flights, type]);

  // Auto-scroll to show the most recent flight (first item) in the middle of visible area
  useEffect(() => {
    if (middleItemRef.current && listRef.current && sortedFlights.length > 0) {
      const listHeight = listRef.current.clientHeight;
      const itemTop = middleItemRef.current.offsetTop;
      const itemHeight = middleItemRef.current.clientHeight;
      // Scroll so that the first (most recent) item appears in the middle of the list
      const scrollPosition = itemTop - (listHeight / 2) + (itemHeight / 2);
      listRef.current.scrollTop = Math.max(0, scrollPosition);
    }
  }, [sortedFlights.length]);

  // Mark the first item (most recent) as the one to scroll to
  const mostRecentIndex = 0;

  return (
    <Container>
      <Header>
        <Title>{title}</Title>
        <Count>{flights.length} 航班</Count>
      </Header>
      <List ref={listRef}>
        {sortedFlights.length === 0 ? (
          <EmptyState>暂无{type === 'arrival' ? '到达' : '出发'}航班</EmptyState>
        ) : (
          sortedFlights.map((flight, index) => {
            const isSelected = isFlightInfo(flight)
              ? selectedFlight?.icao24 === flight.icao24
              : selectedFlight?.icao24 === flight.icao24;
            const isMostRecent = index === mostRecentIndex;

            return (
              <ListItem
                key={isFlightInfo(flight) ? `${flight.icao24}-${index}` : flight.icao24}
                ref={isMostRecent ? middleItemRef : null}
                selected={isSelected}
                onClick={() => onSelect(flight)}
              >
                <FlightHeader>
                  <Callsign>{flight.callsign || flight.icao24?.toUpperCase() || 'Unknown'}</Callsign>
                  {isFlightInfo(flight) && (
                    <Time>
                      {type === 'arrival'
                        ? formatTime(flight.lastSeen)
                        : formatTime(flight.firstSeen)}
                    </Time>
                  )}
                </FlightHeader>

                {isFlightInfo(flight) && (
                  <Route>
                    {type === 'arrival'
                      ? `来自 ${flight.estDepartureAirport || '未知'}`
                      : `飞往 ${flight.estArrivalAirport || '未知'}`}
                  </Route>
                )}

                {!isFlightInfo(flight) && (
                  <Details>
                    <DetailItem>
                      高度: {flight.altitude ? `${Math.round(flight.altitude)}米` : '无'}
                    </DetailItem>
                    <DetailItem>
                      速度: {flight.velocity ? `${Math.round(flight.velocity)}米/秒` : '无'}
                    </DetailItem>
                  </Details>
                )}

                <Country>
                  {isFlightInfo(flight) ? '未知' : (flight.originCountry || '未知')}
                </Country>
              </ListItem>
            );
          })
        )}
      </List>
    </Container>
  );
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #000000;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: #1C1C1E;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: white;
`;

const Count = styled.span`
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  background: rgba(250, 35, 59, 0.2);
  padding: 4px 12px;
  border-radius: 12px;
`;

const List = styled.div`
  flex: 1;
  overflow-y: auto;
  background: #000000;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.02);
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(250, 35, 59, 0.3);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: rgba(250, 35, 59, 0.5);
  }
`;

const EmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgba(255, 255, 255, 0.3);
  font-size: 14px;
`;

const ListItem = styled.div<{ selected: boolean }>`
  padding: 14px 16px;
  cursor: pointer;
  background: ${(props) => (props.selected
    ? 'linear-gradient(135deg, rgba(250, 35, 59, 0.15) 0%, rgba(252, 92, 125, 0.15) 100%)'
    : 'transparent')};
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  border-left: 3px solid ${(props) => (props.selected ? '#FA233B' : 'transparent')};
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.03);
    border-left-color: rgba(250, 35, 59, 0.5);
  }

  &:last-child {
    border-bottom: none;
  }
`;

const FlightHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
`;

const Callsign = styled.div`
  font-weight: 700;
  font-size: 16px;
  color: white;
  letter-spacing: 0.5px;
`;

const Time = styled.div`
  font-size: 13px;
  color: #FC5C7D;
  font-weight: 600;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
`;

const Route = styled.div`
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 4px;
`;

const Details = styled.div`
  display: flex;
  gap: 16px;
  margin-top: 6px;
`;

const DetailItem = styled.div`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  gap: 4px;

  &::before {
    content: '';
    width: 4px;
    height: 4px;
    background: #FA233B;
    border-radius: 50%;
  }
`;

const Country = styled.div`
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 6px;
  text-transform: uppercase;
  letter-spacing: 1px;
`;
