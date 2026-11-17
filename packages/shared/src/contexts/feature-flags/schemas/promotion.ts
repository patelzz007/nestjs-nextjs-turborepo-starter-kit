import { z } from "zod";

import { EpochMsSchema } from "../../../schemas/api/common";
import { DeploymentEnvironmentSchema, FlagGroupKeySchema } from "./conditions";
import { FlagGroupConditionsSchema } from "./flag-groups";
import { DynamicConfigKeySchema } from "./dynamic-configs";
import { RevisionSchema } from "./admin";
import { FeatureFlagKeySchema } from "./registry";
import { ChangeReasonSchema, ConfigRevisionContentSchema, FlagRevisionContentSchema } from "./rules";

// ── Rule promotion (GLOSSARY: rule promotion) ────────────────────────────────────────────────────
// A live revision is exported from one environment as a file and imported into another, where the
// difference is reviewed before it becomes a new revision (pending in production). Only rules and the
// condition-based flag groups they name travel: listed groups, flag overrides and the kill switch hold
// ids of one database and stay where they are.

/** The promotion file format; a reader refuses any other. */
export const PROMOTION_FORMAT_VERSION = 1;

/** A condition-based flag group as it travels with the rules that name it. */
export const PromotedFlagGroupSchema = z.object({
	key: FlagGroupKeySchema,
	name: z.string(),
	description: z.string(),
	conditions: FlagGroupConditionsSchema,
});
export type PromotedFlagGroup = z.output<typeof PromotedFlagGroupSchema>;

const PromotionHeaderShape = {
	formatVersion: z.literal(PROMOTION_FORMAT_VERSION),
	environment: DeploymentEnvironmentSchema,
	exportedAt: EpochMsSchema,
	revision: z.number().int().positive(),
	groups: z.array(PromotedFlagGroupSchema),
	/** Listed groups the rules name; the target must already have groups with these keys. */
	listedGroupKeys: z.array(FlagGroupKeySchema),
};

/** What every promotion file carries beside its rules: the format, where and when it was exported, the groups. */
export type PromotionHeader = z.output<z.ZodObject<typeof PromotionHeaderShape>>;

/** Open, like the rules inside it: the export endpoint answers with one (ADR 022). An unknown key in an imported file is stripped. */
export const PromotionFileSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("FLAG"), key: FeatureFlagKeySchema, content: FlagRevisionContentSchema, ...PromotionHeaderShape }),
	z.object({ kind: z.literal("CONFIG"), key: DynamicConfigKeySchema, content: ConfigRevisionContentSchema, ...PromotionHeaderShape }),
]);
export type PromotionFile = z.output<typeof PromotionFileSchema>;

export const PromotionExportQuerySchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("FLAG"), key: FeatureFlagKeySchema }).strict(),
	z.object({ kind: z.literal("CONFIG"), key: DynamicConfigKeySchema }).strict(),
]);
export type PromotionExportQuery = z.output<typeof PromotionExportQuerySchema>;

/** How one travelling group compares with this environment's group of the same key. */
export const PromotedGroupChangeSchema = z.object({
	key: FlagGroupKeySchema,
	change: z.enum(["NEW", "CHANGED", "SAME", "LISTED_HERE"]),
});
export type PromotedGroupChange = z.output<typeof PromotedGroupChangeSchema>;

/** What an import would change, before it is applied. */
export const PromotionPreviewSchema = z.object({
	kind: z.enum(["FLAG", "CONFIG"]),
	key: z.union([FeatureFlagKeySchema, DynamicConfigKeySchema]),
	from: DeploymentEnvironmentSchema,
	to: DeploymentEnvironmentSchema,
	current: RevisionSchema.nullable(),
	incoming: z.union([FlagRevisionContentSchema, ConfigRevisionContentSchema]),
	identical: z.boolean(),
	groups: z.array(PromotedGroupChangeSchema),
	/** Listed groups the rules name that this environment doesn't have: the import is refused until they exist. */
	missingListedGroups: z.array(FlagGroupKeySchema),
	/** Whether the imported revision will wait for a second person here. */
	needsApproval: z.boolean(),
});
export type PromotionPreview = z.output<typeof PromotionPreviewSchema>;

export const PromotionPreviewInputSchema = z.object({ file: PromotionFileSchema }).strict();
export type PromotionPreviewInput = z.output<typeof PromotionPreviewInputSchema>;

export const PromotionImportInputSchema = z.object({ file: PromotionFileSchema, reason: ChangeReasonSchema }).strict();
export type PromotionImportInput = z.output<typeof PromotionImportInputSchema>;
