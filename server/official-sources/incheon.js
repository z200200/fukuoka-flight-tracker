/**
 * 仁川机场官方数据源 —— 需要韩国公共数据门户 API Key（诚实占位）
 *
 * 仁川机场官网 robots.txt 明确写了 `Disallow: /`（白名单策略，只放行几个语言目录+FAQ），
 * 直接抓官网不合适。正确路径是韩国公共数据门户(data.go.kr)的仁川机场航班运行信息 OpenAPI，
 * 需要用户自行注册获取 KOREA_DATA_API_KEY 后才能启用 —— 这是外部依赖，不是代码能补的缺口。
 * 未配置 key 时明确返回 unavailable，绝不假装官方数据。
 */

const API_KEY_ENV = 'KOREA_DATA_API_KEY';

export async function getSchedule() {
  const apiKey = process.env[API_KEY_ENV];
  if (!apiKey) {
    return { available: false, reason: `missing-${API_KEY_ENV}` };
  }
  // TODO: apiKey 到位后，对接 data.go.kr 仁川机场航班运行信息 OpenAPI 并实现真实解析。
  // 目前尚未实现实际请求逻辑（没有key无法验证真实响应结构，不做未验证的猜测实现）。
  return { available: false, reason: 'provider-not-implemented-yet' };
}

export async function matchFlight() {
  return null;
}

export function getStatus() {
  const hasKey = !!process.env[API_KEY_ENV];
  return {
    sourceType: 'official-api',
    status: hasKey ? 'key-configured-but-not-implemented' : 'needs-api-key',
    requiredEnvVar: API_KEY_ENV,
    note: '仁川官网robots.txt为白名单策略(Disallow: /)，不直接抓取官网，改走data.go.kr公共数据门户',
  };
}
