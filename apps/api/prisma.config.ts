import { defineConfig } from "@prisma/config";

export default defineConfig({
	earlyAccess: true,
	migrations: {
		seed: "tsx prisma/seed.ts",
	},
	datasource: {
		url: process.env.DATABASE_URL,
	},
});
