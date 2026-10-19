import { Logger } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

import { ORGANIZATION_SEED_IDS } from "../prisma/seed/organization-seed-ids";
import { getApiConfig } from "../src/config/api-config";
import { TypedConfigService } from "../src/config/typed-config.service";
import { RequestContextService } from "../src/platform/infrastructure/context/request-context";
import { AsyncLocalCorrelationScope } from "../src/platform/infrastructure/context/work-correlation";
import { MissingTenantContextError } from "../src/prisma/missing-tenant-context.error";
import { PrismaService } from "../src/prisma/prisma.service";
import { apiKeyRlsContext, rlsStorage, systemRlsContext, userRlsContext } from "../src/prisma/rls-context";
import { TenantTransactionService } from "../src/prisma/tenant-transaction.service";

/** Brew & Bean KL owner (seeded). */
const KL_OWNER_USER_ID = "019b76da-a800-763a-b64a-fd037629f93f";
const POLICY_VERSION = 7;

const SessionRowSchema = z.object({
	role: z.string(),
	userId: z.string(),
	organizationId: z.string(),
	rls_bypass: z.string(),
	systemOperation: z.string(),
	apiKeyId: z.string(),
	api_key_location_id: z.string(),
	actorPurpose: z.string(),
	policyVersion: z.string(),
	correlationId: z.string(),
});

const SessionRowsSchema = z.tuple([SessionRowSchema]);

type SessionRow = z.output<typeof SessionRowSchema>;

/** Every transaction-local setting a TenantTransactionService transaction stamps, read back inside it. */
async function readSession(tx: Prisma.TransactionClient): Promise<SessionRow> {
	const rows = await tx.$queryRaw`SELECT
		current_user AS role,
		current_setting('app.current_user_id', true) AS "userId",
		current_setting('app.current_organization_id', true) AS "organizationId",
		current_setting('app.rls_bypass', true) AS rls_bypass,
		current_setting('app.system_operation', true) AS "systemOperation",
		current_setting('app.current_api_key_id', true) AS "apiKeyId",
		current_setting('app.current_api_key_location_id', true) AS api_key_location_id,
		current_setting('app.actor_purpose', true) AS "actorPurpose",
		COALESCE(current_setting('app.policy_version', true), '') AS "policyVersion",
		current_setting('app.correlation_id', true) AS "correlationId"`;
	const [row] = SessionRowsSchema.parse(rows);
	return row;
}

describe("TenantTransactionService session stamping (e2e)", () => {
	let prisma: PrismaService;
	let transactions: TenantTransactionService;

	beforeAll(async () => {
		prisma = new PrismaService(new TypedConfigService(getApiConfig()));
		prisma.onModuleInit();
		await prisma.ensureConnected();
		transactions = new TenantTransactionService(prisma, new RequestContextService());
	});

	afterAll(async () => {
		await prisma.onModuleDestroy();
	});

	it("stamps a tenant user's RLS session and clears the policy version", async () => {
		const scope = { context: userRlsContext(KL_OWNER_USER_ID, ORGANIZATION_SEED_IDS.klOrganization, true), reason: null };

		const session = await transactions.withRlsContext(scope, readSession);

		expect(session).toMatchObject({
			role: "app_runtime",
			userId: KL_OWNER_USER_ID,
			organizationId: ORGANIZATION_SEED_IDS.klOrganization,
			rls_bypass: "false",
			systemOperation: "",
			apiKeyId: "",
			api_key_location_id: "",
			actorPurpose: "",
			policyVersion: "",
		});
		expect(session.correlationId.length).toBeGreaterThan(0);
	});

	it("stamps an API-key principal with its organization and store", async () => {
		const scope = { context: apiKeyRlsContext("key-1", ORGANIZATION_SEED_IDS.klOrganization, "store-1"), reason: null };

		const session = await transactions.withRlsContext(scope, readSession);

		expect(session).toMatchObject({ userId: "", apiKeyId: "key-1", api_key_location_id: "store-1", rls_bypass: "false", policyVersion: "" });
	});

	it("stamps a system scope with its operation's role, the bypass, the acting user and the audit reason", async () => {
		const scope = { context: systemRlsContext("outbox.enqueue", KL_OWNER_USER_ID, ORGANIZATION_SEED_IDS.klOrganization), reason: "e2e session stamp" };

		const session = await transactions.withRlsContext(scope, readSession);

		expect(session).toMatchObject({
			userId: KL_OWNER_USER_ID,
			organizationId: ORGANIZATION_SEED_IDS.klOrganization,
			rls_bypass: "true",
			systemOperation: "outbox.enqueue",
			actorPurpose: "e2e session stamp",
			policyVersion: "",
		});
	});

	it("fails closed, before any query, for a user scope that requires an organization and has none", async () => {
		let ran = false;
		const scope = { context: userRlsContext(KL_OWNER_USER_ID, null, true), reason: null };

		await expect(
			transactions.withRlsContext(scope, async (tx): Promise<SessionRow> => {
				ran = true;
				return readSession(tx);
			}),
		).rejects.toBeInstanceOf(MissingTenantContextError);
		expect(ran).toBe(false);
	});

	it("lets a user scope without an organization through when it does not require one (refresh-token subject)", async () => {
		const session = await transactions.withRlsContext({ context: userRlsContext(KL_OWNER_USER_ID, null, false), reason: null }, readSession);

		expect(session).toMatchObject({ userId: KL_OWNER_USER_ID, organizationId: "", rls_bypass: "false" });
	});

	it("stamps the encryption session's purpose and policy version on a tenant transaction", async () => {
		const session = await transactions.withTenantTransaction(
			{ userId: KL_OWNER_USER_ID, organizationId: ORGANIZATION_SEED_IDS.klOrganization, purpose: "e2e-purpose", policyVersion: POLICY_VERSION },
			readSession,
		);

		expect(session).toMatchObject({ actorPurpose: "e2e-purpose", policyVersion: String(POLICY_VERSION), rls_bypass: "false" });
	});

	it("runs a system operation for a tenant user without an organization (multi-tenant audit write), checked out under its own scope", async () => {
		const tenantUserWithoutOrganization = userRlsContext(KL_OWNER_USER_ID, null, true);
		const session = await rlsStorage.run(tenantUserWithoutOrganization, () =>
			transactions.withSystemOperation({ operation: "outbox.enqueue", reason: "e2e checkout scope", actorUserId: KL_OWNER_USER_ID }, readSession),
		);

		expect(session).toMatchObject({ systemOperation: "outbox.enqueue", rls_bypass: "true", userId: KL_OWNER_USER_ID });
	});

	it("logs a system-scope read once per request per operation, and every call outside a request", async () => {
		const requestContext = new RequestContextService();
		const scoped = new TenantTransactionService(prisma, requestContext);
		const scope = { context: systemRlsContext("outbox.enqueue", null, null), reason: "e2e audit once" };
		const log = vi.spyOn(Logger.prototype, "log").mockImplementation((): void => undefined);
		const auditLines = (): number => log.mock.calls.filter(([entry]) => JSON.stringify(entry).includes('"rls.system_operation"')).length;

		const seed = { correlationId: "corr-audit-once", ip: undefined, userAgent: undefined, edgeLocation: undefined };
		const sessions = await requestContext.run(seed, async () => [await scoped.withRlsContext(scope, readSession), await scoped.withRlsContext(scope, readSession)]);
		expect(sessions.map((session) => session.systemOperation)).toEqual(["outbox.enqueue", "outbox.enqueue"]);
		expect(auditLines()).toBe(1);

		await scoped.withRlsContext(scope, readSession);
		await scoped.withRlsContext(scope, readSession);
		expect(auditLines()).toBe(3);
		log.mockRestore();
	});

	it("stamps one correlation id on every transaction of one background unit of work", async () => {
		const correlation = new AsyncLocalCorrelationScope(new RequestContextService());
		const scope = { context: systemRlsContext("outbox.enqueue", null, null), reason: "e2e correlation" };

		const { opened, first, second } = await correlation.run(async (correlationId: string) => ({
			opened: correlationId,
			first: await transactions.withRlsContext(scope, readSession),
			second: await transactions.withSystemOperation({ operation: "outbox.enqueue", reason: "e2e correlation", actorUserId: null }, readSession),
		}));

		expect(first.correlationId).toBe(opened);
		expect(second.correlationId).toBe(opened);
	});
});
