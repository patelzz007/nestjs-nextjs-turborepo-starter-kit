import { Prisma } from "@prisma/client";
import { epochMs } from "@workspace/shared";
import { describe, expect, it, vi, type Mock } from "vitest";

import { createTestTypedConfig } from "../../../../../test/support/test-api-env";
import { PrismaService } from "../../../../prisma/prisma.service";
import { OrganizationApiKey } from "../../domain/aggregates/organization-api-key.aggregate";
import { OrganizationTerminal } from "../../domain/aggregates/organization-terminal.aggregate";
import { RewardSale } from "../../domain/aggregates/reward-sale.aggregate";
import { SaleIdempotencyKeyTakenError, TerminalIdTakenError } from "../../domain/errors/pos.errors";
import { newSale, NOW, presented } from "../../domain/__tests__/pos-domain.fixture";
import { PrismaOrganizationApiKeyRepository } from "../persistence/prisma-organization-api-key.repository";
import { LIVE_TERMINAL_ID_INDEX, PrismaOrganizationTerminalRepository, TerminalNotSavedError } from "../persistence/prisma-organization-terminal.repository";
import { PrismaRewardSaleRepository, SALE_IDEMPOTENCY_KEY_INDEX } from "../persistence/prisma-reward-sale.repository";
import { committedUniqueIndexNames } from "../../../../platform/infrastructure/persistence/__tests__/committed-unique-indexes";
import { LIVE_ROW_FIELDS } from "../../../../platform/infrastructure/persistence/__tests__/base-row-fields";

vi.mock("../../../../prisma/prisma.service", () => ({ PrismaService: class {} }));

function uniqueViolationOn(index: string): Prisma.PrismaClientKnownRequestError {
	return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
		code: "P2002",
		clientVersion: "test",
		meta: { driverAdapterError: { cause: { constraint: { index } } } },
	});
}

/** A stored sale row as `STORED_SALE_SELECT` reads it. */
const SALE_ROW = {
	id: "sale-1",
	billTotalMinor: 5_000n,
	currency: "MYR",
	paidAt: BigInt(NOW),
	idempotencyKey: "idem-1",
	requestHash: "hash-1",
	redemptions: [
		{ id: "redemption-a", claimId: "claim-2", redemptionMethod: "MANUAL" },
		{ id: "redemption-b", claimId: "claim-1", redemptionMethod: "SCAN" },
	],
};

interface SaleDatabase {
	readonly prisma: PrismaService;
	readonly createSale: Mock<(args: Prisma.RewardSaleCreateArgs) => Promise<object>>;
	readonly createRedemptions: Mock<(args: Prisma.RewardRedemptionCreateManyArgs) => Promise<Prisma.BatchPayload>>;
	readonly findSale: Mock<(args: Prisma.RewardSaleFindUniqueArgs) => Promise<typeof SALE_ROW | null>>;
}

function saleDatabase(): SaleDatabase {
	const createSale = vi.fn<(args: Prisma.RewardSaleCreateArgs) => Promise<object>>().mockResolvedValue({ id: "sale-1" });
	const createRedemptions = vi.fn<(args: Prisma.RewardRedemptionCreateManyArgs) => Promise<Prisma.BatchPayload>>().mockResolvedValue({ count: 2 });
	const findSale = vi.fn<(args: Prisma.RewardSaleFindUniqueArgs) => Promise<typeof SALE_ROW | null>>().mockResolvedValue(SALE_ROW);
	const prisma = Object.assign(new PrismaService(createTestTypedConfig()), {
		rewardSale: { create: createSale, findUnique: findSale, findUniqueOrThrow: findSale },
		rewardRedemption: { createMany: createRedemptions },
	});
	return { prisma, createSale, createRedemptions, findSale };
}

describe("PrismaRewardSaleRepository", () => {
	const sale = (): RewardSale => RewardSale.checkout(newSale([presented({ claimId: "claim-1" }), presented({ claimId: "claim-2" }, "MANUAL")]), NOW);

	it("inserts the sale and one redemption row per line, then reads it back in redemption-id order", async () => {
		const db = saleDatabase();

		await expect(new PrismaRewardSaleRepository(db.prisma).add(sale())).resolves.toEqual({
			id: "sale-1",
			billTotalMinor: 5_000,
			currency: "MYR",
			paidAt: NOW,
			idempotencyKey: "idem-1",
			requestHash: "hash-1",
			lines: [
				{ redemptionId: "redemption-a", claimId: "claim-2", method: "MANUAL" },
				{ redemptionId: "redemption-b", claimId: "claim-1", method: "SCAN" },
			],
		});
		expect(db.createSale.mock.calls.at(0)?.at(0)?.data).toMatchObject({ id: "sale-1", idempotencyKey: "idem-1", requestHash: "hash-1", billTotalMinor: 5_000, paidAt: NOW });
		expect(db.createRedemptions.mock.calls.at(0)?.at(0)?.data).toEqual([
			expect.objectContaining({ claimId: "claim-1", saleId: "sale-1", redemptionMethod: "SCAN", redeemedAt: NOW }),
			expect.objectContaining({ claimId: "claim-2", saleId: "sale-1", redemptionMethod: "MANUAL", redeemedAt: NOW }),
		]);
	});

	it("answers the idempotency index's refusal as SaleIdempotencyKeyTakenError, and rethrows any other failure", async () => {
		const db = saleDatabase();
		const repository = new PrismaRewardSaleRepository(db.prisma);
		db.createSale.mockRejectedValueOnce(uniqueViolationOn(SALE_IDEMPOTENCY_KEY_INDEX));
		const other = uniqueViolationOn("RewardSale_pkey");
		db.createSale.mockRejectedValueOnce(other);

		await expect(repository.add(sale())).rejects.toBeInstanceOf(SaleIdempotencyKeyTakenError);
		await expect(repository.add(sale())).rejects.toBe(other);
		expect(db.createRedemptions).not.toHaveBeenCalled();
	});

	it("finds a sale by its organization's idempotency key, or nothing", async () => {
		const db = saleDatabase();
		const repository = new PrismaRewardSaleRepository(db.prisma);

		await expect(repository.findByIdempotencyKey("org-1", "idem-1")).resolves.toMatchObject({
			id: "sale-1",
			lines: [{ redemptionId: "redemption-a" }, { redemptionId: "redemption-b" }],
		});
		expect(db.findSale.mock.calls.at(0)?.at(0)?.where).toEqual({ organizationId_idempotencyKey: { organizationId: "org-1", idempotencyKey: "idem-1" } });
		db.findSale.mockResolvedValueOnce(null);
		await expect(repository.findByIdempotencyKey("org-1", "idem-2")).resolves.toBeNull();
	});
});

/** A terminal row with every column the repository reads. */
function terminalRow(patch: Partial<Prisma.OrganizationTerminalGetPayload<object>> = {}): Prisma.OrganizationTerminalGetPayload<object> {
	return {
		...LIVE_ROW_FIELDS,
		id: "terminal-1",
		organizationId: "org-1",
		locationId: "store-a",
		terminalId: "TERM-AAAA2222",
		label: "Front till",
		apiKeyId: null,
		pairingCodeHash: "hash:code",
		pairingCodeExpiresAt: BigInt(NOW + 1),
		pairingCodeIssuedByUserId: "member-1",
		pairingCodeIssuedAt: BigInt(NOW),
		pairedAt: null,
		lastSeenAt: null,
		createdByUserId: "member-1",
		createdAt: BigInt(NOW),
		updatedAt: BigInt(NOW),
		isDeleted: false,
		deletedAt: null,
		deletedBy: null,
		...patch,
	};
}

type TerminalRow = ReturnType<typeof terminalRow>;

interface TerminalDatabase {
	readonly prisma: PrismaService;
	readonly lock: Mock<() => Promise<object[]>>;
	readonly create: Mock<(args: Prisma.OrganizationTerminalCreateArgs) => Promise<object>>;
	readonly findFirst: Mock<(args: Prisma.OrganizationTerminalFindFirstArgs) => Promise<TerminalRow | null>>;
	readonly updateMany: Mock<(args: Prisma.OrganizationTerminalUpdateManyArgs) => Promise<Prisma.BatchPayload>>;
	readonly count: Mock<(args: Prisma.OrganizationTerminalCountArgs) => Promise<number>>;
}

function terminalDatabase(): TerminalDatabase {
	const lock = vi.fn<() => Promise<object[]>>().mockResolvedValue([]);
	const create = vi.fn<(args: Prisma.OrganizationTerminalCreateArgs) => Promise<object>>().mockResolvedValue({ id: "terminal-1" });
	const findFirst = vi.fn<(args: Prisma.OrganizationTerminalFindFirstArgs) => Promise<TerminalRow | null>>().mockResolvedValue(terminalRow());
	const updateMany = vi.fn<(args: Prisma.OrganizationTerminalUpdateManyArgs) => Promise<Prisma.BatchPayload>>().mockResolvedValue({ count: 1 });
	const count = vi.fn<(args: Prisma.OrganizationTerminalCountArgs) => Promise<number>>().mockResolvedValue(0);
	const prisma = Object.assign(new PrismaService(createTestTypedConfig()), { $queryRaw: lock, organizationTerminal: { create, findFirst, updateMany, count } });
	return { prisma, lock, create, findFirst, updateMany, count };
}

const REGISTERED = {
	id: "terminal-1",
	organizationId: "org-1",
	locationId: "store-a",
	terminalId: "TERM-AAAA2222",
	name: "Front till",
	createdByUserId: "member-1",
	pairingCode: { hash: "hash:code", expiresAt: epochMs(NOW + 1), issuedByUserId: "member-1", issuedAt: NOW },
};

describe("PrismaOrganizationTerminalRepository", () => {
	it("inserts a registered till with its first code, answering the live terminal-id index as TerminalIdTaken", async () => {
		const db = terminalDatabase();
		const repository = new PrismaOrganizationTerminalRepository(db.prisma);

		await repository.add(OrganizationTerminal.register(REGISTERED));
		expect(db.create.mock.calls.at(0)?.at(0)?.data).toMatchObject({ id: "terminal-1", createdByUserId: "member-1", pairingCodeHash: "hash:code", pairingCodeIssuedAt: NOW });

		db.create.mockRejectedValueOnce(uniqueViolationOn(LIVE_TERMINAL_ID_INDEX));
		await expect(repository.add(OrganizationTerminal.register(REGISTERED))).rejects.toBeInstanceOf(TerminalIdTakenError);
	});

	it("refuses to insert a loaded (not registered) till", async () => {
		const repository = new PrismaOrganizationTerminalRepository(terminalDatabase().prisma);

		await expect(repository.add(OrganizationTerminal.rehydrate({ ...REGISTERED, label: null, apiKeyId: null, pairingCode: null, pairedAt: null }))).rejects.toBeInstanceOf(
			TerminalNotSavedError,
		);
	});

	it("locks a live till of the organization FOR UPDATE before reading it (D33), and finds no deleted or foreign one", async () => {
		const db = terminalDatabase();
		const repository = new PrismaOrganizationTerminalRepository(db.prisma);

		await expect(repository.lockLive("terminal-1", "org-1")).resolves.toBeInstanceOf(OrganizationTerminal);
		expect(db.lock).toHaveBeenCalledOnce();
		expect(db.findFirst.mock.calls.at(0)?.at(0)?.where).toEqual({ id: "terminal-1", organizationId: "org-1", isDeleted: false });
		expect(db.lock.mock.invocationCallOrder.at(0)).toBeLessThan(db.findFirst.mock.invocationCallOrder.at(0) ?? 0);
		db.findFirst.mockResolvedValueOnce(null);
		await expect(repository.lockLive("terminal-1", "org-1")).resolves.toBeNull();
	});

	it("consumes a live, unexpired code with a compare-and-set on its hash, so only one concurrent pairing wins", async () => {
		const db = terminalDatabase();
		const repository = new PrismaOrganizationTerminalRepository(db.prisma);

		await expect(repository.consumePairingCode(["hash:code"], NOW)).resolves.toBeInstanceOf(OrganizationTerminal);
		expect(db.updateMany.mock.calls.at(0)?.at(0)).toEqual({
			where: { id: "terminal-1", pairingCodeHash: "hash:code", isDeleted: false },
			data: { pairingCodeHash: null, pairingCodeExpiresAt: null },
		});
		db.updateMany.mockResolvedValueOnce({ count: 0 });
		await expect(repository.consumePairingCode(["hash:code"], NOW)).resolves.toBeNull();
	});

	it("never consumes an expired code, or a removed till's", async () => {
		const db = terminalDatabase();
		const repository = new PrismaOrganizationTerminalRepository(db.prisma);
		db.findFirst.mockResolvedValueOnce(terminalRow({ pairingCodeExpiresAt: BigInt(NOW - 1) })).mockResolvedValueOnce(terminalRow({ isDeleted: true }));

		await expect(repository.consumePairingCode(["hash:code"], NOW)).resolves.toBeNull();
		await expect(repository.consumePairingCode(["hash:code"], NOW)).resolves.toBeNull();
		expect(db.updateMany).not.toHaveBeenCalled();
	});

	it("writes each change only to a live row, and treats a vanished row as a programming error", async () => {
		const db = terminalDatabase();
		const repository = new PrismaOrganizationTerminalRepository(db.prisma);
		const terminal = OrganizationTerminal.rehydrate({ ...REGISTERED, label: null, apiKeyId: "key-1", pairedAt: NOW });
		terminal.remove("member-1", NOW);

		await repository.save(terminal);
		expect(db.updateMany.mock.calls.at(0)?.at(0)).toEqual({
			where: { id: "terminal-1", isDeleted: false },
			data: { isDeleted: true, deletedAt: NOW, deletedBy: "member-1", pairingCodeHash: null, pairingCodeExpiresAt: null, updatedAt: NOW },
		});
		db.updateMany.mockResolvedValueOnce({ count: 0 });
		await expect(repository.save(terminal)).rejects.toBeInstanceOf(TerminalNotSavedError);
		await expect(repository.save(OrganizationTerminal.rehydrate({ ...REGISTERED, label: null, apiKeyId: null, pairingCode: null, pairedAt: null }))).rejects.toBeInstanceOf(
			TerminalNotSavedError,
		);
	});

	it("counts retired tills' terminal ids as used", async () => {
		const db = terminalDatabase();
		db.count.mockResolvedValueOnce(1);

		await expect(new PrismaOrganizationTerminalRepository(db.prisma).terminalIdExists("org-1", "TERM-AAAA2222")).resolves.toBe(true);
		expect(db.count.mock.calls.at(0)?.at(0)?.where).toEqual({ organizationId: "org-1", terminalId: "TERM-AAAA2222" });
	});
});

describe("PrismaOrganizationApiKeyRepository", () => {
	function keyDatabase(): { readonly prisma: PrismaService; readonly updateMany: Mock<(args: Prisma.OrganizationApiKeyUpdateManyArgs) => Promise<Prisma.BatchPayload>> } {
		const updateMany = vi.fn<(args: Prisma.OrganizationApiKeyUpdateManyArgs) => Promise<Prisma.BatchPayload>>().mockResolvedValue({ count: 1 });
		return { prisma: Object.assign(new PrismaService(createTestTypedConfig()), { organizationApiKey: { updateMany } }), updateMany };
	}

	it("revokes with a compare-and-set on revokedAt IS NULL (D34): the loser of a race writes nothing", async () => {
		const db = keyDatabase();
		const repository = new PrismaOrganizationApiKeyRepository(db.prisma);
		const key = OrganizationApiKey.rehydrate({ id: "key-1", organizationId: "org-1", locationId: null, revokedAt: null });
		key.revoke(NOW);

		await expect(repository.save(key)).resolves.toBe(true);
		expect(db.updateMany).toHaveBeenCalledWith({ where: { id: "key-1", revokedAt: null }, data: { revokedAt: NOW, updatedAt: NOW } });
		db.updateMany.mockResolvedValueOnce({ count: 0 });
		await expect(repository.save(key)).resolves.toBe(false);
	});

	it("writes nothing for a key that was not revoked in this unit of work", async () => {
		const db = keyDatabase();

		await expect(
			new PrismaOrganizationApiKeyRepository(db.prisma).save(
				OrganizationApiKey.rehydrate({ id: "key-1", organizationId: "org-1", locationId: null, revokedAt: epochMs(NOW - 1) }),
			),
		).resolves.toBe(false);
		expect(db.updateMany).not.toHaveBeenCalled();
	});
});

describe("the unique indexes the POS repositories map to domain errors", () => {
	it("exist under these names in the committed migrations", () => {
		const indexes: ReadonlySet<string> = committedUniqueIndexNames();

		expect(indexes.has(SALE_IDEMPOTENCY_KEY_INDEX)).toBe(true);
		expect(indexes.has(LIVE_TERMINAL_ID_INDEX)).toBe(true);
	});
});
