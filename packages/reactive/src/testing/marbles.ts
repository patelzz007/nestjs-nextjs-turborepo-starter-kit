import { Observable } from "../observable";
import { Subject } from "../subject";
import { Subscription } from "../subscription";
import { TestScheduler } from "./test-scheduler";

/** A parsed marble timeline: events keyed by virtual frame. */
type ParsedEvent = { readonly kind: "next"; readonly token: string } | { readonly kind: "error" } | { readonly kind: "complete" };

interface ParsedMarble {
	readonly events: ReadonlyMap<number, readonly ParsedEvent[]>;
	readonly subscriptionFrame: number | null;
}

function pushEvent(events: Map<number, ParsedEvent[]>, frame: number, event: ParsedEvent): void {
	const existing = events.get(frame);
	if (existing === undefined) {
		events.set(frame, [event]);
	} else {
		existing.push(event);
	}
}

/**
 * Parse a marble string into frame-keyed events.
 * 1 frame = 1 virtual ms; `-` advances one frame, `(…)` groups same-frame events,
 * `|` completes, `#` errors, `^` marks a subscription point (hot sources).
 */
export function parseMarble(marbles: string): ParsedMarble {
	const events = new Map<number, ParsedEvent[]>();
	let frame = 0;
	let inGroup = false;
	let groupEvents: ParsedEvent[] = [];
	let subscriptionFrame: number | null = null;

	const push = (event: ParsedEvent): void => {
		if (inGroup) {
			groupEvents.push(event);
			return;
		}
		pushEvent(events, frame, event);
	};

	for (const char of marbles) {
		if (char === " ") {
			continue;
		}
		if (char === "-") {
			if (!inGroup) {
				frame += 1;
			}
			continue;
		}
		if (char === "(") {
			inGroup = true;
			groupEvents = [];
			continue;
		}
		if (char === ")") {
			inGroup = false;
			for (const event of groupEvents) {
				pushEvent(events, frame, event);
			}
			frame += 1;
			continue;
		}
		if (char === "|") {
			push({ kind: "complete" });
			if (!inGroup) {
				frame += 1;
			}
			continue;
		}
		if (char === "#") {
			push({ kind: "error" });
			if (!inGroup) {
				frame += 1;
			}
			continue;
		}
		if (char === "^") {
			subscriptionFrame = frame;
			continue;
		}
		if (char === "!") {
			continue;
		}
		push({ kind: "next", token: char });
		if (!inGroup) {
			frame += 1;
		}
	}
	return { events, subscriptionFrame };
}

const MARBLE_ERROR = new Error("marble error (#)");

/** A cold observable driven by a marble timeline (per-subscription execution). */
export function cold(marbles: string, scheduler?: TestScheduler): Observable<string>;
export function cold<T>(marbles: string, values: Record<string, T>, scheduler?: TestScheduler): Observable<T>;
export function cold<T>(marbles: string, valuesOrScheduler?: Record<string, T> | TestScheduler, scheduler?: TestScheduler): Observable<T | string> {
	const values = valuesOrScheduler instanceof TestScheduler || valuesOrScheduler === undefined ? undefined : valuesOrScheduler;
	const passedScheduler = valuesOrScheduler instanceof TestScheduler ? valuesOrScheduler : scheduler;
	const sched = passedScheduler ?? new TestScheduler();
	// When no scheduler is passed, the timeline replays synchronously on
	// subscription (the internal scheduler is flushed immediately), so
	// `cold("a-b-c|").subscribe(...)` behaves like `of("a", "b", "c")`.
	const isInternalScheduler = passedScheduler === undefined;
	const parsed = parseMarble(marbles);

	return new Observable<T | string>((observer) => {
		// A cold timeline is RELATIVE to subscription: the scheduler adds its
		// current frame to the delay, so scheduling with the raw `frame` lands
		// the events at `subscription-time + frame` (rxjs semantics).
		const scheduled: Subscription[] = [];
		for (const [frame, frameEvents] of parsed.events) {
			for (const event of frameEvents) {
				scheduled.push(
					sched.schedule(() => {
						if (observer.isClosed) {
							return;
						}
						if (event.kind === "next") {
							observer.next(values?.[event.token] ?? event.token);
						} else if (event.kind === "error") {
							observer.error(MARBLE_ERROR);
						} else {
							observer.complete();
						}
					}, frame),
				);
			}
		}
		if (isInternalScheduler) {
			sched.flush();
		}
		return () => {
			for (const sub of scheduled) {
				sub.unsubscribe();
			}
		};
	});
}

/** A hot Subject driven by a marble timeline (late subscribers miss early frames). */
export function hot(marbles: string, scheduler?: TestScheduler): Subject<string>;
export function hot<T>(marbles: string, values: Record<string, T>, scheduler?: TestScheduler): Subject<T>;
export function hot<T>(marbles: string, valuesOrScheduler?: Record<string, T> | TestScheduler, scheduler?: TestScheduler): Subject<T | string> {
	const values = valuesOrScheduler instanceof TestScheduler || valuesOrScheduler === undefined ? undefined : valuesOrScheduler;
	const passedScheduler = valuesOrScheduler instanceof TestScheduler ? valuesOrScheduler : scheduler;
	const sched = passedScheduler ?? new TestScheduler();
	const isInternalScheduler = passedScheduler === undefined;
	const parsed = parseMarble(marbles);
	const subject = new Subject<T | string>();

	for (const [frame, frameEvents] of parsed.events) {
		for (const event of frameEvents) {
			sched.schedule(() => {
				if (event.kind === "next") {
					subject.next(values?.[event.token] ?? event.token);
				} else if (event.kind === "error") {
					subject.error(MARBLE_ERROR);
				} else {
					subject.complete();
				}
			}, frame);
		}
	}
	// Internal-scheduler mode: events fire immediately (into the void if nobody is
	// subscribed — that IS hot semantics). Tests that care about frames always
	// pass the shared TestScheduler.
	if (isInternalScheduler) {
		sched.flush();
	}
	return subject;
}

interface RecordedEvent {
	readonly frame: number;
	readonly kind: "next" | "error" | "complete";
	readonly token?: string;
}

function formatMarble(recorded: readonly RecordedEvent[]): string {
	if (recorded.length === 0) {
		return "|";
	}
	let maxFrame = 0;
	const byFrame = new Map<number, string[]>();
	for (const event of recorded) {
		maxFrame = Math.max(maxFrame, event.frame);
		const token = event.kind === "next" ? (event.token ?? "x") : event.kind === "error" ? "#" : "|";
		const existing = byFrame.get(event.frame);
		if (existing === undefined) {
			byFrame.set(event.frame, [token]);
		} else {
			existing.push(token);
		}
	}
	let out = "";
	for (let frame = 0; frame <= maxFrame; frame += 1) {
		const tokens = byFrame.get(frame);
		if (tokens === undefined) {
			out += "-";
			continue;
		}
		if (tokens.length === 1) {
			out += tokens[0] ?? "-";
		} else {
			out += `(${tokens.join("")})`;
		}
	}
	return out;
}

/**
 * Subscribe to `source`, run the given scheduler to completion, and return the
 * recorded emissions as a marble string for assertions. Throws if the scheduler
 * still has pending actions (the leak check).
 */
export function toMarble<T>(source: Observable<T>, scheduler: TestScheduler, values?: Record<string, T>): string {
	const reverse = new Map<string, string>();
	if (values !== undefined) {
		for (const [token, value] of Object.entries(values)) {
			reverse.set(String(value), token);
		}
	}
	const recorded: RecordedEvent[] = [];
	const sub = source.subscribe({
		next: (value) => {
			recorded.push({ frame: scheduler.now(), kind: "next", token: reverse.get(String(value)) ?? String(value) });
		},
		error: () => {
			recorded.push({ frame: scheduler.now(), kind: "error" });
		},
		complete: () => {
			recorded.push({ frame: scheduler.now(), kind: "complete" });
		},
	});
	scheduler.flush();
	sub.unsubscribe();
	return formatMarble(recorded);
}
