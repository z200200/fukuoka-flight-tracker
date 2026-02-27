import styled from 'styled-components';
import { FlightList } from './FlightList';
import { useFlightContext, type ScheduledFlight } from '../context/FlightContext';
import { useLanguage } from '../context/LanguageContext';

// 规范化callsign格式（去掉空格，转大写）- 用于匹配
function normalizeCallsign(callsign: string | null | undefined): string | null {
  if (!callsign) return null;
  return callsign.trim().replace(/\s+/g, '').toUpperCase();
}

export function FlightListsContainer() {
  const { arrivals, departures, selectedFlight, selectFlight, currentAirport, flightRoutes, flights } = useFlightContext();
  const { t } = useLanguage();

  const handleSelectFlight = (scheduledFlight: ScheduledFlight) => {
    // 通过 flightNumber（callsign）找到对应的实时雷达飞机
    const normalizedFlightNumber = normalizeCallsign(scheduledFlight.flightNumber);
    if (normalizedFlightNumber) {
      const matchingFlight = flights.find(f => normalizeCallsign(f.callsign) === normalizedFlightNumber);
      if (matchingFlight) {
        selectFlight(matchingFlight);
        return;
      }
    }
    // 没有找到对应的雷达数据（飞机可能还未起飞或已降落）
    selectFlight(null);
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
