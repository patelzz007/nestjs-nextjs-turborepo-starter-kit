import { resolve } from "node:path";

import { defineConfig } from "@prisma/config";
import { config as loadEnv } from "dotenv";

// Prisma 7 reads the URL from this file, not `schema.prisma`. Bare
// `npx prisma …` does not load `.env`, so we do it here (path is relative
// to this config, not cwd).
loadEnv({ path: resolve(import.meta.dirname, ".env") });

const databaseUrl: string | undefined = process.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl.length === 0) {
	throw new Error("DATABASE_URL is missing. Copy apps/api/.env.example to apps/api/.env, or run `pnpm db:reset` from the repo root.");
}

// Optional. Required only by `prisma migrate diff --from-migrations` (the
// `db:check-drift` script), which replays the migration history into this
// throwaway database. `prisma migrate dev` creates its own temporary shadow
// database when this is unset. Never point it at a database holding data:
// Prisma drops everything in it on every run.
const shadowDatabaseUrl: string | undefined = process.env.SHADOW_DATABASE_URL;

export default defineConfig({
	schema: resolve(import.meta.dirname, "prisma/schema.prisma"),
	migrations: {
		path: resolve(import.meta.dirname, "prisma/migrations"),
		seed: "tsx prisma/seed-bootstrap.ts",
	},
	datasource: {
		url: databaseUrl,
		...(shadowDatabaseUrl !== undefined && shadowDatabaseUrl.length > 0 ? { shadowDatabaseUrl } : {}),
	},
});
