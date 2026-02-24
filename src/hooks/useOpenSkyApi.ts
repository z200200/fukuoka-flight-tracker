import { useState, useEffect, useCallback, useRef } from 'react';
import { OpenSkyClient, withExponentialBackoff } from '../services/opensky';
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
}

export function useOpenSkyApi(
  clientId: string,
  clientSecret: string
): UseOpenSkyApiResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo>({
    remaining: null,
    retryAfterSeconds: null,
  });

  const clientRef = useRef<OpenSkyClient | null>(null);

  // Initialize client
  useEffect(() => {
    if (clientId && clientSecret) {
      clientRef.current = new OpenSkyClient(clientId, clientSecret);
    }
  }, [clientId, clientSecret]);

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

  return {
    loading,
    error,
    rateLimitInfo,
    fetchStatesAroundAirport,
    fetchArrivals,
    fetchDepartures,
    fetchTrack,
  };
}
