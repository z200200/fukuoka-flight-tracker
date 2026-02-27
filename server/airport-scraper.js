/**
 * 多机场航班时刻表爬虫
 * 支持: 福冈(FUK), 羽田(HND), 成田(NRT), 仁川(ICN)
 */

import { chromium } from 'playwright';

// ========== 机场配置 ==========
const AIRPORTS = {
	FUK: {
		name: '福冈',
		icao: 'RJFF',
		urls: {
			departures: 'https://www.fukuoka-airport.jp/flight/?depArv=D&intDom=D',
			arrivals: 'https://www.fukuoka-airport.jp/flight/?depArv=A&intDom=D',
			intDepartures: 'https://www.fukuoka-airport.jp/flight/?depArv=D&intDom=I',
			intArrivals: 'https://www.fukuoka-airport.jp/flight/?depArv=A&intDom=I',
		},
		locale: 'ja-JP',
		parser: 'fukuoka',
		status: 'active', // 完全支持
	},
	HND: {
		name: '羽田',
		icao: 'RJTT',
		urls: {
			// 羽田机场网站是SPA，需要复杂交互
			departures: 'https://tokyo-haneda.com/flight/flightInfo_dms.html',
			arrivals: 'https://tokyo-haneda.com/flight/flightInfo_dms.html',
			intDepartures: 'https://tokyo-haneda.com/flight/flightInfo_int.html',
			intArrivals: 'https://tokyo-haneda.com/flight/flightInfo_int.html',
		},
		locale: 'ja-JP',
		parser: 'haneda',
		status: 'experimental', // 实验性支持（SPA网站）
		requiresInteraction: true,
	},
	NRT: {
		name: '成田',
		icao: 'RJAA',
		urls: {
			departures: 'https://www.narita-airport.jp/jp/flight/today_dep',
			arrivals: 'https://www.narita-airport.jp/jp/flight/today_arr',
		},
		locale: 'ja-JP',
		parser: 'narita',
		status: 'experimental', // 实验性支持（网站响应慢）
	},
	ICN: {
		name: '仁川',
		icao: 'RKSI',
		urls: {
			departures: 'https://www.airport.kr/ap/en/flight/depPasSchList.do',
			arrivals: 'https://www.airport.kr/ap/en/flight/arrPasSchList.do',
		},
		locale: 'en-US',
		parser: 'incheon',
		status: 'experimental', // 实验性支持（页面重定向）
		requiresInteraction: true,
	},
};

// ========== 缓存 ==========
const flightCache = new Map(); // airportCode -> { data, lastUpdate }
const CACHE_TTL = 5 * 60 * 1000; // 5分钟

// ========== 浏览器管理 ==========
let browser = null;

async function getBrowser() {
	if (!browser || !browser.isConnected()) {
		console.log('[Scraper] 启动浏览器...');
		browser = await chromium.launch({
			headless: true,
			args: [
				'--no-sandbox',
				'--disable-setuid-sandbox',
				'--disable-dev-shm-usage',
				'--disable-gpu',
			]
		});
	}
	return browser;
}

export async function closeBrowser() {
	if (browser) {
		await browser.close();
		browser = null;
	}
}

// ========== 通用爬取函数 ==========
async function scrapePage(url, locale, parserType) {
	const b = await getBrowser();
	const context = await b.newContext({
		userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
		locale: locale,
		viewport: { width: 1920, height: 1080 },
	});
	const page = await context.newPage();

	try {
		console.log(`[Scraper] 访问: ${url}`);

		// 根据解析器类型选择不同的加载策略
		const timeout = parserType === 'narita' ? 60000 : 30000;
		const waitUntil = parserType === 'incheon' ? 'domcontentloaded' : 'networkidle';

		await page.goto(url, { waitUntil, timeout });

		// 特定机场的预处理
		await handleAirportSpecificSetup(page, parserType);

		await page.waitForTimeout(2000);

		let flights = [];

		switch (parserType) {
			case 'fukuoka':
				flights = await parseFukuoka(page);
				break;
			case 'haneda':
				flights = await parseHaneda(page);
				break;
			case 'narita':
				flights = await parseNarita(page);
				break;
			case 'incheon':
				flights = await parseIncheon(page);
				break;
			default:
				flights = await parseGeneric(page);
		}

		console.log(`[Scraper] 提取到 ${flights.length} 个航班`);
		await context.close();
		return flights;
	} catch (error) {
		console.error(`[Scraper] 错误: ${error.message}`);
		await context.close();
		return [];
	}
}

// ========== 机场特定预处理 ==========
async function handleAirportSpecificSetup(page, parserType) {
	switch (parserType) {
		case 'haneda':
			await handleHanedaCookieConsent(page);
			break;
		case 'narita':
			await handleNaritaPageSetup(page);
			break;
		case 'incheon':
			await handleIncheonPageSetup(page);
			break;
	}
}

// 羽田机场：处理Cookie同意弹窗并点击搜索
async function handleHanedaCookieConsent(page) {
	try {
		// 1. 关闭Cookie同意弹窗
		await page.waitForTimeout(2000);
		const cookieSelectors = [
			'button:has-text("OK")',
			'button:has-text("同意")',
			'button:has-text("Accept")',
			'#CybsotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
			'button.CybotCookiebotDialogBodyButton',
			'.cookie-accept',
			'#cookie-accept'
		];

		for (const selector of cookieSelectors) {
			try {
				const btn = await page.$(selector);
				if (btn && await btn.isVisible()) {
					await btn.click();
					console.log(`[Scraper] 羽田: 关闭Cookie弹窗 (${selector})`);
					await page.waitForTimeout(1500);
					break;
				}
			} catch (e) {
				// 继续尝试
			}
		}

		// 2. 点击搜索/查询按钮以加载航班数据
		const searchSelectors = [
			'button:has-text("検索")',
			'button:has-text("Search")',
			'button:has-text("表示")',
			'.flight-search__btn',
			'button[type="submit"]',
			'.btn-search',
			'#search-btn'
		];

		for (const selector of searchSelectors) {
			try {
				const btn = await page.$(selector);
				if (btn && await btn.isVisible()) {
					await btn.click();
					console.log(`[Scraper] 羽田: 点击搜索按钮 (${selector})`);
					await page.waitForTimeout(5000); // 增加等待时间
					break;
				}
			} catch (e) {
				// 继续尝试
			}
		}

		// 3. 等待航班数据加载 - 羽田使用动态加载
		try {
			// 等待搜索结果容器
			await page.waitForSelector('[class*="result"], [class*="flight-item"], table tbody tr', { timeout: 15000 });
			console.log('[Scraper] 羽田: 航班数据已加载');
		} catch (e) {
			console.log('[Scraper] 羽田: 等待航班数据超时，尝试提取页面数据');
		}

		// 4. 额外等待以确保数据渲染完成
		await page.waitForTimeout(2000);
	} catch (e) {
		console.log('[Scraper] 羽田: 预处理完成（部分）');
	}
}

// 成田机场：处理页面加载
async function handleNaritaPageSetup(page) {
	try {
		// 成田网站加载较慢，等待更长时间
		await page.waitForTimeout(5000);

		// 尝试关闭任何弹窗
		const closeSelectors = [
			'.close',
			'button:has-text("閉じる")',
			'button:has-text("Close")',
			'.modal-close'
		];

		for (const selector of closeSelectors) {
			try {
				const btn = await page.$(selector);
				if (btn && await btn.isVisible()) {
					await btn.click();
					console.log(`[Scraper] 成田: 关闭弹窗 (${selector})`);
					await page.waitForTimeout(500);
				}
			} catch (e) {
				// 继续
			}
		}

		// 等待航班表格加载
		await page.waitForSelector('table, .flight-list, [class*="flight"], [class*="schedule"]', { timeout: 15000 });
		console.log('[Scraper] 成田: 页面已加载');
	} catch (e) {
		console.log('[Scraper] 成田: 等待表格超时，尝试继续');
	}
}

// 仁川机场：处理页面加载和搜索
async function handleIncheonPageSetup(page) {
	try {
		// 等待页面完全加载
		await page.waitForTimeout(3000);

		// 1. 检查是否在intro页面，如果是则等待跳转
		const url = page.url();
		if (url.includes('intro') || !url.includes('flight')) {
			console.log('[Scraper] 仁川: 在intro页面，等待跳转...');
			await page.waitForTimeout(5000);
		}

		// 2. 尝试关闭弹窗
		const popupSelectors = [
			'.popup-close',
			'.modal-close',
			'button:has-text("Close")',
			'button:has-text("닫기")',
			'.btn-close'
		];

		for (const selector of popupSelectors) {
			try {
				const btn = await page.$(selector);
				if (btn && await btn.isVisible()) {
					await btn.click();
					console.log(`[Scraper] 仁川: 关闭弹窗 (${selector})`);
					await page.waitForTimeout(500);
				}
			} catch (e) {
				// 继续
			}
		}

		// 3. 点击搜索/查询按钮
		const searchSelectors = [
			'button:has-text("Search")',
			'button:has-text("검색")',
			'button:has-text("조회")',
			'.btn-search',
			'#btnSearch',
			'a.btn',
			'button.btn'
		];

		for (const selector of searchSelectors) {
			try {
				const btn = await page.$(selector);
				if (btn && await btn.isVisible()) {
					await btn.click();
					console.log(`[Scraper] 仁川: 点击搜索按钮 (${selector})`);
					await page.waitForTimeout(3000);
					break;
				}
			} catch (e) {
				// 继续尝试
			}
		}

		// 4. 等待航班数据加载
		try {
			await page.waitForSelector('table tbody tr, .flight-item, [class*="schedule"], [class*="list"]', { timeout: 10000 });
			console.log('[Scraper] 仁川: 航班数据已加载');
		} catch (e) {
			console.log('[Scraper] 仁川: 等待航班数据超时');
		}
	} catch (e) {
		console.log('[Scraper] 仁川: 页面设置完成（部分）:', e.message);
	}
}

// ========== 福冈机场解析器 ==========
async function parseFukuoka(page) {
	return await page.evaluate(() => {
		const flights = [];
		// 福冈机场：找到所有航班号，然后向上找父容器获取完整信息
		const codes = document.querySelectorAll('.flight-code');

		codes.forEach((codeEl) => {
			// 向上找包含时间的父容器
			let parent = codeEl.parentElement;
			for (let i = 0; i < 6 && parent; i++) {
				const timeEl = parent.querySelector('.flight-time');
				if (timeEl) {
					const timeText = timeEl.textContent?.trim() || '';
					// 时间格式: "10:0010:15" = 计划时间 + 实际时间
					const times = timeText.match(/(\d{1,2}:\d{2})/g) || [];
					const scheduledTime = times[0] || null;
					const actualTime = times[1] || null;

					const destination = parent.querySelector('.flight-destination')?.textContent?.trim();
					const status = parent.querySelector('.flight-status')?.textContent?.trim();
					const gate = parent.querySelector('.flight-gate')?.textContent?.trim();
					const terminal = parent.querySelector('.flight-terminal')?.textContent?.trim();
					const code = codeEl.textContent?.trim();

					flights.push({
						scheduledTime: scheduledTime,
						actualTime: actualTime,
						flightNumber: code?.match(/([A-Z]{2,3}\s?\d{1,4})/)?.[1]?.replace(/\s/g, '') || code,
						destination: destination,
						status: status,
						gate: gate,
						terminal: terminal,
					});
					break;
				}
				parent = parent.parentElement;
			}
		});

		// 去重（同一航班可能有共享航班号）
		const seen = new Set();
		return flights.filter((f) => {
			const key = `${f.scheduledTime}-${f.flightNumber}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	});
}

// ========== 羽田机场解析器 ==========
async function parseHaneda(page) {
	return await page.evaluate(() => {
		const flights = [];
		const seen = new Set();

		// 羽田机场使用表格结构
		// 尝试多种选择器
		const tables = document.querySelectorAll('table');

		tables.forEach((table) => {
			const rows = table.querySelectorAll('tbody tr, tr');
			rows.forEach((row) => {
				const cells = row.querySelectorAll('td, th');
				if (cells.length < 2) return;

				const text = row.textContent || '';

				// 提取时间（格式：HH:MM）
				const timeMatches = text.match(/(\d{1,2}:\d{2})/g) || [];
				const scheduledTime = timeMatches[0] || null;
				const actualTime = timeMatches[1] || null;

				// 提取航班号（格式：XX123 或 XXX1234）
				const flightMatches = text.match(/\b([A-Z]{2,3}\s?\d{1,4})\b/g) || [];
				const flightNumber = flightMatches[0]?.replace(/\s/g, '') || null;

				if (scheduledTime && flightNumber) {
					const key = `${scheduledTime}-${flightNumber}`;
					if (!seen.has(key)) {
						seen.add(key);

						// 尝试提取目的地/出发地
						let destination = null;
						cells.forEach((cell) => {
							const cellText = cell.textContent?.trim() || '';
							// 日文城市名或英文城市名
							if (cellText.length > 1 && cellText.length < 20 && !/\d{1,2}:\d{2}/.test(cellText) && !/^[A-Z]{2,3}\d/.test(cellText)) {
								if (!destination) destination = cellText;
							}
						});

						flights.push({
							scheduledTime,
							actualTime,
							flightNumber,
							destination,
							rawText: text.slice(0, 100).trim(),
						});
					}
				}
			});
		});

		// 如果表格方式没找到，尝试其他结构
		if (flights.length === 0) {
			const elements = document.querySelectorAll('[class*="flight"], [class*="schedule"], [class*="info"]');
			elements.forEach((el) => {
				const text = el.textContent || '';
				const timeMatch = text.match(/(\d{1,2}:\d{2})/);
				const flightMatch = text.match(/\b([A-Z]{2,3}\s?\d{1,4})\b/);

				if (timeMatch && flightMatch) {
					const key = `${timeMatch[1]}-${flightMatch[1]}`;
					if (!seen.has(key)) {
						seen.add(key);
						flights.push({
							scheduledTime: timeMatch[1],
							flightNumber: flightMatch[1].replace(/\s/g, ''),
							rawText: text.slice(0, 100).trim(),
						});
					}
				}
			});
		}

		return flights;
	});
}

// ========== 成田机场解析器 ==========
async function parseNarita(page) {
	return await page.evaluate(() => {
		const flights = [];
		const seen = new Set();

		// 成田机场使用表格结构
		const tables = document.querySelectorAll('table');

		tables.forEach((table) => {
			const rows = table.querySelectorAll('tbody tr, tr');
			rows.forEach((row) => {
				const cells = row.querySelectorAll('td');
				if (cells.length < 2) return;

				const text = row.textContent || '';

				// 提取时间
				const timeMatches = text.match(/(\d{1,2}:\d{2})/g) || [];
				const scheduledTime = timeMatches[0] || null;
				const actualTime = timeMatches[1] || null;

				// 提取航班号
				const flightMatches = text.match(/\b([A-Z]{2,3}\s?\d{1,4})\b/g) || [];
				const flightNumber = flightMatches[0]?.replace(/\s/g, '') || null;

				if (scheduledTime && flightNumber) {
					const key = `${scheduledTime}-${flightNumber}`;
					if (!seen.has(key)) {
						seen.add(key);

						// 提取目的地（通常在后面的单元格）
						let destination = null;
						for (let i = 0; i < cells.length; i++) {
							const cellText = cells[i].textContent?.trim() || '';
							// 查找看起来像城市名的文本
							if (cellText.length > 1 && cellText.length < 30 && !/\d{1,2}:\d{2}/.test(cellText) && !/^[A-Z]{2,3}\d/.test(cellText)) {
								// 跳过表头常见文字
								const skipWords = ['Time', 'Flight', 'Destination', 'Status', 'Gate', 'Terminal', '時間', '便名', '行先'];
								if (!skipWords.some((w) => cellText.includes(w))) {
									destination = cellText;
									break;
								}
							}
						}

						// 提取状态
						let status = null;
						const statusKeywords = ['On Time', 'Delayed', 'Cancelled', 'Boarding', 'Departed', 'Arrived', '定刻', '遅延', '欠航'];
						for (const keyword of statusKeywords) {
							if (text.includes(keyword)) {
								status = keyword;
								break;
							}
						}

						flights.push({
							scheduledTime,
							actualTime,
							flightNumber,
							destination,
							status,
							rawText: text.slice(0, 100).trim(),
						});
					}
				}
			});
		});

		// 备用：搜索整个页面
		if (flights.length === 0) {
			const bodyText = document.body.textContent || '';
			const timeMatches = bodyText.match(/\d{1,2}:\d{2}/g) || [];
			const flightMatches = bodyText.match(/\b[A-Z]{2,3}\s?\d{1,4}\b/g) || [];

			// 简单配对
			const count = Math.min(timeMatches.length, flightMatches.length, 20);
			for (let i = 0; i < count; i++) {
				const key = `${timeMatches[i]}-${flightMatches[i]}`;
				if (!seen.has(key)) {
					seen.add(key);
					flights.push({
						scheduledTime: timeMatches[i],
						flightNumber: flightMatches[i].replace(/\s/g, ''),
					});
				}
			}
		}

		return flights;
	});
}

// ========== 仁川机场解析器 ==========
async function parseIncheon(page) {
	return await page.evaluate(() => {
		const flights = [];
		const seen = new Set();

		// 仁川机场使用表格结构
		const tables = document.querySelectorAll('table');

		tables.forEach((table) => {
			const rows = table.querySelectorAll('tbody tr, tr');
			rows.forEach((row) => {
				const cells = row.querySelectorAll('td');
				if (cells.length < 2) return;

				const text = row.textContent || '';

				// 提取时间（格式：HH:MM 或 HHMM）
				let timeMatches = text.match(/(\d{1,2}:\d{2})/g) || [];
				if (timeMatches.length === 0) {
					// 尝试HHMM格式
					const hhmmMatch = text.match(/\b(\d{4})\b/g);
					if (hhmmMatch) {
						timeMatches = hhmmMatch
							.filter((t) => {
								const h = parseInt(t.slice(0, 2));
								const m = parseInt(t.slice(2, 4));
								return h >= 0 && h <= 23 && m >= 0 && m <= 59;
							})
							.map((t) => `${t.slice(0, 2)}:${t.slice(2, 4)}`);
					}
				}

				const scheduledTime = timeMatches[0] || null;
				const actualTime = timeMatches[1] || null;

				// 提取航班号
				const flightMatches = text.match(/\b([A-Z]{2,3}\s?\d{1,4})\b/g) || [];
				const flightNumber = flightMatches[0]?.replace(/\s/g, '') || null;

				if (scheduledTime && flightNumber) {
					const key = `${scheduledTime}-${flightNumber}`;
					if (!seen.has(key)) {
						seen.add(key);

						// 提取目的地
						let destination = null;
						for (let i = 0; i < cells.length; i++) {
							const cellText = cells[i].textContent?.trim() || '';
							// 英文或韩文城市名
							if (cellText.length > 1 && cellText.length < 30 && !/\d{1,2}:\d{2}/.test(cellText) && !/^[A-Z]{2,3}\d/.test(cellText) && !/^\d{4}$/.test(cellText)) {
								const skipWords = ['Time', 'Flight', 'Destination', 'Status', 'Gate', 'Terminal', '시간', '편명', '도착지', '출발지'];
								if (!skipWords.some((w) => cellText.includes(w))) {
									destination = cellText;
									break;
								}
							}
						}

						// 提取状态
						let status = null;
						const statusKeywords = ['On Time', 'Delayed', 'Cancelled', 'Boarding', 'Departed', 'Arrived', 'Gate Open', 'Final Call', '정시', '지연', '결항'];
						for (const keyword of statusKeywords) {
							if (text.includes(keyword)) {
								status = keyword;
								break;
							}
						}

						// 提取登机口
						const gateMatch = text.match(/(?:Gate\s*)?(\d{1,3}[A-Z]?)/i);
						const gate = gateMatch ? gateMatch[1] : null;

						flights.push({
							scheduledTime,
							actualTime,
							flightNumber,
							destination,
							status,
							gate,
							rawText: text.slice(0, 100).trim(),
						});
					}
				}
			});
		});

		// 备用方法：搜索列表元素
		if (flights.length === 0) {
			const listItems = document.querySelectorAll('[class*="flight"], [class*="schedule"], li, .item');
			listItems.forEach((item) => {
				const text = item.textContent || '';
				const timeMatch = text.match(/(\d{1,2}:\d{2})/);
				const flightMatch = text.match(/\b([A-Z]{2,3}\s?\d{1,4})\b/);

				if (timeMatch && flightMatch) {
					const key = `${timeMatch[1]}-${flightMatch[1]}`;
					if (!seen.has(key)) {
						seen.add(key);
						flights.push({
							scheduledTime: timeMatch[1],
							flightNumber: flightMatch[1].replace(/\s/g, ''),
							rawText: text.slice(0, 100).trim(),
						});
					}
				}
			});
		}

		return flights;
	});
}

// ========== 通用解析器 ==========
async function parseGeneric(page) {
	return await page.evaluate(() => {
		const flights = [];
		const elements = document.querySelectorAll('tr, [class*="flight"], [class*="item"]');

		elements.forEach((el) => {
			const text = el.textContent || '';
			const timeMatch = text.match(/(\d{1,2}:\d{2})/);
			const flightMatch = text.match(/\b([A-Z]{2,3}\s?\d{1,4})\b/);

			if (timeMatch || flightMatch) {
				flights.push({
					scheduledTime: timeMatch ? timeMatch[1] : null,
					flightNumber: flightMatch ? flightMatch[1].replace(/\s/g, '') : null,
					rawText: text.slice(0, 100).trim(),
				});
			}
		});

		return flights;
	});
}

// ========== 获取机场航班数据 ==========
export async function getAirportFlights(airportCode, forceRefresh = false) {
	const code = airportCode.toUpperCase();
	const airport = AIRPORTS[code];

	if (!airport) {
		console.error(`[Scraper] 未知机场: ${code}`);
		return null;
	}

	// 检查缓存
	const cached = flightCache.get(code);
	if (!forceRefresh && cached && Date.now() - cached.lastUpdate < CACHE_TTL) {
		console.log(`[Scraper] 使用 ${code} 缓存数据`);
		return cached.data;
	}

	console.log(`[Scraper] 刷新 ${airport.name} (${code}) 数据...`);

	const data = {
		airport: code,
		name: airport.name,
		icao: airport.icao,
		departures: [],
		arrivals: [],
		lastUpdate: Date.now(),
	};

	try {
		// 爬取出发航班
		if (airport.urls.departures) {
			const depDom = await scrapePage(airport.urls.departures, airport.locale, airport.parser);
			data.departures.push(...depDom.map((f) => ({ ...f, terminal: 'domestic' })));
		}
		if (airport.urls.intDepartures) {
			const depInt = await scrapePage(airport.urls.intDepartures, airport.locale, airport.parser);
			data.departures.push(...depInt.map((f) => ({ ...f, terminal: 'international' })));
		}

		// 爬取到达航班
		if (airport.urls.arrivals) {
			const arrDom = await scrapePage(airport.urls.arrivals, airport.locale, airport.parser);
			data.arrivals.push(...arrDom.map((f) => ({ ...f, terminal: 'domestic' })));
		}
		if (airport.urls.intArrivals) {
			const arrInt = await scrapePage(airport.urls.intArrivals, airport.locale, airport.parser);
			data.arrivals.push(...arrInt.map((f) => ({ ...f, terminal: 'international' })));
		}

		// 更新缓存
		flightCache.set(code, { data, lastUpdate: Date.now() });

		console.log(`[Scraper] ${code}: ${data.departures.length} 出发, ${data.arrivals.length} 到达`);
		return data;
	} catch (error) {
		console.error(`[Scraper] ${code} 爬取失败:`, error.message);
		return cached?.data || data;
	}
}

// ========== 获取所有机场数据 ==========
export async function getAllAirportsFlights(forceRefresh = false) {
	const results = {};

	for (const code of Object.keys(AIRPORTS)) {
		results[code] = await getAirportFlights(code, forceRefresh);
	}

	return results;
}

// ========== 匹配航班 ==========
export async function matchFlightAcrossAirports(callsign) {
	if (!callsign) return null;

	const searchKey = callsign.toUpperCase().replace(/\s/g, '');

	for (const code of Object.keys(AIRPORTS)) {
		const data = await getAirportFlights(code);
		if (!data) continue;

		const allFlights = [...data.departures, ...data.arrivals];

		for (const flight of allFlights) {
			if (flight.flightNumber) {
				const flightKey = flight.flightNumber.toUpperCase().replace(/\s/g, '');
				if (flightKey === searchKey || flightKey.includes(searchKey) || searchKey.includes(flightKey)) {
					return { ...flight, airport: code, airportName: data.name };
				}
			}
		}
	}

	return null;
}

// ========== 导出机场列表 ==========
export function getAirportList() {
	return Object.entries(AIRPORTS).map(([code, info]) => ({
		code,
		name: info.name,
		icao: info.icao,
		status: info.status || 'active',
	}));
}

// ========== 测试 ==========
async function test() {
	console.log('=== 多机场爬虫测试 ===\n');

	// 只测试福冈（快速测试）
	const fukuoka = await getAirportFlights('FUK', true);
	if (fukuoka) {
		console.log(`\n福冈出发航班 (${fukuoka.departures.length}):`);
		fukuoka.departures.slice(0, 3).forEach((f) => {
			console.log(`  ${f.scheduledTime || '??:??'} - ${f.flightNumber || '???'}`);
		});
	}

	await closeBrowser();
	console.log('\n✅ 测试完成');
}

if (process.argv[1] && process.argv[1].includes('airport-scraper.js')) {
	test().catch(console.error);
}
