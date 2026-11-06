import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { API_VERSION_PREFIX, ApiErrorResponseSchema, MerchantTerminalPairingSchema, PosPairedTerminalSchema } from "@workspace/shared";

import { TENANT_SEED_IDS, TENANT_SEED_SLUGS } from "../prisma/seed/tenants";
import { createE2eApp, login, type InjectResponse, type LoginResult, mutationHeaders, parseSuccessEnvelope, uniqueClientIp } from "./e2e-helpers";

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";

/** Every terminal this file registers is named with this prefix, so cleanup finds exactly them. */
const NAME_PREFIX = "E2E pairing race";

/**
 * D33 against a real Postgres: two pairing codes issued for one till at the same time both succeed,
 * but the till's row lock serialises them, so exactly one code — the one written last — pairs it. The
 * other answers 404 `PAIRING_CODE_INVALID`, as an unknown code does.
 */
describe("POS pairing-code issue race (e2e, D33)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let owner: LoginResult;

	const terminalsPath = `${API_VERSION_PREFIX}/tenants/${TENANT_SEED_SLUGS.kl}/terminals`;

	function merchantCookies(session: LoginResult): Record<string, string> {
		return { cookie: `merchantAccessToken=${session.accessToken}; merchantRefreshToken=${session.refreshToken}`, "x-client-type": "merchant" };
	}

	function pair(pairingCode: string): Promise<InjectResponse> {
		return app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/integration/terminals/pair`,
			headers: { "content-type": "application/json", "x-forwarded-for": uniqueClientIp() },
			payload: JSON.stringify({ pairingCode }),
		});
	}

	function issueCode(terminalRowId: string): Promise<InjectResponse> {
		return app.inject({ method: "POST", url: `${terminalsPath}/${terminalRowId}/pairing-code`, headers: mutationHeaders(merchantCookies(owner)) });
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: DATABASE_URL });
		owner = await login(app, "brew.owner@kl-rewards.demo", "BrewOwner@123", "merchant");
	});

	afterAll(async () => {
		const client = await pool.connect();
		try {
			await client.query("SELECT set_config('app.rls_bypass', 'true', false)");
			const keyIds = await client.query<{ apiKeyId: string | null }>(`SELECT "apiKeyId" AS "apiKeyId" FROM public."TenantTerminal" WHERE label LIKE $1`, [`${NAME_PREFIX}%`]);
			await client.query(`DELETE FROM public."TenantTerminal" WHERE label LIKE $1`, [`${NAME_PREFIX}%`]);
			await client.query(`DELETE FROM public."TenantApiKey" WHERE id = ANY($1::text[])`, [keyIds.rows.flatMap((row) => (row.apiKeyId === null ? [] : [row.apiKeyId]))]);
		} finally {
			client.release();
		}
		await pool.end();
		await app.close();
	});

	it("issues both concurrent codes, and only the one written last pairs the till", async () => {
		const registered = await app.inject({
			method: "POST",
			url: terminalsPath,
			headers: mutationHeaders(merchantCookies(owner)),
			payload: { name: `${NAME_PREFIX} till`, locationId: TENANT_SEED_IDS.klLocation },
		});
		expect(registered.statusCode, registered.body).toBe(201);
		const terminal = parseSuccessEnvelope(registered, MerchantTerminalPairingSchema).data.terminal;

		const issued = await Promise.all([issueCode(terminal.id), issueCode(terminal.id)]);
		expect(issued.map((response) => response.statusCode)).toEqual([201, 201]);
		const codes = issued.map((response) => parseSuccessEnvelope(response, MerchantTerminalPairingSchema).data.pairingCode);
		expect(new Set(codes).size).toBe(2);

		const attempts = [];
		for (const code of codes) {
			attempts.push(await pair(code));
		}

		expect(attempts.map((response) => response.statusCode).sort((left, right) => left - right)).toEqual([201, 404]);
		const refused = attempts.find((response) => response.statusCode === 404);
		expect(refused === undefined ? null : ApiErrorResponseSchema.parse(refused.json()).error.code).toBe("PAIRING_CODE_INVALID");
		const paired = attempts.find((response) => response.statusCode === 201);
		expect(paired === undefined ? null : parseSuccessEnvelope(paired, PosPairedTerminalSchema).data.terminalId).toBe(terminal.terminalId);
	});
});
