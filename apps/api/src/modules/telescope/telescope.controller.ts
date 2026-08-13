import { Body, Controller, Get, Param, Post, Put, Query, Sse, UseGuards, type MessageEvent } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { map, type Observable } from "rxjs";

import {
	TelescopeAnnotationInputSchema,
	TelescopeDumpInputSchema,
	TelescopeReplayInputSchema,
	type EmailLogEntry,
	type ExceptionLogEntry,
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
	type TelescopeSchedulesResponse,
	type TelescopeSqlListResponse,
	type TelescopeStreamEvent,
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
	 * `data:` field). The global `ResponseInterceptor` bypasses the envelope
	 * for `text/event-stream` Accept headers, and the global AuthGuard +
	 * TelescopeAdminGuard keep the channel admin-only.
	 */
	@Sse("stream")
	public stream(): Observable<MessageEvent> {
		return this.telescopeService.stream().pipe(map((event: TelescopeStreamEvent): MessageEvent => ({ data: JSON.stringify(event) })));
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
