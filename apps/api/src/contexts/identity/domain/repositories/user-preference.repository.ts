import type { UserPreference, UserPreferenceKey, UserPreferenceValue } from "@workspace/shared";

/** A person's remembered choices, bound to one unit-of-work transaction (their own rows only, under RLS). */
export interface UserPreferenceRepository {
	/**
	 * Remembers `value` for `key`: the live row's value is replaced and its
	 * version bumped, or a row is created — in one statement, so two writes at
	 * once leave one live row (the partial unique index on `userId`, `key`).
	 */
	set(id: string, userId: string, key: UserPreferenceKey, value: UserPreferenceValue): Promise<UserPreference>;
	/** "Reset to default": soft-deletes the live row, if there is one. */
	reset(userId: string, key: UserPreferenceKey, deletedBy: string, deletedAt: number): Promise<void>;
}
