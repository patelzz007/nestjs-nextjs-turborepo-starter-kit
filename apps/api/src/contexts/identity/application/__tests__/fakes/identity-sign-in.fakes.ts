import type { SessionLocation, SessionPermissionsResponse, UserResponse } from "@workspace/shared";

import type { LoginVerificationRecord, LoginVerificationStorePort } from "../../ports/login-verification-store.port";
import type { MerchantPortalAccess, MerchantPortalAccessPort } from "../../ports/merchant-portal-access.port";
import type { SessionLocationLookupPort } from "../../ports/session-location.port";
import type { UserSessionCachePort } from "../../ports/user-session-cache.port";
import type { IdentitySettings } from "../../ports/identity-settings.port";
import { LoginVerificationGate } from "../../services/login-verification.gate";
import { SessionIssuer } from "../../services/session-issuer";
import { FakeCredentialCrypto, FakeIdentityTokens, FixedClock, FixedGrants, InMemoryIdentityStore, SequentialIds, TEST_SETTINGS } from "./identity.fakes";

/** Login-verification challenges, recognized devices and recent verifications, in memory (Redis in production). */
export class InMemoryLoginVerificationStore implements LoginVerificationStorePort {
	public readonly challenges = new Map<string, LoginVerificationRecord>();
	public readonly attempts = new Map<string, number>();
	public readonly recognized = new Set<string>();
	public readonly recentlyVerified = new Set<string>();

	public saveChallenge(verificationId: string, record: LoginVerificationRecord): Promise<void> {
		this.challenges.set(verificationId, record);
		return Promise.resolve();
	}

	public findChallenge(verificationId: string): Promise<LoginVerificationRecord | null | "corrupt"> {
		return Promise.resolve(this.challenges.get(verificationId) ?? null);
	}

	public deleteChallenge(verificationId: string): Promise<void> {
		this.challenges.delete(verificationId);
		return Promise.resolve();
	}

	public incrementAttempts(verificationId: string): Promise<number> {
		const attempts: number = (this.attempts.get(verificationId) ?? 0) + 1;
		this.attempts.set(verificationId, attempts);
		return Promise.resolve(attempts);
	}

	public markDeviceRecognized(userId: string, deviceKey: string): Promise<void> {
		this.recognized.add(`${userId}:${deviceKey}`);
		return Promise.resolve();
	}

	public isDeviceRecognized(userId: string, deviceKey: string): Promise<boolean> {
		return Promise.resolve(this.recognized.has(`${userId}:${deviceKey}`));
	}

	public markRecentlyVerified(userId: string): Promise<void> {
		this.recentlyVerified.add(userId);
		return Promise.resolve();
	}

	public wasRecentlyVerified(userId: string): Promise<boolean> {
		return Promise.resolve(this.recentlyVerified.has(userId));
	}
}

/** The location port resolving nothing (the default `none` resolver). */
export class NoSessionLocations implements SessionLocationLookupPort {
	public lookup(): Promise<SessionLocation | null> {
		return Promise.resolve(null);
	}
}

export class InMemorySessionCache implements UserSessionCachePort {
	public readonly me = new Map<string, UserResponse>();
	public readonly permissions = new Map<string, SessionPermissionsResponse>();
	public readonly invalidated: string[] = [];

	public getMe(userId: string): Promise<UserResponse | null> {
		return Promise.resolve(this.me.get(userId) ?? null);
	}

	public setMe(userId: string, value: UserResponse): Promise<void> {
		this.me.set(userId, value);
		return Promise.resolve();
	}

	public getPermissions(userId: string): Promise<SessionPermissionsResponse | null> {
		return Promise.resolve(this.permissions.get(userId) ?? null);
	}

	public setPermissions(userId: string, value: SessionPermissionsResponse): Promise<void> {
		this.permissions.set(userId, value);
		return Promise.resolve();
	}

	public invalidate(userId: string): Promise<void> {
		this.invalidated.push(userId);
		return Promise.resolve();
	}

	public invalidateUsers(userIds: readonly string[]): Promise<void> {
		this.invalidated.push(...userIds);
		return Promise.resolve();
	}
}

/** Merchant portal access as scripted per user (none by default). */
export class ScriptedMerchantAccess implements MerchantPortalAccessPort {
	public readonly access = new Map<string, MerchantPortalAccess>();

	public findAccess(userId: string): Promise<MerchantPortalAccess> {
		return Promise.resolve(this.access.get(userId) ?? { tenantSlug: null, hasPendingTeamInvite: false });
	}
}

/** The sign-in collaborators wired over one in-memory store, as the module wires them. */
export interface SignInHarness {
	readonly crypto: FakeCredentialCrypto;
	readonly tokens: FakeIdentityTokens;
	readonly grants: FixedGrants;
	readonly ids: SequentialIds;
	readonly verifications: InMemoryLoginVerificationStore;
	readonly sessionCache: InMemorySessionCache;
	readonly merchantAccess: ScriptedMerchantAccess;
	readonly sessions: SessionIssuer;
	readonly gate: LoginVerificationGate;
}

export function signInHarness(store: InMemoryIdentityStore, clock: FixedClock, settings: IdentitySettings = TEST_SETTINGS): SignInHarness {
	const crypto = new FakeCredentialCrypto();
	const tokens = new FakeIdentityTokens();
	const grants = new FixedGrants();
	const ids = new SequentialIds("session");
	const verifications = new InMemoryLoginVerificationStore();
	const sessionCache = new InMemorySessionCache();
	const merchantAccess = new ScriptedMerchantAccess();
	const sessions = new SessionIssuer(store.uow, grants, merchantAccess, tokens, crypto, ids, new NoSessionLocations(), sessionCache, settings, clock);
	const gate = new LoginVerificationGate(store.uow, verifications, crypto, settings, clock, sessions);
	return { crypto, tokens, grants, ids, verifications, sessionCache, merchantAccess, sessions, gate };
}
