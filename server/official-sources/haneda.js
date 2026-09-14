/**
 * 羽田机场官方数据源
 *
 * 之前误以为 flight_status.json 是逐条航班数据，实测发现那只是"区域延误/取消计数汇总"。
 * 真正的逐条航班接口是航班搜索表单实际提交后触发的POST请求（通过Playwright实测捕获，
 * 非静态页面加载时的请求）：
 * POST https://tokyo-haneda.com/app/api/v2/flight/search
 * body: { flightType: 1|2(国内|国际), arrivalType: 1|2(出发|到达), searchDt: "YYYYMMDD",
 *         airportCodes: [], airlineCodes: [], flightNumber: "", status: [0] }
 * 实测：国内出发502条、国内到达503条、国际出发166条（数量级符合羽田作为世界最繁忙机场之一的真实体量）
 *
 * 已知限制：area_name 只有日语地名（如"沖縄（那覇）"），没有IATA机场代码，
 * 前端按iata查国家名会失效，但机场名本身仍会正常显示。
 */
import axios from 'axios';

const BASE_URL = 'https://tokyo-haneda.com/app/api/v2/flight/search';
const USER_AGENT = 'fukuoka-flight-tracker/1.0 (+https://fukuoka-flight-tracker.vercel.app; non-commercial personal project)';
const CACHE_TTL_MS = 60 * 1000;

let cache = null; // { fetchedAt, arrivals: [], departures: [] }

function todayDateKey() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

async function fetchDirection(flightType, arrivalType) {
  const res = await axios.post(
    BASE_URL,
    { flightType, arrivalType, searchDt: todayDateKey(), airportCodes: [], airlineCodes: [], flightNumber: '', status: [0] },
    { timeout: 15000, headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/json' } }
  );
  return res.data?.flightlists || [];
}

function extractGate(rec) {
  const gateOption = rec.options?.find(o => o.type === 'gate');
  return gateOption?.items?.[0]?.name || null;
}

function toScheduledFlight(rec, direction) {
  if (!rec.on_time) return null;

  const primary = rec.airlines?.[0];
  if (!primary?.flightNumber) return null;

  const flightNumber = primary.flightNumber.replace(/\s+/g, '');
  const hasChange = !!rec.change_time && rec.change_time !== rec.on_time;
  const airportInfo = rec.area_name ? { iata: null, name: rec.area_name } : null;

  return {
    flightNumber,
    callsign: flightNumber,
    airline: primary.airline || null,
    airlineCode: primary.airline || null,
    origin: direction === 'arrival' ? airportInfo : null,
    destination: direction === 'departure' ? airportInfo : null,
    scheduledTime: rec.on_time,
    scheduledTimeRaw: rec.on_time,
    estimatedTime: hasChange ? rec.change_time : null,
    actualTime: hasChange ? rec.change_time : null,
    terminal: rec.terminal?.terminal || null,
    gate: extractGate(rec),
    checkinCounter: null, // 羽田API的值机信息是设施描述文本(如"ANA 搭乗手続き")，不是简单柜台代码，暂不映射
    status: rec.status?.category ? rec.status.category.charAt(0).toUpperCase() + rec.status.category.slice(1) : null,
    remarks: rec.status?.text || null,
    direction,
    dataSource: 'official-haneda-airport',
    sourceLabel: '羽田机场官方',
    sourceType: 'official',
    found: true,
  };
}

async function fetchAll(forceRefresh) {
  const now = Date.now();
  if (!forceRefresh && cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache;
  }

  const [domDep, domArr, intlDep, intlArr] = await Promise.all([
    fetchDirection(1, 1),
    fetchDirection(1, 2),
    fetchDirection(2, 1),
    fetchDirection(2, 2),
  ]);

  const arrivals = [...domArr, ...intlArr].map(r => toScheduledFlight(r, 'arrival')).filter(Boolean);
  const departures = [...domDep, ...intlDep].map(r => toScheduledFlight(r, 'departure')).filter(Boolean);

  cache = { fetchedAt: now, arrivals, departures };
  return cache;
}

export async function getSchedule(forceRefresh = false) {
  try {
    const { arrivals, departures, fetchedAt } = await fetchAll(forceRefresh);
    return {
      available: true,
      data: {
        airport: 'HND',
        icao: 'RJTT',
        name: '羽田',
        arrivals,
        departures,
        lastUpdate: fetchedAt,
        source: 'Haneda Airport Official',
        sourceUrl: BASE_URL,
        sourceType: 'official',
        cacheTtlMs: CACHE_TTL_MS,
      },
    };
  } catch (error) {
    return { available: false, reason: `fetch-failed: ${error.message}` };
  }
}

function extractDigits(s) {
  const match = s?.match(/(\d+)$/);
  return match ? match[1].replace(/^0+/, '') || '0' : null;
}

export async function matchFlight(callsign) {
  if (!callsign) return null;
  const clean = callsign.trim().toUpperCase().replace(/\s+/g, '');
  const result = await getSchedule(false);
  if (!result.available) return null;

  const all = [...result.data.arrivals, ...result.data.departures];
  const exact = all.find(f => f.flightNumber?.toUpperCase() === clean);
  if (exact) return exact;

  const cleanDigits = extractDigits(clean);
  if (!cleanDigits) return null;
  return all.find(f => extractDigits(f.flightNumber) === cleanDigits) || null;
}

export function getStatus() {
  return {
    sourceType: 'official',
    status: 'enabled',
    sourceUrl: BASE_URL,
    lastFetchedAt: cache?.fetchedAt || null,
    cacheTtlMs: CACHE_TTL_MS,
    note: 'area_name只有日语地名无IATA代码，前端按iata查国家名会失效但机场名正常显示',
  };
}
