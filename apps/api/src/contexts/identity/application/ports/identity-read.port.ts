import type {
	AdminUserBanState,
	AdminMfaRecoveryListQuery,
	AdminMfaRecoveryRequest,
	AdminUserListQuery,
	EpochMs,
	MfaRecoveryStatusResponse,
	OwnProfile,
	PaginatedServiceResult,
	Session,
	SessionListQuery,
	UserPreferences,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";

/** The account fields every user payload (`UserResponse`, tokens, admin views) is built from. */
export interface AccountView {
	readonly id: string;
	readonly email: string;
	readonly fullName: string;
	readonly isActive: boolean;
	readonly isSuperAdmin: boolean;
	readonly isDeleted: boolean;
	readonly deletedAt: EpochMs | null;
	readonly emailVerifiedAt: EpochMs | null;
	readonly tokenVersion: number;
	readonly twoFactorEnabled: boolean;
	readonly createdAt: EpochMs;
	readonly updatedAt: EpochMs;
}

/** An account as the SuperAdmin user screens show it (security state included). */
export interface AdminAccountView extends AccountView {
	readonly failedLoginAttempts: number;
	readonly lockedUntil: EpochMs | null;
	readonly ban: AdminUserBanState | null;
}

/**
 * Identity's read side. Every read takes the actor first and runs under the actor's RLS session
 * (or the route's bypass operation for the public credential flows).
 */
export interface IdentityReadPort {
	findAccount(actor: ActorContext, userId: string): Promise<AccountView | null>;
	listAdminAccounts(actor: ActorContext, query: AdminUserListQuery): Promise<PaginatedServiceResult<AdminAccountView>>;
	findAdminAccount(actor: ActorContext, userId: string): Promise<AdminAccountView | null>;
	findOwnProfile(actor: ActorContext, userId: string): Promise<OwnProfile | null>;
	/** The user's live preferences the registry still accepts; a stored value it no longer accepts is left out (reads as unset). */
	listOwnPreferences(actor: ActorContext, userId: string): Promise<UserPreferences>;
	/** One page of the active (live, unexpired) sessions with every device detail; `isCurrent` from `currentSessionId`. */
	listActiveSessions(actor: ActorContext, userId: string, currentSessionId: string | null, query: SessionListQuery): Promise<PaginatedServiceResult<Session>>;
	countUnusedBackupCodes(actor: ActorContext, userId: string): Promise<number>;
	unusedBackupCodeHashes(actor: ActorContext, userId: string): Promise<readonly string[]>;
	latestMfaRecovery(actor: ActorContext, userId: string): Promise<MfaRecoveryStatusResponse | null>;
	listMfaRecoveries(actor: ActorContext, query: AdminMfaRecoveryListQuery): Promise<PaginatedServiceResult<AdminMfaRecoveryRequest>>;
	/** The bcrypt hash of the live, unused, unexpired reset token with this digest at `now`, or `null`. */
	findUsableResetTokenHash(actor: ActorContext, tokenDigest: string, now: EpochMs): Promise<{ readonly userId: string; readonly tokenHash: string } | null>;
	/** Minimal account facts for verification and reset flows (by canonical email). */
	findAccountByEmail(actor: ActorContext, email: string): Promise<AccountView | null>;
}
