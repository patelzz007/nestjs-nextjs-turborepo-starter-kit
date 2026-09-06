import { describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../../prisma/prisma.service";

import { UserSessionRevocationService } from "./user-session-revocation.service";

describe("UserSessionRevocationService", () => {
	it("revokes refresh tokens and bumps tokenVersion for each affected user", async () => {
		const refreshUpdateMany = vi.fn().mockResolvedValue({ count: 2 });
		const userUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
		const transaction = vi.fn(
			async (callback: (tx: { refreshToken: { updateMany: typeof refreshUpdateMany }; user: { updateMany: typeof userUpdateMany } }) => Promise<void>) => {
				await callback({
					refreshToken: { updateMany: refreshUpdateMany },
					user: { updateMany: userUpdateMany },
				});
			},
		);

		const prisma = {
			$transaction: transaction,
		};

		const service = new UserSessionRevocationService(prisma as unknown as PrismaService);
		await service.revokeAllSessionsForUsers(["user-1", "user-1"]);

		expect(refreshUpdateMany).toHaveBeenCalledWith({
			where: { userId: { in: ["user-1"] }, isDeleted: false },
			data: expect.objectContaining({ isDeleted: true }),
		});
		expect(userUpdateMany).toHaveBeenCalledWith({
			where: { id: { in: ["user-1"] } },
			data: expect.objectContaining({ tokenVersion: { increment: 1 } }),
		});
	});

	it("no-ops when userIds is empty", async () => {
		const transaction = vi.fn();
		const prisma = { $transaction: transaction };
		const service = new UserSessionRevocationService(prisma as unknown as PrismaService);

		await service.revokeAllSessionsForUsers([]);

		expect(transaction).not.toHaveBeenCalled();
	});
});
