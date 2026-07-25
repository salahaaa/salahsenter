import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { getDatabaseUrl } from "./env";

const databaseUrl = getDatabaseUrl();

const globalForDb = globalThis as unknown as {
  postgresClient?: postgres.Sql;
};

function numberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function defaultPoolMax() {
  // Serverless production can multiply connections per lambda instance quickly.
  // Keep the default conservative; operators can raise this behind PgBouncer / pooler.
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY) return 3;
  return 10;
}

const poolMax = numberEnv("DB_POOL_MAX", numberEnv("POSTGRES_POOL_MAX", defaultPoolMax()));
const idleTimeout = numberEnv("DB_IDLE_TIMEOUT_SECONDS", 20);
const connectTimeout = numberEnv("DB_CONNECT_TIMEOUT_SECONDS", 10);

export const client =
  globalForDb.postgresClient ??
  postgres(databaseUrl || "postgres://postgres:postgres@localhost:5432/marketplace", {
    max: poolMax,
    prepare: false,
    idle_timeout: idleTimeout,
    connect_timeout: connectTimeout,
    connection: { application_name: process.env.DB_APPLICATION_NAME || "salahsentar22-app" }
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.postgresClient = client;
}

export const db = drizzle(client, { schema });
export * from "./schema";
