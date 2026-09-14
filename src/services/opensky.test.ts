import { describe, it, expect, vi } from 'vitest';
import { withExponentialBackoff, isRetryableError } from './opensky';

// axios.isAxiosError 只检查 payload.isAxiosError === true，
// 所以用普通对象即可模拟真实 AxiosError 的判定行为
function makeAxiosError(overrides: { status?: number; code?: string; hasResponse?: boolean } = {}) {
  const { status, code, hasResponse = status !== undefined } = overrides;
  return {
    isAxiosError: true,
    code,
    response: hasResponse ? { status, headers: {} } : undefined,
    message: 'mock axios error',
  };
}

describe('isRetryableError', () => {
  it('retries on 429 and 503', () => {
    expect(isRetryableError(makeAxiosError({ status: 429 }))).toBe(true);
    expect(isRetryableError(makeAxiosError({ status: 503 }))).toBe(true);
  });

  it('does not retry on 400 (client error with a response)', () => {
    expect(isRetryableError(makeAxiosError({ status: 400 }))).toBe(false);
  });

  it('retries on network errors with no response', () => {
    expect(isRetryableError(makeAxiosError({ code: 'ECONNABORTED', hasResponse: false }))).toBe(true);
  });

  it('treats non-axios errors as retryable by default', () => {
    expect(isRetryableError(new Error('boom'))).toBe(true);
  });
});

describe('withExponentialBackoff', () => {
  it('returns the result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withExponentialBackoff(fn, 3, 1);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 rate limit and eventually succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(makeAxiosError({ status: 429 }))
      .mockResolvedValueOnce('ok');
    const result = await withExponentialBackoff(fn, 3, 1);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry on a non-retryable 400 error', async () => {
    const err = makeAxiosError({ status: 400 });
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withExponentialBackoff(fn, 3, 1)).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws after exceeding max retries on retryable errors', async () => {
    const err = makeAxiosError({ status: 503 });
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withExponentialBackoff(fn, 2, 1)).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
