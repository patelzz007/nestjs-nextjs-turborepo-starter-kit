import { Injectable } from "@nestjs/common";
import { EventEmitter } from "node:events";
import { Observable } from "rxjs";

import { type EmailLogUpdatedEvent } from "@workspace/shared";

/** Event name used on the internal emitter for every EmailLog write. */
export const EMAIL_LOG_UPDATED_EVENT = "email-log.updated";

/**
 * In-process pub/sub bridge between EmailLog writes and every observer: the
 * SSE stream the admin panel subscribes to (a "something changed" signal per
 * write).
 */
@Injectable()
export class EmailLogEventsService {
	private readonly emitter: EventEmitter = new EventEmitter();

	/**
	 * Fire a single "something changed" signal to every subscriber. Pass the
	 * attempt payload when a row was created; omit it for status flips.
	 */
	public emitUpdated(event?: EmailLogUpdatedEvent): void {
		this.emitter.emit(EMAIL_LOG_UPDATED_EVENT, event);
	}

	/**
	 * Cold Observable of update signals (`null` when the write was a status
	 * flip without an attempt payload). Subscribing attaches a listener,
	 * unsubscribing removes it — so a client that navigates away can never
	 * leak a listener on the shared emitter.
	 */
	public observeUpdates(): Observable<EmailLogUpdatedEvent | null> {
		return new Observable<EmailLogUpdatedEvent | null>((subscriber) => {
			const handler = (event: EmailLogUpdatedEvent | undefined): void => {
				subscriber.next(event ?? null);
			};
			this.emitter.on(EMAIL_LOG_UPDATED_EVENT, handler);
			return (): void => {
				this.emitter.off(EMAIL_LOG_UPDATED_EVENT, handler);
			};
		});
	}
}
