import type { OrganizationLifecycleState } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MerchantApiKeyRepository, type VerifiedApiKeyRow } from "../../rewards/repositories/merchant-api-key.repository";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { PrismaService } from "../../../prisma/prisma.service";
import { MerchantApiKeyVerificationService } from "./merchant-api-key-verification.service";

vi.mock("../../../prisma/prisma.service", () => ({ PrismaService: class {} }));

function keyRow(lifecycleState: OrganizationLifecycleState, isDeleted = false): VerifiedApiKeyRow {
	return {
		id: "key-1",
		organizationId: "org-1",
		locationId: null,
		name: "Till",
		keyHash: "hash",
		keyPrefix: "mk_live_",
		scope: "POS",
		createdByUserId: "owner-1",
		revokedAt: null,
		lastUsedAt: null,
		codeFailureCount: 0,
		codeFailureWindowStartedAt: null,
		codeLockedUntil: null,
		isDeleted: false,
		deletedAt: null,
		createdAt: 0n,
		updatedAt: 0n,
		terminal: null,
		organization: { lifecycleState, isDeleted, merchantProfile: { requireRegisteredTerminals: false } },
	};
}

describe("MerchantApiKeyVerificationService", () => {
	const repository = new MerchantApiKeyRepository(new PrismaService(createTestTypedConfig()));
	const findActiveByHash = vi.spyOn(repository, "findActiveByHash");
	const touchLastUsed = vi.spyOn(repository, "touchLastUsed");
	const service = new MerchantApiKeyVerificationService(repository);

	beforeEach(() => {
		vi.clearAllMocks();
		touchLastUsed.mockResolvedValue(undefined);
	});

	it("verifies a key of an ACTIVE merchant", async () => {
		findActiveByHash.mockResolvedValue(keyRow("ACTIVE"));

		await expect(service.verify("mk_live_x")).resolves.toMatchObject({ apiKeyId: "key-1", organizationId: "org-1" });
	});

	it.each(["SUSPENDED", "RESTRICTED", "PROVISIONING", "PENDING_DELETION", "DELETED"] satisfies OrganizationLifecycleState[])(
		"refuses every call with a %s merchant's key (403 ORGANIZATION_NOT_ACTIVE)",
		async (state) => {
			findActiveByHash.mockResolvedValue(keyRow(state));

			await expect(service.verify("mk_live_x")).rejects.toMatchObject({ response: { error: "ORGANIZATION_NOT_ACTIVE" } });
			expect(touchLastUsed).not.toHaveBeenCalled();
		},
	);

	it("refuses a soft-deleted organization's key even if its state still reads ACTIVE", async () => {
		findActiveByHash.mockResolvedValue(keyRow("ACTIVE", true));

		await expect(service.verify("mk_live_x")).rejects.toMatchObject({ response: { error: "ORGANIZATION_NOT_ACTIVE" } });
	});
});
