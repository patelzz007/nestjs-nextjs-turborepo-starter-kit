import { Controller, Get, HttpStatus, Post, UseInterceptors } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	apiContract,
	apiPath,
	MerchantApiKeyCreatedSchema,
	MerchantApiKeyListQuerySchema,
	MerchantApiKeySummarySchema,
	MerchantCreateApiKeySchema,
	OkResponseSchema,
	OrganizationSlugParamSchema,
	type MerchantApiKeyCreated,
	type MerchantApiKeySummary,
	type OkResponse,
	type PaginatedServiceResult,
} from "@workspace/shared";
import type { z } from "zod";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { MerchantActor } from "../../../../platform/presentation/http/security/api-keys/merchant-actor";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { GetMerchantActor } from "../../../../platform/presentation/http/security/decorators/get-merchant-actor.decorator";
import { SkipAuthThrottle } from "../../../../platform/presentation/http/security/decorators/skip-auth-throttle.decorator";
import { MerchantActorInterceptor } from "../../../../platform/presentation/http/security/interceptors/merchant-actor.interceptor";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodListQuery, ZodParams } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { IssueApiKeyCommand } from "../../application/commands/issue-api-key/issue-api-key.command";
import { RevokeApiKeyCommand } from "../../application/commands/revoke-api-key/revoke-api-key.command";
import { ListApiKeysQuery } from "../../application/queries/list-api-keys/list-api-keys.query";
import { PosEmptyBodyDto } from "./pos-empty-body.dto";

/** The merchant console's API keys (members only; the organization comes from `:orgSlug` through the membership). */
@ApiTags("Organization API Keys")
@ApiBearerAuth()
@UseInterceptors(MerchantActorInterceptor)
@Controller(apiPath("/orgs/:orgSlug/api-keys"))
export class OrganizationApiKeysController {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	@SkipAuthThrottle()
	@Get()
	@ApiOperation({ summary: "List organization API keys" })
	@ZodPaginatedResponse(MerchantApiKeySummarySchema, { description: "Paginated API key summaries; pagination is in `meta`" })
	public listKeys(
		@CurrentActor() actor: ActorContext,
		@GetMerchantActor() merchant: MerchantActor,
		@ZodParams(OrganizationSlugParamSchema) _params: z.output<typeof OrganizationSlugParamSchema>,
		@ZodListQuery(MerchantApiKeyListQuerySchema) query: z.output<typeof MerchantApiKeyListQuerySchema>,
	): Promise<PaginatedServiceResult<MerchantApiKeySummary>> {
		return this.queryBus.execute(new ListApiKeysQuery(actor, { ...query, organizationId: merchant.organizationId }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post()
	@ApiOperation({ summary: "Create a POS API key" })
	@ZodResponse(MerchantApiKeyCreatedSchema, { status: HttpStatus.CREATED, description: "API key created (shown once)" })
	public createKey(
		@CurrentActor() actor: ActorContext,
		@GetMerchantActor() merchant: MerchantActor,
		@ZodParams(OrganizationSlugParamSchema) _params: z.output<typeof OrganizationSlugParamSchema>,
		@ZodBody(MerchantCreateApiKeySchema) body: z.output<typeof MerchantCreateApiKeySchema>,
	): Promise<MerchantApiKeyCreated> {
		return this.commandBus.execute(new IssueApiKeyCommand(actor, { ...body, organizationId: merchant.organizationId }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":keyId/revoke")
	@ApiOperation({ summary: "Revoke a POS API key (no body required)" })
	@ApiBody({ type: PosEmptyBodyDto, required: false })
	@ZodResponse(OkResponseSchema, { status: HttpStatus.CREATED, description: "API key revoked" })
	public revokeKey(
		@CurrentActor() actor: ActorContext,
		@GetMerchantActor() merchant: MerchantActor,
		@ZodParams(apiContract.organizations.apiKeys.revoke.input) params: z.output<typeof apiContract.organizations.apiKeys.revoke.input>,
	): Promise<OkResponse> {
		return this.commandBus.execute(new RevokeApiKeyCommand(actor, { organizationId: merchant.organizationId, keyId: params.keyId }));
	}
}
