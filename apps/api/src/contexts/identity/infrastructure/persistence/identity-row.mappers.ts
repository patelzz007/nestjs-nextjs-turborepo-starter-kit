import type { Prisma } from "@prisma/client";
import { epochMs, type AdminUserBanState, type EpochMs } from "@workspace/shared";

import { UserAccount, type AccountBan } from "../../domain/aggregates/user-account.aggregate";
import { EmailAddress } from "../../domain/value-objects/email-address.value-object";
import { LockoutState } from "../../domain/value-objects/lockout-state.value-object";
import { TokenVersion } from "../../domain/value-objects/token-version.value-object";
import type { AccountView, AdminAccountView } from "../../application/ports/identity-read.port";
import { CorruptAggregateStateError } from "../../../../platform/domain/errors/corrupt-aggregate-state.error";

/** The account columns identity's rules read (also the login view the bootstrap e2e builds). */
export const USER_ACCOUNT_SELECT = {
	id: true,
	email: true,
	fullName: true,
	isActive: true,
	isSuperAdmin: true,
	createdAt: true,
	updatedAt: true,
	isDeleted: true,
	deletedAt: true,
	emailVerifiedAt: true,
	tokenVersion: true,
	twoFactorEnabled: true,
	mfaEnrollmentDeadline: true,
	mfaAssuredAt: true,
	passwordHash: true,
	failedLoginAttempts: true,
	lockedUntil: true,
	bannedAt: true,
	bannedByUserId: true,
	banReason: true,
} satisfies Prisma.UserSelect;

/** One account row as {@link USER_ACCOUNT_SELECT} reads it. */
export type UserLogin = Prisma.UserGetPayload<{ select: typeof USER_ACCOUNT_SELECT }>;

/** The read-view columns (no secrets). */
export const ACCOUNT_VIEW_SELECT = {
	id: true,
	email: true,
	fullName: true,
	isActive: true,
	isSuperAdmin: true,
	createdAt: true,
	updatedAt: true,
	isDeleted: true,
	deletedAt: true,
	emailVerifiedAt: true,
	tokenVersion: true,
	twoFactorEnabled: true,
	failedLoginAttempts: true,
	lockedUntil: true,
} satisfies Prisma.UserSelect;

export type AccountViewRow = Prisma.UserGetPayload<{ select: typeof ACCOUNT_VIEW_SELECT }>;

/** The admin read-view columns: the account view plus its platform ban. */
export const ADMIN_ACCOUNT_VIEW_SELECT = {
	...ACCOUNT_VIEW_SELECT,
	bannedAt: true,
	bannedByUserId: true,
	banReason: true,
	bannedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.UserSelect;

export type AdminAccountViewRow = Prisma.UserGetPayload<{ select: typeof ADMIN_ACCOUNT_VIEW_SELECT }>;

/** A bigint epoch column → epoch ms (or `null`). */
export function epochOrNull(value: bigint | null): EpochMs | null {
	return value === null ? null : epochMs(Number(value));
}

export function toUserAccount(row: UserLogin): UserAccount {
	return UserAccount.rehydrate({
		id: row.id,
		email: EmailAddress.of(row.email),
		fullName: row.fullName,
		passwordHash: row.passwordHash,
		isActive: row.isActive,
		isSuperAdmin: row.isSuperAdmin,
		isDeleted: row.isDeleted,
		deletedAt: epochOrNull(row.deletedAt),
		emailVerifiedAt: epochOrNull(row.emailVerifiedAt),
		tokenVersion: TokenVersion.of(row.tokenVersion),
		lockout: LockoutState.of(row.failedLoginAttempts, epochOrNull(row.lockedUntil)),
		twoFactorEnabled: row.twoFactorEnabled,
		mfaEnrollmentDeadline: epochOrNull(row.mfaEnrollmentDeadline),
		mfaAssuredAt: epochOrNull(row.mfaAssuredAt),
		ban: toAccountBan(row),
		createdAt: epochMs(Number(row.createdAt)),
		updatedAt: epochMs(Number(row.updatedAt)),
	});
}

/** The ban columns → the aggregate's ban; a half-written ban is corrupt state, never read silently. */
function toAccountBan(row: Pick<UserLogin, "id" | "bannedAt" | "bannedByUserId" | "banReason">): AccountBan | null {
	if (row.bannedAt === null && row.banReason === null) {
		return null;
	}
	if (row.bannedAt === null || row.banReason === null) {
		throw new CorruptAggregateStateError("user_account", null, `account ${row.id} has a partial ban`);
	}
	return { bannedAt: epochMs(Number(row.bannedAt)), bannedByUserId: row.bannedByUserId, reason: row.banReason };
}

export function toAccountView(row: AccountViewRow): AccountView {
	return {
		id: row.id,
		email: row.email,
		fullName: row.fullName,
		isActive: row.isActive,
		isSuperAdmin: row.isSuperAdmin,
		isDeleted: row.isDeleted,
		deletedAt: epochOrNull(row.deletedAt),
		emailVerifiedAt: epochOrNull(row.emailVerifiedAt),
		tokenVersion: row.tokenVersion,
		twoFactorEnabled: row.twoFactorEnabled,
		createdAt: epochMs(Number(row.createdAt)),
		updatedAt: epochMs(Number(row.updatedAt)),
	};
}

export function toAdminAccountView(row: AdminAccountViewRow): AdminAccountView {
	return {
		...toAccountView(row),
		failedLoginAttempts: row.failedLoginAttempts,
		lockedUntil: epochOrNull(row.lockedUntil),
		ban: toAdminBanState(row),
	};
}

function toAdminBanState(row: AdminAccountViewRow): AdminUserBanState | null {
	const ban = toAccountBan(row);
	return ban === null ? null : { bannedAt: ban.bannedAt, reason: ban.reason, bannedBy: row.bannedBy };
}
