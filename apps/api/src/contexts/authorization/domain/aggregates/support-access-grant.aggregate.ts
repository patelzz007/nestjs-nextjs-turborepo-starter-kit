import { SUPPORT_ACCESS_GRANT_LIFECYCLE, SupportAccessGrantModeSchema, SupportAccessGrantStatusSchema, type EpochMs } from "@workspace/shared";
import { z } from "zod";

import { SupportAccessGrantNotPendingError, SupportAccessGrantNotRevocableError } from "../errors/authorization.errors";
import { CorruptAggregateStateError } from "../../../../platform/domain/errors/corrupt-aggregate-state.error";

/** Milliseconds per minute: converts the requested grant duration to an epoch-ms expiry. */
const MS_PER_MINUTE = 60_000;

/** `SupportAccessGrant.ticketRef` column width. */
export const SUPPORT_TICKET_REF_MAX_LENGTH = 120;

export type SupportAccessGrantStatus = z.output<typeof SupportAccessGrantStatusSchema>;
export type SupportAccessGrantMode = z.output<typeof SupportAccessGrantModeSchema>;

const SupportAccessGrantStateSchema = z.object({
	id: z.string().min(1),
	tenantId: z.string().min(1),
	supportUserId: z.string().min(1),
	mode: SupportAccessGrantModeSchema,
	status: SupportAccessGrantStatusSchema,
	reason: z.string().min(1),
	ticketRef: z.string().max(SUPPORT_TICKET_REF_MAX_LENGTH).nullable(),
	tenantApprovedById: z.string().min(1).nullable(),
	expiresAt: z.number().int().nonnegative(),
	revokedAt: z.number().int().nonnegative().nullable(),
	createdAt: z.number().int().nonnegative(),
});

export type SupportAccessGrantState = z.output<typeof SupportAccessGrantStateSchema>;

export interface NewSupportAccessGrant {
	readonly id: string;
	readonly tenantId: string;
	readonly supportUserId: string;
	readonly mode: SupportAccessGrantMode;
	readonly reason: string;
	readonly ticketRef: string | null;
	readonly durationMinutes: number;
}

/**
 * Just-in-time support access to one tenant.
 *
 * A SuperAdmin requests a grant (PENDING_TENANT_APPROVAL); an active owner of the grant's tenant
 * approves it (ACTIVE); a SuperAdmin revokes it (REVOKED); the expiry job ends it once its time runs
 * out (EXPIRED). The moves are {@link SUPPORT_ACCESS_GRANT_LIFECYCLE} (`@workspace/shared`); every one
 * is compared-and-set on the status the grant was loaded with, so a revoked or expired grant can
 * never be revived.
 */
export class SupportAccessGrantAggregate {
	private constructor(
		private state: SupportAccessGrantState,
		private readonly loadedStatus: SupportAccessGrantStatus,
	) {}

	public static request(grant: NewSupportAccessGrant, now: EpochMs): SupportAccessGrantAggregate {
		const state: SupportAccessGrantState = SupportAccessGrantStateSchema.parse({
			id: grant.id,
			tenantId: grant.tenantId,
			supportUserId: grant.supportUserId,
			mode: grant.mode,
			status: "PENDING_TENANT_APPROVAL",
			reason: grant.reason,
			ticketRef: grant.ticketRef,
			tenantApprovedById: null,
			expiresAt: now + grant.durationMinutes * MS_PER_MINUTE,
			revokedAt: null,
			createdAt: now,
		});
		return new SupportAccessGrantAggregate(state, state.status);
	}

	public static rehydrate(state: SupportAccessGrantState): SupportAccessGrantAggregate {
		const parsed = SupportAccessGrantStateSchema.safeParse(state);
		if (!parsed.success) {
			throw new CorruptAggregateStateError("SupportAccessGrant", state.id);
		}
		return new SupportAccessGrantAggregate(parsed.data, parsed.data.status);
	}

	public get id(): string {
		return this.state.id;
	}

	/** Always read from the grant record, never from the request. */
	public get tenantId(): string {
		return this.state.tenantId;
	}

	/** Status the grant was loaded with; the repository compares it (CAS). */
	public get concurrencyToken(): SupportAccessGrantStatus {
		return this.loadedStatus;
	}

	public snapshot(): SupportAccessGrantState {
		return { ...this.state };
	}

	/**
	 * An owner approves a pending, unexpired grant someone else requested.
	 * @throws SupportAccessGrantNotPendingError when it is decided, revoked, expired, or self-requested.
	 */
	public approve(approverUserId: string, now: EpochMs): void {
		if (!SUPPORT_ACCESS_GRANT_LIFECYCLE.can("approve", this.state.status) || this.state.expiresAt <= now || this.state.supportUserId === approverUserId) {
			throw new SupportAccessGrantNotPendingError();
		}
		this.state = { ...this.state, status: SUPPORT_ACCESS_GRANT_LIFECYCLE.targetOf("approve"), tenantApprovedById: approverUserId };
	}

	/**
	 * The expiry job marks a grant whose time ran out EXPIRED. Enforcement never waits for it (a grant
	 * past `expiresAt` already verifies as nothing); it makes the end durable. Returns `false` (no
	 * change) for a terminal grant or one that has not expired yet.
	 */
	public expire(now: EpochMs): boolean {
		if (!SUPPORT_ACCESS_GRANT_LIFECYCLE.can("expire", this.state.status) || this.state.expiresAt > now) {
			return false;
		}
		this.state = { ...this.state, status: SUPPORT_ACCESS_GRANT_LIFECYCLE.targetOf("expire") };
		return true;
	}

	/** @throws SupportAccessGrantNotRevocableError for a terminal grant (never revived, never re-revoked). */
	public revoke(now: EpochMs): void {
		if (!SUPPORT_ACCESS_GRANT_LIFECYCLE.can("revoke", this.state.status)) {
			throw new SupportAccessGrantNotRevocableError();
		}
		this.state = { ...this.state, status: SUPPORT_ACCESS_GRANT_LIFECYCLE.targetOf("revoke"), revokedAt: now };
	}
}
