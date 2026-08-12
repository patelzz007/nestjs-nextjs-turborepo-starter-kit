import { Injectable } from "@nestjs/common";
import { EventEmitter } from "node:events";
import { Observable } from "rxjs";

/** Event name used on the internal emitter for every EmailLog write. */
export const EMAIL_LOG_UPDATED_EVENT = "email-log.updated";

/**
 * In-process pub/sub bridge between EmailLog writes and the SSE stream the
 * admin panel subscribes to.
 *
 * Every time a row is written (a send is logged, a webhook flips a status, an
 * open/click is recorded) the writer calls {@link emitUpdated}. The
 * `@Sse()` endpoint subscribes via {@link observeUpdates} and pushes one frame
 * per signal; the admin client invalidates its log-list query on each frame,
 * so the page updates the instant the DB row changes — no polling, no refresh.
 *
 * Deliberately tiny: a `node:events` EventEmitter (zero dependencies) with
 * per-process semantics. That is the correct model here — SSE is an
 * in-process browser connection, and a single NestJS instance owns all writes.
 */
@Injectable()
export class EmailLogEventsService {
	private readonly emitter: EventEmitter = new EventEmitter();

	/** Fire a single "something changed" signal to every subscriber. */
	public emitUpdated(): void {
		this.emitter.emit(EMAIL_LOG_UPDATED_EVENT);
	}

	/**
	 * Cold Observable of update signals. Subscribing attaches a listener,
	 * unsubscribing removes it — so a client that navigates away can never
	 * leak a listener on the shared emitter.
	 */
	public observeUpdates(): Observable<void> {
		return new Observable<void>((subscriber) => {
			const handler = (): void => {
				subscriber.next();
			};
			this.emitter.on(EMAIL_LOG_UPDATED_EVENT, handler);
			return (): void => {
				this.emitter.off(EMAIL_LOG_UPDATED_EVENT, handler);
			};
		});
	}
}
