import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX, ApiErrorResponseSchema, OWN_PROFILE_ERROR_CODES, OwnProfileSchema, UserResponseSchema, type OwnProfile } from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { ImpersonationService } from "../src/modules/impersonation/impersonation.service";
import { runWithSystemRlsContext } from "../src/prisma/rls-context";
import { createE2eApp, login, markSeedUserEmailVerified, mutationHeaders, parseSuccessEnvelope, uniqueClientIp, type InjectResponse, type LoginResult } from "./e2e-helpers";

/**
 * Self-service profile (`GET` / `PATCH /auth/profile`) against the real
 * AppModule, Postgres + RLS and the global audit trail: own-record only,
 * optimistic locking (409 on a stale version, one winner under a race), one
 * transaction with its audit row, `/auth/me` refreshed after a change, and
 * impersonation sessions limited to reading.
 */

const PROFILE_URL = `${API_VERSION_PREFIX}/auth/profile`;
const ME_URL = `${API_VERSION_PREFIX}/auth/me`;
const SUPER_ADMIN_EMAIL = "superadmin@example.com";
/** A seed customer no other e2e suite signs in as (its name is restored after the suite). */
const TARGET_EMAIL = "jack.anderson@example.com";
const TARGET_PASSWORD = "Jack@123";
const USER_AGENT = "own-profile-e2e/1.0";

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_CONFLICT = 409;

const ProfileRowSchema = z.object({ fullName: z.string(), profileVersion: z.number().int() });
const AuditRowSchema = z.object({
	outcome: z.string(),
	responseStatus: z.number().int(),
	errorCode: z.string().nullable(),
	actorUserId: z.string().nullable(),
	impersonatorUserId: z.string().nullable(),
	ipAddress: z.string().nullable(),
	userAgent: z.string().nullable(),
	systemOperations: z.array(z.string()),
});
type AuditRow = z.output<typeof AuditRowSchema>;

describe("Own profile (e2e, real Postgres + RLS + audit trail)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let target: LoginResult;
	let targetId: string;
	let superAdminId: string;
	let originalFullName: string;

	async function userId(email: string): Promise<string> {
		const result = await pool.query<{ id: string }>("SELECT id FROM public.users WHERE email = $1", [email]);
		const id = result.rows.at(0)?.id;
		if (id === undefined) {
			throw new Error(`Seed user missing: ${email} — run pnpm db:seed`);
		}
		return id;
	}

	async function storedProfile(): Promise<z.output<typeof ProfileRowSchema>> {
		const result = await pool.query('SELECT "fullName", profile_version AS "profileVersion" FROM public.users WHERE id = $1', [targetId]);
		return ProfileRowSchema.parse(result.rows.at(0));
	}

	async function auditRows(response: InjectResponse): Promise<readonly AuditRow[]> {
		const result = await pool.query(
			`SELECT outcome::text AS outcome, response_status AS "responseStatus", error_code AS "errorCode", actor_user_id AS "actorUserId",
			        impersonator_user_id AS "impersonatorUserId", ip_address AS "ipAddress", user_agent AS "userAgent", system_operations AS "systemOperations"
			 FROM public.audit_logs WHERE correlation_id = $1`,
			[response.headers["x-correlation-id"]],
		);
		return z.array(AuditRowSchema).parse(result.rows);
	}

	function sessionHeaders(session: LoginResult, clientIp: string = uniqueClientIp()): Record<string, string> {
		return { cookie: `accessToken=${session.accessToken}; refreshToken=${session.refreshToken}`, "x-forwarded-for": clientIp, "user-agent": USER_AGENT };
	}

	async function getProfile(headers: Record<string, string>): Promise<InjectResponse> {
		return app.inject({ method: "GET", url: PROFILE_URL, headers });
	}

	async function patchProfile(headers: Record<string, string>, payload: object): Promise<InjectResponse> {
		return app.inject({ method: "PATCH", url: PROFILE_URL, headers: mutationHeaders(headers), payload });
	}

	async function currentProfile(): Promise<OwnProfile> {
		const response = await getProfile(sessionHeaders(target));
		expect(response.statusCode, response.body).toBe(HTTP_OK);
		return parseSuccessEnvelope(response, OwnProfileSchema).data;
	}

	async function impersonationToken(): Promise<string> {
		const started = await runWithSystemRlsContext("platform.superadmin", () => app.get(ImpersonationService).impersonateUser(superAdminId, targetId));
		return started.accessToken;
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
		targetId = await userId(TARGET_EMAIL);
		superAdminId = await userId(SUPER_ADMIN_EMAIL);
		// The account must hold a full (not enrollment-restricted) session.
		await markSeedUserEmailVerified(pool, TARGET_EMAIL);
		target = await login(app, TARGET_EMAIL, TARGET_PASSWORD);
		originalFullName = (await storedProfile()).fullName;
	});

	afterAll(async () => {
		// Leave the seed account as it was — through the API itself, never a raw write.
		const profile = await currentProfile();
		if (profile.fullName !== originalFullName) {
			const restored = await patchProfile(sessionHeaders(target), { version: profile.version, fullName: originalFullName });
			expect(restored.statusCode, restored.body).toBe(HTTP_OK);
		}
		await pool.end();
		await app.close();
	});

	it("answers 401 without a session", async () => {
		expect((await getProfile({ "x-forwarded-for": uniqueClientIp() })).statusCode).toBe(HTTP_UNAUTHORIZED);
		expect((await patchProfile({ "x-forwarded-for": uniqueClientIp() }, { version: 0, fullName: "Nobody" })).statusCode).toBe(HTTP_UNAUTHORIZED);
	});

	it("returns the caller's own profile, matching the database", async () => {
		const profile = await currentProfile();
		const stored = await storedProfile();

		expect(profile).toMatchObject({ id: targetId, email: TARGET_EMAIL, fullName: stored.fullName, version: stored.profileVersion });
	});

	it("applies an edit at the current version in one audited transaction, and /auth/me shows it at once", async () => {
		const before = await currentProfile();
		// Warm the /auth/me cache with the old name: the edit must drop it.
		const meBefore = await app.inject({ method: "GET", url: ME_URL, headers: sessionHeaders(target) });
		expect(parseSuccessEnvelope(meBefore, UserResponseSchema).data.fullName).toBe(before.fullName);
		const clientIp = uniqueClientIp();

		const response = await patchProfile(sessionHeaders(target, clientIp), { version: before.version, fullName: "  Jack Anderson-Lee  " });

		expect(response.statusCode, response.body).toBe(HTTP_OK);
		expect(parseSuccessEnvelope(response, OwnProfileSchema).data).toMatchObject({ fullName: "Jack Anderson-Lee", version: before.version + 1 });
		expect(await storedProfile()).toEqual({ fullName: "Jack Anderson-Lee", profileVersion: before.version + 1 });
		// Exactly ONE row (written inside the transaction, not again by the interceptor), with the full request context.
		const audit = await auditRows(response);
		expect(audit).toHaveLength(1);
		expect(audit.at(0)).toMatchObject({
			outcome: "SUCCEEDED",
			responseStatus: HTTP_OK,
			errorCode: null,
			actorUserId: targetId,
			impersonatorUserId: null,
			ipAddress: clientIp,
			userAgent: USER_AGENT,
		});
		expect(audit.at(0)?.systemOperations).toContain("auth.profile.update");
		const meAfter = await app.inject({ method: "GET", url: ME_URL, headers: sessionHeaders(target) });
		expect(parseSuccessEnvelope(meAfter, UserResponseSchema).data.fullName).toBe("Jack Anderson-Lee");
	});

	it("answers 409 for a stale version and changes nothing", async () => {
		const current = await currentProfile();
		const stored = await storedProfile();

		const response = await patchProfile(sessionHeaders(target), { version: current.version - 1, fullName: "Stale Edit" });

		expect(response.statusCode, response.body).toBe(HTTP_CONFLICT);
		expect(ApiErrorResponseSchema.parse(response.json()).error.code).toBe("CONFLICT");
		expect(await storedProfile()).toEqual(stored);
		expect(await auditRows(response)).toEqual([expect.objectContaining({ outcome: "FAILED", responseStatus: HTTP_CONFLICT, actorUserId: targetId })]);
	});

	it("lets exactly one of two concurrent edits based on the same version win", async () => {
		const current = await currentProfile();

		const responses = await Promise.all([
			patchProfile(sessionHeaders(target), { version: current.version, fullName: "Racer One" }),
			patchProfile(sessionHeaders(target), { version: current.version, fullName: "Racer Two" }),
		]);

		expect(responses.map((response) => response.statusCode).sort()).toEqual([HTTP_OK, HTTP_CONFLICT]);
		const stored = await storedProfile();
		expect(stored.profileVersion).toBe(current.version + 1);
		expect(["Racer One", "Racer Two"]).toContain(stored.fullName);
	});

	it("rejects invalid bodies with 400: unknown keys, a blank name, nothing to change", async () => {
		const { version } = await currentProfile();
		const stored = await storedProfile();

		for (const payload of [{ version, fullName: "Valid Name", email: "attacker@example.com" }, { version, fullName: "   " }, { version }, { fullName: "No Version" }]) {
			const response = await patchProfile(sessionHeaders(target), payload);
			expect(response.statusCode, JSON.stringify(payload)).toBe(HTTP_BAD_REQUEST);
		}
		expect(await storedProfile()).toEqual(stored);
	});

	describe("during impersonation", () => {
		it("lets the impersonator read the impersonated user's profile", async () => {
			const token = await impersonationToken();

			const response = await getProfile({ authorization: `Bearer ${token}`, "x-forwarded-for": uniqueClientIp() });

			expect(response.statusCode, response.body).toBe(HTTP_OK);
			expect(parseSuccessEnvelope(response, OwnProfileSchema).data.id).toBe(targetId);
		});

		it("refuses an edit with 403, changes nothing, and audits the attempt with the impersonator", async () => {
			const token = await impersonationToken();
			const current = await currentProfile();
			const stored = await storedProfile();

			const response = await patchProfile(
				{ authorization: `Bearer ${token}`, "x-forwarded-for": uniqueClientIp(), "user-agent": USER_AGENT },
				{ version: current.version, fullName: "Changed By Admin" },
			);

			expect(response.statusCode, response.body).toBe(HTTP_FORBIDDEN);
			expect(ApiErrorResponseSchema.parse(response.json()).error.code).toBe(OWN_PROFILE_ERROR_CODES.PROFILE_UPDATE_DURING_IMPERSONATION);
			expect(await storedProfile()).toEqual(stored);
			expect(await auditRows(response)).toEqual([
				expect.objectContaining({
					outcome: "FAILED",
					responseStatus: HTTP_FORBIDDEN,
					errorCode: OWN_PROFILE_ERROR_CODES.PROFILE_UPDATE_DURING_IMPERSONATION,
					actorUserId: targetId,
					impersonatorUserId: superAdminId,
				}),
			]);
		});
	});
});
