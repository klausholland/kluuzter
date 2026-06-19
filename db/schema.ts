import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const yearCache = pgTable("year_cache", {
  spotifyTrackId: text("spotify_track_id").primaryKey(),
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  resolvedYear: integer("resolved_year").notNull(),
  source: text("source", { enum: ["musicbrainz", "spotify"] }).notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

export type YearCacheRow = typeof yearCache.$inferSelect;
