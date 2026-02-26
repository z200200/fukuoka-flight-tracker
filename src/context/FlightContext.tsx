import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useOpenSkyApi } from '../hooks/useOpenSkyApi';
import type { Flight, FlightInfo, StateVector, RateLimitInfo, TrackWaypoint } from '../types/flight';
import { AIRPORTS, DEFAULT_AIRPORT, type AirportId, type AirportConfig } from '../config/airports';
import type { RouteInfo } from '../services/opensky';

// 航线信息类型
export type { RouteInfo } from '../services/opensky';

interface MapBounds {
  lamin: number;
  lamax: number;
  lomin: number;
  lomax: number;
}

interface FlightContextType {
  flights: Flight[];
  flightTracks: Map<string, TrackWaypoint[]>;
  flightRoutes: Map<string, RouteInfo>;
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
  const [flightRoutes, setFlightRoutes] = useState<Map<string, RouteInfo>>(new Map());
  const [arrivals, setArrivals] = useState<FlightInfo[]>([]);
  const [departures, setDepartures] = useState<FlightInfo[]>([]);
  const fetchedRoutesRef = useRef<Set<string>>(new Set()); // 已查询过的呼号
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);
  const [selectedFlightTrack, setSelectedFlightTrack] = useState<TrackWaypoint[] | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [timeRangeHours, setTimeRangeHours] = useState(12); // Default 12 hours history
  const [currentAirportId, setCurrentAirportId] = useState<AirportId>(DEFAULT_AIRPORT);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);

  const currentAirport = AIRPORTS[currentAirportId];

  // Reset data when airport changes
  const setCurrentAirport = useCallback((airportId: AirportId) => {
    console.log(`[FlightContext] Switching to airport: ${airportId}`);
    setFlights([]);
    setFlightTracks(new Map());
    setFlightRoutes(new Map()); // 清除航线缓存
    fetchedRoutesRef.current.clear(); // 重置已查询列表
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
    fetchTrack,
    // ADSB.LOL (无速率限制)
    fetchAircraftAdsbLol,
    fetchAllTracksAdsbLol,
    // HexDB.io 航线查询
    fetchRoutesByCallsigns,
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
      // 手动刷新：重新获取飞机位置数据
      // 到达/出发航班会自动从实时飞机数据推断
      console.log(`[FlightContext] Manual refresh for ${currentAirport.name}: fetching aircraft...`);

      // 优先使用 adsb.lol
      const adsbResponse = await fetchAircraftAdsbLol(
        currentAirport.latitude,
        currentAirport.longitude,
        Math.round(currentAirport.radiusKm * 0.54)
      );

      if (adsbResponse?.states && Array.isArray(adsbResponse.states)) {
        // adsb.lol returns objects directly, cast to unknown first
        const states = adsbResponse.states as unknown as Array<{
          icao24: string;
          callsign: string;
          latitude: number | null;
          longitude: number | null;
          baro_altitude: number | null;
          velocity: number | null;
          true_track: number | null;
          on_ground: boolean;
          origin_country: string;
        }>;
        const flightData = states
          .filter((state) => state.latitude !== null && state.longitude !== null)
          // 过滤掉地面上静止的飞机（速度<5m/s约18km/h），保留正在滑行或刚降落的
          .filter((state) => !state.on_ground || (state.velocity && state.velocity > 5))
          .map((state) => ({
            icao24: state.icao24,
            callsign: state.callsign?.trim() || null,
            latitude: state.latitude as number,
            longitude: state.longitude as number,
            altitude: state.baro_altitude,
            velocity: state.velocity,
            heading: state.true_track,
            onGround: state.on_ground,
            originCountry: state.origin_country,
            lastContact: Math.floor(Date.now() / 1000),
            departureAirport: null,
            arrivalAirport: null,
          }));
        setFlights(flightData);
        console.log(`[FlightContext] Manual refresh: ${flightData.length} aircraft from adsb.lol`);
      } else {
        // 回退到 OpenSky
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
          console.log(`[FlightContext] Manual refresh: ${flightData.length} aircraft from OpenSky`);
        } else {
          setFlights([]);
        }
      }

      setLastUpdate(new Date());
      console.log('[FlightContext] Manual refresh complete (arrivals/departures auto-inferred)');
    } catch (err) {
      console.error('[FlightContext] Failed to refresh flight data:', err);
    }
  }, [
    currentAirport,
    fetchAircraftAdsbLol,
    fetchStatesAroundAirport,
    parseStateArray,
    convertStateVectorToFlight,
  ]);

  // 页面可见性状态
  const [isPageVisible, setIsPageVisible] = useState(!document.hidden);

  // 监听页面可见性变化（后台暂停轮询，节省资源）
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsPageVisible(visible);
      console.log(`[FlightContext] Page visibility changed: ${visible ? 'visible' : 'hidden'}`);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // 使用 adsb.lol 获取飞机位置（无速率限制，支持自动刷新）
  useEffect(() => {
    const fetchStates = async () => {
      // 页面不可见时跳过请求
      if (document.hidden) {
        console.log('[FlightContext] Page hidden, skipping fetch');
        return;
      }

      try {
        console.log(`[FlightContext] Fetching aircraft from adsb.lol for ${currentAirport.name}...`);

        // 优先使用 adsb.lol（无速率限制）
        const adsbResponse = await fetchAircraftAdsbLol(
          currentAirport.latitude,
          currentAirport.longitude,
          Math.round(currentAirport.radiusKm * 0.54) // km to nautical miles
        );

        if (adsbResponse?.states && Array.isArray(adsbResponse.states)) {
          // adsb.lol 返回的是已经解析好的对象格式
          const states = adsbResponse.states as unknown as Array<{
            icao24: string;
            callsign: string;
            latitude: number | null;
            longitude: number | null;
            baro_altitude: number | null;
            velocity: number | null;
            true_track: number | null;
            on_ground: boolean;
            origin_country: string;
          }>;
          const flightData = states
            .filter((state) => state.latitude !== null && state.longitude !== null)
            // 过滤掉地面上静止的飞机（速度<5m/s约18km/h），保留正在滑行或刚降落的
            .filter((state) => !state.on_ground || (state.velocity && state.velocity > 5))
            .map((state) => ({
              icao24: state.icao24,
              callsign: state.callsign?.trim() || null,
              latitude: state.latitude as number,
              longitude: state.longitude as number,
              altitude: state.baro_altitude,
              velocity: state.velocity,
              heading: state.true_track,
              onGround: state.on_ground,
              originCountry: state.origin_country,
              lastContact: Math.floor(Date.now() / 1000),
              departureAirport: null,
              arrivalAirport: null,
            }));
          setFlights(flightData);
          console.log(`[FlightContext] adsb.lol: ${flightData.length} aircraft for ${currentAirport.name}`);
        } else {
          // 回退到 OpenSky
          console.log(`[FlightContext] adsb.lol failed, falling back to OpenSky...`);
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
            console.log(`[FlightContext] OpenSky: ${flightData.length} aircraft for ${currentAirport.name}`);
          } else {
            setFlights([]);
          }
        }

        setLastUpdate(new Date());
      } catch (err) {
        console.error('[FlightContext] Failed to fetch aircraft states:', err);
      }
    };

    fetchStates(); // 初始获取

    // 自动刷新（每10秒，页面可见时）
    const interval = setInterval(fetchStates, 10000);
    return () => clearInterval(interval);
  }, [currentAirport, fetchAircraftAdsbLol, fetchStatesAroundAirport, parseStateArray, convertStateVectorToFlight, isPageVisible]);

  // 从实时飞机数据推断到达/出发航班（替代被限流的OpenSky API）
  // 逻辑：
  // - 到达：下降中（垂直速率<0）或低空（<3000m）接近机场的飞机
  // - 出发：上升中（垂直速率>0）或刚起飞离开机场的飞机
  useEffect(() => {
    if (flights.length === 0) {
      setArrivals([]);
      setDepartures([]);
      return;
    }

    // 检查ICAO代码是否匹配当前机场（支持多机场如东京 RJTT/RJAA）
    const matchesAirport = (icao: string | null) => {
      if (!icao) return false;
      const airportIcaos = currentAirport.icao.split('/');
      return airportIcaos.includes(icao);
    };

    // 计算两点间距离（km）
    const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371; // 地球半径（km）
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const airportLat = currentAirport.latitude;
    const airportLon = currentAirport.longitude;
    const now = Math.floor(Date.now() / 1000);

    const inferredArrivals: FlightInfo[] = [];
    const inferredDepartures: FlightInfo[] = [];

    flights.forEach(flight => {
      if (!flight.callsign) return; // 跳过无呼号的航班

      const distance = getDistance(flight.latitude, flight.longitude, airportLat, airportLon);
      const altitude = flight.altitude || 0;
      const isOnGround = flight.onGround;

      // 获取航线信息
      const route = flightRoutes.get(flight.callsign);

      // 判断是到达还是出发
      // 使用机场配置的范围（radiusKm）
      const inRange = distance < currentAirport.radiusKm;

      // 到达条件（优先根据航线信息判断）：
      // 1. 航线目的地是当前机场（支持多机场如东京 RJTT/RJAA）
      // 2. 或者在范围内且高度较低（正在降落）
      const isArrival = matchesAirport(route?.destination || null) ||
        (inRange && !route && altitude < 5000);

      // 出发条件（优先根据航线信息判断）：
      // 1. 航线出发地是当前机场（支持多机场如东京 RJTT/RJAA）
      // 2. 或者在机场附近地面 或 刚起飞
      const isDeparture = matchesAirport(route?.origin || null) ||
        (distance < 20 && (isOnGround || altitude < 2000));

      // 创建FlightInfo对象
      const flightInfo: FlightInfo = {
        icao24: flight.icao24,
        callsign: flight.callsign,
        firstSeen: now - 3600, // 假设1小时前首次看到
        lastSeen: now,
        estDepartureAirport: route?.origin || null,
        estArrivalAirport: route?.destination || currentAirport.icao,
        estDepartureAirportHorizDistance: null,
        estDepartureAirportVertDistance: null,
        estArrivalAirportHorizDistance: Math.round(distance * 1000),
        estArrivalAirportVertDistance: altitude ? Math.round(altitude) : null,
        departureAirportCandidatesCount: 1,
        arrivalAirportCandidatesCount: 1,
      };

      // 根据航线信息和位置分类
      if (route) {
        // 有航线信息，优先使用（支持多机场如东京 RJTT/RJAA）
        if (matchesAirport(route.destination)) {
          inferredArrivals.push({
            ...flightInfo,
            estArrivalAirport: route.destination, // 保留实际机场代码
            estDepartureAirport: route.origin,
          });
        } else if (matchesAirport(route.origin)) {
          inferredDepartures.push({
            ...flightInfo,
            estDepartureAirport: route.origin, // 保留实际机场代码
            estArrivalAirport: route.destination,
          });
        } else if (inRange) {
          // 有航线但不经过当前机场，显示为到达（过境航班）
          inferredArrivals.push({
            ...flightInfo,
            estDepartureAirport: route.origin,
            estArrivalAirport: route.destination,
          });
        }
      } else if (inRange) {
        // 无航线信息，根据位置和状态推断
        if (isArrival) {
          inferredArrivals.push(flightInfo);
        } else if (isDeparture) {
          inferredDepartures.push({
            ...flightInfo,
            estDepartureAirport: currentAirport.icao,
          });
        } else {
          // 默认归类为到达（显示在列表中）
          inferredArrivals.push(flightInfo);
        }
      }
    });

    // 按距离排序（最近的在前）
    inferredArrivals.sort((a, b) =>
      (a.estArrivalAirportHorizDistance || 0) - (b.estArrivalAirportHorizDistance || 0)
    );
    inferredDepartures.sort((a, b) =>
      (a.estDepartureAirportHorizDistance || 0) - (b.estDepartureAirportHorizDistance || 0)
    );

    setArrivals(inferredArrivals);
    setDepartures(inferredDepartures);

    console.log(`[FlightContext] Inferred flights: ${inferredArrivals.length} arrivals, ${inferredDepartures.length} departures`);
  }, [flights, flightRoutes, currentAirport]);

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

  // 使用 adsb.lol 缓存的航迹（服务器自动收集）
  useEffect(() => {
    const fetchAllTracks = async () => {
      // 页面不可见或无飞机时跳过
      if (document.hidden || flights.length === 0) return;

      try {
        // 从服务器获取所有缓存的航迹
        const tracksData = await fetchAllTracksAdsbLol();

        if (tracksData?.tracks) {
          const newTracks = new Map<string, TrackWaypoint[]>();

          for (const [icao, points] of Object.entries(tracksData.tracks)) {
            if (points.length >= 2) {
              // 转换为 TrackWaypoint 格式
              const waypoints: TrackWaypoint[] = points.map((p: [number, number], i: number) => ({
                time: Math.floor(Date.now() / 1000) - (points.length - i) * 30,
                latitude: p[0],
                longitude: p[1],
                baro_altitude: null,
                true_track: 0,
                on_ground: false,
              }));
              newTracks.set(icao, waypoints);
            }
          }

          setFlightTracks(newTracks);
          console.log(`[FlightContext] adsb.lol tracks: ${newTracks.size} aircraft with trails`);
        }
      } catch (err) {
        console.warn('[FlightContext] Failed to fetch adsb.lol tracks:', err);
      }
    };

    // 每30秒更新航迹（降低频率，航迹数据变化慢）
    fetchAllTracks();
    const interval = setInterval(fetchAllTracks, 30000);
    return () => clearInterval(interval);
  }, [flights, fetchAllTracksAdsbLol, isPageVisible]);

  // 使用 HexDB.io 查询航线信息（包括实时飞机和航班列表）
  useEffect(() => {
    const fetchRoutes = async () => {
      // 收集所有需要查询的呼号（未查询过的）
      const callsignsToFetch: string[] = [];

      // 从实时飞机收集呼号
      flights.forEach(f => {
        if (f.callsign && !fetchedRoutesRef.current.has(f.callsign)) {
          callsignsToFetch.push(f.callsign);
        }
      });

      // 从到达航班收集呼号
      arrivals.forEach(f => {
        const cs = f.callsign?.trim();
        if (cs && !fetchedRoutesRef.current.has(cs)) {
          callsignsToFetch.push(cs);
        }
      });

      // 从出发航班收集呼号
      departures.forEach(f => {
        const cs = f.callsign?.trim();
        if (cs && !fetchedRoutesRef.current.has(cs)) {
          callsignsToFetch.push(cs);
        }
      });

      // 去重
      const uniqueCallsigns = [...new Set(callsignsToFetch)];
      if (uniqueCallsigns.length === 0) return;

      // 标记为已查询
      uniqueCallsigns.forEach(cs => fetchedRoutesRef.current.add(cs));

      try {
        console.log(`[FlightContext] Fetching routes for ${uniqueCallsigns.length} callsigns...`);
        const routes = await fetchRoutesByCallsigns(uniqueCallsigns);

        if (routes) {
          setFlightRoutes(prev => {
            const newMap = new Map(prev);
            Object.entries(routes).forEach(([cs, route]) => {
              if (route.origin || route.destination) {
                newMap.set(cs, route);
              }
            });
            console.log(`[FlightContext] Routes updated: ${newMap.size} total`);
            return newMap;
          });
        }
      } catch (err) {
        console.warn('[FlightContext] Failed to fetch routes:', err);
      }
    };

    // 延迟1秒后获取，避免与其他请求冲突
    const timeout = setTimeout(fetchRoutes, 1000);
    return () => clearTimeout(timeout);
  }, [flights, arrivals, departures, fetchRoutesByCallsigns]);

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
    flightRoutes,
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
