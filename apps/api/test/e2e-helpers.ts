import { randomInt } from "node:crypto";

import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import fastifyCookie from "@fastify/cookie";
import { Test, type TestingModule } from "@nestjs/testing";
import { Pool } from "pg";
import { API_VERSION_PREFIX, MUTATION_INTENT_HEADER, MUTATION_INTENT_VALUE, ApiSuccessResponseSchema, type ApiResponseMeta } from "@workspace/shared";
import { type z } from "zod";

import { AppModule } from "../src/app.module";
import { HealthService } from "../src/modules/health/health.service";

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

/** Distinct synthetic IPs so auth throttler buckets do not collide across e2e logins, files or runs. */
export function uniqueClientIp(): string {
	const index: number = nextClientIpIndex % SYNTHETIC_IP_POOL_SIZE;
	nextClientIpIndex += 1;
	const block: number = Math.floor(index / (OCTET_VALUES * OCTET_VALUES));
	const third: number = Math.floor(index / OCTET_VALUES) % OCTET_VALUES;
	const fourth: number = index % OCTET_VALUES;
	return `${String(SYNTHETIC_IP_FIRST_OCTET)}.${String(SYNTHETIC_IP_SECOND_OCTET_BASE + block)}.${String(third)}.${String(fourth)}`;
}

/** Removes stale TEAM_MEMBER invites so invite e2e tests are repeatable (uses RLS bypass). */
export async function clearPendingTeamInviteForEmail(pool: Pool, organizationId: string, email: string): Promise<void> {
	const client = await pool.connect();
	try {
		await client.query(`SELECT set_config('app.rls_bypass', 'true', true)`);
		await client.query(
			`DELETE FROM public.organization_invitation_location_scopes
       WHERE invitation_id IN (
         SELECT id FROM public.organization_invitations
         WHERE organization_id = $1 AND email = $2 AND kind = 'TEAM_MEMBER' AND status = 'PENDING'
       )`,
			[organizationId, email],
		);
		await client.query(
			`DELETE FROM public.organization_invitations
       WHERE organization_id = $1 AND email = $2 AND kind = 'TEAM_MEMBER' AND status = 'PENDING'`,
			[organizationId, email],
		);
	} finally {
		client.release();
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
	const headers: readonly string[] = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
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

export async function createE2eApp(): Promise<NestFastifyApplication> {
	const moduleFixture: TestingModule = await Test.createTestingModule({
		imports: [AppModule],
	}).compile();

	const app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { rawBody: true });
	await app.register(fastifyCookie);
	await app.init();
	app.get(HealthService).markReady();
	return app;
}

export async function login(app: NestFastifyApplication, email: string, password: string, clientType?: "admin" | "merchant" | "web"): Promise<LoginResult> {
	const response = await app.inject({
		method: "POST",
		url: `${API_VERSION_PREFIX}/auth/login`,
		headers: mutationHeaders({
			"cf-connecting-ip": uniqueClientIp(),
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
