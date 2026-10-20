import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { epochMs, type EpochMs, type RefreshResponse, type UserPermissions } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { USER_GRANTS_READ, type UserGrantsReadPort } from "../../../../../platform/application/ports/authorization.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { DeviceSession, type LostRotationOutcome, type RefreshDecision } from "../../../domain/aggregates/device-session.aggregate";
import type { UserAccount } from "../../../domain/aggregates/user-account.aggregate";
import {
	AccountDeletedError,
	AccountInactiveError,
	RefreshAccountMissingError,
	RefreshTokenInvalidError,
	RefreshTokenSupersededError,
	TokenTheftDetectedError,
} from "../../../domain/errors/identity.errors";
import { DeviceSessionsRevoked, RefreshTokenReuseDetected, DeviceSessionRotated } from "../../../domain/events/identity.events";
import { resolveSessionRestriction, sessionScopeOf } from "../../../domain/policies/session-restriction.policy";
import { revokedBySystem } from "../../../domain/value-objects/session-revoker.value-object";
import type { IdentityScope } from "../../identity-scope";
import type { CredentialCryptoPort } from "../../ports/credential-crypto.port";
import type { IdentitySettings } from "../../ports/identity-settings.port";
import type { IdentityTelemetryPort } from "../../ports/identity-telemetry.port";
import type { IdentityTokensPort, SessionTokens } from "../../ports/identity-tokens.port";
import { CREDENTIAL_CRYPTO, IDENTITY_SETTINGS, IDENTITY_TELEMETRY, IDENTITY_TOKENS, IDENTITY_UNIT_OF_WORK } from "../../ports/identity.tokens";
import { accountViewOf, buildFlatUser, isEmailVerifiedAt } from "../../services/user-response.assembler";
import { RefreshSessionCommand } from "./refresh-session.command";

type RefreshOutcome = { readonly kind: "rotated"; readonly tokens: SessionTokens } | { readonly kind: "superseded" | "reused" | "missing" };

/**
 * Rotates a device session's refresh token in place (the session id `sid` and the device details
 * carry forward). The rotation is a compare-and-set on the stored digest; a rotation that loses it
 * re-reads the row: the immediate predecessor inside the grace window is a benign concurrent refresh
 * (`REFRESH_TOKEN_SUPERSEDED`), anything else is reuse — every session is revoked and `tokenVersion`
 * moves in the SAME transaction, then the request is refused with `TOKEN_THEFT_DETECTED`.
 */
@CommandHandler(RefreshSessionCommand)
export class RefreshSessionHandler implements ICommandHandler<RefreshSessionCommand, RefreshResponse> {
	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(CREDENTIAL_CRYPTO) private readonly crypto: CredentialCryptoPort,
		@Inject(IDENTITY_TOKENS) private readonly tokens: IdentityTokensPort,
		@Inject(USER_GRANTS_READ) private readonly grants: UserGrantsReadPort,
		@Inject(IDENTITY_TELEMETRY) private readonly telemetry: IdentityTelemetryPort,
		@Inject(IDENTITY_SETTINGS) private readonly settings: IdentitySettings,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: RefreshSessionCommand): Promise<RefreshResponse> {
		const { input } = command;
		const startedAt: EpochMs = this.clock.now();
		const actor: ActorContext = command.actor;
		const outcome: RefreshOutcome = await this.uow.run(actor, (scope) => this.rotate(scope, command, startedAt));

		if (outcome.kind === "rotated") {
			return outcome.tokens;
		}
		if (outcome.kind === "superseded") {
			await this.telemetry.recordSessionAction({ action: "refresh", userId: input.userId, error: "REFRESH_TOKEN_SUPERSEDED", durationMs: this.clock.now() - startedAt });
			throw new RefreshTokenSupersededError();
		}
		if (outcome.kind === "reused") {
			throw new TokenTheftDetectedError();
		}
		throw new RefreshTokenInvalidError();
	}

	private async rotate(scope: IdentityScope, command: RefreshSessionCommand, startedAt: EpochMs): Promise<RefreshOutcome> {
		const { input } = command;
		const now: EpochMs = this.clock.now();
		const account: UserAccount | null = await scope.accounts.findById(input.userId);
		if (account === null) {
			throw new RefreshAccountMissingError();
		}
		if (!account.isActive) {
			throw new AccountInactiveError();
		}
		if (account.isDeleted) {
			throw new AccountDeletedError();
		}

		const session: DeviceSession | null = await scope.sessions.findById(input.sessionId);
		if (session?.userId !== input.userId) {
			throw new RefreshTokenInvalidError();
		}
		const expectedTokenHash: string = session.tokenHash;
		const previous: string | null = session.previousTokenHash;
		const decision: RefreshDecision = session.evaluateRefresh(
			{
				storedHashIsDigest: this.crypto.isRefreshTokenDigest(expectedTokenHash),
				matchesCurrent: this.crypto.matchesRefreshToken(input.rawRefreshToken, expectedTokenHash),
				matchesPrevious: previous !== null && this.crypto.matchesRefreshToken(input.rawRefreshToken, previous),
			},
			now,
		);
		if (decision === "superseded") {
			return { kind: "superseded" };
		}
		if (decision === "reused") {
			return this.revokeAllOnReuse(scope, input.userId, input.sessionId, startedAt, now);
		}

		const permissions: UserPermissions = await this.grants.getUserPermissionDetails(account.id);
		const view = accountViewOf(account);
		const restriction = resolveSessionRestriction(
			{
				isEmailVerified: isEmailVerifiedAt(view, now),
				twoFactorEnabled: account.twoFactorEnabled,
				mfaEnrollmentDeadline: account.mfaEnrollmentDeadline,
				enrollmentGraceMs: this.settings.mfaEnrollmentGraceMs,
			},
			now,
		);
		const sessionTokens: SessionTokens = await this.tokens.generateSessionTokens(buildFlatUser(view, permissions, now), session.id, {
			sessionScope: sessionScopeOf(restriction),
			mfaAssuredAt: account.mfaAssuranceAt(now) ?? undefined,
		});
		session.rotate({
			tokenHash: this.crypto.hashRefreshToken(sessionTokens.refreshToken),
			expiresAt: epochMs(now + this.settings.sessionLifetimeMs),
			lastIpAddress: input.device.ipAddress,
			rotatedAt: now,
		});
		const write = await scope.sessions.saveRotation(session, expectedTokenHash, now);
		if (write.kind === "lost") {
			const lost: LostRotationOutcome = DeviceSession.classifyLostRotation(write.current, expectedTokenHash, now);
			return lost === "reused" ? this.revokeAllOnReuse(scope, input.userId, input.sessionId, startedAt, now) : { kind: lost };
		}
		scope.events.collect(new DeviceSessionRotated(input.userId, session.id, startedAt, now));
		return { kind: "rotated", tokens: sessionTokens };
	}

	/** Theft signal: every session of the user is revoked and `tokenVersion` moves, in this transaction. */
	private async revokeAllOnReuse(scope: IdentityScope, userId: string, sessionId: string, startedAt: EpochMs, now: EpochMs): Promise<RefreshOutcome> {
		await scope.sessions.revokeAllOf([userId], revokedBySystem("system:rotation-reuse"), now, null);
		await scope.accounts.bumpTokenVersions([userId], now);
		scope.events.collect(new RefreshTokenReuseDetected(userId, sessionId, startedAt, now));
		scope.events.collect(new DeviceSessionsRevoked([userId], "refresh_token_reuse", now));
		return { kind: "reused" };
	}
}
