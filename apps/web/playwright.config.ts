import { defineConfig, devices } from "@playwright/test";

import { webBrowserE2eEnv } from "./e2e/browser-env.e2e";

/**
 * Browser suite (`pnpm --filter @workspace/web test:browser`): real Chromium
 * against a running web build — for behaviour only a browser can prove (the
 * History API, back/forward). Unit and component tests stay in Vitest.
 */
export default defineConfig({
	testDir: "./e2e",
	testMatch: "**/*.browser.ts",
	forbidOnly: true,
	fullyParallel: false,
	reporter: "list",
	use: {
		...devices["Desktop Chrome"],
		baseURL: webBrowserE2eEnv.WEB_E2E_BASE_URL,
		trace: "retain-on-failure",
	},
});
