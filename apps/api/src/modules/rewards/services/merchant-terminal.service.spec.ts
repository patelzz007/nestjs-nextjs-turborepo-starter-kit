import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { MERCHANT_CAPABILITY, PosPairingCodeSchema } from "@workspace/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../../prisma/prisma.service";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { OrganizationRewardAuthService } from "../../organization/services/organization-reward-auth.service";
import { MerchantApiKeyRepository } from "../repositories/merchant-api-key.repository";
import { MerchantTerminalRepository, type OrganizationTerminalRow } from "../repositories/merchant-terminal.repository";
import { RewardAuditLogRepository } from "../repositories/reward-audit-log.repository";
import { sha256Hex } from "../utils/reward-crypto.util";
import { MerchantContextService } from "./merchant-context.service";
import { MerchantTerminalService } from "./merchant-terminal.service";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";

vi.mock("../../../prisma/prisma.service", () => ({ PrismaService: class {} }));
vi.mock("../../../prisma/tenant-transaction.service", () => ({ TenantTransactionService: class {} }));
vi.mock("../../organization/services/organization-reward-auth.service", () => ({ OrganizationRewardAuthService: class {} }));
vi.mock("./merchant-context.service", () => ({ MerchantContextService: class {} }));

const TX = new PrismaService(createTestTypedConfig());
const ORG_SLUG = "brew-bean-kl";
const USER_ID = "owner-1";
const LOCATION_ID = "4d9a3f5e-2f6b-4c55-8f0c-9a4b1c2d3e4f";
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
		createdByUserId: USER_ID,
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
		setPairingCode: vi.fn<MerchantTerminalRepository["setPairingCode"]>(),
		softDelete: vi.fn<MerchantTerminalRepository["softDelete"]>(),
		setRequireRegisteredTerminals: vi.fn<MerchantTerminalRepository["setRequireRegisteredTerminals"]>(),
	};
	const apiKeys = { revoke: vi.fn<MerchantApiKeyRepository["revoke"]>() };
	const audit = { create: vi.fn<RewardAuditLogRepository["create"]>() };
	const auth = { requireCapabilityForSlug: vi.fn<OrganizationRewardAuthService["requireCapabilityForSlug"]>() };
	const context = { assertAccessibleLocationForUser: vi.fn<MerchantContextService["assertAccessibleLocationForUser"]>() };
	const tenantTx = { withTenantTransaction: vi.fn() };

	beforeEach(async () => {
		vi.clearAllMocks();
		auth.requireCapabilityForSlug.mockResolvedValue(RESOLVED);
		context.assertAccessibleLocationForUser.mockResolvedValue(undefined);
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
		expect(input?.pairingCodeHash).toBe(sha256Hex(pairing.pairingCode));
		expect(JSON.stringify(input)).not.toContain(pairing.pairingCode);
		expect(pairing.terminal.status).toBe("AWAITING_PAIRING");
	});

	it("tries another terminal id when the generated one is taken", async () => {
		terminals.terminalIdExists.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

		await service.create(USER_ID, ORG_SLUG, { name: "Till", locationId: LOCATION_ID });

		expect(terminals.terminalIdExists).toHaveBeenCalledTimes(2);
	});

	it("removing a paired till revokes its key in the same transaction", async () => {
		terminals.findLiveByIdAndOrg.mockResolvedValue(terminalRow({ apiKeyId: "key-1", pairedAt: 1n, apiKey: { revokedAt: null } }));

		await service.remove(USER_ID, ORG_SLUG, "terminal-row-1");

		expect(terminals.softDelete).toHaveBeenCalledWith("terminal-row-1", USER_ID, expect.any(Number), TX);
		expect(apiKeys.revoke).toHaveBeenCalledWith("key-1", expect.any(Number), TX);
	});

	it("answers 404 for a till it cannot see (other organization, or another store under RLS)", async () => {
		terminals.findLiveByIdAndOrg.mockResolvedValue(null);

		await expect(service.issuePairingCode(USER_ID, ORG_SLUG, "terminal-row-9")).rejects.toBeInstanceOf(NotFoundException);
		await expect(service.remove(USER_ID, ORG_SLUG, "terminal-row-9")).rejects.toBeInstanceOf(NotFoundException);
	});

	it("refuses the policy switch for an organization without a merchant profile", async () => {
		terminals.setRequireRegisteredTerminals.mockResolvedValue(0);

		await expect(service.updateSettings(USER_ID, ORG_SLUG, { requireRegisteredTerminals: true })).rejects.toBeInstanceOf(NotFoundException);
	});
});
