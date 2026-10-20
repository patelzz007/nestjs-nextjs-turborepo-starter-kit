import type { Prisma } from "@prisma/client";
import { epochMs } from "@workspace/shared";
import { describe, expect, it, vi, type Mock } from "vitest";

import { createTestTypedConfig } from "../../../../../test/support/test-api-env";
import type { ActorContext } from "../../../../platform/application/actor-context";
import type { RlsTransactionScope } from "../../../../platform/infrastructure/unit-of-work/actor-to-rls-context";
import { PrismaReadExecutor } from "../../../../platform/infrastructure/unit-of-work/prisma-read-executor";
import type { RlsTransactionRunner } from "../../../../platform/infrastructure/unit-of-work/prisma-unit-of-work";
import { PrismaService } from "../../../../prisma/prisma.service";
import type { SystemDatabaseContext } from "../../../../prisma/tenant-context";
import { ApiKeyCapabilitiesAdapter } from "../adapters/api-key-capabilities.adapter";
import { PRISMA_STORE_CLOSURE_FACTORY } from "../adapters/prisma-store-closure";
import { PrismaTillTerminals } from "../adapters/prisma-till-terminals";

vi.mock("../../../../prisma/prisma.service", () => ({ PrismaService: class {} }));

const NOW = epochMs(1_800_000_000_000);

describe("PrismaStoreClosure (D27)", () => {
	type FindTerminals = (args: Prisma.TenantTerminalFindManyArgs) => Promise<readonly { readonly id: string; readonly apiKeyId: string | null }[]>;
	type UpdateTerminals = (args: Prisma.TenantTerminalUpdateManyArgs) => Promise<Prisma.BatchPayload>;
	type UpdateKeys = (args: Prisma.TenantApiKeyUpdateManyArgs) => Promise<Prisma.BatchPayload>;

	function closureDatabase(): {
		readonly prisma: PrismaService;
		readonly findTerminals: Mock<FindTerminals>;
		readonly updateTerminals: Mock<UpdateTerminals>;
		readonly updateKeys: Mock<UpdateKeys>;
	} {
		const findTerminals = vi.fn<FindTerminals>().mockResolvedValue([
			{ id: "terminal-1", apiKeyId: "key-1" },
			{ id: "terminal-2", apiKeyId: null },
		]);
		const updateTerminals = vi.fn<UpdateTerminals>().mockResolvedValue({ count: 2 });
		const updateKeys = vi.fn<UpdateKeys>().mockResolvedValue({ count: 3 });
		const prisma = Object.assign(new PrismaService(createTestTypedConfig()), {
			tenantTerminal: { findMany: findTerminals, updateMany: updateTerminals },
			tenantApiKey: { updateMany: updateKeys },
		});
		return { prisma, findTerminals, updateTerminals, updateKeys };
	}

	it("soft-deletes the store's live tills (clearing their codes) and revokes the store's keys and the tills' keys, in the caller's transaction", async () => {
		const db = closureDatabase();

		await expect(
			PRISMA_STORE_CLOSURE_FACTORY.forTransaction(db.prisma).closeStore({ tenantId: "org-1", locationId: "store-a", closedByUserId: "owner-1", closedAt: NOW }),
		).resolves.toEqual({ terminalsRemoved: 2, apiKeysRevoked: 3 });

		expect(db.findTerminals.mock.calls.at(0)?.at(0)?.where).toEqual({ tenantId: "org-1", locationId: "store-a", isDeleted: false });
		expect(db.updateTerminals).toHaveBeenCalledWith({
			where: { id: { in: ["terminal-1", "terminal-2"] }, isDeleted: false },
			data: { isDeleted: true, deletedAt: NOW, deletedBy: "owner-1", pairingCodeHash: null, pairingCodeExpiresAt: null, updatedAt: NOW },
		});
		expect(db.updateKeys).toHaveBeenCalledWith({
			where: { tenantId: "org-1", isDeleted: false, revokedAt: null, OR: [{ locationId: "store-a" }, { id: { in: ["key-1"] } }] },
			data: { revokedAt: NOW, updatedAt: NOW },
		});
	});
});

describe("PrismaTillTerminals", () => {
	it("finds a live till of the tenant by its terminal id, and stamps when it was last seen", async () => {
		const findFirst = vi.fn<(args: Prisma.TenantTerminalFindFirstArgs) => Promise<{ readonly id: string; readonly locationId: string } | null>>();
		findFirst.mockResolvedValue({ id: "terminal-1", locationId: "store-a" });
		const update = vi.fn<(args: Prisma.TenantTerminalUpdateArgs) => Promise<object>>().mockResolvedValue({ id: "terminal-1" });
		const prisma = Object.assign(new PrismaService(createTestTypedConfig()), { tenantTerminal: { findFirst, update } });
		const tills = new PrismaTillTerminals({
			withSystemOperation: <TResult>(_context: SystemDatabaseContext, work: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult> => work(prisma),
		});

		await expect(tills.findLive("org-1", "TERM-AAAA2222")).resolves.toEqual({ id: "terminal-1", locationId: "store-a" });
		await tills.touchLastSeen("terminal-1", NOW);

		expect(findFirst.mock.calls.at(0)?.at(0)?.where).toEqual({ tenantId: "org-1", terminalId: "TERM-AAAA2222", isDeleted: false });
		expect(update).toHaveBeenCalledWith({ where: { id: "terminal-1" }, data: { lastSeenAt: NOW }, select: { id: true } });
	});
});

describe("ApiKeyCapabilitiesAdapter", () => {
	const KEY: Extract<ActorContext, { kind: "api_key" }> = {
		kind: "api_key",
		apiKeyId: "key-1",
		tenantId: "org-1",
		locationId: null,
		terminalId: null,
		request: { requestId: "req-1", ip: null, userAgent: null, deviceLabel: null, endpoint: null },
	};

	/** Runs every read on the fake client, recording the RLS scope it was asked for. */
	class RecordingRunner implements RlsTransactionRunner<Prisma.TransactionClient> {
		public readonly scopes: RlsTransactionScope[] = [];

		public constructor(private readonly db: Prisma.TransactionClient) {}

		public withRlsContext<TResult>(scope: RlsTransactionScope, handler: (db: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult> {
			this.scopes.push(scope);
			return handler(this.db);
		}
	}

	it("maps a live key's scope to its capabilities, read under the key's own RLS session; a revoked or missing key has none", async () => {
		const findFirst = vi.fn<(args: Prisma.TenantApiKeyFindFirstArgs) => Promise<{ readonly scope: "POS" | "INTEGRATION" } | null>>();
		findFirst.mockResolvedValueOnce({ scope: "INTEGRATION" }).mockResolvedValueOnce(null);
		const runner = new RecordingRunner(Object.assign(new PrismaService(createTestTypedConfig()), { tenantApiKey: { findFirst } }));
		const adapter = new ApiKeyCapabilitiesAdapter(new PrismaReadExecutor(runner));

		await expect(adapter.capabilitiesOf(KEY)).resolves.toEqual(["merchant:view_rewards", "merchant:manage_rewards", "merchant:view_redemptions", "merchant:view_analytics"]);
		await expect(adapter.capabilitiesOf(KEY)).resolves.toBeNull();

		expect(findFirst.mock.calls.at(0)?.at(0)?.where).toEqual({ id: "key-1", tenantId: "org-1", isDeleted: false, revokedAt: null });
		expect(runner.scopes).toHaveLength(2);
		expect(runner.scopes.at(0)).toMatchObject({ context: { apiKeyId: "key-1", tenantId: "org-1", userId: null, bypass: false } });
	});
});
