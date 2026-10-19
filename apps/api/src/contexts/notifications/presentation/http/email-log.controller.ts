import { Controller, Get, Inject, Sse } from "@nestjs/common";
import type { MessageEvent } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { interval, map, merge, type Observable } from "rxjs";

import { apiContract, apiPath, EmailLogEntrySchema, nowEpochMs, type EmailLogEntry, type EmailLogListQuery, type PaginatedServiceResult } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { AdminAccessOnly } from "../../../../platform/presentation/http/security/decorators/admin-access.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { ApiEventStreamResponse } from "../../../../platform/presentation/http/validation/decorators/api-event-stream.decorator";
import { ZodListQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import type { EmailLogSignalPort } from "../../application/ports/email-log-signal.port";
import { EMAIL_LOG_SIGNAL } from "../../application/ports/notifications.tokens";
import { ListEmailLogQuery } from "../../application/queries/list-email-log/list-email-log.query";

/** Keep-alive ping interval of the SSE stream, below common proxy idle timeouts (30 s+). */
const SSE_KEEP_ALIVE_INTERVAL_MS = 25_000;

/**
 * Admin-only audit surface for outbound email. Lists the most recent
 * `EmailLog` rows (newest first) with their lifecycle status — `sent` until
 * the Resend webhook flips them to `delivered` / `bounced` / `complained` /
 * `failed`. Guarded by the global auth guard (admin access required), so the
 * panel is the only consumer.
 *
 * `GET /notifications/email-log/events` is a Server-Sent Events stream: every
 * committed row write pushes a frame, and the admin panel refetches its list —
 * so status changes show up the instant they land, no polling and no manual refresh.
 */
/** The one QueryBus capability the controller uses (the bus satisfies it). */
export interface EmailLogListDispatch {
	execute(query: ListEmailLogQuery): Promise<PaginatedServiceResult<EmailLogEntry>>;
}

@ApiTags("Email Log")
@AdminAccessOnly("Admin access required to view email logs.")
@Controller(apiPath("/notifications/email-log"))
export class EmailLogController {
	public constructor(
		@Inject(QueryBus) private readonly queryBus: EmailLogListDispatch,
		@Inject(EMAIL_LOG_SIGNAL) private readonly emailLogSignal: EmailLogSignalPort,
	) {}

	/**
	 * Paginated email-log rows (newest first by default) — sort, filter and
	 * search follow the shared list grammar (docs/technical/api/list-queries.md).
	 */
	@RequirePermission("LIST", "EMAIL")
	@Get()
	@ApiOperation({ summary: "List sent emails" })
	@ZodPaginatedResponse(EmailLogEntrySchema, { description: "Paginated EmailLog rows; pagination is in `meta`" })
	public async list(
		@CurrentActor() actor: ActorContext,
		@ZodListQuery(apiContract.email.logList.input) query: EmailLogListQuery,
	): Promise<PaginatedServiceResult<EmailLogEntry>> {
		return this.queryBus.execute(new ListEmailLogQuery(actor, query));
	}

	/**
	 * Server-Sent Events stream of EmailLog update signals.
	 *
	 * One frame (`{ updatedAt }`) is pushed per committed write — a new send, an
	 * outcome, or a delivery webhook. The payload is just a "something changed"
	 * signal; the admin client refetches the list so the authoritative rows
	 * always come from the same schema-validated path.
	 *
	 * Protected by the global auth guard like the rest of the controller. The
	 * browser opens it with `withCredentials: true` so the session cookies are
	 * sent (EventSource cannot set Authorization headers — cookies are the
	 * only supported auth transport for SSE).
	 */
	@RequirePermission("LIST", "EMAIL")
	@Sse("events")
	@ApiOperation({ summary: "Live EmailLog update stream (SSE)" })
	@ApiEventStreamResponse("One `{ updatedAt }` frame per EmailLog write (pass-through: no envelope, no response contract)")
	public stream(): Observable<MessageEvent> {
		return merge(
			this.emailLogSignal.observeUpdates().pipe(map((): MessageEvent => ({ data: { updatedAt: nowEpochMs() } }))),
			interval(SSE_KEEP_ALIVE_INTERVAL_MS).pipe(map((): MessageEvent => ({ type: "ping", data: "" }))),
		);
	}
}
