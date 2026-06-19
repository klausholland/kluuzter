import { describe, it, expect } from "vitest";
import { normalize, bestRecordingYear } from "../match";

describe("normalize", () => {
  it("lowercases and strips bracketed suffixes", () => {
    expect(normalize("Sultans of Swing (Remastered 2018)")).toBe(
      "sultans of swing",
    );
  });
  it("removes 'feat.' segments and punctuation", () => {
    expect(normalize("Song (feat. Someone) - Live")).toBe("song");
  });
  it("strips accents", () => {
    expect(normalize("Café del Mar")).toBe("cafe del mar");
  });
});

describe("bestRecordingYear", () => {
  const query = {
    spotifyTrackId: "x",
    title: "Sultans of Swing",
    artist: "Dire Straits",
    spotifyReleaseYear: 2010,
  };

  it("returns the earliest year of matching-title recordings", () => {
    const year = bestRecordingYear(query, [
      { title: "Sultans of Swing", firstReleaseDate: "1979-05-04", artistCredit: ["Dire Straits"] },
      { title: "Sultans of Swing (Live)", firstReleaseDate: "1984", artistCredit: ["Dire Straits"] },
    ]);
    expect(year).toBe(1979);
  });

  it("ignores recordings whose normalized title does not match", () => {
    const year = bestRecordingYear(query, [
      { title: "Completely Different", firstReleaseDate: "1970", artistCredit: ["Dire Straits"] },
      { title: "Sultans of Swing", firstReleaseDate: "1979", artistCredit: ["Dire Straits"] },
    ]);
    expect(year).toBe(1979);
  });

  it("requires the artist to match (normalized)", () => {
    const year = bestRecordingYear(query, [
      { title: "Sultans of Swing", firstReleaseDate: "1965", artistCredit: ["Other Band"] },
    ]);
    expect(year).toBeNull();
  });

  it("returns null when there are no recordings", () => {
    expect(bestRecordingYear(query, [])).toBeNull();
  });

  it("parses a bare year (YYYY) release date", () => {
    const year = bestRecordingYear(query, [
      { title: "Sultans of Swing", firstReleaseDate: "1979", artistCredit: ["Dire Straits"] },
    ]);
    expect(year).toBe(1979);
  });

  it("ignores empty/zero release dates", () => {
    const year = bestRecordingYear(query, [
      { title: "Sultans of Swing", firstReleaseDate: "", artistCredit: ["Dire Straits"] },
      { title: "Sultans of Swing", firstReleaseDate: "0000", artistCredit: ["Dire Straits"] },
      { title: "Sultans of Swing", firstReleaseDate: "1979-01-01", artistCredit: ["Dire Straits"] },
    ]);
    expect(year).toBe(1979);
  });
});
