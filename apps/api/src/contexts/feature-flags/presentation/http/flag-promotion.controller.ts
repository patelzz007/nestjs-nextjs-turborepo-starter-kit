// ============================================
// presentation/http/flag-promotion.controller.ts — rule promotion between environments (ADR 087)
// ============================================
// Export a live revision as a file here; preview, then import it in another environment, where it becomes a new
// revision (pending in production). FEATURE_FLAG:LIST to export and preview, UPDATE to import (with a reason).
// Config files need the same permissions: promotion is one workflow for both kinds.

import { Controller, Get, HttpCode, HttpStatus, Inject, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	apiPath,
	PromotionExportQuerySchema,
	PromotionFileSchema,
	PromotionImportInputSchema,
	PromotionPreviewInputSchema,
	PromotionPreviewSchema,
	RevisionSchema,
	type PromotionExportQuery,
	type PromotionFile,
	type PromotionImportInput,
	type PromotionPreview,
	type PromotionPreviewInput,
	type Revision,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { AdminAccessOnly } from "../../../../platform/presentation/http/security/decorators/admin-access.decorator";
import { PlatformOperation } from "../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { FEATURE_FLAGS_READ_OPERATION, FEATURE_FLAGS_WRITE_OPERATION } from "../../application/ports/feature-flags.operations";
import type { PromotionService } from "../../application/services/promotion.service";
import { PROMOTIONS } from "../../feature-flags.tokens";

@ApiTags("Feature flags")
@ApiBearerAuth()
@AdminAccessOnly("Rule promotion is for the admin console.")
@Controller(apiPath("/admin/feature-flags"))
export class FlagPromotionController {
	public constructor(@Inject(PROMOTIONS) private readonly promotions: PromotionService) {}

	@RequirePermission("LIST", "FEATURE_FLAG")
	@Get("promotion/export")
	@PlatformOperation(FEATURE_FLAGS_READ_OPERATION)
	@ApiOperation({ summary: "A flag's or config's live revision as a promotion file, with the condition groups its rules name" })
	@ZodResponse(PromotionFileSchema, { description: "The file" })
	public export(@CurrentActor() actor: ActorContext, @ZodQuery(PromotionExportQuerySchema) query: PromotionExportQuery): Promise<PromotionFile> {
		return this.promotions.export(actor, query);
	}

	@RequirePermission("LIST", "FEATURE_FLAG")
	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post("promotion/preview")
	@HttpCode(HttpStatus.OK)
	@PlatformOperation(FEATURE_FLAGS_READ_OPERATION)
	@ApiOperation({ summary: "What importing a promotion file would change here: the rules side by side, groups new or changed, listed groups missing" })
	@ZodResponse(PromotionPreviewSchema, { description: "The difference" })
	public preview(@CurrentActor() actor: ActorContext, @ZodBody(PromotionPreviewInputSchema) input: PromotionPreviewInput): Promise<PromotionPreview> {
		return this.promotions.preview(actor, input.file);
	}

	@RequirePermission("UPDATE", "FEATURE_FLAG")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Post("promotion/import")
	@PlatformOperation(FEATURE_FLAGS_WRITE_OPERATION)
	@ApiOperation({
		summary: "Import a promotion file as a new revision, with a reason (pending in production)",
		description: "422 PROMOTION_INVALID for a file from this environment, or naming listed groups this environment lacks.",
	})
	@ZodResponse(RevisionSchema, { status: HttpStatus.CREATED, description: "The new revision" })
	public import(@CurrentActor() actor: ActorContext, @ZodBody(PromotionImportInputSchema) input: PromotionImportInput): Promise<Revision> {
		return this.promotions.import(actor, input.file, input.reason);
	}
}
