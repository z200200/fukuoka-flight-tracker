import axios, { type AxiosInstance } from 'axios';
import type {
  StatesResponse,
  FlightInfo,
  FlightTrack,
  RateLimitInfo,
} from '../types/flight';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export class OpenSkyClient {
  private axiosInstance: AxiosInstance;
  public rateLimitInfo: RateLimitInfo = {
    remaining: null,
    retryAfterSeconds: null,
  };

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: BASE_URL,
      timeout: 30000,
    });

    // Add response interceptor to extract rate limit info
    this.axiosInstance.interceptors.response.use(
      (response) => {
        const remaining = response.headers['x-rate-limit-remaining'];
        const retryAfter = response.headers['x-rate-limit-retry-after-seconds'];

        if (remaining) {
          this.rateLimitInfo.remaining = parseInt(remaining, 10);
        }
        if (retryAfter) {
          this.rateLimitInfo.retryAfterSeconds = parseInt(retryAfter, 10);
        }

        return response;
      },
      (error) => {
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['x-rate-limit-retry-after-seconds'];
          if (retryAfter) {
            this.rateLimitInfo.retryAfterSeconds = parseInt(retryAfter, 10);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  async getStatesInBoundingBox(
    lamin: number,
    lomin: number,
    lamax: number,
    lomax: number
  ): Promise<StatesResponse> {
    const response = await this.axiosInstance.get<StatesResponse>('/states/all', {
      params: { lamin, lomin, lamax, lomax }
    });
    return response.data;
  }

  async getAirportArrivals(
    airport: string,
    beginTime: number,
    endTime: number
  ): Promise<FlightInfo[]> {
    const response = await this.axiosInstance.get<FlightInfo[]>('/flights/arrival', {
      params: { airport, begin: beginTime, end: endTime }
    });
    return response.data;
  }

  async getAirportDepartures(
    airport: string,
    beginTime: number,
    endTime: number
  ): Promise<FlightInfo[]> {
    const response = await this.axiosInstance.get<FlightInfo[]>('/flights/departure', {
      params: { airport, begin: beginTime, end: endTime }
    });
    return response.data;
  }

  async getFlightTrack(icao24: string, timestamp: number = 0): Promise<FlightTrack> {
    const response = await this.axiosInstance.get<FlightTrack>('/tracks', {
      params: { icao24: icao24.toLowerCase(), time: timestamp }
    });
    return response.data;
  }

  async getFlightsAroundAirport(
    latitude: number,
    longitude: number,
    radiusKm: number = 50
  ): Promise<StatesResponse> {
    // Calculate bounding box (rough approximation: 1 degree ≈ 111 km)
    const deltaLat = radiusKm / 111;
    const deltaLon = radiusKm / (111 * Math.cos((latitude * Math.PI) / 180));

    const lamin = latitude - deltaLat;
    const lamax = latitude + deltaLat;
    const lomin = longitude - deltaLon;
    const lomax = longitude + deltaLon;

    return this.getStatesInBoundingBox(lamin, lomin, lamax, lomax);
  }

  // ========== ADSB.LOL Methods (无速率限制) ==========

  // 使用 adsb.lol 获取飞机位置
  async getAircraftFromAdsbLol(
    latitude: number,
    longitude: number,
    radiusNm: number = 100
  ): Promise<StatesResponse> {
    const response = await this.axiosInstance.get<StatesResponse>('/adsb/aircraft', {
      params: { lat: latitude, lon: longitude, dist: radiusNm }
    });
    return response.data;
  }

  // 获取 adsb.lol 缓存的航迹
  async getTrackFromAdsbLol(icao24: string): Promise<FlightTrack> {
    const response = await this.axiosInstance.get<FlightTrack>(`/adsb/track/${icao24.toLowerCase()}`);
    return response.data;
  }

  // 获取所有缓存的航迹
  async getAllTracksFromAdsbLol(): Promise<{ tracks: Record<string, [number, number][]>; count: number }> {
    const response = await this.axiosInstance.get('/adsb/tracks');
    return response.data;
  }

  // ========== HexDB.io Route Lookup Methods ==========

  // 航线信息类型
  async getRouteByCallsign(callsign: string): Promise<RouteInfo> {
    const response = await this.axiosInstance.get<RouteInfo>(`/route/${callsign}`);
    return response.data;
  }

  // 批量获取航线信息
  async getRoutesByCallsigns(callsigns: string[]): Promise<{ routes: Record<string, RouteInfo>; count: number }> {
    const response = await this.axiosInstance.get('/routes', {
      params: { callsigns: callsigns.join(',') }
    });
    return response.data;
  }

  // ========== 机场时刻表爬虫 API ==========

  // 获取机场航班时刻表
  async getAirportSchedule(airportCode: string): Promise<AirportSchedule | null> {
    try {
      const response = await this.axiosInstance.get<AirportSchedule>(`/schedule/${airportCode}`);
      return response.data;
    } catch (error) {
      console.warn(`[OpenSkyClient] Failed to fetch schedule for ${airportCode}:`, error);
      return null;
    }
  }

  // 匹配航班号（跨机场搜索）
  async matchFlightByCallsign(callsign: string): Promise<ScheduledFlight | null> {
    try {
      const response = await this.axiosInstance.get<ScheduledFlight>(`/schedule/match/${callsign}`);
      return response.data?.found === false ? null : response.data;
    } catch (error) {
      console.warn(`[OpenSkyClient] Failed to match flight ${callsign}:`, error);
      return null;
    }
  }

  // 批量匹配航班号
  async matchFlightsByCallsigns(callsigns: string[]): Promise<Record<string, ScheduledFlight | null>> {
    try {
      const response = await this.axiosInstance.post<{ matches: Record<string, ScheduledFlight | null> }>('/schedule/match', {
        callsigns
      });
      return response.data?.matches || {};
    } catch (error) {
      console.warn('[OpenSkyClient] Failed to batch match flights:', error);
      return {};
    }
  }
}

// 航线信息类型
export interface RouteInfo {
  callsign: string;
  origin: string | null;
  destination: string | null;
  route: string | null;
  scheduledTime?: string | null;  // 计划时间 (HH:MM)
  actualTime?: string | null;     // 实际时间 (HH:MM)
  status?: string | null;         // 航班状态
}

// 机场/航线信息
export interface AirportInfo {
  iata: string;
  name: string;
}

// 机场时刻表类型
export interface ScheduledFlight {
  scheduledTime: string | null;
  actualTime?: string | null;
  flightNumber: string | null;
  origin?: AirportInfo | null;      // 出发机场（到达航班有此字段）
  destination?: AirportInfo | null;  // 目的机场（出发航班有此字段）
  status?: string | null;
  gate?: string | null;
  terminal?: string | null;
  airport?: string;      // 匹配到的机场代码 (FUK/HND/NRT/ICN)
  direction?: string;    // 'arrival' | 'departure'
  airportName?: string;
  found?: boolean;
}

export interface AirportSchedule {
  airport: string;
  name: string;
  icao: string;
  departures: ScheduledFlight[];
  arrivals: ScheduledFlight[];
  lastUpdate: number;
}

// Exponential backoff utility
export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  baseDelay: number = 2000
): Promise<T> {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error: unknown) {
      attempt++;

      if (attempt >= maxRetries) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.includes('Rate limited')) {
        // Extract retry time from error message or use exponential backoff
        const match = errorMessage.match(/Retry after (\d+) seconds/);
        const retrySeconds = match ? parseInt(match[1], 10) : 0;
        const delay = retrySeconds
          ? Math.min(retrySeconds * 1000, 120000)
          : baseDelay * Math.pow(2, attempt);

        console.log(`Rate limited. Retrying after ${delay}ms (attempt ${attempt}/${maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        // For other errors, use exponential backoff
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error('Max retries exceeded');
}
