#!/usr/bin/env node
/**
 * Captures the request/response samples of the API reference
 * (`docs/generated/api-samples.json`) by calling a REAL, freshly seeded API —
 * never by hand. Every id, name, code and amount in the samples comes from the
 * `development` seed (`pnpm db:seed`) or from an earlier response in this run.
 *
 * The run CHANGES data (it approves rewards, redeems claims, deletes rows …),
 * so point it at a throwaway database, never at the one you develop against:
 *
 *   createdb docs_api_capture
 *   DATABASE_URL=postgresql://…/docs_api_capture pnpm db:deploy
 *   DATABASE_URL=postgresql://…/docs_api_capture pnpm db:seed
 *   # start the built API on its own port with:
 *   #   DATABASE_URL=…/docs_api_capture PORT=8097 BULLMQ_PREFIX=docs-capture \
 *   #   EMAIL_MODE=log-only LOGIN_VERIFICATION_MODE=disabled TRUST_PROXY=loopback \
 *   #   STORAGE_PROVIDER=local KAFKA_BROKERS= THROTTLE_DEFAULT_LIMIT=100000 \
 *   #   node apps/api/dist/main.js > api.log    (run from apps/api so it reads apps/api/.env)
 *   API_BASE_URL=http://127.0.0.1:8097 API_LOG_FILE=$PWD/api.log SEED_LOG_FILE=$PWD/seed.log \
 *     pnpm --filter @workspace/docs capture:api-samples
 *   (seed.log = the output of the `pnpm db:seed` above, e.g. `pnpm db:seed > seed.log`)
 *   pnpm --filter @workspace/docs docs:api      # re-render docs/technical/api-reference
 *
 * Why those settings:
 *   - EMAIL_MODE=log-only prints every email (verification links, invite links,
 *     claim OTPs) to the log; this script reads one-time tokens from there
 *     (API_LOG_FILE) exactly as a user would read them from their inbox.
 *   - LOGIN_VERIFICATION_MODE=disabled skips the emailed new-device code.
 *   - TRUST_PROXY=loopback lets each persona send its own X-Forwarded-For, so the
 *     per-IP login throttle (5/min) does not stall the run.
 *   - its own BULLMQ_PREFIX keeps the run's jobs away from a dev API on the same Redis.
 *
 * Optional: CAPTURE_STORAGE_CALLBACK_SECRET / CAPTURE_RESEND_WEBHOOK_SECRET (the
 * values the capture API was started with) sign the two machine callbacks; without
 * them those samples show the rejection instead.
 *
 * Samples are made safe to commit: session tokens, signed links, generated API
 * keys and one-time secrets are replaced by `<redacted: …>` markers; every email
 * address outside the documentation/demo domains (e.g. the developer's
 * EMAIL_FROM_ADDRESS / EMAIL_TEST_TO) is rewritten to example.com
 * (src/lib/api-reference/sample-privacy.ts — its test guards the committed file); arrays are cut
 * to their first two items and very long strings are shortened (see `sanitize`).
 */

import { createHash, createHmac, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { neutralizeEmailAddresses } from "../src/lib/api-reference/sample-privacy.ts";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const OUTPUT_FILE = resolve(REPO_ROOT, "docs/generated/api-samples.json");
const BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:8080";
const API_LOG_FILE = process.env.API_LOG_FILE;
/** Output of `pnpm db:seed`: it prints the MFA demo user's (random) TOTP secret and backup code. */
const SEED_LOG_FILE = process.env.SEED_LOG_FILE;
const API_PREFIX = "/api/v1";

/** Frontend origins the API's CORS_ORIGINS allows (apps/api/.env.example). */
const ORIGINS = { web: "http://localhost:3000", admin: "http://localhost:3001", merchant: "http://localhost:3003" };

/** Arrays in samples keep their first items only — enough to show the shape. */
const MAX_SAMPLE_ARRAY_ITEMS = 2;
/** Strings longer than this (rendered HTML, data URLs) are shortened in samples. */
const MAX_SAMPLE_STRING_LENGTH = 400;
const KEPT_STRING_PREFIX_LENGTH = 160;
/** Delay that lets queued work (scans, emails) finish before a dependent step. */
const SETTLE_DELAY_MS = 1500;
const LOG_POLL_ATTEMPTS = 20;
const LOG_POLL_DELAY_MS = 250;

/** RFC 6238 TOTP (authenticator apps): 30-second steps, 6 digits, HMAC-SHA1. */
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const MS_PER_SECOND = 1000;

// ── Seed facts (apps/api/prisma/seed) ───────────────────────────────────────

const SEED = {
	klSlug: "brew-bean-kl",
	mlkSlug: "jonker-street-kitchen",
	klOrganizationId: "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
	mlkOrganizationId: "b57401d5-536e-464f-9ae9-4756b6dd5f61",
	klLocationId: "c178a4d1-6915-4eb3-bf84-6fb14e1feb6d",
	mlkLocationKatilId: "d57401d5-536e-464f-9ae9-4756b6dd5f62",
	mlkLocationBeruangId: "257401d5-536e-464f-9ae9-4756b6dd5f65",
	mlkCashierMembershipId: "157401d5-536e-464f-9ae9-4756b6dd5f64",
	teamInviteToken: "seed_team_invite_token_kl_alice",
	klPosKey:
		"mk_live_IwgbQID2Csq4nbnfwUxVUrQT8lwrlhEz7bzagwasKyFtZYSQ42LSH43lzTfRdBkV7tZArdHQQE4EW0wDHpVAroL57w/+5AzsCxRpax2fmu3JqITATsJKJRi4+fifNVj1E3WswonhsleEBinxwcMOlqccH0suhUq6mJWVvaWYkf8=",
	klTerminalId: "KL-REGISTER-01",
	pendingQrToken: "seed_qr_token_kl_pending_alice_001",
	pendingBackupCode: "ABCD2345",
	sampleFile: resolve(REPO_ROOT, "docs/images/email/welcome.png"),
};

/** The seed accounts this run signs in as (`pnpm db:seed` prints them). */
const ACCOUNTS = {
	superAdmin: { email: "superadmin@example.com", password: "SuperAdmin@123", client: "admin", ip: "203.0.113.10" },
	platformAdmin: { email: "admin@example.com", password: "Admin@123", client: "admin", ip: "203.0.113.22" },
	brewOwner: { email: "brew.owner@kl-rewards.demo", password: "BrewOwner@123", client: "merchant", ip: "203.0.113.11" },
	jonkerOwner: { email: "jonker.owner@melaka-rewards.demo", password: "JonkerOwner@123", client: "merchant", ip: "203.0.113.12" },
	brewCashier: { email: "brew.cashier@kl-rewards.demo", password: "BrewCashier@123", client: "merchant", ip: "203.0.113.13" },
	aliceKl: { email: "alice.kl@kl-rewards.demo", password: "AliceKl@123", client: "merchant", ip: "203.0.113.14" },
	customer: { email: "alice.johnson@example.com", password: "Alice@123", client: "web", ip: "203.0.113.15" },
	david: { email: "david.lee@example.com", password: "David@123", client: "web", ip: "203.0.113.16" },
	henry: { email: "henry.moore@example.com", password: "Henry@123", client: "web", ip: "203.0.113.17" },
	isla: { email: "isla.taylor@example.com", password: "Isla@123", client: "web", ip: "203.0.113.18" },
	jack: { email: "jack.anderson@example.com", password: "Jack@123", client: "web", ip: "203.0.113.19" },
	bob: { email: "bob.smith@example.com", password: "Bob@123", client: "web", ip: "203.0.113.20" },
	frank: { email: "frank.miller@example.com", password: "Frank@123", client: "admin", ip: "203.0.113.21" },
	/** Created by this run's onboarding step (the merchant the admin invited). */
	nyonya: { email: "nyonya.house@melaka-rewards.demo", password: "NyonyaHouse@123", client: "merchant", ip: "203.0.113.23" },
};

// ── Sessions & HTTP ─────────────────────────────────────────────────────────

/** @typedef {{ name: string, label: string, client: string, ip: string, cookies: Map<string, string> }} Session */

/** @param {string} name @param {{ email: string, client: string, ip: string }} account @returns {Session} */
function newSession(name, account) {
	const appName = { web: "web app", admin: "admin panel", merchant: "merchant portal" }[account.client];
	return { name, label: `${account.email} (${appName})`, client: account.client, ip: account.ip, cookies: new Map() };
}

const anonymous = { name: "anonymous", label: "no session", client: "web", ip: "203.0.113.99", cookies: new Map() };

/** @param {Session} session @param {Response} response */
function storeCookies(session, response) {
	for (const cookie of response.headers.getSetCookie()) {
		const [pair] = cookie.split(";");
		const separator = pair.indexOf("=");
		const name = pair.slice(0, separator).trim();
		const value = pair.slice(separator + 1).trim();
		if (value.length === 0 || /Max-Age=0/i.test(cookie)) {
			session.cookies.delete(name);
		} else {
			session.cookies.set(name, value);
		}
	}
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * @param {Session | null} session  null = machine call (POS / callbacks)
 * @param {{ method: string, path: string, query?: Record<string, string>, body?: object, headers?: Record<string, string>, form?: FormData }} request
 */
async function send(session, request) {
	const url = new URL(request.path, BASE_URL);
	for (const [key, value] of Object.entries(request.query ?? {})) {
		url.searchParams.set(key, value);
	}
	const headers = { ...request.headers };
	if (session !== null) {
		headers["X-Client-Type"] = session.client;
		headers["X-Forwarded-For"] = session.ip;
		headers.Origin = ORIGINS[session.client];
		if (MUTATING.has(request.method)) {
			headers["X-Mutation-Intent"] = "same-origin";
		}
		if (session.cookies.size > 0) {
			headers.Cookie = [...session.cookies].map(([name, value]) => `${name}=${value}`).join("; ");
		}
	}
	let body;
	if (request.form !== undefined) {
		body = request.form;
	} else if (request.body !== undefined) {
		headers["Content-Type"] = "application/json";
		body = JSON.stringify(request.body);
	}
	const response = await fetch(url, { method: request.method, headers, body, redirect: "manual" });
	if (session !== null) {
		storeCookies(session, response);
	}
	const contentType = response.headers.get("content-type") ?? "";
	const text = await response.text();
	let json = null;
	if (contentType.includes("json") && text.length > 0) {
		json = JSON.parse(text);
	}
	return { status: response.status, contentType, json, text };
}

// ── Sample recording ────────────────────────────────────────────────────────

/** @type {Record<string, object>} */
const samples = {};
/** @type {string[]} */
const failures = [];

const JWT_PATTERN = /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/;
const SECRET_KEYS = new Set(["token", "tempToken", "secret", "otpauthUrl", "qrCodeUrl", "qrCode", "qrCodeDataUrl", "backupCodes", "apiKey", "rawKey", "plainKey"]);

/** Seed constants that are already public in the seed source may stay in samples. */
const PUBLIC_SEED_VALUES = new Set([SEED.klPosKey, SEED.pendingQrToken, SEED.pendingBackupCode, SEED.teamInviteToken]);

/** The MFA demo user's TOTP secret and unused backup code, as printed by `pnpm db:seed`. */
function readSeedMfaDemo() {
	if (SEED_LOG_FILE === undefined) {
		throw new Error("SEED_LOG_FILE is required: the seed prints the MFA demo user's TOTP secret and backup code");
	}
	const match = /TOTP secret ([A-Z2-7]+) · unused backup code ([A-Z0-9]+)/.exec(readFileSync(SEED_LOG_FILE, "utf8"));
	if (match === null) throw new Error("the seed log has no MFA demo user line");
	return { totpSecret: match[1], backupCode: match[2] };
}

/** @param {string} value */
function redactString(value) {
	// The capture API reads the developer's own apps/api/.env: never publish their addresses.
	value = neutralizeEmailAddresses(value);
	if (PUBLIC_SEED_VALUES.has(value)) return value;
	if (JWT_PATTERN.test(value)) return "<redacted: signed token>";
	if (value.startsWith("mk_live_")) return "mk_live_<redacted: shown once at creation>";
	if (value.startsWith("otpauth://")) return "otpauth://totp/<redacted: authenticator secret>";
	if (value.startsWith("data:")) return `${value.slice(0, value.indexOf(",") + 1)}<redacted: inline data>`;
	if (/[?&](token|X-Amz-Signature|Signature|sig)=/i.test(value)) return value.replace(/([?&](token|X-Amz-Signature|Signature|sig)=)[^&\s"]+/gi, "$1<redacted>");
	if (value.length > MAX_SAMPLE_STRING_LENGTH) return `${value.slice(0, KEPT_STRING_PREFIX_LENGTH)}… <shortened: ${String(value.length)} characters>`;
	return value;
}

/** Recursively makes a JSON value safe and short enough to commit. */
function sanitize(value, key = "") {
	if (Array.isArray(value)) {
		if (SECRET_KEYS.has(key)) return value.map(() => "<redacted: one-time secret>").slice(0, MAX_SAMPLE_ARRAY_ITEMS);
		return value.slice(0, MAX_SAMPLE_ARRAY_ITEMS).map((item) => sanitize(item));
	}
	if (value !== null && typeof value === "object") {
		return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, sanitize(child, childKey)]));
	}
	if (typeof value === "string") {
		if (SECRET_KEYS.has(key) && !PUBLIC_SEED_VALUES.has(value)) return "<redacted: one-time secret>";
		return redactString(value);
	}
	return value;
}

/** Request headers worth showing in a sample (never cookies, never X-Forwarded-For). */
function shownHeaders(session, request) {
	const headers = {};
	if (session !== null) {
		headers["X-Client-Type"] = session.client;
		if (MUTATING.has(request.method)) headers["X-Mutation-Intent"] = "same-origin";
		if (session.cookies.size > 0 || session.name !== "anonymous") headers.Cookie = "<session cookies from POST /api/v1/auth/login>";
	}
	for (const [name, value] of Object.entries(request.headers ?? {})) {
		headers[name] = redactString(value);
	}
	if (request.headers?.["X-API-Key"] !== undefined && request.headers["X-API-Key"] !== SEED.klPosKey) {
		headers["X-API-Key"] = "mk_live_<the key returned by POST /api/v1/pos/terminals/pair>";
	}
	if (request.headers?.["x-storage-callback-secret"] !== undefined) headers["x-storage-callback-secret"] = "<STORAGE_PROCESSING_CALLBACK_SECRET>";
	if (request.headers?.["svix-signature"] !== undefined) headers["svix-signature"] = "v1,<redacted: HMAC of the body with RESEND_WEBHOOK_SECRET>";
	return headers;
}

/**
 * Calls one endpoint and records it as the sample of `operationId`.
 * @param {string} operationId
 * @param {Session | null} session
 * @param {{ method: string, path: string, query?: Record<string, string>, body?: object, headers?: Record<string, string>, form?: FormData, formDescription?: object }} request
 * @param {{ note?: string, expect?: number[], as?: string }} [options]
 */
async function capture(operationId, session, request, options = {}) {
	const response = await send(session, request);
	const expected = options.expect ?? [200, 201];
	if (!expected.includes(response.status)) {
		failures.push(`${operationId}: ${request.method} ${request.path} → ${String(response.status)} ${response.text.slice(0, 300)}`);
		const code = response.json?.error?.code ?? "no error code";
		notCaptured(operationId, `The capture run got ${String(response.status)} ${code} instead of a success response; re-run the capture after fixing it.`);
		return response.json?.data ?? response.json;
	}
	const query = request.query === undefined ? undefined : sanitize(request.query);
	samples[operationId] = {
		as: options.as ?? (session === null ? "a machine client (no session)" : session.label),
		...(options.note === undefined ? {} : { note: options.note }),
		request: {
			method: request.method,
			path: redactString(request.path),
			...(query === undefined ? {} : { query }),
			headers: shownHeaders(session, request),
			...(request.body === undefined ? {} : { body: sanitize(request.body) }),
			...(request.formDescription === undefined ? {} : { body: request.formDescription }),
		},
		response: {
			status: response.status,
			contentType: response.contentType.split(";")[0] ?? "",
			body:
				response.json === null
					? response.text.length === 0
						? null
						: `<${String(response.text.length)} bytes of ${response.contentType.split(";")[0] ?? "data"}>`
					: sanitize(response.json),
		},
	};
	return response.json?.data ?? response.json;
}

/** Records an endpoint that this run deliberately does not call, with the reason. */
function notCaptured(operationId, reason) {
	samples[operationId] = { notCaptured: reason };
}

/** Days of the range the export samples cover (the 30 days before the capture run). */
const EXPORT_SAMPLE_DAYS = 30;
const EXPORT_SAMPLE_DAY_MS = 86_400_000;
const EXPORT_SAMPLE_NOTE =
	"The body is the file itself (Content-Type of the format, Content-Disposition: attachment; filename=…); errors keep the JSON error envelope. See docs/technical/api/analytics.md.";

/** `from` / `to` (epoch ms, as query strings) of the 30 days before now — exports require both. */
function analyticsExportRange() {
	const to = Date.now();
	return { from: String(to - EXPORT_SAMPLE_DAYS * EXPORT_SAMPLE_DAY_MS), to: String(to) };
}

// ── Helpers: login, log scraping, TOTP, files ───────────────────────────────

/** The credentials request every sign-in sends (`POST /auth/login`) for a seed account. */
function loginRequest(name) {
	const account = ACCOUNTS[name];
	return { method: "POST", path: api("/auth/login"), body: { email: account.email, password: account.password } };
}

async function login(name) {
	const account = ACCOUNTS[name];
	const session = newSession(name, account);
	const response = await send(session, loginRequest(name));
	if (response.status !== 200 && response.status !== 201) {
		throw new Error(`login ${account.email} failed: ${String(response.status)} ${response.text}`);
	}
	return session;
}

function readLog() {
	if (API_LOG_FILE === undefined) {
		throw new Error("API_LOG_FILE is required: the run reads emailed one-time tokens from the API's log-only output");
	}
	// eslint-disable-next-line no-control-regex -- strips ANSI colour codes from the Nest logger output
	return readFileSync(API_LOG_FILE, "utf8").replace(/\u001b\[[0-9;]*m/g, "");
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** Waits for the next log match after `offset` (emails are written right after the response). */
async function nextFromLog(pattern, offset) {
	for (let attempt = 0; attempt < LOG_POLL_ATTEMPTS; attempt += 1) {
		const matches = [...readLog().slice(offset).matchAll(pattern)];
		const last = matches.at(-1);
		if (last !== undefined) return last[1];
		await sleep(LOG_POLL_DELAY_MS);
	}
	throw new Error(`no ${String(pattern)} in the API log`);
}

const logOffset = () => readLog().length;

/** Verifies a seed account's email the way its owner would: resend, then open the emailed link. */
let verificationCount = 0;
async function verifyEmailOf(email) {
	// Its own client IP: resend-verification is throttled per IP.
	verificationCount += 1;
	const visitor = newSession("visitor", { email, client: "web", ip: `198.51.100.${String(verificationCount)}` });
	const offset = logOffset();
	await send(visitor, { method: "POST", path: api("/auth/resend-verification"), body: { email } });
	const token = await nextFromLog(/verify-email\?token=([\w.-]+)/g, offset);
	await send(visitor, { method: "POST", path: api("/auth/verify-email"), body: { token } });
}

function base32Decode(input) {
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
	let bits = "";
	for (const character of input.replace(/=+$/, "").toUpperCase()) {
		bits += alphabet.indexOf(character).toString(2).padStart(5, "0");
	}
	const bytes = [];
	for (let index = 0; index + 8 <= bits.length; index += 8) {
		bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
	}
	return Buffer.from(bytes);
}

/** TOTP time step of `atMs`. */
const totpStep = (atMs) => Math.floor(atMs / MS_PER_SECOND / TOTP_STEP_SECONDS);
/** Last step each secret was used in: the API rejects a code replayed within its step. */
const lastTotpStep = new Map();

async function totp(secret) {
	while (lastTotpStep.get(secret) === totpStep(Date.now())) {
		await sleep(LOG_POLL_DELAY_MS);
	}
	const step = totpStep(Date.now());
	lastTotpStep.set(secret, step);
	const counter = Buffer.alloc(8);
	counter.writeBigUInt64BE(BigInt(step));
	const digest = createHmac("sha1", base32Decode(secret)).update(counter).digest();
	const offset = digest[digest.length - 1] & 0x0f;
	const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 10 ** TOTP_DIGITS;
	return String(code).padStart(TOTP_DIGITS, "0");
}

const sampleBytes = readFileSync(SEED.sampleFile);
const sampleChecksum = createHash("sha256").update(sampleBytes).digest("hex");
const sampleFileInfo = { fileName: "welcome.png", mimeType: "image/png", sizeBytes: sampleBytes.length, checksumSha256: sampleChecksum };

/** Sends the bytes to an upload ticket (local provider: the API's /files/:id/local-upload). */
async function uploadToTicket(ticket) {
	const form = new FormData();
	for (const [name, value] of Object.entries(ticket.fields ?? {})) form.set(name, value);
	form.set("file", new Blob([sampleBytes], { type: "image/png" }), "welcome.png");
	const url = new URL(ticket.uploadUrl ?? ticket.url);
	return { path: `${url.pathname}${url.search}`, form, fields: ticket.fields ?? {} };
}

const api = (path) => `${API_PREFIX}${path}`;

/** The list inside a response `data` (a bare array, or the first array property of an object). */
/** Ids of the rows a bulk-create answered with (a bare array, or `{ items }` / `{ created }`). */
function idsOf(created) {
	return (Array.isArray(created) ? created : (created?.items ?? created?.created ?? [])).map((item) => item.id).filter(Boolean);
}

function firstArray(value) {
	if (Array.isArray(value)) return value;
	if (value !== null && typeof value === "object") return Object.values(value).find((child) => Array.isArray(child)) ?? [];
	return [];
}

// ── The run ─────────────────────────────────────────────────────────────────

async function captureSystem() {
	await capture("HealthController_getHello", anonymous, { method: "GET", path: "/" });
	await capture("HealthController_getHealth", anonymous, { method: "GET", path: "/health" });
	await capture("HealthController_getLiveness", anonymous, { method: "GET", path: "/health/live" });
	await capture("HealthController_getReadiness", anonymous, { method: "GET", path: "/health/ready" });
	await capture("HealthController_getDeepHealth", anonymous, { method: "GET", path: "/health/deep" });
	await capture("VersionController_getVersion", anonymous, { method: "GET", path: "/version" });
}

async function captureAuth(context) {
	const superAdmin = await capture("AuthController_login", newSession("superAdmin", ACCOUNTS.superAdmin), loginRequest("superAdmin"));
	void superAdmin;
	const admin = await login("superAdmin");
	context.admin = admin;
	await capture("AuthController_getMe", admin, { method: "GET", path: api("/auth/me") });
	await capture("AuthController_getSessionPermissions", admin, { method: "GET", path: api("/auth/permissions") });
	await capture("SessionStatusController_getSession", admin, { method: "GET", path: api("/session") });
	await capture("SessionsController_getSessions", admin, { method: "GET", path: api("/auth/sessions") });
	await capture("SessionsController_refreshToken", admin, { method: "POST", path: api("/auth/refresh") });
	const profile = await capture("ProfileController_getOwnProfile", admin, { method: "GET", path: api("/auth/profile") });
	await capture("ProfileController_updateOwnProfile", admin, { method: "PATCH", path: api("/auth/profile"), body: { fullName: profile.fullName, version: profile.version } });

	const users = await capture("AuthController_getAdminUsersList", admin, { method: "GET", path: api("/auth/admin/users"), query: { limit: "5", search: "example.com" } });
	const allUsers = await send(admin, { method: "GET", path: api("/auth/admin/users"), query: { limit: "100" } });
	context.userIds = Object.fromEntries(firstArray(allUsers.json?.data).map((user) => [user.email, user.id]));
	void users;
	const grace = await send(admin, { method: "GET", path: api("/auth/admin/users"), query: { search: "grace.wilson" } });
	const graceId = grace.json?.data?.[0]?.id;
	await capture("AuthController_getAdminUserDetail", admin, { method: "GET", path: api(`/auth/admin/users/${graceId}`) });
	await capture("AuthController_unlockUser", admin, { method: "PATCH", path: api(`/auth/admin/users/${graceId}/unlock`) });

	// Email verification: resend → link from the log → verify (alice.johnson is unverified in the seed).
	let offset = logOffset();
	await capture("AuthController_resendVerification", anonymous, { method: "POST", path: api("/auth/resend-verification"), body: { email: ACCOUNTS.customer.email } });
	const verifyToken = await nextFromLog(/verify-email\?token=([\w.-]+)/g, offset);
	await capture("AuthController_verifyEmail", anonymous, { method: "POST", path: api("/auth/verify-email"), body: { token: verifyToken } });

	// Password reset for isla.taylor (seed account): forgot → link from the log → validate → reset.
	offset = logOffset();
	await capture("AuthController_forgotPassword", anonymous, { method: "POST", path: api("/auth/forgot-password"), body: { email: ACCOUNTS.isla.email } });
	const resetToken = await nextFromLog(/reset-password\?token=([\w.-]+)/g, offset);
	await capture("AuthController_validateResetToken", anonymous, { method: "POST", path: api("/auth/validate-reset-token"), body: { token: resetToken } });
	await capture("AuthController_resetPassword", anonymous, { method: "POST", path: api("/auth/reset-password"), body: { token: resetToken, password: "Isla@123-Reset" } });

	const cashier = await login("brewCashier");
	await capture("AuthController_changePassword", cashier, {
		method: "POST",
		path: api("/auth/change-password"),
		body: { currentPassword: ACCOUNTS.brewCashier.password, newPassword: "BrewCashier@2026", confirmPassword: "BrewCashier@2026" },
	});

	await capture(
		"AuthController_signup",
		newSession("signup", { email: "signup", client: "web", ip: "203.0.113.30" }),
		{ method: "POST", path: api("/auth/signup"), body: { email: "pending.invite@melaka-rewards.demo", fullName: "Nyonya Pending Invitee", password: "Nyonya@123" } },
		{ note: "Signs up the seed's pending Jonker Street Kitchen invitee (pending.invite@melaka-rewards.demo), who has no account yet." },
	);
	notCaptured(
		"AuthController_verifyLogin",
		"Needs the emailed new-device code; the capture API runs with LOGIN_VERIFICATION_MODE=disabled. Request: { verificationId (from the login response), code (from the email) }.",
	);

	// Two-factor login with the seed's MFA demo user (david.lee: TOTP secret + unused backup code are printed by the seed).
	const mfaDemo = readSeedMfaDemo();
	const davidPending = newSession("david", ACCOUNTS.david);
	const firstStep = await send(davidPending, loginRequest("david"));
	await capture("TwoFactorController_loginWithTwoFactor", davidPending, {
		method: "POST",
		path: api("/auth/login/2fa"),
		body: { tempToken: firstStep.json?.data?.tempToken, token: await totp(mfaDemo.totpSecret) },
	});
	await capture("TwoFactorController_getBackupCodesRemaining", davidPending, { method: "GET", path: api("/auth/2fa/backup-codes/remaining") });
	const davidBackup = newSession("david", ACCOUNTS.david);
	const secondStep = await send(davidBackup, loginRequest("david"));
	await capture("TwoFactorController_loginWithBackupCode", davidBackup, {
		method: "POST",
		path: api("/auth/login/backup-code"),
		body: { tempToken: secondStep.json?.data?.tempToken, backupCode: mfaDemo.backupCode },
	});
	context.david = davidPending;

	// Enrollment for henry.moore (the seed's mid-enrollment user): setup → enable → verify a backup code → rotate.
	await verifyEmailOf(ACCOUNTS.henry.email);
	const henry = newSession("henry", ACCOUNTS.henry);
	await send(henry, loginRequest("henry"));
	const setup = await capture("TwoFactorController_startSetup", henry, { method: "POST", path: api("/auth/2fa/setup"), body: {} });
	const henrySecret = setup?.secret ?? setup?.manualEntryKey ?? new URL(setup?.otpauthUrl ?? "otpauth://x?secret=").searchParams.get("secret");
	await capture("TwoFactorController_enableTwoFactor", henry, { method: "POST", path: api("/auth/2fa/enable"), body: { token: await totp(henrySecret) } });
	const henryBackupCodes = setup?.backupCodes ?? [];
	// Enabling 2FA revokes the old tokens: sign in again, now with the second factor.
	const henryStep = await send(henry, loginRequest("henry"));
	await send(henry, { method: "POST", path: api("/auth/login/2fa"), body: { tempToken: henryStep.json?.data?.tempToken, token: await totp(henrySecret) } });
	await capture("TwoFactorController_verifyBackupCode", henry, { method: "POST", path: api("/auth/2fa/verify-backup-code"), body: { backupCode: henryBackupCodes[0] } });
	await capture("TwoFactorController_rotateTwoFactor", henry, {
		method: "POST",
		path: api("/auth/2fa/rotate"),
		body: { password: ACCOUNTS.henry.password, backupCode: henryBackupCodes[1] },
	});

	// MFA recovery: david asks, the SuperAdmin reviews.
	await capture("MfaRecoveryController_initiateRecovery", davidPending, { method: "POST", path: api("/auth/mfa/recovery"), body: { reason: "Lost my phone" } });
	await capture("MfaRecoveryController_getRecoveryStatus", davidPending, { method: "GET", path: api("/auth/mfa/recovery/status") });
	const requests = await capture("MfaRecoveryController_listRecoveryRequests", admin, { method: "GET", path: api("/auth/admin/mfa/recovery/requests") });
	const pending = (requests ?? []).find((request) => request.status === "PENDING") ?? requests?.[0];
	await capture("MfaRecoveryController_reviewRecovery", admin, {
		method: "POST",
		path: api("/auth/admin/mfa/recovery/review"),
		body: { requestId: pending?.id, action: "deny", notes: "Identity not confirmed" },
	});

	const leaving = await login("bob");
	await capture("SessionsController_logout", leaving, { method: "POST", path: api("/auth/logout") });
	const leavingEverywhere = await login("frank");
	await capture("SessionsController_logoutAll", leavingEverywhere, { method: "POST", path: api("/auth/logout-all") });
}

async function captureRbac(context) {
	const { admin } = context;
	const permissions = await capture("PermissionsController_list", admin, { method: "GET", path: api("/admin/permissions"), query: { limit: "3" } });
	const allPermissions = await send(admin, { method: "GET", path: api("/admin/permissions"), query: { limit: "100" } });
	const readGeo = firstArray(allPermissions.json?.data).find((permission) => permission.action === "READ" && permission.resource === "GEO") ?? permissions?.[0];
	await capture("PermissionsController_detail", admin, { method: "GET", path: api(`/admin/permissions/${readGeo.id}`) });
	await capture("PermissionsController_listGroups", admin, { method: "GET", path: api("/admin/permissions/groups/list") });
	await capture("PermissionsController_checkPermission", admin, {
		method: "POST",
		path: api("/admin/permissions/check"),
		body: { userId: context.userIds["manager@example.com"], action: "READ", resource: "GEO" },
	});
	const existing = new Set(firstArray(allPermissions.json?.data).map((permission) => `${permission.action}:${permission.resource}`));
	const freeResource = ["REPORT", "INVENTORY", "ORDER", "PAYMENT", "DEVTOOLS", "STORE"].find((resource) => !existing.has(`MANAGE:${resource}`)) ?? "REPORT";
	const created = await capture("PermissionsController_create", admin, {
		method: "POST",
		path: api("/admin/permissions"),
		body: { action: "MANAGE", resource: freeResource, group: "Reports", description: `Manage ${freeResource.toLowerCase()} records` },
	});
	await capture("PermissionsController_update", admin, {
		method: "PATCH",
		path: api(`/admin/permissions/${created?.id}`),
		body: { description: `Manage every ${freeResource.toLowerCase()} record` },
	});
	await capture("PermissionsController_remove", admin, { method: "DELETE", path: api(`/admin/permissions/${created?.id}`) });
	await capture("PermissionsController_restore", admin, { method: "POST", path: api(`/admin/permissions/${created?.id}/restore`) });
	const managerId = context.userIds["manager@example.com"];
	await capture("PermissionsController_grantToUser", admin, {
		method: "POST",
		path: api("/admin/permissions/user/grant"),
		body: { userId: managerId, permissionId: readGeo.id, effect: "ALLOW" },
	});
	await capture("PermissionsController_revokeFromUser", admin, {
		method: "POST",
		path: api("/admin/permissions/user/revoke"),
		body: { userId: managerId, permissionId: readGeo.id },
	});
	await capture("PermissionsController_syncUserPermissions", admin, {
		method: "POST",
		path: api("/admin/permissions/user/sync"),
		body: { userId: managerId, permissionIds: [readGeo.id] },
	});

	await capture("RolesController_list", admin, { method: "GET", path: api("/admin/roles") });
	const rolesResponse = await send(admin, { method: "GET", path: api("/admin/roles"), query: { limit: "100" } });
	const roleList = firstArray(rolesResponse.json?.data);
	const managerRole = roleList.find((role) => role.name === "Manager");
	const userRole = roleList.find((role) => role.name === "User");
	await capture("RolesController_detail", admin, { method: "GET", path: api(`/admin/roles/${managerRole.id}`) });
	const role = await capture("RolesController_create", admin, {
		method: "POST",
		path: api("/admin/roles"),
		body: { name: "Store Auditor", description: "Reads geography and audit data for store reviews", parentId: userRole.id },
	});
	await capture("RolesController_update", admin, {
		method: "PATCH",
		path: api(`/admin/roles/${role?.id}`),
		body: { description: "Reads geography, audit and analytics data for store reviews" },
	});
	await capture("RolesController_setParent", admin, { method: "PATCH", path: api(`/admin/roles/${role?.id}/parent`), body: { parentId: managerRole.id } });
	await capture("RolesController_syncPermissions", admin, { method: "POST", path: api(`/admin/roles/${role?.id}/permissions`), body: { permissionIds: [readGeo.id] } });
	const isla = context.userIds["isla.taylor@example.com"];
	await capture("RolesController_validateAssignment", admin, {
		method: "POST",
		path: api(`/admin/roles/${role?.id}/validate-assignment`),
		body: { userId: isla, roleIds: [role?.id] },
	});
	await capture("RolesController_preview", admin, { method: "POST", path: api("/admin/roles/preview"), body: { userId: isla, roleIds: [userRole.id, role?.id] } });
	await capture("RolesController_assignRoleToUser", admin, { method: "POST", path: api("/admin/roles/user/assign"), body: { userId: isla, roleId: role?.id } });
	await capture("RolesController_removeRoleFromUser", admin, { method: "POST", path: api("/admin/roles/user/remove"), body: { userId: isla, roleId: role?.id } });
	await capture("RolesController_syncUserRoles", admin, { method: "POST", path: api("/admin/roles/user/sync"), body: { userId: isla, roleIds: [userRole.id] } });
	await capture("RolesController_remove", admin, { method: "DELETE", path: api(`/admin/roles/${role?.id}`) });
	await capture("RolesController_restore", admin, { method: "POST", path: api(`/admin/roles/${role?.id}/restore`) });

	await capture("AuthorizationDecisionsController_decide", admin, {
		method: "POST",
		path: api("/authorization/decisions"),
		body: {
			checks: [
				{ action: "READ", resource: "GEO" },
				{ action: "READ", resource: "ANALYTICS" },
			],
		},
	});
	await capture("AuthorizationDecisionsController_explain", admin, {
		method: "GET",
		path: api("/authorization/decisions/explain"),
		query: { action: "READ", resource: "GEO", userId: managerId },
	});
	await capture("CapabilitiesCatalogController_listCatalog", admin, { method: "GET", path: api("/capabilities/catalog") });
	await capture("AuditController_list", admin, { method: "GET", path: api("/admin/audit"), query: { limit: "2" } });

	const author = admin;
	const draft = await capture("PolicyControlPlaneController_createDraft", author, {
		method: "POST",
		path: api("/policies/drafts"),
		body: {
			name: "Brew & Bean KL — owners and admins manage rewards",
			description: "Tenant role-capability policy for Brew & Bean KL",
			scope: "TENANT",
			organizationId: SEED.klOrganizationId,
			builderPayload: { templateId: "tenant.role_capability", parameters: { allowedRoles: ["OWNER", "ADMIN"] } },
		},
	});
	await capture("PolicyControlPlaneController_simulate", author, { method: "POST", path: api(`/policies/drafts/${draft?.draftId}/simulate`) });
	await capture(
		"PolicyControlPlaneController_publish",
		admin,
		{ method: "POST", path: api("/policies/publish"), body: { draftId: draft?.draftId, approvalNote: "Reviewed against the tenant guardrails" } },
		{
			note: "Four-eyes rule: a draft is published by a SECOND SuperAdmin. The seed has one SuperAdmin, so this sample shows the author being refused; a different SuperAdmin gets 201 with the published policy.",
			expect: [201, 403, 409],
		},
	);
}

async function captureGeo(context) {
	const { admin } = context;
	await capture("GeoController_getStats", admin, { method: "GET", path: api("/geo/stats") });
	const regions = await capture("GeoController_listRegions", admin, { method: "GET", path: api("/geo/regions"), query: { limit: "2" } });
	const region = regions?.[0];
	await capture("GeoController_getRegion", admin, { method: "GET", path: api(`/geo/regions/${region?.id}`) });
	const subregions = await capture("GeoController_listSubregions", admin, { method: "GET", path: api("/geo/subregions"), query: { limit: "2" } });
	await capture("GeoController_getSubregion", admin, { method: "GET", path: api(`/geo/subregions/${subregions?.[0]?.id}`) });
	const countries = await capture("GeoController_listCountries", admin, { method: "GET", path: api("/geo/countries"), query: { "filter[iso2]": "MY", limit: "2" } });
	const malaysia = countries?.[0];
	await capture("GeoController_getCountry", admin, { method: "GET", path: api(`/geo/countries/${malaysia?.id}`) });
	const states = await capture("GeoController_listStates", admin, {
		method: "GET",
		path: api("/geo/states"),
		query: { "filter[countryCode]": "MY", sort: "name", limit: "2" },
	});
	const melaka = states?.[0];
	await capture("GeoController_getState", admin, { method: "GET", path: api(`/geo/states/${melaka?.id}`) });
	const cities = await capture("GeoController_listCities", admin, {
		method: "GET",
		path: api("/geo/cities"),
		query: { "filter[countryCode]": "MY", sort: "name", limit: "2" },
	});
	const kualaLumpur = cities?.[0];
	await capture("GeoController_getCity", admin, { method: "GET", path: api(`/geo/cities/${kualaLumpur?.id}`) });
	await capture("GeoController_autocomplete", admin, { method: "GET", path: api("/geo/autocomplete"), query: { q: "Melaka", limit: "3" } });
	await capture("GeoController_cascadePreview", admin, { method: "GET", path: api("/geo/cascade-preview"), query: { entity: "state", id: String(melaka?.id) } });
	await capture("GeoController_exportData", admin, { method: "GET", path: api("/geo/export"), query: { format: "json", countryCode: "MY" } });

	// Create → update → delete one of each level, copying real values from the seeded rows.
	const newRegion = await capture("GeoController_createRegion", admin, { method: "POST", path: api("/geo/regions"), body: { name: `${region?.name} (copy)` } });
	await capture("GeoController_updateRegion", admin, { method: "PATCH", path: api(`/geo/regions/${newRegion?.id}`), body: { name: `${region?.name} (renamed copy)` } });
	const newSubregion = await capture("GeoController_createSubregion", admin, {
		method: "POST",
		path: api("/geo/subregions"),
		body: { name: `${subregions?.[0]?.name} (copy)`, regionId: newRegion?.id },
	});
	await capture("GeoController_updateSubregion", admin, {
		method: "PATCH",
		path: api(`/geo/subregions/${newSubregion?.id}`),
		body: { name: `${subregions?.[0]?.name} (renamed copy)` },
	});
	const newCountry = await capture("GeoController_createCountry", admin, {
		method: "POST",
		path: api("/geo/countries"),
		body: { name: `${malaysia?.name} (copy)`, regionId: newRegion?.id, subregionId: newSubregion?.id },
	});
	await capture("GeoController_updateCountry", admin, {
		method: "PATCH",
		path: api(`/geo/countries/${newCountry?.id}`),
		body: { capital: malaysia?.capital ?? "Kuala Lumpur" },
	});
	const newState = await capture("GeoController_createState", admin, {
		method: "POST",
		path: api("/geo/states"),
		body: { name: `${melaka?.name} (copy)`, countryId: newCountry?.id, countryCode: malaysia?.iso2 ?? "MY" },
	});
	await capture("GeoController_updateState", admin, { method: "PATCH", path: api(`/geo/states/${newState?.id}`), body: { timezone: "Asia/Kuala_Lumpur" } });
	const newCity = await capture("GeoController_createCity", admin, {
		method: "POST",
		path: api("/geo/cities"),
		body: {
			name: `${kualaLumpur?.name} (copy)`,
			stateId: newState?.id,
			stateCode: melaka?.iso2 ?? "04",
			countryId: newCountry?.id,
			countryCode: malaysia?.iso2 ?? "MY",
			latitude: kualaLumpur?.latitude ?? 3.1478,
			longitude: kualaLumpur?.longitude ?? 101.6953,
		},
	});
	await capture("GeoController_updateCity", admin, { method: "PATCH", path: api(`/geo/cities/${newCity?.id}`), body: { timezone: "Asia/Kuala_Lumpur" } });
	await capture("GeoController_deleteCity", admin, { method: "DELETE", path: api(`/geo/cities/${newCity?.id}`) });
	await capture("GeoController_deleteState", admin, { method: "DELETE", path: api(`/geo/states/${newState?.id}`) });
	await capture("GeoController_deleteCountry", admin, { method: "DELETE", path: api(`/geo/countries/${newCountry?.id}`) });
	await capture("GeoController_deleteSubregion", admin, { method: "DELETE", path: api(`/geo/subregions/${newSubregion?.id}`) });
	await capture("GeoController_deleteRegion", admin, { method: "DELETE", path: api(`/geo/regions/${newRegion?.id}`) });

	// Import: validate and upsert the exported region row (same data in, nothing invented).
	const regionRow = { name: region?.name, ...(region?.wikiDataId ? { wikiDataId: region.wikiDataId } : {}) };
	await capture("GeoController_validateImport", admin, { method: "POST", path: api("/geo/import/validate"), body: { entity: "region", data: [regionRow] } });
	await capture("GeoController_importData", admin, { method: "POST", path: api("/geo/import"), body: { entity: "region", data: [regionRow], upsert: true } });
}

async function captureCatalog(context) {
	const { admin } = context;
	const categories = await capture("SampleCategoryController_list", admin, { method: "GET", path: api("/sample-category"), query: { limit: "2" } });
	const category = categories?.[0];
	await capture("SampleCategoryController_get", admin, { method: "GET", path: api(`/sample-category/${category?.id}`) });
	const newCategory = await capture("SampleCategoryController_create", admin, {
		method: "POST",
		path: api("/sample-category"),
		body: { name: `${category?.name} Archive`, slug: `${category?.slug}-archive`, description: category?.description ?? undefined },
	});
	await capture("SampleCategoryController_update", admin, {
		method: "PATCH",
		path: api(`/sample-category/${newCategory?.id}`),
		body: { isActive: false, version: newCategory?.version },
	});
	await capture("SampleCategoryController_delete", admin, { method: "DELETE", path: api(`/sample-category/${newCategory?.id}`) });
	await capture("SampleCategoryController_restore", admin, { method: "POST", path: api(`/sample-category/${newCategory?.id}/restore`) });
	const bulk = await capture("SampleCategoryController_bulkCreate", admin, {
		method: "POST",
		path: api("/sample-category/bulk"),
		body: { items: [{ name: `${categories?.[1]?.name} Archive`, slug: `${categories?.[1]?.slug}-archive` }] },
	});
	const bulkIds = idsOf(bulk);
	await capture("SampleCategoryController_bulkDelete", admin, { method: "POST", path: api("/sample-category/bulk-delete"), body: { ids: [newCategory?.id, ...bulkIds] } });

	const products = await capture("ProductController_list", admin, { method: "GET", path: api("/product"), query: { limit: "2" } });
	const product = products?.[0];
	await capture("ProductController_get", admin, { method: "GET", path: api(`/product/${product?.id}`) });
	const productCopy = {
		name: `${product?.name} (Bundle)`,
		slug: `${product?.slug}-bundle`,
		sku: `${product?.sku}-B`,
		price: product?.price,
		categoryId: product?.categoryId ?? category?.id,
	};
	const newProduct = await capture("ProductController_create", admin, { method: "POST", path: api("/product"), body: productCopy });
	await capture("ProductController_update", admin, { method: "PATCH", path: api(`/product/${newProduct?.id}`), body: { isFeatured: true, version: newProduct?.version } });
	await capture("ProductController_delete", admin, { method: "DELETE", path: api(`/product/${newProduct?.id}`) });
	await capture("ProductController_restore", admin, { method: "POST", path: api(`/product/${newProduct?.id}/restore`) });
	const secondProduct = products?.[1];
	const productBulk = await capture("ProductController_bulkCreate", admin, {
		method: "POST",
		path: api("/product/bulk"),
		body: {
			items: [
				{
					name: `${secondProduct?.name} (Bundle)`,
					slug: `${secondProduct?.slug}-bundle`,
					sku: `${secondProduct?.sku}-B`,
					price: secondProduct?.price,
					categoryId: secondProduct?.categoryId ?? category?.id,
				},
			],
		},
	});
	const productBulkIds = idsOf(productBulk);
	await capture("ProductController_bulkDelete", admin, { method: "POST", path: api("/product/bulk-delete"), body: { ids: [newProduct?.id, ...productBulkIds] } });
}

async function captureEmail(context) {
	const { admin } = context;
	await capture("EmailLogController_list", admin, { method: "GET", path: api("/notifications/email-log"), query: { limit: "2" } });
	notCaptured(
		"EmailLogController_stream",
		"Server-Sent Events stream (text/event-stream) that stays open; each event carries one changed email-log row in the shape of GET /notifications/email-log items.",
	);
	const previews = await capture("EmailPreviewController_list", admin, { method: "GET", path: api("/notifications/email-preview") });
	const key = (Array.isArray(previews) ? previews : (previews?.templates ?? []))[0]?.key ?? "welcome";
	await capture("EmailPreviewController_detail", admin, { method: "GET", path: api(`/notifications/email-preview/${key}`) });
	await capture("EmailPreviewController_sendTest", admin, { method: "POST", path: api(`/notifications/email-preview/${key}/send`) });
	await capture("EmailWebhookController_info", anonymous, { method: "GET", path: "/notifications/email-webhook" });

	const secret = process.env.CAPTURE_RESEND_WEBHOOK_SECRET;
	const log = await send(admin, { method: "GET", path: api("/notifications/email-log"), query: { limit: "1" } });
	const providerId = log.json?.data?.[0]?.providerMessageId ?? log.json?.data?.[0]?.resendId ?? "seed";
	const event = { type: "email.delivered", created_at: new Date().toISOString(), data: { email_id: providerId, to: [log.json?.data?.[0]?.to ?? "superadmin@example.com"] } };
	const body = JSON.stringify(event);
	const messageId = `msg_${randomUUID().replaceAll("-", "")}`;
	const timestamp = String(Math.floor(Date.now() / MS_PER_SECOND));
	const headers = { "svix-id": messageId, "svix-timestamp": timestamp };
	if (secret !== undefined) {
		const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
		headers["svix-signature"] = `v1,${createHmac("sha256", key).update(`${messageId}.${timestamp}.${body}`).digest("base64")}`;
	}
	await capture(
		"EmailWebhookController_receive",
		null,
		{ method: "POST", path: "/notifications/email-webhook", headers, body: event },
		{ expect: secret === undefined ? [400, 401, 403] : [200, 201], as: "Resend (signed delivery webhook)" },
	);
}

async function captureFiles(context) {
	const { admin } = context;
	const ticket = await capture("FilesController_createUploadUrl", admin, {
		method: "POST",
		path: api("/files/upload-url"),
		body: { category: "USER_AVATAR", ...sampleFileInfo, userId: context.userIds["superadmin@example.com"] },
	});
	const upload = await uploadToTicket(ticket?.upload ?? ticket);
	const fileId = ticket?.fileId ?? ticket?.file?.id ?? ticket?.id;
	await capture(
		"LocalStorageTransferController_localUpload",
		null,
		{
			method: "POST",
			path: upload.path,
			form: upload.form,
			formDescription: { "multipart/form-data": { ...sanitize(upload.fields), file: "<the image bytes: welcome.png, image/png>" } },
		},
		{ as: "the browser, posting to the upload ticket (no session needed)" },
	);
	await capture("FilesController_completeUpload", admin, { method: "POST", path: api(`/files/${fileId}/complete`), body: { checksumSha256: sampleChecksum } });
	await sleep(SETTLE_DELAY_MS);
	await capture("FilesController_getFile", admin, { method: "GET", path: api(`/files/${fileId}`) });
	const download = await capture("FilesController_getDownloadUrl", admin, { method: "GET", path: api(`/files/${fileId}/download-url`) });
	const downloadUrl = new URL(download?.url ?? download?.downloadUrl ?? `${BASE_URL}/files/local-download?token=missing`);
	await capture(
		"LocalStorageTransferController_localDownload",
		null,
		{
			method: "GET",
			path: downloadUrl.pathname,
			query: Object.fromEntries(downloadUrl.searchParams),
		},
		{ as: "the browser, following the signed download link (no session needed)" },
	);
	context.avatarFileId = fileId;

	// A public asset (product image) to show the local public route.
	const products = await send(admin, { method: "GET", path: api("/product"), query: { limit: "1" } });
	const productId = products.json?.data?.[0]?.id;
	const publicTicket = await send(admin, { method: "POST", path: api("/files/upload-url"), body: { category: "PRODUCT_IMAGE", ...sampleFileInfo, productId } });
	const publicData = publicTicket.json?.data;
	const publicUpload = await uploadToTicket(publicData?.upload ?? publicData);
	const publicFileId = publicData?.fileId ?? publicData?.file?.id ?? publicData?.id;
	await send(null, { method: "POST", path: publicUpload.path, form: publicUpload.form });
	await send(admin, { method: "POST", path: api(`/files/${publicFileId}/complete`), body: { checksumSha256: sampleChecksum } });
	await sleep(SETTLE_DELAY_MS);
	await capture("LocalStorageTransferController_localPublic", anonymous, { method: "GET", path: api(`/files/${publicFileId}/local-public`) });

	const callbackSecret = process.env.CAPTURE_STORAGE_CALLBACK_SECRET;
	await capture(
		"FilesController_processingCallback",
		null,
		{
			method: "POST",
			path: api("/files/processing-callback"),
			headers: callbackSecret === undefined ? {} : { "x-storage-callback-secret": callbackSecret },
			body: { fileId: publicFileId, status: "READY", scanStatus: "CLEAN" },
		},
		{
			expect: callbackSecret === undefined ? [401, 403] : [200, 201, 409],
			as: "the malware-scanning service (shared callback secret)",
			note: "The file was already READY (MALWARE_SCANNER=none finalizes on complete), so this shows the state-conflict answer; a scanner posts while the file is SCANNING.",
		},
	);
	await capture("FilesController_deleteFile", admin, { method: "DELETE", path: api(`/files/${publicFileId}`) });
}

async function captureMerchantAdmin(context) {
	const { admin } = context;
	const merchants = await capture("RewardsAdminMerchantsController_listMerchants", admin, { method: "GET", path: api("/admin/merchants"), query: { limit: "2" } });
	void merchants;
	const merchant = await capture("RewardsAdminMerchantsController_getMerchant", admin, { method: "GET", path: api(`/admin/merchants/${SEED.klOrganizationId}`) });
	const documentId = merchant?.kyb?.documents?.[0]?.id ?? merchant?.kybDocuments?.[0]?.id ?? merchant?.documents?.[0]?.id;
	await capture("RewardsAdminMerchantsController_downloadDocument", admin, {
		method: "GET",
		path: api(`/admin/merchants/${SEED.klOrganizationId}/documents/${documentId}/download`),
	});
	context.klDocumentId = documentId;
	await capture("RewardsAdminLocationRequestsController_listLocationRequests", admin, { method: "GET", path: api("/admin/location-requests") });
	await capture("RewardsAdminAnalyticsController_getSales", admin, { method: "GET", path: api("/admin/analytics/sales") });
	await capture("RewardsAdminAnalyticsController_getDashboard", admin, { method: "GET", path: api("/admin/analytics/dashboard"), query: { interval: "week" } });
	await capture(
		"RewardsAdminAnalyticsController_exportReport",
		admin,
		{ method: "GET", path: api("/admin/analytics/export"), query: { ...analyticsExportRange(), format: "csv" } },
		{ note: EXPORT_SAMPLE_NOTE },
	);

	const inviteBody = { email: "nyonya.house@melaka-rewards.demo", businessName: "Nyonya House Melaka", city: "MELAKA" };
	await capture("RewardsAdminInvitesController_previewInviteEmail", admin, { method: "POST", path: api("/admin/invites/preview-email"), body: inviteBody });
	const offset = logOffset();
	await capture("RewardsAdminInvitesController_createInvite", admin, { method: "POST", path: api("/admin/invites"), body: inviteBody });
	context.onboardingToken = await nextFromLog(/onboarding\?token=([\w.-]+)/g, offset);
	await capture("OrganizationAdminController_createInvite", admin, {
		method: "POST",
		path: api("/admin/organizations/invites"),
		body: { email: "kopi.corner@kl-rewards.demo", displayName: "Kopi Corner KL", slug: "kopi-corner-kl", category: "cafe", city: "KUALA_LUMPUR", intendedRole: "OWNER" },
	});
}

async function captureOnboarding(context) {
	const token = context.onboardingToken;
	await capture("MerchantOnboardingController_validateInvite", anonymous, { method: "POST", path: api("/orgs/onboarding/validate"), body: { token } });
	const onboarding = newSession("nyonya", { email: "nyonya.house@melaka-rewards.demo", client: "merchant", ip: "203.0.113.31" });
	await capture("MerchantOnboardingController_completeOnboarding", onboarding, {
		method: "POST",
		path: api("/orgs/onboarding/complete"),
		body: {
			token,
			category: "restaurant",
			legalName: "Nyonya House Melaka Sdn Bhd",
			registrationNo: "202601012345",
			taxId: "C2584563202",
			documentType: "SSM",
			fullName: "Nyonya House Owner",
			password: ACCOUNTS.nyonya.password,
			primaryLocation: { name: "Nyonya House — Jonker Walk", addressText: "88 Jalan Hang Jebat, 75200 Melaka", contactPhone: "+60 6-282 1234" },
		},
	});
	const single = await capture("MerchantOnboardingController_createDocumentUploadUrl", anonymous, {
		method: "POST",
		path: api("/orgs/onboarding/documents/upload-url"),
		body: { token, ...sampleFileInfo },
	});
	const singleUpload = await uploadToTicket(single?.upload ?? single);
	await send(null, { method: "POST", path: singleUpload.path, form: singleUpload.form });
	const singleFileId = single?.fileId ?? single?.file?.id ?? single?.id;
	await capture("MerchantOnboardingController_completeDocumentUpload", anonymous, {
		method: "POST",
		path: api("/orgs/onboarding/documents/upload-complete"),
		body: { token, fileId: singleFileId, checksumSha256: sampleChecksum },
	});
	const batch = await capture("MerchantOnboardingController_createDocumentUploadUrls", anonymous, {
		method: "POST",
		path: api("/orgs/onboarding/documents/upload-urls"),
		body: { token, files: [sampleFileInfo] },
	});
	const batchTickets = Array.isArray(batch) ? batch : (batch?.uploads ?? batch?.files ?? []);
	const batchFileIds = [];
	for (const ticket of batchTickets) {
		const upload = await uploadToTicket(ticket.upload ?? ticket);
		await send(null, { method: "POST", path: upload.path, form: upload.form });
		batchFileIds.push(ticket.fileId ?? ticket.file?.id ?? ticket.id);
	}
	await capture("MerchantOnboardingController_completeDocumentUploads", anonymous, {
		method: "POST",
		path: api("/orgs/onboarding/documents/upload-complete-batch"),
		body: { token, completions: batchFileIds.map((fileId) => ({ fileId, checksumSha256: sampleChecksum })) },
	});
	await sleep(SETTLE_DELAY_MS);
	const fileIds = [singleFileId, ...batchFileIds];
	await capture("MerchantOnboardingController_documentStatus", anonymous, { method: "POST", path: api("/orgs/onboarding/documents/status"), body: { token, fileIds } });
	await capture("MerchantOnboardingController_submitDocuments", anonymous, {
		method: "POST",
		path: api("/orgs/onboarding/documents/submit"),
		body: { token, documentFileIds: fileIds },
	});
}

async function captureOrganization(context) {
	const { admin } = context;
	const owner = await login("brewOwner");
	context.brewOwner = owner;
	const slug = SEED.klSlug;
	await capture("OrganizationMembershipsBootstrapController_listMemberships", owner, { method: "GET", path: api("/orgs/memberships") });
	await capture("OrganizationRewardMembershipsController_listMemberships", owner, { method: "GET", path: api(`/orgs/${slug}/memberships`) });
	await capture("OrganizationController_getContext", owner, { method: "GET", path: api(`/orgs/${slug}/context`) });
	await capture("OrganizationController_listMembers", owner, { method: "GET", path: api(`/orgs/${slug}/members`) });
	await capture("OrganizationController_listMemberInvites", owner, { method: "GET", path: api(`/orgs/${slug}/members/invites`) });

	// KYB: Brew & Bean's owner downloads their evidence; Nyonya House (onboarded earlier in this run,
	// review PENDING) resubmits its details and the admin approves the merchant.
	const brewKyb = await send(owner, { method: "GET", path: api(`/orgs/${slug}/kyb`) });
	const kybDocumentId = brewKyb.json?.data?.documents?.[0]?.id ?? context.klDocumentId;
	await capture("OrganizationKybController_downloadDocument", owner, { method: "GET", path: api(`/orgs/${slug}/kyb/documents/${kybDocumentId}/download`) });
	const jonker = await login("jonkerOwner");
	context.jonkerOwner = jonker;
	await verifyEmailOf(ACCOUNTS.nyonya.email);
	const nyonya = await login("nyonya");
	const memberships = await send(nyonya, { method: "GET", path: api("/orgs/memberships") });
	const nyonyaMembership = firstArray(memberships.json?.data)[0];
	const nyonyaSlug = nyonyaMembership?.organizationSlug ?? nyonyaMembership?.slug ?? nyonyaMembership?.organization?.slug;
	const nyonyaOrganizationId = nyonyaMembership?.organizationId ?? nyonyaMembership?.organization?.id;
	const kyb = await capture("OrganizationKybController_getProfile", nyonya, { method: "GET", path: api(`/orgs/${nyonyaSlug}/kyb`) });
	await capture("OrganizationKybController_submitKyb", nyonya, {
		method: "PATCH",
		path: api(`/orgs/${nyonyaSlug}/kyb`),
		body: {
			businessName: kyb?.businessName,
			legalName: kyb?.legalName,
			registrationNo: kyb?.kybFields?.registrationNo,
			taxId: kyb?.kybFields?.taxId,
			documentType: kyb?.kybFields?.documentType,
			addressText: kyb?.addressText,
			contactPhone: kyb?.contactPhone,
			documentFileIds: (kyb?.documents ?? []).map((document) => document.id),
		},
	});
	await capture("RewardsAdminMerchantsController_updateKyb", admin, {
		method: "PATCH",
		path: api(`/admin/merchants/${nyonyaOrganizationId ?? kyb?.organizationId}/kyb`),
		body: { kybStatus: "APPROVED", kybFields: { reviewNotes: "SSM certificate matches the registered name" } },
	});

	// Stores: the owner requests one; the admin rejects it with a reason; the owner edits and resubmits;
	// the admin approves. The admin also opens a store directly, which the owner later closes.
	const bangsar = { name: "Brew & Bean KL — Bangsar", addressText: "21 Jalan Telawi 3, Bangsar Baru, 59100 Kuala Lumpur", contactPhone: "+60 3-2283 1234" };
	const requested = await capture("OrganizationController_createLocation", owner, { method: "POST", path: api(`/orgs/${slug}/locations`), body: bangsar });
	let requestedId = requested?.id ?? requested?.location?.id;
	if (requestedId === undefined) {
		// Fallback when the owner's request failed: the admin records the same store as pending.
		const pendingStore = await send(admin, {
			method: "POST",
			path: api(`/admin/merchants/${SEED.klOrganizationId}/locations`),
			body: { name: bangsar.name, addressText: bangsar.addressText, contactPhone: bangsar.contactPhone, city: "KUALA_LUMPUR", approveImmediately: false },
		});
		requestedId = pendingStore.json?.data?.id ?? pendingStore.json?.data?.location?.id;
	}
	await capture("RewardsAdminMerchantsController_reviewLocation", admin, {
		method: "PATCH",
		path: api(`/admin/merchants/${SEED.klOrganizationId}/locations/${requestedId}/review`),
		body: { approve: false, rejectionReason: "Add the unit number to the address" },
	});
	await capture("OrganizationController_updateLocation", owner, {
		method: "PATCH",
		path: api(`/orgs/${slug}/locations/${requestedId}`),
		body: { ...bangsar, addressText: "Lot G-21, 21 Jalan Telawi 3, Bangsar Baru, 59100 Kuala Lumpur" },
	});
	await send(admin, { method: "PATCH", path: api(`/admin/merchants/${SEED.klOrganizationId}/locations/${requestedId}/review`), body: { approve: true } });
	const adminCreated = await capture("RewardsAdminMerchantsController_createLocation", admin, {
		method: "POST",
		path: api(`/admin/merchants/${SEED.klOrganizationId}/locations`),
		body: { name: "Brew & Bean KL — Mid Valley", addressText: "Lingkaran Syed Putra, Mid Valley City, 59200 Kuala Lumpur", city: "KUALA_LUMPUR", approveImmediately: true },
	});
	const adminCreatedId = adminCreated?.id ?? adminCreated?.location?.id;
	await capture("OrganizationController_closeLocation", owner, {
		method: "POST",
		path: api(`/orgs/${slug}/locations/${adminCreatedId}/close`),
		body: { reason: "Mall lease not renewed" },
	});

	// Team: invite a member by email, revoke a pending invite, remove a member from one store.
	// Invites name an APPROVED store: the seeded primary store (Bukit Bintang).
	const storeId = SEED.klLocationId;
	const invited = await capture("OrganizationController_inviteMember", owner, {
		method: "POST",
		path: api(`/orgs/${slug}/members/invite`),
		body: { email: "barista.bangsar@kl-rewards.demo", role: "CASHIER", locationScopeType: "SELECTED", locationIds: [storeId] },
	});
	await capture("OrganizationController_revokeMemberInvite", owner, { method: "POST", path: api(`/orgs/${slug}/members/invites/${invited?.inviteId}/revoke`) });
	await capture(
		"OrganizationController_removeMemberFromStore",
		jonker,
		{
			method: "POST",
			path: api(`/orgs/${SEED.mlkSlug}/members/${SEED.mlkCashierMembershipId}/stores/${SEED.mlkLocationBeruangId}/remove`),
			body: { allowNoStores: true },
		},
		{ note: "Jonker Street Kitchen removes its cashier from the Bukit Beruang store (the cashier's only store, hence allowNoStores)." },
	);

	// A member's own display name in one organization (set, then cleared again so the seed state is kept).
	await capture(
		"OrganizationController_updateOwnMembership",
		jonker,
		{ method: "PATCH", path: api(`/orgs/${SEED.mlkSlug}/members/me`), body: { displayName: "  Siti (Owner)  " } },
		{ note: 'Jonker Street Kitchen\'s owner sets her display name; it is trimmed. `{ "displayName": null }` clears it.' },
	);
	await send(jonker, { method: "PATCH", path: api(`/orgs/${SEED.mlkSlug}/members/me`), body: { displayName: null } });

	// Team invite links (public validate, accept as an existing account, register-and-accept as a new one).
	await capture("OrganizationTeamInviteController_validateTeamInvite", anonymous, {
		method: "POST",
		path: api("/orgs/invites/validate"),
		body: { token: SEED.teamInviteToken },
	});
	const aliceKl = await login("aliceKl");
	await capture("OrganizationTeamInviteController_acceptTeamInvite", aliceKl, { method: "POST", path: api("/orgs/invites/accept"), body: { token: SEED.teamInviteToken } });
	const offset = logOffset();
	await send(owner, {
		method: "POST",
		path: api(`/orgs/${slug}/members/invite`),
		body: { email: "barista.bangsar@kl-rewards.demo", role: "CASHIER", locationScopeType: "SELECTED", locationIds: [storeId] },
	});
	const freshToken = await nextFromLog(/team-invite\?token=([\w.-]+)/g, offset);
	await capture("OrganizationTeamInviteController_registerAndAcceptTeamInvite", newSession("barista", { email: "barista", client: "merchant", ip: "203.0.113.32" }), {
		method: "POST",
		path: api("/orgs/invites/register-and-accept"),
		body: { token: freshToken, fullName: "Bangsar Barista", password: "Barista@123" },
	});

	// Access request: an existing user asks to join, the owner approves.
	await verifyEmailOf(ACCOUNTS.bob.email);
	const bob = await login("bob");
	const request = await capture("OrganizationController_requestAccess", bob, {
		method: "POST",
		path: api(`/orgs/${slug}/access-requests`),
		body: { message: "I run the Bangsar morning shift" },
	});
	await capture("OrganizationController_reviewAccessRequest", owner, {
		method: "POST",
		path: api(`/orgs/${slug}/access-requests/${request?.id ?? request?.requestId}/review`),
		body: { approve: true, role: "CASHIER", locationScopeType: "SELECTED", locationIds: [storeId] },
	});
	context.bangsarLocationId = storeId;
}

async function captureRewards(context) {
	const { admin, brewOwner: owner } = context;
	const slug = SEED.klSlug;
	const rewards = await capture("OrganizationRewardsController_listRewards", owner, { method: "GET", path: api(`/orgs/${slug}/rewards`) });
	const seededReward = Array.isArray(rewards) ? rewards[0] : rewards?.items?.[0];
	await capture("OrganizationRewardsController_getReward", owner, { method: "GET", path: api(`/orgs/${slug}/rewards/${seededReward?.id}`) });
	const DAY_MS = 86_400_000;
	const now = Date.now();
	const draftBody = {
		title: "Free Kopi O with any breakfast set",
		description: "One free Kopi O when you order any breakfast set at Brew & Bean KL.",
		category: "cafe",
		rewardType: "FREE_ITEM",
		rewardValue: 6,
		quantityTotal: 200,
		startDate: now,
		expiryDate: now + 60 * DAY_MS,
		locationScopeType: "ALL_LOCATIONS",
		rules: { maxUsePerUser: 1, minSpendMyr: 15 },
		referralsEnabled: true,
		referralPoolTotal: 50,
		referrerRewardTitle: "RM5 off your next order",
		saveAsDraft: true,
	};
	const draft = await capture("OrganizationRewardsController_createReward", owner, { method: "POST", path: api(`/orgs/${slug}/rewards`), body: draftBody });
	await capture("OrganizationRewardsController_updateReward", owner, { method: "PATCH", path: api(`/orgs/${slug}/rewards/${draft?.id}`), body: { quantityTotal: 250 } });
	await capture("OrganizationRewardsController_publishReward", owner, { method: "POST", path: api(`/orgs/${slug}/rewards/${draft?.id}/publish`), body: {} });
	await capture("RewardsAdminRewardsController_listPendingRewards", admin, { method: "GET", path: api("/admin/rewards/pending") });
	await capture("RewardsAdminRewardsController_approveReward", admin, { method: "POST", path: api(`/admin/rewards/${draft?.id}/approve`), body: {} });
	const second = await send(owner, {
		method: "POST",
		path: api(`/orgs/${slug}/rewards`),
		body: {
			...draftBody,
			title: "Buy one get one Iced Latte",
			rewardType: "BOGO",
			rewardValue: 13,
			saveAsDraft: false,
			referralsEnabled: false,
			referralPoolTotal: undefined,
			referrerRewardTitle: undefined,
		},
	});
	const secondId = second.json?.data?.id;
	await capture("RewardsAdminRewardsController_rejectReward", admin, {
		method: "POST",
		path: api(`/admin/rewards/${secondId}/reject`),
		body: { rewardId: secondId, reason: "Add the participating stores and the daily limit to the terms" },
	});
	context.approvedRewardId = draft?.id;
}

async function captureCustomer(context) {
	await capture("ConsumerRewardsController_listRewards", anonymous, { method: "GET", path: api("/rewards"), query: { limit: "2" } });
	await capture("ConsumerRewardsController_getReward", anonymous, { method: "GET", path: api(`/rewards/${context.approvedRewardId}`) });
	const customer = await login("customer");
	await capture("RewardLegalController_getStatus", customer, { method: "GET", path: api("/legal/status") });
	const status = await send(customer, { method: "GET", path: api("/legal/status") });
	await capture("RewardLegalController_acceptLegal", customer, {
		method: "POST",
		path: api("/legal/accept"),
		body: {
			termsVersion: status.json?.data?.currentTermsVersion ?? status.json?.data?.termsVersion,
			privacyVersion: status.json?.data?.currentPrivacyVersion ?? status.json?.data?.privacyVersion,
		},
	});
	const phone = "+60123456789";
	const offset = logOffset();
	await capture("ConsumerClaimsController_requestOtp", customer, { method: "POST", path: api("/claims/otp"), body: { rewardId: context.approvedRewardId, phone } });
	const otp = await nextFromLog(/\[reward-otp\][^\n]*code=(\d+)/g, offset);
	const claim = await capture("ConsumerClaimsController_createClaim", customer, {
		method: "POST",
		path: api("/claims"),
		body: { rewardId: context.approvedRewardId, phone, otp },
	});
	const claims = await capture("ConsumerClaimsController_listClaims", customer, { method: "GET", path: api("/claims"), query: { limit: "2" } });
	void claims;
	await capture("ConsumerClaimsController_getClaimQr", customer, { method: "GET", path: api(`/claims/${claim?.claim?.id}/qr`) });
	context.customer = customer;
}

async function capturePos(context) {
	const { brewOwner: owner } = context;
	const slug = SEED.klSlug;
	await capture("OrganizationTerminalsController_list", owner, { method: "GET", path: api(`/orgs/${slug}/terminals`) });
	await capture("OrganizationTerminalsController_summary", owner, { method: "GET", path: api(`/orgs/${slug}/terminals/summary`) });
	await capture("OrganizationTerminalsController_getSettings", owner, { method: "GET", path: api(`/orgs/${slug}/terminals/settings`) });
	await capture("OrganizationTerminalsController_updateSettings", owner, {
		method: "PATCH",
		path: api(`/orgs/${slug}/terminals/settings`),
		body: { requireRegisteredTerminals: false },
	});
	const terminal = await capture("OrganizationTerminalsController_create", owner, {
		method: "POST",
		path: api(`/orgs/${slug}/terminals`),
		body: { locationId: context.bangsarLocationId ?? SEED.klLocationId, name: "Bangsar front counter", terminalId: "KL-BANGSAR-01" },
	});
	const terminalRowId = terminal?.terminal?.id ?? terminal?.id;
	await capture("OrganizationTerminalsController_get", owner, { method: "GET", path: api(`/orgs/${slug}/terminals/${terminalRowId}`) });
	const pairing = await capture("OrganizationTerminalsController_issuePairingCode", owner, {
		method: "POST",
		path: api(`/orgs/${slug}/terminals/${terminalRowId}/pairing-code`),
		body: {},
	});
	const pairingCode = pairing?.pairingCode ?? pairing?.code ?? terminal?.pairingCode;
	await capture(
		"PosTerminalsController_pair",
		null,
		{ method: "POST", path: api("/pos/terminals/pair"), body: { pairingCode } },
		{ as: "a new till (pairing code only, no credential yet)" },
	);

	// The seeded KL register key redeems the seed's pending claim (QR token, then backup code at checkout).
	const posHeaders = { "X-API-Key": SEED.klPosKey, "X-Terminal-Id": SEED.klTerminalId };
	const register = { as: "the seeded Brew & Bean KL register (POS API key)" };
	await capture(
		"RedemptionsController_validate",
		null,
		{ method: "POST", path: api("/redemptions/validate"), headers: posHeaders, body: { token: SEED.pendingQrToken } },
		register,
	);
	await capture(
		"RedemptionsController_checkout",
		null,
		{
			method: "POST",
			path: api("/redemptions/checkout"),
			headers: posHeaders,
			body: { idempotencyKey: randomUUID(), billTotalMinor: 2500, currency: "MYR", codes: [{ backupCode: SEED.pendingBackupCode }] },
		},
		register,
	);

	await capture("OrganizationRedemptionsController_listRedemptions", owner, { method: "GET", path: api(`/orgs/${slug}/redemptions`), query: { limit: "2" } });
	await capture("OrganizationAnalyticsController_getAnalytics", owner, { method: "GET", path: api(`/orgs/${slug}/analytics`) });
	await capture("OrganizationAnalyticsController_getDashboard", owner, { method: "GET", path: api(`/orgs/${slug}/analytics/dashboard`), query: { interval: "week" } });
	await capture(
		"OrganizationAnalyticsController_exportReport",
		owner,
		{ method: "GET", path: api(`/orgs/${slug}/analytics/export`), query: { ...analyticsExportRange(), format: "xlsx" } },
		{ note: EXPORT_SAMPLE_NOTE },
	);
	await capture("OrganizationApiKeysController_listKeys", owner, { method: "GET", path: api(`/orgs/${slug}/api-keys`), query: { limit: "2" } });
	const key = await capture("OrganizationApiKeysController_createKey", owner, {
		method: "POST",
		path: api(`/orgs/${slug}/api-keys`),
		body: { name: "Back-office sync", scope: "INTEGRATION" },
	});
	await capture("OrganizationApiKeysController_revokeKey", owner, { method: "POST", path: api(`/orgs/${slug}/api-keys/${key?.id ?? key?.key?.id}/revoke`), body: {} });
	await capture("OrganizationTerminalsController_remove", owner, { method: "DELETE", path: api(`/orgs/${slug}/terminals/${terminalRowId}`) });

	const { customer } = context;
	await capture("ConsumerClaimsController_getAnalytics", customer, { method: "GET", path: api("/claims/analytics") });
	await capture("ConsumerClaimsController_getAnalyticsDashboard", customer, { method: "GET", path: api("/claims/analytics/dashboard"), query: { interval: "month" } });
	await capture("RewardNotificationsController_listNotifications", customer, { method: "GET", path: api("/reward-notifications"), query: { limit: "2" } });
	await capture("RewardNotificationsController_markRead", customer, { method: "POST", path: api("/reward-notifications/read"), body: { markAll: true } });
}

async function captureSupportAccess(context) {
	const { admin, brewOwner: owner } = context;
	const grant = await capture("SupportAccessController_requestGrant", admin, {
		method: "POST",
		path: api("/support-access/request"),
		body: { organizationId: SEED.klOrganizationId, reason: "Investigate a missing POS checkout", ticketRef: "SUP-1042", mode: "READ_ONLY", durationMinutes: 60 },
	});
	const grantId = grant?.id ?? grant?.grantId;
	await capture("SupportAccessController_approve", owner, { method: "POST", path: api(`/support-access/${grantId}/approve`) });
	await capture("SupportAccessController_revoke", admin, { method: "POST", path: api(`/support-access/${grantId}/revoke`) });
}

async function captureImpersonation(context) {
	// Impersonation needs a SuperAdmin with 2FA who passed it in the last MFA_STEP_UP_TTL_MS (5 min):
	// enroll the seed SuperAdmin, sign in again with the second factor, then impersonate.
	const superAdmin = await login("superAdmin");
	const setup = await send(superAdmin, { method: "POST", path: api("/auth/2fa/setup"), body: {} });
	const secret = setup.json?.data?.secret;
	await send(superAdmin, { method: "POST", path: api("/auth/2fa/enable"), body: { token: await totp(secret) } });
	const stepped = newSession("superAdmin", ACCOUNTS.superAdmin);
	const first = await send(stepped, loginRequest("superAdmin"));
	await send(stepped, { method: "POST", path: api("/auth/login/2fa"), body: { tempToken: first.json?.data?.tempToken, token: await totp(secret) } });
	await capture("ImpersonationController_impersonate", stepped, { method: "POST", path: api(`/auth/impersonate/${context.userIds["user@example.com"]}`) });
	await capture("ImpersonationController_stopImpersonation", stepped, { method: "POST", path: api("/auth/stop-impersonation") });
}

async function main() {
	const context = {};
	const steps = [
		["system", captureSystem],
		["auth", captureAuth],
		["rbac", captureRbac],
		["geo", captureGeo],
		["catalog", captureCatalog],
		["email", captureEmail],
		["files", captureFiles],
		["merchant admin", captureMerchantAdmin],
		["onboarding", captureOnboarding],
		["organization", captureOrganization],
		["rewards", captureRewards],
		["customer", captureCustomer],
		["pos", capturePos],
		["support access", captureSupportAccess],
		["impersonation", captureImpersonation],
	];
	for (const [name, step] of steps) {
		try {
			await step(context);
			console.log(`✓ ${name}`);
		} catch (error) {
			failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
			console.log(`✗ ${name}`);
		}
	}
	const ordered = Object.fromEntries(Object.entries(samples).sort(([left], [right]) => left.localeCompare(right)));
	const now = new Date();
	const capturedAt = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
	writeFileSync(OUTPUT_FILE, `${JSON.stringify({ capturedFrom: "pnpm db:seed (development scenario)", capturedAt, samples: ordered }, null, "\t")}\n`);
	console.log(`\n${String(Object.keys(ordered).length)} samples → ${OUTPUT_FILE}`);
	if (failures.length > 0) {
		console.log(`\n${String(failures.length)} unexpected responses:\n${failures.map((failure) => `  - ${failure}`).join("\n")}`);
		process.exitCode = 1;
	}
}

await main();
