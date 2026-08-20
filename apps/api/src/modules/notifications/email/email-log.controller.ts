import { Controller, Get, Query, Sse } from "@nestjs/common";
import type { MessageEvent } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { interval, map, merge, type Observable } from "rxjs";

import { apiContract, EmailLogListResponseSchema, nowEpochMs, type EmailLogEntry, type EmailLogListQuery, apiPath } from "@workspace/shared";

import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { AdminAccessOnly } from "../../auth/decorators/admin-access.decorator";
import { RequirePermission } from "../../auth/decorators/require-permission.decorator";
import { createWrappedDto } from "../../../common/dto/response-wrapper";

import { EmailLogEventsService } from "./email-log-events.service";
import { EmailLogService } from "./email-log.service";

// ── Wrapped Response DTO ──────────────────────────────────────────────────

const WrappedEmailLogList = createWrappedDto(EmailLogListResponseSchema, "WrappedEmailLogList");

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
	 * Recent rows, newest first. `?limit=` clamps the page size (default 100,
	 * max 500) so a rogue value can't 500 the query or dump the whole table.
	 */
	@RequirePermission("LIST", "EMAIL")
	@Get()
	@ApiOperation({ summary: "List recent sent emails" })
	@ApiQuery({ name: "limit", required: false, description: "Max rows to return (default 100, max 500)", example: 50 })
	@ApiOkResponse({ type: WrappedEmailLogList, description: "Most recent EmailLog rows" })
	public async list(@Query(new ZodValidationPipe(apiContract.email.logList.input)) query: EmailLogListQuery): Promise<{ readonly logs: readonly EmailLogEntry[] }> {
		const logs: EmailLogEntry[] = await this.emailLogService.listRecent(query.limit);
		return { logs };
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
	@ApiOkResponse({ description: "text/event-stream; one `{ updatedAt }` frame per EmailLog write" })
	public stream(): Observable<MessageEvent> {
		return merge(
			this.emailLogEvents.observeUpdates().pipe(map((): MessageEvent => ({ data: { updatedAt: nowEpochMs() } }))),
			interval(25_000).pipe(map((): MessageEvent => ({ type: "ping", data: "" }))),
		);
	}
}
