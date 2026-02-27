import { useState, useEffect, useCallback, useRef } from 'react';
import { OpenSkyClient, withExponentialBackoff, type RouteInfo, type AirportSchedule, type ScheduledFlight } from '../services/opensky';
import type {
  StatesResponse,
  FlightInfo,
  FlightTrack,
  RateLimitInfo,
} from '../types/flight';

interface UseOpenSkyApiResult {
  loading: boolean;
  error: Error | null;
  rateLimitInfo: RateLimitInfo;
  fetchStatesAroundAirport: (
    latitude: number,
    longitude: number,
    radiusKm?: number
  ) => Promise<StatesResponse | null>;
  fetchStatesInBounds: (
    lamin: number,
    lamax: number,
    lomin: number,
    lomax: number
  ) => Promise<StatesResponse | null>;
  fetchArrivals: (
    airport: string,
    beginTime: number,
    endTime: number
  ) => Promise<FlightInfo[] | null>;
  fetchDepartures: (
    airport: string,
    beginTime: number,
    endTime: number
  ) => Promise<FlightInfo[] | null>;
  fetchTrack: (icao24: string, timestamp?: number) => Promise<FlightTrack | null>;
  // ADSB.LOL methods
  fetchAircraftAdsbLol: (
    latitude: number,
    longitude: number,
    radiusNm?: number
  ) => Promise<StatesResponse | null>;
  fetchTrackAdsbLol: (icao24: string) => Promise<FlightTrack | null>;
  fetchAllTracksAdsbLol: () => Promise<{ tracks: Record<string, [number, number][]>; count: number } | null>;
  // HexDB.io route lookup
  fetchRoutesByCallsigns: (callsigns: string[]) => Promise<Record<string, RouteInfo> | null>;
  // 机场时刻表爬虫
  fetchAirportSchedule: (airportCode: string) => Promise<AirportSchedule | null>;
  matchFlightsByCallsigns: (callsigns: string[]) => Promise<Record<string, ScheduledFlight | null>>;
}

export function useOpenSkyApi(): UseOpenSkyApiResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo>({
    remaining: null,
    retryAfterSeconds: null,
  });

  const clientRef = useRef<OpenSkyClient | null>(null);

  // Initialize client
  useEffect(() => {
    clientRef.current = new OpenSkyClient();
  }, []);

  const updateRateLimitInfo = useCallback(() => {
    if (clientRef.current) {
      setRateLimitInfo({ ...clientRef.current.rateLimitInfo });
    }
  }, []);

  const fetchStatesAroundAirport = useCallback(
    async (
      latitude: number,
      longitude: number,
      radiusKm: number = 50
    ): Promise<StatesResponse | null> => {
      if (!clientRef.current) {
        setError(new Error('OpenSky client not initialized'));
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await withExponentialBackoff(() =>
          clientRef.current!.getFlightsAroundAirport(latitude, longitude, radiusKm)
        );
        updateRateLimitInfo();
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        updateRateLimitInfo();
        return null;
      } finally {
        setLoading(false);
      }
    },
    [updateRateLimitInfo]
  );

  const fetchStatesInBounds = useCallback(
    async (
      lamin: number,
      lamax: number,
      lomin: number,
      lomax: number
    ): Promise<StatesResponse | null> => {
      if (!clientRef.current) {
        setError(new Error('OpenSky client not initialized'));
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await withExponentialBackoff(() =>
          clientRef.current!.getStatesInBoundingBox(lamin, lomin, lamax, lomax)
        );
        updateRateLimitInfo();
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        updateRateLimitInfo();
        return null;
      } finally {
        setLoading(false);
      }
    },
    [updateRateLimitInfo]
  );

  const fetchArrivals = useCallback(
    async (
      airport: string,
      beginTime: number,
      endTime: number
    ): Promise<FlightInfo[] | null> => {
      if (!clientRef.current) {
        setError(new Error('OpenSky client not initialized'));
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await withExponentialBackoff(() =>
          clientRef.current!.getAirportArrivals(airport, beginTime, endTime)
        );
        updateRateLimitInfo();
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        updateRateLimitInfo();
        return null;
      } finally {
        setLoading(false);
      }
    },
    [updateRateLimitInfo]
  );

  const fetchDepartures = useCallback(
    async (
      airport: string,
      beginTime: number,
      endTime: number
    ): Promise<FlightInfo[] | null> => {
      if (!clientRef.current) {
        setError(new Error('OpenSky client not initialized'));
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await withExponentialBackoff(() =>
          clientRef.current!.getAirportDepartures(airport, beginTime, endTime)
        );
        updateRateLimitInfo();
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        updateRateLimitInfo();
        return null;
      } finally {
        setLoading(false);
      }
    },
    [updateRateLimitInfo]
  );

  const fetchTrack = useCallback(
    async (icao24: string, timestamp: number = 0): Promise<FlightTrack | null> => {
      if (!clientRef.current) {
        setError(new Error('OpenSky client not initialized'));
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await withExponentialBackoff(() =>
          clientRef.current!.getFlightTrack(icao24, timestamp)
        );
        updateRateLimitInfo();
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        updateRateLimitInfo();
        return null;
      } finally {
        setLoading(false);
      }
    },
    [updateRateLimitInfo]
  );

  // ========== ADSB.LOL Methods ==========

  const fetchAircraftAdsbLol = useCallback(
    async (
      latitude: number,
      longitude: number,
      radiusNm: number = 100
    ): Promise<StatesResponse | null> => {
      if (!clientRef.current) {
        return null;
      }

      setLoading(true);
      try {
        const result = await clientRef.current.getAircraftFromAdsbLol(latitude, longitude, radiusNm);
        return result;
      } catch (err) {
        console.error('[ADSB.LOL] Error fetching aircraft:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const fetchTrackAdsbLol = useCallback(
    async (icao24: string): Promise<FlightTrack | null> => {
      if (!clientRef.current) {
        return null;
      }

      try {
        const result = await clientRef.current.getTrackFromAdsbLol(icao24);
        return result;
      } catch (err) {
        console.error('[ADSB.LOL] Error fetching track:', err);
        return null;
      }
    },
    []
  );

  const fetchAllTracksAdsbLol = useCallback(
    async (): Promise<{ tracks: Record<string, [number, number][]>; count: number } | null> => {
      if (!clientRef.current) {
        return null;
      }

      try {
        const result = await clientRef.current.getAllTracksFromAdsbLol();
        return result;
      } catch (err) {
        console.error('[ADSB.LOL] Error fetching all tracks:', err);
        return null;
      }
    },
    []
  );

  // ========== HexDB.io Route Lookup ==========

  const fetchRoutesByCallsigns = useCallback(
    async (callsigns: string[]): Promise<Record<string, RouteInfo> | null> => {
      if (!clientRef.current || callsigns.length === 0) {
        return null;
      }

      try {
        const result = await clientRef.current.getRoutesByCallsigns(callsigns);
        return result.routes;
      } catch (err) {
        console.error('[HexDB] Error fetching routes:', err);
        return null;
      }
    },
    []
  );

  // ========== 机场时刻表爬虫 ==========

  const fetchAirportSchedule = useCallback(
    async (airportCode: string) => {
      if (!clientRef.current) return null;
      return await clientRef.current.getAirportSchedule(airportCode);
    },
    []
  );

  const matchFlightsByCallsigns = useCallback(
    async (callsigns: string[]) => {
      if (!clientRef.current || callsigns.length === 0) return {};
      return await clientRef.current.matchFlightsByCallsigns(callsigns);
    },
    []
  );

  return {
    loading,
    error,
    rateLimitInfo,
    fetchStatesAroundAirport,
    fetchStatesInBounds,
    fetchArrivals,
    fetchDepartures,
    fetchTrack,
    // ADSB.LOL
    fetchAircraftAdsbLol,
    fetchTrackAdsbLol,
    fetchAllTracksAdsbLol,
    // HexDB.io
    fetchRoutesByCallsigns,
    // 机场时刻表爬虫
    fetchAirportSchedule,
    matchFlightsByCallsigns,
  };
}
