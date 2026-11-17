import { z } from "zod";

import { EpochMsSchema } from "../../../schemas/api/common";
import { AppVersionSchema } from "../../../schemas/api/app-version";
import { PermissionActionSchema, PermissionResourceSchema } from "../../authorization/schemas/permission-enums";
import { AppLanguageSchema } from "../../identity/schemas/profile";
import { CustomerTierSchema } from "../../tiers/schemas/customer-tier";
import { FlagAppSchema } from "./registry";

// ── The condition catalogue (GLOSSARY: condition) ────────────────────────────────────────────────
// Every check a rule can make is declared here, one discriminated case per attribute. A new kind of
// check is a new case in code, never a free-form attribute name typed into the console.

/** The role a deployment plays (GLOSSARY: environment). */
export const DeploymentEnvironmentSchema = z.enum(["development", "staging", "production"]);
export type DeploymentEnvironment = z.output<typeof DeploymentEnvironmentSchema>;

/** Where a client runs: a browser, or the mobile app on iOS or Android. */
export const ClientPlatformSchema = z.enum(["web", "ios", "android"]);
export type ClientPlatform = z.output<typeof ClientPlatformSchema>;

/** Most values one condition lists; a longer list belongs in a flag group. */
export const CONDITION_MAX_VALUES = 100;
const EMAIL_DOMAIN_MAX_LENGTH = 253;
/** A domain such as `example.com`: labels of letters, digits and hyphens, at least one dot. */
const EMAIL_DOMAIN_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export const ListOperatorSchema = z.enum(["IN", "NOT_IN"]);
export type ListOperator = z.output<typeof ListOperatorSchema>;

export const VersionOperatorSchema = z.enum(["AT_LEAST", "BELOW"]);
export type VersionOperator = z.output<typeof VersionOperatorSchema>;

export const GroupOperatorSchema = z.enum(["IN_GROUP", "NOT_IN_GROUP"]);
export type GroupOperator = z.output<typeof GroupOperatorSchema>;

function listOf<T extends z.ZodType>(item: T): z.ZodArray<T> {
	return z.array(item).min(1).max(CONDITION_MAX_VALUES);
}

/** One permission as `ACTION:RESOURCE`, the way the console names it. */
export const PermissionReferenceSchema = z.object({ action: PermissionActionSchema, resource: PermissionResourceSchema });
export type PermissionReference = z.output<typeof PermissionReferenceSchema>;

const FLAG_GROUP_KEY_MAX_LENGTH = 64;
/** A flag group's key: lowercase words joined by hyphens, such as `beta-testers`. */
const FLAG_GROUP_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A flag group's stable key, which rules name (unlike its id, it survives rule promotion). */
export const FlagGroupKeySchema = z.string().min(1).max(FLAG_GROUP_KEY_MAX_LENGTH).regex(FLAG_GROUP_KEY_PATTERN, "lowercase words joined by hyphens, such as beta-testers");
export type FlagGroupKey = z.output<typeof FlagGroupKeySchema>;

export const EmailDomainSchema = z.string().trim().toLowerCase().max(EMAIL_DOMAIN_MAX_LENGTH).regex(EMAIL_DOMAIN_PATTERN, "must be a domain such as example.com");

/**
 * Conditions, like the rules, rollouts and values built from them, are open objects: they come back inside responses,
 * which must tolerate added fields (ADR 022). An unknown key is stripped, never stored. Only the request wrappers
 * (admin.ts, experiments.ts, …) are closed.
 */
export const ConditionSchema = z.discriminatedUnion("attribute", [
	z.object({ attribute: z.literal("USER_ID"), operator: ListOperatorSchema, values: listOf(z.uuid()) }),
	z.object({ attribute: z.literal("EMAIL_DOMAIN"), operator: ListOperatorSchema, values: listOf(EmailDomainSchema) }),
	z.object({ attribute: z.literal("PLATFORM_STAFF"), is: z.boolean() }),
	z.object({ attribute: z.literal("PERMISSION"), operator: z.enum(["HAS", "LACKS"]), permission: PermissionReferenceSchema }),
	z.object({ attribute: z.literal("TENANT_ID"), operator: ListOperatorSchema, values: listOf(z.uuid()) }),
	z.object({ attribute: z.literal("LOCATION_ID"), operator: ListOperatorSchema, values: listOf(z.uuid()) }),
	z.object({ attribute: z.literal("CUSTOMER_TIER"), operator: ListOperatorSchema, values: listOf(CustomerTierSchema) }),
	z.object({ attribute: z.literal("APP"), operator: ListOperatorSchema, values: listOf(FlagAppSchema) }),
	z.object({ attribute: z.literal("PLATFORM"), operator: ListOperatorSchema, values: listOf(ClientPlatformSchema) }),
	z.object({ attribute: z.literal("APP_VERSION"), operator: VersionOperatorSchema, version: AppVersionSchema }),
	z.object({ attribute: z.literal("LOCALE"), operator: ListOperatorSchema, values: listOf(AppLanguageSchema) }),
	z.object({ attribute: z.literal("FLAG_GROUP"), operator: GroupOperatorSchema, groupKey: FlagGroupKeySchema }),
	z
		.object({ attribute: z.literal("TIME"), from: EpochMsSchema.nullable(), until: EpochMsSchema.nullable() })
		.refine((condition) => condition.from !== null || condition.until !== null, { message: "A time condition needs a start, an end or both" })
		.refine((condition) => condition.from === null || condition.until === null || condition.from < condition.until, { message: "The start must come before the end" }),
	z.object({ attribute: z.literal("ENVIRONMENT"), operator: ListOperatorSchema, values: listOf(DeploymentEnvironmentSchema) }),
]);
export type Condition = z.output<typeof ConditionSchema>;
/** A condition as a form holds it before parsing (its times are plain numbers until checked). */
export type ConditionInput = z.input<typeof ConditionSchema>;
export type ConditionAttribute = Condition["attribute"];

/** The attributes in the order the console offers them. */
export const ConditionAttributeSchema = z.enum([
	"USER_ID",
	"EMAIL_DOMAIN",
	"PLATFORM_STAFF",
	"PERMISSION",
	"TENANT_ID",
	"LOCATION_ID",
	"CUSTOMER_TIER",
	"APP",
	"PLATFORM",
	"APP_VERSION",
	"LOCALE",
	"FLAG_GROUP",
	"TIME",
	"ENVIRONMENT",
]);
