import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useOpenSkyApi } from '../hooks/useOpenSkyApi';
import type { Flight, RateLimitInfo, TrackWaypoint } from '../types/flight';
import { AIRPORTS, DEFAULT_AIRPORT, type AirportId, type AirportConfig } from '../config/airports';
import type { RouteInfo, ScheduledFlight } from '../services/opensky';

// 航线信息类型
export type { RouteInfo, ScheduledFlight } from '../services/opensky';

// 规范化callsign格式（去掉空格，转大写）- 用于匹配flightRoutes
// OpenSky返回 "CES 586"，AeroDataBox返回 "CES586"，需要统一格式
function normalizeCallsign(callsign: string | null | undefined): string | null {
  if (!callsign) return null;
  return callsign.trim().replace(/\s+/g, '').toUpperCase();
}

interface MapBounds {
  lamin: number;
  lamax: number;
  lomin: number;
  lomax: number;
}

interface FlightContextType {
  flights: Flight[];                           // 雷达数据 - 用于地图显示飞机位置
  flightTracks: Map<string, TrackWaypoint[]>;
  flightRoutes: Map<string, RouteInfo>;
  arrivals: ScheduledFlight[];                 // 时刻表到达航班 - 固定列表
  departures: ScheduledFlight[];               // 时刻表出发航班 - 固定列表
  scheduledCallsigns: Set<string>;             // 时刻表中的航班callsign集合 - 用于地图颜色区分
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
  nextRescanSeconds: number;   // 下次重新扫描倒计时（-1表示不自动刷新）
  manualRescan: () => void;    // 手动重新扫描
}

const FlightContext = createContext<FlightContextType | undefined>(undefined);

interface FlightProviderProps {
  children: ReactNode;
}

export function FlightProvider({ children }: FlightProviderProps) {
  const [flights, setFlights] = useState<Flight[]>([]);  // 雷达数据 - 用于地图
  const [flightTracks, setFlightTracks] = useState<Map<string, TrackWaypoint[]>>(new Map());
  const [flightRoutes, setFlightRoutes] = useState<Map<string, RouteInfo>>(new Map());
  // 时刻表数据 - 固定列表，不会自动变化
  const [arrivals, setArrivals] = useState<ScheduledFlight[]>([]);
  const [departures, setDepartures] = useState<ScheduledFlight[]>([]);
  // 时刻表中的航班callsign集合 - 用于地图上区分颜色
  const [scheduledCallsigns, setScheduledCallsigns] = useState<Set<string>>(new Set());
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
    setScheduledCallsigns(new Set());
    setSelectedFlight(null);
    setSelectedFlightTrack(null);
    setLastUpdate(null);
    setCurrentAirportId(airportId);
  }, []);

  const {
    loading,
    error,
    rateLimitInfo,
    fetchTrack,
    // ADSB.LOL (无速率限制)
    fetchAircraftAdsbLol,
    fetchAllTracksAdsbLol,
    // HexDB.io 航线查询
    fetchRoutesByCallsigns,
    // 机场时刻表
    fetchAirportSchedule,
    matchFlightsByCallsigns,
  } = useOpenSkyApi();

  // Fetch flights within map bounds - 已禁用，不再使用 OpenSky API
  // 保留接口以保持类型兼容性
  const fetchFlightsInBounds = useCallback(async (_bounds: MapBounds) => {
    // 不再调用 OpenSky API，避免 429 限流错误
    console.log('[FlightContext] fetchFlightsInBounds is disabled to avoid API rate limits');
  }, []);

  const refreshData = useCallback(async () => {
    try {
      // 手动刷新：重新获取飞机位置数据
      // 到达/出发航班会自动从实时飞机数据推断
      console.log(`[FlightContext] Manual refresh for ${currentAirport.name}: fetching aircraft...`);

      // 优先使用 adsb.lol
      const adsbResponse = await fetchAircraftAdsbLol(
        currentAirport.latitude,
        currentAirport.longitude,
        Math.round(currentAirport.radiusKm * 1.2)
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
        // adsb.lol 没有数据
        console.log('[FlightContext] No data from adsb.lol');
        setFlights([]);
      }

      setLastUpdate(new Date());
    } catch (err) {
      console.error('[FlightContext] Failed to refresh flight data:', err);
    }
  }, [currentAirport, fetchAircraftAdsbLol]);

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
  // 移除重新扫描机制 - 航班列表只读取一次，像机场大屏一样
  // const RESCAN_INTERVAL = 2 * 60 * 1000; // 2分钟重新扫描
  const UPDATE_INTERVAL = 3 * 1000; // 3秒更新位置

  // 倒计时状态
  const [nextUpdateSeconds, setNextUpdateSeconds] = useState(3);
  // -1 表示不会自动重新扫描（航班列表固定）
  const [nextRescanSeconds] = useState(-1); // 移除 setter，航班列表不会自动刷新

  // 扫描飞机列表（初次加载或重新扫描时调用）
  // 始终使用机场固定半径，确保显示稳定
  const scanAircraft = useCallback(async () => {
    if (document.hidden) return;

    try {
      console.log(`[FlightContext] Scanning aircraft for ${currentAirport.name}...`);

      const adsbResponse = await fetchAircraftAdsbLol(
        currentAirport.latitude,
        currentAirport.longitude,
        Math.round(currentAirport.radiusKm * 1.2)
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
        Math.round(currentAirport.radiusKm * 1.2)
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

  // 定时任务：只更新飞机位置，不重新扫描航班列表
  // 航班列表像机场大屏一样保持稳定，不会突然增加或减少
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.hidden) return;

      // 飞机列表还没加载完成，不执行更新
      if (lockedIcaosRef.current.size === 0) {
        console.log('[FlightContext] Waiting for initial scan to complete...');
        return;
      }

      // 只更新位置，不重新扫描航班列表
      updatePositions();
      lastUpdateTimeRef.current = Date.now();
    }, UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, [updatePositions, isPageVisible]);

  // 倒计时更新（每秒）- 只显示位置更新倒计时
  useEffect(() => {
    const countdownInterval = setInterval(() => {
      const now = Date.now();
      const updateElapsed = now - lastUpdateTimeRef.current;

      setNextUpdateSeconds(Math.max(0, Math.ceil((UPDATE_INTERVAL - updateElapsed) / 1000)));
      // 不再重新扫描，所以不需要显示重新扫描倒计时
      // setNextRescanSeconds 保持不变或设为-1表示不会重新扫描
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

  // 从机场时刻表获取到达/出发航班
  // 时刻表数据是预先计划好的，不会像雷达数据那样频繁变化
  // 航班列表像机场大屏一样保持稳定
  useEffect(() => {
    const loadSchedule = async () => {
      try {
        // 对于多机场区域（如东京 HND+NRT），分别获取每个子机场的时刻表并合并
        const airportCodes: string[] = [];
        if (currentAirport.subAirports && currentAirport.subAirports.length > 0) {
          // 多机场区域：使用子机场的IATA代码
          currentAirport.subAirports.forEach(sub => airportCodes.push(sub.iata));
          console.log(`[FlightContext] Loading schedule for multi-airport: ${airportCodes.join(', ')}...`);
        } else {
          // 单机场：直接使用IATA代码
          airportCodes.push(currentAirport.iata);
          console.log(`[FlightContext] Loading schedule for ${currentAirport.iata}...`);
        }

        // 并行获取所有机场的时刻表
        const schedulePromises = airportCodes.map(code => fetchAirportSchedule(code));
        const schedules = await Promise.all(schedulePromises);

        // 合并所有时刻表数据
        const allArrivals: ScheduledFlight[] = [];
        const allDepartures: ScheduledFlight[] = [];

        schedules.forEach((schedule, index) => {
          if (schedule) {
            console.log(`[FlightContext] ${airportCodes[index]}: ${schedule.arrivals?.length || 0} arrivals, ${schedule.departures?.length || 0} departures`);
            if (schedule.arrivals) allArrivals.push(...schedule.arrivals);
            if (schedule.departures) allDepartures.push(...schedule.departures);
          }
        });

        if (allArrivals.length > 0 || allDepartures.length > 0) {
          // 按时间排序（合并后重新排序）
          allArrivals.sort((a, b) => {
            if (!a.scheduledTime || !b.scheduledTime) return 0;
            return a.scheduledTime.localeCompare(b.scheduledTime);
          });
          allDepartures.sort((a, b) => {
            if (!a.scheduledTime || !b.scheduledTime) return 0;
            return a.scheduledTime.localeCompare(b.scheduledTime);
          });

          setArrivals(allArrivals);
          setDepartures(allDepartures);

          // 创建时刻表中航班callsign的集合 - 用于地图颜色区分
          const callsigns = new Set<string>();
          allArrivals.forEach(f => {
            const normalized = normalizeCallsign(f.flightNumber);
            if (normalized) callsigns.add(normalized);
          });
          allDepartures.forEach(f => {
            const normalized = normalizeCallsign(f.flightNumber);
            if (normalized) callsigns.add(normalized);
          });
          setScheduledCallsigns(callsigns);

          console.log(`[FlightContext] Schedule loaded (merged): ${allArrivals.length} arrivals, ${allDepartures.length} departures, ${callsigns.size} scheduled callsigns`);
        } else {
          // 没有时刻表数据时，清空列表
          setArrivals([]);
          setDepartures([]);
          setScheduledCallsigns(new Set());
          console.log('[FlightContext] No schedule data available');
        }
      } catch (err) {
        console.error('[FlightContext] Failed to load schedule:', err);
        setArrivals([]);
        setDepartures([]);
        setScheduledCallsigns(new Set());
      }
    };

    loadSchedule();
  }, [currentAirportId, fetchAirportSchedule, currentAirport.iata, currentAirport.subAirports]);

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
    const interval = setInterval(fetchAllTracks, 15000); // 15秒更新一次航迹，减少请求频率
    return () => clearInterval(interval);
  }, [flights, fetchAllTracksAdsbLol, isPageVisible]);

  // 使用 HexDB.io 查询航线信息（包括实时飞机和航班列表）
  useEffect(() => {
    const fetchRoutes = async () => {
      // 收集所有需要查询的呼号（未查询过的）
      const callsignsToFetch: string[] = [];

      // 从实时飞机收集呼号
      // 收集呼号时使用规范化格式检查
      flights.forEach(f => {
        const normalized = normalizeCallsign(f.callsign);
        if (normalized && !fetchedRoutesRef.current.has(normalized)) {
          callsignsToFetch.push(f.callsign!); // 保留原始格式用于API请求
        }
      });

      // 从到达航班收集呼号（ScheduledFlight 使用 flightNumber）
      arrivals.forEach(f => {
        const normalized = normalizeCallsign(f.flightNumber);
        if (normalized && !fetchedRoutesRef.current.has(normalized)) {
          callsignsToFetch.push(f.flightNumber!);
        }
      });

      // 从出发航班收集呼号（ScheduledFlight 使用 flightNumber）
      departures.forEach(f => {
        const normalized = normalizeCallsign(f.flightNumber);
        if (normalized && !fetchedRoutesRef.current.has(normalized)) {
          callsignsToFetch.push(f.flightNumber!);
        }
      });

      // 去重
      const uniqueCallsigns = [...new Set(callsignsToFetch)];
      if (uniqueCallsigns.length === 0) return;

      // 标记为已查询（使用规范化格式）
      uniqueCallsigns.forEach(cs => {
        const normalized = normalizeCallsign(cs);
        if (normalized) fetchedRoutesRef.current.add(normalized);
      });

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
                // 使用规范化的callsign作为key，确保查找时能匹配
                const normalizedCs = normalizeCallsign(cs) || cs;
                newMap.set(normalizedCs, route);
                foundCallsigns.add(normalizedCs);
              }
            });
            return newMap;
          });
        }

        // 2. 对于 HexDB.io 没有数据的航班，使用机场爬虫
        // 注意：检查时也要用规范化的callsign
        const missingCallsigns = uniqueCallsigns.filter(cs => {
          const normalized = normalizeCallsign(cs) || cs;
          return !foundCallsigns.has(normalized);
        });
        if (missingCallsigns.length > 0) {
          console.log(`[FlightContext] HexDB missing ${missingCallsigns.length} routes, trying airport scraper...`);
          const scraperResults = await matchFlightsByCallsigns(missingCallsigns);

          if (scraperResults && Object.keys(scraperResults).length > 0) {
            setFlightRoutes(prev => {
              const newMap = new Map(prev);
              Object.entries(scraperResults).forEach(([cs, flight]) => {
                if (flight) {
                  // 提取 IATA 代码（AeroDataBox 返回的是对象 {iata, name}）
                  const originIata = typeof flight.origin === 'object' && flight.origin?.iata
                    ? flight.origin.iata
                    : (typeof flight.origin === 'string' ? flight.origin : null);
                  const destIata = typeof flight.destination === 'object' && flight.destination?.iata
                    ? flight.destination.iata
                    : (typeof flight.destination === 'string' ? flight.destination : null);

                  // 使用规范化的callsign作为key
                  const normalizedCs = normalizeCallsign(cs) || cs;
                  // 将时刻表数据转换为 RouteInfo 格式
                  newMap.set(normalizedCs, {
                    callsign: normalizedCs,
                    origin: originIata,
                    destination: destIata,
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
    scheduledCallsigns,
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
