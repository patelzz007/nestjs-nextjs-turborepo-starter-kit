/**
 * Signs a seeded demo account in through the API, for phase C of
 * `pnpm tools dev:timing` (plan §19.1): the representative routes are signed-in
 * pages, so their first compile is only measured when the request carries a
 * real session. The browser client types receive their tokens as httpOnly
 * cookies (docs/technical/api-reference/auth-and-sessions.md), which this
 * module turns into a `Cookie` header for the page request.
 *
 * When the API asks for a login verification code (LOGIN_VERIFICATION_MODE
 * `new-device`/`always`), the code is read from the local Mailpit inbox through
 * the injected `readLoginCode` (`pnpm mail:latest --to <email> --code`,
 * docs/technical/email/mailpit-local-inbox.md).
 */
import { setTimeout as delay } from "node:timers/promises";

import { z } from "zod";

/** The prefix every API route is mounted under. */
export const API_PREFIX = "/api/v1";

/** What a login answer may ask for next. Only the fields this flow branches on are parsed. */
const LoginAnswerSchema = z.object({
	data: z.object({
		requiresVerification: z.literal(true).optional(),
		verificationId: z.string().min(1).optional(),
		requiresTwoFactor: z.literal(true).optional(),
		requiresEnrollment: z.literal(true).optional(),
		enrollmentReason: z.string().optional(),
	}),
});

/** HTTP statuses the login and verify-login endpoints answer on success. */
const LOGIN_SUCCESS_STATUSES = new Set([200, 201]);

/** The API's answer once a client IP used up its login attempts for the window. */
const RATE_LIMITED_STATUS = 429;

/** The login limit's window when the answer names none (`THROTTLE_TTL_MS` default). */
export const DEFAULT_RATE_LIMIT_WAIT_MS = 60_000;

/** Milliseconds in one second: `Retry-After` counts seconds. */
const MS_PER_SECOND = 1000;

/** The throttler names its header after the limit (`Retry-After-LOGIN`); any of them says how long to wait. */
const RETRY_AFTER_HEADER_PREFIX = "retry-after";

const RetryAfterSecondsSchema = z.coerce.number().int().nonnegative();

/**
 * @typedef {{ email: string, password: string, clientType: "web" | "admin" | "merchant", origin: string }} DemoAccount
 * @typedef {(url: string, init: RequestInit) => Promise<Response>} FetchLike
 */

/**
 * How long a 429 asks to wait: the longest `Retry-After*` header in seconds, else the default window.
 *
 * @param {Headers} headers
 * @returns {number}
 */
export function rateLimitWaitMs(headers) {
	let waitSeconds = -1;
	for (const [name, value] of headers) {
		const seconds = RetryAfterSecondsSchema.safeParse(value);
		if (name.toLowerCase().startsWith(RETRY_AFTER_HEADER_PREFIX) && seconds.success) {
			waitSeconds = Math.max(waitSeconds, seconds.data);
		}
	}
	return waitSeconds < 0 ? DEFAULT_RATE_LIMIT_WAIT_MS : waitSeconds * MS_PER_SECOND;
}

/**
 * Posts once and, when the login limit answers 429, waits out its window and posts once more: three
 * runs in a row sign in more often than the per-IP login limit allows in one minute.
 *
 * @param {{ fetchImpl: FetchLike, url: string, init: RequestInit, sleep: (ms: number) => Promise<void> }} options
 * @returns {Promise<Response>}
 */
async function postWaitingOutRateLimit({ fetchImpl, url, init, sleep }) {
	const first = await fetchImpl(url, init);
	if (first.status !== RATE_LIMITED_STATUS) {
		return first;
	}
	await sleep(rateLimitWaitMs(first.headers));
	return fetchImpl(url, init);
}

/**
 * `name=value` pairs of every `Set-Cookie` header, joined for a `Cookie` header.
 *
 * @param {readonly string[]} setCookieHeaders
 * @returns {string}
 */
export function cookieHeaderFrom(setCookieHeaders) {
	return setCookieHeaders
		.map((header) => {
			const [pair = ""] = header.split(";");
			return pair.trim();
		})
		.filter((pair) => pair.includes("="))
		.join("; ");
}

/**
 * @param {DemoAccount} account
 * @returns {Record<string, string>}
 */
function mutationHeaders(account) {
	return {
		"content-type": "application/json",
		origin: account.origin,
		"x-client-type": account.clientType,
		// Browser mutations must declare their intent (CSRF guard); the demo login page sends the same.
		"x-mutation-intent": "same-origin",
	};
}

/**
 * @param {Response} response
 * @param {string} step
 * @returns {Promise<z.infer<typeof LoginAnswerSchema>>}
 */
async function readAnswer(response, step) {
	const text = await response.text();
	if (!LOGIN_SUCCESS_STATUSES.has(response.status)) {
		throw new Error(`${step} answered HTTP ${String(response.status)}: ${text.slice(0, 300)}`);
	}
	return LoginAnswerSchema.parse(JSON.parse(text));
}

/**
 * Signs `account` in and returns the `Cookie` header of the new session.
 *
 * @param {{
 *   apiUrl: string,
 *   account: DemoAccount,
 *   readLoginCode: (email: string, previousCode: string | undefined) => Promise<string>,
 *   readCurrentCode: (email: string) => Promise<string | undefined>,
 *   fetchImpl?: FetchLike,
 *   sleep?: (ms: number) => Promise<void>,
 * }} options
 * @returns {Promise<string>}
 */
export async function signIn({ apiUrl, account, readLoginCode, readCurrentCode, fetchImpl = fetch, sleep = delay }) {
	// The newest code already in the inbox, so a verification step can tell its own fresh code apart from it.
	const previousCode = await readCurrentCode(account.email);
	const loginResponse = await postWaitingOutRateLimit({
		fetchImpl,
		url: `${apiUrl}${API_PREFIX}/auth/login`,
		init: { method: "POST", headers: mutationHeaders(account), body: JSON.stringify({ email: account.email, password: account.password }) },
		sleep,
	});
	const login = await readAnswer(loginResponse, `login as ${account.email}`);
	let sessionResponse = loginResponse;
	let answer = login.data;

	if (answer.requiresVerification === true) {
		if (answer.verificationId === undefined) {
			throw new Error(`login as ${account.email} asked for verification without a verificationId`);
		}
		const code = await readLoginCode(account.email, previousCode);
		sessionResponse = await postWaitingOutRateLimit({
			fetchImpl,
			url: `${apiUrl}${API_PREFIX}/auth/verify-login`,
			init: { method: "POST", headers: mutationHeaders(account), body: JSON.stringify({ verificationId: answer.verificationId, code }) },
			sleep,
		});
		answer = (await readAnswer(sessionResponse, `verify-login for ${account.email}`)).data;
	}
	if (answer.requiresTwoFactor === true) {
		throw new Error(`${account.email} has two-factor authentication enabled; pick a demo account without it`);
	}
	if (answer.requiresEnrollment === true) {
		throw new Error(`${account.email} must finish enrollment (${answer.enrollmentReason ?? "unknown"}) first; its pages would redirect`);
	}
	const cookie = cookieHeaderFrom(sessionResponse.headers.getSetCookie());
	if (cookie.length === 0) {
		throw new Error(`login as ${account.email} set no session cookies`);
	}
	return cookie;
}
