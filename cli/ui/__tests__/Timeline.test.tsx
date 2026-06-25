// @vitest-environment node
import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import Timeline from "../Timeline";
import type { Player } from "@/lib/engine/types";

const card = (year: number, title: string) => ({
  id: title, uri: `spotify:track:${title}`, title, artist: "A", year, yearSource: "spotify" as const, coverUrl: null,
});

describe("Timeline", () => {
  it("renders cards with their year and title", () => {
    const player: Player = { id: "p1", name: "Klaus", tokens: 3, timeline: [card(1965, "Yesterday"), card(1991, "Teen Spirit")] };
    const frame = render(<Timeline player={player} />).lastFrame() ?? "";
    expect(frame).toContain("1965");
    expect(frame).toContain("Yesterday");
    expect(frame).toContain("1991");
  });
});
