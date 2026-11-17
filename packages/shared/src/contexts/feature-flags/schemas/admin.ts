import { z } from "zod";

import { EpochMsSchema } from "../../../schemas/api/common";
import { JsonObjectSchema } from "../../../schemas/runtime/json";
import { ConfigResultSchema, DecisionSourceSchema, DecisionTraceStepSchema, FlagResultSchema, SubjectContextSchema } from "./bundle";
import { DeploymentEnvironmentSchema } from "./conditions";
import { DynamicConfigKeySchema } from "./dynamic-configs";
import { FeatureFlagKeySchema, FlagAppSchema, RolloutUnitSchema } from "./registry";
import { ChangeReasonSchema, ConfigRevisionContentSchema, FlagRulesSchema, RevisionContentSchema, RevisionSourceSchema, RevisionStatusSchema } from "./rules";

// ── The admin console's contracts: flags, configs, revisions, overrides, kill switch ─────────────

/** How long a pending revision waits for its second person before it expires. */
export const PENDING_REVISION_TTL_DAYS = 7;
/** How long a flag must have been fully on, fully off, killed or unchecked before it reads "ready to remove". */
export const READY_TO_REMOVE_AFTER_DAYS = 30;

/** Why a flag reads "ready to remove from code" (a badge only; nothing happens by itself). */
export const ReadyToRemoveReasonSchema = z.enum(["ALWAYS_ON", "ALWAYS_OFF", "KILLED", "NEVER_CHECKED"]);
export type ReadyToRemoveReason = z.output<typeof ReadyToRemoveReasonSchema>;

/** One flag revision or dynamic config revision, as the console shows it. */
export const RevisionSchema = z.object({
	id: z.uuid(),
	number: z.number().int().positive(),
	status: RevisionStatusSchema,
	content: RevisionContentSchema,
	reason: z.string(),
	source: RevisionSourceSchema,
	/** The environment a promoted revision came from. */
	promotedFrom: DeploymentEnvironmentSchema.nullable(),
	authorUserId: z.uuid().nullable(),
	authorName: z.string().nullable(),
	createdAt: EpochMsSchema,
	/** When it went live, was rejected or expired. */
	decidedAt: EpochMsSchema.nullable(),
	decidedByName: z.string().nullable(),
	decisionReason: z.string().nullable(),
	/** When a pending revision expires. */
	expiresAt: EpochMsSchema.nullable(),
});
export type Revision = z.output<typeof RevisionSchema>;

export const RevisionListSchema = z.object({ revisions: z.array(RevisionSchema) });
export type RevisionList = z.output<typeof RevisionListSchema>;

export const KillSwitchStateSchema = z.object({
	on: z.boolean(),
	reason: z.string().nullable(),
	changedAt: EpochMsSchema.nullable(),
	changedByName: z.string().nullable(),
});
export type KillSwitchState = z.output<typeof KillSwitchStateSchema>;

/** A flag override: one user, location or tenant forced on or off, ahead of every rule. */
export const FlagOverrideSchema = z.object({
	id: z.uuid(),
	key: FeatureFlagKeySchema,
	unit: z.enum(["USER", "LOCATION", "TENANT"]),
	subjectId: z.uuid(),
	/** The user's name, the location's or the tenant's, for the console. */
	subjectName: z.string().nullable(),
	/** A location's tenant name (null for the other units). */
	tenantName: z.string().nullable(),
	on: z.boolean(),
	reason: z.string(),
	updatedAt: EpochMsSchema,
	updatedByName: z.string().nullable(),
});
export type FlagOverride = z.output<typeof FlagOverrideSchema>;

export const FlagOverrideUnitSchema = FlagOverrideSchema.shape.unit;
export type FlagOverrideUnit = z.output<typeof FlagOverrideUnitSchema>;

/** Exposure counts for one decision path over a window (Phase B). */
export const ExposureCountSchema = z.object({
	source: DecisionSourceSchema,
	ruleId: z.uuid().nullable(),
	/** `on` / `off` for a flag; the value's name (or `default`) for a config. */
	value: z.string(),
	exposures: z.number().int().nonnegative(),
	subjects: z.number().int().nonnegative(),
});
export type ExposureCount = z.output<typeof ExposureCountSchema>;

export const ExposureStatsSchema = z.object({
	last24h: z.array(ExposureCountSchema),
	last7d: z.array(ExposureCountSchema),
	lastExposureAt: EpochMsSchema.nullable(),
});
export type ExposureStats = z.output<typeof ExposureStatsSchema>;

const DeclarationShape = {
	title: z.string(),
	description: z.string(),
	rolloutUnit: RolloutUnitSchema,
	apps: z.array(FlagAppSchema),
};

/** A row of the Feature flags list. */
export const FeatureFlagSummarySchema = z.object({
	key: FeatureFlagKeySchema,
	...DeclarationShape,
	defaultOn: z.boolean(),
	killSwitch: KillSwitchStateSchema,
	liveRevision: z.number().int().positive().nullable(),
	ruleCount: z.number().int().nonnegative(),
	pendingRevision: z.number().int().positive().nullable(),
	overrideCount: z.number().int().nonnegative(),
	updatedAt: EpochMsSchema.nullable(),
	readyToRemove: ReadyToRemoveReasonSchema.nullable(),
	exposures24h: z.number().int().nonnegative(),
});
export type FeatureFlagSummary = z.output<typeof FeatureFlagSummarySchema>;

export const FeatureFlagSummaryListSchema = z.object({ flags: z.array(FeatureFlagSummarySchema) });
export type FeatureFlagSummaryList = z.output<typeof FeatureFlagSummaryListSchema>;

/** One flag's read-only page. */
export const FeatureFlagDetailSchema = FeatureFlagSummarySchema.extend({
	live: RevisionSchema.nullable(),
	pending: RevisionSchema.nullable(),
	overrides: z.array(FlagOverrideSchema),
	exposures: ExposureStatsSchema,
});
export type FeatureFlagDetail = z.output<typeof FeatureFlagDetailSchema>;

export const FeatureFlagPathSchema = z.object({ key: FeatureFlagKeySchema }).strict();
export type FeatureFlagPath = z.output<typeof FeatureFlagPathSchema>;

/**
 * Saving a flag's rules as a new revision. `basedOn` is the live revision the editor started from: when
 * someone else changed the rules meanwhile, the save is refused (409) instead of silently undoing theirs.
 */
export const SaveFlagRevisionSchema = z.object({ rules: FlagRulesSchema, reason: ChangeReasonSchema, basedOn: z.number().int().positive().nullable() }).strict();
export type SaveFlagRevisionInput = z.output<typeof SaveFlagRevisionSchema>;
export const SaveFlagRevisionInputSchema = FeatureFlagPathSchema.extend(SaveFlagRevisionSchema.shape);

/** A pending revision is approved or rejected by someone other than its author, with why. */
export const RevisionDecisionSchema = z.object({ decision: z.enum(["APPROVE", "REJECT"]), reason: ChangeReasonSchema }).strict();
export type RevisionDecisionInput = z.output<typeof RevisionDecisionSchema>;
export const FlagRevisionPathSchema = FeatureFlagPathSchema.extend({ number: z.coerce.number().int().positive() });
export type FlagRevisionPath = z.output<typeof FlagRevisionPathSchema>;
export const DecideFlagRevisionInputSchema = FlagRevisionPathSchema.extend(RevisionDecisionSchema.shape);

/** Throwing or releasing a flag's kill switch, with why. */
export const SetKillSwitchSchema = z.object({ on: z.boolean(), reason: ChangeReasonSchema }).strict();
export type SetKillSwitchInput = z.output<typeof SetKillSwitchSchema>;
export const SetKillSwitchInputSchema = FeatureFlagPathSchema.extend(SetKillSwitchSchema.shape);

/** Forcing a flag on or off for one user, location or tenant (replaces its earlier override). */
export const SetFlagOverrideSchema = z.object({ unit: FlagOverrideUnitSchema, subjectId: z.uuid(), on: z.boolean(), reason: ChangeReasonSchema }).strict();
export type SetFlagOverrideInput = z.output<typeof SetFlagOverrideSchema>;
export const SetFlagOverrideInputSchema = FeatureFlagPathSchema.extend(SetFlagOverrideSchema.shape);

export const RemoveFlagOverrideSchema = z.object({ reason: ChangeReasonSchema }).strict();
export type RemoveFlagOverrideInput = z.output<typeof RemoveFlagOverrideSchema>;
export const FlagOverridePathSchema = FeatureFlagPathSchema.extend({ overrideId: z.uuid() });
export type FlagOverridePath = z.output<typeof FlagOverridePathSchema>;
export const RemoveFlagOverrideInputSchema = FlagOverridePathSchema.extend(RemoveFlagOverrideSchema.shape);

/** "Check a subject": the value one subject would get, and every step that led there. */
export const FlagCheckResultSchema = z.object({ result: FlagResultSchema, trace: z.array(DecisionTraceStepSchema) });
export type FlagCheckResult = z.output<typeof FlagCheckResultSchema>;
/** "Check a subject"'s body: the subject to work the value out for. */
export const CheckSubjectSchema = z.object({ subject: SubjectContextSchema }).strict();
export type CheckSubjectInput = z.output<typeof CheckSubjectSchema>;
export const CheckFlagInputSchema = FeatureFlagPathSchema.extend(CheckSubjectSchema.shape);
export type CheckFlagInput = z.output<typeof CheckFlagInputSchema>;

/** The override pickers: users, tenants and locations by name. */
const SUBJECT_SEARCH_MAX_LENGTH = 100;
export const FLAG_SUBJECT_SEARCH_LIMIT = 20;
export const FlagSubjectSearchQuerySchema = z.object({ unit: FlagOverrideUnitSchema, search: z.string().trim().max(SUBJECT_SEARCH_MAX_LENGTH).optional() }).strict();
export type FlagSubjectSearchQuery = z.output<typeof FlagSubjectSearchQuerySchema>;
export const FlagSubjectOptionSchema = z.object({ id: z.uuid(), name: z.string(), detail: z.string().nullable() });
export type FlagSubjectOption = z.output<typeof FlagSubjectOptionSchema>;
export const FlagSubjectOptionListSchema = z.object({ subjects: z.array(FlagSubjectOptionSchema) });
export type FlagSubjectOptionList = z.output<typeof FlagSubjectOptionListSchema>;

/** The deployment's environment, and whether rule changes here wait for a second person. */
export const FeatureFlagEnvironmentSchema = z.object({ environment: DeploymentEnvironmentSchema, approvalsRequired: z.boolean() });
export type FeatureFlagEnvironment = z.output<typeof FeatureFlagEnvironmentSchema>;

// ── Dynamic configs ──────────────────────────────────────────────────────────────────────────────

export const DynamicConfigSummarySchema = z.object({
	key: DynamicConfigKeySchema,
	...DeclarationShape,
	defaultValue: JsonObjectSchema,
	/** The declared value shape, as JSON Schema, for the console's editor. */
	valueJsonSchema: JsonObjectSchema,
	liveRevision: z.number().int().positive().nullable(),
	valueCount: z.number().int().nonnegative(),
	ruleCount: z.number().int().nonnegative(),
	pendingRevision: z.number().int().positive().nullable(),
	runningExperimentId: z.uuid().nullable(),
	updatedAt: EpochMsSchema.nullable(),
	exposures24h: z.number().int().nonnegative(),
});
export type DynamicConfigSummary = z.output<typeof DynamicConfigSummarySchema>;

export const DynamicConfigSummaryListSchema = z.object({ configs: z.array(DynamicConfigSummarySchema) });
export type DynamicConfigSummaryList = z.output<typeof DynamicConfigSummaryListSchema>;

export const DynamicConfigDetailSchema = DynamicConfigSummarySchema.extend({
	live: RevisionSchema.nullable(),
	pending: RevisionSchema.nullable(),
	exposures: ExposureStatsSchema,
});
export type DynamicConfigDetail = z.output<typeof DynamicConfigDetailSchema>;

export const DynamicConfigPathSchema = z.object({ key: DynamicConfigKeySchema }).strict();
export type DynamicConfigPath = z.output<typeof DynamicConfigPathSchema>;

export const SaveConfigRevisionSchema = z
	.object({ content: ConfigRevisionContentSchema, reason: ChangeReasonSchema, basedOn: z.number().int().positive().nullable() })
	.strict();
export type SaveConfigRevisionInput = z.output<typeof SaveConfigRevisionSchema>;
export const SaveConfigRevisionInputSchema = DynamicConfigPathSchema.extend(SaveConfigRevisionSchema.shape);

export const ConfigRevisionPathSchema = DynamicConfigPathSchema.extend({ number: z.coerce.number().int().positive() });
export type ConfigRevisionPath = z.output<typeof ConfigRevisionPathSchema>;
export const DecideConfigRevisionInputSchema = ConfigRevisionPathSchema.extend(RevisionDecisionSchema.shape);

export const ConfigCheckResultSchema = z.object({ result: ConfigResultSchema, trace: z.array(DecisionTraceStepSchema) });
export type ConfigCheckResult = z.output<typeof ConfigCheckResultSchema>;
export const CheckConfigInputSchema = DynamicConfigPathSchema.extend(CheckSubjectSchema.shape);
export type CheckConfigInput = z.output<typeof CheckConfigInputSchema>;
