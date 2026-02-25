import { useMemo, useEffect, useRef, useCallback } from 'react';
import { MapContainer as LeafletMap, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useFlightContext } from '../context/FlightContext';
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

  // Handle airport change - move map to new location
  useEffect(() => {
    if (prevCoordsRef.current.latitude !== latitude || prevCoordsRef.current.longitude !== longitude) {
      map.setView([latitude, longitude], 9, { animate: true });
      prevCoordsRef.current = { latitude, longitude };
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

// Create a custom plane icon with glow effect (Apple Music style)
const createPlaneIcon = (heading: number | null, isSelected: boolean) => {
  const rotation = heading !== null ? heading : 0;
  const mainColor = isSelected ? '#FC5C7D' : '#FFFFFF';
  const glowColor = isSelected ? 'rgba(250, 35, 59, 0.7)' : 'rgba(255, 255, 255, 0.4)';
  const pulseAnimation = isSelected ? 'pulse-selected' : 'pulse-normal';

  return L.divIcon({
    className: 'custom-plane-icon',
    html: `
      <style>
        @keyframes pulse-selected {
          0%, 100% { filter: drop-shadow(0 0 10px ${glowColor}); }
          50% { filter: drop-shadow(0 0 20px ${glowColor}); }
        }
        @keyframes pulse-normal {
          0%, 100% { filter: drop-shadow(0 0 4px ${glowColor}); }
          50% { filter: drop-shadow(0 0 8px ${glowColor}); }
        }
      </style>
      <div style="
        transform: rotate(${rotation}deg);
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: ${pulseAnimation} 2s ease-in-out infinite;
      ">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="${mainColor}" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">
          <path d="M21,16v-2l-8-5V3.5C13,2.67,12.33,2,11.5,2S10,2.67,10,3.5V9l-8,5v2l8-2.5V19l-2,1.5V22l3.5-1l3.5,1v-1.5L13,19v-5.5L21,16z"/>
        </svg>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

export function MapContainer() {
  const { flights, selectedFlight, currentAirport, flightTracks, fetchFlightsInBounds } = useFlightContext();

  // Handle map bounds change - fetch flights in new area
  const handleBoundsChange = useCallback((bounds: { lamin: number; lamax: number; lomin: number; lomax: number }) => {
    fetchFlightsInBounds(bounds);
  }, [fetchFlightsInBounds]);

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
        // Fallback: draw line from airport to current position
        tracks.push({
          icao24: flight.icao24,
          positions: [
            [currentAirport.latitude, currentAirport.longitude] as [number, number],
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

        return (
          <Marker
            key={flight.icao24}
            position={[flight.latitude, flight.longitude]}
            icon={planeIcon}
          >
            <Popup>
              <PopupContent>
                <PopupTitle>{flight.callsign || flight.icao24?.toUpperCase() || 'Unknown'}</PopupTitle>
                <PopupInfo>
                  <InfoRow>
                    <Label>ICAO24:</Label>
                    <Value>{flight.icao24?.toUpperCase() || '无'}</Value>
                  </InfoRow>
                  <InfoRow>
                    <Label>高度:</Label>
                    <Value>{flight.altitude ? `${Math.round(flight.altitude)}米` : '无'}</Value>
                  </InfoRow>
                  <InfoRow>
                    <Label>速度:</Label>
                    <Value>{flight.velocity ? `${Math.round(flight.velocity)}米/秒` : '无'}</Value>
                  </InfoRow>
                  <InfoRow>
                    <Label>航向:</Label>
                    <Value>{flight.heading !== null ? `${Math.round(flight.heading)}°` : '无'}</Value>
                  </InfoRow>
                  <InfoRow>
                    <Label>国家:</Label>
                    <Value>{flight.originCountry}</Value>
                  </InfoRow>
                  <InfoRow>
                    <Label>状态:</Label>
                    <Value>{flight.onGround ? '地面' : '空中'}</Value>
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
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Airport marker */}
        <Marker position={[currentAirport.latitude, currentAirport.longitude]}>
          <Popup>
            <PopupContent>
              <PopupTitle>{currentAirport.fullName} ({currentAirport.icao}/{currentAirport.iata})</PopupTitle>
              <PopupInfo>
                <InfoRow>
                  <Label>ICAO代码:</Label>
                  <Value>{currentAirport.icao}</Value>
                </InfoRow>
                <InfoRow>
                  <Label>IATA代码:</Label>
                  <Value>{currentAirport.iata}</Value>
                </InfoRow>
                <InfoRow>
                  <Label>坐标:</Label>
                  <Value>
                    {currentAirport.latitude.toFixed(4)}, {currentAirport.longitude.toFixed(4)}
                  </Value>
                </InfoRow>
              </PopupInfo>
            </PopupContent>
          </Popup>
        </Marker>

        {/* Radius circle around airport */}
        <Circle
          center={[currentAirport.latitude, currentAirport.longitude]}
          radius={currentAirport.radiusKm * 1000} // Convert km to meters
          pathOptions={{
            color: '#3388ff',
            fillColor: '#3388ff',
            fillOpacity: 0.05,
            weight: 2,
            dashArray: '5, 5',
          }}
        />

        {/* Real flight tracks */}
        {realFlightTracks.map((track) => (
          <Polyline
            key={`track-${track.icao24}`}
            positions={track.positions}
            pathOptions={{
              color: track.hasTrack ? '#4CAF50' : '#FF5722', // Green for real tracks, orange for fallback
              weight: track.hasTrack ? 3 : 2,
              opacity: track.hasTrack ? 0.8 : 0.5,
              dashArray: track.hasTrack ? undefined : '8, 4', // Solid for real, dashed for fallback
            }}
          />
        ))}

        {/* Flight markers */}
        {markers}
      </LeafletMap>

      <StatusOverlay>
        <StatusText>
          追踪: {flights.length} 架飞机 |
          轨迹: {realFlightTracks.filter(t => t.hasTrack).length}/{Math.min(flights.filter(f => !f.onGround).length, 3)}
        </StatusText>
      </StatusOverlay>
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

  /* Dark map tiles filter - Apple style */
  .leaflet-tile-pane {
    filter: saturate(0.6) brightness(0.7) contrast(1.2);
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
