import { beforeEach, describe, expect, it } from "vitest";
import { epochMs, type AccessTokenPayload, type Session } from "@workspace/shared";

import { AccountNotFoundError, ProfileNotFoundError } from "../../domain/errors/identity.errors";
import { CheckBackupCodeHandler } from "../queries/check-backup-code/check-backup-code.handler";
import { CheckBackupCodeQuery } from "../queries/check-backup-code/check-backup-code.query";
import { CheckPasswordResetTokenHandler } from "../queries/check-password-reset-token/check-password-reset-token.handler";
import { CheckPasswordResetTokenQuery } from "../queries/check-password-reset-token/check-password-reset-token.query";
import { CountRemainingBackupCodesHandler } from "../queries/count-remaining-backup-codes/count-remaining-backup-codes.handler";
import { CountRemainingBackupCodesQuery } from "../queries/count-remaining-backup-codes/count-remaining-backup-codes.query";
import { GetMeHandler } from "../queries/get-me/get-me.handler";
import { GetMeQuery } from "../queries/get-me/get-me.query";
import { GetMyMfaRecoveryStatusHandler } from "../queries/get-my-mfa-recovery-status/get-my-mfa-recovery-status.handler";
import { GetMyMfaRecoveryStatusQuery } from "../queries/get-my-mfa-recovery-status/get-my-mfa-recovery-status.query";
import { GetOwnProfileHandler } from "../queries/get-own-profile/get-own-profile.handler";
import { GetOwnProfileQuery } from "../queries/get-own-profile/get-own-profile.query";
import { GetSessionPermissionsHandler } from "../queries/get-session-permissions/get-session-permissions.handler";
import { GetSessionPermissionsQuery } from "../queries/get-session-permissions/get-session-permissions.query";
import { GetUserForAdminHandler } from "../queries/get-user-for-admin/get-user-for-admin.handler";
import { GetUserForAdminQuery } from "../queries/get-user-for-admin/get-user-for-admin.query";
import { ListMySessionsHandler } from "../queries/list-my-sessions/list-my-sessions.handler";
import { ListMySessionsQuery } from "../queries/list-my-sessions/list-my-sessions.query";
import { ListUsersForAdminHandler } from "../queries/list-users-for-admin/list-users-for-admin.handler";
import { ListUsersForAdminQuery } from "../queries/list-users-for-admin/list-users-for-admin.query";
import { InMemoryIdentityReads, adminAccountView } from "./fakes/identity-reads.fakes";
import { InMemorySessionCache } from "./fakes/identity-sign-in.fakes";
import { FakeCredentialCrypto, FixedClock, FixedGrants, NOW, ScriptedSignupReferralCodes, userActor } from "./fakes/identity.fakes";

const USER_ID = "user-1";
const actor = userActor(USER_ID);
const crypto = new FakeCredentialCrypto();

let reads: InMemoryIdentityReads;
let cache: InMemorySessionCache;
let grants: FixedGrants;
let referrals: ScriptedSignupReferralCodes;
const clock = new FixedClock();

beforeEach(() => {
	reads = new InMemoryIdentityReads();
	cache = new InMemorySessionCache();
	grants = new FixedGrants();
	referrals = new ScriptedSignupReferralCodes();
	reads.accounts.set(USER_ID, adminAccountView({ id: USER_ID, email: "jane@example.com" }));
});

function session(id: string, lastActiveAt: number): Session {
	return {
		id,
		label: "Firefox on macOS",
		isCurrent: false,
		clientType: "web",
		browserName: "Firefox",
		browserVersion: "130",
		osName: "macOS",
		osVersion: "15",
		deviceType: "DESKTOP",
		deviceModel: null,
		deviceName: null,
		appVersion: null,
		signInMethod: "PASSWORD",
		ipAddress: null,
		lastIpAddress: null,
		location: null,
		createdAt: NOW,
		lastActiveAt: epochMs(lastActiveAt),
		expiresAt: NOW,
	};
}

describe("GetMeHandler", () => {
	it("serves the cached profile, building and caching it on a miss", async () => {
		const handler = new GetMeHandler(reads, grants, cache, clock);

		const first = await handler.execute(new GetMeQuery(actor, { userId: USER_ID }));
		const second = await handler.execute(new GetMeQuery(actor, { userId: USER_ID }));

		expect(second).toEqual(first);
		expect(reads.accountReads).toBe(1);
		expect(cache.me.get(USER_ID)).toEqual(first);
	});

	it("answers not found for a missing account", async () => {
		await expect(new GetMeHandler(reads, grants, cache, clock).execute(new GetMeQuery(actor, { userId: "ghost" }))).rejects.toBeInstanceOf(AccountNotFoundError);
	});
});

describe("GetSessionPermissionsHandler", () => {
	const handler = (): GetSessionPermissionsHandler => new GetSessionPermissionsHandler(reads, grants, cache);

	it("reports a full session without an enrollment reason", async () => {
		await expect(handler().execute(new GetSessionPermissionsQuery(actor, { userId: USER_ID, accessPayload: undefined }))).resolves.toMatchObject({
			sessionScope: "full",
			enrollmentReason: undefined,
		});
		expect(cache.permissions.has(USER_ID)).toBe(true);
	});

	it("names why a restricted session is restricted, from the access token", async () => {
		const restricted: AccessTokenPayload = {
			sub: USER_ID,
			id: USER_ID,
			email: "jane@example.com",
			fullName: "Jane",
			isActive: true,
			isSuperAdmin: false,
			isEmailVerified: true,
			hasAdminAccess: false,
			tokenVersion: 1,
			sessionScope: "restricted",
		};

		await expect(
			handler().execute(new GetSessionPermissionsQuery(actor, { userId: USER_ID, accessPayload: { ...restricted, isEmailVerified: false } })),
		).resolves.toMatchObject({
			enrollmentReason: "email_verification",
		});
		await expect(
			handler().execute(new GetSessionPermissionsQuery(actor, { userId: USER_ID, accessPayload: { ...restricted, isEmailVerified: true } })),
		).resolves.toMatchObject({
			enrollmentReason: "mfa_enrollment",
		});
	});
});

describe("Admin user reads", () => {
	it("assembles one user's detail with lockout and signup-referral facts", async () => {
		reads.accounts.set(USER_ID, adminAccountView({ id: USER_ID, email: "jane@example.com", failedLoginAttempts: 3, lockedUntil: epochMs(NOW + 1) }));
		referrals.summaries.set(USER_ID, { referrer: { id: "user-9", fullName: "Referrer" }, status: "not_redeemed" });

		await expect(new GetUserForAdminHandler(reads, grants, referrals, clock).execute(new GetUserForAdminQuery(actor, { userId: USER_ID }))).resolves.toMatchObject({
			id: USER_ID,
			failedLoginAttempts: 3,
			lockedUntil: NOW + 1,
			signupReferrer: { id: "user-9", fullName: "Referrer" },
			signupReferralStatus: "not_redeemed",
		});
	});

	it("lists users with dashboard access derived from their roles, in one batched read each", async () => {
		reads.accounts.set("user-2", adminAccountView({ id: "user-2", email: "manager@example.com" }));
		grants.rolesByUser.set("user-2", [{ id: "role-1", name: "Admin", description: null }]);

		const page = await new ListUsersForAdminHandler(reads, grants, referrals, clock).execute(new ListUsersForAdminQuery(actor, { query: { page: 1, limit: 20 } }));

		expect(page.items.map((user) => [user.id, user.hasAdminAccess])).toEqual([
			[USER_ID, false],
			["user-2", true],
		]);
	});
});

describe("Self-service reads", () => {
	it("returns the read model's page of the caller's sessions, marking the session in use", async () => {
		reads.sessions.set(USER_ID, [session("recent", NOW - 10), session("current", NOW - 100)]);

		const listed = await new ListMySessionsHandler(reads).execute(
			new ListMySessionsQuery(actor, { userId: USER_ID, currentSessionId: "current", query: { page: 1, limit: 20 } }),
		);

		expect(listed.items.map((entry) => [entry.id, entry.isCurrent])).toEqual([
			["recent", false],
			["current", true],
		]);
	});

	it("checks a backup code against the unused hashes and counts what is left", async () => {
		reads.backupCodeHashes.set(USER_ID, ["hash:BACKUP-ONE", "hash:BACKUP-TWO"]);

		await expect(new CheckBackupCodeHandler(reads, crypto).execute(new CheckBackupCodeQuery(actor, { userId: USER_ID, backupCode: "BACKUP-TWO" }))).resolves.toEqual({
			valid: true,
		});
		await expect(new CheckBackupCodeHandler(reads, crypto).execute(new CheckBackupCodeQuery(actor, { userId: USER_ID, backupCode: "NOPE" }))).resolves.toEqual({
			valid: false,
		});
		await expect(new CountRemainingBackupCodesHandler(reads).execute(new CountRemainingBackupCodesQuery(actor, { userId: USER_ID }))).resolves.toEqual({ remaining: 2 });
	});

	it("validates a reset link by digest lookup, then the slow hash", async () => {
		reads.resetTokens.set("sha:good-token", { userId: USER_ID, tokenHash: "hash:good-token", expiresAt: epochMs(NOW + 1) });
		reads.resetTokens.set("sha:stale-token", { userId: USER_ID, tokenHash: "hash:stale-token", expiresAt: epochMs(NOW - 1) });
		const handler = new CheckPasswordResetTokenHandler(reads, crypto, clock);

		await expect(handler.execute(new CheckPasswordResetTokenQuery(actor, { token: "good-token" }))).resolves.toEqual({ valid: true });
		await expect(handler.execute(new CheckPasswordResetTokenQuery(actor, { token: "stale-token" }))).resolves.toEqual({ valid: false });
		await expect(handler.execute(new CheckPasswordResetTokenQuery(actor, { token: "unknown" }))).resolves.toEqual({ valid: false });
	});

	it("answers NONE without a recovery request, and not found without a profile", async () => {
		await expect(new GetMyMfaRecoveryStatusHandler(reads).execute(new GetMyMfaRecoveryStatusQuery(actor, { userId: USER_ID }))).resolves.toMatchObject({ status: "NONE" });
		await expect(new GetOwnProfileHandler(reads).execute(new GetOwnProfileQuery(actor, { userId: USER_ID }))).rejects.toBeInstanceOf(ProfileNotFoundError);
	});
});
