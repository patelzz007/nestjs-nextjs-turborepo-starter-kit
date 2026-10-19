import { Controller, Get, Patch } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	apiPath,
	FileDownloadDispositionSchema,
	MerchantKybDocumentDownloadResponseSchema,
	MerchantKybProfileResponseSchema,
	MerchantKybSubmissionFieldsSchema,
	OrganizationSlugParamSchema,
	UuidParamSchema,
	type MerchantKybDocumentDownloadResponse,
	type MerchantKybProfileResponse,
} from "@workspace/shared";
import { z } from "zod";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { SkipAuthThrottle } from "../../../../platform/presentation/http/security/decorators/skip-auth-throttle.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodParams, ZodQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { SubmitKybCommand } from "../../application/commands/submit-kyb/submit-kyb.command";
import { GetKybDocumentDownloadUrlQuery } from "../../application/queries/get-kyb-document-download-url/get-kyb-document-download-url.query";
import { GetKybProfileQuery } from "../../application/queries/get-kyb-profile/get-kyb-profile.query";

@ApiTags("Organization KYB")
@ApiBearerAuth()
@Controller(apiPath("/orgs/:orgSlug/kyb"))
export class OrganizationKybController {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	@SkipAuthThrottle()
	@Get()
	@ApiOperation({ summary: "Get the organization KYB profile (owner only)" })
	@ZodResponse(MerchantKybProfileResponseSchema, { description: "Organization KYB profile" })
	public getProfile(
		@CurrentActor() actor: ActorContext,
		@ZodParams(OrganizationSlugParamSchema) params: z.output<typeof OrganizationSlugParamSchema>,
	): Promise<MerchantKybProfileResponse> {
		return this.queryBus.execute(new GetKybProfileQuery(actor, params));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Patch()
	@ApiOperation({ summary: "Submit or resubmit business verification details (owner only)" })
	@ZodResponse(MerchantKybProfileResponseSchema, { description: "Updated organization KYB profile" })
	public submitKyb(
		@CurrentActor() actor: ActorContext,
		@ZodParams(OrganizationSlugParamSchema) params: z.output<typeof OrganizationSlugParamSchema>,
		@ZodBody(MerchantKybSubmissionFieldsSchema) body: z.output<typeof MerchantKybSubmissionFieldsSchema>,
	): Promise<MerchantKybProfileResponse> {
		return this.commandBus.execute(new SubmitKybCommand(actor, { ...body, orgSlug: params.orgSlug }));
	}

	/** KYB documents need `merchant:manage_verification` (owner-only), like the profile they belong to. */
	@Get("documents/:documentId/download")
	@ApiOperation({ summary: "Get a short-lived signed download URL for a CLEAN KYB document (owner only)" })
	@ZodResponse(MerchantKybDocumentDownloadResponseSchema, { description: "Signed download URL or scan status" })
	public downloadDocument(
		@CurrentActor() actor: ActorContext,
		@ZodParams(OrganizationSlugParamSchema.extend({ documentId: UuidParamSchema }).strict()) params: { orgSlug: string; documentId: string },
		@ZodQuery(z.object({ disposition: FileDownloadDispositionSchema.optional() }).strict()) query: { disposition?: "inline" | "attachment" },
	): Promise<MerchantKybDocumentDownloadResponse> {
		return this.queryBus.execute(
			new GetKybDocumentDownloadUrlQuery(actor, {
				requester: { kind: "member", orgSlug: params.orgSlug },
				documentId: params.documentId,
				disposition: query.disposition ?? "inline",
			}),
		);
	}
}
