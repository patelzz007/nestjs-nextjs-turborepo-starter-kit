import { z } from "zod";

// The payments context's provider-neutral vocabulary (ADR 020): which gateway took a payment, and where a
// payment stands. Provider SDK types never cross this line; each adapter maps its own states onto these.

/** The gateways the platform can take a payment through. `FAKE` is the deterministic test and local one. */
export const PaymentProviderNameSchema = z.enum(["BILLPLZ", "CHIP", "FAKE"]);
export type PaymentProviderName = z.output<typeof PaymentProviderNameSchema>;

/** Whether a payment through the gateway can be refunded through its API (Billplz refunds only in its own dashboard). */
export const PAYMENT_PROVIDER_REFUNDS: Readonly<Record<PaymentProviderName, boolean>> = {
	BILLPLZ: false,
	CHIP: true,
	FAKE: true,
};

/**
 * Where a payment stands. `PENDING` until the payer finishes (or abandons) checkout; `PAID` once the gateway
 * confirms the money; `FAILED` after a declined attempt (the payer may still retry on the same checkout, so a
 * later `PAID` still applies); `CANCELLED` when it can no longer be paid (cancelled, expired, deleted);
 * `REFUNDED` after a refund or a chargeback.
 */
export const PaymentStatusSchema = z.enum(["PENDING", "PAID", "FAILED", "CANCELLED", "REFUNDED"]);
export type PaymentStatus = z.output<typeof PaymentStatusSchema>;

/** ISO 4217 currencies the gateways accept. Both Billplz and CHIP settle Malaysian ringgit. */
export const PaymentCurrencySchema = z.enum(["MYR"]);
export type PaymentCurrency = z.output<typeof PaymentCurrencySchema>;

/** The smallest charge both gateways accept: RM 1.00 (Billplz's minimum bill). */
export const PAYMENT_MIN_AMOUNT_MINOR = 100;
/** The largest single charge the platform takes: RM 100,000.00 (a guard against a typo, not a gateway limit). */
export const PAYMENT_MAX_AMOUNT_MINOR = 10_000_000;
/** Billplz caps a bill's description at 200 characters; the platform holds every gateway to it. */
export const PAYMENT_DESCRIPTION_MAX_LENGTH = 200;

/** An amount in minor units (sen): a whole number within the platform's limits. */
export const PaymentAmountMinorSchema = z.number().int().min(PAYMENT_MIN_AMOUNT_MINOR).max(PAYMENT_MAX_AMOUNT_MINOR);
