import { useMemo } from 'react';
import { MapContainer as LeafletMap, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
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

// Fukuoka Airport coordinates
const FUKUOKA_AIRPORT = {
  latitude: 33.5859,
  longitude: 130.451,
};

// Create a custom plane icon
const createPlaneIcon = (heading: number | null, isSelected: boolean) => {
  const rotation = heading !== null ? heading : 0;
  const color = isSelected ? '#2196F3' : '#FF5722';

  return L.divIcon({
    className: 'custom-plane-icon',
    html: `
      <div style="
        transform: rotate(${rotation}deg);
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="${color}">
          <path d="M21,16v-2l-8-5V3.5C13,2.67,12.33,2,11.5,2S10,2.67,10,3.5V9l-8,5v2l8-2.5V19l-2,1.5V22l3.5-1l3.5,1v-1.5L13,19v-5.5L21,16z"/>
        </svg>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

export function MapContainer() {
  const { flights, selectedFlight, selectFlight } = useFlightContext();

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
            eventHandlers={{
              click: () => {
                selectFlight(flight);
              },
            }}
          >
            <Popup>
              <PopupContent>
                <PopupTitle>{flight.callsign || flight.icao24.toUpperCase()}</PopupTitle>
                <PopupInfo>
                  <InfoRow>
                    <Label>ICAO24:</Label>
                    <Value>{flight.icao24.toUpperCase()}</Value>
                  </InfoRow>
                  <InfoRow>
                    <Label>Altitude:</Label>
                    <Value>{flight.altitude ? `${Math.round(flight.altitude)}m` : 'N/A'}</Value>
                  </InfoRow>
                  <InfoRow>
                    <Label>Speed:</Label>
                    <Value>{flight.velocity ? `${Math.round(flight.velocity)}m/s` : 'N/A'}</Value>
                  </InfoRow>
                  <InfoRow>
                    <Label>Heading:</Label>
                    <Value>{flight.heading !== null ? `${Math.round(flight.heading)}°` : 'N/A'}</Value>
                  </InfoRow>
                  <InfoRow>
                    <Label>Country:</Label>
                    <Value>{flight.originCountry}</Value>
                  </InfoRow>
                  <InfoRow>
                    <Label>Status:</Label>
                    <Value>{flight.onGround ? 'On Ground' : 'In Air'}</Value>
                  </InfoRow>
                </PopupInfo>
              </PopupContent>
            </Popup>
          </Marker>
        );
      }),
    [flights, selectedFlight, selectFlight]
  );

  return (
    <MapWrapper>
      <LeafletMap
        center={[FUKUOKA_AIRPORT.latitude, FUKUOKA_AIRPORT.longitude]}
        zoom={9}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Fukuoka Airport marker */}
        <Marker position={[FUKUOKA_AIRPORT.latitude, FUKUOKA_AIRPORT.longitude]}>
          <Popup>
            <PopupContent>
              <PopupTitle>Fukuoka Airport (RJFF/FUK)</PopupTitle>
              <PopupInfo>
                <InfoRow>
                  <Label>ICAO:</Label>
                  <Value>RJFF</Value>
                </InfoRow>
                <InfoRow>
                  <Label>IATA:</Label>
                  <Value>FUK</Value>
                </InfoRow>
                <InfoRow>
                  <Label>Location:</Label>
                  <Value>
                    {FUKUOKA_AIRPORT.latitude.toFixed(4)}, {FUKUOKA_AIRPORT.longitude.toFixed(4)}
                  </Value>
                </InfoRow>
              </PopupInfo>
            </PopupContent>
          </Popup>
        </Marker>

        {/* 100km radius circle around airport */}
        <Circle
          center={[FUKUOKA_AIRPORT.latitude, FUKUOKA_AIRPORT.longitude]}
          radius={100000} // 100km in meters
          pathOptions={{
            color: '#3388ff',
            fillColor: '#3388ff',
            fillOpacity: 0.05,
            weight: 2,
            dashArray: '5, 5',
          }}
        />

        {/* Flight markers */}
        {markers}
      </LeafletMap>

      <StatusOverlay>
        <StatusText>Tracking: {flights.length} aircraft</StatusText>
      </StatusOverlay>
    </MapWrapper>
  );
}

const MapWrapper = styled.div`
  position: relative;
  width: 100%;
  height: 100%;

  .leaflet-container {
    background: #aad3df;
  }

  .custom-plane-icon {
    background: transparent;
    border: none;
  }
`;

const StatusOverlay = styled.div`
  position: absolute;
  top: 10px;
  left: 50px;
  background: white;
  padding: 8px 16px;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  z-index: 1000;
`;

const StatusText = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: #2c3e50;
`;

const PopupContent = styled.div`
  min-width: 200px;
`;

const PopupTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 2px solid #e0e0e0;
`;

const PopupInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const InfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 13px;
`;

const Label = styled.span`
  color: #7f8c8d;
  font-weight: 500;
`;

const Value = styled.span`
  color: #2c3e50;
  font-weight: 400;
  margin-left: 8px;
`;
