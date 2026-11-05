// The till's offline queue (enhancement 6.4): a checkout the API validated, then could not be sent because the
// till lost its connection, is kept on the phone with its Idempotency-Key and sent when the connection is back.
// The key is what makes that safe: the API's ledger answers a key it has seen with its first result, so a checkout
// that did reach the API before the answer was lost is never redeemed twice (rules/09). Only checkouts are queued,
// and only those that got no answer at all: a refusal (expired, wrong store, below the minimum spend) is the API's
// decision and is shown at once, as before. The API stays the authority when a queued checkout is sent; a refusal
// then stays on the till's list until the cashier dismisses it.
//
// Kept in Secure Store (a reward code is a bearer credential, like the till's API key), as one bounded value: at
// most MAX_QUEUED_CHECKOUTS, so the queue stays within what Secure Store holds on every platform.

import { ApiError, ApiResponseContractError } from "@workspace/api-client";
import { RedemptionCheckoutSchema, type RedemptionCheckoutInput } from "@workspace/shared";
import { z } from "zod";

import { readSecureValue, SECURE_STORE_ENTRIES, writeSecureValue } from "../../lib/secure-store";

/** Checkouts one till keeps while offline: enough for a short outage, small enough for Secure Store. */
export const MAX_QUEUED_CHECKOUTS = 5;

/** The first wait before sending again after a send that got no answer while the phone counted as online. */
const FIRST_RETRY_DELAY_MS = 2_000;

/** The longest wait between those tries: a till left online for an hour still tries every minute. */
const MAX_RETRY_DELAY_MS = 60_000;

/** Doublings after which the wait has reached MAX_RETRY_DELAY_MS (later attempts double no further). */
const MAX_RETRY_DOUBLINGS = Math.ceil(Math.log2(MAX_RETRY_DELAY_MS / FIRST_RETRY_DELAY_MS));

/**
 * How long to wait before try `attempt` (0 first) after a send got no answer while the phone counted as online:
 * doubling from FIRST_RETRY_DELAY_MS, never above MAX_RETRY_DELAY_MS. The phone can count as online before it
 * can reach the API (leaving airplane mode, Android brings mobile data up before Wi-Fi; a captive portal; DNS not
 * ready), and nothing else would send the queue again until the connection dropped and came back.
 */
export function checkoutRetryDelayMs(attempt: number): number {
	return Math.min(MAX_RETRY_DELAY_MS, FIRST_RETRY_DELAY_MS * 2 ** Math.min(attempt, MAX_RETRY_DOUBLINGS));
}

/** Longest reward title kept with a queued checkout (what the cashier reads in the list). */
const QUEUED_REWARD_TITLE_MAX_LENGTH = 120;

/** Longest refusal kept (the API's message, shown to the cashier). */
const REFUSAL_MAX_LENGTH = 300;

const QueuedCheckoutSchema = z
	.object({
		request: RedemptionCheckoutSchema,
		rewardTitle: z.string().min(1).max(QUEUED_REWARD_TITLE_MAX_LENGTH),
		queuedAtMs: z.number().int().nonnegative(),
		/** Null while waiting to be sent; the API's reason once it refused the checkout. */
		refusal: z.string().max(REFUSAL_MAX_LENGTH).nullable(),
	})
	.strict();

export type QueuedCheckout = z.output<typeof QueuedCheckoutSchema>;

const CheckoutQueueSchema = z.array(QueuedCheckoutSchema).max(MAX_QUEUED_CHECKOUTS);

/** The queue's stored form, or an empty queue for a missing or unreadable value (never a cast). */
export function parseCheckoutQueue(stored: string | null): readonly QueuedCheckout[] {
	if (stored === null) {
		return [];
	}
	try {
		const parsed = CheckoutQueueSchema.safeParse(JSON.parse(stored));
		return parsed.success ? parsed.data : [];
	} catch {
		return [];
	}
}

export function serializeCheckoutQueue(queue: readonly QueuedCheckout[]): string {
	return JSON.stringify(queue);
}

/** Whether the till can keep one more checkout (only waiting ones count: refusals are the cashier's to clear). */
export function canQueueCheckout(queue: readonly QueuedCheckout[]): boolean {
	return queue.length < MAX_QUEUED_CHECKOUTS;
}

/** `queue` with `request` added (once per Idempotency-Key: queueing the same checkout again changes nothing). */
export function withQueuedCheckout(queue: readonly QueuedCheckout[], request: RedemptionCheckoutInput, rewardTitle: string, nowMs: number): readonly QueuedCheckout[] {
	if (queue.some((entry: QueuedCheckout): boolean => entry.request.idempotencyKey === request.idempotencyKey)) {
		return queue;
	}
	return [...queue, { request, rewardTitle: rewardTitle.slice(0, QUEUED_REWARD_TITLE_MAX_LENGTH), queuedAtMs: nowMs, refusal: null }];
}

/** `queue` without the checkout of `idempotencyKey` (it went through, or the cashier dismissed its refusal). */
export function withoutCheckout(queue: readonly QueuedCheckout[], idempotencyKey: string): readonly QueuedCheckout[] {
	return queue.filter((entry: QueuedCheckout): boolean => entry.request.idempotencyKey !== idempotencyKey);
}

/** `queue` with the checkout of `idempotencyKey` marked refused by the API, for the cashier to see. */
export function withRefusedCheckout(queue: readonly QueuedCheckout[], idempotencyKey: string, reason: string): readonly QueuedCheckout[] {
	return queue.map((entry: QueuedCheckout): QueuedCheckout =>
		entry.request.idempotencyKey === idempotencyKey ? { ...entry, refusal: reason.slice(0, REFUSAL_MAX_LENGTH) } : entry,
	);
}

/** The checkouts still to send, oldest first. */
export function waitingCheckouts(queue: readonly QueuedCheckout[]): readonly QueuedCheckout[] {
	return queue.filter((entry: QueuedCheckout): boolean => entry.refusal === null);
}

/**
 * Whether a failed call got no answer from the API (no connection, a timeout): the only failure a checkout is
 * queued for. Any answer, a refusal or a malformed body, is the API's word and is never retried behind it.
 */
export function wasUnanswered(error: Error): boolean {
	return !(error instanceof ApiError) && !(error instanceof ApiResponseContractError);
}

export async function readCheckoutQueue(): Promise<readonly QueuedCheckout[]> {
	return parseCheckoutQueue(await readSecureValue(SECURE_STORE_ENTRIES.tillCheckoutQueue));
}

export async function writeCheckoutQueue(queue: readonly QueuedCheckout[]): Promise<void> {
	await writeSecureValue(SECURE_STORE_ENTRIES.tillCheckoutQueue, serializeCheckoutQueue(queue));
}
