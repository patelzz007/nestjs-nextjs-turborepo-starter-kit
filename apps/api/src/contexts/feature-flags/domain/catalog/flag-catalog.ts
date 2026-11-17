import {
	ConditionSchema,
	ConfigRevisionContentSchema,
	DynamicConfigKeySchema,
	ExperimentVariantSchema,
	FeatureFlagKeySchema,
	FlagGroupKeySchema,
	FlagRuleSchema,
	PercentageSchema,
	RolloutUnitSchema,
} from "@workspace/shared";
import { z } from "zod";

// ── The catalogue: everything a flag decision reads, in one value ────────────────────────────────
// Loaded once (kill switches, live revisions, overrides, groups with their members, running experiments)
// and cached; every evaluation is then a pure function of it and the subject. Lists, not sets, so the
// value round-trips through the cache's schema; `CatalogIndex` builds the lookups.

export const CatalogFlagRevisionSchema = z.object({ key: FeatureFlagKeySchema, number: z.number().int().positive(), rules: z.array(FlagRuleSchema) });
export type CatalogFlagRevision = z.output<typeof CatalogFlagRevisionSchema>;

export const CatalogConfigRevisionSchema = z.object({ key: DynamicConfigKeySchema, number: z.number().int().positive(), content: ConfigRevisionContentSchema });
export type CatalogConfigRevision = z.output<typeof CatalogConfigRevisionSchema>;

export const CatalogOverrideSchema = z.object({
	key: FeatureFlagKeySchema,
	unit: z.enum(["USER", "LOCATION", "TENANT"]),
	subjectId: z.string().min(1),
	on: z.boolean(),
});
export type CatalogOverride = z.output<typeof CatalogOverrideSchema>;

export const CatalogGroupSchema = z.discriminatedUnion("kind", [
	z.object({ key: FlagGroupKeySchema, kind: z.literal("CONDITIONS"), conditions: z.array(ConditionSchema) }),
	z.object({ key: FlagGroupKeySchema, kind: z.literal("LIST"), unit: RolloutUnitSchema, members: z.array(z.string().min(1)) }),
]);
export type CatalogGroup = z.output<typeof CatalogGroupSchema>;

export const CatalogExperimentSchema = z.object({
	id: z.uuid(),
	configKey: DynamicConfigKeySchema,
	salt: z.string().min(1),
	trafficPercentage: PercentageSchema,
	variants: z.array(ExperimentVariantSchema).min(1),
});
export type CatalogExperiment = z.output<typeof CatalogExperimentSchema>;

export const FlagCatalogSchema = z.object({
	version: z.number().int().nonnegative(),
	killSwitches: z.array(FeatureFlagKeySchema),
	flagRevisions: z.array(CatalogFlagRevisionSchema),
	configRevisions: z.array(CatalogConfigRevisionSchema),
	overrides: z.array(CatalogOverrideSchema),
	groups: z.array(CatalogGroupSchema),
	experiments: z.array(CatalogExperimentSchema),
});
export type FlagCatalog = z.output<typeof FlagCatalogSchema>;

/** An empty catalogue: every flag on its code default (no revision, override or kill switch yet). */
export const EMPTY_FLAG_CATALOG: FlagCatalog = {
	version: 0,
	killSwitches: [],
	flagRevisions: [],
	configRevisions: [],
	overrides: [],
	groups: [],
	experiments: [],
};
