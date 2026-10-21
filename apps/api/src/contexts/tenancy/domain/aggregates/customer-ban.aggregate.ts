import type { EpochMs } from "@workspace/shared";

import { AggregateRoot } from "../../../../platform/domain/aggregate-root";
import { CorruptAggregateStateError } from "../../../../platform/domain/errors/corrupt-aggregate-state.error";
import type { TenantsDomainEvent } from "../events/tenants.events";

export interface CustomerBanState {
	readonly id: string;
	readonly tenantId: string;
	readonly customerUserId: string;
	readonly sourceRedemptionId: string | null;
	readonly reason: string;
	readonly bannedByUserId: string | null;
	readonly bannedAt: EpochMs;
}

/** Lifting the ban, as persistence writes it (compare-and-set on the ban still being active). */
export interface CustomerBanLift {
	readonly liftedByUserId: string;
	readonly liftedAt: EpochMs;
}

/**
 * A merchant's ban of one of its customers from its rewards: while it is active the customer cannot
 * claim the merchant's rewards and its tills refuse the customer's codes. Made from one of the
 * customer's redemptions; lifted by the merchant (a lifted ban stays as history).
 */
export class CustomerBan extends AggregateRoot<TenantsDomainEvent> {
	private pendingLift: CustomerBanLift | null = null;

	private constructor(
		private readonly state: CustomerBanState,
		public readonly isNew: boolean,
	) {
		super();
	}

	/** A new active ban; the reason is trimmed and may not be blank. */
	public static issue(id: string, input: Omit<CustomerBanState, "id">): CustomerBan {
		const reason = input.reason.trim();
		if (reason.length === 0) {
			throw new CorruptAggregateStateError("tenant", id);
		}
		return new CustomerBan({ ...input, id, reason }, true);
	}

	public static rehydrate(state: CustomerBanState): CustomerBan {
		return new CustomerBan(state, false);
	}

	public get id(): string {
		return this.state.id;
	}

	public get tenantId(): string {
		return this.state.tenantId;
	}

	public get customerUserId(): string {
		return this.state.customerUserId;
	}

	public get snapshot(): CustomerBanState {
		return this.state;
	}

	/** The lift this unit of work made, or `null`. */
	public get lift(): CustomerBanLift | null {
		return this.pendingLift;
	}

	/** The merchant lifts the ban: the customer may claim and redeem again. */
	public liftBy(memberUserId: string, now: EpochMs): void {
		this.pendingLift = { liftedByUserId: memberUserId, liftedAt: now };
	}
}
