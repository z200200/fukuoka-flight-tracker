import { z } from 'zod';

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

// 运行时校验：adsb.lol 是外部数据源，格式可能变化或返回异常字段，
// 在进入应用状态前用 Zod 校验，格式不对的记录直接丢弃而不是让 NaN/undefined 流入地图渲染
export const FlightSchema = z.object({
  icao24: z.string().min(1),
  callsign: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  altitude: z.number().nullable(),
  velocity: z.number().nullable(),
  heading: z.number().nullable(),
  onGround: z.boolean(),
  originCountry: z.string(),
  lastContact: z.number(),
  departureAirport: z.string().nullable(),
  arrivalAirport: z.string().nullable(),
});

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
