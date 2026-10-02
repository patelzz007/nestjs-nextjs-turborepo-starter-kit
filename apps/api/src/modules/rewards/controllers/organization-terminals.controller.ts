import { Controller, Delete, Get, HttpStatus, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
	apiContract,
	apiPath,
	MerchantCreateTerminalSchema,
	MerchantTerminalListQuerySchema,
	MerchantTerminalPairingSchema,
	MerchantTerminalSettingsResponseSchema,
	MerchantTerminalSettingsSchema,
	MerchantTerminalSummarySchema,
	OkResponseSchema,
	OrganizationSlugParamSchema,
	PosPairedTerminalSchema,
	PosPairTerminalSchema,
} from "@workspace/shared";
import type { z } from "zod";

import { ZodBody, ZodListQuery, ZodParams } from "../../../common/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../common/decorators/zod-response.decorators";
import { GetUser } from "../../auth/decorators/get-user.decorator";
import { Public } from "../../auth/decorators/public.decorator";
import { RlsBypass } from "../../auth/decorators/rls-bypass.decorator";
import { SkipAuthThrottle } from "../../auth/decorators/skip-auth-throttle.decorator";
import { SkipMutationIntent } from "../../auth/decorators/skip-mutation-intent.decorator";
import type { AccessTokenPayload } from "../../auth/services/token.service";
import { RewardsEmptyBodyDto } from "../dtos/rewards.dto";
import { MerchantTerminalService } from "../services/merchant-terminal.service";
import { PosPairingService } from "../services/pos-pairing.service";

type TerminalParams = z.output<typeof apiContract.organizations.terminals.remove.input>;

/** Pairing attempts allowed per client IP per window — codes are 32⁸ values, live 15 minutes and single use. */
const PAIRING_ATTEMPTS_PER_WINDOW = 5;
/** The pairing rate-limit window (one minute). */
const PAIRING_WINDOW_MS = 60_000;

@ApiTags("Organization POS Terminals")
@ApiBearerAuth()
@Controller(apiPath("/orgs/:orgSlug/terminals"))
export class OrganizationTerminalsController {
	public constructor(private readonly terminals: MerchantTerminalService) {}

	@SkipAuthThrottle()
	@Get()
	@ApiOperation({ summary: "List the organization's POS terminals" })
	@ZodPaginatedResponse(MerchantTerminalSummarySchema, { description: "Paginated POS terminals; pagination is in `meta`" })
	public list(
		@GetUser() user: AccessTokenPayload,
		@ZodParams(OrganizationSlugParamSchema) params: z.output<typeof OrganizationSlugParamSchema>,
		@ZodListQuery(MerchantTerminalListQuerySchema) query: z.output<typeof MerchantTerminalListQuerySchema>,
	): ReturnType<MerchantTerminalService["list"]> {
		return this.terminals.list(user.sub, params.orgSlug, query);
	}

	@Post()
	@ApiOperation({ summary: "Register a POS terminal at a store and get its one-time pairing code" })
	@ZodResponse(MerchantTerminalPairingSchema, { status: HttpStatus.CREATED, description: "Terminal registered; the pairing code is shown once" })
	public create(
		@GetUser() user: AccessTokenPayload,
		@ZodParams(OrganizationSlugParamSchema) params: z.output<typeof OrganizationSlugParamSchema>,
		@ZodBody(MerchantCreateTerminalSchema) body: z.output<typeof MerchantCreateTerminalSchema>,
	): ReturnType<MerchantTerminalService["create"]> {
		return this.terminals.create(user.sub, params.orgSlug, body);
	}

	@SkipAuthThrottle()
	@Get("settings")
	@ApiOperation({ summary: "Read the organization's POS terminal policy" })
	@ZodResponse(MerchantTerminalSettingsResponseSchema, { description: "POS terminal settings" })
	public getSettings(
		@GetUser() user: AccessTokenPayload,
		@ZodParams(OrganizationSlugParamSchema) params: z.output<typeof OrganizationSlugParamSchema>,
	): ReturnType<MerchantTerminalService["getSettings"]> {
		return this.terminals.getSettings(user.sub, params.orgSlug);
	}

	@Patch("settings")
	@ApiOperation({ summary: "Turn 'only allow registered terminals' on or off" })
	@ZodResponse(MerchantTerminalSettingsResponseSchema, { description: "POS terminal settings updated" })
	public updateSettings(
		@GetUser() user: AccessTokenPayload,
		@ZodParams(OrganizationSlugParamSchema) params: z.output<typeof OrganizationSlugParamSchema>,
		@ZodBody(MerchantTerminalSettingsSchema) body: z.output<typeof MerchantTerminalSettingsSchema>,
	): ReturnType<MerchantTerminalService["updateSettings"]> {
		return this.terminals.updateSettings(user.sub, params.orgSlug, body);
	}

	@Post(":id/pairing-code")
	@ApiOperation({ summary: "Issue a new pairing code (first pairing, expired code, or re-pair — the old key stops working once the new code is used)" })
	@ApiBody({ type: RewardsEmptyBodyDto, required: false })
	@ZodResponse(MerchantTerminalPairingSchema, { status: HttpStatus.CREATED, description: "New pairing code (shown once)" })
	public issuePairingCode(
		@GetUser() user: AccessTokenPayload,
		@ZodParams(apiContract.organizations.terminals.pairingCode.input) params: TerminalParams,
	): ReturnType<MerchantTerminalService["issuePairingCode"]> {
		return this.terminals.issuePairingCode(user.sub, params.orgSlug, params.id);
	}

	@Delete(":id")
	@ApiOperation({ summary: "Remove a POS terminal and revoke its API key" })
	@ZodResponse(OkResponseSchema, { description: "Terminal removed" })
	public remove(
		@GetUser() user: AccessTokenPayload,
		@ZodParams(apiContract.organizations.terminals.remove.input) params: TerminalParams,
	): ReturnType<MerchantTerminalService["remove"]> {
		return this.terminals.remove(user.sub, params.orgSlug, params.id);
	}
}

/**
 * The till's side of pairing. Public (the till has no credential yet), not a
 * browser flow (no CSRF intent header), rate-limited per client IP.
 */
@ApiTags("POS")
@SkipMutationIntent()
@Controller(apiPath("/pos/terminals"))
export class PosTerminalsController {
	public constructor(private readonly pairing: PosPairingService) {}

	@Public()
	@RlsBypass()
	@Throttle({ strict: { ttl: PAIRING_WINDOW_MS, limit: PAIRING_ATTEMPTS_PER_WINDOW } })
	@Post("pair")
	@ApiOperation({
		summary: "Pair a POS terminal with the one-time code from the merchant console",
		description: "Returns the terminal's own API key (shown once). Send it as X-API-Key on every redemption call; X-Terminal-Id is then optional.",
	})
	@ZodResponse(PosPairedTerminalSchema, { status: HttpStatus.CREATED, description: "Terminal paired" })
	public pair(@ZodBody(PosPairTerminalSchema) body: z.output<typeof PosPairTerminalSchema>): ReturnType<PosPairingService["pair"]> {
		return this.pairing.pair(body);
	}
}
