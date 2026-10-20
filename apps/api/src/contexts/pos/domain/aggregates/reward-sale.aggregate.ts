import type { EpochMs, SaleCurrency } from "@workspace/shared";

import { AggregateRoot } from "../../../../platform/domain/aggregate-root";
import {
	CheckoutIdempotencyKeyReusedError,
	DuplicateRewardCodeError,
	MinSpendNotMetError,
	MultipleCustomersError,
	RedemptionInputRequiredError,
	RedemptionRefusedError,
} from "../errors/pos.errors";
import { SaleCheckedOut, type PosEvent } from "../events/pos.events";
import { redemptionInvalidReason, type RedeemableClaim } from "../policies/redemption-eligibility.policy";

/** How a code reached the till: a scanned QR, or a backup code typed in. */
export type RedemptionMethod = "SCAN" | "MANUAL";

/** One presented code, resolved to its claim. */
export interface PresentedClaim {
	readonly claim: RedeemableClaim;
	readonly method: RedemptionMethod;
}

/** Who rings the bill up: the tenant, its store (when known), the till and its key. */
export interface CheckoutPoint {
	readonly tenantId: string;
	readonly locationId: string | null;
	readonly terminalId: string;
	readonly apiKeyId: string;
}

export interface NewSale {
	readonly id: string;
	readonly point: CheckoutPoint;
	readonly billTotalMinor: number;
	readonly currency: SaleCurrency;
	readonly idempotencyKey: string;
	/** Fingerprint of the bill and its codes (a retried key must carry the same one to be replayed). */
	readonly requestHash: string;
	readonly presented: readonly PresentedClaim[];
}

export interface SaleLine {
	readonly claimId: string;
	readonly rewardId: string;
	readonly method: RedemptionMethod;
}

export interface RewardSaleState {
	readonly id: string;
	readonly point: CheckoutPoint;
	readonly customerUserId: string;
	readonly billTotalMinor: number;
	readonly currency: SaleCurrency;
	readonly idempotencyKey: string;
	readonly requestHash: string;
	readonly paidAt: EpochMs;
	/** Sorted by claim id: the stable lock order that keeps overlapping checkouts from deadlocking. */
	readonly lines: readonly SaleLine[];
}

/**
 * A paid bill and the rewards redeemed on it. Checkout is all-or-nothing: every presented code is a
 * distinct claim of ONE customer, redeemable here now, and the bill meets each reward's minimum (each
 * minimum is checked against the whole bill on its own; minimums do not add up).
 */
export class RewardSale extends AggregateRoot<PosEvent> {
	private constructor(private readonly state: RewardSaleState) {
		super();
	}

	public static checkout(sale: NewSale, now: EpochMs): RewardSale {
		const claimIds = new Set<string>();
		const customers = new Set<string>();
		for (const { claim } of sale.presented) {
			if (claimIds.has(claim.claimId)) {
				throw new DuplicateRewardCodeError(claim.claimId);
			}
			claimIds.add(claim.claimId);
			customers.add(claim.customerUserId);
			const reason = redemptionInvalidReason(claim, sale.point.locationId, now);
			if (reason !== null) {
				throw new RedemptionRefusedError(reason, claim.claimId);
			}
			if (claim.minSpendMinor !== null && sale.billTotalMinor < claim.minSpendMinor) {
				throw new MinSpendNotMetError(claim.rewardTitle, claim.claimId, claim.minSpendMinor);
			}
		}
		if (customers.size > 1) {
			throw new MultipleCustomersError();
		}
		const [first] = sale.presented;
		if (first === undefined) {
			throw new RedemptionInputRequiredError();
		}
		const lines: SaleLine[] = sale.presented
			.map(({ claim, method }): SaleLine => ({ claimId: claim.claimId, rewardId: claim.rewardId, method }))
			.sort((left: SaleLine, right: SaleLine): number => left.claimId.localeCompare(right.claimId));
		const created = new RewardSale({
			id: sale.id,
			point: sale.point,
			customerUserId: first.claim.customerUserId,
			billTotalMinor: sale.billTotalMinor,
			currency: sale.currency,
			idempotencyKey: sale.idempotencyKey,
			requestHash: sale.requestHash,
			paidAt: now,
			lines,
		});
		created.record(
			new SaleCheckedOut(
				now,
				sale.id,
				sale.point.tenantId,
				first.claim.customerUserId,
				sale.point.locationId,
				sale.point.terminalId,
				sale.billTotalMinor,
				sale.currency,
				lines.map((line: SaleLine): string => line.claimId),
			),
		);
		return created;
	}

	/** A stored sale may be replayed only for the identical request. */
	public static assertReplayOf(stored: { readonly saleId: string; readonly requestHash: string }, requestHash: string): void {
		if (stored.requestHash !== requestHash) {
			throw new CheckoutIdempotencyKeyReusedError(stored.saleId);
		}
	}

	public get id(): string {
		return this.state.id;
	}

	public snapshot(): RewardSaleState {
		return this.state;
	}
}
