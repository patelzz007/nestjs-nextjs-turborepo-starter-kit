// ============================================
// presentation/http/operations.controller.ts — servers, instances, dependencies and alerts
// ============================================
// Admin-panel sessions only. Every read needs SERVER_METRIC (LIST for a list, READ for one
// subject); registering, re-keying or removing a server and changing the alert settings are
// SuperAdmin only (ADR 068). Each route runs under a named system operation: the tables are
// bypass-only under RLS.

import { Controller, Delete, Get, HttpStatus, Inject, Post, Put } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	OpsAlertSettingsInputSchema,
	apiPath,
	DeleteSuccessDataSchema,
	OpsAlertListQuerySchema,
	OpsAlertListSchema,
	OpsAlertSettingsSchema,
	OpsDependencyHistorySchema,
	OpsDependencyListSchema,
	OpsDependencyPathSchema,
	OpsHistoryQuerySchema,
	OpsInstanceHistorySchema,
	OpsInstanceListSchema,
	OpsInstancePathSchema,
	OpsOverviewSchema,
	OpsServerCredentialsSchema,
	OpsServerDetailSchema,
	OpsServerHistorySchema,
	OpsServerListSchema,
	OpsServerPathSchema,
	RegisterOpsServerSchema,
	type DeleteSuccessData,
	type OpsAlertList,
	type OpsAlertListQuery,
	type OpsAlertSettings,
	type OpsDependencyHistory,
	type OpsDependencyList,
	type OpsDependencyPath,
	type OpsHistoryQuery,
	type OpsInstanceHistory,
	type OpsInstanceList,
	type OpsInstancePath,
	type OpsOverview,
	type OpsServerCredentials,
	type OpsServerDetail,
	type OpsServerHistory,
	type OpsServerList,
	type OpsServerPath,
	type RegisterOpsServerInput,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { AdminAccessOnly } from "../../../../platform/presentation/http/security/decorators/admin-access.decorator";
import { PlatformOperation } from "../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { SuperAdminOnly } from "../../../../platform/presentation/http/security/decorators/super-admin.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodParams, ZodQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { RegisterOpsServerCommand } from "../../application/commands/register-ops-server/register-ops-server.command";
import { RevokeOpsServerCommand } from "../../application/commands/revoke-ops-server/revoke-ops-server.command";
import { RotateOpsServerTokenCommand } from "../../application/commands/rotate-ops-server-token/rotate-ops-server-token.command";
import { UpdateOpsAlertSettingsCommand } from "../../application/commands/update-ops-alert-settings/update-ops-alert-settings.command";
import { OPERATIONS_READ, OPS_CONSOLE_READ_OPERATION, OPS_SERVERS_WRITE_OPERATION, OPS_SETTINGS_WRITE_OPERATION } from "../../application/ports/operations.tokens";
import type { OperationsReadService } from "../../application/services/operations-read.service";

@ApiTags("Operations")
@ApiBearerAuth()
@AdminAccessOnly("Admin access required for the operations console.")
@Controller(apiPath("/admin/operations"))
export class OperationsController {
	public constructor(
		private readonly commandBus: CommandBus,
		@Inject(OPERATIONS_READ) private readonly reads: OperationsReadService,
	) {}

	@RequirePermission("LIST", "SERVER_METRIC")
	@PlatformOperation(OPS_CONSOLE_READ_OPERATION)
	@Get("overview")
	@ApiOperation({ summary: "Every server, instance and dependency with its live numbers, and the open alerts" })
	@ZodResponse(OpsOverviewSchema, { description: "The overview" })
	public overview(@CurrentActor() actor: ActorContext): Promise<OpsOverview> {
		return this.reads.overview(actor);
	}

	@RequirePermission("LIST", "SERVER_METRIC")
	@PlatformOperation(OPS_CONSOLE_READ_OPERATION)
	@Get("servers")
	@ApiOperation({ summary: "Every registered server with its latest sample" })
	@ZodResponse(OpsServerListSchema, { description: "The servers" })
	public servers(@CurrentActor() actor: ActorContext): Promise<OpsServerList> {
		return this.reads.servers(actor);
	}

	@SuperAdminOnly()
	@PlatformOperation(OPS_SERVERS_WRITE_OPERATION)
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Post("servers")
	@ApiOperation({ summary: "SuperAdmin: register a server and issue its agent token (shown once)" })
	@ZodResponse(OpsServerCredentialsSchema, { status: HttpStatus.CREATED, description: "The server, its agent token and the command that starts the agent" })
	public register(@CurrentActor() actor: ActorContext, @ZodBody(RegisterOpsServerSchema) input: RegisterOpsServerInput): Promise<OpsServerCredentials> {
		return this.commandBus.execute(new RegisterOpsServerCommand(actor, input));
	}

	@RequirePermission("READ", "SERVER_METRIC")
	@PlatformOperation(OPS_CONSOLE_READ_OPERATION)
	@Get("servers/:serverId")
	@ApiOperation({ summary: "One server: its host facts, live sample and its cloud provider's view" })
	@ZodResponse(OpsServerDetailSchema, { description: "The server" })
	public server(@CurrentActor() actor: ActorContext, @ZodParams(OpsServerPathSchema) path: OpsServerPath): Promise<OpsServerDetail> {
		return this.reads.server(actor, path.serverId);
	}

	@RequirePermission("READ", "SERVER_METRIC")
	@PlatformOperation(OPS_CONSOLE_READ_OPERATION)
	@Get("servers/:serverId/history")
	@ApiOperation({ summary: "One server's history over a range (minutes up to a day, hours beyond)" })
	@ZodResponse(OpsServerHistorySchema, { description: "The history" })
	public serverHistory(
		@CurrentActor() actor: ActorContext,
		@ZodParams(OpsServerPathSchema) path: OpsServerPath,
		@ZodQuery(OpsHistoryQuerySchema) query: OpsHistoryQuery,
	): Promise<OpsServerHistory> {
		return this.reads.serverHistory(actor, path.serverId, query.range);
	}

	@SuperAdminOnly()
	@PlatformOperation(OPS_SERVERS_WRITE_OPERATION)
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Post("servers/:serverId/token")
	@ApiOperation({ summary: "SuperAdmin: a new agent token for a server; the old one stops working" })
	@ZodResponse(OpsServerCredentialsSchema, { status: HttpStatus.CREATED, description: "The server and its new agent token (shown once)" })
	public rotateToken(@CurrentActor() actor: ActorContext, @ZodParams(OpsServerPathSchema) path: OpsServerPath): Promise<OpsServerCredentials> {
		return this.commandBus.execute(new RotateOpsServerTokenCommand(actor, path.serverId));
	}

	@SuperAdminOnly()
	@PlatformOperation(OPS_SERVERS_WRITE_OPERATION)
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Delete("servers/:serverId")
	@ApiOperation({ summary: "SuperAdmin: stop monitoring a server (its token stops working; its history stays until retention)" })
	@ZodResponse(DeleteSuccessDataSchema, { description: "Removed" })
	public revoke(@CurrentActor() actor: ActorContext, @ZodParams(OpsServerPathSchema) path: OpsServerPath): Promise<DeleteSuccessData> {
		return this.commandBus.execute(new RevokeOpsServerCommand(actor, path.serverId));
	}

	@RequirePermission("LIST", "SERVER_METRIC")
	@PlatformOperation(OPS_CONSOLE_READ_OPERATION)
	@Get("instances")
	@ApiOperation({ summary: "Every instance's latest heartbeat (API and analytics-consumer processes)" })
	@ZodResponse(OpsInstanceListSchema, { description: "The instances" })
	public instances(): Promise<OpsInstanceList> {
		return this.reads.instances();
	}

	@RequirePermission("READ", "SERVER_METRIC")
	@PlatformOperation(OPS_CONSOLE_READ_OPERATION)
	@Get("instances/:instanceId/history")
	@ApiOperation({ summary: "One instance's history over a range" })
	@ZodResponse(OpsInstanceHistorySchema, { description: "The history" })
	public instanceHistory(
		@CurrentActor() actor: ActorContext,
		@ZodParams(OpsInstancePathSchema) path: OpsInstancePath,
		@ZodQuery(OpsHistoryQuerySchema) query: OpsHistoryQuery,
	): Promise<OpsInstanceHistory> {
		return this.reads.instanceHistory(actor, path.instanceId, query.range);
	}

	@RequirePermission("LIST", "SERVER_METRIC")
	@PlatformOperation(OPS_CONSOLE_READ_OPERATION)
	@Get("dependencies")
	@ApiOperation({ summary: "The latest check of every dependency (PostgreSQL, Redis, queues, Kafka, RabbitMQ, public endpoints)" })
	@ZodResponse(OpsDependencyListSchema, { description: "The dependencies" })
	public dependencies(): Promise<OpsDependencyList> {
		return this.reads.dependencies();
	}

	@RequirePermission("READ", "SERVER_METRIC")
	@PlatformOperation(OPS_CONSOLE_READ_OPERATION)
	@Get("dependencies/:dependency/history")
	@ApiOperation({ summary: "One dependency's history over a range" })
	@ZodResponse(OpsDependencyHistorySchema, { description: "The history" })
	public dependencyHistory(
		@CurrentActor() actor: ActorContext,
		@ZodParams(OpsDependencyPathSchema) path: OpsDependencyPath,
		@ZodQuery(OpsHistoryQuerySchema) query: OpsHistoryQuery,
	): Promise<OpsDependencyHistory> {
		return this.reads.dependencyHistory(actor, path.dependency, query.range);
	}

	@RequirePermission("LIST", "SERVER_METRIC")
	@PlatformOperation(OPS_CONSOLE_READ_OPERATION)
	@Get("alerts")
	@ApiOperation({ summary: "Alerts: open (default), resolved, or all — newest first" })
	@ZodResponse(OpsAlertListSchema, { description: "The alerts" })
	public alerts(@CurrentActor() actor: ActorContext, @ZodQuery(OpsAlertListQuerySchema) query: OpsAlertListQuery): Promise<OpsAlertList> {
		return this.reads.alerts(actor, query.status);
	}

	@RequirePermission("LIST", "SERVER_METRIC")
	@PlatformOperation(OPS_CONSOLE_READ_OPERATION)
	@Get("alert-settings")
	@ApiOperation({ summary: "The alert thresholds and the extra recipients" })
	@ZodResponse(OpsAlertSettingsSchema, { description: "The settings" })
	public alertSettings(@CurrentActor() actor: ActorContext): Promise<OpsAlertSettings> {
		return this.reads.alertSettings(actor);
	}

	@SuperAdminOnly()
	@PlatformOperation(OPS_SETTINGS_WRITE_OPERATION)
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Put("alert-settings")
	@ApiOperation({ summary: "SuperAdmin: change the alert thresholds and the extra recipients (every SuperAdmin always gets alerts)" })
	@ZodResponse(OpsAlertSettingsSchema, { description: "The saved settings" })
	public updateAlertSettings(@CurrentActor() actor: ActorContext, @ZodBody(OpsAlertSettingsInputSchema) settings: OpsAlertSettings): Promise<OpsAlertSettings> {
		return this.commandBus.execute(new UpdateOpsAlertSettingsCommand(actor, settings));
	}
}
