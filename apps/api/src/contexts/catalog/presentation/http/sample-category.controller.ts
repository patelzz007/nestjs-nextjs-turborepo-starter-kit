import { Controller, Delete, Get, HttpStatus, Patch, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { z } from "zod";

import {
	apiPath,
	BulkCreateSampleCategoryResponseSchema,
	BulkCreateSampleCategorySchema,
	BulkDeleteIdsSchema,
	BulkDeleteResultSchema,
	CreateSampleCategorySchema,
	DeleteSuccessDataSchema,
	SampleCategoryIdParamSchema,
	SampleCategoryListQuerySchema,
	SampleCategorySchema,
	type DeleteSuccessData,
	type SampleCategoryListQuery,
	UpdateSampleCategorySchema,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { Idempotent } from "../../../../platform/presentation/http/idempotency/idempotent.decorator";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { ZodBody, ZodListQuery, ZodParams } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { SampleCategoryApplicationService } from "../../application/services/sample-category.application-service";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";

/**
 * CRUD routes for sample categories. Every route is gated by
 * `@RequirePermission`; see docs/technical/authorization/backend.md
 * for layering kernel checks (ACL, policies, ownership) on top.
 */
@ApiTags("SampleCategory", "Sample Category")
@Controller(apiPath("/sample-category"))
export class SampleCategoryController {
	public constructor(private readonly service: SampleCategoryApplicationService) {}

	@RequirePermission("LIST", "SAMPLE_CATEGORY")
	@Get()
	@ApiOperation({ summary: "List SampleCategories" })
	@ZodPaginatedResponse(SampleCategorySchema, { description: "Paginated list of samplecategories" })
	public list(
		@CurrentActor() actor: ActorContext,
		@ZodListQuery(SampleCategoryListQuerySchema) query: SampleCategoryListQuery,
	): ReturnType<SampleCategoryApplicationService["list"]> {
		return this.service.list(actor, query);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("CREATE", "SAMPLE_CATEGORY")
	@Post("bulk")
	@ApiOperation({ summary: "Bulk create samplecategories" })
	@ZodResponse(BulkCreateSampleCategoryResponseSchema, { status: HttpStatus.CREATED, description: "Created samplecategories" })
	public bulkCreate(
		@CurrentActor() actor: ActorContext,
		@ZodBody(BulkCreateSampleCategorySchema) body: { items: z.output<typeof BulkCreateSampleCategorySchema>["items"] },
	): ReturnType<SampleCategoryApplicationService["createMany"]> {
		return this.service.createMany(actor, body.items);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("DELETE", "SAMPLE_CATEGORY")
	@Post("bulk-delete")
	@ApiOperation({ summary: "Bulk soft delete samplecategories" })
	@ZodResponse(BulkDeleteResultSchema, { status: HttpStatus.CREATED, description: "Bulk delete result" })
	public bulkDelete(@CurrentActor() actor: ActorContext, @ZodBody(BulkDeleteIdsSchema) body: { ids: string[] }): ReturnType<SampleCategoryApplicationService["deleteMany"]> {
		return this.service.deleteMany(actor, body.ids);
	}

	@RequirePermission("READ", "SAMPLE_CATEGORY")
	@Get(":id")
	@ApiOperation({ summary: "Get SampleCategory by id" })
	@ZodResponse(SampleCategorySchema, { description: "SampleCategory detail" })
	public get(@CurrentActor() actor: ActorContext, @ZodParams(SampleCategoryIdParamSchema) params: { id: string }): ReturnType<SampleCategoryApplicationService["getById"]> {
		return this.service.getById(actor, params.id);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("CREATE", "SAMPLE_CATEGORY")
	@Idempotent()
	@Post()
	@ApiOperation({ summary: "Create SampleCategory" })
	@ZodResponse(SampleCategorySchema, { status: HttpStatus.CREATED, description: "Created samplecategory" })
	public create(
		@CurrentActor() actor: ActorContext,
		@ZodBody(CreateSampleCategorySchema) body: z.output<typeof CreateSampleCategorySchema>,
	): ReturnType<SampleCategoryApplicationService["create"]> {
		return this.service.create(actor, body);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "SAMPLE_CATEGORY")
	@Patch(":id")
	@ApiOperation({ summary: "Update SampleCategory" })
	@ZodResponse(SampleCategorySchema, { description: "Updated samplecategory" })
	public update(
		@CurrentActor() actor: ActorContext,
		@ZodParams(SampleCategoryIdParamSchema) params: { id: string },
		@ZodBody(UpdateSampleCategorySchema) body: z.output<typeof UpdateSampleCategorySchema>,
	): ReturnType<SampleCategoryApplicationService["update"]> {
		return this.service.update(actor, params.id, body);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("DELETE", "SAMPLE_CATEGORY")
	@Delete(":id")
	@ApiOperation({ summary: "Soft delete SampleCategory" })
	@ZodResponse(DeleteSuccessDataSchema, { description: "SampleCategory deleted" })
	public async delete(@CurrentActor() actor: ActorContext, @ZodParams(SampleCategoryIdParamSchema) params: { id: string }): Promise<DeleteSuccessData> {
		await this.service.delete(actor, params.id);
		return { success: true };
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "SAMPLE_CATEGORY")
	@Post(":id/restore")
	@ApiOperation({ summary: "Restore SampleCategory" })
	@ZodResponse(SampleCategorySchema, { status: HttpStatus.CREATED, description: "Restored samplecategory" })
	public restore(
		@CurrentActor() actor: ActorContext,
		@ZodParams(SampleCategoryIdParamSchema) params: { id: string },
	): ReturnType<SampleCategoryApplicationService["restore"]> {
		return this.service.restore(actor, params.id);
	}
}
