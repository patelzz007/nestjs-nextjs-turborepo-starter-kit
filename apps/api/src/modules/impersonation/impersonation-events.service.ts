import { Injectable } from "@nestjs/common";
import { EventEmitter } from "node:events";
import { Observable } from "rxjs";
import { z } from "zod";

/** Event name used on the internal emitter for every impersonation action. */
export const IMPERSONATION_ACTION_EVENT = "impersonation.action";

/**
 * Typed payload for a completed impersonation action (start / stop).
 * `superAdminId` is the impersonator, `targetUserId` the impersonated user.
 * No telescope types live here — the telescope side subscribes and records
 * each action as a job.
 */
export const ImpersonationActionEventSchema = z
	.object({
		action: z.enum(["start", "stop"]),
		superAdminId: z.string(),
		targetUserId: z.string(),
		status: z.enum(["succeeded", "failed"]),
		error: z.string().nullable(),
		/** Wall-clock duration of the whole action in ms. */
		durationMs: z.number().int().nonnegative(),
	})
	.strict();

export type ImpersonationActionEvent = z.output<typeof ImpersonationActionEventSchema>;

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
