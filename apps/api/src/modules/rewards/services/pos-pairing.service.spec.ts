import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../../prisma/prisma.service";
import { MerchantApiKeyRepository } from "../repositories/merchant-api-key.repository";
import { MerchantTerminalRepository, type PairingTerminalRow } from "../repositories/merchant-terminal.repository";
import { RewardAuditLogRepository } from "../repositories/reward-audit-log.repository";
import { sha256Hex } from "../utils/reward-crypto.util";
import { PosPairingService } from "./pos-pairing.service";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";

vi.mock("../../../prisma/prisma.service", () => ({ PrismaService: class {} }));

/** Stand-in transaction client: every repository call must receive exactly this one. */
const TX = new PrismaService(createTestTypedConfig());
const CODE = "ABCD2345";

function pairingTerminal(overrides: Partial<PairingTerminalRow> = {}): PairingTerminalRow {
	return {
		id: "terminal-row-1",
		organizationId: "org-1",
		locationId: "location-1",
		terminalId: "TERM-WXYZ6789",
		label: "Front counter",
		createdByUserId: "owner-1",
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
		organization: { slug: "brew-bean-kl", displayName: "Brew & Bean KL" },
		...overrides,
	};
}

describe("PosPairingService", () => {
	let service: PosPairingService;
	const terminals = {
		transaction: vi.fn<MerchantTerminalRepository["transaction"]>(),
		consumePairingCode: vi.fn<MerchantTerminalRepository["consumePairingCode"]>(),
		bindApiKey: vi.fn<MerchantTerminalRepository["bindApiKey"]>(),
	};
	const apiKeys = { create: vi.fn<MerchantApiKeyRepository["create"]>(), revoke: vi.fn<MerchantApiKeyRepository["revoke"]>() };
	const audit = { create: vi.fn<RewardAuditLogRepository["create"]>() };

	beforeEach(async () => {
		vi.clearAllMocks();
		terminals.transaction.mockImplementation(async (work) => work(TX));
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
			],
		}).compile();
		service = moduleRef.get(PosPairingService);
	});

	it("exchanges a live code for a store-scoped key bound to the terminal, looking the code up by hash", async () => {
		terminals.consumePairingCode.mockResolvedValue(pairingTerminal());

		const paired = await service.pair({ pairingCode: CODE });

		expect(terminals.consumePairingCode).toHaveBeenCalledWith(sha256Hex(CODE), expect.any(Number), TX);
		const [keyInput] = apiKeys.create.mock.calls[0] ?? [];
		expect(keyInput).toMatchObject({ organizationId: "org-1", locationId: "location-1", name: "Front counter", createdByUserId: "owner-1" });
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
});
