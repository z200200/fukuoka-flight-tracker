/**
 * 大连机场官方数据源 —— 已调研，确认真实技术障碍，暂不可行（诚实占位）
 *
 * 2026-09-14 实测：官网 www.dlairport.com 的服务器TLS配置极老旧
 * (触发"unsafe legacy renegotiation disabled"错误)，且HTTP响应头本身
 * 含不合规字符导致Node严格HTTP解析器拒绝解析。
 * - 用 Playwright 真实浏览器(Chromium)直接访问首页：ERR_EMPTY_RESPONSE，
 *   连接失败，说明不是Node独有的问题，是服务器本身不兼容现代客户端。
 * - 用 Node 原生 https.request 手动加 secureOptions(放宽TLS重协商限制)+
 *   insecureHTTPParser(放宽HTTP头校验) 两层绕过，才勉强拿到 robots.txt
 *   （内容为空Disallow，无限制），但这个绕过组合没法通过项目现有的
 *   axios请求库正常传递，需要完全脱离axios单独写一套底层HTTP客户端
 *   只为这一个provider——复杂度和脆弱性不成比例，且尚未确认过了这层
 *   还能不能真拿到逐条航班JSON（robots.txt能拿到不代表实际航班页面
 *   也能稳定拿到）。
 *
 * 结论：不是不想做，是真实技术障碍，继续走第三方兜底(AeroDataBox)。
 */

export async function getSchedule() {
  return { available: false, reason: 'server-tls-and-http-parser-incompatible' };
}

export async function matchFlight() {
  return null;
}

export function getStatus() {
  return {
    sourceType: 'third-party',
    status: 'blocked-technical',
    note: '官网服务器TLS配置过旧+HTTP响应头不合规，Chromium真实浏览器直接连接失败(ERR_EMPTY_RESPONSE)，非axios可绕过，已实测确认非"未调研"而是真实技术障碍',
  };
}
