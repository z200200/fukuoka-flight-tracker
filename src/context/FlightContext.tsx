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
  // 倒计时
  nextUpdateSeconds: number;   // 下次位置更新倒计时
  nextRescanSeconds: number;   // 下次重新扫描倒计时
  manualRescan: () => void;    // 手动重新扫描
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
    // 机场时刻表爬虫
    matchFlightsByCallsigns,
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
          .filter((state) => !state.on_ground) // 只显示空中的飞机
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

  // 已锁定的飞机 ICAO 列表（用于位置更新）
  const lockedIcaosRef = useRef<Set<string>>(new Set());
  const lastScanTimeRef = useRef<number>(Date.now());
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const RESCAN_INTERVAL = 2 * 60 * 1000; // 2分钟重新扫描
  const UPDATE_INTERVAL = 3 * 1000; // 3秒更新轨迹

  // 倒计时状态
  const [nextUpdateSeconds, setNextUpdateSeconds] = useState(3);
  const [nextRescanSeconds, setNextRescanSeconds] = useState(120);

  // 扫描飞机列表（初次加载或重新扫描时调用）
  const scanAircraft = useCallback(async () => {
    if (document.hidden) return;

    try {
      console.log(`[FlightContext] Scanning aircraft for ${currentAirport.name}...`);

      const adsbResponse = await fetchAircraftAdsbLol(
        currentAirport.latitude,
        currentAirport.longitude,
        Math.round(currentAirport.radiusKm * 0.54)
      );

      if (adsbResponse?.states && Array.isArray(adsbResponse.states)) {
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
          .filter((state) => !state.on_ground)
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

        if (flightData.length > 0) {
          // 锁定这批飞机的 ICAO
          lockedIcaosRef.current = new Set(flightData.map(f => f.icao24));
          lastScanTimeRef.current = Date.now();
          setFlights(flightData);
          console.log(`[FlightContext] Scanned & locked ${flightData.length} aircraft for ${currentAirport.name}`);
        }
      }
      setLastUpdate(new Date());
    } catch (err) {
      console.error('[FlightContext] Failed to scan aircraft:', err);
    }
  }, [currentAirport, fetchAircraftAdsbLol]);

  // 更新已锁定飞机的位置（不改变飞机数量）
  const updatePositions = useCallback(async () => {
    if (document.hidden || lockedIcaosRef.current.size === 0) return;

    try {
      const adsbResponse = await fetchAircraftAdsbLol(
        currentAirport.latitude,
        currentAirport.longitude,
        Math.round(currentAirport.radiusKm * 0.54)
      );

      if (adsbResponse?.states && Array.isArray(adsbResponse.states)) {
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

        // 只更新已锁定的飞机
        const newPositions = new Map<string, typeof states[0]>();
        states.forEach(s => {
          if (lockedIcaosRef.current.has(s.icao24)) {
            newPositions.set(s.icao24, s);
          }
        });

        setFlights(prev => {
          return prev.map(flight => {
            const updated = newPositions.get(flight.icao24);
            if (updated && updated.latitude !== null && updated.longitude !== null) {
              return {
                ...flight,
                latitude: updated.latitude,
                longitude: updated.longitude,
                altitude: updated.baro_altitude,
                velocity: updated.velocity,
                heading: updated.true_track,
                callsign: updated.callsign?.trim() || flight.callsign,
                lastContact: Math.floor(Date.now() / 1000),
              };
            }
            return flight; // 保留旧位置（飞机暂时没信号）
          });
        });

        console.log(`[FlightContext] Updated positions for ${newPositions.size}/${lockedIcaosRef.current.size} aircraft`);
      }
      setLastUpdate(new Date());
    } catch (err) {
      console.error('[FlightContext] Failed to update positions:', err);
    }
  }, [currentAirport, fetchAircraftAdsbLol]);

  // 初次加载：扫描飞机
  useEffect(() => {
    scanAircraft();
  }, [scanAircraft]);

  // 定时任务：飞机列表加载完成后才开始轨迹更新
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.hidden) return;

      // 飞机列表还没加载完成，不执行更新
      if (lockedIcaosRef.current.size === 0) {
        console.log('[FlightContext] Waiting for initial scan to complete...');
        return;
      }

      const now = Date.now();
      if (now - lastScanTimeRef.current >= RESCAN_INTERVAL) {
        // 每2分钟重新扫描
        scanAircraft();
        lastScanTimeRef.current = now;
        lastUpdateTimeRef.current = now;
      } else {
        // 每3秒更新位置
        updatePositions();
        lastUpdateTimeRef.current = now;
      }
    }, UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, [scanAircraft, updatePositions, isPageVisible]);

  // 倒计时更新（每秒）
  useEffect(() => {
    const countdownInterval = setInterval(() => {
      const now = Date.now();
      const updateElapsed = now - lastUpdateTimeRef.current;
      const scanElapsed = now - lastScanTimeRef.current;

      setNextUpdateSeconds(Math.max(0, Math.ceil((UPDATE_INTERVAL - updateElapsed) / 1000)));
      setNextRescanSeconds(Math.max(0, Math.ceil((RESCAN_INTERVAL - scanElapsed) / 1000)));
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, []);

  // 同步选中状态：当飞机列表刷新时，更新或清除选中的飞机
  useEffect(() => {
    if (!selectedFlight) return;

    // 在新的飞机列表中查找选中的飞机
    const updatedFlight = flights.find(f => f.icao24 === selectedFlight.icao24);

    if (updatedFlight) {
      // 飞机还在，更新位置等信息
      setSelectedFlight(updatedFlight);
    } else {
      // 飞机已不在范围内，清除选中状态
      console.log(`[FlightContext] Selected flight ${selectedFlight.icao24} no longer in range, clearing selection`);
      setSelectedFlight(null);
      setSelectedFlightTrack(null);
    }
  }, [flights]); // 只依赖 flights，不依赖 selectedFlight 避免循环

  // 从实时飞机数据推断到达/出发航班
  // 核心逻辑：每架飞机必须被分类，且只分类一次
  // 飞机总数 = 到港飞机 + 出港飞机
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
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    // 计算飞机是否朝向机场（基于航向）
    const isHeadingTowards = (flightLat: number, flightLon: number, heading: number | null, airportLat: number, airportLon: number) => {
      if (heading === null) return null; // 无法判断
      // 计算从飞机到机场的方位角
      const dLon = (airportLon - flightLon) * Math.PI / 180;
      const lat1 = flightLat * Math.PI / 180;
      const lat2 = airportLat * Math.PI / 180;
      const y = Math.sin(dLon) * Math.cos(lat2);
      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
      let bearing = Math.atan2(y, x) * 180 / Math.PI;
      bearing = (bearing + 360) % 360;
      // 计算航向与方位角的差值
      const diff = Math.abs(heading - bearing);
      const angleDiff = diff > 180 ? 360 - diff : diff;
      return angleDiff < 60; // 航向在机场方向±60度范围内视为朝向机场
    };

    // 获取最近的子机场坐标（用于东京等多机场区域）
    const getNearestAirportCoords = (lat: number, lon: number): { lat: number; lon: number } => {
      if (currentAirport.subAirports && currentAirport.subAirports.length > 0) {
        let nearestDist = Infinity;
        let nearest = { lat: currentAirport.latitude, lon: currentAirport.longitude };
        for (const sub of currentAirport.subAirports) {
          const dist = getDistance(lat, lon, sub.latitude, sub.longitude);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearest = { lat: sub.latitude, lon: sub.longitude };
          }
        }
        return nearest;
      }
      return { lat: currentAirport.latitude, lon: currentAirport.longitude };
    };

    const now = Math.floor(Date.now() / 1000);
    const inferredArrivals: FlightInfo[] = [];
    const inferredDepartures: FlightInfo[] = [];

    flights.forEach(flight => {
      // 获取最近的机场坐标
      const nearestAirport = getNearestAirportCoords(flight.latitude, flight.longitude);
      const distance = getDistance(flight.latitude, flight.longitude, nearestAirport.lat, nearestAirport.lon);
      const altitude = flight.altitude || 0;

      // 获取航线信息（如果有呼号）
      const route = flight.callsign ? flightRoutes.get(flight.callsign) : null;

      // 判断飞机方向
      const headingTowards = isHeadingTowards(
        flight.latitude, flight.longitude, flight.heading,
        nearestAirport.lat, nearestAirport.lon
      );

      // 创建FlightInfo对象
      // 使用飞机自身的lastContact作为时间戳，而不是统一的now
      const flightInfo: FlightInfo = {
        icao24: flight.icao24,
        callsign: flight.callsign || flight.icao24.toUpperCase(), // 无呼号用ICAO24代替
        firstSeen: flight.lastContact || now,
        lastSeen: flight.lastContact || now,
        estDepartureAirport: route?.origin || null,
        estArrivalAirport: route?.destination || currentAirport.icao,
        estDepartureAirportHorizDistance: Math.round(distance * 1000),
        estDepartureAirportVertDistance: altitude ? Math.round(altitude) : null,
        estArrivalAirportHorizDistance: Math.round(distance * 1000),
        estArrivalAirportVertDistance: altitude ? Math.round(altitude) : null,
        departureAirportCandidatesCount: 1,
        arrivalAirportCandidatesCount: 1,
      };

      // 分类逻辑（优先级从高到低，每架飞机只分类一次）
      let classified = false;

      // 1. 有航线信息时，优先根据航线判断
      if (route) {
        if (matchesAirport(route.destination)) {
          // 目的地是当前机场 -> 到达
          inferredArrivals.push({
            ...flightInfo,
            estArrivalAirport: route.destination,
            estDepartureAirport: route.origin,
          });
          classified = true;
        } else if (matchesAirport(route.origin)) {
          // 出发地是当前机场 -> 出发
          inferredDepartures.push({
            ...flightInfo,
            estDepartureAirport: route.origin,
            estArrivalAirport: route.destination,
          });
          classified = true;
        }
      }

      // 2. 无航线信息或航线不经过当前机场，根据飞行方向判断
      if (!classified) {
        // 朝向机场 -> 到达
        if (headingTowards === true) {
          inferredArrivals.push(flightInfo);
          classified = true;
        }
        // 背向机场 -> 出发
        else if (headingTowards === false) {
          inferredDepartures.push({
            ...flightInfo,
            estDepartureAirport: currentAirport.icao,
          });
          classified = true;
        }
      }

      // 3. 无法判断方向时，默认归类为到达
      if (!classified) {
        inferredArrivals.push(flightInfo);
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

    // 验证：到达+出发=总数
    const total = inferredArrivals.length + inferredDepartures.length;
    if (total !== flights.length) {
      console.warn(`[FlightContext] Classification mismatch: ${total} != ${flights.length}`);
    }
    console.log(`[FlightContext] Inferred flights: ${inferredArrivals.length} arrivals, ${inferredDepartures.length} departures (total: ${total}/${flights.length})`);
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

  // 轨迹配置
  const MAX_TRACK_POINTS = 30; // B: 每架飞机最多保留30个轨迹点

  // 使用 adsb.lol 缓存的航迹（服务器自动收集）
  useEffect(() => {
    const fetchAllTracks = async () => {
      // 页面不可见或飞机列表未加载完成时跳过
      if (document.hidden || lockedIcaosRef.current.size === 0) return;

      try {
        // 从服务器获取所有缓存的航迹
        const tracksData = await fetchAllTracksAdsbLol();

        if (tracksData?.tracks) {
          const newTracks = new Map<string, TrackWaypoint[]>();

          for (const [icao, points] of Object.entries(tracksData.tracks)) {
            if (points.length >= 2) {
              // B: 只保留最近 MAX_TRACK_POINTS 个点
              const limitedPoints = points.slice(-MAX_TRACK_POINTS);

              // 转换为 TrackWaypoint 格式
              const waypoints: TrackWaypoint[] = limitedPoints.map((p: [number, number], i: number) => ({
                time: Math.floor(Date.now() / 1000) - (limitedPoints.length - i) * 30,
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
          console.log(`[FlightContext] adsb.lol tracks: ${newTracks.size} aircraft with trails (max ${MAX_TRACK_POINTS} points each)`);
        }
      } catch (err) {
        console.warn('[FlightContext] Failed to fetch adsb.lol tracks:', err);
      }
    };

    // 每5秒更新航迹
    fetchAllTracks();
    const interval = setInterval(fetchAllTracks, 5000);
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

        // 1. 先从 HexDB.io 获取
        const routes = await fetchRoutesByCallsigns(uniqueCallsigns);
        const foundCallsigns = new Set<string>();

        if (routes) {
          setFlightRoutes(prev => {
            const newMap = new Map(prev);
            Object.entries(routes).forEach(([cs, route]) => {
              if (route.origin || route.destination) {
                newMap.set(cs, route);
                foundCallsigns.add(cs);
              }
            });
            return newMap;
          });
        }

        // 2. 对于 HexDB.io 没有数据的航班，使用机场爬虫
        const missingCallsigns = uniqueCallsigns.filter(cs => !foundCallsigns.has(cs));
        if (missingCallsigns.length > 0) {
          console.log(`[FlightContext] HexDB missing ${missingCallsigns.length} routes, trying airport scraper...`);
          const scraperResults = await matchFlightsByCallsigns(missingCallsigns);

          if (scraperResults && Object.keys(scraperResults).length > 0) {
            setFlightRoutes(prev => {
              const newMap = new Map(prev);
              Object.entries(scraperResults).forEach(([cs, flight]) => {
                if (flight) {
                  // 将爬虫数据转换为 RouteInfo 格式（包含计划时间）
                  newMap.set(cs, {
                    callsign: cs,
                    origin: flight.airport ? `RJ${flight.airport === 'FUK' ? 'FF' : flight.airport}` : null,
                    destination: flight.destination || null,
                    route: null,
                    scheduledTime: flight.scheduledTime || null,
                    actualTime: flight.actualTime || null,
                    status: flight.status || null,
                  });
                }
              });
              console.log(`[FlightContext] Routes updated with scraper: ${newMap.size} total`);
              return newMap;
            });
          }
        }

        console.log(`[FlightContext] Routes complete: HexDB=${foundCallsigns.size}, Scraper=${missingCallsigns.length}`);
      } catch (err) {
        console.warn('[FlightContext] Failed to fetch routes:', err);
      }
    };

    // 延迟1秒后获取，避免与其他请求冲突
    const timeout = setTimeout(fetchRoutes, 1000);
    return () => clearTimeout(timeout);
  }, [flights, arrivals, departures, fetchRoutesByCallsigns, matchFlightsByCallsigns]);

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
    nextUpdateSeconds,
    nextRescanSeconds,
    manualRescan: scanAircraft,
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
