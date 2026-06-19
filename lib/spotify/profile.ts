export type SpotifyProfile = {
  id: string;
  display_name: string | null;
  product: string;
};

export async function fetchProfile(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SpotifyProfile | null> {
  try {
    const res = await fetchImpl("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as SpotifyProfile;
    return {
      id: data.id,
      display_name: data.display_name,
      product: data.product,
    };
  } catch {
    return null;
  }
}

export function isPremium(profile: SpotifyProfile | null): boolean {
  return profile?.product === "premium";
}
