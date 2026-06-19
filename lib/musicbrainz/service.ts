import type { TrackQuery, ResolvedYear } from "./types";
import { resolveYears } from "./resolve";
import { getCached, putCached } from "./cache";
import { lookupYear } from "./client";
import { createRateLimiter } from "./rate-limit";

const limit = createRateLimiter(1100); // ≥ 1 req/s mit Sicherheitsabstand

export function enrichTracks(queries: TrackQuery[]): Promise<ResolvedYear[]> {
  return resolveYears(queries, {
    getCached,
    putCached,
    lookup: (q) => lookupYear(q),
    limit,
  });
}
