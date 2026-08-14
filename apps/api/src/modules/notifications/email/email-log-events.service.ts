import { Injectable } from "@nestjs/common";
import { EventEmitter } from "node:events";
import { Observable } from "rxjs";
import { z } from "zod";

import { EmailLogStatusSchema } from "@workspace/shared";

/** Event name used on the internal emitter for every EmailLog write. */
export const EMAIL_LOG_UPDATED_EVENT = "email-log.updated";

/**
 * Payload attached to writes that CREATE an EmailLog row (a send attempt).
 * Webhook-driven status flips (`delivered`, `bounced`, …) emit a bare signal
 * without this payload — the fields describe the attempt itself, which is the
 * only thing the creation site knows about.
 */
export const EmailLogUpdatedEventSchema = z
	.object({
		templateKey: z.string(),
		status: EmailLogStatusSchema,
		to: z.string(),
		resendId: z.string().nullable(),
		error: z.string().nullable(),
		/** Send duration in ms (null for noop/log-only modes that never hit the network). */
		durationMs: z.number().int().nonnegative().nullable(),
	})
	.strict();

export type EmailLogUpdatedEvent = z.output<typeof EmailLogUpdatedEventSchema>;

/**
 * In-process pub/sub bridge between EmailLog writes and every observer: the
 * SSE stream the admin panel subscribes to (a "something changed" signal per
 * write) and Telescope's email-job adapter (which records real send attempts
 * as jobs automatically — see `TelescopeEmailJobAdapter`).
 *
 * Every time a row is written (a send is logged, a webhook flips a status)
 * the writer calls {@link emitUpdated} — with the full attempt payload when a
 * row is created, with no payload for webhook flips. The `@Sse()` endpoint
 * subscribes via {@link observeUpdates} and pushes one frame per signal; the
 * admin client invalidates its log-list query on each frame, so the page
 * updates the instant the DB row changes — no polling, no refresh.
 *
 * Deliberately tiny: a `node:events` EventEmitter (zero dependencies) with
 * per-process semantics. That is the correct model here — SSE and the
 * telescope adapter are in-process observers, and a single NestJS instance
 * owns all writes.
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
