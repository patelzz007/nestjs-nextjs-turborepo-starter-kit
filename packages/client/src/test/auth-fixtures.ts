import { epochMs, SessionPermissionsResponseSchema, UserResponseSchema, type SessionPermissionsResponse, type UserResponse } from "@workspace/shared";

/** A valid `/auth/me` profile (parsed through the shared schema), with overrides. */
export function userFixture(overrides: Partial<UserResponse> = {}): UserResponse {
	return UserResponseSchema.parse({
		id: "user-1",
		email: "member@example.com",
		fullName: "Test Member",
		isActive: true,
		isSuperAdmin: false,
		isEmailVerified: true,
		twoFactorEnabled: false,
		hasAdminAccess: false,
		tokenVersion: 1,
		roles: [],
		createdAt: epochMs(0),
		updatedAt: epochMs(0),
		isDeleted: false,
		deletedAt: null,
		...overrides,
	});
}

/** A valid `/auth/permissions` answer (full session unless overridden). */
export function sessionPermissionsFixture(overrides: Partial<SessionPermissionsResponse> = {}): SessionPermissionsResponse {
	return SessionPermissionsResponseSchema.parse({
		roles: [],
		permissions: [],
		tokenVersion: 1,
		hasAdminAccess: false,
		capabilities: [],
		...overrides,
	});
}
