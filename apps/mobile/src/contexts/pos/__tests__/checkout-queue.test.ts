import { ApiError, ApiResponseContractError } from "@workspace/api-client";
import type { RedemptionCheckoutInput } from "@workspace/shared";

import {
	canQueueCheckout,
	checkoutRetryDelayMs,
	MAX_QUEUED_CHECKOUTS,
	parseCheckoutQueue,
	serializeCheckoutQueue,
	waitingCheckouts,
	wasUnanswered,
	withoutCheckout,
	withQueuedCheckout,
	withRefusedCheckout,
	type QueuedCheckout,
} from "../checkout-queue";

const TOKEN = "k3J9xQ2mV8pL1tR6wZ4bN7cY0dF5gH2s";
const QUEUED_AT_MS = 1_793_000_000_000;
const BILL_MINOR = 2550;

function request(index: number): RedemptionCheckoutInput {
	return { idempotencyKey: `0a1b2c3d-4e5f-4a6b-8c7d-00000000000${String(index)}`, billTotalMinor: BILL_MINOR, currency: "MYR", codes: [{ token: TOKEN }] };
}

function queueOf(count: number): readonly QueuedCheckout[] {
	return Array.from({ length: count }, (_unused: undefined, index: number): readonly QueuedCheckout[] =>
		withQueuedCheckout([], request(index), "Free flat white", QUEUED_AT_MS),
	).flat();
}

describe("the till's offline checkout queue (enhancement 6.4)", () => {
	it("keeps a checkout once per Idempotency-Key, waiting to be sent", () => {
		const once = withQueuedCheckout([], request(1), "Free flat white", QUEUED_AT_MS);
		expect(once).toStrictEqual([{ request: request(1), rewardTitle: "Free flat white", queuedAtMs: QUEUED_AT_MS, refusal: null }]);
		expect(withQueuedCheckout(once, request(1), "Free flat white", QUEUED_AT_MS)).toBe(once);
		expect(waitingCheckouts(once)).toStrictEqual(once);
	});

	it("drops a sent checkout, and marks a refused one for the cashier, sending it no more", () => {
		const queue = queueOf(2);
		const refused = withRefusedCheckout(queue, request(0).idempotencyKey, "Already redeemed");
		expect(refused.map((entry: QueuedCheckout): string | null => entry.refusal)).toStrictEqual(["Already redeemed", null]);
		expect(waitingCheckouts(refused).map((entry: QueuedCheckout): string => entry.request.idempotencyKey)).toStrictEqual([request(1).idempotencyKey]);
		expect(withoutCheckout(refused, request(0).idempotencyKey)).toHaveLength(1);
	});

	it("holds at most MAX_QUEUED_CHECKOUTS", () => {
		expect(canQueueCheckout(queueOf(MAX_QUEUED_CHECKOUTS - 1))).toBe(true);
		expect(canQueueCheckout(queueOf(MAX_QUEUED_CHECKOUTS))).toBe(false);
	});

	it("reads back what it wrote, and an unreadable or missing value as an empty queue", () => {
		const queue = queueOf(2);
		expect(parseCheckoutQueue(serializeCheckoutQueue(queue))).toStrictEqual(queue);
		expect(parseCheckoutQueue(null)).toStrictEqual([]);
		expect(parseCheckoutQueue("not json")).toStrictEqual([]);
		expect(parseCheckoutQueue(JSON.stringify([{ request: { codes: [] } }]))).toStrictEqual([]);
	});

	it("waits longer before each try again, doubling from 2 s, never above a minute", () => {
		const waits = [0, 1, 2, 3, 4, 5, 6].map(checkoutRetryDelayMs);
		expect(waits).toStrictEqual([2_000, 4_000, 8_000, 16_000, 32_000, 60_000, 60_000]);
		expect(checkoutRetryDelayMs(Number.MAX_SAFE_INTEGER)).toBe(60_000);
	});

	it("queues only a call that got no answer: any answer is the API's word", () => {
		expect(wasUnanswered(new TypeError("Network request failed"))).toBe(true);
		expect(wasUnanswered(new ApiError({ statusCode: 503, error: "SERVICE_UNAVAILABLE", message: "Try again" }))).toBe(false);
		expect(
			wasUnanswered(new ApiResponseContractError({ method: "POST", url: "/integration/redemptions/checkout", status: 200 }, [{ path: "root", message: "unexpected body" }])),
		).toBe(false);
	});
});
