import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { MfaRecoveryRequestStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TypedConfigService } from "../../../config/typed-config.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { LogService } from "../../logs/logs.service";
import { MfaRecoveryRepository } from "../repositories/mfa-recovery.repository";
import { AuthorizationInvalidationService } from "../../authorization/cache/authorization-invalidation.service";
import { EmailService } from "./email.service";
import { MfaRecoveryService } from "./mfa-recovery.service";

const REQUESTER = "user-1";
const REVIEWER = "admin-2";
const REQUEST_ID = "6c1f4a2e-8d3b-4f5a-9b7c-2e1d0f9a8b7c";
const RECOVERY_DELAY_MS = 24 * 60 * 60 * 1000;

describe("MfaRecoveryService", () => {
	let service: MfaRecoveryService;
	const recoveries = {
		openRequest: vi.fn<MfaRecoveryRepository["openRequest"]>(),
		review: vi.fn<MfaRecoveryRepository["review"]>(),
		findDueApproved: vi.fn<MfaRecoveryRepository["findDueApproved"]>(),
		complete: vi.fn<MfaRecoveryRepository["complete"]>(),
	};
	const prisma = {
		user: {
			findUnique: vi.fn(),
			findMany: vi.fn(),
		},
	};
	const emailService = {
		sendMfaRecoveryUserNotification: vi.fn(),
		sendMfaRecoveryAdminNotification: vi.fn(),
		sendTwoFactorDisabledEmail: vi.fn(),
	};
	const invalidation = { invalidateUsers: vi.fn<AuthorizationInvalidationService["invalidateUsers"]>().mockResolvedValue(undefined) };

	const reviewedRow = {
		id: REQUEST_ID,
		userId: REQUESTER,
		status: MfaRecoveryRequestStatus.APPROVED,
		requestedAt: BigInt(1),
		reviewedBy: REVIEWER,
		reviewedAt: BigInt(2),
		scheduledUnlockAt: BigInt(3),
		completedAt: null,
		notes: null,
		createdAt: BigInt(1),
		updatedAt: BigInt(2),
	};

	beforeEach(async () => {
		vi.clearAllMocks();
		prisma.user.findUnique.mockResolvedValue({ email: "user@example.com", fullName: "User", twoFactorEnabled: true });
		prisma.user.findMany.mockResolvedValue([]);
		const moduleRef = await Test.createTestingModule({
			providers: [
				MfaRecoveryService,
				{ provide: PrismaService, useValue: prisma },
				{ provide: MfaRecoveryRepository, useValue: recoveries },
				{ provide: TypedConfigService, useValue: { mfa: { recoveryDelayMs: RECOVERY_DELAY_MS } } },
				{ provide: EmailService, useValue: emailService },
				{ provide: AuthorizationInvalidationService, useValue: invalidation },
				{ provide: LogService, useValue: { info: vi.fn(), warn: vi.fn() } },
			],
		}).compile();
		service = moduleRef.get(MfaRecoveryService);
	});

	it("rejects a second open recovery request", async () => {
		recoveries.openRequest.mockResolvedValue({ kind: "already_open" });

		await expect(service.initiateRecovery(REQUESTER, { reason: "lost phone" })).rejects.toBeInstanceOf(BadRequestException);
		expect(emailService.sendMfaRecoveryUserNotification).not.toHaveBeenCalled();
	});

	it("refuses self-approval with 403 MFA_RECOVERY_SELF_REVIEW and sends no email", async () => {
		recoveries.review.mockResolvedValue({ kind: "self_review" });

		await expect(service.adminApprove(REQUESTER, { requestId: REQUEST_ID, action: "approve" })).rejects.toMatchObject({
			response: { error: "MFA_RECOVERY_SELF_REVIEW" },
		});
		expect(emailService.sendMfaRecoveryUserNotification).not.toHaveBeenCalled();
	});

	it("refuses a reviewer who is no longer an active super admin", async () => {
		recoveries.review.mockResolvedValue({ kind: "reviewer_not_eligible" });

		await expect(service.adminDeny(REVIEWER, { requestId: REQUEST_ID, action: "deny" })).rejects.toBeInstanceOf(ForbiddenException);
	});

	it("maps a lost compare-and-set (already reviewed) to 400 and an unknown request to 404", async () => {
		recoveries.review.mockResolvedValueOnce({ kind: "not_pending" }).mockResolvedValueOnce({ kind: "not_found" });

		await expect(service.adminApprove(REVIEWER, { requestId: REQUEST_ID, action: "approve" })).rejects.toBeInstanceOf(BadRequestException);
		await expect(service.adminApprove(REVIEWER, { requestId: REQUEST_ID, action: "approve" })).rejects.toBeInstanceOf(NotFoundException);
	});

	it("approves with the configured security delay and the reviewer as actor", async () => {
		recoveries.review.mockResolvedValue({ kind: "reviewed", request: reviewedRow });

		const response = await service.adminApprove(REVIEWER, { requestId: REQUEST_ID, action: "approve", notes: "verified by phone" });

		expect(response.status).toBe("APPROVED");
		const call = recoveries.review.mock.lastCall?.[0];
		expect(call).toMatchObject({ requestId: REQUEST_ID, reviewerId: REVIEWER, decision: "APPROVED", notes: "verified by phone" });
		expect((call?.scheduledUnlockAt ?? 0) - (call?.reviewedAt ?? 0)).toBe(RECOVERY_DELAY_MS);
	});

	it("completes due unlocks, broadcasts the token-state invalidation to every instance, and skips requests another worker completed", async () => {
		recoveries.findDueApproved.mockResolvedValue([{ id: "a" }, { id: "b" }]);
		recoveries.complete.mockResolvedValueOnce({ kind: "completed", userId: REQUESTER, reviewerId: REVIEWER }).mockResolvedValueOnce({ kind: "not_due" });

		await service.processScheduledUnlocks();

		expect(invalidation.invalidateUsers).toHaveBeenCalledTimes(1);
		expect(invalidation.invalidateUsers).toHaveBeenCalledWith([REQUESTER], { accessTokenState: true, trigger: "mfa_recovery_completed" });
		expect(emailService.sendTwoFactorDisabledEmail).toHaveBeenCalledTimes(1);
	});
});
