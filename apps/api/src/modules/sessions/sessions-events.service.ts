import { Injectable } from "@nestjs/common";
import { EventEmitter } from "node:events";
import { Observable } from "rxjs";
import { z } from "zod";

/** Event name used on the internal emitter for every session action. */
export const SESSION_ACTION_EVENT = "session.action";

/**
 * Typed payload for a completed session action (token refresh, device
 * logout, logout-all). `refresh` fires on every token rotation — the
 * telescope adapter throttles those; `logout-*` actions are rare and always
 * recorded.
 *
 * No telescope types live here — this is a plain domain event. The telescope
 * side (TelescopeSessionsJobAdapter) subscribes and records each action as a
 * job.
 */
export const SessionActionEventSchema = z
	.object({
		action: z.enum(["refresh", "logout-device", "logout-all"]),
		userId: z.string(),
		status: z.enum(["succeeded", "failed"]),
		error: z.string().nullable(),
		/** Wall-clock duration of the whole action in ms. */
		durationMs: z.number().int().nonnegative(),
	})
	.strict();

export type SessionActionEvent = z.output<typeof SessionActionEventSchema>;

/**
 * In-process pub/sub bridge between the session lifecycle and every observer
 * (today: Telescope's sessions-job adapter). Same shape as
 * `EmailLogEventsService` / `AuthEventsService`.
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
