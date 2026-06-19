import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

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
