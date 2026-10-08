import { NotFoundException } from "@nestjs/common";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { Test } from "@nestjs/testing";
import type { OrganizationLifecycleState } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../../prisma/prisma.service";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { MerchantApiKeyRepository } from "../repositories/merchant-api-key.repository";
import { MerchantTerminalRepository, type PairingTerminalRow } from "../repositories/merchant-terminal.repository";
import { RewardAuditLogRepository } from "../repositories/reward-audit-log.repository";
import { sha256Hex } from "../../../common/crypto/sha256";
import { RewardCodeHasher } from "../crypto/reward-code-hasher";
import { PosPairingService } from "./pos-pairing.service";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";

vi.mock("../../../prisma/prisma.service", () => ({ PrismaService: class {} }));
vi.mock("../../../prisma/tenant-transaction.service", () => ({ TenantTransactionService: class {} }));

/** Stand-in transaction client: every repository call must receive exactly this one. */
const TX = new PrismaService(createTestTypedConfig());
const CODE = "ABCD2345";
/** Pairing codes are looked up by their keyed hash (`REWARD_CODE_HASH_KEYS`), never a plain SHA-256. */
const HASHER = new RewardCodeHasher({ 1: Buffer.alloc(32, 5).toString("base64") });

function pairingTerminal(overrides: Partial<PairingTerminalRow> = {}): PairingTerminalRow {
	return {
		id: "terminal-row-1",
		organizationId: "org-1",
		locationId: "location-1",
		terminalId: "TERM-WXYZ6789",
		label: "Front counter",
		createdByUserId: "owner-1",
		pairingCodeIssuedByUserId: "manager-2",
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
		organization: { slug: "brew-bean-kl", displayName: "Brew & Bean KL", lifecycleState: "ACTIVE", isDeleted: false },
		...overrides,
	};
}

describe("PosPairingService", () => {
	let service: PosPairingService;
	const terminals = {
		consumePairingCode: vi.fn<MerchantTerminalRepository["consumePairingCode"]>(),
		bindApiKey: vi.fn<MerchantTerminalRepository["bindApiKey"]>(),
	};
	const apiKeys = { create: vi.fn<MerchantApiKeyRepository["create"]>(), revoke: vi.fn<MerchantApiKeyRepository["revoke"]>() };
	const audit = { create: vi.fn<RewardAuditLogRepository["create"]>() };
	const tenantTx = { withSystemOperation: vi.fn() };

	beforeEach(async () => {
		vi.clearAllMocks();
		tenantTx.withSystemOperation.mockImplementation(async (_context: object, work: (tx: PrismaService) => Promise<object>) => work(TX));
		terminals.bindApiKey.mockResolvedValue(undefined);
		apiKeys.revoke.mockResolvedValue(undefined);
		audit.create.mockResolvedValue(undefined);
		apiKeys.create.mockImplementation((input) =>
			Promise.resolve({
				id: "new-key",
				organizationId: input.organizationId,
				locationId: input.locationId ?? null,
				name: input.name,
				keyHash: input.keyHash,
				keyPrefix: input.keyPrefix,
				createdByUserId: input.createdByUserId,
				scope: input.scope,
				codeFailureCount: 0,
				codeFailureWindowStartedAt: null,
				codeLockedUntil: null,
				revokedAt: null,
				lastUsedAt: null,
				isDeleted: false,
				deletedAt: null,
				createdAt: 0n,
				updatedAt: 0n,
			}),
		);

		const moduleRef = await Test.createTestingModule({
			providers: [
				PosPairingService,
				{ provide: MerchantTerminalRepository, useValue: terminals },
				{ provide: MerchantApiKeyRepository, useValue: apiKeys },
				{ provide: RewardAuditLogRepository, useValue: audit },
				{ provide: RewardCodeHasher, useValue: HASHER },
				{ provide: TenantTransactionService, useValue: tenantTx },
			],
		}).compile();
		service = moduleRef.get(PosPairingService);
	});

	it("exchanges a live code for a store-scoped key bound to the terminal, looking the code up by hash", async () => {
		terminals.consumePairingCode.mockResolvedValue(pairingTerminal());

		const paired = await service.pair({ pairingCode: CODE });

		expect(terminals.consumePairingCode).toHaveBeenCalledWith(HASHER.lookupCandidates(CODE), expect.any(Number), TX);
		const [keyInput] = apiKeys.create.mock.calls[LIST_SLOT_INDEX.first] ?? [];
		// The key is minted in the name of the member who issued THIS code (not the terminal's creator) and may only call POS routes.
		expect(keyInput).toMatchObject({ organizationId: "org-1", locationId: "location-1", name: "Front counter", createdByUserId: "manager-2", scope: "POS" });
		expect(audit.create).toHaveBeenCalledWith(expect.objectContaining({ action: "pos.terminal_paired", actorUserId: "manager-2" }), TX);
		expect(keyInput?.keyHash).toBe(sha256Hex(paired.apiKey));
		expect(terminals.bindApiKey).toHaveBeenCalledWith("terminal-row-1", "new-key", expect.any(Number), TX);
		expect(apiKeys.revoke).not.toHaveBeenCalled();
		expect(paired).toMatchObject({ terminalId: "TERM-WXYZ6789", terminalName: "Front counter", organization: { slug: "brew-bean-kl" }, location: { name: "Bangsar" } });
	});

	it("rotates the key when an already-paired terminal pairs again", async () => {
		terminals.consumePairingCode.mockResolvedValue(pairingTerminal({ apiKeyId: "old-key" }));

		await service.pair({ pairingCode: CODE });

		expect(apiKeys.revoke).toHaveBeenCalledWith("old-key", expect.any(Number), TX);
	});

	it("answers unknown, expired and already-used codes identically, minting nothing", async () => {
		terminals.consumePairingCode.mockResolvedValue(null);

		await expect(service.pair({ pairingCode: CODE })).rejects.toBeInstanceOf(NotFoundException);
		expect(apiKeys.create).not.toHaveBeenCalled();
		expect(terminals.bindApiKey).not.toHaveBeenCalled();
	});

	it("refuses a live code with no recorded issuer instead of attributing the key to someone else", async () => {
		terminals.consumePairingCode.mockResolvedValue(pairingTerminal({ pairingCodeIssuedByUserId: null }));

		await expect(service.pair({ pairingCode: CODE })).rejects.toMatchObject({ response: { error: "PAIRING_CODE_INVALID" } });
		expect(apiKeys.create).not.toHaveBeenCalled();
	});

	it.each(["SUSPENDED", "PENDING_DELETION", "RESTRICTED"] satisfies OrganizationLifecycleState[])(
		"refuses to pair a till of a %s merchant, minting nothing",
		async (lifecycleState) => {
			terminals.consumePairingCode.mockResolvedValue(
				pairingTerminal({ organization: { slug: "brew-bean-kl", displayName: "Brew & Bean KL", lifecycleState, isDeleted: false } }),
			);

			await expect(service.pair({ pairingCode: CODE })).rejects.toMatchObject({ response: { error: "ORGANIZATION_NOT_ACTIVE" } });
			expect(apiKeys.create).not.toHaveBeenCalled();
			expect(terminals.bindApiKey).not.toHaveBeenCalled();
		},
	);

	it("runs the whole exchange as the named pos.terminal.pair system operation (there is no API key yet)", async () => {
		terminals.consumePairingCode.mockResolvedValue(pairingTerminal());

		await service.pair({ pairingCode: CODE });

		expect(tenantTx.withSystemOperation).toHaveBeenCalledWith(expect.objectContaining({ operation: "pos.terminal.pair", actorUserId: null }), expect.any(Function));
	});
});
