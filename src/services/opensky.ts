import axios, { AxiosInstance } from 'axios';
import type {
  StatesResponse,
  FlightInfo,
  FlightTrack,
  TokenResponse,
  RateLimitInfo,
} from '../types/flight';

const BASE_URL = 'https://opensky-network.org/api';
const AUTH_URL =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';

export class OpenSkyClient {
  private axiosInstance: AxiosInstance;
  private token: string | null = null;
  private tokenExpiry: number = 0;
  private clientId: string;
  private clientSecret: string;
  public rateLimitInfo: RateLimitInfo = {
    remaining: null,
    retryAfterSeconds: null,
  };

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
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

  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 1 minute buffer)
    if (this.token && Date.now() < this.tokenExpiry - 60000) {
      return this.token;
    }

    try {
      const response = await axios.post<TokenResponse>(
        AUTH_URL,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.token = response.data.access_token;
      this.tokenExpiry = Date.now() + response.data.expires_in * 1000;

      return this.token;
    } catch (error) {
      console.error('Failed to get OAuth2 token:', error);
      throw new Error('Authentication failed');
    }
  }

  private async makeAuthenticatedRequest<T>(
    endpoint: string,
    params: Record<string, string | number> = {}
  ): Promise<T> {
    const token = await this.getAccessToken();

    try {
      const response = await this.axiosInstance.get<T>(endpoint, {
        params,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 429) {
        const retryAfter = this.rateLimitInfo.retryAfterSeconds || 60;
        throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
      }
      throw error;
    }
  }

  async getStatesInBoundingBox(
    lamin: number,
    lomin: number,
    lamax: number,
    lomax: number
  ): Promise<StatesResponse> {
    return this.makeAuthenticatedRequest<StatesResponse>('/states/all', {
      lamin,
      lomin,
      lamax,
      lomax,
    });
  }

  async getAirportArrivals(
    airport: string,
    beginTime: number,
    endTime: number
  ): Promise<FlightInfo[]> {
    return this.makeAuthenticatedRequest<FlightInfo[]>('/flights/arrival', {
      airport,
      begin: beginTime,
      end: endTime,
    });
  }

  async getAirportDepartures(
    airport: string,
    beginTime: number,
    endTime: number
  ): Promise<FlightInfo[]> {
    return this.makeAuthenticatedRequest<FlightInfo[]>('/flights/departure', {
      airport,
      begin: beginTime,
      end: endTime,
    });
  }

  async getFlightTrack(icao24: string, timestamp: number = 0): Promise<FlightTrack> {
    return this.makeAuthenticatedRequest<FlightTrack>('/tracks', {
      icao24: icao24.toLowerCase(),
      time: timestamp,
    });
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
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;

      if (attempt >= maxRetries) {
        throw error;
      }

      if (error.message?.includes('Rate limited')) {
        // Extract retry time from error message or use exponential backoff
        const match = error.message.match(/Retry after (\d+) seconds/);
        const retrySeconds = match ? parseInt(match[1], 10) : 0;
        const delay = retrySeconds
          ? retrySeconds * 1000
          : baseDelay * Math.pow(2, attempt);

        console.log(`Rate limited. Retrying after ${delay}ms...`);
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
