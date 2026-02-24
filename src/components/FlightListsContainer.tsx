import styled from 'styled-components';
import { FlightList } from './FlightList';
import { useFlightContext } from '../context/FlightContext';
import type { Flight, FlightInfo } from '../types/flight';

export function FlightListsContainer() {
  const { arrivals, departures, selectedFlight, selectFlight } = useFlightContext();

  const handleSelectFlight = (flight: FlightInfo | Flight) => {
    // Only select if it's a Flight (has position data), not FlightInfo
    if ('latitude' in flight && 'longitude' in flight) {
      selectFlight(flight as Flight);
    } else {
      // For FlightInfo, we can't select it as it doesn't have position data
      selectFlight(null);
    }
  };

  return (
    <Container>
      <FlightList
        title="Arrivals"
        flights={arrivals}
        selectedFlight={selectedFlight}
        onSelect={handleSelectFlight}
        type="arrival"
      />
      <Divider />
      <FlightList
        title="Departures"
        flights={departures}
        selectedFlight={selectedFlight}
        onSelect={handleSelectFlight}
        type="departure"
      />
    </Container>
  );
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
`;

const Divider = styled.div`
  height: 2px;
  background: #e0e0e0;
  flex-shrink: 0;
`;
