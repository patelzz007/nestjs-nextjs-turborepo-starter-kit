import { TenantAppealStatusSchema, type EpochMs, type TenantAppealStatus } from "@workspace/shared";

import { AggregateRoot } from "../../../../platform/domain/aggregate-root";
import { TenantAppealNotPendingError } from "../errors/tenants.errors";
import type { TenantsDomainEvent } from "../events/tenants.events";
import { CorruptAggregateStateError } from "../../../../platform/domain/errors/corrupt-aggregate-state.error";

export interface SuspensionAppealState {
	readonly id: string;
	readonly tenantId: string;
	readonly submittedByUserId: string;
	readonly message: string;
	readonly status: string;
	readonly reviewedByUserId: string | null;
	readonly reviewedAt: EpochMs | null;
	readonly reviewNote: string | null;
}

/** The decision a review writes; persistence compare-and-sets it on the appeal still being PENDING. */
export interface AppealReview {
	readonly status: Exclude<TenantAppealStatus, "PENDING">;
	readonly reviewedByUserId: string;
	readonly reviewedAt: EpochMs;
	readonly reviewNote: string;
}

/**
 * A suspended tenant's appeal against its suspension. Submitted PENDING by the tenant; a platform
 * admin accepts it (reinstating the tenant in the same transaction) or rejects it with a note.
 */
export class SuspensionAppeal extends AggregateRoot<TenantsDomainEvent> {
	private pendingReview: AppealReview | null = null;

	private constructor(
		public readonly id: string,
		public readonly tenantId: string,
		public readonly submittedByUserId: string,
		public readonly message: string,
		private appealStatus: TenantAppealStatus,
		public readonly isNew: boolean,
	) {
		super();
	}

	public static submit(id: string, tenantId: string, submittedByUserId: string, message: string): SuspensionAppeal {
		const trimmed = message.trim();
		if (trimmed.length === 0) {
			throw new CorruptAggregateStateError("tenant", id);
		}
		return new SuspensionAppeal(id, tenantId, submittedByUserId, trimmed, "PENDING", true);
	}

	public static rehydrate(state: SuspensionAppealState): SuspensionAppeal {
		const status = TenantAppealStatusSchema.safeParse(state.status);
		if (!status.success) {
			throw new CorruptAggregateStateError("tenant", state.id);
		}
		return new SuspensionAppeal(state.id, state.tenantId, state.submittedByUserId, state.message, status.data, false);
	}

	public get status(): TenantAppealStatus {
		return this.appealStatus;
	}

	/** The review this unit of work made, or `null`. */
	public get review(): AppealReview | null {
		return this.pendingReview;
	}

	public accept(adminUserId: string, note: string, now: EpochMs): void {
		this.decide("ACCEPTED", adminUserId, note, now);
	}

	public reject(adminUserId: string, note: string, now: EpochMs): void {
		this.decide("REJECTED", adminUserId, note, now);
	}

	private decide(status: AppealReview["status"], adminUserId: string, note: string, now: EpochMs): void {
		if (this.appealStatus !== "PENDING") {
			throw new TenantAppealNotPendingError();
		}
		this.appealStatus = status;
		this.pendingReview = { status, reviewedByUserId: adminUserId, reviewedAt: now, reviewNote: note.trim() };
	}
}
