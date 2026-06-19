import { drizzle } from "drizzle-orm/neon-http";
import { neon, neonConfig } from "@neondatabase/serverless";
import * as schema from "./schema";

// Lokaler Neon-HTTP-Proxy (siehe docker-compose.yml): Zeigt DATABASE_URL auf
// einen lokalen Host, wird der Serverless-Treiber auf http://<host>:4444/sql
// gelenkt. Für echte Neon-Hosts (Produktion) bleibt es bei https://<host>/sql.
const LOCAL_PROXY_HOSTS = new Set(["db.localtest.me", "localhost", "127.0.0.1"]);
neonConfig.fetchEndpoint = (host) => {
  const isLocal = LOCAL_PROXY_HOSTS.has(host);
  const protocol = isLocal ? "http" : "https";
  const port = isLocal ? 4444 : 443;
  return `${protocol}://${host}:${port}/sql`;
};

type DbClient = ReturnType<typeof drizzle<typeof schema>>;

let instance: DbClient | null = null;

function getDb(): DbClient {
  if (instance) return instance;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  instance = drizzle(neon(url), { schema });
  return instance;
}

/**
 * Lazy Drizzle/Neon-Client: Erst beim ersten Zugriff (Query) wird verbunden
 * und `DATABASE_URL` geprüft. So bleiben Importe (z. B. reine Mapping-Funktionen
 * in derselben Datei) und der Build ohne gesetzte `DATABASE_URL` nutzbar.
 */
export const db = new Proxy({} as DbClient, {
  get(_target, prop, receiver) {
    const client = getDb();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
