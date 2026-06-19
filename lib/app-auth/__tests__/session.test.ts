import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
  isCorrectPassword,
} from "../session";

beforeEach(() => {
  vi.stubEnv("APP_SECRET", "test-secret-value-at-least-32-chars-long!!");
  vi.stubEnv("APP_PASSWORD", "hunter2");
});

describe("session token", () => {
  it("verifies a token it created", async () => {
    const token = await createSessionToken();
    expect(await verifySessionToken(token)).toBe(true);
  });

  it("rejects undefined", async () => {
    expect(await verifySessionToken(undefined)).toBe(false);
  });

  it("rejects a tampered token", async () => {
    const token = await createSessionToken();
    expect(await verifySessionToken(token + "x")).toBe(false);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken();
    vi.stubEnv("APP_SECRET", "a-completely-different-secret-value-here!!");
    expect(await verifySessionToken(token)).toBe(false);
  });
});

describe("isCorrectPassword", () => {
  it("accepts the configured password", () => {
    expect(isCorrectPassword("hunter2")).toBe(true);
  });
  it("rejects a wrong password", () => {
    expect(isCorrectPassword("nope")).toBe(false);
  });
  it("rejects empty input", () => {
    expect(isCorrectPassword("")).toBe(false);
  });
});
