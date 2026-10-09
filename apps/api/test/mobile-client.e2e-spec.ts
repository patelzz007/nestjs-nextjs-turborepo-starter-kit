import { randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import {
	API_VERSION_PREFIX,
	ApiErrorResponseSchema,
	JsonValueSchema,
	LoginMobileResponseSchema,
	LoginTwoFactorPendingResponseSchema,
	LoginVerificationPendingResponseSchema,
	RefreshMobileResponseSchema,
	TwoFactorSetupResponseSchema,
	UserResponseSchema,
	type LoginMobileResponse,
} from "@workspace/shared";
import { generateSync } from "otplib";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { getApiConfig } from "../src/config/api-config";
import { TypedConfigService } from "../src/config/typed-config.service";
import { CryptoService } from "../src/modules/auth/services/crypto.service";
import { createE2eApp, mutationHeaders, parseSuccessEnvelope, uniqueClientIp, type InjectResponse } from "./e2e-helpers";

/**
 * Client type `mobile` end to end (ADR 029 / 033, docs/technical/mobile/mobile-app.md §7):
 * tokens in response bodies and never in cookies, the refresh token in the
 * request body, rotation + reuse detection, logout / logout-all by body token,
 * and the 426 forced upgrade. The app runs with login verification ON
 * (`always`, as production can) and a raised minimum app version, so every
 * step a phone meets is exercised.
 *
 * Mobile requests deliberately send NO Origin / mutation-intent header: a
 * native app has none, and client type `mobile` carries no ambient credential.
 */

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
const PASSWORD = "MobileE2e@123";
const MINIMUM_VERSION = "1.2.0";
const CURRENT_VERSION = "1.4.0";
/** One TOTP period: a code for the NEXT step is accepted (±1 step tolerance) and is never a replay of the enrollment code. */
const TOTP_PERIOD_SECONDS = 30;
const MS_PER_SECOND = 1000;

const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_UNAUTHORIZED = 401;
const HTTP_UPGRADE_REQUIRED = 426;

const CorrelationIdSchema = z.string().min(1);
const AuditBodiesSchema = z.object({ requestBody: JsonValueSchema, responseBody: JsonValueSchema, clientType: z.string().nullable() });

describe("Mobile client type (e2e)", () => {
	const email = `mobile-e2e-${randomUUID()}@example.com`;
	/** A second member who enrolls 2FA — so enrolling never changes the sign-in flow the other tests use. */
	const twoFactorEmail = `mobile-e2e-2fa-${randomUUID()}@example.com`;
	let app: NestFastifyApplication;
	let pool: Pool;
	let crypto: CryptoService;

	function mobileHeaders(extra: Record<string, string> = {}): Record<string, string> {
		return { "x-client-type": "mobile", "x-app-version": CURRENT_VERSION, "x-forwarded-for": uniqueClientIp(), "user-agent": "mobile-e2e", ...extra };
	}

	async function post(path: string, payload: object, headers: Record<string, string>): Promise<InjectResponse> {
		return app.inject({ method: "POST", url: `${API_VERSION_PREFIX}/auth/${path}`, headers, payload });
	}

	function errorCodeOf(response: InjectResponse): string {
		return ApiErrorResponseSchema.parse(response.json()).error.code;
	}

	function setCookies(response: InjectResponse): readonly string[] {
		const header = response.headers["set-cookie"];
		if (header === undefined) return [];
		return z.union([z.string().transform((value: string): string[] => [value]), z.array(z.string())]).parse(header);
	}

	/** Runs `send` and returns the response plus the emailed login-verification code it generated. */
	async function withEmailedCode(send: () => Promise<InjectResponse>): Promise<{ readonly response: InjectResponse; readonly code: string }> {
		const codes = vi.spyOn(crypto, "generateNumericCode");
		try {
			const response = await send();
			return { response, code: z.string().length(6).parse(codes.mock.results.at(-1)?.value) };
		} finally {
			codes.mockRestore();
		}
	}

	/** Password → emailed code (no 2FA yet): the session tokens arrive in the verify-login body. */
	async function signInWithoutTwoFactor(memberEmail: string = email): Promise<LoginMobileResponse> {
		const { response: loginResponse, code } = await withEmailedCode(() => post("login", { email: memberEmail, password: PASSWORD }, mobileHeaders()));
		expect(loginResponse.statusCode, loginResponse.body).toBe(HTTP_CREATED);
		const pending = parseSuccessEnvelope(loginResponse, LoginVerificationPendingResponseSchema).data;

		const verified = await post("verify-login", { verificationId: pending.verificationId, code }, mobileHeaders());
		expect(verified.statusCode, verified.body).toBe(HTTP_OK);
		expect(setCookies(verified)).toEqual([]);
		return parseSuccessEnvelope(verified, LoginMobileResponseSchema).data;
	}

	async function refresh(refreshToken: string): Promise<InjectResponse> {
		return post("refresh", { refreshToken }, mobileHeaders());
	}

	async function auditBodies(response: InjectResponse): Promise<z.output<typeof AuditBodiesSchema>> {
		const correlationId = CorrelationIdSchema.parse(response.headers["x-correlation-id"]);
		const result = await pool.query(
			`SELECT request_body AS "requestBody", response_body AS "responseBody", client_type AS "clientType" FROM public.audit_logs WHERE correlation_id = $1`,
			[correlationId],
		);
		return AuditBodiesSchema.parse(result.rows.at(0));
	}

	beforeAll(async () => {
		const base = getApiConfig();
		app = await createE2eApp((builder) =>
			builder
				.overrideProvider(TypedConfigService)
				.useValue(new TypedConfigService({ ...base, auth: { ...base.auth, loginVerificationMode: "always" }, mobile: { minSupportedVersion: MINIMUM_VERSION } })),
		);
		crypto = app.get(CryptoService);
		pool = new Pool({ connectionString: DATABASE_URL });

		for (const memberEmail of [email, twoFactorEmail]) {
			const signup = await post("signup", { email: memberEmail, password: PASSWORD, fullName: "Mobile E2E" }, mobileHeaders());
			expect(signup.statusCode, signup.body).toBe(HTTP_CREATED);
			// A verified member who has not enrolled 2FA yet (the restriction itself is covered elsewhere).
			await pool.query(`UPDATE public.users SET email_verified_at = $1 WHERE email = $2`, [Date.now(), memberEmail]);
		}
	});

	afterAll(async () => {
		await pool.query("UPDATE public.users SET is_deleted = true, deleted_at = $2 WHERE email = ANY($1)", [[email, twoFactorEmail], Date.now()]);
		await pool.end();
		await app.close();
	});

	describe("sign-in", () => {
		it("password → emailed code: the tokens arrive in the body (tokenTransport: body) and no cookie is set", async () => {
			const { response: loginResponse, code } = await withEmailedCode(() => post("login", { email, password: PASSWORD }, mobileHeaders()));

			expect(loginResponse.statusCode, loginResponse.body).toBe(HTTP_CREATED);
			expect(setCookies(loginResponse)).toEqual([]);
			const pending = parseSuccessEnvelope(loginResponse, LoginVerificationPendingResponseSchema).data;

			const verified = await post("verify-login", { verificationId: pending.verificationId, code }, mobileHeaders());

			expect(verified.statusCode, verified.body).toBe(HTTP_OK);
			expect(setCookies(verified)).toEqual([]);
			const session = parseSuccessEnvelope(verified, LoginMobileResponseSchema).data;
			expect(session.tokenTransport).toBe("body");
			expect(session.user.email).toBe(email);
			expect(session.accessToken.length).toBeGreaterThan(0);
			expect(session.refreshToken.length).toBeGreaterThan(0);
		});

		it("records the mobile login in the audit log with both tokens redacted", async () => {
			const { response: loginResponse, code } = await withEmailedCode(() => post("login", { email, password: PASSWORD }, mobileHeaders()));
			const pending = parseSuccessEnvelope(loginResponse, LoginVerificationPendingResponseSchema).data;
			const verified = await post("verify-login", { verificationId: pending.verificationId, code }, mobileHeaders());
			const session = parseSuccessEnvelope(verified, LoginMobileResponseSchema).data;

			const audit = await auditBodies(verified);

			expect(audit.clientType).toBe("mobile");
			expect(audit.responseBody).toMatchObject({ data: { tokenTransport: "body", accessToken: "[REDACTED]", refreshToken: "[REDACTED]" } });
			expect(JSON.stringify(audit.responseBody)).not.toContain(session.accessToken);
			expect(JSON.stringify(audit.responseBody)).not.toContain(session.refreshToken);
			expect(audit.requestBody).toMatchObject({ code: "[REDACTED]" });
		});

		it("authenticates by the bearer access token, never by a cookie", async () => {
			const session = await signInWithoutTwoFactor();

			const bearer = await app.inject({ method: "GET", url: `${API_VERSION_PREFIX}/auth/me`, headers: mobileHeaders({ authorization: `Bearer ${session.accessToken}` }) });
			const cookieOnly = await app.inject({ method: "GET", url: `${API_VERSION_PREFIX}/auth/me`, headers: mobileHeaders({ cookie: `accessToken=${session.accessToken}` }) });

			expect(bearer.statusCode, bearer.body).toBe(HTTP_OK);
			expect(parseSuccessEnvelope(bearer, UserResponseSchema).data.email).toBe(email);
			expect(cookieOnly.statusCode).toBe(HTTP_UNAUTHORIZED);
			expect(errorCodeOf(cookieOnly)).toBe("ACCESS_TOKEN_MISSING");
		});

		it("a browser login of the same account still gets cookies and a token-free body", async () => {
			const { response: loginResponse, code } = await withEmailedCode(() =>
				app.inject({
					method: "POST",
					url: `${API_VERSION_PREFIX}/auth/login`,
					headers: mutationHeaders({ "x-forwarded-for": uniqueClientIp() }),
					payload: { email, password: PASSWORD },
				}),
			);
			const pending = parseSuccessEnvelope(loginResponse, LoginVerificationPendingResponseSchema).data;
			const verified = await app.inject({
				method: "POST",
				url: `${API_VERSION_PREFIX}/auth/verify-login`,
				headers: mutationHeaders({ "x-forwarded-for": uniqueClientIp() }),
				payload: { verificationId: pending.verificationId, code },
			});

			expect(verified.statusCode, verified.body).toBe(HTTP_OK);
			expect(setCookies(verified).some((cookie: string): boolean => cookie.startsWith("accessToken="))).toBe(true);
			expect(verified.body).not.toContain("accessToken");
			expect(verified.body).not.toContain("refreshToken");
			expect(verified.body).not.toContain("tokenTransport");
		});
	});

	describe("refresh", () => {
		it("rotates: a new token pair in the body, no cookie, and the new access token works", async () => {
			const session = await signInWithoutTwoFactor();

			const rotated = await refresh(session.refreshToken);

			expect(rotated.statusCode, rotated.body).toBe(HTTP_OK);
			expect(setCookies(rotated)).toEqual([]);
			const tokens = parseSuccessEnvelope(rotated, RefreshMobileResponseSchema).data;
			expect(tokens.tokenTransport).toBe("body");
			expect(tokens.refreshToken).not.toBe(session.refreshToken);
			const me = await app.inject({ method: "GET", url: `${API_VERSION_PREFIX}/auth/me`, headers: mobileHeaders({ authorization: `Bearer ${tokens.accessToken}` }) });
			expect(me.statusCode, me.body).toBe(HTTP_OK);

			const audit = await auditBodies(rotated);
			expect(audit.requestBody).toEqual({ refreshToken: "[REDACTED]" });
			expect(audit.responseBody).toMatchObject({ data: { accessToken: "[REDACTED]", refreshToken: "[REDACTED]" } });
		});

		it("detects reuse of an older refresh token and revokes the whole session family", async () => {
			const session = await signInWithoutTwoFactor();
			const first = parseSuccessEnvelope(await refresh(session.refreshToken), RefreshMobileResponseSchema).data;
			const second = parseSuccessEnvelope(await refresh(first.refreshToken), RefreshMobileResponseSchema).data;

			// The ORIGINAL token is two rotations old: not a benign concurrent refresh, a replay.
			const replay = await refresh(session.refreshToken);
			const afterReuse = await refresh(second.refreshToken);

			expect(replay.statusCode).toBe(HTTP_UNAUTHORIZED);
			expect(afterReuse.statusCode).toBe(HTTP_UNAUTHORIZED);
		});

		it("rejects a mobile refresh that carries only a cookie (401 REFRESH_TOKEN_MISSING)", async () => {
			const session = await signInWithoutTwoFactor();

			const response = await app.inject({
				method: "POST",
				url: `${API_VERSION_PREFIX}/auth/refresh`,
				headers: mobileHeaders({ cookie: `refreshToken=${session.refreshToken}` }),
				payload: {},
			});

			expect(response.statusCode).toBe(HTTP_UNAUTHORIZED);
			expect(errorCodeOf(response)).toBe("REFRESH_TOKEN_MISSING");
		});

		it("rejects a browser refresh that presents the token in the body (401 REFRESH_TOKEN_TRANSPORT_MISMATCH), even next to its cookie", async () => {
			const session = await signInWithoutTwoFactor();

			const response = await app.inject({
				method: "POST",
				url: `${API_VERSION_PREFIX}/auth/refresh`,
				headers: mutationHeaders({ "x-forwarded-for": uniqueClientIp(), cookie: `refreshToken=${session.refreshToken}` }),
				payload: { refreshToken: session.refreshToken },
			});

			expect(response.statusCode).toBe(HTTP_UNAUTHORIZED);
			expect(errorCodeOf(response)).toBe("REFRESH_TOKEN_TRANSPORT_MISMATCH");
			expect(setCookies(response).some((cookie: string): boolean => cookie.startsWith("accessToken="))).toBe(false);
		});
	});

	describe("two-factor enrollment and 2FA sign-in", () => {
		it("setup returns the otpauth:// key URI; after enabling, password → TOTP → emailed code yields body tokens", async () => {
			const session = await signInWithoutTwoFactor(twoFactorEmail);
			const bearer = { authorization: `Bearer ${session.accessToken}` };

			const setupResponse = await post("2fa/setup", {}, mobileHeaders(bearer));
			expect(setupResponse.statusCode, setupResponse.body).toBe(HTTP_CREATED);
			const setup = parseSuccessEnvelope(setupResponse, TwoFactorSetupResponseSchema).data;
			expect(setup.otpAuthUrl.startsWith("otpauth://totp/")).toBe(true);
			expect(setup.otpAuthUrl).toContain(`secret=${setup.secret}`);

			const nowSeconds: number = Math.floor(Date.now() / MS_PER_SECOND);
			const enabled = await post("2fa/enable", { token: generateSync({ secret: setup.secret, epoch: nowSeconds }) }, mobileHeaders(bearer));
			expect(enabled.statusCode, enabled.body).toBe(HTTP_OK);

			// Enabling bumps the token version: the old access token is dead, the
			// refresh token mints a new pair (how a forced enrollment completes).
			const stale = await app.inject({ method: "GET", url: `${API_VERSION_PREFIX}/auth/me`, headers: mobileHeaders(bearer) });
			expect(stale.statusCode).toBe(HTTP_UNAUTHORIZED);
			const upgraded = await refresh(session.refreshToken);
			expect(upgraded.statusCode, upgraded.body).toBe(HTTP_OK);
			expect(parseSuccessEnvelope(upgraded, RefreshMobileResponseSchema).data.tokenTransport).toBe("body");

			// Fresh sign-in: password → TOTP → emailed code → tokens.
			const passwordStep = await post("login", { email: twoFactorEmail, password: PASSWORD }, mobileHeaders());
			expect(passwordStep.statusCode, passwordStep.body).toBe(HTTP_CREATED);
			const challenge = parseSuccessEnvelope(passwordStep, LoginTwoFactorPendingResponseSchema).data;

			const nextStepCode: string = generateSync({ secret: setup.secret, epoch: nowSeconds + TOTP_PERIOD_SECONDS });
			const { response: totpStep, code } = await withEmailedCode(() => post("login/2fa", { tempToken: challenge.tempToken, token: nextStepCode }, mobileHeaders()));
			expect(totpStep.statusCode, totpStep.body).toBe(HTTP_OK);
			expect(setCookies(totpStep)).toEqual([]);
			const pending = parseSuccessEnvelope(totpStep, LoginVerificationPendingResponseSchema).data;

			const verified = await post("verify-login", { verificationId: pending.verificationId, code }, mobileHeaders());
			expect(verified.statusCode, verified.body).toBe(HTTP_OK);
			expect(setCookies(verified)).toEqual([]);
			const twoFactorSession = parseSuccessEnvelope(verified, LoginMobileResponseSchema).data;
			expect(twoFactorSession.user.twoFactorEnabled).toBe(true);

			// A backup code completes the 2FA step the same way.
			const backupPassword = await post("login", { email: twoFactorEmail, password: PASSWORD }, mobileHeaders());
			const backupChallenge = parseSuccessEnvelope(backupPassword, LoginTwoFactorPendingResponseSchema).data;
			const backupCode: string = z.string().parse(setup.backupCodes.at(0));
			const backupStep = await post("login/backup-code", { tempToken: backupChallenge.tempToken, backupCode }, mobileHeaders());
			expect(backupStep.statusCode, backupStep.body).toBe(HTTP_OK);
			expect(setCookies(backupStep)).toEqual([]);
			expect(parseSuccessEnvelope(backupStep, LoginVerificationPendingResponseSchema).data.requiresVerification).toBe(true);
		});
	});

	describe("logout", () => {
		it("logout with the body token revokes this device session, sets no cookie, and is idempotent", async () => {
			const loggedIn = await signInWithoutTwoFactor();

			const loggedOut = await post("logout", { refreshToken: loggedIn.refreshToken }, mobileHeaders());
			expect(loggedOut.statusCode, loggedOut.body).toBe(HTTP_CREATED);
			expect(setCookies(loggedOut)).toEqual([]);

			const afterLogout = await refresh(loggedIn.refreshToken);
			expect(afterLogout.statusCode).toBe(HTTP_UNAUTHORIZED);

			const again = await post("logout", { refreshToken: loggedIn.refreshToken }, mobileHeaders());
			const withoutToken = await post("logout", {}, mobileHeaders());
			expect(again.statusCode).toBe(HTTP_CREATED);
			expect(withoutToken.statusCode).toBe(HTTP_CREATED);
		});

		it("logout-all with the body token signs out every device session of the user", async () => {
			const phone = await signInWithoutTwoFactor();
			const tablet = await signInWithoutTwoFactor();

			const response = await post("logout-all", { refreshToken: phone.refreshToken }, mobileHeaders());
			expect(response.statusCode, response.body).toBe(HTTP_CREATED);
			expect(setCookies(response)).toEqual([]);

			expect((await refresh(phone.refreshToken)).statusCode).toBe(HTTP_UNAUTHORIZED);
			expect((await refresh(tablet.refreshToken)).statusCode).toBe(HTTP_UNAUTHORIZED);
			const me = await app.inject({ method: "GET", url: `${API_VERSION_PREFIX}/auth/me`, headers: mobileHeaders({ authorization: `Bearer ${tablet.accessToken}` }) });
			expect(me.statusCode).toBe(HTTP_UNAUTHORIZED);
		});

		it("logout-all without a body token is rejected (401 REFRESH_TOKEN_MISSING)", async () => {
			const response = await post("logout-all", {}, mobileHeaders());

			expect(response.statusCode).toBe(HTTP_UNAUTHORIZED);
			expect(errorCodeOf(response)).toBe("REFRESH_TOKEN_MISSING");
		});
	});

	describe("forced upgrade (426)", () => {
		it.each<[string, Record<string, string>, string]>([
			["missing", { "x-client-type": "mobile" }, "missing"],
			["malformed", { "x-client-type": "mobile", "x-app-version": "v1.4" }, "malformed"],
			["older than the minimum", { "x-client-type": "mobile", "x-app-version": "1.1.9" }, "below_minimum"],
			["a prerelease of the minimum", { "x-client-type": "mobile", "x-app-version": "1.2.0-rc.1" }, "below_minimum"],
		])("answers a %s X-App-Version with 426 APP_VERSION_UNSUPPORTED in the standard envelope, before login runs", async (_label, versionHeaders, reason) => {
			const response = await post("login", { email, password: PASSWORD }, { ...versionHeaders, "x-forwarded-for": uniqueClientIp() });

			expect(response.statusCode).toBe(HTTP_UPGRADE_REQUIRED);
			const envelope = ApiErrorResponseSchema.parse(response.json());
			expect(envelope.error).toEqual({
				code: "APP_VERSION_UNSUPPORTED",
				message: "This version of the app is no longer supported. Please update the app to continue.",
				details: { reason, minimumVersion: MINIMUM_VERSION },
			});
			expect(envelope.meta.correlationId.length).toBeGreaterThan(0);
		});

		it("answers 426 (not 401) on an authenticated route and on refresh, so the app shows the update screen instead of signing out", async () => {
			const me = await app.inject({ method: "GET", url: `${API_VERSION_PREFIX}/auth/me`, headers: { "x-client-type": "mobile", "x-app-version": "1.0.0" } });
			const refreshed = await post("refresh", { refreshToken: "irrelevant" }, { "x-client-type": "mobile", "x-app-version": "1.0.0", "x-forwarded-for": uniqueClientIp() });

			expect(me.statusCode).toBe(HTTP_UPGRADE_REQUIRED);
			expect(refreshed.statusCode).toBe(HTTP_UPGRADE_REQUIRED);
		});

		it("serves the minimum version itself and newer ones", async () => {
			const atMinimum = await app.inject({ method: "GET", url: `${API_VERSION_PREFIX}/auth/me`, headers: { "x-client-type": "mobile", "x-app-version": MINIMUM_VERSION } });

			expect(atMinimum.statusCode).toBe(HTTP_UNAUTHORIZED);
			expect(errorCodeOf(atMinimum)).toBe("ACCESS_TOKEN_MISSING");
		});

		it.each(["web", "admin", "merchant"])("never checks browser client type %s", async (clientType: string) => {
			const response = await app.inject({ method: "GET", url: `${API_VERSION_PREFIX}/auth/me`, headers: { "x-client-type": clientType, "x-app-version": "0.0.1" } });

			expect(response.statusCode).toBe(HTTP_UNAUTHORIZED);
		});
	});
});
