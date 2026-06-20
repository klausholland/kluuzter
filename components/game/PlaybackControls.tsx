import type { PlaybackState } from "@/lib/spotify/useSpotifyPlayer";
import { Box, IconButton, LinearProgress } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";

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
    <Box sx={{ width: "100%", maxWidth: 448, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
      <IconButton
        onClick={onToggle}
        disabled={disabled}
        aria-label={paused ? "Abspielen" : "Pausieren"}
        sx={{ width: 56, height: 56, bgcolor: "primary.main", color: "primary.contrastText", "&:hover": { bgcolor: "primary.dark" } }}
      >
        {paused ? <PlayArrowIcon /> : <PauseIcon />}
      </IconButton>
      <LinearProgress variant="determinate" value={pct} sx={{ width: "100%", height: 8, borderRadius: 4 }} />
    </Box>
  );
}
