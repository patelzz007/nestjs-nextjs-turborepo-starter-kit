import { Injectable } from "@nestjs/common";
import { EventEmitter } from "node:events";
import { Observable } from "rxjs";

import { type AuthFlowEvent } from "@workspace/shared";

/** Event name used on the internal emitter for every auth flow completion. */
export const AUTH_FLOW_EVENT = "auth.flow";

/**
 * In-process pub/sub bridge between the auth flows and every observer.
 * Mirrors `EmailLogEventsService` — a tiny `node:events` EventEmitter with
 * per-process semantics and an rxjs `Observable` surface so subscribers can
 * never leak a listener.
 *
 * The auth services call {@link emitFlow} once per completed flow; observers
 * subscribe via {@link observeFlows}.
 */
@Injectable()
export class AuthEventsService {
	private readonly emitter: EventEmitter = new EventEmitter();

	/** Fire a single completed-flow signal to every subscriber. */
	public emitFlow(event: AuthFlowEvent): void {
		this.emitter.emit(AUTH_FLOW_EVENT, event);
	}

	/**
	 * Cold Observable of completed-flow events. Subscribing attaches a
	 * listener, unsubscribing removes it — so an adapter that shuts down can
	 * never leak a listener on the shared emitter.
	 */
	public observeFlows(): Observable<AuthFlowEvent> {
		return new Observable<AuthFlowEvent>((subscriber) => {
			const handler = (event: AuthFlowEvent): void => {
				subscriber.next(event);
			};
			this.emitter.on(AUTH_FLOW_EVENT, handler);
			return (): void => {
				this.emitter.off(AUTH_FLOW_EVENT, handler);
			};
		});
	}
}
