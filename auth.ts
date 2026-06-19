import NextAuth from "next-auth";
import Spotify from "next-auth/providers/spotify";
import { refreshAccessToken } from "@/lib/spotify/refresh";

const SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "playlist-read-private",
  "playlist-read-collaborative",
].join(" ");

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Spotify({
      authorization: {
        url: "https://accounts.spotify.com/authorize",
        params: { scope: SCOPES },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.access_token = account.access_token;
        token.refresh_token = account.refresh_token;
        token.expires_at = account.expires_at;
        token.error = undefined;
        return token;
      }
      if (token.expires_at && Date.now() < token.expires_at * 1000) {
        return token;
      }
      const refreshed = await refreshAccessToken(token);
      return { ...token, ...refreshed };
    },
    async session({ session, token }) {
      session.accessToken = token.access_token;
      session.error = token.error;
      return session;
    },
  },
});
