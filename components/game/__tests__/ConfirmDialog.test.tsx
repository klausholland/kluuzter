// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ConfirmDialog } from "../ConfirmDialog";

afterEach(cleanup);

function setup() {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDialog
      title="Spiel abbrechen?"
      message="Der aktuelle Spielfortschritt geht verloren."
      confirmLabel="Abbrechen"
      cancelLabel="Weiterspielen"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return { onConfirm, onCancel };
}

describe("ConfirmDialog", () => {
  it("calls onConfirm when the confirm button is clicked", () => {
    const { onConfirm, onCancel } = setup();
    fireEvent.click(screen.getByText("Abbrechen"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("calls onCancel when the cancel button is clicked", () => {
    const { onConfirm, onCancel } = setup();
    fireEvent.click(screen.getByText("Weiterspielen"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onCancel when Escape is pressed", () => {
    const { onCancel } = setup();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
