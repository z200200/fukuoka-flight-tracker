import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useOpenSkyApi } from '../hooks/useOpenSkyApi';
import type { Flight, FlightInfo, StateVector, RateLimitInfo } from '../types/flight';

// Fukuoka Airport coordinates
const FUKUOKA_AIRPORT = {
  icao: 'RJFF',
  iata: 'FUK',
  latitude: 33.5859,
  longitude: 130.451,
  radiusKm: 100, // 100km radius
};

interface FlightContextType {
  flights: Flight[];
  arrivals: FlightInfo[];
  departures: FlightInfo[];
  selectedFlight: Flight | null;
  loading: boolean;
  error: Error | null;
  rateLimitInfo: RateLimitInfo;
  lastUpdate: Date | null;
  selectFlight: (flight: Flight | null) => void;
  refreshData: () => Promise<void>;
  timeRangeHours: number;
  setTimeRangeHours: (hours: number) => void;
}

const FlightContext = createContext<FlightContextType | undefined>(undefined);

interface FlightProviderProps {
  children: ReactNode;
  clientId: string;
  clientSecret: string;
}

export function FlightProvider({ children, clientId, clientSecret }: FlightProviderProps) {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [arrivals, setArrivals] = useState<FlightInfo[]>([]);
  const [departures, setDepartures] = useState<FlightInfo[]>([]);
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [timeRangeHours, setTimeRangeHours] = useState(2); // Default ±2 hours

  const {
    loading,
    error,
    rateLimitInfo,
    fetchStatesAroundAirport,
    fetchArrivals,
    fetchDepartures,
  } = useOpenSkyApi(clientId, clientSecret);

  const convertStateVectorToFlight = useCallback((state: StateVector): Flight => {
    return {
      icao24: state.icao24,
      callsign: state.callsign?.trim() || null,
      latitude: state.latitude || 0,
      longitude: state.longitude || 0,
      altitude: state.baro_altitude,
      velocity: state.velocity,
      heading: state.true_track,
      onGround: state.on_ground,
      originCountry: state.origin_country,
      lastContact: state.last_contact,
      departureAirport: null,
      arrivalAirport: null,
    };
  }, []);

  const refreshData = useCallback(async () => {
    try {
      const now = Math.floor(Date.now() / 1000);
      const timeRange = timeRangeHours * 3600; // Convert hours to seconds
      const beginTime = now - timeRange;
      const endTime = now + timeRange;

      // Fetch all data in parallel
      const [statesResponse, arrivalsData, departuresData] = await Promise.all([
        fetchStatesAroundAirport(
          FUKUOKA_AIRPORT.latitude,
          FUKUOKA_AIRPORT.longitude,
          FUKUOKA_AIRPORT.radiusKm
        ),
        fetchArrivals(FUKUOKA_AIRPORT.icao, beginTime, endTime),
        fetchDepartures(FUKUOKA_AIRPORT.icao, beginTime, endTime),
      ]);

      // Process states
      if (statesResponse?.states) {
        const flightData = statesResponse.states
          .filter((state) => state.latitude !== null && state.longitude !== null)
          .map(convertStateVectorToFlight);

        setFlights(flightData);
      } else {
        setFlights([]);
      }

      // Set arrivals and departures
      setArrivals(arrivalsData || []);
      setDepartures(departuresData || []);

      setLastUpdate(new Date());
    } catch (err) {
      console.error('Failed to refresh flight data:', err);
    }
  }, [
    timeRangeHours,
    fetchStatesAroundAirport,
    fetchArrivals,
    fetchDepartures,
    convertStateVectorToFlight,
  ]);

  // Initial data fetch
  useEffect(() => {
    if (clientId && clientSecret) {
      refreshData();
    }
  }, [clientId, clientSecret, refreshData]);

  // Auto-refresh every 30 seconds for live positions
  useEffect(() => {
    if (!clientId || !clientSecret) return;

    const interval = setInterval(() => {
      refreshData();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [clientId, clientSecret, refreshData]);

  const selectFlight = useCallback((flight: Flight | null) => {
    setSelectedFlight(flight);
  }, []);

  const value: FlightContextType = {
    flights,
    arrivals,
    departures,
    selectedFlight,
    loading,
    error,
    rateLimitInfo,
    lastUpdate,
    selectFlight,
    refreshData,
    timeRangeHours,
    setTimeRangeHours,
  };

  return <FlightContext.Provider value={value}>{children}</FlightContext.Provider>;
}

export function useFlightContext(): FlightContextType {
  const context = useContext(FlightContext);
  if (!context) {
    throw new Error('useFlightContext must be used within FlightProvider');
  }
  return context;
}
