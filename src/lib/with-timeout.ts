export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} did not respond within ${Math.round(ms / 1000)}s`);
    this.name = "TimeoutError";
  }
}

/**
 * Rejects with a TimeoutError when `work` has not settled in time. The
 * underlying promise keeps running; this only stops a hung call from leaving
 * the caller waiting forever.
 */
export function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const expiry = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
  });
  return Promise.race([work, expiry]).finally(() => {
    clearTimeout(timer);
  }) as Promise<T>;
}
