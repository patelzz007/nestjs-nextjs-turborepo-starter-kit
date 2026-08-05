import { type Operator } from "./pipe";
import { normalizePartial, Subscriber, type Observer, type PartialObserver, type Teardown } from "./subscription";
import { Subscription } from "./subscription";

/**
 * `Observable<T>` — the cold, lazy source (design item 1).
 *
 * The constructor takes a subscriber function that runs once per subscription.
 * Every `subscribe()` returns a `Subscription` — there is no fire-and-forget path.
 */
export class Observable<T> {
	public constructor(private readonly _subscribeFn: (observer: Observer<T>) => Teardown | undefined) {}

	public subscribe(observerOrNext?: PartialObserver<T> | ((value: T) => void), error?: (err: Error) => void, complete?: () => void): Subscription {
		const partial: PartialObserver<T> = observerOrNext === undefined ? {} : normalizePartial(observerOrNext, error, complete);
		const subscriber = new Subscriber<T>(partial);
		try {
			const teardown = this._subscribeFn(subscriber);
			if (teardown !== undefined) {
				subscriber.add(teardown);
			}
		} catch (err) {
			subscriber.error(err instanceof Error ? err : new Error(String(err)));
		}
		return subscriber;
	}

	/**
	 * Compose operators (design item 10). Arity-typed up to 6 — keep pipelines
	 * ≤ 5–6 operators and extract named observables beyond that (pitfall 7).
	 */
	public pipe<A>(op1: Operator<T, A>): Observable<A>;
	public pipe<A, B>(op1: Operator<T, A>, op2: Operator<A, B>): Observable<B>;
	public pipe<A, B, C>(op1: Operator<T, A>, op2: Operator<A, B>, op3: Operator<B, C>): Observable<C>;
	public pipe<A, B, C, D>(op1: Operator<T, A>, op2: Operator<A, B>, op3: Operator<B, C>, op4: Operator<C, D>): Observable<D>;
	public pipe<A, B, C, D, E>(op1: Operator<T, A>, op2: Operator<A, B>, op3: Operator<B, C>, op4: Operator<C, D>, op5: Operator<D, E>): Observable<E>;
	public pipe<A, B, C, D, E, F>(op1: Operator<T, A>, op2: Operator<A, B>, op3: Operator<B, C>, op4: Operator<C, D>, op5: Operator<D, E>, op6: Operator<E, F>): Observable<F>;
	public pipe<A, B, C, D, E, F>(
		op1: Operator<T, A>,
		op2?: Operator<A, B>,
		op3?: Operator<B, C>,
		op4?: Operator<C, D>,
		op5?: Operator<D, E>,
		op6?: Operator<E, F>,
	): Observable<A | B | C | D | E | F> {
		if (op2 === undefined) {
			return op1(this);
		}
		if (op3 === undefined) {
			return op2(op1(this));
		}
		if (op4 === undefined) {
			return op3(op2(op1(this)));
		}
		if (op5 === undefined) {
			return op4(op3(op2(op1(this))));
		}
		if (op6 === undefined) {
			return op5(op4(op3(op2(op1(this)))));
		}
		return op6(op5(op4(op3(op2(op1(this))))));
	}
}
