import { describe, expect, it } from "vitest";

import { Observable, Subject, Subscription, of } from "../index";
import { activeSubscriptionCount, activeSubscriptionSnapshot, assertNoActiveSubscriptions } from "../testing/index";

/**
 * The leak detector (design doc Part 8½ "leak detector test pattern").
 *
 * Every `Subscription` registers with a module-scope registry on construction
 * and unregisters on `unsubscribe()`. Because `Subscriber.error()`/`complete()`
 * run `unsubscribe()` internally, a terminated stream cleans itself up — so a
 * healthy test ends with ZERO active subscriptions.
 *
 * NOTE: these tests assert on the registry's global state, so every test MUST
 * fully tear down what it creates (unsubscribe or let the stream complete).
 */
describe("active subscription registry", () => {
	it("tracks a live subscription and unregisters it on unsubscribe", () => {
		const before = activeSubscriptionCount();
		const sub = new Subscription();
		expect(activeSubscriptionCount()).toBe(before + 1);

		sub.unsubscribe();
		expect(activeSubscriptionCount()).toBe(before);
		expect(sub.isClosed).toBe(true);
	});

	it("is idempotent — a second unsubscribe does not double-unregister", () => {
		const before = activeSubscriptionCount();
		const sub = new Subscription();
		sub.unsubscribe();
		sub.unsubscribe();
		expect(activeSubscriptionCount()).toBe(before);
	});

	it("a synchronously-completing stream cleans itself up (of)", () => {
		const before = activeSubscriptionCount();
		of(1, 2, 3).subscribe();
		expect(activeSubscriptionCount()).toBe(before);
	});

	it("an erroring stream cleans itself up", () => {
		const before = activeSubscriptionCount();
		new Observable<number>((observer) => {
			observer.error(new Error("boom"));
			return (): void => undefined;
		}).subscribe();
		expect(activeSubscriptionCount()).toBe(before);
	});

	it("a Subject subscriber unregisters when the Subject completes", () => {
		const before = activeSubscriptionCount();
		const subject = new Subject<number>();
		subject.subscribe();
		expect(activeSubscriptionCount()).toBe(before + 1);
		subject.complete();
		expect(activeSubscriptionCount()).toBe(before);
	});

	it("activeSubscriptionSnapshot lists live subscriptions newest-first", () => {
		const first = new Subscription();
		const second = new Subscription();
		const snapshot = activeSubscriptionSnapshot();
		expect(snapshot[0]).toBe(second);
		expect(snapshot[1]).toBe(first);
		first.unsubscribe();
		second.unsubscribe();
	});

	it("assertNoActiveSubscriptions passes when everything is torn down", () => {
		const sub = new Subscription();
		sub.unsubscribe();
		expect(() => {
			assertNoActiveSubscriptions("clean");
		}).not.toThrow();
	});

	it("assertNoActiveSubscriptions throws with the leak count when something is alive", () => {
		const leak = new Subscription();
		try {
			expect(() => {
				assertNoActiveSubscriptions("leaky test");
			}).toThrow(/subscription leak detected.*1 subscription/s);
		} finally {
			leak.unsubscribe();
		}
	});
});
