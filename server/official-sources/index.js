// 统一调度器：每个机场一个 provider，有官方就用官方，没有就诚实返回 unavailable
import * as fukuoka from './fukuoka.js';
import * as narita from './narita.js';
import * as haneda from './haneda.js';
import * as incheon from './incheon.js';
import * as shanghai from './shanghai.js';
import * as dalian from './dalian.js';

// key = 该机场在项目里使用的 IATA 代码（与 config/airports.ts 的 subAirports.iata / iata 对应）
const PROVIDERS = {
  FUK: fukuoka,
  NRT: narita,
  HND: haneda,
  ICN: incheon,
  PVG: shanghai,
  SHA: shanghai,
  DLC: dalian,
};

export function getOfficialProvider(iataCode) {
  return PROVIDERS[iataCode] || null;
}

// 返回 { available: boolean, data?: AirportSchedule形状, reason?: string }
export async function getOfficialSchedule(iataCode, forceRefresh = false) {
  const provider = getOfficialProvider(iataCode);
  if (!provider) {
    return { available: false, reason: 'no-official-source-configured' };
  }
  try {
    const result = await provider.getSchedule(forceRefresh);
    return result;
  } catch (error) {
    return { available: false, reason: `official-source-error: ${error.message}` };
  }
}

export async function matchOfficialFlight(callsign, iataCode) {
  const provider = getOfficialProvider(iataCode);
  if (!provider || typeof provider.matchFlight !== 'function') {
    return null;
  }
  try {
    return await provider.matchFlight(callsign);
  } catch {
    return null;
  }
}

// 供 /api/schedule/sources/status 使用：每个机场的数据源状态一览
export function getOfficialProviderStatus() {
  const status = {};
  for (const [iata, provider] of Object.entries(PROVIDERS)) {
    status[iata] = typeof provider.getStatus === 'function'
      ? provider.getStatus()
      : { sourceType: 'unknown', status: 'no-status-reported' };
  }
  return status;
}
