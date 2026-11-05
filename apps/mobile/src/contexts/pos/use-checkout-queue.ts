// The till's offline queue at the counter (enhancement 6.4, checkout-queue.ts): keeps a checkout that got no
// answer, and sends what it keeps when the connection is back, when the till screen opens, and on "Send now".
// One at a time, oldest first, each with its own Idempotency-Key; a send with no answer stops the round, a refusal
// stays listed for the cashier, a success is announced and leaves the list. A round stopped by no answer while the
// phone counts as online is tried again on a backoff (checkoutRetryDelayMs): "online" can come before the API is
// reachable (mobile data up before Wi-Fi, seen on a phone), and no other signal would send the queue again.

import type { PosCaller } from "@workspace/api-client";
import type { RedemptionCheckoutInput } from "@workspace/shared";
import * as React from "react";

import { useConnectivity } from "../../features/app-status/facade";
import { errorMessageOf } from "../../lib/error-messages";
import { useRisingEdge } from "../../lib/use-rising-edge";
import {
	canQueueCheckout,
	checkoutRetryDelayMs,
	readCheckoutQueue,
	waitingCheckouts,
	wasUnanswered,
	withoutCheckout,
	withQueuedCheckout,
	withRefusedCheckout,
	writeCheckoutQueue,
	type QueuedCheckout,
} from "./checkout-queue";

export interface CheckoutQueue {
	/** What the till keeps: checkouts waiting, and any the API refused when they were sent. */
	readonly entries: readonly QueuedCheckout[];
	/** A round of sending is running. */
	readonly sending: boolean;
	/** Keeps a checkout that got no answer; false when the till already keeps as many as it can. */
	readonly keep: (request: RedemptionCheckoutInput, rewardTitle: string) => Promise<boolean>;
	/** Forgets a refused checkout the cashier has seen. */
	readonly dismiss: (idempotencyKey: string) => void;
	/** Sends what is waiting now (it also runs by itself when the connection comes back). */
	readonly sendNow: () => void;
}

/** A queued checkout that went through: what was sent and the API's whole answer (for the till's request view). */
export interface SentCheckout {
	readonly request: RedemptionCheckoutInput;
	readonly response: Awaited<ReturnType<PosCaller["checkout"]["mutate"]>>;
}

export interface CheckoutQueueOptions {
	/** A queued checkout went through: the cashier is told, with what it redeemed and what the till sent. */
	readonly onSent: (sent: SentCheckout) => void;
	/** The clock queued checkouts are stamped with (a test's own; `Date.now` otherwise). */
	readonly nowMs?: () => number;
}

export function useCheckoutQueue(till: PosCaller, { onSent, nowMs = Date.now }: CheckoutQueueOptions): CheckoutQueue {
	const online = useConnectivity() === "online";
	const [entries, setEntries] = React.useState<readonly QueuedCheckout[]>([]);
	const [sending, setSending] = React.useState(false);
	// The queue as last written: every change starts from it, so two changes never overwrite each other.
	const latest = React.useRef<readonly QueuedCheckout[]>([]);
	const running = React.useRef(false);
	// Read by a round when it ends, so a round that started online and ended offline schedules nothing.
	const onlineNow = React.useRef(online);
	const retry = React.useRef<{ readonly timer: ReturnType<typeof setTimeout> | null; readonly attempt: number }>({ timer: null, attempt: 0 });

	const commit = React.useCallback(async (next: readonly QueuedCheckout[]): Promise<void> => {
		latest.current = next;
		setEntries(next);
		await writeCheckoutQueue(next);
	}, []);

	const cancelRetry = React.useCallback((): void => {
		const { timer } = retry.current;
		if (timer !== null) {
			clearTimeout(timer);
		}
		retry.current = { timer: null, attempt: 0 };
	}, []);

	/** One round: true when every waiting checkout got an answer, false when one got none (the rest wait). */
	const sendRound = React.useCallback(async (): Promise<boolean> => {
		for (const entry of waitingCheckouts(latest.current)) {
			try {
				const receipt = await till.checkout.mutate(entry.request);
				await commit(withoutCheckout(latest.current, entry.request.idempotencyKey));
				onSent({ request: entry.request, response: receipt });
			} catch (error: unknown) {
				if (!(error instanceof Error) || wasUnanswered(error)) {
					return false;
				}
				await commit(withRefusedCheckout(latest.current, entry.request.idempotencyKey, errorMessageOf(error)));
			}
		}
		return true;
	}, [commit, onSent, till]);

	const send = React.useCallback(async (): Promise<void> => {
		if (running.current) {
			return;
		}
		running.current = true;
		setSending(true);
		const { timer, attempt } = retry.current;
		if (timer !== null) {
			clearTimeout(timer);
		}
		retry.current = { timer: null, attempt };
		try {
			const answered = await sendRound();
			if (answered || !onlineNow.current) {
				// Done, or offline: the connection coming back starts the next round.
				retry.current = { timer: null, attempt: 0 };
				return;
			}
			retry.current = {
				timer: setTimeout((): void => {
					void send();
				}, checkoutRetryDelayMs(attempt)),
				attempt: attempt + 1,
			};
		} finally {
			running.current = false;
			setSending(false);
		}
	}, [sendRound]);

	React.useEffect((): (() => void) => {
		let mounted = true;
		void readCheckoutQueue().then((stored: readonly QueuedCheckout[]): void => {
			if (mounted) {
				latest.current = stored;
				setEntries(stored);
				void send();
			}
		});
		return (): void => {
			mounted = false;
			cancelRetry();
		};
	}, [cancelRetry, send]);

	React.useEffect((): void => {
		onlineNow.current = online;
		if (!online) {
			cancelRetry();
		}
	}, [cancelRetry, online]);

	const sendWhenOnline = React.useCallback((): void => {
		void send();
	}, [send]);
	useRisingEdge(online, sendWhenOnline);

	const keep = React.useCallback(
		async (request: RedemptionCheckoutInput, rewardTitle: string): Promise<boolean> => {
			if (!canQueueCheckout(latest.current)) {
				return false;
			}
			await commit(withQueuedCheckout(latest.current, request, rewardTitle, nowMs()));
			return true;
		},
		[commit, nowMs],
	);
	const dismiss = React.useCallback(
		(idempotencyKey: string): void => {
			void commit(withoutCheckout(latest.current, idempotencyKey));
		},
		[commit],
	);

	return { entries, sending, keep, dismiss, sendNow: sendWhenOnline };
}
