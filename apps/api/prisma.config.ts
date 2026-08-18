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

export default defineConfig({
	earlyAccess: true,
	schema: resolve(import.meta.dirname, "prisma/schema.prisma"),
	migrations: {
		path: resolve(import.meta.dirname, "prisma/migrations"),
		seed: "tsx prisma/seed.ts",
	},
	datasource: {
		url: databaseUrl,
	},
});
