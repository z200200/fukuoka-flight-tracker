/**
 * 大连机场官方数据源 —— 尚未调研（诚实占位）
 * 同上海：本轮未展开调研，明确返回 unavailable，兜底到 AeroDataBox。
 */

export async function getSchedule() {
  return { available: false, reason: 'not-researched-yet' };
}

export async function matchFlight() {
  return null;
}

export function getStatus() {
  return {
    sourceType: 'third-party',
    status: 'research-needed',
    note: '尚未调研大连机场官网是否有可用官方接口',
  };
}
