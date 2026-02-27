import { chromium } from 'playwright';

async function debug() {
	const browser = await chromium.launch({ headless: true });
	const page = await browser.newPage();

	await page.goto('https://www.fukuoka-airport.jp/flight/?depArv=D&intDom=D', {
		waitUntil: 'networkidle',
		timeout: 30000,
	});
	await page.waitForTimeout(2000);

	// 调试：查找包含航班信息的父元素
	const debug = await page.evaluate(() => {
		// 先找航班号元素，然后往上找父容器
		const codes = document.querySelectorAll('.flight-code');
		const results = [];

		for (let i = 0; i < 3 && i < codes.length; i++) {
			const codeEl = codes[i];
			// 往上找几层父元素
			let parent = codeEl.parentElement;
			for (let j = 0; j < 5 && parent; j++) {
				const time = parent.querySelector('.flight-time');
				if (time) {
					results.push({
						parentClass: parent.className,
						parentHTML: parent.outerHTML.slice(0, 300),
						timeText: time.textContent?.trim(),
						codeText: codeEl.textContent?.trim(),
					});
					break;
				}
				parent = parent.parentElement;
			}
		}

		// 直接找 flight-time
		const times = document.querySelectorAll('.flight-time');
		const timeResults = [];
		for (let i = 0; i < 3 && i < times.length; i++) {
			timeResults.push(times[i].textContent?.trim());
		}

		return { results, timeResults, timeCount: times.length, codeCount: codes.length };
	});

	console.log('调试结果:');
	console.log('时间元素数量:', debug.timeCount);
	console.log('航班号元素数量:', debug.codeCount);
	console.log('\n前3个时间:', debug.timeResults);
	console.log('\n匹配结果:');
	debug.results.forEach((d, i) => {
		console.log(`[${i}] 时间:${d.timeText} 航班:${d.codeText} 父类:${d.parentClass}`);
	});

	await browser.close();
}

debug();
