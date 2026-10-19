import { Inject, Injectable, Logger } from "@nestjs/common";
import type {
	EpochMs,
	FlatUserResponse,
	LoginRestrictedEnrollmentResponse,
	LoginServiceResponse,
	SessionLocation,
	SessionSignInMethod,
	UserPermissions,
	UserResponse,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CLOCK, type Clock } from "../../../../platform/application/clock.port";
import { USER_GRANTS_READ, type UserGrantsReadPort } from "../../../../platform/application/ports/authorization.port";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import { DeviceSession, type SessionSweep } from "../../domain/aggregates/device-session.aggregate";
import type { UserAccount } from "../../domain/aggregates/user-account.aggregate";
import { InvalidCredentialsError } from "../../domain/errors/identity.errors";
import { assertMerchantPortalAccess } from "../../domain/policies/merchant-portal-access.policy";
import { resolveSessionRestriction, sessionScopeOf, type SessionRestriction } from "../../domain/policies/session-restriction.policy";
import { buildSessionDeviceLabel, type SessionDeviceContext } from "../../domain/value-objects/session-device.value-object";
import type { IdentityScope } from "../identity-scope";
import type { CredentialCryptoPort } from "../ports/credential-crypto.port";
import type { IdGeneratorPort } from "../ports/id-generator.port";
import type { AccountView } from "../ports/identity-read.port";
import type { IdentitySettings } from "../ports/identity-settings.port";
import type { IdentityTokensPort, SessionTokens } from "../ports/identity-tokens.port";
import {
	CREDENTIAL_CRYPTO,
	ID_GENERATOR,
	IDENTITY_SETTINGS,
	IDENTITY_TOKENS,
	IDENTITY_UNIT_OF_WORK,
	MERCHANT_PORTAL_ACCESS,
	PUBLIC_AUTH_FLOW_OPERATION,
	SESSION_LOCATION_LOOKUP,
	USER_SESSION_CACHE,
} from "../ports/identity.tokens";
import type { MerchantPortalAccessPort } from "../ports/merchant-portal-access.port";
import type { SessionLocationLookupPort } from "../ports/session-location.port";
import type { UserSessionCachePort } from "../ports/user-session-cache.port";
import { buildSessionPermissions } from "./session-permissions";
import { accountViewOf, buildFlatUser, buildUserResponse, isEmailVerifiedAt } from "./user-response.assembler";

/** The sign-in a session is issued for: the device receiving the tokens and the proofs the login flow required. */
export interface SessionSignIn {
	readonly device: SessionDeviceContext;
	readonly signInMethod: SessionSignInMethod;
}

export interface IssueSessionOptions {
	/** The flow just proved a second factor: the session carries a fresh MFA assurance. */
	readonly mfaAssured?: boolean | undefined;
}

/** The permission that lets platform staff into the merchant portal without a membership. */
const MANAGE_MERCHANTS_ACTION = "MANAGE";
const MANAGE_MERCHANTS_RESOURCE = "MERCHANT_ORG";

/**
 * Issues a device session (one `RefreshToken` row and its token pair) to a user who passed every
 * step of a login flow (`SessionIssuer` of plan §7.6: used by LogIn, VerifyNewDeviceLogin, the 2FA
 * completions and invite registration).
 *
 * D15: the session insert and the sweep that retires expired and excess sessions run in ONE unit of
 * work under the user's row lock, so concurrent sign-ins of one user run the sweep one at a time and
 * the cap of live sessions is never exceeded.
 */
@Injectable()
export class SessionIssuer {
	private readonly logger: Logger = new Logger(SessionIssuer.name);

	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(USER_GRANTS_READ) private readonly grants: UserGrantsReadPort,
		@Inject(MERCHANT_PORTAL_ACCESS) private readonly merchantAccess: MerchantPortalAccessPort,
		@Inject(IDENTITY_TOKENS) private readonly tokens: IdentityTokensPort,
		@Inject(CREDENTIAL_CRYPTO) private readonly crypto: CredentialCryptoPort,
		@Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
		@Inject(SESSION_LOCATION_LOOKUP) private readonly locations: SessionLocationLookupPort,
		@Inject(USER_SESSION_CACHE) private readonly sessionCache: UserSessionCachePort,
		@Inject(IDENTITY_SETTINGS) private readonly settings: IdentitySettings,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async issue(
		actor: ActorContext,
		userId: string,
		clientType: string | undefined,
		signIn: SessionSignIn,
		options: IssueSessionOptions = {},
	): Promise<LoginServiceResponse | LoginRestrictedEnrollmentResponse> {
		const now: EpochMs = this.clock.now();
		const account: UserAccount | null = await this.uow.runSystemOperation(PUBLIC_AUTH_FLOW_OPERATION, actor, (scope) => scope.accounts.findById(userId));
		if (!account?.canSignIn()) {
			throw new InvalidCredentialsError();
		}

		const permissions: UserPermissions = await this.grants.getUserPermissionDetails(account.id);
		const organizationSlug: string | null = clientType === "merchant" ? await this.requireMerchantPortalAccess(account, permissions, now) : null;

		const view = accountViewOf(account);
		const profile: UserResponse = buildUserResponse(view, permissions, now);
		const flatUser: FlatUserResponse = buildFlatUser(view, permissions, now);
		const restriction: SessionRestriction = resolveSessionRestriction(
			{
				isEmailVerified: isEmailVerifiedAt(view, now),
				twoFactorEnabled: account.twoFactorEnabled,
				mfaEnrollmentDeadline: account.mfaEnrollmentDeadline,
				enrollmentGraceMs: this.settings.mfaEnrollmentGraceMs,
			},
			now,
		);
		const mfaAssuredAt: EpochMs | null = options.mfaAssured === true ? now : account.mfaAssuranceAt(now);

		// The session id is chosen first: it is the refresh token's `jti` and the access token's `sid`
		// (ADR 034), so the row is stored once, complete.
		const sessionId: string = this.ids.next();
		const sessionTokens: SessionTokens = await this.tokens.generateSessionTokens(flatUser, sessionId, {
			sessionScope: sessionScopeOf(restriction),
			mfaAssuredAt: mfaAssuredAt ?? undefined,
		});
		const location: SessionLocation | null = await this.locations.lookup(signIn.device.ipAddress);

		await this.uow.runSystemOperation(PUBLIC_AUTH_FLOW_OPERATION, actor, async (scope: IdentityScope): Promise<void> => {
			const locked: UserAccount | null = await scope.accounts.lockById(account.id);
			if (!locked?.canSignIn()) {
				throw new InvalidCredentialsError();
			}
			if (options.mfaAssured === true) {
				locked.recordMfaAssurance(now);
				await scope.accounts.save(locked);
			}
			await scope.sessions.add(
				DeviceSession.issue(
					{
						id: sessionId,
						userId: account.id,
						tokenHash: this.crypto.hashRefreshToken(sessionTokens.refreshToken),
						device: signIn.device.device,
						ipAddress: signIn.device.ipAddress,
						location,
						signInMethod: signIn.signInMethod,
						lifetimeMs: this.settings.sessionLifetimeMs,
					},
					now,
				),
			);
			const sweep: SessionSweep = DeviceSession.sweepAtSignIn(await scope.sessions.liveSessionsOf(account.id), now);
			await scope.sessions.revokeSessions(sweep.expired, DeviceSession.sweepRevoker("expired"), now);
			await scope.sessions.revokeSessions(sweep.excess, DeviceSession.sweepRevoker("excess"), now);
			const retired = DeviceSession.sweepEvent(account.id, sweep, now);
			if (retired !== null) {
				scope.events.collect(retired);
			}
		});

		this.logger.log({
			event: "auth.session.issued",
			userId: account.id,
			sessionId,
			sessionScope: sessionScopeOf(restriction),
			enrollmentReason: restriction.restricted ? restriction.reason : null,
			device: buildSessionDeviceLabel(signIn.device.device),
			signInMethod: signIn.signInMethod,
			clientType: clientType ?? "web",
		});

		await this.warmSessionCache(view, profile, permissions);

		if (restriction.restricted) {
			return {
				requiresEnrollment: true,
				enrollmentReason: restriction.reason,
				message: restriction.message,
				user: profile,
				...(organizationSlug !== null ? { organizationSlug } : {}),
				...sessionTokens,
			};
		}
		return { user: profile, ...sessionTokens };
	}

	/** The merchant portal slug, or throws `MERCHANT_ACCESS_REQUIRED`. */
	private async requireMerchantPortalAccess(account: UserAccount, permissions: UserPermissions, now: EpochMs): Promise<string | null> {
		const access = await this.merchantAccess.findAccess(account.id, account.email.value, now);
		assertMerchantPortalAccess({
			hasMerchantMembership: access.organizationSlug !== null,
			canManageMerchants: permissions.permissions.some((permission) => permission.action === MANAGE_MERCHANTS_ACTION && permission.resource === MANAGE_MERCHANTS_RESOURCE),
			hasPendingTeamInvite: access.hasPendingTeamInvite,
		});
		return access.organizationSlug;
	}

	/** Warm the `/auth/me` + `/auth/permissions` cache after sign-in (shared by web, admin and merchant). */
	private async warmSessionCache(view: AccountView, profile: UserResponse, permissions: UserPermissions): Promise<void> {
		await this.sessionCache.setMe(view.id, profile);
		const capabilities = await this.grants.getUserCapabilitySlugs(view.id);
		await this.sessionCache.setPermissions(view.id, buildSessionPermissions(view, permissions, capabilities));
	}
}
