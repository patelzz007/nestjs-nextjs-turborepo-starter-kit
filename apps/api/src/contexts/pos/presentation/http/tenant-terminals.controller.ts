import { Controller, Delete, Get, HttpStatus, Patch, Post, UseInterceptors } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	apiContract,
	apiPath,
	MerchantCreateTerminalSchema,
	MerchantTerminalListQuerySchema,
	MerchantTerminalPairingSchema,
	MerchantTerminalSettingsResponseSchema,
	MerchantTerminalSettingsSchema,
	MerchantTerminalStatusSummaryQuerySchema,
	MerchantTerminalStatusSummarySchema,
	MerchantTerminalSummarySchema,
	OkResponseSchema,
	TenantSlugParamSchema,
	PosPairedTerminalSchema,
	PosPairTerminalSchema,
	type MerchantTerminalPairing,
	type MerchantTerminalSettings,
	type MerchantTerminalStatusSummary,
	type MerchantTerminalSummary,
	type OkResponse,
	type PaginatedServiceResult,
	type PosPairedTerminal,
} from "@workspace/shared";
import type { z } from "zod";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { MerchantActor } from "../../../../platform/presentation/http/security/api-keys/merchant-actor";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { GetMerchantActor } from "../../../../platform/presentation/http/security/decorators/get-merchant-actor.decorator";
import { Public } from "../../../../platform/presentation/http/security/decorators/public.decorator";
import { SkipAuthThrottle } from "../../../../platform/presentation/http/security/decorators/skip-auth-throttle.decorator";
import { SkipMutationIntent } from "../../../../platform/presentation/http/security/decorators/skip-mutation-intent.decorator";
import { MerchantActorInterceptor } from "../../../../platform/presentation/http/security/interceptors/merchant-actor.interceptor";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodListQuery, ZodParams, ZodQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { ChangePosSettingsCommand } from "../../application/commands/change-pos-settings/change-pos-settings.command";
import { IssuePairingCodeCommand } from "../../application/commands/issue-pairing-code/issue-pairing-code.command";
import { PairTerminalCommand } from "../../application/commands/pair-terminal/pair-terminal.command";
import { RegisterTerminalCommand } from "../../application/commands/register-terminal/register-terminal.command";
import { RemoveTerminalCommand } from "../../application/commands/remove-terminal/remove-terminal.command";
import { GetPosSettingsQuery } from "../../application/queries/get-pos-settings/get-pos-settings.query";
import { GetTerminalSummaryQuery } from "../../application/queries/get-terminal-summary/get-terminal-summary.query";
import { GetTerminalQuery } from "../../application/queries/get-terminal/get-terminal.query";
import { ListTerminalsQuery } from "../../application/queries/list-terminals/list-terminals.query";
import { PosEmptyBodyDto } from "./pos-empty-body.dto";

type TerminalParams = z.output<typeof apiContract.tenants.terminals.remove.input>;

/**
 * The merchant console's POS terminals (members only). The member's tenant comes from the
 * route's `:tenantSlug` through their membership (`MerchantActorInterceptor`, 404 for a non-member).
 */
@ApiTags("Tenant POS Terminals")
@ApiBearerAuth()
@UseInterceptors(MerchantActorInterceptor)
@Controller(apiPath("/tenants/:tenantSlug/terminals"))
export class TenantTerminalsController {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	@SkipAuthThrottle()
	@Get()
	@ApiOperation({ summary: "List the tenant's POS terminals" })
	@ZodPaginatedResponse(MerchantTerminalSummarySchema, { description: "Paginated POS terminals; pagination is in `meta`" })
	public list(
		@CurrentActor() actor: ActorContext,
		@GetMerchantActor() merchant: MerchantActor,
		@ZodParams(TenantSlugParamSchema) _params: z.output<typeof TenantSlugParamSchema>,
		@ZodListQuery(MerchantTerminalListQuerySchema) query: z.output<typeof MerchantTerminalListQuerySchema>,
	): Promise<PaginatedServiceResult<MerchantTerminalSummary>> {
		return this.queryBus.execute(new ListTerminalsQuery(actor, { ...query, tenantId: merchant.tenantId }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post()
	@ApiOperation({ summary: "Register a POS terminal at a store and get its one-time pairing code" })
	@ZodResponse(MerchantTerminalPairingSchema, { status: HttpStatus.CREATED, description: "Terminal registered; the pairing code is shown once" })
	public create(
		@CurrentActor() actor: ActorContext,
		@GetMerchantActor() merchant: MerchantActor,
		@ZodParams(TenantSlugParamSchema) _params: z.output<typeof TenantSlugParamSchema>,
		@ZodBody(MerchantCreateTerminalSchema) body: z.output<typeof MerchantCreateTerminalSchema>,
	): Promise<MerchantTerminalPairing> {
		return this.commandBus.execute(new RegisterTerminalCommand(actor, { ...body, tenantId: merchant.tenantId }));
	}

	@SkipAuthThrottle()
	@Get("summary")
	@ApiOperation({ summary: "Count the tenant's live POS terminals per status, within the caller's stores" })
	@ZodResponse(MerchantTerminalStatusSummarySchema, { description: "Terminal counts per status and stores covered" })
	public summary(
		@CurrentActor() actor: ActorContext,
		@GetMerchantActor() merchant: MerchantActor,
		@ZodParams(TenantSlugParamSchema) _params: z.output<typeof TenantSlugParamSchema>,
		@ZodQuery(MerchantTerminalStatusSummaryQuerySchema) query: z.output<typeof MerchantTerminalStatusSummaryQuerySchema>,
	): Promise<MerchantTerminalStatusSummary> {
		return this.queryBus.execute(new GetTerminalSummaryQuery(actor, { ...query, tenantId: merchant.tenantId }));
	}

	@SkipAuthThrottle()
	@Get("settings")
	@ApiOperation({ summary: "Read the tenant's POS terminal policy" })
	@ZodResponse(MerchantTerminalSettingsResponseSchema, { description: "POS terminal settings" })
	public getSettings(
		@CurrentActor() actor: ActorContext,
		@GetMerchantActor() merchant: MerchantActor,
		@ZodParams(TenantSlugParamSchema) _params: z.output<typeof TenantSlugParamSchema>,
	): Promise<MerchantTerminalSettings> {
		return this.queryBus.execute(new GetPosSettingsQuery(actor, { tenantId: merchant.tenantId }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Patch("settings")
	@ApiOperation({ summary: "Turn 'only allow registered terminals' on or off" })
	@ZodResponse(MerchantTerminalSettingsResponseSchema, { description: "POS terminal settings updated" })
	public updateSettings(
		@CurrentActor() actor: ActorContext,
		@GetMerchantActor() merchant: MerchantActor,
		@ZodParams(TenantSlugParamSchema) _params: z.output<typeof TenantSlugParamSchema>,
		@ZodBody(MerchantTerminalSettingsSchema) body: z.output<typeof MerchantTerminalSettingsSchema>,
	): Promise<MerchantTerminalSettings> {
		return this.commandBus.execute(new ChangePosSettingsCommand(actor, { ...body, tenantId: merchant.tenantId }));
	}

	@SkipAuthThrottle()
	@Get(":id")
	@ApiOperation({ summary: "Read one POS terminal (404 outside the caller's stores)" })
	@ZodResponse(MerchantTerminalSummarySchema, { description: "POS terminal" })
	public get(
		@CurrentActor() actor: ActorContext,
		@GetMerchantActor() merchant: MerchantActor,
		@ZodParams(apiContract.tenants.terminals.get.input) params: TerminalParams,
	): Promise<MerchantTerminalSummary> {
		return this.queryBus.execute(new GetTerminalQuery(actor, { tenantId: merchant.tenantId, terminalRowId: params.id }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":id/pairing-code")
	@ApiOperation({ summary: "Issue a new pairing code (first pairing, expired code, or re-pair — the old key stops working once the new code is used)" })
	@ApiBody({ type: PosEmptyBodyDto, required: false })
	@ZodResponse(MerchantTerminalPairingSchema, { status: HttpStatus.CREATED, description: "New pairing code (shown once)" })
	public issuePairingCode(
		@CurrentActor() actor: ActorContext,
		@GetMerchantActor() merchant: MerchantActor,
		@ZodParams(apiContract.tenants.terminals.pairingCode.input) params: TerminalParams,
	): Promise<MerchantTerminalPairing> {
		return this.commandBus.execute(new IssuePairingCodeCommand(actor, { tenantId: merchant.tenantId, terminalRowId: params.id }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Delete(":id")
	@ApiOperation({ summary: "Remove a POS terminal and revoke its API key" })
	@ZodResponse(OkResponseSchema, { description: "Terminal removed" })
	public remove(
		@CurrentActor() actor: ActorContext,
		@GetMerchantActor() merchant: MerchantActor,
		@ZodParams(apiContract.tenants.terminals.remove.input) params: TerminalParams,
	): Promise<OkResponse> {
		return this.commandBus.execute(new RemoveTerminalCommand(actor, { tenantId: merchant.tenantId, terminalRowId: params.id }));
	}
}

/**
 * The till's side of pairing. Public (the till has no credential yet — the exchange runs as the named
 * `pos.terminal.pair` system operation, never a route-wide RLS bypass), not a browser flow (no CSRF
 * intent header), rate-limited per client IP.
 */
@ApiTags("POS")
@SkipMutationIntent()
@Controller(apiPath("/integration/terminals"))
export class PosTerminalsController {
	public constructor(private readonly commandBus: CommandBus) {}

	@Public()
	@RateLimit(RATE_LIMIT_POLICY.terminalPairing)
	@Post("pair")
	@ApiOperation({
		summary: "Pair a POS terminal with the one-time code from the merchant console",
		description: "Returns the terminal's own API key (shown once). Send it as X-API-Key on every redemption call; X-Terminal-Id is then optional.",
	})
	@ZodResponse(PosPairedTerminalSchema, { status: HttpStatus.CREATED, description: "Terminal paired" })
	public pair(
		@CurrentActor({ allowAnonymous: true }) actor: ActorContext,
		@ZodBody(PosPairTerminalSchema) body: z.output<typeof PosPairTerminalSchema>,
	): Promise<PosPairedTerminal> {
		return this.commandBus.execute(new PairTerminalCommand(actor, body));
	}
}
