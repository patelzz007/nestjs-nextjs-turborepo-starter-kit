import { defineConfig, devices } from "@playwright/test";

import { adminBrowserE2eEnv } from "./e2e/browser-env.e2e";

/**
 * Browser suite (`pnpm --filter @workspace/admin test:browser`): real Chromium
 * against a running admin build and seeded API — for behaviour only a browser
 * can prove (the History API, back/forward). Unit tests stay in Vitest.
 */
export default defineConfig({
	testDir: "./e2e",
	testMatch: "**/*.browser.ts",
	forbidOnly: true,
	fullyParallel: false,
	reporter: "list",
	use: {
		...devices["Desktop Chrome"],
		baseURL: adminBrowserE2eEnv.ADMIN_E2E_BASE_URL,
		trace: "retain-on-failure",
	},
});
