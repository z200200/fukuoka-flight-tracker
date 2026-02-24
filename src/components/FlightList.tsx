import React from 'react';
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
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  };

  const isFlightInfo = (flight: FlightInfo | Flight): flight is FlightInfo => {
    return 'firstSeen' in flight;
  };

  return (
    <Container>
      <Header>
        <Title>{title}</Title>
        <Count>{flights.length} flights</Count>
      </Header>
      <List>
        {flights.length === 0 ? (
          <EmptyState>No {type === 'arrival' ? 'arrivals' : 'departures'} found</EmptyState>
        ) : (
          flights.map((flight, index) => {
            const isSelected = isFlightInfo(flight)
              ? selectedFlight?.icao24 === flight.icao24
              : selectedFlight?.icao24 === flight.icao24;

            return (
              <ListItem
                key={isFlightInfo(flight) ? `${flight.icao24}-${index}` : flight.icao24}
                selected={isSelected}
                onClick={() => onSelect(flight)}
              >
                <FlightHeader>
                  <Callsign>{flight.callsign || flight.icao24.toUpperCase()}</Callsign>
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
                      ? `From ${flight.estDepartureAirport || 'Unknown'}`
                      : `To ${flight.estArrivalAirport || 'Unknown'}`}
                  </Route>
                )}

                {!isFlightInfo(flight) && (
                  <Details>
                    <DetailItem>
                      Alt: {flight.altitude ? `${Math.round(flight.altitude)}m` : 'N/A'}
                    </DetailItem>
                    <DetailItem>
                      Speed: {flight.velocity ? `${Math.round(flight.velocity)}m/s` : 'N/A'}
                    </DetailItem>
                  </Details>
                )}

                <Country>{flight.originCountry || 'Unknown'}</Country>
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
  background: white;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 2px solid #e0e0e0;
  background: #f8f9fa;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #2c3e50;
`;

const Count = styled.span`
  font-size: 14px;
  color: #7f8c8d;
`;

const List = styled.div`
  flex: 1;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1;
  }

  &::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: #555;
  }
`;

const EmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #95a5a6;
  font-size: 14px;
`;

const ListItem = styled.div<{ selected: boolean }>`
  padding: 12px 16px;
  cursor: pointer;
  background-color: ${(props) => (props.selected ? '#e3f2fd' : 'transparent')};
  border-bottom: 1px solid #ecf0f1;
  transition: background-color 0.2s;

  &:hover {
    background-color: ${(props) => (props.selected ? '#e3f2fd' : '#f5f5f5')};
  }

  &:last-child {
    border-bottom: none;
  }
`;

const FlightHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
`;

const Callsign = styled.div`
  font-weight: 600;
  font-size: 16px;
  color: #2c3e50;
`;

const Time = styled.div`
  font-size: 14px;
  color: #7f8c8d;
  font-weight: 500;
`;

const Route = styled.div`
  font-size: 13px;
  color: #34495e;
  margin-bottom: 4px;
`;

const Details = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 4px;
`;

const DetailItem = styled.div`
  font-size: 12px;
  color: #7f8c8d;
`;

const Country = styled.div`
  font-size: 11px;
  color: #95a5a6;
  margin-top: 4px;
`;
