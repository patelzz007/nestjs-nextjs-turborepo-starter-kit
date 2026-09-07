import { z } from "zod";

import { RelationCardinalitySchema, ResourceScalarTypeSchema, RlsPolicySchema } from "./resource-definition";

const FIELD_NAME_PATTERN = /^[a-z][a-zA-Z0-9]*$/;
const RESOURCE_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9\s_-]*$/;

export const WizardFieldRelationSchema = z
	.object({
		model: z.string().min(1),
		field: z.string().min(1),
		cardinality: RelationCardinalitySchema.optional(),
	})
	.strict();

export const WizardFieldInputSchema = z
	.object({
		name: z.string().regex(FIELD_NAME_PATTERN),
		type: ResourceScalarTypeSchema,
		required: z.boolean(),
		nullable: z.boolean(),
		searchable: z.boolean(),
		sortable: z.boolean(),
		filterable: z.boolean(),
		defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
		enumValues: z.array(z.string().min(1)).optional(),
		relation: WizardFieldRelationSchema.optional(),
	})
	.strict();

export const WizardResourceInputSchema = z
	.object({
		name: z
			.string()
			.min(1)
			.max(64)
			.regex(RESOURCE_NAME_PATTERN, "Name must start with a letter and contain only letters, numbers, spaces, hyphens, and underscores"),
		rls: RlsPolicySchema,
		softDelete: z.boolean(),
		concurrency: z.boolean(),
		idempotency: z.boolean(),
		fields: z.array(WizardFieldInputSchema).min(1),
		generateUi: z.boolean(),
		uiModules: z.array(z.string().min(1)),
		navigationLabel: z.string().min(1),
	})
	.strict()
	.superRefine((input, ctx) => {
		if (input.generateUi && input.uiModules.length === 0) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Select at least one UI module when generating UI",
				path: ["uiModules"],
			});
		}
		if (!input.generateUi && input.uiModules.length > 0) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "uiModules must be empty when generateUi is false",
				path: ["uiModules"],
			});
		}
	});

export type WizardFieldInput = z.output<typeof WizardFieldInputSchema>;
export type WizardResourceInput = z.output<typeof WizardResourceInputSchema>;
