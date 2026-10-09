import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../../prisma/prisma.service";
import { LogService } from "../../logs/logs.service";
import { MfaRecoveryService } from "./mfa-recovery.service";
import { SignupReferralCheckoutService } from "../signup-referrals/signup-referral-checkout.service";
import { SignupReferralService } from "../signup-referrals/signup-referral.service";
import { TaskScheduleService } from "./task-schedule.service";

const NOW = 1_800_000_000_000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

describe("TaskScheduleService", () => {
	const prisma = { passwordResetToken: { updateMany: vi.fn(), deleteMany: vi.fn() } };
	const logService = { info: vi.fn() };
	const signupReferrals = { maintainReferralCodes: vi.fn() };
	const signupReferralCheckout = { deliverPendingSuccessNotifications: vi.fn() };
	let service: TaskScheduleService;

	beforeEach(async () => {
		vi.clearAllMocks();
		vi.spyOn(Date, "now").mockReturnValue(NOW);
		prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 2 });
		const moduleRef = await Test.createTestingModule({
			providers: [
				TaskScheduleService,
				{ provide: PrismaService, useValue: prisma },
				{ provide: LogService, useValue: logService },
				{ provide: MfaRecoveryService, useValue: { processScheduledUnlocks: vi.fn() } },
				{ provide: SignupReferralService, useValue: signupReferrals },
				{ provide: SignupReferralCheckoutService, useValue: signupReferralCheckout },
			],
		}).compile();
		service = moduleRef.get(TaskScheduleService);
	});

	it("soft-deletes used (7 d) and expired (1 h grace) live tokens — never a DELETE", async () => {
		await service.cleanupExpiredResetTokens();

		expect(prisma.passwordResetToken.deleteMany).not.toHaveBeenCalled();
		expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
			where: {
				isDeleted: false,
				OR: [{ usedAt: { not: null, lte: NOW - 7 * DAY_MS } }, { expiresAt: { lte: NOW - HOUR_MS } }],
			},
			data: { isDeleted: true, deletedAt: NOW, updatedAt: NOW },
		});
		expect(signupReferrals.maintainReferralCodes).not.toHaveBeenCalled();
		vi.restoreAllMocks();
	});

	it("runs the signup referral code job, then the notification retry, and logs what they did", async () => {
		signupReferrals.maintainReferralCodes.mockResolvedValue({ firstCodes: 2, successors: 1, failed: 0 });
		signupReferralCheckout.deliverPendingSuccessNotifications.mockResolvedValue({ delivered: 1, failed: 0 });

		await service.maintainSignupReferrals();

		expect(signupReferrals.maintainReferralCodes).toHaveBeenCalledOnce();
		expect(signupReferralCheckout.deliverPendingSuccessNotifications).toHaveBeenCalledOnce();
		expect(logService.info).toHaveBeenCalledWith("Maintained signup referrals", {
			context: "TaskScheduleService",
			metadata: { firstCodes: 2, successors: 1, codeFailures: 0, notificationsDelivered: 1, notificationFailures: 0 },
		});
	});

	it("stays quiet when the signup referral run had nothing to do", async () => {
		signupReferrals.maintainReferralCodes.mockResolvedValue({ firstCodes: 0, successors: 0, failed: 0 });
		signupReferralCheckout.deliverPendingSuccessNotifications.mockResolvedValue({ delivered: 0, failed: 0 });

		await service.maintainSignupReferrals();

		expect(logService.info).not.toHaveBeenCalled();
	});
});
