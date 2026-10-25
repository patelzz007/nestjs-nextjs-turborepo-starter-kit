import type { EpochMs } from "@workspace/shared";

import { DomainEvent } from "../../../../platform/domain/domain-event";

/**
 * Why an account's credentials changed. Every reason bumps `tokenVersion` in the same transaction,
 * so access tokens issued before it are rejected on every API instance once the after-commit
 * invalidation lands (and at the latest when the access-token state cache expires).
 */
export type CredentialChangeReason =
	| "password_changed"
	| "password_reset"
	| "two_factor_enabled"
	| "two_factor_rotated"
	| "account_unlocked"
	| "mfa_recovery_completed"
	| "account_banned"
	| "account_unbanned";

/** Why device sessions were revoked (drives the after-commit cross-instance invalidation). */
export type SessionRevocationReason = "session_revoked" | "logout_all_devices" | "refresh_token_reuse" | "session_limit" | "rbac_mutation" | "account_banned";

/** `session.action` action a session event reports (the existing outbox payload, ADR 015). */
export type SessionActionName = "refresh" | "logout-device" | "logout-all" | "revoke-device";

/** Every event the identity context records. */
export type IdentityEvent =
	| UserCredentialsChanged
	| DeviceSessionsRevoked
	| DeviceSessionRotated
	| DeviceSessionSignedOut
	| AllDeviceSessionsSignedOut
	| RefreshTokenReuseDetected
	| ImpersonationStarted
	| ImpersonationStopped
	| UserProfileChanged;

/**
 * A credential of the account changed (password, second factor, lock, MFA recovery) and its
 * `tokenVersion` was bumped in the same transaction. After commit: drop the cached access-token
 * state and the `/auth/me` payload on every instance (D16, D18).
 */
export class UserCredentialsChanged extends DomainEvent {
	public readonly eventName: string = "identity.UserCredentialsChanged";

	public constructor(
		public readonly userId: string,
		public readonly reason: CredentialChangeReason,
		occurredAt: EpochMs,
	) {
		super(occurredAt);
	}
}

/**
 * Device sessions of these users were revoked in this transaction. After commit: reject their
 * `sid` on every instance (ADR 034).
 */
export class DeviceSessionsRevoked extends DomainEvent {
	public readonly eventName: string = "identity.DeviceSessionsRevoked";

	public constructor(
		public readonly userIds: readonly string[],
		public readonly reason: SessionRevocationReason,
		occurredAt: EpochMs,
	) {
		super(occurredAt);
	}
}

/** One device session's refresh token was rotated (outbox `session.action` / `refresh`, succeeded). */
export class DeviceSessionRotated extends DomainEvent {
	public readonly eventName: string = "identity.DeviceSessionRotated";

	public constructor(
		public readonly userId: string,
		public readonly sessionId: string,
		/** When the use case started: the outbox payload reports the action's duration. */
		public readonly startedAt: EpochMs,
		occurredAt: EpochMs,
	) {
		super(occurredAt);
	}
}

/** One device session was signed out — the device itself (`logout-device`) or from the device list (`revoke-device`). */
export class DeviceSessionSignedOut extends DomainEvent {
	public readonly eventName: string = "identity.DeviceSessionSignedOut";

	public constructor(
		public readonly userId: string,
		public readonly sessionId: string,
		public readonly action: Extract<SessionActionName, "logout-device" | "revoke-device">,
		public readonly startedAt: EpochMs,
		occurredAt: EpochMs,
	) {
		super(occurredAt);
	}
}

/** The user signed out of every device (outbox `session.action` / `logout-all`, succeeded). */
export class AllDeviceSessionsSignedOut extends DomainEvent {
	public readonly eventName: string = "identity.AllDeviceSessionsSignedOut";

	public constructor(
		public readonly userId: string,
		public readonly startedAt: EpochMs,
		occurredAt: EpochMs,
	) {
		super(occurredAt);
	}
}

/** A rotated refresh token was replayed; every session was revoked (outbox `session.action` / `refresh`, failed `TOKEN_THEFT_DETECTED`). */
export class RefreshTokenReuseDetected extends DomainEvent {
	public readonly eventName: string = "identity.RefreshTokenReuseDetected";

	public constructor(
		public readonly userId: string,
		public readonly sessionId: string,
		public readonly startedAt: EpochMs,
		occurredAt: EpochMs,
	) {
		super(occurredAt);
	}
}

/** A SuperAdmin started impersonating a user (outbox `impersonation.action` / `start`). */
export class ImpersonationStarted extends DomainEvent {
	public readonly eventName: string = "identity.ImpersonationStarted";

	public constructor(
		public readonly impersonatorId: string,
		public readonly targetUserId: string,
		public readonly sessionId: string,
		public readonly startedAt: EpochMs,
		occurredAt: EpochMs,
	) {
		super(occurredAt);
	}
}

/** The SuperAdmin stopped impersonating (outbox `impersonation.action` / `stop`). */
export class ImpersonationStopped extends DomainEvent {
	public readonly eventName: string = "identity.ImpersonationStopped";

	public constructor(
		public readonly impersonatorId: string,
		public readonly targetUserId: string,
		public readonly sessionId: string,
		public readonly startedAt: EpochMs,
		occurredAt: EpochMs,
	) {
		super(occurredAt);
	}
}

/**
 * Something `/auth/me` and `/auth/permissions` show changed for this user (profile name, email
 * verification). After commit: drop the cached payloads so the next read on any instance is fresh.
 */
export class UserProfileChanged extends DomainEvent {
	public readonly eventName: string = "identity.UserProfileChanged";

	public constructor(
		public readonly userId: string,
		occurredAt: EpochMs,
	) {
		super(occurredAt);
	}
}
