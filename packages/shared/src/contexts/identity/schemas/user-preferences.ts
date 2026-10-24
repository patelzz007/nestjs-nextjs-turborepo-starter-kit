import { z } from "zod";

import { KanbanGroupBySchema } from "../../kanban/schemas/kanban";

// ── A person's remembered choices ───────────────────────────────────────────
//
// ONE registry of every preference a person can keep: its key and the values it
// accepts. The API checks a write against it, and checks every stored value
// again on read — a value the registry no longer accepts (a key renamed, an
// option dropped) reads as unset, so the page falls back to its default.

/** The longest key the registry may name (`VarChar(120)`). */
export const USER_PREFERENCE_KEY_MAX_LENGTH = 120;

/**
 * Every preference key: `board.<board>.<setting>` for the kanban boards' grouping
 * (planning groups by epic at most) and the execution board's "Show subtasks".
 */
export const UserPreferenceKeySchema = z.enum(["board.planning.groupBy", "board.execution.groupBy", "board.execution.showSubtasks"]);
export type UserPreferenceKey = z.output<typeof UserPreferenceKeySchema>;

/** Every value any preference holds. */
export const UserPreferenceValueSchema = z.union([KanbanGroupBySchema, z.boolean()]);
export type UserPreferenceValue = z.output<typeof UserPreferenceValueSchema>;

/** What each key accepts. */
export const USER_PREFERENCE_REGISTRY: Readonly<Record<UserPreferenceKey, z.ZodType<UserPreferenceValue>>> = {
	"board.planning.groupBy": KanbanGroupBySchema.extract(["none", "epic"]),
	"board.execution.groupBy": KanbanGroupBySchema,
	"board.execution.showSubtasks": z.boolean(),
};

/** `value` as `key` accepts it, or `null` when the registry does not accept it there. */
export function parseUserPreferenceValue(key: UserPreferenceKey, value: UserPreferenceValue): UserPreferenceValue | null {
	const parsed = USER_PREFERENCE_REGISTRY[key].safeParse(value);
	return parsed.success ? parsed.data : null;
}

/** One stored preference. */
export const UserPreferenceSchema = z.object({
	key: UserPreferenceKeySchema,
	value: UserPreferenceValueSchema,
	version: z.number().int().nonnegative(),
});
export type UserPreference = z.output<typeof UserPreferenceSchema>;

/** `GET /auth/preferences` — the caller's preferences the registry still accepts. A key that is absent uses the page's default. */
export const UserPreferencesSchema = z.object({
	preferences: z.array(UserPreferenceSchema),
});
export type UserPreferences = z.output<typeof UserPreferencesSchema>;

export const UserPreferencePathSchema = z.object({ key: UserPreferenceKeySchema }).strict();
export type UserPreferencePath = z.output<typeof UserPreferencePathSchema>;

/** `PUT /auth/preferences/:key` — remember a value; it must be one the key accepts. */
export const SetUserPreferenceBodySchema = z.object({ value: UserPreferenceValueSchema }).strict();
export type SetUserPreferenceBody = z.output<typeof SetUserPreferenceBodySchema>;

/** The whole request, path and body: refused when the key does not accept the value. */
export const SetUserPreferenceSchema = z
	.object({ key: UserPreferenceKeySchema, value: UserPreferenceValueSchema })
	.strict()
	.superRefine((input, ctx) => {
		if (parseUserPreferenceValue(input.key, input.value) === null) {
			ctx.addIssue({ code: "custom", path: ["value"], message: `That value is not one ${input.key} accepts.` });
		}
	});
export type SetUserPreferenceInput = z.output<typeof SetUserPreferenceSchema>;
