import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useOpenSkyApi } from '../hooks/useOpenSkyApi';
import type { Flight, FlightInfo, StateVector, RateLimitInfo, TrackWaypoint } from '../types/flight';
import { AIRPORTS, DEFAULT_AIRPORT, type AirportId, type AirportConfig } from '../config/airports';

interface MapBounds {
  lamin: number;
  lamax: number;
  lomin: number;
  lomax: number;
}

interface FlightContextType {
  flights: Flight[];
  flightTracks: Map<string, TrackWaypoint[]>;
  arrivals: FlightInfo[];
  departures: FlightInfo[];
  selectedFlight: Flight | null;
  selectedFlightTrack: TrackWaypoint[] | null;
  loading: boolean;
  error: Error | null;
  rateLimitInfo: RateLimitInfo;
  lastUpdate: Date | null;
  selectFlight: (flight: Flight | null) => void;
  refreshData: () => Promise<void>;
  timeRangeHours: number;
  setTimeRangeHours: (hours: number) => void;
  currentAirport: AirportConfig;
  currentAirportId: AirportId;
  setCurrentAirport: (airportId: AirportId) => void;
  mapBounds: MapBounds | null;
  setMapBounds: (bounds: MapBounds) => void;
  fetchFlightsInBounds: (bounds: MapBounds) => Promise<void>;
}

const FlightContext = createContext<FlightContextType | undefined>(undefined);

interface FlightProviderProps {
  children: ReactNode;
}

export function FlightProvider({ children }: FlightProviderProps) {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [flightTracks, setFlightTracks] = useState<Map<string, TrackWaypoint[]>>(new Map());
  const [arrivals, setArrivals] = useState<FlightInfo[]>([]);
  const [departures, setDepartures] = useState<FlightInfo[]>([]);
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);
  const [selectedFlightTrack, setSelectedFlightTrack] = useState<TrackWaypoint[] | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [timeRangeHours, setTimeRangeHours] = useState(2); // Default ±2 hours
  const [currentAirportId, setCurrentAirportId] = useState<AirportId>(DEFAULT_AIRPORT);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);

  const currentAirport = AIRPORTS[currentAirportId];

  // Reset data when airport changes
  const setCurrentAirport = useCallback((airportId: AirportId) => {
    console.log(`[FlightContext] Switching to airport: ${airportId}`);
    setFlights([]);
    setFlightTracks(new Map());
    setArrivals([]);
    setDepartures([]);
    setSelectedFlight(null);
    setSelectedFlightTrack(null);
    setLastUpdate(null);
    setCurrentAirportId(airportId);
  }, []);

  const {
    loading,
    error,
    rateLimitInfo,
    fetchStatesAroundAirport,
    fetchStatesInBounds,
    fetchArrivals,
    fetchDepartures,
    fetchTrack,
  } = useOpenSkyApi();

  // OpenSky API returns states as arrays, convert to objects
  // Array indices: 0=icao24, 1=callsign, 2=origin_country, 3=time_position, 4=last_contact,
  // 5=longitude, 6=latitude, 7=baro_altitude, 8=on_ground, 9=velocity, 10=true_track,
  // 11=vertical_rate, 12=sensors, 13=geo_altitude, 14=squawk, 15=spi, 16=position_source
  const parseStateArray = useCallback((stateArray: unknown[]): StateVector => {
    return {
      icao24: stateArray[0] as string,
      callsign: stateArray[1] as string | null,
      origin_country: stateArray[2] as string,
      time_position: stateArray[3] as number | null,
      last_contact: stateArray[4] as number,
      longitude: stateArray[5] as number | null,
      latitude: stateArray[6] as number | null,
      baro_altitude: stateArray[7] as number | null,
      on_ground: stateArray[8] as boolean,
      velocity: stateArray[9] as number | null,
      true_track: stateArray[10] as number | null,
      vertical_rate: stateArray[11] as number | null,
      sensors: stateArray[12] as number[] | null,
      geo_altitude: stateArray[13] as number | null,
      squawk: stateArray[14] as string | null,
      spi: stateArray[15] as boolean,
      position_source: stateArray[16] as number,
      category: null,
    };
  }, []);

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

  // Fetch flights within map bounds (called when user zooms/pans the map)
  const fetchFlightsInBounds = useCallback(async (bounds: MapBounds) => {
    try {
      console.log(`[FlightContext] Fetching flights in bounds: ${JSON.stringify(bounds)}`);
      const statesResponse = await fetchStatesInBounds(
        bounds.lamin,
        bounds.lamax,
        bounds.lomin,
        bounds.lomax
      );

      if (statesResponse?.states) {
        const flightData = (statesResponse.states as unknown as unknown[][])
          .map(parseStateArray)
          .filter((state) => state.latitude !== null && state.longitude !== null)
          .map(convertStateVectorToFlight);
        setFlights(flightData);
        console.log(`[FlightContext] Fetched ${flightData.length} flights in bounds`);
      } else {
        setFlights([]);
      }

      setLastUpdate(new Date());
    } catch (err) {
      console.error('[FlightContext] Failed to fetch flights in bounds:', err);
    }
  }, [fetchStatesInBounds, parseStateArray, convertStateVectorToFlight]);

  const refreshData = useCallback(async () => {
    try {
      const now = Math.floor(Date.now() / 1000);
      const timeRange = timeRangeHours * 3600; // Convert hours to seconds
      const beginTime = now - timeRange;
      const endTime = now + timeRange;

      // Sequential requests with delays to avoid rate limiting
      console.log(`[FlightContext] Manual refresh for ${currentAirport.name}: fetching states...`);
      const statesResponse = await fetchStatesAroundAirport(
        currentAirport.latitude,
        currentAirport.longitude,
        currentAirport.radiusKm
      );

      // Process states (API returns arrays, need to convert to objects)
      if (statesResponse?.states) {
        const flightData = (statesResponse.states as unknown as unknown[][])
          .map(parseStateArray)
          .filter((state) => state.latitude !== null && state.longitude !== null)
          .map(convertStateVectorToFlight);
        setFlights(flightData);
        console.log(`[FlightContext] Manual refresh: ${flightData.length} aircraft`);
      } else {
        setFlights([]);
      }

      // Wait before next request
      await new Promise(resolve => setTimeout(resolve, 3000));

      console.log(`[FlightContext] Manual refresh for ${currentAirport.name}: fetching arrivals...`);
      const arrivalsData = await fetchArrivals(currentAirport.icao, beginTime, endTime);
      setArrivals(arrivalsData || []);

      await new Promise(resolve => setTimeout(resolve, 3000));

      console.log(`[FlightContext] Manual refresh for ${currentAirport.name}: fetching departures...`);
      const departuresData = await fetchDepartures(currentAirport.icao, beginTime, endTime);
      setDepartures(departuresData || []);

      setLastUpdate(new Date());
      console.log('[FlightContext] Manual refresh complete');
    } catch (err) {
      console.error('[FlightContext] Failed to refresh flight data:', err);
    }
  }, [
    timeRangeHours,
    currentAirport,
    fetchStatesAroundAirport,
    fetchArrivals,
    fetchDepartures,
    parseStateArray,
    convertStateVectorToFlight,
  ]);

  // Initial fetch only (no auto-refresh, manual refresh via button)
  useEffect(() => {
    const fetchStates = async () => {
      try {
        console.log(`[FlightContext] Fetching aircraft states for ${currentAirport.name}...`);
        const statesResponse = await fetchStatesAroundAirport(
          currentAirport.latitude,
          currentAirport.longitude,
          currentAirport.radiusKm
        );

        if (statesResponse?.states) {
          const flightData = (statesResponse.states as unknown as unknown[][])
            .map(parseStateArray)
            .filter((state) => state.latitude !== null && state.longitude !== null)
            .map(convertStateVectorToFlight);
          setFlights(flightData);
          console.log(`[FlightContext] Fetched ${flightData.length} aircraft for ${currentAirport.name}`);
        } else {
          setFlights([]);
          console.log(`[FlightContext] No aircraft data received for ${currentAirport.name}`);
        }

        setLastUpdate(new Date());
      } catch (err) {
        console.error('[FlightContext] Failed to fetch aircraft states:', err);
      }
    };

    fetchStates(); // Initial fetch only, no interval
  }, [currentAirport, fetchStatesAroundAirport, parseStateArray, convertStateVectorToFlight]);

  // Fetch arrival/departure lists once (no auto-refresh, manual refresh via button)
  // Note: This API requires authentication and has strict rate limits
  useEffect(() => {
    const fetchFlightLists = async () => {
      try {
        const now = Math.floor(Date.now() / 1000);
        const timeRange = timeRangeHours * 3600;
        const beginTime = now - timeRange;
        const endTime = now + timeRange;

        // Sequential requests with delay to avoid rate limiting
        console.log(`[FlightContext] Fetching arrivals for ${currentAirport.name}...`);
        const arrivalsData = await fetchArrivals(currentAirport.icao, beginTime, endTime);
        if (Array.isArray(arrivalsData)) {
          setArrivals(arrivalsData);
          console.log(`[FlightContext] Fetched ${arrivalsData.length} arrivals for ${currentAirport.name}`);
        } else {
          console.log(`[FlightContext] Arrivals API rate limited or unavailable`);
          setArrivals([]);
        }

        // Wait 5 seconds before next request
        await new Promise(resolve => setTimeout(resolve, 5000));

        console.log(`[FlightContext] Fetching departures for ${currentAirport.name}...`);
        const departuresData = await fetchDepartures(currentAirport.icao, beginTime, endTime);
        if (Array.isArray(departuresData)) {
          setDepartures(departuresData);
          console.log(`[FlightContext] Fetched ${departuresData.length} departures for ${currentAirport.name}`);
        } else {
          console.log(`[FlightContext] Departures API rate limited or unavailable`);
          setDepartures([]);
        }
      } catch (err) {
        console.error('[FlightContext] Failed to fetch flight lists (rate limited?):', err);
        // Don't crash, just set empty arrays
        setArrivals([]);
        setDepartures([]);
      }
    };

    // Delay initial fetch by 8 seconds to avoid concurrent requests with states
    const initialTimeout = setTimeout(fetchFlightLists, 8000);
    return () => {
      clearTimeout(initialTimeout);
    };
  }, [currentAirport, timeRangeHours, fetchArrivals, fetchDepartures]);

  // Parse track waypoint array to object
  // Array format: [time, latitude, longitude, baro_altitude, true_track, on_ground]
  const parseTrackWaypoint = useCallback((wp: unknown[]): TrackWaypoint => {
    return {
      time: wp[0] as number,
      latitude: wp[1] as number,
      longitude: wp[2] as number,
      baro_altitude: wp[3] as number | null,
      true_track: wp[4] as number,
      on_ground: wp[5] as boolean,
    };
  }, []);

  // Fetch flight tracks for all aircraft (limited to avoid rate limiting)
  // Only fetches once when flights change, no auto-refresh
  useEffect(() => {
    const MAX_TRACKS_TO_FETCH = 3; // Reduced to avoid API rate limiting
    const DELAY_BETWEEN_REQUESTS = 5000; // 5 seconds between each request

    const fetchAllTracks = async () => {
      if (flights.length === 0) return;

      // Only fetch tracks for flights not on ground
      const airborneFlights = flights.filter(f => !f.onGround).slice(0, MAX_TRACKS_TO_FETCH);

      if (airborneFlights.length === 0) {
        console.log('[FlightContext] No airborne flights to fetch tracks for');
        return;
      }

      console.log(`[FlightContext] Fetching tracks for ${airborneFlights.length} aircraft...`);
      const newTracks = new Map<string, TrackWaypoint[]>();

      for (const flight of airborneFlights) {
        try {
          const trackData = await fetchTrack(flight.icao24);
          if (trackData?.path && Array.isArray(trackData.path) && trackData.path.length > 0) {
            // Convert array format to TrackWaypoint objects
            const waypoints = (trackData.path as unknown as unknown[][]).map(parseTrackWaypoint);
            newTracks.set(flight.icao24, waypoints);
            console.log(`[FlightContext] Track for ${flight.callsign || flight.icao24}: ${waypoints.length} waypoints`);
          }
          // Wait between requests to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
        } catch (err) {
          console.warn(`[FlightContext] Failed to fetch track for ${flight.icao24}:`, err);
        }
      }

      setFlightTracks(newTracks);
      console.log(`[FlightContext] Fetched ${newTracks.size} flight tracks`);
    };

    // Delay initial track fetch to avoid concurrent requests
    const timeout = setTimeout(fetchAllTracks, 10000);

    return () => {
      clearTimeout(timeout);
    };
  }, [flights, fetchTrack, parseTrackWaypoint]);

  const selectFlight = useCallback(async (flight: Flight | null) => {
    setSelectedFlight(flight);
    if (flight) {
      // Check if we already have the track
      const existingTrack = flightTracks.get(flight.icao24);
      if (existingTrack) {
        setSelectedFlightTrack(existingTrack);
        return;
      }
      // Fetch flight track when a flight is selected
      try {
        const trackData = await fetchTrack(flight.icao24);
        if (trackData?.path && Array.isArray(trackData.path) && trackData.path.length > 0) {
          // Convert array format to TrackWaypoint objects
          const waypoints = (trackData.path as unknown as unknown[][]).map(parseTrackWaypoint);
          setSelectedFlightTrack(waypoints);
        } else {
          setSelectedFlightTrack(null);
        }
      } catch (err) {
        console.error('Failed to fetch flight track:', err);
        setSelectedFlightTrack(null);
      }
    } else {
      setSelectedFlightTrack(null);
    }
  }, [fetchTrack, flightTracks, parseTrackWaypoint]);

  const value: FlightContextType = {
    flights,
    flightTracks,
    arrivals,
    departures,
    selectedFlight,
    selectedFlightTrack,
    loading,
    error,
    rateLimitInfo,
    lastUpdate,
    selectFlight,
    refreshData,
    timeRangeHours,
    setTimeRangeHours,
    currentAirport,
    currentAirportId,
    setCurrentAirport,
    mapBounds,
    setMapBounds,
    fetchFlightsInBounds,
  };

  return <FlightContext.Provider value={value}>{children}</FlightContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFlightContext(): FlightContextType {
  const context = useContext(FlightContext);
  if (!context) {
    throw new Error('useFlightContext must be used within FlightProvider');
  }
  return context;
}
