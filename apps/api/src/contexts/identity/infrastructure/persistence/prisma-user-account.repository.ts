import type { Prisma } from "@prisma/client";
import { type EpochMs } from "@workspace/shared";
import { z } from "zod";

import { ConcurrentModificationError } from "../../../../platform/infrastructure/persistence/persistence.errors";
import { isUniqueViolationOf } from "../../../../platform/infrastructure/persistence/unique-violation";
import type { UserAccount, UserAccountChange } from "../../domain/aggregates/user-account.aggregate";
import { EmailAlreadyRegisteredError, EmailAlreadyVerifiedError } from "../../domain/errors/identity.errors";
import type { UserAccountRepository } from "../../domain/repositories/user-account.repository";
import { EmailAddress } from "../../domain/value-objects/email-address.value-object";
import { LockoutState, MAX_FAILED_SIGN_IN_ATTEMPTS, type FailedSignInOutcome } from "../../domain/value-objects/lockout-state.value-object";
import { epochOrNull, toUserAccount, USER_ACCOUNT_SELECT } from "./identity-row.mappers";
import { SUPERADMIN_BOOTSTRAP_OPERATION } from "../../application/ports/identity.tokens";

/** Unique index on `User.email`: a violation means a concurrent signup took the address first. */
export const USERS_EMAIL_UNIQUE_INDEX = "User_email_key";

/** The row the atomic failed-attempt statement returns. */
const FailedAttemptRowSchema = z.object({
	failedAttempts: z.number().int().nonnegative(),
	lockedUntil: z.bigint().nullable(),
	locked_now: z.boolean(),
});

/** Accounts on one transaction client. */
export class PrismaUserAccountRepository implements UserAccountRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async findById(id: string): Promise<UserAccount | null> {
		const row = await this.db.user.findUnique({ where: { id }, select: USER_ACCOUNT_SELECT });
		return row === null ? null : toUserAccount(row);
	}

	public async findByEmail(email: EmailAddress): Promise<UserAccount | null> {
		const row = await this.db.user.findUnique({ where: { email: email.value }, select: USER_ACCOUNT_SELECT });
		return row === null ? null : toUserAccount(row);
	}

	public async lockById(id: string): Promise<UserAccount | null> {
		await this.db.$queryRaw`SELECT id FROM "User" WHERE id = ${id} FOR UPDATE`;
		return this.findById(id);
	}

	public async existsByEmail(email: EmailAddress): Promise<boolean> {
		return (await this.db.user.count({ where: { email: email.value } })) > 0;
	}

	public async add(account: UserAccount): Promise<void> {
		const state = account.snapshot;
		try {
			await this.db.user.create({
				data: {
					id: state.id,
					email: state.email.value,
					fullName: state.fullName,
					passwordHash: state.passwordHash,
					isSuperAdmin: state.isSuperAdmin,
					emailVerifiedAt: state.emailVerifiedAt,
					mfaEnrollmentDeadline: state.mfaEnrollmentDeadline,
				},
				select: { id: true },
			});
		} catch (error) {
			if (error instanceof Error && isUniqueViolationOf(error, USERS_EMAIL_UNIQUE_INDEX)) {
				throw new EmailAlreadyRegisteredError();
			}
			throw error;
		}
	}

	/** Inserts the account unless the address is taken (`ON CONFLICT DO NOTHING`); `false` when it was. Never aborts the transaction. */
	public async addIfEmailFree(account: UserAccount): Promise<boolean> {
		const state = account.snapshot;
		const written = await this.db.user.createMany({
			data: [
				{
					id: state.id,
					email: state.email.value,
					fullName: state.fullName,
					passwordHash: state.passwordHash,
					isSuperAdmin: state.isSuperAdmin,
					emailVerifiedAt: state.emailVerifiedAt,
					mfaEnrollmentDeadline: state.mfaEnrollmentDeadline,
				},
			],
			skipDuplicates: true,
		});
		return written.count === 1;
	}

	public async save(account: UserAccount): Promise<void> {
		for (const change of account.pendingChanges) {
			await this.apply(account.id, change);
		}
	}

	public async recordFailedSignIn(userId: string, now: EpochMs): Promise<FailedSignInOutcome | null> {
		const lockEnd = BigInt(LockoutState.lockEndsAt(now));
		const nowValue = BigInt(now);
		// D19: one statement counts the attempt and decides the lock from the row as it is NOW (the CTE
		// locks it; concurrent failures queue on the lock), so the counter is never stale and the lock is
		// taken once — by the attempt that reaches the threshold while the account is not locked.
		const rows = await this.db.$queryRaw`
			WITH previous AS (SELECT id, "lockedUntil" FROM "User" WHERE id = ${userId} FOR UPDATE)
			UPDATE "User" AS u SET
				"failedLoginAttempts" = u."failedLoginAttempts" + 1,
				"lockedUntil" = CASE
					WHEN u."failedLoginAttempts" + 1 >= ${MAX_FAILED_SIGN_IN_ATTEMPTS} AND (u."lockedUntil" IS NULL OR u."lockedUntil" <= ${nowValue}) THEN ${lockEnd}
					ELSE u."lockedUntil"
				END,
				"updatedAt" = ${nowValue}
			FROM previous AS p
			WHERE u.id = p.id
			RETURNING u."failedLoginAttempts" AS "failedAttempts", u."lockedUntil" AS "lockedUntil", (u."lockedUntil" IS DISTINCT FROM p."lockedUntil") AS locked_now`;
		const [row] = z.array(FailedAttemptRowSchema).parse(rows);
		if (row === undefined) {
			return null;
		}
		return { state: LockoutState.of(row.failedAttempts, epochOrNull(row.lockedUntil)), lockedNow: row.locked_now };
	}

	public async resetLockout(userId: string, now: EpochMs): Promise<void> {
		await this.db.user.updateMany({
			where: { id: userId, OR: [{ failedLoginAttempts: { gt: 0 } }, { lockedUntil: { not: null } }] },
			data: { failedLoginAttempts: 0, lockedUntil: null, updatedAt: now },
		});
	}

	public async recentPasswordHashes(userId: string, depth: number): Promise<readonly string[]> {
		const rows = await this.db.passwordHistory.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: depth, select: { passwordHash: true } });
		return rows.map((row): string => row.passwordHash);
	}

	public async bumpTokenVersions(userIds: readonly string[], now: EpochMs): Promise<void> {
		if (userIds.length === 0) {
			return;
		}
		await this.db.user.updateMany({ where: { id: { in: [...userIds] } }, data: { tokenVersion: { increment: 1 }, updatedAt: now } });
	}

	public async lockSuperAdminBootstrap(): Promise<void> {
		await this.db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${SUPERADMIN_BOOTSTRAP_OPERATION}, 0))`;
	}

	public async countActiveSuperAdmins(superAdminRoleName: string): Promise<number> {
		return this.db.user.count({
			where: {
				isDeleted: false,
				isActive: true,
				OR: [{ isSuperAdmin: true }, { userRoles: { some: { isDeleted: false, role: { name: superAdminRoleName, isDeleted: false, isActive: true } } } }],
			},
		});
	}

	public async activeSuperAdminEmails(): Promise<readonly EmailAddress[]> {
		const rows = await this.db.user.findMany({ where: { isSuperAdmin: true, isActive: true, isDeleted: false }, select: { email: true } });
		return rows.map((row): EmailAddress => EmailAddress.of(row.email));
	}

	private async apply(userId: string, change: UserAccountChange): Promise<void> {
		switch (change.kind) {
			case "password_replaced": {
				const written = await this.db.user.updateMany({
					where: { id: userId, tokenVersion: change.previousTokenVersion.value },
					data: { passwordHash: change.passwordHash, tokenVersion: { increment: 1 }, updatedAt: change.at },
				});
				if (written.count !== 1) {
					throw new ConcurrentModificationError(userId);
				}
				await this.db.passwordHistory.create({ data: { userId, passwordHash: change.passwordHash } });
				return;
			}
			case "email_verified": {
				const written = await this.db.user.updateMany({ where: { id: userId, emailVerifiedAt: null }, data: { emailVerifiedAt: change.at, updatedAt: change.at } });
				if (written.count !== 1) {
					throw new EmailAlreadyVerifiedError();
				}
				return;
			}
			case "lockout_cleared":
				await this.db.user.update({ where: { id: userId }, data: { failedLoginAttempts: 0, lockedUntil: null, updatedAt: change.at } });
				return;
			case "mfa_assured":
				await this.db.user.update({ where: { id: userId }, data: { mfaAssuredAt: change.at, updatedAt: change.at } });
				return;
			case "banned": {
				const written = await this.db.user.updateMany({
					where: { id: userId, tokenVersion: change.previousTokenVersion.value, bannedAt: null },
					data: {
						isActive: false,
						bannedAt: change.ban.bannedAt,
						bannedByUserId: change.ban.bannedByUserId,
						banReason: change.ban.reason,
						tokenVersion: { increment: 1 },
						updatedAt: change.ban.bannedAt,
					},
				});
				if (written.count !== 1) {
					throw new ConcurrentModificationError(userId);
				}
				return;
			}
			case "unbanned": {
				const written = await this.db.user.updateMany({
					where: { id: userId, bannedAt: change.bannedAt },
					data: { isActive: true, bannedAt: null, bannedByUserId: null, banReason: null, updatedAt: change.at },
				});
				if (written.count !== 1) {
					throw new ConcurrentModificationError(userId);
				}
				return;
			}
			case "renamed":
				// A profile field changed: move the profile's optimistic-lock token (PATCH /auth/profile).
				await this.db.user.update({ where: { id: userId }, data: { fullName: change.fullName, profileVersion: { increment: 1 }, updatedAt: change.at } });
				return;
		}
	}
}
