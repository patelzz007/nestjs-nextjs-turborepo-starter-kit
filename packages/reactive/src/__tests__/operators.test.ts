import { describe, expect, it, vi } from "vitest";

import {
	BehaviorSubject,
	Observable,
	Subject,
	debounceTime,
	distinctUntilChanged,
	filter,
	from,
	fromEvent,
	fromFetch,
	fromPromise,
	interval,
	map,
	merge,
	of,
	shareReplay,
	startWith,
	switchMap,
	take,
	takeUntil,
	takeWhile,
	throttleTime,
	timer,
} from "../index";
import { cold, hot, TestScheduler, toMarble } from "../testing/index";

const scheduler = (): TestScheduler => new TestScheduler();

describe("map", () => {
	it("transforms every value", () => {
		const s = scheduler();
		const output = cold("a-b-c|", s).pipe(map((v) => v.toUpperCase()));
		expect(toMarble(output, s)).toBe("A-B-C|");
	});
});

describe("filter", () => {
	it("keeps only matching values", () => {
		const s = scheduler();
		const output = cold("a-b-c-d|", s).pipe(filter((v) => v === "a" || v === "c"));
		expect(toMarble(output, s)).toBe("a---c--|");
	});

	it("passes the source index (increments per source emission, not per pass)", () => {
		const s = scheduler();
		const output = cold("a-b-c-d|", s).pipe(filter((_, index) => index % 2 === 0));
		// a@0 emitted, b@1 skipped, c@4 emitted, d@5 skipped, complete@7.
		expect(toMarble(output, s)).toBe("a---c--|");
	});

	it("narrows a discriminated union with a type-guard predicate", () => {
		type State = { readonly kind: "loading" } | { readonly kind: "ready"; readonly payload: string };
		const states: State[] = [{ kind: "loading" }, { kind: "ready", payload: "x" }];
		const seen: string[] = [];
		from(states)
			.pipe(
				filter((state): state is State & { readonly kind: "ready" } => state.kind === "ready"),
				map((state) => state.payload),
			)
			.subscribe({ next: (v) => seen.push(v) });
		expect(seen).toEqual(["x"]);
	});
});

describe("switchMap", () => {
	it("cancels the previous inner on each outer value", () => {
		const s = scheduler();
		const outer = cold("a-b-|", { a: "a", b: "b" }, s);
		const inner = (v: string): Observable<string> => cold(`-${v.toUpperCase()}-|`, s);
		const output = outer.pipe(switchMap(inner));
		expect(toMarble(output, s)).toBe("-A-B-|");
	});

	it("waits for the active inner to finish before completing after outer complete", () => {
		const s = scheduler();
		const outer = cold("a|", { a: "a" }, s);
		const output = outer.pipe(switchMap(() => cold("--x|", { x: "X" }, s)));
		expect(toMarble(output, s)).toBe("--X|");
	});

	it("tears down the active inner on unsubscribe", () => {
		const teardown = vi.fn();
		const inner = new Observable<string>(() => teardown);
		const source = of("x").pipe(switchMap(() => inner));
		const sub = source.subscribe();
		sub.unsubscribe();
		expect(teardown).toHaveBeenCalledTimes(1);
	});
});

describe("take", () => {
	it("emits exactly n values then completes on the same frame as the nth value", () => {
		const s = scheduler();
		const output = cold("a-b-c-d|", s).pipe(take(2));
		expect(toMarble(output, s)).toBe("a-(b|)");
	});

	it("completes immediately for count <= 0", () => {
		const s = scheduler();
		const output = cold("a-b|", s).pipe(take(0));
		expect(toMarble(output, s)).toBe("|");
	});

	it("works with a synchronously-emitting source (regression: no TDZ crash)", () => {
		const seen: number[] = [];
		let completed = false;
		of(1, 2, 3)
			.pipe(take(2))
			.subscribe({ next: (v) => seen.push(v), complete: () => (completed = true) });
		expect(seen).toEqual([1, 2]);
		expect(completed).toBe(true);
	});

	it("works with a BehaviorSubject source that replays synchronously", () => {
		const subject = new BehaviorSubject<number>(0);
		const seen: number[] = [];
		const sub = subject.pipe(take(1)).subscribe({ next: (v) => seen.push(v) });
		expect(seen).toEqual([0]);
		expect(sub.isClosed).toBe(true);
	});
});

describe("takeWhile", () => {
	it("completes at the first failing value", () => {
		const s = scheduler();
		const output = cold("a-b-c-d|", s).pipe(takeWhile((v) => v !== "c"));
		expect(toMarble(output, s)).toBe("a-b-|");
	});

	it("emits the failing value when inclusive", () => {
		const s = scheduler();
		const output = cold("a-b-c-d|", s).pipe(takeWhile((v) => v !== "c", true));
		expect(toMarble(output, s)).toBe("a-b-(c|)");
	});

	it("works with a synchronously-emitting source (regression: no TDZ crash)", () => {
		const seen: number[] = [];
		let completed = false;
		of(1, 2, 3)
			.pipe(takeWhile((v) => v < 3))
			.subscribe({
				next: (v) => seen.push(v),
				complete: () => (completed = true),
			});
		expect(seen).toEqual([1, 2]);
		expect(completed).toBe(true);
	});
});

describe("takeUntil", () => {
	it("completes when the notifier fires", () => {
		const s = scheduler();
		const source = cold("a-b-c-d|", s);
		const notifier = cold("---x", { x: true }, s);
		const output = source.pipe(takeUntil(notifier));
		expect(toMarble(output, s)).toBe("a-b|");
	});

	it("works with a hot notifier (Subject)", () => {
		const s = scheduler();
		const source = cold("a-b-c-d|", s);
		const notifier = hot("---x", { x: true }, s);
		const output = source.pipe(takeUntil(notifier));
		expect(toMarble(output, s)).toBe("a-b|");
	});

	it("stops the source when the notifier fires and tears down both", () => {
		const sourceTeardown = vi.fn();
		const source = new Observable<string>(() => sourceTeardown);
		const notifier = new Subject<boolean>();
		const output = source.pipe(takeUntil(notifier));
		const sub = output.subscribe();
		notifier.next(true);
		sub.unsubscribe();
		expect(sourceTeardown).toHaveBeenCalledTimes(1);
	});

	it("unsubscribes the notifier when the source completes synchronously (regression: no leak)", () => {
		const notifierTeardown = vi.fn();
		const notifier = new Observable<boolean>(() => notifierTeardown);
		const seen: number[] = [];
		let completed = false;
		of(1, 2, 3)
			.pipe(takeUntil(notifier))
			.subscribe({ next: (v) => seen.push(v), complete: () => (completed = true) });
		expect(seen).toEqual([1, 2, 3]);
		expect(completed).toBe(true);
		// The notifier subscription was created after the source already completed
		// — it must be closed immediately, never left dangling.
		expect(notifierTeardown).toHaveBeenCalledTimes(1);
	});
});

describe("debounceTime", () => {
	it("emits the latest value after silence", () => {
		const s = scheduler();
		const input = cold("--a--b--c|", s);
		const output = input.pipe(debounceTime(2, s));
		expect(toMarble(output, s)).toBe("----a--b-|");
	});

	it("drops the pending value when the source completes (rxjs-faithful)", () => {
		const s = scheduler();
		const output = of("x").pipe(debounceTime(2, s));
		expect(toMarble(output, s)).toBe("|");
	});

	it("cancels the pending timer on unsubscribe", () => {
		const s = scheduler();
		const input = cold("a", s);
		const output = input.pipe(debounceTime(5, s));
		const seen: string[] = [];
		const sub = output.subscribe({ next: (v) => seen.push(v) });
		s.advanceTo(2);
		sub.unsubscribe();
		s.flush();
		expect(seen).toEqual([]);
	});
});

describe("throttleTime", () => {
	it("emits at most one value per window (leading edge)", () => {
		const s = scheduler();
		const input = cold("a-b-c-d-e-|", s);
		const output = input.pipe(throttleTime(2, s));
		expect(toMarble(output, s)).toBe("a---c---e-|");
	});
});

describe("startWith", () => {
	it("prepends values synchronously on subscribe", () => {
		const s = scheduler();
		const output = cold("-a-b|", s).pipe(startWith("x"));
		// The prepend lands on the same (frame 0) as the source's first frame.
		expect(toMarble(output, s)).toBe("xa-b|");
	});

	it("prepends multiple values in order", () => {
		const s = scheduler();
		const output = cold("-a|", s).pipe(startWith("x", "y"));
		expect(toMarble(output, s)).toBe("(xy)a|");
	});

	it("does not complete the source", () => {
		const seen: string[] = [];
		let completed = false;
		of("a", "b")
			.pipe(startWith("x"))
			.subscribe({
				next: (v) => seen.push(v),
				complete: () => (completed = true),
			});
		expect(seen).toEqual(["x", "a", "b"]);
		expect(completed).toBe(true);
	});
});

describe("distinctUntilChanged", () => {
	it("suppresses consecutive duplicates", () => {
		const seen: string[] = [];
		of("a", "a", "b", "b", "a")
			.pipe(distinctUntilChanged())
			.subscribe({ next: (v) => seen.push(v) });
		expect(seen).toEqual(["a", "b", "a"]);
	});

	it("updates the comparison baseline even for suppressed values (rxjs-faithful)", () => {
		const seen: string[] = [];
		of("a", "b", "b", "c")
			.pipe(distinctUntilChanged())
			.subscribe({ next: (v) => seen.push(v) });
		// The second `b` is suppressed but still becomes the baseline; `c` differs → emit.
		expect(seen).toEqual(["a", "b", "c"]);
	});

	it("uses a custom comparator", () => {
		const seen: string[] = [];
		of("a", "b", "c")
			.pipe(distinctUntilChanged((previous, current) => previous === current || current === "c"))
			.subscribe({ next: (v) => seen.push(v) });
		expect(seen).toEqual(["a", "b"]);
	});
});

describe("shareReplay", () => {
	it("multicasts ONE source to many subscribers and replays the last value to late ones", () => {
		const s = scheduler();
		const shared = cold("a-b|", s).pipe(shareReplay(1));
		const seen1: string[] = [];
		const seen2: string[] = [];

		const sub1 = shared.subscribe({ next: (v) => seen1.push(v) });
		s.advanceBy(1); // frame 0: `a` delivered to sub1 and buffered
		const sub2 = shared.subscribe({ next: (v) => seen2.push(v) }); // late subscriber
		expect(seen2).toEqual(["a"]); // replay of the buffered value, no re-run of the source

		s.advanceBy(2); // `b` then complete
		expect(seen1).toEqual(["a", "b"]);
		expect(seen2).toEqual(["a", "b"]);
		sub1.unsubscribe();
		sub2.unsubscribe();
	});

	it("refCounts: tears the source down only when the LAST subscriber leaves", () => {
		const teardown = vi.fn();
		const source = new Observable<string>(() => teardown);
		const shared = source.pipe(shareReplay(1));

		const sub1 = shared.subscribe();
		const sub2 = shared.subscribe();
		expect(teardown).not.toHaveBeenCalled();

		sub1.unsubscribe();
		expect(teardown).not.toHaveBeenCalled(); // sub2 still attached
		sub2.unsubscribe();
		expect(teardown).toHaveBeenCalledTimes(1); // last one out closes the source
	});
});

describe("merge", () => {
	it("interleaves values from all sources by arrival", () => {
		const s = scheduler();
		const a = cold("-a--b|", s);
		const b = cold("--c-d|", s);
		const output = merge(a, b);
		// a@1, c@2, then b and d both at frame 4 → grouped.
		expect(toMarble(output, s)).toBe("-ac-(bd)|");
	});

	it("completes only when ALL sources complete", () => {
		const s = scheduler();
		const a = cold("a-|", s);
		const b = cold("-b---", s); // never completes
		const output = merge(a, b);
		const seen: string[] = [];
		const sub = output.subscribe({ next: (v) => seen.push(v) });
		s.advanceBy(5);
		sub.unsubscribe();
		expect(seen).toEqual(["a", "b"]);
	});

	it("propagates errors immediately and tears down every source", () => {
		const s = scheduler();
		const aTeardown = vi.fn();
		const a = new Observable<string>(() => aTeardown);
		const b = hot("--#", {}, s);
		const output = merge(a, b);
		const onError = vi.fn();
		const sub = output.subscribe({ next: () => undefined, error: onError });
		s.advanceBy(3);
		sub.unsubscribe();
		expect(onError).toHaveBeenCalledTimes(1);
		expect(aTeardown).toHaveBeenCalledTimes(1);
	});
});

describe("creation", () => {
	it("of emits synchronously then completes", () => {
		const seen: number[] = [];
		let completed = false;
		of(1, 2, 3).subscribe({ next: (v) => seen.push(v), complete: () => (completed = true) });
		expect(seen).toEqual([1, 2, 3]);
		expect(completed).toBe(true);
	});

	it("from unwraps an array", () => {
		const seen: number[] = [];
		from([1, 2, 3]).subscribe({ next: (v) => seen.push(v) });
		expect(seen).toEqual([1, 2, 3]);
	});

	it("from unwraps a promise", async () => {
		const seen: number[] = [];
		from(Promise.resolve(42)).subscribe({ next: (v) => seen.push(v) });
		await vi.waitFor(() => {
			expect(seen).toEqual([42]);
		});
	});

	it("fromPromise emits the resolved value then completes", async () => {
		const seen: number[] = [];
		const events: string[] = [];
		fromPromise(Promise.resolve(7)).subscribe({
			next: (v) => seen.push(v),
			complete: () => events.push("complete"),
		});
		await vi.waitFor(() => {
			expect(seen).toEqual([7]);
		});
		expect(events).toEqual(["complete"]);
	});

	it("fromPromise routes rejections to error", async () => {
		const boom = new Error("boom");
		const onError = vi.fn();
		fromPromise(Promise.reject(boom)).subscribe({ next: () => undefined, error: onError });
		await vi.waitFor(() => {
			expect(onError).toHaveBeenCalledWith(boom);
		});
	});

	it("fromPromise drops the value when unsubscribed before resolution", async () => {
		const seen: number[] = [];
		let resolve!: (v: number) => void;
		const sub = fromPromise(new Promise<number>((r) => (resolve = r))).subscribe({ next: (v) => seen.push(v) });
		sub.unsubscribe();
		resolve(1);
		await vi.waitFor(() => Promise.resolve());
		expect(seen).toEqual([]);
	});

	it("fromFetch aborts the request on unsubscribe", () => {
		let capturedSignal: AbortSignal | undefined;
		const fetchSpy = vi.fn((_url: string, init: RequestInit | undefined) => {
			capturedSignal = init?.signal ?? undefined;
			return new Promise<Response>(() => undefined);
		});
		vi.stubGlobal("fetch", fetchSpy);
		try {
			const sub = fromFetch("http://example.test").subscribe();
			expect(capturedSignal?.aborted).toBe(false);
			sub.unsubscribe();
			expect(capturedSignal?.aborted).toBe(true);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("fromEvent adds and removes its listener", () => {
		const target = new EventTarget();
		const addListener = vi.spyOn(target, "addEventListener");
		const removeListener = vi.spyOn(target, "removeEventListener");
		const sub = fromEvent(target, "click").subscribe();
		expect(addListener).toHaveBeenCalledTimes(1);
		sub.unsubscribe();
		expect(removeListener).toHaveBeenCalledTimes(1);
	});

	it("interval emits 0, 1, 2 … on the virtual scheduler", () => {
		const s = scheduler();
		const seen: number[] = [];
		const sub = interval(1, s)
			.pipe(take(3))
			.subscribe({ next: (v) => seen.push(v) });
		s.advanceBy(5);
		sub.unsubscribe();
		expect(seen).toEqual([0, 1, 2]);
	});

	it("timer emits once after the delay then completes", () => {
		const s = scheduler();
		const seen: number[] = [];
		let completed = false;
		const sub = timer(2, undefined, s).subscribe({ next: (v) => seen.push(v), complete: () => (completed = true) });
		s.advanceBy(5);
		sub.unsubscribe();
		expect(seen).toEqual([0]);
		expect(completed).toBe(true);
	});
});

describe("marble engine self-test", () => {
	it("parses frames, groups, error, and completion", () => {
		// One scheduler per toMarble call — flush() advances a scheduler to its
		// max frame, so a scheduler is single-use per timeline assertion.
		const s1 = scheduler();
		expect(toMarble(cold("--(ab|)", s1), s1)).toBe("--(ab|)");
		const s2 = scheduler();
		expect(toMarble(cold("-a#", s2), s2)).toBe("-a#");
	});

	it("supports values maps in both directions", () => {
		const s = scheduler();
		const input = cold("a-b|", { a: 10, b: 20 }, s);
		expect(toMarble(input, s, { a: 10, b: 20 })).toBe("a-b|");
	});

	it("cold without a scheduler replays synchronously (like of)", () => {
		const seen: string[] = [];
		let completed = false;
		cold("a-b-c|").subscribe({ next: (v) => seen.push(v), complete: () => (completed = true) });
		expect(seen).toEqual(["a", "b", "c"]);
		expect(completed).toBe(true);
	});

	it("flush() throws when actions are left pending past the max frame (the leak check)", () => {
		const s = scheduler();
		s.schedule(() => undefined, 1500); // beyond TEST_MAX_FRAME (1000)
		s.advanceBy(10);
		expect(() => {
			s.flush();
		}).toThrow(/pending/);
	});

	it("test-scheduled actions are cancelable", () => {
		const s = scheduler();
		let ran = false;
		const sub = s.schedule(() => (ran = true), 10);
		sub.unsubscribe();
		s.advanceTo(20);
		expect(ran).toBe(false);
	});
});
