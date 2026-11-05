// Signs the seeded store owner in once per run and saves the session for every spec (playwright.config.ts → `sign-in`).

import { test as setup } from "@playwright/test";

import { SIGNED_IN_STATE_PATH, signIn, storePath } from "./sign-in.e2e";

setup("sign in as the seeded store owner, landing on the store's dashboard", async ({ page }) => {
	await signIn(page, storePath("/dashboard"));
	await page.context().storageState({ path: SIGNED_IN_STATE_PATH });
});
