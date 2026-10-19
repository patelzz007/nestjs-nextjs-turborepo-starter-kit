import type { EpochMs, FlatUserResponse, UserPermissions, UserResponse } from "@workspace/shared";

import type { UserAccount } from "../../domain/aggregates/user-account.aggregate";
import type { AccountView } from "../ports/identity-read.port";

/** The resource whose permission (any action) opens the admin dashboard. */
const ADMIN_DASHBOARD_RESOURCE = "ADMIN_DASHBOARD";

/** The read view of an account aggregate (sign-in paths load the aggregate and answer with its view). */
export function accountViewOf(account: UserAccount): AccountView {
	const state = account.snapshot;
	return {
		id: state.id,
		email: state.email.value,
		fullName: state.fullName,
		isActive: state.isActive,
		isSuperAdmin: state.isSuperAdmin,
		isDeleted: state.isDeleted,
		deletedAt: state.deletedAt,
		emailVerifiedAt: state.emailVerifiedAt,
		tokenVersion: state.tokenVersion.value,
		twoFactorEnabled: state.twoFactorEnabled,
		createdAt: state.createdAt,
		updatedAt: state.updatedAt,
	};
}

/** Verified once `emailVerifiedAt` is set and not in the future. */
export function isEmailVerifiedAt(account: AccountView, now: EpochMs): boolean {
	return account.emailVerifiedAt !== null && account.emailVerifiedAt <= now;
}

/** Whether the grants open the admin dashboard (a SuperAdmin always may). */
export function hasAdminAccess(account: Pick<AccountView, "isSuperAdmin">, permissions: UserPermissions): boolean {
	return permissions.permissions.some((permission) => permission.resource === ADMIN_DASHBOARD_RESOURCE) || account.isSuperAdmin;
}

/** The canonical `UserResponse` (roles included) of an account and its grants. */
export function buildUserResponse(account: AccountView, permissions: UserPermissions, now: EpochMs): UserResponse {
	return {
		id: account.id,
		email: account.email,
		fullName: account.fullName,
		isActive: account.isActive,
		isSuperAdmin: account.isSuperAdmin,
		isEmailVerified: isEmailVerifiedAt(account, now),
		twoFactorEnabled: account.twoFactorEnabled,
		hasAdminAccess: hasAdminAccess(account, permissions),
		tokenVersion: account.tokenVersion,
		roles: permissions.roles.map(({ id, name, description }) => ({ id, name, description })),
		createdAt: account.createdAt,
		updatedAt: account.updatedAt,
		isDeleted: account.isDeleted,
		deletedAt: account.deletedAt,
	};
}

/** The user the session tokens embed (the permission list included). */
export function buildFlatUser(account: AccountView, permissions: UserPermissions, now: EpochMs): FlatUserResponse {
	return { ...buildUserResponse(account, permissions, now), permissions: permissions.permissions };
}
