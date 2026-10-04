import { HttpStatus } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MerchantApiKeyRepository } from "../repositories/merchant-api-key.repository";
import { RewardAuditLogRepository } from "../repositories/reward-audit-log.repository";
import type { MerchantPosContext } from "../types/merchant-pos-context";
import { POS_CODE_FAILURE_WINDOW_MS, POS_CODE_LOCKOUT_MS, POS_CODE_MAX_FAILURES, PosCodeLockoutService } from "./pos-code-lockout.service";

const NOW = 1_790_000_000_000;
const POS: MerchantPosContext = { organizationId: "org-1", terminalId: "KL-REGISTER-01", apiKeyId: "key-1", locationId: null };

describe("PosCodeLockoutService", () => {
	let service: PosCodeLockoutService;
	const keys = {
		findCodeLockedUntil: vi.fn<MerchantApiKeyRepository["findCodeLockedUntil"]>(),
		addCodeFailures: vi.fn<MerchantApiKeyRepository["addCodeFailures"]>(),
		lockCodeRedemption: vi.fn<MerchantApiKeyRepository["lockCodeRedemption"]>(),
	};
	const audit = { create: vi.fn<RewardAuditLogRepository["create"]>() };

	beforeEach(async () => {
		vi.clearAllMocks();
		audit.create.mockResolvedValue(undefined);
		const moduleRef = await Test.createTestingModule({
			providers: [PosCodeLockoutService, { provide: MerchantApiKeyRepository, useValue: keys }, { provide: RewardAuditLogRepository, useValue: audit }],
		}).compile();
		service = moduleRef.get(PosCodeLockoutService);
	});

	it("lets an unlocked key or an expired lock through, and refuses a live lock with 429", async () => {
		keys.findCodeLockedUntil
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(BigInt(NOW - 1))
			.mockResolvedValueOnce(BigInt(NOW + 1));

		await expect(service.assertNotLocked(POS, NOW)).resolves.toBeUndefined();
		await expect(service.assertNotLocked(POS, NOW)).resolves.toBeUndefined();
		await expect(service.assertNotLocked(POS, NOW)).rejects.toMatchObject({
			status: HttpStatus.TOO_MANY_REQUESTS,
			response: { error: "POS_CODE_LOCKED", lockedUntil: NOW + 1 },
		});
	});

	it("records nothing when no backup code was unknown", async () => {
		await expect(service.recordUnknownBackupCodes(POS, 0, NOW)).resolves.toBeNull();
		expect(keys.addCodeFailures).not.toHaveBeenCalled();
	});

	it("counts failures in the key's window and audits them without locking below the limit", async () => {
		keys.addCodeFailures.mockResolvedValue(POS_CODE_MAX_FAILURES - 1);

		await expect(service.recordUnknownBackupCodes(POS, 3, NOW)).resolves.toBeNull();
		expect(keys.addCodeFailures).toHaveBeenCalledWith("key-1", 3, NOW, POS_CODE_FAILURE_WINDOW_MS);
		expect(audit.create).toHaveBeenCalledWith(expect.objectContaining({ action: "pos.backup_code_rejected" }));
		expect(keys.lockCodeRedemption).not.toHaveBeenCalled();
	});

	it("locks the key once the window reaches the limit, auditing the lock once", async () => {
		keys.addCodeFailures.mockResolvedValue(POS_CODE_MAX_FAILURES);
		keys.lockCodeRedemption.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

		await expect(service.recordUnknownBackupCodes(POS, 1, NOW)).resolves.toBe(NOW + POS_CODE_LOCKOUT_MS);
		await expect(service.recordUnknownBackupCodes(POS, 1, NOW)).resolves.toBe(NOW + POS_CODE_LOCKOUT_MS);
		expect(audit.create.mock.calls.filter(([row]) => row.action === "pos.api_key_code_locked")).toHaveLength(1);
	});
});
