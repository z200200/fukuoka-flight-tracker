import React from 'react';
import styled from 'styled-components';
import { FlightList } from './FlightList';
import { useFlightContext } from '../context/FlightContext';

export function FlightListsContainer() {
  const { arrivals, departures, selectedFlight, selectFlight } = useFlightContext();

  return (
    <Container>
      <FlightList
        title="Arrivals"
        flights={arrivals}
        selectedFlight={selectedFlight}
        onSelect={selectFlight}
        type="arrival"
      />
      <Divider />
      <FlightList
        title="Departures"
        flights={departures}
        selectedFlight={selectedFlight}
        onSelect={selectFlight}
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
