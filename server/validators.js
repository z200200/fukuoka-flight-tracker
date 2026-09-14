// ========== 输入验证工具函数 ==========
// 独立成模块，便于单元测试（见 __tests__/validators.test.js）

export function validateCoordinate(value, name, min, max) {
  const num = parseFloat(value);
  if (isNaN(num)) {
    return { valid: false, error: `${name} must be a number` };
  }
  if (num < min || num > max) {
    return { valid: false, error: `${name} must be between ${min} and ${max}` };
  }
  return { valid: true, value: num };
}

export function validateIcao(icao) {
  if (!icao || typeof icao !== 'string') {
    return { valid: false, error: 'ICAO code is required' };
  }
  // ICAO24 应该是6位十六进制
  const clean = icao.toLowerCase().trim();
  if (!/^[0-9a-f]{6}$/.test(clean)) {
    return { valid: false, error: 'ICAO code must be 6 hexadecimal characters' };
  }
  return { valid: true, value: clean };
}

export function validateCallsign(callsign) {
  if (!callsign || typeof callsign !== 'string') {
    return { valid: false, error: 'Callsign is required' };
  }
  const clean = callsign.trim().toUpperCase();
  // 呼号：2-8位字母数字
  if (!/^[A-Z0-9]{2,8}$/.test(clean)) {
    return { valid: false, error: 'Callsign must be 2-8 alphanumeric characters' };
  }
  return { valid: true, value: clean };
}

// 缓存大小控制：删除最旧的条目（Map 按插入顺序迭代，先插入的即最旧）
export function enforceMaxCacheSize(cache, maxSize, getName = (k) => k) {
  if (cache.size <= maxSize) return;

  const entriesToDelete = cache.size - maxSize;
  const keys = Array.from(cache.keys());
  for (let i = 0; i < entriesToDelete; i++) {
    console.log(`[Cache] Removing oldest entry: ${getName(keys[i])}`);
    cache.delete(keys[i]);
  }
}
