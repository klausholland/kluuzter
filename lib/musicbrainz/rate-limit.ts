export function createRateLimiter(minIntervalMs: number) {
  let chain: Promise<unknown> = Promise.resolve();
  let lastStart = 0;

  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      const now = Date.now();
      const wait = Math.max(0, lastStart + minIntervalMs - now);
      if (wait > 0) {
        await new Promise((r) => setTimeout(r, wait));
      }
      lastStart = Date.now();
      return fn();
    };
    // An die Kette hängen; Fehler eines Tasks darf die Kette nicht abreißen lassen.
    const result = chain.then(run, run);
    chain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
}
