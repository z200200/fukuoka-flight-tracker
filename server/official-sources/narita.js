/**
 * 成田机场官方数据源
 * 真实字段来自实测原始JSON（axios直取）：
 * https://www.narita-airport.jp/api/bff/searchFlight/?locale=en&domInter=I|D&flightDepArr=A|D&date=YYYY-MM-DD&page=0&size=N
 *
 * 分页语义未完全确认（page=0时 hasPrevPage/hasNextPage 均为true，疑似围绕"当前时间"的滚动窗口
 * 而非严格的从头分页）——本实现只取 page=0 大size(150)，覆盖当前时段附近的航班，
 * 不保证是全天完整列表；对我们UI（只展示当前时间前后~10条）已经足够，如实披露此限制。
 */
import axios from 'axios';

const BASE_URL = 'https://www.narita-airport.jp/api/bff/searchFlight/';
const USER_AGENT = 'fukuoka-flight-tracker/1.0 (+https://fukuoka-flight-tracker.vercel.app; non-commercial personal project)';
const CACHE_TTL_MS = 60 * 1000;
const PAGE_SIZE = 150;

let cache = null; // { fetchedAt, arrivals: [], departures: [] }

function todayDateStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// "BR0108" → "BR108"（去掉数字部分前导零，匹配ADS-B呼号习惯，供下游 convertIataToIcao 使用）
function normalizeFlightCode(code, letterCode) {
  if (!code) return null;
  const match = code.match(/^([A-Za-z]+)(\d+)$/);
  if (!match) return code;
  const prefix = letterCode || match[1];
  const num = String(parseInt(match[2], 10));
  return `${prefix}${num}`;
}

async function fetchDirection(domInter, flightDepArr) {
  const res = await axios.get(BASE_URL, {
    params: {
      locale: 'en',
      domInter,
      flightDepArr,
      date: todayDateStr(),
      page: 0,
      size: PAGE_SIZE,
    },
    timeout: 15000,
    headers: { 'User-Agent': USER_AGENT },
  });
  return res.data?.flights?.data || [];
}

function toScheduledFlight(rec, direction) {
  if (!rec.scheduledTime) return null;

  const flightNumber = normalizeFlightCode(rec.flightCode, rec.airline?.['2LetterCode']);
  const actualTime = rec.changeScheduledTime || null;
  const airport = rec.airport?.original
    ? { iata: rec.airport.original['3LetterCode'], name: rec.airport.original.name }
    : null;

  const gateRec = Array.isArray(rec.gate) ? rec.gate[0] : null;
  const gate = gateRec ? (gateRec.changeGateNo || gateRec.gateNo || null) : null;

  const counterList = rec.checkInCounterOrArrivalLobby?.changeNameOfCheckInOrArrival?.length
    ? rec.checkInCounterOrArrivalLobby.changeNameOfCheckInOrArrival
    : rec.checkInCounterOrArrivalLobby?.nameOfCheckInOrArrival;
  const checkinCounter = counterList?.[0]?.name || null;

  return {
    flightNumber,
    callsign: flightNumber,
    airline: rec.airline?.name || null,
    airlineCode: rec.airline?.['2LetterCode'] || rec.airline?.['3LetterCode'] || null,
    origin: direction === 'arrival' ? airport : null,
    destination: direction === 'departure' ? airport : null,
    scheduledTime: rec.scheduledTime,
    scheduledTimeRaw: rec.scheduledTime,
    estimatedTime: actualTime,
    actualTime,
    terminal: rec.displayTerminal || rec.terminalKey || null,
    gate,
    checkinCounter,
    status: rec.status?.status || null,
    remarks: rec.status?.status || null,
    direction,
    dataSource: 'official-narita-airport',
    sourceLabel: '成田机场官方',
    sourceType: 'official',
    found: true,
  };
}

async function fetchAll(forceRefresh) {
  const now = Date.now();
  if (!forceRefresh && cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache;
  }

  const [intlArr, intlDep, domArr, domDep] = await Promise.all([
    fetchDirection('I', 'A'),
    fetchDirection('I', 'D'),
    fetchDirection('D', 'A'),
    fetchDirection('D', 'D'),
  ]);

  const arrivals = [...intlArr, ...domArr].map(r => toScheduledFlight(r, 'arrival')).filter(Boolean);
  const departures = [...intlDep, ...domDep].map(r => toScheduledFlight(r, 'departure')).filter(Boolean);

  cache = { fetchedAt: now, arrivals, departures };
  return cache;
}

export async function getSchedule(forceRefresh = false) {
  try {
    const { arrivals, departures, fetchedAt } = await fetchAll(forceRefresh);
    return {
      available: true,
      data: {
        airport: 'NRT',
        icao: 'RJAA',
        name: '成田',
        arrivals,
        departures,
        lastUpdate: fetchedAt,
        source: 'Narita Airport Official',
        sourceUrl: BASE_URL,
        sourceType: 'official',
        cacheTtlMs: CACHE_TTL_MS,
      },
    };
  } catch (error) {
    return { available: false, reason: `fetch-failed: ${error.message}` };
  }
}

export async function matchFlight(callsign) {
  if (!callsign) return null;
  const clean = callsign.trim().toUpperCase().replace(/\s+/g, '');
  const result = await getSchedule(false);
  if (!result.available) return null;

  const all = [...result.data.arrivals, ...result.data.departures];
  return all.find(f => f.flightNumber?.toUpperCase() === clean) || null;
}

export function getStatus() {
  return {
    sourceType: 'official',
    status: 'enabled',
    sourceUrl: BASE_URL,
    lastFetchedAt: cache?.fetchedAt || null,
    cacheTtlMs: CACHE_TTL_MS,
    note: 'page=0窗口，可能非全天完整列表，但覆盖当前时段附近航班',
  };
}
