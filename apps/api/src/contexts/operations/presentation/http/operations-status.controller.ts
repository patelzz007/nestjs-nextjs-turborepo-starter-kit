// ============================================
// presentation/http/operations-status.controller.ts — the public status page and its incidents (enhancement 4.5)
// ============================================
// `GET /operations/status` is public (customers and merchants, no sign-in; the always-on per-IP throttlers
// apply): each part of the service and the incidents, never internal details or who posted. The staff routes need STATUS_INCIDENT; every post is a
// state-changing request, so the audit trail records who said what.

import { Controller, Get, Header, HttpStatus, Inject, Post } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	apiPath,
	CreateStatusIncidentSchema,
	PostStatusIncidentUpdateSchema,
	PublicStatusPageSchema,
	StatusIncidentListSchema,
	StatusIncidentPathSchema,
	StatusIncidentSchema,
	type CreateStatusIncidentInput,
	type PostStatusIncidentUpdateInput,
	type PublicStatusPage,
	type StatusIncident,
	type StatusIncidentList,
	type StatusIncidentPath,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { AdminAccessOnly } from "../../../../platform/presentation/http/security/decorators/admin-access.decorator";
import { PlatformOperation } from "../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { Public } from "../../../../platform/presentation/http/security/decorators/public.decorator";
import { PublicOperation } from "../../../../platform/presentation/http/security/decorators/public-operation.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodParams } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { OpenStatusIncidentCommand, PostStatusIncidentUpdateCommand } from "../../application/commands/status-page/status-page.commands";
import { STATUS_PAGE, STATUS_PUBLIC_READ_OPERATION, STATUS_READ_OPERATION, STATUS_WRITE_OPERATION } from "../../application/ports/operations.tokens";
import type { StatusPageService } from "../../application/services/status-page.service";

/** Browsers and CDNs may keep the public page this long (seconds): it changes once a minute at most. */
const PUBLIC_STATUS_MAX_AGE_SECONDS = 30;

@ApiTags("Operations")
@Controller(apiPath("/operations"))
export class PublicStatusController {
	public constructor(@Inject(STATUS_PAGE) private readonly status: StatusPageService) {}

	@Public()
	@PublicOperation(STATUS_PUBLIC_READ_OPERATION)
	@Get("status")
	@Header("Cache-Control", `public, max-age=${String(PUBLIC_STATUS_MAX_AGE_SECONDS)}`)
	@ApiOperation({ summary: "The public status page: each part of the service and the incidents (no sign-in)" })
	@ZodResponse(PublicStatusPageSchema, { description: "The status page" })
	public page(@CurrentActor({ allowAnonymous: true }) actor: ActorContext): Promise<PublicStatusPage> {
		return this.status.publicPage(actor);
	}
}

@ApiTags("Operations")
@ApiBearerAuth()
@AdminAccessOnly("Admin access required for the status page's incidents.")
@Controller(apiPath("/admin/operations"))
export class OperationsStatusController {
	public constructor(
		private readonly commandBus: CommandBus,
		@Inject(STATUS_PAGE) private readonly status: StatusPageService,
	) {}

	@RequirePermission("LIST", "STATUS_INCIDENT")
	@PlatformOperation(STATUS_READ_OPERATION)
	@Get("status/incidents")
	@ApiOperation({ summary: "The status page's incidents, newest first, with their updates and who posted them" })
	@ZodResponse(StatusIncidentListSchema, { description: "The incidents" })
	public list(@CurrentActor() actor: ActorContext): Promise<StatusIncidentList> {
		return this.status.incidents(actor);
	}

	@RequirePermission("LIST", "STATUS_INCIDENT")
	@PlatformOperation(STATUS_READ_OPERATION)
	@Get("status/incidents/:incidentId")
	@ApiOperation({ summary: "One incident with its updates" })
	@ZodResponse(StatusIncidentSchema, { description: "The incident" })
	public detail(@CurrentActor() actor: ActorContext, @ZodParams(StatusIncidentPathSchema) path: StatusIncidentPath): Promise<StatusIncident> {
		return this.status.incident(actor, path.incidentId);
	}

	@RequirePermission("CREATE", "STATUS_INCIDENT")
	@PlatformOperation(STATUS_WRITE_OPERATION)
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Post("status/incidents")
	@ApiOperation({ summary: "Open an incident on the public status page, with its first update" })
	@ZodResponse(StatusIncidentSchema, { status: HttpStatus.CREATED, description: "The incident" })
	public open(@CurrentActor() actor: ActorContext, @ZodBody(CreateStatusIncidentSchema) input: CreateStatusIncidentInput): Promise<StatusIncident> {
		return this.commandBus.execute(new OpenStatusIncidentCommand(actor, input));
	}

	@RequirePermission("UPDATE", "STATUS_INCIDENT")
	@PlatformOperation(STATUS_WRITE_OPERATION)
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Post("status/incidents/:incidentId/updates")
	@ApiOperation({ summary: "Post an update on an incident (RESOLVED ends it); 409 once it is resolved" })
	@ZodResponse(StatusIncidentSchema, { status: HttpStatus.CREATED, description: "The incident" })
	public post(
		@CurrentActor() actor: ActorContext,
		@ZodParams(StatusIncidentPathSchema) path: StatusIncidentPath,
		@ZodBody(PostStatusIncidentUpdateSchema) input: PostStatusIncidentUpdateInput,
	): Promise<StatusIncident> {
		return this.commandBus.execute(new PostStatusIncidentUpdateCommand(actor, path.incidentId, input));
	}
}
