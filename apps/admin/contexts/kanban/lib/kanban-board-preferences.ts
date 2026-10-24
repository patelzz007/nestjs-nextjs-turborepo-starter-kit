"use client";

// ============================================
// contexts/kanban/lib/kanban-board-preferences.ts - a board's grouping and "Show subtasks"
// ============================================
// Each choice resolves in one order: the URL (a shared link shows what its
// sender saw), then the person's saved preference (`GET /auth/preferences`,
// checked against the shared registry), then the board's default. Choosing in
// the toolbar writes both the URL and the preference; "Reset to default"
// forgets the preference and clears the URL. A board narrowed to one feature
// that would group by feature groups by story instead — one feature lane
// tells nothing.

import { useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { KanbanGroupBySchema, parseUserPreferenceValue, type KanbanBoardKind, type KanbanGroupBy, type UserPreference, type UserPreferenceKey } from "@workspace/shared";
import * as React from "react";
import { z } from "zod";

import { toastMutationError } from "@/lib/api/mutation-error";

/** What each board groups by until someone chooses: features on the execution board, nothing on the planning board. */
export const DEFAULT_GROUP_BY: Readonly<Record<KanbanBoardKind, KanbanGroupBy>> = { EXECUTION: "feature", PLANNING: "none" };

/** Subtask cards stay folded under their task until someone shows them. */
export const DEFAULT_SHOW_SUBTASKS = false;

const GROUP_BY_KEY: Readonly<Record<KanbanBoardKind, UserPreferenceKey>> = { EXECUTION: "board.execution.groupBy", PLANNING: "board.planning.groupBy" };
const SHOW_SUBTASKS_KEY: UserPreferenceKey = "board.execution.showSubtasks";

/** Where a resolved choice came from: the toolbar says when it is the default, and offers a reset otherwise. */
export type KanbanChoiceSource = "url" | "preference" | "default" | "narrowed";

export interface KanbanResolvedChoice<TValue> {
	readonly value: TValue;
	readonly source: KanbanChoiceSource;
}

/** The stored value of `key`, as the registry accepts it there (`undefined`: none). */
function storedValue(preferences: readonly UserPreference[], key: UserPreferenceKey): UserPreference["value"] | undefined {
	const stored = preferences.find((preference) => preference.key === key);
	return stored === undefined ? undefined : (parseUserPreferenceValue(key, stored.value) ?? undefined);
}

/** URL > preference > default, with the one-feature narrowing applied to anything but an explicit URL choice. */
export function resolveGroupBy(
	board: KanbanBoardKind,
	fromUrl: KanbanGroupBy | undefined,
	preferences: readonly UserPreference[],
	narrowedToFeature: boolean,
): KanbanResolvedChoice<KanbanGroupBy> {
	if (fromUrl !== undefined) {
		return { value: fromUrl, source: "url" };
	}
	const stored = KanbanGroupBySchema.safeParse(storedValue(preferences, GROUP_BY_KEY[board]));
	const chosen: KanbanResolvedChoice<KanbanGroupBy> = stored.success ? { value: stored.data, source: "preference" } : { value: DEFAULT_GROUP_BY[board], source: "default" };
	return narrowedToFeature && chosen.value === "feature" ? { value: "story", source: "narrowed" } : chosen;
}

export function resolveShowSubtasks(fromUrl: boolean | undefined, preferences: readonly UserPreference[]): KanbanResolvedChoice<boolean> {
	if (fromUrl !== undefined) {
		return { value: fromUrl, source: "url" };
	}
	const stored = z.boolean().safeParse(storedValue(preferences, SHOW_SUBTASKS_KEY));
	return stored.success ? { value: stored.data, source: "preference" } : { value: DEFAULT_SHOW_SUBTASKS, source: "default" };
}

export interface KanbanBoardPreferences {
	readonly preferences: readonly UserPreference[];
	/** Remembers a grouping for `board` (the URL is the caller's to write). */
	readonly saveGroupBy: (board: KanbanBoardKind, groupBy: KanbanGroupBy) => void;
	readonly saveShowSubtasks: (show: boolean) => void;
	/** Forgets the board's grouping and "Show subtasks", back to the defaults. */
	readonly reset: (board: KanbanBoardKind) => void;
}

/** The signed-in person's board preferences, and the writes behind the toolbar's choices. */
export function useKanbanBoardPreferences(): KanbanBoardPreferences {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const query = api.auth.preferences.useQuery(undefined);
	const refresh = React.useCallback((): void => {
		void queryClient.invalidateQueries({ queryKey: apiRouter.auth.preferences.scopeKey(undefined) });
	}, [queryClient]);
	const onError = React.useCallback((error: Error): void => {
		toastMutationError("Could not remember that choice", error);
	}, []);
	const setPreference = api.auth.setPreference.useMutation({ onSuccess: refresh, onError });
	const resetPreference = api.auth.resetPreference.useMutation({ onSuccess: refresh, onError });

	const saveGroupBy = React.useCallback(
		(board: KanbanBoardKind, groupBy: KanbanGroupBy): void => {
			setPreference.mutate({ key: GROUP_BY_KEY[board], value: groupBy });
		},
		[setPreference],
	);
	const saveShowSubtasks = React.useCallback(
		(show: boolean): void => {
			setPreference.mutate({ key: SHOW_SUBTASKS_KEY, value: show });
		},
		[setPreference],
	);
	const reset = React.useCallback(
		(board: KanbanBoardKind): void => {
			resetPreference.mutate({ key: GROUP_BY_KEY[board] });
			if (board === "EXECUTION") {
				resetPreference.mutate({ key: SHOW_SUBTASKS_KEY });
			}
		},
		[resetPreference],
	);
	return { preferences: query.data?.data.preferences ?? [], saveGroupBy, saveShowSubtasks, reset };
}
