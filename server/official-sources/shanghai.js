/**
 * 上海机场（浦东PVG/虹桥SHA）官方数据源 —— 尚未调研（诚实占位）
 *
 * 按用户确认的优先级，中国机场排在最后，本轮未展开调研：
 * 境外访问中国机场官网的可靠性、是否有可用JSON接口均未知，且ToS风险判断需要更谨慎的调研。
 * 明确返回 unavailable，由 index.js 兜底到 AeroDataBox，不编造实现。
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
    note: '尚未调研上海机场集团官网是否有可用官方接口',
  };
}
