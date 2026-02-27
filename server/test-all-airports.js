/**
 * 测试所有机场爬虫
 */

import { chromium } from 'playwright';

const AIRPORTS = {
	HND: {
		name: '羽田',
		url: 'https://tokyo-haneda.com/flight/flightInfo_dms.html',
	},
	NRT: {
		name: '成田',
		url: 'https://www.narita-airport.jp/en/flight/dep-search/',
	},
	ICN: {
		name: '仁川',
		url: 'https://www.airport.kr/ap/en/flight/depPasSchList.do',
	},
};

async function testAirport(code, config) {
	console.log(`\n${'='.repeat(50)}`);
	console.log(`测试 ${config.name} (${code})`);
	console.log(`URL: ${config.url}`);
	console.log('='.repeat(50));

	const browser = await chromium.launch({ headless: true });
	const page = await browser.newPage();

	try {
		await page.goto(config.url, { waitUntil: 'networkidle', timeout: 30000 });
		await page.waitForTimeout(3000);

		// 分析页面结构
		const analysis = await page.evaluate(() => {
			const result = {
				title: document.title,
				tables: document.querySelectorAll('table').length,
				classes: {},
			};

			// 查找常见的航班相关类名
			const keywords = ['flight', 'time', 'schedule', 'depart', 'arrival', 'gate', 'status'];
			const allElements = document.querySelectorAll('*');

			allElements.forEach((el) => {
				const className = el.className;
				if (typeof className === 'string') {
					keywords.forEach((kw) => {
						if (className.toLowerCase().includes(kw)) {
							result.classes[className] = (result.classes[className] || 0) + 1;
						}
					});
				}
			});

			// 查找表格中的数据
			const rows = document.querySelectorAll('table tr, tbody tr');
			result.tableRows = rows.length;

			// 尝试提取示例数据
			const samples = [];
			rows.forEach((row, i) => {
				if (i > 0 && i < 5) {
					// 跳过表头，取前4行
					const text = row.textContent?.trim().slice(0, 150);
					if (text) samples.push(text);
				}
			});
			result.samples = samples;

			// 查找时间模式
			const bodyText = document.body.textContent || '';
			const times = bodyText.match(/\d{1,2}:\d{2}/g) || [];
			result.timeCount = times.length;
			result.timeSamples = times.slice(0, 5);

			// 查找航班号模式
			const flights = bodyText.match(/[A-Z]{2,3}\s?\d{1,4}/g) || [];
			result.flightCount = flights.length;
			result.flightSamples = [...new Set(flights)].slice(0, 5);

			return result;
		});

		console.log(`\n页面标题: ${analysis.title}`);
		console.log(`表格数量: ${analysis.tables}`);
		console.log(`表格行数: ${analysis.tableRows}`);
		console.log(`时间数量: ${analysis.timeCount}, 示例: ${analysis.timeSamples.join(', ')}`);
		console.log(`航班号数量: ${analysis.flightCount}, 示例: ${analysis.flightSamples.join(', ')}`);

		console.log(`\n相关CSS类:`);
		Object.entries(analysis.classes)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10)
			.forEach(([cls, count]) => {
				console.log(`  ${cls}: ${count}`);
			});

		console.log(`\n数据样本:`);
		analysis.samples.forEach((s, i) => {
			console.log(`  [${i}] ${s}`);
		});

		// 保存截图
		await page.screenshot({ path: `debug-${code}.png`, fullPage: false });
		console.log(`\n截图已保存: debug-${code}.png`);
	} catch (error) {
		console.error(`错误: ${error.message}`);
	} finally {
		await browser.close();
	}
}

async function main() {
	console.log('开始测试所有机场...\n');

	for (const [code, config] of Object.entries(AIRPORTS)) {
		await testAirport(code, config);
	}

	console.log('\n\n✅ 所有测试完成');
}

main().catch(console.error);
