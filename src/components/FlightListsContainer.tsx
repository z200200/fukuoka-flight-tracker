import styled from 'styled-components';
import { FlightList } from './FlightList';
import { useFlightContext, type ScheduledFlight } from '../context/FlightContext';
import { useLanguage } from '../context/LanguageContext';

// IATA → ICAO 航空公司代码映射表
const IATA_TO_ICAO: Record<string, string> = {
  // 日本
  'JL': 'JAL', 'NH': 'ANA', 'BC': 'SKY', 'JQ': 'JJP', 'MM': 'APJ',
  'GK': 'JJA', 'NU': 'JTA', 'HD': 'ADO', '7G': 'SFJ', 'FW': 'IBX', 'DJ': 'FDA',
  // 中国
  'MU': 'CES', 'CA': 'CCA', 'CZ': 'CSN', 'HU': 'CHH', 'SC': 'CDG',
  '3U': 'CSC', 'MF': 'CXA', 'ZH': 'CSZ', '9C': 'CQH',
  // 中国航空公司补充
  'HO': 'DKH',  // 吉祥航空 Juneyao Airlines
  'FM': 'CSH',  // 上海航空 Shanghai Airlines
  'KN': 'CUA',  // 中国联合航空 China United Airlines
  'TV': 'TBA',  // 西藏航空 Tibet Airlines
  '8L': 'LKE',  // 祥鹏航空 Lucky Air
  'EU': 'UEA',  // 成都航空 Chengdu Airlines
  'GS': 'GCR',  // 天津航空 Tianjin Airlines
  'NS': 'XBH',  // 河北航空 Hebei Airlines
  'Y8': 'YZR',  // 扬子江快运 Yangtze River Express
  'JD': 'CBJ',  // 北京首都航空 Capital Airlines
  // 韩国
  'KE': 'KAL', 'OZ': 'AAR', 'LJ': 'JNA', 'TW': 'TWB', 'BX': 'ABL',
  '7C': 'JJA', 'ZE': 'ESR', 'RF': 'EOK',
  // 台湾/香港
  'BR': 'EVA', 'CI': 'CAL', 'IT': 'TTW', 'CX': 'CPA', 'HX': 'CRK', 'UO': 'HKE',
  // 东南亚
  'SQ': 'SIA', 'TG': 'THA', 'VN': 'HVN', 'VJ': 'VJC', 'QF': 'QFA', 'PR': 'PAL',
  // 欧美
  'AA': 'AAL', 'UA': 'UAL', 'DL': 'DAL', 'AF': 'AFR', 'BA': 'BAW', 'LH': 'DLH',
  // 货运
  'FX': 'FDX', '5X': 'UPS',
};

// 规范化callsign格式（去掉空格，转大写）- 用于匹配
function normalizeCallsign(callsign: string | null | undefined): string | null {
  if (!callsign) return null;
  return callsign.trim().replace(/\s+/g, '').toUpperCase();
}

// 将 IATA 格式航班号转换为 ICAO 格式 (JL310 → JAL310)
function convertIataToIcao(flightNumber: string | null | undefined): string | null {
  if (!flightNumber) return null;
  const normalized = flightNumber.trim().replace(/\s+/g, '').toUpperCase();
  const match = normalized.match(/^([A-Z]{2}|[A-Z]\d|\d[A-Z]|[A-Z]{3})(\d+)$/);
  if (!match) return normalized;
  const [, airlineCode, flightNum] = match;
  if (airlineCode.length === 2 && IATA_TO_ICAO[airlineCode]) {
    return IATA_TO_ICAO[airlineCode] + flightNum;
  }
  return normalized;
}

export function FlightListsContainer() {
  const { arrivals, departures, selectedFlight, selectFlight, currentAirport, flightRoutes, flights } = useFlightContext();
  const { t } = useLanguage();

  const handleSelectFlight = (scheduledFlight: ScheduledFlight) => {
    // 通过 flightNumber 找到对应的实时雷达飞机
    // 时刻表用 IATA 格式 (JL310)，雷达用 ICAO 格式 (JAL310)
    const iataNumber = normalizeCallsign(scheduledFlight.flightNumber);
    const icaoNumber = convertIataToIcao(scheduledFlight.flightNumber);

    // 增强调试日志：显示所有 callsign，便于调试匹配问题
    const allCallsigns = flights.map(f => normalizeCallsign(f.callsign)).filter(Boolean);
    console.log('[FlightListsContainer] Selecting flight:', {
      flightNumber: scheduledFlight.flightNumber,
      iataNumber,
      icaoNumber,
      flightsCount: flights.length,
      allCallsigns: allCallsigns, // 显示所有 callsign
    });

    if (icaoNumber || iataNumber) {
      // 第一步：精确匹配 ICAO 或 IATA 格式
      let matchingFlight = flights.find(f => {
        const callsign = normalizeCallsign(f.callsign);
        return callsign === icaoNumber || callsign === iataNumber;
      });

      if (matchingFlight) {
        console.log('[FlightListsContainer] Exact match found:', matchingFlight.icao24, matchingFlight.callsign);
        selectFlight(matchingFlight);
        return;
      }

      // 第二步：模糊匹配（包含匹配）- 如果精确匹配失败
      console.log('[FlightListsContainer] Exact match failed, trying fuzzy match...');
      const searchTerms = [icaoNumber, iataNumber].filter(Boolean) as string[];

      matchingFlight = flights.find(f => {
        const callsign = normalizeCallsign(f.callsign);
        if (!callsign) return false;
        // 检查是否包含搜索词，或搜索词包含 callsign
        return searchTerms.some(term =>
          callsign.includes(term) || term.includes(callsign)
        );
      });

      if (matchingFlight) {
        console.log('[FlightListsContainer] Fuzzy match found:', matchingFlight.icao24, matchingFlight.callsign);
        selectFlight(matchingFlight);
        return;
      }

      // 第三步：航班号数字部分匹配（提取数字部分）
      const flightNumMatch = (icaoNumber || iataNumber || '').match(/\d+/);
      if (flightNumMatch) {
        const flightNum = flightNumMatch[0];
        console.log('[FlightListsContainer] Trying flight number match:', flightNum);

        matchingFlight = flights.find(f => {
          const callsign = normalizeCallsign(f.callsign);
          if (!callsign) return false;
          const csNumMatch = callsign.match(/\d+/);
          return csNumMatch && csNumMatch[0] === flightNum;
        });

        if (matchingFlight) {
          console.log('[FlightListsContainer] Flight number match found:', matchingFlight.icao24, matchingFlight.callsign);
          selectFlight(matchingFlight);
          return;
        }
      }

      console.log('[FlightListsContainer] No matching flight found after all attempts. Available callsigns:', allCallsigns.slice(0, 20));
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
  background: #FAFBFC;
  overflow: hidden;
`;

const ListWrapper = styled.div`
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

const Divider = styled.div`
  height: 1px;
  background: #E5E7EB;
  flex-shrink: 0;
`;
