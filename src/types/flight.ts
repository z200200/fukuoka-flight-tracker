// OpenSky API Response Types

export interface StateVector {
  icao24: string;
  callsign: string | null;
  origin_country: string;
  time_position: number | null;
  last_contact: number;
  longitude: number | null;
  latitude: number | null;
  baro_altitude: number | null;
  on_ground: boolean;
  velocity: number | null;
  true_track: number | null;
  vertical_rate: number | null;
  sensors: number[] | null;
  geo_altitude: number | null;
  squawk: string | null;
  spi: boolean;
  position_source: number;
  category: string | null;
}

export interface StatesResponse {
  time: number;
  states: StateVector[] | null;
}

export interface FlightInfo {
  icao24: string;
  firstSeen: number;
  estDepartureAirport: string | null;
  lastSeen: number;
  estArrivalAirport: string | null;
  callsign: string | null;
  estDepartureAirportHorizDistance: number | null;
  estDepartureAirportVertDistance: number | null;
  estArrivalAirportHorizDistance: number | null;
  estArrivalAirportVertDistance: number | null;
  departureAirportCandidatesCount: number;
  arrivalAirportCandidatesCount: number;
}

export interface TrackWaypoint {
  time: number;
  latitude: number;
  longitude: number;
  baro_altitude: number | null;
  true_track: number;
  on_ground: boolean;
}

export interface FlightTrack {
  icao24: string;
  callsign: string | null;
  startTime: number;
  endTime: number;
  path: TrackWaypoint[];
}

// Application Types

export interface Flight {
  icao24: string;
  callsign: string | null;
  latitude: number;
  longitude: number;
  altitude: number | null;
  velocity: number | null;
  heading: number | null;
  onGround: boolean;
  originCountry: string;
  lastContact: number;
  departureAirport: string | null;
  arrivalAirport: string | null;
  track?: TrackWaypoint[];
}

export interface AirportInfo {
  icao: string;
  iata: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface ApiError {
  message: string;
  status?: number;
  retryAfter?: number;
}

export interface RateLimitInfo {
  remaining: number | null;
  retryAfterSeconds: number | null;
}

// OAuth2 Token Response
export interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: 'Bearer';
  refresh_expires_in?: number;
  scope?: string;
}
