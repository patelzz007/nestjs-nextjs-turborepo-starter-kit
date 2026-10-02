import { Controller, Get, Sse } from "@nestjs/common";
import type { MessageEvent } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from "@nestjs/swagger";
import { interval, map, merge, type Observable } from "rxjs";

import { apiContract, apiPath, EmailLogEntrySchema, nowEpochMs, type EmailLogEntry, type EmailLogListQuery, type PaginatedServiceResult } from "@workspace/shared";

import { ZodListQuery } from "../../../common/decorators/zod-request.decorators";
import { ZodPaginatedResponse } from "../../../common/decorators/zod-response.decorators";
import { AdminAccessOnly } from "../../auth/decorators/admin-access.decorator";
import { RequirePermission } from "../../auth/decorators/require-permission.decorator";

import { EmailLogEventsService } from "./email-log-events.service";
import { EmailLogService } from "./email-log.service";

/**
 * Admin-only audit surface for outbound email. Lists the most recent
 * `email_logs` rows (newest first) with their lifecycle status — `sent` until
 * the Resend webhook flips them to `delivered` / `bounced` / `complained` /
 * `failed`. Guarded by the global auth guard (admin access required), so the
 * panel is the only consumer.
 *
 * `GET /notifications/email-log/events` is a Server-Sent Events stream: every
 * time a row is written the service pushes a frame, and the admin panel
 * refetches its list — so status changes (delivered → opened → clicked) show
 * up the instant they land, no polling and no manual refresh.
 */
@ApiTags("Email Log")
@AdminAccessOnly("Admin access required to view email logs.")
@Controller(apiPath("/notifications/email-log"))
export class EmailLogController {
	constructor(
		private readonly emailLogService: EmailLogService,
		private readonly emailLogEvents: EmailLogEventsService,
	) {}

	/**
	 * Paginated email-log rows (newest first by default) — sort, filter and
	 * search follow the shared list grammar (docs/list-queries.md).
	 */
	@RequirePermission("LIST", "EMAIL")
	@Get()
	@ApiOperation({ summary: "List sent emails" })
	@ZodPaginatedResponse(EmailLogEntrySchema, { description: "Paginated EmailLog rows; pagination is in `meta`" })
	public async list(@ZodListQuery(apiContract.email.logList.input) query: EmailLogListQuery): Promise<PaginatedServiceResult<EmailLogEntry>> {
		return this.emailLogService.list(query);
	}

	/**
	 * Server-Sent Events stream of EmailLog update signals.
	 *
	 * One frame (`{ updatedAt }`) is pushed per write — a new send, a delivery
	 * webhook, or an opened/clicked engagement event. The payload is just a
	 * "something changed" signal; the admin client refetches the list so the
	 * authoritative rows always come from the same schema-validated path.
	 *
	 * Protected by the global auth guard like the rest of the controller. The
	 * browser opens it with `withCredentials: true` so the session cookies are
	 * sent (EventSource cannot set Authorization headers — cookies are the
	 * only supported auth transport for SSE).
	 */
	@RequirePermission("LIST", "EMAIL")
	@Sse("events")
	@ApiOperation({ summary: "Live EmailLog update stream (SSE)" })
	@ApiProduces("text/event-stream")
	@ApiOkResponse({ description: "text/event-stream; one `{ updatedAt }` frame per EmailLog write (pass-through: no envelope, no response contract)" })
	public stream(): Observable<MessageEvent> {
		return merge(
			this.emailLogEvents.observeUpdates().pipe(map((): MessageEvent => ({ data: { updatedAt: nowEpochMs() } }))),
			interval(25_000).pipe(map((): MessageEvent => ({ type: "ping", data: "" }))),
		);
	}
}
