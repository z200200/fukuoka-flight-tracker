/**
 * 上海机场（浦东PVG/虹桥SHA）官方数据源
 *
 * robots.txt 404（无限制）。真实接口用Playwright实测捕获，页面加载时就直接触发，
 * 不需要提交表单：
 * POST https://www.shanghaiairport.com/AvinexApi/OldFlightHandler.aspx
 * body(x-www-form-urlencoded): action=GetData&currentPage=1&pageSize=1000&flightType=1&
 *   direction=1|2(出发|到达)&airCities=&airCities2=&airCompanies=&timeDays=0&
 *   timeSpan=00:00-23:59&flightNum=
 * 必须带 Referer/Origin 头，否则403（服务端校验请求来源，不是无差别开放）。
 *
 * 关键发现：这一个接口同时覆盖浦东(PVG)和虹桥(SHA)两个机场（实测100条样本里两种
 * 出发地代号都有），不是"一机场一接口"，按 出发地代号/目的地代号 过滤即可拆分。
 * flightType=1是客运，flightType=2实测只返回3条货运航班（联邦快递等），不是机场选择器。
 *
 * 数据本身相当完整：出发地代号/目的地代号(真实IATA码)、候机楼、值机柜台、行李传送带、
 * 计划/实际/预计三套时间(出发+到达分别都有)。
 */
import axios from 'axios';

const BASE_URL = 'https://www.shanghaiairport.com/AvinexApi/OldFlightHandler.aspx';
const USER_AGENT = 'fukuoka-flight-tracker/1.0 (+https://fukuoka-flight-tracker.vercel.app; non-commercial personal project)';
const REFERER = 'https://www.shanghaiairport.com/flights/index.html';
const CACHE_TTL_MS = 60 * 1000;

let cache = null; // { fetchedAt, arrivals: [], departures: [] }（未按机场过滤的全量，PVG+SHA都在里面）

async function fetchDirection(direction) {
  const res = await axios.post(
    BASE_URL,
    new URLSearchParams({
      action: 'GetData',
      currentPage: 1,
      pageSize: 1000, // 实测总量约795-800条，一次拿全，不用分页循环
      flightType: 1, // 客运（2是货运，非机场选择器）
      direction,
      airCities: '', airCities2: '', airCompanies: '', timeDays: 0, timeSpan: '00:00-23:59', flightNum: '',
    }).toString(),
    {
      timeout: 20000,
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': REFERER,
        'Origin': 'https://www.shanghaiairport.com',
        'X-Requested-With': 'XMLHttpRequest',
      },
    }
  );
  const raw = res.data?.data?.flightList;
  if (!raw) return [];
  return JSON.parse(raw);
}

// "2026-09-14 06:04:00" → "06:04"；空字符串返回null
function extractHHMM(datetime) {
  if (!datetime) return null;
  const match = datetime.match(/(\d{2}):(\d{2}):\d{2}$/);
  return match ? `${match[1]}:${match[2]}` : null;
}

function toScheduledFlight(rec, direction) {
  if (!rec.主航班号) return null;

  const flightNumber = rec.主航班号.trim();
  let scheduledTime, actualTime, estimatedTime, airportCode, airportName;

  if (direction === 'departure') {
    scheduledTime = extractHHMM(rec.计划出发时间);
    actualTime = extractHHMM(rec.实际出发时间);
    estimatedTime = extractHHMM(rec.预计出发时间);
    airportCode = rec.目的地代号 || null;
    airportName = rec.目的地 || null;
  } else {
    scheduledTime = extractHHMM(rec.计划到达时间);
    actualTime = extractHHMM(rec.实际到达时间);
    estimatedTime = extractHHMM(rec.预计到达时间);
    airportCode = rec.出发地代号 || null;
    airportName = rec.出发地 || null;
  }
  if (!scheduledTime) return null;

  // 匹配航空公司代码前缀：2字母(MU)、1字母1数字(9C反过来是1数字1字母)、3字母，与项目里
  // convertIataToIcao()用的规则保持一致
  const airlineCodeMatch = flightNumber.toUpperCase().match(/^([A-Z]{2}|[A-Z]\d|\d[A-Z]|[A-Z]{3})\d+/);
  const airportInfo = airportCode ? { iata: airportCode, name: airportName || airportCode } : null;

  return {
    flightNumber,
    callsign: flightNumber,
    airline: rec.航空公司 || null,
    airlineCode: airlineCodeMatch ? airlineCodeMatch[1] : null,
    origin: direction === 'arrival' ? airportInfo : null,
    destination: direction === 'departure' ? airportInfo : null,
    scheduledTime,
    scheduledTimeRaw: scheduledTime,
    estimatedTime: estimatedTime || null,
    actualTime: actualTime || estimatedTime || null,
    terminal: rec.候机楼 || null,
    gate: rec.登机门状态 || null,
    checkinCounter: rec.值机柜台 || null,
    status: rec.状态 || null,
    remarks: rec.状态 || null,
    direction,
    // 服务端过滤用，不对外暴露到前端类型定义里，仅内部使用
    _airportCode: direction === 'departure' ? (rec.出发地代号 || null) : (rec.目的地代号 || null),
    dataSource: 'official-shanghai-airport',
    sourceLabel: '上海机场官方',
    sourceType: 'official',
    found: true,
  };
}

async function fetchAll(forceRefresh) {
  const now = Date.now();
  if (!forceRefresh && cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache;
  }

  const [depRaw, arrRaw] = await Promise.all([fetchDirection(1), fetchDirection(2)]);

  const departures = depRaw.map(r => toScheduledFlight(r, 'departure')).filter(Boolean);
  const arrivals = arrRaw.map(r => toScheduledFlight(r, 'arrival')).filter(Boolean);

  cache = { fetchedAt: now, arrivals, departures };
  return cache;
}

export async function getSchedule(forceRefresh = false, iataCode = 'PVG') {
  try {
    const { arrivals, departures, fetchedAt } = await fetchAll(forceRefresh);

    // 按机场代码过滤：一个接口覆盖PVG+SHA两个机场，这里拆分成调用方要的那一个，
    // 并去掉内部过滤用的_airportCode字段，不对外暴露
    const stripInternal = ({ _airportCode, ...rest }) => rest;
    const filteredArrivals = arrivals.filter(f => f._airportCode === iataCode).map(stripInternal);
    const filteredDepartures = departures.filter(f => f._airportCode === iataCode).map(stripInternal);

    return {
      available: true,
      data: {
        airport: iataCode,
        icao: iataCode === 'SHA' ? 'ZSSS' : 'ZSPD',
        name: iataCode === 'SHA' ? '虹桥' : '浦东',
        arrivals: filteredArrivals,
        departures: filteredDepartures,
        lastUpdate: fetchedAt,
        source: 'Shanghai Airport Official',
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
  const { arrivals, departures } = await fetchAll(false);
  const all = [...arrivals, ...departures];

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
    note: '一个接口同时覆盖PVG(浦东)+SHA(虹桥)，按出发地代号/目的地代号过滤拆分',
  };
}
