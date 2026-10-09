import { randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import {
	API_VERSION_PREFIX,
	ApiErrorResponseSchema,
	encodeSessionDeviceHeaderValue,
	LoginMobileResponseSchema,
	RefreshMobileResponseSchema,
	RevokeSessionResponseSchema,
	SessionListResponseSchema,
	type LoginMobileResponse,
	type Session,
} from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { createE2eApp, extractCookie, mutationHeaders, parseSuccessEnvelope, uniqueClientIp, type InjectResponse } from "./e2e-helpers";

/**
 * Device sessions end to end (docs/technical/mobile/mobile-app.md §8, ADR 034):
 * every detail a sign-in stores and the list returns, `isCurrent`, revoking one
 * device (own only, idempotent, immediate on the next request, race-safe with
 * a refresh), the current device's revoke as a sign-out, `deletedBy` on every
 * revocation path the HTTP surface reaches, the mobile device headers, and the
 * REFRESH_BODY audit method. Each test signs a fresh member in, so the
 * per-user session cap never retires a session a test still holds.
 */

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
const PASSWORD = "DeviceSessions@123";
const APP_VERSION = "1.4.0";
const CHROME_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7390.54 Safari/537.36";
const EXPO_IOS = "RewardHub/42 CFNetwork/1568.100.1 Darwin/24.0.0";
const DEVICE_MODEL = "iPhone 15 Pro";
const DEVICE_NAME = "Alex’s iPhone";

const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;

const SESSIONS_URL = `${API_VERSION_PREFIX}/auth/sessions`;

const SessionRowSchema = z.object({ isDeleted: z.boolean(), deletedBy: z.string().nullable() });
const CountSchema = z.object({ count: z.coerce.number() });
const AuthMethodSchema = z.object({ authMethod: z.string().nullable() });

/** A browser session: the cookie pair of the web app and the IP it signed in from. */
interface BrowserSession {
	readonly accessToken: string;
	readonly refreshToken: string;
	readonly ip: string;
}

/** A mobile-app session: the body tokens and the IP it signed in from. */
interface MobileSession extends LoginMobileResponse {
	readonly ip: string;
}

describe("Device sessions (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	/** Members this suite created — soft-deleted afterwards. */
	const members: string[] = [];

	function browserHeaders(ip: string, extra: Record<string, string> = {}): Record<string, string> {
		return mutationHeaders({ "x-forwarded-for": ip, "user-agent": CHROME_MAC, ...extra });
	}

	function mobileHeaders(ip: string, extra: Record<string, string> = {}): Record<string, string> {
		return {
			"x-client-type": "mobile",
			"x-app-version": APP_VERSION,
			"x-device-model": encodeSessionDeviceHeaderValue(DEVICE_MODEL),
			"x-device-name": encodeSessionDeviceHeaderValue(DEVICE_NAME),
			"user-agent": EXPO_IOS,
			"x-forwarded-for": ip,
			...extra,
		};
	}

	function errorCodeOf(response: InjectResponse): string {
		return ApiErrorResponseSchema.parse(response.json()).error.code;
	}

	/** A fresh, verified member (no 2FA): sign-ins are a password only. */
	async function newMember(): Promise<{ readonly email: string; readonly userId: string }> {
		const email = `device-sessions-${randomUUID()}@example.com`;
		const signup = await app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/auth/signup`,
			headers: browserHeaders(uniqueClientIp()),
			payload: { email, password: PASSWORD, fullName: "Device Sessions E2E" },
		});
		expect(signup.statusCode, signup.body).toBe(HTTP_CREATED);
		const updated = await pool.query(`UPDATE public.users SET email_verified_at = $1 WHERE email = $2 RETURNING id`, [Date.now(), email]);
		const userId = z.object({ id: z.string() }).parse(updated.rows.at(0)).id;
		members.push(email);
		return { email, userId };
	}

	async function signInBrowser(email: string): Promise<BrowserSession> {
		const ip = uniqueClientIp();
		const response = await app.inject({ method: "POST", url: `${API_VERSION_PREFIX}/auth/login`, headers: browserHeaders(ip), payload: { email, password: PASSWORD } });
		expect(response.statusCode, response.body).toBe(HTTP_CREATED);
		const accessToken = extractCookie(response.headers["set-cookie"], "accessToken");
		const refreshToken = extractCookie(response.headers["set-cookie"], "refreshToken");
		if (accessToken === undefined || refreshToken === undefined) {
			throw new Error(`Browser sign-in set no cookies: ${response.body}`);
		}
		return { accessToken, refreshToken, ip };
	}

	async function signInMobile(email: string, extraHeaders: Record<string, string> = {}): Promise<MobileSession> {
		const ip = uniqueClientIp();
		const response = await app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/auth/login`,
			headers: mobileHeaders(ip, extraHeaders),
			payload: { email, password: PASSWORD },
		});
		expect(response.statusCode, response.body).toBe(HTTP_CREATED);
		return { ...parseSuccessEnvelope(response, LoginMobileResponseSchema).data, ip };
	}

	async function listAsBrowser(session: BrowserSession): Promise<Session[]> {
		const response = await app.inject({ method: "GET", url: SESSIONS_URL, headers: browserHeaders(session.ip, { cookie: `accessToken=${session.accessToken}` }) });
		expect(response.statusCode, response.body).toBe(HTTP_OK);
		return parseSuccessEnvelope(response, SessionListResponseSchema).data;
	}

	async function listAsMobile(session: MobileSession): Promise<Session[]> {
		const response = await app.inject({ method: "GET", url: SESSIONS_URL, headers: mobileHeaders(session.ip, { authorization: `Bearer ${session.accessToken}` }) });
		expect(response.statusCode, response.body).toBe(HTTP_OK);
		return parseSuccessEnvelope(response, SessionListResponseSchema).data;
	}

	async function revokeAsBrowser(session: BrowserSession, sessionId: string): Promise<InjectResponse> {
		return app.inject({ method: "POST", url: `${SESSIONS_URL}/${sessionId}/revoke`, headers: browserHeaders(session.ip, { cookie: `accessToken=${session.accessToken}` }) });
	}

	async function meAsMobile(session: Pick<MobileSession, "accessToken" | "ip">): Promise<InjectResponse> {
		return app.inject({ method: "GET", url: `${API_VERSION_PREFIX}/auth/me`, headers: mobileHeaders(session.ip, { authorization: `Bearer ${session.accessToken}` }) });
	}

	async function refreshMobile(refreshToken: string, ip: string = uniqueClientIp()): Promise<InjectResponse> {
		return app.inject({ method: "POST", url: `${API_VERSION_PREFIX}/auth/refresh`, headers: mobileHeaders(ip), payload: { refreshToken } });
	}

	async function storedSession(sessionId: string): Promise<z.output<typeof SessionRowSchema>> {
		const result = await pool.query(`SELECT is_deleted AS "isDeleted", deleted_by AS "deletedBy" FROM public.refresh_tokens WHERE id = $1`, [sessionId]);
		return SessionRowSchema.parse(result.rows.at(0));
	}

	async function deletedByOfUser(userId: string): Promise<readonly (string | null)[]> {
		const result = await pool.query(`SELECT deleted_by AS "deletedBy" FROM public.refresh_tokens WHERE "userId" = $1 ORDER BY "createdAt"`, [userId]);
		return z
			.array(SessionRowSchema.pick({ deletedBy: true }))
			.parse(result.rows)
			.map((row) => row.deletedBy);
	}

	async function revokeDeviceEvents(userId: string): Promise<number> {
		const result = await pool.query(
			`SELECT count(*) AS count FROM public.outbox_events WHERE event_type = 'session.action' AND payload->'payload'->>'action' = 'revoke-device' AND payload->'payload'->>'userId' = $1`,
			[userId],
		);
		return CountSchema.parse(result.rows.at(0)).count;
	}

	function sessionIdOf(sessions: readonly Session[], predicate: (session: Session) => boolean): string {
		const match = sessions.find(predicate);
		if (match === undefined) {
			throw new Error("Expected session not listed");
		}
		return match.id;
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: DATABASE_URL });
	});

	afterAll(async () => {
		await pool.query("UPDATE public.users SET is_deleted = true, deleted_at = $2 WHERE email = ANY($1)", [members, Date.now()]);
		await pool.end();
		await app.close();
	});

	describe("GET /auth/sessions", () => {
		it("lists every client type with every stored detail, the current session first", async () => {
			const { email } = await newMember();
			const phone = await signInMobile(email);
			const browser = await signInBrowser(email);

			const sessions = await listAsBrowser(browser);

			expect(sessions).toHaveLength(2);
			expect(sessions.at(0)).toMatchObject({
				isCurrent: true,
				clientType: "web",
				label: "Chrome 141 on macOS",
				browserName: "Chrome",
				browserVersion: "141.0.7390.54",
				osName: "macOS",
				deviceType: "DESKTOP",
				deviceName: null,
				appVersion: null,
				signInMethod: "PASSWORD",
				ipAddress: browser.ip,
				lastIpAddress: browser.ip,
				location: null,
			});
			expect(sessions.at(1)).toMatchObject({
				isCurrent: false,
				clientType: "mobile",
				label: DEVICE_NAME,
				osName: "iOS",
				deviceType: "MOBILE",
				deviceModel: DEVICE_MODEL,
				deviceName: DEVICE_NAME,
				appVersion: APP_VERSION,
				signInMethod: "PASSWORD",
				ipAddress: phone.ip,
			});
		});

		it("marks the mobile app's own session current on the bearer transport", async () => {
			const { email } = await newMember();
			await signInBrowser(email);
			const phone = await signInMobile(email);

			const sessions = await listAsMobile(phone);

			expect(sessions.map((session) => [session.clientType, session.isCurrent])).toEqual([
				["mobile", true],
				["web", false],
			]);
		});

		it("drops an invalid device name header instead of refusing the sign-in, and ignores device headers from a browser", async () => {
			const { email } = await newMember();
			const phone = await signInMobile(email, { "x-device-name": "%E0%A4%A" });
			const browser = await signInBrowser(email);
			await app.inject({
				method: "POST",
				url: `${API_VERSION_PREFIX}/auth/login`,
				headers: browserHeaders(uniqueClientIp(), { "x-device-name": "Spoofed", "x-app-version": "9.9.9" }),
				payload: { email, password: PASSWORD },
			});

			const sessions = await listAsMobile(phone);

			expect(sessions.find((session) => session.isCurrent)).toMatchObject({ deviceName: null, deviceModel: DEVICE_MODEL, label: DEVICE_MODEL });
			for (const session of sessions.filter((listed) => listed.clientType === "web")) {
				expect(session).toMatchObject({ deviceName: null, appVersion: null });
			}
			expect(browser.accessToken.length).toBeGreaterThan(0);
		});

		it("keeps the session id across refreshes and records the activity (lastActiveAt, lastIpAddress)", async () => {
			const { email } = await newMember();
			const phone = await signInMobile(email);
			const before = (await listAsMobile(phone)).at(0);
			const newIp = uniqueClientIp();

			const rotated = await refreshMobile(phone.refreshToken, newIp);
			expect(rotated.statusCode, rotated.body).toBe(HTTP_OK);
			const tokens = parseSuccessEnvelope(rotated, RefreshMobileResponseSchema).data;
			const after = (await listAsMobile({ ...phone, accessToken: tokens.accessToken })).at(0);

			expect(after).toMatchObject({ id: before?.id, isCurrent: true, ipAddress: phone.ip, lastIpAddress: newIp, deviceName: DEVICE_NAME, appVersion: APP_VERSION });
			expect(after?.lastActiveAt).toBeGreaterThanOrEqual(before?.lastActiveAt ?? Number.MAX_SAFE_INTEGER);
		});

		it("records a body-presented refresh token as REFRESH_BODY in the audit log", async () => {
			const { email } = await newMember();
			const phone = await signInMobile(email);

			const rotated = await refreshMobile(phone.refreshToken);

			const correlationId = z.string().parse(rotated.headers["x-correlation-id"]);
			const audit = await pool.query(`SELECT auth_method::text AS "authMethod" FROM public.audit_logs WHERE correlation_id = $1`, [correlationId]);
			expect(AuthMethodSchema.parse(audit.rows.at(0)).authMethod).toBe("REFRESH_BODY");
		});
	});

	describe("POST /auth/sessions/:sessionId/revoke", () => {
		it("signs another device out at once: its access token and its refresh token stop working; deletedBy is the caller", async () => {
			const { email, userId } = await newMember();
			const phone = await signInMobile(email);
			const browser = await signInBrowser(email);
			const phoneSessionId = sessionIdOf(await listAsBrowser(browser), (session) => session.clientType === "mobile");
			expect((await meAsMobile(phone)).statusCode).toBe(HTTP_OK);

			const revoked = await revokeAsBrowser(browser, phoneSessionId);

			expect(revoked.statusCode, revoked.body).toBe(HTTP_CREATED);
			expect(parseSuccessEnvelope(revoked, RevokeSessionResponseSchema).data.revokedCurrentSession).toBe(false);
			expect(extractCookie(revoked.headers["set-cookie"], "accessToken")).toBeUndefined();
			const me = await meAsMobile(phone);
			expect(me.statusCode).toBe(HTTP_UNAUTHORIZED);
			expect(errorCodeOf(me)).toBe("SESSION_REVOKED");
			expect((await refreshMobile(phone.refreshToken)).statusCode).toBe(HTTP_UNAUTHORIZED);
			expect(await storedSession(phoneSessionId)).toEqual({ isDeleted: true, deletedBy: userId });
			expect((await listAsBrowser(browser)).map((session) => session.id)).not.toContain(phoneSessionId);
			expect(await revokeDeviceEvents(userId)).toBe(1);
		});

		it("is idempotent: revoking it again succeeds with no second event", async () => {
			const { email, userId } = await newMember();
			await signInMobile(email);
			const browser = await signInBrowser(email);
			const phoneSessionId = sessionIdOf(await listAsBrowser(browser), (session) => session.clientType === "mobile");

			const first = await revokeAsBrowser(browser, phoneSessionId);
			const second = await revokeAsBrowser(browser, phoneSessionId);

			expect(first.statusCode, first.body).toBe(HTTP_CREATED);
			expect(second.statusCode, second.body).toBe(HTTP_CREATED);
			expect(await revokeDeviceEvents(userId)).toBe(1);
		});

		it("answers 404 for a session of another user (never 403) and for an unknown id; 400 for a malformed id", async () => {
			const owner = await newMember();
			const other = await newMember();
			const ownerBrowser = await signInBrowser(owner.email);
			const otherBrowser = await signInBrowser(other.email);
			const othersSessionId = sessionIdOf(await listAsBrowser(otherBrowser), (session) => session.isCurrent);

			const foreign = await revokeAsBrowser(ownerBrowser, othersSessionId);
			const unknown = await revokeAsBrowser(ownerBrowser, randomUUID());
			const malformed = await revokeAsBrowser(ownerBrowser, "not-a-session-id");

			expect(foreign.statusCode).toBe(HTTP_NOT_FOUND);
			expect(errorCodeOf(foreign)).toBe("SESSION_NOT_FOUND");
			expect(unknown.statusCode).toBe(HTTP_NOT_FOUND);
			expect(malformed.statusCode).toBe(HTTP_BAD_REQUEST);
			expect(await storedSession(othersSessionId)).toEqual({ isDeleted: false, deletedBy: null });
		});

		it("revoking the current browser session is a sign-out: the cookies are cleared and the access token is rejected", async () => {
			const { email } = await newMember();
			const browser = await signInBrowser(email);
			const currentId = sessionIdOf(await listAsBrowser(browser), (session) => session.isCurrent);

			const revoked = await revokeAsBrowser(browser, currentId);

			expect(revoked.statusCode, revoked.body).toBe(HTTP_CREATED);
			expect(parseSuccessEnvelope(revoked, RevokeSessionResponseSchema).data.revokedCurrentSession).toBe(true);
			expect(extractCookie(revoked.headers["set-cookie"], "accessToken")).toBe("");
			expect(extractCookie(revoked.headers["set-cookie"], "refreshToken")).toBe("");
			const after = await app.inject({ method: "GET", url: SESSIONS_URL, headers: browserHeaders(browser.ip, { cookie: `accessToken=${browser.accessToken}` }) });
			expect(after.statusCode).toBe(HTTP_UNAUTHORIZED);
			expect(errorCodeOf(after)).toBe("SESSION_REVOKED");
		});

		it("never resurrects a session revoked while it refreshes: afterwards no token of it works", async () => {
			const { email } = await newMember();
			const phone = await signInMobile(email);
			const browser = await signInBrowser(email);
			const phoneSessionId = sessionIdOf(await listAsBrowser(browser), (session) => session.clientType === "mobile");

			const [refreshed, revoked] = await Promise.all([refreshMobile(phone.refreshToken), revokeAsBrowser(browser, phoneSessionId)]);

			expect(revoked.statusCode, revoked.body).toBe(HTTP_CREATED);
			expect((await storedSession(phoneSessionId)).isDeleted).toBe(true);
			if (refreshed.statusCode === HTTP_OK) {
				// The refresh committed first: the rotated tokens belong to the revoked session.
				const tokens = parseSuccessEnvelope(refreshed, RefreshMobileResponseSchema).data;
				expect((await meAsMobile({ accessToken: tokens.accessToken, ip: phone.ip })).statusCode).toBe(HTTP_UNAUTHORIZED);
				expect((await refreshMobile(tokens.refreshToken)).statusCode).toBe(HTTP_UNAUTHORIZED);
			} else {
				expect(refreshed.statusCode).toBe(HTTP_UNAUTHORIZED);
			}
			expect((await meAsMobile(phone)).statusCode).toBe(HTTP_UNAUTHORIZED);
		});
	});

	describe("deletedBy on the other revocation paths", () => {
		it("logout records the user", async () => {
			const { email, userId } = await newMember();
			const phone = await signInMobile(email);

			const loggedOut = await app.inject({
				method: "POST",
				url: `${API_VERSION_PREFIX}/auth/logout`,
				headers: mobileHeaders(phone.ip),
				payload: { refreshToken: phone.refreshToken },
			});

			expect(loggedOut.statusCode, loggedOut.body).toBe(HTTP_CREATED);
			expect(await deletedByOfUser(userId)).toEqual([userId]);
			// The logged-out device's access token is rejected on its next request, too.
			expect(errorCodeOf(await meAsMobile(phone))).toBe("SESSION_REVOKED");
		});

		it("logout-all records the user on every session", async () => {
			const { email, userId } = await newMember();
			await signInBrowser(email);
			const phone = await signInMobile(email);

			const loggedOut = await app.inject({
				method: "POST",
				url: `${API_VERSION_PREFIX}/auth/logout-all`,
				headers: mobileHeaders(phone.ip),
				payload: { refreshToken: phone.refreshToken },
			});

			expect(loggedOut.statusCode, loggedOut.body).toBe(HTTP_CREATED);
			expect(await deletedByOfUser(userId)).toEqual([userId, userId]);
		});

		it("refresh-token reuse records system:rotation-reuse", async () => {
			const { email, userId } = await newMember();
			const phone = await signInMobile(email);
			const first = parseSuccessEnvelope(await refreshMobile(phone.refreshToken), RefreshMobileResponseSchema).data;
			parseSuccessEnvelope(await refreshMobile(first.refreshToken), RefreshMobileResponseSchema);

			const replay = await refreshMobile(phone.refreshToken);

			expect(errorCodeOf(replay)).toBe("TOKEN_THEFT_DETECTED");
			expect(await deletedByOfUser(userId)).toEqual(["system:rotation-reuse"]);
		});
	});
});
