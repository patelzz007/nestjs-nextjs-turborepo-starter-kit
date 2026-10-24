import { defineConfig, devices } from "@playwright/test";

import { adminBrowserE2eEnv } from "./e2e/browser-env.e2e";
import { SIGNED_IN_STATE_PATH } from "./e2e/sign-in.e2e";

/**
 * Browser suite (`pnpm --filter @workspace/admin test:browser`): real Chromium
 * against a running admin build and seeded API — for behaviour only a browser
 * can prove (the History API, back/forward).
 *
 * The `sign-in` project signs the seeded admin in once and saves the session
 * (`e2e/sign-in.setup.ts`); every spec starts from it, so a run signs in once
 * however many specs it holds — never tripping the API's sign-in rate limit.
 */
export default defineConfig({
	testDir: "./e2e",
	forbidOnly: true,
	fullyParallel: false,
	reporter: "list",
	use: {
		...devices["Desktop Chrome"],
		baseURL: adminBrowserE2eEnv.ADMIN_E2E_BASE_URL,
		trace: "retain-on-failure",
	},
	projects: [
		{ name: "sign-in", testMatch: "**/sign-in.setup.ts" },
		{ name: "browser", testMatch: "**/*.browser.ts", dependencies: ["sign-in"], use: { storageState: SIGNED_IN_STATE_PATH } },
	],
});
