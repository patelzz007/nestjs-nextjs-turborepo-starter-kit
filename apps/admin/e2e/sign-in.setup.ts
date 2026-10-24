// Signs the seeded admin in once per run and saves the session for every spec (playwright.config.ts → `sign-in`).

import { test as setup } from "@playwright/test";

import { SIGNED_IN_STATE_PATH, signIn } from "./sign-in.e2e";

/** A page every signed-in admin may open, to land on after signing in. */
const LANDING_PATH = "/account/profile";

setup("sign in as the seeded admin", async ({ page }) => {
	await signIn(page, LANDING_PATH);
	await page.context().storageState({ path: SIGNED_IN_STATE_PATH });
});
