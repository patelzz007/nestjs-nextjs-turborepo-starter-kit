import { SupportAccessGrantModeSchema, SupportAccessGrantStatusSchema, type EpochMs } from "@workspace/shared";
import { z } from "zod";

import { CorruptAuthorizationStateError, SupportAccessGrantNotPendingError, SupportAccessGrantNotRevocableError } from "../errors/authorization.errors";

/** Milliseconds per minute: converts the requested grant duration to an epoch-ms expiry. */
const MS_PER_MINUTE = 60_000;

/** `SupportAccessGrant.ticketRef` column width. */
export const SUPPORT_TICKET_REF_MAX_LENGTH = 120;

export type SupportAccessGrantStatus = z.output<typeof SupportAccessGrantStatusSchema>;
export type SupportAccessGrantMode = z.output<typeof SupportAccessGrantModeSchema>;

/**
 * Statuses a grant can still be revoked from. REVOKED, EXPIRED and DENIED are terminal. The code never
 * sets PENDING_APPROVAL, but a row in that state stays revocable, exactly as before the migration.
 */
const REVOCABLE_STATUSES: ReadonlySet<SupportAccessGrantStatus> = new Set<SupportAccessGrantStatus>(["PENDING_APPROVAL", "PENDING_TENANT_APPROVAL", "ACTIVE"]);

const SupportAccessGrantStateSchema = z.object({
	id: z.string().min(1),
	organizationId: z.string().min(1),
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
	readonly organizationId: string;
	readonly supportUserId: string;
	readonly mode: SupportAccessGrantMode;
	readonly reason: string;
	readonly ticketRef: string | null;
	readonly durationMinutes: number;
}

/**
 * Just-in-time support access to one organization.
 *
 * A SuperAdmin requests a grant (PENDING_TENANT_APPROVAL); an active owner of the grant's organization
 * approves it (ACTIVE); a SuperAdmin revokes it (REVOKED). Every transition is compared-and-set on the
 * status the grant was loaded with, so a revoked or expired grant can never be revived.
 */
export class SupportAccessGrantAggregate {
	private constructor(
		private state: SupportAccessGrantState,
		private readonly loadedStatus: SupportAccessGrantStatus,
	) {}

	public static request(grant: NewSupportAccessGrant, now: EpochMs): SupportAccessGrantAggregate {
		const state: SupportAccessGrantState = SupportAccessGrantStateSchema.parse({
			id: grant.id,
			organizationId: grant.organizationId,
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
			throw new CorruptAuthorizationStateError("SupportAccessGrant", state.id);
		}
		return new SupportAccessGrantAggregate(parsed.data, parsed.data.status);
	}

	public get id(): string {
		return this.state.id;
	}

	/** Always read from the grant record, never from the request. */
	public get organizationId(): string {
		return this.state.organizationId;
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
		if (this.state.status !== "PENDING_TENANT_APPROVAL" || this.state.expiresAt <= now || this.state.supportUserId === approverUserId) {
			throw new SupportAccessGrantNotPendingError();
		}
		this.state = { ...this.state, status: "ACTIVE", tenantApprovedById: approverUserId };
	}

	/** @throws SupportAccessGrantNotRevocableError for a terminal grant (never revived, never re-revoked). */
	public revoke(now: EpochMs): void {
		if (!REVOCABLE_STATUSES.has(this.state.status)) {
			throw new SupportAccessGrantNotRevocableError();
		}
		this.state = { ...this.state, status: "REVOKED", revokedAt: now };
	}
}
