import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";
import * as schema from "./schema";

type DbClient = ReturnType<typeof drizzleNeon<typeof schema>>;

// Lokale Hosts sprechen direktes Postgres (node-postgres/TCP). Echte Neon-Hosts
// (Produktion) nutzen den serverless HTTP-Treiber. So braucht die lokale
// Entwicklung nur einen Postgres-Container (kein Neon-HTTP-Proxy).
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "db.localtest.me"]);

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

let instance: DbClient | null = null;

function getDb(): DbClient {
  if (instance) return instance;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (LOCAL_HOSTS.has(hostOf(url))) {
    instance = drizzlePg(new Pool({ connectionString: url }), {
      schema,
    }) as unknown as DbClient;
  } else {
    instance = drizzleNeon(neon(url), { schema });
  }
  return instance;
}

/**
 * Lazy Drizzle-Client: Erst beim ersten Zugriff (Query) wird verbunden und
 * `DATABASE_URL` geprüft. So bleiben Importe (z. B. reine Mapping-Funktionen
 * in derselben Datei) und der Build ohne gesetzte `DATABASE_URL` nutzbar.
 */
export const db = new Proxy({} as DbClient, {
  get(_target, prop, receiver) {
    const client = getDb();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
