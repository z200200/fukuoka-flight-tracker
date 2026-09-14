/**
 * 羽田机场官方数据源 —— 暂不可用（诚实占位，非猜测实现）
 *
 * 2026-09-14 实测：tokyo-haneda.com/app_resource/flight/flightStatus/flight_status.json
 * 返回的不是逐条航班列表，而是"地区/城市 延误·取消 计数汇总"（如 函館: 0延误0取消）。
 * 这不能提供航班号/时间/登机口，不满足我们需要的逐条航班数据结构。
 * 真正的逐条航班查询接口尚未定位（可能在 flightInfo_dms.html 的搜索交互后才触发），
 * 不在此基础上瞎拼解析器；继续返回 unavailable，由 index.js 兜底到 AeroDataBox。
 */

export async function getSchedule() {
  return { available: false, reason: 'no-per-flight-endpoint-found' };
}

export async function matchFlight() {
  return null;
}

export function getStatus() {
  return {
    sourceType: 'official-page-adapter',
    status: 'research-needed',
    note: '已找到的flight_status.json是区域计数汇总，非逐条航班数据；需要进一步定位真实航班列表接口',
  };
}
