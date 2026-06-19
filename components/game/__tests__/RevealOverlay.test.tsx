// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { RevealOverlay } from "../RevealOverlay";
import type { Card, Player, Resolution } from "@/lib/engine/types";

afterEach(cleanup);

const card: Card = {
  id: "m",
  uri: "spotify:track:m",
  title: "Sultans of Swing",
  artist: "Dire Straits",
  year: 1978,
  yearSource: "musicbrainz",
  coverUrl: null,
};

const players: Player[] = [
  { id: "A", name: "Anna", tokens: 2, timeline: [] },
  { id: "B", name: "Ben", tokens: 2, timeline: [] },
];

function resolution(over: Partial<Resolution>): Resolution {
  return {
    card,
    activePlayerId: "A",
    activeSlot: 0,
    activeCorrect: true,
    counters: [],
    winnerId: "A",
    ...over,
  };
}

describe("RevealOverlay verdict banner", () => {
  it("shows a prominent RICHTIG banner when the placement was correct", () => {
    render(
      <RevealOverlay
        resolution={resolution({ activeCorrect: true })}
        players={players}
        activePlayerId="A"
        onContinue={() => {}}
      />,
    );
    const banner = screen.getByTestId("verdict-banner");
    expect(banner.textContent).toMatch(/richtig/i);
  });

  it("shows a prominent FALSCH banner when the placement was wrong", () => {
    render(
      <RevealOverlay
        resolution={resolution({ activeCorrect: false, winnerId: null })}
        players={players}
        activePlayerId="A"
        onContinue={() => {}}
      />,
    );
    const banner = screen.getByTestId("verdict-banner");
    expect(banner.textContent).toMatch(/falsch|daneben/i);
  });

  it("still reveals the song's title, artist and year", () => {
    render(
      <RevealOverlay
        resolution={resolution({})}
        players={players}
        activePlayerId="A"
        onContinue={() => {}}
      />,
    );
    expect(screen.getAllByText(/Sultans of Swing/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Dire Straits/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1978/).length).toBeGreaterThan(0);
  });

  it("calls onContinue(true) when the token claim is confirmed", () => {
    const onContinue = vi.fn();
    render(
      <RevealOverlay
        resolution={resolution({})}
        players={players}
        activePlayerId="A"
        onContinue={onContinue}
      />,
    );
    screen.getByRole("button", { name: /\+1 Token/i }).click();
    expect(onContinue).toHaveBeenCalledWith(true);
  });
});
