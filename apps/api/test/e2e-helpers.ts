import { randomInt } from "node:crypto";

import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyMultipart from "@fastify/multipart";
import { Test, type TestingModule, type TestingModuleBuilder } from "@nestjs/testing";
import type { Prisma } from "@prisma/client";
import { Pool } from "pg";
import {
	API_VERSION_PREFIX,
	isArrayValue,
	MUTATION_INTENT_HEADER,
	MUTATION_INTENT_VALUE,
	ApiPaginatedMetaSchema,
	ApiSuccessResponseSchema,
	TenantGrantResponseSchema,
	type ApiPaginatedMeta,
	type PermissionPair,
	type ApiResponseMeta,
} from "@workspace/shared";
import { z } from "zod";

import { AppModule } from "../src/app.module";
import { userRlsContext } from "../src/prisma/rls-context";
import { TenantTransactionService } from "../src/prisma/tenant-transaction.service";
import { TrustedProxies } from "../src/platform/infrastructure/http/client-ip";
import { getApiConfig } from "../src/config/api-config";
import { HealthService } from "../src/platform/presentation/http/health/health.service";

export interface LoginResult {
	readonly accessToken: string;
	readonly refreshToken: string;
}

/** The resolved result of `app.inject({...})` (light-my-request response). */
export type InjectResponse = Awaited<ReturnType<NestFastifyApplication["inject"]>>;

/** A success envelope whose `data` has been validated against a known schema. */
export interface ParsedSuccessEnvelope<Data> {
	readonly success: true;
	readonly data: Data;
	readonly meta: ApiResponseMeta;
}

/**
 * Parses an injected response body as the standard success envelope
 * (`{ success: true, data, meta }`) with `data` validated by `dataSchema`.
 * Throws (failing the test) when the body does not match the contract, so
 * assertions only ever run against a typed, validated value.
 */
export function parseSuccessEnvelope<DataSchema extends z.ZodType>(response: InjectResponse, dataSchema: DataSchema): ParsedSuccessEnvelope<z.output<DataSchema>> {
	const envelope = ApiSuccessResponseSchema.parse(response.json());
	return { success: envelope.success, data: dataSchema.parse(envelope.data), meta: envelope.meta };
}

/** A parsed paginated success envelope: the page's items and its pagination meta. */
export interface ParsedPaginatedEnvelope<Item> {
	readonly data: readonly Item[];
	readonly meta: ApiPaginatedMeta;
}

/**
 * Parses an injected response body as the paginated success envelope (`{ success: true, data: [...],
 * meta: { limit, total, page, … } }`). {@link parseSuccessEnvelope} keeps only the base meta (the
 * envelope schema strips unknown keys), so a paginated response is parsed against its own contract.
 */
export function parsePaginatedEnvelope<ItemSchema extends z.ZodType>(response: InjectResponse, itemSchema: ItemSchema): ParsedPaginatedEnvelope<z.output<ItemSchema>> {
	const envelope = ApiSuccessResponseSchema.extend({ meta: ApiPaginatedMetaSchema }).parse(response.json());
	return { data: z.array(itemSchema).parse(envelope.data), meta: envelope.meta };
}

const CLIENT_ORIGIN = "http://localhost:3000";

/** Synthetic client addresses come from 198.18.0.0/15 (RFC 2544 benchmarking space). */
const SYNTHETIC_IP_FIRST_OCTET = 198;
const SYNTHETIC_IP_SECOND_OCTET_BASE = 18;
/** Values one IPv4 octet can take. */
const OCTET_VALUES = 256;
/** Addresses available in 198.18.0.0/15 — two /16 blocks. */
const SYNTHETIC_IP_POOL_SIZE = 2 * OCTET_VALUES * OCTET_VALUES;

/**
 * Random per-file start: every e2e file gets a fresh copy of this module, and
 * the auth throttler buckets live in Redis across files AND across runs (60 s
 * window), so a fixed start made every file's first login share one bucket and
 * hit 429 once enough files logged in.
 */
let nextClientIpIndex: number = randomInt(SYNTHETIC_IP_POOL_SIZE);

/**
 * Distinct synthetic client IPs so auth throttler buckets do not collide across
 * e2e logins, files or runs. Send it as `X-Forwarded-For`: the e2e env trusts
 * the loopback test client as a proxy (TEST_E2E_PROXY), so the API resolves it
 * exactly as it resolves a real client behind a trusted reverse proxy.
 */
export function uniqueClientIp(): string {
	const index: number = nextClientIpIndex % SYNTHETIC_IP_POOL_SIZE;
	nextClientIpIndex += 1;
	const block: number = Math.floor(index / (OCTET_VALUES * OCTET_VALUES));
	const third: number = Math.floor(index / OCTET_VALUES) % OCTET_VALUES;
	const fourth: number = index % OCTET_VALUES;
	return `${String(SYNTHETIC_IP_FIRST_OCTET)}.${String(SYNTHETIC_IP_SECOND_OCTET_BASE + block)}.${String(third)}.${String(fourth)}`;
}

/** Removes stale TEAM_MEMBER invites so invite e2e tests are repeatable (uses RLS bypass). */
export async function clearPendingTeamInviteForEmail(pool: Pool, tenantId: string, email: string): Promise<void> {
	const client = await pool.connect();
	try {
		await client.query(`SELECT set_config('app.rls_bypass', 'true', true)`);
		await client.query(
			`DELETE FROM public."TenantInvitationLocationScope"
       WHERE "invitationId" IN (
         SELECT id FROM public."TenantInvitation"
         WHERE "tenantId" = $1 AND email = $2 AND kind = 'TEAM_MEMBER' AND status = 'PENDING'
       )`,
			[tenantId, email],
		);
		await client.query(
			`DELETE FROM public."TenantInvitation"
       WHERE "tenantId" = $1 AND email = $2 AND kind = 'TEAM_MEMBER' AND status = 'PENDING'`,
			[tenantId, email],
		);
	} finally {
		client.release();
	}
}

/**
 * Precondition for suites that sign in as a seeded customer and call full-session
 * routes. Several seed customers (alice.johnson@example.com among them) are seeded
 * UNVERIFIED on purpose — they demo the verify-email flow — so such a suite must
 * establish the verified state itself instead of relying on another suite having
 * done it first (suite order differs between machines and CI). The restriction
 * itself stays in force: this sets the same column the verify-email flow sets.
 */
export async function markSeedUserEmailVerified(pool: Pool, email: string): Promise<void> {
	// COALESCE keeps an existing verification timestamp (idempotent across runs).
	const result = await pool.query(`UPDATE public."User" SET "emailVerifiedAt" = COALESCE("emailVerifiedAt", $1) WHERE email = $2`, [Date.now(), email]);
	if (result.rowCount !== 1) {
		throw new Error(`Seed user ${email} is missing — run pnpm db:seed`);
	}
}

/** How long an e2e precondition stays true: a full run, with room to spare, never outlives it. */
const E2E_PRECONDITION_MS = 7 * 86_400_000;

/**
 * Gives seed users a full (unrestricted) session for this run: a verified email and an MFA
 * enrollment deadline a week ahead. A spec that signs in sets this itself — the seed's deadline
 * runs out a month after seeding, and other specs move it, so what is stored is never a given.
 */
export async function grantSeedUsersFullSession(pool: Pool, emails: readonly string[]): Promise<void> {
	const now = Date.now();
	// The deadline is moot for anyone already enrolled in MFA; it is set for every listed user alike.
	const result = await pool.query(`UPDATE public."User" SET "emailVerifiedAt" = COALESCE("emailVerifiedAt", $1), "mfaEnrollmentDeadline" = $2 WHERE email = ANY($3)`, [
		now,
		now + E2E_PRECONDITION_MS,
		[...emails],
	]);
	if (result.rowCount !== emails.length) {
		throw new Error(`A seed user among ${emails.join(", ")} is missing — run pnpm db:seed`);
	}
}

/**
 * Puts a seed reward back in the review queue for this run. The seed lets it auto-publish a day
 * after seeding (the dev API's scheduler does so), so a spec that needs it pending says so.
 */
export async function resetSeedRewardToPendingReview(pool: Pool, rewardId: string): Promise<void> {
	const now = Date.now();
	const result = await pool.query(
		`UPDATE public."Reward" SET status = 'PENDING_REVIEW', "submittedForReviewAt" = $1, "autoPublishAt" = $2, "reviewedAt" = NULL, "reviewedByUserId" = NULL WHERE id = $3`,
		[now, now + E2E_PRECONDITION_MS, rewardId],
	);
	if (result.rowCount !== 1) {
		throw new Error(`Seed reward ${rewardId} is missing — run pnpm db:seed`);
	}
}

export function mutationHeaders(extra: Record<string, string> = {}): Record<string, string> {
	return {
		origin: CLIENT_ORIGIN,
		[MUTATION_INTENT_HEADER]: MUTATION_INTENT_VALUE,
		...extra,
	};
}

export function extractCookie(setCookieHeader: string | string[] | undefined, name: string): string | undefined {
	if (setCookieHeader === undefined) {
		return undefined;
	}
	const headers: readonly string[] = isArrayValue(setCookieHeader) ? setCookieHeader : [setCookieHeader];
	for (const header of headers) {
		const [pair] = header.split(";");
		if (pair === undefined) {
			continue;
		}
		const [cookieName, value] = pair.split("=", 2);
		if (cookieName === name && value !== undefined) {
			return value;
		}
	}
	return undefined;
}

/**
 * Boots the real AppModule for e2e. `customize` may swap a provider for a
 * TEST-ONLY one (e.g. the malware scanner) before the graph compiles.
 */
export async function createE2eApp(
	customize: (builder: TestingModuleBuilder) => TestingModuleBuilder = (builder: TestingModuleBuilder): TestingModuleBuilder => builder,
): Promise<NestFastifyApplication> {
	const moduleFixture: TestingModule = await customize(
		Test.createTestingModule({
			imports: [AppModule],
		}),
	).compile();

	// Same trusted-proxy list as bootstrap-app.ts, so request.ip (rate limits) and the request context agree.
	const trustProxy = new TrustedProxies(getApiConfig().http.trustedProxies).toFastifyTrustProxy();
	const app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter({ trustProxy }), { rawBody: true });
	await app.register(fastifyCookie);
	// Multipart bodies (local-storage uploads) — registered on the Fastify instance, as register-fastify-plugins.ts does in production.
	await app.getHttpAdapter().getInstance().register(fastifyMultipart);
	await app.init();
	app.get(HealthService).markReady();
	return app;
}

/** One transaction as a tenant member. Reward fixtures use this instead of a request-wide bypass. */
export function withTenantMember<T>(app: NestFastifyApplication, userId: string, tenantId: string, work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
	return app.get(TenantTransactionService).withRlsContext({ context: userRlsContext(userId, tenantId, false), reason: null }, work);
}

export async function login(app: NestFastifyApplication, email: string, password: string, clientType?: "admin" | "merchant" | "web"): Promise<LoginResult> {
	const response = await app.inject({
		method: "POST",
		url: `${API_VERSION_PREFIX}/auth/login`,
		headers: mutationHeaders({
			"x-forwarded-for": uniqueClientIp(),
			...(clientType === undefined ? {} : { "x-client-type": clientType }),
		}),
		payload: { email, password },
	});

	const accessToken = extractCookie(
		response.headers["set-cookie"],
		clientType === "admin" ? "adminAccessToken" : clientType === "merchant" ? "merchantAccessToken" : "accessToken",
	);
	const refreshToken = extractCookie(
		response.headers["set-cookie"],
		clientType === "admin" ? "adminRefreshToken" : clientType === "merchant" ? "merchantRefreshToken" : "refreshToken",
	);

	if (accessToken === undefined || refreshToken === undefined) {
		throw new Error(`Login failed for ${email}: status ${String(response.statusCode)} body ${response.body}`);
	}

	return { accessToken, refreshToken };
}

function merchantSessionHeaders(session: LoginResult): Record<string, string> {
	return { cookie: `merchantAccessToken=${session.accessToken}; merchantRefreshToken=${session.refreshToken}`, "x-client-type": "merchant" };
}

/**
 * A tenant administrator gives a member one extra permission through the tenant access API (ADR 067),
 * permanent unless `expiresAt` is given; returns the grant's id for {@link revokeTenantGrant}.
 */
export async function grantTenantPermission(
	app: NestFastifyApplication,
	granter: LoginResult,
	grant: { readonly tenantSlug: string; readonly membershipId: string; readonly permission: PermissionPair; readonly expiresAt?: number },
): Promise<string> {
	const response = await app.inject({
		method: "POST",
		url: `${API_VERSION_PREFIX}/tenants/${grant.tenantSlug}/access/members/${grant.membershipId}/grants`,
		headers: mutationHeaders(merchantSessionHeaders(granter)),
		payload: { permission: grant.permission, ...(grant.expiresAt === undefined ? {} : { expiresAt: grant.expiresAt }) },
	});
	return parseSuccessEnvelope(response, TenantGrantResponseSchema).data.id;
}

/** Takes a grant made by {@link grantTenantPermission} back (its granter always may). */
export async function revokeTenantGrant(app: NestFastifyApplication, granter: LoginResult, tenantSlug: string, grantId: string): Promise<void> {
	const response = await app.inject({
		method: "DELETE",
		url: `${API_VERSION_PREFIX}/tenants/${tenantSlug}/access/grants/${grantId}`,
		headers: mutationHeaders(merchantSessionHeaders(granter)),
	});
	parseSuccessEnvelope(response, z.object({ ok: z.literal(true) }));
}

/** `[ACTION, RESOURCE]` pairs of GLOBAL catalogue permissions. */
export type TestPermissionPairs = readonly (readonly [string, string])[];

/**
 * A narrow platform role for one spec (ADR 067 retired the seeded platform Manager, the old "lesser
 * staff" persona): exactly `permissions`, optionally held by the seed account `holderEmail`. Remove
 * it with {@link dropTestPlatformRole} in the spec's `afterAll`.
 */
export async function createTestPlatformRole(
	pool: Pool,
	role: { readonly id: string; readonly label: string; readonly permissions: TestPermissionPairs; readonly holderEmail?: string },
): Promise<void> {
	await pool.query(`INSERT INTO public."Role" (id, name, description, kind, "isSystem") VALUES ($1, $2, 'e2e test role', 'PLATFORM', false)`, [
		role.id,
		`e2e ${role.label} ${role.id}`,
	]);
	for (const [action, resource] of role.permissions) {
		await pool.query(
			`INSERT INTO public."RolePermission" (id, "roleId", "permissionId")
			 SELECT uuidv7(), $1, p.id FROM public."Permission" p WHERE p.action::text = $2 AND p.resource::text = $3 AND p.scope = 'GLOBAL' AND p."isDeleted" = false`,
			[role.id, action, resource],
		);
	}
	if (role.holderEmail !== undefined) {
		await pool.query(`INSERT INTO public."UserRole" (id, "userId", "roleId") SELECT uuidv7(), u.id, $1 FROM public."User" u WHERE u.email = $2`, [role.id, role.holderEmail]);
	}
}

/** Removes a {@link createTestPlatformRole} role with its permissions and assignments. */
export async function dropTestPlatformRole(pool: Pool, roleId: string): Promise<void> {
	await pool.query(`DELETE FROM public."UserRole" WHERE "roleId" = $1`, [roleId]);
	await pool.query(`DELETE FROM public."RolePermission" WHERE "roleId" = $1`, [roleId]);
	await pool.query(`DELETE FROM public."Role" WHERE id = $1`, [roleId]);
}
