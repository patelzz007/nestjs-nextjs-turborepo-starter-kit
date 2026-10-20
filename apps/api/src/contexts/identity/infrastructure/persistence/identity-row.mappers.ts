import type { Prisma } from "@prisma/client";
import { epochMs, type EpochMs } from "@workspace/shared";

import { UserAccount } from "../../domain/aggregates/user-account.aggregate";
import { EmailAddress } from "../../domain/value-objects/email-address.value-object";
import { LockoutState } from "../../domain/value-objects/lockout-state.value-object";
import { TokenVersion } from "../../domain/value-objects/token-version.value-object";
import type { AccountView, AdminAccountView } from "../../application/ports/identity-read.port";

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
		createdAt: epochMs(Number(row.createdAt)),
		updatedAt: epochMs(Number(row.updatedAt)),
	});
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

export function toAdminAccountView(row: AccountViewRow): AdminAccountView {
	return { ...toAccountView(row), failedLoginAttempts: row.failedLoginAttempts, lockedUntil: epochOrNull(row.lockedUntil) };
}
