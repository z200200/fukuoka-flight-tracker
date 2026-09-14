/**
 * 福冈机场官方数据源
 * 真实字段来自实测原始JSON（axios直取，非WebFetch摘要）：
 * https://www.fukuoka-airport.jp/api/flight_schedule/flight_schedule.json
 *
 * 关键字段语义（2026-09-14 实测确认）：
 * - appointed_time: "HHMM" 无冒号格式的计划时间
 * - true_ymdhm: "YYYYMMDDHHMM" 已确认的实际时间（到着済み/出発済み时非空）
 * - estimated_ymdhm: "YYYYMMDDHHMM" 尚未确认时的预计/变更时间（可能为空字符串）
 * - remarks/remarks2: 日语/英语状态原文（如 "到着済み"/"Arrived"、"欠航"/"Cancelled"）
 * - airline_cd(ICAO三字码)/airline_2cd(IATA两字码)
 * - tofrom_cd/tofrom_name2: 对方机场IATA代码/英文名
 * - spot_num: 登机口, checkincounter_num: 值机柜台（到达航班通常为空）
 * - deparv_div: "A"=到达 "D"=出发
 */
import axios from 'axios';

const SOURCE_URL = 'https://www.fukuoka-airport.jp/api/flight_schedule/flight_schedule.json';
const USER_AGENT = 'fukuoka-flight-tracker/1.0 (+https://fukuoka-flight-tracker.vercel.app; non-commercial personal project)';
const CACHE_TTL_MS = 60 * 1000; // 60秒缓存，礼貌轮询，不对官网每次用户请求都发一次

let cache = null; // { fetchedAt, data: rawJsonObject }

function pad2(n) {
  return String(n).padStart(2, '0');
}

// "HHMM" → "HH:MM"；空/非法输入返回 null
function formatHHMM(hhmm) {
  if (!hhmm || hhmm.length !== 4) return null;
  const h = hhmm.slice(0, 2);
  const m = hhmm.slice(2, 4);
  return `${h}:${m}`;
}

// "YYYYMMDDHHMM" → "HH:MM"；空返回 null
function formatYmdhm(ymdhm) {
  if (!ymdhm || ymdhm.length !== 12) return null;
  const h = ymdhm.slice(8, 10);
  const m = ymdhm.slice(10, 12);
  return `${h}:${m}`;
}

async function fetchRaw(forceRefresh) {
  const now = Date.now();
  if (!forceRefresh && cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }
  const res = await axios.get(SOURCE_URL, {
    timeout: 15000,
    headers: { 'User-Agent': USER_AGENT },
  });
  cache = { fetchedAt: now, data: res.data };
  return res.data;
}

function toFlightNumber(rec) {
  const numPart = String(parseInt(rec.flt_num_no || '0', 10)); // 去掉前导零，匹配ADS-B呼号习惯
  const suffix = rec.flt_sfx || '';
  // 优先用IATA两字码（下游 convertIataToIcao 期望IATA格式输入）；没有则退化用ICAO三字码原样返回
  const code = rec.airline_2cd || rec.airline_cd || '';
  return `${code}${numPart}${suffix}`;
}

function toScheduledFlight(rec) {
  const scheduledTime = formatHHMM(rec.appointed_time);
  if (!scheduledTime) return null; // 没有计划时间的记录不可用，丢弃

  const actualTime = formatYmdhm(rec.true_ymdhm) || formatYmdhm(rec.estimated_ymdhm) || null;
  const direction = rec.deparv_div === 'A' ? 'arrival' : 'departure';
  const airportInfo = rec.tofrom_cd ? { iata: rec.tofrom_cd, name: rec.tofrom_name2 || rec.tofrom_name || rec.tofrom_cd } : null;

  return {
    flightNumber: toFlightNumber(rec),
    callsign: toFlightNumber(rec),
    airline: rec.airline_name2 || rec.airline_name || null,
    airlineCode: rec.airline_2cd || rec.airline_cd || null,
    origin: direction === 'arrival' ? airportInfo : null,
    destination: direction === 'departure' ? airportInfo : null,
    scheduledTime,
    scheduledTimeRaw: scheduledTime,
    estimatedTime: formatYmdhm(rec.estimated_ymdhm),
    actualTime,
    terminal: rec.ter_div || null,
    // 实测核对官方大屏发现字段映射反了：wicket_num才是登机口(如"81B")，
    // spot_num是飞机停机位编号，是完全不同的概念，两者经常不一致（如NH4937：spot_num=15，
    // 官方大屏实际显示的登机口是wicket_num=81B）。wicket_num为空时(部分到着航班)退回spot_num。
    gate: rec.wicket_num || rec.spot_num || null,
    checkinCounter: rec.checkincounter_num || null,
    status: rec.remarks2 || null, // 只用英文字段；不回退日语原文，避免非日语界面显示未翻译文本（红队发现）
    remarks: rec.remarks || null,
    direction,
    dataSource: 'official-fukuoka-airport',
    sourceLabel: '福冈机场官方',
    sourceType: 'official',
    found: true,
  };
}

export async function getSchedule(forceRefresh = false) {
  try {
    const raw = await fetchRaw(forceRefresh);
    const records = Object.values(raw);
    const arrivals = [];
    const departures = [];

    for (const rec of records) {
      const parsed = toScheduledFlight(rec);
      if (!parsed) continue;
      if (parsed.direction === 'arrival') arrivals.push(parsed);
      else departures.push(parsed);
    }

    return {
      available: true,
      data: {
        airport: 'FUK',
        icao: 'RJFF',
        name: '福冈',
        arrivals,
        departures,
        lastUpdate: cache?.fetchedAt || Date.now(),
        source: 'Fukuoka Airport Official',
        sourceUrl: SOURCE_URL,
        sourceType: 'official',
        cacheTtlMs: CACHE_TTL_MS,
      },
    };
  } catch (error) {
    return { available: false, reason: `fetch-failed: ${error.message}` };
  }
}

// 提取航班号里的纯数字部分，用于ICAO(如"AAR132")/IATA(如"OZ132")格式不一致时的兜底匹配
// （红队审查发现：ADS-B雷达callsign是ICAO格式，本模块flightNumber是IATA格式，精确匹配从不命中）
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
  const exact = all.find(f => f.flightNumber?.toUpperCase() === clean || f.callsign?.toUpperCase() === clean);
  if (exact) return exact;

  // 精确匹配失败（多数情况，因ICAO/IATA前缀不同）：退化为数字部分匹配
  const cleanDigits = extractDigits(clean);
  if (!cleanDigits) return null;
  const found = all.find(f => extractDigits(f.flightNumber) === cleanDigits);
  return found || null;
}

export function getStatus() {
  return {
    sourceType: 'official',
    status: 'enabled',
    sourceUrl: SOURCE_URL,
    lastFetchedAt: cache?.fetchedAt || null,
    cacheTtlMs: CACHE_TTL_MS,
  };
}
