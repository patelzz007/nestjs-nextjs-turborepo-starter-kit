import { Body, Controller, Get, Headers, Param, Post, Put, Query, Sse, UseGuards, type MessageEvent } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { map, type Observable } from "rxjs";

import {
	TelescopeAnnotationInputSchema,
	TelescopeDumpInputSchema,
	TelescopeReplayInputSchema,
	type BufferedStreamEvent,
	type EmailLogEntry,
	type ExceptionLogEntry,
	type TelescopeAlertEntry,
	type TelescopeAlertsResponse,
	type TelescopeAnnotation,
	type TelescopeAnnotationInput,
	type TelescopeCompareResponse,
	type TelescopeDumpInput,
	type TelescopeExceptionListResponse,
	type TelescopeJobLogEntry,
	type TelescopeJobsListResponse,
	type TelescopeLeaderboardResponse,
	type TelescopeLogsListResponse,
	type TelescopeOverview,
	type TelescopeReplayInput,
	type TelescopeReplayResponse,
	type TelescopeRequestDetailResponse,
	type TelescopeRequestListResponse,
	type TelescopeRequestSqlResponse,
	type TelescopeSchedulesResponse,
	type TelescopeSqlListResponse,
	type TelescopeTrendsResponse,
} from "@workspace/shared";

import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe.js";

import { TelescopeAdminGuard } from "./telescope-admin.guard.js";
import { TelescopeService } from "./telescope.service.js";

/**
 * The Telescope read API (docs/telescope.md §7). Every route requires admin
 * access (global AuthGuard + TelescopeAdminGuard) and is excluded from the
 * public Swagger document — request bodies and SQL must never leak.
 *
 * All responses pass through the standard `ResponseInterceptor` envelope.
 * Query params are parsed through the shared Zod schemas (coerced, tolerant).
 */

@ApiExcludeController()
@Controller("telescope")
@UseGuards(TelescopeAdminGuard)
// eslint-disable-next-line @darraghor/nestjs-typed/injectable-should-be-provided -- Registered in TelescopeModule.register()'s dynamic controllers; the typed plugin only scans static @Module decorators.
export class TelescopeController {
	public constructor(private readonly telescopeService: TelescopeService) {}

	@Get("overview")
	public async overview(@Query() query: Record<string, string | string[] | undefined>): Promise<{ readonly overview: TelescopeOverview }> {
		return { overview: await this.telescopeService.overview(query) };
	}

	/**
	 * Improvement 2 — live stream. Frames are `{ type, id }` (JSON in the
	 * `data:` field), each stamped with a monotonic `id:` seq so a reconnecting
	 * client can send `Last-Event-ID` and get a replay of what it missed
	 * (improvement 7). The global `ResponseInterceptor` bypasses the envelope
	 * for `text/event-stream` Accept headers, and the global AuthGuard +
	 * TelescopeAdminGuard keep the channel admin-only.
	 */
	@Sse("stream")
	public stream(@Headers("last-event-id") lastEventId?: string): Observable<MessageEvent> {
		const afterSeq: number = Number.parseInt(lastEventId ?? "0", 10);
		const parsed: number = Number.isFinite(afterSeq) && afterSeq > 0 ? afterSeq : 0;
		return this.telescopeService.stream(parsed).pipe(map((entry: BufferedStreamEvent): MessageEvent => ({ id: String(entry.seq), data: JSON.stringify(entry.event) })));
	}

	/** Improvement 6 — compare two requests via `?a=<id>&b=<id>`. */
	@Get("compare")
	public compare(@Query() query: Record<string, string | string[] | undefined>): TelescopeCompareResponse {
		return this.telescopeService.compare(query);
	}

	@Get("requests")
	public listRequests(@Query() query: Record<string, string | string[] | undefined>): { readonly list: TelescopeRequestListResponse } {
		return { list: this.telescopeService.listRequests(query) };
	}

	@Get("requests/:id")
	public requestDetail(@Param("id") id: string): TelescopeRequestDetailResponse {
		return this.telescopeService.getRequestDetail(id);
	}

	/** Improvement 3 — the lazy SQL/dumps/N+1 payload for a request detail. */
	@Get("requests/:id/sql")
	public requestSql(@Param("id") id: string): TelescopeRequestSqlResponse {
		return this.telescopeService.requestSql(id);
	}

	@Get("sql")
	public listSql(@Query() query: Record<string, string | string[] | undefined>): { readonly list: TelescopeSqlListResponse } {
		return { list: this.telescopeService.listSql(query) };
	}

	@Get("exceptions")
	public listExceptions(@Query() query: Record<string, string | string[] | undefined>): { readonly list: TelescopeExceptionListResponse } {
		return { list: this.telescopeService.listExceptions(query) };
	}

	@Get("exceptions/:id")
	public exceptionDetail(@Param("id") id: string): ExceptionLogEntry {
		return this.telescopeService.getException(id);
	}

	@Get("mail")
	public async listMail(): Promise<{ readonly logs: readonly EmailLogEntry[] }> {
		return this.telescopeService.listMail();
	}

	@Post("dump")
	public dump(@Body(new ZodValidationPipe(TelescopeDumpInputSchema)) body: TelescopeDumpInput): { readonly id: string } {
		return this.telescopeService.pushDump(body);
	}

	/** Feature 3 — jobs. */
	@Get("jobs")
	public listJobs(@Query() query: Record<string, string | string[] | undefined>): { readonly list: TelescopeJobsListResponse } {
		return { list: this.telescopeService.listJobs(query) };
	}

	@Get("jobs/:id")
	public jobDetail(@Param("id") id: string): TelescopeJobLogEntry {
		return this.telescopeService.getJob(id);
	}

	/** Feature 4 — schedules. */
	@Get("schedules")
	public listSchedules(): TelescopeSchedulesResponse {
		return this.telescopeService.listSchedules();
	}

	/** Feature 12 — slow-endpoint leaderboard. */
	@Get("leaderboard")
	public leaderboard(@Query() query: Record<string, string | string[] | undefined>): TelescopeLeaderboardResponse {
		return this.telescopeService.leaderboard(query);
	}

	/** Feature 13 — hourly error-rate trends. */
	@Get("trends")
	public trends(@Query() query: Record<string, string | string[] | undefined>): TelescopeTrendsResponse {
		return this.telescopeService.trends(query);
	}

	/** Feature 20 — logs browser. */
	@Get("logs")
	public listLogs(@Query() query: Record<string, string | string[] | undefined>): { readonly list: TelescopeLogsListResponse } {
		return { list: this.telescopeService.listLogs(query) };
	}

	/** Feature 18 — recent threshold alerts. */
	@Get("alerts")
	public listAlerts(): TelescopeAlertsResponse {
		return this.telescopeService.listAlerts();
	}

	/** Improvement 5 — acknowledge (resolve) an alert. */
	@Post("alerts/:id/ack")
	public acknowledgeAlert(@Param("id") id: string): TelescopeAlertEntry {
		return this.telescopeService.acknowledgeAlert(id);
	}

	/** Improvement 5 — snooze an alert for N minutes. */
	@Post("alerts/:id/snooze")
	public snoozeAlert(@Param("id") id: string, @Body() body: Record<string, string | number | undefined>): TelescopeAlertEntry {
		return this.telescopeService.snoozeAlert(id, body);
	}

	/** Improvement 6 — set the triage status of an exception group. */
	@Put("exceptions/:id/status")
	public setExceptionStatus(@Param("id") id: string, @Body() body: Record<string, string | undefined>): ExceptionLogEntry {
		return this.telescopeService.setExceptionStatus(id, body);
	}

	/** Improvement 17 — re-run a failed job (new entry). */
	@Post("jobs/:id/retry")
	public async retryJob(@Param("id") id: string): Promise<TelescopeJobLogEntry> {
		return this.telescopeService.retryJob(id);
	}

	/** Feature 14 — star/comment a request. */
	@Put("requests/:id/annotation")
	public setAnnotation(@Param("id") id: string, @Body(new ZodValidationPipe(TelescopeAnnotationInputSchema)) body: TelescopeAnnotationInput): TelescopeAnnotation {
		return this.telescopeService.setAnnotation(id, body);
	}

	/** Feature 7 — replay a captured request against a configured target. */
	@Post("replay/:id")
	public async replay(@Param("id") id: string, @Body(new ZodValidationPipe(TelescopeReplayInputSchema)) body: TelescopeReplayInput): Promise<TelescopeReplayResponse> {
		return this.telescopeService.replay(id, body);
	}
}
