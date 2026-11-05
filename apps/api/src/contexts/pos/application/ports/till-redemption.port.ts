import type { CheckoutPoint } from "../../domain/aggregates/reward-sale.aggregate";

/**
 * Whether this store's tills may redeem right now (the `till-redemption` store flag, enhancement 5.11): the
 * pos context's own question; an adapter answers it from the feature-flags context.
 */
export interface TillRedemptionGate {
	isOpen(point: CheckoutPoint): Promise<boolean>;
}

export const TILL_REDEMPTION_GATE = Symbol("TILL_REDEMPTION_GATE");
