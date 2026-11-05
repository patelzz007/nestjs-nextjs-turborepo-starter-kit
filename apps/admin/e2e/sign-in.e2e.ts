// ============================================
// e2e/sign-in.e2e.ts - signing the browser suite in as the seeded admin
// ============================================
// The browser suite signs in once per run (`sign-in.setup.ts`) and every spec reuses the saved session
// (`SIGNED_IN_STATE_PATH`). The sign-in itself (including the emailed code on a new device) is the shared
// `@workspace/client/testing/browser-sign-in`, used by the merchant suite too. A long suite uses `signedInTest`,
// which keeps the session fresh across tests.

import { test, type BrowserContext, type Page } from "@playwright/test";
import { signInThroughLoginPage } from "@workspace/client/testing/browser-sign-in";

import { adminBrowserE2eEnv } from "./browser-env.e2e";

/** Where the signed-in session (cookies) is saved for the specs; git-ignored, rewritten every run. */
export const SIGNED_IN_STATE_PATH = "e2e/.auth/admin.json";

/** Signs the seeded admin in and lands on `pathname` (the login page's `?redirect=`). */
export function signIn(page: Page, pathname: string): Promise<void> {
	return signInThroughLoginPage(page, pathname, {
		email: adminBrowserE2eEnv.ADMIN_E2E_EMAIL,
		password: adminBrowserE2eEnv.ADMIN_E2E_PASSWORD,
		mailpitUrl: adminBrowserE2eEnv.ADMIN_E2E_MAILPIT_URL,
	});
}

/** A saved session: the cookies and storage a context holds. */
type SessionState = Awaited<ReturnType<BrowserContext["storageState"]>>;

/** The worker's latest session: unset until a test has run, then that test's cookies (refreshed ones included). */
interface WorkerSession {
	latest: SessionState | undefined;
}

interface SignedInWorkerFixtures {
	readonly workerSession: WorkerSession;
}

/**
 * A test that starts from the worker's latest session rather than the one saved at sign-in. The API rotates the
 * refresh token on every refresh and revokes the whole session when an old one is replayed (token reuse), so a
 * suite that outlives the access token (CI's is 15 minutes) must carry each test's refreshed cookies into the
 * next test, as one browser would; replaying the sign-in's cookies would sign every later test out.
 */
export const signedInTest = test.extend<object, SignedInWorkerFixtures>({
	workerSession: [{ latest: undefined }, { scope: "worker" }],
	storageState: async ({ storageState, workerSession }, provide): Promise<void> => {
		await provide(workerSession.latest ?? storageState);
	},
	context: async ({ context, workerSession }, provide): Promise<void> => {
		await provide(context);
		workerSession.latest = await context.storageState();
	},
});
