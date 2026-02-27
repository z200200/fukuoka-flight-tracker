import React, { useMemo, useEffect, useRef, useCallback } from 'react';
import { MapContainer as LeafletMap, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useFlightContext } from '../context/FlightContext';
import { useLanguage } from '../context/LanguageContext';
import styled from 'styled-components';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Component to handle map center changes and bounds updates
function MapEventsHandler({
  latitude,
  longitude,
  onBoundsChange
}: {
  latitude: number;
  longitude: number;
  onBoundsChange: (bounds: { lamin: number; lamax: number; lomin: number; lomax: number }) => void;
}) {
  const map = useMap();
  const prevCoordsRef = useRef({ latitude, longitude });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 窗口大小变化时重新计算地图大小
  useEffect(() => {
    const handleResize = () => {
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    // 初始化时也调用一次
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [map]);

  // Handle airport change - move map to new location
  useEffect(() => {
    if (prevCoordsRef.current.latitude !== latitude || prevCoordsRef.current.longitude !== longitude) {
      map.setView([latitude, longitude], 9, { animate: true });
      prevCoordsRef.current = { latitude, longitude };
      // 切换机场时也重新计算大小
      setTimeout(() => map.invalidateSize(), 100);
    }
  }, [map, latitude, longitude]);

  // Handle map move/zoom - fetch new data
  useEffect(() => {
    const handleMoveEnd = () => {
      // Debounce to avoid too many API calls
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        const bounds = map.getBounds();
        const newBounds = {
          lamin: bounds.getSouth(),
          lamax: bounds.getNorth(),
          lomin: bounds.getWest(),
          lomax: bounds.getEast(),
        };
        // console.log('[MapContainer] Bounds changed:', newBounds);
        onBoundsChange(newBounds);
      }, 1000); // Wait 1 second after user stops moving
    };

    map.on('moveend', handleMoveEnd);

    return () => {
      map.off('moveend', handleMoveEnd);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [map, onBoundsChange]);

  return null;
}

// 航班类型枚举
type FlightType = 'arrival' | 'departure' | 'other';

// IATA → ICAO 航空公司代码映射表（福冈机场常见航空公司）
const IATA_TO_ICAO: Record<string, string> = {
  // 日本航空公司
  'JL': 'JAL',   // Japan Airlines
  'NH': 'ANA',   // All Nippon Airways
  'BC': 'SKY',   // Skymark Airlines
  'JQ': 'JJP',   // Jetstar Japan
  'MM': 'APJ',   // Peach Aviation
  'GK': 'JJA',   // Jetstar Japan (old code)
  'NU': 'JTA',   // Japan Transocean Air
  'HD': 'ADO',   // Air Do
  '7G': 'SFJ',   // Star Flyer
  'FW': 'IBX',   // IBEX Airlines
  'DJ': 'FDA',   // Fuji Dream Airlines

  // 中国航空公司
  'MU': 'CES',   // China Eastern
  'CA': 'CCA',   // Air China
  'CZ': 'CSN',   // China Southern
  'HU': 'CHH',   // Hainan Airlines
  'SC': 'CDG',   // Shandong Airlines
  '3U': 'CSC',   // Sichuan Airlines
  'MF': 'CXA',   // Xiamen Airlines
  'ZH': 'CSZ',   // Shenzhen Airlines
  '9C': 'CQH',   // Spring Airlines

  // 韩国航空公司
  'KE': 'KAL',   // Korean Air
  'OZ': 'AAR',   // Asiana Airlines
  'LJ': 'JNA',   // Jin Air
  'TW': 'TWB',   // T'way Air
  'BX': 'ABL',   // Air Busan
  '7C': 'JJA',   // Jeju Air
  'ZE': 'ESR',   // Eastar Jet
  'RF': 'EOK',   // Aero K

  // 台湾航空公司
  'BR': 'EVA',   // EVA Air
  'CI': 'CAL',   // China Airlines
  'IT': 'TTW',   // Tigerair Taiwan
  'AE': 'MDA',   // Mandarin Airlines
  'B7': 'UIA',   // Uni Air

  // 香港航空公司
  'CX': 'CPA',   // Cathay Pacific
  'HX': 'CRK',   // Hong Kong Airlines
  'UO': 'HKE',   // HK Express

  // 东南亚航空公司
  'SQ': 'SIA',   // Singapore Airlines
  'TG': 'THA',   // Thai Airways
  'VN': 'HVN',   // Vietnam Airlines
  'VJ': 'VJC',   // VietJet Air
  'QF': 'QFA',   // Qantas
  'PR': 'PAL',   // Philippine Airlines
  'BI': 'RBA',   // Royal Brunei Airlines

  // 欧美航空公司
  'AA': 'AAL',   // American Airlines
  'UA': 'UAL',   // United Airlines
  'DL': 'DAL',   // Delta Air Lines
  'AF': 'AFR',   // Air France
  'BA': 'BAW',   // British Airways
  'LH': 'DLH',   // Lufthansa

  // 货运航空公司
  'FX': 'FDX',   // FedEx
  '5X': 'UPS',   // UPS Airlines
};

// 规范化callsign格式（去掉空格，转大写）- 用于匹配flightRoutes
function normalizeCallsign(callsign: string | null | undefined): string | null {
  if (!callsign) return null;
  return callsign.trim().replace(/\s+/g, '').toUpperCase();
}

// 将 IATA 格式的航班号转换为 ICAO 格式
// 例如: "JL310" → "JAL310", "NH586" → "ANA586"
function convertIataToIcao(flightNumber: string | null | undefined): string | null {
  if (!flightNumber) return null;

  // 先规范化
  const normalized = flightNumber.trim().replace(/\s+/g, '').toUpperCase();

  // 提取航空公司代码和航班号
  // IATA 代码格式：2个字母(如JL)，或1字母1数字(如7G)，或1数字1字母(如9C)
  // ICAO 代码格式：3个字母(如JAL)
  // 航班号：纯数字
  const match = normalized.match(/^([A-Z]{2}|[A-Z]\d|\d[A-Z]|[A-Z]{3})(\d+)$/);
  if (!match) return normalized;

  const airlineCode = match[1];
  const flightNum = match[2];

  // 如果是2字符的 IATA 代码，尝试转换为 ICAO
  if (airlineCode.length === 2 && IATA_TO_ICAO[airlineCode]) {
    return IATA_TO_ICAO[airlineCode] + flightNum;
  }

  // 已经是 ICAO 格式（3字母）或找不到映射，返回原值
  return normalized;
}

// Create a custom plane icon with glow effect
// 参数: heading=航向, isSelected=是否选中, flightType=航班类型, isInDisplayList=是否在显示列表中
const createPlaneIcon = (
  heading: number | null,
  isSelected: boolean,
  flightType: FlightType = 'other',
  isInDisplayList: boolean = true
) => {
  const rotation = heading !== null ? heading : 0;

  // 颜色配置
  // - 选中: 珊瑚红
  // - 到达: 青色
  // - 出发: 橙色
  // - 非列表: 浅灰色
  // - 其他: 深灰色
  let mainColor: string;
  let glowColor: string;
  let arrowIndicator: string = '';

  if (isSelected) {
    mainColor = '#FF6B6B';
    glowColor = 'rgba(255, 107, 107, 0.6)';
  } else if (!isInDisplayList) {
    mainColor = '#AAAAAA'; // 浅灰色 - 非列表航班
    glowColor = '';
  } else if (flightType === 'arrival') {
    mainColor = '#00BCD4'; // 青色 - 到达
    glowColor = 'rgba(0, 188, 212, 0.4)';
    arrowIndicator = '▼';
  } else if (flightType === 'departure') {
    mainColor = '#FF9800'; // 橙色 - 出发
    glowColor = 'rgba(255, 152, 0, 0.4)';
    arrowIndicator = '▲';
  } else {
    mainColor = '#666666';
    glowColor = '';
  }

  const iconSize = isSelected ? 44 : 32;
  const indicatorSize = 10;

  if (isSelected) {
    // 选中状态：柔和的珊瑚红 + 轻微发光
    return L.divIcon({
      className: 'custom-plane-icon selected-plane',
      html: `
        <div style="
          transform: rotate(${rotation}deg);
          width: ${iconSize}px;
          height: ${iconSize}px;
          display: flex;
          align-items: center;
          justify-content: center;
          filter: drop-shadow(0 0 6px ${glowColor}) drop-shadow(0 0 12px rgba(255, 107, 107, 0.4));
        ">
          <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="${mainColor}"
               stroke="#FFFFFF" stroke-width="0.5">
            <path d="M21,16v-2l-8-5V3.5C13,2.67,12.33,2,11.5,2S10,2.67,10,3.5V9l-8,5v2l8-2.5V19l-2,1.5V22l3.5-1l3.5,1v-1.5L13,19v-5.5L21,16z"/>
          </svg>
        </div>
      `,
      iconSize: [iconSize, iconSize],
      iconAnchor: [iconSize / 2, iconSize / 2],
    });
  }

  // 非选中状态
  const filterStyle = glowColor
    ? `filter: drop-shadow(0 0 4px ${glowColor}) drop-shadow(0 1px 2px rgba(0,0,0,0.3));`
    : 'filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));';

  // 如果有方向指示器（到达/出发），添加小箭头
  const indicatorHtml = arrowIndicator && isInDisplayList ? `
    <div style="
      position: absolute;
      bottom: -2px;
      left: 50%;
      transform: translateX(-50%) rotate(-${rotation}deg);
      font-size: ${indicatorSize}px;
      color: ${mainColor};
      font-weight: bold;
      text-shadow: 0 0 3px rgba(0,0,0,0.5);
      line-height: 1;
    ">${arrowIndicator}</div>
  ` : '';

  return L.divIcon({
    className: 'custom-plane-icon',
    html: `
      <div style="
        transform: rotate(${rotation}deg);
        width: ${iconSize}px;
        height: ${iconSize}px;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      ">
        <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="${mainColor}"
             style="${filterStyle}">
          <path d="M21,16v-2l-8-5V3.5C13,2.67,12.33,2,11.5,2S10,2.67,10,3.5V9l-8,5v2l8-2.5V19l-2,1.5V22l3.5-1l3.5,1v-1.5L13,19v-5.5L21,16z"/>
        </svg>
        ${indicatorHtml}
      </div>
    `,
    iconSize: [iconSize, iconSize],
    iconAnchor: [iconSize / 2, iconSize / 2],
  });
};

export function MapContainer() {
  const { flights, selectedFlight, currentAirport, flightTracks, flightRoutes, arrivals, departures } = useFlightContext();
  const { t } = useLanguage();

  // Handle map bounds change - just log for debugging, no API calls
  const handleBoundsChange = useCallback((_bounds: { lamin: number; lamax: number; lomin: number; lomax: number }) => {
    // 不再触发任何 API 调用，只用于调试
    // console.log('[MapContainer] Bounds changed:', bounds);
  }, []);

  // Helper: calculate distance between two points (in km)
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Helper: find the nearest airport for a flight (handles multi-airport regions like Tokyo)
  const getNearestAirportCoords = (flightLat: number, flightLon: number): [number, number] => {
    if (currentAirport.subAirports && currentAirport.subAirports.length > 0) {
      // Find the nearest sub-airport
      let nearestDist = Infinity;
      let nearestCoords: [number, number] = [currentAirport.latitude, currentAirport.longitude];

      for (const sub of currentAirport.subAirports) {
        const dist = getDistance(flightLat, flightLon, sub.latitude, sub.longitude);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestCoords = [sub.latitude, sub.longitude];
        }
      }
      return nearestCoords;
    }
    // Single airport
    return [currentAirport.latitude, currentAirport.longitude];
  };

  // Filter out ground aircraft - they should not be displayed at all
  const airborneFlights = useMemo(() => {
    return flights.filter(flight => !flight.onGround);
  }, [flights]);

  // Generate real flight tracks from track data
  const realFlightTracks = useMemo(() => {
    const tracks: Array<{
      icao24: string;
      positions: [number, number][];
      hasTrack: boolean;
    }> = [];

    airborneFlights.forEach((flight) => {
      const trackData = flightTracks.get(flight.icao24);
      if (trackData && trackData.length > 1) {
        // Use real track data - 只保留最近40个点，避免轨迹过长
        const positions = trackData.map(
          (wp) => [wp.latitude, wp.longitude] as [number, number]
        ).slice(-40);
        tracks.push({
          icao24: flight.icao24,
          positions,
          hasTrack: true,
        });
      } else {
        // Check if aircraft is within the tracking radius before drawing estimated route
        const distanceToAirport = getDistance(
          flight.latitude,
          flight.longitude,
          currentAirport.latitude,
          currentAirport.longitude
        );

        // Only draw orange estimated line for aircraft within the tracking circle
        if (distanceToAirport <= currentAirport.radiusKm) {
          // Fallback: draw line from nearest airport to current position
          const airportCoords = getNearestAirportCoords(flight.latitude, flight.longitude);
          tracks.push({
            icao24: flight.icao24,
            positions: [
              airportCoords,
              [flight.latitude, flight.longitude] as [number, number],
            ],
            hasTrack: false,
          });
        }
        // Aircraft outside the circle: no estimated route line, but still shown on map
      }
    });

    return tracks;
  }, [airborneFlights, flightTracks, currentAirport]);

  // 解析时间字符串 "HH:MM" 为分钟数（与 FlightList 保持一致）
  const parseTimeToMinutes = (timeStr: string | null | undefined): number | null => {
    if (!timeStr) return null;
    const match = timeStr.match(/^(\d{2}):(\d{2})$/);
    if (match) {
      return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
    }
    return null;
  };

  // 计算在显示列表中的航班 callsign 集合（ScheduledFlight 使用 flightNumber）
  // 使用 IATA→ICAO 转换，以便与 adsb.lol 的 callsign (ICAO格式) 匹配
  const displayedArrivalCallsigns = useMemo(() => {
    // 按计划时间排序（与 FlightList 一致）
    const sorted = [...arrivals].sort((a, b) => {
      const aMinutes = parseTimeToMinutes(a.scheduledTime);
      const bMinutes = parseTimeToMinutes(b.scheduledTime);

      if (aMinutes !== null && bMinutes !== null) return aMinutes - bMinutes;
      if (aMinutes !== null) return -1;
      if (bMinutes !== null) return 1;
      return 0;
    });
    // 返回 ICAO 格式的 callsign 集合
    const callsigns = new Set<string>();
    sorted.slice(0, 10).forEach(f => {
      // 转换 IATA 格式 (JL310) → ICAO 格式 (JAL310)
      const icaoCallsign = convertIataToIcao(f.flightNumber);
      if (icaoCallsign) callsigns.add(icaoCallsign);
    });
    return callsigns;
  }, [arrivals]);

  const displayedDepartureCallsigns = useMemo(() => {
    // 按计划时间排序（与 FlightList 一致）
    const sorted = [...departures].sort((a, b) => {
      const aMinutes = parseTimeToMinutes(a.scheduledTime);
      const bMinutes = parseTimeToMinutes(b.scheduledTime);

      if (aMinutes !== null && bMinutes !== null) return aMinutes - bMinutes;
      if (aMinutes !== null) return -1;
      if (bMinutes !== null) return 1;
      return 0;
    });
    // 返回 ICAO 格式的 callsign 集合
    const callsigns = new Set<string>();
    sorted.slice(0, 10).forEach(f => {
      // 转换 IATA 格式 (JL310) → ICAO 格式 (JAL310)
      const icaoCallsign = convertIataToIcao(f.flightNumber);
      if (icaoCallsign) callsigns.add(icaoCallsign);
    });
    return callsigns;
  }, [departures]);

  const markers = useMemo(
    () =>
      airborneFlights.map((flight) => {
        const isSelected = selectedFlight?.icao24 === flight.icao24;
        const normalizedCallsign = normalizeCallsign(flight.callsign);

        // 判断航班类型 - 使用 callsign 与时刻表的 flightNumber 匹配
        let flightType: FlightType = 'other';
        let inDisplayList = false;

        if (normalizedCallsign) {
          // 检查是否在计划航班中（使用 ICAO 格式匹配）
          // adsb.lol 返回的 callsign 已经是 ICAO 格式 (如 JAL310)
          if (displayedArrivalCallsigns.has(normalizedCallsign)) {
            flightType = 'arrival';
            inDisplayList = true;
          } else if (displayedDepartureCallsigns.has(normalizedCallsign)) {
            flightType = 'departure';
            inDisplayList = true;
          } else {
            // 检查是否在完整的计划列表中（但不在前10显示）
            // 需要将 AeroDataBox 的 IATA 格式转换为 ICAO 格式来匹配
            const isInArrivals = arrivals.some(f => convertIataToIcao(f.flightNumber) === normalizedCallsign);
            const isInDepartures = departures.some(f => convertIataToIcao(f.flightNumber) === normalizedCallsign);

            if (isInArrivals) {
              flightType = 'arrival';
            } else if (isInDepartures) {
              flightType = 'departure';
            }
          }
        }

        const planeIcon = createPlaneIcon(flight.heading, isSelected, flightType, inDisplayList);

        // 选中的飞机不显示弹窗（已有绿色高亮效果）
        if (isSelected) {
          return (
            <Marker
              key={flight.icao24}
              position={[flight.latitude, flight.longitude]}
              icon={planeIcon}
              zIndexOffset={1000}
            />
          );
        }

        return (
          <Marker
            key={flight.icao24}
            position={[flight.latitude, flight.longitude]}
            icon={planeIcon}
            zIndexOffset={inDisplayList ? 100 : 0}
          >
            <Popup>
              <PopupContent>
                <PopupTitle>
                  {flight.callsign || flight.icao24?.toUpperCase() || 'Unknown'}
                  {flight.callsign && flightRoutes.get(normalizeCallsign(flight.callsign)!)?.route && (
                    <RouteInfo>({flightRoutes.get(normalizeCallsign(flight.callsign)!)?.origin}→{flightRoutes.get(normalizeCallsign(flight.callsign)!)?.destination})</RouteInfo>
                  )}
                </PopupTitle>
                <PopupInfo>
                  <InfoRow>
                    <Label>{t.icao24}:</Label>
                    <Value>{flight.icao24?.toUpperCase() || t.noData}</Value>
                  </InfoRow>
                  <InfoRow>
                    <Label>{t.altitude}:</Label>
                    <Value>{flight.altitude ? `${Math.round(flight.altitude)}${t.meter}` : t.noData}</Value>
                  </InfoRow>
                  <InfoRow>
                    <Label>{t.speed}:</Label>
                    <Value>{flight.velocity ? `${Math.round(flight.velocity)}${t.meterPerSec}` : t.noData}</Value>
                  </InfoRow>
                  <InfoRow>
                    <Label>{t.heading}:</Label>
                    <Value>{flight.heading !== null ? `${Math.round(flight.heading)}${t.degree}` : t.noData}</Value>
                  </InfoRow>
                  <InfoRow>
                    <Label>{t.country}:</Label>
                    <Value>{flight.originCountry}</Value>
                  </InfoRow>
                  <InfoRow>
                    <Label>{t.status}:</Label>
                    <Value>{flight.onGround ? t.onGround : t.inAir}</Value>
                  </InfoRow>
                </PopupInfo>
              </PopupContent>
            </Popup>
          </Marker>
        );
      }),
    [airborneFlights, selectedFlight, flightRoutes, t, arrivals, departures, displayedArrivalCallsigns, displayedDepartureCallsigns]
  );

  return (
    <MapWrapper>
      <LeafletMap
        center={[currentAirport.latitude, currentAirport.longitude]}
        zoom={9}
        style={{ height: '100%', width: '100%' }}
      >
        <MapEventsHandler
          latitude={currentAirport.latitude}
          longitude={currentAirport.longitude}
          onBoundsChange={handleBoundsChange}
        />
        {/* 行政区域地图 */}
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {/* Airport marker(s) - show sub-airports if available */}
        {currentAirport.subAirports && currentAirport.subAirports.length > 0 ? (
          // Multiple airports (e.g., Tokyo)
          currentAirport.subAirports.map((sub) => (
            <Marker key={sub.icao} position={[sub.latitude, sub.longitude]}>
              <Popup>
                <PopupContent>
                  <PopupTitle>{sub.name} ({sub.icao}/{sub.iata})</PopupTitle>
                  <PopupInfo>
                    <InfoRow>
                      <Label>{t.icaoCode}:</Label>
                      <Value>{sub.icao}</Value>
                    </InfoRow>
                    <InfoRow>
                      <Label>{t.iataCode}:</Label>
                      <Value>{sub.iata}</Value>
                    </InfoRow>
                    <InfoRow>
                      <Label>{t.coordinates}:</Label>
                      <Value>
                        {sub.latitude.toFixed(4)}, {sub.longitude.toFixed(4)}
                      </Value>
                    </InfoRow>
                  </PopupInfo>
                </PopupContent>
              </Popup>
            </Marker>
          ))
        ) : (
          // Single airport
          <Marker position={[currentAirport.latitude, currentAirport.longitude]}>
            <Popup>
              <PopupContent>
                <PopupTitle>{currentAirport.fullName} ({currentAirport.icao}/{currentAirport.iata})</PopupTitle>
                <PopupInfo>
                  <InfoRow>
                    <Label>{t.icaoCode}:</Label>
                    <Value>{currentAirport.icao}</Value>
                  </InfoRow>
                  <InfoRow>
                    <Label>{t.iataCode}:</Label>
                    <Value>{currentAirport.iata}</Value>
                  </InfoRow>
                  <InfoRow>
                    <Label>{t.coordinates}:</Label>
                    <Value>
                      {currentAirport.latitude.toFixed(4)}, {currentAirport.longitude.toFixed(4)}
                    </Value>
                  </InfoRow>
                </PopupInfo>
              </PopupContent>
            </Popup>
          </Marker>
        )}

        {/* Radius circle around airport */}
        <Circle
          center={[currentAirport.latitude, currentAirport.longitude]}
          radius={currentAirport.radiusKm * 1000} // Convert km to meters
          pathOptions={{
            color: '#88bbff',
            fillColor: '#88bbff',
            fillOpacity: 0.03,
            weight: 1.5,
            dashArray: '8, 6',
          }}
        />

        {/* Real flight tracks with gradient colors */}
        {realFlightTracks.map((track) => {
          if (!track.hasTrack || track.positions.length < 2) {
            // 估算航线：虚线
            return (
              <Polyline
                key={`track-${track.icao24}`}
                positions={track.positions}
                pathOptions={{
                  color: '#FF6600',
                  weight: 3,
                  opacity: 0.7,
                  dashArray: '10, 6',
                }}
              />
            );
          }
          // 真实轨迹：分段渐变颜色（从旧到新：深色到亮色）
          const segments: React.ReactElement[] = [];
          const colors = ['#1a1a4e', '#2d2d7a', '#4040a6', '#5353d2', '#6666ff', '#8888ff', '#aaaaff', '#FF6600'];
          for (let i = 0; i < track.positions.length - 1; i++) {
            const colorIndex = Math.floor((i / (track.positions.length - 1)) * (colors.length - 1));
            segments.push(
              <Polyline
                key={`track-${track.icao24}-seg-${i}`}
                positions={[track.positions[i], track.positions[i + 1]]}
                pathOptions={{
                  color: colors[colorIndex],
                  weight: 4,
                  opacity: 0.9,
                }}
              />
            );
          }
          return segments;
        })}

        {/* Flight markers */}
        {markers}
      </LeafletMap>

      <StatusOverlay>
        <StatusText>
          {t.tracking}: {airborneFlights.length} {t.aircraft} |
          {t.tracks}: {realFlightTracks.filter(track => track.hasTrack).length}/{airborneFlights.length}
        </StatusText>
      </StatusOverlay>

      {/* Selected aircraft info panel */}
      {selectedFlight && (
        <SelectedFlightPanel>
          <PanelTitle>
            {selectedFlight.callsign || selectedFlight.icao24?.toUpperCase() || 'Unknown'}
            {selectedFlight.callsign && flightRoutes.get(normalizeCallsign(selectedFlight.callsign)!)?.route && (
              <RouteInfo>({flightRoutes.get(normalizeCallsign(selectedFlight.callsign)!)?.origin}→{flightRoutes.get(normalizeCallsign(selectedFlight.callsign)!)?.destination})</RouteInfo>
            )}
          </PanelTitle>
          <PanelContent>
            <PanelRow>
              <PanelLabel>{t.icao24}:</PanelLabel>
              <PanelValue>{selectedFlight.icao24?.toUpperCase() || t.noData}</PanelValue>
            </PanelRow>
            <PanelRow>
              <PanelLabel>{t.altitude}:</PanelLabel>
              <PanelValue>{selectedFlight.altitude ? `${Math.round(selectedFlight.altitude)}${t.meter}` : t.noData}</PanelValue>
            </PanelRow>
            <PanelRow>
              <PanelLabel>{t.speed}:</PanelLabel>
              <PanelValue>{selectedFlight.velocity ? `${Math.round(selectedFlight.velocity * 3.6)}${t.kmPerHour}` : t.noData}</PanelValue>
            </PanelRow>
            <PanelRow>
              <PanelLabel>{t.heading}:</PanelLabel>
              <PanelValue>{selectedFlight.heading !== null ? `${Math.round(selectedFlight.heading)}${t.degree}` : t.noData}</PanelValue>
            </PanelRow>
            <PanelRow>
              <PanelLabel>{t.country}:</PanelLabel>
              <PanelValue>{selectedFlight.originCountry || t.noData}</PanelValue>
            </PanelRow>
            <PanelRow>
              <PanelLabel>{t.status}:</PanelLabel>
              <PanelValue>{selectedFlight.onGround ? t.onGround : t.inAir}</PanelValue>
            </PanelRow>
          </PanelContent>
        </SelectedFlightPanel>
      )}
    </MapWrapper>
  );
}

const MapWrapper = styled.div`
  position: relative;
  width: 100%;
  height: 100%;

  .leaflet-container {
    background: #000000;
  }

  .custom-plane-icon {
    background: transparent;
    border: none;
  }

  /* 地图滤镜 */
  .leaflet-tile-pane {
    filter: none;
  }

  /* Popup styling */
  .leaflet-popup-content-wrapper {
    background: transparent;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6);
    border-radius: 12px;
    overflow: hidden;
  }

  .leaflet-popup-tip {
    background: #1C1C1E;
  }

  .leaflet-popup-close-button {
    color: white !important;
  }
`;

const StatusOverlay = styled.div`
  position: absolute;
  top: 10px;
  left: 50px;
  background: rgba(28, 28, 30, 0.95);
  backdrop-filter: blur(20px);
  padding: 12px 20px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
  z-index: 1000;
`;

const StatusText = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: white;
  display: flex;
  align-items: center;
  gap: 10px;

  &::before {
    content: '';
    width: 8px;
    height: 8px;
    background: #FA233B;
    border-radius: 50%;
    animation: blink 1.5s infinite;
    box-shadow: 0 0 8px rgba(250, 35, 59, 0.6);
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
`;

const PopupContent = styled.div`
  min-width: 220px;
  background: #1C1C1E;
  margin: -14px -20px;
  padding: 16px 20px;
  border-radius: 12px;
  color: white;
`;

const PopupTitle = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: #FC5C7D;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const RouteInfo = styled.span`
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  margin-left: 8px;
`;

const PopupInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const InfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  padding: 4px 0;
`;

const Label = styled.span`
  color: rgba(255, 255, 255, 0.6);
  font-weight: 500;
`;

const Value = styled.span`
  color: white;
  font-weight: 600;
  margin-left: 8px;
`;

// Selected aircraft info panel
const SelectedFlightPanel = styled.div`
  position: absolute;
  bottom: 20px;
  left: 50px;
  background: rgba(28, 28, 30, 0.95);
  backdrop-filter: blur(20px);
  padding: 16px 20px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 107, 107, 0.3);
  z-index: 1000;
  min-width: 200px;
  animation: slideIn 0.3s ease;

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 768px) {
    left: 10px;
    right: 10px;
    bottom: 10px;
    min-width: auto;
  }
`;

const PanelTitle = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: #FF6B6B;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255, 107, 107, 0.3);
  font-family: 'Consolas', 'Monaco', monospace;
`;

const PanelContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const PanelRow = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 13px;
`;

const PanelLabel = styled.span`
  color: rgba(255, 255, 255, 0.6);
  font-weight: 500;
`;

const PanelValue = styled.span`
  color: white;
  font-weight: 600;
  font-family: 'Consolas', 'Monaco', monospace;
`;
