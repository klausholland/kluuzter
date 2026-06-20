// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Timeline } from "../Timeline";
import type { Card } from "@/lib/engine/types";

afterEach(cleanup);

function card(id: string, year: number): Card {
  return { id, uri: `spotify:track:${id}`, title: id, artist: id, year, yearSource: "musicbrainz", coverUrl: null };
}

const cards = [card("a", 1970), card("b", 2000)];

describe("Timeline", () => {
  it("renders length+1 slots for the given cards", () => {
    render(
      <Timeline cards={cards} availableSlots={[0, 1, 2]} selectedSlot={null} onSelectSlot={() => {}} interactive />,
    );
    // 2 Karten → 3 Slots
    expect(screen.getAllByLabelText(/^Slot /)).toHaveLength(3);
  });

  it("calls onSelectSlot with the slot index on tap", () => {
    const onSelect = vi.fn();
    render(
      <Timeline cards={cards} availableSlots={[0, 1, 2]} selectedSlot={null} onSelectSlot={onSelect} interactive />,
    );
    fireEvent.click(screen.getByLabelText("Slot 1"));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("disables slots that are not available", () => {
    render(
      <Timeline cards={cards} availableSlots={[0, 2]} selectedSlot={null} onSelectSlot={() => {}} interactive />,
    );
    expect((screen.getByLabelText("Slot 1") as HTMLButtonElement).disabled).toBe(true);
  });

  it("selects a slot when a card is dropped on it (drag & drop)", () => {
    const onSelect = vi.fn();
    render(
      <Timeline cards={cards} availableSlots={[0, 1, 2]} selectedSlot={null} onSelectSlot={onSelect} interactive />,
    );
    const slot = screen.getByLabelText("Slot 1");
    fireEvent.dragOver(slot);
    fireEvent.drop(slot);
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("ignores a drop on a disabled slot", () => {
    const onSelect = vi.fn();
    render(
      <Timeline cards={cards} availableSlots={[0, 2]} selectedSlot={null} onSelectSlot={onSelect} interactive />,
    );
    fireEvent.drop(screen.getByLabelText("Slot 1")); // Slot 1 ist disabled
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("calls onCardClick with the card when a revealed card is clicked", () => {
    const onCardClick = vi.fn();
    render(
      <Timeline cards={cards} availableSlots={[0, 1, 2]} selectedSlot={null} onSelectSlot={() => {}} interactive onCardClick={onCardClick} />,
    );
    fireEvent.click(screen.getByLabelText("Details: a – a"));
    expect(onCardClick).toHaveBeenCalledWith(cards[0]);
  });
});
