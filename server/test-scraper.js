/**
 * 测试机场爬虫 - 使用实际的爬虫模块
 */

import { getAirportFlights, closeBrowser, getAirportList } from './airport-scraper.js';

async function testScraper() {
	console.log('=== 机场爬虫测试 ===\n');

	// 显示支持的机场
	console.log('支持的机场:');
	getAirportList().forEach((a) => {
		console.log(`  ${a.code}: ${a.name} (${a.icao})`);
	});

	// 测试每个机场
	const airports = ['FUK', 'HND', 'NRT', 'ICN'];

	for (const code of airports) {
		console.log(`\n${'='.repeat(50)}`);
		console.log(`测试: ${code}`);
		console.log('='.repeat(50));

		try {
			const startTime = Date.now();
			const data = await getAirportFlights(code, true);
			const elapsed = Date.now() - startTime;

			if (data) {
				console.log(`\n✅ ${data.name} (${data.airport}) - ${elapsed}ms`);
				console.log(`   出发航班: ${data.departures.length}`);
				console.log(`   到达航班: ${data.arrivals.length}`);

				// 显示前3个出发航班
				if (data.departures.length > 0) {
					console.log('\n   出发航班样本:');
					data.departures.slice(0, 3).forEach((f, i) => {
						console.log(`   [${i + 1}] ${f.scheduledTime || '??:??'} ${f.flightNumber || '???'} → ${f.destination || '?'}`);
					});
				}

				// 显示前3个到达航班
				if (data.arrivals.length > 0) {
					console.log('\n   到达航班样本:');
					data.arrivals.slice(0, 3).forEach((f, i) => {
						console.log(`   [${i + 1}] ${f.scheduledTime || '??:??'} ${f.flightNumber || '???'} ← ${f.destination || '?'}`);
					});
				}
			} else {
				console.log(`\n❌ ${code}: 无数据`);
			}
		} catch (error) {
			console.error(`\n❌ ${code}: 错误 - ${error.message}`);
		}
	}

	// 关闭浏览器
	await closeBrowser();
	console.log('\n\n✅ 测试完成');
}

testScraper().catch(console.error);
