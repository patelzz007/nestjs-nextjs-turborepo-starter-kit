import { Injectable } from "@nestjs/common";
import { epochMs, type UserPermissions, type UserResponse, type FlatUserResponse } from "@workspace/shared";

/**
 * Shared mapper that builds the canonical `UserResponse` from a Prisma user
 * row + permission context. Extracted from `AuthService` so sibling modules
 * (`SessionsService`, `ImpersonationService`) can inject it directly instead
 * of reaching into `AuthService.buildUserResponse()`.
 */
@Injectable()
export class UserResponseMapper {
	/**
	 * Builds the canonical `UserResponse` (with roles + permissions) from a
	 * Prisma user row and resolved permission context.
	 */
	public build(
		user: Pick<UserResponse, "id" | "email" | "fullName" | "isActive" | "isSuperAdmin"> & {
			readonly tokenVersion?: number;
			readonly twoFactorEnabled?: boolean;
			readonly createdAt: bigint;
			readonly updatedAt: bigint;
			readonly isDeleted: boolean;
			readonly deletedAt: bigint | null;
		},
		userPermissions: UserPermissions,
		isEmailVerified: boolean,
	): UserResponse {
		const hasAdminAccess: boolean = userPermissions.permissions.some((p) => p.resource === "ADMIN_DASHBOARD") || user.isSuperAdmin;

		return {
			id: user.id,
			email: user.email,
			fullName: user.fullName,
			isActive: user.isActive,
			isSuperAdmin: user.isSuperAdmin,
			isEmailVerified,
			twoFactorEnabled: user.twoFactorEnabled ?? false,
			hasAdminAccess,
			tokenVersion: user.tokenVersion ?? 0,
			roles: userPermissions.roles.map(({ id, name, description }) => ({ id, name, description })),
			createdAt: epochMs(Number(user.createdAt)),
			updatedAt: epochMs(Number(user.updatedAt)),
			isDeleted: user.isDeleted,
			deletedAt: user.deletedAt !== null ? epochMs(Number(user.deletedAt)) : null,
		};
	}

	/** Full flat user for token generation (includes permission list for internal callers). */
	public toFlatUser(
		user: Pick<UserResponse, "id" | "email" | "fullName" | "isActive" | "isSuperAdmin"> & {
			readonly tokenVersion?: number;
			readonly twoFactorEnabled?: boolean;
			readonly createdAt: bigint;
			readonly updatedAt: bigint;
			readonly isDeleted: boolean;
			readonly deletedAt: bigint | null;
		},
		userPermissions: UserPermissions,
		isEmailVerified: boolean,
	): FlatUserResponse {
		const profile = this.build(user, userPermissions, isEmailVerified);
		return {
			...profile,
			permissions: userPermissions.permissions,
		};
	}
}
