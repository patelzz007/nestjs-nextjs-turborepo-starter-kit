import { defineConfig, devices } from "@playwright/test";

import { merchantBrowserE2eEnv } from "./e2e/browser-env.e2e";
import { SIGNED_IN_STATE_PATH } from "./e2e/sign-in.e2e";

/**
 * Browser suite (`pnpm --filter @workspace/merchant test:browser`, enhancement 3.3): real Chromium against a
 * running merchant build and seeded API. The `sign-in` project signs the seeded owner in once and saves the
 * session; every spec starts from it, so a run signs in once however many specs it holds.
 */
export default defineConfig({
	testDir: "./e2e",
	outputDir: "../../.artifacts/playwright/merchant",
	forbidOnly: true,
	fullyParallel: false,
	reporter: "list",
	use: {
		...devices["Desktop Chrome"],
		baseURL: merchantBrowserE2eEnv.MERCHANT_E2E_BASE_URL,
		trace: "retain-on-failure",
	},
	projects: [
		{ name: "sign-in", testMatch: "**/sign-in.setup.ts" },
		{ name: "browser", testMatch: "**/*.browser.ts", dependencies: ["sign-in"], use: { storageState: SIGNED_IN_STATE_PATH } },
	],
});
