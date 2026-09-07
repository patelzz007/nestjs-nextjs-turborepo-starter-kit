import { z } from "zod";

/** Scalar field types supported by the resource DSL. */
export const ResourceScalarTypeSchema = z.enum(["string", "text", "boolean", "int", "decimal", "uuid", "datetime", "enum", "relation"]);

export type ResourceScalarType = z.output<typeof ResourceScalarTypeSchema>;

export const RlsPolicySchema = z.enum(["user-owned", "organization-scoped", "admin-only", "public-read"]);

export type RlsPolicy = z.output<typeof RlsPolicySchema>;

export const RelationCardinalitySchema = z.enum(["one", "many"]);

export type RelationCardinality = z.output<typeof RelationCardinalitySchema>;

export const ResourceFieldDefinitionSchema = z
	.object({
		type: ResourceScalarTypeSchema,
		required: z.boolean().optional(),
		nullable: z.boolean().optional(),
		default: z.union([z.string(), z.number(), z.boolean()]).optional(),
		searchable: z.boolean().optional(),
		sortable: z.boolean().optional(),
		filterable: z.boolean().optional(),
		min: z.number().optional(),
		max: z.number().optional(),
		values: z.array(z.string()).optional(),
		relation: z
			.object({
				model: z.string().min(1),
				field: z.string().min(1),
				cardinality: RelationCardinalitySchema.optional(),
				cascadeSoftDelete: z.boolean().optional(),
			})
			.optional(),
	})
	.strict();

export type ResourceFieldDefinition = z.output<typeof ResourceFieldDefinitionSchema>;

export const WorkflowTransitionMapSchema = z.record(z.string(), z.array(z.string()));

export type WorkflowTransitionMap = z.output<typeof WorkflowTransitionMapSchema>;

export const UiNavigationSchema = z
	.object({
		label: z.string().min(1),
		icon: z.string().min(1).optional(),
		group: z.string().min(1).optional(),
		order: z.number().int().optional(),
		hiddenInProduction: z.boolean().optional(),
	})
	.strict();

export const UiListSchema = z
	.object({
		searchable: z.array(z.string()).optional(),
		filters: z.array(z.string()).optional(),
		sortable: z.array(z.string()).optional(),
		columns: z.array(z.string()).optional(),
	})
	.strict();

export const UiFormSchema = z
	.object({
		layout: z.enum(["single-column", "two-column"]).optional(),
		fields: z.array(z.string()).optional(),
	})
	.strict();

export const UiModuleConfigSchema = z
	.object({
		navigation: UiNavigationSchema.optional(),
		list: UiListSchema.optional(),
		form: UiFormSchema.optional(),
	})
	.strict();

export type UiModuleConfig = z.output<typeof UiModuleConfigSchema>;

export const ResourceScopeSchema = z
	.object({
		api: z.boolean(),
		shared: z.boolean(),
		client: z.boolean(),
		ui: z.array(z.string().min(1)),
	})
	.strict();

export type ResourceScope = z.output<typeof ResourceScopeSchema>;

export const ResourceDefinitionSchema = z
	.object({
		version: z.number().int().positive().default(2),
		name: z.string().min(1),
		scope: ResourceScopeSchema,
		model: z
			.object({
				name: z.string().min(1),
				softDelete: z.boolean().optional(),
				concurrency: z.boolean().optional(),
				idempotency: z.boolean().optional(),
				rls: RlsPolicySchema,
				fields: z.record(z.string(), ResourceFieldDefinitionSchema),
			})
			.strict(),
		workflow: z
			.object({
				field: z.string().min(1),
				initial: z.string().min(1),
				transitions: WorkflowTransitionMapSchema,
			})
			.optional(),
		permissions: z
			.object({
				create: z.boolean().optional(),
				read: z.boolean().optional(),
				update: z.boolean().optional(),
				delete: z.boolean().optional(),
				list: z.boolean().optional(),
				manage: z.boolean().optional(),
			})
			.optional(),
		ui: z.record(z.string(), UiModuleConfigSchema).optional(),
		events: z
			.object({
				created: z.boolean().optional(),
				updated: z.boolean().optional(),
				deleted: z.boolean().optional(),
			})
			.optional(),
		audit: z.boolean().optional(),
	})
	.strict()
	.superRefine((definition, ctx) => {
		const uiKeys = Object.keys(definition.ui ?? {});
		const scopeUi = definition.scope.ui;
		for (const moduleId of scopeUi) {
			if (!uiKeys.includes(moduleId)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: `scope.ui includes "${moduleId}" but ui.${moduleId} is missing`,
					path: ["scope", "ui"],
				});
			}
		}
		for (const moduleId of uiKeys) {
			if (!scopeUi.includes(moduleId)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: `ui.${moduleId} is defined but not listed in scope.ui`,
					path: ["ui", moduleId],
				});
			}
		}
		if (scopeUi.length > 0 && (definition.ui === undefined || Object.keys(definition.ui).length === 0)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "scope.ui is non-empty but no ui module blocks were provided",
				path: ["ui"],
			});
		}
	});

export type ResourceDefinition = z.output<typeof ResourceDefinitionSchema>;

/** Helper used in documentation and tests; definitions are parsed statically from `.resource.ts` files. */
export function defineResource(definition: ResourceDefinition): ResourceDefinition {
	return ResourceDefinitionSchema.parse(definition);
}
