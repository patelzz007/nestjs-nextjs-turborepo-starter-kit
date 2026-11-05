import type { PaymentStatus } from "@workspace/shared";

// Which status a payment may move to (ADR 020). Gateways retry and reorder callbacks, and the redirect and
// the callback race, so the same news can arrive twice or late. The policy makes every update safe to apply
// in any order: a repeat is a no-op, and news that would move a payment backwards (a late "pending" after
// "paid", "failed" after "paid") is ignored rather than rejected.

/** The outcome of offering a status to a payment. */
export type PaymentStatusChange = "applied" | "unchanged" | "ignored";

/** The statuses each status may move to. */
const ALLOWED_NEXT: Readonly<Record<PaymentStatus, readonly PaymentStatus[]>> = {
	PENDING: ["PAID", "FAILED", "CANCELLED"],
	// A declined attempt doesn't close the checkout: the payer may try another card or bank.
	FAILED: ["PAID", "CANCELLED"],
	PAID: ["REFUNDED"],
	CANCELLED: [],
	REFUNDED: [],
};

/** What offering `next` to a payment now in `current` does. */
export function paymentStatusChange(current: PaymentStatus, next: PaymentStatus): PaymentStatusChange {
	if (current === next) {
		return "unchanged";
	}
	return ALLOWED_NEXT[current].includes(next) ? "applied" : "ignored";
}

/** Whether nothing can change a payment in this status any more. */
export function isFinalPaymentStatus(status: PaymentStatus): boolean {
	return ALLOWED_NEXT[status].length === 0;
}
