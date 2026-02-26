import styled from 'styled-components';
import { FlightList } from './FlightList';
import { useFlightContext } from '../context/FlightContext';
import { useLanguage } from '../context/LanguageContext';
import type { Flight, FlightInfo } from '../types/flight';

export function FlightListsContainer() {
  const { arrivals, departures, selectedFlight, selectFlight, currentAirport, flightRoutes, flights } = useFlightContext();
  const { t } = useLanguage();

  const handleSelectFlight = (flight: FlightInfo | Flight) => {
    // 如果是Flight对象（有位置数据），直接选中
    if ('latitude' in flight && 'longitude' in flight) {
      selectFlight(flight as Flight);
    } else {
      // 如果是FlightInfo，通过icao24找到对应的实时飞机
      const matchingFlight = flights.find(f => f.icao24 === flight.icao24);
      if (matchingFlight) {
        selectFlight(matchingFlight);
      } else {
        selectFlight(null);
      }
    }
  };

  return (
    <Container>
      <ListWrapper>
        <FlightList
          title={t.arrivals}
          flights={arrivals}
          selectedFlight={selectedFlight}
          onSelect={handleSelectFlight}
          type="arrival"
          currentAirportIcao={currentAirport.icao}
          flightRoutes={flightRoutes}
        />
      </ListWrapper>
      <Divider />
      <ListWrapper>
        <FlightList
          title={t.departures}
          flights={departures}
          selectedFlight={selectedFlight}
          onSelect={handleSelectFlight}
          type="departure"
          currentAirportIcao={currentAirport.icao}
          flightRoutes={flightRoutes}
        />
      </ListWrapper>
    </Container>
  );
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: linear-gradient(180deg, #0a0a12 0%, #0f0f1a 100%);
  overflow: hidden;
`;

const ListWrapper = styled.div`
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

const Divider = styled.div`
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, rgba(0, 255, 255, 0.3) 50%, transparent 100%);
  flex-shrink: 0;
`;
