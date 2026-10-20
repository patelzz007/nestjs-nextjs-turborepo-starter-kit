import type { Prisma } from "@prisma/client";
import { epochMs } from "@workspace/shared";
import { describe, expect, it, vi, type Mock } from "vitest";

import { createTestTypedConfig } from "../../../../../test/support/test-api-env";
import { PrismaService } from "../../../../prisma/prisma.service";
import { CodeFailuresNotRecordedError, PrismaCodeLockoutRepository } from "../persistence/prisma-code-lockout.repository";

vi.mock("../../../../prisma/prisma.service", () => ({ PrismaService: class {} }));

const NOW = epochMs(1_800_000_000_000);
const WINDOW_MS = 900_000;

type UpdateMany = (args: Prisma.TenantApiKeyUpdateManyArgs) => Promise<Prisma.BatchPayload>;

function database(updates: readonly number[], failureCount = 3): { readonly prisma: PrismaService; readonly updateMany: Mock<UpdateMany> } {
	const updateMany = vi.fn<UpdateMany>();
	for (const count of updates) {
		updateMany.mockResolvedValueOnce({ count });
	}
	const prisma = Object.assign(new PrismaService(createTestTypedConfig()), {
		tenantApiKey: {
			updateMany,
			findUniqueOrThrow: vi.fn().mockResolvedValue({ codeFailureCount: failureCount }),
			findUnique: vi.fn().mockResolvedValue({ codeLockedUntil: BigInt(NOW + 1) }),
		},
	});
	return { prisma, updateMany };
}

describe("PrismaCodeLockoutRepository", () => {
	it("adds failures to the live window", async () => {
		const db = database([1]);

		await expect(new PrismaCodeLockoutRepository(db.prisma).addFailures("key-1", 2, NOW, WINDOW_MS)).resolves.toBe(3);
		expect(db.updateMany).toHaveBeenCalledWith({ where: { id: "key-1", codeFailureWindowStartedAt: { gt: NOW - WINDOW_MS } }, data: { codeFailureCount: { increment: 2 } } });
	});

	it("opens a new window when none is live", async () => {
		const db = database([0, 1]);

		await new PrismaCodeLockoutRepository(db.prisma).addFailures("key-1", 2, NOW, WINDOW_MS);
		expect(db.updateMany).toHaveBeenLastCalledWith({
			where: { id: "key-1", OR: [{ codeFailureWindowStartedAt: null }, { codeFailureWindowStartedAt: { lte: NOW - WINDOW_MS } }] },
			data: { codeFailureCount: 2, codeFailureWindowStartedAt: NOW },
		});
	});

	it("counts into the window a concurrent request opened between the two statements, and gives up on a vanished key", async () => {
		await expect(new PrismaCodeLockoutRepository(database([0, 0, 1]).prisma).addFailures("key-1", 1, NOW, WINDOW_MS)).resolves.toBe(3);
		await expect(new PrismaCodeLockoutRepository(database([0, 0, 0, 0]).prisma).addFailures("key-1", 1, NOW, WINDOW_MS)).rejects.toBeInstanceOf(CodeFailuresNotRecordedError);
	});

	it("locks a key only when it is not locked already, resetting its window", async () => {
		const db = database([1, 0]);
		const repository = new PrismaCodeLockoutRepository(db.prisma);

		await expect(repository.lock("key-1", NOW, epochMs(NOW + 60))).resolves.toBe(true);
		await expect(repository.lock("key-1", NOW, epochMs(NOW + 60))).resolves.toBe(false);
		expect(db.updateMany).toHaveBeenCalledWith({
			where: { id: "key-1", OR: [{ codeLockedUntil: null }, { codeLockedUntil: { lte: NOW } }] },
			data: { codeLockedUntil: NOW + 60, codeFailureCount: 0, codeFailureWindowStartedAt: null },
		});
		await expect(repository.lockedUntil("key-1")).resolves.toBe(NOW + 1);
	});
});
