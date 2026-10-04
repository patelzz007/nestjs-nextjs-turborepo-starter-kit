import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Test } from "@nestjs/testing";
import { MERCHANT_CAPABILITY, MerchantTerminalListQuerySchema, PosPairingCodeSchema } from "@workspace/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../../prisma/prisma.service";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { OrganizationRewardAuthService } from "../../organization/services/organization-reward-auth.service";
import { MerchantApiKeyRepository } from "../repositories/merchant-api-key.repository";
import { MerchantTerminalRepository, type OrganizationTerminalRow } from "../repositories/merchant-terminal.repository";
import { RewardAuditLogRepository } from "../repositories/reward-audit-log.repository";
import { RewardCodeHasher } from "../crypto/reward-code-hasher";

import { MerchantContextService } from "./merchant-context.service";
import { MerchantTerminalService } from "./merchant-terminal.service";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { ALL_LOCATIONS_SCOPE, selectedLocationsScope } from "../types/merchant-location-scope";

/** Pairing codes are stored as their keyed hash (`REWARD_CODE_HASH_KEYS`). */
const HASHER = new RewardCodeHasher({ 1: Buffer.alloc(32, 6).toString("base64") });

vi.mock("../../../prisma/prisma.service", () => ({ PrismaService: class {} }));
vi.mock("../../../prisma/tenant-transaction.service", () => ({ TenantTransactionService: class {} }));
vi.mock("../../organization/services/organization-reward-auth.service", () => ({ OrganizationRewardAuthService: class {} }));
vi.mock("./merchant-context.service", () => ({ MerchantContextService: class {} }));

const TX = new PrismaService(createTestTypedConfig());
const ORG_SLUG = "brew-bean-kl";
const USER_ID = "owner-1";
const LOCATION_ID = "4d9a3f5e-2f6b-4c55-8f0c-9a4b1c2d3e4f";
const OTHER_LOCATION_ID = "5e0b4a6f-3a7c-4d66-9a1d-0b5c2d3e4f50";
const RESOLVED = {
	organizationId: "org-1",
	slug: ORG_SLUG,
	userId: USER_ID,
	policyVersion: 1,
	membership: { organizationId: "org-1", organizationSlug: ORG_SLUG, displayName: "Brew", role: "OWNER", kybStatus: "APPROVED", lifecycleState: "ACTIVE" },
} satisfies Awaited<ReturnType<OrganizationRewardAuthService["requireCapabilityForSlug"]>>;

function terminalRow(overrides: Partial<OrganizationTerminalRow> = {}): OrganizationTerminalRow {
	return {
		id: "terminal-row-1",
		organizationId: "org-1",
		locationId: LOCATION_ID,
		terminalId: "TERM-WXYZ6789",
		label: "Front counter",
		createdByUserId: "creator-1",
		pairingCodeIssuedByUserId: "creator-1",
		pairingCodeIssuedAt: 0n,
		apiKeyId: null,
		pairingCodeHash: null,
		pairingCodeExpiresAt: null,
		pairedAt: null,
		lastSeenAt: null,
		isDeleted: false,
		deletedAt: null,
		deletedBy: null,
		createdAt: 0n,
		updatedAt: 0n,
		location: { name: "Bangsar" },
		apiKey: null,
		...overrides,
	};
}

describe("MerchantTerminalService", () => {
	let service: MerchantTerminalService;
	const terminals = {
		terminalIdExists: vi.fn<MerchantTerminalRepository["terminalIdExists"]>(),
		create: vi.fn<MerchantTerminalRepository["create"]>(),
		findLiveByIdAndOrg: vi.fn<MerchantTerminalRepository["findLiveByIdAndOrg"]>(),
		findLiveByIdAndOrgForUpdate: vi.fn<MerchantTerminalRepository["findLiveByIdAndOrgForUpdate"]>(),
		listByOrgId: vi.fn<MerchantTerminalRepository["listByOrgId"]>(),
		countStatusSummary: vi.fn<MerchantTerminalRepository["countStatusSummary"]>(),
		setPairingCode: vi.fn<MerchantTerminalRepository["setPairingCode"]>(),
		softDelete: vi.fn<MerchantTerminalRepository["softDelete"]>(),
		setRequireRegisteredTerminals: vi.fn<MerchantTerminalRepository["setRequireRegisteredTerminals"]>(),
	};
	const apiKeys = { revoke: vi.fn<MerchantApiKeyRepository["revoke"]>() };
	const audit = { create: vi.fn<RewardAuditLogRepository["create"]>() };
	const auth = { requireCapabilityForSlug: vi.fn<OrganizationRewardAuthService["requireCapabilityForSlug"]>() };
	const context = {
		assertAccessibleLocationForUser: vi.fn<MerchantContextService["assertAccessibleLocationForUser"]>(),
		resolveUserLocationScope: vi.fn<MerchantContextService["resolveUserLocationScope"]>(),
	};
	const tenantTx = { withTenantTransaction: vi.fn() };

	beforeEach(async () => {
		vi.clearAllMocks();
		auth.requireCapabilityForSlug.mockResolvedValue(RESOLVED);
		context.assertAccessibleLocationForUser.mockResolvedValue(undefined);
		context.resolveUserLocationScope.mockResolvedValue(ALL_LOCATIONS_SCOPE);
		terminals.listByOrgId.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0, nextCursor: null, hasNext: false, hasPrevious: false });
		tenantTx.withTenantTransaction.mockImplementation(async (_context: object, work: (tx: PrismaService) => Promise<object>) => work(TX));
		terminals.terminalIdExists.mockResolvedValue(false);
		terminals.create.mockImplementation((input) =>
			Promise.resolve(
				terminalRow({ terminalId: input.terminalId, label: input.name, pairingCodeHash: input.pairingCodeHash, pairingCodeExpiresAt: BigInt(input.pairingCodeExpiresAt) }),
			),
		);
		audit.create.mockResolvedValue(undefined);

		const moduleRef = await Test.createTestingModule({
			providers: [
				MerchantTerminalService,
				{ provide: MerchantTerminalRepository, useValue: terminals },
				{ provide: MerchantApiKeyRepository, useValue: apiKeys },
				{ provide: RewardAuditLogRepository, useValue: audit },
				{ provide: MerchantContextService, useValue: context },
				{ provide: OrganizationRewardAuthService, useValue: auth },
				{ provide: TenantTransactionService, useValue: tenantTx },
				{ provide: RewardCodeHasher, useValue: HASHER },
			],
		}).compile();
		service = moduleRef.get(MerchantTerminalService);
	});

	it("requires the API-key capability and access to the store before registering a till", async () => {
		await service.create(USER_ID, ORG_SLUG, { name: "Front counter", locationId: LOCATION_ID });

		expect(auth.requireCapabilityForSlug).toHaveBeenCalledWith(USER_ID, ORG_SLUG, MERCHANT_CAPABILITY.manageApiKeys);
		expect(context.assertAccessibleLocationForUser).toHaveBeenCalledWith(USER_ID, ORG_SLUG, LOCATION_ID);
	});

	it("stops when the member lacks the capability or the store", async () => {
		auth.requireCapabilityForSlug.mockRejectedValueOnce(new ForbiddenException());
		await expect(service.create(USER_ID, ORG_SLUG, { name: "Till", locationId: LOCATION_ID })).rejects.toBeInstanceOf(ForbiddenException);

		context.assertAccessibleLocationForUser.mockRejectedValueOnce(new ForbiddenException());
		await expect(service.create(USER_ID, ORG_SLUG, { name: "Till", locationId: LOCATION_ID })).rejects.toBeInstanceOf(ForbiddenException);
		expect(terminals.create).not.toHaveBeenCalled();
	});

	it("returns the pairing code once and stores only its hash", async () => {
		const pairing = await service.create(USER_ID, ORG_SLUG, { name: "Front counter", locationId: LOCATION_ID });

		expect(PosPairingCodeSchema.safeParse(pairing.pairingCode).success).toBe(true);
		const [input] = terminals.create.mock.calls[0] ?? [];
		// Stored as its keyed hash (`REWARD_CODE_HASH_KEYS`), never the code or a plain SHA-256.
		expect(input?.pairingCodeHash).toBe(HASHER.hash(pairing.pairingCode));
		expect(JSON.stringify(input)).not.toContain(pairing.pairingCode);
		expect(pairing.terminal.status).toBe("AWAITING_PAIRING");
	});

	it("tries another terminal id when the generated one is taken", async () => {
		terminals.terminalIdExists.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

		await service.create(USER_ID, ORG_SLUG, { name: "Till", locationId: LOCATION_ID });

		expect(terminals.terminalIdExists).toHaveBeenCalledTimes(2);
	});

	it("removing a paired till locks the row, then revokes the key it holds in the same transaction", async () => {
		terminals.findLiveByIdAndOrgForUpdate.mockResolvedValue(terminalRow({ apiKeyId: "key-1", pairedAt: 1n, apiKey: { revokedAt: null } }));

		await service.remove(USER_ID, ORG_SLUG, "terminal-row-1");

		expect(terminals.softDelete).toHaveBeenCalledWith("terminal-row-1", USER_ID, expect.any(Number), TX);
		expect(apiKeys.revoke).toHaveBeenCalledWith("key-1", expect.any(Number), TX);
	});

	it("answers 404 for a till it cannot see (other organization, or another store under RLS)", async () => {
		terminals.findLiveByIdAndOrg.mockResolvedValue(null);
		terminals.findLiveByIdAndOrgForUpdate.mockResolvedValue(null);

		await expect(service.issuePairingCode(USER_ID, ORG_SLUG, "terminal-row-9")).rejects.toBeInstanceOf(NotFoundException);
		await expect(service.remove(USER_ID, ORG_SLUG, "terminal-row-9")).rejects.toBeInstanceOf(NotFoundException);
	});

	it("refuses the policy switch for an organization without a merchant profile", async () => {
		terminals.setRequireRegisteredTerminals.mockResolvedValue(0);

		await expect(service.updateSettings(USER_ID, ORG_SLUG, { requireRegisteredTerminals: true })).rejects.toBeInstanceOf(NotFoundException);
	});

	it("re-issuing a code records who issued it and when, and never rewrites the terminal's creator", async () => {
		terminals.findLiveByIdAndOrg.mockResolvedValue(terminalRow());
		terminals.setPairingCode.mockImplementation((_id, input) =>
			Promise.resolve(terminalRow({ pairingCodeHash: input.pairingCodeHash, pairingCodeExpiresAt: BigInt(input.pairingCodeExpiresAt) })),
		);

		await service.issuePairingCode(USER_ID, ORG_SLUG, "terminal-row-1");

		const [, input] = terminals.setPairingCode.mock.calls[0] ?? [];
		expect(input?.issuedByUserId).toBe(USER_ID);
		expect(input?.issuedAt).toBeGreaterThan(0);
		expect(Object.keys(input ?? {}).toSorted()).toEqual(["issuedAt", "issuedByUserId", "pairingCodeExpiresAt", "pairingCodeHash"]);
	});

	it("hides another store's till from a store-limited member on re-pair and removal (404, nothing written)", async () => {
		context.resolveUserLocationScope.mockResolvedValue(selectedLocationsScope([OTHER_LOCATION_ID]));
		terminals.findLiveByIdAndOrg.mockResolvedValue(terminalRow());
		terminals.findLiveByIdAndOrgForUpdate.mockResolvedValue(terminalRow());

		await expect(service.issuePairingCode(USER_ID, ORG_SLUG, "terminal-row-1")).rejects.toBeInstanceOf(NotFoundException);
		await expect(service.remove(USER_ID, ORG_SLUG, "terminal-row-1")).rejects.toBeInstanceOf(NotFoundException);
		expect(terminals.setPairingCode).not.toHaveBeenCalled();
		expect(terminals.softDelete).not.toHaveBeenCalled();
	});

	it("lists only the member's stores' tills when no store is named", async () => {
		const scope = selectedLocationsScope([LOCATION_ID]);
		context.resolveUserLocationScope.mockResolvedValue(scope);
		const query = MerchantTerminalListQuerySchema.parse({});

		await service.list(USER_ID, ORG_SLUG, query);

		expect(context.resolveUserLocationScope).toHaveBeenCalledWith(USER_ID, ORG_SLUG, undefined);
		expect(terminals.listByOrgId).toHaveBeenCalledWith("org-1", scope, query, TX);
	});

	it("registers a till under the merchant's own terminal id and answers 409 when a live till already uses it", async () => {
		await service.create(USER_ID, ORG_SLUG, { name: "Till", locationId: LOCATION_ID, terminalId: "KL-REGISTER-07" });
		expect(terminals.create.mock.calls[0]?.[0].terminalId).toBe("KL-REGISTER-07");
		expect(terminals.terminalIdExists).not.toHaveBeenCalled();

		terminals.create.mockRejectedValueOnce(
			new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
				code: "P2002",
				clientVersion: "test",
				meta: { driverAdapterError: { cause: { constraint: { index: "organization_terminals_organization_id_terminal_id_key" } } } },
			}),
		);
		await expect(service.create(USER_ID, ORG_SLUG, { name: "Till", locationId: LOCATION_ID, terminalId: "KL-REGISTER-07" })).rejects.toBeInstanceOf(ConflictException);
	});

	it("summarises only the member's stores' tills, with UNPAIRED as the remainder of the database counts", async () => {
		const scope = selectedLocationsScope([LOCATION_ID]);
		context.resolveUserLocationScope.mockResolvedValue(scope);
		terminals.countStatusSummary.mockResolvedValue({ total: 7, awaitingPairing: 2, active: 4, storesWithTerminals: 1 });

		const summary = await service.summary(USER_ID, ORG_SLUG, {});

		expect(terminals.countStatusSummary).toHaveBeenCalledWith("org-1", scope, expect.any(Number), TX);
		expect(summary).toEqual({ total: 7, byStatus: { AWAITING_PAIRING: 2, ACTIVE: 4, UNPAIRED: 1 }, storesWithTerminals: 1 });
	});

	it("reads one till of the member's stores and answers 404 for another store's till", async () => {
		terminals.findLiveByIdAndOrg.mockResolvedValue(terminalRow());
		await expect(service.get(USER_ID, ORG_SLUG, "terminal-row-1")).resolves.toMatchObject({ id: "terminal-row-1", locationId: LOCATION_ID });

		context.resolveUserLocationScope.mockResolvedValue(selectedLocationsScope([OTHER_LOCATION_ID]));
		await expect(service.get(USER_ID, ORG_SLUG, "terminal-row-1")).rejects.toBeInstanceOf(NotFoundException);
	});
});
