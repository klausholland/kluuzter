const API = "https://api.spotify.com/v1";

async function putPlayer(
  url: string,
  token: string,
  body: unknown | undefined,
  fetchImpl: typeof fetch,
): Promise<void> {
  const res = await fetchImpl(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Spotify playback ${res.status} for ${url}`);
  }
}

export function playTrack(
  token: string,
  deviceId: string,
  uri: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  return putPlayer(
    `${API}/me/player/play?device_id=${deviceId}`,
    token,
    { uris: [uri] },
    fetchImpl,
  );
}

export function pausePlayback(
  token: string,
  deviceId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  return putPlayer(
    `${API}/me/player/pause?device_id=${deviceId}`,
    token,
    undefined,
    fetchImpl,
  );
}

export function transferPlayback(
  token: string,
  deviceId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  return putPlayer(
    `${API}/me/player`,
    token,
    { device_ids: [deviceId], play: false },
    fetchImpl,
  );
}
