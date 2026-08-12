import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";

import type {
	EmailLogEntry,
	ExceptionLogEntry,
	TelescopeExceptionListResponse,
	TelescopeOverview,
	TelescopeRequestDetailResponse,
	TelescopeRequestListResponse,
	TelescopeSqlListResponse,
} from "@workspace/shared";

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
export class TelescopeController {
	public constructor(private readonly telescopeService: TelescopeService) {}

	@Get("overview")
	public async overview(@Query() query: Record<string, string | string[] | undefined>): Promise<{ readonly overview: TelescopeOverview }> {
		return { overview: await this.telescopeService.overview(query) };
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
	public dump(@Body() body: unknown): { readonly id: string } {
		return this.telescopeService.pushDump(body);
	}
}
