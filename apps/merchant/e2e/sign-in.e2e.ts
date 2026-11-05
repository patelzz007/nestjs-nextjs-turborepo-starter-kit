// ============================================
// e2e/sign-in.e2e.ts - signing the merchant browser suite in as the seeded store owner
// ============================================
// Signed in once per run (`sign-in.setup.ts`); every spec reuses the saved session. The sign-in itself is the
// shared `@workspace/client/testing/browser-sign-in` (the admin suite uses it too).

import type { Page } from "@playwright/test";
import { signInThroughLoginPage } from "@workspace/client/testing/browser-sign-in";

import { merchantBrowserE2eEnv } from "./browser-env.e2e";

/** Where the signed-in session (cookies) is saved for the specs; git-ignored, rewritten every run. */
export const SIGNED_IN_STATE_PATH = "e2e/.auth/merchant.json";

/** The seeded store's own pages, under `/t/<slug>`. */
export function storePath(path: string): string {
	return `/t/${merchantBrowserE2eEnv.MERCHANT_E2E_TENANT_SLUG}${path}`;
}

/** Signs the seeded owner in and lands on `pathname`. */
export function signIn(page: Page, pathname: string): Promise<void> {
	return signInThroughLoginPage(page, pathname, {
		email: merchantBrowserE2eEnv.MERCHANT_E2E_EMAIL,
		password: merchantBrowserE2eEnv.MERCHANT_E2E_PASSWORD,
		mailpitUrl: merchantBrowserE2eEnv.MERCHANT_E2E_MAILPIT_URL,
	});
}
