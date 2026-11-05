// The merchant's payment screens (ADR 020): words for statuses and gateways, sen ⇄ ringgit, the
// "ask for a payment" form's checks, and the retry-safe Idempotency-Key. Plain functions, so the
// components stay presentational and every rule is tested on its own.

import {
	CreatePaymentIntentSchema,
	PAYMENT_DESCRIPTION_MAX_LENGTH,
	PAYMENT_MAX_AMOUNT_MINOR,
	PAYMENT_MIN_AMOUNT_MINOR,
	PaymentProviderNameSchema,
	type CreatePaymentIntent,
	type PaymentCurrency,
	type PaymentProviderName,
	type PaymentStatus,
} from "@workspace/shared";
import { z } from "zod";

/** Sen in one ringgit: amounts travel in sen, people type and read ringgit. */
export const MINOR_UNITS_PER_MAJOR = 100;

export const PAYMENT_STATUS_LABELS: Readonly<Record<PaymentStatus, string>> = {
	PENDING: "Waiting for payment",
	PAID: "Paid",
	FAILED: "Failed",
	CANCELLED: "Cancelled",
	REFUNDED: "Refunded",
};

export const PAYMENT_PROVIDER_LABELS: Readonly<Record<PaymentProviderName, string>> = {
	BILLPLZ: "Billplz",
	CHIP: "CHIP",
	FAKE: "Test gateway",
};

/** What each gateway lets the payer pay with, in a line under its name. */
export const PAYMENT_PROVIDER_DESCRIPTIONS: Readonly<Record<PaymentProviderName, string>> = {
	BILLPLZ: "FPX online banking and cards. Refunds are made in your Billplz dashboard.",
	CHIP: "FPX, cards and e-wallets. Refunds can be made here.",
	FAKE: "For development: no money moves.",
};

/** How each currency is written before its amount. */
const CURRENCY_SYMBOLS: Readonly<Record<PaymentCurrency, string>> = { MYR: "RM" };

/** Two decimals, with thousands grouped: 125000 sen → `1,250.00`. */
const MAJOR_AMOUNT_FORMAT = new Intl.NumberFormat("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** An amount in sen as people read it: `2500, "MYR"` → `RM 25.00` (a plain space, so it copies and matches as typed). */
export function formatPaymentAmount(amountMinor: number, currency: PaymentCurrency): string {
	return `${CURRENCY_SYMBOLS[currency]} ${MAJOR_AMOUNT_FORMAT.format(amountMinor / MINOR_UNITS_PER_MAJOR)}`;
}

/** Ringgit as typed (`25`, `25.5`, `25.50`, `1,250.00`) → sen, or null when it isn't an amount. */
export function parseAmountToMinor(text: string): number | null {
	const match = /^(?<whole>\d{1,7})(?:\.(?<fraction>\d{1,2}))?$/u.exec(text.trim().replaceAll(",", ""));
	const whole = match?.groups?.whole;
	if (whole === undefined) {
		return null;
	}
	const fraction = (match?.groups?.fraction ?? "").padEnd(2, "0");
	return Number(whole) * MINOR_UNITS_PER_MAJOR + Number(fraction);
}

/** What the form holds while the merchant types: the amount stays text, so "25." never loses its dot. */
export const PaymentFormValuesSchema = z
	.object({
		provider: PaymentProviderNameSchema.or(z.literal("")),
		amount: z.string(),
		description: z.string(),
		payerName: z.string(),
		payerEmail: z.string(),
	})
	.strict();
export type PaymentFormValues = z.output<typeof PaymentFormValuesSchema>;
export type PaymentFormField = keyof PaymentFormValues;

export const EMPTY_PAYMENT_FORM: PaymentFormValues = { provider: "", amount: "", description: "", payerName: "", payerEmail: "" };

/** The form checked: the request to send, or one message per field that is wrong. */
export type PaymentFormCheck =
	| { readonly ok: true; readonly request: CreatePaymentIntent }
	| { readonly ok: false; readonly errors: Readonly<Partial<Record<PaymentFormField, string>>> };

const AMOUNT_RANGE_MESSAGE = `Enter an amount from ${formatPaymentAmount(PAYMENT_MIN_AMOUNT_MINOR, "MYR")} to ${formatPaymentAmount(PAYMENT_MAX_AMOUNT_MINOR, "MYR")}.`;

const FIELD_MESSAGES: Readonly<Record<Exclude<PaymentFormField, "amount">, string>> = {
	provider: "Choose how the customer pays.",
	description: `Say what the payment is for (up to ${String(PAYMENT_DESCRIPTION_MAX_LENGTH)} characters).`,
	payerName: "Enter the customer's name.",
	payerEmail: "Enter the customer's email address; the gateway sends the receipt there.",
};

const FormFieldSchema = PaymentFormValuesSchema.keyof();

/**
 * Checks the form with the API's own schema (`CreatePaymentIntentSchema`), so the screen and the server
 * agree on what is valid. `returnUrl` is where the payer comes back to after checkout.
 */
export function checkPaymentForm(values: PaymentFormValues, returnUrl: string): PaymentFormCheck {
	const amountMinor = parseAmountToMinor(values.amount);
	const parsed = CreatePaymentIntentSchema.safeParse({
		provider: values.provider,
		amountMinor: amountMinor ?? Number.NaN,
		description: values.description,
		payerName: values.payerName,
		payerEmail: values.payerEmail.trim(),
		returnUrl,
	});
	if (parsed.success) {
		return { ok: true, request: parsed.data };
	}
	const errors: Partial<Record<PaymentFormField, string>> = {};
	for (const issue of parsed.error.issues) {
		const [first] = issue.path;
		const field = first === "amountMinor" ? "amount" : FormFieldSchema.safeParse(first).data;
		if (field === "amount") {
			errors.amount = amountMinor === null ? "Enter the amount in ringgit, like 25.00." : AMOUNT_RANGE_MESSAGE;
		} else if (field !== undefined) {
			errors[field] = FIELD_MESSAGES[field];
		}
	}
	return { ok: false, errors };
}

/** The key last sent, with the exact request it was sent for. */
export interface SentIdempotencyKey {
	readonly key: string;
	readonly request: CreatePaymentIntent;
}

// The currency has one value today (MYR), so it can't differ; compare it here when a second currency is added.
function sameRequest(left: CreatePaymentIntent, right: CreatePaymentIntent): boolean {
	return (
		left.provider === right.provider &&
		left.amountMinor === right.amountMinor &&
		left.description === right.description &&
		left.payerName === right.payerName &&
		left.payerEmail === right.payerEmail &&
		left.returnUrl === right.returnUrl
	);
}

/**
 * The `Idempotency-Key` for sending `request`: the same key again when it is the same request (a retry after
 * a lost answer returns the payment already made, never a second one), a new key once anything changed.
 */
export function idempotencyKeyFor(previous: SentIdempotencyKey | null, request: CreatePaymentIntent, newKey: () => string): SentIdempotencyKey {
	return previous !== null && sameRequest(previous.request, request) ? previous : { key: newKey(), request };
}
