import { Controller, Get, Inject, Sse, type MessageEvent } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { interval, map, merge, throttleTime, type Observable } from "rxjs";

import { apiContract, apiPath, AuditTrailEntrySchema, nowEpochMs, type AuditTrailEntry, type AuditTrailListQuery, type PaginatedServiceResult } from "@workspace/shared";

import { ApiEventStreamResponse } from "../../../../platform/presentation/http/validation/decorators/api-event-stream.decorator";
import { ZodListQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { AdminAccessOnly } from "../../../../platform/presentation/http/security/decorators/admin-access.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { PlatformOperation } from "../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { AUDIT_TRAIL_SIGNALS, type AuditTrailSignalsPort } from "../../application/ports/audit-trail-signals.port";
import { ListAuditTrailQuery } from "../../application/queries/list-audit-trail/list-audit-trail.query";
import { AUDIT_TRAIL_READ_OPERATION } from "../../application/audit-read-operations";

/** At most one signal per this window: a burst of activity is one refetch, not one per request. Leading and trailing, so the first and the last change both land. */
export const AUDIT_TRAIL_SIGNAL_THROTTLE_MS = 2_000;
/** A comment frame this often keeps proxies and load balancers from closing an idle stream. */
export const AUDIT_TRAIL_KEEPALIVE_MS = 25_000;

/**
 * The admin audit log's timeline (ADR 051): every HTTP request — with the rows
 * it changed — and every database write no request made, newest first. The
 * complete records stay at `GET /admin/audit-logs/:id` and
 * `GET /admin/data-changes/:id`.
 *
 * Authorization: admin-panel access AND `LIST AUDIT_LOG`. Every call is itself
 * recorded as a sensitive read. The controller only validates and dispatches one query.
 */
@ApiTags("Audit Log")
@AdminAccessOnly("Admin access required to view the audit log.")
@Controller(apiPath("/admin/audit-trail"))
export class AuditTrailController {
	public constructor(
		private readonly queryBus: QueryBus,
		@Inject(AUDIT_TRAIL_SIGNALS) private readonly auditTrailSignals: AuditTrailSignalsPort,
	) {}

	@RequirePermission("LIST", "AUDIT_LOG")
	@PlatformOperation(AUDIT_TRAIL_READ_OPERATION)
	@Get()
	@ApiOperation({
		summary: "List the audit trail (newest first)",
		description: "HTTP requests (with how many rows each changed) and background database writes as one timeline.",
	})
	@ZodPaginatedResponse(AuditTrailEntrySchema, { description: "Paginated timeline entries; pagination is in `meta`" })
	public async list(
		@CurrentActor() actor: ActorContext,
		@ZodListQuery(apiContract.auditTrail.list.input) query: AuditTrailListQuery,
	): Promise<PaginatedServiceResult<AuditTrailEntry>> {
		return this.queryBus.execute(new ListAuditTrailQuery(actor, query));
	}

	/**
	 * Server-Sent Events: a `{ updatedAt }` frame whenever an audit entry is
	 * written — by a request or a background write (the database notifies) —
	 * at most one per two seconds. The frame carries nothing from the trail;
	 * the page refetches the list it shows. Reads of the audit log itself do
	 * not signal (viewing it is audited, and would otherwise loop).
	 */
	@RequirePermission("LIST", "AUDIT_LOG")
	@Sse("events")
	@ApiOperation({ summary: "Live audit trail update stream (SSE)" })
	@ApiEventStreamResponse("One `{ updatedAt }` frame per burst of new entries, a `ping` every 25 s (no envelope, no response contract)")
	public stream(): Observable<MessageEvent> {
		return merge(
			this.auditTrailSignals.observe().pipe(
				throttleTime(AUDIT_TRAIL_SIGNAL_THROTTLE_MS, undefined, { leading: true, trailing: true }),
				map((): MessageEvent => ({ data: { updatedAt: nowEpochMs() } })),
			),
			interval(AUDIT_TRAIL_KEEPALIVE_MS).pipe(map((): MessageEvent => ({ type: "ping", data: "" }))),
		);
	}
}
