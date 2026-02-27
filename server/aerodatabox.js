/**
 * AeroDataBox API 集成
 * 获取机场航班时刻表（替代 Playwright 爬虫）
 *
 * API 文档: https://rapidapi.com/aedbx-aedbx/api/aerodatabox
 */

import axios from 'axios';

// ========== 配置 ==========
const RAPIDAPI_HOST = 'aerodatabox.p.rapidapi.com';
const BASE_URL = `https://${RAPIDAPI_HOST}`;

// 缓存配置
const scheduleCache = new Map(); // airportCode -> { data, lastUpdate, userLastAccess }
const CACHE_TTL = 10 * 60 * 1000; // 10分钟缓存（节省API请求）
const MIN_REFRESH_INTERVAL = 5 * 60 * 1000; // 最小刷新间隔5分钟

// API 请求计数（用于监控）
let apiCallCount = 0;
let apiCallsThisMonth = 0;
const monthlyLimit = 500; // 免费版限制

// ========== 机场 ICAO 代码映射 ==========
const AIRPORT_ICAO = {
	FUK: 'RJFF',  // 福冈
	HND: 'RJTT',  // 羽田
	NRT: 'RJAA',  // 成田
	ICN: 'RKSI',  // 仁川
};

// ========== API 调用函数 ==========
async function callAeroDataBox(endpoint) {
	const apiKey = process.env.RAPIDAPI_KEY;

	if (!apiKey) {
		console.warn('[AeroDataBox] RAPIDAPI_KEY not configured');
		return null;
	}

	// 检查月度限制
	if (apiCallsThisMonth >= monthlyLimit) {
		console.warn(`[AeroDataBox] Monthly limit reached (${apiCallsThisMonth}/${monthlyLimit})`);
		return null;
	}

	try {
		console.log(`[AeroDataBox] Calling: ${endpoint}`);
		const response = await axios.get(`${BASE_URL}${endpoint}`, {
			headers: {
				'X-RapidAPI-Key': apiKey,
				'X-RapidAPI-Host': RAPIDAPI_HOST,
			},
			timeout: 15000,
		});

		apiCallCount++;
		apiCallsThisMonth++;
		console.log(`[AeroDataBox] Success. Total calls: ${apiCallCount}, This month: ${apiCallsThisMonth}`);

		return response.data;
	} catch (error) {
		console.error(`[AeroDataBox] Error: ${error.message}`);
		if (error.response) {
			console.error(`[AeroDataBox] Status: ${error.response.status}`);
			console.error(`[AeroDataBox] Data:`, error.response.data);
		}
		return null;
	}
}

// ========== 获取机场时刻表 ==========
export async function getAirportSchedule(airportCode, forceRefresh = false) {
	const icao = AIRPORT_ICAO[airportCode];
	if (!icao) {
		return { error: `Unknown airport: ${airportCode}` };
	}

	const now = Date.now();
	const cached = scheduleCache.get(airportCode);

	// 更新用户访问时间
	if (cached) {
		cached.userLastAccess = now;
	}

	// 检查缓存是否有效
	if (cached && !forceRefresh) {
		const cacheAge = now - cached.lastUpdate;
		if (cacheAge < CACHE_TTL) {
			console.log(`[AeroDataBox] Cache hit for ${airportCode} (age: ${Math.round(cacheAge/1000)}s)`);
			return cached.data;
		}

		// 缓存过期但未到刷新间隔，返回旧数据
		if (cacheAge < MIN_REFRESH_INTERVAL) {
			console.log(`[AeroDataBox] Cache stale but within refresh interval for ${airportCode}`);
			return cached.data;
		}
	}

	// 获取当前时间和12小时后的时间范围
	const fromTime = new Date();
	const toTime = new Date(fromTime.getTime() + 12 * 60 * 60 * 1000);

	// 格式化为本地时间字符串 (YYYY-MM-DDTHH:mm)
	const formatLocalTime = (date) => {
		const pad = (n) => n.toString().padStart(2, '0');
		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
	};

	const fromLocal = formatLocalTime(fromTime);
	const toLocal = formatLocalTime(toTime);

	// 获取航班数据（一次请求同时获取到达和出发）
	const flightData = await callAeroDataBox(
		`/flights/airports/icao/${icao}/${fromLocal}/${toLocal}?withCancelled=false&withCodeshared=true&withCargo=false&withPrivate=false`
	);

	// API 返回 { arrivals: [...], departures: [...] }
	const arrivals = flightData?.arrivals || [];
	const departures = flightData?.departures || [];

	// 转换数据格式
	const result = {
		airport: airportCode,
		icao: icao,
		arrivals: parseFlights(arrivals, 'arrival'),
		departures: parseFlights(departures, 'departure'),
		lastUpdate: now,
		source: 'AeroDataBox',
		apiCallsThisMonth: apiCallsThisMonth,
	};

	// 更新缓存
	scheduleCache.set(airportCode, {
		data: result,
		lastUpdate: now,
		userLastAccess: now,
	});

	return result;
}

// ========== 解析航班数据 ==========
function parseFlights(data, direction) {
	if (!data || !Array.isArray(data)) {
		return [];
	}

	return data.map(flight => {
		// AeroDataBox API 返回的数据结构
		// movement 包含到达/出发机场和时间信息
		const movement = flight.movement || {};
		const scheduledTime = movement.scheduledTime?.local;
		const actualTime = movement.actualTime?.local || movement.revisedTime?.local;
		const terminal = movement.terminal;
		const gate = movement.gate;

		// 获取航班状态
		let status = flight.status || null;

		// 对于到达航班，movement.airport 是出发机场
		// 对于出发航班，movement.airport 是目的机场
		const otherAirport = movement.airport || {};

		return {
			flightNumber: flight.number,
			callsign: flight.callSign || flight.number?.replace(/\s/g, ''),
			airline: flight.airline?.name || null,
			airlineCode: flight.airline?.iata || null,
			// 起点/终点
			origin: direction === 'arrival' ? {
				iata: otherAirport.iata,
				name: otherAirport.name,
			} : null,
			destination: direction === 'departure' ? {
				iata: otherAirport.iata,
				name: otherAirport.name,
			} : null,
			// 时间
			scheduledTime: scheduledTime ? formatDisplayTime(scheduledTime) : null,
			scheduledTimeRaw: scheduledTime,
			actualTime: actualTime ? formatDisplayTime(actualTime) : null,
			// 航站楼和登机口
			terminal: terminal,
			gate: gate,
			// 状态
			status: status,
			// 飞机信息
			aircraft: flight.aircraft?.model || null,
			registration: flight.aircraft?.reg || null,
		};
	}).filter(f => f.scheduledTime); // 只返回有时间的航班
}

// ========== 格式化显示时间 ==========
// 从本地时间字符串中提取 HH:MM（不做时区转换）
// 输入格式: "2026-02-27 15:40+09:00" 或 "2026-02-27T15:40:00+09:00"
function formatDisplayTime(localTimeString) {
	if (!localTimeString) return null;
	try {
		// 直接从字符串中提取时间部分（本地时间，不转换时区）
		// 匹配 HH:MM 格式
		const match = localTimeString.match(/(\d{2}):(\d{2})/);
		if (match) {
			return `${match[1]}:${match[2]}`;
		}
		return null;
	} catch {
		return null;
	}
}

// ========== 匹配航班（根据呼号查找时刻表信息）==========
export async function matchFlight(callsign, airports = ['FUK', 'HND', 'NRT', 'ICN']) {
	if (!callsign) return null;

	const cleanCallsign = callsign.trim().toUpperCase().replace(/\s/g, '');

	for (const airport of airports) {
		let cached = scheduleCache.get(airport);

		// 如果缓存为空或数据为空，获取时刻表
		const needsFetch = !cached ||
			(cached.data.arrivals.length === 0 && cached.data.departures.length === 0);

		if (needsFetch) {
			console.log(`[AeroDataBox] Cache miss or empty for ${airport}, fetching schedule...`);
			await getAirportSchedule(airport, true); // 强制刷新
			cached = scheduleCache.get(airport);
			if (!cached) continue;
		}

		const { arrivals, departures } = cached.data;

		// 在到达航班中查找
		const arrivalMatch = arrivals.find(f =>
			f.callsign === cleanCallsign ||
			f.flightNumber?.replace(/\s/g, '') === cleanCallsign
		);
		if (arrivalMatch) {
			return { ...arrivalMatch, direction: 'arrival', airport };
		}

		// 在出发航班中查找
		const departureMatch = departures.find(f =>
			f.callsign === cleanCallsign ||
			f.flightNumber?.replace(/\s/g, '') === cleanCallsign
		);
		if (departureMatch) {
			return { ...departureMatch, direction: 'departure', airport };
		}
	}

	return null;
}

// ========== 获取 API 使用统计 ==========
export function getApiStats() {
	return {
		totalCalls: apiCallCount,
		callsThisMonth: apiCallsThisMonth,
		monthlyLimit: monthlyLimit,
		remainingCalls: monthlyLimit - apiCallsThisMonth,
		cacheSize: scheduleCache.size,
	};
}

// ========== 重置月度计数（每月1号自动重置）==========
function checkMonthlyReset() {
	const now = new Date();
	if (now.getDate() === 1 && now.getHours() === 0) {
		console.log('[AeroDataBox] Monthly reset');
		apiCallsThisMonth = 0;
	}
}

// 每小时检查一次是否需要重置
setInterval(checkMonthlyReset, 60 * 60 * 1000);

// ========== 导出支持的机场列表 ==========
export function getSupportedAirports() {
	return Object.entries(AIRPORT_ICAO).map(([code, icao]) => ({
		code,
		icao,
		name: {
			FUK: '福冈',
			HND: '羽田',
			NRT: '成田',
			ICN: '仁川',
		}[code],
	}));
}
