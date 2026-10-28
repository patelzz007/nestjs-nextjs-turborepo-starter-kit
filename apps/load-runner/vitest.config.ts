import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		// Unit tests only: the machine readings and the API are ports, faked in the tests.
		include: ["src/**/*.spec.ts"],
	},
});
