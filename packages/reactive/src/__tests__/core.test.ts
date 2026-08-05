import { describe, expect, it, vi } from "vitest";

import { BehaviorSubject, Observable, Subject, Subscription, of } from "../index";

describe("Observable", () => {
	it("is cold: each subscription runs the subscriber function independently", () => {
		const subscribeFn = vi.fn((observer: { next: (v: number) => void }) => {
			observer.next(1);
			observer.next(2);
			return undefined;
		});
		const source = new Observable<number>(subscribeFn);
		const first: number[] = [];
		const second: number[] = [];
		source.subscribe({ next: (v) => first.push(v) });
		source.subscribe({ next: (v) => second.push(v) });
		expect(subscribeFn).toHaveBeenCalledTimes(2);
		expect(first).toEqual([1, 2]);
		expect(second).toEqual([1, 2]);
	});

	it("delivers complete and error through the partial observer", () => {
		const events: string[] = [];
		of(1).subscribe({
			next: () => events.push("next"),
			error: () => events.push("error"),
			complete: () => events.push("complete"),
		});
		expect(events).toEqual(["next", "complete"]);
	});

	it("supports the (next, error, complete) call signature", () => {
		const seen: number[] = [];
		of(1, 2, 3).subscribe(
			(v) => seen.push(v),
			() => undefined,
			() => undefined,
		);
		expect(seen).toEqual([1, 2, 3]);
	});

	it("returns a Subscription whose unsubscribe stops delivery", () => {
		const seen: number[] = [];
		const sub = of(1, 2, 3).subscribe({ next: (v) => seen.push(v) });
		sub.unsubscribe();
		expect(sub.isClosed).toBe(true);
		expect(seen).toEqual([1, 2, 3]);
	});

	it("invokes the source teardown exactly once on unsubscribe", () => {
		const teardown = vi.fn();
		const source = new Observable<number>(() => teardown);
		const sub = source.subscribe();
		sub.unsubscribe();
		sub.unsubscribe();
		expect(teardown).toHaveBeenCalledTimes(1);
	});

	it("catches synchronous subscriber errors and routes them to the observer", () => {
		const boom = new Error("boom");
		const source = new Observable<number>(() => {
			throw boom;
		});
		const onError = vi.fn();
		source.subscribe({ next: () => undefined, error: onError });
		expect(onError).toHaveBeenCalledWith(boom);
	});

	it("stops delivering after complete (closed guard)", () => {
		const seen: number[] = [];
		const source = new Observable<number>((observer) => {
			observer.next(1);
			observer.complete();
			observer.next(2);
		});
		source.subscribe({ next: (v) => seen.push(v) });
		expect(seen).toEqual([1]);
	});
});

describe("Subscription", () => {
	it("is idempotent: teardown runs exactly once", () => {
		const teardown = vi.fn();
		const sub = new Subscription();
		sub.add(teardown);
		sub.unsubscribe();
		sub.unsubscribe();
		expect(teardown).toHaveBeenCalledTimes(1);
		expect(sub.isClosed).toBe(true);
	});

	it("runs child teardowns (compound unsubscribe)", () => {
		const first = vi.fn();
		const second = vi.fn();
		const parent = new Subscription();
		const childA = new Subscription();
		childA.add(first);
		parent.add(childA);
		parent.add(second);
		parent.unsubscribe();
		expect(first).toHaveBeenCalledTimes(1);
		expect(second).toHaveBeenCalledTimes(1);
		expect(childA.isClosed).toBe(true);
	});

	it("runs a child added after close immediately", () => {
		const teardown = vi.fn();
		const sub = new Subscription();
		sub.unsubscribe();
		sub.add(teardown);
		expect(teardown).toHaveBeenCalledTimes(1);
	});

	it("supports remove before the parent closes", () => {
		const teardown = vi.fn();
		const sub = new Subscription();
		sub.add(teardown);
		sub.remove(teardown);
		sub.unsubscribe();
		expect(teardown).not.toHaveBeenCalled();
	});
});

describe("Subject", () => {
	it("is hot: late subscribers miss earlier values", () => {
		const subject = new Subject<number>();
		const late: number[] = [];
		subject.next(1);
		subject.subscribe({ next: (v) => late.push(v) });
		subject.next(2);
		expect(late).toEqual([2]);
	});

	it("multicasts to every current subscriber", () => {
		const subject = new Subject<number>();
		const a: number[] = [];
		const b: number[] = [];
		subject.subscribe({ next: (v) => a.push(v) });
		subject.subscribe({ next: (v) => b.push(v) });
		subject.next(1);
		expect(a).toEqual([1]);
		expect(b).toEqual([1]);
	});

	it("stops delivering to an unsubscribed subscriber", () => {
		const subject = new Subject<number>();
		const seen: number[] = [];
		const sub = subject.subscribe({ next: (v) => seen.push(v) });
		subject.next(1);
		sub.unsubscribe();
		subject.next(2);
		expect(seen).toEqual([1]);
	});

	it("completes current subscribers and terminates new ones", () => {
		const subject = new Subject<number>();
		const complete = vi.fn();
		subject.subscribe({ next: () => undefined, complete });
		subject.complete();
		expect(complete).toHaveBeenCalledTimes(1);
		const lateComplete = vi.fn();
		subject.subscribe({ next: () => undefined, complete: lateComplete });
		expect(lateComplete).toHaveBeenCalledTimes(1);
	});
});

describe("BehaviorSubject", () => {
	it("replays the current value to new subscribers", () => {
		const subject = new BehaviorSubject<number>(0);
		subject.next(1);
		const seen: number[] = [];
		subject.subscribe({ next: (v) => seen.push(v) });
		subject.next(2);
		expect(seen).toEqual([1, 2]);
	});

	it("getValue returns the latest value", () => {
		const subject = new BehaviorSubject<string>("a");
		subject.next("b");
		expect(subject.getValue()).toBe("b");
	});
});
