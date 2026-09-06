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
			})
			.optional(),
	})
	.strict();

export type ResourceFieldDefinition = z.output<typeof ResourceFieldDefinitionSchema>;

export const WorkflowTransitionMapSchema = z.record(z.string(), z.array(z.string()));

export type WorkflowTransitionMap = z.output<typeof WorkflowTransitionMapSchema>;

export const ResourceDefinitionSchema = z
	.object({
		version: z.number().int().positive().default(1),
		name: z.string().min(1),
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
		admin: z
			.object({
				navigation: z
					.object({
						label: z.string().min(1),
						icon: z.string().min(1).optional(),
						group: z.string().min(1).optional(),
						order: z.number().int().optional(),
						hiddenInProduction: z.boolean().optional(),
					})
					.optional(),
				list: z
					.object({
						searchable: z.array(z.string()).optional(),
						filters: z.array(z.string()).optional(),
						sortable: z.array(z.string()).optional(),
						columns: z.array(z.string()).optional(),
					})
					.optional(),
				form: z
					.object({
						layout: z.enum(["single-column", "two-column"]).optional(),
						fields: z.array(z.string()).optional(),
					})
					.optional(),
			})
			.optional(),
		events: z
			.object({
				created: z.boolean().optional(),
				updated: z.boolean().optional(),
				deleted: z.boolean().optional(),
			})
			.optional(),
		audit: z.boolean().optional(),
	})
	.strict();

export type ResourceDefinition = z.output<typeof ResourceDefinitionSchema>;

/** Helper used in documentation and tests; definitions are parsed statically from `.resource.ts` files. */
export function defineResource(definition: ResourceDefinition): ResourceDefinition {
	return ResourceDefinitionSchema.parse(definition);
}
