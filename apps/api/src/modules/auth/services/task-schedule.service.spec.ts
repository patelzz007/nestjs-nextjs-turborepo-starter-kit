import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../../prisma/prisma.service";
import { LogService } from "../../logs/logs.service";
import { MfaRecoveryService } from "./mfa-recovery.service";
import { TaskScheduleService } from "./task-schedule.service";

const NOW = 1_800_000_000_000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

describe("TaskScheduleService.cleanupExpiredResetTokens", () => {
	const prisma = { passwordResetToken: { updateMany: vi.fn(), deleteMany: vi.fn() } };
	let service: TaskScheduleService;

	beforeEach(async () => {
		vi.clearAllMocks();
		vi.spyOn(Date, "now").mockReturnValue(NOW);
		prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 2 });
		const moduleRef = await Test.createTestingModule({
			providers: [
				TaskScheduleService,
				{ provide: PrismaService, useValue: prisma },
				{ provide: LogService, useValue: { info: vi.fn() } },
				{ provide: MfaRecoveryService, useValue: { processScheduledUnlocks: vi.fn() } },
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
		vi.restoreAllMocks();
	});
});
