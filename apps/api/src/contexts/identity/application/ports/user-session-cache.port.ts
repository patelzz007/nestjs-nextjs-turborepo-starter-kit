import type { SessionPermissionsResponse, UserResponse } from "@workspace/shared";

/** The short-lived `/auth/me` + `/auth/permissions` cache (Redis, or in-memory). */
export interface UserSessionCachePort {
	getMe(userId: string): Promise<UserResponse | null>;
	setMe(userId: string, value: UserResponse): Promise<void>;
	getPermissions(userId: string): Promise<SessionPermissionsResponse | null>;
	setPermissions(userId: string, value: SessionPermissionsResponse): Promise<void>;
	invalidate(userId: string): Promise<void>;
	invalidateUsers(userIds: readonly string[]): Promise<void>;
}
