// @vitest-environment node
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "ink-testing-library";
import SelectList from "../SelectList";

describe("SelectList", () => {
  it("renders all item labels and marks the first as selected", () => {
    const { lastFrame } = render(
      <SelectList items={[{ label: "Alpha", value: 1 }, { label: "Beta", value: 2 }]} onSelect={vi.fn()} />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Alpha");
    expect(frame).toContain("Beta");
    expect(frame).toContain("❯ Alpha"); // cursor on first item
  });

  it("selects an item when Enter is pressed", () => {
    const onSelect = vi.fn();
    const { stdin } = render(
      <SelectList items={[{ label: "Alpha", value: "a" }, { label: "Beta", value: "b" }]} onSelect={onSelect} />,
    );
    stdin.write("\r"); // Enter
    expect(onSelect).toHaveBeenCalledWith("a");
  });
});
