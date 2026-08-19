import { Injectable } from "@nestjs/common";
import { EventEmitter } from "node:events";
import { Observable } from "rxjs";

import { type ImpersonationActionEvent } from "@workspace/shared";

/** Event name used on the internal emitter for every impersonation action. */
export const IMPERSONATION_ACTION_EVENT = "impersonation.action";

/**
 * In-process pub/sub bridge between the impersonation flows and every observer
 * (today: Telescope's impersonation-job adapter). Same shape as
 * `EmailLogEventsService` / `AuthEventsService`.
 */
@Injectable()
export class ImpersonationEventsService {
	private readonly emitter: EventEmitter = new EventEmitter();

	/** Fire a single completed-action signal to every subscriber. */
	public emitAction(event: ImpersonationActionEvent): void {
		this.emitter.emit(IMPERSONATION_ACTION_EVENT, event);
	}

	/** Cold Observable of completed-action events. */
	public observeActions(): Observable<ImpersonationActionEvent> {
		return new Observable<ImpersonationActionEvent>((subscriber) => {
			const handler = (event: ImpersonationActionEvent): void => {
				subscriber.next(event);
			};
			this.emitter.on(IMPERSONATION_ACTION_EVENT, handler);
			return (): void => {
				this.emitter.off(IMPERSONATION_ACTION_EVENT, handler);
			};
		});
	}
}
