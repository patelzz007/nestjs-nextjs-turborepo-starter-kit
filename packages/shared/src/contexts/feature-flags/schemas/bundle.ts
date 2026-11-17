import { z } from "zod";

import { EpochMsSchema } from "../../../schemas/api/common";
import { JsonObjectSchema } from "../../../schemas/runtime/json";
import { AppLanguageSchema } from "../../identity/schemas/profile";
import { AppVersionSchema } from "../../../schemas/api/app-version";
import { ClientPlatformSchema, ConditionAttributeSchema } from "./conditions";
import { DynamicConfigKeySchema } from "./dynamic-configs";
import { BundleAppSchema, FeatureFlagKeySchema, FlagAppSchema, RolloutUnitSchema } from "./registry";
import { ConfigValueNameSchema } from "./rules";

// ── The bundle: one subject's evaluated results, for one app ─────────────────────────────────────
// The API works out every value; an app receives only results (never rules, conditions or listed IDs).
// The live stream announces only the catalogue version; a client refetches its bundle when it changes.

/** Header every app sends with its anonymous device id on bundle and exposure requests. */
export const DEVICE_ID_HEADER = "X-Device-Id";
/**
 * The web apps' first-party cookie holding the device id: set by each web app's own server on the first visit and
 * sent to the API as {@link DEVICE_ID_HEADER} (the mobile app keeps its id on the device). Readable by the page,
 * since it is no secret: it identifies a browser, never a person.
 */
export const DEVICE_ID_COOKIE = "flagDeviceId";
/** How long a browser keeps its device id: a year, renewed on each visit. */
export const DEVICE_ID_COOKIE_MAX_AGE_SECONDS = 31_536_000;
/** Header the mobile app sends with `ios` or `android`; a browser app is `web`. */
export const CLIENT_PLATFORM_HEADER = "X-Client-Platform";

/** A device id: a random UUID, made once per browser or per installed app, never linked to a person's record. */
export const DeviceIdSchema = z.uuid();

/** What decided a value: the kill switch, a flag override (which level), a rule, an experiment, or the default. */
export const DecisionSourceSchema = z.enum(["KILL_SWITCH", "OVERRIDE_USER", "OVERRIDE_LOCATION", "OVERRIDE_TENANT", "RULE", "EXPERIMENT", "DEFAULT"]);
export type DecisionSource = z.output<typeof DecisionSourceSchema>;

/** Asking for a bundle: which app, and the store the person is working in (merchant app, mobile till). */
export const FeatureFlagBundleQuerySchema = z
	.object({
		app: BundleAppSchema,
		tenantId: z.uuid().optional(),
		locationId: z.uuid().optional(),
		locale: AppLanguageSchema.optional(),
	})
	.strict()
	.refine((query) => query.locationId === undefined || query.tenantId !== undefined, { message: "A location needs its tenant", path: ["locationId"] });
export type FeatureFlagBundleQuery = z.output<typeof FeatureFlagBundleQuerySchema>;

export const FlagResultSchema = z.object({
	key: FeatureFlagKeySchema,
	on: z.boolean(),
	source: DecisionSourceSchema,
	/** The live revision that decided (null: no revision, or the kill switch / an override decided). */
	revision: z.number().int().positive().nullable(),
	ruleId: z.uuid().nullable(),
});
export type FlagResult = z.output<typeof FlagResultSchema>;

export const ConfigResultSchema = z.object({
	key: DynamicConfigKeySchema,
	/** The named value given (null: the code default). */
	valueName: ConfigValueNameSchema.nullable(),
	value: JsonObjectSchema,
	source: DecisionSourceSchema,
	revision: z.number().int().positive().nullable(),
	ruleId: z.uuid().nullable(),
	experimentId: z.uuid().nullable(),
	variant: ConfigValueNameSchema.nullable(),
});
export type ConfigResult = z.output<typeof ConfigResultSchema>;

export const FeatureFlagBundleSchema = z.object({
	/** The catalogue version these results were worked out from (the stream announces newer ones). */
	version: z.number().int().nonnegative(),
	app: BundleAppSchema,
	evaluatedAt: EpochMsSchema,
	/** When a scheduled rollout's share next changes, so a client refetches then (null: none planned). */
	nextChangeAt: EpochMsSchema.nullable(),
	flags: z.array(FlagResultSchema),
	configs: z.array(ConfigResultSchema),
});
export type FeatureFlagBundle = z.output<typeof FeatureFlagBundleSchema>;

/** One frame of the live stream: the catalogue's version. */
export const FeatureFlagVersionSignalSchema = z.object({ version: z.number().int().nonnegative() });
export type FeatureFlagVersionSignal = z.output<typeof FeatureFlagVersionSignalSchema>;

// ── Exposures (GLOSSARY: exposure) ───────────────────────────────────────────────────────────────

/** Most exposures one batch carries; a client sends more in further batches. */
export const EXPOSURE_BATCH_MAX = 50;

/** A subject id as an exposure records it: a user, tenant or location id, or a device id. */
const SUBJECT_ID_MAX_LENGTH = 64;

const FlagExposureShape = {
	kind: z.literal("FLAG"),
	key: FeatureFlagKeySchema,
	on: z.boolean(),
	source: DecisionSourceSchema,
	revision: z.number().int().positive().nullable(),
	ruleId: z.uuid().nullable(),
	at: EpochMsSchema,
};

const ConfigExposureShape = {
	kind: z.literal("CONFIG"),
	key: DynamicConfigKeySchema,
	valueName: ConfigValueNameSchema.nullable(),
	source: DecisionSourceSchema,
	revision: z.number().int().positive().nullable(),
	ruleId: z.uuid().nullable(),
	experimentId: z.uuid().nullable(),
	variant: ConfigValueNameSchema.nullable(),
	at: EpochMsSchema,
};

/** Who an exposure is attributed to: added by the API, never sent by a client. */
const AttributionShape = { subjectUnit: RolloutUnitSchema, subjectId: z.string().min(1).max(SUBJECT_ID_MAX_LENGTH) };

export const ExposureSchema = z.discriminatedUnion("kind", [z.object(FlagExposureShape).strict(), z.object(ConfigExposureShape).strict()]);
export type Exposure = z.output<typeof ExposureSchema>;

/**
 * A client's batch of exposures. The person comes from the session and the device from its id, never from the
 * body; a tenant or location named here counts only when the person works there (as for a bundle).
 */
export const ExposureBatchSchema = z
	.object({
		app: BundleAppSchema,
		tenantId: z.uuid().optional(),
		locationId: z.uuid().optional(),
		exposures: z.array(ExposureSchema).min(1).max(EXPOSURE_BATCH_MAX),
	})
	.strict();
export type ExposureBatch = z.output<typeof ExposureBatchSchema>;

/** One exposure as the platform event carries it: attributed by the API to its rollout unit's subject. */
export const AttributedExposureSchema = z.discriminatedUnion("kind", [
	z.object({ ...FlagExposureShape, ...AttributionShape }).strict(),
	z.object({ ...ConfigExposureShape, ...AttributionShape }).strict(),
]);
export type AttributedExposure = z.output<typeof AttributedExposureSchema>;

/** The `feature_flag.exposure` platform event: one batch, from one app (or the API's own checks). */
export const FeatureFlagExposureEventSchema = z.object({ app: FlagAppSchema, exposures: z.array(AttributedExposureSchema).min(1).max(EXPOSURE_BATCH_MAX) }).strict();
export type FeatureFlagExposureEvent = z.output<typeof FeatureFlagExposureEventSchema>;

export const ExposureBatchResultSchema = z.object({ accepted: z.number().int().nonnegative(), ignored: z.number().int().nonnegative() });
export type ExposureBatchResult = z.output<typeof ExposureBatchResultSchema>;

/** A stable string for one exposure's decision, which a client de-duplicates on within a session. */
export function exposureDedupeKey(exposure: Exposure): string {
	switch (exposure.kind) {
		case "FLAG":
			return `FLAG|${exposure.key}|${String(exposure.revision ?? "-")}|${exposure.ruleId ?? "-"}|${exposure.source}|${String(exposure.on)}`;
		case "CONFIG":
			return `CONFIG|${exposure.key}|${String(exposure.revision ?? "-")}|${exposure.ruleId ?? "-"}|${exposure.source}|${exposure.valueName ?? "-"}|${exposure.experimentId ?? "-"}`;
	}
}

/** Who/what a check is for, as the console's "Check a subject" panel takes it. */
export const SubjectContextSchema = z
	.object({
		userId: z.uuid().nullable(),
		tenantId: z.uuid().nullable(),
		locationId: z.uuid().nullable(),
		deviceId: DeviceIdSchema.nullable(),
		app: FlagAppSchema,
		platform: ClientPlatformSchema.nullable(),
		appVersion: AppVersionSchema.nullable(),
		locale: AppLanguageSchema.nullable(),
	})
	.strict();
export type SubjectContext = z.output<typeof SubjectContextSchema>;

/** One step of an explained decision, for "Check a subject". */
export const DecisionTraceStepSchema = z.object({
	step: z.enum(["KILL_SWITCH", "OVERRIDE", "RULE", "EXPERIMENT", "DEFAULT"]),
	label: z.string(),
	matched: z.boolean(),
	/** Why a rule didn't match: its first condition that failed, or its share. */
	failedAttribute: ConditionAttributeSchema.nullable(),
	detail: z.string().nullable(),
});
export type DecisionTraceStep = z.output<typeof DecisionTraceStepSchema>;
