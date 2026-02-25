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
      <ListWrapper>
        <FlightList
          title="到达航班"
          flights={arrivals}
          selectedFlight={selectedFlight}
          onSelect={handleSelectFlight}
          type="arrival"
        />
      </ListWrapper>
      <Divider />
      <ListWrapper>
        <FlightList
          title="出发航班"
          flights={departures}
          selectedFlight={selectedFlight}
          onSelect={handleSelectFlight}
          type="departure"
        />
      </ListWrapper>
    </Container>
  );
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
  overflow: hidden;
`;

const ListWrapper = styled.div`
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

const Divider = styled.div`
  height: 2px;
  background: #e0e0e0;
  flex-shrink: 0;
`;
