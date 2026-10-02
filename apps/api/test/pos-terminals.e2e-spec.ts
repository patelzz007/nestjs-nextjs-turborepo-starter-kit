import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	API_VERSION_PREFIX,
	ApiErrorResponseSchema,
	MerchantTerminalPairingSchema,
	MerchantTerminalSettingsResponseSchema,
	MerchantTerminalSummarySchema,
	PosPairedTerminalSchema,
	type MerchantTerminalPairing,
} from "@workspace/shared";
import { z } from "zod";

import { ORGANIZATION_SEED_IDS, ORGANIZATION_SEED_SLUGS } from "../prisma/seed/organizations";
import { DEMO_MERCHANT_API_KEYS } from "../prisma/seed/rewards";
import { createE2eApp, login, type InjectResponse, type LoginResult, mutationHeaders, parseSuccessEnvelope, uniqueClientIp } from "./e2e-helpers";

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";

/** Every terminal this file registers is named with this prefix, so cleanup finds exactly them. */
const NAME_PREFIX = "E2E pairing";
/** A well-formed backup code no claim has — a 404 from validate proves the POS call got past authentication. */
const UNKNOWN_BACKUP_CODE = "ZZZZ2222";
/** A seeded terminal registered to the KL store. */
const REGISTERED_KL_TERMINAL = "KL-REGISTER-01";

/**
 * POS terminal registration end to end: an owner registers a till, the till
 * pairs with the one-time code and calls the POS API with only its own key;
 * re-pairing rotates the key, removing the till revokes it, and the merchant's
 * "only allow registered terminals" switch governs manually created keys.
 */
describe("POS terminal pairing (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let owner: LoginResult;
	let cashier: LoginResult;

	const terminalsPath = `${API_VERSION_PREFIX}/orgs/${ORGANIZATION_SEED_SLUGS.kl}/terminals`;

	function merchantCookies(session: LoginResult): Record<string, string> {
		return { cookie: `merchantAccessToken=${session.accessToken}; merchantRefreshToken=${session.refreshToken}`, "x-client-type": "merchant" };
	}

	function errorCodeOf(response: InjectResponse): string {
		return ApiErrorResponseSchema.parse(response.json()).error.code;
	}

	async function register(name: string): Promise<MerchantTerminalPairing> {
		const response = await app.inject({
			method: "POST",
			url: terminalsPath,
			headers: mutationHeaders(merchantCookies(owner)),
			payload: { name: `${NAME_PREFIX} ${name}`, locationId: ORGANIZATION_SEED_IDS.klLocation },
		});
		expect(response.statusCode, response.body).toBe(201);
		return parseSuccessEnvelope(response, MerchantTerminalPairingSchema).data;
	}

	function pair(pairingCode: string): Promise<InjectResponse> {
		return app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/pos/terminals/pair`,
			headers: { "content-type": "application/json", "cf-connecting-ip": uniqueClientIp() },
			payload: JSON.stringify({ pairingCode }),
		});
	}

	function validate(apiKey: string, terminalId?: string): Promise<InjectResponse> {
		return app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/redemptions/validate`,
			headers: { "x-api-key": apiKey, "content-type": "application/json", ...(terminalId !== undefined ? { "x-terminal-id": terminalId } : {}) },
			payload: JSON.stringify({ backupCode: UNKNOWN_BACKUP_CODE }),
		});
	}

	async function listTerminals(): Promise<z.output<typeof MerchantTerminalSummarySchema>[]> {
		const response = await app.inject({ method: "GET", url: terminalsPath, headers: merchantCookies(owner) });
		expect(response.statusCode, response.body).toBe(200);
		return parseSuccessEnvelope(response, z.array(MerchantTerminalSummarySchema)).data;
	}

	async function setRequireRegistered(requireRegisteredTerminals: boolean): Promise<void> {
		const response = await app.inject({
			method: "PATCH",
			url: `${terminalsPath}/settings`,
			headers: mutationHeaders(merchantCookies(owner)),
			payload: { requireRegisteredTerminals },
		});
		expect(response.statusCode, response.body).toBe(200);
		expect(parseSuccessEnvelope(response, MerchantTerminalSettingsResponseSchema).data.requireRegisteredTerminals).toBe(requireRegisteredTerminals);
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: DATABASE_URL });
		owner = await login(app, "brew.owner@kl-rewards.demo", "BrewOwner@123", "merchant");
		cashier = await login(app, "brew.cashier@kl-rewards.demo", "BrewCashier@123", "merchant");
	});

	afterAll(async () => {
		await setRequireRegistered(false);
		const client = await pool.connect();
		try {
			await client.query("SELECT set_config('app.rls_bypass', 'true', false)");
			const keyIds = await client.query<{ apiKeyId: string | null }>(`SELECT api_key_id AS "apiKeyId" FROM public.organization_terminals WHERE label LIKE $1`, [
				`${NAME_PREFIX}%`,
			]);
			await client.query(`DELETE FROM public.organization_terminals WHERE label LIKE $1`, [`${NAME_PREFIX}%`]);
			await client.query(`DELETE FROM public.organization_api_keys WHERE name LIKE $1 OR id = ANY($2::text[])`, [
				`${NAME_PREFIX}%`,
				keyIds.rows.flatMap((row) => (row.apiKeyId === null ? [] : [row.apiKeyId])),
			]);
		} finally {
			client.release();
		}
		await pool.end();
		await app.close();
	});

	it("registers a till, pairs it once, and lets it call the POS API with only its own key", async () => {
		const registered = await register("front counter");
		expect(registered.terminal).toMatchObject({ status: "AWAITING_PAIRING", locationId: ORGANIZATION_SEED_IDS.klLocation });
		expect(registered.terminal.terminalId).toMatch(/^TERM-/u);

		const paired = await pair(registered.pairingCode);
		expect(paired.statusCode, paired.body).toBe(201);
		const till = parseSuccessEnvelope(paired, PosPairedTerminalSchema).data;
		expect(till).toMatchObject({ terminalId: registered.terminal.terminalId, organization: { slug: ORGANIZATION_SEED_SLUGS.kl } });

		// Authenticated (the unknown code is the only problem) — no X-Terminal-Id needed.
		const call = await validate(till.apiKey);
		expect(call.statusCode, call.body).toBe(404);
		expect(errorCodeOf(call)).toBe("REDEMPTION_TOKEN_INVALID");

		const otherTill = await validate(till.apiKey, REGISTERED_KL_TERMINAL);
		expect(otherTill.statusCode).toBe(403);
		expect(errorCodeOf(otherTill)).toBe("TERMINAL_KEY_MISMATCH");

		const reused = await pair(registered.pairingCode);
		expect(reused.statusCode).toBe(404);
		expect(errorCodeOf(reused)).toBe("PAIRING_CODE_INVALID");

		const listed = (await listTerminals()).find((terminal) => terminal.id === registered.terminal.id);
		expect(listed?.status).toBe("ACTIVE");
		expect(listed?.lastSeenAt).not.toBeNull();
	});

	it("re-pairing rotates the key and removing the till revokes it", async () => {
		const registered = await register("drive-through");
		const first = parseSuccessEnvelope(await pair(registered.pairingCode), PosPairedTerminalSchema).data;

		const reissued = await app.inject({ method: "POST", url: `${terminalsPath}/${registered.terminal.id}/pairing-code`, headers: mutationHeaders(merchantCookies(owner)) });
		expect(reissued.statusCode, reissued.body).toBe(201);
		const second = parseSuccessEnvelope(await pair(parseSuccessEnvelope(reissued, MerchantTerminalPairingSchema).data.pairingCode), PosPairedTerminalSchema).data;

		expect((await validate(first.apiKey)).statusCode).toBe(401);
		expect((await validate(second.apiKey)).statusCode).toBe(404);

		const removed = await app.inject({ method: "DELETE", url: `${terminalsPath}/${registered.terminal.id}`, headers: mutationHeaders(merchantCookies(owner)) });
		expect(removed.statusCode, removed.body).toBe(200);
		expect((await validate(second.apiKey)).statusCode).toBe(401);
		expect((await listTerminals()).some((terminal) => terminal.id === registered.terminal.id)).toBe(false);
	});

	it("keeps registration to members who may manage API keys", async () => {
		const response = await app.inject({
			method: "POST",
			url: terminalsPath,
			headers: mutationHeaders(merchantCookies(cashier)),
			payload: { name: `${NAME_PREFIX} cashier attempt`, locationId: ORGANIZATION_SEED_IDS.klLocation },
		});

		expect(response.statusCode).toBe(403);
		expect(errorCodeOf(response)).toBe("ORGANIZATION_ROLE_CAPABILITY_REQUIRED");
	});

	it("refuses unregistered tills for manually created keys once the merchant turns the switch on", async () => {
		expect((await validate(DEMO_MERCHANT_API_KEYS.kl, "E2E-UNREGISTERED-TILL")).statusCode).toBe(404);

		await setRequireRegistered(true);

		const unregistered = await validate(DEMO_MERCHANT_API_KEYS.kl, "E2E-UNREGISTERED-TILL");
		expect(unregistered.statusCode).toBe(401);
		expect(errorCodeOf(unregistered)).toBe("TERMINAL_NOT_REGISTERED");
		expect((await validate(DEMO_MERCHANT_API_KEYS.kl, REGISTERED_KL_TERMINAL)).statusCode).toBe(404);

		await setRequireRegistered(false);
	});
});
