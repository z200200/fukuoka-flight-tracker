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
