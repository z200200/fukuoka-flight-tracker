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
        console.log('[MapContainer] Bounds changed:', newBounds);
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

// Create a custom plane icon with glow effect
const createPlaneIcon = (heading: number | null, isSelected: boolean) => {
  const rotation = heading !== null ? heading : 0;
  const mainColor = isSelected ? '#FF6B6B' : '#333333';
  const iconSize = isSelected ? 44 : 32;

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
          filter: drop-shadow(0 0 6px rgba(255, 107, 107, 0.6)) drop-shadow(0 0 12px rgba(255, 107, 107, 0.4));
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

  // 普通状态：深灰色
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
      ">
        <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="${mainColor}"
             style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));">
          <path d="M21,16v-2l-8-5V3.5C13,2.67,12.33,2,11.5,2S10,2.67,10,3.5V9l-8,5v2l8-2.5V19l-2,1.5V22l3.5-1l3.5,1v-1.5L13,19v-5.5L21,16z"/>
        </svg>
      </div>
    `,
    iconSize: [iconSize, iconSize],
    iconAnchor: [iconSize / 2, iconSize / 2],
  });
};

export function MapContainer() {
  const { flights, selectedFlight, currentAirport, flightTracks, fetchFlightsInBounds } = useFlightContext();
  const { t } = useLanguage();

  // Handle map bounds change - fetch flights in new area
  const handleBoundsChange = useCallback((bounds: { lamin: number; lamax: number; lomin: number; lomax: number }) => {
    fetchFlightsInBounds(bounds);
  }, [fetchFlightsInBounds]);

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

  // Generate real flight tracks from track data
  const realFlightTracks = useMemo(() => {
    const tracks: Array<{
      icao24: string;
      positions: [number, number][];
      hasTrack: boolean;
    }> = [];

    flights.forEach((flight) => {
      const trackData = flightTracks.get(flight.icao24);
      if (trackData && trackData.length > 1) {
        // Use real track data
        const positions = trackData.map(
          (wp) => [wp.latitude, wp.longitude] as [number, number]
        );
        tracks.push({
          icao24: flight.icao24,
          positions,
          hasTrack: true,
        });
      } else {
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
    });

    return tracks;
  }, [flights, flightTracks, currentAirport]);

  const markers = useMemo(
    () =>
      flights.map((flight) => {
        const isSelected = selectedFlight?.icao24 === flight.icao24;
        const planeIcon = createPlaneIcon(flight.heading, isSelected);

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
            zIndexOffset={0}
          >
            <Popup>
              <PopupContent>
                <PopupTitle>{flight.callsign || flight.icao24?.toUpperCase() || 'Unknown'}</PopupTitle>
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
    [flights, selectedFlight]
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
          {t.tracking}: {flights.length} {t.aircraft} |
          {t.tracks}: {realFlightTracks.filter(track => track.hasTrack).length}/{Math.min(flights.filter(f => !f.onGround).length, 3)}
        </StatusText>
      </StatusOverlay>

      {/* Selected aircraft info panel */}
      {selectedFlight && (
        <SelectedFlightPanel>
          <PanelTitle>{selectedFlight.callsign || selectedFlight.icao24?.toUpperCase() || 'Unknown'}</PanelTitle>
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
