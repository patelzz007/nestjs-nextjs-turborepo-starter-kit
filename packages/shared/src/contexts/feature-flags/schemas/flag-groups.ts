import { z } from "zod";

import { EpochMsSchema } from "../../../schemas/api/common";
import { defineListQuery } from "../../../schemas/api/list-query";
import { ConditionSchema, FlagGroupKeySchema } from "./conditions";
import { DynamicConfigKeySchema } from "./dynamic-configs";
import { FeatureFlagKeySchema, RolloutUnitSchema } from "./registry";
import { ChangeReasonSchema, RULE_MAX_CONDITIONS } from "./rules";

// ── Flag groups (GLOSSARY: flag group) ───────────────────────────────────────────────────────────
// A named, reusable set that many flags' rules can name: either conditions (all must match) or a list
// of subjects of one rollout unit. A listed group can hold user IDs, so it is its own permission.

/** Most subjects one listed group holds. */
export const FLAG_GROUP_MAX_MEMBERS = 10_000;
/** Most subjects one add or remove call carries. */
export const FLAG_GROUP_MEMBERS_PER_CALL = 1000;
const NAME_MAX_LENGTH = 80;
const DESCRIPTION_MAX_LENGTH = 500;

export const FlagGroupKindSchema = z.enum(["CONDITIONS", "LIST"]);
export type FlagGroupKind = z.output<typeof FlagGroupKindSchema>;

/** A group's own conditions can't name another group: membership stays one level deep. */
export const FlagGroupConditionsSchema = z
	.array(ConditionSchema)
	.min(1)
	.max(RULE_MAX_CONDITIONS)
	.refine((conditions) => conditions.every((condition) => condition.attribute !== "FLAG_GROUP"), { message: "A flag group can't name another flag group" });

export const FlagGroupDefinitionSchema = z.discriminatedUnion("kind", [
	// Open: a group's definition comes back inside responses (ADR 022).
	z.object({ kind: z.literal("CONDITIONS"), conditions: FlagGroupConditionsSchema }),
	z.object({ kind: z.literal("LIST"), unit: RolloutUnitSchema }),
]);
export type FlagGroupDefinition = z.output<typeof FlagGroupDefinitionSchema>;

/** A flag or config whose live or pending rules name the group. */
export const FlagGroupUsageSchema = z.object({ kind: z.enum(["FLAG", "CONFIG"]), key: z.union([FeatureFlagKeySchema, DynamicConfigKeySchema]) });
export type FlagGroupUsage = z.output<typeof FlagGroupUsageSchema>;

export const FlagGroupSchema = z.object({
	id: z.uuid(),
	key: FlagGroupKeySchema,
	name: z.string(),
	description: z.string(),
	definition: FlagGroupDefinitionSchema,
	memberCount: z.number().int().nonnegative(),
	usedBy: z.array(FlagGroupUsageSchema),
	updatedAt: EpochMsSchema,
	updatedByName: z.string().nullable(),
});
export type FlagGroup = z.output<typeof FlagGroupSchema>;

export const FlagGroupListSchema = z.object({ groups: z.array(FlagGroupSchema) });
export type FlagGroupList = z.output<typeof FlagGroupListSchema>;

export const FlagGroupPathSchema = z.object({ groupId: z.uuid() }).strict();
export type FlagGroupPath = z.output<typeof FlagGroupPathSchema>;

const GroupFieldsShape = {
	name: z.string().trim().min(1).max(NAME_MAX_LENGTH),
	description: z.string().trim().max(DESCRIPTION_MAX_LENGTH),
	reason: ChangeReasonSchema,
};

export const CreateFlagGroupSchema = z.object({ key: FlagGroupKeySchema, definition: FlagGroupDefinitionSchema, ...GroupFieldsShape }).strict();
export type CreateFlagGroupInput = z.output<typeof CreateFlagGroupSchema>;

/** A group's key and kind never change (rules name the key); its name, description and conditions can. */
export const UpdateFlagGroupSchema = z.object({ conditions: FlagGroupConditionsSchema.nullable(), ...GroupFieldsShape }).strict();
export type UpdateFlagGroupInput = z.output<typeof UpdateFlagGroupSchema>;
export const UpdateFlagGroupInputSchema = FlagGroupPathSchema.extend(UpdateFlagGroupSchema.shape);

export const RemoveFlagGroupSchema = z.object({ reason: ChangeReasonSchema }).strict();
export type RemoveFlagGroupInput = z.output<typeof RemoveFlagGroupSchema>;
export const RemoveFlagGroupInputSchema = FlagGroupPathSchema.extend(RemoveFlagGroupSchema.shape);

/** Adding or removing listed subjects: user, tenant or location ids, or device ids. */
export const ChangeFlagGroupMembersSchema = z
	.object({ action: z.enum(["ADD", "REMOVE"]), subjectIds: z.array(z.uuid()).min(1).max(FLAG_GROUP_MEMBERS_PER_CALL), reason: ChangeReasonSchema })
	.strict();
export type ChangeFlagGroupMembersInput = z.output<typeof ChangeFlagGroupMembersSchema>;
export const ChangeFlagGroupMembersInputSchema = FlagGroupPathSchema.extend(ChangeFlagGroupMembersSchema.shape);

export const ChangeFlagGroupMembersResultSchema = z.object({ changed: z.number().int().nonnegative(), memberCount: z.number().int().nonnegative() });
export type ChangeFlagGroupMembersResult = z.output<typeof ChangeFlagGroupMembersResultSchema>;

export const FlagGroupMemberSchema = z.object({
	subjectId: z.uuid(),
	/** The user's, tenant's or location's name; null for a device. */
	name: z.string().nullable(),
	addedAt: EpochMsSchema,
	addedByName: z.string().nullable(),
});
export type FlagGroupMember = z.output<typeof FlagGroupMemberSchema>;

export const flagGroupMemberListQuery = defineListQuery({
	sortable: ["addedAt"],
	defaultSort: [{ field: "addedAt", direction: "desc" }],
	filter: {},
	params: {},
});
/** The query string of `GET /admin/flag-groups/:groupId/members`. */
export const FlagGroupMemberListQuerySchema = flagGroupMemberListQuery.schema;
export type FlagGroupMemberListQuery = z.output<typeof FlagGroupMemberListQuerySchema>;
/** The whole input of that route, as the typed client sends it (the group id fills the path). */
export const FlagGroupMemberListInputSchema = FlagGroupMemberListQuerySchema.extend(FlagGroupPathSchema.shape);
