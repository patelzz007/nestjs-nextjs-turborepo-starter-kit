import type { Prisma } from "@prisma/client";
import { epochMs, type EpochMs } from "@workspace/shared";

import type { CodeLockoutRepository } from "../../domain/repositories/pos.repositories";

/**
 * Rounds of "increment the live window, else open a new one". The second round always finds the
 * window a concurrent request just opened; a third would mean the key row vanished.
 */
const CODE_FAILURE_WINDOW_ATTEMPTS = 2;

/** The key's failures could not be counted: its row is gone. */
export class CodeFailuresNotRecordedError extends Error {
	public constructor(apiKeyId: string) {
		super(`Could not record POS code failures for API key ${apiKeyId}`);
		this.name = "CodeFailuresNotRecordedError";
	}
}

/** The backup-code lockout counters on `OrganizationApiKey`, on one unit-of-work transaction. */
export class PrismaCodeLockoutRepository implements CodeLockoutRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async lockedUntil(apiKeyId: string): Promise<EpochMs | null> {
		const row = await this.db.organizationApiKey.findUnique({ where: { id: apiKeyId }, select: { codeLockedUntil: true } });
		return row?.codeLockedUntil === null || row?.codeLockedUntil === undefined ? null : epochMs(Number(row.codeLockedUntil));
	}

	public async addFailures(apiKeyId: string, failures: number, now: EpochMs, windowMs: number): Promise<number> {
		const windowOpenAfter = now - windowMs;
		for (let attempt = 0; attempt < CODE_FAILURE_WINDOW_ATTEMPTS; attempt += 1) {
			const incremented = await this.db.organizationApiKey.updateMany({
				where: { id: apiKeyId, codeFailureWindowStartedAt: { gt: windowOpenAfter } },
				data: { codeFailureCount: { increment: failures } },
			});
			const counted =
				incremented.count === 1 ||
				(
					await this.db.organizationApiKey.updateMany({
						where: { id: apiKeyId, OR: [{ codeFailureWindowStartedAt: null }, { codeFailureWindowStartedAt: { lte: windowOpenAfter } }] },
						data: { codeFailureCount: failures, codeFailureWindowStartedAt: now },
					})
				).count === 1;
			if (counted) {
				const row = await this.db.organizationApiKey.findUniqueOrThrow({ where: { id: apiKeyId }, select: { codeFailureCount: true } });
				return row.codeFailureCount;
			}
			// Neither matched: a concurrent request opened the window between the two statements — count into it.
		}
		throw new CodeFailuresNotRecordedError(apiKeyId);
	}

	public async lock(apiKeyId: string, now: EpochMs, lockedUntil: EpochMs): Promise<boolean> {
		const locked = await this.db.organizationApiKey.updateMany({
			where: { id: apiKeyId, OR: [{ codeLockedUntil: null }, { codeLockedUntil: { lte: now } }] },
			data: { codeLockedUntil: lockedUntil, codeFailureCount: 0, codeFailureWindowStartedAt: null },
		});
		return locked.count === 1;
	}
}
