import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRateLimiter } from "../rate-limit";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createRateLimiter", () => {
  it("runs tasks serially spaced by at least minInterval", async () => {
    const limit = createRateLimiter(1000);
    const starts: number[] = [];
    const task = (i: number) =>
      limit(async () => {
        starts.push(i);
        return i;
      });

    const p = Promise.all([task(0), task(1), task(2)]);
    await vi.runAllTimersAsync();
    const results = await p;

    expect(results).toEqual([0, 1, 2]);
    expect(starts).toEqual([0, 1, 2]); // serielle Reihenfolge
  });

  it("propagates errors without breaking the queue", async () => {
    const limit = createRateLimiter(0);
    const ok1 = limit(async () => "a");
    const bad = limit(async () => {
      throw new Error("boom");
    });
    const ok2 = limit(async () => "b");
    await vi.runAllTimersAsync();

    await expect(ok1).resolves.toBe("a");
    await expect(bad).rejects.toThrow("boom");
    await expect(ok2).resolves.toBe("b");
  });
});
