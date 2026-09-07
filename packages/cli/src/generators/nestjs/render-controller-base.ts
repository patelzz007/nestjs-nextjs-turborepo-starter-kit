import type { ResourceIR } from "../../ir/types";

export function renderNestControllerBase(ir: ResourceIR): string {
	const model = ir.resource.modelName;
	const slug = ir.resource.slug;
	const resource = ir.resource.permissionResource;
	const transitionEndpoint = ir.workflow
		? `
	@RequirePermission("UPDATE", "${resource}")
	@Post(":id/transitions/:transition")
	@ApiOperation({ summary: "Transition ${ir.resource.singular} workflow" })
	public transition(
		@Param(new ZodValidationPipe(${model}TransitionParamSchema)) params: { id: string; transition: ${model}Status },
		@Body(new ZodValidationPipe(${model}TransitionBodySchema)) body: { expectedVersion: number; idempotencyKey: string },
	): ReturnType<${model}Service["transition"]> {
		return this.service.transition(params.id, params.transition, body);
	}
`
		: "";
	const workflowImports = ir.workflow ? `, ${model}TransitionBodySchema, ${model}TransitionParamSchema` : "";

	return `import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { apiPath, BulkCreate${model}Schema, BulkDeleteIdsSchema, Create${model}Schema, ${model}IdParamSchema, ${model}ListQuerySchema, Update${model}Schema${workflowImports}${ir.workflow ? `, type ${model}Status` : ""} } from "@workspace/shared";

import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { RequirePermission } from "../auth/decorators/require-permission.decorator";

import { ${model}Service } from "./${slug}.service";

@ApiTags("${model}")
@Controller(apiPath("/${slug}"))
export class Generated${model}Controller {
	public constructor(protected readonly service: ${model}Service) {}

	@RequirePermission("LIST", "${resource}")
	@Get()
	@ApiOperation({ summary: "List ${ir.resource.plural}" })
	@ApiOkResponse({ description: "Paginated list of ${ir.resource.plural.toLowerCase()}" })
	public list(@Query(new ZodValidationPipe(${model}ListQuerySchema)) query: Parameters<${model}Service["list"]>[0]): ReturnType<${model}Service["list"]> {
		return this.service.list(query);
	}

	@RequirePermission("CREATE", "${resource}")
	@Post("bulk")
	@ApiOperation({ summary: "Bulk create ${ir.resource.plural.toLowerCase()}" })
	@ApiOkResponse({ description: "Created ${ir.resource.plural.toLowerCase()}" })
	public bulkCreate(@Body(new ZodValidationPipe(BulkCreate${model}Schema)) body: { items: Parameters<${model}Service["createMany"]>[0] }): ReturnType<${model}Service["createMany"]> {
		return this.service.createMany(body.items);
	}

	@RequirePermission("DELETE", "${resource}")
	@Post("bulk-delete")
	@ApiOperation({ summary: "Bulk soft delete ${ir.resource.plural.toLowerCase()}" })
	@ApiOkResponse({ description: "Bulk delete result" })
	public bulkDelete(@Body(new ZodValidationPipe(BulkDeleteIdsSchema)) body: { ids: string[] }): ReturnType<${model}Service["deleteMany"]> {
		return this.service.deleteMany(body.ids);
	}

	@RequirePermission("READ", "${resource}")
	@Get(":id")
	@ApiOperation({ summary: "Get ${ir.resource.singular} by id" })
	@ApiOkResponse({ description: "${ir.resource.singular} detail" })
	public get(@Param(new ZodValidationPipe(${model}IdParamSchema)) params: { id: string }): ReturnType<${model}Service["getById"]> {
		return this.service.getById(params.id);
	}

	@RequirePermission("CREATE", "${resource}")
	@Post()
	@ApiOperation({ summary: "Create ${ir.resource.singular}" })
	@ApiOkResponse({ description: "Created ${ir.resource.singular.toLowerCase()}" })
	public create(@Body(new ZodValidationPipe(Create${model}Schema)) body: Parameters<${model}Service["create"]>[0]): ReturnType<${model}Service["create"]> {
		return this.service.create(body);
	}

	@RequirePermission("UPDATE", "${resource}")
	@Patch(":id")
	@ApiOperation({ summary: "Update ${ir.resource.singular}" })
	@ApiOkResponse({ description: "Updated ${ir.resource.singular.toLowerCase()}" })
	public update(
		@Param(new ZodValidationPipe(${model}IdParamSchema)) params: { id: string },
		@Body(new ZodValidationPipe(Update${model}Schema)) body: Parameters<${model}Service["update"]>[1],
	): ReturnType<${model}Service["update"]> {
		return this.service.update(params.id, body);
	}

	@RequirePermission("DELETE", "${resource}")
	@Delete(":id")
	@ApiOperation({ summary: "Soft delete ${ir.resource.singular}" })
	@ApiOkResponse({ description: "${ir.resource.singular} deleted" })
	public async delete(@Param(new ZodValidationPipe(${model}IdParamSchema)) params: { id: string }): Promise<{ success: true }> {
		await this.service.delete(params.id);
		return { success: true };
	}

	@RequirePermission("UPDATE", "${resource}")
	@Post(":id/restore")
	@ApiOperation({ summary: "Restore ${ir.resource.singular}" })
	@ApiOkResponse({ description: "Restored ${ir.resource.singular.toLowerCase()}" })
	public restore(@Param(new ZodValidationPipe(${model}IdParamSchema)) params: { id: string }): ReturnType<${model}Service["restore"]> {
		return this.service.restore(params.id);
	}
${transitionEndpoint}
}
`;
}
