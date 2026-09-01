import { Injectable } from "@nestjs/common";
import { EventEmitter } from "node:events";
import { Observable } from "rxjs";

import { type SessionActionEvent } from "@workspace/shared";

/** Event name used on the internal emitter for every session action. */
export const SESSION_ACTION_EVENT = "session.action";

/**
 * In-process pub/sub bridge between the session lifecycle and every observer.
 * Same shape as `EmailLogEventsService` / `AuthEventsService`.
 */
@Injectable()
export class SessionsEventsService {
	private readonly emitter: EventEmitter = new EventEmitter();

	/** Fire a single completed-action signal to every subscriber. */
	public emitAction(event: SessionActionEvent): void {
		this.emitter.emit(SESSION_ACTION_EVENT, event);
	}

	/** Cold Observable of completed-action events. */
	public observeActions(): Observable<SessionActionEvent> {
		return new Observable<SessionActionEvent>((subscriber) => {
			const handler = (event: SessionActionEvent): void => {
				subscriber.next(event);
			};
			this.emitter.on(SESSION_ACTION_EVENT, handler);
			return (): void => {
				this.emitter.off(SESSION_ACTION_EVENT, handler);
			};
		});
	}
}
