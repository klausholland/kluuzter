// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CardDetail } from "../CardDetail";
import type { Card } from "@/lib/engine/types";

afterEach(cleanup);

const card: Card = {
  id: "t1",
  uri: "spotify:track:t1",
  title: "A Very Long Song Title That Gets Truncated On The Card",
  artist: "An Artist With A Long Name",
  year: 1991,
  yearSource: "musicbrainz",
  coverUrl: null,
};

describe("CardDetail", () => {
  it("shows the full artist, title and year", () => {
    render(<CardDetail card={card} onClose={() => {}} />);
    expect(screen.getByText("An Artist With A Long Name")).toBeTruthy();
    expect(
      screen.getByText("A Very Long Song Title That Gets Truncated On The Card"),
    ).toBeTruthy();
    expect(screen.getByText("1991")).toBeTruthy();
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(<CardDetail card={card} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Schließen"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows the approximate-year hint for spotify-sourced years", () => {
    render(<CardDetail card={{ ...card, yearSource: "spotify" }} onClose={() => {}} />);
    expect(screen.getByText(/ungenau/)).toBeTruthy();
  });
});
