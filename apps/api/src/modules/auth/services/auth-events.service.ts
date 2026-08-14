import { Injectable } from "@nestjs/common";
import { EventEmitter } from "node:events";
import { Observable } from "rxjs";
import { z } from "zod";

/** Event name used on the internal emitter for every auth flow completion. */
export const AUTH_FLOW_EVENT = "auth.flow";

/**
 * Typed payload for a finished credential/identity flow (signup, login,
 * password reset, email verification). The flow is identified by `flow`, and
 * the outcome by `status` — failed attempts carry the short machine `error`
 * code (e.g. `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED`) so Telescope can render
 * a failed job with a reason.
 *
 * No telescope types live here: this is a plain domain event. The telescope
 * side (TelescopeAuthJobAdapter) subscribes and records each flow as a job.
 */
export const AuthFlowEventSchema = z
	.object({
		flow: z.enum(["signup", "login", "forgot-password", "reset-password", "verify-email"]),
		/** The user the flow acted on — null when the flow could not identify one. */
		userId: z.string().nullable(),
		/** Login origin ("web" | "admin") — null for flows without a client type. */
		clientType: z.string().nullable(),
		status: z.enum(["succeeded", "failed"]),
		error: z.string().nullable(),
		/** Wall-clock duration of the whole flow in ms. */
		durationMs: z.number().int().nonnegative(),
	})
	.strict();

export type AuthFlowEvent = z.output<typeof AuthFlowEventSchema>;

/**
 * In-process pub/sub bridge between the auth flows and every observer (today:
 * Telescope's auth-job adapter). Mirrors `EmailLogEventsService` — a tiny
 * `node:events` EventEmitter with per-process semantics and an rxjs
 * `Observable` surface so subscribers can never leak a listener.
 *
 * The auth services call {@link emitFlow} once per completed flow; observers
 * (the telescope adapter) subscribe via {@link observeFlows}.
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
