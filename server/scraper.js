/**
 * 福冈机场航班时刻表爬虫
 * 数据源: https://www.fukuoka-airport.jp/flight/
 */

import { chromium } from 'playwright';

// 缓存配置
let flightCache = {
	departures: [],
	arrivals: [],
	lastUpdate: null,
};
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

// 浏览器实例（复用）
let browserInstance = null;

/**
 * 获取或创建浏览器实例
 */
async function getBrowser() {
	if (!browserInstance || !browserInstance.isConnected()) {
		console.log('[Scraper] 启动浏览器...');
		browserInstance = await chromium.launch({
			headless: true,
		});
	}
	return browserInstance;
}

/**
 * 关闭浏览器实例
 */
export async function closeBrowser() {
	if (browserInstance) {
		await browserInstance.close();
		browserInstance = null;
	}
}

/**
 * 爬取航班数据
 * @param {string} type - 'departure' 或 'arrival'
 * @param {string} terminal - 'domestic' 或 'international'
 */
async function scrapeFlights(type = 'departure', terminal = 'domestic') {
	const browser = await getBrowser();
	const context = await browser.newContext({
		userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
		locale: 'ja-JP',
	});

	const page = await context.newPage();

	try {
		// 构建URL参数
		const depArv = type === 'departure' ? 'D' : 'A';
		const intDom = terminal === 'domestic' ? 'D' : 'I';

		const url = `https://www.fukuoka-airport.jp/flight/?depArv=${depArv}&intDom=${intDom}`;
		console.log(`[Scraper] 访问: ${url}`);

		await page.goto(url, {
			waitUntil: 'networkidle',
			timeout: 30000,
		});

		// 等待航班数据加载
		await page.waitForTimeout(2000);

		// 提取航班数据
		const flights = await page.evaluate(() => {
			const results = [];

			// 查找所有航班卡片
			const flightCards = document.querySelectorAll('[class*="flightInfo"], .flight-item, [class*="resultItem"]');

			flightCards.forEach((card) => {
				try {
					// 尝试多种选择器提取数据
					const timeEl = card.querySelector('[class*="time"], .scheduled-time, time');
					const flightNumEl = card.querySelector('[class*="flightNum"], [class*="flight-number"], .flight-num');
					const airlineEl = card.querySelector('[class*="airline"], .carrier');
					const destinationEl = card.querySelector('[class*="destination"], [class*="airport"], .dest');
					const statusEl = card.querySelector('[class*="status"], [class*="remark"]');
					const gateEl = card.querySelector('[class*="gate"]');

					// 获取文本内容
					const getText = (el) => el?.textContent?.trim() || null;

					const flight = {
						scheduledTime: getText(timeEl),
						flightNumber: getText(flightNumEl),
						airline: getText(airlineEl),
						destination: getText(destinationEl),
						status: getText(statusEl),
						gate: getText(gateEl),
						rawText: card.textContent?.trim().slice(0, 200),
					};

					// 只添加有航班号的数据
					if (flight.flightNumber || flight.scheduledTime) {
						results.push(flight);
					}
				} catch (e) {
					// 忽略单个卡片解析错误
				}
			});

			return results;
		});

		console.log(`[Scraper] 提取到 ${flights.length} 个航班 (${type}, ${terminal})`);

		await context.close();
		return flights;
	} catch (error) {
		console.error(`[Scraper] 错误: ${error.message}`);
		await context.close();
		return [];
	}
}

/**
 * 从原始文本解析航班数据
 * 备用方案：当结构化选择器失败时使用
 */
function parseFlightFromText(text) {
	if (!text) return null;

	// 尝试匹配航班号模式: ANA123, JAL456, JL123, NH456 等
	const flightNumMatch = text.match(/\b([A-Z]{2,3}\s*\d{1,4})\b/);
	// 尝试匹配时间模式: 09:00, 14:30 等
	const timeMatch = text.match(/\b(\d{1,2}:\d{2})\b/);

	if (flightNumMatch || timeMatch) {
		return {
			flightNumber: flightNumMatch ? flightNumMatch[1].replace(/\s/g, '') : null,
			scheduledTime: timeMatch ? timeMatch[1] : null,
			rawText: text.slice(0, 100),
		};
	}

	return null;
}

/**
 * 获取所有航班数据（带缓存）
 */
export async function getAllFlights(forceRefresh = false) {
	const now = Date.now();

	// 检查缓存是否有效
	if (!forceRefresh && flightCache.lastUpdate && now - flightCache.lastUpdate < CACHE_TTL) {
		console.log('[Scraper] 使用缓存数据');
		return flightCache;
	}

	console.log('[Scraper] 刷新航班数据...');

	try {
		// 并行获取国内线和国际线的出发/到达数据
		const [domDepartures, domArrivals, intDepartures, intArrivals] = await Promise.all([
			scrapeFlights('departure', 'domestic'),
			scrapeFlights('arrival', 'domestic'),
			scrapeFlights('departure', 'international'),
			scrapeFlights('arrival', 'international'),
		]);

		// 合并数据
		flightCache = {
			departures: [
				...domDepartures.map((f) => ({ ...f, terminal: 'domestic' })),
				...intDepartures.map((f) => ({ ...f, terminal: 'international' })),
			],
			arrivals: [
				...domArrivals.map((f) => ({ ...f, terminal: 'domestic' })),
				...intArrivals.map((f) => ({ ...f, terminal: 'international' })),
			],
			lastUpdate: now,
		};

		console.log(`[Scraper] 缓存已更新: ${flightCache.departures.length} 出发, ${flightCache.arrivals.length} 到达`);

		return flightCache;
	} catch (error) {
		console.error('[Scraper] 获取航班数据失败:', error.message);

		// 返回过期的缓存数据（如果有）
		if (flightCache.lastUpdate) {
			console.log('[Scraper] 返回过期缓存');
			return flightCache;
		}

		return { departures: [], arrivals: [], lastUpdate: null };
	}
}

/**
 * 根据航班号/呼号匹配航班信息
 * @param {string} callsign - 航班呼号 (如 ANA123, JAL456)
 */
export async function matchFlight(callsign) {
	if (!callsign) return null;

	const data = await getAllFlights();
	const searchKey = callsign.toUpperCase().replace(/\s/g, '');

	// 在出发和到达中搜索
	const allFlights = [...data.departures, ...data.arrivals];

	for (const flight of allFlights) {
		if (flight.flightNumber) {
			const flightKey = flight.flightNumber.toUpperCase().replace(/\s/g, '');
			if (flightKey === searchKey || flightKey.includes(searchKey) || searchKey.includes(flightKey)) {
				return flight;
			}
		}
	}

	return null;
}

/**
 * 批量匹配航班信息
 * @param {string[]} callsigns - 航班呼号数组
 */
export async function matchFlights(callsigns) {
	if (!callsigns || callsigns.length === 0) return {};

	const data = await getAllFlights();
	const allFlights = [...data.departures, ...data.arrivals];
	const results = {};

	for (const callsign of callsigns) {
		const searchKey = callsign.toUpperCase().replace(/\s/g, '');
		results[callsign] = null;

		for (const flight of allFlights) {
			if (flight.flightNumber) {
				const flightKey = flight.flightNumber.toUpperCase().replace(/\s/g, '');
				if (flightKey === searchKey || flightKey.includes(searchKey) || searchKey.includes(flightKey)) {
					results[callsign] = flight;
					break;
				}
			}
		}
	}

	return results;
}

// 测试函数
async function test() {
	console.log('=== 测试爬虫 ===\n');

	const data = await getAllFlights(true);

	console.log('\n=== 出发航班示例 ===');
	data.departures.slice(0, 5).forEach((f, i) => {
		console.log(`[${i + 1}] ${f.scheduledTime || '??:??'} - ${f.flightNumber || '???'} -> ${f.destination || '???'}`);
	});

	console.log('\n=== 到达航班示例 ===');
	data.arrivals.slice(0, 5).forEach((f, i) => {
		console.log(`[${i + 1}] ${f.scheduledTime || '??:??'} - ${f.flightNumber || '???'} <- ${f.destination || '???'}`);
	});

	// 测试匹配
	console.log('\n=== 测试匹配 ANA123 ===');
	const match = await matchFlight('ANA123');
	console.log(match || '未找到匹配');

	await closeBrowser();
}

// 如果直接运行此文件，执行测试
if (process.argv[1].includes('scraper.js')) {
	test().catch(console.error);
}
