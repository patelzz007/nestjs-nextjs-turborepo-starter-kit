import { Body, Controller, Get, Param, Post, Query, Sse, UseGuards, type MessageEvent } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { map, type Observable } from "rxjs";

import {
	TelescopeDumpInputSchema,
	type EmailLogEntry,
	type ExceptionLogEntry,
	type TelescopeCompareResponse,
	type TelescopeDumpInput,
	type TelescopeExceptionListResponse,
	type TelescopeOverview,
	type TelescopeRequestDetailResponse,
	type TelescopeRequestListResponse,
	type TelescopeSqlListResponse,
	type TelescopeStreamEvent,
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
}
