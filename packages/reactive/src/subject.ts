import { Observable } from "./observable";
import { Subscription, normalizePartial, Subscriber, type Observer, type PartialObserver } from "./subscription";

/**
 * `Subject<T>` — a hot, multicast observable that is also an observer (item 5).
 *
 * `next` delivers to every current subscriber; late subscribers miss earlier
 * values. Subscribing returns a Subscription whose teardown removes the
 * subscriber — unsubscribing genuinely stops delivery.
 */
export class Subject<T> extends Observable<T> implements Observer<T> {
	protected readonly subscribers = new Set<Subscriber<T>>();
	protected stopped = false;

	public constructor() {
		super(() => undefined);
	}

	/** True once `complete()`/`error()` has run. */
	public get isStopped(): boolean {
		return this.stopped;
	}

	/** Observer contract — a stopped subject is considered closed. */
	public get isClosed(): boolean {
		return this.stopped;
	}

	public next(value: T): void {
		if (this.stopped) {
			return;
		}
		for (const subscriber of [...this.subscribers]) {
			subscriber.next(value);
		}
	}

	public error(err: Error): void {
		if (this.stopped) {
			return;
		}
		this.stopped = true;
		for (const subscriber of [...this.subscribers]) {
			subscriber.error(err);
		}
		this.subscribers.clear();
	}

	public complete(): void {
		if (this.stopped) {
			return;
		}
		this.stopped = true;
		for (const subscriber of [...this.subscribers]) {
			subscriber.complete();
		}
		this.subscribers.clear();
	}

	public override subscribe(observerOrNext?: PartialObserver<T> | ((value: T) => void), error?: (err: Error) => void, complete?: () => void): Subscription {
		const partial: PartialObserver<T> = observerOrNext === undefined ? {} : normalizePartial(observerOrNext, error, complete);
		const subscriber = new Subscriber<T>(partial);
		if (this.stopped) {
			// Late subscriber to a finished subject: terminate immediately.
			subscriber.complete();
			return subscriber;
		}
		this.subscribers.add(subscriber);
		subscriber.add(() => {
			this.subscribers.delete(subscriber);
		});
		return subscriber;
	}
}

/**
 * `BehaviorSubject<T>` — a Subject that replays its current value to every new
 * subscriber (item 6). The workhorse for app state.
 */
export class BehaviorSubject<T> extends Subject<T> {
	private _currentValue: T;

	public constructor(initialValue: T) {
		super();
		this._currentValue = initialValue;
	}

	/** Synchronous read of the current value (use sparingly — see the design doc). */
	public getValue(): T {
		return this._currentValue;
	}

	public override next(value: T): void {
		this._currentValue = value;
		super.next(value);
	}

	public override subscribe(observerOrNext?: PartialObserver<T> | ((value: T) => void), error?: (err: Error) => void, complete?: () => void): Subscription {
		const partial: PartialObserver<T> = observerOrNext === undefined ? {} : normalizePartial(observerOrNext, error, complete);
		const subscriber = new Subscriber<T>(partial);
		subscriber.next(this._currentValue);
		if (this.stopped) {
			subscriber.complete();
			return subscriber;
		}
		this.subscribers.add(subscriber);
		subscriber.add(() => {
			this.subscribers.delete(subscriber);
		});
		return subscriber;
	}
}
