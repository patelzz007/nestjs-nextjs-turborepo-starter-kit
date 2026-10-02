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

import { ZodBody, ZodListQuery, ZodParams } from "../../common/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../common/decorators/zod-response.decorators";
import { RequirePermission } from "../auth/decorators/require-permission.decorator";

import { SampleCategoryService } from "./sample-category.service";

/**
 * CRUD routes for sample categories. Every route is gated by
 * `@RequirePermission`; see /docs/authorization-kernel-integration-guide.md
 * for layering kernel checks (ACL, policies, ownership) on top.
 */
@ApiTags("SampleCategory", "Sample Category")
@Controller(apiPath("/sample-category"))
export class SampleCategoryController {
	public constructor(private readonly service: SampleCategoryService) {}

	@RequirePermission("LIST", "SAMPLE_CATEGORY")
	@Get()
	@ApiOperation({ summary: "List SampleCategories" })
	@ZodPaginatedResponse(SampleCategorySchema, { description: "Paginated list of samplecategories" })
	public list(@ZodListQuery(SampleCategoryListQuerySchema) query: SampleCategoryListQuery): ReturnType<SampleCategoryService["list"]> {
		return this.service.list(query);
	}

	@RequirePermission("CREATE", "SAMPLE_CATEGORY")
	@Post("bulk")
	@ApiOperation({ summary: "Bulk create samplecategories" })
	@ZodResponse(BulkCreateSampleCategoryResponseSchema, { status: HttpStatus.CREATED, description: "Created samplecategories" })
	public bulkCreate(
		@ZodBody(BulkCreateSampleCategorySchema) body: { items: z.output<typeof BulkCreateSampleCategorySchema>["items"] },
	): ReturnType<SampleCategoryService["createMany"]> {
		return this.service.createMany(body.items);
	}

	@RequirePermission("DELETE", "SAMPLE_CATEGORY")
	@Post("bulk-delete")
	@ApiOperation({ summary: "Bulk soft delete samplecategories" })
	@ZodResponse(BulkDeleteResultSchema, { status: HttpStatus.CREATED, description: "Bulk delete result" })
	public bulkDelete(@ZodBody(BulkDeleteIdsSchema) body: { ids: string[] }): ReturnType<SampleCategoryService["deleteMany"]> {
		return this.service.deleteMany(body.ids);
	}

	@RequirePermission("READ", "SAMPLE_CATEGORY")
	@Get(":id")
	@ApiOperation({ summary: "Get SampleCategory by id" })
	@ZodResponse(SampleCategorySchema, { description: "SampleCategory detail" })
	public get(@ZodParams(SampleCategoryIdParamSchema) params: { id: string }): ReturnType<SampleCategoryService["getById"]> {
		return this.service.getById(params.id);
	}

	@RequirePermission("CREATE", "SAMPLE_CATEGORY")
	@Post()
	@ApiOperation({ summary: "Create SampleCategory" })
	@ZodResponse(SampleCategorySchema, { status: HttpStatus.CREATED, description: "Created samplecategory" })
	public create(@ZodBody(CreateSampleCategorySchema) body: z.output<typeof CreateSampleCategorySchema>): ReturnType<SampleCategoryService["create"]> {
		return this.service.create(body);
	}

	@RequirePermission("UPDATE", "SAMPLE_CATEGORY")
	@Patch(":id")
	@ApiOperation({ summary: "Update SampleCategory" })
	@ZodResponse(SampleCategorySchema, { description: "Updated samplecategory" })
	public update(
		@ZodParams(SampleCategoryIdParamSchema) params: { id: string },
		@ZodBody(UpdateSampleCategorySchema) body: z.output<typeof UpdateSampleCategorySchema>,
	): ReturnType<SampleCategoryService["update"]> {
		return this.service.update(params.id, body);
	}

	@RequirePermission("DELETE", "SAMPLE_CATEGORY")
	@Delete(":id")
	@ApiOperation({ summary: "Soft delete SampleCategory" })
	@ZodResponse(DeleteSuccessDataSchema, { description: "SampleCategory deleted" })
	public async delete(@ZodParams(SampleCategoryIdParamSchema) params: { id: string }): Promise<DeleteSuccessData> {
		await this.service.delete(params.id);
		return { success: true };
	}

	@RequirePermission("UPDATE", "SAMPLE_CATEGORY")
	@Post(":id/restore")
	@ApiOperation({ summary: "Restore SampleCategory" })
	@ZodResponse(SampleCategorySchema, { status: HttpStatus.CREATED, description: "Restored samplecategory" })
	public restore(@ZodParams(SampleCategoryIdParamSchema) params: { id: string }): ReturnType<SampleCategoryService["restore"]> {
		return this.service.restore(params.id);
	}
}
