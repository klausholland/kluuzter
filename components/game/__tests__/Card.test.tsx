// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { GameCard } from "../Card";
import type { Card } from "@/lib/engine/types";

afterEach(cleanup);

const card: Card = {
  id: "t1",
  uri: "spotify:track:t1",
  title: "Sultans of Swing",
  artist: "Dire Straits",
  year: 1978,
  yearSource: "musicbrainz",
  coverUrl: null,
};

describe("GameCard", () => {
  it("shows artist, year and title when revealed", () => {
    render(<GameCard card={card} />);
    expect(screen.getByText("Dire Straits")).toBeTruthy();
    expect(screen.getByText("1978")).toBeTruthy();
    expect(screen.getByText("Sultans of Swing")).toBeTruthy();
  });

  it("hides the year when hideYear is set", () => {
    render(<GameCard card={card} hideYear />);
    expect(screen.queryByText("1978")).toBeNull();
    expect(screen.getByText("?")).toBeTruthy();
  });

  it("marks a spotify-sourced year as approximate", () => {
    render(<GameCard card={{ ...card, yearSource: "spotify" }} />);
    expect(screen.getByText(/ungenau/)).toBeTruthy();
  });
});
