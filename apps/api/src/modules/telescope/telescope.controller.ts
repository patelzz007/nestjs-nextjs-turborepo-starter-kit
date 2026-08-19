import { Body, Controller, Get, Headers, Param, Post, Put, Query, Sse, UseGuards, type MessageEvent } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { map, type Observable } from "rxjs";

import {
	apiContract,
	TelescopeAlertSnoozeInputSchema,
	TelescopeAnnotationInputSchema,
	TelescopeExceptionStatusInputSchema,
	TelescopeReplayInputSchema,
	TelescopeScheduleRunInputSchema,
	type BufferedStreamEvent,
	type EmailLogEntry,
	type ExceptionLogEntry,
	type TelescopeAlertEntry,
	type TelescopeAlertsResponse,
	type TelescopeAnnotation,
	type TelescopeAnnotationInput,
	type TelescopeAlertSnoozeInput,
	type TelescopeCompareQuery,
	type TelescopeCompareResponse,
	type TelescopeDumpInput,
	type TelescopeExceptionListQuery,
	type TelescopeExceptionListResponse,
	type TelescopeExceptionStatusInput,
	type TelescopeJobLogEntry,
	type TelescopeJobsListQuery,
	type TelescopeJobsListResponse,
	type TelescopeLeaderboardQuery,
	type TelescopeLeaderboardResponse,
	type TelescopeLogsListQuery,
	type TelescopeLogsListResponse,
	type TelescopeOverview,
	type TelescopeOverviewQuery,
	type TelescopeReplayInput,
	type TelescopeReplayResponse,
	type TelescopeRequestDetailResponse,
	type TelescopeRequestListQuery,
	type TelescopeRequestListResponse,
	type TelescopeRequestSqlResponse,
	type TelescopeScheduleLog,
	type TelescopeScheduleRunInput,
	type TelescopeSchedulesResponse,
	type TelescopeSearchQuery,
	type TelescopeSearchResponse,
	type TelescopeSqlListQuery,
	type TelescopeSqlListResponse,
	type TelescopeStatus,
	type TelescopeTrendsQuery,
	type TelescopeTrendsResponse,
	type TelescopeUsersQuery,
	type TelescopeUsersResponse,
	type TelescopeWebhookDeliveriesResponse,
} from "@workspace/shared";
import { TelescopeIdParamSchema, TelescopeScheduleNameParamSchema, apiPath } from "@workspace/shared";

import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { RequirePermission } from "../auth/decorators/require-permission.decorator";

import { TelescopeAdminGuard } from "./telescope-admin.guard";
import { TelescopeService } from "./telescope.service";

/**
 * The Telescope read API (docs/telescope.md §7). Every route requires admin
 * access (global AuthGuard + TelescopeAdminGuard) and is excluded from the
 * public Swagger document — request bodies and SQL must never leak.
 *
 * All responses pass through the standard `ResponseInterceptor` envelope.
 * Every query-string and body is validated STRICTLY at the HTTP boundary via
 * `ZodValidationPipe(apiContract.telescope.*.input)` — the same zod contract
 * the client router (`@workspace/client` endpoints.ts) derives from, so the
 * two sides can never drift. Malformed input returns a 400 with the zod
 * issues instead of being silently dropped.
 */

@ApiExcludeController()
@Controller(apiPath("/telescope"))
@UseGuards(TelescopeAdminGuard)
export class TelescopeController {
	public constructor(private readonly telescopeService: TelescopeService) {}

	@RequirePermission("READ", "TELESCOPE")
	@Get("overview")
	public async overview(@Query(new ZodValidationPipe(apiContract.telescope.overview.input)) query: TelescopeOverviewQuery): Promise<{ readonly overview: TelescopeOverview }> {
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
	@RequirePermission("READ", "TELESCOPE")
	@Sse("stream")
	public stream(@Headers("last-event-id") lastEventId?: string): Observable<MessageEvent> {
		const afterSeq: number = Number.parseInt(lastEventId ?? "0", 10);
		const parsed: number = Number.isFinite(afterSeq) && afterSeq > 0 ? afterSeq : 0;
		return this.telescopeService.stream(parsed).pipe(map((entry: BufferedStreamEvent): MessageEvent => ({ id: String(entry.seq), data: JSON.stringify(entry.event) })));
	}

	/** Improvement 6 — compare two requests via `?a=<id>&b=<id>`. */
	@RequirePermission("READ", "TELESCOPE")
	@Get("compare")
	public compare(@Query(new ZodValidationPipe(apiContract.telescope.compare.input)) query: TelescopeCompareQuery): TelescopeCompareResponse {
		return this.telescopeService.compare(query);
	}

	@RequirePermission("LIST", "TELESCOPE")
	@Get("requests")
	public async listRequests(
		@Query(new ZodValidationPipe(apiContract.telescope.requests.input)) query: TelescopeRequestListQuery,
	): Promise<{ readonly list: TelescopeRequestListResponse }> {
		return { list: await this.telescopeService.listRequests(query) };
	}

	@RequirePermission("READ", "TELESCOPE")
	@Get("requests/:id")
	public async requestDetail(
		@Param("id", new ZodValidationPipe(TelescopeIdParamSchema)) id: string,
	): Promise<TelescopeRequestDetailResponse> {
		return this.telescopeService.getRequestDetail(id);
	}

	/** Improvement 3 — the lazy SQL/dumps/N+1 payload for a request detail. */
	@RequirePermission("READ", "TELESCOPE")
	@Get("requests/:id/sql")
	public requestSql(@Param("id", new ZodValidationPipe(TelescopeIdParamSchema)) id: string): TelescopeRequestSqlResponse {
		return this.telescopeService.requestSql(id);
	}

	@RequirePermission("LIST", "TELESCOPE")
	@Get("sql")
	public listSql(@Query(new ZodValidationPipe(apiContract.telescope.sql.input)) query: TelescopeSqlListQuery): { readonly list: TelescopeSqlListResponse } {
		return { list: this.telescopeService.listSql(query) };
	}

	@RequirePermission("LIST", "TELESCOPE")
	@Get("exceptions")
	public listExceptions(@Query(new ZodValidationPipe(apiContract.telescope.exceptions.input)) query: TelescopeExceptionListQuery): {
		readonly list: TelescopeExceptionListResponse;
	} {
		return { list: this.telescopeService.listExceptions(query) };
	}

	@RequirePermission("READ", "TELESCOPE")
	@Get("exceptions/:id")
	public exceptionDetail(@Param("id", new ZodValidationPipe(TelescopeIdParamSchema)) id: string): ExceptionLogEntry {
		return this.telescopeService.getException(id);
	}

	@RequirePermission("LIST", "TELESCOPE")
	@Get("mail")
	public async listMail(): Promise<{ readonly logs: readonly EmailLogEntry[] }> {
		return this.telescopeService.listMail();
	}

	@RequirePermission("CREATE", "TELESCOPE")
	@Post("dump")
	public dump(@Body(new ZodValidationPipe(apiContract.telescope.dump.input)) body: TelescopeDumpInput): { readonly id: string } {
		return this.telescopeService.pushDump(body);
	}

	/** Feature 3 — jobs. */
	@RequirePermission("LIST", "TELESCOPE")
	@Get("jobs")
	public listJobs(@Query(new ZodValidationPipe(apiContract.telescope.jobs.input)) query: TelescopeJobsListQuery): { readonly list: TelescopeJobsListResponse } {
		return { list: this.telescopeService.listJobs(query) };
	}

	@RequirePermission("READ", "TELESCOPE")
	@Get("jobs/:id")
	public jobDetail(@Param("id", new ZodValidationPipe(TelescopeIdParamSchema)) id: string): TelescopeJobLogEntry {
		return this.telescopeService.getJob(id);
	}

	/** Feature 4 — schedules. */
	@RequirePermission("LIST", "TELESCOPE")
	@Get("schedules")
	public listSchedules(): TelescopeSchedulesResponse {
		return this.telescopeService.listSchedules();
	}

	/** Feature 12 — slow-endpoint leaderboard. */
	@RequirePermission("READ", "TELESCOPE")
	@Get("leaderboard")
	public leaderboard(@Query(new ZodValidationPipe(apiContract.telescope.leaderboard.input)) query: TelescopeLeaderboardQuery): TelescopeLeaderboardResponse {
		return this.telescopeService.leaderboard(query);
	}

	/** Feature 13 — hourly error-rate trends. */
	@RequirePermission("READ", "TELESCOPE")
	@Get("trends")
	public trends(@Query(new ZodValidationPipe(apiContract.telescope.trends.input)) query: TelescopeTrendsQuery): TelescopeTrendsResponse {
		return this.telescopeService.trends(query);
	}

	/** Feature 20 — logs browser. */
	@RequirePermission("LIST", "TELESCOPE")
	@Get("logs")
	public listLogs(@Query(new ZodValidationPipe(apiContract.telescope.logs.input)) query: TelescopeLogsListQuery): { readonly list: TelescopeLogsListResponse } {
		return { list: this.telescopeService.listLogs(query) };
	}

	/** Feature 1 — global free-text search across every captured surface. */
	@RequirePermission("READ", "TELESCOPE")
	@Get("search")
	public async search(@Query(new ZodValidationPipe(apiContract.telescope.search.input)) query: TelescopeSearchQuery): Promise<TelescopeSearchResponse> {
		return this.telescopeService.search(query);
	}

	/** Feature 3 — per-user request aggregation. */
	@RequirePermission("LIST", "TELESCOPE")
	@Get("users")
	public async listUsers(@Query(new ZodValidationPipe(apiContract.telescope.users.input)) query: TelescopeUsersQuery): Promise<{ readonly list: TelescopeUsersResponse }> {
		return { list: await this.telescopeService.listUsers(query) };
	}

	/** Feature 12 — run a registered schedule on demand (\"Run now\" button). */
	@RequirePermission("CREATE", "TELESCOPE")
	@Post("schedules/:name/run")
	public async runSchedule(
		@Param("name", new ZodValidationPipe(TelescopeScheduleNameParamSchema)) name: string,
		@Body(new ZodValidationPipe(TelescopeScheduleRunInputSchema)) body: TelescopeScheduleRunInput,
	): Promise<TelescopeScheduleLog> {
		return this.telescopeService.runSchedule(name, body);
	}

	/** Feature 13 — webhook delivery records for the alerts panel. */
	@RequirePermission("LIST", "TELESCOPE")
	@Get("webhook-deliveries")
	public listWebhookDeliveries(): TelescopeWebhookDeliveriesResponse {
		return this.telescopeService.listWebhookDeliveries();
	}

	/** Feature 8 — manual retention pruning (`?force=true` clears everything old). */
	@RequirePermission("DELETE", "TELESCOPE")
	@Post("admin/prune")
	public prune(@Query(new ZodValidationPipe(apiContract.telescope.prune.input)) query: { readonly force?: boolean | "true" | "false" }): { readonly removed: number } {
		return this.telescopeService.prune(query);
	}

	/** Feature 8 — empty every buffer (requests, SQL, exceptions, jobs, …). */
	@RequirePermission("DELETE", "TELESCOPE")
	@Post("admin/clear")
	public clearAll(): { readonly cleared: true } {
		return this.telescopeService.clearAll();
	}

	/** Feature 9 — the fully-resolved capture config + pipeline health snapshot. */
	@RequirePermission("READ", "TELESCOPE")
	@Get("status")
	public status(): TelescopeStatus {
		return this.telescopeService.status();
	}

	/** Feature 18 — recent threshold alerts. */
	@RequirePermission("LIST", "TELESCOPE")
	@Get("alerts")
	public listAlerts(): TelescopeAlertsResponse {
		return this.telescopeService.listAlerts();
	}

	/** Improvement 5 — acknowledge (resolve) an alert. */
	@RequirePermission("UPDATE", "TELESCOPE")
	@Post("alerts/:id/ack")
	public acknowledgeAlert(@Param("id", new ZodValidationPipe(TelescopeIdParamSchema)) id: string): TelescopeAlertEntry {
		return this.telescopeService.acknowledgeAlert(id);
	}

	/** Improvement 5 — snooze an alert for N minutes. */
	@RequirePermission("UPDATE", "TELESCOPE")
	@Post("alerts/:id/snooze")
	public snoozeAlert(
		@Param("id", new ZodValidationPipe(TelescopeIdParamSchema)) id: string,
		@Body(new ZodValidationPipe(TelescopeAlertSnoozeInputSchema)) body: TelescopeAlertSnoozeInput,
	): TelescopeAlertEntry {
		return this.telescopeService.snoozeAlert(id, body);
	}

	/** Improvement 6 — set the triage status of an exception group. */
	@RequirePermission("UPDATE", "TELESCOPE")
	@Put("exceptions/:id/status")
	public setExceptionStatus(
		@Param("id", new ZodValidationPipe(TelescopeIdParamSchema)) id: string,
		@Body(new ZodValidationPipe(TelescopeExceptionStatusInputSchema)) body: TelescopeExceptionStatusInput,
	): ExceptionLogEntry {
		return this.telescopeService.setExceptionStatus(id, body);
	}

	/** Improvement 17 — re-run a failed job (new entry). */
	@RequirePermission("CREATE", "TELESCOPE")
	@Post("jobs/:id/retry")
	public async retryJob(@Param("id", new ZodValidationPipe(TelescopeIdParamSchema)) id: string): Promise<TelescopeJobLogEntry> {
		return this.telescopeService.retryJob(id);
	}

	/** Feature 14 — star/comment a request. */
	@RequirePermission("UPDATE", "TELESCOPE")
	@Put("requests/:id/annotation")
	public setAnnotation(
		@Param("id", new ZodValidationPipe(TelescopeIdParamSchema)) id: string,
		@Body(new ZodValidationPipe(TelescopeAnnotationInputSchema)) body: TelescopeAnnotationInput,
	): TelescopeAnnotation {
		return this.telescopeService.setAnnotation(id, body);
	}

	/** Feature 7 — replay a captured request against a configured target. */
	@RequirePermission("CREATE", "TELESCOPE")
	@Post("replay/:id")
	public async replay(
		@Param("id", new ZodValidationPipe(TelescopeIdParamSchema)) id: string,
		@Body(new ZodValidationPipe(TelescopeReplayInputSchema)) body: TelescopeReplayInput,
	): Promise<TelescopeReplayResponse> {
		return this.telescopeService.replay(id, body);
	}
}
