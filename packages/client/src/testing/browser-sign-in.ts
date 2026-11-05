// ============================================
// testing/browser-sign-in.ts - signing a browser suite in through an app's login page
// ============================================
// Shared by the admin and merchant Playwright suites (one helper, no drift). The API asks for an emailed
// six-digit code when the sign-in comes from a device it does not recognise yet (login verification,
// `new-device` mode) — a fresh Playwright browser usually is one — so the helper reads the newest sign-in code
// from the local Mailpit inbox and enters it, exactly as a person would. It finds the email by its
// `login-verification` tag, not by recipient: a developer's `EMAIL_TEST_TO` sends every email to their own
// inbox. Mailpit is only asked once the page actually shows the code prompt: a run against an API with
// `LOGIN_VERIFICATION_MODE=disabled` (CI) never needs an inbox, so it must not depend on one being reachable.

import { expect, type Page } from "@playwright/test";
import { JsonValueSchema, type JsonValue } from "@workspace/shared";
import { z } from "zod";

/** How long the emailed code may take to arrive, and how often the inbox is asked. */
const CODE_POLL_ATTEMPTS = 50;
const CODE_POLL_INTERVAL_MS = 200;

const SearchResponseSchema = z.object({ messages: z.array(z.object({ ID: z.string(), Created: z.iso.datetime({ offset: true }) }).loose()) }).loose();
const MessageSchema = z.object({ Text: z.string() }).loose();
const CODE_PATTERN = /\b(?<code>\d{6})\b/;

async function getJson(mailpitUrl: string, path: string): Promise<JsonValue> {
	const response = await fetch(`${mailpitUrl}${path}`);
	if (!response.ok) {
		throw new Error(`Mailpit answered ${String(response.status)} for ${path} — is it running (\`pnpm mailpit\`)?`);
	}
	return JsonValueSchema.parse(await response.json());
}

/** The Mailpit tag the API puts on a sign-in verification email. */
const LOGIN_VERIFICATION_TAG = "login-verification";

/** The id of the newest sign-in verification email Mailpit received at or after `sinceMs`, or `null` when there is none yet. */
async function newestCodeEmailIdSince(mailpitUrl: string, sinceMs: number): Promise<string | null> {
	const query = new URLSearchParams({ query: `tag:${LOGIN_VERIFICATION_TAG}`, limit: "1" });
	const [newest] = SearchResponseSchema.parse(await getJson(mailpitUrl, `/api/v1/search?${query.toString()}`)).messages;
	if (newest === undefined || Date.parse(newest.Created) < sinceMs) {
		return null;
	}
	return newest.ID;
}

/** The six-digit code of the first sign-in verification email received since `requestedAtMs` (a requested code invalidates older ones). */
async function emailedCode(mailpitUrl: string, requestedAtMs: number): Promise<string> {
	for (let attempt = 0; attempt < CODE_POLL_ATTEMPTS; attempt += 1) {
		const newestId = await newestCodeEmailIdSince(mailpitUrl, requestedAtMs);
		if (newestId !== null) {
			const message = MessageSchema.parse(await getJson(mailpitUrl, `/api/v1/message/${encodeURIComponent(newestId)}`));
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

export interface BrowserSignIn {
	readonly email: string;
	readonly password: string;
	/** The local Mailpit the API delivers to (for the emailed code on a new device). */
	readonly mailpitUrl: string;
}

/** Signs in through the app's `/auth/login` and lands on `pathname` (the login page's `?redirect=`). */
export async function signInThroughLoginPage(page: Page, pathname: string, account: BrowserSignIn): Promise<void> {
	await page.goto(`/auth/login?redirect=${pathname}`);
	await page.getByLabel("Email").fill(account.email);
	await page.getByLabel("Password", { exact: true }).fill(account.password);
	const requestedAtMs = Date.now();
	await page.getByRole("button", { name: "Sign in", exact: true }).click();

	const codeInput = page.getByRole("textbox", { name: "Verification code" });
	const landed = page.waitForURL((url: URL) => url.pathname === pathname).then((): boolean => true);
	const challenged = codeInput.waitFor().then((): boolean => false);
	if (!(await Promise.race([landed, challenged]))) {
		await codeInput.fill(await emailedCode(account.mailpitUrl, requestedAtMs));
		await page.getByRole("button", { name: "Verify sign-in" }).click();
		await landed;
	}
	await expect(page).toHaveURL((url: URL) => url.pathname === pathname);
}
