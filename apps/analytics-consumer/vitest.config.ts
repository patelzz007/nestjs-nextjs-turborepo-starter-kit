import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		// Unit tests: the inbox store is an in-memory port — no Kafka, no Postgres.
		include: ["src/**/*.spec.ts"],
		exclude: ["src/**/*.e2e-spec.ts"],
	},
});
