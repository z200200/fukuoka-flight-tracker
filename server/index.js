import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
// AeroDataBox API (替代 Playwright 爬虫)
import { getAirportSchedule, matchFlight, getSupportedAirports, getApiStats } from './aerodatabox.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration - 更精确的域名匹配
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
    'http://localhost:5177',
    'https://fukuoka-flight-tracker.vercel.app',
    /^https:\/\/fukuoka-flight-tracker(-[a-z0-9]+)?\.vercel\.app$/
  ],
  credentials: true
}));

app.use(express.json());

// ========== 请求速率限制（简易实现）==========
const rateLimitStore = new Map(); // IP -> { count, resetTime }
const RATE_LIMIT_WINDOW = 60 * 1000; // 1分钟
const RATE_LIMIT_MAX = 300; // 每分钟最多300次请求（提高限制，adsb.lol 无速率限制）

function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();

  let record = rateLimitStore.get(ip);
  if (!record || now > record.resetTime) {
    record = { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
    rateLimitStore.set(ip, record);
  }

  record.count++;
  if (record.count > RATE_LIMIT_MAX) {
    console.warn(`[RateLimit] IP ${ip} exceeded limit (${record.count}/${RATE_LIMIT_MAX})`);
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil((record.resetTime - now) / 1000)
    });
  }

  next();
}

// 定期清理过期的速率限制记录
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(ip);
    }
  }
}, 60000);

// 应用速率限制到所有API路由
app.use('/api/', rateLimit);

// ========== 输入验证工具函数 ==========
function validateCoordinate(value, name, min, max) {
  const num = parseFloat(value);
  if (isNaN(num)) {
    return { valid: false, error: `${name} must be a number` };
  }
  if (num < min || num > max) {
    return { valid: false, error: `${name} must be between ${min} and ${max}` };
  }
  return { valid: true, value: num };
}

function validateIcao(icao) {
  if (!icao || typeof icao !== 'string') {
    return { valid: false, error: 'ICAO code is required' };
  }
  // ICAO24 应该是6位十六进制
  const clean = icao.toLowerCase().trim();
  if (!/^[0-9a-f]{6}$/.test(clean)) {
    return { valid: false, error: 'ICAO code must be 6 hexadecimal characters' };
  }
  return { valid: true, value: clean };
}

function validateCallsign(callsign) {
  if (!callsign || typeof callsign !== 'string') {
    return { valid: false, error: 'Callsign is required' };
  }
  const clean = callsign.trim().toUpperCase();
  // 呼号：2-8位字母数字
  if (!/^[A-Z0-9]{2,8}$/.test(clean)) {
    return { valid: false, error: 'Callsign must be 2-8 alphanumeric characters' };
  }
  return { valid: true, value: clean };
}

// Token cache
let cachedToken = null;
let tokenExpiry = 0;

// Check if credentials are configured
const hasCredentials = process.env.OPENSKY_CLIENT_ID &&
  process.env.OPENSKY_CLIENT_ID !== 'your_client_id_here' &&
  process.env.OPENSKY_CLIENT_SECRET &&
  process.env.OPENSKY_CLIENT_SECRET !== 'your_client_secret_here';

// Get OAuth2 token (only if credentials configured)
async function getToken() {
  if (!hasCredentials) {
    return null; // Use anonymous mode
  }

  if (cachedToken && Date.now() < tokenExpiry - 60000) {
    return cachedToken;
  }

  try {
    const response = await axios.post(
      'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token',
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.OPENSKY_CLIENT_ID,
        client_secret: process.env.OPENSKY_CLIENT_SECRET,
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    cachedToken = response.data.access_token;
    tokenExpiry = Date.now() + response.data.expires_in * 1000;

    console.log('✅ Token obtained successfully');
    return cachedToken;
  } catch (error) {
    console.error('❌ Failed to get token:', error.message);
    console.log('⚠️ Falling back to anonymous mode');
    return null;
  }
}

// Request counter for logging
let requestCount = 0;
let lastRequestTime = Date.now();

// ========== ADSB.LOL Integration ==========
// 航迹缓存：存储每架飞机的位置历史（最近30分钟）
const trackCache = new Map(); // icao24 -> [{time, lat, lon, alt, track}, ...]
const TRACK_MAX_AGE = 30 * 60 * 1000; // 30分钟
const TRACK_CLEANUP_INTERVAL = 60 * 1000; // 1分钟清理一次
const TRACK_CACHE_MAX_SIZE = 500; // 最多缓存500架飞机的航迹

// ========== HexDB.io Route Lookup ==========
// 航线缓存：存储呼号 -> 航线（有效期1小时）
const routeCache = new Map(); // callsign -> { origin, destination, route, fetchedAt }
const ROUTE_CACHE_MAX_AGE = 60 * 60 * 1000; // 1小时
const ROUTE_CACHE_MAX_SIZE = 2000; // 最多缓存2000条航线

// 缓存大小控制：删除最旧的条目
function enforceMaxCacheSize(cache, maxSize, getName = (k) => k) {
  if (cache.size <= maxSize) return;

  // 找出最旧的条目并删除
  const entriesToDelete = cache.size - maxSize;
  const keys = Array.from(cache.keys());
  for (let i = 0; i < entriesToDelete; i++) {
    console.log(`[Cache] Removing oldest entry: ${getName(keys[i])}`);
    cache.delete(keys[i]);
  }
}

// 定期清理过期数据
setInterval(() => {
  const now = Date.now();
  for (const [icao, points] of trackCache.entries()) {
    const filtered = points.filter(p => now - p.time < TRACK_MAX_AGE);
    if (filtered.length === 0) {
      trackCache.delete(icao);
    } else {
      trackCache.set(icao, filtered);
    }
  }
}, TRACK_CLEANUP_INTERVAL);

// 更新航迹缓存
function updateTrackCache(aircraft) {
  if (!aircraft || !Array.isArray(aircraft)) return;

  const now = Date.now();
  for (const ac of aircraft) {
    if (!ac.hex || ac.lat === undefined || ac.lon === undefined) continue;

    const icao = ac.hex.toLowerCase();
    const point = {
      time: now,
      lat: ac.lat,
      lon: ac.lon,
      alt: ac.alt_baro || ac.alt_geom || null,
      track: ac.track || null,
      gs: ac.gs || null,
    };

    if (!trackCache.has(icao)) {
      // 检查缓存大小限制
      enforceMaxCacheSize(trackCache, TRACK_CACHE_MAX_SIZE);
      trackCache.set(icao, []);
    }

    const points = trackCache.get(icao);
    // 避免重复点（5秒内同一位置）
    const lastPoint = points[points.length - 1];
    if (!lastPoint || now - lastPoint.time > 5000) {
      points.push(point);
    }
  }
}

// ADSB.LOL API 请求
async function fetchAdsbLol(lat, lon, dist) {
  try {
    const url = `https://api.adsb.lol/v2/point/${lat}/${lon}/${dist}`;
    console.log(`[ADSB.LOL] Fetching: ${url}`);

    const response = await axios.get(url, { timeout: 15000 });
    const aircraft = response.data.ac || [];

    // 更新航迹缓存
    updateTrackCache(aircraft);

    console.log(`[ADSB.LOL] Got ${aircraft.length} aircraft, cache has ${trackCache.size} tracks`);
    return aircraft;
  } catch (error) {
    console.error(`[ADSB.LOL] Error: ${error.message}`);
    return null;
  }
}

// Proxy API request helper
async function proxyRequest(req, res, endpoint) {
  requestCount++;
  const requestId = requestCount;
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  lastRequestTime = now;

  console.log(`[${new Date().toISOString()}] #${requestId} Request: ${endpoint} (${timeSinceLastRequest}ms since last)`);

  try {
    const token = await getToken();
    const headers = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await axios.get(`https://opensky-network.org/api${endpoint}`, {
      params: req.query,
      headers,
      timeout: 30000
    });

    // Forward rate limit headers
    const remaining = response.headers['x-rate-limit-remaining'];
    const retryAfter = response.headers['x-rate-limit-retry-after-seconds'];

    if (remaining) {
      res.setHeader('x-rate-limit-remaining', remaining);
      console.log(`[${new Date().toISOString()}] #${requestId} Success: ${endpoint} (remaining: ${remaining})`);
    } else {
      console.log(`[${new Date().toISOString()}] #${requestId} Success: ${endpoint}`);
    }

    if (retryAfter) {
      res.setHeader('x-rate-limit-retry-after-seconds', retryAfter);
    }

    res.json(response.data);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] #${requestId} ❌ Error for ${endpoint}: ${error.message}`);

    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['x-rate-limit-retry-after-seconds'] || 60;
      console.warn(`[${new Date().toISOString()}] #${requestId} ⚠️ Rate limited! Retry after: ${retryAfter}s`);
      res.status(429).json({
        error: 'Rate limited',
        retryAfter: retryAfter
      });
    } else if (error.response?.status === 404) {
      // OpenSky API returns 404 when no data available, return empty array
      console.log(`[${new Date().toISOString()}] #${requestId} ℹ️ No data available for ${endpoint}, returning empty array`);
      res.json([]);
    } else {
      res.status(error.response?.status || 500).json({
        error: error.message,
        details: error.response?.data
      });
    }
  }
}

// API endpoints
app.get('/api/states/all', (req, res) => proxyRequest(req, res, '/states/all'));

// Flights endpoints (require authentication)
app.get('/api/flights/arrival', async (req, res) => {
  if (!hasCredentials) {
    // Anonymous mode: return empty array (endpoint requires auth)
    return res.json([]);
  }
  proxyRequest(req, res, '/flights/arrival');
});

app.get('/api/flights/departure', async (req, res) => {
  if (!hasCredentials) {
    // Anonymous mode: return empty array (endpoint requires auth)
    return res.json([]);
  }
  proxyRequest(req, res, '/flights/departure');
});

app.get('/api/tracks', (req, res) => proxyRequest(req, res, '/tracks/all'));

// ========== ADSB.LOL Endpoints ==========

// 获取飞机位置（使用 adsb.lol，无速率限制）
app.get('/api/adsb/aircraft', async (req, res) => {
  const { lat, lon, dist } = req.query;

  // 输入验证
  const latResult = validateCoordinate(lat, 'lat', -90, 90);
  if (!latResult.valid) {
    return res.status(400).json({ error: latResult.error });
  }

  const lonResult = validateCoordinate(lon, 'lon', -180, 180);
  if (!lonResult.valid) {
    return res.status(400).json({ error: lonResult.error });
  }

  const distResult = validateCoordinate(dist || '100', 'dist', 1, 500);
  if (!distResult.valid) {
    return res.status(400).json({ error: distResult.error });
  }

  const aircraft = await fetchAdsbLol(latResult.value, lonResult.value, distResult.value);
  if (aircraft === null) {
    return res.status(500).json({ error: 'Failed to fetch from adsb.lol' });
  }

  // 转换为与 OpenSky 兼容的格式
  const states = aircraft.map(ac => ({
    icao24: ac.hex,
    callsign: ac.flight?.trim().replace(/\s+/g, '') || null,
    origin_country: ac.r ? getCountryFromReg(ac.r) : 'Unknown',
    latitude: ac.lat,
    longitude: ac.lon,
    baro_altitude: ac.alt_baro || ac.alt_geom || null,
    on_ground: ac.alt_baro === 'ground' || ac.alt_baro === 0,
    velocity: ac.gs ? ac.gs * 0.514444 : null, // knots to m/s
    true_track: ac.track || null,
    vertical_rate: ac.baro_rate ? ac.baro_rate * 0.00508 : null, // ft/min to m/s
    squawk: ac.squawk || null,
    aircraft_type: ac.t || null,
    registration: ac.r || null,
  }));

  res.json({ time: Math.floor(Date.now() / 1000), states });
});

// 获取缓存的航迹
app.get('/api/adsb/track/:icao', (req, res) => {
  const icaoResult = validateIcao(req.params.icao);
  if (!icaoResult.valid) {
    return res.status(400).json({ error: icaoResult.error });
  }
  const icao = icaoResult.value;
  const points = trackCache.get(icao) || [];

  // 转换为 OpenSky tracks 格式
  const path = points.map(p => [
    Math.floor(p.time / 1000),
    p.lat,
    p.lon,
    p.alt,
    p.track,
    false // on_ground
  ]);

  res.json({
    icao24: icao,
    callsign: null,
    path: path
  });
});

// 获取所有缓存的航迹（用于批量显示）
app.get('/api/adsb/tracks', (req, res) => {
  const tracks = {};
  for (const [icao, points] of trackCache.entries()) {
    if (points.length >= 2) { // 至少2个点才算航迹
      tracks[icao] = points.map(p => [p.lat, p.lon]);
    }
  }
  res.json({ tracks, count: Object.keys(tracks).length });
});

// ========== HexDB.io Route Lookup Endpoints ==========

// 从 hexdb.io 获取航线信息
async function fetchRoute(callsign) {
  if (!callsign || callsign.trim() === '') return null;

  const cleanCallsign = callsign.trim().toUpperCase();

  // 检查缓存
  const cached = routeCache.get(cleanCallsign);
  if (cached && Date.now() - cached.fetchedAt < ROUTE_CACHE_MAX_AGE) {
    return cached;
  }

  try {
    const url = `https://hexdb.io/api/v1/route/icao/${cleanCallsign}`;
    const response = await axios.get(url, { timeout: 5000 });

    if (response.data && response.data.route) {
      // 解析航线格式：RJTT-RJFF -> { origin: 'RJTT', destination: 'RJFF' }
      const parts = response.data.route.split('-');
      const routeData = {
        callsign: cleanCallsign,
        origin: parts[0] || null,
        destination: parts[1] || null,
        route: response.data.route,
        fetchedAt: Date.now(),
      };

      // 检查缓存大小限制
      enforceMaxCacheSize(routeCache, ROUTE_CACHE_MAX_SIZE, (k) => k);
      routeCache.set(cleanCallsign, routeData);
      console.log(`[HexDB] Route for ${cleanCallsign}: ${response.data.route}`);
      return routeData;
    }
  } catch (error) {
    // 缓存空结果避免重复请求
    enforceMaxCacheSize(routeCache, ROUTE_CACHE_MAX_SIZE, (k) => k);
    routeCache.set(cleanCallsign, { callsign: cleanCallsign, origin: null, destination: null, route: null, fetchedAt: Date.now() });
  }

  return null;
}

// 单个呼号查询
app.get('/api/route/:callsign', async (req, res) => {
  const csResult = validateCallsign(req.params.callsign);
  if (!csResult.valid) {
    return res.status(400).json({ error: csResult.error });
  }
  const route = await fetchRoute(csResult.value);
  res.json(route || { callsign: csResult.value, origin: null, destination: null, route: null });
});

// 批量呼号查询（限制最多50个）
app.get('/api/routes', async (req, res) => {
  const callsigns = req.query.callsigns;
  if (!callsigns) {
    return res.status(400).json({ error: 'callsigns parameter required' });
  }

  const callsignList = callsigns.split(',')
    .map(c => c.trim().toUpperCase())
    .filter(c => /^[A-Z0-9]{2,8}$/.test(c))
    .slice(0, 50); // 限制最多50个

  if (callsignList.length === 0) {
    return res.status(400).json({ error: 'No valid callsigns provided' });
  }

  const results = {};

  // 并发请求（最多10个同时）
  const batchSize = 10;
  for (let i = 0; i < callsignList.length; i += batchSize) {
    const batch = callsignList.slice(i, i + batchSize);
    const promises = batch.map(async (cs) => {
      const route = await fetchRoute(cs);
      results[cs] = route || { callsign: cs, origin: null, destination: null, route: null };
    });
    await Promise.all(promises);
  }

  res.json({ routes: results, count: Object.keys(results).length });
});

// 从注册号推断国家
function getCountryFromReg(reg) {
  if (!reg) return 'Unknown';
  const prefix = reg.substring(0, 2).toUpperCase();
  const countries = {
    'JA': 'Japan', 'HL': 'South Korea', 'B-': 'China/Taiwan',
    'N': 'United States', 'G-': 'United Kingdom', 'D-': 'Germany',
    'F-': 'France', 'VH': 'Australia', '9V': 'Singapore',
    'HS': 'Thailand', 'VN': 'Vietnam', 'RP': 'Philippines',
    'A6': 'UAE', 'A7': 'Qatar', 'A4': 'Oman',
  };
  return countries[prefix] || countries[reg[0]] || 'Unknown';
}

// ========== 航班时刻表 API (AeroDataBox) ==========

// API状态和统计
app.get('/api/schedule/debug', (req, res) => {
  const stats = getApiStats();
  res.json({
    ...stats,
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    dataSource: 'AeroDataBox',
    env: {
      RENDER: process.env.RENDER || 'false',
      RAPIDAPI_KEY_SET: !!process.env.RAPIDAPI_KEY
    }
  });
});

// 获取支持的机场列表
app.get('/api/schedule/airports', (req, res) => {
  res.json(getSupportedAirports());
});

// 获取指定机场的航班时刻表
app.get('/api/schedule/:airport', async (req, res) => {
  const airport = req.params.airport.toUpperCase();
  const forceRefresh = req.query.refresh === 'true';

  try {
    const data = await getAirportSchedule(airport, forceRefresh);
    if (data.error) {
      return res.status(404).json({ error: data.error });
    }
    res.json(data);
  } catch (error) {
    console.error(`[Schedule API] Error for ${airport}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// 匹配航班号（跨所有机场搜索）
app.get('/api/schedule/match/:callsign', async (req, res) => {
  const callsign = req.params.callsign;

  try {
    const match = await matchFlight(callsign);
    res.json(match || { callsign, found: false });
  } catch (error) {
    console.error(`[Schedule API] Match error:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// 批量匹配航班号
app.post('/api/schedule/match', express.json(), async (req, res) => {
  const { callsigns } = req.body;

  if (!callsigns || !Array.isArray(callsigns)) {
    return res.status(400).json({ error: 'callsigns array required' });
  }

  const results = {};
  for (const cs of callsigns.slice(0, 50)) { // 限制50个
    results[cs] = await matchFlight(cs);
  }

  res.json({ matches: results, count: Object.keys(results).length });
});

// Health check（包含缓存统计）
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    tokenCached: !!cachedToken,
    timestamp: new Date().toISOString(),
    cache: {
      trackCache: {
        size: trackCache.size,
        maxSize: TRACK_CACHE_MAX_SIZE
      },
      routeCache: {
        size: routeCache.size,
        maxSize: ROUTE_CACHE_MAX_SIZE
      },
      rateLimitStore: {
        size: rateLimitStore.size
      }
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy server running on http://localhost:${PORT}`);
  console.log(`📡 Proxying OpenSky Network API requests`);
  console.log(`🛫 Airport schedule API enabled (AeroDataBox)`);
  console.log(`   Supported airports: FUK, HND, NRT, ICN`);
  if (process.env.RAPIDAPI_KEY) {
    console.log(`🔑 AeroDataBox API key configured`);
  } else {
    console.warn(`⚠️  RAPIDAPI_KEY not set - schedule API will not work`);
  }
  if (hasCredentials) {
    console.log(`🔐 OpenSky Mode: Authenticated (higher rate limits)`);
  } else {
    console.log(`🔓 OpenSky Mode: Anonymous (limited to ~100 requests/day)`);
    console.log(`💡 To get higher limits, register at https://opensky-network.org/`);
  }

  // ========== Render 保活机制 ==========
  // 每14分钟自我 ping，防止 Render 免费版休眠
  const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
  if (RENDER_URL) {
    const KEEPALIVE_INTERVAL = 14 * 60 * 1000; // 14分钟
    console.log(`🔄 Keepalive enabled: will ping ${RENDER_URL}/health every 14 minutes`);

    setInterval(async () => {
      try {
        const response = await axios.get(`${RENDER_URL}/health`, { timeout: 10000 });
        console.log(`[Keepalive] Ping successful: ${response.data.status}`);
      } catch (error) {
        console.warn(`[Keepalive] Ping failed:`, error.message);
      }
    }, KEEPALIVE_INTERVAL);
  }
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});
