import { z } from "zod";

export const RollbackActionSchema = z.enum(["unpatch", "delete", "remove-directory"]);

export type RollbackAction = z.output<typeof RollbackActionSchema>;

export const RollbackPlanStepSchema = z
	.object({
		action: RollbackActionSchema,
		path: z.string().min(1),
		reason: z.string().min(1),
	})
	.strict();

export type RollbackPlanStep = z.output<typeof RollbackPlanStepSchema>;

export const RollbackPlanSchema = z
	.object({
		resource: z.string().min(1),
		steps: z.array(RollbackPlanStepSchema),
		warnings: z.array(z.string()),
		canRollback: z.boolean(),
	})
	.strict();

export type RollbackPlan = z.output<typeof RollbackPlanSchema>;

export const RollbackRecordSchema = z
	.object({
		resource: z.string().min(1),
		createdAt: z.string().min(1),
		definitionRelativePath: z.string().min(1),
		stashedPaths: z.array(z.string()),
		gitStashRef: z.string().nullable(),
		gitStashMessage: z.string().nullable(),
		hasSyncedSinceGenerate: z.boolean(),
		trackedFiles: z.array(z.string()),
	})
	.strict();

export type RollbackRecord = z.output<typeof RollbackRecordSchema>;

export const SharedPatchSnapshotSchema = z.record(z.string(), z.string());

export type SharedPatchSnapshot = z.output<typeof SharedPatchSnapshotSchema>;
