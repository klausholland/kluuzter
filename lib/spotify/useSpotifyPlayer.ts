"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SDK_SRC = "https://sdk.scdn.co/spotify-player.js";

export type PlaybackState = {
  paused: boolean;
  position: number; // ms
  duration: number; // ms
};

/** Holt ein frisches Access-Token aus der Session-Route (Auth.js refresht serverseitig). */
async function fetchToken(): Promise<string> {
  const res = await fetch("/api/spotify/token");
  if (!res.ok) throw new Error("token fetch failed");
  const data = (await res.json()) as { accessToken: string };
  return data.accessToken;
}

function loadSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Spotify) return Promise.resolve();
  return new Promise((resolve) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    if (!document.querySelector(`script[src="${SDK_SRC}"]`)) {
      const script = document.createElement("script");
      script.src = SDK_SRC;
      script.async = true;
      document.body.appendChild(script);
    }
  });
}

export function useSpotifyPlayer() {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const playerRef = useRef<Spotify.Player | null>(null);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    loadSdk().then(() => {
      if (cancelled || !window.Spotify) return;

      const player = new window.Spotify.Player({
        name: "Hitster Web Player",
        getOAuthToken: (cb) => {
          fetchToken()
            .then(cb)
            .catch(() => setError("Token konnte nicht geladen werden."));
        },
        volume: 0.8,
      });
      playerRef.current = player;

      player.addListener("ready", ({ device_id }) => {
        if (cancelled) return;
        setDeviceId(device_id);
        setReady(true);
      });
      player.addListener("not_ready", () => setReady(false));
      player.addListener("initialization_error", ({ message }) => setError(message));
      player.addListener("authentication_error", ({ message }) => setError(message));
      player.addListener("account_error", () =>
        setError("Spotify Premium erforderlich für die Wiedergabe."),
      );
      player.addListener("player_state_changed", (state) => {
        if (!state) {
          setPlayback(null);
          return;
        }
        setPlayback({
          paused: state.paused,
          position: state.position,
          duration: state.duration,
        });
      });

      player.connect();

      // Lokaler Tick für einen flüssigen Fortschrittsbalken zwischen SDK-Events.
      interval = setInterval(() => {
        setPlayback((prev) =>
          prev && !prev.paused
            ? { ...prev, position: Math.min(prev.position + 250, prev.duration) }
            : prev,
        );
      }, 250);
    });

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
  }, []);

  const togglePlay = useCallback(() => {
    playerRef.current?.togglePlay();
  }, []);

  return { deviceId, ready, error, playback, togglePlay };
}
