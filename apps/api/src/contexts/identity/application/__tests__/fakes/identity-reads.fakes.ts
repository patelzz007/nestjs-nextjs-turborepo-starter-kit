import type {
	AdminMfaRecoveryRequest,
	EpochMs,
	MfaRecoveryStatusResponse,
	OwnProfile,
	PaginatedServiceResult,
	Session,
	UserPreference,
	UserPreferences,
} from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { AccountView, AdminAccountView, IdentityReadPort } from "../../ports/identity-read.port";
import { NOW } from "./identity.fakes";

/** One page holding every item (the read model's paging is the repository's concern, tested there). */
export function singlePage<Item>(items: Item[]): PaginatedServiceResult<Item> {
	return { items, limit: items.length, total: items.length, page: 1, totalPages: 1, nextCursor: null, hasNext: false, hasPrevious: false };
}

/** Identity's read model as plain maps, keyed by user id. */
export class InMemoryIdentityReads implements IdentityReadPort {
	public readonly accounts = new Map<string, AdminAccountView>();
	public readonly profiles = new Map<string, OwnProfile>();
	public readonly preferences = new Map<string, readonly UserPreference[]>();
	public readonly sessions = new Map<string, Session[]>();
	public readonly backupCodeHashes = new Map<string, readonly string[]>();
	public readonly recoveries = new Map<string, MfaRecoveryStatusResponse>();
	public readonly recoveryList: AdminMfaRecoveryRequest[] = [];
	public readonly resetTokens = new Map<string, { readonly userId: string; readonly tokenHash: string; readonly expiresAt: EpochMs }>();
	public accountReads = 0;

	public findAccount(_actor: ActorContext, userId: string): Promise<AccountView | null> {
		this.accountReads += 1;
		return Promise.resolve(this.accounts.get(userId) ?? null);
	}

	public listAdminAccounts(): Promise<PaginatedServiceResult<AdminAccountView>> {
		return Promise.resolve(singlePage([...this.accounts.values()]));
	}

	public findAdminAccount(_actor: ActorContext, userId: string): Promise<AdminAccountView | null> {
		return Promise.resolve(this.accounts.get(userId) ?? null);
	}

	public findOwnProfile(_actor: ActorContext, userId: string): Promise<OwnProfile | null> {
		return Promise.resolve(this.profiles.get(userId) ?? null);
	}

	public listOwnPreferences(_actor: ActorContext, userId: string): Promise<UserPreferences> {
		return Promise.resolve({ preferences: [...(this.preferences.get(userId) ?? [])] });
	}

	public listActiveSessions(_actor: ActorContext, userId: string, currentSessionId: string | null): Promise<PaginatedServiceResult<Session>> {
		return Promise.resolve(singlePage((this.sessions.get(userId) ?? []).map((session: Session): Session => ({ ...session, isCurrent: session.id === currentSessionId }))));
	}

	public countUnusedBackupCodes(_actor: ActorContext, userId: string): Promise<number> {
		return Promise.resolve((this.backupCodeHashes.get(userId) ?? []).length);
	}

	public unusedBackupCodeHashes(_actor: ActorContext, userId: string): Promise<readonly string[]> {
		return Promise.resolve(this.backupCodeHashes.get(userId) ?? []);
	}

	public latestMfaRecovery(_actor: ActorContext, userId: string): Promise<MfaRecoveryStatusResponse | null> {
		return Promise.resolve(this.recoveries.get(userId) ?? null);
	}

	public listMfaRecoveries(): Promise<PaginatedServiceResult<AdminMfaRecoveryRequest>> {
		return Promise.resolve(singlePage(this.recoveryList));
	}

	public findUsableResetTokenHash(_actor: ActorContext, tokenDigest: string, now: EpochMs): Promise<{ readonly userId: string; readonly tokenHash: string } | null> {
		const token = this.resetTokens.get(tokenDigest);
		return Promise.resolve(token === undefined || token.expiresAt < now ? null : { userId: token.userId, tokenHash: token.tokenHash });
	}

	public findAccountByEmail(_actor: ActorContext, email: string): Promise<AccountView | null> {
		return Promise.resolve([...this.accounts.values()].find((account: AdminAccountView): boolean => account.email === email) ?? null);
	}
}

/** A verified, active account view without 2FA. */
export function adminAccountView(overrides: Partial<AdminAccountView> & Pick<AdminAccountView, "id" | "email">): AdminAccountView {
	return {
		fullName: "Jane Doe",
		isActive: true,
		isSuperAdmin: false,
		isDeleted: false,
		deletedAt: null,
		emailVerifiedAt: NOW,
		tokenVersion: 1,
		twoFactorEnabled: false,
		createdAt: NOW,
		updatedAt: NOW,
		failedLoginAttempts: 0,
		lockedUntil: null,
		ban: null,
		...overrides,
	};
}
