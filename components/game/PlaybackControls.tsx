import type { PlaybackState } from "@/lib/spotify/useSpotifyPlayer";

export function PlaybackControls({
  playback,
  onToggle,
  disabled = false,
}: {
  playback: PlaybackState | null;
  onToggle: () => void;
  disabled?: boolean;
}) {
  const duration = playback?.duration ?? 0;
  const position = playback?.position ?? 0;
  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
  const paused = playback?.paused ?? true;

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-2">
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-label={paused ? "Abspielen" : "Pausieren"}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-2xl disabled:opacity-40"
      >
        {paused ? "▶" : "⏸"}
      </button>
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-700">
        <div
          className="h-full bg-green-500 transition-[width] duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
