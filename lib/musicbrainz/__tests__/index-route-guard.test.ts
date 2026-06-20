import { describe, it, expect } from "vitest";
import { isValidBatch, INDEX_BATCH_SIZE } from "../indexing";

function q(id: string) {
  return { spotifyTrackId: id, title: id, artist: id, spotifyReleaseYear: 1990 };
}

describe("INDEX_BATCH_SIZE", () => {
  it("is 20", () => expect(INDEX_BATCH_SIZE).toBe(20));
});

describe("isValidBatch", () => {
  it("accepts an array within the batch limit", () => {
    expect(isValidBatch([q("a"), q("b")])).toBe(true);
  });
  it("accepts an empty array", () => {
    expect(isValidBatch([])).toBe(true);
  });
  it("rejects a non-array", () => {
    expect(isValidBatch("nope")).toBe(false);
    expect(isValidBatch(null)).toBe(false);
  });
  it("rejects a batch larger than INDEX_BATCH_SIZE", () => {
    const big = Array.from({ length: INDEX_BATCH_SIZE + 1 }, (_, i) => q(String(i)));
    expect(isValidBatch(big)).toBe(false);
  });
  it("rejects entries missing required fields", () => {
    expect(isValidBatch([{ spotifyTrackId: "a" }])).toBe(false);
  });
});
