// ============================================
// e2e/sign-in.e2e.ts - signing the browser suite in as the seeded admin
// ============================================
// The browser suite signs in once per run (`sign-in.setup.ts`) and every spec
// reuses the saved session (`SIGNED_IN_STATE_PATH`). The API asks for an emailed six-digit
// code when the sign-in comes from a device it does not recognise yet (login
// verification, `new-device` mode) — a fresh Playwright browser usually is one —
// so the helper reads the newest sign-in code from the local Mailpit inbox
// (AGENTS.md → "Reading emails while testing locally") and enters it, exactly
// as a person would. It finds the email by its `login-verification` tag, not by
// recipient: a developer's `EMAIL_TEST_TO` sends every email to their own inbox.
// Mailpit is only asked once the page actually shows the code prompt: a run
// against an API with `LOGIN_VERIFICATION_MODE=disabled` (CI) never needs an
// inbox, so it must not depend on one being reachable.

import { expect, type Page } from "@playwright/test";
import { JsonValueSchema, type JsonValue } from "@workspace/shared";
import { z } from "zod";

import { adminBrowserE2eEnv } from "./browser-env.e2e";

/** Where the signed-in session (cookies) is saved for the specs; git-ignored, rewritten every run. */
export const SIGNED_IN_STATE_PATH = "e2e/.auth/admin.json";

/** How long the emailed code may take to arrive, and how often the inbox is asked. */
const CODE_POLL_ATTEMPTS = 50;
const CODE_POLL_INTERVAL_MS = 200;

const SearchResponseSchema = z.object({ messages: z.array(z.object({ ID: z.string(), Created: z.iso.datetime({ offset: true }) }).loose()) }).loose();
const MessageSchema = z.object({ Text: z.string() }).loose();
const CODE_PATTERN = /\b(?<code>\d{6})\b/;

async function getJson(path: string): Promise<JsonValue> {
	const response = await fetch(`${adminBrowserE2eEnv.ADMIN_E2E_MAILPIT_URL}${path}`);
	if (!response.ok) {
		throw new Error(`Mailpit answered ${String(response.status)} for ${path} — is it running (\`pnpm mailpit\`)?`);
	}
	return JsonValueSchema.parse(await response.json());
}

/** The Mailpit tag the API puts on a sign-in verification email. */
const LOGIN_VERIFICATION_TAG = "login-verification";

/** The id of the newest sign-in verification email Mailpit received at or after `sinceMs`, or `null` when there is none yet. */
async function newestCodeEmailIdSince(sinceMs: number): Promise<string | null> {
	const query = new URLSearchParams({ query: `tag:${LOGIN_VERIFICATION_TAG}`, limit: "1" });
	const [newest] = SearchResponseSchema.parse(await getJson(`/api/v1/search?${query.toString()}`)).messages;
	if (newest === undefined || Date.parse(newest.Created) < sinceMs) {
		return null;
	}
	return newest.ID;
}

/** The six-digit code of the first sign-in verification email received since `requestedAtMs` (a requested code invalidates older ones). */
async function emailedCode(requestedAtMs: number): Promise<string> {
	for (let attempt = 0; attempt < CODE_POLL_ATTEMPTS; attempt += 1) {
		const newestId = await newestCodeEmailIdSince(requestedAtMs);
		if (newestId !== null) {
			const message = MessageSchema.parse(await getJson(`/api/v1/message/${encodeURIComponent(newestId)}`));
			const code = CODE_PATTERN.exec(message.Text)?.groups?.code;
			if (code !== undefined) {
				return code;
			}
		}
		await new Promise<void>((resolve: () => void): void => {
			setTimeout(resolve, CODE_POLL_INTERVAL_MS);
		});
	}
	throw new Error("No sign-in code reached Mailpit");
}

/** Signs the seeded admin in and lands on `pathname` (the login page's `?redirect=`). */
export async function signIn(page: Page, pathname: string): Promise<void> {
	await page.goto(`/auth/login?redirect=${pathname}`);
	await page.getByLabel("Email").fill(adminBrowserE2eEnv.ADMIN_E2E_EMAIL);
	await page.getByLabel("Password", { exact: true }).fill(adminBrowserE2eEnv.ADMIN_E2E_PASSWORD);
	const requestedAtMs = Date.now();
	await page.getByRole("button", { name: "Sign in" }).click();

	const codeInput = page.getByRole("textbox", { name: "Verification code" });
	const landed = page.waitForURL((url: URL) => url.pathname === pathname).then((): boolean => true);
	const challenged = codeInput.waitFor().then((): boolean => false);
	if (!(await Promise.race([landed, challenged]))) {
		await codeInput.fill(await emailedCode(requestedAtMs));
		await page.getByRole("button", { name: "Verify sign-in" }).click();
		await landed;
	}
	await expect(page).toHaveURL((url: URL) => url.pathname === pathname);
}
